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
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Server,
  Undo2
} from 'lucide-react';
import { 
  HardwareProfile, 
  cortexFunctionsList, 
  debunkedMythsList,
  CortexFunction 
} from '../data/optimizerData';
import { generateV7PowershellMaster } from '../utils/scriptTemplates';
import { downloadSingleFile } from '../utils/zipGenerator';
import { OperationResult } from '../services/nativeBridge';

interface QuickRunTerminalProps {
  hardware: HardwareProfile;
  isNativeConnected?: boolean;
  activeOperation?: string | null;
  onApplyOp?: (opId: string) => Promise<OperationResult>;
  onRestoreOp?: (opId: string) => Promise<OperationResult>;
}

interface FunctionNativeMapping {
  operationId?: string;
  restoreOperationId?: string;
  isImplemented: boolean;
  statusLabel: string;
  implementationNote?: string;
  canRestore?: boolean;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export const functionNativeMappings: Record<string, FunctionNativeMapping> = {
  'f-bestia': {
    operationId: 'cortex.mode.bestia',
    restoreOperationId: 'gaming.cs2.priority.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Modo Bestia (Afinidad P-Cores Mask 15 + Prioridad Alta + Respaldo)',
    canRestore: true,
  },
  'f-torneo': {
    operationId: 'cortex.mode.torneo',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Modo Torneo (Suspensión DWM / Explorer con UAC)',
    canRestore: true,
    requiresConfirmation: true,
    confirmationMessage: 'El Modo Torneo suspende temporalmente las transparencias de Windows y tareas secundarias para maximizar la VRAM disponible para la GPU integrada. ¿Confirmas la ejecución?'
  },
  'f-nucleo': {
    operationId: 'cortex.mode.nucleo',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Modo Núcleo (Kernel Memory, Mitigaciones y Modo MSI)',
    canRestore: true,
  },
  'f-timers': {
    operationId: 'cortex.mode.timers',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Temporizadores TSC de Alta Precisión (BCDedit)',
    canRestore: true,
  },
  'f-gpu': {
    operationId: 'cortex.mode.gpu',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Optimización GPU Intel UHD (HAGS, MPO Fix y TDR Delay)',
    canRestore: true,
  },
  'f-stutter': {
    operationId: 'cortex.mode.stutter',
    isImplemented: true,
    statusLabel: 'Operación Real: Purga de Standby List y Working Sets de Memoria',
    canRestore: false,
  },
  'f-red': {
    operationId: 'cortex.mode.network',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Red de Baja Latencia (Nagle OFF, TCPNoDelay, AutoTuning)',
    canRestore: true,
  },
  'f-debloat': {
    operationId: 'cortex.mode.debloat',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Debloat Seguro de Windows (Apps UWP y Telemetría)',
    canRestore: true,
  },
  'f-servicios': {
    operationId: 'cortex.mode.services',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Perfil de Servicios Gaming con Snapshot y UAC',
    canRestore: true,
  },
  'f-vbs': {
    operationId: 'cortex.mode.vbs',
    restoreOperationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Alternador VBS / HVCI con Confirmación y Reinicio',
    canRestore: true,
    requiresConfirmation: true,
    confirmationMessage: 'Modificar el estado de Seguridad Basada en Virtualización (VBS/HVCI) requiere privilegios administrativos y reiniciar Windows. ¿Deseas continuar?'
  },
  'f-limpieza': {
    operationId: 'system.temp.cleanup',
    isImplemented: true,
    statusLabel: 'Operación Real: Limpieza Segura de Temporales del Usuario (%TEMP%)',
    canRestore: false,
  },
  'f-loop': {
    operationId: 'gaming.cs2.detect',
    isImplemented: true,
    statusLabel: 'Operación Real: Detección Activa de cs2.exe en Windows',
    canRestore: false,
  },
  'f-bench': {
    operationId: 'system.hardware.refresh',
    isImplemented: true,
    statusLabel: 'Operación Real: Diagnóstico WMI en Vivo',
    canRestore: false,
  },
  'f-cfg': {
    operationId: 'cortex.mode.cfg',
    isImplemented: true,
    statusLabel: 'Operación Real: Despliegue de Autoexec Competitivo y Config Source 2',
    canRestore: false,
  },
  'f-restore': {
    operationId: 'cortex.mode.restore',
    isImplemented: true,
    statusLabel: 'Operación Real: Restauración Integral de Valores Originales',
    canRestore: false,
  },
};

export const QuickRunTerminal: React.FC<QuickRunTerminalProps> = ({ 
  hardware,
  isNativeConnected = false,
  activeOperation = null,
  onApplyOp,
  onRestoreOp
}) => {
  const [subTab, setSubTab] = useState<'cortex' | 'master_ps1' | 'debunked'>('cortex');
  const [selectedFunc, setSelectedFunc] = useState<CortexFunction>(cortexFunctionsList[0]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const currentMapping = functionNativeMappings[selectedFunc.id] || {
    isImplemented: false,
    statusLabel: 'Pendiente de integración',
    implementationNote: 'Programada para fases posteriores.'
  };

  const handleExecuteRealOperation = async (fn: CortexFunction) => {
    const mapping = functionNativeMappings[fn.id];

    if (!mapping || !mapping.isImplemented || !mapping.operationId) {
      setTerminalLogs([
        `[AVISO] La función '${fn.title}' está pendiente de integración en el motor nativo C#.`,
        `[DETALLE] ${mapping?.implementationNote || 'Se incorporará en la siguiente fase de desarrollo con verificación de seguridad.'}`,
        `[REGLA DE CONGRUENCIA] No se simula éxito artificial para operaciones que aún no están conectadas al sistema.`
      ]);
      return;
    }

    if (!isNativeConnected || !onApplyOp) {
      setTerminalLogs([
        `[ERROR] El motor nativo C# (EvoNativeEngine) no está conectado en http://127.0.0.1:48120.`,
        `[INSTRUCCIÓN] Inicia el servicio en Windows ejecutando: scripts\\Start-EvoEngine.ps1`,
        `[REGLA 5] Por seguridad, las operaciones sobre el sistema Windows requieren el motor local en tu máquina.`
      ]);
      return;
    }

    if (mapping.requiresConfirmation) {
      const confirmed = window.confirm(mapping.confirmationMessage || `¿Confirmas ejecutar la operación '${mapping.operationId}'?`);
      if (!confirmed) {
        setTerminalLogs([`[CANCELADO] Operación '${mapping.operationId}' cancelada por el usuario.`]);
        return;
      }
    }

    setIsExecuting(true);
    setTerminalLogs([`[INICIO] Enviando orden de ejecución para: ${mapping.operationId}...`]);

    try {
      const res = await onApplyOp(mapping.operationId);
      setLastResult(res);

      if (res.logs && res.logs.length > 0) {
        setTerminalLogs(res.logs);
      } else {
        setTerminalLogs([
          `[COMPLETADO] Operación '${res.operationId}' ejecutada en ${res.durationMs.toFixed(1)} ms.`,
          res.success ? '[ESTADO] Éxito' : `[ESTADO] Error: ${res.errorMessage}`
        ]);
      }
    } catch (err: any) {
      setTerminalLogs([
        `[ERROR DE COMUNICACIÓN] Falló la llamada al motor nativo: ${err.message}`
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRestoreRealOperation = async (fn: CortexFunction) => {
    const mapping = functionNativeMappings[fn.id];

    if (!mapping || !mapping.canRestore || !mapping.operationId) {
      return;
    }

    if (!isNativeConnected || !onRestoreOp) {
      setTerminalLogs([
        `[ERROR] Motor C# no conectado. No se puede consultar el respaldo ni restaurar valores originales.`
      ]);
      return;
    }

    setIsExecuting(true);
    setTerminalLogs([`[RESTAURAR] Solicitando restauración de respaldo para: ${mapping.operationId}...`]);

    try {
      const res = await onRestoreOp(mapping.operationId);
      setLastResult(res);

      if (res.logs && res.logs.length > 0) {
        setTerminalLogs(res.logs);
      } else {
        setTerminalLogs([
          `[COMPLETADO] Restauración de '${res.operationId}' finalizada en ${res.durationMs.toFixed(1)} ms.`,
          res.success ? '[ESTADO] Restaurado con éxito' : `[ESTADO] Error: ${res.errorMessage}`
        ]);
      }
    } catch (err: any) {
      setTerminalLogs([
        `[ERROR DE RESTAURACIÓN] ${err.message}`
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const block0 = `Set-ExecutionPolicy Bypass -Scope Process -Force`;
  const v7MasterPs1 = generateV7PowershellMaster();

  const isCurrentOpRunning = isExecuting || (activeOperation !== null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1.5">
              <Flame className="w-4 h-4 fill-emerald-400/20" />
              <span>Consola de Ejecución Real Razer Cortex (Windows 11)</span>
              <span aria-hidden="true">·</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                isNativeConnected 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {isNativeConnected ? 'Motor C# Conectado (127.0.0.1:48120)' : 'Motor C# Desconectado'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Centro de Control del ASUS PN64 para CS2
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Ejecución controlada mediante identificadores estrictos resueltos por el motor nativo en C# (.NET 8).
              No se admiten comandos arbitrarios y las operaciones críticas cuentan con copia de respaldo y restauración.
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
                15 funciones catalogadas
              </span>
            </div>

            <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
              {cortexFunctionsList.map((fn) => {
                const isSelected = selectedFunc.id === fn.id;
                const mapping = functionNativeMappings[fn.id];
                const isOpConnected = mapping?.isImplemented ?? false;

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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isOpConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                        <span className={`text-[10px] font-mono ${isOpConnected ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}`}>
                          {isOpConnected ? 'Motor C# Activo' : 'Pendiente integración'}
                        </span>
                      </div>
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
              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Opción [{selectedFunc.num}]
                    </span>
                    <span className="text-xs text-neutral-400">
                      Categoría: {selectedFunc.category}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded border font-mono ${
                      currentMapping.isImplemented
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                    }`}>
                      {currentMapping.isImplemented ? `Operación Real: ${currentMapping.operationId}` : 'Pendiente de integración'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedFunc.title}
                  </h3>
                </div>

                {/* Real Execution Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {currentMapping.canRestore && (
                    <button
                      onClick={() => handleRestoreRealOperation(selectedFunc)}
                      disabled={isCurrentOpRunning || !isNativeConnected}
                      title="Restaura la prioridad original de cs2.exe guardada en el respaldo"
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-40 rounded-lg shadow-sm transition-all active:scale-95"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Restaurar</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleExecuteRealOperation(selectedFunc)}
                    disabled={isCurrentOpRunning}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 ${
                      !currentMapping.isImplemented
                        ? 'text-neutral-400 bg-neutral-800/80 border border-neutral-700 cursor-not-allowed'
                        : isNativeConnected
                        ? 'text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50'
                        : 'text-neutral-300 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {isCurrentOpRunning 
                        ? 'Ejecutando...' 
                        : currentMapping.isImplemented 
                        ? 'Ejecutar operación' 
                        : 'Pendiente de integración'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Status Note if pending */}
              {!currentMapping.isImplemented && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">Estado: Pendiente de integración</strong>
                    <p>{currentMapping.implementationNote}</p>
                  </div>
                </div>
              )}

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
                  <span className="text-neutral-400 font-medium">Comando PowerShell V7 de referencia:</span>
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
              </div>
            </div>

            {/* Live Real Terminal Output Box */}
            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs">
                <div className="flex items-center gap-2 font-mono text-neutral-400">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Consola de Salida del Motor C# .NET 8 (Windows 11)</span>
                </div>
                {terminalLogs.length > 0 && (
                  <button
                    onClick={() => setTerminalLogs([])}
                    className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {/* Progress bar when executing */}
              {isExecuting && (
                <div className="w-full bg-neutral-900 h-1 overflow-hidden">
                  <div className="bg-emerald-400 h-1 w-full animate-pulse" />
                </div>
              )}

              <div className="p-4 font-mono text-xs min-h-[170px] max-h-[250px] overflow-y-auto space-y-1.5 custom-scrollbar bg-neutral-950">
                {terminalLogs.length === 0 ? (
                  <div className="text-neutral-600 italic py-8 text-center">
                    Selecciona una función con motor activo y presiona "Ejecutar operación" para procesar la orden en Windows 11.
                  </div>
                ) : (
                  terminalLogs.map((log, index) => {
                    const isSuccess = log.includes('[OK]') || log.includes('[COMPLETADO]') || log.includes('[Éxito]');
                    const isWarn = log.includes('[!]') || log.includes('[INFO]') || log.includes('[AVISO]');
                    const isErr = log.includes('[ERROR]') || log.includes('[ERROR CRÍTICO]');
                    return (
                      <div 
                        key={index} 
                        className={`leading-relaxed ${
                          isErr
                            ? 'text-rose-400 font-semibold'
                            : isSuccess 
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
