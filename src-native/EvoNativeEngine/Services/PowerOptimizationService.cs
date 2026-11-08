using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using EvoNativeEngine.Models;

namespace EvoNativeEngine.Services;

public interface IPowerSettings
{
    Guid ActiveScheme();
    void Activate(Guid scheme);
    uint ReadIdle(Guid scheme);
    void WriteIdle(Guid scheme, uint value);
}

/// <summary>Uses documented Windows power APIs; no localized command output parsing.</summary>
public sealed class WindowsPowerSettings : IPowerSettings
{
    private static readonly Guid Processor = new("54533251-82be-4824-96c1-47b60b740d00");
    private static readonly Guid IdleDisable = new("5d76a2ca-e8c0-402f-a133-2158492d58ad");
    private static void Check(uint code)
    {
        if (code != 0) throw new Win32Exception((int)code);
    }
    public Guid ActiveScheme()
    {
        Check(PowerGetActiveScheme(IntPtr.Zero, out var pointer));
        try { return Marshal.PtrToStructure<Guid>(pointer); }
        finally { LocalFree(pointer); }
    }
    public void Activate(Guid scheme) => Check(PowerSetActiveScheme(IntPtr.Zero, in scheme));
    public uint ReadIdle(Guid scheme)
    {
        Check(PowerReadACValueIndex(IntPtr.Zero, in scheme, in Processor, in IdleDisable, out var value));
        return value;
    }
    public void WriteIdle(Guid scheme, uint value) =>
        Check(PowerWriteACValueIndex(IntPtr.Zero, in scheme, in Processor, in IdleDisable, value));

    [DllImport("powrprof.dll")] private static extern uint PowerGetActiveScheme(IntPtr root, out IntPtr scheme);
    [DllImport("powrprof.dll")] private static extern uint PowerSetActiveScheme(IntPtr root, in Guid scheme);
    [DllImport("powrprof.dll")] private static extern uint PowerReadACValueIndex(IntPtr root, in Guid scheme, in Guid subgroup, in Guid setting, out uint value);
    [DllImport("powrprof.dll")] private static extern uint PowerWriteACValueIndex(IntPtr root, in Guid scheme, in Guid subgroup, in Guid setting, uint value);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}

public sealed class PowerOptimizationService(IBackupManager backups, IPowerSettings power)
{
    // A versioned key prevents old guessed snapshots from being interpreted as real state.
    public sealed record Snapshot(int Version, string Operation, Guid Scheme, uint? IdleAc);
    private static readonly Guid HighPerformance = new("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
    private static readonly SemaphoreSlim Gate = LibraryOptimizationService.Gate;
    public bool Supports(string id) => id is "cortex.mode.nucleo" or "tweak.cpu.idledisable";

    public async Task<OperationResult> ExecuteAsync(string id, bool restore)
    {
        var timer = Stopwatch.StartNew();
        var logs = new List<string>();
        var key = $"verified.v1.{id}";
        Snapshot? before = null;
        await Gate.WaitAsync();
        try
        {
            if (!Supports(id)) throw new NotSupportedException(id);
            var active = power.ActiveScheme();
            var idle = id == "tweak.cpu.idledisable";
            before = new Snapshot(1, id, active, idle ? power.ReadIdle(active) : null);
            Snapshot original;
            if (backups.HasBackup(key))
            {
                original = await backups.GetLastStateAsync<Snapshot>(key)
                    ?? throw new IOException("Respaldo ilegible; no se modificó el sistema.");
                if (original.Version != 1 || original.Operation != id || original.Scheme == Guid.Empty ||
                    (idle && original.IdleAc is not (0 or 1)))
                    throw new IOException("Respaldo incompatible; no se modificó el sistema.");
            }
            else
            {
                if (restore) throw new InvalidOperationException("No existe un respaldo verificado para restaurar.");
                original = before;
                await backups.SaveStateAsync(key, original);
            }
            if (idle)
            {
                // Once applied, never redirect the operation to another plan on reapply.
                if (!restore && active != original.Scheme)
                    throw new InvalidOperationException("Cambió el plan activo. Restaura el ajuste anterior antes de aplicarlo a otro plan.");
                var value = restore ? original.IdleAc!.Value : 1u;
                power.WriteIdle(original.Scheme, value);
                // Refresh only if still active: restoration must not switch an unrelated plan.
                if (power.ActiveScheme() == original.Scheme) power.Activate(original.Scheme);
                if (power.ReadIdle(original.Scheme) != value) throw new IOException("No se verificó IDLEDISABLE.");
            }
            else
            {
                var target = restore ? original.Scheme : HighPerformance;
                power.Activate(target); // Returns an error if this plan is unavailable, e.g. Modern Standby.
                if (power.ActiveScheme() != target) throw new IOException("No se verificó el plan activo.");
            }
            if (restore) await backups.ClearBackupAsync(key);
            logs.Add(idle ? "IDLEDISABLE AC leído y verificado. No modifica el perfil de batería. Puede aumentar consumo y temperatura."
                : "Plan de energía activo leído y verificado. No modifica BCD ni TRIM.");
            return new(true, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, before, new { Verified = true }, null, restore);
        }
        catch (Exception ex)
        {
            logs.Add("Fallo; respaldo conservado para recuperación: " + ex.Message);
            return new(false, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, before, null, ex.Message, false);
        }
        finally { Gate.Release(); }
    }
}
