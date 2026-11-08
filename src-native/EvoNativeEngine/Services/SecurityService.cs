using System;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Extensions.Logging;

namespace EvoNativeEngine.Services;

public interface ISecurityService
{
    bool IsElevated();
    bool ValidateWhitelistedAction(string actionId);
}

public class SecurityService : ISecurityService
{
    private readonly ILogger<SecurityService> _logger;
    private readonly HashSet<string> _whitelistedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "diagnostics.system_report",
        "diagnostics.refresh",
        "status.ping"
    };

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
