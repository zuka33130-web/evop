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
    Task<RealtimeTelemetryData> GetRealtimeTelemetryAsync();
    Task<OperationResult> RestoreVerifiedAsync();
}

public class OptimizationService : IOptimizationService
{
    private readonly OperationJournal _journal;
    private readonly ILogger<OptimizationService> _logger;
    private readonly ISecurityService _securityService;
    private readonly IBackupManager _backupManager;
    private readonly IDiagnosticsService _diagnosticsService;

    private GameOptimizationService GameOperations => new(_backupManager, new WindowsGameProcessProvider());

    private WindowsTuningService TuningOperations => new(_backupManager, new WindowsTuning());

    private PowerOptimizationService PowerOperations => new(_backupManager, new WindowsPowerSettings());

    private LibraryOptimizationService LibraryOperations => new(_backupManager, _securityService, new WindowsLibraryBackend());

    private RegistryOptimizationService RegistryOperations => new(_backupManager, _securityService);

    private readonly ConcurrentBag<OperationHistoryItem> _history = new();
    private static readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

    private readonly Dictionary<string, OperationCatalogItem> _catalog = new(StringComparer.OrdinalIgnoreCase)
    {
        // 1. Diagnóstico y Sistema
        ["system.hardware.refresh"] = new("system.hardware.refresh", "Actualizar Diagnóstico de Hardware", "Consulta en vivo el hardware del sistema (CPU, RAM, GPU, Discos) vía WMI y Win32.", "Sistema", false, false, true),
        ["system.processes.list"] = new("system.processes.list", "Enumerar Procesos Activos", "Lee la lista de procesos en ejecución de forma segura para auditar el uso de memoria.", "Procesos", false, false, true),
        ["system.temp.cleanup"] = new("system.temp.cleanup", "Limpieza Segura de Temporales del Usuario", "Purga archivos temporales obsoletos del directorio %TEMP% sin tocar archivos en uso.", "Almacenamiento", false, false, true),
        ["telemetry.realtime"] = new("telemetry.realtime", "Telemetría en Tiempo Real de Windows", "Lectura continua de CPU, reloj, RAM, temperatura y banderas de throttling de Windows.", "Telemetría", false, false, true),

        // 2. Gaming & CS2 Específico
        ["gaming.cs2.detect"] = new("gaming.cs2.detect", "Detectar Estado de Counter-Strike 2", "Comprueba si cs2.exe está en ejecución, obteniendo PID, hilos y prioridad real.", "Gaming", false, false, true),
        ["gaming.cs2.launch"] = new("gaming.cs2.launch", "Lanzar CS2 mediante Steam", "Inicia Counter-Strike 2 vía Steam y confirma su arranque activo en la lista de procesos.", "Gaming", false, false, true),
        ["gaming.cs2.priority"] = new("gaming.cs2.priority", "Fijar Prioridad Alta en CS2", "Guarda la prioridad original de cs2.exe con validación de PID y asigna 'High'.", "Gaming", false, true, true),
        ["gaming.cs2.priority.restore"] = new("gaming.cs2.priority.restore", "Restaurar Prioridad Original de CS2", "Restaura la prioridad previa validando la identidad del proceso original.", "Gaming", false, false, true),

        // 3. Los 15 Modos Cortex
        ["cortex.mode.bestia"] = new("cortex.mode.bestia", "Prioridad de Juego", "Prioridad High para la instancia actual de CS2. Conserva afinidad y aplicaciones secundarias.", "Cortex", false, true, true),
        ["cortex.mode.torneo"] = new("cortex.mode.torneo", "Modo Torneo (Optimización DWM / Shell)", "Desactiva únicamente EnableTransparency de usuario, guardando su valor original. No garantiza mejora de FPS.", "Cortex", false, true, true, true, "¿Deseas optimizar la composición visual de Windows para máxima fluidez en CS2?"),
        ["cortex.mode.nucleo"] = new("cortex.mode.nucleo", "Plan de Alto Rendimiento", "Activa el plan de Alto Rendimiento existente y respalda el GUID original. No modifica BCD ni TRIM.", "Cortex", true, true, true),
        ["cortex.mode.timers"] = new("cortex.mode.timers", "Fix Timers TSC (Anti-HPET lento)", "Elimina temporizadores lentos y activa TSC nativo a 4GHz sin jitter.", "Cortex", true, true, true),
        ["cortex.mode.gpu"] = new("cortex.mode.gpu", "Prueba de configuración GPU", "Aplica MPO, HAGS y TDR con respaldos individuales. Requiere administrador y puede requerir reinicio; no prueba soporte efectivo del driver.", "Cortex", false, true, true),
        ["cortex.mode.stutter"] = new("cortex.mode.stutter", "Prueba PageCombining", "Desactiva PageCombining mediante MMAgent, guardando el valor original. No purga RAM ni detiene SysMain.", "Cortex", true, true, true),
        ["cortex.mode.network"] = new("cortex.mode.network", "Red Competitiva + Nagle OFF", "Establece TcpAckFrequency=1 y TCPNoDelay=1 en las interfaces activas.", "Cortex", true, true, true),
        ["cortex.mode.debloat"] = new("cortex.mode.debloat", "Debloat Quirúrgico Seguro", "Detiene DiagTrack y MapsBroker de forma reversible. No desinstala aplicaciones ni modifica seguridad.", "Cortex", true, true, true),
        ["cortex.mode.services"] = new("cortex.mode.services", "Servicios Gaming Switcher", "Detiene únicamente DiagTrack y MapsBroker si existen, conservando su estado real. No cambia el inicio automático.", "Cortex", true, true, true),
        ["cortex.mode.vbs"] = new("cortex.mode.vbs", "VBS / HVCI Toggle", "Ajusta aislamiento de virtualización de memoria. Requiere confirmación y reinicio.", "Cortex", true, true, true, true, "Modificar VBS/HVCI puede requerir reiniciar Windows. ¿Confirmar acción?"),
        ["cortex.mode.cleanup"] = new("cortex.mode.cleanup", "Limpieza Total NVMe + Cachés", "Purga archivos temporales seguros y limpia cachés de DirectX/Steam.", "Cortex", false, false, true),
        ["cortex.mode.watchdog"] = new("cortex.mode.watchdog", "Consultar CS2", "Consulta puntual del proceso sin cambiar prioridad ni afinidad. No instala un watchdog.", "Cortex", false, false, true),
        ["cortex.mode.bench"] = new("cortex.mode.bench", "Actualizar diagnóstico", "Lectura puntual del hardware. Para benchmarks utiliza las capturas de estabilidad.", "Cortex", false, false, true),
        ["cortex.mode.cfg"] = new("cortex.mode.cfg", "Desplegar CFG y Video.txt", "Genera y despliega autoexec.cfg optimizado en la ruta de CS2.", "Cortex", false, true, true),
        ["cortex.mode.restore"] = new("cortex.mode.restore", "Restaurar Todo al Modo Stock", "Revierte todos los valores modificados a sus snapshots originales de Windows.", "Cortex", false, false, true),

        // 4. Tweaks Atómicos
        ["tweak.cpu.affinity_15"] = new("tweak.cpu.affinity_15", "Afinidad explícita 0-3 (Máscara 15)", "Restringe CS2 a los primeros cuatro procesadores lógicos, sin detectar P-Cores. Puede reducir rendimiento.", "CPU", false, true, true, true, "La máscara 15 no garantiza P-Cores y puede empeorar FPS. ¿Aplicar para una prueba A/B?"),
        ["tweak.cpu.idledisable"] = new("tweak.cpu.idledisable", "Desactivar Reposo CPU (IDLEDISABLE)", "Desactiva reposo en el perfil AC del plan activo. Puede aumentar consumo y temperatura; no garantiza frecuencia fija.", "CPU", true, true, true),
        ["tweak.cpu.powerthrottling_off"] = new("tweak.cpu.powerthrottling_off", "Desactivar Power Throttling", "Escribe PowerThrottlingOff=1 con respaldo. No garantiza frecuencia fija ni mejora de rendimiento.", "CPU", true, true, true),
        ["tweak.cpu.win32priority"] = new("tweak.cpu.win32priority", "Win32PrioritySeparation a 38", "Modifica Win32PrioritySeparation globalmente a 38; no es prioridad exclusiva de CS2. Medir antes de conservar.", "CPU", true, true, true),
        ["tweak.gpu.mpo_fix"] = new("tweak.gpu.mpo_fix", "Desactivar Multi-Plane Overlay (MPO)", "Desactiva MPO mediante OverlayTestMode=5. Usar para probar una incidencia concreta; puede no ayudar.", "GPU", true, true, true),
        ["tweak.gpu.hags"] = new("tweak.gpu.hags", "HAGS HwSchMode = 2", "Aceleración por hardware del programador de GPU.", "GPU", true, true, true),
        ["tweak.gpu.tdr_delay"] = new("tweak.gpu.tdr_delay", "TdrDelay a 10", "Aumenta la tolerancia de tiempo de recuperación del driver gráfico.", "GPU", true, true, true),
        ["tweak.network.nagle_off"] = new("tweak.network.nagle_off", "Desactivar Algoritmo de Nagle", "Transmisión instantánea de paquetes de red sin retraso de 40ms.", "Red", true, true, true),
        ["tweak.network.autotuning_high"] = new("tweak.network.autotuning_high", "TCP Autotuning Level High", "Ajuste dinámico optimizado de ventanas de recepción TCP.", "Red", true, true, true),
        ["tweak.memory.pagecombining_off"] = new("tweak.memory.pagecombining_off", "Desactivar PageCombining", "Evita consumo de ciclos de CPU analizando páginas idénticas en RAM.", "Memoria", true, true, true),
        ["tweak.memory.pagefile_fixed"] = new("tweak.memory.pagefile_fixed", "Pagefile Fija Estática en NVMe", "Evita tirones causados por redimensionamiento dinámico de memoria virtual.", "Memoria", true, true, true),
        ["tweak.disk.trim_nvme"] = new("tweak.disk.trim_nvme", "Habilitar TRIM en SSD NVMe", "Mantiene la velocidad óptima de lectura de modelos y mapas.", "Disco", true, true, true),
        ["tweak.disk.disablelastaccess"] = new("tweak.disk.disablelastaccess", "Desactivar LastAccessTime", "Elimina escrituras innecesarias en el disco por cada lectura.", "Disco", true, true, true),
        ["tweak.security.defender_exclusions"] = new("tweak.security.defender_exclusions", "Exclusiones de CS2 en Defender", "Añade exclusiones para la carpeta de CS2 evitando escaneos en plena partida.", "Seguridad", true, true, true),
        ["tweak.services.update_pause"] = new("tweak.services.update_pause", "Pausar Windows Update en Juego", "Detiene temporalmente descargas en segundo plano mientras juegas.", "Servicios", true, true, true),
        ["tweak.services.gaming_toggle"] = new("tweak.services.gaming_toggle", "Alternar Servicios Gaming", "Detiene servicios secundarios de diagnóstico y mapas durante la sesión.", "Servicios", true, true, true),

        // 5. Orquestadores Ultra & God Mode
        ["cortex.mode.iniciar_todo"] = new("cortex.mode.iniciar_todo", "INICIAR_TODO_V3 (Suite Completa)", "Aplica plan de energía, PowerThrottling y transparencias con respaldos individuales. No crea un punto de restauración Windows.", "Orquestador", true, true, true, true, "¿Aplicar los tres módulos con respaldo individual? No se crea un punto de restauración Windows."),
        ["cortex.mode.auto_pre_game"] = new("cortex.mode.auto_pre_game", "24_AUTO_PRE_GAME (Lanzador Rápido)", "Ajusta transparencias y prioridad de CS2 ya iniciado. No purga RAM ni lanza el juego.", "Orquestador", false, true, true),
        ["cortex.mode.extreme_v2"] = new("cortex.mode.extreme_v2", "EXTREME_v2 (Modo Extremo)", "Aplica IDLEDISABLE AC, PowerThrottling, prioridad de ventana y MPO con respaldo individual.", "Orquestador", true, true, true),
        ["cortex.mode.extreme_undo"] = new("cortex.mode.extreme_undo", "EXTREME_Undo (Revertir Extremo)", "Revierte todos los cambios de Fase 2 al estado original.", "Orquestador", true, false, true),
        ["cortex.mode.god_mode"] = new("cortex.mode.god_mode", "GOD_MODE (Telemetría y Clamp)", "Supervisión activa con control térmico y telemetría de solo lectura.", "Orquestador", false, false, true)
    };

