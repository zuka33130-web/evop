using System;
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
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
if (int.TryParse(Environment.GetEnvironmentVariable("EVO_ENGINE_PORT"), out int customPort))
{
    port = customPort;
}

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
builder.Services.AddSingleton<BenchmarkSessionService>();

// CORS: Permitir exclusivamente solicitudes de clientes locales (Vite dev server, Tauri, etc.)
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalIpcPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;
            var uri = new Uri(origin);
            return uri.Host is "localhost" or "127.0.0.1" || origin.StartsWith("tauri://") || origin.StartsWith("http://localhost:") || origin.StartsWith("http://127.0.0.1:");
        })
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("LocalIpcPolicy");

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

// Endpoint raíz informativo
app.MapGet("/", () => Results.Json(new
{
    name = "EVOOPTIMIZER Native Engine",
    version = "1.1.0",
    status = "Active",
    listenAddress = $"http://127.0.0.1:{port}",
    docs = "Motor de Operaciones Reales de Windows 11 conectado. Visita /api/operations para ver el catálogo."
}));

app.Logger.LogInformation("=================================================");
app.Logger.LogInformation("EVOOPTIMIZER Native Engine 1.1 - Motor Real de Operaciones");
app.Logger.LogInformation("Escuchando en: http://127.0.0.1:{Port}", port);
app.Logger.LogInformation("Seguridad: Enlace exclusivo Loopback (Regla 5)");
app.Logger.LogInformation("=================================================");

app.Run();
