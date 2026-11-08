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
    IReadOnlySet<string> AllowedActions { get; }
}

public class SecurityService : ISecurityService
{
    private readonly ILogger<SecurityService> _logger;
    private readonly HashSet<string> _whitelistedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Operaciones de Diagnóstico y Estado
        "diagnostics.system_report",
        "diagnostics.refresh",
        "status.ping",

        // Operaciones Reales del Motor (Implementación 01)
        "system.hardware.refresh",
        "system.processes.list",
        "gaming.cs2.detect",
        "gaming.cs2.launch",
        "gaming.cs2.priority",
        "gaming.cs2.priority.restore",
        "system.temp.cleanup"
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
}
