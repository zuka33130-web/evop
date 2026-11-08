import { useState } from 'react';
import { LayoutDashboard, Zap, Trash2, Crosshair, History, BookOpen, Menu, X, ScanLine, Cpu, ArrowUpRight } from 'lucide-react';
const groups = [
  { name: 'WORKSPACE', items: [
    { id: 'dashboard', label: 'Panel de control', icon: LayoutDashboard },
    { id: 'stability', label: 'Estabilidad y 1% Low', icon: Crosshair },
    { id: 'native-operations', label: 'Operaciones Windows', icon: Zap },
  ] },
  { name: 'TU EQUIPO', items: [
    { id: 'advisor', label: 'Auditor local', icon: ScanLine },
    { id: 'cleaner', label: 'Limpieza inteligente', icon: Trash2 },
    { id: 'diagnostics', label: 'Diagnóstico', icon: Cpu },
  ] },
  { name: 'REGISTRO Y AYUDA', items: [
    { id: 'history', label: 'Historial', icon: History },
    { id: 'knowledge', label: 'Fuentes y herramientas', icon: BookOpen },
  ] },
];
export function Sidebar({ activeTab, setActiveTab, isNativeConnected = false }: {
  activeTab: string; setActiveTab: (tab: string) => void; isNativeConnected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  function navigate(id: string) { setActiveTab(id); setOpen(false); }
  return <>
    <div className="mobile-brand"><span className="brand-word">evo<span> /</span></span><button aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
    {open && <button className="nav-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
    <aside className={`evo-sidebar ${open ? 'is-open' : ''}`}>
      <button onClick={() => navigate('dashboard')} className="brand-lockup" aria-label="EVO · inicio"><span className="brand-word">evo<span> /</span></span><span className="brand-tag">PERFORMANCE LAB</span></button>
      <div className="workspace-label"><span className="workspace-icon"><Cpu size={16} /></span><div>Equipo local<small>Windows workspace</small></div><span className={`status-dot ${isNativeConnected ? 'online' : ''}`} /></div>
      <nav aria-label="Navegación principal">{groups.map(group => <div className="nav-group" key={group.name}><p>{group.name}</p>{group.items.map(({ id, label, icon: Icon }) => <button key={id} aria-current={activeTab === id ? 'page' : undefined} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.6} /><span>{label}</span>{activeTab === id && <span className="active-mark" />}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">DATOS, NO PROMESAS</span><p>Una buena optimización<br />empieza por medir.</p><button onClick={() => navigate('stability')}>Abrir laboratorio <ArrowUpRight size={15} /></button></div><div className="engine-caption"><span className={`status-dot ${isNativeConnected ? 'online' : ''}`} />{isNativeConnected ? 'Motor nativo conectado' : 'Motor no conectado'}<span>LOCAL</span></div></div>
    </aside>
  </>;
}
