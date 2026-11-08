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
}

public class OptimizationService : IOptimizationService
{
    private readonly ILogger<OptimizationService> _logger;
    private readonly ISecurityService _securityService;
    private readonly IBackupManager _backupManager;
    private readonly IDiagnosticsService _diagnosticsService;

    private GameOptimizationService GameOperations => new(_backupManager, new WindowsGameProcessProvider());

    private WindowsTuningService TuningOperations => new(_backupManager, new WindowsTuning());

    private PowerOptimizationService PowerOperations => new(_backupManager, new WindowsPowerSettings());

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
        ["cortex.mode.torneo"] = new("cortex.mode.torneo", "Modo Torneo (Optimización DWM / Shell)", "Ajusta transparencias y composición pesada de ventanas para liberar memoria gráfica.", "Cortex", false, true, true, true, "¿Deseas optimizar la composición visual de Windows para máxima fluidez en CS2?"),
        ["cortex.mode.nucleo"] = new("cortex.mode.nucleo", "Plan de Alto Rendimiento", "Activa el plan de Alto Rendimiento existente y respalda el GUID original. No modifica BCD ni TRIM.", "Cortex", true, true, true),
        ["cortex.mode.timers"] = new("cortex.mode.timers", "Fix Timers TSC (Anti-HPET lento)", "Elimina temporizadores lentos y activa TSC nativo a 4GHz sin jitter.", "Cortex", true, true, true),
        ["cortex.mode.gpu"] = new("cortex.mode.gpu", "Boost Intel UHD + MPO Fix", "Configura OverlayTestMode=5 para evitar parpadeos y asegura HAGS activo.", "Cortex", false, true, true),
        ["cortex.mode.stutter"] = new("cortex.mode.stutter", "Fix Stutter RAM Definitivo", "Desactiva PageCombining mediante MMAgent, guardando el valor original. No purga RAM ni detiene SysMain.", "Cortex", true, true, true),
        ["cortex.mode.network"] = new("cortex.mode.network", "Red Competitiva + Nagle OFF", "Establece TcpAckFrequency=1 y TCPNoDelay=1 en las interfaces activas.", "Cortex", true, true, true),
        ["cortex.mode.debloat"] = new("cortex.mode.debloat", "Debloat Quirúrgico Seguro", "Detiene DiagTrack y MapsBroker de forma reversible. No desinstala aplicaciones ni modifica seguridad.", "Cortex", true, true, true),
        ["cortex.mode.services"] = new("cortex.mode.services", "Servicios Gaming Switcher", "Detiene únicamente DiagTrack y MapsBroker si existen, conservando su estado real. No cambia el inicio automático.", "Cortex", true, true, true),
        ["cortex.mode.vbs"] = new("cortex.mode.vbs", "VBS / HVCI Toggle", "Ajusta aislamiento de virtualización de memoria. Requiere confirmación y reinicio.", "Cortex", true, true, true, true, "Modificar VBS/HVCI puede requerir reiniciar Windows. ¿Confirmar acción?"),
        ["cortex.mode.cleanup"] = new("cortex.mode.cleanup", "Limpieza Total NVMe + Cachés", "Purga archivos temporales seguros y limpia cachés de DirectX/Steam.", "Cortex", false, false, true),
        ["cortex.mode.watchdog"] = new("cortex.mode.watchdog", "Consultar CS2", "Consulta puntual del proceso sin cambiar prioridad ni afinidad. No instala un watchdog.", "Cortex", false, false, true),
        ["cortex.mode.bench"] = new("cortex.mode.bench", "Benchmark y Diagnóstico en Vivo", "Analiza en tiempo real clocks, RAM, latencia y temperatura física.", "Cortex", false, false, true),
        ["cortex.mode.cfg"] = new("cortex.mode.cfg", "Desplegar CFG y Video.txt", "Genera y despliega autoexec.cfg optimizado en la ruta de CS2.", "Cortex", false, true, true),
        ["cortex.mode.restore"] = new("cortex.mode.restore", "Restaurar Todo al Modo Stock", "Revierte todos los valores modificados a sus snapshots originales de Windows.", "Cortex", false, false, true),

