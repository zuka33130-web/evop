/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// MOTOR ESTADÍSTICO CIENTÍFICO EVO & FRAME TIME ANALYZER
// Implementación rigurosa sin sesgo: Mann-Whitney U, Bootstrap 10k y métricas PresentMon
// ============================================================================

export type MetricDirection = 'HigherIsBetter' | 'LowerIsBetter';
export type BenchmarkVerdict = 'Improved' | 'NoChange' | 'Regressed' | 'Inconclusive';
export type InconclusiveReason = 
  | 'None' 
  | 'ContextMismatch' 
  | 'InvalidData' 
  | 'InsufficientRuns' 
  | 'DegenerateBaseline' 
  | 'Ambiguous';

export interface ComparisonResult {
  verdict: BenchmarkVerdict;
  reason: InconclusiveReason;
  summary: string;
  notes: string[];
  runsBefore: number;
  runsAfter: number;
  medianBefore: number | null;
  medianAfter: number | null;
  relativeChange: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  pValue: number | null;
  pValueIsExact: boolean | null;
  probabilityOfImprovement: number | null;
  baselineNoise: number | null;
}

export interface FrameStats {
  validFrames: number;
  pausedFrames: number;
  warmupFramesSkipped: number;
  durationSeconds: number;
  averageFps: number | null;
  medianFrameTimeMs: number | null;
  p95FrameTimeMs: number | null;
  p99FrameTimeMs: number | null;
  minFrameTimeMs: number | null;
  maxFrameTimeMs: number | null;
  onePercentLowFps: number | null;
  pointOnePercentLowFps: number | null;
  robustVariability: number | null;
  meanSuccessiveDifferenceMs: number | null;
  spikeCount: number;
  spikeFraction: number | null;
  notes: string[];
}

export class RobustStatistics {
  public static median(values: number[]): number {
    if (values.length === 0) throw new Error("Se necesita al menos un valor.");
    const sorted = [...values].sort((a, b) => a - b);
    return this.medianOfSorted(sorted);
  }

  public static medianOfSorted(sorted: number[]): number {
    const n = sorted.length;
    if (n === 0) throw new Error("Se necesita al menos un valor.");
    return n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
  }

  public static percentile(values: number[], q: number): number {
    if (values.length === 0) throw new Error("Se necesita al menos un valor.");
    const sorted = [...values].sort((a, b) => a - b);
    return this.percentileOfSorted(sorted, q);
  }

  public static percentileOfSorted(sorted: number[], q: number): number {
    if (sorted.length === 0) throw new Error("Se necesita al menos un valor.");
    const clampedQ = Math.max(0, Math.min(1, q));
    const h = (sorted.length - 1) * clampedQ;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }

  public static medianAbsoluteDeviation(values: number[]): number {
    const med = this.median(values);
    const deviations = values.map(x => Math.abs(x - med)).sort((a, b) => a - b);
    return this.medianOfSorted(deviations);
  }
}

export class SplitMix64 {
  private state: bigint;

  constructor(seed: number | bigint = 0x45564Fn) {
    this.state = BigInt(seed);
  }

  public next(): bigint {
    this.state = (this.state + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & 0xFFFFFFFFFFFFFFFFn;
    return (z ^ (z >> 31n)) & 0xFFFFFFFFFFFFFFFFn;
  }

  public nextIndex(exclusiveMax: number): number {
    const n = BigInt(exclusiveMax);
    return Number(this.next() % n);
  }
}

export class MannWhitneyTest {
  public static readonly EXACT_MAX_TOTAL = 50;

  public static twoSided(first: number[], second: number[]): { u: number; pValue: number; isExact: boolean } {
    if (first.length === 0 || second.length === 0) {
      throw new Error("Ambos grupos necesitan al menos una observación.");
    }

    let u = 0;
    for (const x of first) {
      for (const y of second) {
        if (x > y) u += 1.0;
        else if (x === y) u += 0.5;
      }
    }

    if (first.length + second.length <= this.EXACT_MAX_TOTAL) {
      return this.exact(first, second, u);
    }
    return this.approximate(first, second, u);
  }

