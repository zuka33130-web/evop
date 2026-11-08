using System.Diagnostics;
using System.Text;
using System.Text.Json;
namespace EvoNativeEngine.Services;

public static class FixedWindowsCommand
{
    // Only assembly-defined scripts/allowlisted package names; no script or path accepted from HTTP.
    public static async Task<string> RunAsync(string script)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Requiere Windows.");
        using var process = new Process { StartInfo = new("powershell.exe") { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true } };
        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes("$ErrorActionPreference='Stop'; " + script)) }) process.StartInfo.ArgumentList.Add(argument);
        process.Start(); var output = process.StandardOutput.ReadToEndAsync(); var error = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { process.Kill(true); await process.WaitForExitAsync(); throw new TimeoutException("La operación Appx excedió 90 s; consulta el estado antes de repetir."); }
        var text = await output; var stderr = await error;
        if (process.ExitCode != 0) throw new IOException(stderr);
        return text.Trim();
    }
}
public sealed record OptionalPackage(string Name, string Label, string Loss);
public sealed record PackageState(string Name, string PackageFullName, string InstallLocation, bool IsFramework, bool NonRemovable);
public interface IOptionalPackages
{
    Task<PackageState[]> ListAsync();
    Task RemoveAsync(PackageState package);
    Task RestoreAsync(PackageState package);
}
public sealed class WindowsOptionalPackages : IOptionalPackages
{
    private static string Literal(string name) => DebloatService.Packages.Any(p => p.Name == name) ? "'" + name + "'" : throw new ArgumentException("Paquete no permitido.");
    public async Task<PackageState[]> ListAsync()
    {
        var names = string.Join(",", DebloatService.Packages.Select(p => Literal(p.Name)));
        var json = await FixedWindowsCommand.RunAsync($"$names=@({names}); @((Get-AppxPackage | Where-Object {{$names -contains $_.Name}}) | Select-Object Name,PackageFullName,InstallLocation,IsFramework,NonRemovable) | ConvertTo-Json -Compress -Depth 3");
        if (string.IsNullOrWhiteSpace(json) || json == "null") return [];
        using var document = JsonDocument.Parse(json);
        return document.RootElement.ValueKind == JsonValueKind.Array ? JsonSerializer.Deserialize<PackageState[]>(json)! : [JsonSerializer.Deserialize<PackageState>(json)!];
    }
    public async Task RemoveAsync(PackageState package)
    {
        if (package.IsFramework || package.NonRemovable) throw new IOException("Paquete framework/no eliminable protegido.");
        var name = Literal(package.Name);
        // Re-query from Windows: do not execute a path or untrusted package full name from a request/receipt.
        var fullName = Convert.ToBase64String(Encoding.UTF8.GetBytes(package.PackageFullName));
        await FixedWindowsCommand.RunAsync($"$full=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{fullName}')); $pkg=Get-AppxPackage -Name {name} | Where-Object {{$_.PackageFullName -eq $full -and -not $_.IsFramework -and -not $_.NonRemovable}}; if(-not $pkg){{throw 'El paquete cambió o está protegido.'}}; $pkg | Remove-AppxPackage -ErrorAction Stop");
    }
    public async Task RestoreAsync(PackageState package)
    {
        Literal(package.Name);
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "WindowsApps") + Path.DirectorySeparatorChar;
        if (!package.PackageFullName.StartsWith(package.Name + "_", StringComparison.Ordinal) || Path.GetFileName(package.InstallLocation.TrimEnd('\\', '/')) != package.PackageFullName)
            throw new IOException("Identidad/ruta de paquete incompatible.");
        var path = Path.GetFullPath(Path.Combine(package.InstallLocation, "AppxManifest.xml"));
        if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(path)) throw new IOException("Archivos ya no disponibles. Reinstala la aplicación desde Microsoft Store; no se promete recuperación de datos.");
        var directory = new DirectoryInfo(package.InstallLocation);
        while (directory is not null && directory.FullName.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
        {
            if ((directory.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("No se siguen enlaces de WindowsApps.");
            directory = directory.Parent;
        }
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(path));
        await FixedWindowsCommand.RunAsync($"$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{encoded}')); Add-AppxPackage -DisableDevelopmentMode -Register $path -ErrorAction Stop");
    }
}
public sealed record DebloatPlan(Guid Id, DateTime ExpiresUtc, PackageState[] Candidates);
public sealed record DebloatRequest(Guid PlanId, string[] Names, string Confirmation);
public sealed record DebloatStep(string Name, string Action, bool Success, string Message);
public sealed record DebloatReceipt(Guid Id, DateTime CreatedUtc, List<PackageState> Attempted, List<DebloatStep> Results);
public sealed class DebloatService(IOptionalPackages packages, IBackupManager backups, OperationJournal journal)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private DebloatPlan? active;
    public static readonly OptionalPackage[] Packages = [
        new("Microsoft.BingNews", "Microsoft News", "Pierdes la app de noticias y sus ajustes locales."),
        new("Microsoft.BingWeather", "Microsoft Weather", "Pierdes la app del tiempo; no se elimina Widgets."),
        new("Microsoft.MicrosoftSolitaireCollection", "Solitaire Collection", "Puede perder datos locales del juego; sincroniza antes."),
        new("Microsoft.GetHelp", "Obtener ayuda", "Pierdes la app de ayuda y algunos accesos de soporte."),
        new("Microsoft.Getstarted", "Sugerencias", "Pierdes guías de uso de Windows."),
        new("Microsoft.People", "Contactos", "Puede perder caché/datos locales no sincronizados."),
        new("Microsoft.MicrosoftOfficeHub", "Microsoft 365 / Office Hub", "No desinstala Word/Excel Win32; elimina solo el hub."),
        new("Clipchamp.Clipchamp", "Clipchamp", "Guarda/exporta proyectos antes: puede perder datos locales.")
    ];
    public async Task<object> PreviewAsync()
    {
        await gate.WaitAsync();
        try
        {
            var candidates = (await packages.ListAsync()).Where(p => Packages.Any(a => a.Name == p.Name) && !p.IsFramework && !p.NonRemovable).GroupBy(p => p.Name).Where(group => group.Count() == 1).Select(group => group.Single()).ToArray();
            active = new(Guid.NewGuid(), DateTime.UtcNow.AddMinutes(5), candidates);
            return new { Plan = active, Definitions = Packages, Warning = "Solo usuario actual; sin AllUsers, provisionados, Store, frameworks, Gaming Services ni WebView2. Desinstalar puede borrar datos; reinstalación no garantizada. No se promete FPS." };
        }
        finally { gate.Release(); }
    }
    public async Task<DebloatReceipt> RemoveAsync(DebloatRequest request)
    {
        if (request.Confirmation != "DESINSTALAR APLICACIONES") throw new ArgumentException("Confirmación explícita requerida.");
        await gate.WaitAsync();
        try
        {
            var plan = active;
            var selected = request.Names ?? [];
            if (plan is null || plan.Id != request.PlanId || plan.ExpiresUtc < DateTime.UtcNow || selected.Length == 0 || selected.Length > 8 ||
                selected.Distinct().Count() != selected.Length || selected.Any(n => !plan.Candidates.Any(p => p.Name == n))) throw new ArgumentException("Selección inválida/expirada; vuelve a analizar.");
            active = null;
            var receipt = new DebloatReceipt(Guid.NewGuid(), DateTime.UtcNow, [], []);
            var key = "debloat." + receipt.Id.ToString("N");
            await backups.SaveStateAsync(key, receipt); journal.Touch();
            foreach (var snapshot in plan.Candidates.Where(p => selected.Contains(p.Name)))
            {
                receipt.Attempted.Add(snapshot); await backups.SaveStateAsync(key, receipt);
                try
                {
                    var current = (await packages.ListAsync()).SingleOrDefault(p => p.PackageFullName == snapshot.PackageFullName);
                    if (current is null || current != snapshot) throw new IOException("Identidad cambió. No se desinstaló.");
                    await packages.RemoveAsync(current);
                    if ((await packages.ListAsync()).Any(p => p.Name == current.Name)) throw new IOException("La aplicación sigue registrada para el usuario.");
                    receipt.Results.Add(new(snapshot.Name, "remove", true, "Ausencia de registro Appx del usuario verificada. No se certifican bytes libres ni borrado de datos físicos."));
                }
                catch (Exception ex) { receipt.Results.Add(new(snapshot.Name, "remove", false, ex.Message)); }
                await backups.SaveStateAsync(key, receipt);
            }
            return receipt;
        }
        finally { gate.Release(); }
    }
    public async Task<DebloatReceipt> RestoreAsync(Guid id)
    {
        await gate.WaitAsync();
        try
        {
            var key = "debloat." + id.ToString("N");
            var receipt = await backups.GetLastStateAsync<DebloatReceipt>(key) ?? throw new ArgumentException("Recibo desconocido.");
            if (receipt.Id != id || receipt.Attempted.Count > 8 || receipt.Attempted.Any(p => !Packages.Any(d => d.Name == p.Name))) throw new IOException("Recibo inválido.");
            journal.Touch();
            foreach (var snapshot in receipt.Attempted.AsEnumerable().Reverse())
            {
                try {
                    if (!(await packages.ListAsync()).Any(p => p.Name == snapshot.Name)) await packages.RestoreAsync(snapshot);
                    if (!(await packages.ListAsync()).Any(p => p.Name == snapshot.Name)) throw new IOException("No se verificó el registro de la app.");
                    receipt.Results.Add(new(snapshot.Name, "restore", true, "Aplicación registrada; no certifica recuperación de datos anteriores."));
                } catch (Exception ex) { receipt.Results.Add(new(snapshot.Name, "restore", false, ex.Message)); }
                await backups.SaveStateAsync(key, receipt);
            }
            return receipt;
        }
        finally { gate.Release(); }
    }
}
