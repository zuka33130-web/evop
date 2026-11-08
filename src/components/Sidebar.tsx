import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Zap, 
  Trash2,
  Crosshair, 
  Terminal, 
  BookOpen, 
  Download, 
  Menu,
  X,
  Server
} from 'lucide-react';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isNativeConnected?: boolean;
  onDownloadZip?: () => void;
  isDownloading?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isNativeConnected = false,
  onDownloadZip,
  isDownloading = false
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    { id: 'advisor', label: 'Auditor local', sublabel: 'Hardware, software y recomendaciones', icon: Server, badge: 'Local' },
    { id: 'stability', label: 'Estabilidad y 1% Low', sublabel: 'Capturas reales y comparación', icon: Crosshair, badge: 'Medido' },
    { id: 'native-operations', label: 'Operaciones Windows', sublabel: 'Catálogo real y restauración', icon: Server, badge: 'Nativo' },
    {
      id: 'dashboard',
      label: 'Panel de Control',
      sublabel: 'Dashboard general del hardware',
      icon: LayoutDashboard,
      badge: 'i3-1220P'
    },
    {
      id: 'optimization',
      label: 'Centro de Optimización',
      sublabel: 'Plantillas 1-Click & Tweaks',
      icon: Zap,
      badge: '110 Tweaks'
    },
    {
      id: 'cleaner',
      label: 'Limpieza inteligente',
      sublabel: 'Vista previa, cuarentena y restauración',
      icon: Trash2,
      badge: 'EvoClean'
    },
    {
      id: 'presentmon',
      label: 'Laboratorio PresentMon',
      sublabel: 'Telemetría empírica de frametimes',
      icon: Crosshair,
      badge: 'Empírico'
    },
    {
      id: 'console',
      label: 'Consola de Ejecución',
      sublabel: 'Logs del motor C# / DOS',
      icon: Terminal,
      badge: 'Kernel/OS'
    },
    {
      id: 'knowledge',
      label: 'Base de Conocimiento',
      sublabel: 'Mitos desmentidos con ciencia',
      icon: BookOpen,
      badge: 'Forense'
    }
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-neutral-950 border-b border-neutral-800 p-4 flex items-center justify-between sticky top-0 z-50">
        <div 
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-400/20" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white font-sans">
            EVO<span className="text-emerald-400">OPTIMIZER</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isNativeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-neutral-950 border-r border-neutral-800/80 flex flex-col select-none transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Brand & Hardware Target Info */}
        <div className="p-5 border-b border-neutral-800/80">
          <div 
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 transition-colors shadow-sm">
              <Zap className="w-5 h-5 fill-emerald-400/20" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>EVO<span className="text-emerald-400">OPTIMIZER</span></span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/30">
                  ULTRA
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 font-mono">
                ASUS PN64 · CS2 Booster
              </div>
            </div>
          </div>

          {/* Status Badge: C# Native Engine */}
          <div className="mt-4 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isNativeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
              <span className="text-neutral-300 font-medium">Motor C# (.NET 8)</span>
            </div>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
              isNativeConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-neutral-800 text-neutral-500 border-neutral-700'
            }`}>
              {isNativeConnected ? '127.0.0.1:48120' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Lista de Navegación Lateral con Limpieza incluida */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500 px-3 py-2">
            Navegación del Sistema
          </div>

          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group ${
                  isActive
                    ? 'bg-neutral-900 border border-emerald-500/40 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-neutral-900 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-500">0{index + 1}.</span>
                      <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-neutral-900 text-neutral-500 border-neutral-800 group-hover:border-neutral-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer del Sidebar con Descarga de Paquete */}
        <div className="p-4 border-t border-neutral-800/80 bg-neutral-950 space-y-2">
          {onDownloadZip && (
            <button
              onClick={onDownloadZip}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Generando .ZIP...' : 'Descargar Scripts .ZIP'}</span>
            </button>
          )}

          <div className="text-center text-[10px] text-neutral-500 font-mono pt-1">
            RYZER CORTEX ULTRA · EvoClean & PresentMon
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}
    </>
  );
};