  private static exact(first: number[], second: number[], u: number): { u: number; pValue: number; isExact: boolean } {
    const n1 = first.length;
    const n2 = second.length;
    const n = n1 + n2;

    const items: { val: number; inFirst: boolean }[] = [];
    for (let i = 0; i < n1; i++) items.push({ val: first[i], inFirst: true });
    for (let j = 0; j < n2; j++) items.push({ val: second[j], inFirst: false });
    items.sort((a, b) => a.val - b.val);

    const ranks2 = new Int32Array(n);
    let observed = 0;
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && items[j + 1].val === items[i].val) j++;
      const r2 = (i + 1) + (j + 1);
      for (let t = i; t <= j; t++) {
        ranks2[t] = r2;
        if (items[t].inFirst) observed += r2;
      }
      i = j + 1;
    }

    const total2 = n * (n + 1);
    const dp: number[][] = Array.from({ length: n1 + 1 }, () => new Array(total2 + 1).fill(0));
    dp[0][0] = 1;

    for (let i = 0; i < n; i++) {
      const r = ranks2[i];
      for (let j = Math.min(i + 1, n1); j >= 1; j--) {
        for (let s = total2; s >= r; s--) {
          dp[j][s] += dp[j - 1][s - r];
        }
      }
    }

    const target = Math.abs(observed * n - n1 * total2);
    let all = 0;
    let extreme = 0;

    for (let s = 0; s <= total2; s++) {
      const c = dp[n1][s];
      if (c === 0) continue;
      all += c;
      if (Math.abs(s * n - n1 * total2) >= target) extreme += c;
    }

    const p = all > 0 ? Math.min(1.0, extreme / all) : 1.0;
    return { u, pValue: p, isExact: true };
  }

  private static approximate(first: number[], second: number[], u: number): { u: number; pValue: number; isExact: boolean } {
    const n1 = first.length;
    const n2 = second.length;
    const n = n1 + n2;

    const all = [...first, ...second].sort((a, b) => a - b);
    let tieTerm = 0;
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && all[j + 1] === all[i]) j++;
      const t = j - i + 1;
      tieTerm += t * t * t - t;
      i = j + 1;
    }

    const pairs = n1 * n2;
    const mean = pairs / 2.0;
    const variance = (pairs / 12.0) * ((n + 1) - (tieTerm / (n * (n - 1))));

    if (variance <= 1e-12) return { u, pValue: 1.0, isExact: false };

    const z = Math.max(0, Math.abs(u - mean) - 0.5) / Math.sqrt(variance);
    const p = Math.max(0, Math.min(1.0, this.erfc(z / Math.SQRT2)));
    return { u, pValue: p, isExact: false };
  }

  private static erfc(x: number): number {
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-x * x);
  }
}

export class BenchmarkComparer {
  private static readonly NORMAL_CONSISTENCY = 1.4826;

