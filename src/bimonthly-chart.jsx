import React from 'react'
import { buildBimonthlyStats, useFadeOut, useTrackedYears } from './data-utils.jsx'
import { MultiContinuousChart } from './continuous-chart.jsx'

// BimonthlyCard — Sazonal (empresa + anos) e Contínuo (3 linhas simultâneas)

const BM_LABELS = ['Jan/Fev','Mar/Abr','Mai/Jun','Jul/Ago','Set/Out','Nov/Dez'];
const BM_SHORT  = ['J/F','M/A','M/J','J/A','S/O','N/D'];

function toBimonthly(rows, fieldKeys) {
  const map = {};
  for (const r of rows) {
    const bm  = Math.ceil(r.month / 2);
    const key = `${r.year}-${bm}`;
    if (!map[key] && fieldKeys.some(f => r[f] != null)) {
      const entry = { year: r.year, bimonth: bm };
      for (const f of fieldKeys) entry[f] = r[f] ?? null;
      map[key] = entry;
    }
  }
  return Object.values(map).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.bimonth - b.bimonth
  );
}

// Mesma paleta do SeasonalChart
function makeYearColor(accent) {
  const palette = [
    'oklch(0.75 0.15 200)','oklch(0.68 0.16 255)','oklch(0.74 0.15 310)',
    'oklch(0.78 0.17 35)', 'oklch(0.80 0.15 60)', 'oklch(0.72 0.16 0)',
    'oklch(0.76 0.13 170)',
  ];
  return (yr, selectedYears) => {
    const latest = Math.max(...selectedYears);
    const age = latest - yr;
    if (age === 0) return accent;
    if (age - 1 < palette.length) return palette[age - 1];
    const t = Math.min(1, (age - palette.length) / 4);
    return `oklch(${0.48 - t * 0.08} 0.01 260)`;
  };
}

