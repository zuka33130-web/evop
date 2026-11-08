using System;
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using Microsoft.Extensions.FileProviders;
using EvoNativeEngine.Models;
using EvoNativeEngine.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// Hold an exclusive file handle for the full process lifetime. Even with a custom
// port, a second engine for this user must not race on the same snapshot files.
var stateDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer");
Directory.CreateDirectory(stateDirectory);
using var instanceLock = new FileStream(Path.Combine(stateDirectory, "engine.lock"),
    FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);

var builder = WebApplication.CreateBuilder(args);

// Configuración de Kestrel: enlace estricto y exclusivo a Loopback (127.0.0.1)
const int defaultPort = 48120;
int port = defaultPort;
if (int.TryParse(Environment.GetEnvironmentVariable("EVO_ENGINE_PORT"), out int customPort) && customPort is > 0 and <= 65535)
{
    port = customPort;
}

var sessionAuthentication = new SessionAuthentication(Environment.GetEnvironmentVariable("EVO_ENGINE_TOKEN"));
var frontendDirectory = Path.Combine(AppContext.BaseDirectory, "wwwroot");
var hasFrontend = File.Exists(Path.Combine(frontendDirectory, "index.html"));

builder.WebHost.ConfigureKestrel(options =>
{
    // Solo escucha en 127.0.0.1 para máxima seguridad local
    options.Listen(IPAddress.Loopback, port);
});

// Configuración de servicios e inyección de dependencias
builder.Services.AddSingleton<ISecurityService, SecurityService>();
builder.Services.AddSingleton<IBackupManager, BackupManager>();
builder.Services.AddSingleton<IDiagnosticsService, DiagnosticsService>();
builder.Services.AddSingleton<IOptimizationService, OptimizationService>();
builder.Services.AddSingleton<IEvoCleanService, EvoCleanService>();
builder.Services.AddSingleton<OperationJournal>();
builder.Services.AddSingleton<BenchmarkSessionService>();
builder.Services.AddSingleton<OptimizationExperimentService>();
builder.Services.AddSingleton<SmartCleanupService>();
builder.Services.AddSingleton<LocalAuditAdvisor>();
builder.Services.AddSingleton<OptimizationTemplateService>();
builder.Services.AddSingleton<IOptionalApplications, WindowsOptionalApplications>();
builder.Services.AddSingleton<BeastSessionService>();
builder.Services.AddSingleton<IOptionalPackages, WindowsOptionalPackages>();
builder.Services.AddSingleton<DebloatService>();

// CORS: Permitir exclusivamente solicitudes de clientes locales (Vite dev server, Tauri, etc.)
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalIpcPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            return SessionAuthentication.IsLocalOrigin(origin, port) ||
                (!sessionAuthentication.Required && SessionAuthentication.IsLocalOrigin(origin, 3000));
        })
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("LocalIpcPolicy");
app.Use(async (context, next) =>
{
    // Reject DNS-rebinding hosts even in standalone development mode.
    if (context.Request.Host.Host is not ("127.0.0.1" or "localhost"))
    { context.Response.StatusCode = 403; return; }
    if (sessionAuthentication.Required)
    {
        var candidate = context.Request.Headers["X-Evo-Session"].FirstOrDefault() ?? context.Request.Cookies["EvoSession"];
        if (!sessionAuthentication.Authorize(candidate))
        { context.Response.StatusCode = 401; return; }
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrEmpty(origin) && !SessionAuthentication.IsLocalOrigin(origin, port))
        { context.Response.StatusCode = 403; return; }
    }
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    if (hasFrontend) context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'";
    await next();
});
if (hasFrontend)
{
    var provider = new PhysicalFileProvider(frontendDirectory);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = provider });
}

app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) && context.Request.Path.StartsWithSegments("/api/clean"))
        context.RequestServices.GetRequiredService<OperationJournal>().Touch();
    await next();
});


var startedAt = DateTime.UtcNow;
var process = Process.GetCurrentProcess();

// Middleware de logging y cabeceras de seguridad
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Evo-Engine-Version", "1.1.0");
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    await next();
});

// Endpoint: Estado y verificación de enlace IPC
app.MapGet("/api/status", (ISecurityService security) =>
{
    var uptime = (DateTime.UtcNow - startedAt).TotalSeconds;
    var isElevated = security.IsElevated();

    return Results.Ok(new EngineStatusResponse(
        IsReady: true,
        Version: "1.1.0",
        EngineName: "EvoNativeEngine (C# .NET 8 Real Operations Engine)",
        IsElevated: isElevated,
        ProcessId: process.Id,
        UptimeSeconds: Math.Round(uptime, 2),
        OperatingSystem: RuntimeInformation.OSDescription,
        Architecture: RuntimeInformation.ProcessArchitecture.ToString(),
        StartedAtUtc: startedAt,
        SupportedEndpoints: new[]
        {
            "GET /api/status",
            "GET /api/diagnostics",
            "POST /api/diagnostics/refresh",
            "GET /api/operations",
            "POST /api/operations/{id}/apply",
            "POST /api/operations/{id}/restore",
            "GET /api/operations/history",
            "GET /api/operations/{id}/status"
        }
    ));
});

