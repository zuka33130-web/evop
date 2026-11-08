/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// EVO FPS OPTIMIZER - MASTER ENGINEERING ENGINE v4.0
// Telemetría de Kernel, Topología de Silicio (i3-1220P 2P+8E), 
// EVO Performance Score (4D), Prueba t de Welch (Multi-Corrida) y Diagnóstico Predictivo
// ============================================================================

export type OptimizationObjective = 'EverydayUse' | 'Gaming' | 'MaxPerformance';

export interface ObjectiveConfig {
  id: OptimizationObjective;
  name: string;
  badge: string;
  description: string;
  weights: {
    stability: number;
    performance: number;
    efficiency: number;
    health: number;
  };
  targetTimerMs: number;
  cpuSetsStrategy: string;
}

export const OBJECTIVES_CONFIG: Record<OptimizationObjective, ObjectiveConfig> = {
  EverydayUse: {
    id: 'EverydayUse',
    name: '01 · Uso Cotidiano',
    badge: 'Eficiencia & C-States',
    description: 'Prioriza eficiencia energética, temperaturas bajas, salud de componentes y mínima carga en segundo plano. Mantiene timer estándar para permitir C-States profundos.',
    weights: { stability: 0.30, efficiency: 0.35, health: 0.25, performance: 0.10 },
    targetTimerMs: 15.625,
    cpuSetsStrategy: 'Equilibrado por Intel Thread Director (sin restricciones de afinidad).'
  },
  Gaming: {
    id: 'Gaming',
    name: '02 · Gaming Competitivo',
    badge: '1% Lows & Frametime',
    description: 'Prioriza consistencia extrema de frametimes (1% lows), aislamiento de hilos y reducción de jitter. Confinamiento de tareas de fondo en E-Cores mediante CPU Sets.',
    weights: { stability: 0.40, performance: 0.35, efficiency: 0.15, health: 0.10 },
    targetTimerMs: 1.0,
    cpuSetsStrategy: 'CS2 soft-affinity en P-Cores (hilos 0..3); procesos de fondo en E-Cores (hilos 4..11).'
  },
  MaxPerformance: {
    id: 'MaxPerformance',
    name: '03 · Máximo Rendimiento',
    badge: 'Throughput & Cómputo',
    description: 'Prioriza rendimiento bruto y disponibilidad de todos los hilos de cómputo para cargas intensivas, compilación de shaders y renderizado.',
    weights: { performance: 0.45, stability: 0.30, efficiency: 0.15, health: 0.10 },
    targetTimerMs: 0.5,
    cpuSetsStrategy: 'Todos los 12 hilos desbloqueados con prioridad alta en el quantum de despacho.'
  }
};

export interface Evo4DScore {
  compositeScore: number;
  stabilityScore: number;
  stabilityDiagnostic: string;
  performanceScore: number;
  performanceDiagnostic: string;
  efficiencyScore: number;
  efficiencyDiagnostic: string;
  healthScore: number;
  healthDiagnostic: string;
}

export interface TelemetryInputs {
  cpuUsagePercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  commitUsedGb: number;
  commitLimitGb: number;
  ssdFreePercent: number;
  runningProcesses: number;
  runningThreads: number;
  currentMhz: number;
  maxMhz: number;
  mhzLimit: number; // powrprof limit
  ramLeakRateMbMin: number; // dRAM/dt
  schedulerQueueP99Ms: number;
  thermalSensorCalibrated: boolean;
}

