using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using EvoNativeEngine.Models;
using Microsoft.Extensions.Logging;

namespace EvoNativeEngine.Services;

public interface IOptimizationService
{
    Task<IReadOnlyList<OperationCatalogItem>> GetCatalogAsync();
    Task<OperationResult> ApplyOperationAsync(string operationId);
    Task<OperationResult> RestoreOperationAsync(string operationId);
    Task<IReadOnlyList<OperationHistoryItem>> GetHistoryAsync();
    Task<OperationStatusResponse> GetOperationStatusAsync(string operationId);
}

public class OptimizationService : IOptimizationService
{
    private readonly ILogger<OptimizationService> _logger;
    private readonly ISecurityService _securityService;
    private readonly IBackupManager _backupManager;
    private readonly IDiagnosticsService _diagnosticsService;

    private readonly ConcurrentBag<OperationHistoryItem> _history = new();
    private static readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

    private readonly Dictionary<string, OperationCatalogItem> _catalog = new(StringComparer.OrdinalIgnoreCase)
    {
        ["system.hardware.refresh"] = new(
            Id: "system.hardware.refresh",
            Name: "Actualizar Diagnóstico de Hardware",
            Description: "Consulta en vivo el hardware del sistema (CPU, RAM, GPU, Discos) vía WMI y Win32.",
            Category: "Sistema",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        ),
        ["system.processes.list"] = new(
            Id: "system.processes.list",
            Name: "Enumerar Procesos Activos",
            Description: "Lee la lista de procesos en ejecución de forma segura para auditar el uso de memoria.",
            Category: "Procesos",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        ),
        ["gaming.cs2.detect"] = new(
            Id: "gaming.cs2.detect",
            Name: "Detectar Estado de Counter-Strike 2",
            Description: "Comprueba si cs2.exe está en ejecución, obteniendo su PID, hilos y clase de prioridad.",
            Category: "Gaming",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        ),
        ["gaming.cs2.launch"] = new(
            Id: "gaming.cs2.launch",
            Name: "Lanzar CS2 mediante Steam",
            Description: "Inicia de forma segura Counter-Strike 2 a través del protocolo oficial de Steam.",
            Category: "Gaming",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        ),
        ["gaming.cs2.priority"] = new(
            Id: "gaming.cs2.priority",
            Name: "Fijar Prioridad Alta en CS2",
            Description: "Guarda la prioridad actual de cs2.exe y la establece en 'High' para asegurar quantum de CPU.",
            Category: "Gaming",
            RequiresElevation: false,
            CanRestore: true,
            IsImplemented: true
        ),
        ["gaming.cs2.priority.restore"] = new(
            Id: "gaming.cs2.priority.restore",
            Name: "Restaurar Prioridad Original de CS2",
            Description: "Restaura la prioridad que tenía cs2.exe antes de aplicar la optimización.",
            Category: "Gaming",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        ),
        ["system.temp.cleanup"] = new(
            Id: "system.temp.cleanup",
            Name: "Limpieza Segura de Temporales del Usuario",
            Description: "Purga archivos temporales obsoletos del directorio %TEMP% del usuario sin tocar archivos bloqueados.",
            Category: "Almacenamiento",
            RequiresElevation: false,
            CanRestore: false,
            IsImplemented: true
        )
    };

    public OptimizationService(
        ILogger<OptimizationService> logger,
        ISecurityService securityService,
        IBackupManager backupManager,
        IDiagnosticsService diagnosticsService)
    {
        _logger = logger;
        _securityService = securityService;
        _backupManager = backupManager;
        _diagnosticsService = diagnosticsService;
    }

    public Task<IReadOnlyList<OperationCatalogItem>> GetCatalogAsync()
    {
        return Task.FromResult<IReadOnlyList<OperationCatalogItem>>(_catalog.Values.ToList());
    }

