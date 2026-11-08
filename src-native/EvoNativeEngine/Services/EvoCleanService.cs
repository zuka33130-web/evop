using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace EvoNativeEngine.Services
{
    public class EvoCleanResult
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = "success";

        [JsonPropertyName("mode")]
        public string Mode { get; set; } = "Scan";

        [JsonPropertyName("freedMB")]
        public double FreedMB { get; set; }

        [JsonPropertyName("scannedMB")]
        public double ScannedMB { get; set; }

        [JsonPropertyName("details")]
        public string Details { get; set; } = string.Empty;

        [JsonPropertyName("executedAtUtc")]
        public DateTime ExecutedAtUtc { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("durationMs")]
        public long DurationMs { get; set; }
    }

    public interface IEvoCleanService
    {
        Task<EvoCleanResult> RunCleanAsync(string mode = "Scan");
    }

    public class EvoCleanService : IEvoCleanService
    {
        private readonly ILogger<EvoCleanService> _logger;
        private readonly ISecurityService _security;
        private readonly IOptimizationService _optimizationService;

        public EvoCleanService(
            ILogger<EvoCleanService> logger, 
            ISecurityService security,
            IOptimizationService optimizationService)
        {
            _logger = logger;
            _security = security;
            _optimizationService = optimizationService;
        }

        public async Task<EvoCleanResult> RunCleanAsync(string mode = "Scan")
        {
            var sw = Stopwatch.StartNew();
            string validMode = mode.Equals("Clean", StringComparison.OrdinalIgnoreCase) ? "Clean" : "Scan";

            _logger.LogInformation("Iniciando EvoCleanService en modo: {Mode}", validMode);

            // Validar ruta del script PowerShell
            string[] possiblePaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Scripts", "Invoke-EvoClean.ps1"),
                Path.Combine(Directory.GetCurrentDirectory(), "Scripts", "Invoke-EvoClean.ps1"),
                Path.Combine(Directory.GetCurrentDirectory(), "src-native", "EvoNativeEngine", "Scripts", "Invoke-EvoClean.ps1"),
                Path.Combine(Directory.GetCurrentDirectory(), "scripts", "Invoke-EvoClean.ps1")
            };

            string scriptPath = string.Empty;
            foreach (var path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    scriptPath = path;
                    break;
                }
            }

            if (string.IsNullOrEmpty(scriptPath))
            {
                return new EvoCleanResult { Status = "error", Mode = validMode,
                    Details = "No se encontró Invoke-EvoClean.ps1. No se ejecutó ninguna limpieza." };
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\" -Mode {validMode}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using var process = Process.Start(psi);
                if (process == null)
                {
                    throw new InvalidOperationException("No se pudo arrancar el proceso de PowerShell.");
                }

                string stdout = await process.StandardOutput.ReadToEndAsync();
                string stderr = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                sw.Stop();

                _logger.LogInformation("Invoke-EvoClean.ps1 completado con código {ExitCode} en {Duration}ms", process.ExitCode, sw.ElapsedMilliseconds);

                if (process.ExitCode != 0) throw new InvalidOperationException($"PowerShell: {stderr}");

                if (!string.IsNullOrWhiteSpace(stdout))
                {
                    try
                    {
                        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                        var parsed = JsonSerializer.Deserialize<EvoCleanResult>(stdout, options);
                        if (parsed != null)
                        {
                            parsed.DurationMs = sw.ElapsedMilliseconds;
                            parsed.ExecutedAtUtc = DateTime.UtcNow;

                            _logger.LogInformation("EvoClean exitoso: FreedMB={FreedMB}, ScannedMB={ScannedMB}", parsed.FreedMB, parsed.ScannedMB);
                            return parsed;
                        }
                    }
                    catch (Exception jsonEx)
                    {
                        _logger.LogWarning(jsonEx, "No se pudo parsear el JSON de Invoke-EvoClean.ps1. Salida cruda: {Stdout}", stdout);
                    }
                }

                return new EvoCleanResult
                {
                    Status = "error",
                    Mode = validMode,
                    FreedMB = 0,
                    ScannedMB = 0,
                    Details = string.IsNullOrWhiteSpace(stdout) ? (stderr ?? "Ejecutado sin errores.") : stdout,
                    DurationMs = sw.ElapsedMilliseconds
                };
            }
            catch (Exception ex)
            {
                sw.Stop();
                _logger.LogError(ex, "Error al ejecutar Invoke-EvoClean.ps1");

                return new EvoCleanResult
                {
                    Status = "error",
                    Mode = validMode,
                    FreedMB = 0,
                    ScannedMB = 0,
                    Details = $"Error en servicio C#: {ex.Message}",
                    DurationMs = sw.ElapsedMilliseconds
                };
            }
        }
    }
}
