using System.Diagnostics;
using EvoNativeEngine.Models;

namespace EvoNativeEngine.Services;

public sealed record GameProcessState(int Pid, long StartedUtcTicks, string Name, ProcessPriorityClass Priority, long Affinity);
public interface IGameProcess : IDisposable
{
    GameProcessState Read();
    void SetPriority(ProcessPriorityClass priority);
    void SetAffinity(long mask);
}
public interface IGameProcessProvider { IGameProcess OpenCs2(); }
public sealed class WindowsGameProcessProvider : IGameProcessProvider
{
    public IGameProcess OpenCs2()
    {
        var processes = Process.GetProcessesByName("cs2");
        if (processes.Length != 1)
        {
            foreach (var process in processes) process.Dispose();
            throw new InvalidOperationException("Debe haber exactamente una instancia de cs2.exe abierta.");
        }
        return new WindowsGameProcess(processes[0]);
    }
    private sealed class WindowsGameProcess(Process process) : IGameProcess
    {
        public GameProcessState Read()
        {
            process.Refresh();
            if (process.HasExited) throw new InvalidOperationException("La instancia de CS2 terminó.");
            return new(process.Id, process.StartTime.ToUniversalTime().Ticks, process.ProcessName,
                process.PriorityClass, (long)process.ProcessorAffinity);
        }
        public void SetPriority(ProcessPriorityClass priority) => process.PriorityClass = priority;
        public void SetAffinity(long mask) => process.ProcessorAffinity = (IntPtr)mask;
        public void Dispose() => process.Dispose();
    }
}

/// <summary>Priority and affinity are independent; defaults never guess CPU topology.</summary>
public sealed class GameOptimizationService(IBackupManager backups, IGameProcessProvider processes)
{
    public const string BackupKey = "verified.v1.gaming.cs2.process";
    public sealed record Snapshot(int Version, GameProcessState Original, bool PriorityTouched, bool AffinityTouched);
    private static readonly SemaphoreSlim Gate = new(1, 1);
    public bool Supports(string id) => id is "gaming.cs2.priority" or "gaming.cs2.priority.restore"
        or "cortex.mode.bestia" or "tweak.cpu.affinity_15";
    private static bool SameInstance(GameProcessState left, GameProcessState right) =>
        left.Pid == right.Pid && left.StartedUtcTicks == right.StartedUtcTicks &&
        string.Equals(left.Name, right.Name, StringComparison.OrdinalIgnoreCase);

    public async Task<OperationResult> ExecuteAsync(string id, bool restore)
    {
        restore |= id == "gaming.cs2.priority.restore";
        var timer = Stopwatch.StartNew();
        var logs = new List<string>();
        GameProcessState? before = null;
        await Gate.WaitAsync();
        try
        {
            if (!Supports(id)) throw new NotSupportedException(id);
            using var process = processes.OpenCs2();
            before = process.Read();
            if (!string.Equals(before.Name, "cs2", StringComparison.OrdinalIgnoreCase) || before.Pid <= 0 || before.StartedUtcTicks <= 0 || before.Affinity == 0)
                throw new IOException("Identidad/estado del proceso no válido.");
            Snapshot snapshot;
            if (backups.HasBackup(BackupKey))
            {
                snapshot = await backups.GetLastStateAsync<Snapshot>(BackupKey)
                    ?? throw new IOException("Respaldo ilegible; no se modificó el proceso.");
                if (snapshot.Version != 1 || snapshot.Original is null || !SameInstance(snapshot.Original, before) ||
                    !Enum.IsDefined(snapshot.Original.Priority) || snapshot.Original.Affinity == 0)
                    throw new IOException("El respaldo no pertenece a esta instancia de CS2. No se modificó ni se eliminó.");
            }
            else
            {
                if (restore) throw new IOException("No existe respaldo verificado para este proceso.");
                snapshot = new(1, before, false, false);
            }
            if (!restore)
            {
                var affinityOnly = id == "tweak.cpu.affinity_15";
                if (affinityOnly && (before.Affinity & 15) != 15)
                    throw new NotSupportedException("La máscara 15 no está disponible en la afinidad actual del proceso.");
                snapshot = snapshot with { PriorityTouched = snapshot.PriorityTouched || !affinityOnly,
                    AffinityTouched = snapshot.AffinityTouched || affinityOnly };
                // Persist intent before writing, so a partial failure is recoverable.
                await backups.SaveStateAsync(BackupKey, snapshot);
                if (affinityOnly) process.SetAffinity(15);
                else process.SetPriority(ProcessPriorityClass.High);
            }
            else
            {
                if (snapshot.PriorityTouched) process.SetPriority(snapshot.Original.Priority);
                if (snapshot.AffinityTouched) process.SetAffinity(snapshot.Original.Affinity);
            }
            var actual = process.Read();
            if (!SameInstance(before, actual)) throw new IOException("La instancia del proceso cambió durante la operación.");
            var priority = restore ? snapshot.Original.Priority : ProcessPriorityClass.High;
            var affinity = restore ? snapshot.Original.Affinity : 15L;
            if ((restore ? snapshot.PriorityTouched : id != "tweak.cpu.affinity_15") && actual.Priority != priority ||
                (restore ? snapshot.AffinityTouched : id == "tweak.cpu.affinity_15") && actual.Affinity != affinity)
                throw new IOException("La lectura posterior no confirma el cambio; respaldo conservado.");
            if (restore) await backups.ClearBackupAsync(BackupKey);
            logs.Add($"CS2 PID {actual.Pid}, inicio {actual.StartedUtcTicks}: estado verificado.");
            logs.Add(id == "tweak.cpu.affinity_15" ? "Máscara explícita 15: no detecta P-Cores; evaluar frametimes antes/después."
                : "La prioridad no altera afinidad, no desactiva E-Cores y no garantiza más FPS.");
            return new(true, id, restore ? "restore" : "apply", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds,
                logs, before, actual, null, restore);
        }
        catch (Exception ex)
        {
            logs.Add("Operación incompleta; no se descarta el respaldo: " + ex.Message);
            return new(false, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, before, null, ex.Message, false);
        }
        finally { Gate.Release(); }
    }
}
