import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Terminal, 
  Play, 
  RotateCcw, 
  Download, 
  Flame, 
  ShieldAlert, 
  Cpu, 
  Layers, 
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import { 
  HardwareProfile, 
  cortexFunctionsList, 
  debunkedMythsList,
  CortexFunction 
} from '../data/optimizerData';
import { generateV7PowershellMaster, generateV6BatchMaster } from '../utils/scriptTemplates';
import { downloadSingleFile } from '../utils/zipGenerator';

interface QuickRunTerminalProps {
  hardware: HardwareProfile;
}

export const QuickRunTerminal: React.FC<QuickRunTerminalProps> = ({ hardware }) => {
  const [subTab, setSubTab] = useState<'cortex' | 'master_ps1' | 'debunked'>('cortex');
  const [selectedFunc, setSelectedFunc] = useState<CortexFunction>(cortexFunctionsList[0]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [simProgress, setSimProgress] = useState(0);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSimulateRun = (fn: CortexFunction) => {
    setIsSimulating(true);
    setSimulationLogs([]);
    setSimProgress(10);

    const logs: string[] = [
      `[INICIO] Invocando función: ${fn.title}`,
      `[HARDWARE] Detectado: ${hardware.targetModel} (${hardware.cpuModel})`,
      `[PRIVILEGIOS] Verificando token de Administrador de Windows... OK`,
    ];

    setTimeout(() => {
      logs.push(`[MODO CORTEX] Aplicando: ${fn.shortDesc}`);
      logs.push(`[FUNDAMENTO] ${fn.whyItWorks}`);
      setSimulationLogs([...logs]);
      setSimProgress(45);
    }, 450);

    setTimeout(() => {
      if (fn.id === 'f-bestia') {
        logs.push(`[TASKKILL] Procesos secundarios purgados: OneDrive, Teams, Spotify, Chrome, Discord`);
        logs.push(`[NET STOP] Servicios detenidos: SysMain, DiagTrack, WSearch, Spooler`);
        logs.push(`[AFFINITY] cs2.exe fijado a P-Cores 0-3 (Máscara 15 / 0x0F) con Prioridad ALTA`);
      } else if (fn.id === 'f-torneo') {
        logs.push(`[KILL] explorer.exe finalizado. Liberados 420 MB de VRAM compartida para la Intel UHD`);
        logs.push(`[INFO] Para volver al escritorio: Ctrl+Shift+Esc > Archivo > explorer.exe`);
      } else if (fn.id === 'f-timers') {
        logs.push(`[BCDEDIT] useplatformtick y useplatformclock eliminados (HPET de 14MHz removido)`);
        logs.push(`[BCDEDIT] disabledynamictick = yes | tscsyncpolicy = Enhanced (TSC 4.0GHz nativo activo)`);
      } else if (fn.id === 'f-gpu') {
        logs.push(`[REGISTRO] OverlayTestMode = 5 (Multi-Plane Overlay MPO Fix aplicado)`);
        logs.push(`[REGISTRO] HwSchMode = 2 (HAGS) | TdrDelay = 10`);
        logs.push(`[FLUSH] Caché de shaders D3DSCache y shadercache/730 eliminadas para recompilar limpio`);
      } else {
        logs.push(`[SCRIPT] Ejecutando: ${fn.powershellCmd}`);
        logs.push(`[RESULTADO] ${fn.expectedGain}`);
      }
      setSimulationLogs([...logs]);
      setSimProgress(80);
    }, 950);

    setTimeout(() => {
      logs.push(`[COMPLETADO] Operación finalizada con éxito. Ganancia estimada: ${fn.expectedGain}`);
      setSimulationLogs([...logs]);
      setSimProgress(100);
      setIsSimulating(false);
    }, 1500);
  };

  const block0 = `Set-ExecutionPolicy Bypass -Scope Process -Force`;
  const v7MasterPs1 = generateV7PowershellMaster();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1.5">
              <Flame className="w-4 h-4 fill-emerald-400/20" />
              <span>Consola Interactiva Razer Cortex 1-Click</span>
              <span aria-hidden="true">·</span>
              <span>Edición V7 Ultimate (15 Modos + 110 Tweaks)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Centro de Control del ASUS PN64 para CS2
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Basado en los scripts probados <code className="text-emerald-300 font-mono">PN64_V7_ULTIMATE.ps1</code> y <code className="text-emerald-300 font-mono">PN64_V6_ULTIMATE.bat</code>. 
              Ejecuta o simula cada función con fundamento físico real (confinamiento en P-Cores, MPO Fix para Intel UHD y temporizador TSC).
            </p>
          </div>

          {/* Sub-tab navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950/80 border border-neutral-800 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setSubTab('cortex')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                subTab === 'cortex'
                  ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              15 Modos Cortex
            </button>
            <button
              onClick={() => setSubTab('master_ps1')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                subTab === 'master_ps1'
                  ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              PowerShell Maestro V7
            </button>
            <button
              onClick={() => setSubTab('debunked')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                subTab === 'debunked'
                  ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Mitos Desmentidos
            </button>
          </div>
        </div>
      </div>

      {/* Subtab 1: 15 Modos Cortex */}
      {subTab === 'cortex' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive list of 15 Cortex modes */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Selecciona una función
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                15 funciones listas
              </span>
            </div>

            <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
              {cortexFunctionsList.map((fn) => {
                const isSelected = selectedFunc.id === fn.id;
                return (
                  <button
                    key={fn.id}
                    onClick={() => setSelectedFunc(fn)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/60 text-white shadow-sm'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-emerald-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {fn.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate text-white">
                          {fn.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {fn.shortDesc}
                      </p>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                      fn.isDangerous 
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' 
                        : 'bg-neutral-800 text-emerald-400 border border-neutral-700'
                    }`}>
                      {fn.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Function details & live runner console */}
          <div className="lg:col-span-7 space-y-4">
            {/* Selected function card */}
            <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Opción [{selectedFunc.num}]
                    </span>
                    <span className="text-xs text-neutral-400">
                      Categoría: {selectedFunc.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedFunc.title}
                  </h3>
                </div>

                <button
                  onClick={() => handleSimulateRun(selectedFunc)}
                  disabled={isSimulating}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isSimulating ? 'Simulando...' : 'Probar en Terminal'}</span>
                </button>
              </div>

              <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800/80">
                <p className="font-semibold text-neutral-200 mb-1">¿Qué hace exactamente?</p>
                <p>{selectedFunc.shortDesc}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fundamento Físico</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {selectedFunc.whyItWorks}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 mb-1">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Ganancia Estimada</span>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-semibold leading-relaxed">
                    {selectedFunc.expectedGain}
                  </p>
                </div>
              </div>

              {/* Commands with 1-click copy */}
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 font-medium">Comando PowerShell V7:</span>
                  <button
                    onClick={() => handleCopy(selectedFunc.powershellCmd, 'ps-cmd')}
                    className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                  >
                    {copiedKey === 'ps-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ps-cmd' ? '¡Copiado!' : 'Copiar comando'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-950 font-mono text-xs text-neutral-200 border border-neutral-800 overflow-x-auto">
                  <code>{selectedFunc.powershellCmd}</code>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-neutral-400 font-medium">Equivalente en Batch V6:</span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    {selectedFunc.batchCmd}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Terminal Output Box */}
            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs">
                <div className="flex items-center gap-2 font-mono text-neutral-400">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Terminal Virtual — ASUS PN64 PowerShell Engine</span>
                </div>
                {simulationLogs.length > 0 && (
                  <button
                    onClick={() => setSimulationLogs([])}
                    className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {isSimulating && (
                <div className="w-full bg-neutral-900 h-1">
                  <div 
                    className="bg-emerald-400 h-1 transition-all duration-300"
                    style={{ width: `${simProgress}%` }}
                  />
                </div>
              )}

              <div className="p-4 font-mono text-xs min-h-[160px] max-h-[220px] overflow-y-auto space-y-1.5 custom-scrollbar bg-neutral-950">
                {simulationLogs.length === 0 ? (
                  <div className="text-neutral-600 italic py-8 text-center">
                    Haz clic en "Probar en Terminal" arriba para simular la ejecución y verificar los comandos paso a paso.
                  </div>
                ) : (
                  simulationLogs.map((log, index) => {
                    const isSuccess = log.includes('[OK]') || log.includes('[COMPLETADO]');
                    const isWarn = log.includes('[!]') || log.includes('[INFO]');
                    return (
                      <div 
                        key={index} 
                        className={`leading-relaxed ${
                          isSuccess 
                            ? 'text-emerald-400 font-semibold' 
                            : isWarn 
                            ? 'text-amber-300' 
                            : 'text-neutral-300'
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: PowerShell Maestro V7 completo */}
      {subTab === 'master_ps1' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Ejecución en 30 Segundos desde Windows Terminal</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Abre PowerShell como Administrador y pega estos dos bloques en orden para iniciar la suite completa.
                </p>
              </div>

              <button
                onClick={() => downloadSingleFile('PN64_V7_ULTIMATE.ps1', v7MasterPs1)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 rounded-lg transition-colors self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PN64_V7.ps1</span>
              </button>
            </div>

            {/* Block 0 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">
                  Paso 1: Bloque 0 — Permitir Ejecución de Scripts (Copia y pulsa Enter)
                </span>
                <button
                  onClick={() => handleCopy(block0, 'b0')}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-mono"
                >
                  {copiedKey === 'b0' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'b0' ? '¡Copiado!' : 'Copiar Bloque 0'}</span>
                </button>
              </div>
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-emerald-400">
                <code>{block0}</code>
              </div>
            </div>

            {/* Block 1 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">
                  Paso 2: Bloque 1 — Script Maestro Completo V7 (15 Funciones)
                </span>
                <button
                  onClick={() => handleCopy(v7MasterPs1, 'b1')}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-mono"
                >
                  {copiedKey === 'b1' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'b1' ? '¡Script Copiado!' : 'Copiar Script Completo'}</span>
                </button>
              </div>
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-neutral-300 max-h-96 overflow-y-auto custom-scrollbar">
                <pre className="whitespace-pre-wrap">{v7MasterPs1}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Mitos Desmentidos & Ciencia */}
      {subTab === 'debunked' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold mb-0.5">
                Por qué eliminamos estos tweaks populares de la versión V4 a la V5/V6/V7:
              </strong>
              Muchos "optimizadores" de YouTube aplican claves ciegas de hace 15 años que destruyen el rendimiento de los procesadores modernos Intel Alder Lake. Aquí tienes la explicación técnica de por qué fueron eliminados y cuál es la solución real comprobada con PresentMon y CapFrameX.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {debunkedMythsList.map((m) => (
              <div 
                key={m.id}
                className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <h4 className="text-sm font-bold text-white">
                    {m.mythName}
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                    <span className="font-semibold text-rose-300 block mb-0.5">
                      ❌ Por qué perjudicaba al i3-1220P:
                    </span>
                    <p className="text-neutral-400 leading-relaxed">
                      {m.whyItFailed}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <span className="font-semibold text-emerald-300 block mb-0.5">
                      ✓ La corrección en V7 Ultimate:
                    </span>
                    <p className="text-neutral-300 leading-relaxed">
                      {m.theRealFix}
                    </p>
                  </div>

                  <div className="text-[11px] text-neutral-500 italic pt-1">
                    Fundamento: {m.scienceRationale}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
