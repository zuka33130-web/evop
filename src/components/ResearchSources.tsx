import { useState } from 'react';
import { DEFAULT_NATIVE_ENGINE_URL } from '../services/nativeBridge';

const evidence = [
  { title: 'PresentMon: intervalos medidos y límites de instrumentación',
    detail: 'La documentación describe restricciones de OpenGL/Vulkan y de métricas GPU con HAGS. Conserva la misma fuente en A y B; el frametime no equivale a input lag.',
    url: 'https://github.com/GameTechDev/PresentMon', setting: '', action: '' },
  { title: 'Optimización de juegos en ventana',
    detail: 'Microsoft documenta el cambio de blt a flip para juegos DX10/DX11 compatibles en ventana o sin bordes. No es una mejora universal. Comprueba compatibilidad, reinicia el juego y mide.',
    url: 'https://devblogs.microsoft.com/directx/updates-in-graphics-and-gaming/', setting: 'graphics', action: 'Abrir gráficos de Windows' },
  { title: 'HAGS: compatibilidad y pruebas, no una promesa de FPS',
    detail: 'Microsoft describe requisitos de hardware/controlador y validación A/B de fiabilidad. No lo combines con otros cambios para atribuir una diferencia. Los experimentos de la app no atraviesan reinicios.',
    url: 'https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/', setting: 'graphics', action: 'Revisar HAGS manualmente' },
  { title: 'WPR/WPA: investigar cuellos de botella del sistema',
    detail: 'Herramientas oficiales para trazas ETW y análisis de CPU, disco y memoria. Son un paso diagnóstico, no un tweak. La app no inicia sesiones WPR que puedan interferir con capturas existentes.',
    url: 'https://learn.microsoft.com/en-us/windows-hardware/test/wpt/introduction-to-wpr', setting: '', action: '' },
  { title: 'Timers BCD: no aplicar ajustes de depuración como optimización universal',
    detail: 'Microsoft documenta useplatformclock y useplatformtick como opciones de depuración. Los módulos heredados de timers permanecen bloqueados; no se cambia el arranque para perseguir FPS sin evidencia.',
    url: 'https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/bcdedit--set', setting: '', action: '' }
];
export function ResearchSources() {
  const [message, setMessage] = useState('');
  async function openSetting(id: string) {
    try {
      const response = await fetch(`${DEFAULT_NATIVE_ENGINE_URL}/api/system/settings/${id}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo abrir Configuración');
      setMessage('Configuración abierta en Windows. No se cambió ningún valor automáticamente; cambia una opción y mide.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Inicia el motor nativo en Windows.'); }
  }
  return <section className="space-y-4 rounded-2xl border border-cyan-900 p-5">
    <h2 className="text-xl font-bold">Fuentes técnicas y decisiones de ingeniería</h2>
    <p className="text-sm text-neutral-400">Revisión: 08/11/2026. Selección de fuentes primarias, no un rastreo exhaustivo. Documentación de una función ≠ prueba de ganancia en tu PC. No se copian tweaks de foros ni se desactiva seguridad para inflar un benchmark.</p>
    <div className="grid gap-4 md:grid-cols-2">{evidence.map(item => <article className="rounded-lg bg-neutral-900 p-4 space-y-2" key={item.url}>
      <h3 className="font-bold">{item.title}</h3><p className="text-sm text-neutral-400">{item.detail}</p>
      <a className="text-xs text-cyan-300 underline block" href={item.url} target="_blank" rel="noreferrer">Documentación primaria ↗</a>
      {item.setting && <button className="text-sm border border-neutral-700 rounded px-3 py-2" onClick={() => openSetting(item.setting)}>{item.action}</button>}
    </article>)}</div>
    <p className="text-sm text-neutral-400">Revisa también inicio automático, grabación en segundo plano, almacenamiento y refresco de pantalla. Son puntos de diagnóstico: conserva lo necesario y confirma cada cambio con mediciones, sin desinstalar componentes indiscriminadamente.</p>
    <div className="flex flex-wrap gap-3">{[['startup', 'Apps de inicio'], ['captures', 'Grabación de juegos'], ['display', 'Pantalla avanzada'], ['storage', 'Almacenamiento'], ['gamemode', 'Modo Juego']].map(([id, label]) =>
      <button className="border border-neutral-700 rounded px-3 py-2 text-sm" key={id} onClick={() => openSetting(id)}>{label}</button>)}</div>
    {message && <p role="status" className="text-amber-300 text-sm">{message}</p>}
  </section>;
}
