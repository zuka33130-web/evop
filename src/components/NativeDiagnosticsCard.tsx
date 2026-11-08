import React from 'react';
import { 
  Cpu, 
  HardDrive, 
  Monitor, 
  Server, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink,
  Layers,
  AlertTriangle,
  Clock,
  Activity
} from 'lucide-react';
import { 
  SystemHardwareReport, 
  EngineStatus, 
  ConnectionStatus 
} from '../services/nativeBridge';

interface NativeDiagnosticsCardProps {
  status: ConnectionStatus;
  engineInfo: EngineStatus | null;
  diagnostics: SystemHardwareReport | null;
  error: string | null;
  isScanning: boolean;
  onReconnect: () => void;
  onRefresh: () => void;
  onApplyRealHardware?: (diag: SystemHardwareReport) => void;
}

export const NativeDiagnosticsCard: React.FC<NativeDiagnosticsCardProps> = ({
  status,
  engineInfo,
  diagnostics,
  error,
  isScanning,
  onReconnect,
  onRefresh,
  onApplyRealHardware
}) => {
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const isConnected = status === 'connected';

  return (
    <div className="space-y-6">
      {/* Engine Status Top Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isConnected 
          ? 'bg-emerald-950/20 border-emerald-500/40' 
          : status === 'connecting'
          ? 'bg-cyan-950/20 border-cyan-500/40'
          : 'bg-neutral-900/90 border-neutral-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isConnected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}>
              <Server className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isConnected 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : status === 'connecting'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-ping' : status === 'connecting' ? 'bg-cyan-400' : 'bg-amber-400'
                  }`} />
                  {isConnected ? 'Motor C# .NET Conectado' : status === 'connecting' ? 'Conectando...' : 'Motor C# Desconectado (Modo Web)'}
                </span>

                {engineInfo && (
                  <>
                    <span className="text-xs font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                      PID: {engineInfo.processId}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      engineInfo.isElevated 
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}>
                      {engineInfo.isElevated ? 'Privilegios: Administrador' : 'Privilegios: Usuario Estándar'}
                    </span>
                  </>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white">
                {isConnected ? 'Enlace IPC Local Establecido (127.0.0.1:48120)' : 'Arquitectura Nativa Windows 11 — Comunicación IPC'}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl leading-relaxed">
                {isConnected 
                  ? 'El motor nativo en C# (.NET 8) está ejecutándose en tu PC. Todas las operaciones de diagnóstico son reales, de solo lectura y consultadas directamente desde el kernel y WMI de Windows.'
                  : 'Para leer el hardware real de tu equipo sin simulación ni valores ficticios, inicia EvoNativeEngine en tu Windows 11.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            {isConnected ? (
              <>
                <button
                  onClick={onRefresh}
                  disabled={isScanning}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Escaneando...' : 'Escanear Hardware'}</span>
                </button>

                {diagnostics && onApplyRealHardware && (
                  <button
                    onClick={() => onApplyRealHardware(diagnostics)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Usar en Perfil</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onReconnect}
                disabled={status === 'connecting'}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
                <span>Reintentar Conexión</span>
              </button>
            )}
          </div>
        </div>

        {/* Real Error display if any */}
        {error && !isConnected && (
          <div className="mt-4 p-3.5 bg-neutral-950/80 border border-rose-900/60 rounded-xl text-xs flex items-start gap-2.5 text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-200">Estado de la conexión local:</span>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-400">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* When Connected: Display REAL Hardware Diagnostics */}
      {isConnected && diagnostics && (
        <div className="space-y-6">
          {/* Diagnostic Metadata Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-neutral-900/70 border border-neutral-800 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              <span className="text-neutral-400">Host: <strong className="text-white font-mono">{diagnostics.hostName}</strong></span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-400">Plataforma: <strong className="text-emerald-400 font-mono">{diagnostics.isWindowsPlatform ? 'Windows NT Nativo' : 'Unix / Emulado'}</strong></span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Tiempo de consulta WMI: <strong className="text-white">{diagnostics.executionTimeMs.toFixed(1)} ms</strong>
              </span>
              <span className="text-neutral-600">|</span>
              <span>{new Date(diagnostics.queriedAtUtc).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* 5 Real Diagnostic Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Operating System */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. Sistema Operativo Real</span>
                </div>
                <div className="text-base font-bold text-white mb-1">
                  {diagnostics.operatingSystem.name}
                </div>
                <div className="text-xs text-neutral-400 font-mono space-y-1">
                  <div>Versión: <span className="text-neutral-200">{diagnostics.operatingSystem.version}</span></div>
                  <div>Build: <span className="text-neutral-200">{diagnostics.operatingSystem.buildNumber}</span></div>
                  <div>Arquitectura: <span className="text-neutral-200">{diagnostics.operatingSystem.architecture}</span></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 font-mono flex items-center justify-between">
                <span>Tiempo encendido:</span>
                <span className="text-emerald-400">{diagnostics.operatingSystem.uptimeHours} h</span>
              </div>
            </div>

            {/* 2. Processor */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 mb-2">
                  <Cpu className="w-4 h-4" />
                  <span>2. Procesador (CPU) Real</span>
                </div>
                <div className="text-base font-bold text-white mb-1 truncate" title={diagnostics.processor.name}>
                  {diagnostics.processor.name}
                </div>
                <div className="text-xs text-neutral-400 font-mono space-y-1">
                  <div>Núcleos Físicos: <span className="text-neutral-200">{diagnostics.processor.physicalCores}</span></div>
                  <div>Hilos Lógicos: <span className="text-neutral-200">{diagnostics.processor.logicalProcessors}</span></div>
                  <div>Fabricante: <span className="text-neutral-200">{diagnostics.processor.manufacturer}</span></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 font-mono flex items-center justify-between">
                <span>Reloj Máximo:</span>
                <span className="text-cyan-400">{diagnostics.processor.maxClockSpeedMhz > 0 ? `${diagnostics.processor.maxClockSpeedMhz} MHz` : 'Detectado por driver'}</span>
              </div>
            </div>

            {/* 3. Memory RAM */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-2">
                  <Layers className="w-4 h-4" />
                  <span>3. Memoria RAM Real</span>
                </div>
                <div className="text-base font-bold text-white mb-1">
                  {diagnostics.memory.totalGb} GB Total
                </div>
                <div className="text-xs text-neutral-400 font-mono space-y-1">
                  <div>Disponible: <span className="text-emerald-300">{diagnostics.memory.availableGb} GB</span></div>
                  <div>En Uso: <span className="text-neutral-200">{diagnostics.memory.usedGb} GB ({diagnostics.memory.usedPercentage}%)</span></div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-950 rounded-full h-2 mt-2.5 overflow-hidden border border-neutral-800">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${diagnostics.memory.usedPercentage}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 font-mono flex items-center justify-between">
                <span>Llamada Win32:</span>
                <span className="text-indigo-400">GlobalMemoryStatusEx</span>
              </div>
            </div>
          </div>

          {/* 4. GPU Cards */}
          <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Monitor className="w-4 h-4" />
                <span>4. Controladores Gráficos (GPU) Reales ({diagnostics.graphicsCards.length})</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">Win32_VideoController</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {diagnostics.graphicsCards.map((gpu, idx) => (
                <div key={idx} className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white truncate" title={gpu.name}>
                      {gpu.name}
                    </span>
                    {gpu.isPrimary && (
                      <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        Primaria
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono space-y-0.5">
                    <div>Fabricante: <span className="text-neutral-200">{gpu.manufacturer}</span></div>
                    <div>Versión Driver: <span className="text-neutral-200">{gpu.driverVersion}</span></div>
                    <div>Memoria VRAM: <span className="text-amber-400">{gpu.adapterRamMb > 0 ? `${gpu.adapterRamMb} MB` : 'Compartida con sistema'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Storage Drives */}
          <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                <HardDrive className="w-4 h-4" />
                <span>5. Espacio Real en Discos de Almacenamiento ({diagnostics.storageDrives.length})</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">System.IO.DriveInfo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {diagnostics.storageDrives.map((disk, idx) => (
                <div key={idx} className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                        <span>{disk.driveLetter}</span>
                        <span className="text-neutral-400 font-normal text-xs">({disk.volumeLabel})</span>
                      </div>
                      {disk.isSystemDrive && (
                        <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                          Sistema C:
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-neutral-400 font-mono space-y-1">
                      <div>Espacio Libre: <strong className="text-emerald-400">{disk.freeGb} GB</strong> de {disk.totalGb} GB</div>
                      <div>Formato: <span className="text-neutral-300">{disk.fileSystem} ({disk.driveType})</span></div>
                      <div>Porcentaje Libre: <span className="text-white">{disk.freePercentage}%</span></div>
                    </div>

                    {/* Drive free/used visual bar */}
                    <div className="w-full bg-neutral-900 rounded-full h-2 mt-2 overflow-hidden border border-neutral-800">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          disk.freePercentage < 15 ? 'bg-rose-500' : disk.freePercentage < 30 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${100 - disk.freePercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* When Disconnected: Real Guide & Local Execution Instructions */}
      {!isConnected && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Instrucciones para Iniciar el Motor C# en tu Windows 11
                </h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Por seguridad y diseño arquitectónico (Regla 5 y Principio de Privacidad), el frontend web <strong className="text-neutral-200">no</strong> tiene acceso directo a tu hardware desde la nube. Requiere el servicio local seguro <code className="text-emerald-300 font-mono">EvoNativeEngine</code> corriendo en tu máquina Windows.
                </p>
              </div>
            </div>

            {/* Step 1 */}
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">
                  Opción A: Ejecutar con PowerShell desde la carpeta del proyecto
                </span>
                <button
                  onClick={() => handleCopy('.\\scripts\\Start-EvoEngine.ps1', 'step1')}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                >
                  {copiedCmd === 'step1' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'step1' ? '¡Copiado!' : 'Copiar comando'}</span>
                </button>
              </div>
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto">
                <code>.\scripts\Start-EvoEngine.ps1</code>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">
                  Opción B: Compilar y ejecutar directamente con .NET 8 SDK
                </span>
                <button
                  onClick={() => handleCopy('dotnet run --project src-native/EvoNativeEngine', 'step2')}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                >
                  {copiedCmd === 'step2' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'step2' ? '¡Copiado!' : 'Copiar comando'}</span>
                </button>
              </div>
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-neutral-300 overflow-x-auto">
                <code>dotnet run --project src-native/EvoNativeEngine</code>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">
                  Opción C: Doble clic en el lanzador integrado
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                Ejecuta <span className="text-emerald-300 font-bold">scripts\Run-EvoDesktop.bat</span> para iniciar tanto el motor C# como el frontend en un solo paso.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
