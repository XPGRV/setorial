import React from 'react'
import { MONTHS_PT, availableYears, fmt, useFadeOut } from './data-utils.jsx'
import { SeasonalChart } from './seasonal-chart.jsx'
import { ContinuousCard, ContinuousChart } from './continuous-chart.jsx'

// Aba WEG (provisória) — dados da planilha WEG - Setorial.xlsm

// ── Definições dos peers ──────────────────────────────────────────────────────
// Cores puxadas da identidade de cada empresa, mas espalhadas no círculo de
// matiz para que nenhuma linha fique parecida com a vizinha.
const WEG_PEERS = [
  { key: 'weg',       label: 'WEG',           color: 'oklch(0.62 0.17 255)' },
  { key: 'abb',       label: 'ABB',           color: 'oklch(0.62 0.21 25)'  },
  { key: 'nidec',     label: 'Nidec',         color: 'oklch(0.72 0.17 150)' },
  { key: 'regal',     label: 'Regal Rexnord', color: 'oklch(0.74 0.12 200)' },
  { key: 'eaton',     label: 'Eaton',         color: 'oklch(0.72 0.18 55)'  },
  { key: 'siemens',   label: 'Siemens',       color: 'oklch(0.58 0.10 215)' },
  { key: 'schneider', label: 'Schneider',     color: 'oklch(0.58 0.15 135)' },
  { key: 'gevernova', label: 'GE Vernova',    color: 'oklch(0.60 0.16 290)' },
  { key: 'hitachi',   label: 'Hitachi',       color: 'oklch(0.66 0.20 350)' },
  { key: 'hyosung',   label: 'Hyosung',       color: 'oklch(0.80 0.15 90)'  },
];
const PEER_BY_KEY = Object.fromEntries(WEG_PEERS.map(p => [p.key, p]));

const TRANSFORMER_PRODUCTS = [
  { code: 'liq_lt_650', label: 'Transformadores < 650 kVA', short: '850421', codes: ['850421'], desc: 'Transformadores dieletricos de liquido ate 650 kVA.' },
  { code: 'liq_650_10000', label: 'Transformadores > 650 kVA e < 10.000 kVA', short: '850422', codes: ['850422'], desc: 'Transformadores dieletricos de liquido acima de 650 kVA e ate 10.000 kVA.' },
  { code: 'liq_gt_10000', label: 'Transformadores > 10.000 kVA', short: '850423', codes: ['850423'], desc: 'Transformadores dieletricos de liquido acima de 10.000 kVA.' },
  { code: 'outros', label: 'Outros Transformadores', short: '850431-850490', codes: ['850431', '850432', '850433', '850434', '850490'], desc: 'Outros transformadores eletricos e partes de transformadores.' },
];
const TRANSFORMER_SEASONAL_ACCENT = 'oklch(0.82 0.18 155)';

const PEER_GROUPS = [
  { key: 'eie', label: 'EIE Peers', members: ['abb', 'nidec', 'regal'] },
  { key: 'gtd', label: 'GTD Peers', members: ['eaton', 'siemens', 'schneider', 'gevernova', 'hitachi', 'hyosung'] },
  { key: 'ai',  label: 'AI Peers',  members: [] }, // a definir
];

const sameSet = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// Qual grupo (se algum) corresponde à seleção atual de peers (ignorando WEG).
function groupOf(selected) {
  const peersSel = [...selected].filter(k => k !== 'weg');
  for (const g of PEER_GROUPS) {
    if (g.members.length && sameSet(peersSel, g.members)) return g.key;
  }
  return peersSel.length ? 'custom' : 'none';
}

// ── Dropdown genérico (fecha ao clicar fora) ─────────────────────────────────
const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginLeft: 4 }}>
    <path d="M2 4l4 4 4-4"/>
  </svg>
);

