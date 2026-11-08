import { useState, useEffect } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';

type Run = {
  id: string; configuration: string; width: number; height: number; fpsCap: number;
  metrics: { frames: number; seconds: number; averageFps: number; onePercentLowFps: number;
    p99Ms: number; budgetMissPercent: number; stutterPercent: number };
  warnings: string[]; provenance: string; systemSamples?: { cpuUsagePct: number | null; ramUsedPct: number | null }[];
};
type Ranking = { configuration: string; width: number; height: number; fpsCap: number; runs: number;
  medianLowFps: number; medianP99Ms: number; medianBudgetMissPercent: number; meetsTarget: boolean; provisional: boolean };
type Comparison = { rankings: Ranking[]; decision: string; definition: string };

type Experiment = { id: string; operationId: string; beforeIds: string[]; applied: { success: boolean; errorMessage: string | null }; [key: string]: unknown };
type Estimate = { changePercent: number; ciLowPercent: number; ciHighPercent: number };
type Verdict = { verdict: string; lowFps: Estimate; p99Ms: Estimate; averageFps: Estimate; limitations: string[];
  resources: { cpuMeanBefore: number | null; cpuMeanAfter: number | null; ramPeakBefore: number | null; ramPeakAfter: number | null;
    acpiMaxBefore: number | null; acpiMaxAfter: number | null; samplesBefore: number; samplesAfter: number } };
