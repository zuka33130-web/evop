/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FlaskConical, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  Gauge, 
  ShieldAlert, 
  Info, 
  Sliders, 
  ArrowRight, 
  RefreshCw,
  Zap,
  BarChart2,
  FileSpreadsheet,
  Cpu,
  Layers,
  Download,
  Flame,
  ShieldCheck,
  Scale,
  HardDrive,
  SlidersHorizontal
} from 'lucide-react';
import { HardwareProfile } from '../data/optimizerData';
import { 
  BenchmarkComparer, 
  ComparisonResult, 
  FrameTimeAnalyzer, 
  FrameStats,
  RobustStatistics
} from '../utils/statisticalEngine';
import {
  OptimizationObjective,
  OBJECTIVES_CONFIG,
  EvoPerformanceScoreCalculator,
  TelemetryInputs,
  I3_1220P_TOPOLOGY,
  I3_1220P_CACHE_SUMMARY,
  WelchTTestEngine,
  MultiRunSample,
  WelchComparisonReport,
  WINDOWS_13_MECHANISMS_AUDIT,
  exportAuditReportJson
} from '../utils/evoMasterEngine';

interface ScientificLabProps {
  hardware: HardwareProfile;
}

export const ScientificLab: React.FC<ScientificLabProps> = ({ hardware }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'evo_score' | 'silicon_topology' | 'welch_ab' | 'frametimes' | 'audit_13_internals' | 'memory_intel'
  >('evo_score');

  // =========================================================================
  // SUB-TAB 1: EVO PERFORMANCE SCORE 4D & 3 ESCENARIOS DE OBJETIVO
  // =========================================================================
  const [activeObjective, setActiveObjective] = useState<OptimizationObjective>('Gaming');

  // Live simulation telemetry inputs
  const [telemetry, setTelemetry] = useState<TelemetryInputs>({
    cpuUsagePercent: 38,
    ramUsedGb: 7.2,
    ramTotalGb: hardware.ramGB || 16,
    commitUsedGb: 8.9,
    commitLimitGb: 18.5,
    ssdFreePercent: 48,
    runningProcesses: 142,
    runningThreads: 2120,
    currentMhz: 4200,
    maxMhz: 4400,
    mhzLimit: 4400, // powrprof limit
    ramLeakRateMbMin: 8, // dRAM/dt
    schedulerQueueP99Ms: 0.42,
    thermalSensorCalibrated: false // Transparencia epistémica (guardia activa)
  });

  const evoScore = useMemo(() => {
    return EvoPerformanceScoreCalculator.calculate(telemetry, activeObjective);
  }, [telemetry, activeObjective]);

  const loadScorePreset = (preset: 'nominal' | 'throttled' | 'ram_leak' | 'scheduler_jam' | 'commit_exhaustion') => {
    if (preset === 'nominal') {
      setTelemetry({
        cpuUsagePercent: 35,
        ramUsedGb: 6.8,
        ramTotalGb: 16,
        commitUsedGb: 8.2,
        commitLimitGb: 18.5,
        ssdFreePercent: 52,
        runningProcesses: 135,
        runningThreads: 1980,
        currentMhz: 4300,
        maxMhz: 4400,
        mhzLimit: 4400,
        ramLeakRateMbMin: 6,
        schedulerQueueP99Ms: 0.38,
        thermalSensorCalibrated: true
      });
    } else if (preset === 'throttled') {
      setTelemetry({
        cpuUsagePercent: 88,
        ramUsedGb: 9.4,
        ramTotalGb: 16,
        commitUsedGb: 11.2,
        commitLimitGb: 18.5,
        ssdFreePercent: 45,
        runningProcesses: 172,
        runningThreads: 2450,
        currentMhz: 2800,
        maxMhz: 4400,
        mhzLimit: 2900, // Thermal limit reached in ASUS PN64 MiniPC!
        ramLeakRateMbMin: 15,
        schedulerQueueP99Ms: 0.72,
        thermalSensorCalibrated: true
      });
    } else if (preset === 'ram_leak') {
      setTelemetry({
        cpuUsagePercent: 55,
        ramUsedGb: 13.8,
        ramTotalGb: 16,
        commitUsedGb: 16.2,
        commitLimitGb: 18.5,
        ssdFreePercent: 32,
        runningProcesses: 168,
        runningThreads: 2600,
        currentMhz: 4100,
        maxMhz: 4400,
        mhzLimit: 4400,
        ramLeakRateMbMin: 220, // Rapid leak > 180 MB/min
        schedulerQueueP99Ms: 0.88,
        thermalSensorCalibrated: false
      });
    } else if (preset === 'scheduler_jam') {
      setTelemetry({
        cpuUsagePercent: 78,
        ramUsedGb: 10.5,
        ramTotalGb: 16,
        commitUsedGb: 13.0,
        commitLimitGb: 18.5,
        ssdFreePercent: 40,
        runningProcesses: 245,
        runningThreads: 3600,
        currentMhz: 4000,
        maxMhz: 4400,
        mhzLimit: 4400,
        ramLeakRateMbMin: 25,
        schedulerQueueP99Ms: 1.45, // Extreme queue latency
        thermalSensorCalibrated: false
      });
    } else if (preset === 'commit_exhaustion') {
      setTelemetry({
        cpuUsagePercent: 62,
        ramUsedGb: 14.5,
        ramTotalGb: 16,
        commitUsedGb: 17.8,
        commitLimitGb: 18.5, // 96% commit!
        ssdFreePercent: 12,
        runningProcesses: 195,
        runningThreads: 2800,
        currentMhz: 3900,
        maxMhz: 4400,
        mhzLimit: 4400,
        ramLeakRateMbMin: 45,
        schedulerQueueP99Ms: 0.95,
        thermalSensorCalibrated: false
      });
    }
  };

  // =========================================================================
  // SUB-TAB 2: TOPOLOGÍA DE SILICIO INTEL CORE i3-1220P & THROTTLING
  // =========================================================================
  const isThrottling = telemetry.mhzLimit < telemetry.maxMhz;
  const throttleDeficit = Math.max(0, telemetry.maxMhz - telemetry.mhzLimit);

  // =========================================================================
  // SUB-TAB 3: COMPARADOR A/B MULTI-CORRIDA (PRUEBA T DE WELCH & IC 95%)
  // =========================================================================
  const [welchMetric, setWelchMetric] = useState<'onePercentLowFps' | 'averageFps' | 'p99Ms'>('onePercentLowFps');

  // Default multi-run datasets (3 independent runs each)
  const [multiRunsA, setMultiRunsA] = useState<MultiRunSample[]>([
    { runId: 'Run A1 (Stock)', onePercentLowFps: 42.1, averageFps: 78.4, p99Ms: 23.75, stutterCount: 14, durationSeconds: 60 },
    { runId: 'Run A2 (Stock)', onePercentLowFps: 44.5, averageFps: 80.1, p99Ms: 22.47, stutterCount: 12, durationSeconds: 61 },
    { runId: 'Run A3 (Stock)', onePercentLowFps: 41.8, averageFps: 77.9, p99Ms: 23.92, stutterCount: 16, durationSeconds: 59 }
  ]);

  const [multiRunsB, setMultiRunsB] = useState<MultiRunSample[]>([
    { runId: 'Run B1 (EVO V7)', onePercentLowFps: 62.4, averageFps: 91.2, p99Ms: 16.02, stutterCount: 3, durationSeconds: 60 },
    { runId: 'Run B2 (EVO V7)', onePercentLowFps: 64.1, averageFps: 92.5, p99Ms: 15.60, stutterCount: 2, durationSeconds: 60 },
    { runId: 'Run B3 (EVO V7)', onePercentLowFps: 61.8, averageFps: 90.4, p99Ms: 16.18, stutterCount: 4, durationSeconds: 61 }
  ]);

  const welchReport: WelchComparisonReport = useMemo(() => {
    return WelchTTestEngine.compare(multiRunsA, multiRunsB, welchMetric);
  }, [multiRunsA, multiRunsB, welchMetric]);

  const loadWelchPreset = (preset: 'v7_conclusive' | 'pcore_isolation' | 'placebo_noise' | 'thermal_regression' | 'insufficient') => {
    if (preset === 'v7_conclusive') {
      setWelchMetric('onePercentLowFps');
      setMultiRunsA([
        { runId: 'Stock #1', onePercentLowFps: 42.1, averageFps: 78.4, p99Ms: 23.75, stutterCount: 14, durationSeconds: 60 },
        { runId: 'Stock #2', onePercentLowFps: 44.5, averageFps: 80.1, p99Ms: 22.47, stutterCount: 12, durationSeconds: 61 },
        { runId: 'Stock #3', onePercentLowFps: 41.8, averageFps: 77.9, p99Ms: 23.92, stutterCount: 16, durationSeconds: 59 }
      ]);
      setMultiRunsB([
        { runId: 'EVO V7 #1', onePercentLowFps: 62.4, averageFps: 91.2, p99Ms: 16.02, stutterCount: 3, durationSeconds: 60 },
        { runId: 'EVO V7 #2', onePercentLowFps: 64.1, averageFps: 92.5, p99Ms: 15.60, stutterCount: 2, durationSeconds: 60 },
        { runId: 'EVO V7 #3', onePercentLowFps: 61.8, averageFps: 90.4, p99Ms: 16.18, stutterCount: 4, durationSeconds: 61 }
      ]);
    } else if (preset === 'pcore_isolation') {
      setWelchMetric('onePercentLowFps');
      setMultiRunsA([
        { runId: '12T Híbrido #1', onePercentLowFps: 34.2, averageFps: 82.0, p99Ms: 29.2, stutterCount: 22, durationSeconds: 60 },
        { runId: '12T Híbrido #2', onePercentLowFps: 32.8, averageFps: 81.4, p99Ms: 30.5, stutterCount: 25, durationSeconds: 60 },
        { runId: '12T Híbrido #3', onePercentLowFps: 35.1, averageFps: 83.1, p99Ms: 28.5, stutterCount: 19, durationSeconds: 60 }
      ]);
      setMultiRunsB([
        { runId: 'P-Cores CPU Sets #1', onePercentLowFps: 58.4, averageFps: 88.5, p99Ms: 17.1, stutterCount: 4, durationSeconds: 60 },
        { runId: 'P-Cores CPU Sets #2', onePercentLowFps: 60.2, averageFps: 89.1, p99Ms: 16.6, stutterCount: 3, durationSeconds: 60 },
        { runId: 'P-Cores CPU Sets #3', onePercentLowFps: 59.0, averageFps: 87.8, p99Ms: 16.9, stutterCount: 5, durationSeconds: 60 }
      ]);
    } else if (preset === 'placebo_noise') {
      setWelchMetric('averageFps');
      setMultiRunsA([
        { runId: 'Condición A1', onePercentLowFps: 55.2, averageFps: 82.4, p99Ms: 18.1, stutterCount: 5, durationSeconds: 60 },
        { runId: 'Condición A2', onePercentLowFps: 54.1, averageFps: 83.8, p99Ms: 18.5, stutterCount: 6, durationSeconds: 60 },
        { runId: 'Condición A3', onePercentLowFps: 56.0, averageFps: 81.9, p99Ms: 17.8, stutterCount: 4, durationSeconds: 60 }
      ]);
      setMultiRunsB([
        { runId: 'Condición B1', onePercentLowFps: 54.8, averageFps: 82.9, p99Ms: 18.2, stutterCount: 5, durationSeconds: 60 },
        { runId: 'Condición B2', onePercentLowFps: 55.4, averageFps: 83.2, p99Ms: 18.0, stutterCount: 4, durationSeconds: 60 },
        { runId: 'Condición B3', onePercentLowFps: 54.3, averageFps: 82.1, p99Ms: 18.4, stutterCount: 6, durationSeconds: 60 }
      ]);
    } else if (preset === 'thermal_regression') {
      setWelchMetric('onePercentLowFps');
      setMultiRunsA([
        { runId: 'Fresco (Inicio)', onePercentLowFps: 63.5, averageFps: 92.0, p99Ms: 15.7, stutterCount: 3, durationSeconds: 60 },
        { runId: 'Fresco (Min 2)', onePercentLowFps: 62.8, averageFps: 91.4, p99Ms: 15.9, stutterCount: 4, durationSeconds: 60 },
        { runId: 'Fresco (Min 4)', onePercentLowFps: 64.0, averageFps: 92.8, p99Ms: 15.6, stutterCount: 2, durationSeconds: 60 }
      ]);
      setMultiRunsB([
        { runId: 'Caliente (Min 20)', onePercentLowFps: 48.2, averageFps: 76.5, p99Ms: 20.7, stutterCount: 14, durationSeconds: 60 },
        { runId: 'Caliente (Min 25)', onePercentLowFps: 46.5, averageFps: 74.8, p99Ms: 21.5, stutterCount: 18, durationSeconds: 60 },
        { runId: 'Caliente (Min 30)', onePercentLowFps: 47.1, averageFps: 75.2, p99Ms: 21.2, stutterCount: 16, durationSeconds: 60 }
      ]);
    } else if (preset === 'insufficient') {
      setMultiRunsA([
        { runId: 'Corrida Única A', onePercentLowFps: 45.0, averageFps: 80.0, p99Ms: 22.2, stutterCount: 10, durationSeconds: 60 }
      ]);
      setMultiRunsB([
        { runId: 'Corrida Única B', onePercentLowFps: 60.0, averageFps: 90.0, p99Ms: 16.6, stutterCount: 4, durationSeconds: 60 }
      ]);
    }
  };

  // =========================================================================
  // SUB-TAB 4: ANALIZADOR DE FRAMETIMES PRESENTMON
  // =========================================================================
  const generateFrameData = (mode: 'smooth' | 'stutter' | 'short') => {
    if (mode === 'short') {
      // 200 frames only (< 901)
      const frames: number[] = [];
      for (let i = 0; i < 200; i++) {
        frames.push(Number((11.0 + Math.sin(i * 0.1) * 1.5 + (Math.random() * 0.8)).toFixed(2)));
      }
      return frames.join(', ');
    } else if (mode === 'smooth') {
      // 1000 frames stable ~11.1ms (90 FPS)
      const frames: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const jitter = (Math.random() - 0.5) * 1.2;
        const val = 11.1 + jitter;
        frames.push(Number(Math.max(8.0, val).toFixed(2)));
      }
      return frames.join(', ');
    } else {
      // 1000 frames with massive stutters (E-Core dispatching)
      const frames: number[] = [];
      for (let i = 0; i < 1000; i++) {
        let val = 12.0 + (Math.random() - 0.5) * 2.0;
        if (i % 65 === 0) val = 48.0 + Math.random() * 25.0; // 50-70ms hitch
        if (i % 250 === 0) val = 120.0; // 120ms pause
        frames.push(Number(val.toFixed(2)));
      }
      return frames.join(', ');
    }
  };

  const [rawFrameTimes, setRawFrameTimes] = useState<string>(() => generateFrameData('smooth'));
  const [warmupFrames, setWarmupFrames] = useState<number>(30);

  const parsedFrameTimes = useMemo(() => {
    return rawFrameTimes
      .split(/[\s,;\n]+/)
      .map(v => parseFloat(v.trim()))
      .filter(v => !isNaN(v) && isFinite(v) && v > 0);
  }, [rawFrameTimes]);

  const frameStats: FrameStats = useMemo(() => {
    const warmupSeconds = (warmupFrames * 11) / 1000.0;
    return FrameTimeAnalyzer.analyze(parsedFrameTimes, warmupSeconds, 100.0);
  }, [parsedFrameTimes, warmupFrames]);

  // =========================================================================
  // SUB-TAB 5: AUDITORÍA DE 13 MECANISMOS DE WINDOWS INTERNALS
  // =========================================================================
  const [mechanismFilter, setMechanismFilter] = useState<'all' | 'Recomendado' | 'Auditoría / Solo Lectura' | 'Prohibido en EVO'>('all');

  const filteredMechanisms = useMemo(() => {
    if (mechanismFilter === 'all') return WINDOWS_13_MECHANISMS_AUDIT;
    return WINDOWS_13_MECHANISMS_AUDIT.filter(m => m.statusOnEvo === mechanismFilter);
  }, [mechanismFilter]);

  // =========================================================================
  // SUB-TAB 6: DIAGNÓSTICO DE MEMORIA ADAPTATIVO
  // =========================================================================
  const [simAvailableRamGb, setSimAvailableRamGb] = useState<number>(3.8);
  const [simCommitChargePercent, setSimCommitChargePercent] = useState<number>(55);
  const [simHardFaultsSec, setSimHardFaultsSec] = useState<number>(4);

  const memoryThresholdGb = useMemo(() => {
    const tenPercent = ((hardware.ramGB || 16) * 0.10);
    return Math.min(tenPercent, 2.0); // 1.6 GB for 16GB
  }, [hardware.ramGB]);

  const memoryState = useMemo(() => {
    if (simAvailableRamGb < 0.5 && simHardFaultsSec > 50) {
      return {
        state: 'Pressure',
        title: 'Presión Crítica de Memoria (Pressure)',
        color: 'rose',
        action: 'Alerta crítica: Se requiere cerrar navegadores u otras aplicaciones en fondo. El sistema está paginando activamente a disco NVMe.',
        isHarmfulToClean: false
      };
    } else if (simAvailableRamGb < 0.8 && simCommitChargePercent > 85) {
      return {
        state: 'CommitNearLimit',
        title: 'Commit Charge Próximo al Límite (CommitNearLimit)',
        color: 'amber',
        action: 'Límite de memoria comprometida alcanzado. Incrementar el tamaño del archivo de paginación en C: (pagefile.sys gestionado).',
        isHarmfulToClean: false
      };
    } else if (simAvailableRamGb < memoryThresholdGb) {
      return {
        state: 'ReducedHeadroom',
        title: 'Margen Reducido (ReducedHeadroom)',
        color: 'amber',
        action: 'Margen menor al umbral de seguridad (1.6 GB). El juego puede sufrir tirones si carga un mapa pesado como Nuke o Inferno.',
        isHarmfulToClean: true
      };
    } else if (simHardFaultsSec > 30 && simAvailableRamGb >= memoryThresholdGb) {
      return {
        state: 'PagingWithoutShortage',
        title: 'Paginación Anómala sin Escasez (PagingWithoutShortage)',
        color: 'cyan',
        action: 'Hay suficiente RAM disponible, pero se detectan fallos de página duros. Causa habitual: se ejecutó un "limpiador de RAM" agresivo que expulsó recursos.',
        isHarmfulToClean: true
      };
    } else {
      return {
        state: 'Healthy',
        title: 'Memoria Saludable (Healthy)',
        color: 'emerald',
        action: 'Condición ideal de funcionamiento. No intervenir. La RAM libre está siendo usada eficientemente como File Cache por Windows.',
        isHarmfulToClean: true
      };
    }
  }, [simAvailableRamGb, simCommitChargePercent, simHardFaultsSec, memoryThresholdGb]);

  // Export JSON audit handler
  const handleExportAuditJson = () => {
    exportAuditReportJson(telemetry, activeObjective, evoScore, welchReport);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <FlaskConical className="w-4 h-4" />
              <span>LABORATORIO CIENTÍFICO EVO v4.0 MASTER RELEASE</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-400">Sin Placebo · Transparencia Epistémica</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Ingeniería de Rendimiento Real & Diagnóstico Multidimensional
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-3xl leading-relaxed">
              Diseñado para el <strong className="text-white">ASUS MiniPC PN64</strong> (Intel Core i3-1220P 2P+8E, Intel UHD 64EU, 16GB DDR5, Monitor 200 Hz). 
              Aísla variables, evalúa en 4 dimensiones ortogonales y aplica pruebas inferenciales de <strong className="text-white">Welch ($t$-test al 95% de confianza)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
            <button
              onClick={handleExportAuditJson}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer"
              title="Descargar reporte completo en formato JSON estándar"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Auditoría JSON</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-300">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>v4.0 Master</span>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-neutral-800/80 pb-px overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('evo_score')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'evo_score'
                ? 'bg-neutral-800/80 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>1. EVO Performance Score 4D</span>
          </button>

          <button
            onClick={() => setActiveSubTab('silicon_topology')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'silicon_topology'
                ? 'bg-neutral-800/80 text-cyan-400 border-t-2 border-cyan-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. Topología i3-1220P & Throttling</span>
          </button>

          <button
            onClick={() => setActiveSubTab('welch_ab')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'welch_ab'
                ? 'bg-neutral-800/80 text-indigo-400 border-t-2 border-indigo-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>3. Comparador A/B Welch ($K \ge 2$)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('frametimes')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'frametimes'
                ? 'bg-neutral-800/80 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>4. Frametimes PresentMon</span>
          </button>

          <button
            onClick={() => setActiveSubTab('audit_13_internals')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'audit_13_internals'
                ? 'bg-neutral-800/80 text-amber-400 border-t-2 border-amber-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>5. Auditoría 13 Mecanismos Windows</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory_intel')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'memory_intel'
                ? 'bg-neutral-800/80 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>6. Memoria & UMA Compartida</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: EVO PERFORMANCE SCORE 4D */}
      {/* =================================================================== */}
      {activeSubTab === 'evo_score' && (
        <div className="space-y-6">
          {/* Objective Selector Banner */}
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Seleccionar Objetivo del Usuario (Estrategia Adaptativa)
              </div>
              <div className="text-sm text-neutral-300 mt-0.5">
                La ponderación de los 4 vectores cambia según la intención, sin forzar modificaciones destructivas en el sistema.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['EverydayUse', 'Gaming', 'MaxPerformance'] as OptimizationObjective[]).map(obj => {
                const cfg = OBJECTIVES_CONFIG[obj];
                const isSelected = activeObjective === obj;
                return (
                  <button
                    key={obj}
                    onClick={() => setActiveObjective(obj)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    <div>{cfg.name}</div>
                    <div className="text-[10px] font-mono opacity-80">{cfg.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Objective Details Card */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-white">Estrategia Activa:</span>{' '}
              {OBJECTIVES_CONFIG[activeObjective].description}
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400 shrink-0">
              <span>Timer Objetivo: <strong className="text-cyan-400">{OBJECTIVES_CONFIG[activeObjective].targetTimerMs} ms</strong></span>
              <span aria-hidden="true">·</span>
              <span>Ponderación: <strong className="text-emerald-400">{(OBJECTIVES_CONFIG[activeObjective].weights.stability * 100).toFixed(0)}% Est / {(OBJECTIVES_CONFIG[activeObjective].weights.performance * 100).toFixed(0)}% Rend / {(OBJECTIVES_CONFIG[activeObjective].weights.efficiency * 100).toFixed(0)}% Efic / {(OBJECTIVES_CONFIG[activeObjective].weights.health * 100).toFixed(0)}% Sal</strong></span>
            </div>
          </div>

          {/* Composite Score & 4 Orthogonal Vectors */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Global Composite Score */}
            <div className="lg:col-span-1 p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between items-center text-center">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                EVO Score Ponderado
              </div>

              <div className="my-4 relative">
                <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 flex items-center justify-center bg-neutral-950 shadow-inner">
                  <div className="text-3xl font-black text-white font-mono">
                    {evoScore.compositeScore}
                  </div>
                </div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">sobre 100</div>
              </div>

              <div className="w-full">
                <div className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase ${
                  evoScore.compositeScore >= 85 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  evoScore.compositeScore >= 70 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                  evoScore.compositeScore >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {evoScore.compositeScore >= 85 ? 'Excelente Operación' :
                   evoScore.compositeScore >= 70 ? 'Buen Margen' :
                   evoScore.compositeScore >= 50 ? 'Presión Moderada' : 'Riesgo / Congestión'}
                </div>
              </div>
            </div>

            {/* 4 Vectors Cards */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Estabilidad */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Estabilidad (Stability)</span>
                  </div>
                  <span className="font-mono text-base font-bold text-emerald-400">{evoScore.stabilityScore}/100</span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${evoScore.stabilityScore}%` }} />
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
                  {evoScore.stabilityDiagnostic}
                </p>
                <div className="text-[10px] text-neutral-500">
                  Evalúa: Commit charge vs límite, saturación de hilos del sistema y latencia de cola del planificador P99.
                </div>
              </div>

              {/* Rendimiento */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>Rendimiento (Performance)</span>
                  </div>
                  <span className="font-mono text-base font-bold text-cyan-400">{evoScore.performanceScore}/100</span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full transition-all" style={{ width: `${evoScore.performanceScore}%` }} />
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
                  {evoScore.performanceDiagnostic}
                </p>
                <div className="text-[10px] text-neutral-500">
                  Evalúa: Holgura de cómputo CPU, RAM libre para assets y estrangulamiento térmico (powrprof limit).
                </div>
              </div>

              {/* Eficiencia */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Eficiencia (Efficiency)</span>
                  </div>
                  <span className="font-mono text-base font-bold text-indigo-400">{evoScore.efficiencyScore}/100</span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full transition-all" style={{ width: `${evoScore.efficiencyScore}%` }} />
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
                  {evoScore.efficiencyDiagnostic}
                </p>
                <div className="text-[10px] text-neutral-500">
                  Evalúa: Proliferación de procesos (process sprawl) y tasa de crecimiento de memoria (dRAM/dt).
                </div>
              </div>

              {/* Salud */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Salud (Health)</span>
                  </div>
                  <span className="font-mono text-base font-bold text-amber-400">{evoScore.healthScore}/100</span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${evoScore.healthScore}%` }} />
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
                  {evoScore.healthDiagnostic}
                </p>
                <div className="text-[10px] text-neutral-500">
                  Evalúa: Espacio libre para paginación NVMe y activación de la guardia de incertidumbre térmica.
                </div>
              </div>
            </div>
          </div>

          {/* Predictive Diagnostics Banner */}
          {(telemetry.ramLeakRateMbMin > 180 || telemetry.schedulerQueueP99Ms > 0.85 || isThrottling) && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4" />
                <span>Alertas Predictivas del Motor de Diagnóstico en Tiempo Real</span>
              </div>
              <ul className="text-xs space-y-1 list-disc list-inside font-mono">
                {isThrottling && (
                  <li>
                    <strong>Estrangulamiento Térmico/Energético Detectado:</strong> powrprof reporta un límite de frecuencia de {telemetry.mhzLimit} MHz frente al máximo de {telemetry.maxMhz} MHz (-{throttleDeficit} MHz). El disipador del ASUS PN64 o el límite PL1 están restringiendo el silicio.
                  </li>
                )}
                {telemetry.ramLeakRateMbMin > 180 && (
                  <li>
                    <strong>Fuga Acelerada de Memoria:</strong> Tasa de consumo dRAM/dt de +{telemetry.ramLeakRateMbMin.toFixed(0)} MB/min excede el umbral crítico de 180 MB/min. El Commit Charge se agotará en breve.
                  </li>
                )}
                {telemetry.schedulerQueueP99Ms > 0.85 && (
                  <li>
                    <strong>Contención Severa del Planificador:</strong> Latencia P99 de cola de hilos en {telemetry.schedulerQueueP99Ms.toFixed(2)} ms (&gt; 0.85 ms límite). Demasiados hilos compitiendo por los 2 P-Cores del procesador.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Telemetry Simulator Controls */}
          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Simulador de Telemetría Real (ASUS PN64)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-neutral-400 mr-1">Presets de Carga:</span>
                <button
                  onClick={() => loadScorePreset('nominal')}
                  className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded cursor-pointer"
                >
                  Nominal
                </button>
                <button
                  onClick={() => loadScorePreset('throttled')}
                  className="px-2 py-1 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded cursor-pointer"
                >
                  Thermal Throttle
                </button>
                <button
                  onClick={() => loadScorePreset('ram_leak')}
                  className="px-2 py-1 text-[11px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded cursor-pointer"
                >
                  Fuga RAM
                </button>
                <button
                  onClick={() => loadScorePreset('scheduler_jam')}
                  className="px-2 py-1 text-[11px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded cursor-pointer"
                >
                  Contención Hilos
                </button>
                <button
                  onClick={() => loadScorePreset('commit_exhaustion')}
                  className="px-2 py-1 text-[11px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded cursor-pointer"
                >
                  Commit 96%
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* CPU Usage */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Uso CPU Total:</span>
                  <span className="font-mono text-white">{telemetry.cpuUsagePercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={telemetry.cpuUsagePercent}
                  onChange={e => setTelemetry(t => ({ ...t, cpuUsagePercent: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* RAM Used */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>RAM Física Usada:</span>
                  <span className="font-mono text-white">{telemetry.ramUsedGb.toFixed(1)} / 16 GB</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="0.2"
                  value={telemetry.ramUsedGb}
                  onChange={e => setTelemetry(t => ({ ...t, ramUsedGb: Number(e.target.value) }))}
                  className="w-full accent-emerald-400"
                />
              </div>

              {/* Commit Charge */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Commit Usado:</span>
                  <span className="font-mono text-white">{telemetry.commitUsedGb.toFixed(1)} / {telemetry.commitLimitGb.toFixed(1)} GB</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="18.5"
                  step="0.2"
                  value={telemetry.commitUsedGb}
                  onChange={e => setTelemetry(t => ({ ...t, commitUsedGb: Number(e.target.value) }))}
                  className="w-full accent-indigo-400"
                />
              </div>

              {/* powrprof MHz Limit */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Límite Frecuencia (powrprof):</span>
                  <span className={`font-mono font-bold ${isThrottling ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {telemetry.mhzLimit} MHz
                  </span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="4400"
                  step="100"
                  value={telemetry.mhzLimit}
                  onChange={e => setTelemetry(t => ({ ...t, mhzLimit: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>

              {/* dRAM/dt */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Fuga dRAM/dt:</span>
                  <span className={`font-mono ${telemetry.ramLeakRateMbMin > 180 ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>
                    +{telemetry.ramLeakRateMbMin} MB/min
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="10"
                  value={telemetry.ramLeakRateMbMin}
                  onChange={e => setTelemetry(t => ({ ...t, ramLeakRateMbMin: Number(e.target.value) }))}
                  className="w-full accent-rose-400"
                />
              </div>

              {/* Scheduler Queue P99 */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Cola Planificador P99:</span>
                  <span className={`font-mono ${telemetry.schedulerQueueP99Ms > 0.85 ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>
                    {telemetry.schedulerQueueP99Ms.toFixed(2)} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="2.00"
                  step="0.05"
                  value={telemetry.schedulerQueueP99Ms}
                  onChange={e => setTelemetry(t => ({ ...t, schedulerQueueP99Ms: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Running Processes */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Procesos Activos:</span>
                  <span className="font-mono text-white">{telemetry.runningProcesses}</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="300"
                  value={telemetry.runningProcesses}
                  onChange={e => setTelemetry(t => ({ ...t, runningProcesses: Number(e.target.value) }))}
                  className="w-full accent-indigo-400"
                />
              </div>

              {/* Thermal Sensor Calibrated */}
              <div className="flex items-center justify-between pt-4">
                <span className="text-neutral-400">Sensor Ring-0 Térmico:</span>
                <button
                  onClick={() => setTelemetry(t => ({ ...t, thermalSensorCalibrated: !t.thermalSensorCalibrated }))}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer border ${
                    telemetry.thermalSensorCalibrated
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {telemetry.thermalSensorCalibrated ? 'CALIBRADO' : 'INCIERTO (Guardia)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: TOPOLOGÍA DE SILICIO INTEL CORE i3-1220P */}
      {/* =================================================================== */}
      {activeSubTab === 'silicon_topology' && (
        <div className="space-y-6">
          {/* CRITICAL ARCHITECTURAL WARNING BANNER */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Regla Fundamental de Silicio: Por qué NUNCA se debe amputar CPU 0 y CPU 1</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-300 font-sans">
              Muchos optimizadores comerciales ejecutan a ciegas el comando <code className="text-amber-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">AffinityMask & ~0x3</code> asumiendo que Core 0 es exclusivo de interrupciones DPC/ISR del sistema.
              En el <strong className="text-white">Intel Core i3-1220P (Alder Lake-P)</strong>, los núcleos son híbridos: 
              <strong className="text-emerald-400"> solo existen 2 núcleos P Golden Cove (Hilos 0, 1, 2, 3)</strong> y 
              <strong className="text-cyan-400"> 8 núcleos E Gracemont (Hilos 4..11)</strong>. 
              Excluir CPU 0 y 1 destruye el <strong className="text-rose-400">50% de la capacidad de cómputo de alto rendimiento</strong> del equipo. 
              EVO utiliza <strong className="text-emerald-400">CPU Sets (Soft Affinity)</strong> para dirigir procesos de fondo hacia los núcleos E sin aislar el hilo principal de CS2 de los núcleos P.
            </p>
          </div>

          {/* Cache Hierarchy Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">Caché L1 (I/D)</div>
              <div className="text-lg font-bold text-white font-mono mt-1">320 KB + 384 KB</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">32K+48K por P-Core / 32K+32K por E-Core</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">Caché L2 Dedicado/Cluster</div>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-1">{I3_1220P_CACHE_SUMMARY.l2TotalMb} MB Total</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">1.25MB x 2 P-Cores + 2.0MB x 2 clusters E</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">Caché L3 Intel Smart Cache</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{I3_1220P_CACHE_SUMMARY.l3SharedMb} MB Compartido</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Compartido dinámicamente entre los 10 núcleos</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">Sensor Throttling (powrprof)</div>
              <div className={`text-lg font-bold font-mono mt-1 ${isThrottling ? 'text-amber-400' : 'text-emerald-400'}`}>
                {telemetry.mhzLimit} MHz
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {isThrottling ? `Throttling: -${throttleDeficit} MHz límite` : 'Sin estrangulamiento térmico'}
              </div>
            </div>
          </div>

          {/* Core Topology Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Distribución Real de Núcleos e Hilos Lógicos (10 Cores / 12 Threads)</span>
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  2 P-Cores Golden Cove (4.4 GHz Max)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
                  8 E-Cores Gracemont (3.3 GHz Max)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {I3_1220P_TOPOLOGY.map(core => {
                const isPCore = core.type === 'P-Core';
                return (
                  <div
                    key={core.coreIndex}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isPCore
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isPCore ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {core.type} #{core.coreIndex}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {core.architecture}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-neutral-400">
                        {core.baseMhz} - {core.maxTurboMhz} MHz
                      </div>
                    </div>

                    <div className="mt-2 text-xs flex items-center gap-2">
                      <span className="text-neutral-400">Hilos Lógicos:</span>
                      <div className="flex gap-1 font-mono">
                        {core.threads.map(t => (
                          <span
                            key={t}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              isPCore
                                ? 'bg-emerald-500/30 text-white'
                                : 'bg-neutral-800 text-cyan-300'
                            }`}
                          >
                            CPU {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-neutral-400 leading-relaxed font-sans">
                      {core.roleDescription}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: COMPARADOR A/B MULTI-CORRIDA (PRUEBA T DE WELCH) */}
      {/* =================================================================== */}
      {activeSubTab === 'welch_ab' && (
        <div className="space-y-6">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium mr-1">Cargar Presets Multi-Corrida ($K \ge 3$):</span>
            <button
              onClick={() => loadWelchPreset('v7_conclusive')}
              className="px-3 py-1.5 text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-md hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              Stock vs V7 Booster (+45% 1% Lows, Concluyente)
            </button>
            <button
              onClick={() => loadWelchPreset('pcore_isolation')}
              className="px-3 py-1.5 text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-md hover:bg-cyan-500/25 transition-colors cursor-pointer"
            >
              12T vs P-Cores Soft Affinity (+75% 1% Lows)
            </button>
            <button
              onClick={() => loadWelchPreset('placebo_noise')}
              className="px-3 py-1.5 text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-md hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              Tweak Ineficaz / Ruido (IC cruza cero)
            </button>
            <button
              onClick={() => loadWelchPreset('thermal_regression')}
              className="px-3 py-1.5 text-xs bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-md hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              Regresión Térmica tras 20 Minutos
            </button>
            <button
              onClick={() => loadWelchPreset('insufficient')}
              className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              Muestra Insuficiente ($K=1$)
            </button>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center gap-3 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs">
            <span className="text-neutral-400 font-semibold">Métrica de Comparación:</span>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() => setWelchMetric('onePercentLowFps')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  welchMetric === 'onePercentLowFps' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                1% Low FPS (Mayor es mejor)
              </button>
              <button
                onClick={() => setWelchMetric('averageFps')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  welchMetric === 'averageFps' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                FPS Promedio (Mayor es mejor)
              </button>
              <button
                onClick={() => setWelchMetric('p99Ms')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  welchMetric === 'p99Ms' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Frametime P99 ms (Menor es mejor)
              </button>
            </div>
          </div>

          {/* Welch Verdict Card */}
          <div className={`p-5 rounded-2xl border ${
            welchReport.verdict === 'Improvement' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' :
            welchReport.verdict === 'Regression' ? 'bg-rose-950/20 border-rose-500/40 text-rose-200' :
            welchReport.verdict === 'NoChange' ? 'bg-neutral-900 border-neutral-700 text-neutral-300' :
            'bg-amber-950/20 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider">
                  {welchReport.verdict === 'Improvement' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {welchReport.verdict === 'Regression' && <XCircle className="w-4 h-4 text-rose-400" />}
                  {welchReport.verdict === 'NoChange' && <Info className="w-4 h-4 text-neutral-400" />}
                  {welchReport.verdict === 'Inconclusive' && <HelpCircle className="w-4 h-4 text-amber-400" />}
                  <span>Veredicto de Inferencia Estadística de Welch</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {welchReport.headline}
                </h3>
              </div>

              {welchReport.status === 'Conclusive' && (
                <div className="text-right">
                  <div className="text-2xl font-black font-mono">
                    {welchReport.deltaPercent > 0 ? '+' : ''}{welchReport.deltaPercent.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    Δ = {welchReport.deltaAbsolute > 0 ? '+' : ''}{welchReport.deltaAbsolute.toFixed(2)} unidades
                  </div>
                </div>
              )}
            </div>

            {/* Confidence Interval Visualization */}
            {welchReport.status === 'Conclusive' && (
              <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <div className="text-neutral-400">Intervalo de Confianza (95%):</div>
                  <div className="text-white font-bold">[{welchReport.ci95Low.toFixed(2)}, {welchReport.ci95High.toFixed(2)}]</div>
                </div>
                <div>
                  <div className="text-neutral-400">Grados de Libertad (ν):</div>
                  <div className="text-white font-bold">{welchReport.degreesOfFreedom.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Error Estándar (SE_Δ):</div>
                  <div className="text-white font-bold">{welchReport.standardErrorDelta.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Nivel de Significancia (p):</div>
                  <div className="text-white font-bold">p = {welchReport.pValue.toFixed(4)}</div>
                </div>
              </div>
            )}

            {/* Technical notes */}
            <div className="mt-4 space-y-1 text-xs font-mono text-neutral-300">
              {welchReport.technicalDetails.map((note, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-neutral-500">›</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Run Tables for Group A and Group B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Group A */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Grupo A: Condición Línea Base (Stock)
                </div>
                <span className="text-[11px] font-mono text-neutral-400">{multiRunsA.length} Corridas</span>
              </div>

              <div className="space-y-2">
                {multiRunsA.map((run, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between font-mono">
                    <span className="text-neutral-300">{run.runId}</span>
                    <div className="flex items-center gap-3 text-neutral-400">
                      <span>1% Low: <strong className="text-white">{run.onePercentLowFps}</strong></span>
                      <span>Avg: <strong className="text-white">{run.averageFps}</strong></span>
                      <span>P99: <strong className="text-white">{run.p99Ms}ms</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Group B */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Grupo B: Condición Optimizada (EVO V7)
                </div>
                <span className="text-[11px] font-mono text-neutral-400">{multiRunsB.length} Corridas</span>
              </div>

              <div className="space-y-2">
                {multiRunsB.map((run, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between font-mono">
                    <span className="text-neutral-300">{run.runId}</span>
                    <div className="flex items-center gap-3 text-neutral-400">
                      <span>1% Low: <strong className="text-emerald-400">{run.onePercentLowFps}</strong></span>
                      <span>Avg: <strong className="text-emerald-400">{run.averageFps}</strong></span>
                      <span>P99: <strong className="text-emerald-400">{run.p99Ms}ms</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: ANALIZADOR DE FRAMETIMES PRESENTMON */}
      {/* =================================================================== */}
      {activeSubTab === 'frametimes' && (
        <div className="space-y-6">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium mr-1">Cargar Captura PresentMon:</span>
            <button
              onClick={() => setRawFrameTimes(generateFrameData('smooth'))}
              className="px-3 py-1.5 text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-md hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              Captura Fluida (1000 frames @ 90 FPS)
            </button>
            <button
              onClick={() => setRawFrameTimes(generateFrameData('stutter'))}
              className="px-3 py-1.5 text-xs bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-md hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              Stuttering Severo (Picos de E-Core & 120ms hitch)
            </button>
            <button
              onClick={() => setRawFrameTimes(generateFrameData('short'))}
              className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              Captura Corta (200 frames: Guarda Insuficiente)
            </button>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">FPS Promedio</div>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {frameStats.averageFps ? frameStats.averageFps.toFixed(1) : 'N/A'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{frameStats.validFrames} fotogramas válidos</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">1% Low FPS (P99)</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {frameStats.onePercentLowFps ? frameStats.onePercentLowFps.toFixed(1) : 'Incierto'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {frameStats.validFrames >= 901 ? 'Cola ≥ 10 frames verificada' : '< 901 frames (Guarda Activa)'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">P99 Frametime</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
                {frameStats.p99FrameTimeMs ? `${frameStats.p99FrameTimeMs.toFixed(2)} ms` : 'N/A'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Percentil 99 de entrega</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase font-mono">Picos de Stutter</div>
              <div className={`text-2xl font-bold font-mono mt-1 ${frameStats.spikeCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {frameStats.spikeCount}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {frameStats.spikeFraction ? `${(frameStats.spikeFraction * 100).toFixed(1)}% de cuadros` : '0%'}
              </div>
            </div>
          </div>

          {/* Frame Notes */}
          {frameStats.notes.length > 0 && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 space-y-1">
              <div className="text-neutral-400 font-bold uppercase text-[10px]">Anotaciones de Higiene de Captura:</div>
              {frameStats.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-neutral-500">›</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}

          {/* Raw Input Box */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-400 font-semibold uppercase">
              Vector de Tiempos de Fotograma (ms separados por comas o saltos de línea):
            </label>
            <textarea
              rows={4}
              value={rawFrameTimes}
              onChange={e => setRawFrameTimes(e.target.value)}
              className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 font-mono text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 5: AUDITORÍA 13 MECANISMOS WINDOWS INTERNALS */}
      {/* =================================================================== */}
      {activeSubTab === 'audit_13_internals' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-semibold">Filtrar por Veredicto EVO:</span>
              <div className="flex items-center gap-1.5">
                {(['all', 'Recomendado', 'Auditoría / Solo Lectura', 'Prohibido en EVO'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setMechanismFilter(filter)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                      mechanismFilter === filter
                        ? 'bg-neutral-800 text-white font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {filter === 'all' ? 'Todos (13)' : filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-neutral-400 text-[11px] font-mono">
              Objetivo: ASUS PN64 (i3-1220P 2P+8E + Intel UHD)
            </div>
          </div>

          {/* Mechanisms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMechanisms.map(m => {
              const isProhibited = m.statusOnEvo === 'Prohibido en EVO';
              const isRecommended = m.statusOnEvo === 'Recomendado';

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    isProhibited
                      ? 'bg-rose-950/15 border-rose-500/30 text-rose-200'
                      : isRecommended
                      ? 'bg-emerald-950/15 border-emerald-500/30 text-emerald-200'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                        {m.subsystem}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        {m.name}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                      isProhibited ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                      isRecommended ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    }`}>
                      {m.statusOnEvo}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-neutral-400">
                    API: <code className="text-cyan-300 bg-neutral-900 px-1 py-0.5 rounded">{m.api}</code>
                  </div>

                  <div className="text-xs space-y-1.5 font-sans">
                    <p className="text-neutral-300">
                      <strong className="text-neutral-100">Qué modifica:</strong> {m.whatItModifies}
                    </p>
                    <p className="text-neutral-300">
                      <strong className="text-neutral-100">Impacto en i3-1220P:</strong> {m.impactOnI31220P}
                    </p>
                    <p className="text-neutral-300">
                      <strong className="text-neutral-100">Impacto en CS2:</strong> {m.impactOnCs2}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>Reversibilidad: <strong className="text-white">{m.reversibility}</strong></span>
                    <span>Riesgo: <strong className={m.riskLevel === 'Peligroso' ? 'text-rose-400' : 'text-neutral-300'}>{m.riskLevel}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 6: INTELIGENCIA DE MEMORIA & UMA COMPARTIDA */}
      {/* =================================================================== */}
      {activeSubTab === 'memory_intel' && (
        <div className="space-y-6">
          {/* Adaptive Memory State Banner */}
          <div className={`p-5 rounded-2xl border ${
            memoryState.color === 'emerald' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' :
            memoryState.color === 'amber' ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' :
            memoryState.color === 'rose' ? 'bg-rose-950/20 border-rose-500/40 text-rose-200' :
            'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
          }`}>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider">
              {memoryState.color === 'emerald' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <span>Diagnóstico de Memoria UMA (Intel UHD + DDR5)</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {memoryState.title}
            </h3>
            <p className="text-xs sm:text-sm mt-2 leading-relaxed">
              {memoryState.action}
            </p>
          </div>

          {/* Interactive Memory Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
              <div className="flex justify-between text-xs text-neutral-300">
                <span>RAM Física Disponible:</span>
                <span className="font-mono font-bold text-white">{simAvailableRamGb.toFixed(1)} GB</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="8.0"
                step="0.1"
                value={simAvailableRamGb}
                onChange={e => setSimAvailableRamGb(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <div className="text-[10px] text-neutral-500">Umbral de Seguridad: {memoryThresholdGb.toFixed(1)} GB</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
              <div className="flex justify-between text-xs text-neutral-300">
                <span>Commit Charge Total:</span>
                <span className="font-mono font-bold text-white">{simCommitChargePercent}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="98"
                step="1"
                value={simCommitChargePercent}
                onChange={e => setSimCommitChargePercent(Number(e.target.value))}
                className="w-full accent-indigo-400"
              />
              <div className="text-[10px] text-neutral-500">Peligro de compresión: &gt; 85%</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
              <div className="flex justify-between text-xs text-neutral-300">
                <span>Hard Page Faults/seg:</span>
                <span className="font-mono font-bold text-white">{simHardFaultsSec} /s</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="2"
                value={simHardFaultsSec}
                onChange={e => setSimHardFaultsSec(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="text-[10px] text-neutral-500">Lecturas forzadas desde NVMe</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
