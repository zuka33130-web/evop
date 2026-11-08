import { useEffect, useState } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL, fetchOperationStatus, type OperationCatalogItem, type OperationResult, type OperationStatusResponse } from '../services/nativeBridge';

export function NativeOperationsPanel({ connected, elevated, globalBusy, catalog, apply, restore }: {
  connected: boolean; elevated: boolean; globalBusy: boolean; catalog: OperationCatalogItem[];
  apply: (id: string) => Promise<OperationResult>; restore: (id: string) => Promise<OperationResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState('');
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
      .then(values => { if (!disposed) { setStates(Object.fromEntries(values)); setError(''); } })
      .catch(() => { if (!disposed) setError('No se pudieron consultar los respaldos. Actualiza antes de restaurar.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [connected, catalog, refresh]);
  async function execute(item: OperationCatalogItem, revert: boolean) {
    if (!window.confirm(`${revert ? 'Restaurar' : 'Aplicar'}: ${item.name}\n${item.description}\n${item.confirmationMessage || ''}\nEsto puede modificar Windows. No garantiza más FPS.`)) return;
    setBusy(true); setError('');
    try { setResult(await (revert ? restore : apply)(item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { setBusy(false); setRefresh(v => v + 1); }
  }
  async function recover(expired: boolean) {
    if (!confirm(expired ? 'Solo se archivará el respaldo de CS2 si el motor puede verificar que la instancia original terminó. No se modificará la nueva instancia. ¿Continuar?'
      : 'Restaurar todos los módulos con respaldos verificados. No incluye snapshots heredados ni archivos purgados; puede requerir administrador. ¿Continuar?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/recovery/${expired ? 'cs2-expired' : 'verified'}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falló la recuperación');
      if (expired) { setResult(null); setError(data.message); } else setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de recuperación'); }
    finally { setBusy(false); setRefresh(v => v + 1); }
  }
  const available = catalog.filter(item => item.isImplemented && `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">Operaciones nativas verificables</h1>
    <p className="text-sm text-neutral-400">Solo se ofrecen las acciones implementadas por el motor. Escribir un valor no prueba una mejora: aplica uno a la vez y mide en A/B. Los presets pueden dejar cambios parciales si falla un paso.</p>
    {!connected && <p className="text-amber-300">Motor desconectado. Inícialo localmente en Windows.</p>}
    {connected && !elevated && <p className="text-amber-300 text-sm">Usuario estándar: los cambios de sistema que exigen administrador están bloqueados. No se implementó elevación selectiva.</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Buscar operaciones" placeholder="Buscar por nombre, categoría o descripción" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
      <button disabled={!connected || busy || globalBusy || loading} className="underline" onClick={() => setRefresh(v => v + 1)}>Actualizar respaldos</button></div>
    <div className="rounded-xl border border-amber-900 p-4 space-y-2"><h2 className="font-bold">Recuperación</h2>
      <p className="text-xs text-neutral-400">Solo se usan respaldos verificados. La restauración puede ser parcial si faltan permisos o el juego cerró; se muestran los pasos fallidos.</p>
      <div className="flex flex-wrap gap-3"><button disabled={!connected || busy || globalBusy || loading} className="border rounded px-3 py-2 disabled:opacity-30" onClick={() => recover(false)}>Restaurar módulos con respaldo</button>
      {states['gaming.cs2.priority']?.hasBackup && <button disabled={!connected || busy || globalBusy} className="border rounded px-3 py-2 disabled:opacity-30" onClick={() => recover(true)}>Archivar respaldo de CS2 terminado</button>}</div>
    </div>
    {result && <div role="status" className="rounded-xl border border-neutral-700 p-4">
      <h2>{result.success ? 'Operación completada' : 'Falló / incompleto'} · {result.operationId}</h2>
      {result.errorMessage && <p className="text-rose-300">{result.errorMessage}</p>}
      <pre className="whitespace-pre-wrap text-xs mt-3">{result.logs.join('\n')}</pre>
      <details className="mt-2 text-xs"><summary>Estado anterior / posterior y pasos</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ previous: result.previousState, current: result.currentState }, null, 2)}</pre></details>
    </div>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {loading && <p role="status">Consultando respaldos…</p>}
    {available.map(item => {
      const permissionBlocked = item.requiresElevation && !elevated;
      const hasBackup = states[item.id]?.hasBackup === true;
      const disabled = !connected || busy || globalBusy || permissionBlocked;
      return <article key={item.id} className="rounded-xl border border-neutral-800 p-4 space-y-2">
        <h2 className="font-bold">{item.name}</h2><p className="text-sm text-neutral-400">{item.description}</p>
        <p className="text-xs text-neutral-500">{item.id} · {item.requiresElevation ? 'Administrador requerido' : 'Usuario estándar'} · {item.canRestore ? hasBackup ? 'Respaldo disponible' : 'Sin respaldo detectado' : 'Acción sin restauración'} {item.requiresRestart && '· Puede requerir reinicio'}</p>
        <div className="flex gap-3"><button disabled={disabled} title={permissionBlocked ? 'El motor no está elevado' : ''} onClick={() => execute(item, false)} className="bg-emerald-500 text-black rounded px-3 py-2 disabled:opacity-30">{item.isReadOnly ? 'Consultar' : 'Aplicar'}</button>
          {item.canRestore && <button disabled={disabled || !hasBackup || loading} onClick={() => execute(item, true)} className="border border-neutral-600 rounded px-3 py-2 disabled:opacity-30">Restaurar respaldo</button>}</div>
      </article>;
    })}
    {connected && !available.length && <p>No hay acciones que coincidan. Prueba otra búsqueda o reconecta para cargar el catálogo.</p>}
    <details className="border border-neutral-800 rounded-xl p-4"><summary>Funciones retiradas o pendientes ({catalog.filter(c => !c.isImplemented).length})</summary>
      <p className="text-sm text-neutral-400 my-2">No se muestran botones ficticios para ajustes sin verificación/restauración ni se recomienda desactivar seguridad. La limpieza se realiza en su vista previa dedicada.</p>
      {catalog.filter(c => !c.isImplemented).map(c => <p className="text-xs text-neutral-500 mb-2" key={c.id}>{c.id}: {c.availabilityReason || 'No disponible en este motor.'}</p>)}
    </details>
  </section>;
}
