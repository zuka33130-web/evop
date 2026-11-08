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
    context.Response.Headers.Append("X-Evo-Engine-Version", "1.0.0");
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
        Version: "1.0.0",
        EngineName: "EvoNativeEngine (C# .NET 8 Core)",
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
            "POST /api/diagnostics/refresh"
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

// Endpoint raíz informativo
app.MapGet("/", () => Results.Json(new
{
    name = "EVOOPTIMIZER Native Engine",
    version = "1.0.0",
    status = "Active",
    listenAddress = $"http://127.0.0.1:{port}",
    docs = "Visita /api/status o /api/diagnostics desde la aplicación web o cliente Tauri."
}));

app.Logger.LogInformation("=================================================");
app.Logger.LogInformation("EVOOPTIMIZER Native Engine - Windows 11 Optimization Bridge");
app.Logger.LogInformation("Escuchando en: http://127.0.0.1:{Port}", port);
app.Logger.LogInformation("Seguridad: Modo de solo lectura activado (Regla 5)");
app.Logger.LogInformation("=================================================");

app.Run();