  public static compare(
    before: number[],
    after: number[],
    metricName: string,
    direction: MetricDirection,
    minimumRelevantChange: number = 0.03,
    workloadContext: string = "CS2 1280x960",
    minRunsPerGroup: number = 5,
    alpha: number = 0.05,
    bootstrapResamples: number = 10_000
  ): ComparisonResult {
    const nB = before.length;
    const nA = after.length;
    const notes: string[] = [];

    if (!workloadContext || workloadContext.trim().length === 0) {
      return {
        verdict: 'Inconclusive',
        reason: 'ContextMismatch',
        summary: 'No se puede comparar: falta declarar el contexto de carga (juego, mapa, resolución, duración).',
        notes: ['Un score o benchmark solo es comparable dentro del mismo contexto de medición idéntico.'],
        runsBefore: nB,
        runsAfter: nA,
        medianBefore: null,
        medianAfter: null,
        relativeChange: null,
        ciLow: null,
        ciHigh: null,
        pValue: null,
        pValueIsExact: null,
        probabilityOfImprovement: null,
        baselineNoise: null
      };
    }

    if (before.some(v => !Number.isFinite(v)) || after.some(v => !Number.isFinite(v))) {
      return {
        verdict: 'Inconclusive',
        reason: 'InvalidData',
        summary: 'No se puede comparar: hay valores no numéricos o infinitos.',
        notes: [],
        runsBefore: nB,
        runsAfter: nA,
        medianBefore: null,
        medianAfter: null,
        relativeChange: null,
        ciLow: null,
        ciHigh: null,
        pValue: null,
        pValueIsExact: null,
        probabilityOfImprovement: null,
        baselineNoise: null
      };
    }

    const medB = nB > 0 ? RobustStatistics.median(before) : null;
    const medA = nA > 0 ? RobustStatistics.median(after) : null;

    if (nB < minRunsPerGroup || nA < minRunsPerGroup) {
      return {
        verdict: 'Inconclusive',
        reason: 'InsufficientRuns',
        summary: `Datos insuficientes: se necesitan al menos ${minRunsPerGroup} corridas independientes por grupo (hay ${nB} antes y ${nA} después).`,
        notes: [
          'Una sola captura no mide un ajuste: el ruido entre corridas puede ser mayor que el efecto.',
          'Con menos de 5 corridas, la prueba de Mann-Whitney U no puede alcanzar significación estadística (p < 0.05).'
        ],
        runsBefore: nB,
        runsAfter: nA,
        medianBefore: medB,
        medianAfter: medA,
        relativeChange: null,
        ciLow: null,
        ciHigh: null,
        pValue: null,
        pValueIsExact: null,
        probabilityOfImprovement: null,
        baselineNoise: null
      };
    }

    if (!medB || medB <= 0) {
      return {
        verdict: 'Inconclusive',
        reason: 'DegenerateBaseline',
        summary: 'No se puede calcular el cambio relativo: la mediana de la línea base es 0 o negativa.',
        notes: [],
        runsBefore: nB,
        runsAfter: nA,
        medianBefore: medB,
        medianAfter: medA,
        relativeChange: null,
        ciLow: null,
        ciHigh: null,
        pValue: null,
        pValueIsExact: null,
        probabilityOfImprovement: null,
        baselineNoise: null
      };
    }

    const sign = direction === 'HigherIsBetter' ? 1.0 : -1.0;
    const estimate = sign * (medA! - medB) / medB;

    const mw = MannWhitneyTest.twoSided(after, before);
    const pairs = nA * nB;
    const probImprovement = direction === 'HigherIsBetter'
      ? mw.u / pairs
      : 1.0 - (mw.u / pairs);

    // Bootstrap Percentile Interval
    const { ciLow, ciHigh } = this.bootstrapInterval(before, after, sign, medB, alpha, bootstrapResamples);
    const noise = (this.NORMAL_CONSISTENCY * RobustStatistics.medianAbsoluteDeviation(before)) / medB;

    const m = minimumRelevantChange;
    const significant = mw.pValue < alpha;

    let verdict: BenchmarkVerdict = 'Inconclusive';
    let reason: InconclusiveReason = 'None';

    if (significant && ciLow > 0 && estimate >= m) {
      verdict = 'Improved';
    } else if (significant && ciHigh < 0 && estimate <= -m) {
      verdict = 'Regressed';
    } else if (ciLow >= -m && ciHigh <= m) {
      verdict = 'NoChange';
    } else {
      verdict = 'Inconclusive';
      reason = 'Ambiguous';
    }

    if (Math.min(nB, nA) < 10) {
      notes.push('Con menos de 10 corridas por grupo el intervalo bootstrap tiende a ser optimista; interprétalo con cautela.');
    }

    const causalityNote = 'Esto demuestra una diferencia estadística entre dos grupos de corridas. Para confirmar causalidad, alterna corridas (A-B-A-B) y mantén idéntica temperatura ambiente y programas en segundo plano.';

    if (verdict === 'Improved') {
      notes.push(causalityNote);
    } else if (verdict === 'Regressed') {
      notes.push(causalityNote);
    } else if (verdict === 'NoChange') {
      if (significant) {
        notes.push(`Diferencia pequeña detectable (p = ${mw.pValue.toFixed(4)}), pero dentro del margen no relevante (±${(m * 100).toFixed(1)}%): equivalencia práctica demostrada.`);
      }
    } else {
      notes.push('«No concluyente» significa que el ruido entre corridas o la dispersión del intervalo impide descartar o asegurar un efecto del tamaño requerido.');
      if (noise > m) {
        notes.push(`El ruido intrínseco de la línea base (${(noise * 100).toFixed(1)}%) supera el mínimo relevante (${(m * 100).toFixed(1)}%): se requieren más corridas para filtrar la variación.`);
      }
    }

    const pctStr = (estimate * 100 >= 0 ? '+' : '') + (estimate * 100).toFixed(1) + '%';
    const ciStr = `IC ${((1 - alpha) * 100).toFixed(0)}%: ${(ciLow * 100).toFixed(1)}% a ${(ciHigh * 100).toFixed(1)}%`;
    const pStr = mw.pValue < 0.001 ? 'p < 0.001' : `p = ${mw.pValue.toFixed(3)}`;

    let summary = '';
    if (verdict === 'Improved') {
      summary = `Mejora respaldada científicamente en «${metricName}»: ${pctStr} (${ciStr}; ${pStr}).`;
    } else if (verdict === 'Regressed') {
      summary = `Empeoramiento respaldado científicamente en «${metricName}»: ${pctStr} (${ciStr}; ${pStr}).`;
    } else if (verdict === 'NoChange') {
      summary = `Sin cambio práctico en «${metricName}»: el intervalo (${(ciLow * 100).toFixed(1)}% a ${(ciHigh * 100).toFixed(1)}%) queda acotado dentro de ±${(m * 100).toFixed(1)}%.`;
    } else {
      summary = `No concluyente en «${metricName}»: cambio estimado ${pctStr}, pero el intervalo (${(ciLow * 100).toFixed(1)}% a ${(ciHigh * 100).toFixed(1)}%) no permite afirmar ni descartar el efecto (${pStr}).`;
    }

    return {
      verdict,
      reason,
      summary,
      notes,
      runsBefore: nB,
      runsAfter: nA,
      medianBefore: medB,
      medianAfter: medA,
      relativeChange: estimate,
      ciLow,
      ciHigh,
      pValue: mw.pValue,
      pValueIsExact: mw.isExact,
      probabilityOfImprovement: probImprovement,
      baselineNoise: noise
    };
  }

