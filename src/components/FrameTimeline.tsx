export type TimelinePoint = { second: number; frames: number; averageFps: number };
export function FrameTimeline({ before, after }: { before?: TimelinePoint[]; after?: TimelinePoint[] }) {
  const points = [...(before || []), ...(after || [])];
  if (!points.length) return <div className="chart-empty"><span className="text-3xl text-neutral-600">⌁</span><span>Tu próxima captura empieza aquí</span><span className="text-[10px] text-neutral-500">La curva aparecerá al finalizar. No se generan datos simulados.</span></div>;
  const maxX = Math.max(1, ...points.map(p => p.second));
  const maxY = Math.max(30, Math.ceil(Math.max(...points.map(p => p.averageFps)) / 30) * 30);
  function line(values: TimelinePoint[]) { return values.map(p => `${38 + p.second / maxX * 608},${166 - p.averageFps / maxY * 148}`).join(' '); }
  return <><svg viewBox="0 0 660 200" role="img" aria-label="FPS medios por grupo de intervalos, agrupados por segundo de inicio; referencia en lima y resultado en azul" className="w-full">
    {[0, .5, 1].map(f => <g key={f}><line x1="38" x2="646" y1={166-f*148} y2={166-f*148} stroke="#29313b" strokeDasharray="3 5" /><text x="0" y={170-f*148} fill="#8b98a8" fontSize="9">{Math.round(maxY*f)}</text></g>)}
    {[before,after].map((values,i) => values?.length ? <g key={i}><polyline fill="none" stroke={i ? '#79b9fa' : '#ccf76a'} strokeWidth="2" strokeLinejoin="round" points={line(values)} />{values.map(p => <circle key={p.second} cx={38+p.second/maxX*608} cy={166-p.averageFps/maxY*148} r="2.5" fill={i ? '#79b9fa' : '#ccf76a'}><title>{p.second}s · {p.averageFps.toFixed(2)} FPS · {p.frames} intervalos</title></circle>)}</g> : null)}
    <text x="38" y="192" fill="#8b98a8" fontSize="9">0 s</text><text x="625" y="192" fill="#8b98a8" fontSize="9">{maxX} s</text>
  </svg><p className="text-[9px] text-neutral-500">Tiempo útil tras calentamiento. Grupos de intervalos completos; no es un contador instantáneo ni una medida de input lag.</p></>;
}
