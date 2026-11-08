import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NativeDiagnosticsCard } from './components/NativeDiagnosticsCard';
import { NativeOperationsPanel } from './components/NativeOperationsPanel';
import { FrameStabilityLab } from './components/FrameStabilityLab';
import { SmartCleanup } from './components/SmartCleanup';
import { LocalAuditAdvisor } from './components/LocalAuditAdvisor';
import { ResearchSources } from './components/ResearchSources';
import { useNativeBridge } from './services/nativeBridge';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const native = useNativeBridge();
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState('');
  async function launchGame() {
    setLaunching(true); setLaunchMessage('Solicitando inicio a Steam…');
    try {
      const launch = await native.applyOp('gaming.cs2.launch');
      if (!launch.success) throw new Error(launch.errorMessage || 'Falló el lanzamiento.');
      setLaunchMessage(launch.currentState?.isRunning
        ? 'CS2 detectado. No se alteró su prioridad ni afinidad. Mide una referencia antes de aplicar cambios.'
        : 'Solicitud enviada a Steam; el juego todavía no está confirmado como activo.');
    } catch (e) { setLaunchMessage(e instanceof Error ? e.message : 'Falló la conexión.'); }
    finally { setLaunching(false); }
  }
  return <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col lg:flex-row">
    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isNativeConnected={native.isConnected} />
    <div className="flex-1 min-w-0">
      <header className="border-b border-neutral-800 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div><span className="font-bold">EVO Optimizer</span><span className="ml-3 text-xs text-neutral-400">Medir → cambiar uno → verificar → restaurar</span></div>
        <div className="flex items-center gap-3 text-xs"><span className={native.isConnected ? 'text-emerald-300' : 'text-amber-300'}>{native.isConnected ? native.engineInfo?.isElevated ? 'Motor conectado · administrador' : 'Motor conectado · usuario estándar' : 'Motor desconectado'}</span>
          <button className="underline" disabled={native.connectionStatus === 'connecting'} onClick={native.reconnect}>Reconectar</button></div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-5">
        {native.error && <p role="alert" className="rounded border border-amber-800 p-3 text-sm text-amber-300">{native.error}</p>}
        {activeTab === 'dashboard' && <section className="space-y-6">
          <h1 className="text-3xl font-bold">Panel de control</h1>
          <p className="text-neutral-400">Operaciones nativas con respaldo y mediciones reales. Sin perfiles de hardware inventados, mejoras de FPS garantizadas ni scripts agresivos descargables.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border border-neutral-800 rounded-xl p-5"><h2 className="text-sm text-neutral-400">CPU detectada</h2><p className="mt-2 font-bold">{native.diagnostics?.processor.name || 'Sin lectura'}</p></div>
            <div className="border border-neutral-800 rounded-xl p-5"><h2 className="text-sm text-neutral-400">RAM detectada</h2><p className="mt-2 font-bold">{native.diagnostics ? `${native.diagnostics.memory.totalGb.toFixed(1)} GB · ${native.diagnostics.memory.availableGb.toFixed(1)} GB disponibles` : 'Sin lectura'}</p></div>
            <div className="border border-neutral-800 rounded-xl p-5"><h2 className="text-sm text-neutral-400">Catálogo del motor</h2><p className="mt-2 font-bold">{native.isConnected ? `${native.catalog.filter(c => c.isImplemented).length} acciones disponibles` : 'Sin conexión'}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">{[
            ['advisor', '1. Auditar el equipo', 'Inventario real y recomendaciones explicables.'],
            ['stability', '2. Medir una referencia', 'Frametimes, 1% low, P99 y pruebas A/B por módulo.'],
            ['native-operations', '3. Aplicar un cambio', 'Catálogo real, permisos y restauración por respaldo.'],
            ['cleaner', '4. Limpiar con revisión', 'Vista previa, cuarentena recuperable y purga explícita.']
          ].map(([id, title, text]) => <button key={id} onClick={() => setActiveTab(id)} className="text-left rounded-xl border border-neutral-800 p-5 hover:border-emerald-700"><h2 className="font-bold">{title}</h2><p className="text-sm text-neutral-400 mt-2">{text}</p></button>)}</div>
          {!native.engineInfo?.isElevated && <p className="text-sm text-amber-300">El escritorio no eleva procesos automáticamente. Las acciones que necesitan administrador se muestran bloqueadas; no se evita la comprobación de permisos.</p>}
          <div className="rounded-xl border border-neutral-800 p-5 space-y-3"><h2 className="font-bold">Lanzar CS2 sin aplicar tweaks</h2><button onClick={launchGame} disabled={!native.isConnected || launching || !!native.activeOperation} className="rounded bg-emerald-500 text-black px-4 py-2 disabled:opacity-40">{launching ? 'Iniciando…' : 'Solicitar inicio a Steam'}</button><p role="status" className="text-sm text-neutral-400">{launchMessage}</p></div>
        </section>}
        {activeTab === 'native-operations' && <NativeOperationsPanel connected={native.isConnected} elevated={!!native.engineInfo?.isElevated} globalBusy={!!native.activeOperation} catalog={native.catalog} apply={native.applyOp} restore={native.restoreOp} />}
        {activeTab === 'diagnostics' && <section className="space-y-5"><h1 className="text-2xl font-bold">Diagnóstico del equipo</h1><NativeDiagnosticsCard status={native.connectionStatus} engineInfo={native.engineInfo} diagnostics={native.diagnostics} error={native.error} isScanning={native.isScanning} onReconnect={native.reconnect} onRefresh={native.refreshScan} catalog={native.catalog} history={native.history} /></section>}
        {activeTab === 'stability' && <FrameStabilityLab connected={native.isConnected} />}
        {activeTab === 'cleaner' && <SmartCleanup connected={native.isConnected} />}
        {activeTab === 'advisor' && <LocalAuditAdvisor connected={native.isConnected} apply={native.applyOp} onMeasure={() => setActiveTab('stability')} />}
        {activeTab === 'knowledge' && <ResearchSources />}
        {activeTab === 'history' && <section className="space-y-4"><h1 className="text-2xl font-bold">Historial del motor</h1><p className="text-sm text-neutral-400">Resultados de aplicación y restauración. No confundir cambio aplicado con mejora de rendimiento. Este historial es de la sesión del motor.</p><button disabled={!native.isConnected} className="underline" onClick={native.refreshHistory}>Actualizar historial</button>
          {!native.history.length && <p>No hay operaciones registradas.</p>}
          {native.history.map(h => <article className="rounded border border-neutral-800 p-4" key={h.id}><h2>{h.success ? 'Correcto' : 'Falló'} · {h.operationId} · {h.actionType}</h2><p className="text-xs text-neutral-400">{new Date(h.timestampUtc).toLocaleString()} · {h.durationMs.toFixed(1)} ms</p><p className="text-sm">{h.summary}</p>{h.errorMessage && <p className="text-amber-300 text-sm">{h.errorMessage}</p>}</article>)}</section>}
      </main>
    </div>
  </div>;
}