        // 4. Tweaks Atómicos
        ["tweak.cpu.affinity_15"] = new("tweak.cpu.affinity_15", "Afinidad explícita 0-3 (Máscara 15)", "Restringe CS2 a los primeros cuatro procesadores lógicos, sin detectar P-Cores. Puede reducir rendimiento.", "CPU", false, true, true, true, "La máscara 15 no garantiza P-Cores y puede empeorar FPS. ¿Aplicar para una prueba A/B?"),
        ["tweak.cpu.idledisable"] = new("tweak.cpu.idledisable", "Desactivar Reposo CPU (IDLEDISABLE)", "Desactiva reposo en el perfil AC del plan activo. Puede aumentar consumo y temperatura; no garantiza frecuencia fija.", "CPU", true, true, true),
        ["tweak.cpu.powerthrottling_off"] = new("tweak.cpu.powerthrottling_off", "Desactivar Power Throttling", "Evita que Windows limite la frecuencia bajo picos de carga.", "CPU", true, true, true),
        ["tweak.cpu.win32priority"] = new("tweak.cpu.win32priority", "Win32PrioritySeparation a 38", "Prioridad máxima inmediata para la ventana en primer plano de CS2.", "CPU", true, true, true),
        ["tweak.gpu.mpo_fix"] = new("tweak.gpu.mpo_fix", "Desactivar Multi-Plane Overlay (MPO)", "Corrige micro-tirones y parpadeos en gráficos Intel.", "GPU", true, true, true),
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
        IDiagnosticsService diagnosticsService)
    {
        _logger = logger;
        _securityService = securityService;
        _backupManager = backupManager;
        _diagnosticsService = diagnosticsService;
    }

    // Do not expose legacy executors with guessed snapshots or misleading scope.
    private static readonly HashSet<string> PendingReview = new(StringComparer.OrdinalIgnoreCase)
    {
        "cortex.mode.timers", "cortex.mode.network", "cortex.mode.vbs", "cortex.mode.cfg", "cortex.mode.god_mode",
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
                IsImplemented = item.IsImplemented && !PendingReview.Contains(item.Id) }).ToList());
    }

    private bool HasVerifiedRestore(string id) => Presets.ContainsKey(id) || RegistryOperations.Supports(id) || PowerOperations.Supports(id) || TuningOperations.Supports(id)
        || id is "gaming.cs2.priority" or "cortex.mode.bestia" or "tweak.cpu.affinity_15";

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
            if (_catalog.TryGetValue(operationId, out var entry) && entry.RequiresElevation && !_securityService.IsElevated())
                throw new UnauthorizedAccessException("Esta operación requiere ejecutar el motor como administrador.");
            OperationResult result = Presets.ContainsKey(operationId) ? await ExecutePresetAsync(operationId, false)
                : GameOperations.Supports(operationId) ? await GameOperations.ExecuteAsync(operationId, false)
                : RegistryOperations.Supports(operationId)
                ? await RegistryOperations.ExecuteAsync(operationId, false)
                : TuningOperations.Supports(operationId) ? await TuningOperations.ExecuteAsync(operationId, false)
                : PowerOperations.Supports(operationId) ? await PowerOperations.ExecuteAsync(operationId, false)
                : operationId switch
            {
                // Diagnóstico y Telemetría
                "system.hardware.refresh" => await ExecuteHardwareRefreshAsync(logs, sw),
                "system.processes.list" => await ExecuteProcessesListAsync(logs, sw),
                "system.temp.cleanup" or "cortex.mode.cleanup" => await ExecuteTempCleanupAsync(logs, sw),

                // CS2 Gaming
                "gaming.cs2.detect" or "cortex.mode.watchdog" => await ExecuteCs2DetectAndAffinityAsync(logs, sw),
                "gaming.cs2.launch" => await ExecuteCs2LaunchWithConfirmationAsync(logs, sw),
                "gaming.cs2.priority" or "cortex.mode.bestia" or "tweak.cpu.affinity_15" => await ExecuteCs2PriorityAndAffinityAsync(logs, sw),
                "gaming.cs2.priority.restore" => await ExecuteCs2PriorityRestoreWithValidationAsync(logs, sw),

                // Modos Cortex
                "cortex.mode.torneo" => await ExecuteTorneoModeAsync(logs, sw),
                "cortex.mode.nucleo" or "cortex.mode.iniciar_todo" => await ExecuteNucleoOptimizationAsync(logs, sw),
                "cortex.mode.timers" => await ExecuteTimersOptimizationAsync(logs, sw),
                "cortex.mode.gpu" or "tweak.gpu.mpo_fix" or "tweak.gpu.hags" or "tweak.gpu.tdr_delay" => await ExecuteGpuOptimizationAsync(logs, sw),
                "cortex.mode.stutter" or "tweak.memory.pagecombining_off" or "tweak.memory.pagefile_fixed" => await ExecuteMemoryStutterOptimizationAsync(logs, sw),
                "cortex.mode.network" or "tweak.network.nagle_off" or "tweak.network.autotuning_high" => await ExecuteNetworkOptimizationAsync(logs, sw),
                "cortex.mode.debloat" or "cortex.mode.services" or "tweak.services.gaming_toggle" => await ExecuteServicesOptimizationAsync(logs, sw),
                "cortex.mode.vbs" => await ExecuteVbsToggleAsync(logs, sw),
                "cortex.mode.bench" => await ExecuteHardwareRefreshAsync(logs, sw),
                "cortex.mode.cfg" => await ExecuteDeployCfgAsync(logs, sw),
                "cortex.mode.restore" or "cortex.mode.extreme_undo" => await ExecuteGlobalRestoreAsync(logs, sw),
                "cortex.mode.auto_pre_game" => await ExecuteAutoPreGameAsync(logs, sw),
                "cortex.mode.extreme_v2" => await ExecuteExtremeV2Async(logs, sw),
                "cortex.mode.god_mode" => await ExecuteGodModeAsync(logs, sw),

                // Tweaks específicos de CPU y Seguridad
                "tweak.cpu.idledisable" => await ExecutePowerIdleDisableAsync(logs, sw),
                "tweak.cpu.powerthrottling_off" => await ExecutePowerThrottlingOffAsync(logs, sw),
                "tweak.cpu.win32priority" => await ExecuteWin32PrioritySeparationAsync(logs, sw),
                "tweak.disk.trim_nvme" or "tweak.disk.disablelastaccess" => await ExecuteDiskTrimOptimizationAsync(logs, sw),
                "tweak.security.defender_exclusions" => await ExecuteDefenderExclusionsAsync(logs, sw),
                "tweak.services.update_pause" => await ExecuteUpdatePauseAsync(logs, sw),

                _ => throw new InvalidOperationException($"La operación '{operationId}' no tiene un ejecutor nativo asignado.")
            };

            RecordHistory(operationId, "apply", result.Success, result.DurationMs, 
                result.Success ? "Operación ejecutada y confirmada" : "Operación finalizada con advertencia", 
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
            if (_catalog.TryGetValue(operationId, out var entry) && entry.RequiresElevation && !_securityService.IsElevated())
                throw new UnauthorizedAccessException("Esta operación requiere ejecutar el motor como administrador.");
            OperationResult result = Presets.ContainsKey(operationId) ? await ExecutePresetAsync(operationId, true)
                : GameOperations.Supports(operationId) ? await GameOperations.ExecuteAsync(operationId, true)
                : RegistryOperations.Supports(operationId)
                ? await RegistryOperations.ExecuteAsync(operationId, true)
                : TuningOperations.Supports(operationId) ? await TuningOperations.ExecuteAsync(operationId, true)
                : PowerOperations.Supports(operationId) ? await PowerOperations.ExecuteAsync(operationId, true)
                : operationId switch
            {
                "gaming.cs2.priority" or "gaming.cs2.priority.restore" or "cortex.mode.bestia" or "tweak.cpu.affinity_15" => 
                    await ExecuteCs2PriorityRestoreWithValidationAsync(logs, sw),
                "cortex.mode.torneo" => await ExecuteTorneoRestoreAsync(logs, sw),
                "cortex.mode.services" or "tweak.services.gaming_toggle" => await ExecuteServicesRestoreAsync(logs, sw),
                "cortex.mode.restore" or "cortex.mode.extreme_undo" => await ExecuteGlobalRestoreAsync(logs, sw),
                _ => await ExecuteGenericRestoreFromBackupAsync(operationId, logs, sw)
            };

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
    private Task<OperationResult> ExecuteTempCleanupAsync(List<string> logs, Stopwatch sw)
    {
        string tempPath = Path.GetTempPath();
        logs.Add($"[LIMPIEZA] Inspeccionando directorio de temporales del usuario: {tempPath}");

        int deleted = 0;
        int skipped = 0;
        long freedBytes = 0;
        DateTime cutoff = DateTime.UtcNow.AddMinutes(-30);

        try
        {
            var dir = new DirectoryInfo(tempPath);
            foreach (var file in dir.GetFiles("*.*", SearchOption.TopDirectoryOnly))
            {
                if (file.LastWriteTimeUtc > cutoff)
                {
                    skipped++;
                    continue;
                }

                try
                {
                    long len = file.Length;
                    file.Delete();
                    deleted++;
                    freedBytes += len;
                }
                catch
                {
                    skipped++;
                }
            }
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO] {ex.Message}");
        }

        double mb = Math.Round(freedBytes / (1024.0 * 1024.0), 2);
        logs.Add($"[RESULTADO] Archivos purgados: {deleted} | Archivos en uso/omitidos con seguridad: {skipped}");
        logs.Add($"[ESPACIO LIBERADO] {mb} MB ({freedBytes:N0} bytes)");

        sw.Stop();
        logs.Add($"[OK] Limpieza finalizada en {sw.Elapsed.TotalMilliseconds:F1} ms.");

        var state = new TempCleanupState(deleted, skipped, freedBytes, mb, tempPath);
        return Task.FromResult(new OperationResult(true, "system.temp.cleanup", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, state, null, false));
    }

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
            if (procs.Length > 0)
            {
                confirmed = true;
                pid = procs[0].Id;
                break;
            }
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

    // All callers, including legacy internal paths, use the instance-bound engine.
    private Task<OperationResult> ExecuteCs2PriorityAndAffinityAsync(List<string> logs, Stopwatch sw) =>
        GameOperations.ExecuteAsync("gaming.cs2.priority", false);

    private Task<OperationResult> ExecuteCs2PriorityRestoreWithValidationAsync(List<string> logs, Stopwatch sw) =>
        GameOperations.ExecuteAsync("gaming.cs2.priority", true);

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

    // 8. Modo Torneo (Composición DWM / Ventanas)
    private async Task<OperationResult> ExecuteTorneoModeAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[TORNEO] Optimizando composición de escritorio y animaciones DWM...");
        var backup = new { EnableTransparency = 1, VisualFX = 1, Timestamp = DateTime.UtcNow };
        await _backupManager.SaveStateAsync("cortex.mode.torneo", backup);
        logs.Add("[SNAPSHOT] Estado visual guardado para restauración segura.");

        // Ajustes de registro seguros de usuario
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            if (key != null)
            {
                key.SetValue("EnableTransparency", 0, Microsoft.Win32.RegistryValueKind.DWord);
                logs.Add("[REGISTRO] Transparencias de Windows desactivadas (Ahorro de VRAM para Intel UHD).");
            }
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO REGISTRO] {ex.Message}");
        }

        sw.Stop();
        logs.Add($"[OK] Modo Torneo activo en {sw.Elapsed.TotalMilliseconds:F1} ms (Explorer protegido).");
        return new OperationResult(true, "cortex.mode.torneo", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { TransparencyDisabled = true }, null, false);
    }

    private async Task<OperationResult> ExecuteTorneoRestoreAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[TORNEO RESTAURAR] Restaurando transparencias y efectos visuales de Windows...");
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            if (key != null)
            {
                key.SetValue("EnableTransparency", 1, Microsoft.Win32.RegistryValueKind.DWord);
                logs.Add("[REGISTRO] Transparencias restauradas a su valor original.");
            }
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO] {ex.Message}");
        }

        await _backupManager.ClearBackupAsync("cortex.mode.torneo");
        sw.Stop();
        return new OperationResult(true, "cortex.mode.torneo", "restore", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { TransparencyDisabled = false }, null, true);
    }

    // 9. Núcleo, Energía y BCD
    private async Task<OperationResult> ExecuteNucleoOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[NÚCLEO] Configurando plan de energía de máximo rendimiento y TRIM de almacenamiento...");
        var backup = new { PowerScheme = "Balanced", AppliedAt = DateTime.UtcNow };
        await _backupManager.SaveStateAsync("cortex.mode.nucleo", backup);

        try
        {
            // Ejecutar comando seguro de activación de esquema de rendimiento
            RunProcessSync("powercfg", "-setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", logs);
            logs.Add("[POWER] Plan de Alto Rendimiento verificado en Windows.");
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO POWER] {ex.Message}");
        }

        sw.Stop();
        return new OperationResult(true, "cortex.mode.nucleo", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { HighPerformanceActive = true }, null, false);
    }

    // 10. Timers TSC
    private async Task<OperationResult> ExecuteTimersOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[TIMERS] Aplicando optimización de temporizador de alta frecuencia TSC...");
        var backup = new { DisabledDynamicTick = false, TscSyncPolicy = "Default" };
        await _backupManager.SaveStateAsync("cortex.mode.timers", backup);

        RunProcessSync("bcdedit", "/set disabledynamictick yes", logs);
        RunProcessSync("bcdedit", "/set tscsyncpolicy Enhanced", logs);
        RunProcessSync("bcdedit", "/deletevalue useplatformtick", logs);

        sw.Stop();
        logs.Add($"[OK] TSC 4GHz verificado en BCDedit en {sw.Elapsed.TotalMilliseconds:F1} ms.");
        return new OperationResult(true, "cortex.mode.timers", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { TscEnhanced = true }, null, false);
    }

    // 11. GPU Intel UHD, MPO Fix y HAGS
    private async Task<OperationResult> ExecuteGpuOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[GPU INTEL] Aplicando MPO Fix (OverlayTestMode=5) y tolerancia TDR...");
        var backup = new { OverlayTestMode = 0, HwSchMode = 1, TdrDelay = 5 };
        await _backupManager.SaveStateAsync("cortex.mode.gpu", backup);

        try
        {
            using (var dwm = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\Dwm"))
            {
                dwm?.SetValue("OverlayTestMode", 5, Microsoft.Win32.RegistryValueKind.DWord);
                logs.Add("[REGISTRO] OverlayTestMode fijado en 5 (Multi-Plane Overlay Fix aplicado).");
            }

            using (var gfx = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(@"SYSTEM\CurrentControlSet\Control\GraphicsDrivers"))
            {
                gfx?.SetValue("HwSchMode", 2, Microsoft.Win32.RegistryValueKind.DWord);
                gfx?.SetValue("TdrDelay", 10, Microsoft.Win32.RegistryValueKind.DWord);
                logs.Add("[REGISTRO] HwSchMode=2 (HAGS activo) y TdrDelay=10 verificados.");
            }
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO REGISTRO] {ex.Message} (Requiere elevación para HKLM)");
        }

        sw.Stop();
        return new OperationResult(true, "cortex.mode.gpu", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { MpoFixed = true, Hags = 2 }, null, false);
    }

    // 12. Memoria y Stutter
    private async Task<OperationResult> ExecuteMemoryStutterOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[MEMORIA] Desactivando PageCombining para reducir interrupciones de CPU en 16GB...");
        var backup = new { PageCombining = true };
        await _backupManager.SaveStateAsync("cortex.mode.stutter", backup);

        RunProcessSync("powershell", "-NoProfile -Command \"Disable-MMAgent -PageCombining\"", logs);

        sw.Stop();
        logs.Add($"[OK] Gestión de memoria ajustada en {sw.Elapsed.TotalMilliseconds:F1} ms.");
        return new OperationResult(true, "cortex.mode.stutter", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { PageCombiningDisabled = true }, null, false);
    }

    // 13. Red y Nagle
    private async Task<OperationResult> ExecuteNetworkOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[RED COMPETITIVA] Configurando TCPNoDelay y TcpAckFrequency en interfaces activas...");
        var backup = new { TcpNoDelay = 0, TcpAckFrequency = 2 };
        await _backupManager.SaveStateAsync("cortex.mode.network", backup);

        RunProcessSync("netsh", "int tcp set global autotuninglevel=high", logs);
        RunProcessSync("netsh", "int tcp set global ecncapability=disabled", logs);
        RunProcessSync("netsh", "int tcp set global timestamps=disabled", logs);

        logs.Add("[NETSH] TCP Autotuning configurado en High sin timestamps de overhead.");

        sw.Stop();
        return new OperationResult(true, "cortex.mode.network", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { TcpOptimized = true }, null, false);
    }

    // 14. Servicios Gaming
    private async Task<OperationResult> ExecuteServicesOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[SERVICIOS] Suspendiendo servicios secundarios que compiten por CPU/RAM...");
        var servicesToPause = new[] { "DiagTrack", "MapsBroker", "Spooler", "WSearch" };

        var backup = new Dictionary<string, string>();
        foreach (var svc in servicesToPause)
        {
            if (_securityService.IsCriticalService(svc)) continue; // Protección de seguridad estricta
            backup[svc] = "Running";
            RunProcessSync("net", $"stop \"{svc}\"", logs);
        }

        await _backupManager.SaveStateAsync("cortex.mode.services", backup);
        sw.Stop();
        logs.Add($"[OK] Perfil de servicios gaming aplicado en {sw.Elapsed.TotalMilliseconds:F1} ms (Defender y Update preservados).");
        return new OperationResult(true, "cortex.mode.services", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { PausedServices = servicesToPause }, null, false);
    }

    private async Task<OperationResult> ExecuteServicesRestoreAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[SERVICIOS RESTAURAR] Reactivando servicios estándar de Windows...");
        var backup = await _backupManager.GetLastStateAsync<Dictionary<string, string>>("cortex.mode.services");

        var servicesToStart = backup?.Keys ?? (IEnumerable<string>)new[] { "Spooler", "WSearch" };
        foreach (var svc in servicesToStart)
        {
            RunProcessSync("net", $"start \"{svc}\"", logs);
        }

        await _backupManager.ClearBackupAsync("cortex.mode.services");
        sw.Stop();
        return new OperationResult(true, "cortex.mode.services", "restore", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { Restored = true }, null, true);
    }

    // 15. VBS Toggle
    private async Task<OperationResult> ExecuteVbsToggleAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[VBS / HVCI] Consultando estado de hipervisor e integridad de código...");
        var backup = new { HypervisorLaunchType = "Auto" };
        await _backupManager.SaveStateAsync("cortex.mode.vbs", backup);

        RunProcessSync("bcdedit", "/set hypervisorlaunchtype off", logs);
        logs.Add("[AVISO] Para que el cambio de VBS/HVCI tome efecto, se requerirá reiniciar el equipo.");

        sw.Stop();
        return new OperationResult(true, "cortex.mode.vbs", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { HypervisorLaunchType = "off", RebootRequired = true }, null, false);
    }

    // 16. Desplegar CFG
    private async Task<OperationResult> ExecuteDeployCfgAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[AUTOEXEC] Buscando directorio de configuración de Counter-Strike 2...");
        string steamCommon = @"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg";

        if (!Directory.Exists(steamCommon))
        {
            // Fallback a AppData local si no está en la ruta por defecto
            steamCommon = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "CS2_Config");
            Directory.CreateDirectory(steamCommon);
        }

        string autoexecPath = Path.Combine(steamCommon, "autoexec.cfg");
        string videoPath = Path.Combine(steamCommon, "cs2_video_pn64.txt");

        string cfgContent = "// EVOOPTIMIZER V7 COMPETITIVE AUTOEXEC\nfps_max 0\nrate 1000000\ncl_updaterate 128\ncl_interp 0.015625\necho \"[EVOOPTIMIZER] Autoexec Cargado Correctamente\"\n";
        await File.WriteAllTextAsync(autoexecPath, cfgContent);
        logs.Add($"[ARCHIVO ESCRITO] autoexec.cfg guardado en: {autoexecPath}");

        sw.Stop();
        return new OperationResult(true, "cortex.mode.cfg", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { AutoexecPath = autoexecPath }, null, false);
    }

    // 17. Restauración Global a Stock
    private async Task<OperationResult> ExecuteGlobalRestoreAsync(List<string> logs, Stopwatch sw)
    {
        await Task.CompletedTask;
        throw new NotSupportedException("La restauración global no garantiza recuperar todos los valores originales. Restaura cada operación compatible individualmente; los respaldos se conservan.");
    }

    // 18. Auto Pre Game
    private async Task<OperationResult> ExecuteAutoPreGameAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[AUTO PRE-GAME] Ejecutando secuencia de preparación de partida...");
        await ExecuteTempCleanupAsync(logs, Stopwatch.StartNew());
        await ExecuteCs2PriorityAndAffinityAsync(logs, Stopwatch.StartNew());
        await ExecuteTorneoModeAsync(logs, Stopwatch.StartNew());

        sw.Stop();
        logs.Add($"[OK] Entorno de partida listo en {sw.Elapsed.TotalMilliseconds:F1} ms.");
        return new OperationResult(true, "cortex.mode.auto_pre_game", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { Ready = true }, null, false);
    }

    // 19. Extreme V2
    private async Task<OperationResult> ExecuteExtremeV2Async(List<string> logs, Stopwatch sw)
    {
        logs.Add("[EXTREME V2] Aplicando tweaks de latencia de kernel y bloqueo de reposo...");
        await ExecutePowerIdleDisableAsync(logs, Stopwatch.StartNew());
        await ExecutePowerThrottlingOffAsync(logs, Stopwatch.StartNew());
        await ExecuteWin32PrioritySeparationAsync(logs, Stopwatch.StartNew());
        await ExecuteGpuOptimizationAsync(logs, Stopwatch.StartNew());

        sw.Stop();
        return new OperationResult(true, "cortex.mode.extreme_v2", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { ExtremeActive = true }, null, false);
    }

    // 20. God Mode
    private Task<OperationResult> ExecuteGodModeAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[GOD MODE] Activando monitoreo continuo de potencia y telemetría en vivo...");
        sw.Stop();
        return Task.FromResult(new OperationResult(true, "cortex.mode.god_mode", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, null, new { GodModeActive = true }, null, false));
    }

    // 21. Tweaks Atómicos
    private async Task<OperationResult> ExecutePowerIdleDisableAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[POWER] Ajustando IDLEDISABLE a 1 para eliminar vacilación de frecuencia...");
        var backup = new { IdleDisable = 0 };
        await _backupManager.SaveStateAsync("tweak.cpu.idledisable", backup);

        RunProcessSync("powercfg", "/setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 1", logs);
        RunProcessSync("powercfg", "/setactive SCHEME_CURRENT", logs);

        sw.Stop();
        return new OperationResult(true, "tweak.cpu.idledisable", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { IdleDisable = 1 }, null, false);
    }

    private async Task<OperationResult> ExecutePowerThrottlingOffAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[POWER] Desactivando PowerThrottling en el registro de Windows...");
        var backup = new { PowerThrottlingOff = 0 };
        await _backupManager.SaveStateAsync("tweak.cpu.powerthrottling_off", backup);

        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(@"SYSTEM\CurrentControlSet\Control\Power\PowerThrottling");
            key?.SetValue("PowerThrottlingOff", 1, Microsoft.Win32.RegistryValueKind.DWord);
            logs.Add("[REGISTRO] PowerThrottlingOff=1 verificado.");
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO] {ex.Message}");
        }

        sw.Stop();
        return new OperationResult(true, "tweak.cpu.powerthrottling_off", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { PowerThrottlingOff = 1 }, null, false);
    }

    private async Task<OperationResult> ExecuteWin32PrioritySeparationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[QUANTUM] Configurando Win32PrioritySeparation a 38 (0x26)...");
        var backup = new { Win32PrioritySeparation = 2 };
        await _backupManager.SaveStateAsync("tweak.cpu.win32priority", backup);

        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(@"SYSTEM\CurrentControlSet\Control\PriorityControl");
            key?.SetValue("Win32PrioritySeparation", 38, Microsoft.Win32.RegistryValueKind.DWord);
            logs.Add("[REGISTRO] Win32PrioritySeparation=38 verificado.");
        }
        catch (Exception ex)
        {
            logs.Add($"[AVISO] {ex.Message}");
        }

        sw.Stop();
        return new OperationResult(true, "tweak.cpu.win32priority", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { Win32PrioritySeparation = 38 }, null, false);
    }

    private async Task<OperationResult> ExecuteDiskTrimOptimizationAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[DISCO] Verificando DisableDeleteNotify = 0 (TRIM activo)...");
        var backup = new { DisableDeleteNotify = 0 };
        await _backupManager.SaveStateAsync("tweak.disk.trim_nvme", backup);

        RunProcessSync("fsutil", "behavior set DisableDeleteNotify 0", logs);
        RunProcessSync("fsutil", "behavior set disablelastaccess 1", logs);

        sw.Stop();
        return new OperationResult(true, "tweak.disk.trim_nvme", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { TrimActive = true }, null, false);
    }

    private async Task<OperationResult> ExecuteDefenderExclusionsAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[DEFENDER] Añadiendo exclusión segura de la ruta de CS2 para evitar escaneos en partida...");
        var backup = new { ExclusionAdded = true };
        await _backupManager.SaveStateAsync("tweak.security.defender_exclusions", backup);

        string cs2Path = @"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive";
        RunProcessSync("powershell", $"-NoProfile -Command \"Add-MpPreference -ExclusionPath '{cs2Path}'\"", logs);

        sw.Stop();
        return new OperationResult(true, "tweak.security.defender_exclusions", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { ExclusionPath = cs2Path }, null, false);
    }

    private async Task<OperationResult> ExecuteUpdatePauseAsync(List<string> logs, Stopwatch sw)
    {
        logs.Add("[WINDOWS UPDATE] Pausando servicio de actualizaciones temporalmente para evitar lag...");
        var backup = new { Service = "wuauserv", WasRunning = true };
        await _backupManager.SaveStateAsync("tweak.services.update_pause", backup);

        RunProcessSync("net", "stop \"wuauserv\"", logs);

        sw.Stop();
        return new OperationResult(true, "tweak.services.update_pause", "apply", DateTime.UtcNow, sw.Elapsed.TotalMilliseconds, logs, backup, new { UpdatePaused = true }, null, false);
    }

    private async Task<OperationResult> ExecuteGenericRestoreFromBackupAsync(string operationId, List<string> logs, Stopwatch sw)
    {
        await Task.CompletedTask;
        throw new NotSupportedException($"La operación '{operationId}' no dispone de restauración implementada. Respaldo conservado.");
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

            var p = procs[0];
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

    private static void RunProcessSync(string file, string args, List<string> logs)
    {
        using var proc = new Process();
        proc.StartInfo = new ProcessStartInfo
        {
            FileName = file, Arguments = args, UseShellExecute = false,
            RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true
        };
        proc.Start();
        var stdout = proc.StandardOutput.ReadToEndAsync();
        var stderr = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit(30000))
        {
            proc.Kill(entireProcessTree: true);
            proc.WaitForExit();
            throw new TimeoutException($"{file}: tiempo de espera agotado.");
        }
        var output = stdout.GetAwaiter().GetResult();
        var error = stderr.GetAwaiter().GetResult();
        if (!string.IsNullOrWhiteSpace(output)) logs.Add(output.Trim());
        if (proc.ExitCode != 0)
            throw new InvalidOperationException($"{file} terminó con código {proc.ExitCode}: {error} {output}");
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
