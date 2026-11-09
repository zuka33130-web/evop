import { useState } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL, type OperationCatalogItem, type OperationResult } from '../services/nativeBridge';
type Report = { engine: string; createdUtc: string; software: { name: string; version: string | null; publisher: string | null }[];
  topProcesses: { name: string; workingSetMb: number }[]; startupNames: string[];
  recommendations: { id: string; title: string; evidence: string; action: string; risk: string; operationId: string | null; requiresAbTest: boolean }[];
  limitations: string[]; hardware: { processor: { name: string }; memory: { totalGb: number; availableGb: number }; graphicsCards: { name: string; driverVersion: string }[] } };
export function LocalAuditAdvisor({ connected, apply, onMeasure, onStudio, externalBusy = false, catalog = [], elevated = false }: { externalBusy?:boolean; onStudio?:()=>void; catalog?:OperationCatalogItem[]; elevated?:boolean; connected: boolean; apply: (id: string) => Promise<OperationResult>; onMeasure: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function audit() {
    if (externalBusy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/advisor/audit`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Falló la auditoría'); setReport(data);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { setBusy(false); }
  }
  async function execute(id: string) {
    if (!confirm('Se aplicará un cambio real. La recomendación no prueba una mejora; usa A/B antes de conservarlo. ¿Continuar?')) return;
    if (externalBusy) return;
    setBusy(true);
    try { const result = await apply(id); setMessage((result.success ? 'Cambio verificado. Ahora mide antes/después.' : result.errorMessage || 'Falló el cambio') + '\n' + result.logs.join('\n')); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Error de aplicación'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">Auditor local de hardware y software</h1>
    <p className="text-sm text-neutral-400">Motor de reglas explicables, no IA generativa ni diagnóstico infalible. Audita sin enviar información a la nube y no ejecuta recomendaciones automáticamente. Los inventarios pueden contener nombres y rutas personales: revisa antes de compartir.</p>
    <div className="flex gap-3"><button className="rounded bg-cyan-600 px-4 py-2 disabled:opacity-40" disabled={externalBusy || busy || !connected} onClick={audit}>{busy ? 'Procesando…' : 'Auditar PC real'}</button>
      <button className="rounded border px-4 py-2" onClick={onMeasure}>Abrir experimentos A/B</button><button className="secondary-button" onClick={onStudio}>Plantillas y Modo Bestia</button></div>
    {!connected && <p className="text-amber-300">Inicia el motor Windows local para auditar.</p>}
    {message && <pre role="status" className="whitespace-pre-wrap text-xs text-amber-300">{message}</pre>}
    {report && <>
      <div className="rounded-xl border border-neutral-800 p-4 space-y-2"><h2>{report.engine} · {new Date(report.createdUtc).toLocaleString()}</h2>
        <p className="text-sm">{report.hardware.processor.name} · RAM {report.hardware.memory.totalGb.toFixed(1)} GB / libre {report.hardware.memory.availableGb.toFixed(1)} GB</p>
        {report.hardware.graphicsCards.map((gpu, i) => <p className="text-sm" key={i}>{gpu.name} · driver {gpu.driverVersion}</p>)}
      </div>
      {report.recommendations.map(r => <article className="rounded-xl border border-neutral-800 p-4 space-y-2" key={r.id}>
        <h2 className="font-bold">{r.title}</h2><p className="text-sm text-cyan-300">Evidencia: {r.evidence}</p><p className="text-sm">{r.action}</p><p className="text-xs text-amber-300">Riesgo/límite: {r.risk}</p>
        {r.operationId && <button disabled={externalBusy || busy || !connected || (!elevated && !!catalog.find(c => c.id === r.operationId)?.requiresElevation)} className="rounded border px-3 py-2 text-sm disabled:opacity-30" onClick={() => execute(r.operationId!)}>Aplicar módulo real con confirmación</button>}
        {r.requiresAbTest && <button className="ml-3 underline text-sm" onClick={onMeasure}>Medir en A/B</button>}
      </article>)}
      <details className="rounded-xl border border-neutral-800 p-4"><summary>Procesos con mayor working set (muestra puntual)</summary>{report.topProcesses.map((p, i) => <p key={i} className="text-sm">{p.name}: {p.workingSetMb.toFixed(1)} MB</p>)}</details>
      <details className="rounded-xl border border-neutral-800 p-4"><summary>Software registrado ({report.software.length}) / inicio ({report.startupNames.length})</summary>
        <p className="text-xs text-neutral-400">Inicio: {report.startupNames.join(', ')}</p>{report.software.map((s, i) => <p className="text-sm" key={i}>{s.name} {s.version} · {s.publisher}</p>)}</details>
      {report.limitations.map(l => <p key={l} className="text-xs text-neutral-400">{l}</p>)}
      <button className="underline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'evo-local-audit.json'; a.click(); URL.revokeObjectURL(url); }}>Exportar auditoría local (revisar privacidad antes de compartir)</button>
    </>}
  </section>;
}
