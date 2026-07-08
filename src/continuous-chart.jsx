import React from 'react'
import { useFadeOut } from './data-utils.jsx'

// ContinuousChart — série contínua (não sazonal) com controles simplificados

const MONTHS_PT_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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


function filterByRangeYears(rows, field, rangeYears) {
  const valid = rows.filter(r => r[field] != null);
  if (!valid.length || rangeYears === 'all') return valid;
  const last = valid[valid.length - 1];
  const cutOrd = last.year * 12 + last.month - 1 - rangeYears * 12;
  return valid.filter(r => r.year * 12 + r.month - 1 > cutOrd);
}

function ContinuousChart({ rows, field, accent, unit = '', decimals = 1, height = 260, events = [], showEvents = true, chartStyle = 'line', zeroBaseline = false, highlightZero = false, endPaddingMonths = 0, bottomPadding = 32, connectGaps = false, onZoom, onResetZoom }) {
  const reactId = React.useId().replace(/[^a-z0-9-]/gi, '');
  const svgRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null); // { x, y, row, mouseY }
  const [svgW, setSvgW] = React.useState(760);
  const dragRef = React.useRef(null);
  const selRef = React.useRef(null);

  React.useLayoutEffect(() => {
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

  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = useFadeOut(chartStyle === 'area', 450);

  const W = svgW, H = height;
  const padL = 58, padR = 72, padT = 14, padB = bottomPadding;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const valid = React.useMemo(() => rows.filter(r => r[field] != null), [rows, field]);

  if (!valid.length) {
    return (
      <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
        Sem dados
      </div>
    );
  }

  const vals   = valid.map(r => r[field]);
  const minV   = Math.min(...vals);
  const maxV   = Math.max(...vals);
  const { ticks: yTicks, lo: yMin, hi: yMax } = niceYTicks(minV, maxV);

  const firstOrd  = valid[0].year * 12 + valid[0].month - 1;
  const lastOrd   = valid[valid.length - 1].year * 12 + valid[valid.length - 1].month - 1;
  const domainLastOrd = lastOrd + endPaddingMonths;
  const totalMons = domainLastOrd - firstOrd || 1;

  const xOf = row => padL + ((row.year * 12 + row.month - 1 - firstOrd) / totalMons) * chartW;
  const yOf = v   => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const clampX = px => Math.max(padL, Math.min(padL + chartW, px));
  const ordAtX = px => firstOrd + ((clampX(px) - padL) / chartW) * totalMons;

  // X ticks: 3a/5a → a cada 6 meses; 10a/Todos → a cada 12 meses
  const xOf_ord = ord => padL + ((ord - firstOrd) / totalMons) * chartW;
  const stepMons = totalMons <= 72 ? 6 : 12;
  const xTicks = [];
  const tickStart = Math.ceil(firstOrd / stepMons) * stepMons;
  for (let ord = tickStart; ord <= lastOrd; ord += stepMons) {
    const yr = Math.floor(ord / 12);
    const mo = (ord % 12) + 1;
    const label = stepMons === 6
      ? `${MONTHS_PT_ABR[mo - 1]}/${String(yr).slice(-2)}`
      : String(yr);
    xTicks.push({ x: xOf_ord(ord), label });
  }

  // Some sources are sparse monthly series. For those, connect valid points
  // like MultiContinuousChart instead of making isolated one-point fragments.
  const segments = connectGaps ? [valid] : (() => {
    const out = [];
    let seg = [valid[0]];
    for (let i = 1; i < valid.length; i++) {
      const gap = valid[i].year * 12 + valid[i].month - (valid[i-1].year * 12 + valid[i-1].month);
      if (gap > 2) { out.push(seg); seg = [valid[i]]; }
      else seg.push(valid[i]);
    }
    out.push(seg);
    return out;
  })();

  const linePath = segments
    .map(s => 'M' + s.map(r => `${xOf(r).toFixed(1)},${yOf(r[field]).toFixed(1)}`).join('L'))
    .join('');

  const zeroY       = yOf(0);
  const zeroInChart = zeroY >= padT && zeroY <= padT + chartH;
  const baseY       = (zeroBaseline && zeroInChart) ? zeroY : padT + chartH;
  const areaPath    = segments.map(s => {
    const pts = s.map(r => `${xOf(r).toFixed(1)},${yOf(r[field]).toFixed(1)}`);
    const x0  = xOf(s[0]).toFixed(1);
    const xN  = xOf(s[s.length - 1]).toFixed(1);
    return `M${pts.join('L')}L${xN},${baseY.toFixed(1)}L${x0},${baseY.toFixed(1)}Z`;
  }).join(' ');

  // Hover + brush zoom
  const pxOf = e => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (W / rect.width),
      py: (e.clientY - rect.top) * (H / rect.height),
    };
  };
  const drawRect = (x0, x1) => {
    const el = selRef.current; if (!el) return;
    const x = Math.min(x0, x1), w = Math.abs(x1 - x0);
    el.setAttribute('x', x);
    el.setAttribute('width', w);
    el.style.visibility = w > 1 ? 'visible' : 'hidden';
  };
  const hideRect = () => { if (selRef.current) selRef.current.style.visibility = 'hidden'; };

  const onMouseMove = (e) => {
    if (!svgRef.current) return;
    const { px, py } = pxOf(e);
    if (dragRef.current != null) {
      drawRect(dragRef.current, clampX(px));
      return;
    }
    const ord = ordAtX(px);
    let best = null, bestD = Infinity;
    for (const r of valid) {
      const d = Math.abs(r.year * 12 + r.month - 1 - ord);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) {
      setHovered(prev => prev && prev.row === best && Math.abs(prev.mouseY - py) < 16
        ? prev
        : { x: xOf(best), y: yOf(best[field]), row: best, mouseY: py });
    }
  };
  const onMouseDown = e => {
    if (e.button !== 0 || !onZoom || !svgRef.current) return;
    const { px } = pxOf(e);
    dragRef.current = clampX(px);
    setHovered(null);
    drawRect(dragRef.current, dragRef.current);
  };
  const onMouseUp = e => {
    const start = dragRef.current;
    if (start == null) return;
    dragRef.current = null;
    hideRect();
    const end = clampX(pxOf(e).px);
    if (Math.abs(end - start) >= 6 && onZoom) {
      onZoom({ o0: ordAtX(Math.min(start, end)), o1: ordAtX(Math.max(start, end)) });
    }
  };
  const onMouseLeave = () => {
    dragRef.current = null;
    hideRect();
    setHovered(null);
  };

  // Visible events
  const visEvts = showEvents
    ? events.filter(ev => { const o = ev.year * 12 + ev.month - 1; return o >= firstOrd && o <= lastOrd; })
    : [];

  const fmt = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const clipId = `cc-clip-${field}-${reactId}`;
  const gradId = `cc-grad-${field}-${reactId}`;
  const dataKey = valid.length > 0
    ? `${valid[0].year}-${valid[0].month}-${valid.length}`
    : 'empty';

  return (
    <div style={{position:'relative', animation:'rx-fade-in 0.5s ease-out'}}>
      <svg key={dataKey} ref={svgRef} className="chart-svg" width="100%" height={H}
        style={{display:'block', overflow:'visible'}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave} onDoubleClick={() => onResetZoom && onResetZoom()}>
        <defs>
          <clipPath id={clipId}>
            <rect x={padL} y={padT - 2} width={chartW} height={chartH + 6}/>
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={accent} stopOpacity={0.22}/>
            <stop offset="100%" stopColor={accent} stopOpacity={0.01}/>
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)}
              className="grid-line" style={{opacity: i === 0 ? 0 : 0.6}}
            />
            <text x={W - padR + 8} y={yOf(v)} textAnchor="start" fontSize={10} fill="var(--fg-dim)">
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Axis baseline */}
        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--border)" strokeWidth={1}/>

        {/* Zero line highlight */}
        {highlightZero && zeroInChart && (
          <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY}
            stroke="var(--fg-dim)" strokeWidth={1.5} opacity={0.55}
            clipPath={`url(#${clipId})`}/>
        )}

        {/* X labels */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT + chartH} y2={padT + chartH + 4} stroke="var(--fg-dim)" strokeWidth={0.5}/>
            <text x={t.x} y={padT + chartH + 14} textAnchor="middle" fontSize={10} fill="var(--fg-dim)">{t.label}</text>
          </g>
        ))}

        {/* Events */}
        {visEvts.map((ev, i) => {
          const ex = padL + ((ev.year * 12 + ev.month - 1 - firstOrd) / totalMons) * chartW;
          return (
            <line key={i} x1={ex} x2={ex} y1={padT} y2={padT + chartH}
              stroke="var(--fg-dim)" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.45}
              clipPath={`url(#${clipId})`}/>
          );
        })}

        {/* Area */}
        {showAreaRender && (
          <path d={areaPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`}
            className={`rx-area${areaLeaving ? ' rx-area-leaving' : ''}`}/>
        )}

        {/* Line */}
        {chartStyle !== 'bars' && (
          <path d={linePath} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round"
            clipPath={`url(#${clipId})`}/>
        )}

        {/* Bars */}
        {chartStyle === 'bars' && (() => {
          const bw = Math.max(1, chartW / totalMons - 0.5);
          return valid.map((r, i) => {
            const bx = xOf(r) - bw / 2;
            const by = yOf(r[field]);
            return <rect key={i} x={bx} y={by} width={bw} height={(padT + chartH) - by}
              fill={accent} opacity={0.75} clipPath={`url(#${clipId})`}/>;
          });
        })()}

        <rect ref={selRef} x={padL} y={padT} width={0} height={chartH}
          fill="var(--accent)" fillOpacity="0.12" stroke="var(--accent)"
          strokeOpacity="0.5" strokeWidth="1" pointerEvents="none"
          style={{ visibility: 'hidden' }}/>

        {/* Hover crosshair */}
        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--bg-panel)"
              stroke={accent} strokeWidth={2} className="rx-no-anim"/>
          </g>
        )}
      </svg>

      {/* Tooltip — mesmo estilo do SeasonalChart */}
      {hovered && (() => {
        const r = hovered.row;
        const TW = 170;
        const rawLeft = hovered.x > svgW * 0.65 ? hovered.x - TW - 16 : hovered.x + 16;
        const style = {
          left: Math.max(4, Math.min(svgW - TW - 4, rawLeft)),
          top: Math.max(10, Math.min(H - 120, hovered.mouseY - 40)),
        };
        return (
          <div className="hover-card" style={style}>
            <div className="hover-month">{MONTHS_PT_ABR[r.month - 1]}/{r.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-val" style={{color: accent}}>
                  {fmt(r[field])}<span className="hover-unit"> {unit}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── ContinuousCard ────────────────────────────────────────────────────────────
function ContinuousCard({ cardId, title, sub, accent, data, dataset, field, unit = '', decimals = 1, height = 260, events: eventsProp, footerNote, rebaseBase100 = false, enableZoom = false }) {
  const [range, setRange]           = React.useState('5');
  const [chartStyle, setChartStyle] = React.useState('area');
  const [zoom, setZoom]             = React.useState(null);

  const eventsData = []; // eventos desativados neste gráfico
  const allRows    = data[dataset] || [];

  const ordOf = r => r.year * 12 + r.month - 1;
  const rangeNum = range === 'all' ? 'all' : parseInt(range);
  const filteredRows = React.useMemo(() => {
    if (zoom) return allRows.filter(r => r[field] != null && ordOf(r) >= zoom.o0 && ordOf(r) <= zoom.o1);
    return filterByRangeYears(allRows, field, rangeNum);
  }, [allRows, field, rangeNum, zoom]);
  const rows = React.useMemo(() => {
    if (!rebaseBase100) return filteredRows;
    const base = filteredRows.find(r => r[field] != null && r[field] !== 0)?.[field];
    if (base == null) return filteredRows;
    return filteredRows.map(r => ({
      ...r,
      [field]: r[field] == null ? null : (r[field] / base) * 100,
    }));
  }, [filteredRows, field, rebaseBase100]);

  const applyZoom = z => {
    if (!enableZoom) return;
    let count = 0;
    for (const r of allRows) {
      const o = ordOf(r);
      if (r[field] != null && o >= z.o0 && o <= z.o1) count++;
      if (count >= 2) break;
    }
    if (count >= 2) setZoom(z);
  };

  // Latest value header stats
  const lastRow  = rows[rows.length - 1] || null;
  const prevRow  = rows.length >= 2 ? rows[rows.length - 2] : null;
  const yoyRow   = lastRow ? [...rows].reverse().find(r => r.year === lastRow.year - 1 && r.month === lastRow.month) : null;
  const pct = (a, b) => (a == null || b == null || b === 0) ? null : (a - b) / Math.abs(b);
  const mom  = pct(lastRow?.[field], prevRow?.[field]);
  const yoy  = pct(lastRow?.[field], yoyRow?.[field]);
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  const fmtVal = v => v == null ? '—' : Number(v).toFixed(decimals).replace('.', ',');

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price">
            <span className="card-value">{fmtVal(lastRow?.[field])}</span>
            <span className="card-unit">{unit}</span>
            <span className={`card-delta ${mom == null ? '' : mom >= 0 ? 'is-up' : 'is-down'}`}>
              {fmtPct(mom)}<span className="card-delta-label"> MoM</span>
            </span>
            <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
              {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
            </span>
          </div>
        </div>

        {/* Controles simplificados — sem Média+Faixa, sem Barras, sem Eventos, sem seleção individual de anos */}
        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a',3],['5a',5],['10a',10],['Todos','all']].map(([label, val]) => (
                <button key={label}
                  className={`year-seg-btn ${!zoom && range === String(val) ? 'is-on' : ''}`}
                  onClick={() => { setZoom(null); setRange(String(val)); }}>
                  {label}
                </button>
              ))}
            </div>
            {zoom && (
              <button className="seg-btn weg-zoom-reset" onClick={() => setZoom(null)} title="Duplo-clique no gráfico também reseta">
                Reset zoom
              </button>
            )}
          </div>
          <div className="card-ctrl-row">
            <div className="seg">
              {[['line','Linha'],['area','Área']].map(([v, l]) => (
                <button key={v} className={`seg-btn ${chartStyle === v ? 'is-on' : ''}`}
                  onClick={() => setChartStyle(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ContinuousChart
        rows={rows} field={field} accent={accent}
        unit={unit} decimals={decimals} height={height}
        events={eventsData} showEvents={false}
        chartStyle={chartStyle}
        onZoom={enableZoom ? applyZoom : undefined}
        onResetZoom={enableZoom ? () => setZoom(null) : undefined}
      />

      {footerNote && (
        <div style={{padding:'6px 0 4px', fontSize:11, color:'var(--fg-dim)', lineHeight:1.6}}>
          {footerNote}
        </div>
      )}
    </section>
  );
}



// ── MultiContinuousChart ──────────────────────────────────────────────────────
function MultiContinuousChart({ rows, fields, unit = '', decimals = 2, height = 260, chartId = 'mc', chartStyle = 'line', pinnedSeries, setPinnedSeries }) {
  const svgRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [svgW, setSvgW] = React.useState(760);
  const { shouldRender: showLabels, isLeaving: labelsLeaving } = useFadeOut(!!pinnedSeries, 150);
  const lastPinnedRef = React.useRef(pinnedSeries);
  if (pinnedSeries) lastPinnedRef.current = pinnedSeries;

  React.useLayoutEffect(() => {
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
  const padL = 58, padR = 48, padT = 14, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const valid = React.useMemo(
    () => rows.filter(r => fields.some(f => r[f.key] != null)),
    [rows, fields]
  );
  const allVals = React.useMemo(
    () => valid.flatMap(r => fields.map(f => r[f.key]).filter(v => v != null)),
    [valid, fields]
  );

  if (!valid.length || !allVals.length) {
    return (
      <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
        Sem dados
      </div>
    );
  }

  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const { ticks: yTicks, lo: yMin, hi: yMax } = niceYTicks(minV, maxV);

  const tOf = row => row.year + (row.month - 1) / 12 + ((row.day || 1) - 1) / 365.25;
  const firstT = tOf(valid[0]);
  const lastT = tOf(valid[valid.length - 1]);
  const totalT = lastT - firstT || 1;
  const firstOrd  = valid[0].year * 12 + valid[0].month - 1;
  const lastOrd   = valid[valid.length - 1].year * 12 + valid[valid.length - 1].month - 1;

  const xOf     = row => padL + ((tOf(row) - firstT) / totalT) * chartW;
  const yOf     = v   => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const xOf_ord = ord => {
    const yr = Math.floor(ord / 12);
    const mo = (ord % 12) + 1;
    return padL + ((yr + (mo - 1) / 12 - firstT) / totalT) * chartW;
  };

  const lineOpacity = key => pinnedSeries ? (pinnedSeries === key ? 1 : 0.15) : 1;
  const lineWidth   = key => pinnedSeries === key ? 2.5 : 2;

  const spanMons = Math.max(1, Math.round(totalT * 12));
  const stepMons = spanMons <= 72 ? 6 : 12;
  const xTicks = [];
  const tickStart = Math.ceil(firstOrd / stepMons) * stepMons;
  for (let ord = tickStart; ord <= lastOrd; ord += stepMons) {
    const yr = Math.floor(ord / 12);
    const mo = (ord % 12) + 1;
    const label = stepMons === 6
      ? `${MONTHS_PT_ABR[mo - 1]}/${String(yr).slice(-2)}`
      : String(yr);
    xTicks.push({ x: xOf_ord(ord), label });
  }

  const buildPath = key => {
    let path = '', inPath = false;
    for (const r of valid) {
      const v = r[key];
      if (v != null) {
        const pt = `${xOf(r).toFixed(1)},${yOf(v).toFixed(1)}`;
        path += inPath ? `L${pt}` : `M${pt}`; inPath = true;
      } else { inPath = false; }
    }
    return path;
  };

  const buildAreaPath = key => {
    const pts = valid.filter(r => r[key] != null);
    if (!pts.length) return '';
    const line = pts.map(r => `${xOf(r).toFixed(1)},${yOf(r[key]).toFixed(1)}`).join('L');
    const x0 = xOf(pts[0]).toFixed(1), x1 = xOf(pts[pts.length - 1]).toFixed(1);
    const base = (padT + chartH).toFixed(1);
    return `M${line}L${x1},${base}L${x0},${base}Z`;
  };

  const onMouseMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left - padL) / chartW;
    const t = firstT + px * totalT;
    let best = null, bestD = Infinity;
    for (const r of valid) {
      const d = Math.abs(tOf(r) - t);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) {
      const my = e.clientY - rect.top;
      setHovered(prev => prev && prev.row === best && Math.abs(prev.mouseY - my) < 16
        ? prev
        : { x: xOf(best), row: best, mouseY: my });
    }
  };

  const toggle = key => setPinnedSeries(p => p === key ? null : key);

  const fmt    = v  => v == null ? '—' : Number(v).toFixed(decimals).replace('.', ',');
  const fmtDate = r => r?.day
    ? `${String(r.day).padStart(2, '0')}/${MONTHS_PT_ABR[r.month - 1]}/${String(r.year).slice(-2)}`
    : `${MONTHS_PT_ABR[r.month - 1]}/${r.year}`;
  const clipId = `mcc-clip-${chartId}`;

  const visFields = pinnedSeries ? fields.filter(f => f.key === pinnedSeries) : fields;

  return (
    <div style={{position:'relative', animation:'rx-fade-in 0.5s ease-out'}}>
      <svg ref={svgRef} width="100%" height={H} style={{display:'block', overflow:'visible'}}
        onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)}>
        <defs>
          <clipPath id={clipId}>
            <rect x={padL} y={padT - 2} width={chartW} height={chartH + 6}/>
          </clipPath>
          {fields.map(f => (
            <linearGradient key={f.key} id={`mcc-grad-${chartId}-${f.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={f.color} stopOpacity={0.25}/>
              <stop offset="100%" stopColor={f.color} stopOpacity={0.01}/>
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)}
              className="grid-line" style={{opacity: i === 0 ? 0 : 0.6}}/>
            <text x={W - padR + 8} y={yOf(v)} textAnchor="start" fontSize={10} fill="var(--fg-dim)">
              {fmt(v)}
            </text>
          </g>
        ))}

        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--border)" strokeWidth={1}/>

        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT + chartH} y2={padT + chartH + 4} stroke="var(--fg-dim)" strokeWidth={0.5}/>
            <text x={t.x} y={padT + chartH + 14} textAnchor="middle" fontSize={10} fill="var(--fg-dim)">{t.label}</text>
          </g>
        ))}

        {fields.map(f => {
          const linePath = buildPath(f.key);
          if (!linePath) return null;
          const isPinned = pinnedSeries === f.key;
          return (
            <g key={f.key}>
              {chartStyle === 'area' && (
                <path d={buildAreaPath(f.key)} fill={`url(#mcc-grad-${chartId}-${f.key})`}
                  opacity={pinnedSeries && !isPinned ? 0 : 1}
                  style={{transition:'opacity 0.25s ease'}}
                  clipPath={`url(#${clipId})`}/>
              )}
              <path d={linePath} fill="none" stroke={f.color}
                strokeWidth={lineWidth(f.key)} strokeLinejoin="round"
                opacity={lineOpacity(f.key)}
                style={{transition:'opacity 0.25s ease'}}
                clipPath={`url(#${clipId})`}/>
              {/* transparent hit area */}
              <path d={linePath} fill="none" stroke="transparent" strokeWidth={12}
                style={{cursor:'pointer'}} clipPath={`url(#${clipId})`}
                onClick={() => toggle(f.key)}/>
            </g>
          );
        })}

        {/* Data labels for pinned series */}
        {showLabels && (() => {
          const f = fields.find(ff => ff.key === lastPinnedRef.current);
          if (!f) return null;
          const MIN_GAP = 34;
          const lastIdx = valid.length - 1;
          const lastX = valid.length ? xOf(valid[lastIdx]) : -Infinity;
          let lastLabelX = -Infinity;
          return (
            <g style={{animation: labelsLeaving ? 'rx-fade-in 0.15s ease-out reverse forwards' : 'rx-fade-in 0.15s ease-out'}}>
              {valid.map((r, i) => {
                const v = r[f.key];
                if (v == null) return null;
                const cx = xOf(r), cy = yOf(v);
                const isLast = i === lastIdx;
                // O último ponto sempre aparece; os intermediários pulam se
                // colarem no rótulo anterior OU no rótulo final.
                if (!isLast && (cx - lastLabelX < MIN_GAP || lastX - cx < MIN_GAP)) return null;
                lastLabelX = cx;
                const above     = cy - padT > 20;
                const nearLeft  = cx < padL + 20;
                const anchor    = nearLeft ? 'start' : 'middle';
                const lx        = nearLeft ? padL + 2 : cx;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={3} fill={f.color} opacity={0.9}/>
                    <text x={lx} y={above ? cy - 7 : cy + 13} textAnchor={anchor}
                      style={{fontFamily:'var(--font-mono)', fontSize:10, fill:f.color, fontWeight:500, letterSpacing:'0.02em'}}>
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Hover crosshair + dots */}
        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            {fields.map(f => {
              const v = hovered.row[f.key];
              if (v == null) return null;
              const isPinned = pinnedSeries === f.key;
              const dimmed   = pinnedSeries && !isPinned;
              return (
                <circle key={f.key} cx={hovered.x} cy={yOf(v)}
                  r={isPinned ? 6 : dimmed ? 3 : 4}
                  fill="var(--bg-panel)" stroke={f.color}
                  strokeWidth={isPinned ? 3 : dimmed ? 1.2 : 2}
                  className="rx-no-anim"
                  style={{cursor:'pointer'}}
                  onClick={() => toggle(f.key)}/>
              );
            })}
          </g>
        )}
      </svg>

      {hovered && (() => {
        const r = hovered.row;
        const TW = 200;
        const rawLeft = hovered.x > svgW * 0.65 ? hovered.x - TW - 16 : hovered.x + 16;
        return (
          <div className="hover-card" style={{
            left: Math.max(4, Math.min(svgW - TW - 4, rawLeft)),
            top: Math.max(10, Math.min(H - 120, hovered.mouseY - 40)),
          }}>
            <div className="hover-month">{fmtDate(r)}</div>
            <div className="hover-rows">
              {visFields.map(f => (
                <div key={f.key} className="hover-row">
                  <span className="hover-year" style={{color: f.color}}>{f.label}</span>
                  <span className="hover-val">{fmt(r[f.key])}<span className="hover-unit"> {unit}</span></span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── MultiContinuousCard ───────────────────────────────────────────────────────
function MultiContinuousCard({ cardId, title, sub, rows, fields, unit = '', decimals = 2, height = 360, defaultRange = '5', beforeChart = null }) {
  const [range, setRange]             = React.useState(defaultRange);
  const [chartStyle, setChartStyle]   = React.useState('area');
  const [pinnedSeries, setPinnedSeries] = React.useState(null);
  const rangeNum = range === 'all' ? 'all' : parseInt(range);

  const filteredRows = React.useMemo(() => {
    if (!rows.length || rangeNum === 'all') return rows;
    const last = rows[rows.length - 1];
    const tOf = row => row.year + (row.month - 1) / 12 + ((row.day || 1) - 1) / 365.25;
    const cutT = tOf(last) - rangeNum;
    return rows.filter(r => tOf(r) > cutT);
  }, [rows, rangeNum]);

  const lastRow = filteredRows[filteredRows.length - 1] || null;
  const fmt = v => v == null ? '—' : Number(v).toFixed(decimals).replace('.', ',');

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price" style={{flexWrap:'wrap', gap:'8px 20px'}}>
            {fields.map(f => (
              <span key={f.key} style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <span style={{width:8, height:8, borderRadius:'50%', background:f.color,
                  display:'inline-block', flexShrink:0}}/>
                <span className="card-value" style={{color: f.color}}>{fmt(lastRow?.[f.key])}</span>
                <span className="card-unit">{unit}</span>
                <span style={{fontSize:11, color:'var(--fg-dim)', marginLeft:2}}>{f.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a',3],['5a',5],['10a',10],['Todos','all']].map(([label, val]) => (
                <button key={label}
                  className={`year-seg-btn ${range === String(val) ? 'is-on' : ''}`}
                  onClick={() => setRange(String(val))}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-ctrl-row">
            <div className="seg">
              {[['line','Linha'],['area','Área']].map(([v, l]) => (
                <button key={v} className={`seg-btn ${chartStyle === v ? 'is-on' : ''}`}
                  onClick={() => setChartStyle(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {beforeChart?.({ pinnedSeries, setPinnedSeries, fields, lastRow })}

      <MultiContinuousChart
        rows={filteredRows}
        fields={fields}
        unit={unit}
        decimals={decimals}
        height={height}
        chartId={cardId}
        chartStyle={chartStyle}
        pinnedSeries={pinnedSeries}
        setPinnedSeries={setPinnedSeries}
      />

      <div className="ciclo-legend" style={{marginTop: 8}}>
        {fields.map(f => (
          <span key={f.key} className="legend-year"
            style={{
              userSelect:'none', padding:'2px 6px', cursor:'pointer',
              opacity: pinnedSeries && pinnedSeries !== f.key ? 0.3 : 1,
              outline: pinnedSeries === f.key ? `1px solid ${f.color}` : 'none',
              borderRadius: 4,
            }}
            onClick={() => setPinnedSeries(p => p === f.key ? null : f.key)}>
            <span className="legend-line" style={{background: f.color}}/>
            {f.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export { ContinuousCard, ContinuousChart, MultiContinuousCard, MultiContinuousChart };
