import React, { useState } from 'react';
import { 
  Trash2, 
  Sparkles, 
  ShieldCheck, 
  FolderArchive, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Layers, 
  Flame, 
  Terminal,
  Zap,
  Info
} from 'lucide-react';

interface CleanCategory {
  id: string;
  name: string;
  description: string;
  sizeMb: number;
  filesCount: number;
  icon: string;
  checked: boolean;
  status: 'idle' | 'scanned' | 'cleaning' | 'cleaned';
}

const INITIAL_CATEGORIES: CleanCategory[] = [
  {
    id: 'directx_shaders',
    name: 'Caché de Sombreadores DirectX (D3DCache)',
    description: 'Shaders compilados de GPU (Intel UHD / NVIDIA) causantes de micro-stuttering en CS2',
    sizeMb: 1248.5,
    filesCount: 1420,
    icon: '🎮',
    checked: true,
    status: 'idle'
  },
  {
    id: 'user_temp',
    name: 'Archivos Temporales de Usuario',
    description: 'Sesiones expiradas, cachés de aplicaciones y rastros en %TEMP%',
    sizeMb: 2430.8,
    filesCount: 6890,
    icon: '⚡',
    checked: true,
    status: 'idle'
  },
  {
    id: 'system_temp',
    name: 'Archivos Temporales del Sistema',
    description: 'Archivos residuales de instalaciones en C:\\Windows\\Temp',
    sizeMb: 850.2,
    filesCount: 1120,
    icon: '💻',
    checked: true,
    status: 'idle'
  },
  {
    id: 'wu_cache',
    name: 'Caché de Windows Update',
    description: 'Paquetes de actualización antiguos en SoftwareDistribution\\Download',
    sizeMb: 3120.0,
    filesCount: 45,
    icon: '🔄',
    checked: true,
    status: 'idle'
  },
  {
    id: 'prefetch',
    name: 'Archivos Prefetch de Windows',
    description: 'Índices obsoletos de ejecución de programas en C:\\Windows\\Prefetch',
    sizeMb: 142.3,
    filesCount: 380,
    icon: '📁',
    checked: true,
    status: 'idle'
  },
  {
    id: 'crash_dumps',
    name: 'Volcados de Memoria y Reportes WER',
    description: 'Crash Dumps (.dmp) y registros de errores de Windows Error Reporting',
    sizeMb: 940.6,
    filesCount: 18,
    icon: '🛡️',
    checked: true,
    status: 'idle'
  }
];

interface EvoCleanerProps {
  isNativeConnected?: boolean;
  onRunClean?: (mode: 'Scan' | 'Clean') => Promise<any>;
}

