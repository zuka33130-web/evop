import React, { useState } from 'react';
import { Cpu, HardDrive, Monitor, Sliders, Layers, CheckCircle2, Server, Eye } from 'lucide-react';
import { HardwareProfile } from '../data/optimizerData';
import { SystemHardwareReport } from '../services/nativeBridge';

interface HardwareProfileHeaderProps {
  hardware: HardwareProfile;
  setHardware: React.Dispatch<React.SetStateAction<HardwareProfile>>;
  isNativeConnected?: boolean;
  realDiagnostics?: SystemHardwareReport | null;
  onOpenDiagnostics?: () => void;
}

export const HardwareProfileHeader: React.FC<HardwareProfileHeaderProps> = ({
  hardware,
  setHardware,
  isNativeConnected = false,
  realDiagnostics = null,
  onOpenDiagnostics
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showRealHardwareView, setShowRealHardwareView] = useState(false);

  const hasRealData = isNativeConnected && realDiagnostics !== null;

  const affinityMask = Math.pow(2, hardware.pCores) - 1;
  const affinityHex = '0x' + affinityMask.toString(16).toUpperCase();

  const handlePcoresChange = (val: number) => {
    setHardware(prev => ({
      ...prev,
      pCores: val,
      threads: val + prev.eCores
    }));
  };

  const handleRamChange = (val: number) => {
    setHardware(prev => ({
      ...prev,
      ramGB: val
    }));
  };

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              hasRealData 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40' 
                : 'bg-neutral-800/80 text-neutral-400 border-neutral-700'
            }`}>
              <Server className="w-3 h-3" />
              {hasRealData 
                ? `Motor C# Activo (${realDiagnostics.hostName})` 
                : 'Motor C# Desconectado (Modo Web)'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{hasRealData && showRealHardwareView ? 'Hardware Real del Sistema' : 'Hardware Objetivo Optimizado'}</span>
            <span aria-hidden="true">·</span>
            <span>{hasRealData && showRealHardwareView ? realDiagnostics.operatingSystem.name : 'ASUS ExpertCenter PN64'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {hasRealData && showRealHardwareView ? 'Diagnóstico Real del Sistema (C# WMI / Win32)' : 'Perfil de Ajuste de Latencia & Frecuencia'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            {hasRealData && showRealHardwareView
              ? `Datos reales de solo lectura leídos directamente por EvoNativeEngine en ${realDiagnostics.hostName} sin simulación.`
              : 'Alineado para eliminar el cuello de botella del Intel Thread Director y fijar el hilo maestro de Source 2 a los núcleos Golden Cove de 4.4 GHz.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {hasRealData && (
            <button
              onClick={() => setShowRealHardwareView(!showRealHardwareView)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showRealHardwareView ? 'Ver Perfil PN64' : 'Ver Hardware Real'}</span>
            </button>
          )}

          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Panel Motor C#</span>
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700/80 rounded-lg border border-neutral-700 transition-colors whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEditing ? 'Guardar Perfil' : 'Personalizar Cores / RAM'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Procesador</span>
          </div>
          <div className="text-sm font-semibold text-white truncate" title={hasRealData && showRealHardwareView ? realDiagnostics.processor.name : hardware.cpuModel}>
            {hasRealData && showRealHardwareView ? realDiagnostics.processor.name : 'i3-1220P'}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono tabular-nums truncate">
            {hasRealData && showRealHardwareView 
              ? `${realDiagnostics.processor.physicalCores}C / ${realDiagnostics.processor.logicalProcessors}T`
              : `${hardware.pCores}P + ${hardware.eCores}E (${hardware.threads}T)`}
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hasRealData && showRealHardwareView ? 'Windows OS' : 'Frecuencia Boost'}</span>
          </div>
          <div className="text-sm font-semibold text-white font-mono tabular-nums truncate">
            {hasRealData && showRealHardwareView ? `Build ${realDiagnostics.operatingSystem.buildNumber}` : '4.4 GHz'}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono truncate">
            {hasRealData && showRealHardwareView ? realDiagnostics.operatingSystem.architecture : 'Bloqueado 100%'}
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Memoria RAM</span>
          </div>
          <div className="text-sm font-semibold text-white font-mono tabular-nums">
            {hasRealData && showRealHardwareView ? `${realDiagnostics.memory.totalGb} GB` : `${hardware.ramGB} GB DDR4`}
          </div>
          <div className="text-[11px] text-neutral-500 truncate">
            {hasRealData && showRealHardwareView 
              ? `${realDiagnostics.memory.availableGb} GB libres` 
              : 'Dual Channel 3200'}
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Almacenamiento</span>
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {hasRealData && showRealHardwareView && realDiagnostics.storageDrives[0] 
              ? `${realDiagnostics.storageDrives[0].driveLetter} ${realDiagnostics.storageDrives[0].freeGb} GB` 
              : 'NVMe PCIe 4.0'}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono truncate">
            {hasRealData && showRealHardwareView && realDiagnostics.storageDrives[0]
              ? `${realDiagnostics.storageDrives[0].fileSystem} (${realDiagnostics.storageDrives[0].freePercentage}% Libre)`
              : 'TRIM Habilitado'}
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Controlador GPU</span>
          </div>
          <div className="text-sm font-semibold text-white truncate" title={hasRealData && showRealHardwareView && realDiagnostics.graphicsCards[0] ? realDiagnostics.graphicsCards[0].name : hardware.gpuModel}>
            {hasRealData && showRealHardwareView && realDiagnostics.graphicsCards[0] 
              ? realDiagnostics.graphicsCards[0].name 
              : 'Intel UHD iGPU'}
          </div>
          <div className="text-[11px] text-amber-400/90 font-mono truncate">
            {hasRealData && showRealHardwareView && realDiagnostics.graphicsCards[0]
              ? (realDiagnostics.graphicsCards[0].adapterRamMb > 0 ? `${realDiagnostics.graphicsCards[0].adapterRamMb} MB VRAM` : 'VRAM Compartida')
              : 'HAGS Desactivado'}
          </div>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hasRealData && showRealHardwareView ? 'Host & Nivel' : 'Máscara Afinidad'}</span>
          </div>
          <div className="text-sm font-semibold text-emerald-400 font-mono tabular-nums truncate">
            {hasRealData && showRealHardwareView ? realDiagnostics.hostName : affinityHex}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono truncate">
            {hasRealData && showRealHardwareView 
              ? (realDiagnostics.isElevated ? 'Privilegio Admin' : 'Usuario Estándar')
              : `Cores 0 a ${hardware.pCores - 1}`}
          </div>
        </div>
      </div>

      {/* Editing drawer if toggled */}
      {isEditing && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 bg-neutral-950/40 p-4 rounded-lg">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
            Ajuste Dinámico de Parámetros de Generación
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">
                Núcleos P-Core asignados a CS2:
              </label>
              <div className="flex gap-2">
                {[1, 2, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePcoresChange(num)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border ${
                      hardware.pCores === num
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {num} P-Cores ({num === 2 ? 'i3-1220P' : `${num} Cores`})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">
                Capacidad de Memoria RAM:
              </label>
              <div className="flex gap-2">
                {[8, 16, 32].map(num => (
                  <button
                    key={num}
                    onClick={() => handleRamChange(num)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border ${
                      hardware.ramGB === num
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {num} GB
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <div className="text-xs text-neutral-400">
                Resultado de generación:
              </div>
              <div className="text-xs font-mono text-emerald-400 mt-1">
                CS2 Steam: <span className="text-neutral-200">-threads {hardware.pCores}</span> · Pagefile: <span className="text-neutral-200">4096MB</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