    public OptimizationService(
        ILogger<OptimizationService> logger,
        ISecurityService securityService,
        IBackupManager backupManager,
        IDiagnosticsService diagnosticsService, OperationJournal journal)
    {
        foreach (var definition in OptimizationLibrary.Definitions.Values) _catalog.Add(definition.Id, definition.Catalog);
        _journal = journal;
        _logger = logger;
        _securityService = securityService;
        _backupManager = backupManager;
        _diagnosticsService = diagnosticsService;
    }

    // Do not expose legacy executors with guessed snapshots or misleading scope.
    private static readonly HashSet<string> PendingReview = new(StringComparer.OrdinalIgnoreCase)
    {
        "system.temp.cleanup", "cortex.mode.cleanup", "cortex.mode.timers", "cortex.mode.network", "cortex.mode.vbs", "cortex.mode.cfg", "cortex.mode.god_mode",
        "tweak.network.nagle_off", "tweak.network.autotuning_high", "tweak.memory.pagefile_fixed",
        "tweak.disk.trim_nvme", "tweak.disk.disablelastaccess", "tweak.security.defender_exclusions",
        "tweak.services.update_pause", "cortex.mode.restore", "cortex.mode.extreme_undo"
    };
    private static readonly Dictionary<string, string[]> Presets = new()
    {
        ["cortex.mode.gpu"] = ["tweak.gpu.mpo_fix", "tweak.gpu.hags", "tweak.gpu.tdr_delay"],
        ["cortex.mode.extreme_v2"] = ["tweak.cpu.idledisable", "tweak.cpu.powerthrottling_off", "tweak.cpu.win32priority", "tweak.gpu.mpo_fix"],
        ["cortex.mode.iniciar_todo"] = ["cortex.mode.nucleo", "tweak.cpu.powerthrottling_off", "cortex.mode.torneo"],
        ["cortex.mode.auto_pre_game"] = ["cortex.mode.torneo", "gaming.cs2.priority"]
    };

