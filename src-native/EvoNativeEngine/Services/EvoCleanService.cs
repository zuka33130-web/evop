using System.Text.Json.Serialization;

namespace EvoNativeEngine.Services;
public class EvoCleanResult
{
    [JsonPropertyName("status")] public string Status { get; set; } = "error";
    [JsonPropertyName("mode")] public string Mode { get; set; } = "Scan";
    [JsonPropertyName("freedMB")] public double FreedMB { get; set; }
    [JsonPropertyName("scannedMB")] public double ScannedMB { get; set; }
    [JsonPropertyName("details")] public string Details { get; set; } = "";
    [JsonPropertyName("executedAtUtc")] public DateTime ExecutedAtUtc { get; set; } = DateTime.UtcNow;
    [JsonPropertyName("durationMs")] public long DurationMs { get; set; }
}
public interface IEvoCleanService { Task<EvoCleanResult> RunCleanAsync(string mode = "Scan"); }
// Compatibility endpoint: never execute the historical broad-deletion PS1.
public sealed class EvoCleanService(SmartCleanupService cleanup) : IEvoCleanService
{
    public async Task<EvoCleanResult> RunCleanAsync(string mode = "Scan")
    {
        if (!mode.Equals("Scan", StringComparison.OrdinalIgnoreCase))
            return new() { Mode = mode, Details = "La limpieza sin selección está deshabilitada. Usa Limpieza inteligente: vista previa, cuarentena y confirmación de purga." };
        var timer = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var plan = await cleanup.ScanAsync();
            return new() { Status = "success", DurationMs = timer.ElapsedMilliseconds, ScannedMB = plan.Items.Sum(i => i.Bytes) / 1048576.0,
                Details = $"{plan.Items.Count} candidatos. No se modificó nada. Usa la vista previa de Limpieza inteligente para seleccionar." };
        }
        catch (Exception ex) { return new() { Details = ex.Message, DurationMs = timer.ElapsedMilliseconds }; }
    }
}
