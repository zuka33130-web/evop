using EvoNativeEngine.Models;
using Microsoft.Win32;
using System.Diagnostics;

namespace EvoNativeEngine.Services;

public sealed record InstalledSoftware(string Name, string? Version, string? Publisher);
public sealed record ProcessUsage(string Name, double WorkingSetMb);
public sealed record AuditRecommendation(string Id, string Title, string Evidence, string Action,
    string Risk, string? OperationId, bool RequiresAbTest);
public sealed record LocalAuditReport(DateTime CreatedUtc, string Engine, SystemHardwareReport Hardware,
    List<InstalledSoftware> Software, List<ProcessUsage> TopProcesses, List<string> StartupNames,
    List<AuditRecommendation> Recommendations, List<string> Limitations);

/// <summary>Local explainable rules, not a trained language model. No data leaves the computer.</summary>
public sealed class LocalAuditAdvisor(IDiagnosticsService diagnostics, IOptimizationService operations)
{
    public async Task<LocalAuditReport> AuditAsync()
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("La auditoría nativa requiere Windows.");
        var hardware = await diagnostics.GetSystemHardwareReportAsync(true);
        var software = new List<InstalledSoftware>(); var startup = new List<string>(); var top = new List<ProcessUsage>();
        var warnings = new List<string> {
            "Motor local de reglas explicables; no es IA generativa ni modelo entrenado. No envía datos a una nube ni ejecuta recomendaciones automáticamente.",
            "Inventario parcial: software registrado en Uninstall, no todas las apps portátiles/Store. El working set es una muestra, no carga CPU sostenida.",
            "Las recomendaciones son hipótesis de diagnóstico. No se garantiza una ganancia ni se identifica el cuello de botella solo por el modelo del hardware." };
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using var root = RegistryKey.OpenBaseKey(hive, view);
                using var uninstall = root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");
                if (uninstall is not null)
                    foreach (var keyName in uninstall.GetSubKeyNames().Take(500))
                    {
                        using var key = uninstall.OpenSubKey(keyName);
                        if (key?.GetValue("DisplayName") is string name)
                            software.Add(new(name, key.GetValue("DisplayVersion") as string, key.GetValue("Publisher") as string));
                    }
                using var run = root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
                if (run is not null) startup.AddRange(run.GetValueNames());
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException)
            { warnings.Add("Inventario no accesible: " + hive + " / " + view); }
        }
        foreach (var process in Process.GetProcesses())
        {
            using (process)
                try { top.Add(new(process.ProcessName, Math.Round(process.WorkingSet64 / 1048576.0, 1))); }
                catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception) { }
        }
        top = top.OrderByDescending(p => p.WorkingSetMb).Take(15).ToList();
        var recommendations = Recommend(hardware, top, startup.Count);
        var catalog = await operations.GetCatalogAsync();
        recommendations = recommendations.Select(r => r with { OperationId = catalog.Any(c => c.Id == r.OperationId && c.IsImplemented) ? r.OperationId : null }).ToList();
        return new(DateTime.UtcNow, "EVO Local Advisor / reglas v1 (sin LLM)", hardware,
            software.DistinctBy(s => (s.Name, s.Version)).OrderBy(s => s.Name).Take(500).ToList(), top,
            startup.Distinct().Order().ToList(), recommendations, warnings);
    }
    public static List<AuditRecommendation> Recommend(SystemHardwareReport hardware, IReadOnlyList<ProcessUsage> top, int startupCount)
    {
        var result = new List<AuditRecommendation>();
        if (hardware.Memory.UsedPercentage >= 80 || hardware.Memory.AvailableGb < 2)
            result.Add(new("memory-pressure", "Investigar presión de memoria", $"RAM usada {hardware.Memory.UsedPercentage:F1}%, disponible {hardware.Memory.AvailableGb:F1} GB.",
                "Revisar las aplicaciones con mayor working set. No vaciar RAM en espera ni fijar pagefile sin medir fallos de página/commit.", "Cerrar aplicaciones puede perder trabajo; no se hace automáticamente.", null, false));
        foreach (var disk in hardware.StorageDrives.Where(d => d.FreePercentage < 15 && d.TotalBytes > 0))
            result.Add(new("disk-" + disk.DriveLetter, "Revisar espacio de " + disk.DriveLetter, $"Libre {disk.FreePercentage:F1}% / {disk.FreeGb:F1} GB.",
                "Escanear la limpieza recuperable y revisar archivos grandes manualmente. No borrar WinSxS ni cachés del sistema a ciegas.", "La cuarentena no libera espacio hasta su purga irreversible.", null, false));
        if (startupCount > 8)
            result.Add(new("startup-review", "Revisar programas de inicio", $"{startupCount} entradas Run observadas (puede haber duplicados entre vistas).",
                "Abrir Aplicaciones de inicio y revisar lo que no se necesita; conservar seguridad, audio, dispositivos y sincronización requerida.", "Deshabilitar sin identificar puede perder funcionalidades.", null, false));
        if (top.Any(p => p.Name.Equals("cs2", StringComparison.OrdinalIgnoreCase)))
            result.Add(new("cs2-priority", "Medir prioridad High sin restringir núcleos", "Se observó cs2.exe activo en el inventario de procesos.",
                "Probar A/B con cinco capturas por fase. No usar prioridad Realtime ni asumir que cuatro hilos son los P-Cores.", "High puede perjudicar otras tareas; restaurar si P99 o low empeoran.", "gaming.cs2.priority", true));
        if (hardware.GraphicsCards.Count > 1)
            result.Add(new("gpu-choice", "Comprobar GPU usada por el juego", $"Se detectaron {hardware.GraphicsCards.Count} adaptadores gráficos.",
                "Revisar la preferencia por aplicación en Configuración de gráficos y confirmar qué GPU usa el proceso; no decidir solo por el orden del inventario.", "La preferencia puede aumentar consumo y no aplicarse a todas las APIs.", null, true));
        result.Add(new("baseline", "Establecer una referencia de frametimes", $"CPU: {hardware.Processor.Name}; RAM: {hardware.Memory.TotalGb:F1} GB; GPU: {string.Join(", ", hardware.GraphicsCards.Select(g => g.Name))}.",
            "Registrar misma escena, API, resolución y cap. Comparar 1% low y P99 antes de conservar un ajuste.", "Sin capturas reales no se puede prometer FPS ni recomendar un preset agresivo por modelo.", null, false));
        result.Add(new("drivers", "Verificar controladores desde el fabricante", "Versiones detectadas: " + string.Join("; ", hardware.GraphicsCards.Select(g => g.Name + " " + g.DriverVersion)),
            "Consultar el fabricante y las notas del controlador. La versión leída no prueba que esté desactualizado; no se instala automáticamente.", "Actualizar puede introducir regresiones; conservar posibilidad de volver al anterior.", null, true));
        return result;
    }
}
