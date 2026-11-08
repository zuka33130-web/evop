import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { operationGuide } from '../services/operationGuide';
import { DEFAULT_NATIVE_ENGINE_URL, fetchOperationStatus, type OperationCatalogItem, type OperationResult, type OperationStatusResponse } from '../services/nativeBridge';

export function NativeOperationsPanel({ connected, elevated, globalBusy, catalog, apply, restore, onMeasure }: {
  onMeasure?: () => void;
  connected: boolean; elevated: boolean; globalBusy: boolean; catalog: OperationCatalogItem[];
  apply: (id: string) => Promise<OperationResult>; restore: (id: string) => Promise<OperationResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [states, setStates] = useState<Record<string, OperationStatusResponse>>({});
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let disposed = false;
    setStates({});
    if (!connected) return;
    setLoading(true);
    Promise.all(catalog.filter(c => c.isImplemented && c.canRestore).map(async c => [c.id, await fetchOperationStatus(c.id)] as const))
      .then(values => { if (!disposed) { setStates(Object.fromEntries(values)); } })
      .catch(() => { if (!disposed) setError('No se pudieron consultar los respaldos. Actualiza antes de restaurar.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [connected, catalog, refresh]);
  async function execute(item: OperationCatalogItem, revert: boolean) {
    if (!window.confirm(`${revert ? 'Restaurar' : 'Aplicar'}: ${item.name}\n${item.description}\n${item.confirmationMessage || ''}\nEsto puede modificar Windows. No garantiza más FPS.`)) return;
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try { setResult(await (revert ? restore : apply)(item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { lock.current = false; setBusy(false); setRefresh(v => v + 1); }
  }
  async function recover(expired: boolean) {
    if (!confirm(expired ? 'Solo se archivará el respaldo de CS2 si el motor puede verificar que la instancia original terminó. No se modificará la nueva instancia. ¿Continuar?'
      : 'Restaurar todos los módulos con respaldos verificados. No incluye snapshots heredados ni archivos purgados; puede requerir administrador. ¿Continuar?')) return;
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/recovery/${expired ? 'cs2-expired' : 'verified'}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falló la recuperación');
      if (expired) { setResult(null); setError(data.message); } else setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de recuperación'); }
    finally { lock.current = false; setBusy(false); setRefresh(v => v + 1); }
  }
  const available = catalog.filter(item => item.isImplemented && (category === 'all' || item.category === category) && `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="space-y-5">
    <div className="page-heading"><div><span className="eyebrow">CHANGE WORKSPACE</span><h1>Operaciones nativas verificables</h1><p>Conoce el alcance antes de aplicar. Prueba un solo módulo y compara la misma escena en el laboratorio.</p></div><button className="secondary-button" onClick={onMeasure}>Medir antes / después <ArrowUpRight size={14} /></button></div>
    {!connected && <p className="text-amber-300">Motor desconectado. Inícialo localmente en Windows.</p>}
    {connected && !elevated && <p className="text-amber-300 text-sm">Usuario estándar: los cambios de sistema que exigen administrador están bloqueados. No se implementó elevación selectiva.</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Buscar operaciones" placeholder="Buscar por nombre, categoría o descripción" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
      <select aria-label="Categoría de operación" className="evo-input" style={{width:'auto'}} value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas las categorías</option>{[...new Set(catalog.filter(c => c.isImplemented).map(c => c.category))].map(c => <option key={c} value={c}>{c === 'Cortex' ? 'Módulos y accesos' : c}</option>)}</select>
      <button disabled={!connected || busy || globalBusy || loading} className="secondary-button" onClick={() => setRefresh(v => v + 1)}>Actualizar respaldos</button></div>
    <details className="instrument-card space-y-3"><summary className="text-xs font-semibold">Recuperación y respaldos</summary><h2 className="font-bold">Recuperación</h2>
      <p className="text-xs text-neutral-400">Solo se usan respaldos verificados. La restauración puede ser parcial si faltan permisos o el juego cerró; se muestran los pasos fallidos.</p>
      <div className="flex flex-wrap gap-3"><button disabled={!connected || busy || globalBusy || loading} className="border rounded px-3 py-2 disabled:opacity-30" onClick={() => recover(false)}>Restaurar módulos con respaldo</button>
      {states['gaming.cs2.priority']?.hasBackup && <button disabled={!connected || busy || globalBusy} className="border rounded px-3 py-2 disabled:opacity-30" onClick={() => recover(true)}>Archivar respaldo de CS2 terminado</button>}</div>
    </details>
    {result && <div role="status" className="rounded-xl border border-neutral-700 p-4">
      <h2>{result.success ? 'Operación completada' : 'Falló / incompleto'} · {result.operationId}</h2>
      {result.errorMessage && <p className="text-rose-300">{result.errorMessage}</p>}
      <pre className="whitespace-pre-wrap text-xs mt-3">{result.logs.join('\n')}</pre>
      {result.success && <button className="primary-button mt-3" onClick={onMeasure}>Comprobar resultado en laboratorio <ArrowUpRight size={13} /></button>}
      <details className="mt-2 text-xs"><summary>Estado anterior / posterior y pasos</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ previous: result.previousState, current: result.currentState }, null, 2)}</pre></details>
    </div>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {loading && <p role="status">Consultando respaldos…</p>}
    {available.map(item => {
      const guide = operationGuide(item);
      const permissionBlocked = item.requiresElevation && !elevated;
      const hasBackup = states[item.id]?.hasBackup === true;
      const disabled = !connected || busy || globalBusy || permissionBlocked;
      return <article key={item.id} className="instrument-card space-y-3">
        <div className="flex gap-3 items-center justify-between"><span className="pill"><SlidersHorizontal size={11} />{item.category === 'Cortex' ? 'Módulo nativo' : item.category}</span><span className="text-[10px] text-neutral-400">{item.isReadOnly ? 'Solo lectura' : item.requiresRestart ? 'Cambio · reinicio posible' : 'Cambio de sesión / configuración'}</span></div>
        <h2 className="text-base font-semibold">{item.name}</h2><p className="text-sm text-neutral-400">{item.description}</p>
        <p className="text-xs text-neutral-500">{item.id} · {item.requiresElevation ? 'Administrador requerido' : 'Usuario estándar'} · {item.canRestore ? hasBackup ? 'Respaldo disponible' : 'Sin respaldo detectado' : 'Acción sin restauración'} {item.requiresRestart && '· Puede requerir reinicio'}</p>
        <details><summary className="text-[11px] text-lime-200">Definición, riesgos y cómo comprobarlo</summary><dl className="definition-grid">{[['Qué cambia',guide.scope],['Cuándo considerarlo',guide.when],['Riesgos y límites',guide.risk],['Cómo verificar el efecto',guide.verify],['Cómo revertir',guide.undo]].map(([title,text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl></details>
        <div className="flex flex-wrap gap-3 pt-2"><button disabled={disabled} title={permissionBlocked ? 'El motor no está elevado' : ''} onClick={() => execute(item, false)} className="primary-button">{item.isReadOnly ? 'Consultar' : 'Aplicar'}</button>
          {item.canRestore && <button disabled={disabled || !hasBackup || loading} onClick={() => execute(item, true)} className="secondary-button">Restaurar respaldo</button>}<button className="text-[11px] text-neutral-400 ml-auto" onClick={onMeasure}>Abrir medición ↗</button></div>
      </article>;
    })}
    {connected && !available.length && <p>No hay acciones que coincidan. Prueba otra búsqueda o reconecta para cargar el catálogo.</p>}
    <details className="border border-neutral-800 rounded-xl p-4"><summary>Funciones retiradas o pendientes ({catalog.filter(c => !c.isImplemented).length})</summary>
      <p className="text-sm text-neutral-400 my-2">No se muestran botones ficticios para ajustes sin verificación/restauración ni se recomienda desactivar seguridad. La limpieza se realiza en su vista previa dedicada.</p>
      {catalog.filter(c => !c.isImplemented).map(c => <p className="text-xs text-neutral-500 mb-2" key={c.id}>{c.id}: {c.availabilityReason || 'No disponible en este motor.'}</p>)}
    </details>
  </section>;
}