function Dropdown({ label, children, width = 200 }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="weg-dd" ref={ref}>
      <button className={`weg-dd-btn ${open ? 'is-open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span>{label}</span><ChevronDown/>
      </button>
      {open && <div className="weg-dd-panel" style={{ width }}>{children}</div>}
    </div>
  );
}

// ── Gráfico multi-linha diário contínuo ──────────────────────────────────────
export function WegPeersChart({ rows, peers, chartStyle, pinnedKey, setPinnedKey, chartId = 'weg', decimals = 1, onZoom, onResetZoom }) {
  const W = 1000, H = 340;
  const padL = 56, padR = 24, padT = 18, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const [hover, setHover] = React.useState(null);
  const [mouseY, setMouseY] = React.useState(0);
  const dragRef = React.useRef(null); // px inicial do arraste (ou null)
  const selRef  = React.useRef(null); // <rect> da seleção, atualizado imperativamente (sem re-render)
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = useFadeOut(chartStyle === 'area', 400);

  const tOf = React.useCallback(r => r.year + (r.month - 1) / 12 + (r.day - 0.5) / 365.25, []);

  const geom = React.useMemo(() => {
    if (!rows.length || !peers.length) return null;
    const vals = [];
    for (const r of rows) for (const p of peers) { const v = r[p.key]; if (v != null) vals.push(v); }
    if (!vals.length) return null;
    const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
    const pad = (rawMax - rawMin) * 0.06 || 1;
    const vMin = rawMin - pad, vMax = rawMax + pad;
    const tFirst = tOf(rows[0]), tLast = tOf(rows[rows.length - 1]);
    const span = tLast - tFirst || 1;
    const xOf = r => padL + ((tOf(r) - tFirst) / span) * chartW;
    const yOf = v => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;

    // Y ticks
    const vRange = vMax - vMin;
    const rawStep = vRange / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceStep = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => vRange / s <= 8) || mag * 10;
    const yTicks = [];
    for (let v = Math.ceil(vMin / niceStep) * niceStep; v <= vMax + niceStep * 0.01; v = Math.round((v + niceStep) * 1e6) / 1e6)
      yTicks.push(v);

    // X ticks (por ordinal mensal, como no Poultry/Beef Ratio)
    const spanYears = tLast - tFirst;
    const stepMons = spanYears <= 3.5 ? 6 : spanYears <= 6 ? 12 : spanYears <= 13 ? 24 : 60;
    const firstOrd = rows[0].year * 12 + rows[0].month - 1;
    const lastOrd = rows[rows.length - 1].year * 12 + rows[rows.length - 1].month - 1;
    const xTicks = [];
    for (let ord = Math.ceil(firstOrd / stepMons) * stepMons; ord <= lastOrd; ord += stepMons) {
      const yr = Math.floor(ord / 12), mo = (ord % 12) + 1;
      const t = yr + (mo - 1) / 12;
      const x = padL + ((t - tFirst) / span) * chartW;
      const label = stepMons === 6 ? `${MONTHS_PT[mo - 1]}/${String(yr).slice(-2)}` : String(yr);
      xTicks.push({ x, label });
    }

    // Paths por série (quebra em nulos)
    const paths = {};
    for (const p of peers) {
      let d = '', pen = false;
      for (const r of rows) {
        const v = r[p.key];
        if (v == null) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${xOf(r).toFixed(1)},${yOf(v).toFixed(1)}`;
        pen = true;
      }
      paths[p.key] = d;
    }
    const baseY = padT + chartH;
    const areaPaths = {};
    for (const p of peers) {
      const pts = rows.filter(r => r[p.key] != null);
      if (!pts.length) { areaPaths[p.key] = ''; continue; }
      const line = pts.map(r => `${xOf(r).toFixed(1)},${yOf(r[p.key]).toFixed(1)}`).join('L');
      areaPaths[p.key] = `M${line}L${xOf(pts[pts.length - 1]).toFixed(1)},${baseY.toFixed(1)}L${xOf(pts[0]).toFixed(1)},${baseY.toFixed(1)}Z`;
    }
    return { vMin, vMax, tFirst, span, xOf, yOf, yTicks, xTicks, paths, areaPaths, baseY };
  }, [rows, peers, tOf]);

  if (!geom) {
    return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Selecione ao menos uma empresa</div>;
  }
  const { xOf, yOf, yTicks, xTicks, paths, areaPaths } = geom;

  const opacityOf = key => pinnedKey ? (pinnedKey === key ? 1 : 0.12) : 1;
  const widthOf   = key => pinnedKey === key ? 2.4 : 1.6;

  const pxOf = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (W / rect.width),
      py: (e.clientY - rect.top) * (H / rect.height),
    };
  };
  const clampX = px => Math.max(padL, Math.min(padL + chartW, px));
  const tAtPx  = px => geom.tFirst + ((clampX(px) - padL) / chartW) * geom.span;

  // Atualiza o retângulo direto no DOM — sem setState, sem re-render, zero lag.
  const drawRect = (x0, x1) => {
    const el = selRef.current; if (!el) return;
    const x = Math.min(x0, x1), w = Math.abs(x1 - x0);
    el.setAttribute('x', x);
    el.setAttribute('width', w);
    el.style.visibility = w > 1 ? 'visible' : 'hidden';
  };
  const hideRect = () => { if (selRef.current) selRef.current.style.visibility = 'hidden'; };

  const onDown = e => {
    if (e.button !== 0) return;
    const { px } = pxOf(e);
    dragRef.current = clampX(px);
    setHover(null);
    drawRect(dragRef.current, dragRef.current);
  };
  const onMove = e => {
    const { px, py } = pxOf(e);
    if (dragRef.current != null) { drawRect(dragRef.current, clampX(px)); return; }
    const t = tAtPx(px);
    let best = null, bestD = Infinity;
    for (const r of rows) { const d = Math.abs(tOf(r) - t); if (d < bestD) { bestD = d; best = r; } }
    setHover(best || null); setMouseY(prev => Math.abs(prev - py) < 16 ? prev : py);
  };
  const onUp = e => {
    const start = dragRef.current;
    if (start == null) return;
    dragRef.current = null;
    hideRect();
    const end = clampX(pxOf(e).px);
    // Só dá zoom se o arraste for significativo (evita conflito com clique simples)
    if (Math.abs(end - start) >= 6 && onZoom) {
      onZoom({ t0: tAtPx(Math.min(start, end)), t1: tAtPx(Math.max(start, end)) });
    }
  };
  const onLeave = () => { dragRef.current = null; hideRect(); setHover(null); };

  const clipId = `weg-peers-clip-${chartId}`;
  const gradId = key => `weg-grad-${chartId}-${key}`;
  const visForTip = pinnedKey ? peers.filter(p => p.key === pinnedKey) : peers;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave}
        onDoubleClick={() => onResetZoom && onResetZoom()}>
        <defs>
          <clipPath id={clipId}><rect x={padL} y={padT} width={chartW} height={chartH + 4}/></clipPath>
          {peers.map(p => (
            <linearGradient key={p.key} id={gradId(p.key)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={p.color} stopOpacity="0.01"/>
            </linearGradient>
          ))}
        </defs>

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} className="grid-line"/>
            <text x={padL - 6} y={yOf(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {fmt(v, { decimals: Math.abs(v) >= 100 ? 0 : decimals })}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT} y2={H - padB} className="grid-line" opacity="0.3"/>
            <text x={t.x} y={H - padB + 16} className="tick-label" textAnchor="middle">{t.label}</text>
          </g>
        ))}

        {showAreaRender && peers.map(p => (
          areaPaths[p.key] ? (
            <path key={p.key} d={areaPaths[p.key]} fill={`url(#${gradId(p.key)})`}
              opacity={pinnedKey && pinnedKey !== p.key ? 0 : 1}
              style={{ transition: 'opacity 0.25s ease' }}
              className={`rx-area${areaLeaving ? ' rx-area-leaving' : ''}`} clipPath={`url(#${clipId})`}/>
          ) : null
        ))}

        {peers.map(p => (
          paths[p.key] ? (
            <path key={p.key} d={paths[p.key]} fill="none" stroke={p.color} strokeWidth={widthOf(p.key)}
              strokeLinejoin="round" strokeLinecap="round" opacity={opacityOf(p.key)}
              style={{ transition: 'opacity 0.25s ease' }} clipPath={`url(#${clipId})`}/>
          ) : null
        ))}

        {/* Retângulo de seleção do brush (zoom) — posicionado imperativamente via ref */}
        <rect ref={selRef} x={padL} y={padT} width={0} height={chartH}
          fill="var(--accent)" fillOpacity="0.12" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1"
          pointerEvents="none" style={{ visibility: 'hidden' }}/>

        {hover && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={padT} y2={H - padB}
              stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            {peers.map(p => {
              const v = hover[p.key];
              if (v == null) return null;
              const dimmed = pinnedKey && pinnedKey !== p.key;
              return <circle key={p.key} cx={xOf(hover)} cy={yOf(v)} r={dimmed ? 2.5 : 3.5}
                fill="var(--bg)" stroke={p.color} strokeWidth={2} opacity={dimmed ? 0.3 : 1}/>;
            })}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis-line"/>
        <line x1={padL} x2={padL} y1={padT} y2={H - padB} className="axis-line"/>
      </svg>

      {hover && (() => {
        const xPos = xOf(hover);
        const isRight = xPos > W * 0.68;
        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 150, mouseY - 40)),
            transform: isRight ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">{String(hover.day).padStart(2, '0')}/{MONTHS_PT[hover.month - 1]}/{hover.year}</div>
            <div className="hover-rows">
              {visForTip.map(p => hover[p.key] == null ? null : (
                <div key={p.key} className="hover-row">
                  <span className="hover-year" style={{ color: p.color }}>{p.label}</span>
                  <span className="hover-val">{fmt(hover[p.key], { decimals })}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="ciclo-legend" style={{ marginTop: 8 }}>
        {peers.map(p => (
          <span key={p.key} className="legend-year"
            style={{
              userSelect: 'none', padding: '2px 6px', cursor: 'pointer',
              opacity: pinnedKey && pinnedKey !== p.key ? 0.3 : 1,
              outline: pinnedKey === p.key ? `1px solid ${p.color}` : 'none', borderRadius: 4,
            }}
            onClick={() => setPinnedKey(k => k === p.key ? null : p.key)}>
            <span className="legend-line" style={{ background: p.color }}/>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Card do gráfico de peers ──────────────────────────────────────────────────
// Reutilizado para dois gráficos: 'price' (rebaseado em Base 100, pois preços
// absolutos não são comparáveis) e 'pe' (valor absoluto, pois o múltiplo P/E já
// é diretamente comparável entre empresas).
const PEER_METRICS = {
  price: {
    chartId: 'price', suffix: '', rebase: true, decimals: 1,
    cardId: 'card-weg-peers', title: 'Peers · Comparação de Preço',
    eyebrow: 'Bloomberg · Preço das ações · Base 100 (início da janela)',
  },
  pe: {
    chartId: 'pe', suffix: '_pe', rebase: false, decimals: 1,
    cardId: 'card-weg-peers-pe', title: 'Peers · Comparação de P/E',
    eyebrow: 'Bloomberg · Múltiplo Preço/Lucro (P/E) Forward 12M',
  },
};

function WegPeersCard({ data, metric = 'price' }) {
  const m = PEER_METRICS[metric];
  const allRows = React.useMemo(() => data.weg_peers || [], [data]);
  const [range, setRange] = React.useState('5');
  const [chartStyle, setChartStyle] = React.useState('line');
  const [selected, setSelected] = React.useState(() => new Set(['weg', 'abb', 'nidec', 'regal']));
  const [pinnedKey, setPinnedKey] = React.useState(null);
  const [zoom, setZoom] = React.useState(null); // { t0, t1 } | null — brush zoom (sobrepõe o range)

  const tOf = r => r.year + (r.month - 1) / 12 + (r.day - 0.5) / 365.25;
  const rangeNum = range === 'all' ? 'all' : parseInt(range);
  const filtered = React.useMemo(() => {
    if (!allRows.length) return allRows;
    if (zoom) return allRows.filter(r => { const t = tOf(r); return t >= zoom.t0 && t <= zoom.t1; });
    if (rangeNum === 'all') return allRows;
    const last = allRows[allRows.length - 1];
    const cutOrd = last.year * 12 + last.month - rangeNum * 12;
    return allRows.filter(r => r.year * 12 + r.month > cutOrd);
  }, [allRows, rangeNum, zoom]);

  // Aplica o zoom só se houver pelo menos 2 pontos na janela (evita zoom vazio).
  const applyZoom = z => {
    let cnt = 0;
    for (const r of allRows) { const t = tOf(r); if (t >= z.t0 && t <= z.t1) cnt++; if (cnt >= 2) break; }
    if (cnt >= 2) setZoom(z);
  };

  // Cada série é lida da coluna certa (suffix) e — só no gráfico de preço —
  // rebaseada ao seu 1º valor dentro da janela visível. O chart sempre lê p.key.
  const rows = React.useMemo(() => {
    const firsts = {};
    return filtered.map(r => {
      const nr = { year: r.year, month: r.month, day: r.day };
      for (const p of WEG_PEERS) {
        const v = r[p.key + m.suffix];
        if (v == null) continue;
        if (m.rebase) {
          if (firsts[p.key] == null && v !== 0) firsts[p.key] = v;
          if (firsts[p.key] != null) nr[p.key] = (v / firsts[p.key]) * 100;
        } else {
          nr[p.key] = v;
        }
      }
      return nr;
    });
  }, [filtered, m]);

  const peers = React.useMemo(() => WEG_PEERS.filter(p => selected.has(p.key)), [selected]);
  const curGroup = groupOf(selected);

  const togglePeer = key => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  // Grupo é um atalho que substitui os peers, preservando o estado do WEG.
  const applyGroup = g => setSelected(prev => {
    const next = new Set(g.members);
    if (prev.has('weg')) next.add('weg');
    return next;
  });

  const groupLabel = curGroup === 'custom' ? 'Personalizado'
    : curGroup === 'none' ? 'Nenhum'
    : PEER_GROUPS.find(g => g.key === curGroup)?.label;

  return (
    <section className="card card-full" data-card-id={m.cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{m.eyebrow}</div>
          <h3 className="card-title">{m.title}</h3>
        </div>

        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a', 3], ['5a', 5], ['10a', 10], ['Todos', 'all']].map(([label, val]) => (
                <button key={label} className={`year-seg-btn ${!zoom && range === String(val) ? 'is-on' : ''}`}
                  onClick={() => { setZoom(null); setRange(String(val)); }}>{label}</button>
              ))}
            </div>
            {zoom && (
              <button className="seg-btn weg-zoom-reset" onClick={() => setZoom(null)} title="Duplo-clique no gráfico também reseta">
                ⤢ Reset zoom
              </button>
            )}
            <div className="seg">
              {[['line', 'Linha'], ['area', 'Área']].map(([v, l]) => (
                <button key={v} className={`seg-btn ${chartStyle === v ? 'is-on' : ''}`}
                  onClick={() => setChartStyle(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="card-ctrl-row">
            <Dropdown label={`Grupo: ${groupLabel}`} width={170}>
              {PEER_GROUPS.map(g => {
                const disabled = g.members.length === 0;
                return (
                  <button key={g.key} className={`weg-dd-opt ${curGroup === g.key ? 'is-on' : ''}`}
                    disabled={disabled} onClick={() => !disabled && applyGroup(g)}>
                    {g.label}{disabled ? ' (a definir)' : ''}
                  </button>
                );
              })}
            </Dropdown>
            <Dropdown label={`Empresas (${peers.length})`} width={200}>
              {WEG_PEERS.map(p => (
                <label key={p.key} className="weg-dd-check">
                  <input type="checkbox" checked={selected.has(p.key)} onChange={() => togglePeer(p.key)}/>
                  <span className="weg-dd-dot" style={{ background: p.color }}/>
                  <span>{p.label}</span>
                </label>
              ))}
            </Dropdown>
          </div>
        </div>
      </div>

      <WegPeersChart rows={rows} peers={peers} chartStyle={chartStyle}
        pinnedKey={pinnedKey} setPinnedKey={setPinnedKey}
        chartId={m.chartId} decimals={m.decimals}
        onZoom={applyZoom} onResetZoom={() => setZoom(null)}/>
    </section>
  );
}

function TransformerExportControls({ scope, setScope, selectedCodes, toggleCode, selectedProducts }) {
  const label = selectedProducts.length === 1
    ? selectedProducts[0].label
    : `${selectedProducts.length} categorias`;
  return (
    <div className="card-ctrl-row">
      <div className="seg">
        {[
          ['br', 'Brasil'],
          ['sc', 'SC'],
        ].map(([value, label]) => (
          <button key={value} className={`seg-btn ${scope === value ? 'is-on' : ''}`}
            onClick={() => setScope(value)}>{label}</button>
        ))}
      </div>
      <Dropdown label={label} width={360}>
        {TRANSFORMER_PRODUCTS.map(p => (
          <label key={p.code} className="weg-dd-check" style={{alignItems:'flex-start'}}>
            <input type="checkbox" checked={selectedCodes.has(p.code)} onChange={() => toggleCode(p.code)}/>
            <span style={{display:'block', flex:1}}>
              <span style={{display:'block', fontWeight:700}}>{p.label}</span>
              <span style={{display:'block', marginTop:3, color:'var(--fg-dim)', fontSize:11, lineHeight:1.35}}>
                {p.short} · {p.desc}
              </span>
            </span>
          </label>
        ))}
      </Dropdown>
    </div>
  );
}

function TransformerExportSummary({ selectedProducts }) {
  if (!selectedProducts.length) return 'Nenhuma categoria selecionada';
  if (selectedProducts.length === 1) return `${selectedProducts[0].short} · ${selectedProducts[0].desc}`;
  return selectedProducts.map(p => p.label).join(' + ');
}

function WegTransformerExportsSection({ data, accent }) {
  const sourceDataset = 'weg_transformadores_exports';
  const chartDataset = 'weg_transformadores_exports_sum';
  const allRows = data[sourceDataset] || [];
  const [scope, setScope] = React.useState('br');
  const [selectedCodes, setSelectedCodes] = React.useState(() => new Set(TRANSFORMER_PRODUCTS.map(p => p.code)));
  const [range, setRange] = React.useState('5');
  const [chartStyle, setChartStyle] = React.useState('area');
  const [zoom, setZoom] = React.useState(null);
  const [seasonalStyle, setSeasonalStyle] = React.useState('line');
  const [seasonalWindow, setSeasonalWindow] = React.useState('5');

  const selectedKey = React.useMemo(() => [...selectedCodes].sort().join('|'), [selectedCodes]);
  const selectedProducts = React.useMemo(
    () => TRANSFORMER_PRODUCTS.filter(p => selectedCodes.has(p.code)),
    [selectedKey]
  );
  const field = 'value';
  const scopeLabel = scope === 'br' ? 'Brasil' : 'Santa Catarina';
  const ordOf = r => r.year * 12 + r.month - 1;

  const toggleCode = code => setSelectedCodes(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const summedRows = React.useMemo(() => {
    if (!selectedProducts.length) return [];
    return allRows.map(r => {
      let total = 0;
      let hasAny = false;
      for (const product of selectedProducts) {
        for (const sh6 of product.codes) {
          const value = r[`${scope}_${sh6}`];
          if (value != null) {
            total += value;
            hasAny = true;
          }
        }
      }
      return { year: r.year, month: r.month, value: hasAny ? total : null };
    }).filter(r => r.value != null);
  }, [allRows, scope, selectedKey]);

  const chartData = React.useMemo(() => ({ ...data, [chartDataset]: summedRows }), [data, summedRows]);
  const validRows = summedRows;
  React.useEffect(() => { setZoom(null); }, [scope, selectedKey]);

  const filteredRows = React.useMemo(() => {
    if (zoom) return validRows.filter(r => ordOf(r) >= zoom.o0 && ordOf(r) <= zoom.o1);
    if (range === 'all') return validRows;
    if (!validRows.length) return validRows;
    const last = validRows[validRows.length - 1];
    const cutOrd = ordOf(last) - parseInt(range, 10) * 12;
    return validRows.filter(r => ordOf(r) > cutOrd);
  }, [validRows, range, zoom]);

  const applyZoom = z => {
    let count = 0;
    for (const r of validRows) {
      const o = ordOf(r);
      if (o >= z.o0 && o <= z.o1) count++;
      if (count >= 2) break;
    }
    if (count >= 2) setZoom(z);
  };

  const lastRow = filteredRows[filteredRows.length - 1] || null;
  const prevRow = filteredRows.length >= 2 ? filteredRows[filteredRows.length - 2] : null;
  const yoyRow = lastRow ? [...filteredRows].reverse().find(r => r.year === lastRow.year - 1 && r.month === lastRow.month) : null;
  const pct = (a, b) => (a == null || b == null || b === 0) ? null : (a - b) / Math.abs(b);
  const mom = pct(lastRow?.value, prevRow?.value);
  const yoy = pct(lastRow?.value, yoyRow?.value);
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1).replace('.', ',') + '%';

  const years = React.useMemo(() => {
    if (!summedRows.length) return [];
    return availableYears(chartData, chartDataset, field);
  }, [chartData, summedRows]);
  const selectedYears = React.useMemo(() => {
    if (seasonalWindow === 'all') return years;
    return years.slice(-parseInt(seasonalWindow, 10));
  }, [years, seasonalWindow]);

  if (!allRows.length) return null;

  return (
    <>
      <section className="card card-full" data-card-id="card-weg-transformadores-exportacoes">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">SECEX · Exportações · {scopeLabel} · 1000 US$</div>
            <h3 className="card-title">Exportações de Transformadores</h3>
            <span style={{display:'block', marginTop:3, color:'var(--fg-dim)', fontSize:11, lineHeight:1.35}}>
              {TransformerExportSummary({ selectedProducts })}
            </span>
            <div className="card-price">
              <span className="card-value">{fmt(lastRow?.value, { decimals: 0 })}</span>
              <span className="card-unit">1000 US$</span>
              <span className={`card-delta ${mom == null ? '' : mom >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(mom)}<span className="card-delta-label"> MoM</span>
              </span>
              <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
              </span>
            </div>
          </div>

          <div className="card-controls">
            <TransformerExportControls scope={scope} setScope={setScope} selectedCodes={selectedCodes} toggleCode={toggleCode} selectedProducts={selectedProducts}/>
            <div className="card-ctrl-row">
              <div className="year-seg">
                {[["3a","3"], ["5a","5"], ["10a","10"], ["Todos","all"]].map(([label, value]) => (
                  <button key={value} className={`year-seg-btn ${!zoom && range === value ? 'is-on' : ''}`}
                    onClick={() => { setZoom(null); setRange(value); }}>{label}</button>
                ))}
              </div>
              {zoom && (
                <button className="seg-btn weg-zoom-reset" onClick={() => setZoom(null)}
                  title="Duplo-clique no gráfico também reseta">Reset zoom</button>
              )}
              <div className="seg">
                {[["line","Linha"], ["area","Área"]].map(([value, label]) => (
                  <button key={value} className={`seg-btn ${chartStyle === value ? 'is-on' : ''}`}
                    onClick={() => setChartStyle(value)}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ContinuousChart
          rows={filteredRows} field={field} accent={accent}
          unit="1000 US$" decimals={0} height={360}
          chartStyle={chartStyle}
          endPaddingMonths={2}
          onZoom={applyZoom}
          onResetZoom={() => setZoom(null)}
        />
      </section>

      <section className="card card-full" data-card-id="card-weg-transformadores-exportacoes-sazonal">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">SECEX · Sazonal · {scopeLabel}</div>
            <h3 className="card-title">Exportações de Transformadores · Sazonal</h3>
            <span style={{display:'block', marginTop:3, color:'var(--fg-dim)', fontSize:11, lineHeight:1.35}}>
              {TransformerExportSummary({ selectedProducts })}
            </span>
          </div>
          <div className="card-controls">
            <TransformerExportControls scope={scope} setScope={setScope} selectedCodes={selectedCodes} toggleCode={toggleCode} selectedProducts={selectedProducts}/>
            <div className="card-ctrl-row">
              <div className="year-seg">
                {[["5a","5"], ["10a","10"], ["Todos","all"]].map(([label, value]) => (
                  <button key={value} className={`year-seg-btn ${seasonalWindow === value ? 'is-on' : ''}`}
                    onClick={() => setSeasonalWindow(value)}>{label}</button>
                ))}
              </div>
              <div className="seg">
                {[["line","Linha"], ["area","Área"], ["bars","Barras"]].map(([value, label]) => (
                  <button key={value} className={`seg-btn ${seasonalStyle === value ? 'is-on' : ''}`}
                    onClick={() => setSeasonalStyle(value)}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selectedYears.length ? (
          <SeasonalChart
            data={chartData} dataset={chartDataset} field={field}
            selectedYears={selectedYears}
            showStats={false} showEvents={false} events={[]}
            chartStyle={seasonalStyle} accent={TRANSFORMER_SEASONAL_ACCENT}
            unit="1000 US$" decimals={0} big={false}
            height={340}
            hideAvg
          />
        ) : (
          <div style={{height:300, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
            Sem dados para a seleção
          </div>
        )}
      </section>
    </>
  );
}

// ── Aba ───────────────────────────────────────────────────────────────────────
const EmptyWeg = () => (
  <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 21V9l6-3v3l6-3v3l6-3v15zM3 21h18"/>
    </svg>
    <div style={{fontSize:16,fontWeight:500,color:'var(--fg)'}}>Sem dados da WEG</div>
    <div style={{fontSize:13,textAlign:'center',maxWidth:320}}>Atualize a planilha WEG - Setorial.xlsm para visualizar os gráficos.</div>
  </main>
);

// Sub-aba controlada pela sidebar (prop `tab`, à la Poultry): 'peers' mostra os
// dois gráficos de comparação; qualquer outro valor mostra Transformadores.
// Se a sub-aba pedida não tiver dados, cai graciosamente para a que tiver.
const WegTab = ({ data, accent, tab }) => {
  const hasTransfPrice = !!(data.weg_transformadores && data.weg_transformadores.length);
  const hasTransfExports = !!(data.weg_transformadores_exports && data.weg_transformadores_exports.length);
  const hasTransf = hasTransfPrice || hasTransfExports;
  const hasPeers  = !!(data.weg_peers && data.weg_peers.length);
  if (!hasTransf && !hasPeers) return <EmptyWeg />;

  const showPeers  = (tab === 'peers' && hasPeers) || (!hasTransf && hasPeers);
  const showTransf = !showPeers && hasTransf;

  return (
    <main className="main">
      {showTransf && (
        <>
          {hasTransfPrice && (
            <ContinuousCard
              cardId="card-weg-transformadores"
              title="Preço Transformadores"
              sub="PPI · Electric Power and Specialty Transformer Manufacturing · Base 100 (início da janela)"
              accent={accent} data={data} dataset="weg_transformadores"
              field="value" unit="Base 100" decimals={2}
              rebaseBase100
              enableZoom
            />
          )}
          {hasTransfExports && <WegTransformerExportsSection data={data} accent={accent}/>}
        </>
      )}
      {showPeers && (
        <>
          <WegPeersCard data={data} metric="price"/>
          <WegPeersCard data={data} metric="pe"/>
        </>
      )}
    </main>
  );
};

export { WegTab };
