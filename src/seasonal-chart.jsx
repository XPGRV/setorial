import React from 'react'

// Seasonal chart — futuristic dark style: one current year line, others faded, area fill under current

const SeasonalChart = ({
  data, dataset, field, selectedYears,
  showStats, showEvents, events,
  chartStyle, accent, unit, decimals, big,
  height = 260,
  hideAvg = false,
}) => {
  const W = 1000;
  const H = height;
  const padL = 56, padR = 64, padT = 14, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const years = React.useMemo(() => {
    const ys = new Set();
    data[dataset].forEach(r => { if (r[field] != null) ys.add(r.year); });
    return [...ys].sort((a,b) => a-b);
  }, [data, dataset, field]);

  const seasonal = React.useMemo(
    () => window.buildSeasonal(data, dataset, field, years),
    [data, dataset, field, years.join(',')]
  );

  const statsRange = React.useMemo(() => {
    const latest = years[years.length-1];
    return { from: Math.max(2015, latest-10), to: latest-1 };
  }, [years]);

  const stats = React.useMemo(
    () => window.buildStats(data, dataset, field, statsRange.from, statsRange.to),
    [data, dataset, field, statsRange.from, statsRange.to]
  );

  const { yMin, yMax } = React.useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const y of selectedYears) {
      for (const v of (seasonal[y] || [])) {
        if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    }
    if (showStats && !hideAvg && stats) {
      for (const s of stats) { if (!s) continue; lo = Math.min(lo, s.min); hi = Math.max(hi, s.max); }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.1 || 1;
    return { yMin: lo - pad*0.3, yMax: hi + pad*0.5 };
  }, [seasonal, selectedYears.join(','), stats, showStats, hideAvg]);

  const x = (m) => padL + (m / 11) * chartW;
  const y = (v) => padT + (1 - (v - yMin)/(yMax - yMin)) * chartH;

  function accentHue(c) {
    const m = /oklch\([^)]+\)/.exec(c);
    if (!m) return 160;
    const parts = m[0].match(/[\d.]+/g);
    return parts ? parseFloat(parts[2]) : 160;
  }
  const hue = accentHue(accent);

  const yearColor = (yr) => {
    const latest = Math.max(...selectedYears);
    const age = latest - yr;
    if (age === 0) return accent;
    // Hues spread across the wheel for maximum distinction
    const palette = [
      `oklch(0.75 0.15 200)`,  // age 1 — teal
      `oklch(0.68 0.16 255)`,  // age 2 — azul
      `oklch(0.74 0.15 310)`,  // age 3 — roxo
      `oklch(0.78 0.17 35)`,   // age 4 — laranja
      `oklch(0.80 0.15 60)`,   // age 5 — amarelo
      `oklch(0.72 0.16 0)`,    // age 6 — vermelho
      `oklch(0.76 0.13 170)`,  // age 7 — verde-água
    ];
    if (age - 1 < palette.length) return palette[age - 1];
    // Mais antigos: cinza muted
    const t = Math.min(1, (age - palette.length) / 4);
    return `oklch(${0.48 - t * 0.08} 0.01 260)`;
  };

  const ticks = React.useMemo(() => {
    const range = yMax - yMin;
    const rawStep = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / mag;
    const niceStep = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
    const step = niceStep * mag;
    const start = Math.ceil(yMin / step) * step;
    const out = [];
    for (let v = start; v <= yMax + step * 0.01; v += step) out.push(parseFloat(v.toPrecision(10)));
    return out;
  }, [yMin, yMax]);

  const buildPath = (values) => {
    const pts = [];
    values.forEach((v, i) => { if (v != null) pts.push([x(i), y(v)]); });
    if (!pts.length) return '';
    return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  };

  const buildAreaPath = (values) => {
    const pts = [];
    values.forEach((v, i) => { if (v != null) pts.push([x(i), y(v)]); });
    if (!pts.length) return '';
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return d + ` L${pts[pts.length-1][0].toFixed(1)},${y(yMin).toFixed(1)} L${pts[0][0].toFixed(1)},${y(yMin).toFixed(1)} Z`;
  };

  const slotW = chartW / 12;
  const barW = slotW * 0.85 / Math.max(selectedYears.length, 1);
  const xBar = (mi) => padL + (mi + 0.5) * slotW;

  const [hover, setHover] = React.useState(null);
  const [pinnedYear, setPinnedYear] = React.useState(null);
  const [dotHoverYear, setDotHoverYear] = React.useState(null);
  const { shouldRender: showLabels, isLeaving: labelsLeaving } = window.useFadeOut(!!pinnedYear, 150);
  const lastPinnedRef = React.useRef(pinnedYear);
  if (pinnedYear) lastPinnedRef.current = pinnedYear;

  React.useEffect(() => { setPinnedYear(null); }, [selectedYears]);

  const seriesOpacity = (yr) => {
    if (!pinnedYear) return yr === latestYear ? 1 : 0.8;
    return yr === pinnedYear ? 1 : 0.1;
  };
  const seriesWidth = (yr) => {
    if (pinnedYear) return yr === pinnedYear ? 2.5 : 1;
    return yr === latestYear ? 2 : 1.25;
  };

  const [mouseY, setMouseY] = React.useState(0);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const pos = Math.round(((px - padL) / chartW) * 11);
    setHover(Math.max(0, Math.min(11, pos)));
    setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };

  const EVENT_COLOR = 'oklch(0.85 0.18 80)'; // amber — distinct from any year series color
  const gradId = `grad-${dataset}-${field}`.replace(/[^a-z0-9-]/gi, '');
  const fmtOpts = { decimals, big };

  const sortedAsc = [...selectedYears].sort((a,b) => a-b);
  const latestYear = Math.max(...selectedYears);
  // Anos visualmente exibidos (inclui anos saindo para animação de undraw)
  const { displayYears, isLeaving } = window.useTrackedYears(selectedYears);
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = window.useFadeOut(showEvents, 400);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = window.useFadeOut(chartStyle === 'area', 400);
  const { shouldRender: showBarsRender, isLeaving: barsLeaving } = window.useFadeOut(chartStyle === 'bars', 280);
  const { shouldRender: showStatsRender, isLeaving: statsLeaving } = window.useFadeOut(showStats && !hideAvg, 500);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {sortedAsc.map(yr => (
            <linearGradient key={yr} id={`${gradId}-${yr}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={yearColor(yr)} stopOpacity="0.28"/>
              <stop offset="100%" stopColor={yearColor(yr)} stopOpacity="0"/>
            </linearGradient>
          ))}
          <clipPath id={`clip-${gradId}`}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
        </defs>

        {/* Grid */}
        <g className="grid">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid-line"/>
              <text x={W - padR + 6} y={y(t)} className="tick-label" textAnchor="start" dominantBaseline="middle">
                {window.fmtCompact(t, fmtOpts)}
              </text>
            </g>
          ))}
        </g>

        {/* X ticks */}
        <g className="x-ticks">
          {window.MONTHS_PT.map((m, i) => (
            <text key={m} x={chartStyle === 'bars' ? xBar(i) : x(i)} y={H - padB + 18} className="tick-label" textAnchor="middle">{m}</text>
          ))}
        </g>

        {/* Historical band */}
        {showStatsRender && stats && chartStyle !== 'bars' && (
          <g clipPath={`url(#clip-${gradId})`}>
            <path
              d={(() => {
                const top = stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.max)}` : '').join(' ');
                const bot = [...stats].map((s, i) => s ? `L${x(i)},${y(s.min)}` : '').reverse().join(' ');
                return top + ' ' + bot + ' Z';
              })()}
              fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.05}}
            />
            <path
              d={(() => {
                const top = stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.p75)}` : '').join(' ');
                const bot = [...stats].map((s, i) => s ? `L${x(i)},${y(s.p25)}` : '').reverse().join(' ');
                return top + ' ' + bot + ' Z';
              })()}
              fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.08}}
            />
            <path
              d={stats.map((s, i) => s ? `${i===0?'M':'L'}${x(i)},${y(s.mean)}` : '').join(' ')}
              stroke="var(--fg)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" fill="none"
              className={`rx-stat-mean${statsLeaving ? ' rx-stat-leaving' : ''}`}
            />
          </g>
        )}

        {/* Year series — bars */}
        {showBarsRender && (
          <g clipPath={`url(#clip-${gradId})`}>
            {sortedAsc.map((yr, idx) => (
              <g key={yr}>
                {seasonal[yr] && seasonal[yr].map((v, mi) => v != null && (
                  <rect key={mi}
                    x={xBar(mi) - (selectedYears.length * barW)/2 + idx * barW}
                    y={y(v)}
                    width={barW - 1}
                    height={y(yMin) - y(v)}
                    fill={yearColor(yr)}
                    opacity={seriesOpacity(yr)}
                    rx={1}
                    className={`rx-bar${barsLeaving ? ' rx-bar-leaving' : ''}`}
                    style={{animationDelay: barsLeaving ? '0s' : `${mi * 0.045}s`, cursor: 'pointer'}}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                  />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* Year series — lines + area */}
        {chartStyle !== 'bars' && (
          <g clipPath={`url(#clip-${gradId})`}>
            {displayYears.map((yr) => {
              const isCurrent = yr === latestYear;
              const values = seasonal[yr] || [];
              const stroke = yearColor(yr);
              const leaving = isLeaving(yr);
              return (
                <g key={yr}>
                  {showAreaRender && (
                    <path d={buildAreaPath(values)} fill={`url(#${gradId}-${yr})`}
                      style={{'--rx-area-op': seriesOpacity(yr)}}
                      className={`rx-area ${leaving ? 'rx-leaving' : ''} ${areaLeaving ? 'rx-area-leaving' : ''}`}/>
                  )}
                  <path
                    d={buildPath(values)}
                    stroke={stroke}
                    strokeWidth={seriesWidth(yr)}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={seriesOpacity(yr)}
                    className={leaving ? 'rx-leaving' : ''}
                  />
                  {/* invisible wide hitbox for easier clicking */}
                  {!leaving && (
                    <path
                      d={buildPath(values)}
                      stroke="transparent"
                      strokeWidth={12}
                      fill="none"
                      style={{cursor: 'pointer'}}
                      onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                    />
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Event dots — always above series lines */}
        {showEventsRender && sortedAsc.filter(yr => !pinnedYear || yr === pinnedYear).map(yr => {
          const isPinned = yr === pinnedYear;
          const yearEvents = events.filter(e => e.year === yr);

          // Pre-compute cx for all events in this year
          const cxArr = yearEvents.map(ev => {
            const mi = ev.month - 1;
            if (chartStyle === 'bars') {
              const idx = sortedAsc.indexOf(yr);
              return xBar(mi) - (selectedYears.length * barW) / 2 + idx * barW + (barW - 1) / 2;
            }
            return x(mi);
          });

          // Pre-compute label layout (lx, anchor, pixel bounds) for each event
          const layouts = yearEvents.map((ev, i) => {
            const approxW = ev.label.length * 5.5;
            const cx = cxArr[i];
            let lx, anchor;
            if (cx - approxW / 2 < padL)        { lx = padL;      anchor = 'start'; }
            else if (cx + approxW / 2 > W - padR) { lx = W - padR; anchor = 'end';   }
            else                                   { lx = cx;        anchor = 'middle'; }
            const left  = anchor === 'start' ? lx : anchor === 'end' ? lx - approxW : lx - approxW / 2;
            const right = anchor === 'start' ? lx + approxW : anchor === 'end' ? lx : lx + approxW / 2;
            return { lx, anchor, left, right };
          });

          // Assign label rows using actual pixel bounds (not fixed threshold)
          const rowArr = new Array(yearEvents.length).fill(0);
          if (isPinned) {
            const order = cxArr.map((_, i) => i).sort((a, b) => cxArr[a] - cxArr[b]);
            const rowRight = [-Infinity, -Infinity]; // rightmost pixel used per row
            for (const i of order) {
              const { left, right } = layouts[i];
              if (left >= rowRight[0] + 4) { rowArr[i] = 0; rowRight[0] = right; }
              else                          { rowArr[i] = 1; rowRight[1] = right; }
            }
          }

          return yearEvents.map((ev, i) => {
            const mi = ev.month - 1;
            const v = seasonal[yr]?.[mi];
            if (v == null) return null;
            const cx = cxArr[i];
            const cy = y(v);
            const dotDelay = chartStyle === 'bars'
              ? `${(mi * 0.045 + 0.6).toFixed(2)}s`
              : `${(mi / 11 * 1.1).toFixed(2)}s`;

            const { lx, anchor } = layouts[i];
            const row = rowArr[i];
            const labelY = padT + 2 + row * 13;

            return (
              <g key={`ev-${yr}-${i}-${chartStyle === 'bars' ? 'bars' : 'line'}`}
                 className={eventsLeaving ? 'rx-events-leaving' : ''}>
                <window.EventDot cx={cx} cy={cy}
                  r={isPinned ? 5 : 3}
                  fill={isPinned ? 'var(--bg)' : EVENT_COLOR}
                  stroke={EVENT_COLOR} strokeWidth={1.5}
                  delaySec={parseFloat(dotDelay)}/>
                {isPinned && (
                  <line className="rx-event-beam" x1={cx} y1={labelY + 11} x2={cx} y2={cy - 6}
                    stroke={EVENT_COLOR} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.6}/>
                )}
                {isPinned && (
                  <text x={lx} y={labelY}
                    textAnchor={anchor} dominantBaseline="hanging"
                    style={{fontFamily:'var(--font-mono)', fontSize:9, fill:EVENT_COLOR, fontWeight:600, letterSpacing:'0.01em'}}
                  >{ev.label}</text>
                )}
              </g>
            );
          });
        })}

        {/* Data labels for pinned year */}
        {showLabels && (() => {
          const yr = lastPinnedRef.current;
          if (!yr || !seasonal[yr]) return null;
          return (
            <g style={{animation: labelsLeaving ? 'rx-fade-in 0.15s ease-out reverse forwards' : 'rx-fade-in 0.15s ease-out'}}>
            {seasonal[yr].map((v, mi) => {
          if (v == null) return null;
          const label = window.fmtCompact(v, fmtOpts);
          const color = yearColor(yr);

          if (chartStyle === 'bars') {
            const pinnedIdx = sortedAsc.indexOf(yr);
            const bx = xBar(mi) - (selectedYears.length * barW) / 2 + pinnedIdx * barW + (barW - 1) / 2;
            const by = y(v);
            const nearRight = bx > W - padR - 36;
            const nearLeft  = bx < padL + 36;
            const anchor = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
            const lx = nearRight ? W - padR - 4 : nearLeft ? padL + 4 : bx;
            return (
              <text key={mi} x={lx} y={by - 5}
                textAnchor={anchor} dominantBaseline="auto"
                style={{fontFamily:'var(--font-mono)', fontSize:10, fill: color, fontWeight:500, letterSpacing:'0.02em'}}
              >{label}</text>
            );
          }

          const cx = x(mi);
          const cy = y(v);
          const above = cy - padT > 22;
          const nearRight = cx > W - padR - 36;
          const nearLeft  = cx < padL + 36;
          const anchor = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
          const lx = nearRight ? W - padR - 4 : nearLeft ? padL + 4 : cx;
          return (
            <g key={mi}>
              <circle cx={cx} cy={cy} r={3.5} fill={color} opacity={0.9}/>
              <text x={lx} y={above ? cy - 8 : cy + 14}
                textAnchor={anchor} dominantBaseline="auto"
                style={{fontFamily:'var(--font-mono)', fontSize:10, fill: color, fontWeight:500, letterSpacing:'0.02em'}}
              >{label}</text>
            </g>
          );
        })}
            </g>
          );
        })()}

        {/* Hover crosshair */}
        {hover != null && (
          <g>
            {chartStyle !== 'bars' && (
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB}
                stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            )}
            {chartStyle === 'bars' ? (
              sortedAsc.map((yr, idx) => {
                const v = seasonal[yr]?.[hover];
                if (v == null) return null;
                return (
                  <rect key={yr}
                    x={xBar(hover) - (selectedYears.length * barW)/2 + idx * barW}
                    y={y(v)} width={barW - 1} height={y(yMin) - y(v)}
                    fill="none" stroke={yearColor(yr)} strokeWidth={2} rx={1}
                    style={{cursor: 'pointer'}}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                  />
                );
              })
            ) : (
              sortedAsc.map(yr => {
                const v = seasonal[yr]?.[hover];
                if (v == null) return null;
                const isCurrent = yr === latestYear;
                const isPinned = yr === pinnedYear;
                return (
                  <circle key={yr} cx={x(hover)} cy={y(v)}
                    r={isPinned ? 5 : isCurrent ? 4 : 3}
                    fill="var(--bg)" stroke={yearColor(yr)}
                    strokeWidth={isPinned ? 2.5 : isCurrent ? 2 : 1.25}
                    style={{cursor: 'pointer'}}
                    onMouseEnter={() => setDotHoverYear(yr)}
                    onMouseLeave={() => setDotHoverYear(null)}
                    onClick={() => setPinnedYear(p => p === yr ? null : yr)}
                  />
                );
              })
            )}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis-line"/>
      </svg>

      {hover != null && (
        <HoverCard
          month={hover}
          years={selectedYears}
          seasonal={seasonal}
          stats={showStats && !hideAvg ? stats[hover] : null}
          events={showEvents ? events.filter(e => selectedYears.includes(e.year) && e.month - 1 === hover) : []}
          fmtOpts={fmtOpts}
          unit={unit}
          xPos={x(hover)}
          W={W}
          H={H}
          mouseY={mouseY}
          highlightYear={dotHoverYear}
          yearColor={yearColor}
        />
      )}

      <div className="ciclo-legend">
        {[...selectedYears].sort((a,b) => b-a).map(yr => (
          <span key={yr} className="legend-year"
            onClick={() => setPinnedYear(p => p === yr ? null : yr)}
            style={{
              opacity: pinnedYear && pinnedYear !== yr ? 0.3 : yr === latestYear ? 1 : 0.7,
              cursor: 'pointer',
              userSelect: 'none',
              outline: pinnedYear === yr ? `1px solid ${yearColor(yr)}` : 'none',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
            <span className="legend-line" style={{background: yearColor(yr)}}/>
            {yr}
          </span>
        ))}
        {showStats && !hideAvg && chartStyle !== 'bars' && (<>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{
              display: 'inline-block', width: 16, height: 2,
              borderTop: '2px dashed var(--fg)', opacity: 0.5,
              verticalAlign: 'middle', marginRight: 2,
            }}/>
            Média histórica
          </span>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{
              display: 'inline-block', width: 16, height: 8,
              background: 'var(--fg)', opacity: 0.08,
              verticalAlign: 'middle', marginRight: 2, borderRadius: 1,
            }}/>
            P25–P75
          </span>
          <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
            <span style={{
              display: 'inline-block', width: 16, height: 8,
              background: 'var(--fg)', opacity: 0.05,
              verticalAlign: 'middle', marginRight: 2, borderRadius: 1,
            }}/>
            Mín–Máx
          </span>
        </>)}
      </div>
    </div>
  );
};

const HoverCard = ({ month, years, seasonal, stats, events, fmtOpts, unit, xPos, W, H, mouseY, highlightYear, yearColor }) => {
  const sorted = [...years].sort((a,b) => b-a);
  const isRightSide = xPos > W * 0.75;
  const style = {
    left: `${(xPos / W * 100).toFixed(1)}%`,
    top: Math.max(10, Math.min(H - 120, mouseY - 40)),
    transform: isRightSide ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
  };
  return (
    <div className="hover-card" style={style}>
      <div className="hover-month">{window.MONTHS_PT[month]}</div>
      <div className="hover-rows">
        {sorted.map(yr => {
          const v = seasonal[yr]?.[month];
          const color = yearColor ? yearColor(yr) : undefined;
          return (
            <div key={yr} className="hover-row">
              <span className="hover-year" style={{color}}>{yr}</span>
              <span className="hover-val">{window.fmt(v, fmtOpts)}<span className="hover-unit"> {unit}</span></span>
            </div>
          );
        })}
        {stats && (
          <div className="hover-row hover-stat">
            <span className="hover-year">média {stats.n}a</span>
            <span className="hover-val">{window.fmt(stats.mean, fmtOpts)}</span>
          </div>
        )}
      </div>
      {events.length > 0 && (
        <div className="hover-events">
          {events.map((e, i) => (
            <div key={i} className="hover-event">
              <span className="hover-event-year">{e.year}</span>
              {e.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { SeasonalChart });
