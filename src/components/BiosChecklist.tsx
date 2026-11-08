import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, Circle, AlertCircle, Copy, Check } from 'lucide-react';
import { biosSettingsList } from '../data/optimizerData';

export const BiosChecklist: React.FC = () => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ryzer_bios_checklist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [copiedUefiCmd, setCopiedUefiCmd] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('ryzer_bios_checklist', JSON.stringify(checkedItems));
    } catch {
      // ignore
    }
  }, [checkedItems]);

  const toggleCheck = (name: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleCopyUefiCommand = () => {
    navigator.clipboard.writeText('shutdown /r /fw /t 0');
    setCopiedUefiCmd(true);
    setTimeout(() => setCopiedUefiCmd(false), 2000);
  };

  const totalSettings = biosSettingsList.length;
  const completedCount = biosSettingsList.filter(s => checkedItems[s.name]).length;
  const progressPercent = Math.round((completedCount / totalSettings) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>Guía de Ajustes de BIOS (ASUS PN64 F2)</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Configuración crítica a nivel de hardware para que el procesador i3-1220P y la RAM DDR4 operen al 100% de su rendimiento.
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-xl">
          <div className="text-right">
            <div className="text-xs font-semibold text-white">Progreso de BIOS</div>
            <div className="text-[11px] text-emerald-400 font-mono tabular-nums">
              {completedCount} de {totalSettings} verificados ({progressPercent}%)
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-neutral-800 flex items-center justify-center relative">
            <div 
              className="absolute inset-0 rounded-full border-2 border-emerald-400 transition-all duration-300"
              style={{
                clipPath: `polygon(50% 50%, -50% -50%, ${progressPercent}% -50%, ${progressPercent}% 150%, -50% 150%)`
              }}
            />
            <span className="text-xs font-mono font-bold text-white">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Direct UEFI Reboot Shortcut card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-400 mb-0.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Atajo de Entrada Directa a la BIOS desde Windows</span>
          </div>
          <div className="text-xs text-neutral-300">
            ¿Tu teclado USB inicia demasiado tarde para presionar F2? Ejecuta este comando en CMD/PowerShell (Admin) para reiniciar directo a la BIOS:
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <code className="bg-neutral-950 border border-neutral-800 text-neutral-200 px-3 py-1.5 rounded-lg text-xs font-mono select-all">
            shutdown /r /fw /t 0
          </code>
          <button
            onClick={handleCopyUefiCommand}
            className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg border border-neutral-700 transition-colors"
            title="Copiar comando de reinicio UEFI"
          >
            {copiedUefiCmd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {biosSettingsList.map((item) => {
          const isDone = !!checkedItems[item.name];

          return (
            <div
              key={item.name}
              onClick={() => toggleCheck(item.name)}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                isDone
                  ? 'bg-neutral-900/90 border-emerald-500/50 shadow-sm'
                  : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-600 shrink-0" />
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold transition-colors ${isDone ? 'text-white' : 'text-neutral-200'}`}>
                      {item.name}
                    </h4>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {item.recommended}
                      </span>
                      {item.isCritical && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                          Crítico
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-neutral-400 pl-8 leading-relaxed">
                {item.why}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
