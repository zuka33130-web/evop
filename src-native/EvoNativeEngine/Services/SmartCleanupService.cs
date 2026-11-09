using Microsoft.Win32;
using System.Diagnostics;
using System.Text.Json;
using System.Security.Cryptography;

namespace EvoNativeEngine.Services;

public sealed record CleanupItem(Guid Id, string Category, string Path, long Bytes, DateTime ModifiedUtc,
    string Kind = "File", string? ValueName = null, string? Value = null, int ValueKind = 0);
public sealed record CleanupPlan(Guid Id, DateTime CreatedUtc, List<CleanupItem> Items, List<string> Warnings);
public sealed record CleanupSelection(Guid PlanId, Guid[] ItemIds);
public sealed record QuarantinedItem(CleanupItem Original, string? StoredPath, string? Sha256 = null);
public sealed record CleanupReceipt(Guid Id, DateTime CreatedUtc, List<QuarantinedItem> Items, long BytesQuarantined,
    List<string> Errors, string Message, string Action = "quarantine", long BytesDeleted = 0);

/// <summary>Allowlisted preview, revalidation and recoverable quarantine, never generic registry sweeping.</summary>
public sealed class SmartCleanupService(IBackupManager backups, OperationJournal journal, Dictionary<string, string>? testRoots = null)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private CleanupPlan? current;
    private Dictionary<string, string> AllowedRoots => testRoots ?? Roots();
    private const string RunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private static readonly string StateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "Quarantine");
    public static Dictionary<string, string> Roots()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return new() {
            ["Temporales de usuario"] = Path.Combine(local, "Temp"),
            ["Crash dumps de usuario"] = Path.Combine(local, "CrashDumps"),
            ["Informes WER de usuario"] = Path.Combine(local, @"Microsoft\Windows\WER\ReportArchive"),
            ["Caché DirectX (opcional: recompilar puede causar tirones)"] = Path.Combine(local, "D3DSCache"),
            ["Caché Chrome Default (cerrar navegador)"] = Path.Combine(local, @"Google\Chrome\User Data\Default\Cache"),
            ["Caché Edge Default (cerrar navegador)"] = Path.Combine(local, @"Microsoft\Edge\User Data\Default\Cache")
        };
    }
    public static bool SafePath(string root, string path)
    {
        root = Path.GetFullPath(root);
        path = Path.GetFullPath(path);
        var relative = Path.GetRelativePath(root, path);
        if (relative == "." || relative == ".." || relative.StartsWith(".." + Path.DirectorySeparatorChar) || Path.IsPathRooted(relative)) return false;
        // Reject a reparse point anywhere from the file to the volume root, including an allowlisted root.
        for (string? part = path; part is not null; part = Path.GetDirectoryName(part))
            if ((File.Exists(part) || Directory.Exists(part)) && (File.GetAttributes(part) & FileAttributes.ReparsePoint) != 0) return false;
        return true;
    }
    private static bool BrowserActive(string category)
    {
        var name = category.Contains("Chrome") ? "chrome" : category.Contains("Edge") ? "msedge" : null;
        if (name is null) return false;
        var processes = Process.GetProcessesByName(name);
        var active = processes.Length > 0;
        foreach (var process in processes) process.Dispose();
        return active;
    }
    public async Task<CleanupPlan> ScanAsync()
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Limpieza nativa disponible en Windows.");
        await gate.WaitAsync();
        try
        {
            var items = new List<CleanupItem>();
            var warnings = new List<string> { "Solo archivos de más de 7 días; no se incluyen cookies, contraseñas, historial, Prefetch, WinSxS ni Windows Update. Cuarentena no libera espacio hasta purgarla.",
                "Caché de shaders: borrarla puede empeorar el stutter hasta recompilar. No seleccionada automáticamente.",
                "Entradas Run con destino ausente son candidatas, no prueba de que sea seguro quitarlas. Revisar cada una." };
            var timer = Stopwatch.StartNew();
            int visited = 0;
            foreach (var (category, root) in AllowedRoots)
            {
                if (!Directory.Exists(root) || BrowserActive(category)) continue;
                var pending = new Stack<(string Path, int Depth)>(); pending.Push((root, 0));
                while (pending.Count > 0 && visited < 30000 && items.Count < 3000 && timer.Elapsed.TotalSeconds < 15)
                {
                    var (directory, depth) = pending.Pop();
                    try
                    {
                        if (depth > 10 || (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) continue;
                        foreach (var file in Directory.EnumerateFiles(directory))
                        {
                            if (++visited > 30000 || items.Count >= 3000) break;
                            try
                            {
                                var info = new FileInfo(file);
                                if (!SafePath(root, file) || info.LastWriteTimeUtc > DateTime.UtcNow.AddDays(-7) || info.Length > 64 * 1024 * 1024) continue;
                                items.Add(new(Guid.NewGuid(), category, info.FullName, info.Length, info.LastWriteTimeUtc));
                            }
                            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
                        }
                        foreach (var sub in Directory.EnumerateDirectories(directory)) pending.Push((sub, depth + 1));
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
                }
            }
            if (visited >= 30000 || items.Count >= 3000 || timer.Elapsed.TotalSeconds >= 15) warnings.Add("Escaneo limitado por presupuesto de tiempo/archivos. No es un inventario completo.");
            using var run = Registry.CurrentUser.OpenSubKey(RunPath);
            if (run is not null)
                foreach (var name in run.GetValueNames())
                {
                    if (run.GetValue(name, null, RegistryValueOptions.DoNotExpandEnvironmentNames) is not string value) continue;
                    if (run.GetValueKind(name) is not (RegistryValueKind.String or RegistryValueKind.ExpandString)) continue;
                    var executable = MissingLocalExecutable(value);
                    if (executable is null) continue;
                    items.Add(new(Guid.NewGuid(), "Registro: inicio HKCU Run (revisión manual)", RunPath, 0, DateTime.UtcNow,
                        "Registry", name, value, (int)run.GetValueKind(name)));
                }
            current = new(Guid.NewGuid(), DateTime.UtcNow, items, warnings);
            return current;
        }
        finally { gate.Release(); }
    }
    public static string? MissingLocalExecutable(string command)
    {
        // Conservative parser: quoted absolute executable or unquoted no-space absolute executable only.
        var match = System.Text.RegularExpressions.Regex.Match(command, "^\\s*(?:\"([^\"]+\\.exe)\"|([^\\s\"]+\\.exe))(?:\\s|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success) return null;
        var path = Environment.ExpandEnvironmentVariables(match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value);
        if (!Path.IsPathFullyQualified(path) || path.StartsWith(@"\\") || path.Contains('%')) return null;
        var root = Path.GetPathRoot(path)!;
        try { if (new DriveInfo(root).DriveType != DriveType.Fixed || !Directory.Exists(root) || File.Exists(path)) return null; }
        catch { return null; }
        try { File.GetAttributes(path); return null; }
        catch (FileNotFoundException) { }
        catch (DirectoryNotFoundException) { }
        catch { return null; } // Access denied is not evidence of an orphan.
        return path;
    }
    public Task<CleanupReceipt[]> ReceiptsAsync() => WorkflowReceipts.ReadAsync<CleanupReceipt>(backups, "cleanup", r => r.Id, int.MaxValue);
    private static string Digest(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Convert.ToHexString(SHA256.HashData(stream));
    }
    private static void VerifyFile(string path, QuarantinedItem item)
    {
        // Legacy receipts without hashes remain recoverable only by manual inspection.
        if (item.Sha256 is null || new FileInfo(path).Length != item.Original.Bytes || Digest(path) != item.Sha256)
            throw new IOException("Integridad no verificada; archivo y manifiesto conservados para revisión manual.");
    }
    public async Task<CleanupReceipt> QuarantineAsync(CleanupSelection selection)
    {
        await gate.WaitAsync();
        try
        {
            if (current is null || current.Id != selection.PlanId || current.CreatedUtc < DateTime.UtcNow.AddMinutes(-15)) throw new ArgumentException("Vista previa expirada; escanea de nuevo.");
            if (selection.ItemIds.Length is < 1 or > 500 || selection.ItemIds.Distinct().Count() != selection.ItemIds.Length) throw new ArgumentException("Selecciona de 1 a 500 elementos distintos.");
            var selected = selection.ItemIds.Select(id => current.Items.FirstOrDefault(i => i.Id == id) ?? throw new ArgumentException("Elemento ajeno a la vista previa.")).ToArray();
            var id = Guid.NewGuid();
            var directory = Path.Combine(StateDir, id.ToString("N"));
            Directory.CreateDirectory(directory);
            var staged = new List<QuarantinedItem>(); var errors = new List<string>();
            journal.Touch();
            foreach (var item in selected)
            {
                try
                {
                    string? target = null;
                    if (item.Kind == "Registry")
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(RunPath, true) ?? throw new IOException("No se pudo abrir Run.");
                        var value = key.GetValue(item.ValueName!, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                        if (value is not string text || text != item.Value || (int)key.GetValueKind(item.ValueName!) != item.ValueKind || MissingLocalExecutable(text) is null)
                            throw new IOException("Entrada modificada o destino presente; no se elimina.");
                        // Persist the complete original before deletion.
                        staged.Add(new(item, null));
                        await Save(id, staged, errors);
                        key.DeleteValue(item.ValueName!, false);
                        if (key.GetValue(item.ValueName!) != null) throw new IOException("No se verificó la eliminación de Run.");
                    }
                    else
                    {
                        if (!AllowedRoots.TryGetValue(item.Category, out var root) || !SafePath(root, item.Path) || BrowserActive(item.Category)) throw new IOException("Ruta no admitida o navegador activo.");
                        var info = new FileInfo(item.Path);
                        if (!info.Exists || info.Length != item.Bytes || info.LastWriteTimeUtc != item.ModifiedUtc) throw new IOException("Archivo cambiado desde el escaneo.");
                        // Holding an exclusive stream prevents normal applications reopening it during the move.
                        using var stream = new FileStream(item.Path, FileMode.Open, FileAccess.Read, FileShare.Delete);
                        target = Path.Combine(directory, item.Id.ToString("N") + ".bin");
                        if (!SafePath(StateDir, target)) throw new IOException("Cuarentena no segura.");
                        var hash = Convert.ToHexString(SHA256.HashData(stream));
                        staged.Add(new(item, target, hash));
                        await Save(id, staged, errors);
                        File.Move(item.Path, target); // No overwrite, cross-volume or locked-file fallback deletion.
                        stream.Dispose();
                        VerifyFile(target, staged[^1]);
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                { errors.Add(item.Path + ": " + ex.Message); }
            }
            current = null;
            return await Save(id, staged, errors);
        }
        finally { gate.Release(); }
    }
    private Task<CleanupReceipt> Save(Guid id, List<QuarantinedItem> items, List<string> errors) => SaveCore(id, items, errors);
    private async Task<CleanupReceipt> SaveCore(Guid id, List<QuarantinedItem> items, List<string> errors, string action = "quarantine", long deleted = 0)
    {
        var bytes = items.Where(i => i.StoredPath is not null && File.Exists(i.StoredPath)).Sum(i => i.Original.Bytes);
        var receipt = new CleanupReceipt(id, DateTime.UtcNow, items.ToList(), bytes, errors.ToList(), action == "restore" ? (items.Count == 0 ? "Restauración verificada: sin elementos pendientes." : "Restauración parcial: respaldos pendientes conservados.")
                : action == "purge" ? $"Eliminados definitivamente {deleted} bytes lógicos; registro recuperable conservado. No equivale a espacio físico medido."
                : "Cuarentena recuperable; no equivale a espacio libre ganado. Conservar el ID para restaurar.", action, deleted);
        await backups.SaveStateAsync("cleanup." + id.ToString("N"), receipt);
        return receipt;
    }
    public async Task<CleanupReceipt> RestoreAsync(Guid id)
    {
        await gate.WaitAsync();
        try
        {
            var receipt = await backups.GetLastStateAsync<CleanupReceipt>("cleanup." + id.ToString("N")) ?? throw new ArgumentException("No hay manifiesto de cuarentena.");
            if (receipt.Id != id) throw new IOException("Identidad del manifiesto inválida.");
            var errors = new List<string>(); var remaining = new List<QuarantinedItem>();
            journal.Touch();
            foreach (var item in receipt.Items)
            {
                try
                {
                    var original = item.Original;
                    if (original.Kind == "Registry")
                    {
                        if (original.Path != RunPath || original.Value is null || original.ValueName is null || original.ValueKind is not (1 or 2)) throw new IOException("Respaldo de registro no compatible.");
                        using var key = Registry.CurrentUser.CreateSubKey(RunPath, true);
                        var existing = key.GetValue(original.ValueName, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                        if (existing is not null && !Equals(existing, original.Value)) throw new IOException("Valor ocupado; no se sobrescribe.");
                        key.SetValue(original.ValueName, original.Value, (RegistryValueKind)original.ValueKind);
                        if (!Equals(key.GetValue(original.ValueName, null, RegistryValueOptions.DoNotExpandEnvironmentNames), original.Value) ||
                            (int)key.GetValueKind(original.ValueName) != original.ValueKind) throw new IOException("Restauración de registro no verificada.");
                    }
                    else
                    {
                        if (!AllowedRoots.TryGetValue(original.Category, out var root) || !SafePath(root, original.Path) || item.StoredPath is null || Path.GetFullPath(item.StoredPath) != Path.Combine(StateDir, id.ToString("N"), original.Id.ToString("N") + ".bin") || !SafePath(StateDir, item.StoredPath)) throw new IOException("Ruta fuera de los límites permitidos.");
                        if (File.Exists(item.StoredPath))
                        {
                            VerifyFile(item.StoredPath, item);
                            if (File.Exists(original.Path)) throw new IOException("Destino ocupado; no se sobrescribe.");
                            Directory.CreateDirectory(Path.GetDirectoryName(original.Path)!);
                            File.Move(item.StoredPath, original.Path);
                        }
                        else if (!File.Exists(original.Path)) throw new IOException("No se encuentra original ni cuarentena.");
                        VerifyFile(original.Path, item);
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                { remaining.Add(item); errors.Add(item.Original.Path + ": " + ex.Message); }
            }
            return await SaveCore(id, remaining, errors, "restore");
        }
        finally { gate.Release(); }
    }
    public async Task<CleanupReceipt> PurgeAsync(Guid id, string confirmation)
    {
        if (confirmation != "ELIMINAR DEFINITIVAMENTE") throw new ArgumentException("Confirmación irreversible incorrecta.");
        await gate.WaitAsync();
        try
        {
            var receipt = await backups.GetLastStateAsync<CleanupReceipt>("cleanup." + id.ToString("N")) ?? throw new ArgumentException("Cuarentena desconocida.");
            if (receipt.Id != id) throw new IOException("Identidad del manifiesto inválida.");
            var remaining = new List<QuarantinedItem>(); var errors = new List<string>(); long deleted = 0;
            journal.Touch();
            foreach (var item in receipt.Items)
            {
                if (item.Original.Kind == "Registry") { remaining.Add(item); continue; } // Keep registry recovery data.
                try
                {
                    var expected = Path.Combine(StateDir, id.ToString("N"), item.Original.Id.ToString("N") + ".bin");
                    if (item.StoredPath is null || Path.GetFullPath(item.StoredPath) != expected || !SafePath(StateDir, expected)) throw new IOException("Ruta de cuarentena no válida.");
                    if (!File.Exists(expected)) throw new IOException("Archivo de cuarentena ausente; manifiesto conservado para revisión.");
                    if (File.Exists(expected))
                    {
                        VerifyFile(expected, item);
                        var length = new FileInfo(expected).Length;
                        File.Delete(expected);
                        if (File.Exists(expected)) throw new IOException("No se verificó el borrado.");
                        deleted += length;
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                { remaining.Add(item); errors.Add(item.Original.Path + ": " + ex.Message); }
            }
            return await SaveCore(id, remaining, errors, "purge", deleted);
        }
        finally { gate.Release(); }
    }

}
