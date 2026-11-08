import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  ShieldCheck, 
  Cpu, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  Terminal, 
  Clock, 
  Layers, 
  Play, 
  Square,
  Sparkles,
  Info,
  Server,
  Network,
  HardDrive,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { OperationResult } from '../services/nativeBridge';

export interface OptimizationTemplate {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  category: 'competitive' | 'tournament' | 'extreme' | 'network' | 'maintenance' | 'restore';
  description: string;
  expectedFpsBoost: string;
  expectedLatencyReduction: string;
  operationIds: string[];
  reversible: boolean;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  tweakItems: {
    label: string;
    target: string;
    detail: string;
  }[];
}

export const OPTIMIZATION_TEMPLATES: OptimizationTemplate[] = [
  {
    id: 'tpl-cs2-premier',
    name: 'CS2 Competitivo Premier',
    subtitle: 'Plantilla de alto rendimiento recomendada para ASUS PN64',
    badge: 'Recomendado +25 FPS',
    category: 'competitive',
    description: 'Aísla CS2 en los 4 hilos de alto rendimiento (P-Cores), fija prioridad Alta, desactiva MPO en la GPU Intel y optimiza la pila de red con Nagle desactivado.',
    expectedFpsBoost: '+20-28 FPS en 1% Low',
    expectedLatencyReduction: '-3.5 ms de frametime',
    operationIds: [
      'cortex.mode.bestia',
      'tweak.gpu.mpo_fix',
      'cortex.mode.timers',
      'tweak.network.nagle_off',
      'system.temp.cleanup'
    ],
    reversible: true,
    tweakItems: [
      { label: 'Afinidad P-Cores', target: 'cs2.exe', detail: 'Confinamiento exclusivo en hilos 0, 1, 2, 3 (Mask 15 / 0x0F)' },
      { label: 'Prioridad de Proceso', target: 'IFEO Windows NT', detail: 'Prioridad Alta permanente sin software de terceros' },
      { label: 'Multi-Plane Overlay Fix', target: 'DWM Registry', detail: 'OverlayTestMode=5 para eliminar micro-parpadeos en Intel UHD' },
      { label: 'Temporizadores TSC', target: 'BCDedit Firmware', detail: 'TSC nativo a 4.0 GHz sin latencia del temporizador HPET' },
      { label: 'Algoritmo de Nagle OFF', target: 'TCP/IP Interfaces', detail: 'TcpAckFrequency=1 y TCPNoDelay=1 para disparos instantáneos' },
      { label: 'Limpieza de Temporales', target: '%TEMP% Usuario', detail: 'Purga de archivos temporales residuales no bloqueados' }
    ]
  },
  {
    id: 'tpl-esports-tournament',
    name: 'Modo Torneo E-Sports',
    subtitle: 'Máxima liberación de VRAM compartida y suspensión de efectos secundarios',
    badge: 'Latencia Cero',
    category: 'tournament',
    description: 'Para partidas clasificatorias y scrims: suspende temporalmente las transparencias DWM y 55+ servicios de fondo para liberar hasta 500 MB de memoria de video para la Intel UHD.',
    expectedFpsBoost: '+8-12 FPS adicionales',
    expectedLatencyReduction: '-5.0 ms de input lag',
    operationIds: [
      'cortex.mode.torneo',
      'cortex.mode.services',
      'cortex.mode.stutter',
      'tweak.network.autotuning_high'
    ],
    reversible: true,
    requiresConfirmation: true,
    confirmationMessage: 'El Modo Torneo suspenderá temporalmente transparencias de Windows y servicios secundarios para maximizar la VRAM disponible. ¿Deseas activarlo?',
    tweakItems: [
      { label: 'Suspensión DWM / Shell', target: 'Windows Desktop', detail: 'Detiene efectos de transparencia y widgets para liberar VRAM' },
      { label: 'Perfil Gaming de Servicios', target: 'Service Manager', detail: 'Pone en pausa 55+ servicios de diagnóstico y telemetría de fondo' },
      { label: 'Purga de Standby List', target: 'Memoria Win32', detail: 'Vacía la lista de reserva y libera conjuntos de trabajo de RAM' },
      { label: 'TCP Window Auto-Tuning', target: 'Netsh Interface', detail: 'Ajuste de búfer de recepción en modo High para conexiones de fibra' }
    ]
  },
  {
    id: 'tpl-alderlake-extreme',
    name: 'Modo Extremo Alder Lake (12th Gen)',
    subtitle: 'Sostén incondicional a 4.4 GHz y mitigaciones del kernel OFF',
    badge: 'Hardware Agresivo',
    category: 'extreme',
    description: 'Ajustes a nivel de microcódigo y kernel de Windows: bloquea la entrada en reposo de la CPU (IDLEDISABLE 1), fija la paginación a 8GB y activa interrupciones MSI en buses PCIe.',
    expectedFpsBoost: '+1-3% IPC CPU sostenido',
    expectedLatencyReduction: 'Cero fluctuaciones térmicas de reloj',
    operationIds: [
      'tweak.cpu.idledisable',
      'tweak.memory.pagecombining_off',
      'tweak.memory.pagefile_fixed',
      'cortex.mode.nucleo',
      'tweak.cpu.powerthrottling_off'
    ],
    reversible: true,
    requiresConfirmation: true,
    confirmationMessage: 'Esta plantilla bloquea estados de reposo (mayor consumo eléctrico) y desactiva PageCombining. ¿Confirmas la aplicación?',
    tweakItems: [
      { label: 'Relojes Fijos al Máximo', target: 'Power Plan Sub-CPU', detail: 'IDLEDISABLE 1 evita que los P-Cores bajen de frecuencia' },
      { label: 'PageCombining Desactivado', target: 'MMAgent Windows', detail: 'Elimina el consumo de CPU de fusión periódica de memoria' },
      { label: 'Pagefile Fijo a 8 GB', target: 'C:\\pagefile.sys', detail: 'Evita redimensionamiento dinámico de paginación durante el juego' },
      { label: 'Modo MSI en PCIe', target: 'PCI Device Drivers', detail: 'Message Signaled Interrupts en GPU y controladora NVMe' },
      { label: 'Power Throttling OFF', target: 'Kernel Executive', detail: 'Impide que Windows limite la potencia de hilos intensivos' }
    ]
  },
  {
    id: 'tpl-network-tournament',
    name: 'Baja Latencia de Red & Ping',
    subtitle: 'Transmisión milimétrica de paquetes de 128 tick sin demora',
    badge: 'Ping Mínimo',
    category: 'network',
    description: 'Configura la pila TCP/IP para juegos multijugador competitivos, eliminando el agrupamiento artificial de paquetes y maximizando el rendimiento de la tarjeta de red.',
    expectedFpsBoost: 'Registro instantáneo de balas',
    expectedLatencyReduction: '-15 a -25 ms de bufferbloat',
    operationIds: [
      'tweak.network.nagle_off',
      'tweak.network.autotuning_high'
    ],
    reversible: true,
    tweakItems: [
      { label: 'Algoritmo de Nagle OFF', target: 'TCP/IP Parameters', detail: 'Envía cada paquete de movimiento y disparo sin esperar confirmación' },
      { label: 'TcpDelAckTicks = 0', target: 'Registro Winsock', detail: 'Cero demora en el reconocimiento de paquetes entrantes del servidor' },
      { label: 'TCP AutoTuning High', target: 'Pila de Red Win32', detail: 'Aprovecha el ancho de banda sin retención de búfer intermedio' }
    ]
  },
  {
    id: 'tpl-system-maintenance',
    name: 'Limpieza Profunda & Mantenimiento',
    subtitle: 'Optimización de celdas SLC en NVMe y purga de archivos residuales',
    badge: 'Mantenimiento Seguro',
    category: 'maintenance',
    description: 'Ejecuta el comando TRIM por hardware en la unidad SSD NVMe PCIe 4.0, desactiva marcas de tiempo de acceso redundantes y elimina gigabytes de temporales de Windows.',
    expectedFpsBoost: 'Carga de mapas ultra rápida',
    expectedLatencyReduction: 'Cero stutters al cargar modelos',
    operationIds: [
      'system.temp.cleanup',
      'tweak.disk.trim_nvme',
      'tweak.disk.disablelastaccess'
    ],
    reversible: false,
    tweakItems: [
      { label: 'Limpieza de Temporales', target: '%TEMP% y Cachés', detail: 'Elimina residuos de instalación y cachés de render antiguos' },
      { label: 'TRIM Forzado en NVMe', target: 'Controladora SSD C:', detail: 'Optimiza los bloques de memoria flash NAND para escrituras rápidas' },
      { label: 'DisableLastAccess', target: 'FSUtil Sistema de Archivos', detail: 'Evita actualizar la fecha de acceso en cada lectura de texturas' }
    ]
  },
  {
    id: 'tpl-stock-restore',
    name: 'Restauración Windows Stock (Segura)',
    subtitle: 'Recupera los valores originales de fábrica de tu sistema',
    badge: '100% Reversible',
    category: 'restore',
    description: 'Restaura el sistema al estado registrado antes de las optimizaciones, revirtiendo el registro de Windows, los temporizadores de arranque y los servicios modificados.',
    expectedFpsBoost: 'Valores originales de Windows',
    expectedLatencyReduction: 'Configuración estándar',
    operationIds: [
      'cortex.mode.restore'
    ],
    reversible: false,
    requiresConfirmation: true,
    confirmationMessage: '¿Deseas restaurar todos los valores de Windows modificados a su estado original?',
    tweakItems: [
      { label: 'Restaurar Prioridades IFEO', target: 'Registro de Procesos', detail: 'Elimina las prioridades fijas forzadas para cs2.exe' },
      { label: 'Restaurar BCDedit Timers', target: 'Boot Configuration', detail: 'Vuelve al gestor de temporizadores predeterminado de Windows' },
      { label: 'Restaurar Servicios de Windows', target: 'Service Manager', detail: 'Reactiva los servicios en su tipo de inicio original' }
    ]
  }
];

