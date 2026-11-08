import { useEffect, useRef, useState } from 'react';
import { Rocket, Layers3, ShieldCheck, ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';
type Definition = { id: string; name: string; category: string; purpose: string; risk: string; kind: string; hive: string; path: string; valueName: string; target: string; admin: boolean; restart: boolean; applicability: string };
type Template = { id: string; name: string; description: string; risk: string; operations: string[] };
type Preview = { template: Template; note: string; items: { definition: Definition; available: boolean; reason: string | null; hasBackup: boolean; current: unknown }[] };
type BeastPlan = { id: string; expiresUtc: string; candidates: { pid:number; name:string; path:string; workingSetMb:number }[]; protected: string[]; warning:string };
type DebloatPreview = { plan: { id:string; expiresUtc:string; candidates:{ name:string; packageFullName:string }[] }; definitions:{ name:string; label:string; loss:string }[]; warning:string };
type Receipt = { id:string; templateId?:string; createdUtc?:string; restored?:boolean; finished?:boolean; results?: { operationId?:string; name?:string; action?:string; success:boolean; logs?:string[]; errorMessage?:string; message?:string }[]; applications?:{ pid:number; name:string; outcome:string; exited:boolean }[]; operations?:{ operationId:string; success:boolean; logs:string[]; errorMessage?:string }[]; template?: Receipt | null; limitations?:string[] };
async function api(path:string, body?:unknown) {
  const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/${path}`, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}
function exportReceipt(receipt:Receipt) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`evo-receipt-${receipt.id}.json`;a.click();URL.revokeObjectURL(url);
}
function ReceiptCard({ receipt }: {receipt:Receipt}) {
  const steps=[...(receipt.results || []),...(receipt.operations || [])];
  return <div className="instrument-card space-y-4" role="status"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Resultado y recibo de recuperación</h2><button className="secondary-button" onClick={() => exportReceipt(receipt)}><Download size={13} /> Exportar recibo</button></div>
    <p className="text-[11px] break-all text-neutral-400">ID: {receipt.id} · {receipt.restored ? 'Restauración completada' : receipt.finished === false ? 'Incompleto: revisa recuperación' : 'Revisar cada paso; no implica mejora de FPS'}</p>
    {steps.map((r,i) => <div className="border-t border-neutral-800 pt-3 text-xs" key={i}><p className={r.success ? 'text-lime-200' : 'text-amber-300'}>{r.success ? 'Verificado' : 'Falló / requiere revisión'} · {'operationId' in r ? r.operationId : ''}{'name' in r ? r.name : ''} {'action' in r ? r.action : ''}</p>{r.errorMessage && <p className="text-amber-200 mt-2">{r.errorMessage}</p>}{'message' in r && <p className="text-neutral-400 mt-2">{r.message}</p>}<details className="mt-2 text-neutral-400"><summary>Detalle del motor</summary><pre className="whitespace-pre-wrap break-all mt-2 text-[10px]">{r.logs?.join('\n') || JSON.stringify(r,null,2)}</pre></details></div>)}
    {receipt.applications?.map((p,i) => <p className="text-[11px] text-neutral-300" key={i}>{p.name} · PID {p.pid} · {p.exited ? 'Cierre confirmado' : 'No cerrado / no confirmado'} · {p.outcome}</p>)}
    {receipt.template && <p className="text-[11px] text-neutral-400 break-all">Plantilla de esta sesión: {receipt.template.id}. Recuperable en «Recibos de plantillas».</p>}
    {receipt.limitations?.map(l => <p className="text-[10px] text-amber-200/80" key={l}>{l}</p>)}
    <details className="text-[10px] text-neutral-500"><summary>Recibo completo</summary><pre className="whitespace-pre-wrap break-all mt-3">{JSON.stringify(receipt,null,2)}</pre></details>
  </div>;
}
export function OptimizationStudio({ connected, globalBusy, onBusyChange, onMeasure, restorePriority }: {
  connected:boolean; globalBusy:boolean; onBusyChange:(busy:boolean)=>void; onMeasure:()=>void; restorePriority:()=>Promise<unknown>;
}) {
  const [tab,setTab]=useState('templates'); const [templates,setTemplates]=useState<Template[]>([]);
  const [definitions,setDefinitions]=useState<Definition[]>([]); const [preview,setPreview]=useState<Preview|null>(null);
  const [selected,setSelected]=useState<string[]>([]); const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [receipt,setReceipt]=useState<Receipt|null>(null); const [busy,setBusy]=useState(false); const lock=useRef(false);
  const [error,setError]=useState(''); const [beast,setBeast]=useState<BeastPlan|null>(null); const [pids,setPids]=useState<number[]>([]);
  const [force,setForce]=useState(false); const [base,setBase]=useState(false); const [priority,setPriority]=useState(true);
  const [confirmation,setConfirmation]=useState(''); const [debloat,setDebloat]=useState<DebloatPreview|null>(null);
  const [packages,setPackages]=useState<string[]>([]); const [recoverId,setRecoverId]=useState('');
  useEffect(() => { onBusyChange(busy); },[busy,onBusyChange]);
  async function loadReceipts() { const rows=await api('templates/receipts'); if(Array.isArray(rows))setReceipts(rows); }
  useEffect(() => {
    if(!connected)return;
    Promise.all([api('templates'),api('library'),api('templates/receipts')]).then(([t,d,r]) => {setTemplates(Array.isArray(t)?t:[]);setDefinitions(Array.isArray(d)?d:[]);setReceipts(Array.isArray(r)?r:[]);}).catch(() => setError('No se pudo cargar el catálogo de plantillas. Reconecta con el motor actualizado.'));
  },[connected]);
  async function action(fn:()=>Promise<void>) {
    if(lock.current || globalBusy || !connected)return;
    lock.current=true;setBusy(true);setError('');
    try{await fn();}catch(e){setError(e instanceof Error?e.message:'Falló el flujo. Conserva el recibo y revisa recuperación.');}
    finally{lock.current=false;setBusy(false);}
  }
  const blocked=busy || globalBusy || !connected;
  function toggle<T>(values:T[],value:T,set:(v:T[])=>void){set(values.includes(value)?values.filter(v=>v!==value):[...values,value]);}
  async function inspect(id:string){await action(async()=>{setPreview(await api(`templates/${id}/preview`));setSelected([]);setReceipt(null);});}
  async function applyTemplate(){if(!preview || !confirm(`Aplicar ${selected.length} cambios reales de «${preview.template.name}». ${preview.template.risk} Si falla un paso se detiene la secuencia; podrás restaurar sus respaldos. ¿Continuar?`))return;await action(async()=>{setReceipt(await api(`templates/${preview.template.id}/apply`,{selectedIds:selected,confirmation:'APLICAR PLANTILLA'}));setPreview(null);setSelected([]);await loadReceipts();});}
  async function recoverTemplate(id:string){if(!confirm('Restaurar los respaldos que pertenecen a este recibo. No reinstala apps ni recupera trabajo de procesos cerrados. ¿Continuar?'))return;await action(async()=>{setReceipt(await api(`templates/receipts/${encodeURIComponent(id)}/restore`,{}));await loadReceipts();});}
  return <section className="space-y-5">
    <div className="page-heading"><div><span className="eyebrow">NATIVE OPTIMIZATION STUDIO</span><h1>Plantillas y Modo Bestia</h1><p>Controles explícitos, no un botón para apagar todo. {definitions.length ? `${definitions.length} acciones nuevas de Windows` : 'Catálogo del motor'}, con selección, lectura posterior y límites visibles.</p></div><button className="secondary-button" onClick={onMeasure}>Medir antes / después <ArrowUpRight size={14} /></button></div>
    <div className="phase-toggle" style={{maxWidth:680}}>{[['templates','Plantillas revisables'],['beast','Modo Bestia · CS2'],['debloat','Debloat de aplicaciones']].map(([id,label])=><button key={id} disabled={busy} aria-pressed={tab===id} onClick={()=>{setTab(id);setConfirmation('');setError('');}}>{label}</button>)}</div>
    {!connected && <p className="notice">Estas funciones necesitan el motor local actualizado en Windows. La vista previa remota no modifica tu PC.</p>}
    {globalBusy && <p className="notice">Espera a que termine la medición u operación activa. No mezcles cambios con capturas.</p>}
    {busy && <p role="status" className="notice">Procesando en Windows. No cierres el motor; espera el resultado y conserva el recibo.</p>}
    {error && <p role="alert" className="notice">{error}</p>}
    {tab==='templates' && <>
      <div className="notice">Rendimiento, privacidad y apariencia son objetivos distintos. Una escritura verificada no demuestra una mejora de FPS. Nada se aplica al abrir esta vista; prueba primero un módulo y mide.</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(t=><article className="instrument-card space-y-3" key={t.id}><div className="section-label"><Layers3 size={14} />{t.operations.length} módulos</div><h2 className="font-semibold text-sm">{t.name}</h2><p className="text-xs text-neutral-400 leading-6">{t.description}</p><p className="text-[10px] text-amber-200/75 leading-6">{t.risk}</p><button className="secondary-button" disabled={blocked} onClick={()=>inspect(t.id)}>Revisar cambios <ArrowUpRight size={12} /></button></article>)}</div>
      {preview && <div className="instrument-card space-y-4"><h2 className="text-lg font-semibold">Revisión · {preview.template.name}</h2><p className="text-xs text-neutral-400">{preview.note}</p><button className="secondary-button" disabled={blocked} onClick={()=>setSelected(preview.items.filter(i=>i.available).map(i=>i.definition.id))}>Seleccionar compatibles explícitamente</button>
        {preview.items.map(item=><div className="border-t border-neutral-800 pt-4" key={item.definition.id}><label className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={blocked || !item.available} checked={selected.includes(item.definition.id)} onChange={()=>toggle(selected,item.definition.id,setSelected)} /><span>{item.definition.name}<small className="block text-[10px] text-neutral-400 mt-2">{item.definition.admin?'Administrador':'Usuario estándar'} · {item.definition.restart?'Nueva sesión/reinicio posible':'Sin reinicio declarado'} · {item.definition.kind}</small></span></label><p className="text-xs text-neutral-400 mt-3 leading-6">{item.definition.purpose}</p><p className="text-[10px] text-amber-200/75 mt-2">{item.definition.risk}</p>{!item.available && <p className="text-xs text-amber-300 mt-2">No disponible: {item.reason}</p>}<details className="text-[10px] text-neutral-500 mt-3"><summary>Valor real, destino y compatibilidad</summary><p className="break-all mt-2">{item.definition.hive} {item.definition.path} / {item.definition.valueName} → {item.definition.target}</p><pre className="whitespace-pre-wrap">{JSON.stringify(item.current,null,2)}</pre><p>{item.definition.applicability}</p></details></div>)}
        <button className="primary-button" disabled={blocked || !selected.length} onClick={applyTemplate}>Aplicar {selected.length} cambios seleccionados</button></div>}
      <details className="instrument-card"><summary className="text-xs font-semibold">Recibos de plantillas · recuperación después de reiniciar</summary><button className="secondary-button my-4" disabled={blocked} onClick={()=>action(loadReceipts)}>Actualizar recibos</button>{!receipts.length && <p className="text-xs text-neutral-400">Sin recibos detectados.</p>}{receipts.map(r=><div key={r.id} className="run-row"><div>{r.templateId}<small className="break-all">{r.id} · {r.restored?'Restaurado':'Revisar respaldos'}</small></div><button className="secondary-button" disabled={blocked || r.restored} onClick={()=>recoverTemplate(r.id)}><RotateCcw size={12} /> Restaurar plantilla</button></div>)}</details>
    </>}
    {tab==='beast' && <>
      <div className="hero-panel"><span className="eyebrow">CS2 · SESSION LAUNCHER</span><h2>Prioriza tu partida.<br />No rompas sus dependencias.</h2><p>Analiza aplicaciones opcionales del mismo usuario. Elige cuáles cerrar, guarda tu trabajo y lanza CS2 con Steam. No se tocan Windows, anticheat, audio, red ni seguridad.</p><button className="primary-button mt-5" disabled={blocked} onClick={()=>action(async()=>{setBeast(await api('beast/preview',{}));setPids([]);setConfirmation('');setReceipt(null);})}><Rocket size={15} /> Analizar sesión antes de lanzar</button></div>
      {beast && <div className="instrument-card space-y-4"><p className="notice">{beast.warning}</p><p className="text-[10px] text-neutral-400">Vista previa válida hasta {new Date(beast.expiresUtc).toLocaleTimeString()}. Máximo 20 procesos seleccionados. Working set no equivale a RAM que se liberará: puede estar compartida.</p>
        {!beast.candidates.length && <p className="text-xs text-neutral-400">No hay procesos opcionales elegibles. Puedes lanzar CS2 sin cerrar nada.</p>}
        {beast.candidates.map(p=><label key={p.pid} className="flex gap-3 items-start border-t border-neutral-800 pt-3 text-xs"><input type="checkbox" disabled={blocked || (!pids.includes(p.pid) && pids.length>=20)} checked={pids.includes(p.pid)} onChange={()=>toggle(pids,p.pid,setPids)} /><span>{p.name} · PID {p.pid} · {p.workingSetMb.toFixed(1)} MB working set<small className="block text-[9px] text-neutral-500 mt-1 break-all">{p.path}</small></span></label>)}
        <div className="subtle-divider" />
        <label className="flex gap-3 text-xs"><input type="checkbox" disabled={blocked} checked={base} onChange={e=>setBase(e.target.checked)} /> Aplicar base Gaming: Game Mode, sin DVR ni invocación de barra con mando (recibo separado).</label>
        <label className="flex gap-3 text-xs"><input type="checkbox" disabled={blocked} checked={priority} onChange={e=>setPriority(e.target.checked)} /> Probar prioridad High para CS2 (no Realtime ni restricción de núcleos).</label>
        <label className="flex gap-3 text-xs text-amber-200"><input type="checkbox" disabled={blocked} checked={force} onChange={e=>{setForce(e.target.checked);setConfirmation('');}} /> Forzar terminación SOLO de los procesos elegidos. Puede perder trabajo sin guardar.</label>
        <p className="text-[10px] text-neutral-400 leading-6">Sin fuerza se solicita cierre normal: si una app no termina en 3 s, se informa y no se fuerza. Steam puede mantener procesos necesarios aunque no esté en primer plano. No se promete «solo el juego» ni FPS perfectos.</p>
        <details className="text-xs text-neutral-400"><summary>Dependencias protegidas</summary><ul className="mt-3 space-y-2">{beast.protected.map(p=><li key={p}>✓ {p}</li>)}</ul></details>
        <label className="field-label">Escribe {force?'CERRAR FORZOSAMENTE E INICIAR':'INICIAR MODO BESTIA'}<input aria-label="Confirmación Modo Bestia" className="evo-input mt-2" disabled={blocked} value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>
        <button className="primary-button" disabled={blocked || confirmation!==(force?'CERRAR FORZOSAMENTE E INICIAR':'INICIAR MODO BESTIA')} onClick={()=>action(async()=>{const result=await api('beast/start',{planId:beast.id,pids,forceSelected:force,applyGamingBase:base,highPriority:priority,confirmation});setReceipt(result);setBeast(null);setPids([]);setConfirmation('');await loadReceipts();})}><Rocket size={14} /> Lanzar CS2 · {pids.length} cierres elegidos</button>
      </div>}
      <button className="secondary-button" disabled={blocked} onClick={()=>action(async()=>{const r=await restorePriority() as {success?:boolean;errorMessage?:string};if(r?.success===false)throw new Error(r.errorMessage || 'No se pudo restaurar prioridad.');})}>Restaurar prioridad/afinidad del respaldo de CS2</button>
    </>}
    {tab==='debloat' && <>
      <div className="instrument-card space-y-4"><h2 className="text-base font-semibold flex items-center gap-2"><ShieldCheck size={17} /> Desinstalación selectiva, no borrado masivo</h2><p className="text-xs text-neutral-400 leading-7">Solo ocho paquetes opcionales permitidos y solo para tu usuario. Se conserva Store, App Installer, frameworks, Gaming Services, WebView2 y paquetes provisionados. Desinstalar puede perder datos locales; reinstalar no siempre es posible desde los archivos restantes.</p><button className="secondary-button" disabled={blocked} onClick={()=>action(async()=>{setDebloat(await api('debloat/preview',{}));setPackages([]);setConfirmation('');setReceipt(null);})}>Analizar aplicaciones opcionales</button></div>
      {debloat && <div className="instrument-card space-y-4"><p className="notice">{debloat.warning}</p>{!debloat.plan.candidates.length && <p className="text-xs text-neutral-400">No hay paquetes opcionales permitidos instalados para este usuario.</p>}{debloat.plan.candidates.map(p=>{const d=debloat.definitions.find(x=>x.name===p.name);return <label className="flex gap-3 items-start text-sm border-t border-neutral-800 pt-4" key={p.packageFullName}><input type="checkbox" disabled={blocked} checked={packages.includes(p.name)} onChange={()=>toggle(packages,p.name,setPackages)} /><span>{d?.label || p.name}<small className="block text-[10px] text-amber-200/75 mt-2">{d?.loss}</small><small className="block text-[9px] text-neutral-500 mt-2 break-all">{p.packageFullName}</small></span></label>;})}<label className="field-label">Escribe DESINSTALAR APLICACIONES<input aria-label="Confirmación debloat" className="evo-input mt-2" disabled={blocked} value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label><button className="primary-button" disabled={blocked || !packages.length || confirmation!=='DESINSTALAR APLICACIONES'} onClick={()=>action(async()=>{const result=await api('debloat/remove',{planId:debloat.plan.id,names:packages,confirmation});setReceipt(result);setRecoverId(result.id);setDebloat(null);setPackages([]);setConfirmation('');})}>Desinstalar {packages.length} aplicaciones elegidas</button></div>}
      <div className="instrument-card space-y-3"><h2 className="text-sm font-semibold">Intentar volver a registrar una app</h2><p className="text-[11px] text-neutral-400 leading-6">Introduce el ID del recibo exportado. Solo funciona si los archivos de instalación siguen disponibles; de lo contrario reinstala desde Store. No recupera datos personales eliminados.</p><input aria-label="ID recibo debloat" className="evo-input" value={recoverId} onChange={e=>setRecoverId(e.target.value)} placeholder="ID del recibo" /><button className="secondary-button" disabled={blocked || !recoverId.trim()} onClick={()=>{if(confirm('Intentar registrar las aplicaciones del recibo. No garantiza reinstalación ni recuperación de datos. ¿Continuar?'))void action(async()=>setReceipt(await api(`debloat/restore/${encodeURIComponent(recoverId.trim())}`,{})));}}>Intentar recuperación del recibo</button></div>
    </>}
    {receipt && <ReceiptCard receipt={receipt} />}
    <p className="text-[10px] text-neutral-500 leading-6">Cada módulo conserva el primer estado original. Las plantillas se detienen al fallar un paso y conservan recibos antes de modificar. No se fuerza Defender, Windows Update, BCD, VBS, prioridad Realtime ni afinidades supuestamente inteligentes. Para beneficio verificable, mide la misma escena antes/después.</p>
  </section>;
}
