using EvoNativeEngine.Models;

namespace EvoNativeEngine.Services;

public sealed record EffectEstimate(double ChangePercent, double CiLowPercent, double CiHighPercent);
public sealed record ResourceComparison(double? CpuMeanBefore, double? CpuMeanAfter, double? RamPeakBefore,
    double? RamPeakAfter, double? AcpiMaxBefore, double? AcpiMaxAfter, int SamplesBefore, int SamplesAfter);
public sealed record ExperimentVerdict(string Verdict, EffectEstimate LowFps, EffectEstimate P99Ms,
    EffectEstimate AverageFps, List<string> Limitations, ResourceComparison Resources);
public static class BeforeAfterAnalyzer
{
    public static ExperimentVerdict Analyze(IReadOnlyList<BenchmarkRun> before, IReadOnlyList<BenchmarkRun> after, bool provenanceVerified)
    {
        if (before.Count < 1 || after.Count < 1 || before.Count > 30 || after.Count > 30)
            throw new ArgumentException("Se requieren entre 1 y 30 capturas por fase.");
        var all = before.Concat(after).ToArray();
        var first = all[0];
        if (all.Any(r => r.ProcessName != first.ProcessName || r.Scenario != first.Scenario || r.Width != first.Width ||
            r.Height != first.Height || r.FpsCap != first.FpsCap || r.TargetFps != first.TargetFps || r.SourceColumn != first.SourceColumn))
            throw new ArgumentException("Para aislar un tweak no cambies proceso, escena, resolución, cap, objetivo o señal entre A y B.");
        if (all.Select(r => r.SourceSha256).Distinct().Count() != all.Length)
            throw new ArgumentException("Las repeticiones deben proceder de CSV distintos.");
        var low = Estimate(before.Select(r => r.Metrics.OnePercentLowFps).ToArray(), after.Select(r => r.Metrics.OnePercentLowFps).ToArray());
        var p99 = Estimate(before.Select(r => r.Metrics.P99Ms).ToArray(), after.Select(r => r.Metrics.P99Ms).ToArray());
        var average = Estimate(before.Select(r => r.Metrics.AverageFps).ToArray(), after.Select(r => r.Metrics.AverageFps).ToArray());
        var limitations = new List<string> {
            "IC bootstrap percentil 95%, 5000 remuestreos de capturas completas, no de frames autocorrelacionados. Métrica primaria: 1% low; margen práctico 3%.",
            "Una secuencia antes/después no prueba causalidad. Alterna A/B/A/B y confirma resultados; temperatura, escena y software externo pueden confundirlos.",
            "No aplica corrección por probar muchos tweaks. Evita elegir solo el mejor resultado de múltiples comparaciones." };
        var sufficient = before.Count >= 5 && after.Count >= 5 && all.All(r => r.Metrics.Frames >= 1000 && r.Metrics.Seconds >= 30);
        if (!sufficient) limitations.Add("Mínimo para emitir señal: cinco capturas por fase, cada una con 30s útiles y 1000 frames.");
        if (!provenanceVerified) limitations.Add("Proveniencia o aislamiento no verificables: CSV importado, captura fuera de fase o cambios adicionales del motor.");
        var verdict = "Inconcluso";
        if (sufficient && provenanceVerified)
        {
            if (low.CiHighPercent < -3 || p99.CiLowPercent > 3 || average.CiHighPercent < -3) verdict = "Señal de regresión";
            else if (low.CiLowPercent > 3 && p99.CiHighPercent <= 3 && average.CiLowPercent >= -3) verdict = "Señal de mejora";
            else if (low.CiLowPercent >= -3 && low.CiHighPercent <= 3 && p99.CiLowPercent >= -3 && p99.CiHighPercent <= 3)
                verdict = "Sin cambio relevante observado";
        }
        static RealtimeTelemetryData[] Samples(IEnumerable<BenchmarkRun> list) => list.SelectMany(r => r.SystemSamples ?? []).ToArray();
        static double? Mean(IEnumerable<double?> values) { var known = values.Where(v => v.HasValue).Select(v => v!.Value).ToArray(); return known.Length > 0 ? known.Average() : null; }
        static double? Peak(IEnumerable<double?> values) { var known = values.Where(v => v.HasValue).Select(v => v!.Value).ToArray(); return known.Length > 0 ? known.Max() : null; }
        var aSamples = Samples(before);
        var bSamples = Samples(after);
        var resources = new ResourceComparison(Mean(aSamples.Select(s => s.CpuUsagePct)), Mean(bSamples.Select(s => s.CpuUsagePct)),
            Peak(aSamples.Select(s => s.RamUsedPct)), Peak(bSamples.Select(s => s.RamUsedPct)),
            Peak(aSamples.Select(s => s.TemperatureCelsius)), Peak(bSamples.Select(s => s.TemperatureCelsius)), aSamples.Length, bSamples.Length);
        return new(verdict, low, p99, average, limitations, resources);
    }
    private static EffectEstimate Estimate(double[] baseline, double[] treatment)
    {
        static double Median(double[] values) { Array.Sort(values); return (values[(values.Length - 1) / 2] + values[values.Length / 2]) / 2; }
        if (baseline.Concat(treatment).Any(v => !double.IsFinite(v) || v <= 0)) throw new ArgumentException("Métricas no válidas.");
        var point = 100 * (Median(treatment.ToArray()) / Median(baseline.ToArray()) - 1);
        var random = new Random(20261108);
        var estimates = new double[5000];
        for (int i = 0; i < estimates.Length; i++)
        {
            var a = Enumerable.Range(0, baseline.Length).Select(_ => baseline[random.Next(baseline.Length)]).ToArray();
            var b = Enumerable.Range(0, treatment.Length).Select(_ => treatment[random.Next(treatment.Length)]).ToArray();
            estimates[i] = 100 * (Median(b) / Median(a) - 1);
        }
        Array.Sort(estimates);
        return new(point, estimates[124], estimates[4874]);
    }
}
public sealed record ExperimentStart(string OperationId, Guid[] BeforeIds);
public sealed record ExperimentEvaluation(Guid Id, Guid[] AfterIds);
public sealed record OptimizationExperiment(Guid Id, string OperationId, Guid[] BeforeIds, DateTime AppliedUtc,
    long BeforeRevision, long AppliedRevision, OperationResult Applied, RealtimeTelemetryData BeforeTelemetry,
    RealtimeTelemetryData AfterTelemetry, SystemHardwareReport Hardware);

