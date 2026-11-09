using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace EvoDesktop;
public partial class MainWindow : Window
{
    private const string Origin = "http://127.0.0.1:48120";
    private readonly string token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly HttpClient client;
    private Process? engine;
    private bool canClose, stopping;
    public MainWindow()
    {
        InitializeComponent();
        var cookies = new CookieContainer();
        cookies.Add(new Uri(Origin), new Cookie("EvoSession", token, "/") { HttpOnly = true });
        client = new HttpClient(new HttpClientHandler { CookieContainer = cookies, UseProxy = false }) { Timeout = TimeSpan.FromSeconds(2) };
        Loaded += Start;
        Closing += CloseRequested;
        Closed += (_, _) => { Browser.Dispose(); client.Dispose(); engine?.Dispose(); };
    }
    private async void Start(object sender, RoutedEventArgs e)
    {
        try
        {
            var engineDirectory = Path.Combine(AppContext.BaseDirectory, "engine");
            var executable = Path.Combine(engineDirectory, "EvoNativeEngine.exe");
            if (!File.Exists(executable) || !File.Exists(Path.Combine(engineDirectory, "wwwroot", "index.html")))
                throw new FileNotFoundException("Paquete incompleto. Publica con scripts/Publish-EvoDesktop.ps1 y ejecuta EvoDesktop.exe desde la carpeta resultante.");
            // The UI is deliberately not elevated. The engine inherits only current-user privileges.
            var start = new ProcessStartInfo(executable) { WorkingDirectory = engineDirectory, UseShellExecute = false, CreateNoWindow = true };
            start.Environment["EVO_ENGINE_TOKEN"] = token;
            start.Environment["EVO_ENGINE_PORT"] = "48120";
            engine = Process.Start(start) ?? throw new IOException("No se pudo iniciar EvoNativeEngine.");
            var ready = false;
            for (var attempt = 0; attempt < 60 && !stopping; attempt++)
            {
                if (engine.HasExited) throw new IOException("El motor terminó al iniciar. Cierra otras instancias y comprueba el paquete.");
                try { using var response = await client.GetAsync(Origin + "/api/status"); ready = response.IsSuccessStatusCode; }
                catch (HttpRequestException) { }
                catch (TaskCanceledException) { }
                if (ready) break;
                await Task.Delay(250);
            }
            if (stopping) return;
            if (!ready) throw new IOException("El motor no respondió. Puede haber otra instancia usando el puerto 48120.");
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, profile);
            await Browser.EnsureCoreWebView2Async(environment);
            if (stopping) return;
            var web = Browser.CoreWebView2;
            web.Settings.AreDevToolsEnabled = false;
            web.Settings.AreHostObjectsAllowed = false;
            web.Settings.IsWebMessageEnabled = false;
            web.Settings.AreDefaultContextMenusEnabled = false;
            web.PermissionRequested += (_, request) => request.State = CoreWebView2PermissionState.Deny;
            web.DownloadStarting += (_, request) =>
            {
                // React generates local JSON/ZIP exports; only downloads initiated by local content are allowed.
                if (web.Source is not string source || !IsLocal(source)) request.Cancel = true;
            };
            web.NavigationStarting += (_, navigation) => { if (!IsLocal(navigation.Uri) && navigation.Uri != "about:blank") navigation.Cancel = true; };
            web.NewWindowRequested += (_, request) =>
            {
                request.Handled = true;
                if (Uri.TryCreate(request.Uri, UriKind.Absolute, out var url) && url.Scheme == "https" &&
                    url.Host is "github.com" or "learn.microsoft.com" or "devblogs.microsoft.com" or "support.microsoft.com")
                    Process.Start(new ProcessStartInfo(url.AbsoluteUri) { UseShellExecute = true });
            };
            var cookie = web.CookieManager.CreateCookie("EvoSession", token, "127.0.0.1", "/");
            cookie.IsHttpOnly = true;
            cookie.SameSite = CoreWebView2CookieSameSiteKind.Strict;
            web.CookieManager.AddOrUpdateCookie(cookie);
            Browser.Source = new Uri(Origin);
            Browser.Visibility = Visibility.Visible;
            Status.Visibility = Visibility.Collapsed;
        }
        catch (Exception ex)
        {
            await StopEngineAsync();
            if (!stopping) Status.Text = "No se pudo abrir EVO Optimizer.\n" + ex.Message +
                "\nSi falta WebView2 Runtime, instálalo desde el sitio oficial de Microsoft. No se modificó su instalación automáticamente.";
        }
    }
    private static bool IsLocal(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == "http" && uri.Host == "127.0.0.1" && uri.Port == 48120;
    private async void CloseRequested(object? sender, CancelEventArgs e)
    {
        if (canClose) return;
        e.Cancel = true;
        if (stopping) return;
        if (engine is { HasExited: false } && MessageBox.Show(
            "Detén capturas y operaciones antes de salir. Los ajustes aplicados permanecerán en Windows; cerrar no los restaura. ¿Cerrar y detener el motor?",
            "Cerrar EVO Optimizer", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        stopping = true;
        Browser.Visibility = Visibility.Hidden;
        Status.Visibility = Visibility.Visible;
        Status.Text = "Deteniendo el motor…";
        await StopEngineAsync();
        canClose = true;
        Close();
    }
    private async Task StopEngineAsync()
    {
        if (engine is null || engine.HasExited) return;
        try { using var response = await client.PostAsync(Origin + "/api/desktop/shutdown", null); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { }
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try { await engine.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { if (!engine.HasExited) engine.Kill(entireProcessTree: true); }
    }
}
