import { ResearchSources } from './ResearchSources';
import React, { useState } from 'react';
import { 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  HelpCircle, 
  ArrowRight,
  ExternalLink,
  Flame,
  Search
} from 'lucide-react';
import { debunkedMythsList, DebunkedMyth } from '../data/optimizerData';

export const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMyth, setSelectedMyth] = useState<string | null>(debunkedMythsList[0]?.id || null);

  const filteredMyths = debunkedMythsList.filter(m => 
    m.mythName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.whatItDid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.whyItFailed.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMyth = debunkedMythsList.find(m => m.id === selectedMyth) || debunkedMythsList[0];

  return (
    <div className="space-y-6 animate-fadeIn text-neutral-100">
      <ResearchSources />
      {/* Header Forense */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs uppercase tracking-wider font-semibold">
                Auditoría Antifraude & Ciencia de Silicio
              </span>
              <span className="text-xs text-neutral-500 font-mono">ASUS PN64 · Intel Alder Lake</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-emerald-400" />
              Base de Conocimiento: Mitos Desmentidos
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl mt-1.5 leading-relaxed">
              Desmitificación técnica de los falsos optimizadores de internet mediante pruebas empíricas de laboratorio, latencia DPC y telemetría de microarquitectura.
            </p>
          </div>

          {/* Barra de búsqueda */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar mito o comando..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Grid de Contenido: Selector Lateral + Vista Detallada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Selector de Mitos (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider px-1">
            Mitos Auditados ({filteredMyths.length})
          </div>
          
          <div className="space-y-2">
            {filteredMyths.map((m) => {
              const isSelected = m.id === selectedMyth;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMyth(m.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-neutral-900 border-emerald-500/50 shadow-md text-white'
                      : 'bg-neutral-950/70 border-neutral-800/80 hover:bg-neutral-900/60 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold font-mono text-rose-400">
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      MITO DETECTADO
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">#{m.id}</span>
                  </div>
                  <div className="text-sm font-semibold text-neutral-100 line-clamp-1">
                    {m.mythName}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalle Forense del Mito Seleccionado (8 cols) */}
        {activeMyth && (
          <div className="lg:col-span-8 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2 text-xs font-mono text-rose-400 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>ANÁLISIS DE IMPACTO NEGATIVO EN WINDOWS 11</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {activeMyth.mythName}
              </h2>
            </div>

            {/* ¿Qué hacía el tweak popular? */}
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
              <div className="text-xs font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                ¿Qué afirmaban los optimizadores de YouTube/TikTok?
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {activeMyth.whatItDid}
              </p>
            </div>

            {/* ¿Por qué fracasó técnicamente? */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
              <div className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                La Realidad del Silicio: Por qué destruye el rendimiento
              </div>
              <p className="text-sm text-rose-200/90 leading-relaxed">
                {activeMyth.whyItFailed}
              </p>
            </div>

            {/* La Solución Real y Científica */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
              <div className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Solución Empírica Implementada en EVO OPTIMIZER
              </div>
              <p className="text-sm text-emerald-200/90 leading-relaxed font-mono">
                {activeMyth.theRealFix}
              </p>
            </div>

            {/* Justificación Científica & Telemetría */}
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-900/40">
              <div className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Verificación Empírica con PresentMon & Latencymon
              </div>
              <p className="text-sm text-cyan-200/90 leading-relaxed">
                {activeMyth.scienceRationale}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
