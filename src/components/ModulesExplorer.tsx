import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Copy, Check, Info, ShieldAlert, Cpu, Network, Zap, Sliders, HardDrive, Monitor, Terminal } from 'lucide-react';
import { allTweaksList, disabledServicesList, optimizationModules, TweakItem } from '../data/optimizerData';

export const ModulesExplorer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedTweakId, setExpandedTweakId] = useState<string | null>('tw-affinity');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [showServicesList, setShowServicesList] = useState(false);

  const categories = [
    { id: 'all', label: 'Todos (72)' },
    { id: 'processes', label: 'Afinidad P-Cores' },
    { id: 'cpu_power', label: 'Energía & CPU' },
    { id: 'services', label: 'Servicios (55+)' },
    { id: 'network', label: 'Red & Nagle' },
    { id: 'registry', label: 'Registro Windows' },
    { id: 'memory', label: 'Memoria RAM' },
    { id: 'disk', label: 'NVMe TRIM' },
    { id: 'gpu', label: 'iGPU Intel' },
    { id: 'cs2', label: 'CS2 In-Game' },
  ];

  const filteredTweaks = allTweaksList.filter(tweak => {
    const matchesCategory = selectedCategory === 'all' || tweak.category === selectedCategory;
    const matchesSearch = 
      tweak.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tweak.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tweak.technicalRationale.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopySnippet = (snippet: string, id: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'processes': return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'cpu_power': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'services': return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'network': return <Network className="w-4 h-4 text-cyan-400" />;
      case 'memory': return <Sliders className="w-4 h-4 text-indigo-400" />;
      case 'disk': return <HardDrive className="w-4 h-4 text-emerald-400" />;
      case 'gpu': return <Monitor className="w-4 h-4 text-teal-400" />;
      default: return <Terminal className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Category Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Directorio Técnico de las 72 Optimizaciones
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Cada tweak con su fundamento técnico comprobado para la arquitectura Intel Alder Lake y CS2 Source 2.
          </p>
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por tweak, Nagle, HAGS, TRIM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Category Pills/Segments */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
              selectedCategory === cat.id
                ? 'bg-neutral-800 text-emerald-300 border border-neutral-700 shadow-sm'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800/80 hover:bg-neutral-800/60'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 14 Optimization Modules Summary Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {optimizationModules.slice(0, 4).map((mod) => (
          <div key={mod.id} className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                MÓDULO [{mod.index}]
              </span>
              <span className="text-[11px] text-neutral-500">
                {mod.tweaksCount} tweaks
              </span>
            </div>
            <h4 className="text-sm font-semibold text-white truncate" title={mod.title}>
              {mod.title}
            </h4>
            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
              {mod.subtitle}
            </p>
            <div className="mt-3 pt-2.5 border-t border-neutral-800/60 text-[11px] text-emerald-400/90 font-medium truncate">
              {mod.highlight}
            </div>
          </div>
        ))}
      </div>

      {/* 55+ Services Drawer Toggle */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                Lista Completa de 55+ Servicios Desactivados
              </div>
              <div className="text-xs text-neutral-400">
                Libera más de 1.2 GB de memoria RAM compartida para la VRAM de la iGPU Intel UHD.
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowServicesList(!showServicesList)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors"
          >
            <span>{showServicesList ? 'Ocultar Lista' : 'Ver Todos los Servicios'}</span>
            {showServicesList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showServicesList && (
          <div className="mt-4 pt-4 border-t border-neutral-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-2">
              {disabledServicesList.map((svc) => (
                <div key={svc.name} className="p-2.5 bg-neutral-950/60 border border-neutral-800/60 rounded-lg text-xs">
                  <div className="font-mono font-semibold text-emerald-400 flex items-center justify-between">
                    <span>{svc.name}</span>
                    <span className="text-[10px] text-rose-400">disabled</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1 line-clamp-1" title={svc.desc}>
                    {svc.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tweaks Detailed List */}
      <div className="space-y-3">
        {filteredTweaks.map((tweak) => {
          const isExpanded = expandedTweakId === tweak.id;

          return (
            <div
              key={tweak.id}
              className={`border rounded-xl transition-all ${
                isExpanded
                  ? 'bg-neutral-900/90 border-emerald-500/40 shadow-lg shadow-black/40'
                  : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div
                onClick={() => setExpandedTweakId(isExpanded ? null : tweak.id)}
                className="p-4 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                    {getCategoryIcon(tweak.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {tweak.name}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        tweak.impact === 'Critico' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : tweak.impact === 'Alto'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        Impacto {tweak.impact}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {tweak.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button className="text-neutral-400 hover:text-white">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-neutral-800/80 space-y-3">
                  <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1.5">
                      <Info className="w-3.5 h-3.5" />
                      <span>Fundamento Técnico (Por qué funciona)</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {tweak.technicalRationale}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-neutral-400">
                        Comando / Clave de Ejecución:
                      </span>
                      <button
                        onClick={() => handleCopySnippet(tweak.commandSnippet, tweak.id)}
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {copiedSnippet === tweak.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet === tweak.id ? 'Copiado' : 'Copiar Comando'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 overflow-x-auto">
                      <code>{tweak.commandSnippet}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