    public async Task<OperationResult> ApplyOperationAsync(string operationId)
    {
        var sw = Stopwatch.StartNew();
        var logs = new List<string>();
        DateTime startedAt = DateTime.UtcNow;

        logs.Add($"[INICIO] Invocando operación: '{operationId}'");

        if (!_securityService.ValidateWhitelistedAction(operationId))
        {
            sw.Stop();
            var errResult = new OperationResult(
                Success: false,
                OperationId: operationId,
                ActionType: "apply",
                TimestampUtc: startedAt,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: null,
                ErrorMessage: $"La operación '{operationId}' no está permitida o no forma parte de la lista blanca.",
                Restored: false
            );
            RecordHistory(operationId, "apply", false, sw.Elapsed.TotalMilliseconds, "Acceso denegado: acción no permitida", errResult.ErrorMessage);
            return errResult;
        }

        try
        {
            OperationResult result = operationId switch
            {
                "system.hardware.refresh" => await ExecuteHardwareRefreshAsync(logs, sw),
                "system.processes.list" => await ExecuteProcessesListAsync(logs, sw),
                "gaming.cs2.detect" => await ExecuteCs2DetectAsync(logs, sw),
                "gaming.cs2.launch" => await ExecuteCs2LaunchAsync(logs, sw),
                "gaming.cs2.priority" => await ExecuteCs2PriorityApplyAsync(logs, sw),
                "gaming.cs2.priority.restore" => await ExecuteCs2PriorityRestoreAsync(logs, sw),
                "system.temp.cleanup" => await ExecuteTempCleanupAsync(logs, sw),
                _ => throw new InvalidOperationException($"La operación '{operationId}' no tiene un ejecutor asignado.")
            };

            RecordHistory(operationId, "apply", result.Success, result.DurationMs, 
                result.Success ? "Operación completada con éxito" : "Operación finalizada con advertencias/errores", 
                result.ErrorMessage);

            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Error crítico al ejecutar la operación '{OperationId}'", operationId);
            logs.Add($"[ERROR CRÍTICO] {ex.Message}");

            var failResult = new OperationResult(
                Success: false,
                OperationId: operationId,
                ActionType: "apply",
                TimestampUtc: startedAt,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: null,
                ErrorMessage: ex.Message,
                Restored: false
            );

            RecordHistory(operationId, "apply", false, sw.Elapsed.TotalMilliseconds, "Excepción durante la ejecución", ex.Message);
            return failResult;
        }
    }

    public async Task<OperationResult> RestoreOperationAsync(string operationId)
    {
        var sw = Stopwatch.StartNew();
        var logs = new List<string>();
        DateTime startedAt = DateTime.UtcNow;

        logs.Add($"[INICIO] Invocando restauración de: '{operationId}'");

        if (!_securityService.ValidateWhitelistedAction(operationId))
        {
            sw.Stop();
            return new OperationResult(
                Success: false,
                OperationId: operationId,
                ActionType: "restore",
                TimestampUtc: startedAt,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: null,
                ErrorMessage: $"La operación '{operationId}' no está permitida.",
                Restored: false
            );
        }

        try
        {
            OperationResult result = operationId switch
            {
                "gaming.cs2.priority" or "gaming.cs2.priority.restore" => await ExecuteCs2PriorityRestoreAsync(logs, sw),
                _ => new OperationResult(
                    Success: false,
                    OperationId: operationId,
                    ActionType: "restore",
                    TimestampUtc: startedAt,
                    DurationMs: sw.Elapsed.TotalMilliseconds,
                    Logs: logs,
                    PreviousState: null,
                    CurrentState: null,
                    ErrorMessage: $"La operación '{operationId}' no tiene valores reversibles o ya está en estado base.",
                    Restored: false
                )
            };

            RecordHistory(operationId, "restore", result.Success, result.DurationMs, 
                result.Success ? "Restauración exitosa" : "Fallo en restauración", 
                result.ErrorMessage);

            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Error al restaurar '{OperationId}'", operationId);
            logs.Add($"[ERROR RESTAURACIÓN] {ex.Message}");

            var failResult = new OperationResult(
                Success: false,
                OperationId: operationId,
                ActionType: "restore",
                TimestampUtc: startedAt,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: null,
                ErrorMessage: ex.Message,
                Restored: false
            );

            RecordHistory(operationId, "restore", false, sw.Elapsed.TotalMilliseconds, "Excepción al restaurar", ex.Message);
            return failResult;
        }
    }

    public Task<IReadOnlyList<OperationHistoryItem>> GetHistoryAsync()
    {
        var list = _history.OrderByDescending(h => h.TimestampUtc).Take(50).ToList();
        return Task.FromResult<IReadOnlyList<OperationHistoryItem>>(list);
    }

