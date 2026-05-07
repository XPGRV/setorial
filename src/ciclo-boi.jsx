import React from 'react'

// Ciclo do Boi — série temporal contínua: %Fêmeas no abate + MM12

const CicloDoBoi = ({ data, accent, events = [], showEvents = true }) => {
  const W = 1000, H = 340;
  const padL = 52, padR = 24, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const points = React.useMemo(() => {
    return (data.beef || [])
      .filter(r => r.pct_femeas != null)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      .map(r => ({ year: r.year, month: r.month, t: r.year + (r.month - 1) / 12, v: r.pct_femeas }));
  }, [data]);

  const mm12 = React.useMemo(() => {
    return points.map((p, i) => {
      if (i < 11) return null;
      const avg = points.slice(i - 11, i + 1).reduce((s, x) => s + x.v, 0) / 12;
      return { ...p, mm: avg };
    }).filter(Boolean);
  }, [points]);

  const [hover, setHover] = React.useState(null);

  if (!points.length) return null;

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const vAll = points.map(p => p.v);
  const vMin = Math.floor(Math.min(...vAll) / 5) * 5 - 2;
  const vMax = Math.ceil(Math.max(...vAll) / 5) * 5 + 2;

  const xs = (t) => padL + ((t - tMin) / (tMax - tMin)) * chartW;
  const ys = (v) => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;

  const rawPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
  const mmPath  = mm12.map((p, i)   => `${i === 0 ? 'M' : 'L'}${xs(p.t).toFixed(1)},${ys(p.mm).toFixed(1)}`).join(' ');

  const yTicks = [];
  for (let v = Math.ceil(vMin / 5) * 5; v <= vMax; v += 5) yTicks.push(v);

  const xTicks = [];
  for (let yr = Math.ceil(tMin); yr <= Math.floor(tMax); yr++) {
    if (yr % 2 === 0) xTicks.push(yr);
  }

  const [mouseY, setMouseY] = React.useState(0);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const t = tMin + ((px - padL) / chartW) * (tMax - tMin);
    let best = null, bestDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.t - t);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    setHover(best);
    setMouseY(py);
  };

  const latestMM = mm12[mm12.length - 1];
  const latest   = points[points.length - 1];

  function accentHue(c) {
    const m = /oklch\([^)]+\)/.exec(c);
    if (!m) return 160;
    const parts = m[0].match(/[\d.]+/g);
    return parts ? parseFloat(parts[2]) : 160;
  }
  const rawColor = `oklch(0.60 0.07 ${accentHue(accent) + 200})`;
  const EVENT_COLOR = 'oklch(0.85 0.18 80)';
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = window.useFadeOut(showEvents, 400);
  const nearEvent = hover && showEvents
    ? events.find(ev => { const evT = ev.year + (ev.month - 1) / 12; return Math.abs(hover.t - evT) < 0.09; })
    : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>

        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={ys(t)} y2={ys(t)} className="grid-line"/>
            <text x={padL - 6} y={ys(t)} className="tick-label" textAnchor="end" dominantBaseline="middle">{t}%</text>
          </g>
        ))}

        {xTicks.map(yr => (
          <g key={yr}>
            <line x1={xs(yr)} x2={xs(yr)} y1={padT} y2={H - padB} className="grid-line" opacity="0.3"/>
            <text x={xs(yr)} y={H - padB + 14} className="tick-label" textAnchor="middle">{yr}</text>
          </g>
        ))}

        {/* Raw mensal — fino, azulado */}
        <path d={rawPath} fill="none" stroke={rawColor} strokeWidth="1" strokeOpacity="0.5" strokeLinejoin="round"/>

        {/* MM12 — grosso, accent */}
        <path d={mmPath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>

        {/* Ponto + label do último MM12 */}
        {latestMM && (
          <g>
            <circle cx={xs(latestMM.t)} cy={ys(latestMM.mm)} r={5} fill={accent}/>
            <text x={xs(latestMM.t) - 10} y={ys(latestMM.mm) - 10}
              textAnchor="end" fill={accent}
              style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:500}}>
              MM12 {latestMM.mm.toFixed(1)}%
            </text>
          </g>
        )}

        {/* Hover */}
        {hover && (
          <g>
            <line x1={xs(hover.t)} x2={xs(hover.t)} y1={padT} y2={H - padB}
              stroke="var(--fg)" strokeOpacity="0.15" strokeWidth="1"/>
            <circle cx={xs(hover.t)} cy={ys(hover.v)} r={4}
              fill="var(--bg)" stroke={rawColor} strokeWidth="1.5"/>
            {mm12.find(p => p.year === hover.year && p.month === hover.month) && (() => {
              const mm = mm12.find(p => p.year === hover.year && p.month === hover.month);
              return <circle cx={xs(mm.t)} cy={ys(mm.mm)} r={4} fill="var(--bg)" stroke={accent} strokeWidth="2"/>;
            })()}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis-line"/>
        <line x1={padL} x2={padL} y1={padT} y2={H - padB} className="axis-line"/>

        {/* Event markers — after axis lines so dots sit on top */}
        {showEventsRender && events.map((ev, i) => {
          const evT = ev.year + (ev.month - 1) / 12;
          if (evT < tMin || evT > tMax) return null;
          const cx = xs(evT);
          const isNear = nearEvent === ev;
          const nearRight = cx > W - padR - 90;
          const nearLeft  = cx < padL + 90;
          const anchor = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
          const lx = nearRight ? cx - 8 : nearLeft ? cx + 8 : cx;
          return (
            <g key={i} className={eventsLeaving ? 'rx-events-leaving' : ''}>
              <circle cx={cx} cy={H-padB} r={isNear ? 5 : 3}
                fill={isNear ? 'var(--bg)' : EVENT_COLOR}
                stroke={EVENT_COLOR} strokeWidth={1.5} strokeOpacity={isNear ? 1 : 0.7}/>
              <line className="rx-event-beam" x1={cx} x2={cx} y1={padT} y2={H-padB}
                stroke={EVENT_COLOR} strokeOpacity={isNear ? 0.5 : 0.15}
                strokeWidth={1} strokeDasharray="3 3"/>
              {isNear && (
                <text x={lx} y={H-padB+28} textAnchor={anchor}
                  style={{fontSize:9.5, fill:EVENT_COLOR, fontWeight:600, fontFamily:'var(--font-mono)'}}>
                  {ev.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && (() => {
        const xPos = xs(hover.t);
        const isRightSide = xPos > chartW * 0.75;
        const style = {
          left: `${(xPos / W * 100).toFixed(1)}%`,
          top: Math.max(10, Math.min(H - 120, mouseY - 40)),
          transform: isRightSide ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
        };
        return (
          <div className="hover-card" style={style}>
            <div className="hover-month">{window.MONTHS_PT[hover.month - 1]}/{hover.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-year" style={{color: rawColor}}>%Fêmeas</span>
                <span className="hover-val">{hover.v.toFixed(0)}<span className="hover-unit"> %</span></span>
              </div>
              {(() => {
                const mm = mm12.find(p => p.year === hover.year && p.month === hover.month);
                if (!mm) return null;
                return (
                  <div className="hover-row">
                    <span className="hover-year" style={{color: accent}}>MM12</span>
                    <span className="hover-val">{mm.mm.toFixed(1)}<span className="hover-unit"> %</span></span>
                  </div>
                );
              })()}
            </div>
            {nearEvent && (
              <div className="hover-events">
                <div className="hover-event">
                  <span className="hover-event-year">{nearEvent.year}</span>
                  {nearEvent.label}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="ciclo-legend">
        <span className="legend-year" style={{userSelect:'none', padding:'2px 6px'}}>
          <span className="legend-line" style={{background: rawColor, opacity: 0.7}}/>
          %Abate Fêmeas (mensal)
        </span>
        <span className="legend-year" style={{userSelect:'none', padding:'2px 6px'}}>
          <span className="legend-line" style={{background: accent}}/>
          MM12
        </span>
      </div>
    </div>
  );
};

Object.assign(window, { CicloDoBoi });