export class EvoPerformanceScoreCalculator {
  public static calculate(
    telemetry: TelemetryInputs,
    objective: OptimizationObjective
  ): Evo4DScore {
    const cfg = OBJECTIVES_CONFIG[objective];

    // 1. ESTABILIDAD (Commit charge, RAM pressure, thread contention)
    const commitPercent = telemetry.commitLimitGb > 0 
      ? (telemetry.commitUsedGb / telemetry.commitLimitGb) * 100 
      : 50;
    const commitPenalty = Math.max(0, commitPercent - 55.0) * 1.1;
    const threadPenalty = Math.max(0, (telemetry.runningThreads - 2200) / 80.0);
    const queuePenalty = telemetry.schedulerQueueP99Ms > 0.85 
      ? (telemetry.schedulerQueueP99Ms - 0.85) * 40.0 
      : 0;
    
    const stabilityScore = Math.round(
      Math.max(20, Math.min(99, 96.0 - commitPenalty - threadPenalty - queuePenalty))
    );
    const stabilityDiagnostic = `Commit al ${commitPercent.toFixed(0)}% (${telemetry.commitUsedGb.toFixed(1)}/${telemetry.commitLimitGb.toFixed(1)} GB) · ${telemetry.runningThreads} hilos · Cola P99: ${telemetry.schedulerQueueP99Ms.toFixed(2)}ms`;

    // 2. RENDIMIENTO (CPU Headroom, RAM headroom, Frequency headroom)
    const cpuBusyPenalty = telemetry.cpuUsagePercent * 0.45;
    const ramFreeGb = Math.max(0, telemetry.ramTotalGb - telemetry.ramUsedGb);
    const ramHeadroomBonus = Math.min(12.0, ramFreeGb * 0.8);
    
    // Throttling penalty from powrprof.dll (if mhzLimit < maxMhz)
    const throttleDeficit = Math.max(0, telemetry.maxMhz - telemetry.mhzLimit);
    const throttlePenalty = (throttleDeficit / telemetry.maxMhz) * 35.0;

    const performanceScore = Math.round(
      Math.max(15, Math.min(99, 86.0 - cpuBusyPenalty + ramHeadroomBonus - throttlePenalty))
    );
    const performanceDiagnostic = `Holgura CPU: ${(100.0 - telemetry.cpuUsagePercent).toFixed(1)}% · RAM Libre: ${ramFreeGb.toFixed(1)} GB · Frecuencia: ${telemetry.currentMhz} MHz (Límite: ${telemetry.mhzLimit} MHz)`;

    // 3. EFICIENCIA (Process sprawl, memory leak, background footprint)
    const processSprawlPenalty = Math.max(0, (telemetry.runningProcesses - 120) * 0.28);
    const leakPenalty = telemetry.ramLeakRateMbMin > 60 
      ? Math.min(30, (telemetry.ramLeakRateMbMin - 60) * 0.15) 
      : 0;

    const efficiencyScore = Math.round(
      Math.max(20, Math.min(99, 98.0 - processSprawlPenalty - leakPenalty))
    );
    const efficiencyDiagnostic = `${telemetry.runningProcesses} procesos activos · dRAM/dt: ${telemetry.ramLeakRateMbMin > 0 ? '+' : ''}${telemetry.ramLeakRateMbMin.toFixed(0)} MB/min`;

    // 4. SALUD (SSD wear/capacity, thermal sensor uncertainty guard)
    const storagePenalty = telemetry.ssdFreePercent < 20.0 
      ? (20.0 - telemetry.ssdFreePercent) * 2.5 
      : 0;
    const thermalUncertaintyCap = !telemetry.thermalSensorCalibrated ? 8.0 : 0;
    const healthScore = Math.round(
      Math.max(25, Math.min(99, 96.0 - storagePenalty - thermalUncertaintyCap))
    );
    const healthDiagnostic = `Espacio libre SSD: ${telemetry.ssdFreePercent.toFixed(0)}% · ${telemetry.thermalSensorCalibrated ? 'Sensor Térmico Ring-0 Calibrado' : 'Guardia de Incertidumbre Activa'}`;

    // Weighted composite
    const compositeWeighted = 
      (stabilityScore * cfg.weights.stability) +
      (performanceScore * cfg.weights.performance) +
      (efficiencyScore * cfg.weights.efficiency) +
      (healthScore * cfg.weights.health);

    return {
      compositeScore: Math.round(compositeWeighted),
      stabilityScore,
      stabilityDiagnostic,
      performanceScore,
      performanceDiagnostic,
      efficiencyScore,
      efficiencyDiagnostic,
      healthScore,
      healthDiagnostic
    };
  }
}

// ============================================================================
// TOPOLOGÍA DE SILICIO INTEL CORE i3-1220P (ALDER LAKE-P)
// ============================================================================

export interface CoreTopologyInfo {
  coreIndex: number;
  type: 'P-Core' | 'E-Core';
  architecture: 'Golden Cove' | 'Gracemont';
  threads: number[];
  baseMhz: number;
  maxTurboMhz: number;
  l2CacheKb: number;
  efficiencyClass: number; // 1 = P, 0 = E
  roleDescription: string;
}