    public Task<OperationStatusResponse> GetOperationStatusAsync(string operationId)
    {
        bool isImplemented = _catalog.TryGetValue(operationId, out var item) && item.IsImplemented;
        bool canRestore = item?.CanRestore ?? false;
        bool hasBackup = _backupManager.HasBackup(operationId);

        var lastRun = _history.Where(h => h.OperationId.Equals(operationId, StringComparison.OrdinalIgnoreCase))
                              .OrderByDescending(h => h.TimestampUtc)
                              .FirstOrDefault();

        object? currentState = null;
        string? message = null;

        if (operationId == "gaming.cs2.detect" || operationId.StartsWith("gaming.cs2.priority"))
        {
            var cs2State = GetCs2CurrentProcessState();
            currentState = cs2State;
            message = cs2State.IsRunning ? $"CS2 detectado (PID {cs2State.ProcessId}, Prioridad {cs2State.PriorityClass})" : "CS2 no está en ejecución.";
        }

        return Task.FromResult(new OperationStatusResponse(
            OperationId: operationId,
            IsImplemented: isImplemented,
            CanRestore: canRestore,
            HasBackup: hasBackup,
            LastRunUtc: lastRun?.TimestampUtc,
            CurrentState: currentState,
            Message: message
        ));
    }

    #region Implementaciones de Operaciones Reales

    private async Task<OperationResult> ExecuteHardwareRefreshAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[DIAGNÓSTICO] Forzando refresco de hardware en vivo vía WMI y APIs del sistema...");
        var report = await _diagnosticsService.GetSystemHardwareReportAsync(forceRefresh: true);

        logs.Add($"[SISTEMA] OS: {report.OperatingSystem.Name} (Build {report.OperatingSystem.BuildNumber})");
        logs.Add($"[CPU] {report.Processor.Name} ({report.Processor.PhysicalCores} núcleos / {report.Processor.LogicalProcessors} hilos)");
        logs.Add($"[RAM] Total: {report.Memory.TotalGb} GB | Libre: {report.Memory.AvailableGb} GB ({report.Memory.UsedPercentage}% en uso)");
        logs.Add($"[GPU] Adaptadores encontrados: {report.GraphicsCards.Count}");
        foreach (var gpu in report.GraphicsCards)
        {
            logs.Add($"  - {gpu.Name} (Driver: {gpu.DriverVersion})");
        }
        logs.Add($"[ALMACENAMIENTO] Unidades: {report.StorageDrives.Count}");
        foreach (var drive in report.StorageDrives)
        {
            logs.Add($"  - {drive.DriveLetter} {drive.FreeGb} GB libres de {drive.TotalGb} GB ({drive.FileSystem})");
        }

