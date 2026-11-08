import React, { useState } from 'react';
import { 
  Settings, 
  Copy, 
  Check, 
  Download, 
  Crosshair, 
  Folder, 
  HelpCircle, 
  Monitor, 
  Sliders, 
  Flame, 
  Sparkles 
} from 'lucide-react';
import { 
  generateAutoexecString, 
  generateLaunchOptionsString, 
  generateVideoTxtString 
} from '../data/optimizerData';
import { downloadSingleFile } from '../utils/zipGenerator';

export const AutoexecBuilder: React.FC = () => {
  const [activeCfgTab, setActiveCfgTab] = useState<'autoexec' | 'video' | 'launch'>('autoexec');
  const [showFps, setShowFps] = useState(true);
  const [fov, setFov] = useState(68);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const autoexecContent = generateAutoexecString({ showFps, fov });
  const videoTxtContent = generateVideoTxtString();
  const launchOptionsContent = generateLaunchOptionsString(8);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>Configurador de CS2: Autoexec, Video.txt & Parámetros Steam</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Ajustes de renderizado calibrados para la Intel UHD 64EU y los núcleos P-Core del i3-1220P.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveCfgTab('autoexec')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCfgTab === 'autoexec'
                ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            autoexec.cfg
          </button>
          <button
            onClick={() => setActiveCfgTab('video')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCfgTab === 'video'
                ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            video.txt (1280x960 FSR)
          </button>
          <button
            onClick={() => setActiveCfgTab('launch')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCfgTab === 'launch'
                ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Parámetros Steam
          </button>
        </div>
      </div>

      {/* TAB 1: AUTOEXEC.CFG */}
      {activeCfgTab === 'autoexec' && (
        <div className="space-y-6">
          <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sub-Tick & Red Competitiva Rate 786432</span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Elimina interpolación tardía, activa sleeping post-tick y reduce los efectos visuales innecesarios de la iGPU.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => downloadSingleFile('autoexec.cfg', autoexecContent)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar autoexec.cfg</span>
              </button>

              <button
                onClick={() => handleCopy(autoexecContent, 'autoexec')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all active:scale-95"
              >
                {copiedKey === 'autoexec' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'autoexec' ? '¡Copiado!' : 'Copiar autoexec.cfg'}</span>
              </button>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Telemetría de FPS In-Game (cl_showfps):
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFps(true)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md border ${
                    showFps 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  Activado (cl_showfps 1)
                </button>
                <button
                  onClick={() => setShowFps(false)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md border ${
                    !showFps 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  Oculto (cl_showfps 0)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Campo de Visión del Arma (viewmodel_fov): <span className="text-emerald-400 font-mono">{fov}</span>
              </label>
              <input
                type="range"
                min="54"
                max="68"
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                className="w-full accent-emerald-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 mt-1 font-mono">
                <span>54 (Estrecho)</span>
                <span>68 (Competitivo Máx)</span>
              </div>
            </div>
          </div>

          {/* Code preview */}
          <div className="relative rounded-xl border border-neutral-800 bg-[#09090b] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs font-mono text-neutral-400">
              <span>Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\autoexec.cfg</span>
              <span>Valve Source 2 CFG</span>
            </div>
            <pre className="p-4 text-xs font-mono text-neutral-300 max-h-80 overflow-y-auto leading-relaxed">
              <code>{autoexecContent}</code>
            </pre>
          </div>

          {/* Location instruction */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs text-neutral-300 leading-relaxed">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Folder className="w-4 h-4 text-emerald-400" />
              <span>Ruta de instalación de autoexec.cfg</span>
            </div>
            <p>
              Pega este archivo en:
              <code className="text-emerald-300 bg-neutral-950 px-2 py-1 rounded block mt-1 select-all font-mono">
                C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\autoexec.cfg
              </code>
            </p>
            <p className="flex items-center gap-1.5 text-neutral-400 pt-1">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Para verificar dentro de CS2, abre la consola y escribe una vez: <code className="font-mono text-white">exec autoexec</code></span>
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: VIDEO.TXT (CRITICAL FOR INTEL UHD 64EU) */}
      {activeCfgTab === 'video' && (
        <div className="space-y-6">
          <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>1280x960 4:3 Estirado + FidelityFX Super Resolution (FSR)</span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                La configuración gráfica obligatoria para no saturar la iGPU Intel UHD. <strong className="text-white">+25 FPS gratis</strong> con FSR Rendimiento (setting.fidelityfx_super_resolution: 2).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => downloadSingleFile('video.txt', videoTxtContent)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar video.txt</span>
              </button>

              <button
                onClick={() => handleCopy(videoTxtContent, 'video')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all active:scale-95"
              >
                {copiedKey === 'video' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'video' ? '¡Copiado!' : 'Copiar video.txt'}</span>
              </button>
            </div>
          </div>

          {/* Key settings highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Resolución de renderizado:</span>
              <strong className="text-sm text-white font-mono">1280 x 960 (4:3)</strong>
              <p className="text-[11px] text-neutral-400 mt-1">
                Aumenta el grosor visual de los modelos enemigos y aligera la carga en un 55% vs 1080p.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">FSR Rendimiento:</span>
              <strong className="text-sm text-emerald-400 font-mono">Valor 2 (Performance)</strong>
              <p className="text-[11px] text-neutral-400 mt-1">
                Escala internamente con algoritmo espacial de AMD. Imprescindible en gráficos integrados.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Sombras y Reflejos:</span>
              <strong className="text-sm text-cyan-400 font-mono">Bajo / Desactivado (0)</strong>
              <p className="text-[11px] text-neutral-400 mt-1">
                Elimina el cálculo de mapas de sombras dinámicas en tiempo real en la Intel UHD.
              </p>
            </div>
          </div>

          {/* Video preview */}
          <div className="relative rounded-xl border border-neutral-800 bg-[#09090b] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs font-mono text-neutral-400">
              <span>Steam\userdata\TU_STEAM_ID\730\local\cfg\video.txt</span>
              <span>Valve VideoConfig KeyValues</span>
            </div>
            <pre className="p-4 text-xs font-mono text-neutral-300 max-h-80 overflow-y-auto leading-relaxed">
              <code>{videoTxtContent}</code>
            </pre>
          </div>

          {/* Destination */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs text-neutral-300 leading-relaxed">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>Ruta de instalación de video.txt</span>
            </div>
            <p>
              Reemplaza el archivo existente en tu carpeta de usuario de Steam (sustituye TU_STEAM_ID por tu carpeta numérica):
              <code className="text-cyan-300 bg-neutral-950 px-2 py-1 rounded block mt-1 select-all font-mono">
                C:\Program Files (x86)\Steam\userdata\TU_STEAM_ID\730\local\cfg\video.txt
              </code>
            </p>
            <p className="text-neutral-400 pt-1">
              Nota: Si tienes varios IDs de Steam, el script maestro V7 (opción 14) copia automáticamente el archivo <code className="text-white font-mono">video.txt</code> a todas tus cuentas detectadas en tu disco.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: STEAM LAUNCH OPTIONS */}
      {activeCfgTab === 'launch' && (
        <div className="space-y-6">
          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-emerald-400" />
                  <span>Parámetros de Lanzamiento de Steam (Obligatorio)</span>
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Fija -threads 8 para no saturar los núcleos eficientes E-Cores y fuerza el render DirectX 11.
                </p>
              </div>

              <button
                onClick={() => handleCopy(launchOptionsContent, 'launch')}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
              >
                {copiedKey === 'launch' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'launch' ? '¡Parámetros Copiados!' : 'Copiar Parámetros'}</span>
              </button>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-emerald-300 select-all overflow-x-auto">
              <code>{launchOptionsContent}</code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <strong className="text-emerald-400 block mb-1">-threads 8 (No 10 ni 12):</strong>
                <span className="text-neutral-400 leading-relaxed">
                  El i3-1220P tiene 4 hilos en los núcleos de alto rendimiento (P-Cores) y 8 hilos en núcleos eficientes. Limitar a 8 evita que el motor sature los E-Cores lentos.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <strong className="text-cyan-400 block mb-1">-dx11 vs -vulkan:</strong>
                <span className="text-neutral-400 leading-relaxed">
                  En el 70% de las pruebas con Intel UHD Alder Lake, el backend DirectX 11 (-dx11) ofrece mayor consistencia de frametimes y menos micro-tirones que Vulkan.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