export const I3_1220P_TOPOLOGY: CoreTopologyInfo[] = [
  {
    coreIndex: 0,
    type: 'P-Core',
    architecture: 'Golden Cove',
    threads: [0, 1],
    baseMhz: 1500,
    maxTurboMhz: 4400,
    l2CacheKb: 1280, // 1.25 MB
    efficiencyClass: 1,
    roleDescription: 'P-Core 0: Hilo principal CS2, Render Loop DXGI & DPC/ISR de alta prioridad.'
  },
  {
    coreIndex: 1,
    type: 'P-Core',
    architecture: 'Golden Cove',
    threads: [2, 3],
    baseMhz: 1500,
    maxTurboMhz: 4400,
    l2CacheKb: 1280, // 1.25 MB
    efficiencyClass: 1,
    roleDescription: 'P-Core 1: Hilo de renderizado CS2, física y compilación de shaders.'
  },
  {
    coreIndex: 2,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [4],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512, // Compartido en cluster de 4
    efficiencyClass: 0,
    roleDescription: 'E-Core 0 (Cluster 1): Hilos de sonido, red y tareas auxiliares de CS2.'
  },
  {
    coreIndex: 3,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [5],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 1 (Cluster 1): Tareas secundarias y temporizadores del sistema.'
  },
  {
    coreIndex: 4,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [6],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 2 (Cluster 1): DWM, composición de ventanas y UI de Windows.'
  },
  {
    coreIndex: 5,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [7],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 3 (Cluster 1): Procesos de fondo, indexadores y telemetría.'
  },
  {
    coreIndex: 6,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [8],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512, // Compartido en cluster 2
    efficiencyClass: 0,
    roleDescription: 'E-Core 4 (Cluster 2): Steam Client, Discord, browser de fondo.'
  },
  {
    coreIndex: 7,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [9],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 5 (Cluster 2): E/S de almacenamiento y tareas de compresión.'
  },
  {
    coreIndex: 8,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [10],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 6 (Cluster 2): Drivers periféricos y servicios de usuario.'
  },
  {
    coreIndex: 9,
    type: 'E-Core',
    architecture: 'Gracemont',
    threads: [11],
    baseMhz: 1100,
    maxTurboMhz: 3300,
    l2CacheKb: 512,
    efficiencyClass: 0,
    roleDescription: 'E-Core 7 (Cluster 2): Tareas en espera y recolección de basura.'
  }
];

export const I3_1220P_CACHE_SUMMARY = {
  l1InstructionKb: 320, // 32KB x 2 P + 32KB x 8 E
  l1DataKb: 384,        // 48KB x 2 P + 32KB x 8 E
  l2TotalMb: 6.5,       // (1.25MB x 2) + (2.0MB x 2 clusters de 4 E)
  l3SharedMb: 12.0,     // 12 MB Intel Smart Cache compartida
  architectureNote: 'CRÍTICO: En el i3-1220P, CPU 0..3 corresponden a los ÚNICOS 2 P-Cores. Amputar CPU 0/1 destruye el 50% de la capacidad Golden Cove. Se debe utilizar CPU Sets (Soft Affinity) en lugar de máscaras rígidas.'
};

// ============================================================================
// COMPARADOR A/B MULTI-CORRIDA (PRUEBA T DE WELCH & INTERVALOS DE CONFIANZA 95%)
// ============================================================================

export interface MultiRunSample {
  runId: string;
  onePercentLowFps: number;
  averageFps: number;
  p99Ms: number;
  stutterCount: number;
  durationSeconds: number;
}

export interface WelchComparisonReport {
  status: 'Conclusive' | 'Inconclusive';
  verdict: 'Improvement' | 'Regression' | 'NoChange' | 'Inconclusive';
  runsA: number;
  runsB: number;
  meanA: number;
  meanB: number;
  stdDevA: number;
  stdDevB: number;
  deltaAbsolute: number;
  deltaPercent: number;
  standardErrorDelta: number;
  degreesOfFreedom: number;
  ci95Low: number;
  ci95High: number;
  pValue: number;
  headline: string;
  technicalDetails: string[];
  contextFlags: {
    sampleSizeMet: boolean; // KA >= 2 and KB >= 2
    recommendedMet: boolean; // KA >= 3 and KB >= 3
    durationVarianceOk: boolean;
    zeroCrossing: boolean;
  };
}

