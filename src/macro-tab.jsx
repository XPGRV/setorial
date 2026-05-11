import React from 'react'

const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;

const MONTHS_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CHART_GREEN = 'oklch(0.70 0.19 160)';

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

// ── SelicSnapshotChart ────────────────────────────────────────────────────────

function SelicSnapshotChart({ rows, snapYear, snapMonth, accent, height = 240 }) {
  const svgRef = useRef(null);
  const [svgW, setSvgW] = useState(760);
  const [hovered, setHovered] = useState(null);

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
  const padL = 52, padR = 48, padT = 14, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const valid = useMemo(() => rows.filter(r => r.value != null), [rows]);

  if (!valid.length) return (
    <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
      Sem dados
    </div>
  );

  const firstOrd = valid[0].year * 12 + valid[0].month;
  const lastOrd  = valid[valid.length - 1].year * 12 + valid[valid.length - 1].month;
  const span     = lastOrd - firstOrd || 1;

  const xOf = r => padL + ((r.year * 12 + r.month - firstOrd) / span) * chartW;

  const vals = valid.map(r => r.value);
  const { ticks: yTicks, lo: yMin, hi: yMax } = niceYTicks(Math.min(...vals), Math.max(...vals));
  const yOf  = v => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  // Split into solid (historical) and dashed (forecast) paths
  const solidRows = valid.filter(r => !r.isForecast);
  const dotRows   = valid.filter(r => r.isForecast);
  const lastSolid = solidRows[solidRows.length - 1];
  // Connect dashed path from the last solid point
  const dotFull   = lastSolid ? [lastSolid, ...dotRows] : dotRows;

  const toPath = pts => pts.length < 2 ? '' :
    `M${pts.map(r => `${xOf(r).toFixed(1)},${yOf(r.value).toFixed(1)}`).join('L')}`;

  const solidPath = toPath(solidRows);
  const dotPath   = toPath(dotFull);

  // Vertical marker at snapshot month
  const snapOrd = snapYear * 12 + snapMonth;
  const snapX   = padL + ((snapOrd - firstOrd) / span) * chartW;

  // X-axis ticks — adaptive density
  const totalMonths = span;
  const tickStep = totalMonths <= 12 ? 1 : totalMonths <= 24 ? 3 : totalMonths <= 48 ? 6 : 12;
  const xTicks = valid
    .filter(r => (r.year * 12 + r.month - firstOrd) % tickStep === 0)
    .map(r => ({ x: xOf(r), label: `${MONTHS_ABR[r.month - 1]}/${String(r.year).slice(2)}` }));

  const onMouseMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px   = (e.clientX - rect.left - padL) / chartW;
    const target = firstOrd + px * span;
    let best = null, bestD = Infinity;
    for (const r of valid) {
      const d = Math.abs(r.year * 12 + r.month - target);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) setHovered({ x: xOf(best), y: yOf(best.value), row: best, mouseY: e.clientY - rect.top });
  };

  const fmt = v => v == null ? '—' : v.toFixed(2).replace('.', ',');

  return (
    <div style={{position:'relative', animation:'rx-fade-in 0.5s ease-out'}}>
      <svg ref={svgRef} className="chart-svg" width="100%" height={H}
        style={{display:'block', overflow:'visible'}}
        onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)}>

        {/* Y grid + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)}
              className="grid-line" style={{opacity: i === 0 ? 0 : 0.6}}/>
            <text x={W - padR + 8} y={yOf(v)} textAnchor="start" fontSize={10} fill="var(--fg-dim)">
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
            <text x={t.x} y={padT + chartH + 14} textAnchor="middle" fontSize={10} fill="var(--fg-dim)">{t.label}</text>
          </g>
        ))}

        {/* Snapshot vertical marker */}
        {snapX >= padL && snapX <= W - padR && (
          <line x1={snapX} x2={snapX} y1={padT} y2={padT + chartH}
            stroke={accent} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.45}/>
        )}

        {/* Solid historical path */}
        {solidPath && (
          <path d={solidPath} fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round"/>
        )}

        {/* Dashed forecast path */}
        {dotPath && (
          <path d={dotPath} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round"
            strokeDasharray="6 4" strokeOpacity={0.7}/>
        )}

        {/* Hover crosshair + dot */}
        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--bg-panel)"
              stroke={accent} strokeWidth={2} className="rx-no-anim"/>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{display:'flex', gap:16, padding:'6px 0 0', fontSize:11, color:'var(--fg-dim)'}}>
        <span style={{display:'flex', alignItems:'center', gap:5}}>
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={accent} strokeWidth="2.5"/></svg>
          Realizado
        </span>
        <span style={{display:'flex', alignItems:'center', gap:5}}>
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={accent} strokeWidth="2" strokeDasharray="5 3" strokeOpacity="0.7"/></svg>
          Projetado
        </span>
      </div>

      {/* Hover tooltip */}
      {hovered && (() => {
        const r   = hovered.row;
        const TW  = 160;
        const rawL = hovered.x > svgW * 0.65 ? hovered.x - TW - 16 : hovered.x + 16;
        return (
          <div className="hover-card" style={{
            left: Math.max(4, Math.min(svgW - TW - 4, rawL)),
            top:  Math.max(10, Math.min(H - 80, hovered.mouseY - 40)),
          }}>
            <div className="hover-month">{MONTHS_ABR[r.month - 1]}/{r.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-val" style={{color: accent}}>
                  {fmt(r.value)}<span className="hover-unit"> % a.a.</span>
                </span>
                {r.isForecast && <span style={{fontSize:10, color:'var(--fg-dim)', marginLeft:6}}>projetado</span>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── SelicSnapshotCard ─────────────────────────────────────────────────────────

function SelicSnapshotCard({ selicSnapshots }) {
  const { snapshots, bySnapshot } = selicSnapshots;
  const [selectedSnap, setSelectedSnap] = useState(snapshots[snapshots.length - 1]);

  const allRows  = bySnapshot[selectedSnap] || [];
  const snapMeta = parseSnapLabel(selectedSnap);

  // Show only 12 months of history before snapshot + full forecast
  const rows = useMemo(() => {
    const cutOrd = snapMeta.year * 12 + snapMeta.month - 6;
    return allRows.filter(r => r.isForecast || (r.year * 12 + r.month) >= cutOrd);
  }, [allRows, snapMeta.year, snapMeta.month]);

  const latest = useMemo(() => [...rows].filter(r => !r.isForecast).at(-1), [rows]);

  return (
    <section className="card card-full">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">BCB · Revisões de Mercado · Bloomberg</div>
          <h3 className="card-title">SELIC</h3>
          {latest && (
            <div className="card-price">
              <span className="card-value">{latest.value.toFixed(2).replace('.', ',')}</span>
              <span className="card-unit">% a.a.</span>
              <span className="card-date">snapshot {snapMeta.display}</span>
            </div>
          )}
        </div>
        <div className="card-head-right">
          <div className="card-controls">
            <div className="card-ctrl-row">
              <div className="year-seg">
                {snapshots.map(s => {
                  const meta = parseSnapLabel(s);
                  return (
                    <button key={s}
                      className={`year-seg-btn ${selectedSnap === s ? 'is-on' : ''}`}
                      onClick={() => setSelectedSnap(s)}>
                      {meta.display}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <SelicSnapshotChart
        rows={rows}
        snapYear={snapMeta.year}
        snapMonth={snapMeta.month}
        accent={CHART_GREEN}
        height={240}
      />
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
        <SelicSnapshotCard selicSnapshots={selicSnapshots} />
      </main>
    );
  }

  return (
    <main className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12, color:'var(--fg-dim)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.35 }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <div style={{ fontSize:14, color:'var(--fg)', opacity:0.6 }}>Nenhum dado SELIC</div>
        <div style={{ fontSize:12, color:'var(--fg-mute)', maxWidth:320, lineHeight:1.5 }}>
          Faça upload da <strong>Planilha - Selic.xlsm</strong> para visualizar as revisões de mercado.
        </div>
      </div>
    </main>
  );
}

window.MacroTab = MacroTab;