  private static bootstrapInterval(
    before: number[],
    after: number[],
    sign: number,
    denom: number,
    alpha: number,
    resamples: number
  ): { ciLow: number; ciHigh: number } {
    const rng = new SplitMix64(0x45564Fn);
    const nB = before.length;
    const nA = after.length;
    const rb = new Float64Array(nB);
    const ra = new Float64Array(nA);
    const stats = new Float64Array(resamples);

    for (let r = 0; r < resamples; r++) {
      for (let i = 0; i < nB; i++) rb[i] = before[rng.nextIndex(nB)];
      for (let i = 0; i < nA; i++) ra[i] = after[rng.nextIndex(nA)];
      rb.sort();
      ra.sort();

      const medB = nB % 2 === 1 ? rb[Math.floor(nB / 2)] : (rb[nB / 2 - 1] + rb[nB / 2]) / 2.0;
      const medA = nA % 2 === 1 ? ra[Math.floor(nA / 2)] : (ra[nA / 2 - 1] + ra[nA / 2]) / 2.0;
      stats[r] = (sign * (medA - medB)) / denom;
    }

    stats.sort();
    const loIdx = Math.floor(resamples * (alpha / 2.0));
    const hiIdx = Math.min(resamples - 1, Math.floor(resamples * (1.0 - alpha / 2.0)));

    return { ciLow: stats[loIdx], ciHigh: stats[hiIdx] };
  }
}