// ── Seasonal (eixo bimestral, 1 empresa, anos sobrepostos) ────────────────────
function BimonthlySeasonalChart({ bmRows, fieldKey, accent, selectedYears, chartStyle = 'line', showStats, stats, height = 260, chartId = 'sea' }) {
  const W = 1000;
  const H = height;
  const padL = 58, padR = 48, padT = 16, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const seasonal = React.useMemo(() => {
    const s = {};
    for (const r of bmRows) {
      if (!s[r.year]) s[r.year] = {};
      s[r.year][r.bimonth] = r[fieldKey] ?? null;
    }
    return s;
  }, [bmRows, fieldKey]);

  const yearColor = React.useMemo(() => makeYearColor(accent), [accent]);
  const sortedYears  = [...selectedYears].sort((a, b) => a - b);
  const latestYear   = sortedYears[sortedYears.length - 1];

  const { displayYears, isLeaving } = useTrackedYears(selectedYears);
  const { shouldRender: showStatsRender, isLeaving: statsLeaving } = useFadeOut(showStats && chartStyle !== 'bars', 500);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = useFadeOut(chartStyle === 'area', 450);
  const { shouldRender: showBarsRender, isLeaving: barsLeaving } = useFadeOut(chartStyle === 'bars', 300);

  const [pinnedYear, setPinnedYear] = React.useState(null);
  const [hoverBm, setHoverBm] = React.useState(null);
  const [mouseX, setMouseX]   = React.useState(0);
  const [mouseY, setMouseY]   = React.useState(0);

  const allVals = React.useMemo(() => {
    const vals = bmRows.filter(r => selectedYears.includes(r.year)).map(r => r[fieldKey]).filter(v => v != null);
    if (showStats && stats) {
      stats.forEach(s => { if (s) { vals.push(s.min, s.max); } });
    }
    return vals;
  }, [bmRows, selectedYears, fieldKey, showStats, stats]);

  if (!allVals.length) {
    return <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>Sem dados</div>;
  }

  const lo = Math.min(...allVals, 0), hi = Math.max(...allVals, 0);
  const range = hi - lo || 0.1;
  const rawStep = (range * 1.25) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
  const norm = rawStep / mag;
  const nStep = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = nStep * mag;

  const yMin = Math.floor((lo - range * 0.1) / step) * step;
  const yMax = Math.ceil((hi + range * 0.15) / step) * step;

  const yTicks = [];
  for (let v = yMin; v <= yMax + step * 0.01; v += step)
    yTicks.push(Number(v.toPrecision(10)));

  const x   = bm => padL + ((bm - 1) / 5) * chartW;
  const y   = v  => padT + chartH - ((v - yMin) / (Math.max(0.01, yMax - yMin))) * chartH;
  const fmt = v  => v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(1).replace('.', ',') + '%';

  const seriesOpacity = yr => pinnedYear ? (yr === pinnedYear ? 1 : 0.1) : (yr === latestYear ? 1 : 0.80);
  const seriesWidth   = yr => pinnedYear ? (yr === pinnedYear ? 3.5 : 1.2) : (yr === latestYear ? 3 : 1.8);

  const buildPath = (yr) => {
    const pts = [];
    for (let bm = 1; bm <= 6; bm++) {
      const v = seasonal[yr]?.[bm];
      if (v != null) pts.push(`${pts.length === 0 ? 'M' : 'L'}${x(bm).toFixed(1)},${y(v).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const buildAreaPath = (yr) => {
    const pts = [];
    for (let bm = 1; bm <= 6; bm++) {
      const v = seasonal[yr]?.[bm];
      if (v != null) pts.push([x(bm), y(v)]);
    }
    if (!pts.length) return '';
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const y0 = y(0);
    return d + ` L${pts[pts.length-1][0].toFixed(1)},${y0.toFixed(1)} L${pts[0][0].toFixed(1)},${y0.toFixed(1)} Z`;
  };

  const barW = (chartW / 6) * 0.8 / Math.max(selectedYears.length, 1);
  const xBar = (bm, yrIdx) => x(bm) - (selectedYears.length * barW)/2 + yrIdx * barW + barW/2;

  const onMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const bm = Math.round(((px - padL) / chartW) * 5) + 1;
    if (bm >= 1 && bm <= 6) {
      setHoverBm(bm); setMouseX(prev => Math.abs(prev - px) < 16 ? prev : px); setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
    }
  };

  return (
    <div className="chart-wrap" style={{animation:'rx-fade-in 0.5s ease-out'}}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMouseMove} onMouseLeave={() => setHoverBm(null)}>
        <defs>
          <clipPath id={`bm-sea-clip-${chartId}`}>
            <rect x={padL} y={padT - 2} width={chartW} height={chartH + 6}/>
          </clipPath>
          {(() => {
            const range = yMax - yMin || 1;
            const zeroPct = ((yMax - 0) / range) * 100;
            return displayYears.map(yr => (
              <linearGradient key={`grad-${yr}`} id={`grad-bm-${chartId}-${yr}`} x1="0" x2="0" y1={y(yMax)} y2={y(yMin)} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={yearColor(yr, selectedYears)} stopOpacity="0.4"/>
                <stop offset={`${zeroPct}%`} stopColor={yearColor(yr, selectedYears)} stopOpacity="0"/>
                <stop offset="100%" stopColor={yearColor(yr, selectedYears)} stopOpacity="0.4"/>
              </linearGradient>
            ));
          })()}
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid-line"/>
            <text x={W - padR + 8} y={y(v)} className="tick-label" textAnchor="start" dominantBaseline="middle">{fmt(v)}</text>
          </g>
        ))}

        {/* Vertical Gridlines */}
        {[1,2,3,4,5,6].map(bm => (
          <line key={`vgrid-${bm}`} x1={x(bm)} x2={x(bm)} y1={padT} y2={padT + chartH} className="grid-line" style={{opacity:0.25}}/>
        ))}

        {/* Evident zero line */}
        {yMin <= 0 && yMax >= 0 && (
          <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)}
            stroke="var(--fg)" strokeWidth={1.5} strokeOpacity={0.6}/>
        )}

        {/* Historical band */}
        {showStatsRender && stats && chartStyle !== 'bars' && (
          <g clipPath={`url(#bm-sea-clip-${chartId})`}>
            <path
              d={(() => {
                const top = stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i+1)},${y(s.max)}` : '').join(' ');
                const bot = [...stats].map((s, i) => s ? `L${x(i+1)},${y(s.min)}` : '').reverse().join(' ');
                return top + ' ' + bot + ' Z';
              })()}
              fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.05}}
            />
            <path
              d={(() => {
                const top = stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i+1)},${y(s.p75)}` : '').join(' ');
                const bot = [...stats].map((s, i) => s ? `L${x(i+1)},${y(s.p25)}` : '').reverse().join(' ');
                return top + ' ' + bot + ' Z';
              })()}
              fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.08}}
            />
            <path
              d={stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i+1)},${y(s.mean)}` : '').join(' ')}
              stroke="var(--fg)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" fill="none"
              className={`rx-stat-mean${statsLeaving ? ' rx-stat-leaving' : ''}`}
            />
          </g>
        )}

        {/* X axis labels */}
        {BM_LABELS.map((label, i) => (
          <text key={i} x={x(i + 1)} y={H - padB + 20} className="tick-label" textAnchor="middle">{label}</text>
        ))}

        {/* Year series — bars */}
        {showBarsRender && (
          <g clipPath={`url(#bm-sea-clip-${chartId})`}>
            {displayYears.map((yr, idx) => {
              const leaving = isLeaving(yr);
              return (
                <g key={yr}>
                  {[1,2,3,4,5,6].map(bm => {
                    const v = seasonal[yr]?.[bm];
                    if (v == null) return null;
                    const y0 = y(0);
                    const yV = y(v);
                    return (
                      <rect key={bm}
                        x={xBar(bm, idx) - barW/2}
                        y={Math.min(y0, yV)}
                        width={barW - 1}
                        height={Math.max(1, Math.abs(y0 - yV))}
                        fill={yearColor(yr, selectedYears)}
                        opacity={seriesOpacity(yr)}
                        rx={1}
                        className={`rx-bar ${leaving || barsLeaving ? 'rx-bar-leaving' : ''}`}
                        style={{
                          cursor: 'pointer',
                          transformOrigin: `0px ${y0.toFixed(1)}px`,
                          animationDelay: `${bm * 0.05}s`
                        }}
                        onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        )}

        {/* Year series — lines + area */}
        {chartStyle !== 'bars' && (
          <g clipPath={`url(#bm-sea-clip-${chartId})`}>
            {displayYears.map(yr => {
              const color = yearColor(yr, selectedYears);
              const values = [1,2,3,4,5,6].map(bm => seasonal[yr]?.[bm]);
              const bmsWithData = [1,2,3,4,5,6].filter(bm => seasonal[yr]?.[bm] != null);
              if (bmsWithData.length === 0) return null;
              if (bmsWithData.length === 1) {
                const bm = bmsWithData[0];
                const v = seasonal[yr]?.[bm];
                const color = yearColor(yr, selectedYears);
                return (
                  <circle key={yr} cx={x(bm)} cy={y(v)} r={4}
                    fill={color} opacity={seriesOpacity(yr)}
                    clipPath={`url(#bm-sea-clip-${chartId})`}/>
                );
              }
              const path = buildPath(yr);
              const leaving = isLeaving(yr);
              const isPinned = yr === pinnedYear;
              return (
                <g key={yr}>
                  {(showAreaRender || isPinned) && !leaving && (
                    <path d={buildAreaPath(yr)}
                      fill={`url(#grad-bm-${chartId}-${yr})`}
                      style={{
                        '--rx-area-op': seriesOpacity(yr) * 0.7,
                        pointerEvents: 'none'
                      }}
                      className={`rx-area ${areaLeaving && !isPinned ? 'rx-area-leaving' : ''}`}/>
                  )}
                  <path d={path} fill="none" stroke={color}
                    strokeWidth={seriesWidth(yr)} strokeLinejoin="round" strokeLinecap="round"
                    opacity={seriesOpacity(yr)} className={leaving ? 'rx-leaving' : ''}/>
                  <path d={path} fill="none" stroke="transparent" strokeWidth={12}
                    style={{cursor:'pointer'}}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}/>
                </g>
              );
            })}
          </g>
        )}

        {/* Data labels for pinned year */}
        {pinnedYear && (
          <g>
            {[1,2,3,4,5,6].map(bm => {
              const v = seasonal[pinnedYear]?.[bm];
              if (v == null) return null;
              const color = yearColor(pinnedYear, selectedYears);
              const cx = x(bm), cy = y(v);
              const above = cy - padT > 22;
              const nearLeft = cx < padL + 28;
              const anchor = nearLeft ? 'start' : 'middle';
              const lx = nearLeft ? padL + 4 : cx;
              return (
                <g key={bm}>
                  <circle cx={cx} cy={cy} r={3.5} fill={color} opacity={0.9}/>
                  <text x={lx} y={above ? cy - 8 : cy + 14}
                    textAnchor={anchor} dominantBaseline="auto"
                    style={{fontFamily:'var(--font-mono)', fontSize:11, fill:color, fontWeight:500, letterSpacing:'0.02em'}}>
                    {fmt(v)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Hover crosshair + dots */}
        {hoverBm != null && (
          <g>
            {chartStyle !== 'bars' && (
              <line x1={x(hoverBm)} x2={x(hoverBm)} y1={padT} y2={padT + chartH}
                stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            )}
            {chartStyle === 'bars' ? (
              sortedYears.map((yr, idx) => {
                const v = seasonal[yr]?.[hoverBm];
                if (v == null) return null;
                return (
                  <rect key={yr}
                    x={xBar(hoverBm, idx) - barW/2}
                    y={Math.min(y(0), y(v))} width={barW - 1} height={Math.abs(y(0) - y(v))}
                    fill="none" stroke={yearColor(yr, selectedYears)} strokeWidth={2} rx={1}
                    style={{cursor: 'pointer'}}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                  />
                );
              })
            ) : (
              displayYears.map(yr => {
                const v = seasonal[yr]?.[hoverBm];
                if (v == null) return null;
                const isPinned = yr === pinnedYear;
                const isCurrent = yr === latestYear;
                return (
                  <circle key={yr} cx={x(hoverBm)} cy={y(v)}
                    r={isPinned ? 6 : isCurrent ? 5 : 4}
                    fill="var(--bg)" stroke={yearColor(yr, selectedYears)}
                    strokeWidth={isPinned ? 3 : isCurrent ? 2.5 : 1.5}
                    className="rx-no-anim"
                    style={{cursor:'pointer'}}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}/>
                );
              })
            )}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} className="axis-line"/>
      </svg>

      {/* Tooltip */}
      {hoverBm != null && (
        <div className="hover-card" style={{
          left:`${(mouseX / W * 100).toFixed(1)}%`,
          top: Math.max(10, Math.min(H - 120, mouseY - 40)),
          transform: mouseX > W * 0.75 ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
        }}>
          <div className="hover-month">{BM_LABELS[hoverBm - 1]}</div>
          <div className="hover-rows">
            {[...displayYears].sort((a, b) => b - a).map(yr => {
              const v = seasonal[yr]?.[hoverBm];
              return (
                <div key={yr} className="hover-row">
                  <span className="hover-year" style={{color: yearColor(yr, selectedYears)}}>{yr}</span>
                  <span className="hover-val">{fmt(v)}</span>
                </div>
              );
            })}
            {showStats && stats && stats[hoverBm - 1] && (
              <div className="hover-row hover-stat">
                <span className="hover-year">média {stats[hoverBm - 1].n}a</span>
                <span className="hover-val">{fmt(stats[hoverBm - 1].mean)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legenda de anos */}
      <div className="ciclo-legend">
        {[...selectedYears].sort((a, b) => b - a).map(yr => (
          <span key={yr} className="legend-year"
            style={{
              userSelect:'none', padding:'2px 6px', cursor:'pointer',
              opacity: pinnedYear && pinnedYear !== yr ? 0.3 : 1,
              outline: pinnedYear === yr ? `1px solid ${yearColor(yr, selectedYears)}` : 'none',
              borderRadius: 4,
            }}
            onClick={() => setPinnedYear(p => p === yr ? null : yr)}>
            <span className="legend-line" style={{background: yearColor(yr, selectedYears)}}/>
            {yr}
          </span>
        ))}
        {showStats && chartStyle !== 'bars' && (<>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{display:'inline-block', width:16, height:2, borderTop:'2px dashed var(--fg)', opacity:0.5, verticalAlign:'middle', marginRight:2}}/>
            Média histórica
          </span>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{display:'inline-block', width:16, height:8, background:'var(--fg)', opacity:0.08, verticalAlign:'middle', marginRight:2, borderRadius:1}}/>
            P25–P75
          </span>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{display:'inline-block', width:16, height:8, background:'var(--fg)', opacity:0.05, verticalAlign:'middle', marginRight:2, borderRadius:1}}/>
            Mín–Máx
          </span>
        </>)}
      </div>
    </div>
  );
}

// ── Continuous (3 linhas, eixo temporal bimestral) ────────────────────────────
function BimonthlyContChart({ bmRows, fields, rangeYears, chartStyle = 'line', height = 260, prevFirstOrd = null, chartId = 'cont' }) {
  const svgRef    = React.useRef(null);
  const [W, setW] = React.useState(1000);
  const [hovered, setHovered]             = React.useState(null);
  const [pinnedCompany, setPinnedCompany] = React.useState(null);

  const { shouldRender: showAreaRender,  isLeaving: areaLeaving   } = useFadeOut(chartStyle === 'area', 450);
  const { shouldRender: showLabels,      isLeaving: labelsLeaving  } = useFadeOut(!!pinnedCompany, 150);
  const lastPinnedRef = React.useRef(pinnedCompany);
  if (pinnedCompany) lastPinnedRef.current = pinnedCompany;

  // useLayoutEffect: mede a largura real antes do primeiro paint (elimina o flash inicial)
  React.useLayoutEffect(() => {
    if (!svgRef.current) return;
    const initial = Math.floor(svgRef.current.getBoundingClientRect().width);
    if (initial > 0) setW(initial);

    const obs = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      if (w > 0) setW(prev => Math.abs(w - prev) > 2 ? w : prev);
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

  const filtered = React.useMemo(() => {
    if (!bmRows.length || rangeYears === 'all') return bmRows;
    const last = bmRows[bmRows.length - 1];
    const cutOrd = last.year * 6 + last.bimonth - 1 - rangeYears * 6;
    return bmRows.filter(r => r.year * 6 + r.bimonth - 1 > cutOrd);
  }, [bmRows, rangeYears]);

  // Dimensões e padding proporcionais ao W (igual ao sazonal com viewBox 1000×height)
  const sc   = W / 1000;
  const H    = Math.round(height * sc);
  const padL = Math.round(58 * sc), padR = Math.round(48 * sc);
  const padT = Math.round(16 * sc), padB = Math.round(40 * sc);
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = React.useMemo(() =>
    filtered.flatMap(r => fields.map(f => r[f.key]).filter(v => v != null)),
    [filtered, fields]
  );
  if (!allVals.length) {
    return <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>Sem dados</div>;
  }

  const lo = Math.min(...allVals, 0), hi = Math.max(...allVals, 0);
  const range = hi - lo || 0.1;
  const rawStep = (range * 1.1) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
  const norm = rawStep / mag;
  const nStep = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = nStep * mag;

  const yMin = Math.floor((lo - range * 0.05) / step) * step;
  const yMax = Math.ceil((hi + range * 0.08) / step) * step;

  const firstOrd = filtered[0].year * 6 + filtered[0].bimonth - 1;
  const lastOrd  = filtered[filtered.length - 1].year * 6 + filtered[filtered.length - 1].bimonth - 1;
  const totalBms = lastOrd - firstOrd || 1;

  const xOf    = r   => padL + ((r.year * 6 + r.bimonth - 1 - firstOrd) / totalBms) * chartW;
  const xOfOrd = ord => padL + ((ord - firstOrd) / totalBms) * chartW;
  const yOf    = v   => padT + chartH - ((v - yMin) / (Math.max(0.01, yMax - yMin))) * chartH;
  const fmt    = v   => v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(1).replace('.', ',') + '%';

  const buildPath = (key) => {
    let path = '', inPath = false;
    for (const r of filtered) {
      const v = r[key];
      if (v != null) {
        const pt = `${xOf(r).toFixed(1)},${yOf(v).toFixed(1)}`;
        path += inPath ? `L${pt}` : `M${pt}`; inPath = true;
      } else { inPath = false; }
    }
    return path;
  };

  const buildAreaPath = (key) => {
    const pts = [];
    for (const r of filtered) {
      const v = r[key];
      if (v != null) pts.push([xOf(r), yOf(v)]);
    }
    if (!pts.length) return '';
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const y0 = yOf(0);
    return d + ` L${pts[pts.length-1][0].toFixed(1)},${y0.toFixed(1)} L${pts[0][0].toFixed(1)},${y0.toFixed(1)} Z`;
  };

  const lineOpacity = key => pinnedCompany ? (key === pinnedCompany ? 1 : 0.15) : 1;
  const lineWidth   = key => pinnedCompany === key ? 3.5 : 2.5;

  const rangeYrsNum = totalBms / 6;
  const stepBms = rangeYrsNum <= 6 ? 3 : 6;
  const xTicks  = [];
  const tickStart = Math.ceil(firstOrd / stepBms) * stepBms;
  for (let ord = tickStart; ord <= lastOrd; ord += stepBms) {
    const yr = Math.floor(ord / 6);
    const bm = (ord % 6) + 1;
    xTicks.push({ x: xOfOrd(ord), label: stepBms === 3 ? `${BM_SHORT[bm - 1]}/${String(yr).slice(-2)}` : String(yr) });
  }

  const yTicks = [];
  for (let v = yMin; v <= yMax + step * 0.01; v += step)
    yTicks.push(Number(v.toPrecision(10)));

  const onMouseMove = React.useCallback((e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px   = (e.clientX - rect.left - padL) / chartW;
    const ord  = firstOrd + px * totalBms;
    let best = null, bestD = Infinity;
    for (const r of filtered) {
      const d = Math.abs(r.year * 6 + r.bimonth - 1 - ord);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) {
      const my = e.clientY - rect.top;
      setHovered(prev => prev && prev.row === best && Math.abs(prev.mouseY - my) < 16
        ? prev
        : { x: xOf(best), row: best, mouseY: my });
    }
  }, [filtered, firstOrd, totalBms, chartW]);

  return (
    <div className="chart-wrap" style={{animation:'rx-fade-in 0.5s ease-out'}}>
      <svg ref={svgRef} width="100%" height={H} style={{display:'block', overflow:'visible'}}
        onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)}>
        <defs>
          <clipPath id={`bm-cont-clip-${chartId}`}>
            <rect x={padL} y={padT - 2} width={chartW} height={chartH + 6}/>
          </clipPath>
          {(() => {
            const range = yMax - yMin || 1;
            const zeroPct = ((yMax - 0) / range) * 100;
            return fields.map(f => (
              <linearGradient key={`grad-cont-${chartId}-${f.key}`} id={`grad-cont-${chartId}-${f.key}`}
                x1="0" x2="0" y1={yOf(yMax)} y2={yOf(yMin)} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={f.color} stopOpacity="0.4"/>
                <stop offset={`${zeroPct}%`} stopColor={f.color} stopOpacity="0"/>
                <stop offset="100%" stopColor={f.color} stopOpacity="0.4"/>
              </linearGradient>
            ));
          })()}
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} className="grid-line"/>
            <text x={W - padR + 8} y={yOf(v)} textAnchor="start" dominantBaseline="middle"
              fontSize={10 * W / 1000} fill="var(--fg-dim)"
              fontFamily="var(--font-mono)" letterSpacing="0.02em"
              style={{userSelect:'none'}}>{fmt(v)}</text>
          </g>
        ))}

        {/* Evident zero line */}
        {yMin <= 0 && yMax >= 0 && (
          <line x1={padL} x2={W - padR} y1={yOf(0)} y2={yOf(0)}
            stroke="var(--fg)" strokeWidth={2} strokeOpacity={0.8}
            style={{filter:'drop-shadow(0 0 2px var(--fg))'}}/>
        )}

        {/* X Ticks + Labels */}
        {xTicks.map((t, i) => (
          <g key={`xtick-${i}`}>
            <line x1={t.x} x2={t.x} y1={padT + chartH} y2={padT + chartH + 5} stroke="var(--border-strong)" strokeWidth={1.5}/>
            <text x={t.x} y={padT + chartH + 20} textAnchor="middle"
              fontSize={10 * W / 1000} fill="var(--fg-dim)"
              fontFamily="var(--font-mono)" letterSpacing="0.02em"
              style={{userSelect:'none'}}>{t.label}</text>
          </g>
        ))}

        {/* Vertical Gridlines */}
        {xTicks.map((t, i) => (
          <line key={`vgrid-${i}`} x1={t.x} x2={t.x} y1={padT} y2={padT + chartH} className="grid-line" style={{opacity:0.15}}/>
        ))}

        {/* Linhas + hitbox clicável */}
        <g clipPath={`url(#bm-cont-clip-${chartId})`}>
          {(() => {
            // Quando expandindo: só a porção nova (à esquerda) anima; o restante já aparece visível
            const hasPartial = prevFirstOrd != null && prevFirstOrd > firstOrd;
            const clipStartPct = hasPartial
              ? ((padL + ((prevFirstOrd - firstOrd) / totalBms) * chartW) / W * 100).toFixed(1) + '%'
              : null;
            const lineAnim = hasPartial
              ? 'bm-line-draw-partial 1.2s cubic-bezier(0.4, 0, 0.2, 1) backwards'
              : 'bm-line-draw 1.2s cubic-bezier(0.4, 0, 0.2, 1) backwards';

            return fields.map(f => {
              const path = buildPath(f.key);
              if (!path) return null;
              const isPinned = pinnedCompany === f.key;
              return (
                <g key={f.key}>
                  {(showAreaRender || isPinned) && (
                    <path d={buildAreaPath(f.key)} fill={`url(#grad-cont-${chartId}-${f.key})`}
                      style={{ '--bm-area-op': lineOpacity(f.key) * 0.7, pointerEvents: 'none' }}
                      className={`bm-area ${areaLeaving && !isPinned ? 'bm-area-leaving' : ''}`}/>
                  )}
                  <path d={path} fill="none" stroke={f.color}
                    strokeWidth={lineWidth(f.key)} strokeLinejoin="round"
                    opacity={lineOpacity(f.key)}
                    style={{
                      '--bm-clip-left': clipStartPct ?? '100%',
                      animation: lineAnim,
                      transition: 'opacity 0.3s ease',
                    }}/>
                  <path d={path} fill="none" stroke="transparent" strokeWidth={12}
                    style={{cursor:'pointer'}}
                    onClick={() => setPinnedCompany(p => p === f.key ? null : f.key)}/>
                </g>
              );
            });
          })()}
        </g>

        {/* Data labels for pinned company — todos os pontos com espaçamento mínimo */}
        {showLabels && (
          <g style={{animation: labelsLeaving ? 'rx-fade-in 0.15s ease-out reverse forwards' : 'rx-fade-in 0.15s ease-out'}}>
            {(() => {
              const f = fields.find(ff => ff.key === lastPinnedRef.current);
              const MIN_GAP = 30; // px mínimo entre labels para não sobrepor
              let lastX = -Infinity;
              return filtered.map((r, i) => {
                const v = r[f.key];
                if (v == null) return null;
                const cx = xOf(r), cy = yOf(v);
                const isLast = i === filtered.length - 1;
                if (!isLast && cx - lastX < MIN_GAP) return null;
                lastX = cx;
                const above = cy - padT > 22;
                const nearLeft  = cx < padL + 20;
                const anchor = nearLeft ? 'start' : 'middle';
                const lx = nearLeft ? padL + 2 : cx;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={3.5} fill={f.color} opacity={0.9}/>
                    <text x={lx} y={above ? cy - 8 : cy + 14} textAnchor={anchor}
                      style={{fontFamily:'var(--font-mono)', fontSize:10, fill:f.color, fontWeight:500, letterSpacing:'0.02em'}}>
                      {fmt(v)}
                    </text>
                  </g>
                );
              });
            })()}
          </g>
        )}

        {/* Hover crosshair + dots */}
        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            {fields.map(f => {
              const v = hovered.row[f.key];
              if (v == null) return null;
              const isPinned = pinnedCompany === f.key;
              const dimmed   = pinnedCompany && !isPinned;
              return (
                <circle key={f.key} cx={hovered.x} cy={yOf(v)}
                  r={isPinned ? 6 : dimmed ? 3 : 5}
                  fill="var(--bg-panel)" stroke={f.color}
                  strokeWidth={isPinned ? 3 : dimmed ? 1.2 : 2.5}
                  className="rx-no-anim"
                  style={{cursor:'pointer'}}
                  onClick={() => setPinnedCompany(p => p === f.key ? null : f.key)}/>
              );
            })}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} className="axis-line"/>
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const r = hovered.row;
        const isRight = hovered.x > W * 0.75;
        const visFields = pinnedCompany ? fields.filter(f => f.key === pinnedCompany) : fields;
        return (
          <div className="hover-card" style={{
            left:`${(hovered.x / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 120, hovered.mouseY - 40)),
            transform: isRight ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">{BM_LABELS[r.bimonth - 1]}/{r.year}</div>
            <div className="hover-rows">
              {visFields.map(f => (
                <div key={f.key} className="hover-row">
                  <span className="hover-year" style={{color: f.color}}>{f.label}</span>
                  <span className="hover-val">{fmt(r[f.key])}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Legenda — clicável para pinnar empresa */}
      <div className="ciclo-legend">
        {fields.map(f => (
          <span key={f.key} className="legend-year"
            style={{
              userSelect:'none', padding:'2px 6px', cursor:'pointer',
              opacity: pinnedCompany && pinnedCompany !== f.key ? 0.3 : 1,
              outline: pinnedCompany === f.key ? `1px solid ${f.color}` : 'none',
              borderRadius: 4,
            }}
            onClick={() => setPinnedCompany(p => p === f.key ? null : f.key)}>
            <span className="legend-line" style={{background: f.color}}/>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── BimonthlyCard ─────────────────────────────────────────────────────────────
function BimonthlyCard({ cardId, title, sub, data, dataset, fields, accent, height = 260, footerNote, footerNoteBase100, continuousOnly = false, base100Fields = null }) {
  const initialMode = (continuousOnly || base100Fields) ? 'continuous' : 'seasonal';
  const [mode, setMode]             = React.useState(initialMode);
  const [range, setRange]           = React.useState('5');
  const [prevFirstOrd, setPrevFirstOrd] = React.useState(null);
  const [selYears, setSelYears]     = React.useState(null);
  const [activeFieldIdx, setActiveFieldIdx] = React.useState(0);
  const [chartStyle, setChartStyle]     = React.useState('line');
  const [showStats, setShowStats]       = React.useState(false);
  const [pinnedBase100, setPinnedBase100] = React.useState(null);

  const allRows   = data[dataset] || [];
  const fieldKeys = fields.map(f => f.key);
  const bmRows    = React.useMemo(() => toBimonthly(allRows, fieldKeys), [allRows, fieldKeys.join(',')]);
  const years     = React.useMemo(() => [...new Set(bmRows.map(r => r.year))].sort((a, b) => a - b), [bmRows]);

  const toNum = v => v === 'all' ? 999 : parseInt(v);
  const changeRange = React.useCallback((val) => {
    const oldNum = toNum(range);
    const newNum = toNum(val);
    if (newNum > oldNum && bmRows.length) {
      // Expanding — guarda o firstOrd atual para animar só a porção nova
      const last  = bmRows[bmRows.length - 1];
      const cutOrd = oldNum === 999 ? -Infinity : last.year * 6 + last.bimonth - 1 - oldNum * 6;
      const cur   = bmRows.filter(r => r.year * 6 + r.bimonth - 1 > cutOrd);
      setPrevFirstOrd(cur.length ? cur[0].year * 6 + cur[0].bimonth - 1 : null);
    } else {
      setPrevFirstOrd(null); // shrinking → redesenha tudo normalmente
    }
    setRange(val);
  }, [range, bmRows]);
  const latest    = years[years.length - 1];

  const PRESETS = [
    { label:'3a',    yrs: [latest, latest-1, latest-2] },
    { label:'5a',    yrs: [latest, latest-1, latest-2, latest-3, latest-4] },
    { label:'10a',   yrs: Array.from({length:10}, (_, i) => latest - i) },
    { label:'Todos', yrs: years },
  ];
  const defaultYears  = React.useMemo(
    () => [latest, latest-1, latest-2, latest-3, latest-4].filter(y => years.includes(y)),
    [latest, years.join(',')]
  );
  const activeYears   = selYears ?? defaultYears;
  const activePreset  = PRESETS.find(p => {
    const v = p.yrs.filter(y => years.includes(y));
    return v.length === activeYears.length && v.every(y => activeYears.includes(y));
  });
  const rangeNum = range === 'all' ? 'all' : parseInt(range);

  const base100Rows = React.useMemo(() => {
    if (!base100Fields) return [];
    const allRows = data[dataset] || [];
    const valid = allRows.filter(r => base100Fields.some(f => r[f.key] != null));
    if (!valid.length || rangeNum === 'all') return valid;
    const last = valid[valid.length - 1];
    const cutOrd = last.year * 12 + last.month - 1 - rangeNum * 12;
    return valid.filter(r => r.year * 12 + r.month - 1 > cutOrd);
  }, [base100Fields, data, dataset, rangeNum]);

  const stats = React.useMemo(() => {
    const latest = years[years.length - 1];
    return buildBimonthlyStats(bmRows, fields[activeFieldIdx].key, Math.max(2015, latest - 10), latest - 1);
  }, [bmRows, activeFieldIdx, fields, years]);

  if (!bmRows.length) {
    return (
      <section className="card card-full" data-card-id={cardId}>
        <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>Sem dados</div>
      </section>
    );
  }

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
        </div>

        <div className="card-controls">
          {/* Row 1: Periods (if seasonal) or Range (if continuous) + Mode */}
          <div className="card-ctrl-row">
            {mode === 'seasonal' ? (
              <div className="year-seg">
                {PRESETS.map(p => (
                  <button key={p.label}
                    className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`}
                    onClick={() => setSelYears(p.yrs.filter(y => years.includes(y)))}>
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="year-seg">
                {[['3a','3'],['5a','5'],['10a','10'],['Todos','all']].map(([label, val]) => (
                  <button key={label}
                    className={`year-seg-btn ${range === val ? 'is-on' : ''}`}
                    onClick={() => changeRange(val)}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {!continuousOnly && (
              <div className="seg" style={{marginLeft: 16}}>
                {base100Fields ? (
                  <>
                    <button className={`seg-btn ${mode === 'continuous' ? 'is-on' : ''}`} onClick={() => setMode('continuous')}>Contínuo</button>
                    <button className={`seg-btn ${mode === 'base100'    ? 'is-on' : ''}`} onClick={() => setMode('base100')}>Base 100</button>
                  </>
                ) : (
                  <>
                    <button className={`seg-btn ${mode === 'seasonal'   ? 'is-on' : ''}`} onClick={() => setMode('seasonal')}>Sazonal</button>
                    <button className={`seg-btn ${mode === 'continuous' ? 'is-on' : ''}`} onClick={() => setMode('continuous')}>Contínuo</button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Stats (seasonal) + Style + Fields (seasonal) */}
          <div className="card-ctrl-row">
            {mode === 'seasonal' && (
              <button
                className={`ctrl-btn ${showStats && chartStyle !== 'bars' ? 'is-on' : ''} ${chartStyle === 'bars' ? 'is-disabled' : ''}`}
                onClick={() => chartStyle !== 'bars' && setShowStats(v => !v)}>
                MÉDIA + FAIXA
              </button>
            )}

            <div className="seg" style={{marginLeft: 16}}>
              {[['line','Linha'],['area','Área'], mode === 'seasonal' && ['bars','Barras']].filter(Boolean).map(([v, l]) => (
                <button key={v} className={`seg-btn ${chartStyle===v?'is-on':''}`} onClick={() => setChartStyle(v)}>{l}</button>
              ))}
            </div>

            {mode === 'seasonal' && (
              <div className="seg" style={{marginLeft: 16}}>
                {fields.map((f, i) => (
                  <button key={f.key}
                    className={`seg-btn ${activeFieldIdx === i ? 'is-on' : ''}`}
                    onClick={() => setActiveFieldIdx(i)}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'seasonal' ? (
        <BimonthlySeasonalChart
          key={fields[activeFieldIdx].key}
          bmRows={bmRows}
          fieldKey={fields[activeFieldIdx].key}
          accent={accent}
          selectedYears={activeYears}
          chartStyle={chartStyle}
          showStats={showStats}
          stats={stats}
          height={height}
          chartId={`${cardId}-sea`}
        />
      ) : mode === 'base100' ? (
        <MultiContinuousChart
          key={`base100-${range}`}
          rows={base100Rows}
          fields={base100Fields}
          unit="Base 100" decimals={1}
          height={height}
          chartId={`${cardId}-b100`}
          chartStyle={chartStyle}
          pinnedSeries={pinnedBase100}
          setPinnedSeries={setPinnedBase100}
        />
      ) : (
        <BimonthlyContChart
          key={range}
          bmRows={bmRows}
          fields={fields}
          rangeYears={rangeNum}
          chartStyle={chartStyle}
          prevFirstOrd={prevFirstOrd}
          height={height}
          chartId={`${cardId}-cont`}
        />
      )}
      {mode === 'base100' && base100Fields && (
        <div className="ciclo-legend" style={{marginTop: 8}}>
          {base100Fields.map(f => (
            <span key={f.key} className="legend-year"
              style={{
                userSelect:'none', padding:'2px 6px', cursor:'pointer',
                opacity: pinnedBase100 && pinnedBase100 !== f.key ? 0.3 : 1,
                outline: pinnedBase100 === f.key ? `1px solid ${f.color}` : 'none',
                borderRadius: 4,
              }}
              onClick={() => setPinnedBase100(p => p === f.key ? null : f.key)}>
              <span className="legend-line" style={{background: f.color}}/>
              {f.label}
            </span>
          ))}
        </div>
      )}
      {footerNote && (
        <div style={{padding:'6px 0 4px', fontSize:11, color:'var(--fg-dim)', lineHeight:1.6}}>
          {footerNote}
        </div>
      )}
      {footerNoteBase100 && mode === 'base100' && (
        <div style={{padding:'2px 0 4px', fontSize:11, color:'var(--fg-dim)', lineHeight:1.6}}>
          {footerNoteBase100}
        </div>
      )}
    </section>
  );
}

export { BimonthlyCard };
