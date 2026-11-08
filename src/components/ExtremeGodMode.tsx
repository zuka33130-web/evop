import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  Zap, 
  Terminal, 
  Activity, 
  Sliders, 
  RotateCcw, 
  Copy, 
  Check, 
  Download, 
  AlertTriangle, 
  ShieldAlert, 
  Cpu, 
  Play, 
  Square, 
  FileSpreadsheet, 
  Info, 
  Gauge, 
  TrendingUp, 
  Layers,
  Sparkles,
  HardDrive,
  Monitor,
  Disc,
  PlayCircle
} from 'lucide-react';
import { 
  HardwareProfile, 
  extremeTweaksList, 
  godModeSensorsList, 
  decisionMatrixRules,
  ultraModulesList,
  extendedLaunchOptions
} from '../data/optimizerData';
import { 
  generateExtremeV2Ps1, 
  generateBoosterV2Bat, 
  generateExtremeUndoPs1, 
  generateGodModeMonitorPs1, 
  generateGodModeBat, 
  generateThrottleStopGuideTxt 
} from '../utils/scriptTemplates';
import {
  generateMsiInterruptBat,
  generateKernelCpuUltraBat,
  generateGpuDriverCoreBat,
  generateDirectxRuntimeProBat,
  generateIoStorageSchedulerBat,
  generateStrippingWindowsBat,
  generateMonitoringToolsBat,
  generateCs2EngineProBat,
  generateAutoPreGameBat,
  generateRamDiskGameBat,
  generateIniciarTodoV3Bat,
  generateAutoexecUltraCfg
} from '../utils/ultraScriptTemplates';
import {
  generateRestorePointBat,
  generateOptWindowsBat,
  generateOptGpuIntelBat,
  generateOptRedBat,
  generateOptMemoriaBat,
  generateLimpiarProcesosBat,
  generateConfigCs2Bat,
  generateOptArranqueBat,
  generateTareasMemoriaProBat,
  generateDispositivosCoresBat,
  generatePowerPlanProBat,
  generateAudioInputMouseBat,
  generateSteamDirectxBat,
  generateRegistryUltraBat,
  generateBiosGuidePn64Bat,
  generateRevertirTodoBat
} from '../utils/discreteModulesBat';
import { downloadSingleFile } from '../utils/zipGenerator';

interface ExtremeGodModeProps {
  hardware: HardwareProfile;
}

interface TelemetryRow {
  time: string;
  clk: number;
  cpu: number;
  gpu: number;
  ramFree: number;
  temp: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  throttlingFlag: string;
}