export class WelchTTestEngine {
  public static compare(
    groupA: MultiRunSample[],
    groupB: MultiRunSample[],
    metricKey: 'onePercentLowFps' | 'averageFps' | 'p99Ms' = 'onePercentLowFps'
  ): WelchComparisonReport {
    const kA = groupA.length;
    const kB = groupB.length;
    const notes: string[] = [];

    // Verificación 1: Mínimo K >= 2 por grupo
    if (kA < 2 || kB < 2) {
      return {
        status: 'Inconclusive',
        verdict: 'Inconclusive',
        runsA: kA,
        runsB: kB,
        meanA: 0,
        meanB: 0,
        stdDevA: 0,
        stdDevB: 0,
        deltaAbsolute: 0,
        deltaPercent: 0,
        standardErrorDelta: 0,
        degreesOfFreedom: 0,
        ci95Low: 0,
        ci95High: 0,
        pValue: 1.0,
        headline: 'Muestras Insuficientes: Se requieren al menos 2 corridas independientes por grupo.',
        technicalDetails: [
          `Grupo A tiene ${kA} corridas; Grupo B tiene ${kB} corridas.`,
          'Una sola corrida no permite calcular la varianza muestral ni aplicar inferencia estadística.',
          'Regla de oro: Capture un mínimo de 3 corridas de 60 segundos por cada condición.'
        ],
        contextFlags: {
          sampleSizeMet: false,
          recommendedMet: false,
          durationVarianceOk: true,
          zeroCrossing: true
        }
      };
    }

    const valuesA = groupA.map(g => g[metricKey]);
    const valuesB = groupB.map(g => g[metricKey]);

    const meanA = valuesA.reduce((a, b) => a + b, 0) / kA;
    const meanB = valuesB.reduce((a, b) => a + b, 0) / kB;

    const varA = valuesA.reduce((sum, v) => sum + Math.pow(v - meanA, 2), 0) / (kA - 1);
    const varB = valuesB.reduce((sum, v) => sum + Math.pow(v - meanB, 2), 0) / (kB - 1);

    const stdA = Math.sqrt(varA);
    const stdB = Math.sqrt(varB);

    const seA = varA / kA;
    const seB = varB / kB;
    const seDelta = Math.sqrt(seA + seB);

    // Grados de libertad de Welch-Satterthwaite
    const num = Math.pow(seA + seB, 2);
    const den = (Math.pow(seA, 2) / (kA - 1)) + (Math.pow(seB, 2) / (kB - 1));
    const df = den > 0 ? num / den : 1;

    // t crítico aproximado para 95% bilateral (alpha = 0.05)
    const tCrit = this.getStudentTCritical95(df);

    // Delta = B - A
    const delta = meanB - meanA;
    const deltaPercent = meanA !== 0 ? (delta / meanA) * 100 : 0;

    const marginOfError = tCrit * seDelta;
    const ciLow = delta - marginOfError;
    const ciHigh = delta + marginOfError;

    // p-value aproximado
    const tStat = seDelta > 0 ? Math.abs(delta) / seDelta : 0;
    const pValue = this.approximateStudentPValue(tStat, df);

    // Chequeo de duración
    const durA = groupA.map(g => g.durationSeconds);
    const durB = groupB.map(g => g.durationSeconds);
    const avgDurA = durA.reduce((a, b) => a + b, 0) / kA;
    const avgDurB = durB.reduce((a, b) => a + b, 0) / kB;
    const durationRatio = avgDurA > 0 ? Math.abs(avgDurA - avgDurB) / avgDurA : 0;
    const durationOk = durationRatio <= 0.25;

    if (!durationOk) {
      notes.push(`Discrepancia de duración (${(durationRatio * 100).toFixed(1)}% de diferencia entre grupos). Puede introducir sesgo de fase de partida.`);
    }

    const crossesZero = ciLow <= 0 && ciHigh >= 0;
    const higherIsBetter = metricKey !== 'p99Ms';

    let verdict: 'Improvement' | 'Regression' | 'NoChange' | 'Inconclusive' = 'Inconclusive';
    let headline = '';

    if (crossesZero) {
      if (Math.abs(deltaPercent) < 1.5) {
        verdict = 'NoChange';
        headline = 'Sin Cambio Estadísticamente Significativo (|Δ| < 1.5%)';
        notes.push('El intervalo de confianza del 95% contiene el cero. La diferencia observada es indistinguible del ruido aleatorio.');
      } else {
        verdict = 'Inconclusive';
        headline = 'Resultado Inconcluyente: Alta varianza entre partidas';
        notes.push('El intervalo cruza el cero debido a alta dispersión en las corridas. Se requieren más repeticiones para aislar la señal.');
      }
    } else {
      const isPositive = higherIsBetter ? delta > 0 : delta < 0;
      if (isPositive) {
        verdict = 'Improvement';
        headline = `Mejora Concluyente Verificada (+${Math.abs(deltaPercent).toFixed(1)}%) con 95% de Certeza`;
        notes.push(`El intervalo de confianza [${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}] se encuentra totalmente en zona favorable.`);
      } else {
        verdict = 'Regression';
        headline = `Regresión Medida Detectada (${deltaPercent.toFixed(1)}%)`;
        notes.push(`El intervalo de confianza [${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}] demuestra pérdida estadísticamente significativa.`);
      }
    }

    notes.push(`Media Grupo A: ${meanA.toFixed(2)} (s=${stdA.toFixed(2)}) | Media Grupo B: ${meanB.toFixed(2)} (s=${stdB.toFixed(2)})`);
    notes.push(`Grados de libertad (Welch): ${df.toFixed(1)} · Error estándar SE_Δ: ${seDelta.toFixed(3)} · t=${tStat.toFixed(2)} (p=${pValue.toFixed(4)})`);

    return {
      status: verdict === 'Inconclusive' ? 'Inconclusive' : 'Conclusive',
      verdict,
      runsA: kA,
      runsB: kB,
      meanA,
      meanB,
      stdDevA: stdA,
      stdDevB: stdB,
      deltaAbsolute: delta,
      deltaPercent,
      standardErrorDelta: seDelta,
      degreesOfFreedom: df,
      ci95Low: ciLow,
      ci95High: ciHigh,
      pValue,
      headline,
      technicalDetails: notes,
      contextFlags: {
        sampleSizeMet: true,
        recommendedMet: kA >= 3 && kB >= 3,
        durationVarianceOk: durationOk,
        zeroCrossing: crossesZero
      }
    };
  }