export class FrameTimeAnalyzer {
  public static analyze(frameTimesMs: number[], warmupSeconds: number = 0, pauseThresholdMs: number = 1000): FrameStats {
    const notes: string[] = [];
    const kept: number[] = [];
    const afterGap: boolean[] = [];

    const warmupMs = warmupSeconds * 1000.0;
    let elapsed = 0;
    let skipped = 0;
    let paused = 0;
    let gap = false;

    for (const ms of frameTimesMs) {
      if (!Number.isFinite(ms) || ms <= 0) continue;

      if (elapsed < warmupMs) {
        elapsed += ms;
        skipped++;
        continue;
      }
      elapsed += ms;

      if (ms >= pauseThresholdMs) {
        paused++;
        gap = true;
        continue;
      }

      kept.push(ms);
      afterGap.push(gap);
      gap = false;
    }

    if (skipped > 0) notes.push(`Calentamiento descartado: ${skipped} fotogramas.`);
    if (paused > 0) notes.push(`${paused} fotogramas ≥ ${pauseThresholdMs}ms excluidos como pausas (alt-tab / carga).`);

    const n = kept.length;
    if (n === 0) {
      return {
        validFrames: 0,
        pausedFrames: paused,
        warmupFramesSkipped: skipped,
        durationSeconds: 0,
        averageFps: null,
        medianFrameTimeMs: null,
        p95FrameTimeMs: null,
        p99FrameTimeMs: null,
        minFrameTimeMs: null,
        maxFrameTimeMs: null,
        onePercentLowFps: null,
        pointOnePercentLowFps: null,
        robustVariability: null,
        meanSuccessiveDifferenceMs: null,
        spikeCount: 0,
        spikeFraction: null,
        notes: ['Sin fotogramas válidos tras descartar pausas y calentamiento.']
      };
    }

    let sum = 0;
    for (const ms of kept) sum += ms;

    const sorted = [...kept].sort((a, b) => a - b);
    const median = RobustStatistics.medianOfSorted(sorted);

    // 1% Low: k = ceil(n/100), requires k >= 10 (n >= 901)
    const k1 = Math.ceil(n / 100.0);
    let oneLow: number | null = null;
    if (k1 >= 10) {
      let tailSum = 0;
      for (let i = n - k1; i < n; i++) tailSum += sorted[i];
      oneLow = 1000.0 / (tailSum / k1);
    } else {
      notes.push(`1% Low: información insuficiente (se necesitan ≥ 901 fotogramas para cola de 10; hay ${n}).`);
    }

    // 0.1% Low: k = ceil(n/1000), requires k >= 10 (n >= 9001)
    const k01 = Math.ceil(n / 1000.0);
    let pointOneLow: number | null = null;
    if (k01 >= 10) {
      let tailSum = 0;
      for (let i = n - k01; i < n; i++) tailSum += sorted[i];
      pointOneLow = 1000.0 / (tailSum / k01);
    } else {
      notes.push(`0.1% Low: información insuficiente (se necesitan ≥ 9001 fotogramas; hay ${n}).`);
    }

    let diffSum = 0;
    let diffCount = 0;
    for (let i = 1; i < n; i++) {
      if (afterGap[i]) continue;
      diffSum += Math.abs(kept[i] - kept[i - 1]);
      diffCount++;
    }

    const mad = RobustStatistics.medianAbsoluteDeviation(sorted);
    const spikeThreshold = 2.0 * median;
    let spikes = 0;
    for (const ms of kept) if (ms > spikeThreshold) spikes++;

    return {
      validFrames: n,
      pausedFrames: paused,
      warmupFramesSkipped: skipped,
      durationSeconds: sum / 1000.0,
      averageFps: 1000.0 * n / sum,
      medianFrameTimeMs: median,
      p95FrameTimeMs: RobustStatistics.percentileOfSorted(sorted, 0.95),
      p99FrameTimeMs: RobustStatistics.percentileOfSorted(sorted, 0.99),
      minFrameTimeMs: sorted[0],
      maxFrameTimeMs: sorted[n - 1],
      onePercentLowFps: oneLow,
      pointOnePercentLowFps: pointOneLow,
      robustVariability: (1.4826 * mad) / median,
      meanSuccessiveDifferenceMs: diffCount > 0 ? diffSum / diffCount : null,
      spikeCount: spikes,
      spikeFraction: spikes / n,
      notes
    };
  }
}
