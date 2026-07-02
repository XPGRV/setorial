import React from 'react'
import { EventDot, useFadeOut, useTrackedYears } from './data-utils.jsx'

// Production USDA — quarterly forecast comparison chart

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const PT_MON_ABBR = {
  jan:'Jan', fev:'Fev', mar:'Mar', abr:'Abr', mai:'Mai', jun:'Jun',
  jul:'Jul', ago:'Ago', set:'Set', out:'Out', nov:'Nov', dez:'Dez',
};

// ── ProductionControls ────────────────────────────────────────────────────────
function ProductionControls({
  histYears, selectedHistYears, setSelectedHistYears,
  pairs, pairIdx, setPairIdx,
  showStats, setShowStats,
  chartStyle, setChartStyle,
  showForecast, setShowForecast,
  showEvents, setShowEvents,
}) {
  const { useState, useEffect, useRef } = React;
  const [histDropOpen, setHistDropOpen] = useState(false);
  const [pairDropOpen, setPairDropOpen] = useState(false);
  const histRef = useRef(null);
  const pairRef = useRef(null);
  const presets = [
    { label: '3a',    yrs: histYears.slice(-3) },
    { label: '5a',    yrs: histYears.slice(-5) },
    { label: '10a',   yrs: histYears.slice(-10) },
    { label: 'Todos', yrs: histYears },
  ];

  const activePreset = presets.find(p => {
    const valid = p.yrs.filter(y => histYears.includes(y));
    return valid.length === selectedHistYears.length && valid.every(y => selectedHistYears.includes(y));
  });

  const toggleHistYear = yr => setSelectedHistYears(prev =>
    prev.includes(yr)
      ? (prev.length === 1 ? prev : prev.filter(y => y !== yr))
      : [...prev, yr].sort((a, b) => a - b)
  );

  useEffect(() => {
    if (!histDropOpen) return;
    const h = e => { if (histRef.current && !histRef.current.contains(e.target)) setHistDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [histDropOpen]);

  useEffect(() => {
    if (!pairDropOpen) return;
    const h = e => { if (pairRef.current && !pairRef.current.contains(e.target)) setPairDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pairDropOpen]);

  const fmtSnap = s => {
    if (!s) return '';
    const [mo, yr] = s.split('-');
    return (PT_MON_ABBR[mo] || mo) + '-' + yr;
  };
  const fmtPair = pair => `${fmtSnap(pair.b)} vs ${fmtSnap(pair.a)}`;

  return (
    <div className="card-controls">
      <div className="card-ctrl-row">
        {/* Historical year presets */}
        <div className="year-seg">
          {presets.map(p => (
            <button key={p.label}
              className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`}
              onClick={() => setSelectedHistYears(p.yrs.filter(y => histYears.includes(y)))}>
              {p.label}
            </button>
          ))}
          <div className="year-drop-wrap" ref={histRef}>
            <button
              className={`year-seg-btn ${histDropOpen ? 'is-active' : ''} ${!activePreset && !histDropOpen ? 'is-on' : ''}`}
              onClick={() => setHistDropOpen(o => !o)}>
              Anos ▾
            </button>
            {histDropOpen && (
              <div className="year-drop">
                {histYears.slice().reverse().map(yr => (
                  <div key={yr} className={`year-drop-item ${selectedHistYears.includes(yr) ? 'is-on' : ''}`}
                    onClick={() => toggleHistYear(yr)}>
                    <span className="year-drop-check">{selectedHistYears.includes(yr) ? '✓' : ''}</span>
                    {yr}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comparison pair dropdown */}
        <div className="year-drop-wrap" ref={pairRef} style={{marginLeft: 12}}>
          <button
            className={`year-seg-btn ${pairDropOpen ? 'is-active' : ''}`}
            style={{minWidth: 148, justifyContent: 'space-between'}}
            onClick={() => setPairDropOpen(o => !o)}>
            {pairs[pairIdx] ? fmtPair(pairs[pairIdx]) : '—'} ▾
          </button>
          {pairDropOpen && (
            <div className="year-drop" style={{minWidth: 160}}>
              {pairs.map((pair, i) => (
                <div key={i} className={`year-drop-item ${i === pairIdx ? 'is-on' : ''}`}
                  onClick={() => { setPairIdx(i); setPairDropOpen(false); }}>
                  <span className="year-drop-check">{i === pairIdx ? '✓' : ''}</span>
                  {fmtPair(pair)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card-ctrl-row">
        <div className="ctrl-btn-group">
          <button className={`ctrl-btn ${showStats ? 'is-on' : ''}`} onClick={() => setShowStats(s => !s)}>
            MÉDIA + FAIXA
          </button>
          <button className={`ctrl-btn ${showEvents ? 'is-on' : ''}`} onClick={() => setShowEvents(s => !s)}>
            EVENTOS
          </button>
          <button className={`ctrl-btn ${!showForecast ? 'is-on' : ''}`} onClick={() => setShowForecast(s => !s)}>
            SEM FORECAST
          </button>
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

// ── ProductionChart ───────────────────────────────────────────────────────────
function ProductionChart({
  histSeries,
  indexedA, indexedB,
  compYears,
  selectedHistYears,
  pair, showStats, chartStyle, accent,
  showForecast,
  events = [],
  showEvents = true,
}) {
  const W = 1000, H = 260;
  const padL = 72, padR = 24, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = useFadeOut(showEvents, 400);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = useFadeOut(chartStyle === 'area', 400);
  const { shouldRender: showStatsRender, isLeaving: statsLeaving } = useFadeOut(showStats, 500);
  // (i) Center each quarter in its slot instead of pinning Q1/Q4 to the axes
  const SEG = chartW / 4;
  const x = qi => padL + (qi + 0.5) * SEG;

  // Unified year palette
  const allShownYears = [...new Set([...selectedHistYears, ...compYears])].sort((a,b) => a-b);
  const latestYear    = allShownYears.length ? Math.max(...allShownYears) : 0;
  const yearColor = yr => {
    const palette = [
      'oklch(0.75 0.15 200)',
      'oklch(0.68 0.16 255)',
      'oklch(0.74 0.15 310)',
      'oklch(0.78 0.17 35)',
      'oklch(0.80 0.15 60)',
      'oklch(0.72 0.16 0)',
      'oklch(0.76 0.13 170)',
    ];
    const age = latestYear - yr;
    if (age === 0) return accent;
    return age - 1 < palette.length ? palette[age - 1] : 'oklch(0.48 0.01 260)';
  };

  // ── ALL hooks must come before any early return ──────────────────────────────
  // (iii) Selected year for data labels
  const [hover,   setHover]   = React.useState(null);
  const [selYear, setSelYear] = React.useState(null);

  // Stats band
  const stats = React.useMemo(() => {
    if (!showStatsRender) return null;
    const byQ = [[], [], [], []];
    for (const yr of selectedHistYears) {
      (histSeries[yr]?.values || []).forEach((v, qi) => { if (v != null) byQ[qi].push(v); });
    }
    return byQ.map(vals => {
      if (vals.length < 2) return null;
      const s = [...vals].sort((a, b) => a - b);
      return { min: s[0], max: s[s.length-1], p25: s[Math.floor(s.length*.25)], p75: s[Math.floor(s.length*.75)], mean: vals.reduce((a,b)=>a+b,0)/vals.length };
    });
  }, [showStatsRender, histSeries, selectedHistYears]);

  // ── Y range ──────────────────────────────────────────────────────────────────
  const allVals = [];
  for (const yr of selectedHistYears) (histSeries[yr]?.values || []).forEach(v => v != null && allVals.push(v));
  for (const yr of compYears) {
    (indexedA[yr]?.values || []).forEach((v, i) => {
      if (v != null && (showForecast || !indexedA[yr].forecast[i])) allVals.push(v);
    });
    (indexedB[yr]?.values || []).forEach((v, i) => {
      if (v != null && (showForecast || !indexedB[yr].forecast[i])) allVals.push(v);
    });
  }

  // ── ALL hooks must come before any early return ──────────────────────────────
  const sortedHist = [...selectedHistYears].sort((a,b) => a-b).filter(yr => histSeries[yr]);
  // Anos saindo: rastreia para animação reversa de undraw
  const { displayYears: displayHistYears, isLeaving } = useTrackedYears(sortedHist);

  if (!allVals.length) {
    return (
      <div style={{padding:40, color:'var(--fg-dim)', textAlign: 'center'}}>
        Aguardando dados de produção...
      </div>
    );
  }

  const lo = Math.min(...allVals), hi = Math.max(...allVals);
  const rng = hi - lo || 1;
  const yMin = lo - rng * 0.05, yMax = hi + rng * 0.18;
  const y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  // (ii) Nice Y ticks with decimal when range is small
  const rawStep = (yMax - yMin) / 5;
  const mag  = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const nn   = rawStep / mag;
  const nice = nn < 1.5 ? 1 : nn < 3 ? 2 : nn < 7 ? 5 : 10;
  const step = nice * mag;
  const yTicks = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + step * 0.01; v += step)
    yTicks.push(parseFloat(v.toPrecision(10)));

  const tickFmt = v => {
    if (step >= 1000) return (v / 1000).toFixed(0) + 'k';
    if (step >= 100)  return (v / 1000).toFixed(1) + 'k';
    return Math.round(v).toLocaleString('pt-BR');
  };

  // ── Path builders ─────────────────────────────────────────────────────────────
  const buildPath = vals => {
    const pts = vals.map((v, i) => v != null ? [x(i), y(v)] : null).filter(Boolean);
    if (!pts.length) return '';
    return pts.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  };

  const buildMixed = (values, forecast) => {
    const solidPts = [], dashedPts = [];
    let lastRealIdx = -1;

    for (let i = 0; i < 4; i++) {
      if (values[i] == null) continue;
      
      const isFC = !!forecast[i];
      const p = [x(i), y(values[i])];

      if (!isFC) {
        solidPts.push(p);
        lastRealIdx = i;
      } else if (showForecast) {
        if (dashedPts.length === 0 && lastRealIdx !== -1) {
          dashedPts.push([x(lastRealIdx), y(values[lastRealIdx])]);
        }
        dashedPts.push(p);
      }
    }

    const toPath = pts => {
      if (pts.length < 2) return null;
      return pts.map((p, j) => `${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    };

    const splitFraction = lastRealIdx >= 0 ? (lastRealIdx + 0.5) / 4 : 0;
    return { solidPath: toPath(solidPts), dashedPath: toPath(dashedPts), splitFraction };
  };

  const buildAreaPath = vals => {
    const pts = vals.map((v, i) => v != null ? [x(i), y(v)] : null).filter(Boolean);
    if (!pts.length) return '';
    const top = pts.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return top + ` L${pts[pts.length-1][0].toFixed(1)},${y(yMin).toFixed(1)} L${pts[0][0].toFixed(1)},${y(yMin).toFixed(1)} Z`;
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const toggleSelYear = yr => setSelYear(prev => prev === yr ? null : yr);
  const [mouseY, setMouseY] = React.useState(0);

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const pos = Math.round(((px - padL) / chartW) * 3);
    setHover(Math.max(0, Math.min(3, pos)));
    setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };
  const onSvgClick = () => setSelYear(null);

  const fmtSnap  = s => { if (!s) return ''; const [mo, yr] = s.split('-'); return (PT_MON_ABBR[mo] || mo) + '-' + yr; };
  const fmtVal   = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR');
  const fmtLabel = v => v == null ? '' : Math.round(v).toLocaleString('pt-BR');

  const gradId = 'prod-grad';
  const EVENT_COLOR = 'oklch(0.85 0.18 80)';
  // Events that fall in the hovered quarter among visible years
  const eventsInHoverQ = hover != null && showEvents
    ? events.filter(ev => Math.ceil(ev.month / 3) - 1 === hover && allShownYears.includes(ev.year))
    : [];

  return (
    <div className="chart-wrap">

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        onClick={onSvgClick} style={{cursor:'default'}}>

        <defs>
          {displayHistYears.map(yr => (
            <linearGradient key={yr} id={`${gradId}-${yr}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor={yearColor(yr)} stopOpacity="0.20"/>
              <stop offset="100%" stopColor={yearColor(yr)} stopOpacity="0"/>
            </linearGradient>
          ))}
          <clipPath id={`clip-${gradId}`}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
        </defs>

        {/* Y grid + ticks */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} className="grid-line"/>
            <text x={padL-6} y={y(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {tickFmt(v)}
            </text>
          </g>
        ))}

        {/* X axis — quarters (centered in each slot) */}
        {QUARTERS.map((q, i) => (
          <g key={q}>
            <line x1={x(i)} x2={x(i)} y1={padT} y2={H-padB} className="grid-line" opacity="0.35"/>
            <text x={x(i)} y={H-padB+16} className="tick-label" textAnchor="middle">{q}</text>
          </g>
        ))}

        {/* Stats band */}
        {showStatsRender && stats && (
          <g clipPath={`url(#clip-${gradId})`}>
            <path d={(() => {
              const top = stats.map((s,i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.max)}` : '').join(' ');
              const bot = [...stats].map((s,i) => s ? `L${x(i)},${y(s.min)}` : '').reverse().join(' ');
              return top + ' ' + bot + ' Z';
            })()} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.05}}/>
            <path d={(() => {
              const top = stats.map((s,i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.p75)}` : '').join(' ');
              const bot = [...stats].map((s,i) => s ? `L${x(i)},${y(s.p25)}` : '').reverse().join(' ');
              return top + ' ' + bot + ' Z';
            })()} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.08}}/>
            <path
              d={stats.map((s,i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.mean)}` : '').join(' ')}
              stroke="var(--fg)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" fill="none"
              className={`rx-stat-mean${statsLeaving ? ' rx-stat-leaving' : ''}`}
            />
          </g>
        )}

        {/* ── Pure-historical context years ── */}
        <g clipPath={`url(#clip-${gradId})`}>
        {displayHistYears.map(yr => {
          const vals    = histSeries[yr];
          if (!vals) return null;
          const clr     = yearColor(yr);
          const isLast  = yr === Math.max(...sortedHist);
          const isSel   = selYear === yr;
          const dimmed  = selYear != null && !isSel;
          const leaving = isLeaving(yr);
          const { solidPath, dashedPath, splitFraction } = buildMixed(vals.values, vals.forecast);
          const dashedDelay    = `${(splitFraction * 1.2).toFixed(3)}s`;
          const dashedDuration = `${((1 - splitFraction) * 1.2).toFixed(3)}s`;
          return (
            <g key={yr}>
              {showAreaRender && (
                <path d={buildAreaPath(vals.values)} fill={`url(#${gradId}-${yr})`}
                  pointerEvents="none"
                  style={{'--rx-area-op': dimmed ? 0.15 : (isLast ? 0.9 : 0.6)}}
                  className={`rx-area ${leaving ? 'rx-leaving' : ''} ${areaLeaving ? 'rx-area-leaving' : ''}`}/>
              )}
              {solidPath && (
                <path
                  d={solidPath} fill="none" stroke={clr}
                  strokeWidth={isSel ? 2.5 : (isLast ? 2 : 1.25)}
                  opacity={dimmed ? 0.15 : (isLast ? 1 : 0.8)}
                  strokeLinejoin="round" strokeLinecap="round"
                  className={leaving ? 'rx-leaving' : ''}/>
              )}
              {dashedPath && (
                <path
                  d={dashedPath} fill="none" stroke={clr}
                  strokeWidth={isSel ? 3 : (isLast ? 2.5 : 1.5)}
                  opacity={dimmed ? 0.2 : (isLast ? 1 : 0.8)}
                  strokeDasharray="10 8"
                  strokeLinejoin="round" strokeLinecap="round"
                  className={`rx-dashed-line ${leaving ? 'rx-leaving' : ''}`}
                  style={{ animationDelay: dashedDelay, animationDuration: dashedDuration }}/>
              )}
              {/* Invisible wide click target — só quando o ano está ativo */}
              {!leaving && (
                <path d={buildPath(vals.values)} fill="none" stroke="transparent" strokeWidth={12}
                  style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); toggleSelYear(yr); }}/>
              )}
              {/* Dots + labels when year is selected */}
              {isSel && !leaving && vals.values.map((v, qi) => v != null ? (
                <g key={qi}>
                  <circle cx={x(qi)} cy={y(v)} r={3.5} fill={clr} opacity={0.9}/>
                  <text x={x(qi)} y={y(v) - 10} textAnchor="middle"
                    style={{fontSize:11, fill:clr, fontWeight:600, fontFamily:'var(--font-mono)', pointerEvents:'none'}}>
                    {fmtLabel(v)}
                  </text>
                </g>
              ) : null)}
            </g>
          );
        })}
        </g>

        {/* ── Comparison years (A = older muted, B = newer full) ── */}
        {compYears.map(yr => {
          const clr   = yearColor(yr);
          const a     = indexedA[yr];
          const b     = indexedB[yr];
          const isSel = selYear === yr;
          const dimmed = selYear != null && !isSel;
          const { solidPath: aSolid, dashedPath: aDashed, splitFraction: aFrac } = a ? buildMixed(a.values, a.forecast) : {};
          const { solidPath: bSolid, dashedPath: bDashed, splitFraction: bFrac } = b ? buildMixed(b.values, b.forecast) : {};
          const dashedStyle = f => f != null ? { animationDelay: `${(f * 1.2).toFixed(3)}s`, animationDuration: `${((1 - f) * 1.2).toFixed(3)}s` } : {};
          // no bFullPath needed — click targets built individually below
          return (
            <g key={yr}>
              {/* Line A — older snapshot, muted */}
              {a && (
                <g opacity={dimmed ? 0.08 : 0.38}>
                  {aSolid  && <path d={aSolid}  fill="none" stroke={clr} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>}
                  {aDashed && <path d={aDashed} fill="none" stroke={clr} strokeWidth={2} strokeDasharray="10 8" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.9" className="rx-dashed-line" style={dashedStyle(aFrac)}/>}
                </g>
              )}
              {/* Line B — newer snapshot, full opacity */}
              {b && (
                <g opacity={dimmed ? 0.12 : 1}>
                  {bSolid  && <path d={bSolid}  fill="none" stroke={clr} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>}
                  {bDashed && <path d={bDashed} fill="none" stroke={clr} strokeWidth={3} strokeDasharray="10 8" strokeLinejoin="round" strokeLinecap="round" className="rx-dashed-line" style={dashedStyle(bFrac)}/>}
                </g>
              )}
              {/* (iii) Click targets — cover solid + dashed for BOTH A and B */}
              {[aSolid, aDashed, bSolid, bDashed].filter(Boolean).map((d, i) => (
                <path key={i} d={d} fill="none" stroke="transparent" strokeWidth={12}
                  style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); toggleSelYear(yr); }}/>
              ))}
              {/* Dots + labels when year is selected */}
              {isSel && (
                <g>
                  {/* B dots + labels */}
                  {b && b.values.map((v, qi) => {
                    if (v == null) return null;
                    if (!showForecast && b.forecast[qi]) return null;
                    return (
                      <g key={`b-${qi}`}>
                        <circle cx={x(qi)} cy={y(v)} r={3.5} fill={clr} opacity={0.9}/>
                        <text x={x(qi)} y={y(v) - 10} textAnchor="middle"
                          style={{fontSize:11, fill:clr, fontWeight:600, fontFamily:'var(--font-mono)', pointerEvents:'none'}}>
                          {fmtLabel(v)}
                        </text>
                      </g>
                    );
                  })}
                  {/* A dots + delta labels */}
                  {a && a.values.map((v, qi) => {
                    if (v == null) return null;
                    if (!showForecast && a.forecast[qi]) return null;
                    const vB    = b?.values[qi];
                    const delta = vB != null ? vB - v : null;
                    const txt   = delta != null
                      ? (delta >= 0 ? '+' : '') + Math.round(delta).toLocaleString('pt-BR')
                      : fmtLabel(v);
                    const yLabelA = Math.max(y(v), vB != null ? y(vB) : y(v)) + 18;
                    return (
                      <g key={`a-${qi}`}>
                        <circle cx={x(qi)} cy={y(v)} r={2.5} fill={clr} opacity={0.45}/>
                        <text x={x(qi)} y={yLabelA} textAnchor="middle"
                          style={{fontSize:10, fill:clr, opacity:0.55, fontFamily:'var(--font-mono)', pointerEvents:'none'}}>
                          {txt}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}

        {/* Event markers — BEFORE hover crosshair so hover dots naturally cover them */}
        {showEventsRender && allShownYears
          .filter(yr => !selYear || yr === selYear)
          .flatMap(yr => {
            const yearEvents = events.filter(ev => ev.year === yr);
            return yearEvents.flatMap((ev, i) => {
              const qi  = Math.ceil(ev.month / 3) - 1;
              const v   = selectedHistYears.includes(yr)
                ? (histSeries[yr]?.values[qi] ?? null)
                : (() => {
                    const vb  = indexedB[yr]?.values[qi];
                    const fcB = indexedB[yr]?.forecast[qi];
                    return (vb != null && (showForecast || !fcB)) ? vb : null;
                  })();
              if (v == null) return [];

              const cx       = x(qi);
              const cy       = y(v);
              const isPinned = yr === selYear;
              const labelY   = padT + 2;
              const nearRight = cx > W - padR - 100;
              const nearLeft  = cx < padL + 100;
              const anchor   = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
              const lx       = nearRight ? cx - 8 : nearLeft ? cx + 8 : cx;

              // delay synced with line draw (1.2s over 4 quarters)
              const dotDelay = `${(qi / 3 * 1.1).toFixed(2)}s`;
              return [(
                <g key={`ev-${yr}-${i}`} className={eventsLeaving ? 'rx-events-leaving' : ''}>
                  <EventDot cx={cx} cy={cy}
                    r={isPinned ? 5 : 3}
                    fill={isPinned ? 'none' : EVENT_COLOR}
                    stroke={EVENT_COLOR} strokeWidth={1.5}
                    delaySec={parseFloat(dotDelay)}/>
                  {isPinned && (
                    <line className="rx-event-beam" x1={cx} y1={labelY + 12} x2={cx} y2={cy - 6}
                      stroke={EVENT_COLOR} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.6}/>
                  )}
                  {isPinned && (
                    <text x={lx} y={labelY}
                      textAnchor={anchor} dominantBaseline="hanging"
                      style={{fontFamily:'var(--font-mono)', fontSize:10, fill:EVENT_COLOR, fontWeight:600, letterSpacing:'0.01em'}}>
                      {ev.label}
                    </text>
                  )}
                </g>
              )];
            });
          })}

        {/* Hover crosshair + dots — rendered after events, so dots cover event markers */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H-padB} stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            {sortedHist.map(yr => {
              const v = histSeries[yr]?.values[hover];
              if (v == null) return null;
              const isFC = histSeries[yr]?.forecast[hover];
              return (
                <circle key={yr} cx={x(hover)} cy={y(v)} 
                  r={3.5} 
                  fill={isFC ? 'transparent' : 'var(--bg)'} 
                  stroke={yearColor(yr)} 
                  strokeWidth={1.5}
                />
              );
            })}
            {compYears.map(yr => {
              const clr = yearColor(yr);
              const va  = indexedA[yr]?.values[hover];
              const vb  = indexedB[yr]?.values[hover];
              const fcA = indexedA[yr]?.forecast[hover];
              const fcB = indexedB[yr]?.forecast[hover];
              return (
                <g key={yr}>
                  {va != null && (showForecast || !fcA) && (
                    <circle cx={x(hover)} cy={y(va)} r={4} 
                      fill={fcA ? 'transparent' : 'var(--bg)'} 
                      stroke={clr} strokeWidth={1.5} opacity={0.6}
                    />
                  )}
                  {vb != null && (showForecast || !fcB) && (
                    <circle cx={x(hover)} cy={y(vb)} r={4.5} 
                      fill={fcB ? 'transparent' : 'var(--bg)'} 
                      stroke={clr} strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}
          </g>
        )}

        <line x1={padL} x2={W-padR} y1={H-padB} y2={H-padB} className="axis-line"/>
        <line x1={padL} x2={padL}   y1={padT}    y2={H-padB} className="axis-line"/>
      </svg>

      {/* Hover card */}
      {hover != null && (() => {
        const rows = [];
        for (const yr of [...compYears].reverse()) {
          const clr = yearColor(yr);
          const va  = indexedA[yr]?.values[hover];
          const vb  = indexedB[yr]?.values[hover];
          const fcA = indexedA[yr]?.forecast[hover];
          const fcB = indexedB[yr]?.forecast[hover];
          if (vb != null && (showForecast || !fcB)) rows.push({ label:`${yr} · ${fmtSnap(pair?.b)}${fcB?' (fc)':''}`, color:clr, val:vb });
          if (va != null && (showForecast || !fcA)) rows.push({ label:`${yr} · ${fmtSnap(pair?.a)}${fcA?' (fc)':''}`, color:clr, val:va, muted:true });
        }
        for (const yr of [...sortedHist].reverse()) {
          const v = histSeries[yr]?.values[hover];
          if (v != null) rows.push({ label:String(yr), color:yearColor(yr), val:v });
        }
        if (!rows.length) return null;
        const xPos = x(hover);
        const isRightSide = xPos > chartW * 0.75;
        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 140, mouseY - 40)),
            transform: isRightSide ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">{QUARTERS[hover]}</div>
            <div className="hover-rows">
              {rows.map((r, i) => (
                <div key={i} className="hover-row" style={r.muted ? {opacity:0.5} : {}}>
                  <span className="hover-year" style={{color: r.color}}>{r.label}</span>
                  <span className="hover-val">{fmtVal(r.val)}<span className="hover-unit"> 000 lb</span></span>
                </div>
              ))}
            </div>
            {eventsInHoverQ.length > 0 && (
              <div className="hover-events">
                {eventsInHoverQ.map((ev, i) => (
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

      {/* Legend — clicking also selects year */}
      <div className="ciclo-legend" style={{flexWrap:'wrap', gap:4}}>
        {[...sortedHist].reverse().map(yr => {
          const isSel  = selYear === yr;
          const dimmed = selYear != null && !isSel;
          return (
            <span key={yr} className="legend-year"
              style={{
                padding:'2px 6px',
                opacity: dimmed ? 0.25 : (yr===Math.max(...sortedHist)?1:0.75),
                cursor:'pointer', userSelect:'none',
                outline: isSel ? `1px solid ${yearColor(yr)}` : 'none',
                borderRadius: 4,
              }}
              onClick={() => toggleSelYear(yr)}>
              <span className="legend-line" style={{background: yearColor(yr)}}/>
              {yr}
            </span>
          );
        })}
        {compYears.map(yr => {
          const clr    = yearColor(yr);
          const isSel  = selYear === yr;
          const dimmed = selYear != null && !isSel;
          const hasFcA = indexedA[yr]?.forecast.some(f => f);
          const hasFcB = indexedB[yr]?.forecast.some(f => f);
          return (
            <React.Fragment key={yr}>
              <span className="legend-year"
                style={{padding:'2px 6px', opacity: dimmed ? 0.1 : 1, cursor:'pointer', userSelect:'none',
                  outline: isSel ? `1px solid ${clr}` : 'none', borderRadius: 4}}
                onClick={() => toggleSelYear(yr)}>
                <span style={{
                  display:'inline-block',width:22,height:0,
                  borderTop: hasFcB ? `2.5px dashed ${clr}` : `2.5px solid ${clr}`,
                  verticalAlign:'middle',marginRight:4
                }}/>
                {yr} {fmtSnap(pair?.b)}
              </span>
              <span className="legend-year"
                style={{padding:'2px 6px', opacity: dimmed ? 0.05 : 0.45, cursor:'pointer', userSelect:'none',
                  outline: isSel ? `1px solid ${clr}` : 'none', borderRadius: 4}}
                onClick={() => toggleSelYear(yr)}>
                <span style={{
                  display:'inline-block',width:22,height:0,
                  borderTop: hasFcA ? `1.5px dashed ${clr}` : `1.5px solid ${clr}`,
                  verticalAlign:'middle',marginRight:4
                }}/>
                {yr} {fmtSnap(pair?.a)}
              </span>
            </React.Fragment>
          );
        })}
        {showStats && (<>
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
        </>)}
      </div>
    </div>
  );
}

// ── LDP summary parser ────────────────────────────────────────────────────────
const MONTH_EN_PT = {
  january:'jan', february:'fev', march:'mar', april:'abr',
  may:'mai', june:'jun', july:'jul', august:'ago',
  september:'set', october:'out', november:'nov', december:'dez',
};

// Normaliza abreviatura EN → PT para o lookup de summaries.
// Ex: "apr-26" → "abr-26", "dec-25" → "dez-25".
// Meses idênticos nos dois idiomas (jan, mar, jun, jul, nov) passam sem alteração.
const EN_ABBR_TO_PT = { feb:'fev', apr:'abr', may:'mai', aug:'ago', sep:'set', oct:'out', dec:'dez' };
function normalizeSummaryKey(key) {
  if (!key) return key;
  const dash = key.lastIndexOf('-');
  if (dash < 0) return key;
  const mo = key.slice(0, dash).toLowerCase();
  const yr = key.slice(dash + 1);
  return `${EN_ABBR_TO_PT[mo] || mo}-${yr}`;
}

function parseLDPSummaries(text) {
  const map = {};
  const lines = text.split(/\r?\n/);
  let key = null, buf = [];

  const flush = () => {
    if (key) {
      const pdfLine = buf.find(l => l.startsWith('PDF:'));
      const pdf = pdfLine ? pdfLine.replace(/^PDF:\s*/, '').trim() : null;
      const body = buf.filter(l => l && !l.startsWith('PDF:')).join(' ').trim();
      if (body) map[key] = { text: body, pdf };
    }
    buf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const hdr = line.match(/^={3}\s+Livestock[^:]+:\s+(\w+)\s+(\d{4})/i);
    if (hdr) {
      flush();
      const pt = MONTH_EN_PT[hdr[1].toLowerCase()];
      key = pt ? `${pt}-${hdr[2].slice(-2)}` : null;
    } else {
      buf.push(line);
    }
  }
  flush();
  return map;
}

// ── ProductionCard ────────────────────────────────────────────────────────────
function ProductionCard({
  data, accent, events = [], pairIdx: pairIdxProp, onPairChange,
  productionKey = 'production',
  summariesFile = 'ldp_pdf_summaries.txt',
  eyebrow: eyebrowProp,
  title: titleProp,
  cardId = 'us-production',
}) {
  const { useState, useMemo, useEffect } = React;

  const [summaries, setSummaries] = useState({});
  useEffect(() => {
    fetch(summariesFile)
      .then(r => r.ok ? r.text() : '')
      .then(text => { if (text) setSummaries(parseLDPSummaries(text)); })
      .catch(() => {});
  }, [summariesFile]);

  // Extract early — hooks must all fire before any conditional return
  const production  = data?.[productionKey];
  const snapshots   = production?.snapshots  || [];
  const bySnapshot  = production?.bySnapshot || {};

  const toByYQ = records => {
    const out = {};
    for (const r of (records || [])) {
      if (!out[r.year]) out[r.year] = { values:[null,null,null,null], forecast:[false,false,false,false] };
      out[r.year].values[r.quarter - 1]   = r.value;
      out[r.year].forecast[r.quarter - 1] = r.isForecast;
    }
    return out;
  };

  const pairs = useMemo(() => {
    const p = [];
    for (let i = snapshots.length - 1; i >= 1; i--) p.push({ a: snapshots[i-1], b: snapshots[i] });
    return p;
  }, [snapshots.join(',')]);

  const [localPairIdx, setLocalPairIdx] = useState(0);
  const pairIdx    = pairIdxProp !== undefined ? pairIdxProp : localPairIdx;
  const setPairIdx = onPairChange  !== undefined ? onPairChange  : setLocalPairIdx;
  const [showStats, setShowStats]     = useState(false);
  const [showEvents, setShowEvents]   = useState(true);
  const [chartStyle, setChartStyle]   = useState('line');
  const [showForecast, setShowForecast] = useState(true);

  const pair     = pairs[Math.min(pairIdx, pairs.length - 1)];
  const indexedA = useMemo(() => toByYQ(pair ? bySnapshot[pair.a] : []), [bySnapshot, pair?.a]);
  const indexedB = useMemo(() => toByYQ(pair ? bySnapshot[pair.b] : []), [bySnapshot, pair?.b]);

  const compYears = useMemo(() => {
    const allYrs = new Set([...Object.keys(indexedA), ...Object.keys(indexedB)].map(Number));
    return [...allYrs].filter(yr => {
      const a = indexedA[yr], b = indexedB[yr];
      if (!a || !b) return false;
      
      // 1. Is it a forecast year?
      const isFC = a.forecast.some(f => f) || b.forecast.some(f => f);
      if (isFC) return true;
      
      // 2. Was it revised (are values different between snapshots)?
      const isRevised = a.values.some((v, i) => v !== b.values[i]);
      if (isRevised) return true;

      return false;
    }).sort((a, b) => a - b);
  }, [indexedA, indexedB]);

  const histYears = useMemo(() => {
    const compSet = new Set(compYears);
    const allKnownYrs = new Set([...Object.keys(indexedA), ...Object.keys(indexedB)].map(Number));
    // Historical years are those that are NOT in the comparison (they are identical and have no forecast)
    return [...allKnownYrs].filter(yr => !compSet.has(yr)).sort((a, b) => a - b);
  }, [indexedA, indexedB, compYears]);

  const [selectedHistYears, setSelectedHistYears] = useState(() => histYears.slice(-5));
  useEffect(() => { setSelectedHistYears(histYears.slice(-5)); }, [pairIdx, histYears.join(',')]);

  // Inclui TODOS os anos históricos para suportar animação reversa de undraw
  // (anos saindo precisam ter seus dados disponíveis durante a animação)
  const histSeries = useMemo(() => {
    const out = {};
    for (const yr of histYears) {
      const d = indexedB[yr] || indexedA[yr];
      if (d) out[yr] = { values: d.values, forecast: d.forecast };
    }
    return out;
  }, [indexedA, indexedB, histYears.join(',')]);

  // Early return after all hooks
  if (!snapshots.length || !production?.bySnapshot) {
    return (
      <div style={{padding:40, color:'var(--fg-dim)', textAlign: 'center'}}>
        Aguardando dados de produção...
      </div>
    );
  }

  const fmtSnap = s => { if (!s) return ''; const [mo, yr] = s.split('-'); return (PT_MON_ABBR[mo]||mo)+'-'+yr; };

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{eyebrowProp || 'USDA · Produção bovina trimestral · 000 lb'}</div>
          <h3 className="card-title">{titleProp || 'Revisão de Forecast'}</h3>
          <div className="card-sub">
            {pair ? `${fmtSnap(pair.b)} vs ${fmtSnap(pair.a)}` : ''}
            {' · '}contínuo = realizado · tracejado = projeção
          </div>
        </div>
        <ProductionControls
          histYears={histYears}
          selectedHistYears={selectedHistYears} setSelectedHistYears={setSelectedHistYears}
          pairs={pairs} pairIdx={pairIdx} setPairIdx={setPairIdx}
          showStats={showStats} setShowStats={setShowStats}
          showEvents={showEvents} setShowEvents={setShowEvents}
          chartStyle={chartStyle} setChartStyle={setChartStyle}
          showForecast={showForecast} setShowForecast={setShowForecast}
        />
      </div>
      <ProductionChart
        histSeries={histSeries}
        indexedA={indexedA} indexedB={indexedB}
        compYears={compYears}
        selectedHistYears={selectedHistYears}
        pair={pair}
        showStats={showStats} chartStyle={chartStyle}
        accent={accent}
        showForecast={showForecast}
        events={events}
        showEvents={showEvents}
      />
      {showForecast && pair?.b && summaries[normalizeSummaryKey(pair.b)] && (
        <div className="forecast-summary">
          <div className="forecast-summary-label">
            Motivo da revisão · {fmtSnap(pair.b)}
            {summaries[normalizeSummaryKey(pair.b)].pdf && (
              <a href={summaries[normalizeSummaryKey(pair.b)].pdf} target="_blank" rel="noreferrer" className="forecast-summary-link">
                Ver relatório ↗
              </a>
            )}
          </div>
          <p className="forecast-summary-text">{summaries[normalizeSummaryKey(pair.b)].text}</p>
        </div>
      )}
    </section>
  );
}

// ── buildAnnualSeries ─────────────────────────────────────────────────────────
function buildAnnualSeries(records) {
  const byYear = {};
  for (const { year, quarter, value, isForecast } of (records || [])) {
    if (!byYear[year]) byYear[year] = { realized: 0, forecast: 0, total: 0 };
    const v = value || 0;
    byYear[year].total += v;
    if (isForecast) byYear[year].forecast += v;
    else byYear[year].realized += v;
  }
  return byYear;
}

// ── AnnualProductionChart ─────────────────────────────────────────────────────
function AnnualProductionChart({ annualB, annualA, compYears, allYears, showForecast, accent, pair }) {
  const fmtSnap = s => { if (!s) return ''; const [mo, yr] = s.split('-'); return (PT_MON_ABBR[mo]||mo)+'-'+yr; };
  const { useState } = React;
  const W = 1000, H = 260;
  const padL = 72, padR = 24, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const [hover,  setHover]  = useState(null);
  const [mouseY, setMouseY] = useState(0);

  const numYears = allYears.length;
  if (!numYears) return null;

  const slotW = chartW / numYears;
  const barGap = 4;
  const bBarW  = Math.min(slotW * 0.38, 28);

  const xCenter = i => padL + (i + 0.5) * slotW;

  const latestYear = Math.max(...allYears);
  const yearColor  = yr => {
    const palette = [
      'oklch(0.75 0.15 200)',
      'oklch(0.68 0.16 255)',
      'oklch(0.74 0.15 310)',
      'oklch(0.78 0.17 35)',
      'oklch(0.80 0.15 60)',
      'oklch(0.72 0.16 0)',
      'oklch(0.76 0.13 170)',
    ];
    const age = latestYear - yr;
    if (age === 0) return accent;
    return age - 1 < palette.length ? palette[age - 1] : 'oklch(0.48 0.01 260)';
  };

  // Y range
  const allVals = [];
  for (const yr of allYears) {
    const b = annualB[yr];
    const a = annualA[yr];
    if (b) allVals.push(showForecast ? b.total : b.realized);
    if (a) allVals.push(showForecast ? a.total : a.realized);
  }
  if (!allVals.length) return null;

  const hiVal = Math.max(...allVals);
  const yMin  = 20000;
  const yMax  = hiVal * 1.05;
  const yBase = padT + chartH;
  const y     = v => padT + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  // Nice ticks
  const rawStep = (yMax - yMin) / 5;
  const mag  = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const nn   = rawStep / mag;
  const nice = nn < 1.5 ? 1 : nn < 3 ? 2 : nn < 7 ? 5 : 10;
  const step = nice * mag;
  const yTicks = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + step * 0.01; v += step) yTicks.push(parseFloat(v.toPrecision(10)));

  const tickFmt = v => {
    if (step >= 1000000) return (v / 1000000).toFixed(0) + 'M';
    if (step >= 1000)    return (v / 1000).toFixed(0) + 'k';
    if (step >= 100)     return (v / 1000).toFixed(1) + 'k';
    return Math.round(v).toLocaleString('pt-BR');
  };
  const fmtVal = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR');

  const gradId    = 'annual-prod';
  const patId     = yr => `hatch-ann-${yr}`;
  const hoverYear = hover != null ? allYears[hover] : null;

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px   = (e.clientX - rect.left) * (W / rect.width);
    const py   = (e.clientY - rect.top)  * (H / rect.height);
    const xi   = Math.floor((px - padL) / slotW);
    setHover(xi >= 0 && xi < numYears ? xi : null);
    setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };

  return (
    <div className="chart-wrap" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>

        <defs>
          <clipPath id={`clip-${gradId}`}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
          {allYears.map(yr => (
            <pattern key={yr} id={patId(yr)} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={yearColor(yr)} strokeWidth="2.2" strokeOpacity="0.55"/>
            </pattern>
          ))}
        </defs>

        {/* Y grid + ticks */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid-line"/>
            <text x={padL - 6} y={y(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {tickFmt(v)}
            </text>
          </g>
        ))}

        {/* Bars — centered, no exit animation */}
        <g clipPath={`url(#clip-${gradId})`}>
          {allYears.map((yr, di) => {
            const isComp = compYears.includes(yr);
            const clr    = yearColor(yr);
            const bData  = annualB[yr];
            const aData  = annualA[yr];
            const isHov  = hover === di;

            const bTotal    = bData ? (showForecast ? bData.total    : bData.realized) : 0;
            const bRealized = bData ? bData.realized : 0;
            const aTotal    = aData ? (showForecast ? aData.total    : aData.realized) : 0;

            const cx = xCenter(di);
            // Comparison: pair centered on cx (B left, A right); solo: B centered
            const bX = isComp ? cx - barGap / 2 - bBarW : cx - bBarW / 2;
            const aX = cx + barGap / 2;

            const bRealY = y(bRealized);
            const bRealH = Math.max(0, yBase - bRealY);
            const bTotY  = y(bTotal);
            const bTotH  = Math.max(0, yBase - bTotY);
            const bFcH   = Math.max(0, bTotH - bRealH);
            const aTotY  = y(aTotal);
            const aTotH  = Math.max(0, yBase - aTotY);

            // Entry right-to-left delay
            const entryDelay = `${(numYears - 1 - di) * 0.04}s`;

            return (
              <g key={yr}>
                {bRealH > 0 && (
                  <rect x={bX} y={bRealY} width={bBarW} height={bRealH}
                    fill={clr} opacity={isHov ? 0.95 : 0.72} rx={2}
                    className="rx-bar" style={{ animationDelay: entryDelay }}/>
                )}
                {bFcH > 0 && (
                  <>
                    <rect x={bX} y={bTotY} width={bBarW} height={bFcH}
                      fill={clr} opacity={isHov ? 0.22 : 0.14} rx={2}
                      className="rx-bar" style={{ animationDelay: entryDelay }}/>
                    <rect x={bX} y={bTotY} width={bBarW} height={bFcH}
                      fill={`url(#${patId(yr)})`} rx={2}
                      className="rx-bar" style={{ animationDelay: entryDelay }}/>
                  </>
                )}
                {isComp && aTotH > 0 && (
                  <rect x={aX} y={aTotY} width={bBarW} height={aTotH}
                    fill="none" stroke={clr} strokeWidth={1.5} strokeOpacity={isHov ? 0.85 : 0.55}
                    strokeDasharray="3 2" rx={2}
                    className="rx-bar" style={{ animationDelay: entryDelay }}/>
                )}
              </g>
            );
          })}
        </g>

        {/* X axis baseline */}
        <line x1={padL} x2={W - padR} y1={yBase} y2={yBase} stroke="var(--border)" strokeWidth={1}/>

        {/* Year labels */}
        {allYears.map((yr, di) => (
          <text key={yr} x={xCenter(di)} y={yBase + 16} textAnchor="middle"
            className="tick-label" style={{ fontSize: numYears > 13 ? 9 : 11 }}>
            {yr}
          </text>
        ))}
      </svg>

      {/* Hover card — mesmo padrão dos outros gráficos */}
      {hoverYear != null && (() => {
        const bData  = annualB[hoverYear];
        const aData  = annualA[hoverYear];
        const isComp = compYears.includes(hoverYear);
        const clr    = yearColor(hoverYear);
        const xPos   = padL + (hover + 0.5) * slotW;
        const isRight = xPos > W * 0.65;

        const bTotal = bData ? (showForecast ? bData.total : bData.realized) : null;
        const aTotal = aData ? (showForecast ? aData.total : aData.realized) : null;
        const delta  = isComp && bTotal != null && aTotal != null ? bTotal - aTotal : null;

        const rows = [];
        if (bTotal != null) {
          rows.push({ label: String(hoverYear), color: clr, val: bTotal });
          if (showForecast && bData.realized > 0 && bData.forecast > 0) {
            rows.push({ label: 'Realizado', color: clr, val: bData.realized, muted: true });
            rows.push({ label: 'Forecast',  color: clr, val: bData.forecast, muted: true });
          }
        }
        if (isComp && aTotal != null) {
          rows.push({ label: 'Revisão ant.', color: clr, val: aTotal, muted: true });
        }
        if (!rows.length) return null;

        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 150, mouseY - 40)),
            transform: isRight ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">Produção</div>
            <div className="hover-rows">
              {rows.map((r, i) => (
                <div key={i} className="hover-row" style={r.muted ? { opacity: 0.55 } : {}}>
                  <span className="hover-year" style={{ color: r.color }}>{r.label}</span>
                  <span className="hover-val">{fmtVal(r.val)}<span className="hover-unit"> 000 lb</span></span>
                </div>
              ))}
              {delta != null && (
                <div className="hover-row" style={{ marginTop: 4 }}>
                  <span className="hover-year" style={{ color: delta >= 0 ? '#4caf50' : '#f55' }}>Δ revisão</span>
                  <span className="hover-val" style={{ color: delta >= 0 ? '#4caf50' : '#f55' }}>
                    {delta >= 0 ? '+' : ''}{fmtVal(delta)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="ciclo-legend" style={{flexWrap:'wrap', gap:4}}>
        {[...allYears].reverse().map(yr => (
          <span key={yr} className="legend-year" style={{padding:'2px 6px', userSelect:'none'}}>
            <span style={{
              display:'inline-block', width:12, height:12,
              background: yearColor(yr), opacity:0.75, borderRadius:2,
              verticalAlign:'middle', marginRight:4,
            }}/>
            {yr}
          </span>
        ))}
        <span style={{flex:'1 0 100%', height:0}}/>
        {showForecast && (
          <span className="legend-year" style={{opacity:0.6, userSelect:'none', padding:'2px 6px'}}>
            <span style={{
              display:'inline-block', width:14, height:10,
              background:'repeating-linear-gradient(45deg, var(--fg) 0, var(--fg) 1.2px, transparent 0, transparent 4px)',
              opacity:0.45, borderRadius:1, verticalAlign:'middle', marginRight:4,
            }}/>
            Forecast {fmtSnap(pair?.b)}
          </span>
        )}
        {compYears.length > 0 && (
          <span className="legend-year" style={{opacity:0.6, userSelect:'none', padding:'2px 6px'}}>
            <span style={{
              display:'inline-block', width:14, height:10,
              border:'1.5px dashed var(--fg)', opacity:0.45,
              borderRadius:2, verticalAlign:'middle', marginRight:4,
            }}/>
            Forecast {fmtSnap(pair?.a)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── AnnualProductionCard ──────────────────────────────────────────────────────
function AnnualProductionCard({
  data, accent, pairIdx: pairIdxProp,
  productionKey = 'production',
  eyebrow: eyebrowProp,
  title: titleProp,
  cardId = 'us-annual',
}) {
  const { useState, useMemo, useEffect, useRef } = React;

  const production  = data?.[productionKey];
  const snapshots   = production?.snapshots  || [];
  const bySnapshot  = production?.bySnapshot || {};

  const pairs = useMemo(() => {
    const p = [];
    for (let i = snapshots.length - 1; i >= 1; i--) p.push({ a: snapshots[i-1], b: snapshots[i] });
    return p;
  }, [snapshots.join(',')]);

  // pairIdx driven by quarterly chart (prop); local state kept only as fallback
  const [localPairIdx, setLocalPairIdx] = useState(0);
  const pairIdx       = pairIdxProp !== undefined ? pairIdxProp : localPairIdx;
  const pairLocked    = pairIdxProp !== undefined;

  const [showForecast, setShowForecast] = useState(true);
  const [yearRange,    setYearRange]    = useState('10a');
  const [pairDropOpen, setPairDropOpen] = useState(false);
  const pairRef = useRef(null);

  useEffect(() => {
    if (!pairDropOpen) return;
    const h = e => { if (pairRef.current && !pairRef.current.contains(e.target)) setPairDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pairDropOpen]);

  const pair    = pairs[Math.min(pairIdx, pairs.length - 1)];
  const annualB = useMemo(() => buildAnnualSeries(pair ? bySnapshot[pair.b] : []), [bySnapshot, pair?.b]);
  const annualA = useMemo(() => buildAnnualSeries(pair ? bySnapshot[pair.a] : []), [bySnapshot, pair?.a]);

  const allYears = useMemo(() => {
    const s = new Set([...Object.keys(annualB), ...Object.keys(annualA)].map(Number));
    return [...s].sort((a, b) => a - b);
  }, [annualB, annualA]);

  const compYears = useMemo(() => {
    if (!pair) return [];
    return allYears.filter(yr => {
      const b = annualB[yr], a = annualA[yr];
      if (!b || !a) return false;
      return b.forecast > 0 || a.forecast > 0 || Math.abs(b.total - a.total) > 0.5;
    });
  }, [annualB, annualA, allYears, pair?.a, pair?.b]);

  const filteredYears = useMemo(() => {
    if (yearRange === '5a')  return allYears.slice(-5);
    if (yearRange === '10a') return allYears.slice(-10);
    return allYears;
  }, [allYears, yearRange]);

  const fmtSnap = s => { if (!s) return ''; const [mo, yr] = s.split('-'); return (PT_MON_ABBR[mo]||mo)+'-'+yr; };
  const fmtPair = p => p ? `${fmtSnap(p.b)} vs ${fmtSnap(p.a)}` : '—';

  if (!snapshots.length || !production?.bySnapshot) {
    return (
      <div style={{ padding: 40, color: 'var(--fg-dim)', textAlign: 'center' }}>
        Aguardando dados de produção...
      </div>
    );
  }

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{eyebrowProp || 'USDA · Produção bovina anual · 000 lb'}</div>
          <h3 className="card-title">{titleProp || 'Revisão de Forecast · Anual'}</h3>
          <div className="card-sub">
            {pair ? `${fmtSnap(pair.b)} vs ${fmtSnap(pair.a)}` : ''}
          </div>
        </div>
        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {['5a', '10a', 'Todos'].map(p => (
                <button key={p} className={`year-seg-btn ${yearRange === p ? 'is-on' : ''}`}
                  onClick={() => setYearRange(p)}>{p}</button>
              ))}
            </div>
            <div className="year-drop-wrap" ref={pairRef} style={{ marginLeft: 12 }}>
              <button
                className={`year-seg-btn ${pairDropOpen ? 'is-active' : ''}`}
                style={{ minWidth: 148, justifyContent: 'space-between', opacity: pairLocked ? 0.35 : 1, cursor: pairLocked ? 'not-allowed' : 'pointer' }}
                onClick={() => { if (!pairLocked) setPairDropOpen(o => !o); }}
                title={pairLocked ? 'Controlado pelo gráfico trimestral' : undefined}>
                {fmtPair(pair)} ▾
              </button>
              {pairDropOpen && !pairLocked && (
                <div className="year-drop" style={{ minWidth: 160 }}>
                  {pairs.map((p, i) => (
                    <div key={i} className={`year-drop-item ${i === pairIdx ? 'is-on' : ''}`}
                      onClick={() => { setLocalPairIdx(i); setPairDropOpen(false); }}>
                      <span className="year-drop-check">{i === pairIdx ? '✓' : ''}</span>
                      {fmtPair(p)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="card-ctrl-row">
            <div className="ctrl-btn-group">
              <button className={`ctrl-btn ${!showForecast ? 'is-on' : ''}`}
                onClick={() => setShowForecast(s => !s)}>SEM FORECAST</button>
            </div>
          </div>
        </div>
      </div>
      <AnnualProductionChart
        annualB={filteredYears.reduce((acc, yr) => { if (annualB[yr]) acc[yr] = annualB[yr]; return acc; }, {})}
        annualA={filteredYears.reduce((acc, yr) => { if (annualA[yr]) acc[yr] = annualA[yr]; return acc; }, {})}
        compYears={compYears}
        allYears={filteredYears}
        showForecast={showForecast}
        accent={accent}
        pair={pair}
      />
    </section>
  );
}

export { ProductionCard, AnnualProductionCard };
