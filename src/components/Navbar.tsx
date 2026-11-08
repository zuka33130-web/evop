import React from 'react';
import { Download, Zap, Server } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onDownloadZip: () => void;
  isDownloading: boolean;
  isNativeConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onDownloadZip,
  isDownloading,
  isNativeConnected = false
}) => {
  const navItems = [
    { id: 'overview', label: 'Panel Principal' },
    { id: 'diagnostics', label: 'Diagnóstico C#' },
    { id: 'godmode', label: 'Fase 3 Ultra & God Mode' },
    { id: 'runner', label: '15 Modos Cortex' },
    { id: 'tweaks', label: '110 Tweaks' },
    { id: 'fps_calculator', label: 'Calculador FPS' },
    { id: 'lab', label: 'Laboratorio A/B & EVO' },
    { id: 'autoexec', label: 'CS2 CFG & Video' },
    { id: 'bios', label: 'Guía BIOS' },
    { id: 'files', label: 'Archivos & Scripts' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Brand title wordmark */}
        <div 
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 transition-colors">
            <Zap className="w-4 h-4 fill-emerald-400/30" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white font-sans">
            RYZER <span className="text-emerald-400">CORTEX ULTRA</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700/60 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isNativeConnected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title={isNativeConnected ? 'Motor C# Activo en 127.0.0.1:48120' : 'Motor C# Desconectado (Modo Web)'}
          >
            <span className={`w-2 h-2 rounded-full ${isNativeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
            <span className="hidden sm:inline">{isNativeConnected ? 'C# Conectado' : 'C# Desconectado'}</span>
          </button>

          <button
            onClick={onDownloadZip}
            disabled={isDownloading}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm shadow-emerald-500/10 active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Generando...' : 'Descargar .ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav scrollbar */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-neutral-800/80 no-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-neutral-800 text-emerald-400 border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
