import React from 'react'
import { EVENTS_US, EventDot, MONTHS_PT, useFadeOut, useTrackedYears } from './data-utils.jsx'
import { AnnualProductionCard, ProductionCard } from './production-chart.jsx'

// Beef US Tab — Edgebeef sazonal diário + Ciclo do Boi US

const MONTH_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

// ── Daily stats helper ────────────────────────────────────────────────────────
function buildDailyStats(byYear, histYears) {
  const byDoy = {};
  for (const yr of histYears) {
    for (const pt of (byYear[yr] || [])) {
      if (!byDoy[pt.doy]) byDoy[pt.doy] = [];
      byDoy[pt.doy].push(pt.value);
    }
  }
  const stats = {};
  for (const [doy, vals] of Object.entries(byDoy)) {
    if (vals.length < 2) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    stats[Number(doy)] = {
      min: sorted[0], max: sorted[sorted.length - 1],
      mean: vals.reduce((a, b) => a + b, 0) / vals.length,
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      n: sorted.length,
    };
  }
  return stats;
}

// ── Edgebeef Seasonal Chart (pure rendering) ──────────────────────────────────
const EdgebeeefChart = ({
  byYear, allYears, selectedYears, pinnedYear, setPinnedYear,
  chartStyle, showStats, showEvents, events, accent, chartId = 'edgebeef',
  unit = 'USD/cwt', decimals = 1,
}) => {
  const W = 1000, H = 260;
  const padL = 64, padR = 24, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const latestYear = Math.max(...selectedYears);
  const sortedAsc  = [...selectedYears].sort((a, b) => a - b);
  const { displayYears, isLeaving } = useTrackedYears(selectedYears);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = useFadeOut(chartStyle === 'area', 400);
  const { shouldRender: showStatsRender, isLeaving: statsLeaving } = useFadeOut(showStats, 500);

  const [hover, setHover] = React.useState(null);
  React.useEffect(() => { setHover(null); }, [selectedYears.join(',')]);

  // Y range
  const { vMin, vMax, step } = React.useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const yr of selectedYears) {
      for (const p of (byYear[yr] || [])) {
        if (p.value < lo) lo = p.value;
        if (p.value > hi) hi = p.value;
      }
    }
    if (!isFinite(lo)) { lo = -100; hi = 100; }
    const range = hi - lo;
    const step = range > 800 ? 200 : range > 400 ? 100 : range > 150 ? 50 : range > 60 ? 25 : range > 30 ? 10 : range > 15 ? 5 : range > 6 ? 2 : range > 3 ? 1 : 0.5;
    return {
      vMin: Math.floor((lo - range * 0.05) / step) * step,
      vMax: Math.ceil((hi  + range * 0.15) / step) * step,
      step,
    };
  }, [byYear, selectedYears.join(',')]);

  // Stats
  const stats = React.useMemo(() => {
    if (!showStatsRender) return {};
    const latest = Math.max(...allYears);
    const fromYr = Math.max(allYears[0], latest - 10);
    const histYears = allYears.filter(y => y >= fromYr && y < latest);
    return buildDailyStats(byYear, histYears);
  }, [byYear, allYears, showStatsRender]);

  const x = doy => padL + ((doy - 1) / 364) * chartW;
  const y = v   => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;

  // (ii) Cada ano mantém sua cor de paleta ao ser pinado; só o latestYear recebe
  // o accent quando nenhum ano está pinado — igual ao SeasonalChart do BeefBR.
  const yearColor = yr => {
    const palette = ['oklch(0.75 0.15 200)','oklch(0.68 0.16 255)','oklch(0.74 0.15 310)','oklch(0.78 0.17 35)','oklch(0.80 0.15 60)','oklch(0.72 0.16 0)','oklch(0.76 0.13 170)'];
    const age = latestYear - yr;
    if (age === 0) return accent;                        // ano mais recente = accent
    return age - 1 < palette.length ? palette[age - 1] : 'oklch(0.48 0.01 260)';
  };

  const seriesOpacity = yr => {
    if (!pinnedYear) return yr === latestYear ? 1 : 0.7;
    return yr === pinnedYear ? 1 : 0.1;
  };
  const seriesWidth = yr => {
    if (pinnedYear) return yr === pinnedYear ? 2.5 : 1;
    return yr === latestYear ? 2 : 1.25;
  };

  const buildPath = pts =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.doy).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const buildArea = (pts) => {
    if (!pts.length) return '';
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.doy).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    return top + ` L${x(pts[pts.length-1].doy).toFixed(1)},${y(0).toFixed(1)} L${x(pts[0].doy).toFixed(1)},${y(0).toFixed(1)} Z`;
  };

  const yTicks = [];
  for (let v = vMin; v <= vMax; v += step) yTicks.push(v);

  // Stats band paths
  const statsDoys = Object.keys(stats).map(Number).sort((a,b)=>a-b);
  const statsMaxPath  = statsDoys.map((d,i) => `${i===0?'M':'L'}${x(d).toFixed(1)},${y(stats[d].max).toFixed(1)}`).join(' ');
  const statsMinPath  = [...statsDoys].reverse().map(d => `L${x(d).toFixed(1)},${y(stats[d].min).toFixed(1)}`).join(' ');
  const statsP75Path  = statsDoys.map((d,i) => `${i===0?'M':'L'}${x(d).toFixed(1)},${y(stats[d].p75).toFixed(1)}`).join(' ');
  const statsP25Path  = [...statsDoys].reverse().map(d => `L${x(d).toFixed(1)},${y(stats[d].p25).toFixed(1)}`).join(' ');
  const statsMeanPath = statsDoys.map((d,i) => `${i===0?'M':'L'}${x(d).toFixed(1)},${y(stats[d].mean).toFixed(1)}`).join(' ');

  // Events: position at mid-month doy
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = useFadeOut(showEvents, 400);
  const eventsInView = React.useMemo(() => {
    if (!showEventsRender) return [];
    return (events || []).filter(e => selectedYears.includes(e.year) && (!pinnedYear || e.year === pinnedYear));
  }, [showEventsRender, selectedYears, pinnedYear, events]);

  const EVENT_COLOR = 'oklch(0.85 0.18 80)';

  const getHoverPoint = (yr, doy) => {
    const pts = byYear[yr] || [];
    let best = null, bestD = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.doy - doy);
      if (d < bestD) { bestD = d; best = p; }
    }
    return bestD <= 4 ? best : null;
  };

  const doyToLabel = doy => {
    let mo = 0;
    for (let m = 11; m >= 0; m--) { if (doy > MONTH_DOY[m]) { mo = m; break; } }
    return `${doy - MONTH_DOY[mo]} ${MONTHS_PT[mo]}`;
  };

  const [mouseY, setMouseY] = React.useState(0);

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const doy = Math.round(1 + ((px - padL) / chartW) * 364);
    setHover(Math.max(1, Math.min(365, doy)));
    setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };

  const gradId = `edge-grad-${chartId}`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {sortedAsc.map(yr => {
            const pts = byYear[yr] || [];
            const zeroY = y(0);
            const extremeY = pts.length ? pts.reduce((best, p) => {
              const py = y(p.value);
              return Math.abs(py - zeroY) > Math.abs(best - zeroY) ? py : best;
            }, y(pts[0].value)) : zeroY - 50;
            return (
              <linearGradient key={yr} id={`${gradId}-${yr}`} x1="0" x2="0"
                y1={extremeY.toFixed(1)} y2={zeroY.toFixed(1)} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={yearColor(yr)} stopOpacity="0.28"/>
                <stop offset="100%" stopColor={yearColor(yr)} stopOpacity="0"/>
              </linearGradient>
            );
          })}
          <clipPath id={`clip-${gradId}`}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
        </defs>

        {/* Y grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} className="grid-line"/>
            <text x={padL-6} y={y(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">{v}</text>
          </g>
        ))}
        {vMin < 0 && vMax > 0 && (
          <line x1={padL} x2={W-padR} y1={y(0)} y2={y(0)} stroke="var(--fg)" strokeWidth={1.5} strokeOpacity={0.6}/>
        )}

        {/* X ticks — months */}
        {MONTH_DOY.map((doy, mi) => (
          <g key={mi}>
            <line x1={x(doy+1)} x2={x(doy+1)} y1={padT} y2={H-padB} className="grid-line" opacity="0.3"/>
            <text x={x(doy+16)} y={H-padB+16} className="tick-label" textAnchor="middle">{MONTHS_PT[mi]}</text>
          </g>
        ))}

        {/* Stats band */}
        {showStatsRender && statsDoys.length > 0 && (
          <g clipPath={`url(#clip-${gradId})`}>
            <path d={statsMaxPath + ' ' + statsMinPath + ' Z'} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.05}}/>
            <path d={statsP75Path + ' ' + statsP25Path + ' Z'} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.08}}/>
            <path d={statsMeanPath} stroke="var(--fg)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" fill="none" className={`rx-stat-mean${statsLeaving ? ' rx-stat-leaving' : ''}`}/>
          </g>
        )}

        <g clipPath={`url(#clip-${gradId})`}>
        {/* Area fills */}
        {showAreaRender && displayYears.map(yr => {
          const pts = byYear[yr] || [];
          if (!pts.length) return null;
          const leaving = isLeaving(yr);
          return <path key={yr} d={buildArea(pts)} fill={`url(#${gradId}-${yr})`}
            style={{'--rx-area-op': seriesOpacity(yr)}}
            className={`rx-area ${leaving ? 'rx-leaving' : ''} ${areaLeaving ? 'rx-area-leaving' : ''}`}/>;
        })}

        {/* Year lines */}
        {displayYears.map(yr => {
          const pts = byYear[yr] || [];
          if (!pts.length) return null;
          const stroke = yearColor(yr);
          const leaving = isLeaving(yr);
          return (
            <g key={yr}>
              <path
                d={buildPath(pts)} fill="none" stroke={stroke}
                strokeWidth={seriesWidth(yr)} strokeLinejoin="round" strokeLinecap="round"
                opacity={seriesOpacity(yr)}
                className={leaving ? 'rx-leaving' : ''}/>
              {!leaving && (
                <path d={buildPath(pts)} fill="none" stroke="transparent" strokeWidth={12}
                  style={{cursor:'pointer'}}
                  onClick={() => setPinnedYear(p => p === yr ? null : yr)}/>
              )}
            </g>
          );
        })}
        </g>

        {/* Event dots */}
        {eventsInView.map((ev, i) => {
          const doy = MONTH_DOY[ev.month - 1] + 15;
          const yr  = ev.year;
          const pts = byYear[yr] || [];
          let best = null, bestD = Infinity;
          for (const p of pts) { const d = Math.abs(p.doy - doy); if (d < bestD) { bestD = d; best = p; } }
          if (!best) return null;
          const cx = x(best.doy), cy = y(best.value);
          const isPinned = yr === pinnedYear;
          const nearRight = cx > W - padR - 80;
          const nearLeft  = cx < padL + 80;
          const anchor = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
          const lx = nearRight ? cx - 8 : nearLeft ? cx + 8 : cx;
          const labelY = padT + 2;
          // delay synced with line draw (1.2s over 365 days)
          const dotDelay = `${((best.doy - 1) / 364 * 1.1).toFixed(2)}s`;
          return (
            <g key={`ev-${ev.year}-${ev.month}`} className={eventsLeaving ? 'rx-events-leaving' : ''}>
              <EventDot cx={cx} cy={cy} r={isPinned ? 5 : 3}
                fill={isPinned ? 'var(--bg)' : EVENT_COLOR} stroke={EVENT_COLOR} strokeWidth={1.5}
                delaySec={parseFloat(dotDelay)}/>
              {isPinned && <line className="rx-event-beam" x1={cx} y1={labelY+12} x2={cx} y2={cy-6} stroke={EVENT_COLOR} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.6}/>}
              {isPinned && (
                <text x={lx} y={labelY} textAnchor={anchor} dominantBaseline="hanging"
                  style={{fontFamily:'var(--font-mono)', fontSize:10, fill:EVENT_COLOR, fontWeight:600}}>
                  {ev.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Hover */}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H-padB}
              stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            {sortedAsc.map(yr => {
              const pt = getHoverPoint(yr, hover);
              if (!pt) return null;
              const isPinned = yr === pinnedYear, isCurrent = yr === latestYear;
              return (
                <circle key={yr} cx={x(pt.doy)} cy={y(pt.value)}
                  r={isPinned ? 5 : isCurrent ? 4 : 3}
                  fill="var(--bg)" stroke={yearColor(yr)}
                  strokeWidth={isPinned ? 2.5 : isCurrent ? 2 : 1.25}
                  className="rx-no-anim"
                  style={{cursor:'pointer'}}
                  onClick={() => setPinnedYear(p => p === yr ? null : yr)}/>
              );
            })}
          </g>
        )}

        <line x1={padL} x2={W-padR} y1={H-padB} y2={H-padB} className="axis-line"/>
        <line x1={padL} x2={padL} y1={padT} y2={H-padB} className="axis-line"/>
      </svg>

      {/* Hover card */}
      {hover != null && (() => {
        const rows = [...sortedAsc].reverse()
          .map(yr => ({ yr, pt: getHoverPoint(yr, hover) }))
          .filter(r => r.pt);
        if (!rows.length) return null;
        const statEntry = stats[hover] || stats[hover-1] || stats[hover+1];
        let hoverMo = 0;
        for (let i = 11; i >= 0; i--) { if (hover > MONTH_DOY[i]) { hoverMo = i; break; } }
        const nearEvents = showEvents
          ? (events||[]).filter(ev => ev.month - 1 === hoverMo && selectedYears.includes(ev.year))
          : [];
        const xPos = x(hover);
        const isRightSide = xPos > chartW * 0.75;
        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 120, mouseY - 40)),
            transform: isRightSide ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">{doyToLabel(hover)}</div>
            <div className="hover-rows">
              {rows.map(({yr, pt}) => (
                <div key={yr} className="hover-row">
                  <span className="hover-year" style={{color: yearColor(yr)}}>{yr}</span>
                  <span className="hover-val">{pt.value.toFixed(decimals)}<span className="hover-unit"> {unit}</span></span>
                </div>
              ))}
              {showStats && statEntry && (
                <div className="hover-row hover-stat">
                  <span className="hover-year">média {statEntry.n}a</span>
                  <span className="hover-val">{statEntry.mean.toFixed(decimals)}</span>
                </div>
              )}
            </div>
            {nearEvents.length > 0 && (
              <div className="hover-events">
                {nearEvents.map((ev, i) => (
                  <div key={i} className="hover-event">
                    <span className="hover-event-year">{ev.year}</span>
                    {ev.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      <div className="ciclo-legend">
        {[...selectedYears].sort((a,b)=>b-a).map(yr => (
          <span key={yr} className="legend-year"
            onClick={() => setPinnedYear(p => p === yr ? null : yr)}
            style={{
              cursor:'pointer', userSelect:'none', padding:'2px 6px',
              opacity: pinnedYear && pinnedYear !== yr ? 0.3 : yr === latestYear ? 1 : 0.7,
              outline: pinnedYear === yr ? `1px solid ${yearColor(yr)}` : 'none',
              borderRadius: 4,
            }}>
            <span className="legend-line" style={{background: yearColor(yr)}}/>
            {yr}
          </span>
        ))}
        {showStats && (
          <>
            <span className="legend-year" style={{opacity:0.6, userSelect:'none', padding:'2px 6px'}}>
              <span style={{display:'inline-block',width:16,height:2,borderTop:'2px dashed var(--fg)',opacity:0.5,verticalAlign:'middle',marginRight:2}}/>
              Média histórica
            </span>
            <span className="legend-year" style={{opacity:0.6, userSelect:'none', padding:'2px 6px'}}>
              <span style={{display:'inline-block',width:16,height:8,background:'var(--fg)',opacity:0.08,verticalAlign:'middle',marginRight:2,borderRadius:1}}/>
              P25–P75
            </span>
            <span className="legend-year" style={{opacity:0.6, userSelect:'none', padding:'2px 6px'}}>
              <span style={{display:'inline-block',width:16,height:8,background:'var(--fg)',opacity:0.05,verticalAlign:'middle',marginRight:2,borderRadius:1}}/>
              Mín–Máx
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// ── Edgebeef Controls — componente separado, igual ao ChartControls do BeefBR ──
function EdgebeeefControls({
  years, selectedYears, setSelectedYears,
  showStats, setShowStats,
  showEvents, setShowEvents,
  chartStyle, setChartStyle,
}) {
  const { useState, useEffect, useRef } = React;
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  const presets = [
    { label: '3a',    yrs: years.slice(-3) },
    { label: '5a',    yrs: years.slice(-5) },
    { label: '10a',   yrs: years.slice(-10) },
    { label: 'Todos', yrs: years },
  ];

  const activePreset = presets.find(p => {
    const valid = p.yrs.filter(y => years.includes(y));
    return valid.length === selectedYears.length && valid.every(y => selectedYears.includes(y));
  });

  const toggleYear = yr => setSelectedYears(prev =>
    prev.includes(yr)
      ? (prev.length === 1 ? prev : prev.filter(y => y !== yr))
      : [...prev, yr].sort((a, b) => a - b)
  );

  useEffect(() => {
    if (!dropOpen) return;
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  return (
    <div className="card-controls">
      {/* Row 1: presets de ano + dropdown */}
      <div className="card-ctrl-row">
        <div className="year-seg">
          {presets.map(p => (
            <button key={p.label}
              className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`}
              onClick={() => setSelectedYears(p.yrs.filter(y => years.includes(y)))}>
              {p.label}
            </button>
          ))}
          <div className="year-drop-wrap" ref={dropRef}>
            <button
              className={`year-seg-btn ${dropOpen ? 'is-active' : ''} ${!activePreset && !dropOpen ? 'is-on' : ''}`}
              onClick={() => setDropOpen(o => !o)}>
              Anos ▾
            </button>
            {dropOpen && (
              <div className="year-drop">
                {years.slice().reverse().map(yr => (
                  <div key={yr}
                    className={`year-drop-item ${selectedYears.includes(yr) ? 'is-on' : ''}`}
                    onClick={() => toggleYear(yr)}>
                    <span className="year-drop-check">{selectedYears.includes(yr) ? '✓' : ''}</span>
                    {yr}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Row 2: toggles + estilo */}
      <div className="card-ctrl-row">
        <div className="ctrl-btn-group">
          <button className={`ctrl-btn ${showStats ? 'is-on' : ''}`} onClick={() => setShowStats(s => !s)}>MÉDIA + FAIXA</button>
          {/* Sem setShowEvents (ex: descontos do Agro, que não têm eventos), o botão some */}
          {setShowEvents && (
            <button className={`ctrl-btn ${showEvents ? 'is-on' : ''}`} onClick={() => setShowEvents(s => !s)}>EVENTOS</button>
          )}
        </div>
        <div style={{marginLeft: 16}}>
          <div className="seg">
            <button className={`seg-btn ${chartStyle==='line'?'is-on':''}`} onClick={() => setChartStyle('line')}>Linha</button>
            <button className={`seg-btn ${chartStyle==='area'?'is-on':''}`} onClick={() => setChartStyle('area')}>Área</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edgebeef Card (state + controls + chart) ──────────────────────────────────
const EdgebeeefCard = ({ data, accent, events }) => {
  const byYear = React.useMemo(() => {
    const out = {};
    for (const r of (data.edgebeef_daily || [])) {
      if (!out[r.year]) out[r.year] = [];
      out[r.year].push({ doy: MONTH_DOY[r.month - 1] + r.day, value: r.value });
    }
    for (const yr of Object.keys(out)) out[yr].sort((a, b) => a.doy - b.doy);
    return out;
  }, [data]);

  const allYears = React.useMemo(() => Object.keys(byYear).map(Number).sort((a,b)=>a-b), [byYear]);

  // Latest data point and YoY
  const latestRaw = React.useMemo(() => {
    const rows = (data.edgebeef_daily || []).slice().sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day
    );
    return rows[rows.length - 1] || null;
  }, [data]);

  const yoyRaw = React.useMemo(() => {
    if (!latestRaw) return null;
    const candidates = (data.edgebeef_daily || []).filter(r =>
      r.year === latestRaw.year - 1 && r.month === latestRaw.month
    );
    let best = null, bestD = Infinity;
    for (const r of candidates) {
      const d = Math.abs(r.day - latestRaw.day);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }, [data, latestRaw]);

  const yoy = latestRaw && yoyRaw
    ? (latestRaw.value - yoyRaw.value) / Math.abs(yoyRaw.value)
    : null;
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

  const [selectedYears, setSelectedYears] = React.useState(() => allYears.slice(-5));
  const [chartStyle, setChartStyle]       = React.useState('line');
  const [showStats, setShowStats]         = React.useState(false);
  const [showEvents, setShowEvents]       = React.useState(true);
  const [pinnedYear, setPinnedYear]       = React.useState(null);

  // Auto-popula quando dados chegam após o mount (upload pós-carregamento inicial vazio)
  React.useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0) {
      setSelectedYears(allYears.slice(-5));
    }
  }, [allYears.join(',')]);

  React.useEffect(() => { setPinnedYear(null); }, [selectedYears.join(',')]);

  return (
    <section className="card card-full" data-card-id="us-edgebeef">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Bloomberg · EDGEBEEF Index · Margem dos Frigoríficos</div>
          <h3 className="card-title">EdgeBeef</h3>
          <div className="card-price">
            {latestRaw && (<>
              <span className="card-value">{latestRaw.value.toFixed(1)}</span>
              <span className="card-unit">USD/cwt</span>
              <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
              </span>
              <span className="card-date">
                {MONTHS_PT[latestRaw.month - 1]}/{String(latestRaw.year).slice(-2)}
              </span>
            </>)}
          </div>
        </div>
        <EdgebeeefControls
          years={allYears}
          selectedYears={selectedYears} setSelectedYears={setSelectedYears}
          showStats={showStats} setShowStats={setShowStats}
          showEvents={showEvents} setShowEvents={setShowEvents}
          chartStyle={chartStyle} setChartStyle={setChartStyle}
        />
      </div>
      <EdgebeeefChart
        byYear={byYear} allYears={allYears}
        selectedYears={selectedYears}
        pinnedYear={pinnedYear} setPinnedYear={setPinnedYear}
        chartStyle={chartStyle}
        showStats={showStats} showEvents={showEvents}
        events={events || []}
        accent={accent}
        chartId="us-edgebeef"
      />
    </section>
  );
};

// ── Ciclo do Boi US ───────────────────────────────────────────────────────────
const CicloBoiUS = ({ data, accent, events = [], showEvents = true }) => {
  const W = 1000, H = 260;
  const padL = 56, padR = 64, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Mesma lógica de cores do CicloDoBoi do BeefBR
  function accentHue(c) {
    const m = /oklch\([^)]+\)/.exec(c);
    if (!m) return 160;
    const parts = m[0].match(/[\d.]+/g);
    return parts ? parseFloat(parts[2]) : 160;
  }
  const rawColor = `oklch(0.60 0.07 ${accentHue(accent) + 200})`;

  const femPoints = React.useMemo(() => {
    return (data.beef_us || [])
      .filter(r => r.pct_femeas != null)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      .map(r => ({ year: r.year, month: r.month, t: r.year + (r.month - 1) / 12, v: r.pct_femeas }));
  }, [data]);

  const boiPoints = React.useMemo(() => {
    return (data.beef_us || [])
      .filter(r => r.boi_bezerro_mm12 != null && typeof r.boi_bezerro_mm12 === 'number')
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      .map(r => ({ year: r.year, month: r.month, t: r.year + (r.month - 1) / 12, v: r.boi_bezerro_mm12 }));
  }, [data]);

  const [hover, setHover] = React.useState(null);
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = useFadeOut(showEvents, 400);

  const tMin = femPoints.length ? femPoints[0].t : 2000;
  const tMax = femPoints.length ? femPoints[femPoints.length - 1].t : 2026;

  if (!femPoints.length) {
    return (
      <div style={{ padding: 40, color: 'var(--fg-dim)', textAlign: 'center' }}>
        Aguardando dados do ciclo...
      </div>
    );
  }

  const femVals = femPoints.map(p => p.v);
  const femPad  = (Math.max(...femVals) - Math.min(...femVals)) * 0.15;
  const vLeftMin  = Math.floor((Math.min(...femVals) - femPad) / 2) * 2;
  const vLeftMax  = Math.ceil((Math.max(...femVals)  + femPad) / 2) * 2;

  const boiVals = boiPoints.map(p => p.v);
  const boiPad  = (Math.max(...boiVals) - Math.min(...boiVals)) * 0.15;
  const vRightMin = Math.floor((Math.min(...boiVals) - boiPad) * 20) / 20;
  const vRightMax = Math.ceil((Math.max(...boiVals)  + boiPad) * 20) / 20;

  const xs      = t => padL + ((t - tMin) / ((tMax - tMin) || 1)) * chartW;
  const ysLeft  = v => padT + (1 - (v - vLeftMin)  / ((vLeftMax  - vLeftMin) || 1))  * chartH;
  const ysRight = v => padT + (1 - (v - vRightMin) / ((vRightMax - vRightMin) || 1)) * chartH;

  const femPath = femPoints.map((p, i) => `${i===0?'M':'L'}${xs(p.t).toFixed(1)},${ysLeft(p.v).toFixed(1)}`).join(' ');
  const boiPath = boiPoints.map((p, i) => `${i===0?'M':'L'}${xs(p.t).toFixed(1)},${ysRight(p.v).toFixed(1)}`).join(' ');

  const leftTicks = [], rightTicks = [];
  for (let v = Math.ceil(vLeftMin/2)*2; v <= vLeftMax; v += 2) leftTicks.push(v);
  const rStep = 0.05;
  for (let v = Math.round(vRightMin/rStep)*rStep; v <= vRightMax+0.001; v = Math.round((v+rStep)*1000)/1000) rightTicks.push(v);

  const xTicks = [];
  for (let yr = Math.ceil(tMin); yr <= Math.floor(tMax); yr++) {
    if (yr % 2 === 0) xTicks.push(yr);
  }

  const [mouseY, setMouseY] = React.useState(0);

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const t = tMin + ((px - padL) / chartW) * (tMax - tMin);
    let best = null, bestDist = Infinity;
    for (const p of femPoints) {
      const d = Math.abs(p.t - t);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    setHover(best);
    setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };

  const hoverBoi = hover ? boiPoints.find(p => p.year === hover.year && p.month === hover.month) : null;

  const EVENT_COLOR = 'oklch(0.85 0.18 80)';

  // Evento mais próximo do hover (tolerância ±1 mês)
  const nearEvent = hover && showEvents
    ? events.find(ev => {
        const evT = ev.year + (ev.month - 1) / 12;
        return Math.abs(hover.t - evT) < 0.09;
      })
    : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>

        {leftTicks.map(v => (
          <g key={`l${v}`}>
            <line x1={padL} x2={W-padR} y1={ysLeft(v)} y2={ysLeft(v)} className="grid-line"/>
            <text x={padL-6} y={ysLeft(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">{v}%</text>
          </g>
        ))}
        {rightTicks.map(v => (
          <text key={`r${v}`} x={W-padR+6} y={ysRight(v)} className="tick-label" textAnchor="start" dominantBaseline="middle">{v.toFixed(2)}</text>
        ))}
        {xTicks.map(yr => (
          <g key={yr}>
            <line x1={xs(yr)} x2={xs(yr)} y1={padT} y2={H-padB} className="grid-line" opacity="0.3"/>
            <text x={xs(yr)} y={H-padB+14} className="tick-label" textAnchor="middle">{yr}</text>
          </g>
        ))}

        {/* %Fêmeas — fino, muted (igual rawPath do CicloDoBoi) */}
        <path
          d={femPath} fill="none" stroke={rawColor} strokeWidth="1" strokeOpacity="0.5" strokeLinejoin="round"/>
        {/* Boi/Bezerro MM12M — grosso, accent (igual mmPath do CicloDoBoi) */}
        <path
          d={boiPath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>

        {hover && (
          <g>
            <line x1={xs(hover.t)} x2={xs(hover.t)} y1={padT} y2={H-padB} stroke="var(--fg)" strokeOpacity="0.15" strokeWidth="1"/>
            <circle cx={xs(hover.t)} cy={ysLeft(hover.v)} r={4} fill="var(--bg)" stroke={rawColor} strokeWidth="1.5" className="rx-no-anim"/>
            {hoverBoi && <circle cx={xs(hoverBoi.t)} cy={ysRight(hoverBoi.v)} r={4} fill="var(--bg)" stroke={accent} strokeWidth="2" className="rx-no-anim"/>}
          </g>
        )}

        <line x1={padL} x2={W-padR} y1={H-padB} y2={H-padB} className="axis-line"/>
        <line x1={padL} x2={padL}   y1={padT}    y2={H-padB} className="axis-line"/>
        <line x1={W-padR} x2={W-padR} y1={padT}  y2={H-padB} className="axis-line" strokeOpacity="0.4"/>

        {/* Event markers — after axis lines so dots sit on top */}
        {showEventsRender && events.map((ev, i) => {
          const evT = ev.year + (ev.month - 1) / 12;
          if (evT < tMin || evT > tMax) return null;
          const cx      = xs(evT);
          const isNear  = nearEvent === ev;
          const nearRight = cx > W - padR - 90;
          const nearLeft  = cx < padL + 90;
          const anchor  = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
          const lx      = nearRight ? cx - 8 : nearLeft ? cx + 8 : cx;
          return (
            <g key={i} className={eventsLeaving ? 'rx-events-leaving' : ''}>
              <circle cx={cx} cy={H-padB} r={isNear ? 5 : 3}
                fill={isNear ? 'var(--bg)' : EVENT_COLOR}
                stroke={EVENT_COLOR} strokeWidth={1.5} strokeOpacity={isNear ? 1 : 0.7}/>
              <line className="rx-event-beam" x1={cx} x2={cx} y1={padT} y2={H-padB}
                stroke={EVENT_COLOR} strokeOpacity={isNear ? 0.5 : 0.18}
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
            <div className="hover-month">{MONTHS_PT[hover.month-1]}/{hover.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-year" style={{color:rawColor}}>%Fêmeas</span>
                <span className="hover-val">{hover.v.toFixed(1)}<span className="hover-unit"> %</span></span>
              </div>
              {hoverBoi && (
                <div className="hover-row">
                  <span className="hover-year" style={{color:accent}}>Boi/Bezerro</span>
                  <span className="hover-val">{hoverBoi.v.toFixed(3)}</span>
                </div>
              )}
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
          <span className="legend-line" style={{background:rawColor, opacity:0.7}}/>
          %Fêmeas (mensal)
        </span>
        <span className="legend-year" style={{userSelect:'none', padding:'2px 6px'}}>
          <span className="legend-line" style={{background:accent}}/>
          Boi/Bezerro MM12M (eixo direito)
        </span>
      </div>
    </div>
  );
};

// ── Tab ───────────────────────────────────────────────────────────────────────
function BeefUSTab({ data, accent }) {
  const chartAccent = 'oklch(0.78 0.15 160)';
  const [showEventsCiclo, setShowEventsCiclo] = React.useState(true);
  const [prodPairIdx, setProdPairIdx] = React.useState(0);
  return (
    <main className="main">
      <EdgebeeefCard data={data} accent={chartAccent} events={EVENTS_US || []}/>
      <section className="card card-full" data-card-id="us-ciclo">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">USDA · Ciclo pecuário</div>
            <h3 className="card-title">Ciclo do Boi</h3>
            <div className="card-sub">%Fêmeas no Abate + Boi/Bezerro MM12M</div>
          </div>
          <div className="card-controls" style={{alignSelf:'center'}}>
            <div className="ctrl-btn-group">
              <button className={`ctrl-btn ${showEventsCiclo ? 'is-on' : ''}`} onClick={() => setShowEventsCiclo(v => !v)}>EVENTOS</button>
            </div>
          </div>
        </div>
        <CicloBoiUS data={data} accent={chartAccent} events={EVENTS_US || []} showEvents={showEventsCiclo}/>
      </section>
      <ProductionCard data={data} accent={chartAccent} events={EVENTS_US || []}
        pairIdx={prodPairIdx} onPairChange={setProdPairIdx}/>
      <AnnualProductionCard data={data} accent={chartAccent} pairIdx={prodPairIdx}/>
    </main>
  );
}

export { BeefUSTab, EdgebeeefChart, EdgebeeefControls, buildDailyStats };