    private async Task<OperationResult> ExecutePresetAsync(string id, bool restore)
    {
        var timer = Stopwatch.StartNew();
        var results = new List<OperationResult>();
        var children = restore ? Presets[id].Reverse() : Presets[id].AsEnumerable();
        foreach (var child in children)
        {
            if (restore && !(await GetOperationStatusAsync(child)).HasBackup) continue;
            var result = restore ? await RestoreOperationAsync(child) : await ApplyOperationAsync(child);
            results.Add(result);
            // Apply stops on first failure. Restore attempts every backed-up child.
            if (!result.Success && !restore) break;
        }
        var success = results.Count > 0 && results.All(r => r.Success);
        return new(success, id, restore ? "restore" : "apply", DateTime.UtcNow,
            timer.Elapsed.TotalMilliseconds, results.SelectMany(r => r.Logs).ToList(), null,
            new { Steps = results, PartialChangesPossible = !success },
            success ? null : "Secuencia incompleta. Consulta los pasos; restaura los módulos con respaldo. No se realizó rollback automático.",
            restore && success);
    }

    public Task<IReadOnlyList<OperationCatalogItem>> GetCatalogAsync()
    {
        return Task.FromResult<IReadOnlyList<OperationCatalogItem>>(_catalog.Values
            .Select(item => item with { CanRestore = HasVerifiedRestore(item.Id),
                IsImplemented = item.IsImplemented && !PendingReview.Contains(item.Id),
                IsReadOnly = item.Id is "system.hardware.refresh" or "system.processes.list" or "gaming.cs2.detect" or "cortex.mode.watchdog" or "cortex.mode.bench" or "telemetry.realtime",
                RequiresRestart = item.RequiresRestart || item.Id.StartsWith("tweak.gpu.") || item.Id is "cortex.mode.gpu" or "tweak.cpu.win32priority" or "tweak.cpu.powerthrottling_off",
                AvailabilityReason = PendingReview.Contains(item.Id) ? "Sin implementación verificable/reversión en este motor, o reemplazado por un flujo específico. No ejecutar scripts heredados como sustituto." : null,
                RequiresElevation = item.RequiresElevation || item.Id is "cortex.mode.gpu" or "cortex.mode.extreme_v2" or "cortex.mode.iniciar_todo" }).ToList());
    }