  private static getStudentTCritical95(df: number): number {
    // Aproximación de Cornish-Fisher para t_{0.975}
    if (df <= 1) return 12.71;
    if (df <= 2) return 4.303;
    if (df <= 3) return 3.182;
    if (df <= 4) return 2.776;
    if (df <= 5) return 2.571;
    if (df <= 10) return 2.228;
    if (df <= 20) return 2.086;
    if (df <= 30) return 2.042;
    if (df <= 60) return 2.000;
    return 1.96;
  }

  private static approximateStudentPValue(t: number, df: number): number {
    // Aproximación de cola bilateral para t-distribution
    const x = df / (df + t * t);
    // Beta incompleta simple aproximada
    const z = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + (t * t) / (2 * df));
    // Normal estándar aproximada de z
    const p = Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * (z + 0.0001));
    return Math.max(0.0001, Math.min(1.0, 2 * p));
  }
}

// ============================================================================
// MATRIZ AUDITADA DE 13 MECANISMOS DE WINDOWS INTERNALS (i3-1220P + UHD + CS2)
// ============================================================================

export interface WindowsMechanismAudit {
  id: string;
  name: string;
  api: string;
  subsystem: string;
  statusOnEvo: 'Recomendado' | 'Auditoría / Solo Lectura' | 'Prohibido en EVO' | 'Bloqueado por Seguridad';
  reversibility: '100% Reversible en Caliente' | 'Requiere Reinicio' | 'NO REVERSIBLE (Destructivo)' | 'Solo Monitoreo';
  riskLevel: 'Cero Riesgo' | 'Bajo Riesgo' | 'Alto Riesgo' | 'Peligroso';
  whatItModifies: string;
  impactOnI31220P: string;
  impactOnCs2: string;
  rollbackStrategy: string;
}