        sw.Stop();
        logs.Add($"[COMPLETADO] Diagnóstico actualizado en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return new OperationResult(
            Success: true,
            OperationId: "system.hardware.refresh",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: null,
            CurrentState: report,
            ErrorMessage: null,
            Restored: false
        );
    }

    private Task<OperationResult> ExecuteProcessesListAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[PROCESOS] Consultando tabla de procesos activa del sistema...");

        var procs = Process.GetProcesses();
        int totalCount = procs.Length;
        logs.Add($"[TOTAL] Procesos totales en ejecución: {totalCount}");

        var topByMemory = procs
            .Select(p =>
            {
                try
                {
                    return new ProcessSummaryItem(
                        Id: p.Id,
                        Name: p.ProcessName,
                        WorkingSetBytes: p.WorkingSet64,
                        WorkingSetMb: Math.Round(p.WorkingSet64 / (1024.0 * 1024.0), 1),
                        PriorityClass: GetSafePriorityClass(p)
                    );
                }
                catch
                {
                    return null;
                }
            })
            .Where(p => p != null)
            .OrderByDescending(p => p!.WorkingSetBytes)
            .Take(15)
            .ToList();

        logs.Add("[TOP CONSUMO RAM] Primeros 15 procesos del sistema:");
        foreach (var p in topByMemory)
        {
            logs.Add($"  - PID {p!.Id,5} | {p.Name,-25} | {p.WorkingSetMb,7:F1} MB | Prioridad: {p.PriorityClass}");
        }

        sw.Stop();
        logs.Add($"[COMPLETADO] Lista de procesos generada en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return Task.FromResult(new OperationResult(
            Success: true,
            OperationId: "system.processes.list",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: null,
            CurrentState: new { TotalCount = totalCount, TopProcesses = topByMemory },
            ErrorMessage: null,
            Restored: false
        ));
    }

    private Task<OperationResult> ExecuteCs2DetectAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[DETECTAR] Buscando proceso 'cs2.exe' en la sesión de Windows...");

        var state = GetCs2CurrentProcessState();

        if (state.IsRunning)
        {
            logs.Add($"[OK] Proceso CS2 DETECTADO!");
            logs.Add($"  - PID: {state.ProcessId}");
            logs.Add($"  - Prioridad: {state.PriorityClass}");
            logs.Add($"  - Hilos activos: {state.ThreadCount}");
            logs.Add($"  - Memoria asignada: {state.WorkingSetMb:F1} MB");
            if (state.StartTimeUtc.HasValue)
            {
                logs.Add($"  - Hora de inicio: {state.StartTimeUtc.Value:HH:mm:ss} UTC");
            }
        }
        else
        {
            logs.Add("[INFO] Counter-Strike 2 (cs2.exe) NO está ejecutándose actualmente.");
        }

        sw.Stop();
        logs.Add($"[COMPLETADO] Chequeo finalizado en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return Task.FromResult(new OperationResult(
            Success: true,
            OperationId: "gaming.cs2.detect",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: null,
            CurrentState: state,
            ErrorMessage: null,
            Restored: false
        ));
    }

    private Task<OperationResult> ExecuteCs2LaunchAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[LANZAR] Verificando presencia de Steam para iniciar Counter-Strike 2...");

        // Protocolo nativo de Steam URI: steam://rungameid/730
        const string steamUri = "steam://rungameid/730";

        bool started = false;
        string? error = null;

        try
        {
            logs.Add($"[STEAM] Invocando protocolo URI seguro: {steamUri}");
            var psi = new ProcessStartInfo
            {
                FileName = steamUri,
                UseShellExecute = true
            };
            Process.Start(psi);
            started = true;
            logs.Add("[OK] Solicitud de arranque enviada a Steam con éxito.");
        }
        catch (Exception ex)
        {
            error = $"No se pudo iniciar el protocolo Steam: {ex.Message}";
            logs.Add($"[ERROR] {error}");
        }

        sw.Stop();
        logs.Add($"[COMPLETADO] Operación finalizada en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return Task.FromResult(new OperationResult(
            Success: started,
            OperationId: "gaming.cs2.launch",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: null,
            CurrentState: new { Launched = started, Protocol = steamUri },
            ErrorMessage: error,
            Restored: false
        ));
    }

    private async Task<OperationResult> ExecuteCs2PriorityApplyAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[PRIORIDAD] Buscando instancia de Counter-Strike 2 (cs2.exe)...");

        var procs = Process.GetProcessesByName("cs2");
        if (procs.Length == 0)
        {
            sw.Stop();
            logs.Add("[!] 'cs2.exe' no está en ejecución. No se puede fijar la prioridad.");
            return new OperationResult(
                Success: false,
                OperationId: "gaming.cs2.priority",
                ActionType: "apply",
                TimestampUtc: DateTime.UtcNow,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: new { IsRunning = false },
                ErrorMessage: "Counter-Strike 2 no está abierto. Inicia el juego primero para configurar su prioridad de CPU.",
                Restored: false
            );
        }

        var cs2Proc = procs[0];
        string previousPriority = "Normal";

        try
        {
            previousPriority = cs2Proc.PriorityClass.ToString();
        }
        catch (Exception ex)
        {
            logs.Add($"[!] Advertencia al leer prioridad original: {ex.Message}");
        }

        logs.Add($"[ESTADO ACTUAL] Prioridad original detectada: {previousPriority}");

        // Guardar copia de respaldo antes de modificar (Regla 8)
        var backupData = new { PriorityClass = previousPriority, ProcessId = cs2Proc.Id, SavedAtUtc = DateTime.UtcNow };
        await _backupManager.SaveStateAsync("gaming.cs2.priority", backupData);
        logs.Add($"[BACKUP] Prioridad original ({previousPriority}) guardada para restauración.");

        // Modificar prioridad a High
        logs.Add("[APLICAR] Modificando ProcessPriorityClass a 'High'...");
        try
        {
            cs2Proc.PriorityClass = ProcessPriorityClass.High;
        }
        catch (Exception ex)
        {
            sw.Stop();
            logs.Add($"[ERROR] Permiso denegado al cambiar prioridad: {ex.Message}");
            return new OperationResult(
                Success: false,
                OperationId: "gaming.cs2.priority",
                ActionType: "apply",
                TimestampUtc: DateTime.UtcNow,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: backupData,
                CurrentState: new { PriorityClass = previousPriority },
                ErrorMessage: $"No se pudo cambiar la prioridad: {ex.Message}. Intenta ejecutar el motor como Administrador si CS2 corre con privilegios elevados.",
                Restored: false
            );
        }

        // Confirmar releyendo el estado
        string newPriority = cs2Proc.PriorityClass.ToString();
        logs.Add($"[VERIFICACIÓN] Nueva prioridad confirmada en Windows: {newPriority}");

        sw.Stop();
        logs.Add($"[COMPLETADO] Prioridad ajustada exitosamente a High en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return new OperationResult(
            Success: true,
            OperationId: "gaming.cs2.priority",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: backupData,
            CurrentState: new { PriorityClass = newPriority, ProcessId = cs2Proc.Id },
            ErrorMessage: null,
            Restored: false
        );
    }

    private async Task<OperationResult> ExecuteCs2PriorityRestoreAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[RESTAURACIÓN] Consultando copia de respaldo previa de prioridad de CS2...");

        var backup = await _backupManager.GetLastStateAsync<JsonElement>("gaming.cs2.priority");
        if (backup.ValueKind == JsonValueKind.Undefined)
        {
            sw.Stop();
            logs.Add("[!] No se encontró ningún respaldo de prioridad previa para CS2.");
            return new OperationResult(
                Success: false,
                OperationId: "gaming.cs2.priority.restore",
                ActionType: "restore",
                TimestampUtc: DateTime.UtcNow,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: null,
                CurrentState: null,
                ErrorMessage: "No existe un estado de prioridad previo respaldado para restaurar.",
                Restored: false
            );
        }

        string originalPriorityStr = "Normal";
        if (backup.TryGetProperty("PriorityClass", out var prop))
        {
            originalPriorityStr = prop.GetString() ?? "Normal";
        }

        logs.Add($"[BACKUP ENCONTRADO] Valor original a restaurar: {originalPriorityStr}");

        var procs = Process.GetProcessesByName("cs2");
        if (procs.Length == 0)
        {
            sw.Stop();
            logs.Add("[INFO] 'cs2.exe' no está ejecutándose en este momento. El respaldo se mantendrá para la próxima sesión.");
            return new OperationResult(
                Success: true,
                OperationId: "gaming.cs2.priority.restore",
                ActionType: "restore",
                TimestampUtc: DateTime.UtcNow,
                DurationMs: sw.Elapsed.TotalMilliseconds,
                Logs: logs,
                PreviousState: backup,
                CurrentState: new { Status = "CS2 no activo, respaldo conservado", TargetPriority = originalPriorityStr },
                ErrorMessage: null,
                Restored: true
            );
        }

        var cs2Proc = procs[0];
        if (Enum.TryParse<ProcessPriorityClass>(originalPriorityStr, true, out var targetPriority))
        {
            cs2Proc.PriorityClass = targetPriority;
            logs.Add($"[OK] Prioridad de cs2.exe restaurada a: {targetPriority}");
        }
        else
        {
            cs2Proc.PriorityClass = ProcessPriorityClass.Normal;
            logs.Add("[OK] Prioridad de cs2.exe restaurada a Normal");
        }

        string confirmed = cs2Proc.PriorityClass.ToString();
        logs.Add($"[VERIFICACIÓN] Prioridad final confirmada: {confirmed}");

        await _backupManager.ClearBackupAsync("gaming.cs2.priority");
        logs.Add("[LIMPIEZA] Copia de respaldo limpiada tras restauración exitosa.");

        sw.Stop();
        logs.Add($"[COMPLETADO] Restauración completada en {sw.Elapsed.TotalMilliseconds:F1} ms");

        return new OperationResult(
            Success: true,
            OperationId: "gaming.cs2.priority.restore",
            ActionType: "restore",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: backup,
            CurrentState: new { PriorityClass = confirmed, ProcessId = cs2Proc.Id },
            ErrorMessage: null,
            Restored: true
        );
    }

    private Task<OperationResult> ExecuteTempCleanupAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[LIMPIEZA] Identificando directorio temporal seguro del usuario...");

        string tempPath = Path.GetTempPath();
        logs.Add($"[DIRECTORIO] Ruta: {tempPath}");

        int deletedCount = 0;
        int skippedCount = 0;
        long bytesFreed = 0;

        DateTime cutoff = DateTime.UtcNow.AddHours(-1); // No tocar archivos modificados en la última hora

        try
        {
            var dirInfo = new DirectoryInfo(tempPath);
            var files = dirInfo.GetFiles("*.*", SearchOption.TopDirectoryOnly);

            logs.Add($"[ESCANEO] Encontrados {files.Length} archivos en el primer nivel de temporales.");

            foreach (var file in files)
            {
                // Regla de seguridad: omitir archivos muy recientes
                if (file.LastWriteTimeUtc > cutoff)
                {
                    skippedCount++;
                    continue;
                }

                try
                {
                    long size = file.Length;
                    file.Delete();
                    deletedCount++;
                    bytesFreed += size;
                }
                catch
                {
                    // Archivo en uso o bloqueado por Windows -> omitir con gracia
                    skippedCount++;
                }
            }
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO] No se pudo escanear completamente el directorio: {ex.Message}");
        }

        double mbFreed = Math.Round(bytesFreed / (1024.0 * 1024.0), 2);
        logs.Add($"[RESULTADO] Archivos eliminados: {deletedCount}");
        logs.Add($"[RESULTADO] Archivos en uso/omitidos con seguridad: {skippedCount}");
        logs.Add($"[RESULTADO] Espacio liberado: {mbFreed} MB ({bytesFreed:N0} bytes)");

        sw.Stop();
        logs.Add($"[COMPLETADO] Limpieza finalizada en {sw.Elapsed.TotalMilliseconds:F1} ms");

        var state = new TempCleanupState(
            FilesDeleted: deletedCount,
            FilesSkipped: skippedCount,
            BytesFreed: bytesFreed,
            MbFreed: mbFreed,
            TempDirectory: tempPath
        );

        return Task.FromResult(new OperationResult(
            Success: true,
            OperationId: "system.temp.cleanup",
            ActionType: "apply",
            TimestampUtc: DateTime.UtcNow,
            DurationMs: sw.Elapsed.TotalMilliseconds,
            Logs: logs,
            PreviousState: null,
            CurrentState: state,
            ErrorMessage: null,
            Restored: false
        ));
    }

    private static Cs2ProcessState GetCs2CurrentProcessState()
    {
        try
        {
            var procs = Process.GetProcessesByName("cs2");
            if (procs.Length == 0)
            {
                return new Cs2ProcessState(
                    IsRunning: false,
                    ProcessId: null,
                    PriorityClass: null,
                    ThreadCount: null,
                    WorkingSetMb: null,
                    StartTimeUtc: null,
                    StatusMessage: "No se encontró el proceso cs2.exe."
                );
            }

            var p = procs[0];
            string priority = GetSafePriorityClass(p);
            double mb = Math.Round(p.WorkingSet64 / (1024.0 * 1024.0), 1);
            DateTime? startTime = null;
            try { startTime = p.StartTime.ToUniversalTime(); } catch { }

            return new Cs2ProcessState(
                IsRunning: true,
                ProcessId: p.Id,
                PriorityClass: priority,
                ThreadCount: p.Threads.Count,
                WorkingSetMb: mb,
                StartTimeUtc: startTime,
                StatusMessage: $"cs2.exe activo (PID {p.Id}, {priority})"
            );
        }
        catch (Exception ex)
        {
            return new Cs2ProcessState(
                IsRunning: false,
                ProcessId: null,
                PriorityClass: null,
                ThreadCount: null,
                WorkingSetMb: null,
                StartTimeUtc: null,
                StatusMessage: $"Error al consultar estado de cs2.exe: {ex.Message}"
            );
        }
    }

    private static string GetSafePriorityClass(Process p)
    {
        try
        {
            return p.PriorityClass.ToString();
        }
        catch
        {
            return "NoDisponible";
        }
    }

    private void RecordHistory(string operationId, string actionType, bool success, double durationMs, string summary, string? error)
    {
        _history.Add(new OperationHistoryItem(
            Id: Guid.NewGuid().ToString("N")[..8],
            OperationId: operationId,
            ActionType: actionType,
            TimestampUtc: DateTime.UtcNow,
            Success: success,
            DurationMs: Math.Round(durationMs, 1),
            Summary: summary,
            ErrorMessage: error
        ));
    }

    #endregion
}