    private bool HasVerifiedRestore(string id) => OptimizationLibrary.Definitions.ContainsKey(id) || Presets.ContainsKey(id) || RegistryOperations.Supports(id) || PowerOperations.Supports(id) || TuningOperations.Supports(id)
        || id is "gaming.cs2.priority" or "cortex.mode.bestia" or "tweak.cpu.affinity_15";

    public async Task<OperationResult> ApplyOperationAsync(string operationId)
    {
        _journal.Touch();
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
                ErrorMessage: $"La operación '{operationId}' no está permitida o no forma parte de la lista blanca de seguridad.",
                Restored: false
            );
            RecordHistory(operationId, "apply", false, sw.Elapsed.TotalMilliseconds, "Acceso denegado: acción no permitida", errResult.ErrorMessage);
            return errResult;
        }

        try
        {
            if (PendingReview.Contains(operationId)) throw new NotSupportedException("Módulo deshabilitado hasta completar implementación verificable y restauración real.");
            if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("El motor de optimización requiere Windows.");
            if (_catalog.TryGetValue(operationId, out var entry) && (entry.RequiresElevation || operationId is "cortex.mode.gpu" or "cortex.mode.extreme_v2" or "cortex.mode.iniciar_todo") && !_securityService.IsElevated())
                throw new UnauthorizedAccessException("Esta operación requiere ejecutar el motor como administrador.");
            OperationResult result = OptimizationLibrary.Definitions.ContainsKey(operationId) ? await LibraryOperations.ExecuteAsync(operationId, false)
                : Presets.ContainsKey(operationId) ? await ExecutePresetAsync(operationId, false)
                : GameOperations.Supports(operationId) ? await GameOperations.ExecuteAsync(operationId, false)
                : RegistryOperations.Supports(operationId)
                ? await RegistryOperations.ExecuteAsync(operationId, false)
                : TuningOperations.Supports(operationId) ? await TuningOperations.ExecuteAsync(operationId, false)
                : PowerOperations.Supports(operationId) ? await PowerOperations.ExecuteAsync(operationId, false)
                : operationId switch
            {
                "system.hardware.refresh" or "cortex.mode.bench" => await ExecuteHardwareRefreshAsync(logs, sw),
                "system.processes.list" => await ExecuteProcessesListAsync(logs, sw),
                "telemetry.realtime" => await ExecuteTelemetryReadAsync(logs, sw),
                "gaming.cs2.detect" or "cortex.mode.watchdog" => await ExecuteCs2DetectAndAffinityAsync(logs, sw),
                "gaming.cs2.launch" => await ExecuteCs2LaunchWithConfirmationAsync(logs, sw),
                _ => throw new NotSupportedException($"La operación '{operationId}' no tiene un ejecutor verificado.")
            };

            RecordHistory(operationId, "apply", result.Success, result.DurationMs,
                result.Success ? "Solicitud procesada: consulta alcance y lectura posterior en el resultado" : "Operación finalizada con advertencia",
                result.ErrorMessage);

            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Error al ejecutar '{OperationId}'", operationId);
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

            RecordHistory(operationId, "apply", false, sw.Elapsed.TotalMilliseconds, "Fallo de ejecución", ex.Message);
            return failResult;
        }
    }

    public async Task<OperationResult> RestoreOperationAsync(string operationId)
    {
        _journal.Touch();
        var sw = Stopwatch.StartNew();
        var logs = new List<string>();
        DateTime startedAt = DateTime.UtcNow;

        logs.Add($"[INICIO RESTAURACIÓN] Solicitando reversión de: '{operationId}'");

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
            if (PendingReview.Contains(operationId)) throw new NotSupportedException("Módulo deshabilitado hasta completar implementación verificable y restauración real.");
            if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("El motor de optimización requiere Windows.");
            if (_catalog.TryGetValue(operationId, out var entry) && (entry.RequiresElevation || operationId is "cortex.mode.gpu" or "cortex.mode.extreme_v2" or "cortex.mode.iniciar_todo") && !_securityService.IsElevated())
                throw new UnauthorizedAccessException("Esta operación requiere ejecutar el motor como administrador.");
            OperationResult result = OptimizationLibrary.Definitions.ContainsKey(operationId) ? await LibraryOperations.ExecuteAsync(operationId, true)
                : Presets.ContainsKey(operationId) ? await ExecutePresetAsync(operationId, true)
                : GameOperations.Supports(operationId) ? await GameOperations.ExecuteAsync(operationId, true)
                : RegistryOperations.Supports(operationId)
                ? await RegistryOperations.ExecuteAsync(operationId, true)
                : TuningOperations.Supports(operationId) ? await TuningOperations.ExecuteAsync(operationId, true)
                : PowerOperations.Supports(operationId) ? await PowerOperations.ExecuteAsync(operationId, true)
                : throw new NotSupportedException($"La operación '{operationId}' no dispone de restauración verificada. Respaldo conservado.");

            RecordHistory(operationId, "restore", result.Success, result.DurationMs,
                result.Success ? "Valores originales restaurados con éxito" : "Fallo al restaurar valores",
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

            RecordHistory(operationId, "restore", false, sw.Elapsed.TotalMilliseconds, "Excepción en restauración", ex.Message);
            return failResult;
        }
    }

    public async Task<OperationResult> RestoreVerifiedAsync()
    {
        var timer = Stopwatch.StartNew();
        // Canonical IDs only, never legacy guessed snapshots. Plan restored last.
        string[] ids = ["gaming.cs2.priority", "tweak.services.gaming_toggle", "tweak.memory.pagecombining_off",
            "cortex.mode.torneo", "tweak.gpu.mpo_fix", "tweak.gpu.hags", "tweak.gpu.tdr_delay",
            "tweak.cpu.powerthrottling_off", "tweak.cpu.win32priority", "tweak.cpu.idledisable", "cortex.mode.nucleo"];
        var results = new List<OperationResult>();
        foreach (var id in OptimizationLibrary.Definitions.Keys.Reverse().Concat(ids))
            if ((await GetOperationStatusAsync(id)).HasBackup) results.Add(await RestoreOperationAsync(id));
        var success = results.All(r => r.Success);
        return new(success, "restore.verified", "restore", DateTime.UtcNow, timer.Elapsed.TotalMilliseconds,
            results.Count == 0 ? ["No se encontraron respaldos verificados; no se modificó Windows."] : results.SelectMany(r => r.Logs).ToList(),
            null, new { Steps = results }, success ? null : "Restauración parcial: revisa los pasos. No se borran respaldos fallidos.", success);
    }

    public Task<IReadOnlyList<OperationHistoryItem>> GetHistoryAsync()
    {
        var list = _history.OrderByDescending(h => h.TimestampUtc).Take(60).ToList();
        return Task.FromResult<IReadOnlyList<OperationHistoryItem>>(list);
    }

    public async Task<OperationStatusResponse> GetOperationStatusAsync(string operationId)
    {
        bool isImplemented = _catalog.TryGetValue(operationId, out var item) && item.IsImplemented && !PendingReview.Contains(operationId);
        bool canRestore = isImplemented && HasVerifiedRestore(operationId);
        bool hasBackup = _backupManager.HasBackup(
            OptimizationLibrary.Definitions.ContainsKey(operationId) ? LibraryOptimizationService.BackupKey(operationId) :
            GameOperations.Supports(operationId) ? GameOptimizationService.BackupKey :
            TuningOperations.Supports(operationId) ? $"verified.v1.{TuningOperations.CanonicalId(operationId)}" :
            PowerOperations.Supports(operationId) || RegistryOperations.Supports(operationId)
                ? $"verified.v1.{operationId}" : operationId);

        if (Presets.TryGetValue(operationId, out var children))
        {
            var states = await Task.WhenAll(children.Select(GetOperationStatusAsync));
            hasBackup = states.Any(state => state.HasBackup);
        }

        var lastRun = _history.Where(h => h.OperationId.Equals(operationId, StringComparison.OrdinalIgnoreCase))
                              .OrderByDescending(h => h.TimestampUtc)
                              .FirstOrDefault();

        object? currentState = null;
        string? message = null;

        if (operationId.Contains("cs2"))
        {
            var cs2State = GetCs2CurrentProcessState();
            currentState = cs2State;
            message = cs2State.IsRunning ? $"cs2.exe activo (PID {cs2State.ProcessId}, Prioridad {cs2State.PriorityClass})" : "CS2 no está en ejecución.";
        }

        return new OperationStatusResponse(
            OperationId: operationId,
            IsImplemented: isImplemented,
            CanRestore: canRestore,
            HasBackup: hasBackup,
            LastRunUtc: lastRun?.TimestampUtc,
            CurrentState: currentState,
            Message: message
        );
    }

    public Task<RealtimeTelemetryData> GetRealtimeTelemetryAsync()
    {
        DateTime now = DateTime.UtcNow;
        string timeStr = now.ToLocalTime().ToString("HH:mm:ss");

        // 1. Memoria RAM física real
        double? ramFreeMb = null;
        double? ramTotalMb = null;
        double? ramUsedPct = null;

        try
        {
            var memStatus = new MEMORYSTATUSEX();
            memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
            if (GlobalMemoryStatusEx(ref memStatus))
            {
                ramTotalMb = Math.Round(memStatus.ullTotalPhys / (1024.0 * 1024.0), 1);
                ramFreeMb = Math.Round(memStatus.ullAvailPhys / (1024.0 * 1024.0), 1);
                ramUsedPct = ramTotalMb > 0 ? Math.Round(((ramTotalMb.Value - ramFreeMb.Value) / ramTotalMb.Value) * 100.0, 1) : 0;
            }
        }
        catch { }

        // 2. CPU Usage & Clock
        int cpuCores = Environment.ProcessorCount;
        double? cpuUsage = GetSystemCpuUsage();
        int maxClockMhz = 0;
        int currentClockMhz = 0;

        try
        {
            using var searcher = new System.Management.ManagementObjectSearcher("SELECT CurrentClockSpeed, MaxClockSpeed FROM Win32_Processor");
            foreach (System.Management.ManagementObject obj in searcher.Get())
            {
                if (int.TryParse(obj["CurrentClockSpeed"]?.ToString(), out int cur)) currentClockMhz = cur;
                if (int.TryParse(obj["MaxClockSpeed"]?.ToString(), out int max) && max > 0) maxClockMhz = max;
                break;
            }
        }
        catch { }

        double? clkPct = maxClockMhz > 0 && currentClockMhz > 0
            ? Math.Round((double)currentClockMhz / maxClockMhz * 100.0, 1) : null;
        // GPU utilization is not derivable from CPU usage. ACPI is not CPU package temperature.
        double? gpuUsage = null;
        var cs2State = GetCs2CurrentProcessState();
        double? temp = null;
        try
        {
            using var searcher = new System.Management.ManagementObjectSearcher(@"root\WMI", "SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature");
            foreach (System.Management.ManagementObject obj in searcher.Get())
            {
                if (long.TryParse(obj["CurrentTemperature"]?.ToString(), out long kelvinTenths))
                {
                    double c = (kelvinTenths / 10.0) - 273.15;
                    if (c is > 20 and < 115) temp = Math.Round(c, 1);
                }
                break;
            }
        }
        catch { }

        // No hardware limit-reason sensor is available. Never infer thermal/power throttling from a clock ratio.
        string throttling = "UNKNOWN";

        var data = new RealtimeTelemetryData(
            TimestampUtc: now,
            TimeString: timeStr,
            CpuUsagePct: cpuUsage is double usage ? Math.Round(usage, 1) : null,
            CpuClockPct: clkPct,
            CpuClockMhz: currentClockMhz > 0 ? currentClockMhz : null,
            GpuUsagePct: gpuUsage,
            RamFreeMb: ramFreeMb,
            RamTotalMb: ramTotalMb,
            RamUsedPct: ramUsedPct,
            TemperatureCelsius: temp,
            ThrottlingStatus: throttling,
            TelemetrySource: "CPU: delta GetSystemTimes; RAM: GlobalMemoryStatusEx; clock: WMI reportado (no reloj efectivo); temperatura: zona ACPI (no paquete CPU); GPU y throttling: no disponibles",
            IsCs2Running: cs2State.IsRunning,
            Cs2ProcessId: cs2State.ProcessId
        );

        return Task.FromResult(data);
    }

    private async Task<OperationResult> ExecuteTelemetryReadAsync(List<string> logs, Stopwatch sw)
    {
        var data = await GetRealtimeTelemetryAsync();
        logs.Add(data.TelemetrySource);
        return new(true, "telemetry.realtime", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, data, null, false);
    }

    #region Implementaciones Detalladas

    // 1. Diagnóstico de Hardware en Vivo
    private async Task<OperationResult> ExecuteHardwareRefreshAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[DIAGNÓSTICO] Consultando hardware en tiempo real vía WMI y Kernel...");
        var report = await _diagnosticsService.GetSystemHardwareReportAsync(forceRefresh: true);

        logs.Add($"[SISTEMA] {report.OperatingSystem.Name} (Build {report.OperatingSystem.BuildNumber}, {report.OperatingSystem.Architecture})");
        logs.Add($"[CPU] {report.Processor.Name} ({report.Processor.PhysicalCores} núcleos / {report.Processor.LogicalProcessors} hilos)");
        logs.Add($"[RAM] Total: {report.Memory.TotalGb} GB | Libre: {report.Memory.AvailableGb} GB ({report.Memory.UsedPercentage}% en uso)");
        logs.Add($"[GPU] Adaptador: {report.GraphicsCards.FirstOrDefault()?.Name} (VRAM: {report.GraphicsCards.FirstOrDefault()?.AdapterRamMb} MB)");
        logs.Add($"[DISCO] Unidades disponibles: {string.Join(", ", report.StorageDrives.Select(d => $"{d.DriveLetter} {d.FreeGb}GB libres"))}");

        sw.Stop();
        logs.Add($"[OK] Diagnóstico completado en {sw.Elapsed.TotalMilliseconds:F1} ms.");

        return new OperationResult(true, "system.hardware.refresh", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, report, null, false);
    }

    // 2. Enumeración Segura de Procesos
    private Task<OperationResult> ExecuteProcessesListAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[PROCESOS] Leyendo tabla activa del planificador de tareas de Windows...");
        var procs = Process.GetProcesses();
        int total = procs.Length;

        var top = procs.Select(p =>
        {
            try
            {
                return new ProcessSummaryItem(p.Id, p.ProcessName, p.WorkingSet64, Math.Round(p.WorkingSet64 / (1024.0 * 1024.0), 1), GetSafePriorityClass(p));
            }
            catch { return null; }
            finally { p.Dispose(); }
        })
        .Where(p => p != null)
        .OrderByDescending(p => p!.WorkingSetBytes)
        .Take(12)
        .ToList();

        logs.Add($"[TOTAL] {total} procesos activos. Top consumo de memoria:");
        foreach (var p in top)
        {
            logs.Add($"  - PID {p!.Id,5} | {p.Name,-22} | {p.WorkingSetMb,6:F1} MB | Prioridad: {p.PriorityClass}");
        }

        sw.Stop();
        logs.Add($"[OK] Tabla de procesos obtenida en {sw.Elapsed.TotalMilliseconds:F1} ms.");
        return Task.FromResult(new OperationResult(true, "system.processes.list", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { TotalCount = total, TopProcesses = top }, null, false));
    }

    // 3. Limpieza Segura de Temporales
    // 4. Lanzamiento de CS2 con confirmación activa de arranque (Requerimiento 5)
    private async Task<OperationResult> ExecuteCs2LaunchWithConfirmationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[STEAM] Solicitando lanzamiento oficial de Counter-Strike 2 vía steam://rungameid/730...");

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "steam://rungameid/730",
                UseShellExecute = true
            });
            logs.Add("[SOLICITUD ENVIADA] Protocolo invocado. Verificando arranque de cs2.exe en Windows...");
        }
        catch (Exception ex)
        {
            sw.Stop();
            logs.Add($"[ERROR STEAM] {ex.Message}");
            return new OperationResult(false, "gaming.cs2.launch", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, null, ex.Message, false);
        }

        // Sondeo activo durante hasta 8 segundos para confirmar arranque real
        bool confirmed = false;
        int pid = 0;

        for (int i = 0; i < 8; i++)
        {
            await Task.Delay(1000);
            var procs = Process.GetProcessesByName("cs2");
            if (procs.Length > 0) { confirmed = true; pid = procs[0].Id; }
            foreach (var candidate in procs) candidate.Dispose();
            if (confirmed) break;
            logs.Add($"[ESPERANDO] Sondeo {i + 1}/8: cs2.exe aún inicializando en Steam...");
        }

        sw.Stop();
        if (confirmed)
        {
            logs.Add($"[ARRANQUE CONFIRMADO] ¡Counter-Strike 2 está activo con PID {pid}!");
            return new OperationResult(true, "gaming.cs2.launch", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { IsRunning = true, ProcessId = pid }, null, false);
        }
        else
        {
            logs.Add("[INFO] Petición enviada exitosamente a Steam. El proceso cs2.exe puede estar actualizando shaders o conectando a la cuenta.");
            return new OperationResult(true, "gaming.cs2.launch", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { IsRunning = false, Status = "Lanzamiento solicitado, pendiente de inicialización en Steam" }, null, false);
        }
    }

    // 7. Watchdog Loop Detección y Afinidad
    private Task<OperationResult> ExecuteCs2DetectAndAffinityAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[WATCHDOG] Comprobando estado en tiempo real de Counter-Strike 2...");
        var state = GetCs2CurrentProcessState();

        logs.Add(state.IsRunning ? $"CS2 detectado: PID {state.ProcessId}. Consulta de solo lectura; no cambia afinidad."
            : "CS2 no está ejecutándose.");

        sw.Stop();
        return Task.FromResult(new OperationResult(true, "gaming.cs2.detect", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, state, null, false));
    }

    #endregion

    #region Utilidades y Consultas de Sistema

    private static Cs2ProcessState GetCs2CurrentProcessState()
    {
        try
        {
            var procs = Process.GetProcessesByName("cs2");
            if (procs.Length == 0)
            {
                return new Cs2ProcessState(false, null, null, null, null, null, "No se encontró el proceso cs2.exe.");
            }

            using var p = procs[0];
            foreach (var other in procs.Skip(1)) other.Dispose();
            string priority = GetSafePriorityClass(p);
            double mb = Math.Round(p.WorkingSet64 / (1024.0 * 1024.0), 1);
            DateTime? startTime = null;
            try { startTime = p.StartTime.ToUniversalTime(); } catch { }

            return new Cs2ProcessState(true, p.Id, priority, p.Threads.Count, mb, startTime, $"cs2.exe activo (PID {p.Id}, {priority})");
        }
        catch (Exception ex)
        {
            return new Cs2ProcessState(false, null, null, null, null, null, $"Error al consultar cs2.exe: {ex.Message}");
        }
    }

    private static string GetSafePriorityClass(Process p)
    {
        try { return p.PriorityClass.ToString(); }
        catch { return "NoDisponible"; }
    }

    private static readonly object CpuSampleLock = new();
    private static (ulong Idle, ulong Total)? LastCpuSample;
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetSystemTimes(out ulong idle, out ulong kernel, out ulong user);

    private static double? GetSystemCpuUsage()
    {
        lock (CpuSampleLock)
        {
            if (!OperatingSystem.IsWindows() || !GetSystemTimes(out var idle, out var kernel, out var user)) return null;
            var total = kernel + user; // Kernel includes idle time.
            var previous = LastCpuSample;
            LastCpuSample = (idle, total);
            if (previous is null || total <= previous.Value.Total || idle < previous.Value.Idle) return null;
            var elapsed = total - previous.Value.Total;
            var idleElapsed = idle - previous.Value.Idle;
            return idleElapsed <= elapsed ? Math.Clamp(100.0 * (elapsed - idleElapsed) / elapsed, 0, 100) : null;
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

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    #endregion
}
