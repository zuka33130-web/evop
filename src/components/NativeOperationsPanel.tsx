import { useState } from 'react';
import type { OperationCatalogItem, OperationResult } from '../services/nativeBridge';

export function NativeOperationsPanel({ connected, catalog, apply, restore }: {
  connected: boolean; catalog: OperationCatalogItem[]; apply: (id: string) => Promise<OperationResult>;
  restore: (id: string) => Promise<OperationResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState('');
  async function execute(item: OperationCatalogItem, revert: boolean) {
    if (!window.confirm(`${revert ? 'Restaurar' : 'Aplicar'}: ${item.name}\n${item.description}\n${item.confirmationMessage || ''}\nEsto puede modificar Windows. No garantiza más FPS.`)) return;
    setBusy(true); setError('');
    try { setResult(await (revert ? restore : apply)(item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">Operaciones nativas · catálogo real del motor</h1>
    <p className="text-sm text-neutral-400">Las guías BIOS, estimaciones y exportadores no ejecutan cambios. Aquí cada acción habilitada llama al motor Windows; los módulos pendientes se bloquean. Aplica un cambio a la vez y compara frametimes antes/después.</p>
    {!connected && <p className="text-amber-300">Motor desconectado. Inícialo localmente en Windows.</p>}
    {catalog.map(item => <article key={item.id} className="rounded-xl border border-neutral-800 p-4 space-y-2">
      <h2 className="font-bold">{item.name} {!item.isImplemented && '· Pendiente / bloqueado'}</h2>
      <p className="text-sm text-neutral-400">{item.description}</p>
      <p className="text-xs text-neutral-500">{item.id} · {item.requiresElevation ? 'Administrador requerido' : 'Usuario estándar'} · {item.canRestore ? 'Restauración dedicada' : 'Sin restauración anunciada'}</p>
      <div className="flex gap-3">
        <button disabled={!connected || busy || !item.isImplemented} onClick={() => execute(item, false)} className="bg-emerald-500 text-black rounded px-3 py-2 disabled:opacity-30">Ejecutar</button>
        {item.canRestore && <button disabled={!connected || busy || !item.isImplemented} onClick={() => execute(item, true)} className="border border-neutral-600 rounded px-3 py-2 disabled:opacity-30">Restaurar respaldo</button>}
      </div>
    </article>)}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {result && <div role="status" className="rounded-xl border border-neutral-700 p-4">
      <h2>{result.success ? 'Verificado por el motor' : 'Falló / incompleto'} · {result.operationId}</h2>
      {result.errorMessage && <p className="text-rose-300">{result.errorMessage}</p>}
      <pre className="whitespace-pre-wrap text-xs mt-3">{result.logs.join('\n')}</pre>
    </div>}
  </section>;
}
