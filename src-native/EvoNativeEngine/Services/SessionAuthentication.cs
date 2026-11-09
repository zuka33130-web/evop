using System.Security.Cryptography;
using System.Text;

namespace EvoNativeEngine.Services;

/// <summary>Per-launch desktop token. Never logged, placed in URLs or exposed to JavaScript.</summary>
public sealed class SessionAuthentication
{
    private readonly byte[]? expected;
    public bool Required => expected is not null;
    public SessionAuthentication(string? token)
    {
        if (string.IsNullOrEmpty(token)) return; // Explicit development/standalone compatibility mode.
        if (token.Length < 64 || token.Length > 256) throw new ArgumentException("EVO_ENGINE_TOKEN debe tener entre 64 y 256 caracteres.");
        expected = Encoding.UTF8.GetBytes(token);
    }
    public bool Authorize(string? candidate)
    {
        if (expected is null) return true;
        if (candidate is null || candidate.Length > 256) return false;
        var received = Encoding.UTF8.GetBytes(candidate);
        return CryptographicOperations.FixedTimeEquals(expected, received);
    }
    public static bool IsLocalOrigin(string? origin, int port) =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.Scheme == "http" &&
        uri.Host is "127.0.0.1" or "localhost" && uri.Port == port &&
        uri.AbsolutePath == "/" && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment) && string.IsNullOrEmpty(uri.UserInfo);
}
