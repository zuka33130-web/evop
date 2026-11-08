/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Zap, 
  Terminal, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  ArrowRight, 
  RotateCcw,
  Gauge,
  Flame,
  Monitor,
  FlaskConical
} from 'lucide-react';
import { defaultHardwareProfile, HardwareProfile } from './data/optimizerData';
import { downloadPackageZip } from './utils/zipGenerator';
import { Navbar } from './components/Navbar';
import { HardwareProfileHeader } from './components/HardwareProfileHeader';
import { QuickRunTerminal } from './components/QuickRunTerminal';
import { ModulesExplorer } from './components/ModulesExplorer';
import { FpsCalculator } from './components/FpsCalculator';
import { AutoexecBuilder } from './components/AutoexecBuilder';
import { BiosChecklist } from './components/BiosChecklist';
import { FilesExporter } from './components/FilesExporter';
import { ExtremeGodMode } from './components/ExtremeGodMode';
import { ScientificLab } from './components/ScientificLab';
import { NativeDiagnosticsCard } from './components/NativeDiagnosticsCard';
import { useNativeBridge, SystemHardwareReport } from './services/nativeBridge';
import { Server } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [hardware, setHardware] = useState<HardwareProfile>(defaultHardwareProfile);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const {
    connectionStatus,
    engineInfo,
    diagnostics,
    catalog,
    history,
    error: nativeError,
    isScanning,
    reconnect,
    refreshScan,
    isConnected,
    activeOperation,
    applyOp,
    restoreOp,
    fetchTelemetry
  } = useNativeBridge();

  const handleApplyRealHardware = (diag: SystemHardwareReport) => {
    setHardware(prev => ({
      ...prev,
      targetModel: diag.hostName ? `${diag.hostName} (Host Real)` : prev.targetModel,
      cpuModel: diag.processor.name || prev.cpuModel,
      pCores: diag.processor.physicalCores > 0 ? Math.min(diag.processor.physicalCores, 16) : prev.pCores,
      threads: diag.processor.logicalProcessors > 0 ? diag.processor.logicalProcessors : prev.threads,
      ramGB: diag.memory.totalGb > 0 ? Math.round(diag.memory.totalGb) : prev.ramGB,
      gpuModel: diag.graphicsCards[0]?.name || prev.gpuModel,
      os: diag.operatingSystem.name || prev.os,
    }));
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      await downloadPackageZip(hardware);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onDownloadZip={handleDownloadZip}
        isDownloading={isDownloadingZip}
        isNativeConnected={isConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hardware target banner */}
        <HardwareProfileHeader 
          hardware={hardware} 
          setHardware={setHardware}
          isNativeConnected={isConnected}
          realDiagnostics={diagnostics}
          onOpenDiagnostics={() => setActiveTab('diagnostics')}
        />

        {/* Tab 1: Overview Dashboard */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Card */}
            <div className="relative rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 p-6 sm:p-8 overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
                  <Flame className="w-4 h-4 fill-emerald-400/30" />
                  <span>ASUS PN64 CS2 Booster V7 Ultimate</span>
                  <span aria-hidden="true">·</span>
                  <span>15 Modos Cortex & 110 Tweaks en C:\PN64_CS2\</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white" style={{ textWrap: 'balance' }}>
                  Optimizador de FPS para ASUS PN64 — Edición Definitiva CS2
                </h1>

                <p className="text-sm sm:text-base text-neutral-300 mt-3 leading-relaxed">
                  Ingeniería de latencia creada para el procesador <strong className="text-white">Intel Core i3-1220P</strong> y los gráficos <strong className="text-white">Intel UHD 64EU</strong>. 
                  Confinamiento en los 4 hilos de los P-Cores a 4.4 GHz (máscara 15), eliminación del temporizador lento HPET, corrección MPO y liberación de memoria de video matando Explorer para pasar de <strong className="text-rose-400">30-45 FPS con tirones</strong> a <strong className="text-emerald-400 font-mono">75-110 FPS estables</strong> en 1280x960 con FSR Rendimiento.
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <button
                    onClick={() => setActiveTab('runner')}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all active:scale-95"
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Consola 1-Click Cortex (15 Modos)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setActiveTab('godmode')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg transition-colors"
                  >
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>Fase 3: Modo Ultra Agresivo & God Mode</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('tweaks')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-lg transition-colors"
                  >
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Explorar los 110 Tweaks</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('fps_calculator')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-lg transition-colors"
                  >
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    <span>Simular FPS Reales</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('lab')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 rounded-lg transition-colors"
                  >
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>Laboratorio Científico A/B & EVO</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition-colors ${
                      isConnected 
                        ? 'text-neutral-950 bg-emerald-400 hover:bg-emerald-300 border-emerald-400 font-bold' 
                        : 'text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border-neutral-700/80'
                    }`}
                  >
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span>Diagnóstico Real C# {isConnected ? '(Conectado)' : '(Windows 11)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Core Pillars Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab('runner')}
                className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/50 cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Afinidad P-Cores (Mask 15)
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Confina CS2 a los 4 hilos rápidos (0-3). Evita que Windows Thread Director envíe hilos críticos a los 8 lentos E-Cores.
                </p>
                <div className="text-[11px] font-mono text-emerald-400 mt-3 flex items-center gap-1">
                  <span>1% Low: de 22 a 64+ FPS</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('runner')}
                className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/50 cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Modo Torneo (Explorer Killer)
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Mata explorer.exe y transparencias de Windows. Libera 300-500MB de memoria de video compartida para la Intel UHD.
                </p>
                <div className="text-[11px] font-mono text-amber-300 mt-3 flex items-center gap-1">
                  <span>+5-8 FPS netos en UHD</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('runner')}
                className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/50 cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                  <Monitor className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  MPO Fix & Timers TSC
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  OverlayTestMode=5 corrige parpadeos en Intel. Borra HPET useplatformtick y activa TSC nativo a 4GHz sin retardo.
                </p>
                <div className="text-[11px] font-mono text-cyan-400 mt-3 flex items-center gap-1">
                  <span>-2.8 ms de input lag</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('autoexec')}
                className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/50 cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Video.txt + FSR Rendimiento
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  1280x960 4:3 con escalado FidelityFX Super Resolution en modo Rendimiento (valor 2). La clave de los 100 FPS en UHD.
                </p>
                <div className="text-[11px] font-mono text-emerald-400 mt-3 flex items-center gap-1">
                  <span>+25 FPS por FSR</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Step by step Game Day Protocol */}
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
              <h3 className="text-lg font-bold text-white tracking-tight mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Orden de Uso Cortex en 5 Pasos</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                    PASO 01
                  </div>
                  <div className="text-xs font-bold text-white">BIOS ASUS (F2)</div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    DVMT a <strong className="text-white">512M o 1024M</strong> + Fan Profile Full Speed y MyASUS Rendimiento Completo.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                    PASO 02
                  </div>
                  <div className="text-xs font-bold text-white">Estructura en C:\</div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Descarga el pack y ejecuta <code className="text-emerald-300 font-mono">00_CREAR_ESTRUCTURA.bat</code> para montar <code className="text-white font-mono">C:\PN64_CS2\</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                    PASO 03
                  </div>
                  <div className="text-xs font-bold text-white">Aplicar Registro & Núcleo</div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Aplica 01, 02 y 03 .reg. Luego en PN64_V6 o V7 ejecuta la opción <strong className="text-white">[3]</strong> y reinicia.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                    PASO 04
                  </div>
                  <div className="text-xs font-bold text-white">Steam & Video.txt</div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Pega <code className="text-emerald-300 font-mono">-threads 8 -dx11</code> en Steam e instala <code className="text-white font-mono">autoexec.cfg</code> y <code className="text-white font-mono">video.txt</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                    PASO 05
                  </div>
                  <div className="text-xs font-bold text-white">1-Click Antes de Jugar</div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Abre PN64_V7 o V6 y pulsa <strong className="text-emerald-400">[1] Modo Bestia</strong> o <strong className="text-amber-300">[2] Torneo</strong>. Al terminar, <strong className="text-white">[14/15]</strong> para restaurar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Diagnóstico Real C# (Windows 11 Native Engine) */}
        {activeTab === 'diagnostics' && (
          <NativeDiagnosticsCard
            status={connectionStatus}
            engineInfo={engineInfo}
            diagnostics={diagnostics}
            error={nativeError}
            isScanning={isScanning}
            onReconnect={reconnect}
            onRefresh={refreshScan}
            onApplyRealHardware={handleApplyRealHardware}
            catalog={catalog}
            history={history}
          />
        )}

        {/* Tab: Fase 2 & 3 God Mode */}
        {activeTab === 'godmode' && (
          <ExtremeGodMode 
            hardware={hardware}
            isNativeConnected={isConnected}
            activeOperation={activeOperation}
            onApplyOp={applyOp}
            onRestoreOp={restoreOp}
            fetchTelemetry={fetchTelemetry}
          />
        )}

        {/* Tab 2: 15 Modos Cortex */}
        {activeTab === 'runner' && (
          <QuickRunTerminal 
            hardware={hardware} 
            isNativeConnected={isConnected}
            activeOperation={activeOperation}
            onApplyOp={applyOp}
            onRestoreOp={restoreOp}
          />
        )}

        {/* Tab 3: 110 Tweaks Explorer */}
        {activeTab === 'tweaks' && (
          <ModulesExplorer 
            isNativeConnected={isConnected}
            activeOperation={activeOperation}
            onApplyOp={applyOp}
            onRestoreOp={restoreOp}
          />
        )}

        {/* Tab 4: FPS Calculator */}
        {activeTab === 'fps_calculator' && (
          <FpsCalculator />
        )}

        {/* Tab: Laboratorio A/B & EVO */}
        {activeTab === 'lab' && (
          <ScientificLab hardware={hardware} />
        )}

        {/* Tab 5: CS2 Autoexec Builder & Video.txt */}
        {activeTab === 'autoexec' && (
          <AutoexecBuilder />
        )}

        {/* Tab 6: BIOS Guide */}
        {activeTab === 'bios' && (
          <BiosChecklist />
        )}

        {/* Tab 7: Files Exporter */}
        {activeTab === 'files' && (
          <FilesExporter hardware={hardware} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-6 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            ASUS ExpertCenter PN64 CS2 FPS Booster · V7 Ultimate (i3-1220P 2P+8E · Intel UHD 64EU · 16GB DDR4 Dual Channel)
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('files')}
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Restaurador de Emergencia: RESTORE_TOTAL.bat</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
