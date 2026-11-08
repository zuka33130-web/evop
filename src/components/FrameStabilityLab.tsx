import { useState, useEffect, useRef } from 'react';
import { Crosshair, ArrowRight, Timer, Activity, Download, CircleHelp } from 'lucide-react';
import { FrameTimeline, type TimelinePoint } from './FrameTimeline';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';

type Run = {
  id: string; processName: string; scenario: string; sourceColumn: string; createdUtc: string; targetFps: number; sourceSha256?: string; timeline?: TimelinePoint[]; requestedSeconds?: number; capturedProcessId?: number; configuration: string; width: number; height: number; fpsCap: number;
  metrics: { frames: number; rejectedRows?: number; seconds: number; averageFps: number; onePercentLowFps: number;
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

export function FrameStabilityLab({ connected, onBusyChange, externalBusy = false }: { connected: boolean; externalBusy?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [seconds, setSeconds] = useState(60);
  const [phase, setPhase] = useState<'A' | 'B'>('A');
  const [baselineId, setBaseline] = useState('');
  const [afterId, setAfter] = useState('');
  const [readiness, setReadiness] = useState<{ windows: boolean; toolReady: boolean; gameInstances: number; message: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const requestLock = useRef(false);
  const readinessVersion = useRef(0);
  useEffect(() => {
    if (!capturing) return;
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
    return () => clearInterval(timer);
  }, [capturing]);
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
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState('gaming.cs2.priority');
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  useEffect(() => {
    if (!connected) return;
    fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/experiments/active`).then(r => r.text())
      .then(text => { if (text) setExperiment(JSON.parse(text)); }).catch(() => {});
  }, [connected]);
  useEffect(() => {
    if (!connected) return;
    fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/runs`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Run[]) => { if (Array.isArray(data)) setRuns(data); }).catch(() => setError('No se pudo recuperar el historial de capturas de esta sesión.'));
  }, [connected]);
  async function checkReadiness() {
    const version = ++readinessVersion.current;
    setReadiness(null);
    try {
      const r = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/readiness?processName=${encodeURIComponent(processName)}`);
      if (!r.ok) throw new Error('No se pudo verificar la preparación del motor.');
      const data = await r.json();
      if (version === readinessVersion.current) setReadiness(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sin conexión'); }
  }
  useEffect(() => { if (connected) void checkReadiness(); else setReadiness(null); }, [connected, processName]);
  const inputClass = 'evo-input';
  async function request(path: string, body: unknown) {
    const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/benchmarks/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falló el motor de medición.');
    return data;
  }
  async function run(action: 'import' | 'capture' | 'compare') {
    if (requestLock.current || externalBusy) return;
    requestLock.current = true;
    setBusy(true); setError('');
    try {
      if (action === 'compare') {
        setComparison(await request(action, runs.map(r => r.id)));
      } else {
        if (action === 'capture') { setElapsed(0); startedAt.current = Date.now(); setCapturing(true); }
        const result = await request(action, { processName, scenario, configuration, width, height, fpsCap, targetFps,
          ...(action === 'import' ? { csv, warmupSeconds: 5 } : { seconds }) });
        setRuns(previous => [...previous.filter(r => r.id !== result.id), result]);
        if (phase === 'A') setBaseline(result.id); else setAfter(result.id);
        setComparison(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la medición.'); }
    finally { requestLock.current = false; setBusy(false); setCapturing(false); }
  }
  async function experimentAction(action: 'start' | 'evaluate' | 'restore') {
    if (action !== 'evaluate' && !confirm(action === 'start'
      ? 'Se aplicará un cambio real en Windows. Conserva la misma escena y configuración para medir B. ¿Continuar?'
      : '¿Restaurar el respaldo del módulo probado?')) return;
    if (requestLock.current || externalBusy) return;
    requestLock.current = true;
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
        setExperiment(null); setVerdict(null); setComparison(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Falló el experimento'); }
    finally { requestLock.current = false; setBusy(false); }
  }
  const baseline = runs.find(r => r.id === baselineId);
  const after = runs.find(r => r.id === afterId);
  const selected = (phase === 'A' ? baseline : after) || runs.at(-1);
  const mismatch = baseline && after ? baseline.id === after.id ? 'Selecciona dos capturas distintas.'
    : baseline.sourceSha256 && baseline.sourceSha256 === after.sourceSha256 ? 'El mismo CSV no cuenta como dos mediciones independientes.'
    : ['processName','scenario','width','height','fpsCap','targetFps','sourceColumn'].some(key => baseline[key as keyof Run] !== after[key as keyof Run])
      ? 'Contexto distinto: usa el mismo proceso, escena, resolución, cap, objetivo y fuente de intervalos.' : '' : '';
  function exportReport() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedUtc: new Date().toISOString(), baseline, after, runs, comparison, experiment, verdict,
      interpretation: 'Diferencias descriptivas; no prueban causalidad. FPS medio = 1000 / media de intervalos válidos. No mide input lag.' }, null, 2)], { type:'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'evo-benchmark-report.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="space-y-5">
    <div className="page-heading"><div><span className="eyebrow">BENCHMARK WORKSPACE</span><h1>Laboratorio de FPS</h1><p>Una referencia. Un cambio. Una nueva medición. Compara resultados reales sin salir de la aplicación.</p></div><span className="pill lime"><Activity size={12} /> PRESENTMON / ETW</span></div>
    <div className="lab-grid">
      <div className="instrument-card">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Crosshair size={16} className="text-lime-200" /> Preparar medición</h2><p className="text-[10px] text-neutral-400 leading-6 mt-2">Abre el juego y repite una escena fija. No cambies de ventana durante la captura.</p>
        <fieldset disabled={externalBusy || busy}>
          <label className="field-label" htmlFor="measure-process">Proceso del juego</label><input id="measure-process" className={inputClass} value={processName} onChange={e => setProcess(e.target.value)} />
          <label className="field-label" htmlFor="capture-phase">¿Qué vas a medir?</label><div id="capture-phase" className="phase-toggle"><button aria-pressed={phase === 'A'} onClick={() => setPhase('A')}>A · Antes del cambio</button><button aria-pressed={phase === 'B'} onClick={() => setPhase('B')}>B · Después</button></div>
          <label className="field-label" htmlFor="capture-seconds">Duración de la captura</label><select id="capture-seconds" className={inputClass} value={seconds} onChange={e => setSeconds(+e.target.value)}>{[30,60,90,120].map(n => <option key={n} value={n}>{n} segundos{n === 60 ? ' · recomendado' : ''}</option>)}</select>
          <p className="text-[9px] text-neutral-500 mt-2">Se excluyen 5 s de calentamiento. Tiempo útil esperado: ~{seconds-5} s. El tiempo real se muestra al finalizar.</p>
          <label className="field-label" htmlFor="measure-scenario">Escena / API / ajustes del juego</label><input id="measure-scenario" className={inputClass} maxLength={120} value={scenario} onChange={e => setScenario(e.target.value)} />
          <label className="field-label" htmlFor="measure-config">Etiqueta de configuración</label><input id="measure-config" className={inputClass} maxLength={120} value={configuration} onChange={e => setConfiguration(e.target.value)} />
          <details className="mt-4"><summary className="text-[11px] text-neutral-400">Resolución, cap y objetivo</summary><div className="grid grid-cols-2 gap-3"><label className="field-label">Ancho<input type="number" min="640" max="16384" className={inputClass} value={width} onChange={e => setWidth(+e.target.value)} /></label><label className="field-label">Alto<input type="number" min="480" max="16384" className={inputClass} value={height} onChange={e => setHeight(+e.target.value)} /></label><label className="field-label">Cap (0 = libre)<input type="number" min="0" max="2000" className={inputClass} value={fpsCap} onChange={e => setCap(+e.target.value)} /></label><label className="field-label">FPS objetivo<input type="number" min="20" max="1000" className={inputClass} value={targetFps} onChange={e => setTarget(+e.target.value)} /></label></div><p className="text-[10px] text-neutral-500 mt-3">Datos declarados: EVO no verifica ni aplica estos ajustes dentro del juego.</p></details>
        </fieldset>
        <div className="subtle-divider" />
        <div className="text-[10px] text-neutral-400 leading-6 space-y-1"><p className="flex justify-between">Motor Windows<span>{connected ? 'Conectado' : 'Sin conexión'}</span></p><p className="flex justify-between">PresentMon CLI<span>{readiness?.toolReady ? 'Configurado' : 'No confirmado'}</span></p><p className="flex justify-between">Instancias del juego<span>{readiness?.gameInstances ?? '—'}</span></p></div>
        <button className="primary-button w-full mt-4" disabled={!connected || externalBusy || busy} onClick={() => run('capture')}><Timer size={14} />{capturing ? 'Capturando…' : `Capturar fase ${phase} · ${seconds} s`}<ArrowRight size={14} /></button>
        <button className="text-[10px] text-neutral-400 underline mt-3" disabled={!connected || externalBusy || busy} onClick={checkReadiness}>Verificar preparación</button>
        <p className="text-[10px] text-neutral-400 leading-6 mt-2">{readiness?.message || 'Conecta el motor local para medir en Windows.'}</p>
      </div>
      <div className="space-y-5">
        {capturing && <div className="instrument-card" role="status"><div className="flex justify-between text-xs mb-4"><span>{elapsed < seconds ? 'Capturando · juega la escena habitual' : 'Finalizando y analizando intervalos…'}</span><span>{Math.min(Math.floor(elapsed),seconds)} / {seconds} s</span></div><div className="capture-progress"><div style={{width:`${Math.min(100,elapsed/seconds*100)}%`}} /></div><p className="text-[10px] text-neutral-400 mt-3">El progreso es tiempo transcurrido de solicitud, no FPS en vivo. No se presentan cifras hasta validar el CSV.</p></div>}
        {selected && <p className="text-[10px] text-neutral-400">Mostrando captura: {selected.configuration} · {selected.metrics.seconds.toFixed(1)} s útiles · {selected.id === baselineId ? 'A / referencia' : selected.id === afterId ? 'B / resultado' : 'última captura'}</p>}
        <div className="result-grid">{[
          ['FPS promedio', selected?.metrics.averageFps, 'FPS', 'Más alto suele ser mejor'],
          ['1% low', selected?.metrics.onePercentLowFps, 'FPS', 'Estabilidad en los peores frames'],
          ['Frametime P99', selected?.metrics.p99Ms, 'ms', 'Más bajo suele ser mejor'],
        ].map(([label,value,unit,help]) => <div className="instrument-card" key={String(label)}><div className="section-label" style={{fontSize:9,letterSpacing:'.6px'}}>{label}</div><p className="metric-value">{typeof value === 'number' ? value.toFixed(2) : '—'}<small>{unit}</small></p><p className="metric-foot">{help}</p></div>)}</div>
        <div className="instrument-card"><div className="flex flex-wrap justify-between gap-3 mb-5"><h2 className="text-xs font-semibold">Evolución de FPS</h2><div className="flex gap-4 text-[9px]"><span className="text-lime-200">● A · Referencia</span><span className="text-blue-300">● B · Resultado</span></div></div><div className="chart-surface"><FrameTimeline before={baseline?.timeline || (!after ? selected?.timeline : undefined)} after={after?.timeline} /></div><p className="text-[10px] text-neutral-400 mt-3">{selected ? `${selected.metrics.frames.toLocaleString()} intervalos · ${selected.metrics.seconds.toFixed(2)} s útiles · ${selected.sourceColumn} · ${selected.provenance === 'NativeCapture' ? 'Captura nativa' : 'CSV importado'}` : 'Sin captura seleccionada · no hay valores estimados'}</p></div>
        <div className="instrument-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Antes vs. después</h2><button className="text-[10px] inline-flex items-center gap-2 text-neutral-400" disabled={!runs.length} onClick={exportReport}><Download size={12} /> Exportar informe</button></div>
          <div className="grid grid-cols-2 gap-3 mb-4"><label className="field-label">A · Referencia<select aria-label="Captura de referencia A" className={inputClass} disabled={externalBusy || busy} value={baselineId} onChange={e => setBaseline(e.target.value)}><option value="">Selecciona una captura</option>{runs.map((r,i) => <option key={r.id} value={r.id}>#{i+1} · {r.configuration} · {r.metrics.averageFps.toFixed(2)} FPS</option>)}</select></label><label className="field-label">B · Resultado<select aria-label="Captura de resultado B" className={inputClass} disabled={externalBusy || busy} value={afterId} onChange={e => setAfter(e.target.value)}><option value="">Selecciona una captura</option>{runs.map((r,i) => <option key={r.id} value={r.id}>#{i+1} · {r.configuration} · {r.metrics.averageFps.toFixed(2)} FPS</option>)}</select></label></div>
          {mismatch ? <p role="alert" className="notice">{mismatch}</p> : baseline && after ? <><div className="grid grid-cols-3 gap-4">{[['FPS promedio',baseline.metrics.averageFps,after.metrics.averageFps],['1% low',baseline.metrics.onePercentLowFps,after.metrics.onePercentLowFps],['P99 ms',baseline.metrics.p99Ms,after.metrics.p99Ms]].map(([label,a,b]) => <div key={String(label)}><p className="text-[10px] text-neutral-400">{label}</p><p className="text-sm mt-2 tabular-nums">{Number(a).toFixed(2)} → {Number(b).toFixed(2)}</p><p className="text-[11px] text-neutral-300 mt-1">{Number(b)>=Number(a)?'+':''}{((Number(b)/Number(a)-1)*100).toFixed(2)}%</p></div>)}</div><p className="text-[10px] text-amber-200/70 mt-5 leading-6">Diferencia descriptiva, no prueba causal. Repite ≥3 veces por fase; usa el experimento avanzado para evaluar variabilidad e intervalos de confianza. {baseline.provenance !== 'NativeCapture' || after.provenance !== 'NativeCapture' ? 'Incluye CSV importado: comparación exploratoria.' : ''}</p></> : <p className="text-[11px] text-neutral-400 leading-7">1. Captura A sin cambios. 2. Abre Operaciones y aplica un único módulo. 3. Regresa, elige fase B y repite la misma escena. Tus capturas permanecen al navegar.</p>}
        </div>
        {error && <p role="alert" className="notice">{error}</p>}
        {busy && !capturing && <p role="status" className="text-xs text-neutral-400">Procesando solicitud del motor…</p>}
      </div>
    </div>
    <details className="instrument-card"><summary className="text-xs font-semibold flex items-center gap-2"><CircleHelp size={15} /> Qué mide EVO y cómo interpretar los resultados</summary><dl className="definition-grid"><div><dt>FPS promedio</dt><dd>1000 dividido entre la media de los intervalos válidos, equivalente a intervalos / segundos medidos. No es la media de contadores de FPS instantáneos.</dd></div><div><dt>1% low y P99</dt><dd>1% low: 1000 / media del 1% de intervalos más lentos. P99: intervalo que cubre el 99% de la muestra. Los tirones reales nunca se filtran como atípicos.</dd></div><div><dt>Precisión y fuente</dt><dd>Se calcula sobre intervalos reales registrados por PresentMon. MsBetweenPresents mide presentaciones; CPUFrameTime mide cadencia CPU. Ninguna equivale necesariamente a FPS visibles del monitor o input lag. No mezclar fuentes.</dd></div><div><dt>Comparación válida</dt><dd>Mismo juego, escena, API, resolución, cap y alimentación. Cambios de temperatura, carga o servidor pueden alterar resultados. Un solo par no demuestra una mejora reproducible.</dd></div></dl></details>
    <details className="instrument-card"><summary className="text-xs font-semibold">Importar CSV / comparar varias configuraciones</summary><p className="text-[11px] text-neutral-400 mt-3 mb-3">PresentMon CLI 2.x debe estar configurado en EVO_PRESENTMON_PATH antes de iniciar el motor. No se descarga software ni se inyecta código. También puedes analizar una captura externa.</p><input aria-label="Importar CSV PresentMon" type="file" accept=".csv,text/csv" disabled={externalBusy || busy} onChange={async e => { const file=e.target.files?.[0]; if(!file) return; if(file.size>24_000_000){setError('Máximo 24 MB.');return;} setCsv(await file.text());setError(''); }} /><div className="flex flex-wrap gap-3 mt-4"><button className="secondary-button" disabled={!connected || externalBusy || busy || !csv} onClick={() => run('import')}>Analizar CSV real</button><button className="secondary-button" disabled={!connected || externalBusy || busy || runs.length<2} onClick={() => run('compare')}>Comparar configuraciones</button></div></details>
    <details className="instrument-card"><summary className="text-xs font-semibold">Experimento avanzado · cambio controlado e intervalo de confianza</summary>
    <div className="rounded-xl border border-cyan-900 p-5 space-y-3">
      <h2 className="font-bold">Experimento A/B por optimización</h2>
      <p className="text-sm text-neutral-400">1. Captura A cinco veces sin cambios. 2. Aplica un único módulo. 3. Captura B cinco veces sin cambiar escena, resolución ni cap. 4. Evalúa y exporta. 5. Restaura y confirma con A/B/A/B. Tres repeticiones permiten iniciar, pero no emitir señal estadística.</p>
      <select className={inputClass} disabled={externalBusy || busy || !!experiment} value={operation} onChange={e => setOperation(e.target.value)}>
        {abOperations.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select>
      {!experiment ? <button disabled={externalBusy || busy || !connected || runs.length < 3} className="rounded bg-cyan-600 px-4 py-2 disabled:opacity-40" onClick={() => experimentAction('start')}>Fijar capturas A y aplicar cambio real</button>
        : <><p>Activo: {experiment.operationId} · Base: {experiment.beforeIds.length} capturas · B: {runs.filter(r => !experiment.beforeIds.includes(r.id)).length}</p>
          {!experiment.applied.success && <p className="text-rose-300">Aplicación fallida o parcial: {experiment.applied.errorMessage}. Restaura antes de continuar.</p>}
          <div className="flex gap-3"><button disabled={externalBusy || busy || !connected} className="rounded border px-4 py-2" onClick={() => experimentAction('evaluate')}>Evaluar antes / después</button>
          <button disabled={externalBusy || busy || !connected} className="rounded border px-4 py-2" onClick={() => experimentAction('restore')}>Restaurar módulo y cerrar</button></div></>}
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
    </details>
    <div className="instrument-card"><h2 className="text-sm font-semibold mb-3">Capturas de esta sesión <span className="text-neutral-500">/ {runs.length}</span></h2>
    {!runs.length && <p className="text-xs text-neutral-400">Todavía no hay capturas. Inicia tu primera medición arriba.</p>}
    {runs.map((r, i) => <article className="rounded-xl border border-neutral-800 p-4 space-y-2" key={r.id}>
      <div className="flex justify-between gap-2"><h2 className="font-bold">#{i + 1} {r.configuration} · {r.width}×{r.height} · cap {r.fpsCap || 'libre'}</h2>
        <button disabled={externalBusy || busy || !!experiment} onClick={() => { setRuns(v => v.filter(x => x.id !== r.id)); if (baselineId === r.id) setBaseline(''); if (afterId === r.id) setAfter(''); setComparison(null); }} className="text-neutral-400">Quitar</button></div>
      <p className="text-sm font-mono">FPS {r.metrics.averageFps.toFixed(2)} · 1% low {r.metrics.onePercentLowFps.toFixed(2)} · P99 {r.metrics.p99Ms.toFixed(2)} ms · fuera de presupuesto {r.metrics.budgetMissPercent.toFixed(2)}% · {r.metrics.frames} frames / {r.metrics.seconds.toFixed(1)} s</p>
      <p className="text-xs text-cyan-300">{experiment ? experiment.beforeIds.includes(r.id) ? 'Fase A del experimento' : 'Fase B del experimento' : r.id === baselineId ? 'Referencia A seleccionada' : r.id === afterId ? 'Resultado B seleccionado' : 'Sin fase asignada'} · {r.provenance === 'NativeCapture' ? 'Captura nativa' : 'CSV importado'} · {r.systemSamples?.length || 0} muestras de CPU/RAM/reloj/ACPI (sensores disponibles)</p>
      {!!r.metrics.rejectedRows && <p className="text-xs text-amber-300">{r.metrics.rejectedRows} filas inválidas excluidas. Revisa la calidad de la captura.</p>}
      {r.warnings.map(w => <p key={w} className="text-xs text-amber-300">{w}</p>)}
    </article>)}
    </div>
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