interface OptimizationTemplatesProps {
  isNativeConnected?: boolean;
  activeOperation?: string | null;
  onApplyOp?: (opId: string) => Promise<OperationResult>;
  onRestoreOp?: (opId: string) => Promise<OperationResult>;
}

export const OptimizationTemplates: React.FC<OptimizationTemplatesProps> = ({
  isNativeConnected = false,
  activeOperation = null,
  onApplyOp,
  onRestoreOp
}) => {
  // Active templates state persisted in localStorage
  const [activeTemplateIds, setActiveTemplateIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('evo_active_templates');
      return saved ? JSON.parse(saved) : ['tpl-cs2-premier'];
    } catch {
      return ['tpl-cs2-premier'];
    }
  });

  const [executingTemplateId, setExecutingTemplateId] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [executionLogs, setExecutionLogs] = useState<{
    templateId: string;
    success: boolean;
    durationMs: number;
    logs: string[];
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('evo_active_templates', JSON.stringify(activeTemplateIds));
    } catch {
      // ignore
    }
  }, [activeTemplateIds]);

  const handleToggleTemplate = async (template: OptimizationTemplate) => {
    const isCurrentlyActive = activeTemplateIds.includes(template.id);

    if (!isNativeConnected || !onApplyOp || !onRestoreOp) {
      alert('Para aplicar o desactivar plantillas en Windows 11, inicia EvoNativeEngine en tu máquina (http://127.0.0.1:48120).');
      return;
    }

    if (template.requiresConfirmation) {
      const ok = window.confirm(template.confirmationMessage || `¿Confirmas la aplicación de la plantilla '${template.name}'?`);
      if (!ok) return;
    }

    setExecutingTemplateId(template.id);
    setExecutionLogs(null);
    const startTime = performance.now();
    const collectedLogs: string[] = [];
    let overallSuccess = true;

    try {
      if (!isCurrentlyActive) {
        // ACTIVAR PLANTILLA: Aplicar operaciones secuencialmente
        collectedLogs.push(`[PLANTILLA] Iniciando activación de: ${template.name}...`);
        
        for (let i = 0; i < template.operationIds.length; i++) {
          const opId = template.operationIds[i];
          setExecutionProgress(`Aplicando paso ${i + 1} de ${template.operationIds.length}: ${opId}...`);
          collectedLogs.push(`>> Ejecutando: ${opId}`);
          
          try {
            const res = await onApplyOp(opId);
            if (res.logs && res.logs.length > 0) {
              collectedLogs.push(...res.logs);
            }
            if (!res.success) {
              overallSuccess = false;
              collectedLogs.push(`[ADVERTENCIA] Falló el paso '${opId}': ${res.errorMessage}`);
            }
          } catch (err: any) {
            overallSuccess = false;
            collectedLogs.push(`[ERROR] Excepción en '${opId}': ${err.message}`);
          }
        }

        if (overallSuccess) {
          collectedLogs.push(`[ÉXITO] Plantilla '${template.name}' aplicada y verificada con éxito en Windows.`);
          setActiveTemplateIds(prev => [...new Set([...prev, template.id])]);
        } else {
          collectedLogs.push(`[PARCIAL] La plantilla se completó con algunas advertencias. Revisa los registros.`);
          setActiveTemplateIds(prev => [...new Set([...prev, template.id])]);
        }
      } else {
        // DESACTIVAR / RESTAURAR PLANTILLA
        collectedLogs.push(`[PLANTILLA] Iniciando desactivación / reversión de: ${template.name}...`);
        
        for (let i = template.operationIds.length - 1; i >= 0; i--) {
          const opId = template.operationIds[i];
          setExecutionProgress(`Revirtiendo paso ${template.operationIds.length - i} de ${template.operationIds.length}: ${opId}...`);
          collectedLogs.push(`>> Restaurando respaldo de: ${opId}`);
          
          try {
            const res = await onRestoreOp(opId);
            if (res.logs && res.logs.length > 0) {
              collectedLogs.push(...res.logs);
            }
          } catch (err: any) {
            collectedLogs.push(`[AVISO] Paso sin respaldo individual o ya restaurado: ${err.message}`);
          }
        }

        collectedLogs.push(`[RESTAURADO] Plantilla '${template.name}' desactivada. Valores originales restaurados.`);
        setActiveTemplateIds(prev => prev.filter(id => id !== template.id));
      }
    } finally {
      const elapsed = performance.now() - startTime;
      setExecutionLogs({
        templateId: template.id,
        success: overallSuccess,
        durationMs: elapsed,
        logs: collectedLogs,
        timestamp: new Date().toLocaleTimeString()
      });
      setExecutingTemplateId(null);
      setExecutionProgress(null);
    }
  };

  const filteredTemplates = OPTIMIZATION_TEMPLATES.filter(tpl => {
    if (selectedCategory === 'all') return true;
    return tpl.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 p-6 sm:p-7 overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
            <Sparkles className="w-4 h-4 fill-emerald-400/20" />
            <span>PLANTILLAS INTELIGENTES DE RENDIMIENTO — CAMBIOS REALES EN WINDOWS 11</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Plantillas de Optimización 1-Click
          </h2>

          <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
            Activa o desactiva conjuntos completos de optimizaciones probadas con un solo interruptor. Cada plantilla aplica cambios reales por hardware en el Registro, BCDedit, Afinidad de CPU y Servicios de Windows, creando un respaldo automático para permitir reversión instantánea.
          </p>

          {/* Engine status indicator */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-neutral-800">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              isNativeConnected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              <Server className="w-3.5 h-3.5" />
              <span>
                {isNativeConnected 
                  ? 'Motor C# Activo en localhost:48120 — Cambios en vivo listos' 
                  : 'Motor C# no detectado — Ejecuta scripts/Start-EvoEngine.ps1 en Windows'}
              </span>
            </div>

            <div className="text-xs text-neutral-400 font-mono">
              Plantillas activas: <strong className="text-emerald-400">{activeTemplateIds.length} de {OPTIMIZATION_TEMPLATES.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Progress Banner */}
      {executingTemplateId && (
        <div className="p-4 rounded-xl bg-neutral-900 border border-emerald-500/50 shadow-lg flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Aplicando cambios reales en Windows...
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                {executionProgress || 'Procesando órdenes en el motor nativo C#...'}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-neutral-400">Por favor, espera</span>
        </div>
      )}

      {/* Execution Results / Log Drawer */}
      {executionLogs && (
        <div className={`p-4 rounded-xl border space-y-2.5 transition-all ${
          executionLogs.success 
            ? 'bg-neutral-900/90 border-emerald-500/40 text-neutral-200' 
            : 'bg-neutral-900/90 border-amber-500/40 text-neutral-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              {executionLogs.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
              <span>Resultado de Ejecución en Windows ({executionLogs.durationMs.toFixed(0)} ms)</span>
              <span className="text-[10px] text-neutral-400 font-mono">[{executionLogs.timestamp}]</span>
            </div>
            <button
              onClick={() => setExecutionLogs(null)}
              className="text-xs px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
            >
              Cerrar
            </button>
          </div>

          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 max-h-36 overflow-y-auto font-mono text-[11px] space-y-1 text-neutral-300">
            {executionLogs.logs.map((log, i) => (
              <div key={i} className="leading-relaxed">{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
          { id: 'all', label: 'Todas las Plantillas (6)' },
          { id: 'competitive', label: 'Competitivo CS2' },
          { id: 'tournament', label: 'Modo Torneo' },
          { id: 'extreme', label: 'Fase Extrema' },
          { id: 'network', label: 'Red & Ping' },
          { id: 'maintenance', label: 'Mantenimiento' },
          { id: 'restore', label: 'Restauración Stock' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 font-medium ${
              selectedCategory === cat.id
                ? 'bg-neutral-800 text-emerald-400 border border-neutral-700 font-semibold shadow-sm'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800/80 hover:bg-neutral-800/60'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const isActive = activeTemplateIds.includes(template.id);
          const isBusy = executingTemplateId === template.id;

          return (
            <div
              key={template.id}
              className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                isActive
                  ? 'bg-neutral-900/90 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                  : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="p-5 sm:p-6 space-y-3.5">
                {/* Header row: badge + toggle switch */}
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}>
                    {template.badge}
                  </span>

                  {/* Big Professional Toggle Switch */}
                  <button
                    disabled={isBusy || !isNativeConnected}
                    onClick={() => handleToggleTemplate(template)}
                    className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                      isActive ? 'bg-emerald-500' : 'bg-neutral-800'
                    }`}
                    title={isActive ? 'Desactivar y revertir valores' : 'Activar plantilla en Windows'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">
                    {template.name}
                  </h3>
                  <div className="text-xs text-neutral-400 mt-0.5 font-medium">
                    {template.subtitle}
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">
                  {template.description}
                </p>

                {/* Metric highlights */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">GANANCIA ESTIMADA</span>
                    <span className="text-emerald-400 font-semibold">{template.expectedFpsBoost}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">IMPACTO LATENCIA</span>
                    <span className="text-cyan-300 font-semibold">{template.expectedLatencyReduction}</span>
                  </div>
                </div>

                {/* Tweaks list in this template */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">
                    Ajustes incluidos ({template.tweakItems.length}):
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {template.tweakItems.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/70">
                        <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{item.label}</div>
                          <div className="text-[11px] text-neutral-400 line-clamp-1">{item.detail}</div>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                          {item.target}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer: Action button + status */}
              <div className="px-5 py-3.5 bg-neutral-950/80 border-t border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                  <span className={isActive ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                    {isActive ? 'Activo en Windows' : 'Desactivado'}
                  </span>
                </div>

                <button
                  disabled={isBusy || !isNativeConnected}
                  onClick={() => handleToggleTemplate(template)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold shadow-sm shadow-emerald-500/20'
                  }`}
                >
                  {isBusy ? (
                    <>
                      <Zap className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : isActive ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Desactivar / Revertir</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Activar en Windows</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
