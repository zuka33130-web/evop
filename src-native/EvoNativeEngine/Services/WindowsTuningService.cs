using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.ServiceProcess;
using EvoNativeEngine.Models;

namespace EvoNativeEngine.Services;

public interface IWindowsTuning
{
    Task<bool> ReadPageCombiningAsync();
    Task SetPageCombiningAsync(bool enabled);
    bool? ReadService(string name);
    void SetService(string name, bool running);
}

public sealed class WindowsTuning : IWindowsTuning
{
    private static async Task<string> RunAsync(string script)
    {
        // Scripts are fixed by this assembly; no script text is accepted from HTTP callers.
        var encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes("$ErrorActionPreference='Stop'; " + script));
        using var process = new Process { StartInfo = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false, RedirectStandardOutput = true,
            RedirectStandardError = true, CreateNoWindow = true
        }};
        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded })
            process.StartInfo.ArgumentList.Add(argument);
        process.Start();
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            throw new TimeoutException("PowerShell excedió 30 segundos.");
        }
        var stdout = await output;
        var stderr = await error;
        if (process.ExitCode != 0) throw new IOException($"PowerShell ({process.ExitCode}): {stderr}");
        return stdout.Trim();
    }
    public async Task<bool> ReadPageCombiningAsync() => JsonSerializer.Deserialize<bool>(
        await RunAsync("[bool](Get-MMAgent -ErrorAction Stop).PageCombining | ConvertTo-Json -Compress"));
    public async Task SetPageCombiningAsync(bool enabled) =>
        await RunAsync(enabled ? "Enable-MMAgent -PageCombining -ErrorAction Stop" : "Disable-MMAgent -PageCombining -ErrorAction Stop");

    public bool? ReadService(string name)
    {
        using var service = new ServiceController(name);
        try
        {
            var status = service.Status;
            if (status is not (ServiceControllerStatus.Running or ServiceControllerStatus.Stopped))
                throw new IOException($"{name}: estado transitorio o pausado; inténtalo después.");
            return status == ServiceControllerStatus.Running;
        }
        catch (InvalidOperationException ex) when (ex.InnerException is System.ComponentModel.Win32Exception { NativeErrorCode: 1060 })
        { return null; }
    }
    public void SetService(string name, bool running)
    {
        using var service = new ServiceController(name);
        if (running) service.Start();
        else
        {
            // Never force-stop dependents (they are outside the snapshot).
            if (service.DependentServices.Any(s => s.Status != ServiceControllerStatus.Stopped))
                throw new IOException($"{name} tiene servicios dependientes activos; no se detuvo.");
            service.Stop();
        }
        service.WaitForStatus(running ? ServiceControllerStatus.Running : ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
    }
}

public sealed class WindowsTuningService(IBackupManager backups, IWindowsTuning windows)
{
    public sealed record Snapshot(int Version, string Operation, Dictionary<string, bool> Values);
    private static readonly SemaphoreSlim Gate = new(1, 1);
    // Deliberately excludes Update, Defender, printing, search, network and system services.
    private static readonly string[] OptionalServices = ["DiagTrack", "MapsBroker"];
    public bool Supports(string id) => id is "tweak.memory.pagecombining_off" or "cortex.mode.stutter"
        or "cortex.mode.services" or "cortex.mode.debloat" or "tweak.services.gaming_toggle";
    public string CanonicalId(string id) => id is "cortex.mode.stutter" or "tweak.memory.pagecombining_off"
        ? "tweak.memory.pagecombining_off" : "tweak.services.gaming_toggle";
    public async Task<OperationResult> ExecuteAsync(string id, bool restore)
    {
        var timer = Stopwatch.StartNew();
        var logs = new List<string>();
        var canonical = CanonicalId(id);
        var key = $"verified.v1.{canonical}";
        var memory = canonical == "tweak.memory.pagecombining_off";
        Dictionary<string, bool>? before = null;
        await Gate.WaitAsync();
        try
        {
            if (!Supports(id)) throw new NotSupportedException(id);
            before = memory ? new() { ["PageCombining"] = await windows.ReadPageCombiningAsync() } : ReadServices();
            if (before.Count == 0) throw new NotSupportedException("No se encontraron los servicios opcionales en este equipo.");
            Snapshot original;
            if (backups.HasBackup(key))
            {
                original = await backups.GetLastStateAsync<Snapshot>(key)
                    ?? throw new IOException("Respaldo ilegible; no se modificó el sistema.");
                if (original.Version != 1 || original.Operation != canonical || original.Values is null || original.Values.Count == 0 ||
                    original.Values.Keys.Any(k => memory ? k != "PageCombining" : !OptionalServices.Contains(k)))
                    throw new IOException("Respaldo incompatible; no se modificó el sistema.");
            }
            else
            {
                if (restore) throw new IOException("No hay respaldo verificado para restaurar.");
                original = new(1, canonical, before);
                await backups.SaveStateAsync(key, original);
            }
            // Only operate on the exact original inventory, including after repeated apply.
            foreach (var (name, wasEnabled) in original.Values)
            {
                var target = restore && wasEnabled;
                if (memory)
                {
                    if (await windows.ReadPageCombiningAsync() != target) await windows.SetPageCombiningAsync(target);
                    if (await windows.ReadPageCombiningAsync() != target) throw new IOException("PageCombining no coincide con el valor solicitado.");
                }
                else
                {
                    var current = windows.ReadService(name) ?? throw new IOException($"El servicio {name} ya no existe.");
                    if (current != target) windows.SetService(name, target);
                    if (windows.ReadService(name) != target) throw new IOException($"No se verificó {name}.");
                }
                logs.Add($"{name}: {(target ? "activo" : "inactivo")} verificado.");
            }
            if (restore) await backups.ClearBackupAsync(key);
            return new(true, id, restore ? "restore" : "apply", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds,
                logs, before, new { Verified = true }, null, restore);
        }
        catch (Exception ex)
        {
            logs.Add("Puede haber cambios parciales; respaldo conservado: " + ex.Message);
            return new(false, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, before, null, ex.Message, false);
        }
        finally { Gate.Release(); }
    }
    private Dictionary<string, bool> ReadServices()
    {
        var states = new Dictionary<string, bool>();
        foreach (var name in OptionalServices)
            if (windows.ReadService(name) is bool running) states[name] = running;
        return states;
    }
}