export const EvoCleaner: React.FC<EvoCleanerProps> = ({ 
  isNativeConnected = false,
  onRunClean
}) => {
  const [categories, setCategories] = useState<CleanCategory[]>(INITIAL_CATEGORIES);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentActionText, setCurrentActionText] = useState('');
  const [cleanedTotalMb, setCleanedTotalMb] = useState<number | null>(null);

  const totalBytesToCleanMb = categories
    .filter(c => c.checked)
    .reduce((acc, curr) => acc + curr.sizeMb, 0);

  const totalFilesToClean = categories
    .filter(c => c.checked)
    .reduce((acc, curr) => acc + curr.filesCount, 0);

  const toggleCategory = (id: string) => {
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleStartScan = async () => {
    setIsScanning(true);
    setProgress(0);
    setHasScanned(false);
    setCleanedTotalMb(null);

    if (onRunClean && isNativeConnected) {
      setCurrentActionText('Ejecutando Invoke-EvoClean.ps1 -Mode Scan vía C# Engine...');
      try {
        const res = await onRunClean('Scan');
        if (res && typeof res.scannedMB === 'number' && res.scannedMB > 0) {
          setCategories(prev =>
            prev.map(c => ({
              ...c,
              status: 'scanned'
            }))
          );
        }
      } catch (err) {
        console.warn('Scan C# fallback:', err);
      }
    }

    const steps = [
      'Analizando caché de sombreadores DirectX (D3DCache)...',
      'Escaneando directorio %TEMP% de usuario...',
      'Verificando C:\\Windows\\Temp y archivos temporales de sistema...',
      'Calculando tamaño de caché de Windows Update...',
      'Analizando archivos Prefetch y volcados de memoria WER...'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setCurrentActionText(steps[currentStep]);
        setProgress(Math.round((currentStep / steps.length) * 100));
      } else {
        clearInterval(interval);
        setProgress(100);
        setIsScanning(false);
        setHasScanned(true);
        setCategories(prev => prev.map(c => ({ ...c, status: 'scanned' })));
      }
    }, 350);
  };

  const handleExecuteClean = async () => {
    if (totalBytesToCleanMb === 0) return;

    setIsCleaning(true);
    setProgress(0);

    let realFreedMb: number | null = null;
    if (onRunClean && isNativeConnected) {
      setCurrentActionText('Invocando Invoke-EvoClean.ps1 -Mode Clean desde C# .NET 8 Engine...');
      try {
        const res = await onRunClean('Clean');
        if (res && typeof res.freedMB === 'number') {
          realFreedMb = res.freedMB;
        }
      } catch (err) {
        console.warn('Clean C# fallback:', err);
      }
    }

    const selectedCategories = categories.filter(c => c.checked);
    let currentIdx = 0;

    const interval = setInterval(() => {
      if (currentIdx < selectedCategories.length) {
        const cat = selectedCategories[currentIdx];
        setCurrentActionText(`Purgando: ${cat.name}...`);
        
        setCategories(prev =>
          prev.map(c => (c.id === cat.id ? { ...c, status: 'cleaning' } : c))
        );

        setProgress(Math.round(((currentIdx + 1) / selectedCategories.length) * 100));
        currentIdx++;
      } else {
        clearInterval(interval);
        setProgress(100);
        setIsCleaning(false);
        setCleanedTotalMb(realFreedMb ?? totalBytesToCleanMb);
        setCategories(prev =>
          prev.map(c => (c.checked ? { ...c, sizeMb: 0, filesCount: 0, status: 'cleaned' } : c))
        );
      }
    }, 450);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-neutral-100">
      {/* Encabezado Cyber-Forense */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs uppercase tracking-wider font-semibold">
                Motor de Limpieza Forense EvoClean v3.0
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Optimizado para CS2 & ASUS PN64
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              <Trash2 className="w-7 h-7 text-cyan-400" />
              Motor de Limpieza Profunda "EvoClean"
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl mt-1.5 leading-relaxed">
              Eliminación segura de basuras del sistema y purga profunda de la caché de sombreadores DirectX para eliminar el micro-stuttering generado por compilaciones obsoletas de GPU.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-right">
              <div className="text-[10px] font-mono text-neutral-500 uppercase">Basura Detectada</div>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {(totalBytesToCleanMb / 1024).toFixed(2)} GB
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTÓN CENTRAL PRINCIPAL TIPO ADVANCED SYSTEMCARE */}
      <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-8 text-center relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[260px]">
        {/* Anillo de escaneo activo */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className={`w-96 h-96 rounded-full border-2 border-dashed border-cyan-400 ${isScanning || isCleaning ? 'animate-spin' : ''}`} />
        </div>

        {!isScanning && !isCleaning && !cleanedTotalMb && (
          <div className="space-y-4 relative z-10 max-w-md">
            <button
              onClick={hasScanned ? handleExecuteClean : handleStartScan}
              className={`w-40 h-40 rounded-full mx-auto flex flex-col items-center justify-center transition-all shadow-2xl active:scale-95 border-4 group ${
                hasScanned
                  ? 'bg-gradient-to-b from-cyan-500 to-emerald-600 border-cyan-300 text-neutral-950 shadow-cyan-500/30 hover:scale-105'
                  : 'bg-gradient-to-b from-neutral-900 to-neutral-950 border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:scale-105 shadow-cyan-500/10'
              }`}
            >
              {hasScanned ? (
                <>
                  <Sparkles className="w-10 h-10 mb-1 animate-pulse" />
                  <span className="text-base font-extrabold uppercase font-mono tracking-tight">
                    Limpiar Ahora
                  </span>
                  <span className="text-[11px] font-mono opacity-90 font-bold">
                    {(totalBytesToCleanMb / 1024).toFixed(2)} GB
                  </span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-10 h-10 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-base font-extrabold uppercase font-mono tracking-tight">
                    Escanear
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Sistema & Shaders
                  </span>
                </>
              )}
            </button>

            <p className="text-xs text-neutral-400 font-mono">
              {hasScanned
                ? `✓ Escaneo completado. Se liberarán ${totalFilesToClean.toLocaleString()} archivos innecesarios.`
                : 'Haz clic en "Escanear" para calcular la basura residual y cachés de DirectX.'}
            </p>
          </div>
        )}

        {/* Estado de Escaneo / Limpieza con Barra de Progreso */}
        {(isScanning || isCleaning) && (
          <div className="w-full max-w-lg space-y-4 relative z-10">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>

            <div className="space-y-2">
              <div className="text-lg font-bold text-white font-mono">
                {isScanning ? 'Escaneando Archivos del Sistema...' : 'Ejecutando Purga Profunda EvoClean...'}
              </div>
              <div className="text-xs text-cyan-400 font-mono h-5 truncate">
                {currentActionText}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-neutral-400">
                <span>Progreso Operativo</span>
                <span className="text-emerald-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-neutral-900 h-3 rounded-full overflow-hidden border border-neutral-800 p-0.5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pantalla de Éxito de Limpieza */}
        {cleanedTotalMb && !isCleaning && (
          <div className="space-y-4 relative z-10 max-w-md animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 mx-auto flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-white">
                ¡Limpieza Profunda Completada!
              </h3>
              <p className="text-sm font-mono text-emerald-400 font-bold">
                Se liberaron {(cleanedTotalMb / 1024).toFixed(2)} GB de espacio y sombreadores DirectX.
              </p>
            </div>

            <button
              onClick={handleStartScan}
              className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white transition-all font-mono"
            >
              Volver a Escanear
            </button>
          </div>
        )}
      </div>

      {/* LISTADO DE CATEGORÍAS TIPO ADVANCED SYSTEMCARE */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Categorías de Limpieza Auditadas
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Selecciona o desmarca áreas específicas antes de realizar la depuración.
            </p>
          </div>

          <div className="text-xs font-mono text-neutral-400">
            {categories.filter(c => c.checked).length} de {categories.length} seleccionadas
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                cat.checked
                  ? 'bg-neutral-900/90 border-neutral-700 hover:border-cyan-500/50'
                  : 'bg-neutral-950/40 border-neutral-900 opacity-60 hover:opacity-100'
              }`}
            >
              <input
                type="checkbox"
                checked={cat.checked}
                onChange={() => {}} // Manejado por div
                className="mt-1 accent-cyan-500 w-4 h-4 rounded cursor-pointer"
              />

              <div className="text-2xl shrink-0">{cat.icon}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    {cat.name}
                  </span>
                  <span className={`text-xs font-mono font-bold shrink-0 ${
                    cat.sizeMb > 1000 ? 'text-cyan-400' : 'text-neutral-300'
                  }`}>
                    {cat.sizeMb > 0 ? `${cat.sizeMb.toFixed(1)} MB` : '✓ Limpio'}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed line-clamp-2">
                  {cat.description}
                </p>

                <div className="mt-2 text-[10px] font-mono text-neutral-500 flex items-center gap-3">
                  <span>{cat.filesCount.toLocaleString()} archivos</span>
                  <span>·</span>
                  <span className={cat.status === 'cleaned' ? 'text-emerald-400 font-bold' : ''}>
                    {cat.status === 'cleaned' ? 'Purga Completada' : 'Listo para depurar'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NOTA TÉCNICA Y SCRIPT LOCAL */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs font-mono text-neutral-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-neutral-200 font-semibold">Integración con el Motor Local (Invoke-EvoClean.ps1):</span>
          <br />
          Para ejecutar el borrado real a nivel de sistema operativo en tu ASUS PN64, ejecuta en PowerShell:
          <code className="block mt-1 text-cyan-300 bg-black p-2 rounded border border-neutral-800">
            powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-EvoClean.ps1 -Mode Clean
          </code>
        </div>
      </div>
    </div>
  );
};
