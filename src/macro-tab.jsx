import React from 'react'
import { useFadeOut } from './data-utils.jsx'

const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;

const MONTHS_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SEASONAL_PALETTE = [
  'oklch(0.75 0.15 200)',  // age 1 — teal
  'oklch(0.68 0.16 255)',  // age 2 — azul
  'oklch(0.74 0.15 310)',  // age 3 — roxo
  'oklch(0.78 0.17 35)',   // age 4 — laranja
  'oklch(0.80 0.15 60)',   // age 5 — amarelo
  'oklch(0.72 0.16 0)',    // age 6 — vermelho
  'oklch(0.76 0.13 170)',  // age 7 — verde-água
];

function niceYTicks(dataMin, dataMax, count = 5) {
  const range = dataMax - dataMin || 1;
  const rough = range / (count - 1);
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / mag;
  const step  = norm < 1.5 ? mag : norm < 3.5 ? 2 * mag : norm < 7.5 ? 5 * mag : 10 * mag;
  const lo    = Math.floor(dataMin / step) * step;
  const hi    = Math.ceil(dataMax / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-9; v = Math.round((v + step) * 1e10) / 1e10) ticks.push(v);
  return { ticks, lo, hi };
}

const ALL_MO_SELIC = { jan:1, fev:2, feb:2, mar:3, abr:4, apr:4, mai:5, may:5, jun:6, jul:7, ago:8, aug:8, set:9, sep:9, out:10, oct:10, nov:11, dez:12, dec:12 };

function parseSnapLabel(label) {
  const m = String(label).match(/^([a-z]{3})-(\d{2,4})$/i);
  if (!m) return { month: 1, year: 2026, display: label };
  const mo = ALL_MO_SELIC[m[1].toLowerCase()] || 1;
  let yr = parseInt(m[2]);
  if (yr < 100) yr += 2000;
  return { month: mo, year: yr, display: `${MONTHS_ABR[mo - 1]}/${m[2]}` };
}

function ordToMoYr(ord) {
  const mo = ((ord % 12) || 12);
  const yr = (ord - mo) / 12;
  return { mo, yr };
}

// ── SelicSnapshotChart ────────────────────────────────────────────────────────