export const WINDOWS_13_MECHANISMS_AUDIT: WindowsMechanismAudit[] = [
  {
    id: '01_timer_resolution',
    name: '01. Timer Resolution',
    api: 'ntdll!NtQueryTimerResolution / NtSetTimerResolution',
    subsystem: 'Kernel Timer Interrupts',
    statusOnEvo: 'Recomendado',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Frecuencia de interrupción del temporizador del kernel (de 15.625 ms a 0.5–1.0 ms).',
    impactOnI31220P: 'Aumenta consumo en ~1.5W. Si no se juega, bloquea C-States profundos. En Gaming mejora respuesta de despacho.',
    impactOnCs2: 'Reduce jitter en la cola de frames DXGI si GlobalTimerResolutionRequests está activo.',
    rollbackStrategy: 'NtSetTimerResolution(setResolution: false) restaura inmediatamente el valor previo.'
  },
  {
    id: '02_mmcss',
    name: '02. MMCSS (Multimedia Class Scheduler)',
    api: 'avrt.dll / HKLM Multimedia\\SystemProfile',
    subsystem: 'Audio & Game Thread Scheduling',
    statusOnEvo: 'Auditoría / Solo Lectura',
    reversibility: 'Requiere Reinicio',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Prioridad relativa de hilos de audio y juegos vía servicio MMCSS.',
    impactOnI31220P: 'Poner SystemResponsiveness en 0% puede provocar cortes en Discord o audiodg al monopolizar los 2 P-Cores.',
    impactOnCs2: 'CS2 ya eleva sus hilos a MMCSS categoría Games internamente.',
    rollbackStrategy: 'Restauración del valor DWORD original (20%) en el registro.'
  },
  {
    id: '03_hags',
    name: '03. HAGS (Hardware-Accelerated GPU Scheduling)',
    api: 'GraphicsDrivers\\HwSchMode (WDDM 2.7+)',
    subsystem: 'GPU Driver Command Queues',
    statusOnEvo: 'Auditoría / Solo Lectura',
    reversibility: 'Requiere Reinicio',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Pasa la cola de despacho de comandos de la GPU del kernel al microcontrolador de la GPU.',
    impactOnI31220P: 'En Intel UHD 64EU compartida, el soporte depende del driver WDDM. Puede aumentar varianza con iGPU al 99%.',
    impactOnCs2: 'Verificar mediante A/B: no activar a ciegas en GPUs integradas sin benchmark.',
    rollbackStrategy: 'HwSchMode = 1 (desactivado) y reinicio del equipo.'
  },
  {
    id: '04_vbs_hvci',
    name: '04. VBS / HVCI (Core Isolation Memory Integrity)',
    api: 'DeviceGuard / hypervisorlaunchtype',
    subsystem: 'Kernel Virtualization Security',
    statusOnEvo: 'Auditoría / Solo Lectura',
    reversibility: 'Requiere Reinicio',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Ejecuta el kernel de Windows dentro de Hyper-V SLAT/EPT para proteger código Ring-0.',
    impactOnI31220P: 'La sobrecarga SLAT resta ~3% a 7% de FPS en el i3-1220P. EVO audita su estado sin desactivarlo a la fuerza.',
    impactOnCs2: 'Menor sobrecarga de llamadas al sistema en 1% lows si está desactivado, pero reduce la seguridad del SO.',
    rollbackStrategy: 'Reactivar aislamiento del núcleo en Seguridad de Windows.'
  },
  {
    id: '05_cpu_priority',
    name: '05. Prioridades de CPU (SetPriorityClass)',
    api: 'kernel32!SetPriorityClass',
    subsystem: 'Process Scheduler Quantum',
    statusOnEvo: 'Recomendado',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Prioridad base del proceso en el planificador de Windows (Normal, BelowNormal, High).',
    impactOnI31220P: 'No poner cs2.exe en Realtime/High porque ahoga al driver Intel UHD o al ratón de 1000Hz en solo 2 P-Cores. En cambio, bajar tareas secundarias a BelowNormal es ideal.',
    impactOnCs2: 'Libera ciclos de los 2 P-Cores de procesos parásitos de fondo.',
    rollbackStrategy: 'SetPriorityClass con la prioridad original leída en el preflight.'
  },
  {
    id: '06_hard_affinity',
    name: '06. Afinidad Dura (SetProcessAffinityMask)',
    api: 'kernel32!SetProcessAffinityMask',
    subsystem: 'Thread Hard Pinning',
    statusOnEvo: 'Prohibido en EVO',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Alto Riesgo',
    whatItModifies: 'Máscara rígida de bits que fuerza a un proceso a ejecutarse únicamente en núcleos fijos.',
    impactOnI31220P: 'PELIGRO: El truco común "Affinity & ~0x3" amputa los hilos 0..3 (los 2 únicos P-Cores del i3-1220P). Además anula Intel Thread Director.',
    impactOnCs2: 'Forzar solo 4 hilos satura los job threads de Source 2 al 100%, provocando stuttering severo en 0.1% lows.',
    rollbackStrategy: 'Desactivado y prohibido en EVO. Se sustituye por CPU Sets.'
  },
  {
    id: '07_cpu_sets',
    name: '07. CPU Sets & Topología Híbrida',
    api: 'kernel32!SetProcessDefaultCpuSets',
    subsystem: 'Soft Affinity & Thread Director',
    statusOnEvo: 'Recomendado',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Indica al planificador un conjunto preferido de procesadores lógicos sin restringir desbordes.',
    impactOnI31220P: 'Confinamiento de procesos de fondo pesados (Discord, Chrome) en los 8 E-Cores (hilos 4..11), dejando los 2 P-Cores despejados para CS2.',
    impactOnCs2: 'Mantiene máxima localidad de caché L2/L3 en los P-Cores para el hilo de render y simulación.',
    rollbackStrategy: 'SetProcessDefaultCpuSets(hProcess, null, 0) desvincula las directrices.'
  },
  {
    id: '08_io_priority',
    name: '08. Prioridad de I/O de Almacenamiento',
    api: 'ntdll!NtSetInformationProcess (ProcessIoPriority)',
    subsystem: 'Storage Driver I/O Queues',
    statusOnEvo: 'Recomendado',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Prioridad de cola en el controlador de almacenamiento NVMe (VeryLow, Low, Normal).',
    impactOnI31220P: 'Reduce la latencia de lectura de texturas y shaders de CS2 si un proceso en fondo lee o escribe en disco.',
    impactOnCs2: 'Previene tirones de disco en cargas repentinas de mapas.',
    rollbackStrategy: 'Restauración del nivel de IoPriority previo mediante NtSetInformationProcess.'
  },
  {
    id: '09_ecoqos',
    name: '09. EcoQoS / Efficiency Mode',
    api: 'kernel32!SetProcessInformation (ProcessPowerThrottling)',
    subsystem: 'SoC Energy & E-Core Steering',
    statusOnEvo: 'Recomendado',
    reversibility: '100% Reversible en Caliente',
    riskLevel: 'Bajo Riesgo',
    whatItModifies: 'Informa al kernel que ejecute el proceso con frecuencias eficientes priorizando E-Cores.',
    impactOnI31220P: 'Ahorra vatios del presupuesto compartido PL1 (15-28W), liberando margen térmico y eléctrico para la Intel UHD.',
    impactOnCs2: 'NUNCA aplicar a cs2.exe ni a audiodg. Solo sobre procesos auxiliares seleccionados.',
    rollbackStrategy: 'SetProcessInformation con StateMask = 0.'
  },
  {
    id: '10_working_set_purge',
    name: '10. Purga de Memoria (EmptyWorkingSet)',
    api: 'psapi!EmptyWorkingSet',
    subsystem: 'Virtual Memory Working Set',
    statusOnEvo: 'Prohibido en EVO',
    reversibility: 'NO REVERSIBLE (Destructivo)',
    riskLevel: 'Peligroso',
    whatItModifies: 'Expulsa todas las páginas físicas residentes del proceso hacia el pagefile o Standby.',
    impactOnI31220P: 'CATASTRÓFICO: No se puede deshacer. Provoca una tormenta inmediata de Hard Page Faults al re-acceder activos, saturando la RAM DDR5 compartida con la iGPU.',
    impactOnCs2: 'Picos de stuttering masivo (>200ms) durante la partida cuando el motor vuelve a leer texturas.',
    rollbackStrategy: 'PROHIBIDO en el motor EVO. Solo se audita el Working Set real.'
  },
  {
    id: '11_memory_uma_guard',
    name: '11. Gestión de RAM UMA & Commit Charge',
    api: 'kernel32!GlobalMemoryStatusEx',
    subsystem: 'Unified Memory Architecture',
    statusOnEvo: 'Recomendado',
    reversibility: 'Solo Monitoreo',
    riskLevel: 'Cero Riesgo',
    whatItModifies: 'Monitorea la reserva de memoria dinámica entre el SO y la GPU Intel UHD integrada (hasta 8GB compartidos).',
    impactOnI31220P: 'Con 16 GB DDR5, si el Commit supera el 85%, Windows comprime memoria consumiendo CPU en el proceso System.',
    impactOnCs2: 'Alerta preventiva antes de jugar para evitar compresión y paginación en pleno combate.',
    rollbackStrategy: 'Informativo y de auditoría continua.'
  },
  {
    id: '12_windows_services',
    name: '12. Servicios de Windows (SCM / svchost)',
    api: 'advapi32!ChangeServiceConfig',
    subsystem: 'System Services Infrastructure',
    statusOnEvo: 'Prohibido en EVO',
    reversibility: 'Requiere Reinicio',
    riskLevel: 'Alto Riesgo',
    whatItModifies: 'Deshabilitación o detención de servicios nativos de Windows.',
    impactOnI31220P: 'Rompe componentes esenciales (Windows Update, Audio, Store, Game Bar, Red, Seguridad).',
    impactOnCs2: 'Ganancia nula o placebo en hardware moderno; riesgo masivo de inestabilidad y pantalla azul.',
    rollbackStrategy: 'EVO NO toca servicios del sistema por filosofía innegociable de seguridad.'
  },
  {
    id: '13_dpc_isr_analysis',
    name: '13. Análisis de Latencia DPC / ISR',
    api: 'ETW / PresentMon MsBetweenPresents vs RenderComplete',
    subsystem: 'Interrupt Handling & Driver Latency',
    statusOnEvo: 'Auditoría / Solo Lectura',
    reversibility: 'Solo Monitoreo',
    riskLevel: 'Cero Riesgo',
    whatItModifies: 'Inspecciona demoras causadas por controladores de red/audio en modo kernel.',
    impactOnI31220P: 'Permite diagnosticar si los 2 P-Cores están sufriendo interrupciones de drivers defectuosos.',
    impactOnCs2: 'Aísla la causa raíz de stutters cuando no provienen de la tasa de cuadros bruta.',
    rollbackStrategy: 'Diagnóstico pasivo sin alteración del sistema.'
  }
];