public sealed class OptimizationExperimentService(BenchmarkSessionService sessions, IOptimizationService operations,
    OperationJournal journal, IDiagnosticsService diagnostics)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private OptimizationExperiment? active;
    public OptimizationExperiment? Active => active;
    // Reboot-dependent tweaks cannot be assessed by this in-session workflow.
    private static readonly HashSet<string> Eligible = new() { "cortex.mode.torneo", "cortex.mode.nucleo", "tweak.cpu.idledisable",
        "tweak.memory.pagecombining_off", "gaming.cs2.priority", "tweak.cpu.affinity_15", "tweak.services.gaming_toggle" };
    public async Task<OptimizationExperiment> StartAsync(ExperimentStart request)
    {
        await gate.WaitAsync();
        try
        {
            if (active is not null) throw new InvalidOperationException("Restaura el experimento activo antes de abrir otro.");
            if (!Eligible.Contains(request.OperationId)) throw new ArgumentException("Prueba un único módulo reversible que no requiera reiniciar.");
            var before = request.BeforeIds.Select(sessions.Get).ToArray();
            if (before.Length < 3) throw new ArgumentException("Registra al menos tres capturas base antes de aplicar el cambio (cinco recomendadas).");
            BeforeAfterAnalyzer.Analyze(before, [before[0] with { SourceSha256 = "validation-only" }], false);
            if ((await operations.GetOperationStatusAsync(request.OperationId)).HasBackup)
                throw new InvalidOperationException("Ya existe un respaldo de este módulo; restaura primero para tener una base identificable.");
            var revision = journal.Revision;
            var hardware = await diagnostics.GetSystemHardwareReportAsync(true);
            var prior = await operations.GetRealtimeTelemetryAsync();
            var applied = await operations.ApplyOperationAsync(request.OperationId);
            // Retain failed/partial operations so the user can recover instead of losing the workflow.
            active = new(Guid.NewGuid(), request.OperationId, request.BeforeIds, DateTime.UtcNow, revision,
                journal.Revision, applied, prior, await operations.GetRealtimeTelemetryAsync(), hardware);
            return active;
        }
        finally { gate.Release(); }
    }
    public ExperimentVerdict Evaluate(ExperimentEvaluation request)
    {
        var experiment = active ?? throw new ArgumentException("No hay experimento activo.");
        if (request.Id != experiment.Id) throw new ArgumentException("Experimento desconocido.");
        var before = experiment.BeforeIds.Select(sessions.Get).ToArray();
        var after = request.AfterIds.Select(sessions.Get).ToArray();
        var verified = experiment.Applied.Success && experiment.AppliedRevision == experiment.BeforeRevision + 1 && journal.Revision == experiment.AppliedRevision &&
            before.All(r => r.Provenance == "NativeCapture" && r.OperationRevision == experiment.BeforeRevision && r.CreatedUtc <= experiment.AppliedUtc) &&
            after.All(r => r.Provenance == "NativeCapture" && r.OperationRevision == experiment.AppliedRevision && r.CaptureStartedUtc >= experiment.AppliedUtc);
        return BeforeAfterAnalyzer.Analyze(before, after, verified);
    }
    public async Task<OperationResult> RestoreAsync(Guid id)
    {
        await gate.WaitAsync();
        try
        {
            if (active is null || active.Id != id) throw new ArgumentException("Experimento desconocido.");
            if (!(await operations.GetOperationStatusAsync(active.OperationId)).HasBackup)
            {
                active = null;
                return new(true, "experiment.close", "restore", DateTime.UtcNow, 0,
                    ["No hay respaldo del módulo: el experimento se cierra sin modificar Windows. No se certifica una restauración externa."], null, null, null, false);
            }
            var result = await operations.RestoreOperationAsync(active.OperationId);
            if (result.Success) active = null;
            return result;
        }
        finally { gate.Release(); }
    }
}
