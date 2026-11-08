using System.Diagnostics;
using System.Collections.Concurrent;

namespace EvoNativeEngine.Services;

public sealed record CaptureRequest(string ProcessName, string Scenario, string Configuration,
    int Width, int Height, int FpsCap, int TargetFps, int Seconds = 60);
public sealed class BenchmarkSessionService(OperationJournal journal, IOptimizationService operations)
{
    public BenchmarkRun[] List() => runs.Values.OrderBy(r => r.CreatedUtc).ToArray();
    public static object Readiness(string processName)
    {
        var tool = Environment.GetEnvironmentVariable("EVO_PRESENTMON_PATH");
        var toolReady = !string.IsNullOrWhiteSpace(tool) && Path.IsPathFullyQualified(tool) && File.Exists(tool) && tool.EndsWith(".exe", StringComparison.OrdinalIgnoreCase);
        var count = 0;
        if (OperatingSystem.IsWindows() && System.Text.RegularExpressions.Regex.IsMatch(processName, @"^[a-zA-Z0-9_. -]{1,100}\.exe$"))
        {
            var processes = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(processName));
            count = processes.Length;
            foreach (var process in processes) process.Dispose();
        }
        return new { Windows = OperatingSystem.IsWindows(), ToolReady = toolReady, GameInstances = count,
            MinimumSeconds = 30, MaximumSeconds = 120, WarmupSeconds = 5,
            Message = !OperatingSystem.IsWindows() ? "La captura requiere Windows." : !toolReady ? "Configura EVO_PRESENTMON_PATH con PresentMon CLI 2.x y reinicia el motor." : count != 1 ? "Abre una sola instancia del proceso seleccionado." : "Listo para solicitar captura. ETW verificará permisos al iniciarla." };
    }
    public BenchmarkRun Get(Guid id) => runs.TryGetValue(id, out var run) ? run : throw new ArgumentException("Captura expirada o desconocida.");
    private readonly ConcurrentDictionary<Guid, BenchmarkRun> runs = new();
    private readonly SemaphoreSlim captureGate = new(1, 1);
    public BenchmarkRun Import(BenchmarkInput input)
    {
        var run = FrameBenchmarkService.Analyze(input);
        runs[run.Id] = run;
        foreach (var old in runs.Values.OrderByDescending(r => r.CreatedUtc).Skip(100)) runs.TryRemove(old.Id, out _);
        return run;
    }
    public BenchmarkComparison Compare(Guid[] ids)
    {
        if (ids.Length != ids.Distinct().Count()) throw new ArgumentException("No se permite contar una captura más de una vez.");
        return FrameBenchmarkService.Compare(ids.Select(id => runs.TryGetValue(id, out var run) ? run
            : throw new ArgumentException("Captura desconocida o expirada. Importa de nuevo el CSV.")).ToArray());
    }
    public async Task<BenchmarkRun> CaptureAsync(CaptureRequest request, CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Captura ETW requiere Windows.");
        if (request.Seconds < 30 || request.Seconds > 120) throw new ArgumentException("Duración entre 30 y 120 segundos.");
        // Validate metadata before starting any process, using a minimal well-formed trace.
        FrameBenchmarkService.Analyze(new("Application,ProcessID,MsBetweenPresents\n" + request.ProcessName + ",1,16\n",
            request.ProcessName, request.Scenario, request.Configuration, request.Width, request.Height,
            request.FpsCap, request.TargetFps, 0));
        var tool = Environment.GetEnvironmentVariable("EVO_PRESENTMON_PATH");
        if (string.IsNullOrWhiteSpace(tool) || !Path.IsPathFullyQualified(tool) || !File.Exists(tool) ||
            !tool.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Configura EVO_PRESENTMON_PATH con la ruta absoluta a PresentMon CLI 2.x oficial. No se descarga ni ejecuta un binario desde la web.");
        var game = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(request.ProcessName));
        var gameCount = game.Length;
        var capturedPid = gameCount == 1 ? game[0].Id : 0;
        foreach (var process in game) process.Dispose();
        if (gameCount != 1) throw new InvalidOperationException("Abre exactamente una instancia del juego antes de capturar.");
        if (!await captureGate.WaitAsync(0, cancellationToken)) throw new InvalidOperationException("Ya hay una captura en curso.");
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvoOptimizer", "Telemetry");
        var file = Path.Combine(directory, Guid.NewGuid().ToString("N") + ".csv");
        try
        {
            Directory.CreateDirectory(directory);
            using var process = new Process { StartInfo = new ProcessStartInfo(tool)
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true } };
            foreach (var arg in new[] { "--process_id", capturedPid.ToString(System.Globalization.CultureInfo.InvariantCulture), "--output_file", file,
                "--timed", request.Seconds.ToString(System.Globalization.CultureInfo.InvariantCulture),
                "--terminate_after_timed", "--no_console_stats" }) process.StartInfo.ArgumentList.Add(arg);
            var startRevision = journal.Revision;
            var startedUtc = DateTime.UtcNow;
            process.Start();
            using var sampleCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var sampleTask = SampleAsync(sampleCancellation.Token);
            try
            {
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(request.Seconds + 30));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException)
            {
                if (!process.HasExited) process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync();
                throw new InvalidOperationException("Captura cancelada o agotada; no se genera un resultado ficticio.");
            }
            sampleCancellation.Cancel();
            var systemSamples = await sampleTask;
            var error = await stderr;
            await stdout;
            if (process.ExitCode != 0) throw new IOException($"PresentMon terminó con código {process.ExitCode}: {error}");
            if (!File.Exists(file) || new FileInfo(file).Length > 24_000_000) throw new IOException("No hay CSV válido o supera 24 MB.");
            var measured = Import(new(await File.ReadAllTextAsync(file, cancellationToken), request.ProcessName,
                request.Scenario, request.Configuration, request.Width, request.Height, request.FpsCap,
                request.TargetFps, 5));
            measured = measured with { Provenance = "NativeCapture", CaptureStartedUtc = startedUtc,
                OperationRevision = startRevision == journal.Revision ? startRevision : null, SystemSamples = systemSamples, RequestedSeconds = request.Seconds, CapturedProcessId = capturedPid };
            runs[measured.Id] = measured;
            return measured;
            }
            finally { sampleCancellation.Cancel(); await sampleTask; }
        }
        finally
        {
            // Raw traces are temporary (can contain process metadata); export original imports separately.
            try { File.Delete(file); } finally { captureGate.Release(); }
        }
    }
    private async Task<EvoNativeEngine.Models.RealtimeTelemetryData[]> SampleAsync(CancellationToken token)
    {
        var samples = new List<EvoNativeEngine.Models.RealtimeTelemetryData>();
        try
        {
            while (!token.IsCancellationRequested && samples.Count < 160)
            {
                try { samples.Add(await operations.GetRealtimeTelemetryAsync()); }
                catch { /* No fabricated samples when a sensor provider fails. */ }
                await Task.Delay(1000, token);
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { }
        return samples.ToArray();
    }

}