function SelicSnapshotChart({ series, height = 320 }) {
  const svgRef = useRef(null);
  const [svgW, setSvgW] = useState(760);
  const [hovOrd, setHovOrd] = useState(null);
  const [hovMouse, setHovMouse] = useState({ x: 0, y: 0 });
  const [pinnedSnap, setPinnedSnap] = useState(null);
  const { shouldRender: showLabels, isLeaving: labelsLeaving } = useFadeOut(!!pinnedSnap, 150);
  const lastPinnedRef = useRef(pinnedSnap);
  if (pinnedSnap) lastPinnedRef.current = pinnedSnap;

  // Reset pin when series change
  useEffect(() => { setPinnedSnap(null); }, [series.map(s => s.label).join(',')]);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const initial = Math.floor(svgRef.current.getBoundingClientRect().width);
    if (initial > 0) setSvgW(initial);
    const obs = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      if (w > 0) setSvgW(prev => Math.abs(w - prev) > 2 ? w : prev);
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

  const W = svgW, H = height;
  const padL = 52, padR = 16, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allPoints = useMemo(() =>
    series.flatMap(s => s.rows.filter(r => r.value != null)), [series]);

  if (!allPoints.length) return (
    <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
      Sem dados
    </div>
  );

  const allOrds = useMemo(() => {
    const set = new Set(allPoints.map(r => r.year * 12 + r.month));
    return [...set].sort((a, b) => a - b);
  }, [allPoints]);

  const firstOrd = allOrds[0];
  const lastOrd  = allOrds[allOrds.length - 1];
  const span     = lastOrd - firstOrd || 1;

  const xOfOrd = ord => padL + ((ord - firstOrd) / span) * chartW;
  const xOf    = r   => xOfOrd(r.year * 12 + r.month);

  const vals = allPoints.map(r => r.value);
  const { ticks: yTicks, lo: yMin, hi: yMax } = niceYTicks(Math.min(...vals), Math.max(...vals));
  const yOf = v => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const toPath = pts => pts.length < 2 ? '' :
    `M${pts.map(r => `${xOf(r).toFixed(1)},${yOf(r.value).toFixed(1)}`).join('L')}`;

  const seriesBuilt = series.map(s => {
    const valid     = s.rows.filter(r => r.value != null);
    const solidRows = valid.filter(r => !r.isForecast);
    const dotRows   = valid.filter(r => r.isForecast);
    const lastSolid = solidRows[solidRows.length - 1];
    const dotFull   = lastSolid ? [lastSolid, ...dotRows] : dotRows;
    const splitFraction = lastSolid ? Math.max(0, Math.min(1, (lastSolid.year * 12 + lastSolid.month - firstOrd) / span)) : 0;
    return { solidPath: toPath(solidRows), dotPath: toPath(dotFull), valid, solidRows, dotRows, splitFraction };
  });

  // X-axis: generate every month in range regardless of data gaps
  const tickStep = span <= 36 ? 1 : span <= 60 ? 2 : 3;
  const xTicks = [];
  for (let ord = firstOrd; ord <= lastOrd; ord++) {
    if ((ord - firstOrd) % tickStep !== 0) continue;
    const { mo, yr } = ordToMoYr(ord);
    xTicks.push({ x: xOfOrd(ord), label: `${MONTHS_ABR[mo - 1]}/${String(yr).slice(2)}` });
  }

  const onMouseMove = e => {
    if (!svgRef.current) return;
    const rect   = svgRef.current.getBoundingClientRect();
    const px     = (e.clientX - rect.left - padL) / chartW;
    const target = firstOrd + px * span;
    const closest = allOrds.reduce((best, ord) =>
      Math.abs(ord - target) < Math.abs(best - target) ? ord : best, allOrds[0]);
    setHovOrd(closest);
    setHovMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const fmt = v => v == null ? '—' : v.toFixed(2).replace('.', ',');

  const hovX = hovOrd != null ? xOfOrd(hovOrd) : null;

  const seriesOpacity = s => {
    if (!pinnedSnap) return 1;
    return s.label === pinnedSnap ? 1 : 0.1;
  };
  const seriesWidth = s => {
    if (!pinnedSnap) return 2.2;
    return s.label === pinnedSnap ? 2.5 : 1;
  };

  return (
    <div style={{position:'relative', animation:'rx-fade-in 0.5s ease-out'}}>
      <svg ref={svgRef} className="chart-svg" width="100%" height={H}
        style={{display:'block', overflow:'visible'}}
        onMouseMove={onMouseMove} onMouseLeave={() => setHovOrd(null)}>

        {/* Y grid + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)}
              className="grid-line" style={{opacity: i === 0 ? 0 : 0.6}}/>
            <text x={padL - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="var(--fg-dim)">
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X baseline */}
        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--border)" strokeWidth={1}/>

        {/* X ticks + labels */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT + chartH} y2={padT + chartH + 4} stroke="var(--fg-dim)" strokeWidth={0.5}/>
            <text x={t.x} y={padT + chartH + 14} textAnchor="middle" fontSize={12} fill="var(--fg-dim)">{t.label}</text>
          </g>
        ))}

        {/* Snapshot vertical markers */}
        {series.map((s, i) => {
          const snapOrd = s.snapYear * 12 + s.snapMonth;
          const sx = xOfOrd(snapOrd);
          if (sx < padL || sx > W - padR) return null;
          return (
            <line key={i} x1={sx} x2={sx} y1={padT} y2={padT + chartH}
              stroke={s.color} strokeWidth={1} strokeDasharray="3 3"
              strokeOpacity={pinnedSnap && s.label !== pinnedSnap ? 0.1 : 0.4}/>
          );
        })}

        {/* Series paths */}
        {seriesBuilt.map((sp, i) => {
          const s   = series[i];
          const op  = seriesOpacity(s);
          const sw  = seriesWidth(s);
          return (
            <g key={i} style={{opacity: op, transition:'opacity 0.2s'}}>
              {sp.solidPath && (
                <path d={sp.solidPath} fill="none" stroke={s.color} strokeWidth={sw} strokeLinejoin="round"/>
              )}
              {sp.dotPath && (
                <path d={sp.dotPath} fill="none" stroke={s.color} strokeWidth={sw * 0.85} strokeLinejoin="round"
                  strokeDasharray="6 4" strokeOpacity={0.8} className="rx-dashed-line"
                  style={{ animationDelay: `${(sp.splitFraction * 1.2).toFixed(3)}s`, animationDuration: `${((1 - sp.splitFraction) * 1.2).toFixed(3)}s` }}/>
              )}
            </g>
          );
        })}

        {/* Hit areas (wider transparent paths for click) */}
        {seriesBuilt.map((sp, i) => {
          const s = series[i];
          const combinedPath = [sp.solidPath, sp.dotPath].filter(Boolean).join(' ');
          if (!combinedPath) return null;
          return (
            <path key={i} d={combinedPath} fill="none" stroke="transparent" strokeWidth={14}
              style={{cursor: 'pointer'}}
              onClick={() => setPinnedSnap(p => p === s.label ? null : s.label)}/>
          );
        })}

        {/* Data labels for pinned series */}
        {showLabels && (() => {
          const snap = lastPinnedRef.current;
          if (!snap) return null;
          const si = series.findIndex(s => s.label === snap);
          if (si < 0) return null;
          const s  = series[si];
          const sp = seriesBuilt[si];
          return (
            <g style={{animation: labelsLeaving ? 'rx-fade-in 0.15s ease-out reverse forwards' : 'rx-fade-in 0.15s ease-out'}}>
              {sp.valid.map((r, j) => {
                const cx     = xOf(r);
                const cy     = yOf(r.value);
                const above  = cy - padT > 18;
                const nearR  = cx > W - padR - 28;
                const nearL  = cx < padL + 28;
                const anchor = nearR ? 'end' : nearL ? 'start' : 'middle';
                const lx     = nearR ? W - padR - 2 : nearL ? padL + 2 : cx;
                return (
                  <g key={j}>
                    <circle cx={cx} cy={cy} r={3} fill={s.color} opacity={0.9}/>
                    <text x={lx} y={above ? cy - 7 : cy + 13}
                      textAnchor={anchor}
                      style={{fontFamily:'var(--font-mono)', fontSize:11, fill: s.color, fontWeight:500}}>
                      {fmt(r.value)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Hover crosshair + dots */}
        {hovOrd != null && hovX != null && (
          <g>
            <line x1={hovX} x2={hovX} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.15} strokeWidth={1}/>
            {series.map((s, i) => {
              const pt = s.rows.find(r => r.year * 12 + r.month === hovOrd && r.value != null);
              if (!pt) return null;
              const op = pinnedSnap && s.label !== pinnedSnap ? 0.15 : 1;
              return (
                <circle key={i} cx={hovX} cy={yOf(pt.value)} r={4}
                  fill="var(--bg-panel)" stroke={s.color} strokeWidth={2}
                  className="rx-no-anim" style={{opacity: op}}/>
              );
            })}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{display:'flex', gap:16, flexWrap:'wrap', padding:'6px 0 0', fontSize:12, color:'var(--fg-dim)', alignItems:'center'}}>
        {series.map((s, i) => (
          <span key={i}
            style={{
              display:'flex', alignItems:'center', gap:5, cursor:'pointer',
              opacity: pinnedSnap && s.label !== pinnedSnap ? 0.35 : 1,
              transition:'opacity 0.2s, box-shadow 0.15s',
              padding:'2px 6px', borderRadius:4,
              boxShadow: pinnedSnap === s.label ? `0 0 0 1px ${s.color}` : 'none',
            }}
            onClick={() => setPinnedSnap(p => p === s.label ? null : s.label)}>
            <svg width="20" height="10">
              <line x1="0" y1="3" x2="20" y2="3" stroke={s.color} strokeWidth="2.5"/>
              <line x1="0" y1="8" x2="20" y2="8" stroke={s.color} strokeWidth="2" strokeDasharray="5 3" strokeOpacity="0.8"/>
            </svg>
            {parseSnapLabel(s.label).display}
          </span>
        ))}
        <span style={{marginLeft:'auto', display:'flex', gap:12}}>
          <span style={{display:'flex', alignItems:'center', gap:4}}>
            <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="var(--fg-dim)" strokeWidth="2"/></svg>
            Realizado
          </span>
          <span style={{display:'flex', alignItems:'center', gap:4}}>
            <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="var(--fg-dim)" strokeWidth="2" strokeDasharray="4 3" strokeOpacity="0.8"/></svg>
            Projetado
          </span>
        </span>
      </div>

      {/* Hover tooltip */}
      {hovOrd != null && (() => {
        const { mo, yr } = ordToMoYr(hovOrd);
        const TW  = 180;
        const rawL = hovMouse.x > svgW * 0.65 ? hovMouse.x - TW - 16 : hovMouse.x + 16;
        const tooltipRows = series.map(s => ({
          label: parseSnapLabel(s.label).display,
          color: s.color,
          point: s.rows.find(r => r.year * 12 + r.month === hovOrd && r.value != null),
        }));
        return (
          <div className="hover-card" style={{
            left: Math.max(4, Math.min(svgW - TW - 4, rawL)),
            top:  Math.max(10, Math.min(H - 80, hovMouse.y - 40)),
            minWidth: TW,
          }}>
            <div className="hover-month">{MONTHS_ABR[mo - 1]}/{yr}</div>
            <div className="hover-rows">
              {tooltipRows.map((tr, i) => (
                <div key={i} className="hover-row">
                  <span style={{fontSize:10, color:'var(--fg-dim)', minWidth:44}}>{tr.label}</span>
                  <span className="hover-val" style={{color: tr.color}}>
                    {tr.point ? fmt(tr.point.value) : '—'}
                    {tr.point && <span className="hover-unit"> %</span>}
                  </span>
                  {tr.point?.isForecast && <span style={{fontSize:9, color:'var(--fg-dim)', marginLeft:4}}>proj.</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── SelicSnapshotCard ─────────────────────────────────────────────────────────

function SelicSnapshotCard({ selicSnapshots, accent }) {
  const { snapshots, bySnapshot } = selicSnapshots;
  const [selectedSnaps, setSelectedSnaps] = useState(snapshots);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const toggleSnap = s => setSelectedSnaps(prev =>
    prev.includes(s)
      ? prev.length > 1 ? prev.filter(x => x !== s) : prev
      : [...prev, s]
  );

  const series = useMemo(() => {
    const sortedByRecency = [...selectedSnaps].sort((a, b) => {
      const ma = parseSnapLabel(a), mb = parseSnapLabel(b);
      return (mb.year * 12 + mb.month) - (ma.year * 12 + ma.month);
    });
    const snapColor = s => {
      const age = sortedByRecency.indexOf(s);
      return age === 0 ? (accent || 'oklch(0.70 0.19 160)') : SEASONAL_PALETTE[(age - 1) % SEASONAL_PALETTE.length];
    };
    const globalCutOrd = Math.min(...selectedSnaps.map(s => {
      const meta = parseSnapLabel(s);
      return meta.year * 12 + meta.month - 6;
    }));
    return selectedSnaps.map(s => {
      const meta    = parseSnapLabel(s);
      const allRows = bySnapshot[s] || [];
      const rows    = allRows.filter(r => r.isForecast || (r.year * 12 + r.month) >= globalCutOrd);
      return { label: s, rows, color: snapColor(s), snapYear: meta.year, snapMonth: meta.month };
    });
  }, [selectedSnaps, bySnapshot, accent]);

  const latestSnap  = snapshots[snapshots.length - 1];
  const latestMeta  = parseSnapLabel(latestSnap);
  const latestRows  = bySnapshot[latestSnap] || [];
  const latestPoint = [...latestRows].filter(r => !r.isForecast).at(-1);

  const btnLabel = selectedSnaps.length === 1
    ? `${parseSnapLabel(selectedSnaps[0]).display} ▾`
    : `Projeções ▾`;

  return (
    <section className="card card-full">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">BCB · Revisões de Mercado · Bloomberg</div>
          <h3 className="card-title">CDI</h3>
          {latestPoint && (
            <div className="card-price">
              <span className="card-value">{latestPoint.value.toFixed(2).replace('.', ',')}</span>
              <span className="card-unit">% a.a.</span>
              <span className="card-date">projeção {latestMeta.display}</span>
            </div>
          )}
        </div>
        <div className="card-head-right">
          <div className="card-controls">
            <div className="card-ctrl-row">
              <div className="year-drop-wrap" ref={dropRef}>
                <button
                  className={`year-seg-btn ${dropOpen ? 'is-active' : ''}`}
                  onClick={() => setDropOpen(o => !o)}>
                  {btnLabel}
                </button>
                {dropOpen && (
                  <div className="year-drop">
                    {snapshots.map(s => {
                      const on = selectedSnaps.includes(s);
                      return (
                        <div key={s}
                          className={`year-drop-item ${on ? 'is-on' : ''}`}
                          onClick={() => toggleSnap(s)}>
                          <span className="year-drop-check">{on ? '✓' : ''}</span>
                          {parseSnapLabel(s).display}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <SelicSnapshotChart series={series} height={480} />
    </section>
  );
}

// ── MacroTab ──────────────────────────────────────────────────────────────────

function MacroTab({ data: propData, accent }) {
  const [dashData, setDashData] = useState(propData || window.__dashboardData || null);

  useEffect(() => {
    if (propData !== undefined) setDashData(propData);
  }, [propData]);

  useEffect(() => {
    const onUpdate = e => { if (e.detail?.data) setDashData(e.detail.data); };
    window.addEventListener('dashboard-data-updated', onUpdate);
    return () => window.removeEventListener('dashboard-data-updated', onUpdate);
  }, []);

  const selicSnapshots = dashData?.selic_snapshots;

  if (selicSnapshots?.snapshots?.length > 0) {
    return (
      <main className="main">
        <SelicSnapshotCard selicSnapshots={selicSnapshots} accent={accent} />
      </main>
    );
  }

  return (
    <main className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12, color:'var(--fg-dim)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.35 }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <div style={{ fontSize:14, color:'var(--fg)', opacity:0.6 }}>Nenhum dado CDI</div>
        <div style={{ fontSize:12, color:'var(--fg-mute)', maxWidth:320, lineHeight:1.5 }}>
          Faça upload da <strong>Planilha - Selic.xlsm</strong> para visualizar as revisões de mercado.
        </div>
      </div>
    </main>
  );
}

export { MacroTab };
