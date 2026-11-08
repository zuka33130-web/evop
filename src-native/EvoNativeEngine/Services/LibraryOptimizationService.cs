using System.Diagnostics;
using System.Globalization;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using EvoNativeEngine.Models;
namespace EvoNativeEngine.Services;

public sealed record LibraryValue(bool Exists, string Kind, string Value, string? Context = null);
public interface ILibraryBackend
{
    LibraryValue Read(LibraryDefinition definition, string? context = null);
    void Write(LibraryDefinition definition, LibraryValue value);
}
public sealed class WindowsLibraryBackend : ILibraryBackend
{
    private static readonly WindowsPowerSettings Power = new();
    private static readonly WindowsTuning Services = new();
    public LibraryValue Read(LibraryDefinition d, string? context = null)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Requiere Windows.");
        if (d.Kind == "Power")
        {
            var scheme = context is null ? Power.ActiveScheme() : Guid.Parse(context);
            var group = Guid.Parse(d.Path); var setting = Guid.Parse(d.ValueName);
            Check(PowerReadACValueIndex(IntPtr.Zero, in scheme, in group, in setting, out var value));
            return new(true, "Power", value.ToString(CultureInfo.InvariantCulture), scheme.ToString());
        }
        if (d.Kind == "Service") return new(true, "Service", Services.ReadService(d.Path) is bool running
            ? running ? "1" : "0" : throw new NotSupportedException($"Servicio {d.Path} no instalado."));
        if (d.Id.StartsWith("library.browser."))
        {
            var relative = d.Id.Contains("chrome") ? @"Google\Chrome\Application\chrome.exe" : @"Microsoft\Edge\Application\msedge.exe";
            if (!new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) }.Any(folder => File.Exists(Path.Combine(folder, relative))))
                throw new NotSupportedException("Navegador no detectado en ubicaciones compatibles; no se crea una política sin aplicación detectada.");
        }
        if (d.Id == "library.background.widgets" && Environment.OSVersion.Version.Build < 22000)
            throw new NotSupportedException("Este módulo de Widgets requiere Windows 11.");
        using var root = RegistryKey.OpenBaseKey(d.Hive == "HKLM" ? RegistryHive.LocalMachine : RegistryHive.CurrentUser, RegistryView.Registry64);
        using var key = root.OpenSubKey(d.Path, false);
        var raw = key?.GetValue(d.ValueName, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
        if (raw is null) return new(false, d.Kind, "");
        var kind = key!.GetValueKind(d.ValueName);
        return kind switch {
            RegistryValueKind.DWord => new(true, "RegistryDword", ((int)raw).ToString(CultureInfo.InvariantCulture)),
            RegistryValueKind.String => new(true, "RegistryString", (string)raw),
            _ => throw new IOException("Tipo no compatible: no se modifica ni se adivina el original.")
        };
    }
    public void Write(LibraryDefinition d, LibraryValue value)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        if (d.Kind == "Power")
        {
            var scheme = Guid.Parse(value.Context!); var group = Guid.Parse(d.Path); var setting = Guid.Parse(d.ValueName);
            Check(PowerWriteACValueIndex(IntPtr.Zero, in scheme, in group, in setting, uint.Parse(value.Value, CultureInfo.InvariantCulture)));
            if (Power.ActiveScheme() == scheme) Power.Activate(scheme); // Never activate an unrelated plan while restoring.
            return;
        }
        if (d.Kind == "Service")
        {
            var current = Services.ReadService(d.Path) ?? throw new IOException("El servicio desapareció.");
            if (current != (value.Value == "1")) Services.SetService(d.Path, value.Value == "1");
            return;
        }
        using var root = RegistryKey.OpenBaseKey(d.Hive == "HKLM" ? RegistryHive.LocalMachine : RegistryHive.CurrentUser, RegistryView.Registry64);
        using var key = root.CreateSubKey(d.Path, true) ?? throw new IOException("No se pudo abrir el registro para escritura.");
        if (!value.Exists) key.DeleteValue(d.ValueName, false);
        else if (value.Kind == "RegistryDword") key.SetValue(d.ValueName, int.Parse(value.Value, CultureInfo.InvariantCulture), RegistryValueKind.DWord);
        else if (value.Kind == "RegistryString") key.SetValue(d.ValueName, value.Value, RegistryValueKind.String);
        else throw new IOException("Tipo de respaldo no válido.");
        key.Flush();
    }
    private static void Check(uint code) { if (code != 0) throw new Win32Exception((int)code); }
    [DllImport("powrprof.dll")] private static extern uint PowerReadACValueIndex(IntPtr root, in Guid scheme, in Guid group, in Guid setting, out uint value);
    [DllImport("powrprof.dll")] private static extern uint PowerWriteACValueIndex(IntPtr root, in Guid scheme, in Guid group, in Guid setting, uint value);
}
public sealed class LibraryOptimizationService(IBackupManager backups, ISecurityService security, ILibraryBackend backend)
{
    // Shared with legacy power/service APIs so overlapping policies cannot interleave snapshot/write.
    internal static readonly SemaphoreSlim Gate = new(1, 1);
    internal static readonly AsyncLocal<string?> ReceiptOwner = new();
    public sealed record Snapshot(int Version, string Id, LibraryValue Original, string? OwnerId = null);
    public static string BackupKey(string id) => "library.v1." + id;
    public async Task<OperationResult> ExecuteAsync(string id, bool restore)
    {
        await Gate.WaitAsync();
        var timer = Stopwatch.StartNew(); var logs = new List<string>(); LibraryValue? before = null;
        try
        {
            if (!OptimizationLibrary.Definitions.TryGetValue(id, out var d)) throw new ArgumentException("Acción no permitida.");
            if (d.Admin && !security.IsElevated()) throw new UnauthorizedAccessException("Requiere motor elevado como administrador.");
            if (!restore && d.Kind == "Service" && (d.Path is "MapsBroker" or "DiagTrack") && backups.HasBackup("verified.v1.tweak.services.gaming_toggle"))
                throw new InvalidOperationException("Restaura primero el módulo anterior de servicios para no solapar respaldos.");
            Snapshot? snapshot = null;
            if (backups.HasBackup(BackupKey(id)))
            {
                snapshot = await backups.GetLastStateAsync<Snapshot>(BackupKey(id));
                Validate(snapshot, id, d);
                if (!restore && ReceiptOwner.Value is string owner && snapshot!.OwnerId != owner) throw new IOException("Respaldo existente de otra sesión: no se modifica.");
            }
            if (restore && snapshot is null) throw new IOException("No existe respaldo verificado.");
            before = backend.Read(d, restore ? snapshot!.Original.Context : null);
            if (!restore && snapshot is not null && d.Kind == "Power" && before.Context != snapshot.Original.Context)
                throw new IOException("Cambió el plan. Restaura primero el ajuste del plan original.");
            var target = restore ? snapshot!.Original : new LibraryValue(true, d.Kind, d.Target, before.Context);
            var changed = before != target;
            if (!restore && snapshot is null && changed) await backups.SaveStateAsync(BackupKey(id), new Snapshot(1, id, before, ReceiptOwner.Value));
            if (changed) backend.Write(d, target);
            var actual = backend.Read(d, target.Context);
            if (actual != target) throw new IOException("Lectura posterior no coincide; respaldo conservado para recuperación.");
            if (restore) await backups.ClearBackupAsync(BackupKey(id));
            logs.Add(changed ? "Cambio leído y verificado: " + d.Name : "Ya tenía el valor solicitado: no se creó un respaldo ni se atribuye mejora.");
            logs.Add($"{d.Kind}: {d.Hive} {d.Path} {d.ValueName} → {target.Value}. " + d.Applicability);
            logs.Add("Verificar un valor no verifica que Windows/driver lo use ni que aumente FPS. " + d.Risk);
            return new(true, id, restore ? "restore" : "apply", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds, logs, before, new { Actual = actual, Changed = changed, Definition = d }, null, restore);
        }
        catch (Exception ex) { logs.Add(ex.Message); return new(false, id, restore ? "restore" : "apply", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds, logs, before, null, ex.Message, false); }
        finally { Gate.Release(); }
    }
    private static void Validate(Snapshot? snapshot, string id, LibraryDefinition d)
    {
        if (snapshot is null || snapshot.Version != 1 || snapshot.Id != id || snapshot.Original is null) throw new IOException("Respaldo no válido.");
        var value = snapshot.Original;
        if (d.Kind == "Power" && (!value.Exists || value.Kind != "Power" || !Guid.TryParse(value.Context, out var scheme) || scheme == Guid.Empty || !uint.TryParse(value.Value, out _)) ||
            d.Kind == "Service" && (!value.Exists || value.Context is not null || value.Kind != "Service" || value.Value is not ("0" or "1")) ||
            d.Kind.StartsWith("Registry") && (value.Context is not null || value.Kind is not ("RegistryDword" or "RegistryString") || value.Kind == "RegistryDword" && value.Exists && !int.TryParse(value.Value, out _)))
            throw new IOException("Datos de respaldo incompatibles.");
    }
}
