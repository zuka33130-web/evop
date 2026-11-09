import { useState, useRef, useEffect } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';
type Outcome = {path:string;category:string;status:string;reason:string;bytes?:number};
type Volume = {volume:string;freeBefore:number|null;freeAfter:number|null;observedFreeDelta:number|null;note:string};
type Item = { id: string; category: string; path: string; bytes: number; kind: string; valueName: string | null; value: string | null; allocatedBytes?:number|null; companion?:Item|null };
type Plan = { id: string; items: Item[]; warnings: string[]; logicalBytes?:number; allocatedBytes?:number|null; complete?:boolean; cancelled?:boolean; outcomes?:Outcome[] };
type Receipt = { id: string; bytesQuarantined: number; errors: string[]; message: string; items: unknown[]; action?:string; bytesDeleted?:number; createdUtc?:string; outcomes?:Outcome[]; volumes?:Volume[]; cancelled?:boolean; status?:string };
export function SmartCleanup({ connected, externalBusy = false, onBusyChange }: { connected: boolean; externalBusy?: boolean; onBusyChange?:(busy:boolean)=>void }) {
  const lock = useRef(false);
  const [category, setCategory] = useState('all');
  const [cancelRequested, setCancelRequested] = useState(false);
  const [progress, setProgress] = useState<{action:string;processed:number;total:number}|null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [restoreId, setRestoreId] = useState('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptError, setReceiptError] = useState('');
  async function refreshReceipts() {
    try {
      const r = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/cleanup/receipts`);
      const rows = await r.json();
      if (!r.ok || !Array.isArray(rows)) throw new Error('No se pudo consultar el inventario de cuarentenas. No se asume que esté vacío.');
      setReceipts(rows); setReceiptError('');
    } catch(e) { setReceiptError(e instanceof Error ? e.message : 'Inventario no disponible'); }
  }
  useEffect(() => { if (connected) void refreshReceipts(); else setReceipts([]); }, [connected]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy,onBusyChange]);
  const [error, setError] = useState('');
  async function request(path: string, body?: unknown) {
    const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/cleanup/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Error de limpieza'); return data;
  }
  useEffect(() => {
    if (!busy || !connected) return;
    let disposed = false;
    const update = async () => {
      try { const r=await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/cleanup/progress`); if (r.ok && !disposed) setProgress(await r.json()); } catch { /* No fabricated progress. */ }
    };
    void update(); const id=setInterval(update,750);
    return () => { disposed=true;clearInterval(id); };
  }, [busy,connected]);
  async function cancel() {
    try { const result=await request('cancel'); if (result.accepted) setCancelRequested(true); }
    catch(e) { setError(e instanceof Error ? e.message : 'No se confirmó la cancelación.'); }
  }
  function bytes(item:Item) { return item.bytes + (item.companion?.bytes ?? 0); }
  function selectCategory(name:string) {
    const candidates=plan?.items.filter(i=>i.category===name).map(i=>i.id) ?? [];
    setSelected(previous => [...new Set([...previous,...candidates])].slice(0,500));
  }
  async function action(kind: 'preview' | 'quarantine' | 'restore' | 'purge') {
    if (kind === 'quarantine' && !confirm(`¿Mover ${selected.length} elementos a cuarentena y retirar las entradas Run seleccionadas? Revisa especialmente el registro y cachés de shaders.`)) return;
    let confirmation = '';
    if (kind === 'purge') { confirmation = prompt('Borrado IRREVERSIBLE de archivos en cuarentena. Escribe ELIMINAR DEFINITIVAMENTE') || ''; if (confirmation !== 'ELIMINAR DEFINITIVAMENTE') return; }
    if (lock.current || externalBusy || !connected) return;
    lock.current = true;
    setBusy(true); setError(''); setCancelRequested(false); setProgress(null);
    try {
      if (kind === 'preview') { setPlan(await request('preview')); setSelected([]); setCategory('all'); }
      else {
        const result = await request(kind === 'quarantine' ? kind : `${kind}/${restoreId}`, kind === 'quarantine'
          ? { planId: plan?.id, itemIds: selected } : kind === 'purge' ? { confirmation } : undefined);
        setReceipt(result); setRestoreId(result.id); setPlan(null); setSelected([]); await refreshReceipts();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">Limpieza inteligente y recuperable</h1>
    <p className="text-sm text-neutral-400">Vista previa sin cambios → selección → cuarentena → restaurar o purgar. Nada se selecciona automáticamente. Temporales, cachés, logs/crashes de aplicaciones, miniaturas y archivos de la papelera del usuario actual. Solo archivos antiguos en ubicaciones permitidas y candidatos HKCU Run; no es un limpiador universal de registro ni una réplica completa de CCleaner.</p>
    <p className="text-amber-300 text-sm">Limpiar cachés o registro no garantiza FPS. Borrar shaders puede causar tirones. No se tocan cookies, contraseñas, Prefetch, WinSxS ni Windows Update.</p>
    {!connected && <p>Inicia el motor Windows para escanear.</p>}
    <button disabled={!connected || externalBusy || busy} className="rounded bg-emerald-500 text-black px-4 py-2 disabled:opacity-40" onClick={() => action('preview')}>Escanear sin modificar</button>
    {busy && <div role="status"><p>{cancelRequested ? 'Cancelación solicitada: se termina el archivo actual y se conservan los pendientes.' : 'Procesando… no cierres el motor.'}</p>{progress && <p className="text-xs">{progress.action} · {progress.processed} procesados · {progress.total} candidatos/elementos observados (no es una estimación porcentual).</p>}<button disabled={cancelRequested} onClick={cancel} className="border rounded px-3 py-2">Cancelar de forma segura</button></div>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {plan && <div className="space-y-3">
      {plan.warnings.map(w => <p className="text-xs text-amber-300" key={w}>{w}</p>)}
      {(plan.complete === false || plan.cancelled) && <p role="status" className="text-amber-300">Inventario parcial{plan.cancelled ? ' por cancelación' : ''}. Solo se cuentan archivos realmente analizados.</p>}
      <div className="rounded border border-neutral-700 p-3 text-sm">
        <p>{plan.logicalBytes ?? plan.items.reduce((n,i)=>n+bytes(i),0)} bytes lógicos analizados · {plan.allocatedBytes == null ? 'Asignación física no disponible' : `${plan.allocatedBytes} bytes asignados leídos de Windows`}</p>
        <p>Selección: {plan.items.filter(i=>selected.includes(i.id)).reduce((n,i)=>n+bytes(i),0)} bytes lógicos. La asignación no garantiza espacio físico liberado.</p>
      </div>
      <label className="block text-sm">Categoría<select aria-label="Categoría de limpieza" value={category} onChange={e=>setCategory(e.target.value)} className="block bg-neutral-900 border border-neutral-700 rounded p-2"><option value="all">Todas las categorías</option>{[...new Set(plan.items.map(i=>i.category))].map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      <div className="grid gap-2 md:grid-cols-2">{[...new Set(plan.items.map(i=>i.category))].map(name=> {
        const items=plan.items.filter(i=>i.category===name);
        return <article key={name} className="rounded border border-neutral-700 p-3 text-sm"><h2 className="font-bold">{name}</h2><p>{items.length} candidatos · {items.reduce((n,i)=>n+bytes(i),0)} bytes lógicos</p><button disabled={busy || externalBusy} className="underline mr-3" onClick={()=>{selectCategory(name);setCategory(name);}}>Seleccionar categoría (hasta 500)</button><button disabled={busy || externalBusy} className="underline" onClick={()=>setSelected(s=>s.filter(id=>!items.some(i=>i.id===id)))}>Quitar categoría</button></article>;
      })}</div>
      <p>{plan.items.length} candidatos · {selected.length} seleccionados (máximo 500)</p>
      <div className="max-h-[32rem] overflow-auto space-y-2">{plan.items.filter(i=>category==='all' || i.category===category).map(item => <label key={item.id} className="block rounded border border-neutral-800 p-3 text-sm">
        <input type="checkbox" disabled={externalBusy || busy || (!selected.includes(item.id) && selected.length >= 500)} checked={selected.includes(item.id)} onChange={e => setSelected(v => e.target.checked ? [...v, item.id] : v.filter(id => id !== item.id))} />
        <span className="ml-2 font-bold">{item.category}</span><span className="block break-all text-xs text-neutral-400">{item.path} {item.valueName} {item.value}</span>
        <span className="text-xs">{item.kind === 'Registry' ? 'Revisión manual, respaldo antes de eliminar' : `${bytes(item)} bytes lógicos${item.companion ? ' (incluye metadatos $I de papelera)' : ''}`}</span>
      </label>)}</div>
      {plan.outcomes && <details><summary>{plan.outcomes.length} elementos/ubicaciones omitidos durante el análisis</summary><div className="max-h-64 overflow-auto">{plan.outcomes.map((o,i)=><p key={i} className="text-xs break-all">{o.category} · {o.path} · {o.reason}</p>)}</div></details>}
      <button disabled={externalBusy || busy || !selected.length} className="rounded border border-amber-600 px-4 py-2 disabled:opacity-40" onClick={() => action('quarantine')}>Poner selección en cuarentena</button>
    </div>}
    <div className="rounded-xl border border-neutral-800 p-4 space-y-3">
      <h2 className="font-bold">Cuarentenas guardadas en este equipo</h2>
      <button disabled={!connected || busy || externalBusy} className="underline disabled:opacity-40" onClick={refreshReceipts}>Actualizar cuarentenas</button>
      {receiptError && <p role="alert" className="text-amber-300 text-sm">{receiptError}</p>}
      {!receiptError && connected && !receipts.some(r => r.items.length > 0) && <p className="text-sm text-neutral-400">Sin elementos pendientes en el inventario leído.</p>}
      {receipts.filter(r => r.items.length > 0).map(r => <button key={r.id} disabled={busy || externalBusy} onClick={() => {setRestoreId(r.id);setReceipt(r);}} className="block text-left border border-neutral-700 rounded p-2 text-xs break-all">{r.id} · {r.items.length} pendientes · {(r.bytesQuarantined / 1048576).toFixed(2)} MB en cuarentena</button>)}
      <label className="block">ID de cuarentena para recuperar (también tras reiniciar)<input className="block w-full rounded bg-neutral-900 px-3 py-2 mt-2" value={restoreId} onChange={e => setRestoreId(e.target.value)} /></label>
      <div className="flex gap-3"><button disabled={externalBusy || busy || !connected || !restoreId} onClick={() => action('restore')} className="border rounded px-3 py-2 disabled:opacity-40">Restaurar sin sobrescribir</button>
        <button disabled={externalBusy || busy || !connected || !restoreId} onClick={() => action('purge')} className="border border-rose-800 rounded px-3 py-2 disabled:opacity-40">Purgar archivos definitivamente</button></div>
      <p className="text-xs text-neutral-400">Cuarentena mueve archivos, no libera espacio físico. La purga es irreversible; las copias del registro se conservan.</p>
    </div>
    {receipt && <div className="rounded border border-neutral-700 p-4 space-y-2"><p>{receipt.message}</p>{receipt.status && <p>Estado del motor: {receipt.status}</p>}{receipt.cancelled && <p className="text-amber-300">Cancelado: los pasos ya completados no se inventan ni se revierten silenciosamente. Los elementos pendientes conservan su respaldo.</p>}
      {receipt.action === 'purge' && <p>{receipt.bytesDeleted ?? 0} bytes lógicos eliminados en esta purga; no es una medición de espacio físico libre.</p>}
      <p>ID: {receipt.id} · {(receipt.bytesQuarantined / 1048576).toFixed(2)} MB aún en cuarentena · {receipt.errors.length} incidencias</p>
      {receipt.volumes?.map(v=><div key={v.volume} className="text-xs border border-neutral-700 p-2 rounded"><p>Unidad {v.volume}: libre antes {v.freeBefore ?? 'no disponible'} bytes · después {v.freeAfter ?? 'no disponible'} bytes · delta neto observado {v.observedFreeDelta ?? 'no disponible'} bytes</p><p>{v.note}</p></div>)}
      {receipt.outcomes && <details><summary>{receipt.outcomes.length} resultados por elemento</summary><div className="max-h-64 overflow-auto">{receipt.outcomes.map((o,i)=><p key={i} className="text-xs break-all">{o.status} · {o.path} · {o.reason} · {o.bytes ?? 0} bytes lógicos</p>)}</div></details>}
      {receipt.errors.map((e, i) => <p key={i} className="text-xs text-amber-300 break-all">{e}</p>)}
      <button className="underline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'evo-cleanup-receipt.json'; a.click(); URL.revokeObjectURL(url); }}>Guardar recibo e ID</button>
    </div>}
  </section>;
}
