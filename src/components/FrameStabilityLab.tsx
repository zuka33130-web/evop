import { useState } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';

type Run = {
  id: string; configuration: string; width: number; height: number; fpsCap: number;
  metrics: { frames: number; seconds: number; averageFps: number; onePercentLowFps: number;
    p99Ms: number; budgetMissPercent: number; stutterPercent: number };
  warnings: string[];
};
type Ranking = { configuration: string; width: number; height: number; fpsCap: number; runs: number;
  medianLowFps: number; medianP99Ms: number; medianBudgetMissPercent: number; meetsTarget: boolean; provisional: boolean };
type Comparison = { rankings: Ranking[]; decision: string; definition: string };

export function FrameStabilityLab({ connected }: { connected: boolean }) {
  const [processName, setProcess] = useState('cs2.exe');
  const [scenario, setScenario] = useState('Mapa y recorrido fijo — misma escena');
  const [configuration, setConfiguration] = useState('Bajo / sin cambios');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fpsCap, setCap] = useState(0);
  const [targetFps, setTarget] = useState(60);
  const [csv, setCsv] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputClass = 'w-full mt-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm';
  async function request(path: string, body: unknown) {
    const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falló el motor de medición.');
    return data;
  }
  async function run(action: 'import' | 'capture' | 'compare') {
    setBusy(true); setError('');
    try {
      if (action === 'compare') {
        setComparison(await request(action, runs.map(r => r.id)));
      } else {
        const result = await request(action, { processName, scenario, configuration, width, height, fpsCap, targetFps,
          ...(action === 'import' ? { csv, warmupSeconds: 5 } : { seconds: 60 }) });
        setRuns(previous => [...previous, result]);
        setComparison(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la medición.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <header><h1 className="text-2xl font-bold">Motor de estabilidad · 1% low y frametimes</h1>
      <p className="mt-2 text-neutral-400 text-sm">Mediciones reales, no predicciones. Ajusta la resolución y el límite de FPS dentro del juego antes de cada captura. El motor no acredita esos valores ni cambia ajustes gráficos a ciegas.</p></header>
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label>Proceso<input className={inputClass} value={processName} onChange={e => setProcess(e.target.value)} /></label>
        <label>Escena / API gráfica / ajustes comunes<input className={inputClass} value={scenario} onChange={e => setScenario(e.target.value)} /></label>
        <label>Nombre de configuración<input className={inputClass} value={configuration} onChange={e => setConfiguration(e.target.value)} /></label>
        <label>Ancho<input type="number" min="640" className={inputClass} value={width} onChange={e => setWidth(+e.target.value)} /></label>
        <label>Alto<input type="number" min="480" className={inputClass} value={height} onChange={e => setHeight(+e.target.value)} /></label>
        <label>Límite FPS (0 = sin límite)<input type="number" min="0" className={inputClass} value={fpsCap} onChange={e => setCap(+e.target.value)} /></label>
        <label>FPS objetivo<input type="number" min="20" className={inputClass} value={targetFps} onChange={e => setTarget(+e.target.value)} /></label>
      </div>
      <p className="text-xs text-neutral-400">Repite cada configuración al menos 3 veces, con 30 s útiles y 1000 frames por captura. Mantén escena, API, alimentación y temperatura comparables. Se descartan solo los primeros 5 s y filas inválidas, nunca los tirones reales.</p>
      <label className="block text-sm">Importar CSV PresentMon
        <input className="block mt-2" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          if (file.size > 24_000_000) { setError('Máximo 24 MB.'); return; }
          setCsv(await file.text()); setError('');
        }} />
      </label>
      <div className="flex gap-3 flex-wrap">
        <button className="rounded bg-emerald-500 px-4 py-2 text-black disabled:opacity-40" disabled={!connected || busy || !csv} onClick={() => run('import')}>Analizar CSV real</button>
        <button className="rounded border border-cyan-600 px-4 py-2 disabled:opacity-40" disabled={!connected || busy} onClick={() => run('capture')}>Capturar juego · 60 s</button>
        <button className="rounded border border-neutral-600 px-4 py-2 disabled:opacity-40" disabled={!connected || busy || runs.length < 2} onClick={() => run('compare')}>Comparar configuraciones</button>
      </div>
      <p className="text-xs text-neutral-400">Captura requiere PresentMon CLI 2.x oficial y EVO_PRESENTMON_PATH configurado al iniciar el motor. No se instala software ni se inyecta código en el juego. Si ETW no tiene permisos, el motor informa error. El CSV temporal se elimina tras analizarlo.</p>
      {!connected && <p className="text-amber-300">Inicia EvoNativeEngine en Windows y abre la interfaz local para medir.</p>}
      {busy && <p role="status">Procesando… Si es una captura, juega la misma escena durante 60 segundos.</p>}
      {error && <p role="alert" className="text-rose-300">{error}</p>}
    </div>
    {runs.map((r, i) => <article className="rounded-xl border border-neutral-800 p-4 space-y-2" key={r.id}>
      <div className="flex justify-between gap-2"><h2 className="font-bold">#{i + 1} {r.configuration} · {r.width}×{r.height} · cap {r.fpsCap || 'libre'}</h2>
        <button disabled={busy} onClick={() => { setRuns(v => v.filter(x => x.id !== r.id)); setComparison(null); }} className="text-neutral-400">Quitar</button></div>
      <p className="text-sm font-mono">FPS {r.metrics.averageFps.toFixed(2)} · 1% low {r.metrics.onePercentLowFps.toFixed(2)} · P99 {r.metrics.p99Ms.toFixed(2)} ms · fuera de presupuesto {r.metrics.budgetMissPercent.toFixed(2)}% · {r.metrics.frames} frames / {r.metrics.seconds.toFixed(1)} s</p>
      {r.warnings.map(w => <p key={w} className="text-xs text-amber-300">{w}</p>)}
    </article>)}
    {comparison && <div className="rounded-xl border border-emerald-800 p-5 space-y-3">
      <h2 className="font-bold">Orden de candidatos medidos</h2><p>{comparison.decision}</p>
      {comparison.rankings.map((r, i) => <p className="text-sm" key={`${r.configuration}-${r.width}-${r.height}-${r.fpsCap}`}>{i + 1}. {r.configuration} · {r.width}×{r.height} · cap {r.fpsCap || 'libre'} · {r.runs} repeticiones · 1% low {r.medianLowFps.toFixed(2)} · P99 {r.medianP99Ms.toFixed(2)} ms · {r.provisional ? 'provisional' : r.meetsTarget ? 'cumple presupuesto' : 'no cumple objetivo'}</p>)}
      <button className="underline" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ runs, comparison }, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'evo-stability-report.json'; a.click(); URL.revokeObjectURL(url);
      }}>Exportar informe JSON</button>
    </div>}
    <p className="text-xs text-neutral-400">1% low = 1000 / media del 1% de intervalos más lentos (redondeo hacia arriba). P99 usa rango más próximo. Un frametime de 16,67 ms equivale a 60 FPS; no mide input lag. La mejor opción solo es válida entre las configuraciones probadas, no para todas las escenas o juegos. Las capturas del servidor se pierden al reiniciarlo.</p>
  </section>;
}
