using Microsoft.Win32;
using System.Diagnostics;
using System.Text.Json;
using System.Security.Cryptography;
using System.Security.Principal;

namespace EvoNativeEngine.Services;

public sealed record CleanupItem(Guid Id, string Category, string Path, long Bytes, DateTime ModifiedUtc,
    string Kind = "File", string? ValueName = null, string? Value = null, int ValueKind = 0,
    long? AllocatedBytes = null, string? FileIdentity = null, CleanupItem? Companion = null, string? ScannedSha256 = null);
public sealed record CleanupOutcome(string Path, string Category, string Status, string Reason, long Bytes = 0);
public sealed record CleanupCategory(string Name, int Files, long LogicalBytes, long? AllocatedBytes);
public sealed record CleanupVolume(string Volume, long? FreeBefore, long? FreeAfter, long? ObservedFreeDelta, string Note);
public sealed record CleanupProgress(string Action, int Processed, int Total, bool CancelRequested);
public sealed record CleanupPlan(Guid Id, DateTime CreatedUtc, List<CleanupItem> Items, List<string> Warnings,
    List<CleanupOutcome>? Outcomes = null, List<CleanupCategory>? Categories = null, bool Complete = true, bool Cancelled = false, long LogicalBytes = 0, long? AllocatedBytes = null);
public sealed record CleanupSelection(Guid PlanId, Guid[] ItemIds);
public sealed record QuarantinedItem(CleanupItem Original, string? StoredPath, string? Sha256 = null);
public sealed record CleanupReceipt(Guid Id, DateTime CreatedUtc, List<QuarantinedItem> Items, long BytesQuarantined,
    List<string> Errors, string Message, string Action = "quarantine", long BytesDeleted = 0, List<CleanupOutcome>? Outcomes = null,
    List<CleanupVolume>? Volumes = null, bool Cancelled = false)
{
    public string Status => Cancelled ? "cancelled" : Errors.Count > 0 ? "partial" : Action == "restore" && Items.Count > 0 ? "partial" : "completed";
}

