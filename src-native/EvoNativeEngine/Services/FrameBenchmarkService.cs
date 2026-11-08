using Microsoft.VisualBasic.FileIO;
using System.Globalization;

namespace EvoNativeEngine.Services;

public sealed record BenchmarkInput(string Csv, string ProcessName, string Scenario, string Configuration,
    int Width, int Height, int FpsCap, int TargetFps, double WarmupSeconds = 5);
public sealed record FrameMetrics(int Frames, int RejectedRows, double Seconds, double AverageFps,
    double OnePercentLowFps, double PointOnePercentLowFps, double P50Ms, double P95Ms, double P99Ms,
    double P999Ms, double BudgetMissPercent, double StutterPercent, double CoefficientOfVariation);
public sealed record BenchmarkRun(Guid Id, DateTime CreatedUtc, string ProcessName, string Scenario,
    string Configuration, int Width, int Height, int FpsCap, int TargetFps, FrameMetrics Metrics,
    string SourceColumn, List<string> Warnings, string SourceSha256);
public sealed record RankedConfiguration(string Configuration, int Width, int Height, int FpsCap, int Runs,
    double MedianLowFps, double MedianP99Ms, double MedianBudgetMissPercent, bool MeetsTarget, bool Provisional);
public sealed record BenchmarkComparison(List<RankedConfiguration> Rankings, string Decision, string Definition);

