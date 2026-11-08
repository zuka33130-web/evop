using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Extensions.Logging;

namespace EvoNativeEngine.Services;

public interface ISecurityService
{
    bool IsElevated();
    bool ValidateWhitelistedAction(string actionId);
    bool IsCriticalProcess(string processName);
    bool IsCriticalService(string serviceName);
    IReadOnlySet<string> AllowedActions { get; }
}

public class SecurityService : ISecurityService
{
    private readonly ILogger<SecurityService> _logger;

    private static readonly HashSet<string> _criticalProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "csrss", "smss", "wininit", "winlogon", "services", "lsass", 
        "svchost", "fontdrvhost", "dwm", "system", "idle", "runtimebroker",
        "explorer" // Protegido contra cierre forzado no autorizado
    };

    private static readonly HashSet<string> _criticalServices = new(StringComparer.OrdinalIgnoreCase)
    {
        "RpcSs", "DcomLaunch", "EventLog", "PlugPlay", "LanmanWorkstation", 
        "SecurityHealthService", "SamSs", "ProfSvc", "Power", "CoreMessagingRegistrar"
    };

    private readonly HashSet<string> _whitelistedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Operaciones de Diagnóstico y Telemetría
        "diagnostics.system_report",
        "diagnostics.refresh",
        "status.ping",
        "telemetry.realtime",

        // Operaciones Reales del Sistema y Gaming
        "system.hardware.refresh",
        "system.processes.list",
        "gaming.cs2.detect",
        "gaming.cs2.launch",
        "gaming.cs2.priority",
        "gaming.cs2.priority.restore",
        "system.temp.cleanup",

        // 15 Modos Cortex Nativos
        "cortex.mode.bestia",
        "cortex.mode.torneo",
        "cortex.mode.nucleo",
        "cortex.mode.timers",
        "cortex.mode.gpu",
        "cortex.mode.stutter",
        "cortex.mode.network",
        "cortex.mode.debloat",
        "cortex.mode.services",
        "cortex.mode.vbs",
        "cortex.mode.cleanup",
        "cortex.mode.watchdog",
        "cortex.mode.bench",
        "cortex.mode.cfg",
        "cortex.mode.restore",

        // Tweaks Atómicos y Módulos de Registro / Hardware
        "tweak.cpu.affinity_15",
        "tweak.cpu.idledisable",
        "tweak.cpu.powerthrottling_off",
        "tweak.cpu.win32priority",
        "tweak.gpu.mpo_fix",
        "tweak.gpu.hags",
        "tweak.gpu.tdr_delay",
        "tweak.network.nagle_off",
        "tweak.network.autotuning_high",
        "tweak.memory.pagecombining_off",
        "tweak.memory.pagefile_fixed",
        "tweak.disk.trim_nvme",
        "tweak.disk.disablelastaccess",
        "tweak.security.defender_exclusions",
        "tweak.services.update_pause",
        "tweak.services.gaming_toggle",

        // Módulos Orquestadores de Fase 2 y Fase 3
        "cortex.mode.iniciar_todo",
        "cortex.mode.auto_pre_game",
        "cortex.mode.extreme_v2",
        "cortex.mode.extreme_undo",
        "cortex.mode.god_mode"
    };

    public IReadOnlySet<string> AllowedActions => _whitelistedActions;

    public SecurityService(ILogger<SecurityService> logger)
    {
        _logger = logger;
    }

    public bool IsElevated()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return false;
        }

        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo verificar el nivel de elevación del proceso.");
            return false;
        }
    }

    public bool ValidateWhitelistedAction(string actionId)
    {
        if (string.IsNullOrWhiteSpace(actionId)) return false;
        bool allowed = _whitelistedActions.Contains(actionId);
        if (!allowed)
        {
            _logger.LogWarning("ACCESO DENEGADO: Intento de invocar acción no autorizada o arbitraria: '{ActionId}'. REGLA 5: No se admiten comandos arbitrarios.", actionId);
        }
        return allowed;
    }

    public bool IsCriticalProcess(string processName)
    {
        if (string.IsNullOrWhiteSpace(processName)) return true;
        string cleanName = processName.Replace(".exe", "", StringComparison.OrdinalIgnoreCase).Trim();
        return _criticalProcesses.Contains(cleanName);
    }

    public bool IsCriticalService(string serviceName)
    {
        if (string.IsNullOrWhiteSpace(serviceName)) return true;
        return _criticalServices.Contains(serviceName.Trim());
    }
}
