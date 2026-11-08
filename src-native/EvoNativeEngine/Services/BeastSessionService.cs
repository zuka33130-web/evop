using System.Diagnostics;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Security.Principal;
using EvoNativeEngine.Models;
namespace EvoNativeEngine.Services;

public sealed record OptionalProcess(int Pid, long StartedTicks, string Name, string Path, double WorkingSetMb);
public sealed record BeastPlan(Guid Id, DateTime ExpiresUtc, OptionalProcess[] Candidates, string[] Protected, string Warning);
public sealed record BeastRequest(Guid PlanId, int[] Pids, bool ForceSelected, bool ApplyGamingBase, bool HighPriority, string Confirmation);
public sealed record ClosedApplication(int Pid, string Name, string Outcome, bool Exited);
public sealed record BeastReceipt(Guid Id, DateTime CreatedUtc, List<ClosedApplication> Applications,
    TemplateReceipt? Template, List<OperationResult> Operations, bool Finished, string[] Limitations);
public interface IOptionalApplications
{
    OptionalProcess[] Scan();
    Task<ClosedApplication> CloseAsync(OptionalProcess process, bool force);
}
public sealed class WindowsOptionalApplications : IOptionalApplications
{
    // Only optional interactive apps. Never broad "everything except" filtering, child-tree killing or sync client termination.
    private static readonly HashSet<string> AllowedNames = new(StringComparer.OrdinalIgnoreCase) { "chrome", "msedge", "firefox", "brave", "opera", "Discord", "Spotify", "Teams", "ms-teams", "EpicGamesLauncher" };
    public static bool AllowedName(string name) => AllowedNames.Contains(name);
    private static bool Safe(Process process, out string path)
    {
        path = "";
        if (!OperatingSystem.IsWindows() || process.Id == Environment.ProcessId || !AllowedName(process.ProcessName)) return false;
        using var self = Process.GetCurrentProcess();
        if (process.SessionId != self.SessionId) return false;
        if (!IsProcessCritical(process.Handle, out var critical) || critical) return false;
        if (!OpenProcessToken(process.Handle, 8 /* TOKEN_QUERY */, out var token)) return false;
        try { using var identity = new WindowsIdentity(token); if (identity.User?.Value != WindowsIdentity.GetCurrent().User?.Value) return false; }
        finally { CloseHandle(token); }
        path = process.MainModule?.FileName ?? "";
        var windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows).TrimEnd('\\') + "\\";
        return Path.IsPathFullyQualified(path) && !path.StartsWith(windows, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(Path.GetFileNameWithoutExtension(path), process.ProcessName, StringComparison.OrdinalIgnoreCase);
    }
    public OptionalProcess[] Scan()
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Requiere Windows.");
        var found = new List<OptionalProcess>();
        foreach (var process in Process.GetProcesses())
        {
            using (process) try { if (Safe(process, out var path)) found.Add(new(process.Id, process.StartTime.ToUniversalTime().Ticks, process.ProcessName, path, process.WorkingSet64 / 1048576d)); } catch { /* inaccessible => not eligible */ }
        }
        return found.OrderByDescending(p => p.WorkingSetMb).Take(100).ToArray();
    }
    public async Task<ClosedApplication> CloseAsync(OptionalProcess selected, bool force)
    {
        try
        {
            using var process = Process.GetProcessById(selected.Pid);
            if (!Safe(process, out var path) || process.StartTime.ToUniversalTime().Ticks != selected.StartedTicks ||
                process.ProcessName != selected.Name || !string.Equals(path, selected.Path, StringComparison.OrdinalIgnoreCase))
                throw new IOException("PID/identidad/permisos cambiaron. No se cerró.");
            if (force) process.Kill(entireProcessTree: false);
            else if (!process.CloseMainWindow()) return new(selected.Pid, selected.Name, "Sin ventana cerrable: no se forzó; permanece activo.", false);
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { return new(selected.Pid, selected.Name, "No terminó en 3 s; no se escaló a cierre forzado.", false); }
            return new(selected.Pid, selected.Name, force ? "Proceso elegido terminado forzosamente; datos no guardados pueden perderse." : "Cierre normal confirmado.", true);
        }
        catch (Exception ex) { return new(selected.Pid, selected.Name, ex.Message, false); }
    }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool IsProcessCritical(IntPtr process, out bool critical);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