// ============================================================================
// EXPORTADOR DE AUDITORÍA TÉCNICA JSON
// ============================================================================

export function exportAuditReportJson(
  telemetry: TelemetryInputs,
  objective: OptimizationObjective,
  score: Evo4DScore,
  welchReport?: WelchComparisonReport
): void {
  const payload = {
    metadata: {
      generator: 'EVO FPS Optimizer v4.0 Master Engineering Release',
      exportTimestamp: new Date().toISOString(),
      platform: 'Windows 11 x64 (Build 26100 / 24H2)',
      targetHardware: 'ASUS MiniPC PN64 / ExpertCenter (Intel Core i3-1220P 2P+8E / Intel UHD 64EU / 16GB DDR5)'
    },
    activeObjective: {
      selected: objective,
      config: OBJECTIVES_CONFIG[objective]
    },
    siliconTopology: {
      cpuModel: 'Intel Core i3-1220P',
      physicalCores: 10,
      logicalThreads: 12,
      pCores: 2,
      eCores: 8,
      cacheSummary: I3_1220P_CACHE_SUMMARY,
      cores: I3_1220P_TOPOLOGY
    },
    telemetrySnapshot: telemetry,
    evo4DPerformanceScore: score,
    multiRunWelchBenchmark: welchReport || 'No multi-run benchmark captured during this session',
    windowsInternalsAuditMatrix: WINDOWS_13_MECHANISMS_AUDIT.map(m => ({
      id: m.id,
      name: m.name,
      status: m.statusOnEvo,
      reversibility: m.reversibility,
      riskLevel: m.riskLevel,
      impactOnI31220P: m.impactOnI31220P
    }))
  };

  const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `EVO_Engineering_Audit_PN64_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