const abOperations = [
  ['gaming.cs2.priority', 'Prioridad CS2 (sin cambiar afinidad)'], ['cortex.mode.torneo', 'Transparencias'],
  ['cortex.mode.nucleo', 'Plan de Alto Rendimiento'], ['tweak.cpu.idledisable', 'Reposo CPU AC (mayor consumo)'],
  ['tweak.memory.pagecombining_off', 'PageCombining'], ['tweak.services.gaming_toggle', 'Servicios opcionales'],
  ['tweak.cpu.affinity_15', 'Afinidad explícita 0–3 (puede empeorar FPS)']
];

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
  const [operation, setOperation] = useState('gaming.cs2.priority');
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  useEffect(() => {
    if (!connected) return;
    fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/experiments/active`).then(r => r.text())
      .then(text => { if (text) setExperiment(JSON.parse(text)); }).catch(() => {});
  }, [connected]);
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
  async function experimentAction(action: 'start' | 'evaluate' | 'restore') {
    if (action !== 'evaluate' && !confirm(action === 'start'
      ? 'Se aplicará un cambio real en Windows. Conserva la misma escena y configuración para medir B. ¿Continuar?'
      : '¿Restaurar el respaldo del módulo probado?')) return;
    setBusy(true); setError('');
    try {
      if (action === 'start') {
        setExperiment(await request('experiments/start', { operationId: operation, beforeIds: runs.map(r => r.id) }));
        setVerdict(null);
      } else if (action === 'evaluate') {
        setVerdict(await request('experiments/evaluate', { id: experiment?.id,
          afterIds: runs.filter(r => !experiment?.beforeIds.includes(r.id)).map(r => r.id) }));
      } else {
        const result = await request('experiments/restore', { id: experiment?.id, afterIds: [] });
        if (!result.success) throw new Error(result.errorMessage || 'La restauración falló; respaldo conservado.');
        setExperiment(null); setVerdict(null); setRuns([]); setComparison(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Falló el experimento'); }
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
    <div className="rounded-xl border border-cyan-900 p-5 space-y-3">
      <h2 className="font-bold">Experimento A/B por optimización</h2>
      <p className="text-sm text-neutral-400">1. Captura A cinco veces sin cambios. 2. Aplica un único módulo. 3. Captura B cinco veces sin cambiar escena, resolución ni cap. 4. Evalúa y exporta. 5. Restaura y confirma con A/B/A/B. Tres repeticiones permiten iniciar, pero no emitir señal estadística.</p>
      <select className={inputClass} disabled={busy || !!experiment} value={operation} onChange={e => setOperation(e.target.value)}>
        {abOperations.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select>
      {!experiment ? <button disabled={busy || !connected || runs.length < 3} className="rounded bg-cyan-600 px-4 py-2 disabled:opacity-40" onClick={() => experimentAction('start')}>Fijar capturas A y aplicar cambio real</button>
        : <><p>Activo: {experiment.operationId} · Base: {experiment.beforeIds.length} capturas · B: {runs.filter(r => !experiment.beforeIds.includes(r.id)).length}</p>
          {!experiment.applied.success && <p className="text-rose-300">Aplicación fallida o parcial: {experiment.applied.errorMessage}. Restaura antes de continuar.</p>}
          <div className="flex gap-3"><button disabled={busy || !connected} className="rounded border px-4 py-2" onClick={() => experimentAction('evaluate')}>Evaluar antes / después</button>
          <button disabled={busy || !connected} className="rounded border px-4 py-2" onClick={() => experimentAction('restore')}>Restaurar módulo y cerrar</button></div></>}
      <p className="text-xs text-amber-300">Solo capturas nativas vinculadas al cambio permiten emitir señal. CSV importados son exploratorios. El contador detecta otras operaciones del motor, no modificaciones externas ni cambios de escena. No se evalúan automáticamente ajustes que requieren reinicio.</p>
      {verdict && <div className="space-y-2"><h3 className="font-bold">{verdict.verdict}</h3>
        {([['1% low (↑ mejor)', verdict.lowFps], ['P99 ms (↓ mejor)', verdict.p99Ms], ['FPS medio', verdict.averageFps]] as [string, Estimate][]).map(([label, v]) =>
          <p key={label} className="font-mono text-sm">{label}: {v.changePercent.toFixed(2)}% · IC95% [{v.ciLowPercent.toFixed(2)}, {v.ciHighPercent.toFixed(2)}]%</p>)}
        <p className="text-sm text-neutral-400">Telemetría auxiliar A → B ({verdict.resources.samplesBefore} / {verdict.resources.samplesAfter} muestras). No determina por sí sola el veredicto:</p>
        {([['CPU media %', verdict.resources.cpuMeanBefore, verdict.resources.cpuMeanAfter],
          ['RAM pico %', verdict.resources.ramPeakBefore, verdict.resources.ramPeakAfter],
          ['Zona ACPI máxima °C', verdict.resources.acpiMaxBefore, verdict.resources.acpiMaxAfter]] as [string, number | null, number | null][]).map(([label, a, b]) =>
          <p className="text-sm font-mono" key={label}>{label}: {a == null ? 'N/D' : a.toFixed(1)} → {b == null ? 'N/D' : b.toFixed(1)}</p>)}
        {verdict.limitations.map(text => <p key={text} className="text-xs text-neutral-400">{text}</p>)}
        <button className="underline" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify({ experiment, verdict, runs }, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a'); a.href = url; a.download = 'evo-optimization-experiment.json'; a.click(); URL.revokeObjectURL(url);
        }}>Exportar evidencia A/B, hardware y telemetría</button>
      </div>}
    </div>
    {runs.map((r, i) => <article className="rounded-xl border border-neutral-800 p-4 space-y-2" key={r.id}>
      <div className="flex justify-between gap-2"><h2 className="font-bold">#{i + 1} {r.configuration} · {r.width}×{r.height} · cap {r.fpsCap || 'libre'}</h2>
        <button disabled={busy} onClick={() => { setRuns(v => v.filter(x => x.id !== r.id)); setComparison(null); }} className="text-neutral-400">Quitar</button></div>
      <p className="text-sm font-mono">FPS {r.metrics.averageFps.toFixed(2)} · 1% low {r.metrics.onePercentLowFps.toFixed(2)} · P99 {r.metrics.p99Ms.toFixed(2)} ms · fuera de presupuesto {r.metrics.budgetMissPercent.toFixed(2)}% · {r.metrics.frames} frames / {r.metrics.seconds.toFixed(1)} s</p>
      <p className="text-xs text-cyan-300">{experiment ? experiment.beforeIds.includes(r.id) ? 'Fase A' : 'Fase B' : 'Sin fase'} · {r.provenance === 'NativeCapture' ? 'Captura nativa' : 'CSV importado'} · {r.systemSamples?.length || 0} muestras de CPU/RAM/reloj/ACPI (sensores disponibles)</p>
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
