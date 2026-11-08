using Microsoft.Win32;
using EvoNativeEngine.Models;
using System.Diagnostics;

namespace EvoNativeEngine.Services;

/// <summary>Atomic, reversible registry operations. Never guesses the previous value.</summary>
public sealed class RegistryOptimizationService(IBackupManager backups, ISecurityService security)
{
    private sealed record Setting(RegistryHive Hive, string Path, string Name, int Value);
    public sealed record Snapshot(bool Exists, int Value);
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly Dictionary<string, Setting> Settings = new()
    {
        ["tweak.gpu.mpo_fix"] = new(RegistryHive.LocalMachine, @"SOFTWARE\Microsoft\Windows\Dwm", "OverlayTestMode", 5),
        ["tweak.gpu.hags"] = new(RegistryHive.LocalMachine, @"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode", 2),
        ["tweak.gpu.tdr_delay"] = new(RegistryHive.LocalMachine, @"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "TdrDelay", 10),
        ["tweak.cpu.powerthrottling_off"] = new(RegistryHive.LocalMachine, @"SYSTEM\CurrentControlSet\Control\Power\PowerThrottling", "PowerThrottlingOff", 1),
        ["tweak.cpu.win32priority"] = new(RegistryHive.LocalMachine, @"SYSTEM\CurrentControlSet\Control\PriorityControl", "Win32PrioritySeparation", 38),
        ["cortex.mode.torneo"] = new(RegistryHive.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "EnableTransparency", 0)
    };

    public bool Supports(string id) => Settings.ContainsKey(id);

    public async Task<OperationResult> ExecuteAsync(string id, bool restore)
    {
        var timer = Stopwatch.StartNew();
        var logs = new List<string>();
        await Gate.WaitAsync();
        try
        {
            if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Esta operación requiere Windows.");
            var setting = Settings[id];
            if (setting.Hive == RegistryHive.LocalMachine && !security.IsElevated())
                throw new UnauthorizedAccessException("Reinicia EvoNativeEngine como administrador.");
            using var root = RegistryKey.OpenBaseKey(setting.Hive, RegistryView.Registry64);
            using var key = root.CreateSubKey(setting.Path, true)
                ?? throw new IOException("No se pudo abrir la clave de registro.");
            var raw = key.GetValue(setting.Name);
            if (raw != null && key.GetValueKind(setting.Name) != RegistryValueKind.DWord)
                throw new InvalidOperationException("Tipo de registro no compatible; no se modificó el valor.");
            var before = new Snapshot(raw != null, raw is int value ? value : 0);
            Snapshot target;
            if (restore)
            {
                target = await backups.GetLastStateAsync<Snapshot>(id)
                    ?? throw new InvalidOperationException("No hay un respaldo original para esta operación.");
            }
            else
            {
                // Preserve the FIRST original state across repeated applications.
                if (!backups.HasBackup(id)) await backups.SaveStateAsync(id, before);
                target = new Snapshot(true, setting.Value);
            }
            if (target.Exists) key.SetValue(setting.Name, target.Value, RegistryValueKind.DWord);
            else key.DeleteValue(setting.Name, false);
            key.Flush();
            var actual = key.GetValue(setting.Name);
            if (target.Exists ? actual is not int n || n != target.Value : actual != null)
                throw new IOException("La lectura posterior no coincide con el cambio solicitado; respaldo conservado.");
            if (restore) await backups.ClearBackupAsync(id);
            logs.Add($"Registro verificado: {setting.Path}\\{setting.Name}. Algunos cambios requieren reiniciar Windows.");
            return new OperationResult(true, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, before, target, null, restore);
        }
        catch (Exception ex)
        {
            logs.Add(ex.Message);
            return new OperationResult(false, id, restore ? "restore" : "apply", DateTime.UtcNow,
                timer.Elapsed.TotalMilliseconds, logs, null, null, ex.Message, false);
        }
        finally { Gate.Release(); }
    }
}
