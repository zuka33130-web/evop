import { useState } from 'react';
import { OptimizationStudio } from './components/OptimizationStudio';
import { PerformanceDashboard } from './components/PerformanceDashboard';
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
  const [panelBusy, setPanelBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const guardedApply: typeof native.applyOp = async id => {
    if (captureBusy || workflowBusy || cleanupBusy || panelBusy) throw new Error('Medición en curso: espera a que termine antes de aplicar cambios.');
    return native.applyOp(id);
  };
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState('');
  async function launchGame() {
    setLaunching(true); setLaunchMessage('Solicitando inicio a Steam…');
    try {
      const launch = await guardedApply('gaming.cs2.launch');
      if (!launch.success) throw new Error(launch.errorMessage || 'Falló el lanzamiento.');
      setLaunchMessage(launch.currentState?.isRunning
        ? 'CS2 detectado. No se alteró su prioridad ni afinidad. Mide una referencia antes de aplicar cambios.'
        : 'Solicitud enviada a Steam; el juego todavía no está confirmado como activo.');
    } catch (e) { setLaunchMessage(e instanceof Error ? e.message : 'Falló la conexión.'); }
    finally { setLaunching(false); }
  }
  const labels: Record<string, string> = { studio:'Plantillas y Modo Bestia', dashboard:'Panel de control', stability:'Laboratorio de FPS', 'native-operations':'Operaciones Windows', advisor:'Auditor local', cleaner:'Limpieza inteligente', diagnostics:'Diagnóstico', history:'Historial', knowledge:'Fuentes y herramientas' };
  return <div className="evo-shell">
    <a href="#main-content" className="sr-only focus:not-sr-only">Saltar al contenido</a>
    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isNativeConnected={native.isConnected} />
    <div className="evo-main">
      <header className="evo-topbar"><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{labels[activeTab]}</strong></div><div className="topbar-status"><span className={`status-dot ${native.isConnected ? 'online' : ''}`} />{native.isConnected ? native.engineInfo?.isElevated ? 'Administrador' : 'Usuario estándar' : 'Motor desconectado'}<button className="ml-3 hover:text-white" disabled={native.connectionStatus === 'connecting' || captureBusy} onClick={native.reconnect}>Reconectar ↗</button></div></header>
      <main id="main-content" className="evo-content space-y-5">
        {native.error && <p role="alert" className="rounded border border-amber-800 p-3 text-sm text-amber-300">{native.error}</p>}
        {captureBusy && activeTab !== 'stability' && <div className="notice">Hay una medición en curso. No apliques cambios externos durante la captura. <button className="underline" onClick={() => setActiveTab('stability')}>Ver progreso →</button></div>}
        {workflowBusy && activeTab !== 'studio' && <div className="notice">Se está preparando una plantilla o sesión. Espera el recibo antes de aplicar otros cambios. <button className="underline" onClick={() => setActiveTab('studio')}>Ver progreso →</button></div>}
        {cleanupBusy && activeTab !== 'cleaner' && <div className="notice">Limpieza en curso. Espera su resultado antes de medir. <button className="underline" onClick={() => setActiveTab('cleaner')}>Ver limpieza →</button></div>}
        {activeTab === 'dashboard' && <PerformanceDashboard native={native} navigate={setActiveTab} launchGame={launchGame} launching={launching || captureBusy || workflowBusy || cleanupBusy || panelBusy} launchMessage={launchMessage} />}
        <div hidden={activeTab !== 'native-operations'}><NativeOperationsPanel onBusyChange={setPanelBusy} connected={native.isConnected} elevated={!!native.engineInfo?.isElevated} globalBusy={!!native.activeOperation || captureBusy || workflowBusy || cleanupBusy} catalog={native.catalog} onMeasure={() => setActiveTab('stability')} apply={guardedApply} restore={native.restoreOp} /></div>
        {activeTab === 'diagnostics' && <section className="space-y-5"><h1 className="text-2xl font-bold">Diagnóstico del equipo</h1><NativeDiagnosticsCard status={native.connectionStatus} engineInfo={native.engineInfo} diagnostics={native.diagnostics} error={native.error} isScanning={native.isScanning} onReconnect={native.reconnect} onRefresh={native.refreshScan} catalog={native.catalog} history={native.history} /></section>}
        <div hidden={activeTab !== 'studio'}><OptimizationStudio visible={activeTab === 'studio'} connected={native.isConnected} globalBusy={panelBusy || captureBusy || cleanupBusy || !!native.activeOperation} onBusyChange={setWorkflowBusy} onMeasure={() => setActiveTab('stability')} restorePriority={() => native.restoreOp('gaming.cs2.priority')} /></div>
        <div hidden={activeTab !== 'stability'}><FrameStabilityLab externalBusy={panelBusy || workflowBusy || cleanupBusy || !!native.activeOperation} connected={native.isConnected} onBusyChange={setCaptureBusy} /></div>
        <div hidden={activeTab !== 'cleaner'}><SmartCleanup onBusyChange={setCleanupBusy} externalBusy={panelBusy || captureBusy || workflowBusy || !!native.activeOperation} connected={native.isConnected} /></div>
        <div hidden={activeTab !== 'advisor'}><LocalAuditAdvisor externalBusy={captureBusy || workflowBusy || cleanupBusy || panelBusy} onStudio={() => setActiveTab('studio')} catalog={native.catalog} elevated={!!native.engineInfo?.isElevated} connected={native.isConnected} apply={guardedApply} onMeasure={() => setActiveTab('stability')} /></div>
        {activeTab === 'knowledge' && <ResearchSources />}
        {activeTab === 'history' && <section className="space-y-4"><h1 className="text-2xl font-bold">Historial del motor</h1><p className="text-sm text-neutral-400">Resultados de aplicación y restauración. No confundir cambio aplicado con mejora de rendimiento. Este historial es de la sesión del motor.</p><button disabled={!native.isConnected} className="underline" onClick={native.refreshHistory}>Actualizar historial</button>
          {!native.history.length && <p>No hay operaciones registradas.</p>}
          {native.history.map(h => <article className="rounded border border-neutral-800 p-4" key={h.id}><h2>{h.success ? 'Correcto' : 'Falló'} · {h.operationId} · {h.actionType}</h2><p className="text-xs text-neutral-400">{new Date(h.timestampUtc).toLocaleString()} · {h.durationMs.toFixed(1)} ms</p><p className="text-sm">{h.summary}</p>{h.errorMessage && <p className="text-amber-300 text-sm">{h.errorMessage}</p>}</article>)}</section>}
      </main>
    </div>
  </div>;
}