// Endpoint: Diagnóstico real de solo lectura del hardware
app.MapGet("/api/diagnostics", async (IDiagnosticsService diagnostics) =>
{
    try
    {
        var report = await diagnostics.GetSystemHardwareReportAsync(forceRefresh: false);
        return Results.Ok(report);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error al generar el diagnóstico de hardware.");
        return Results.Problem(
            detail: ex.Message,
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error en diagnóstico de hardware del sistema"
        );
    }
});

// Endpoint: Forzar refresco del diagnóstico en vivo
app.MapPost("/api/diagnostics/refresh", async (IDiagnosticsService diagnostics, ISecurityService security) =>
{
    if (!security.ValidateWhitelistedAction("diagnostics.refresh"))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    try
    {
        var report = await diagnostics.GetSystemHardwareReportAsync(forceRefresh: true);
        return Results.Ok(report);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error al refrescar el diagnóstico de hardware.");
        return Results.Problem(
            detail: ex.Message,
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error al actualizar diagnóstico"
        );
    }
});

// Endpoints de Operaciones Reales (Implementación 01)
// Catálogo de operaciones disponibles
app.MapGet("/api/operations", async (IOptimizationService ops) =>
{
    var catalog = await ops.GetCatalogAsync();
    return Results.Ok(catalog);
});

// Aplicar operación real
app.MapPost("/api/operations/{id}/apply", async (string id, IOptimizationService ops) =>
{
    var result = await ops.ApplyOperationAsync(id);
    return Results.Ok(result);
});

// Restaurar operación
app.MapPost("/api/operations/{id}/restore", async (string id, IOptimizationService ops) =>
{
    var result = await ops.RestoreOperationAsync(id);
    return Results.Ok(result);
});

// Historial de operaciones ejecutadas
app.MapGet("/api/operations/history", async (IOptimizationService ops) =>
{
    var history = await ops.GetHistoryAsync();
    return Results.Ok(history);
});

// Consultar estado de una operación
app.MapGet("/api/operations/{id}/status", async (string id, IOptimizationService ops) =>
{
    var status = await ops.GetOperationStatusAsync(id);
    return Results.Ok(status);
});

// Telemetría en tiempo real desde Windows
app.MapGet("/api/telemetry/realtime", async (IOptimizationService ops) =>
{
    var telemetry = await ops.GetRealtimeTelemetryAsync();
    return Results.Ok(telemetry);
});

// Endpoints de Limpieza Profunda (EvoClean)
app.MapGet("/api/clean/scan", async (IEvoCleanService cleanService) =>
{
    var result = await cleanService.RunCleanAsync("Scan");
    return Results.Ok(result);
});

app.MapPost("/api/clean/scan", async (IEvoCleanService cleanService) =>
{
    var result = await cleanService.RunCleanAsync("Scan");
    return Results.Ok(result);
});

app.MapPost("/api/clean/execute", async (IEvoCleanService cleanService) =>
{
    var result = await cleanService.RunCleanAsync("Clean");
    return Results.Ok(result);
});

app.MapPost("/api/clean/apply", async (IEvoCleanService cleanService) =>
{
    var result = await cleanService.RunCleanAsync("Clean");
    return Results.Ok(result);
});

app.MapGet("/api/benchmarks/runs", (BenchmarkSessionService sessions) => Results.Ok(sessions.List()));
app.MapGet("/api/benchmarks/readiness", (string? processName) => Results.Ok(BenchmarkSessionService.Readiness(processName ?? "cs2.exe")));