public sealed class BeastSessionService(IOptionalApplications applications, IOptimizationService operations,
    OptimizationTemplateService templates, IBackupManager backups, OperationJournal journal)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly ConcurrentDictionary<Guid, BeastPlan> plans = new();
    public BeastPlan Preview()
    {
        foreach (var entry in plans.Where(p => p.Value.ExpiresUtc < DateTime.UtcNow)) plans.TryRemove(entry.Key, out _);
        if (plans.Count >= 10) throw new InvalidOperationException("Espera a que expire la vista previa anterior.");
        var plan = new BeastPlan(Guid.NewGuid(), DateTime.UtcNow.AddMinutes(2), applications.Scan(),
            ["Windows y drivers", "Defender/seguridad", "Steam y steamwebhelper", "CS2 y anticheat", "Audio, red y servicios esenciales", "Explorador, WebView2 y EVO", "Clientes de sincronización y apps no incluidas"],
            "Selecciona aplicaciones opcionales. Nada se cierra por defecto. Cierre forzado puede perder datos y no se puede deshacer. No es posible dejar únicamente CS2 sin dependencias de Windows.");
        plans[plan.Id] = plan;
        return plan;
    }
    public async Task<BeastReceipt> StartAsync(BeastRequest request)
    {
        if (request.Confirmation != (request.ForceSelected ? "CERRAR FORZOSAMENTE E INICIAR" : "INICIAR MODO BESTIA")) throw new ArgumentException("Confirmación explícita requerida.");
        if (!plans.TryGetValue(request.PlanId, out var plan) || plan.ExpiresUtc < DateTime.UtcNow) throw new ArgumentException("Vista previa expirada. Vuelve a analizar.");
        var pids = request.Pids ?? [];
        if (pids.Length > 20 || pids.Length != pids.Distinct().Count() || pids.Any(id => !plan.Candidates.Any(p => p.Pid == id))) throw new ArgumentException("Selecciona hasta 20 candidatos de la vista previa.");
        if (!await gate.WaitAsync(0)) throw new InvalidOperationException("Ya se prepara una sesión.");
        try
        {
            if (!plans.TryRemove(plan.Id, out _)) throw new ArgumentException("Vista previa ya utilizada.");
            var receipt = new BeastReceipt(Guid.NewGuid(), DateTime.UtcNow, [], null, [], false,
                ["Cerrar apps no es reversible: reábralas manualmente. No se promete recuperar trabajo no guardado.", "No modifica afinidad, Realtime, seguridad, Windows Update, BCD ni protecciones térmicas.", "High es una prueba, no garantiza más FPS. El sistema y Steam deben seguir funcionando. Mide A/B."]);
            var key = "beast." + receipt.Id.ToString("N");
            await backups.SaveStateAsync(key, receipt); // Audit intent before any close/change.
            journal.Touch();
            if (request.ApplyGamingBase)
            {
                var template = await templates.ApplyAsync("gaming", new(OptimizationTemplateService.Templates.Single(t => t.Id == "gaming").Operations, "APLICAR PLANTILLA"));
                receipt = receipt with { Template = template };
                await backups.SaveStateAsync(key, receipt);
                if (template.Results.Any(r => !r.Success)) return receipt; // Recover partial settings, do not close apps on failure.
            }
            foreach (var process in plan.Candidates.Where(p => pids.Contains(p.Pid)))
            {
                // Durable identity/intent, including if the engine is interrupted during close.
                receipt.Applications.Add(new(process.Pid, process.Name, "Cierre solicitado; resultado aún no confirmado.", false));
                await backups.SaveStateAsync(key, receipt);
                receipt.Applications[^1] = await applications.CloseAsync(process, request.ForceSelected);
                await backups.SaveStateAsync(key, receipt);
            }
            var launch = await operations.ApplyOperationAsync("gaming.cs2.launch");
            receipt.Operations.Add(launch);
            await backups.SaveStateAsync(key, receipt);
            if (request.HighPriority && launch.Success)
            {
                // Give Steam up to ~30s beyond launch polling. Applying requires exact instance verification.
                OperationResult? priority = null;
                for (var i = 0; i < 15; i++)
                {
                    var state = await operations.GetOperationStatusAsync("gaming.cs2.priority");
                    if (state.CurrentState is Cs2ProcessState { IsRunning: true }) { priority = await operations.ApplyOperationAsync("gaming.cs2.priority"); break; }
                    await Task.Delay(2000);
                }
                receipt.Operations.Add(priority ?? new(false, "gaming.cs2.priority", "apply", DateTime.UtcNow, 0,
                    ["CS2 todavía no fue confirmado. No se aplicó prioridad a procesos distintos ni se inventó un resultado."], null, null, "Inicia CS2 y usa prioridad desde el catálogo.", false));
            }
            receipt = receipt with { Finished = true };
            await backups.SaveStateAsync(key, receipt);
            return receipt;
        }
        finally { gate.Release(); }
    }
}