export const ExtremeGodMode: React.FC<ExtremeGodModeProps> = ({ hardware }) => {
  const [subTab, setSubTab] = useState<'fase3_ultra' | 'fase2_extremo' | 'fase3_godmode'>('fase3_ultra');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ultraCategoryFilter, setUltraCategoryFilter] = useState<string>('all');

  // Script code viewer state
  const [selectedScript, setSelectedScript] = useState<string>('iniciar_todo_v3');

  // Simulator state for CS2_GODMODE_MONITOR.ps1
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState<TelemetryRow[]>([]);
  const [simulationSummary, setSimulationSummary] = useState<{
    totalSamples: number;
    avgClk: number;
    maxTemp: number;
    throttlingEvents: number;
    gpuAvg: number;
    verdict: string;
    action: string;
  } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Map script ID to data
  const getScriptData = (id: string) => {
    switch (id) {
      case 'iniciar_todo_v3':
        return {
          filename: 'INICIAR_TODO_V3.bat',
          code: generateIniciarTodoV3Bat(),
          type: 'Batch Orquestador Maestro',
          badge: 'Ejecuta Módulos 1 al 25'
        };
      case 'auto_pre_game':
        return {
          filename: '24_AUTO_PRE_GAME.bat',
          code: generateAutoPreGameBat(),
          type: 'Batch Pre-Game',
          badge: 'Limpiar + Optimizar + Lanzar'
        };
      case 'mod_16':
        return {
          filename: '16_INTERRUPT_MSI_MODE.bat',
          code: generateMsiInterruptBat(),
          type: 'Batch & PowerShell',
          badge: 'MSI Mode + IRQ P-Cores'
        };
      case 'mod_17':
        return {
          filename: '17_KERNEL_CPU_ULTRA.bat',
          code: generateKernelCpuUltraBat(),
          type: 'Batch & Registro',
          badge: 'Kernel Memory & Mitigaciones OFF'
        };
      case 'mod_18':
        return {
          filename: '18_GPU_DRIVER_CORE.bat',
          code: generateGpuDriverCoreBat(),
          type: 'Batch & Registro',
          badge: 'Intel UHD/Xe Driver Core'
        };
      case 'mod_19':
        return {
          filename: '19_DIRECTX_RUNTIME_PRO.bat',
          code: generateDirectxRuntimeProBat(),
          type: 'Batch & Registro',
          badge: 'DirectX 11/12 & Vulkan ICD'
        };
      case 'mod_20':
        return {
          filename: '20_IO_STORAGE_SCHEDULER.bat',
          code: generateIoStorageSchedulerBat(),
          type: 'Batch & FSUtil',
          badge: 'NVMe PS0 & I/O Priority 3'
        };
      case 'mod_21':
        return {
          filename: '21_STRIPPING_WINDOWS.bat',
          code: generateStrippingWindowsBat(),
          type: 'Batch & PowerShell',
          badge: '40+ UWP OFF & OneDrive Kill'
        };
      case 'mod_22':
        return {
          filename: '22_MONITORING_TOOLS.bat',
          code: generateMonitoringToolsBat(),
          type: 'Batch Generador',
          badge: 'PERF & DPC Checkers'
        };
      case 'mod_23':
        return {
          filename: '23_CS2_ENGINE_PRO.bat',
          code: generateCs2EngineProBat(),
          type: 'Batch & CFG',
          badge: 'Source 2 Engine Pro'
        };
      case 'autoexec_ultra':
        return {
          filename: 'autoexec_ULTRA.cfg',
          code: generateAutoexecUltraCfg(),
          type: 'Source 2 CFG',
          badge: '200+ Comandos Competitivos'
        };
      case 'mod_25':
        return {
          filename: '25_RAM_DISK_GAME.bat',
          code: generateRamDiskGameBat(),
          type: 'Batch & Guía',
          badge: 'RAM Disk 2GB Shaders'
        };
      case 'extreme_v2':
        return {
          filename: 'EXTREME_v2.ps1',
          code: generateExtremeV2Ps1(),
          type: 'PowerShell',
          badge: 'Fase 2 Extrema'
        };
      case 'booster_v2':
        return {
          filename: 'CS2_Booster_v2.bat',
          code: generateBoosterV2Bat(),
          type: 'Batch (Auto-Restore)',
          badge: 'Lanzador con Retorno Automático'
        };
      case 'extreme_undo':
        return {
          filename: 'EXTREME_Undo.ps1',
          code: generateExtremeUndoPs1(),
          type: 'PowerShell Reversor',
          badge: 'Deshacer 100%'
        };
      case 'god_mode_bat':
        return {
          filename: 'GOD_MODE.bat',
          code: generateGodModeBat(),
          type: 'Batch Orquestador',
          badge: 'Fase 3 God Mode'
        };
      case 'monitor_ps1':
        return {
          filename: 'CS2_GODMODE_MONITOR.ps1',
          code: generateGodModeMonitorPs1(),
          type: 'PowerShell Telemetría',
          badge: 'Monitor 1s con Color'
        };
      case 'throttlestop_txt':
        return {
          filename: 'THROTTLESTOP_GUIA.txt',
          code: generateThrottleStopGuideTxt(),
          type: 'Guía Técnica de Potencia',
          badge: 'Calibración TPL 28W'
        };
      case 'revertir_todo':
        return {
          filename: 'REVERTIR_TODO.bat',
          code: generateRevertirTodoBat(),
          type: 'Batch Reversor Total',
          badge: 'Restaurar Valores Originales'
        };
      case 'mod_1':
        return {
          filename: '1_CREAR_PUNTO_RESTAURACION.bat',
          code: generateRestorePointBat(),
          type: 'Batch Módulo 1',
          badge: 'Punto de Restauración'
        };
      case 'mod_2':
        return {
          filename: '2_OPTIMIZAR_WINDOWS.bat',
          code: generateOptWindowsBat(),
          type: 'Batch Módulo 2',
          badge: 'Windows GameDVR & MPO'
        };
      case 'mod_3':
        return {
          filename: '3_OPTIMIZAR_GPU_INTEL.bat',
          code: generateOptGpuIntelBat(),
          type: 'Batch Módulo 3',
          badge: 'Intel UHD DVMT 1024'
        };
      case 'mod_4':
        return {
          filename: '4_OPTIMIZAR_RED.bat',
          code: generateOptRedBat(),
          type: 'Batch Módulo 4',
          badge: 'Red & TCPNoDelay'
        };
      case 'mod_5':
        return {
          filename: '5_OPTIMIZAR_MEMORIA.bat',
          code: generateOptMemoriaBat(),
          type: 'Batch Módulo 5',
          badge: 'Pagefile 8GB & PageCombining OFF'
        };
      case 'mod_6':
        return {
          filename: '6_LIMPIAR_PROCESOS.bat',
          code: generateLimpiarProcesosBat(),
          type: 'Batch Módulo 6',
          badge: 'Limpieza de Procesos'
        };
      case 'mod_7':
        return {
          filename: '7_CONFIG_CS2.bat',
          code: generateConfigCs2Bat(),
          type: 'Batch Módulo 7',
          badge: 'Instalador Autoexec CS2'
        };
      case 'mod_8':
        return {
          filename: '8_OPTIMIZAR_ARRANQUE.bat',
          code: generateOptArranqueBat(),
          type: 'Batch Módulo 8',
          badge: 'Temporizadores TSC 4.4GHz'
        };
      case 'mod_9':
        return {
          filename: '9_TAREAS_MEMORIA_PRO.bat',
          code: generateTareasMemoriaProBat(),
          type: 'Batch Módulo 9',
          badge: 'Tareas Telemetría OFF'
        };
      case 'mod_10':
        return {
          filename: '10_DISPOSITIVOS_CORES.bat',
          code: generateDispositivosCoresBat(),
          type: 'Batch Módulo 10',
          badge: 'Afinidad P-Cores Mask 15'
        };
      case 'mod_11':
        return {
          filename: '11_POWER_PLAN_PRO.bat',
          code: generatePowerPlanProBat(),
          type: 'Batch Módulo 11',
          badge: 'Plan Ultimate 100%'
        };
      case 'mod_12':
        return {
          filename: '12_AUDIO_INPUT_MOUSE.bat',
          code: generateAudioInputMouseBat(),
          type: 'Batch Módulo 12',
          badge: 'Aceleración Ratón OFF'
        };
      case 'mod_13':
        return {
          filename: '13_STEAM_DIRECTX.bat',
          code: generateSteamDirectxBat(),
          type: 'Batch Módulo 13',
          badge: 'Steam Overlay & DX Debug'
        };
      case 'mod_14':
        return {
          filename: '14_REGISTRY_ULTRA.bat',
          code: generateRegistryUltraBat(),
          type: 'Batch Módulo 14',
          badge: '90 Tweaks de Registro V6'
        };
      case 'mod_15':
        return {
          filename: '15_BIOS_GUIDE_PN64.bat',
          code: generateBiosGuidePn64Bat(),
          type: 'Batch Módulo 15',
          badge: 'Guía BIOS ASUS F2'
        };
      default:
        return {
          filename: 'INICIAR_TODO_V3.bat',
          code: generateIniciarTodoV3Bat(),
          type: 'Batch Maestro',
          badge: 'Suite Completa V3'
        };
    }
  };

  // Telemetry Simulator Interval
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSimulating) {
      timer = setInterval(() => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];

        const clkVariation = Math.floor(Math.random() * 14) - 5;
        const clk = Math.max(82, Math.min(108, 101 + clkVariation));
        const cpu = Math.floor(Math.random() * 22) + 48;
        const gpu = Math.floor(Math.random() * 6) + 95;
        const ramFree = Math.floor(Math.random() * 800) + 7200;
        const tempSpike = Math.random() > 0.85 ? Math.floor(Math.random() * 8) : 0;
        const temp = 80 + Math.floor(Math.random() * 6) + tempSpike;

        let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        let throttlingFlag = 'NO';

        if (temp >= 94 || clk < 90) {
          status = 'RED';
          throttlingFlag = temp >= 94 ? 'T-THROT' : 'P-THROT';
        } else if (temp >= 85 || clk < 100) {
          status = 'YELLOW';
          throttlingFlag = 'MARGINAL';
        }

        const newRow: TelemetryRow = {
          time: timeStr,
          clk,
          cpu,
          gpu,
          ramFree,
          temp,
          status,
          throttlingFlag
        };

        setSimulatedLogs(prev => {
          const next = [...prev, newRow];
          return next.slice(-60);
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isSimulating]);

  useEffect(() => {
    if (isSimulating && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatedLogs, isSimulating]);

  const handleStopSimulation = () => {
    setIsSimulating(false);
    if (simulatedLogs.length === 0) return;

    const avgClk = Math.round(simulatedLogs.reduce((acc, r) => acc + r.clk, 0) / simulatedLogs.length);
    const maxTemp = Math.max(...simulatedLogs.map(r => r.temp));
    const throttlingEvents = simulatedLogs.filter(r => r.status === 'RED').length;
    const gpuAvg = Math.round(simulatedLogs.reduce((acc, r) => acc + r.gpu, 0) / simulatedLogs.length);

    let verdict = 'Excelente: Frecuencias sostenidas al 100% sin estrangulamiento térmico.';
    let action = 'El clamp de 28W en ThrottleStop y el modo IDLEDISABLE 1 mantienen los P-Cores a 4.4GHz estables.';

    if (throttlingEvents > 2 || maxTemp >= 95) {
      verdict = 'Alerta de Thermal Throttling: La temperatura superó los 94°C.';
      action = 'Reduce PL1 a 25W en ThrottleStop y verifica perfil Full Speed en BIOS/MyASUS.';
    } else if (avgClk < 95) {
      verdict = 'Power Throttling Leve: La CPU promedió <95% de su reloj máximo.';
      action = 'Activa EPP = 0 en ThrottleStop y confirma que cs2.exe tiene afinidad a los núcleos 0-3.';
    }

    setSimulationSummary({
      totalSamples: simulatedLogs.length,
      avgClk,
      maxTemp,
      throttlingEvents,
      gpuAvg,
      verdict,
      action
    });
  };

  const handleExportCsv = () => {
    if (simulatedLogs.length === 0) return;
    const header = 'TIMESTAMP,CLK_PCT,CPU_UTIL_PCT,GPU_UTIL_PCT,RAM_FREE_MB,TEMP_C,THROTTLE_FLAG\n';
    const rows = simulatedLogs.map(r => 
      `${r.time},${r.clk},${r.cpu},${r.gpu},${r.ramFree},${r.temp},${r.throttlingFlag}`
    ).join('\n');
    downloadSingleFile('CS2_GODMODE_TELEMETRIA_SIMULADA.csv', header + rows);
  };

  const currentScript = getScriptData(selectedScript);

  const filteredUltraModules = ultraModulesList.filter(mod => {
    if (ultraCategoryFilter === 'all') return true;
    return mod.category === ultraCategoryFilter;
  });

  return (
    <div className="space-y-8">
      {/* Top Banner: Mode switcher */}
      <div className="relative rounded-2xl bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 p-6 sm:p-8 overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-400 mb-2">
            <Flame className="w-4 h-4 fill-rose-400/20" />
            <span>NIVEL ULTRA AGRESIVO — 25 MÓDULOS & 500+ TWEAKS</span>
            <span aria-hidden="true">·</span>
            <span>ASUS PN64 i3-1220P · Intel UHD 64EU / Iris Xe</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Fase 2, Fase 3 Ultra & God Mode: Potencia Sostenida y Kernel Agresivo
          </h2>

          <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
            Suite completa de ingeniería de rendimiento para CS2. Desde la afinidad de interrupciones IRQ de hardware (GPU+USB a CPU 0) y supresión de mitigaciones del kernel, hasta el clamp de potencia PL1 a 28W en ThrottleStop, el stripping masivo de Windows y el lanzador pre-juego todo en uno.
          </p>

          {/* Sub Tab Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => setSubTab('fase3_ultra')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                subTab === 'fase3_ultra'
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20 border border-rose-400'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Fase 3: Modo Ultra Agresivo (Módulos 16-25)</span>
            </button>

            <button
              onClick={() => setSubTab('fase3_godmode')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                subTab === 'fase3_godmode'
                  ? 'bg-emerald-500 text-neutral-950 shadow-sm shadow-emerald-500/20 border border-emerald-400'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Fase 3: God Mode (ThrottleStop & Telemetría)</span>
            </button>

            <button
              onClick={() => setSubTab('fase2_extremo')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                subTab === 'fase2_extremo'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm shadow-amber-500/20 border border-amber-400'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Fase 2: Modo Extremo (10 Tweaks Base)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 0: FASE 3 - MODO ULTRA AGRESIVO (Módulos 16 al 25) */}
      {/* ========================================================================= */}
      {subTab === 'fase3_ultra' && (
        <div className="space-y-8">
          {/* Hero Banner: Orchestrator & Auto-Pre-Game */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 to-neutral-900 border border-rose-500/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                    SCRIPT MAESTRO V3
                  </span>
                  <Flame className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">INICIAR_TODO_V3.bat</h3>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Ejecuta en secuencia perfecta los <strong className="text-white">25 módulos y más de 500 optimizaciones</strong>. Crea automáticamente un punto de restauración del sistema antes de comenzar y ofrece reinicio automático.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-rose-900/40">
                <button
                  onClick={() => {
                    setSelectedScript('iniciar_todo_v3');
                    copyToClipboard(generateIniciarTodoV3Bat(), 'card_iniciar_v3');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-colors"
                >
                  {copiedId === 'card_iniciar_v3' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'card_iniciar_v3' ? '¡Copiado!' : 'Copiar Script'}</span>
                </button>
                <button
                  onClick={() => downloadSingleFile('INICIAR_TODO_V3.bat', generateIniciarTodoV3Bat())}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-lg transition-colors"
                  title="Descargar INICIAR_TODO_V3.bat"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-neutral-900 border border-emerald-500/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    USO DIARIO ANTES DE JUGAR
                  </span>
                  <PlayCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">24_AUTO_PRE_GAME.bat</h3>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Tu lanzador diario personal: cierra 20 procesos invasivos (Chrome, Discord, Spotify), vacía memoria RAM, activa temporizador a 0.5ms, energía máxima y <strong className="text-emerald-300">lanza CS2 automáticamente</strong> con los mejores flags.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-emerald-900/40">
                <button
                  onClick={() => {
                    setSelectedScript('auto_pre_game');
                    copyToClipboard(generateAutoPreGameBat(), 'card_pregame');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-neutral-950 rounded-lg transition-colors"
                >
                  {copiedId === 'card_pregame' ? <Check className="w-3.5 h-3.5 text-neutral-950" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'card_pregame' ? '¡Copiado!' : 'Copiar Lanzador'}</span>
                </button>
                <button
                  onClick={() => downloadSingleFile('24_AUTO_PRE_GAME.bat', generateAutoPreGameBat())}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-lg transition-colors"
                  title="Descargar 24_AUTO_PRE_GAME.bat"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* IRQ Affinity Map Visualization (Archivo 16) */}
          <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Mapa de Afinidad de Interrupciones IRQ de Hardware (Archivo 16)</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                -5 a -20ms de Input Lag
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              En lugar de permitir que Windows interrumpa aleatoriamente cualquier núcleo, el módulo 16 asigna cada dispositivo de alta velocidad a un hilo dedicado de los P-Cores del i3-1220P para evitar colisiones:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-neutral-950/80 border border-emerald-500/30 rounded-xl">
                <div className="text-[11px] font-mono text-emerald-400 font-bold mb-1">CPU 0 (P-Core 0)</div>
                <div className="text-xs font-bold text-white">GPU Intel + USB / Ratón</div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Máxima prioridad de refresco para el cursor del ratón y el pipeline gráfico del juego sin compartir cola.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl">
                <div className="text-[11px] font-mono text-cyan-400 font-bold mb-1">CPU 1 (P-Core 0 HT)</div>
                <div className="text-xs font-bold text-white">Red (Ethernet / WiFi 6E)</div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Aislado de la entrada del ratón. Los paquetes de red de 128 tick no saturan la respuesta física del puntero.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl">
                <div className="text-[11px] font-mono text-amber-400 font-bold mb-1">CPU 2 (P-Core 1)</div>
                <div className="text-xs font-bold text-white">SSD NVMe PCIe 4.0</div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Las lecturas continuas de modelos y texturas de mapas de CS2 se procesan en un canal de bus separado.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl">
                <div className="text-[11px] font-mono text-indigo-400 font-bold mb-1">CPU 3 a 11</div>
                <div className="text-xs font-bold text-white">Audio + 8 E-Cores</div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Audio Realtek y los 8 núcleos de eficiencia E-Cores se encargan del sistema operativo y tareas de fondo.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Extended Launch Options (Archivo 23) */}
          <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>3 Variantes de Parámetros de Lanzamiento de Steam (Archivo 23)</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                Copiar y pegar en Propiedades de CS2 en Steam
              </span>
            </div>

            <div className="space-y-3">
              {extendedLaunchOptions.map((opt) => (
                <div key={opt.id} className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{opt.label}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      {opt.badge}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {opt.description}
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <code className="text-[11px] font-mono text-neutral-300 bg-neutral-900 p-2 rounded-lg border border-neutral-800/90 truncate flex-1 select-all">
                      {opt.params}
                    </code>
                    <button
                      onClick={() => copyToClipboard(opt.params, opt.id)}
                      className="px-3 py-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {copiedId === opt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === opt.id ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 10 Ultra Modules Grid (Archivos 16 al 25) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                <span>Desglose de los 10 Módulos Ultra Agresivos (16 al 25)</span>
              </h3>

              {/* Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs no-scrollbar">
                {[
                  { id: 'all', label: 'Todos (10)' },
                  { id: 'Interrupts & Kernel', label: 'Interrupts & Kernel' },
                  { id: 'GPU & DirectX', label: 'GPU & DirectX' },
                  { id: 'Storage & Sistema', label: 'Storage & Sistema' },
                  { id: 'Juego & Engine', label: 'Juego & Engine' },
                  { id: 'Herramientas', label: 'Herramientas' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setUltraCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      ultraCategoryFilter === cat.id
                        ? 'bg-neutral-800 text-rose-300 border border-neutral-700 font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUltraModules.map((mod) => (
                <div 
                  key={mod.id}
                  className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-rose-300 font-semibold border border-neutral-700">
                        {mod.filename}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                        {mod.badge}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mt-1">
                      {mod.title}
                    </h4>

                    <div className="text-xs text-neutral-300 mt-2 leading-relaxed">
                      {mod.description}
                    </div>

                    <div className="mt-3 p-3 bg-neutral-950/70 rounded-xl border border-neutral-800/80 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                        Ajustes Clave:
                      </div>
                      <ul className="text-[11px] text-neutral-300 space-y-1">
                        {mod.keyTweaks.map((tweak, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span>{tweak}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-400">
                      Impacto: <strong className="text-neutral-200">{mod.impact}</strong>
                    </span>

                    <button
                      onClick={() => {
                        const targetKey = mod.num === 16 ? 'mod_16'
                          : mod.num === 17 ? 'mod_17'
                          : mod.num === 18 ? 'mod_18'
                          : mod.num === 19 ? 'mod_19'
                          : mod.num === 20 ? 'mod_20'
                          : mod.num === 21 ? 'mod_21'
                          : mod.num === 22 ? 'mod_22'
                          : mod.num === 23 ? 'mod_23'
                          : mod.num === 24 ? 'auto_pre_game'
                          : 'mod_25';
                        setSelectedScript(targetKey);
                        const scriptContent = getScriptData(targetKey).code;
                        copyToClipboard(scriptContent, `mod_copy_${mod.id}`);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      {copiedId === `mod_copy_${mod.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === `mod_copy_${mod.id}` ? 'Copiado' : 'Ver y Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: FASE 2 - MODO EXTREMO */}
      {/* ========================================================================= */}
      {subTab === 'fase2_extremo' && (
        <div className="space-y-8">
          {/* Warning banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
              <strong className="text-amber-300 font-semibold block mb-0.5">
                Aviso de Modo Extremo (Agresivo pero 100% Reversible)
              </strong>
              Los ajustes de Fase 2 incluyen desactivación de mitigaciones de canal lateral (Spectre/Meltdown) para exprimir +1-3% de IPC puro en Alder Lake, fijación de prioridad alta en IFEO nativo y bloqueo de estados de reposo de CPU (<code className="text-amber-300 font-mono">IDLEDISABLE 1</code>). Para su seguridad, incluimos el script de restauración completa <code className="text-white font-mono">EXTREME_Undo.ps1</code>.
            </div>
          </div>

          {/* 3 Main Action Scripts for Fase 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                    PowerShell
                  </span>
                  <Flame className="w-4 h-4 text-rose-400" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono">EXTREME_v2.ps1</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Aplica los 10 tweaks extremos de sistema: mitigaciones OFF, IFEO Prioridad 3 fija para cs2.exe, PageCombining OFF, MSI Mode y 8GB pagefile estática.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800/80">
                <button
                  onClick={() => {
                    setSelectedScript('extreme_v2');
                    copyToClipboard(generateExtremeV2Ps1(), 'card_ext_v2');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                >
                  {copiedId === 'card_ext_v2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'card_ext_v2' ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => downloadSingleFile('EXTREME_v2.ps1', generateExtremeV2Ps1())}
                  className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-md transition-colors"
                  title="Descargar EXTREME_v2.ps1"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Batch Auto-Restore
                  </span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono">CS2_Booster_v2.bat</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Lanzador interactivo de sesión de juego: mata Explorer, apaga 30 servicios, activa IDLEDISABLE 1 y al pulsar cualquier tecla tras jugar, ¡restaura todo automáticamente!
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800/80">
                <button
                  onClick={() => {
                    setSelectedScript('booster_v2');
                    copyToClipboard(generateBoosterV2Bat(), 'card_booster_v2');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                >
                  {copiedId === 'card_booster_v2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'card_booster_v2' ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => downloadSingleFile('CS2_Booster_v2.bat', generateBoosterV2Bat())}
                  className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-md transition-colors"
                  title="Descargar CS2_Booster_v2.bat"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Reversor Quirúrgico
                  </span>
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono">EXTREME_Undo.ps1</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Restaura el sistema al estado seguro 100%: reactiva Spectre/Meltdown, borra prioridad IFEO, reactiva PageCombining y reestablece el pagefile de Windows.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800/80">
                <button
                  onClick={() => {
                    setSelectedScript('extreme_undo');
                    copyToClipboard(generateExtremeUndoPs1(), 'card_undo');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                >
                  {copiedId === 'card_undo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'card_undo' ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => downloadSingleFile('EXTREME_Undo.ps1', generateExtremeUndoPs1())}
                  className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-md transition-colors"
                  title="Descargar EXTREME_Undo.ps1"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 10 Extreme Tweaks List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                <span>Desglose de los 10 Tweaks de la Fase Extrema</span>
              </h3>
              <span className="text-xs text-neutral-400">
                Afinados para CPU Intel 12th Gen Alder Lake i3-1220P
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {extremeTweaksList.map((tweak) => (
                <div 
                  key={tweak.id}
                  className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-white">{tweak.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-rose-300 border border-neutral-700">
                        {tweak.phase}
                      </span>
                    </div>

                    <div className="text-[11px] text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{tweak.impact}</span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed mt-1.5">
                      {tweak.whyItWorks}
                    </p>

                    <div className="text-[11px] text-neutral-400 mt-2 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80">
                      <span className="text-amber-400 font-medium">Nota de seguridad: </span>
                      {tweak.riskNotice}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                    <code className="text-[10px] font-mono text-neutral-400 truncate flex-1">
                      {tweak.commandSnippet}
                    </code>
                    <button
                      onClick={() => copyToClipboard(tweak.commandSnippet, tweak.id)}
                      className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded flex items-center gap-1 shrink-0"
                    >
                      {copiedId === tweak.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === tweak.id ? 'Copiado' : 'Comando'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test de Afinidad A/B Guide */}
          <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Protocolo de Prueba A/B: Afinidad P-Cores vs Windows Thread Director</span>
            </h3>

            <p className="text-xs text-neutral-300 leading-relaxed">
              El Core i3-1220P tiene <strong className="text-white">2 P-Cores (4 hilos a 4.4GHz)</strong> y <strong className="text-white">8 E-Cores (8 hilos a 3.3GHz)</strong>. Aunque Steam reconozca 12 hilos, CS2 sufre micro-parones catastróficos cuando el motor de audio o cálculo de físicas se despacha a los núcleos E. Puedes verificar la diferencia ejecutando este test:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-lg">
                <div className="text-[11px] font-mono text-neutral-400 font-bold mb-1">OPCIÓN A: Stock</div>
                <div className="text-xs font-semibold text-neutral-200">12 Hilos Libres</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Windows decide los hilos. Tirones frecuentes (1% Low cae a 22 FPS cuando un hilo de renderizado migra a un E-Core).
                </div>
              </div>

              <div className="p-3.5 bg-neutral-950/80 border border-emerald-500/40 rounded-lg">
                <div className="text-[11px] font-mono text-emerald-400 font-bold mb-1">OPCIÓN B (Recomendada)</div>
                <div className="text-xs font-semibold text-emerald-300">P-Cores Aislados (Mask 15)</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  CS2 corre exclusivamente en los 4 hilos rápidos (0, 1, 2, 3). Los 8 E-Cores quedan para el sistema. 1% Low sube a 64+ FPS.
                </div>
              </div>

              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-lg">
                <div className="text-[11px] font-mono text-cyan-400 font-bold mb-1">OPCIÓN C: Steam Launch</div>
                <div className="text-xs font-semibold text-neutral-200">Parámetro -threads 8</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Obliga al motor Source 2 a reservar hilos principales de render en los núcleos 0-3 y limita la sobrecarga de sincronización de subprocesos.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FASE 3 - GOD MODE (ThrottleStop & Telemetría) */}
      {/* ========================================================================= */}
      {subTab === 'fase3_godmode' && (
        <div className="space-y-8">
          {/* Header Explanation: The Mini-PC Paradox */}
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Gauge className="w-4 h-4" />
              <span>LA PARADOJA TÉRMICA DEL MINI PC ASUS PN64</span>
            </div>

            <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
              En mini PCs de chasis ultracompacto (120 x 130 x 58 mm), el disipador térmico solo puede disipar de manera continua entre <strong className="text-emerald-400">25W y 30W</strong>. 
              Si dejas que la BIOS active PL2 a 64W de forma descontrolada:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <div className="text-xs font-bold text-rose-300 mb-1">Sin Calibrar (Turbos Desbocados a 45W+)</div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  La CPU alcanza 98°C en 15 segundos. Se activa el <strong className="text-white">Thermal Throttling</strong> del MSR, reduciendo el reloj abruptamente de 4.4 GHz a 2.1 GHz durante 4 segundos. Resultado: la pantalla se congela en medio de un tiroteo y el 1% Low cae a 18 FPS.
                </p>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs font-bold text-emerald-300 mb-1">God Mode (PL1 Clamp a 28W + EPP=0)</div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Fijar el límite de potencia continua en 28W permite al disipador mantener 82-86°C estables sin tocar jamás los 95°C de corte. El procesador sostiene su reloj óptimo sin fluctuar jamás, triplicando la estabilidad de fotogramas mínimos.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Live Monitor Simulator */}
          <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Simulador Interactivo de CS2_GODMODE_MONITOR.ps1</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Muestra la lectura segundo a segundo igual que la ventana de PowerShell con códigos de color de alerta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isSimulating ? (
                  <button
                    onClick={() => {
                      setSimulationSummary(null);
                      setIsSimulating(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-neutral-950 rounded-lg transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Monitoreo (1s)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopSimulation}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Detener y Analizar Sesión</span>
                  </button>
                )}

                {simulatedLogs.length > 0 && (
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportar CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Metrics Header Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-neutral-950/60 border-b border-neutral-800/80 text-xs font-mono">
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">RELOJ CPU (CLK)</span>
                <span className="text-sm font-bold text-emerald-400">
                  {simulatedLogs.length > 0 ? `${simulatedLogs[simulatedLogs.length - 1].clk}%` : '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">USO CPU</span>
                <span className="text-sm font-bold text-cyan-400">
                  {simulatedLogs.length > 0 ? `${simulatedLogs[simulatedLogs.length - 1].cpu}%` : '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">USO GPU 3D</span>
                <span className="text-sm font-bold text-amber-400">
                  {simulatedLogs.length > 0 ? `${simulatedLogs[simulatedLogs.length - 1].gpu}%` : '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">RAM LIBRE</span>
                <span className="text-sm font-bold text-indigo-400">
                  {simulatedLogs.length > 0 ? `${simulatedLogs[simulatedLogs.length - 1].ramFree} MB` : '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800 col-span-2 sm:col-span-1">
                <span className="text-neutral-400 block text-[10px]">TEMP PAQUETE</span>
                <span className={`text-sm font-bold ${
                  simulatedLogs.length > 0 && simulatedLogs[simulatedLogs.length - 1].temp >= 92 
                    ? 'text-rose-400' 
                    : simulatedLogs.length > 0 && simulatedLogs[simulatedLogs.length - 1].temp >= 85
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {simulatedLogs.length > 0 ? `${simulatedLogs[simulatedLogs.length - 1].temp}°C` : '--'}
                </span>
              </div>
            </div>

            {/* Console Log Terminal Window */}
            <div className="bg-neutral-950 p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
              {simulatedLogs.length === 0 ? (
                <div className="text-neutral-500 py-8 text-center">
                  Pulsa "Iniciar Monitoreo (1s)" para simular la telemetría en tiempo real de tu partida en el PN64.
                </div>
              ) : (
                simulatedLogs.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-neutral-500 text-[11px] shrink-0">[{row.time}]</span>
                    
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      row.status === 'GREEN' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : row.status === 'YELLOW'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    }`}>
                      {row.status === 'GREEN' ? '🟢 NORMAL' : row.status === 'YELLOW' ? '🟡 ALERTA' : '🔴 THROTTLE'}
                    </span>

                    <span className="text-neutral-300">
                      CLK: <strong className="text-white">{row.clk}%</strong> | CPU: {row.cpu}% | GPU: {row.gpu}% | RAM: {row.ramFree}MB | TEMP: <strong className={row.temp >= 90 ? 'text-rose-400' : 'text-neutral-200'}>{row.temp}°C</strong>
                    </span>

                    {row.throttlingFlag !== 'NO' && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded ml-auto">
                        FLAG: {row.throttlingFlag}
                      </span>
                    )}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Post-Session Summary Diagnostic Card */}
            {simulationSummary && (
              <div className="p-5 bg-neutral-900 border-t border-neutral-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>DIAGNÓSTICO AUTOMÁTICO DE LA SESIÓN DE JUEGO ({simulationSummary.totalSamples} muestras)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 text-[10px] block">PROMEDIO CLOCK</span>
                    <span className="text-base font-bold text-white">{simulationSummary.avgClk}%</span>
                  </div>
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 text-[10px] block">TEMP MÁXIMA</span>
                    <span className="text-base font-bold text-white">{simulationSummary.maxTemp}°C</span>
                  </div>
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 text-[10px] block">EVENTOS THROTTLING</span>
                    <span className={`text-base font-bold ${simulationSummary.throttlingEvents > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {simulationSummary.throttlingEvents}
                    </span>
                  </div>
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 text-[10px] block">USO GPU PROMEDIO</span>
                    <span className="text-base font-bold text-amber-400">{simulationSummary.gpuAvg}%</span>
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs space-y-1">
                  <div className="font-semibold text-white">{simulationSummary.verdict}</div>
                  <div className="text-neutral-400">{simulationSummary.action}</div>
                </div>
              </div>
            )}
          </div>

          {/* ThrottleStop TPL Calibration Step-by-Step */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Guía Paso a Paso de Calibración de ThrottleStop TPL en ASUS PN64</span>
              </h3>
              <button
                onClick={() => downloadSingleFile('THROTTLESTOP_GUIA.txt', generateThrottleStopGuideTxt())}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Guía TXT</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                <div className="text-[11px] font-mono text-emerald-400 font-bold">AJUSTE 01</div>
                <div className="text-xs font-bold text-white">Long Power PL1 = 28W</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Límite de potencia sostenida continua. Evita que la CPU supere los 88°C bajo partidas largas en Mirage, Inferno o Dust II.
                </p>
              </div>

              <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                <div className="text-[11px] font-mono text-emerald-400 font-bold">AJUSTE 02</div>
                <div className="text-xs font-bold text-white">Short Power PL2 = 50W</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Permite un breve impulso de 50W durante la carga de mapas de CS2 y pre-renderizado de shaders, cayendo suavemente a 28W.
                </p>
              </div>

              <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                <div className="text-[11px] font-mono text-emerald-400 font-bold">AJUSTE 03</div>
                <div className="text-xs font-bold text-white">Turbo Time Limit = 28s</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Ventana máxima de duración para el turbo secundario PL2 antes de que el procesador transicione al régimen estable de 28W.
                </p>
              </div>

              <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                <div className="text-[11px] font-mono text-emerald-400 font-bold">AJUSTE 04</div>
                <div className="text-xs font-bold text-white">Speed Shift EPP = 0</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Energy Performance Preference al mínimo absoluto. Fuerza al microcódigo de Intel a no demorar jamás el escalado de reloj de los P-Cores.
                </p>
              </div>
            </div>
          </div>

          {/* 5 HWiNFO64 Sensors Table */}
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Los 5 Sensores Clave a Monitorear en HWiNFO64</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950/80 text-neutral-400 font-mono text-[11px] border-b border-neutral-800">
                  <tr>
                    <th className="p-3 font-semibold">Sensor</th>
                    <th className="p-3 font-semibold">Qué Significa</th>
                    <th className="p-3 font-semibold">Rango Saludable (CS2)</th>
                    <th className="p-3 font-semibold">Indicador Crítico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {godModeSensorsList.map((sensor, idx) => (
                    <tr key={idx} className="hover:bg-neutral-800/30">
                      <td className="p-3 font-medium text-white whitespace-nowrap">{sensor.name}</td>
                      <td className="p-3 text-neutral-300">{sensor.meaning}</td>
                      <td className="p-3 font-mono text-emerald-400">{sensor.goodRange}</td>
                      <td className="p-3 font-mono text-rose-300">{sensor.badIndicator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Decision Matrix Table */}
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Matriz de Decisión para Analizar el CSV en Excel</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {decisionMatrixRules.map((rule, idx) => (
                <div key={idx} className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
                  <div className="text-[11px] font-mono text-amber-300 font-semibold">
                    PATRÓN EN CSV: {rule.pattern}
                  </div>
                  <div className="text-xs font-bold text-white">
                    DIAGNÓSTICO: {rule.diagnosis}
                  </div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    ACCIÓN: {rule.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCRIPT VIEWER & EXPORTER ACCORDION */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Visor de Código & Descarga de Scripts Avanzados</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Inspecciona línea por línea el código fuente de los 25 módulos o descárgalo individualmente para colocarlo en <code className="text-white font-mono">C:\PN64_CS2\</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(currentScript.code, 'viewer_code')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
            >
              {copiedId === 'viewer_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'viewer_code' ? 'Copiado al Portapapeles' : 'Copiar Código'}</span>
            </button>

            <button
              onClick={() => downloadSingleFile(currentScript.filename, currentScript.code)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-neutral-950 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar {currentScript.filename}</span>
            </button>
          </div>
        </div>

        {/* Script Selector Tabs (Cleanly ordered) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-neutral-800 text-xs no-scrollbar">
          {[
            { id: 'iniciar_todo_v3', label: 'INICIAR_TODO_V3.bat' },
            { id: 'auto_pre_game', label: '24_AUTO_PRE_GAME.bat' },
            { id: 'mod_16', label: '16_INTERRUPT_MSI.bat' },
            { id: 'mod_17', label: '17_KERNEL_CPU.bat' },
            { id: 'mod_18', label: '18_GPU_DRIVER.bat' },
            { id: 'mod_19', label: '19_DIRECTX.bat' },
            { id: 'mod_20', label: '20_IO_STORAGE.bat' },
            { id: 'mod_21', label: '21_STRIPPING.bat' },
            { id: 'mod_22', label: '22_MONITORING.bat' },
            { id: 'mod_23', label: '23_ENGINE_PRO.bat' },
            { id: 'autoexec_ultra', label: 'autoexec_ULTRA.cfg' },
            { id: 'mod_25', label: '25_RAM_DISK.bat' },
            { id: 'revertir_todo', label: 'REVERTIR_TODO.bat' },
            { id: 'mod_1', label: '01_RESTAURACION.bat' },
            { id: 'mod_2', label: '02_WINDOWS.bat' },
            { id: 'mod_3', label: '03_GPU_INTEL.bat' },
            { id: 'mod_10', label: '10_P_CORES.bat' },
            { id: 'mod_11', label: '11_POWER_PLAN.bat' },
            { id: 'mod_15', label: '15_BIOS_GUIDE.bat' },
            { id: 'extreme_v2', label: 'EXTREME_v2.ps1' },
            { id: 'booster_v2', label: 'CS2_Booster_v2.bat' },
            { id: 'extreme_undo', label: 'EXTREME_Undo.ps1' },
            { id: 'god_mode_bat', label: 'GOD_MODE.bat' },
            { id: 'monitor_ps1', label: 'GODMODE_MONITOR.ps1' },
            { id: 'throttlestop_txt', label: 'THROTTLESTOP.txt' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedScript(tab.id)}
              className={`px-3 py-1.5 font-mono text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedScript === tab.id
                  ? 'bg-neutral-800 text-emerald-400 border border-neutral-700 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Container */}
        <div className="relative rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/80 border-b border-neutral-800 text-xs text-neutral-400 font-mono">
            <span>{currentScript.filename} ({currentScript.type})</span>
            <span className="text-[11px] text-emerald-400">{currentScript.badge}</span>
          </div>

          <pre className="p-4 font-mono text-xs text-neutral-300 max-h-96 overflow-y-auto leading-relaxed whitespace-pre selection:bg-emerald-500/30">
            {currentScript.code}
          </pre>
        </div>
      </div>
    </div>
  );
};