/// <summary>Deterministic metrics over measured PresentMon intervals, not a performance predictor.</summary>
public static class FrameBenchmarkService
{
    public const string Definition = "1% low = 1000 / media del 1% de intervalos más lentos (ceil(N*0.01)). " +
        "P99 y P99.9: rango más próximo (ceil(p*N)). FPS = 1000/media(ms). No es latencia de entrada.";
    public static BenchmarkRun Analyze(BenchmarkInput input)
    {
        if (input.Csv is null || input.Csv.Length > 24_000_000) throw new ArgumentException("CSV ausente o mayor de 24 MB.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(input.ProcessName ?? "", @"^[a-zA-Z0-9_. -]{1,100}\.exe$"))
            throw new ArgumentException("Indica el nombre de un ejecutable, por ejemplo cs2.exe.");
        if (string.IsNullOrWhiteSpace(input.Scenario) || input.Scenario.Length > 120 ||
            string.IsNullOrWhiteSpace(input.Configuration) || input.Configuration.Length > 120)
            throw new ArgumentException("Escenario y configuración deben tener entre 1 y 120 caracteres.");
        if (input.Width < 640 || input.Width > 16384 || input.Height < 480 || input.Height > 16384 ||
            input.TargetFps < 20 || input.TargetFps > 1000 || input.FpsCap < 0 || input.FpsCap > 2000 ||
            !double.IsFinite(input.WarmupSeconds) || input.WarmupSeconds < 0 || input.WarmupSeconds > 120)
            throw new ArgumentException("Resolución, FPS objetivo, límite o calentamiento fuera de rango.");
        using var csv = new TextFieldParser(new StringReader(input.Csv));
        csv.SetDelimiters(",");
        csv.HasFieldsEnclosedInQuotes = true;
        csv.TrimWhiteSpace = true;
        var headers = csv.ReadFields() ?? throw new ArgumentException("CSV vacío.");
        headers = headers.Select(h => h.Trim().Trim('\uFEFF')).ToArray();
        int Column(string name) => Array.FindIndex(headers, h => h.Equals(name, StringComparison.OrdinalIgnoreCase));
        // CPUFrameTime is supported as a separate source, never mixed with display intervals.
        var source = Column("MsBetweenPresents") >= 0 ? "MsBetweenPresents" : "CPUFrameTime";
        var frameIndex = Column(source);
        var appIndex = Column("Application");
        var pidIndex = Column("ProcessID");
        var chainIndex = Column("SwapChainAddress");
        if (frameIndex < 0 || appIndex < 0 || pidIndex < 0)
            throw new ArgumentException("Se requieren Application, ProcessID y MsBetweenPresents o CPUFrameTime. No se aceptan tiempos GPU como frametime.");
        var samples = new List<double>();
        var streams = new HashSet<string>();
        int rejected = 0;
        double elapsed = 0;
        int rows = 0;
        while (!csv.EndOfData)
        {
            if (++rows > 1_000_000) throw new ArgumentException("Máximo un millón de filas por captura.");
            var fields = csv.ReadFields()!;
            if (fields.Length != headers.Length) throw new ArgumentException("CSV con filas incompletas.");
            if (!fields[appIndex].Equals(input.ProcessName, StringComparison.OrdinalIgnoreCase)) continue;
            streams.Add(fields[pidIndex] + ":" + (chainIndex >= 0 ? fields[chainIndex] : "default"));
            if (streams.Count > 1) throw new ArgumentException("La captura mezcla PID o swapchains. Exporta un solo flujo para evitar mezclar menús/ventanas/instancias.");
            if (!double.TryParse(fields[frameIndex], NumberStyles.Float, CultureInfo.InvariantCulture, out var ms) || !double.IsFinite(ms) || ms <= 0)
            { rejected++; continue; }
            elapsed += ms / 1000;
            if (elapsed <= input.WarmupSeconds) continue;
            samples.Add(ms); // Never discard real long frames as outliers.
        }
        var metrics = Calculate(samples, input.TargetFps, rejected);
        var warnings = new List<string>();
        if (metrics.Frames < 1000) warnings.Add("Menos de 1000 frames: cola del 1% poco representativa.");
        if (metrics.Seconds < 30) warnings.Add("Menos de 30 segundos útiles: captura demasiado corta para decidir.");
        if (metrics.Frames < 10000) warnings.Add("0.1% low tiene pocas muestras; interpretar con cautela.");
        if (source == "CPUFrameTime") warnings.Add("Fuente CPUFrameTime; no comparar con MsBetweenPresents como si fueran la misma señal.");
        warnings.Add("Resolución, límite y escenario declarados por el usuario; el CSV no acredita que el juego los aplicó.");
        return new(Guid.NewGuid(), DateTime.UtcNow, input.ProcessName, input.Scenario, input.Configuration,
            input.Width, input.Height, input.FpsCap, input.TargetFps, metrics, source, warnings,
            Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(input.Csv))));
    }

    public static FrameMetrics Calculate(IReadOnlyList<double> frames, int targetFps, int rejected = 0)
    {
        if (frames.Count == 0 || targetFps < 20 || frames.Any(v => !double.IsFinite(v) || v <= 0))
            throw new ArgumentException("No hay intervalos válidos o el objetivo FPS no es válido.");
        var sorted = frames.Order().ToArray();
        double Percentile(double p) => sorted[Math.Clamp((int)Math.Ceiling(p * sorted.Length) - 1, 0, sorted.Length - 1)];
        double Low(double tail) => 1000 / sorted.TakeLast(Math.Max(1, (int)Math.Ceiling(sorted.Length * tail))).Average();
        var mean = sorted.Average();
        var budget = 1000.0 / targetFps;
        var median = Percentile(.5);
        return new(sorted.Length, rejected, sorted.Sum() / 1000, 1000 / mean, Low(.01), Low(.001),
            median, Percentile(.95), Percentile(.99), Percentile(.999),
            100.0 * sorted.Count(v => v > budget * 1.05) / sorted.Length,
            100.0 * sorted.Count(v => v > Math.Max(2 * median, budget * 1.5)) / sorted.Length,
            Math.Sqrt(sorted.Average(v => (v - mean) * (v - mean))) / mean);
    }

    public static BenchmarkComparison Compare(IReadOnlyList<BenchmarkRun> runs)
    {
        if (runs.Count < 2 || runs.Count > 100) throw new ArgumentException("Compara de 2 a 100 capturas.");
        if (runs.Select(r => r.SourceSha256).Distinct().Count() != runs.Count)
            throw new ArgumentException("El mismo CSV no cuenta como varias repeticiones independientes.");
        var first = runs[0];
        if (runs.Any(r => r.ProcessName != first.ProcessName || r.Scenario != first.Scenario ||
            r.TargetFps != first.TargetFps || r.SourceColumn != first.SourceColumn))
            throw new ArgumentException("No mezcles juego, escenario, objetivo o fuente de intervalos diferentes.");
        static double Median(IEnumerable<double> values)
        {
            var v = values.Order().ToArray();
            return (v[(v.Length - 1) / 2] + v[v.Length / 2]) / 2;
        }
        var rankings = runs.GroupBy(r => (r.Configuration, r.Width, r.Height, r.FpsCap)).Select(group =>
        {
            var low = Median(group.Select(r => r.Metrics.OnePercentLowFps));
            var p99 = Median(group.Select(r => r.Metrics.P99Ms));
            var missed = Median(group.Select(r => r.Metrics.BudgetMissPercent));
            return new RankedConfiguration(group.Key.Configuration, group.Key.Width, group.Key.Height, group.Key.FpsCap,
                group.Count(), low, p99, missed, p99 <= 1000.0 / first.TargetFps * 1.05 && low >= first.TargetFps * .95 && missed <= 1,
                group.Count() < 3 || group.Any(r => r.Metrics.Frames < 1000 || r.Metrics.Seconds < 30));
        }).OrderBy(r => r.Provisional).ThenByDescending(r => r.MeetsTarget)
          .ThenByDescending(r => r.MeetsTarget ? (long)r.Width * r.Height : 0)
          .ThenBy(r => r.MedianP99Ms).ThenByDescending(r => r.MedianLowFps).ToList();
        return new(rankings, rankings.Count < 2 ? "Falta una segunda configuración."
            : rankings.Any(r => r.Provisional) ? "Comparación provisional: realiza al menos tres capturas de 30s/1000 frames por configuración."
            : "Ordenado por cumplimiento del presupuesto y resolución entre candidatos estables; si ninguno cumple, por P99. Repite con la misma escena y condiciones térmicas. No es un óptimo universal.", Definition);
    }
}