/// <summary>Allowlisted preview, revalidation and recoverable quarantine, never generic registry sweeping.</summary>
public sealed class SmartCleanupService(IBackupManager backups, OperationJournal journal, Dictionary<string, string>? testRoots = null)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private CleanupPlan? current;
    private readonly object cancellationLock = new();
    private CancellationTokenSource? activeCancellation;
    private CleanupProgress progress = new("idle", 0, 0, false);
    public event Action<CleanupProgress>? ProgressChanged;
    public CleanupProgress Progress { get { lock (cancellationLock) return progress; } }
    public bool RequestCancellation()
    {
        lock (cancellationLock)
        {
            if (activeCancellation is null) return false;
            activeCancellation.Cancel(); progress = progress with { CancelRequested = true }; return true;
        }
    }
    private CancellationTokenSource Begin(string action, CancellationToken token)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(token);
        lock (cancellationLock) { activeCancellation = source; progress = new(action, 0, 0, source.IsCancellationRequested); }
        return source;
    }
    private void Report(int processed, int total)
    {
        CleanupProgress value;
        lock (cancellationLock) { progress = progress with { Processed = processed, Total = total }; value = progress; }
        try { ProgressChanged?.Invoke(value); } catch { /* Observer failure cannot interrupt a file transaction. */ }
    }
    private void End()
    {
        lock (cancellationLock) { activeCancellation = null; progress = progress with { Action = "idle" }; }
    }
    private Dictionary<string, string> AllowedRoots => testRoots ?? Roots();
    private const string RunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private static readonly string StateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "Quarantine");
    public static Dictionary<string, string> Roots()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var roots = new Dictionary<string,string> {
            ["Temporales de usuario"] = Path.Combine(local, "Temp"),
            ["Temporales de Windows"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Temp"),
            ["Miniaturas de usuario"] = Path.Combine(local, @"Microsoft\Windows\Explorer"),
            ["Residuos Discord (logs)"] = Path.Combine(local, @"Discord\logs"),
            ["Caché Discord"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"discord\Cache"),
            ["Residuos Chrome (crashes)"] = Path.Combine(local, @"Google\Chrome\User Data\Crashpad\reports"),
            ["Residuos Edge (crashes)"] = Path.Combine(local, @"Microsoft\Edge\User Data\Crashpad\reports"),
            ["Crash dumps de usuario"] = Path.Combine(local, "CrashDumps"),
            ["Informes WER de usuario"] = Path.Combine(local, @"Microsoft\Windows\WER\ReportArchive"),
            ["Caché DirectX (opcional: recompilar puede causar tirones)"] = Path.Combine(local, "D3DSCache"),
            ["Caché Chrome Default (cerrar navegador)"] = Path.Combine(local, @"Google\Chrome\User Data\Default\Cache"),
            ["Caché Edge Default (cerrar navegador)"] = Path.Combine(local, @"Microsoft\Edge\User Data\Default\Cache")
        };
        if (OperatingSystem.IsWindows())
        {
            using var identity = WindowsIdentity.GetCurrent();
            if (identity.User is not null)
                foreach (var drive in DriveInfo.GetDrives().Where(d => d.DriveType == DriveType.Fixed && d.IsReady))
                    roots["Papelera de usuario · " + drive.Name] = Path.Combine(drive.Name, "$Recycle.Bin", identity.User.Value);
        }
        return roots;
    }
    private static bool Recycle(string category) => category.StartsWith("Papelera de usuario");
    private static bool CandidateName(string category, string path, bool companion = false)
    {
        var name = Path.GetFileName(path);
        if (category == "Miniaturas de usuario") return name.StartsWith("thumbcache_", StringComparison.OrdinalIgnoreCase) && name.EndsWith(".db", StringComparison.OrdinalIgnoreCase);
        if (Recycle(category)) return name.StartsWith(companion ? "$I" : "$R", StringComparison.OrdinalIgnoreCase);
        return true;
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
        var name = category.Contains("Chrome") ? "chrome" : category.Contains("Edge") ? "msedge" : category.Contains("Discord") ? "Discord" : null;
        if (name is null) return false;
        var processes = Process.GetProcessesByName(name);
        var active = processes.Length > 0;
        foreach (var process in processes) process.Dispose();
        return active;
    }
    private static async Task<CleanupItem> InspectCandidate(string category, string root, string path, CancellationToken cancellationToken, bool companion = false)
    {
        if (!SafePath(root, path) || !CandidateName(category, path, companion)) throw new IOException("Ruta/nombre fuera del alcance permitido.");
        var info = new FileInfo(path);
        if ((info.Attributes & (FileAttributes.ReparsePoint | FileAttributes.Offline | FileAttributes.ReadOnly | FileAttributes.System)) != 0)
            throw new IOException("Archivo protegido, offline o enlace; no se toca.");
        if (info.LastWriteTimeUtc > DateTime.UtcNow.AddDays(-7)) throw new IOException("Archivo reciente (menos de 7 días).");
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Delete);
        CleanupFileAccess.VerifyResolvedPath(stream, path);
        var actual = CleanupFileAccess.Inspect(stream);
        if (actual.Links != 1) throw new IOException("Archivo con enlaces físicos compartidos; no se cuenta como recuperable.");
        return new(Guid.NewGuid(), category, info.FullName, actual.Bytes, info.LastWriteTimeUtc,
            AllocatedBytes: actual.Allocated, FileIdentity: actual.Identity, ScannedSha256: Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken)));
    }
    private static IEnumerable<CleanupItem> Expand(CleanupItem item)
    {
        yield return item;
        if (item.Companion is not null) yield return item.Companion;
    }
    public async Task<CleanupPlan> ScanAsync(CancellationToken cancellationToken = default)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Limpieza nativa disponible en Windows.");
        await gate.WaitAsync();
        using var cancellation = Begin("scan", cancellationToken);
        cancellation.CancelAfter(TimeSpan.FromSeconds(60));
        try
        {
            var items = new List<CleanupItem>(); var outcomes = new List<CleanupOutcome>();
            var warnings = new List<string> { "Solo archivos de más de 7 días en rutas permitidas; cuarentena no libera espacio hasta purgar. Papelera: solo archivos del usuario actual, nunca carpetas ni otros usuarios.",
                "Miniaturas y cachés pueden regenerarse. Shaders pueden causar tirones al recompilar. Nada se selecciona automáticamente.",
                "Bytes lógicos y asignados se leen de archivos/handles de Windows, no se estiman. No equivalen a una garantía de espacio físico libre: compresión, metadatos y actividad externa pueden cambiarlo.",
                "HKCU Run se revisa aparte; no libera espacio de disco." };
            var timer = Stopwatch.StartNew(); int visited = 0; bool complete = true;
            void Omit(string path, string category, string reason) {
                if (outcomes.Count < 10000) outcomes.Add(new(path, category, "skipped", reason));
                else complete = false;
            }
            foreach (var (category, root) in AllowedRoots)
            {
                if (cancellation.IsCancellationRequested) { complete = false; break; }
                if (!Directory.Exists(root)) { Omit(root, category, "Ubicación ausente o inaccesible."); continue; }
                if (BrowserActive(category)) { Omit(root, category, "Aplicación activa: caché/residuos omitidos."); continue; }
                var pending = new Stack<(string Path, int Depth)>(); pending.Push((root, 0));
                while (pending.Count > 0)
                {
                    if (cancellation.IsCancellationRequested || visited >= 100000 || items.Count >= 10000 || timer.Elapsed.TotalSeconds >= 60)
                    { complete = false; break; }
                    var (directory, depth) = pending.Pop();
                    try
                    {
                        if (depth > 10 || (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) { Omit(directory, category, "Enlace o límite de profundidad."); complete = false; continue; }
                        // Check the root ancestry too: never traverse a redirected allowlisted cache.
                        if (!SafePath(root, Path.Combine(directory, "__evo_boundary_check__"))) throw new IOException("Ancestro redirigido o fuera de límites.");
                        foreach (var file in Directory.EnumerateFiles(directory))
                        {
                            if (cancellation.IsCancellationRequested || ++visited > 100000 || items.Count >= 10000 || timer.Elapsed.TotalSeconds >= 60) { complete = false; break; }
                            try
                            {
                                if (!CandidateName(category, file)) { Omit(file, category, "Nombre protegido/no admitido en esta categoría."); continue; }
                                var item = await InspectCandidate(category, root, file, cancellation.Token);
                                if (Recycle(category))
                                {
                                    var meta = Path.Combine(directory, "$I" + Path.GetFileName(file)[2..]);
                                    var companion = await InspectCandidate(category, root, meta, cancellation.Token, true);
                                    item = item with { Companion = companion };
                                }
                                items.Add(item);
                            }
                            catch (OperationCanceledException) { complete = false; Omit(file, category, "Análisis interrumpido antes de completar hash/identidad; no se contó el archivo."); break; }
                            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { Omit(file, category, ex.Message); }
                            Report(visited, items.Count);
                        }
                        foreach (var sub in Directory.EnumerateDirectories(directory))
                            if (Recycle(category) || category == "Miniaturas de usuario") Omit(sub, category, "Carpeta excluida; nunca se borra recursivamente en esta categoría.");
                            else pending.Push((sub, depth + 1));
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { Omit(directory, category, ex.Message); complete = false; }
                }
            }
            if (!complete) warnings.Add("Inventario parcial/cancelado o limitado (60 s, 100000 archivos, 10000 candidatos, 10000 incidencias, profundidad 10). No se extrapola el resto del disco.");
            if (!cancellation.IsCancellationRequested)
            {
                try
                {
                    using var run = Registry.CurrentUser.OpenSubKey(RunPath);
                    if (run is not null) foreach (var name in run.GetValueNames())
                    {
                        if (run.GetValue(name, null, RegistryValueOptions.DoNotExpandEnvironmentNames) is not string value ||
                            run.GetValueKind(name) is not (RegistryValueKind.String or RegistryValueKind.ExpandString) || MissingLocalExecutable(value) is null) continue;
                        items.Add(new(Guid.NewGuid(), "Registro: inicio HKCU Run (revisión manual)", RunPath, 0, DateTime.UtcNow, "Registry", name, value, (int)run.GetValueKind(name)));
                    }
                }
                catch (Exception ex) { Omit(RunPath, "Registro", ex.Message); complete = false; }
            }
            var categories = items.GroupBy(i => i.Category).Select(g => new CleanupCategory(g.Key, g.Count(),
                g.SelectMany(Expand).Sum(i => i.Bytes), g.SelectMany(Expand).All(i => i.AllocatedBytes.HasValue) ? g.SelectMany(Expand).Sum(i => i.AllocatedBytes!.Value) : null)).ToList();
            var files = items.Where(i => i.Kind == "File").SelectMany(Expand).ToArray();
            current = new(Guid.NewGuid(), DateTime.UtcNow, items, warnings, outcomes, categories, complete, cancellation.IsCancellationRequested,
                files.Sum(i => i.Bytes), files.All(i => i.AllocatedBytes.HasValue) ? files.Sum(i => i.AllocatedBytes!.Value) : null);
            await backups.SaveStateAsync("cleanupPlan." + current.Id.ToString("N"), current);
            return current;
        }
        finally { End(); gate.Release(); }
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
    public async Task<CleanupReceipt> QuarantineAsync(CleanupSelection selection, CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync();
        using var cancellation = Begin("quarantine", cancellationToken);
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
            var outcomes = new List<CleanupOutcome>(); int processed = 0; var completedPrimary = new HashSet<Guid>();
            foreach (var item in selected.SelectMany(Expand))
            {
                var parent = selected.FirstOrDefault(s => s.Companion?.Id == item.Id);
                if ((parent is not null && !completedPrimary.Contains(parent.Id)) || (cancellation.IsCancellationRequested && parent is null))
                { outcomes.Add(new(item.Path, item.Category, "skipped", parent is not null ? "Payload no movido; metadatos de papelera conservados junto a él." : "Cancelado antes de modificar este archivo.", item.Bytes)); continue; }
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
                        if (!AllowedRoots.TryGetValue(item.Category, out var root) || !SafePath(root, item.Path) || !CandidateName(item.Category, item.Path, Path.GetFileName(item.Path).StartsWith("$I")) || BrowserActive(item.Category)) throw new IOException("Ruta no admitida o navegador activo.");
                        var info = new FileInfo(item.Path);
                        if (!info.Exists || info.Length != item.Bytes || info.LastWriteTimeUtc != item.ModifiedUtc) throw new IOException("Archivo cambiado desde el escaneo.");
                        // Holding an exclusive stream prevents normal applications reopening it during the move.
                        using var stream = new FileStream(item.Path, FileMode.Open, FileAccess.Read, FileShare.Delete);
                        CleanupFileAccess.VerifyResolvedPath(stream, item.Path);
                        var identity = CleanupFileAccess.Inspect(stream);
                        if (identity.Links != 1 || identity.Bytes != item.Bytes || item.FileIdentity is null || identity.Identity != item.FileIdentity)
                            throw new IOException("Identidad/enlaces cambiaron desde el escaneo; no se modifica.");
                        if ((File.GetAttributes(item.Path) & (FileAttributes.System | FileAttributes.ReadOnly | FileAttributes.Offline | FileAttributes.ReparsePoint)) != 0) throw new IOException("Archivo protegido.");
                        if (!string.Equals(Path.GetPathRoot(item.Path), Path.GetPathRoot(directory), StringComparison.OrdinalIgnoreCase))
                            throw new IOException("Otra unidad: no se usa copia+borrado como sustituto de cuarentena recuperable.");
                        target = Path.Combine(directory, item.Id.ToString("N") + ".bin");
                        if (!SafePath(StateDir, target)) throw new IOException("Cuarentena no segura.");
                        var hash = Convert.ToHexString(SHA256.HashData(stream));
                        if (item.ScannedSha256 is null || hash != item.ScannedSha256) throw new IOException("Contenido cambió desde el análisis; no se mueve.");
                        staged.Add(new(item, target, hash));
                        await Save(id, staged, errors);
                        File.Move(item.Path, target); // No overwrite, cross-volume or locked-file fallback deletion.
                        stream.Dispose();
                        VerifyFile(target, staged[^1]);
                    }
                    outcomes.Add(new(item.Path, item.Category, "quarantined", "Cambio verificado; aún recuperable.", item.Bytes));
                    completedPrimary.Add(item.Id);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                { errors.Add(item.Path + ": " + ex.Message); outcomes.Add(new(item.Path, item.Category, "skipped", ex.Message, item.Bytes)); }
                Report(++processed, selected.SelectMany(Expand).Count());
            }
            current = null;
            return await SaveCore(id, staged, errors, outcomes: outcomes, cancelled: cancellation.IsCancellationRequested);
        }
        finally { End(); gate.Release(); }
    }
    private Task<CleanupReceipt> Save(Guid id, List<QuarantinedItem> items, List<string> errors) => SaveCore(id, items, errors);
    private async Task<CleanupReceipt> SaveCore(Guid id, List<QuarantinedItem> items, List<string> errors, string action = "quarantine", long deleted = 0, List<CleanupOutcome>? outcomes = null, List<CleanupVolume>? volumes = null, bool cancelled = false)
    {
        var bytes = items.Where(i => i.StoredPath is not null && File.Exists(i.StoredPath)).Sum(i => new FileInfo(i.StoredPath!).Length);
        var receipt = new CleanupReceipt(id, DateTime.UtcNow, items.ToList(), bytes, errors.ToList(), (cancelled ? "Cancelado entre archivos; cambios completados y pendientes conservados. " : "") + (action == "restore" ? (items.Count == 0 ? "Restauración verificada: sin elementos pendientes." : "Restauración parcial: respaldos pendientes conservados.")
                : action == "purge" ? $"Eliminados definitivamente {deleted} bytes lógicos; registro recuperable conservado. No equivale a espacio físico medido."
                : "Cuarentena recuperable; no equivale a espacio libre ganado. Conservar el ID para restaurar."), action, deleted, outcomes, volumes, cancelled);
        await backups.SaveStateAsync("cleanup." + id.ToString("N"), receipt);
        return receipt;
    }
    public async Task<CleanupReceipt> RestoreAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync();
        using var cancellation = Begin("restore", cancellationToken);
        try
        {
            var receipt = await backups.GetLastStateAsync<CleanupReceipt>("cleanup." + id.ToString("N")) ?? throw new ArgumentException("No hay manifiesto de cuarentena.");
            if (receipt.Id != id) throw new IOException("Identidad del manifiesto inválida.");
            var errors = new List<string>(); var remaining = new List<QuarantinedItem>();
            journal.Touch();
            var outcomes = new List<CleanupOutcome>(); int processed = 0;
            foreach (var item in receipt.Items)
            {
                if (cancellation.IsCancellationRequested) { remaining.Add(item); outcomes.Add(new(item.Original.Path, item.Original.Category, "skipped", "Cancelado; respaldo conservado.")); continue; }
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
                    outcomes.Add(new(item.Original.Path, item.Original.Category, "restored", "Original verificado.", item.Original.Bytes));
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                { remaining.Add(item); errors.Add(item.Original.Path + ": " + ex.Message); outcomes.Add(new(item.Original.Path, item.Original.Category, "skipped", ex.Message)); }
                Report(++processed, receipt.Items.Count);
            }
            return await SaveCore(id, remaining, errors, "restore", outcomes: outcomes, cancelled: cancellation.IsCancellationRequested);
        }
        finally { End(); gate.Release(); }
    }
    private static long? ReadFree(string volume)
    {
        try { return new DriveInfo(volume).AvailableFreeSpace; } catch { return null; }
    }
    private static List<CleanupVolume> Measure(Dictionary<string,long?> before) => before.Select(pair => {
        var after = ReadFree(pair.Key);
        return new CleanupVolume(pair.Key, pair.Value, after, pair.Value.HasValue && after.HasValue ? after.Value - pair.Value.Value : null,
            "Delta neto observado en la unidad durante la operación; incluye actividad ajena, metadatos y recibos. No se atribuye íntegramente a EvoClean y puede ser negativo.");
    }).ToList();
    public async Task<CleanupReceipt> PurgeAsync(Guid id, string confirmation, CancellationToken cancellationToken = default)
    {
        if (confirmation != "ELIMINAR DEFINITIVAMENTE") throw new ArgumentException("Confirmación irreversible incorrecta.");
        await gate.WaitAsync();
        using var cancellation = Begin("purge", cancellationToken);
        try
        {
            var receipt = await backups.GetLastStateAsync<CleanupReceipt>("cleanup." + id.ToString("N")) ?? throw new ArgumentException("Cuarentena desconocida.");
            if (receipt.Id != id) throw new IOException("Identidad del manifiesto inválida.");
            var remaining = new List<QuarantinedItem>(); var errors = new List<string>(); long deleted = 0;
            var outcomes = new List<CleanupOutcome>(); int processed = 0;
            var volumes = receipt.Items.Where(i => i.StoredPath is not null).Select(i => Path.GetPathRoot(i.StoredPath!)!).Distinct(StringComparer.OrdinalIgnoreCase).ToDictionary(v => v, ReadFree);
            journal.Touch();
            foreach (var item in receipt.Items)
            {
                if (cancellation.IsCancellationRequested) { remaining.Add(item); outcomes.Add(new(item.Original.Path, item.Original.Category, "skipped", "Cancelado; archivo no eliminado.")); continue; }
                if (item.Original.Kind == "Registry") { remaining.Add(item); processed++; outcomes.Add(new(item.Original.Path, item.Original.Category, "skipped", "Respaldo de registro conservado; no es espacio recuperable.")); continue; } // Keep registry recovery data.
                try
                {
                    var expected = Path.Combine(StateDir, id.ToString("N"), item.Original.Id.ToString("N") + ".bin");
                    if (item.StoredPath is null || Path.GetFullPath(item.StoredPath) != expected || !SafePath(StateDir, expected)) throw new IOException("Ruta de cuarentena no válida.");
                    if (!File.Exists(expected)) throw new IOException("Archivo de cuarentena ausente; manifiesto conservado para revisión.");
                    if (File.Exists(expected))
                    {
                        deleted += CleanupFileAccess.DeleteVerified(expected, item);
                        outcomes.Add(new(item.Original.Path, item.Original.Category, "deleted", "Borrado por handle y ausencia verificados.", item.Original.Bytes));
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                { remaining.Add(item); errors.Add(item.Original.Path + ": " + ex.Message); outcomes.Add(new(item.Original.Path, item.Original.Category, "skipped", ex.Message)); }
                processed++;
                // Persist completed files before moving on; interruption never reports pending files as deleted.
                await SaveCore(id, remaining.Concat(receipt.Items.Skip(processed)).ToList(), errors, "purge", deleted, outcomes, Measure(volumes));
                Report(processed, receipt.Items.Count);
            }
            return await SaveCore(id, remaining, errors, "purge", deleted, outcomes, Measure(volumes), cancellation.IsCancellationRequested);
        }
        finally { End(); gate.Release(); }
    }

}
