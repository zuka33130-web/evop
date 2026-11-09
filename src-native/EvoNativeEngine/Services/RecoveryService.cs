using System.Diagnostics;
using EvoNativeEngine.Models;
namespace EvoNativeEngine.Services;

public sealed record GlobalRecoveryRequest(string Confirmation);
public sealed record RecoveryStep(string Kind, string Id, bool Success, string Message);
public sealed class RecoveryService(IOptimizationService operations, SmartCleanupService cleanup,
    DebloatService debloat, IBackupManager backups)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    public async Task<OperationResult> RestoreAllAsync(GlobalRecoveryRequest request)
    {
        if (request.Confirmation != "RESTAURAR TODO") throw new ArgumentException("Confirmación global requerida.");
        await gate.WaitAsync();
        var timer = Stopwatch.StartNew();
        var steps = new List<RecoveryStep>();
        try
        {
            // Individual executors retain their own locks, readback and original snapshots.
            try
            {
                var result = await operations.RestoreVerifiedAsync();
                steps.Add(new("operations", "verified", result.Success && result.Restored,
                    string.Join("\n", result.Logs) + (result.ErrorMessage is null ? "" : "\n" + result.ErrorMessage)));
            }
            catch (Exception ex) { steps.Add(new("operations", "verified", false, ex.Message)); }
            try
            {
                foreach (var receipt in await cleanup.ReceiptsAsync())
                {
                    if (receipt.Items.Count == 0) continue;
                    try
                    {
                        var result = await cleanup.RestoreAsync(receipt.Id);
                        steps.Add(new("cleanup", receipt.Id.ToString(), result.Items.Count == 0 && result.Errors.Count == 0,
                            result.Message + " " + string.Join("; ", result.Errors)));
                    }
                    catch (Exception ex) { steps.Add(new("cleanup", receipt.Id.ToString(), false, ex.Message)); }
                }
            }
            catch (Exception ex) { steps.Add(new("cleanup", "inventory", false, ex.Message)); }
            try
            {
                // No latest-100 truncation: global recovery must not silently skip older receipts.
                foreach (var receipt in await WorkflowReceipts.ReadAsync<DebloatReceipt>(backups, "debloat", r => r.Id, int.MaxValue))
                {
                    if (!receipt.Attempted.Any(p => receipt.Results.LastOrDefault(r => r.Name == p.Name) is not { Action: "restore", Success: true })) continue;
                    try
                    {
                        var result = await debloat.RestoreAsync(receipt.Id);
                        var latest = result.Attempted.Select(p => result.Results.LastOrDefault(r => r.Name == p.Name)).ToArray();
                        var success = latest.All(r => r is { Action: "restore", Success: true });
                        steps.Add(new("debloat", receipt.Id.ToString(), success, string.Join("; ", latest.Select(r => r?.Message ?? "Sin resultado verificable"))));
                    }
                    catch (Exception ex) { steps.Add(new("debloat", receipt.Id.ToString(), false, ex.Message)); }
                }
            }
            catch (Exception ex) { steps.Add(new("debloat", "inventory", false, ex.Message)); }
            bool ok = steps.All(s => s.Success);
            return new(ok, "recovery.all", "restore", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds,
                steps.Select(s => $"[{(s.Success ? "VERIFICADO" : "PENDIENTE")}] {s.Kind}/{s.Id}: {s.Message}").Append(
                    "Alcance: módulos con respaldo, archivos en cuarentena y registro Appx recuperable. No recupera archivos purgados, datos Appx eliminados ni procesos cerrados; no crea valores de fábrica.").ToList(),
                null, new { Steps = steps }, ok ? null : "Recuperación parcial. Respaldos fallidos conservados; revisa permisos, integridad y disponibilidad del payload Appx.", ok);
        }
        finally { gate.Release(); }
    }
}