// Measured frame intervals only. Session IDs are server-owned and expire on restart.
app.MapPost("/api/benchmarks/import", (BenchmarkInput input, BenchmarkSessionService sessions) =>
{
    try { return Results.Ok(sessions.Import(input)); }
    catch (Exception ex) when (ex is ArgumentException or Microsoft.VisualBasic.FileIO.MalformedLineException)
    { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/benchmarks/compare", (Guid[] ids, BenchmarkSessionService sessions) =>
{
    try { return Results.Ok(sessions.Compare(ids)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/benchmarks/capture", async (CaptureRequest request, BenchmarkSessionService sessions, HttpContext context) =>
{
    try { return Results.Ok(await sessions.CaptureAsync(request, context.RequestAborted)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/benchmarks/experiments/active", (OptimizationExperimentService experiments) => Results.Ok(experiments.Active));
app.MapPost("/api/benchmarks/experiments/start", async (ExperimentStart request, OptimizationExperimentService experiments) =>
{
    try { return Results.Ok(await experiments.StartAsync(request)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/benchmarks/experiments/evaluate", (ExperimentEvaluation request, OptimizationExperimentService experiments) =>
{
    try { return Results.Ok(experiments.Evaluate(request)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/benchmarks/experiments/restore", async (ExperimentEvaluation request, OptimizationExperimentService experiments) =>
{
    try { return Results.Ok(await experiments.RestoreAsync(request.Id)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// Fixed Settings URIs only: open supported system UI instead of undocumented registry guesses.
app.MapPost("/api/system/settings/{id}", (string id) =>
{
    var pages = new Dictionary<string, string> {
        ["graphics"] = "ms-settings:display-advancedgraphics", ["display"] = "ms-settings:display-advanced",
        ["startup"] = "ms-settings:startupapps", ["captures"] = "ms-settings:gaming-gamedvr",
        ["gamemode"] = "ms-settings:gaming-gamemode", ["storage"] = "ms-settings:storagesense"
    };
    if (!OperatingSystem.IsWindows() || !pages.TryGetValue(id, out var uri))
        return Results.BadRequest(new { error = "Página no admitida o sistema distinto de Windows." });
    try
    {
        Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
        return Results.Ok(new { opened = id, changed = false });
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPost("/api/desktop/shutdown", (IHostApplicationLifetime lifetime) =>
{
    if (!sessionAuthentication.Required) return Results.NotFound();
    _ = Task.Run(async () => { await Task.Delay(200); lifetime.StopApplication(); });
    return Results.Ok(new { stopping = true });
});

app.MapPost("/api/cleanup/preview", async (SmartCleanupService cleanup) =>
{
    try { return Results.Ok(await cleanup.ScanAsync()); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/cleanup/quarantine", async (CleanupSelection selection, SmartCleanupService cleanup) =>
{
    try { return Results.Ok(await cleanup.QuarantineAsync(selection)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/cleanup/restore/{id:guid}", async (Guid id, SmartCleanupService cleanup) =>
{
    try { return Results.Ok(await cleanup.RestoreAsync(id)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/cleanup/purge/{id:guid}", async (Guid id, PurgeConfirmation request, SmartCleanupService cleanup) =>
{
    try { return Results.Ok(await cleanup.PurgeAsync(id, request.Confirmation)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapGet("/api/advisor/audit", async (LocalAuditAdvisor advisor) =>
{
    try { return Results.Ok(await advisor.AuditAsync()); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPost("/api/recovery/verified", async (IOptimizationService operations) => Results.Ok(await operations.RestoreVerifiedAsync()));
app.MapPost("/api/recovery/cs2-expired", async (IBackupManager backups) =>
{
    try { return Results.Ok(new { message = await new GameOptimizationService(backups, new WindowsGameProcessProvider()).RetireExpiredAsync() }); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/library", () => Results.Ok(OptimizationLibrary.Definitions.Values));
app.MapGet("/api/templates", () => Results.Ok(OptimizationTemplateService.Templates));
app.MapGet("/api/templates/receipts", async (OptimizationTemplateService service) => Results.Ok(await service.ReceiptsAsync()));
app.MapGet("/api/templates/{id}/preview", async (string id, OptimizationTemplateService service) =>
{
    try { return Results.Ok(await service.PreviewAsync(id)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/templates/{id}/apply", async (string id, TemplateRequest request, OptimizationTemplateService service) =>
{
    try { return Results.Ok(await service.ApplyAsync(id, request)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/templates/receipts/{id:guid}/restore", async (Guid id, OptimizationTemplateService service) =>
{
    try { return Results.Ok(await service.RestoreAsync(id)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapGet("/api/beast/receipts", async (BeastSessionService service) => Results.Ok(await service.ReceiptsAsync()));
app.MapGet("/api/debloat/receipts", async (DebloatService service) => Results.Ok(await service.ReceiptsAsync()));
app.MapPost("/api/beast/preview", (BeastSessionService service) =>
{
    try { return Results.Ok(service.Preview()); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/beast/start", async (BeastRequest request, BeastSessionService service) =>
{
    try { return Results.Ok(await service.StartAsync(request)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/debloat/preview", async (DebloatService service) =>
{
    try { return Results.Ok(await service.PreviewAsync()); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/debloat/remove", async (DebloatRequest request, DebloatService service) =>
{
    try { return Results.Ok(await service.RemoveAsync(request)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/debloat/restore/{id:guid}", async (Guid id, DebloatService service) =>
{
    try { return Results.Ok(await service.RestoreAsync(id)); } catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// Endpoint raíz informativo en modo API; en escritorio se sirve React desde wwwroot.
if (!hasFrontend) app.MapGet("/", () => Results.Json(new
{
    name = "EVOOPTIMIZER Native Engine",
    version = "1.1.0",
    status = "Active",
    listenAddress = $"http://127.0.0.1:{port}",
    docs = "Motor de Operaciones Reales de Windows 11 conectado. Visita /api/operations para ver el catálogo."
}));

if (!sessionAuthentication.Required) app.Logger.LogWarning("Modo local de desarrollo SIN autenticación. No exponer ni redirigir el puerto; escritorio debe iniciar con EVO_ENGINE_TOKEN.");
app.Logger.LogInformation("=================================================");
app.Logger.LogInformation("EVOOPTIMIZER Native Engine 1.1 - Motor Real de Operaciones");
app.Logger.LogInformation("Escuchando en: http://127.0.0.1:{Port}", port);
app.Logger.LogInformation("Seguridad: Enlace exclusivo Loopback (Regla 5)");
app.Logger.LogInformation("=================================================");

app.Run();

public sealed record PurgeConfirmation(string Confirmation);
