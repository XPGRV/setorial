import React from 'react'

const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;

const MONTHS_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CHART_GREEN = 'oklch(0.82 0.18 155)';

const SERIES_META = [
  { id: 'ipca',   label: 'IPCA',   eyebrow: 'BCB SGS 433 · Variação Mensal', unit: '%',      decimals: 2 },
  { id: 'selic',  label: 'SELIC',  eyebrow: 'BCB SGS 432 · Meta',            unit: '% a.a.', decimals: 2 },
  { id: 'igpm',   label: 'IGP-M',  eyebrow: 'BCB SGS 189 · FGV',             unit: '%',      decimals: 2 },
  { id: 'tjlp',   label: 'TJLP',   eyebrow: 'BCB SGS 4175',                  unit: '% a.a.', decimals: 2 },
  { id: 'cpi_us', label: 'CPI-US', eyebrow: 'BLS CUUR0000SA0 · All Items',   unit: 'idx',    decimals: 1 },
];

const PTAX_META = { id: 'ptax', label: 'PTAX', eyebrow: 'BCB SGS 1 · Fim de Mês', unit: 'R$/USD', decimals: 2 };

const RANGE_OPTS = [
  { label: 'LTM',   years: 1    },
  { label: '3a',    years: 3    },
  { label: '5a',    years: 5    },
  { label: '10a',   years: 10   },
  { label: 'Todos', years: null },
];

const PTAX_RANGE_OPTS = [
  { label: '1m',    months: 1,  daily: true  },
  { label: '6m',    months: 6,  daily: true  },
  { label: 'LTM',   years: 1,   daily: false },
  { label: '3a',    years: 3,   daily: false },
  { label: '5a',    years: 5,   daily: false },
  { label: '10a',   years: 10,  daily: false },
  { label: 'Todos', years: null, daily: false },
];

function filterRows(rows, years) {
  if (!years || !rows.length) return rows;
  const last     = rows[rows.length - 1];
  const cutMonth = last.year * 12 + last.month - years * 12;
  return rows.filter(r => r.year * 12 + r.month >= cutMonth);
}

// ── PtaxDailyChart ────────────────────────────────────────────────────────────

function PtaxDailyChart({ rows, accent, unit, decimals, height = 220, chartStyle }) {
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [svgW, setSvgW] = useState(760);
  const { shouldRender: showArea, isLeaving: areaLeaving } = window.useFadeOut(chartStyle === 'area', 450);

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
  const padL = 58, padR = 48, padT = 14, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const valid = useMemo(() => rows.filter(r => r.value != null), [rows]);

  if (!valid.length) return (
    <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
      Sem dados
    </div>
  );

  const dayMs  = r => new Date(r.year, r.month - 1, r.day).getTime();
  const firstMs = dayMs(valid[0]);
  const lastMs  = dayMs(valid[valid.length - 1]);
  const spanMs  = lastMs - firstMs || 1;

  const xOf = r => padL + ((dayMs(r) - firstMs) / spanMs) * chartW;

  const vals = valid.map(r => r.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV || 1;
  const yMin = minV - span * 0.04;
  const yMax = maxV + span * 0.04;
  const yOf  = v => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const yTicks = Array.from({length: 5}, (_, i) => yMin + (yMax - yMin) * (i / 4));

  const spanDays = spanMs / 86400000;
  const xTicks = [];
  if (spanDays <= 40) {
    // 1m: every ~7 days
    let t = new Date(firstMs);
    t.setDate(t.getDate() + ((8 - t.getDay()) % 7 || 7));
    while (t.getTime() <= lastMs) {
      const x = padL + ((t.getTime() - firstMs) / spanMs) * chartW;
      xTicks.push({ x, label: `${t.getDate()}/${MONTHS_ABR[t.getMonth()]}` });
      t = new Date(t.getTime() + 7 * 86400000);
    }
  } else {
    // 6m: first of each month
    const fd = new Date(firstMs);
    let t = new Date(fd.getFullYear(), fd.getMonth() + 1, 1);
    while (t.getTime() <= lastMs) {
      const x = padL + ((t.getTime() - firstMs) / spanMs) * chartW;
      xTicks.push({ x, label: `${MONTHS_ABR[t.getMonth()]}/${String(t.getFullYear()).slice(2)}` });
      t = new Date(t.getFullYear(), t.getMonth() + 1, 1);
    }
  }

  const pts      = valid.map(r => `${xOf(r).toFixed(1)},${yOf(r.value).toFixed(1)}`);
  const linePath = `M${pts.join('L')}`;
  const areaPath = `${linePath}L${xOf(valid[valid.length - 1]).toFixed(1)},${(padT + chartH).toFixed(1)}L${padL},${(padT + chartH).toFixed(1)}Z`;

  const onMouseMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px   = (e.clientX - rect.left - padL) / chartW;
    const ms   = firstMs + px * spanMs;
    let best = null, bestD = Infinity;
    for (const r of valid) {
      const d = Math.abs(dayMs(r) - ms);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) setHovered({ x: xOf(best), y: yOf(best.value), row: best, mouseY: e.clientY - rect.top });
  };

  const fmt     = v => v == null ? '—' : Number(v).toFixed(decimals).replace('.', ',');
  const clipId  = 'ptax-daily-clip';
  const gradId  = 'ptax-daily-grad';
  const dataKey = `${valid[0].year}${valid[0].month}${valid[0].day}-${valid.length}`;

  return (
    <div style={{position:'relative', animation:'rx-fade-in 0.5s ease-out'}}>
      <svg key={dataKey} ref={svgRef} className="chart-svg" width="100%" height={H}
        style={{display:'block', overflow:'visible'}}
        onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)}>
        <defs>
          <clipPath id={clipId}>
            <rect x={padL} y={padT - 2} width={chartW} height={chartH + 6}/>
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={accent} stopOpacity={0.22}/>
            <stop offset="100%" stopColor={accent} stopOpacity={0.01}/>
          </linearGradient>
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

        {showArea && (
          <path d={areaPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`}
            className={`rx-area${areaLeaving ? ' rx-area-leaving' : ''}`}/>
        )}

        <path d={linePath} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round"
          clipPath={`url(#${clipId})`}/>

        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={padT + chartH}
              stroke="var(--fg)" strokeOpacity={0.2} strokeWidth={1}/>
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--bg-panel)"
              stroke={accent} strokeWidth={2} className="rx-no-anim"/>
          </g>
        )}
      </svg>

      {hovered && (() => {
        const r   = hovered.row;
        const TW  = 170;
        const rawLeft = hovered.x > svgW * 0.65 ? hovered.x - TW - 16 : hovered.x + 16;
        return (
          <div className="hover-card" style={{
            left: Math.max(4, Math.min(svgW - TW - 4, rawLeft)),
            top:  Math.max(10, Math.min(H - 120, hovered.mouseY - 40)),
          }}>
            <div className="hover-month">{r.day}/{MONTHS_ABR[r.month - 1]}/{r.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-val" style={{color: accent}}>
                  {fmt(r.value)}<span className="hover-unit"> {unit}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── MacroCard ─────────────────────────────────────────────────────────────────

function MacroCard({ meta, rows }) {
  const [range,      setRange]      = useState(null);
  const [chartStyle, setChartStyle] = useState('line');
  const [viewMode,   setViewMode]   = useState('mom');  // 'mom' | 'acum' — só IPCA

  const isIpca = meta.id === 'ipca';
  const isIgpm = meta.id === 'igpm';

  const rangeOpts = (isIpca || isIgpm)
    ? [
        { label: 'LTM',   years: 1    },
        { label: '3a',    years: 3    },
        { label: '5a',    years: 5    },
        { label: '10a',   years: 10   },
        { label: '20a',   years: 20   },
        { label: 'Todos', years: null },
      ]
    : RANGE_OPTS;

  // Série acumulada 12m calculada sobre todo o histórico (para não perder dados nas bordas após filtro)
  const accRows = useMemo(() => {
    if (!isIpca && !isIgpm) return rows;
    return rows.map((row, i) => {
      const slice = rows.slice(Math.max(0, i - 11), i + 1);
      const value = slice.length === 12
        ? slice.reduce((s, r) => s + r.value, 0)
        : null;
      return { ...row, value };
    });
  }, [rows, isIpca, isIgpm]);

  const sourceRows = (isIpca || isIgpm) && viewMode === 'acum' ? accRows : rows;
  const filtered   = useMemo(() => filterRows(sourceRows, range), [sourceRows, range]);

  const displayUnit = (isIpca || isIgpm) && viewMode === 'acum' ? '% a.a.' : meta.unit;

  const latest = sourceRows[sourceRows.length - 1];
  const prev   = sourceRows[sourceRows.length - 2];
  const val    = latest?.value ?? null;
  const delta  = val != null && prev?.value != null ? val - prev.value : null;
  const isUp   = delta != null ? delta >= 0 : null;

  const fmtN = (v, d) => v != null ? v.toFixed(d) : '—';
  const fmtD = (v, d) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(d) : null;
  const dateLabel = latest
    ? `${MONTHS_ABR[latest.month - 1]}/${String(latest.year).slice(2)}`
    : '—';

  return (
    <section className="card card-full">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{meta.eyebrow}</div>
          <h3 className="card-title">{meta.label}</h3>
          <div className="card-price">
            <span className="card-value">{fmtN(val, meta.decimals)}</span>
            <span className="card-unit">{displayUnit}</span>
            {fmtD(delta, meta.decimals) && (
              <span className={`card-delta ${isUp ? 'is-up' : 'is-down'}`}>
                {fmtD(delta, meta.decimals)}
                <span className="card-delta-label"> MoM</span>
              </span>
            )}
            <span className="card-date">{dateLabel}</span>
          </div>
        </div>

        <div className="card-head-right">
          <div className="card-controls">
            <div className="card-ctrl-row">
              <div className="year-seg">
                {rangeOpts.map(o => (
                  <button key={o.label}
                    className={`year-seg-btn ${range === o.years ? 'is-on' : ''}`}
                    onClick={() => setRange(o.years)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-ctrl-row">
              {(isIpca || isIgpm) && (
                <div className="seg">
                  <button className={`seg-btn ${viewMode==='mom'  ? 'is-on' : ''}`} onClick={() => setViewMode('mom')}>%MoM</button>
                  <button className={`seg-btn ${viewMode==='acum' ? 'is-on' : ''}`} onClick={() => setViewMode('acum')}>Acumulado</button>
                </div>
              )}
              <div className="seg">
                <button className={`seg-btn ${chartStyle==='line' ? 'is-on' : ''}`} onClick={() => setChartStyle('line')}>Linha</button>
                <button className={`seg-btn ${chartStyle==='area' ? 'is-on' : ''}`} onClick={() => setChartStyle('area')}>Área</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <window.ContinuousChart
        rows={filtered}
        field="value"
        accent={CHART_GREEN}
        unit={displayUnit}
        decimals={meta.decimals}
        height={220}
        chartStyle={chartStyle}
        zeroBaseline={isIgpm}
        highlightZero={isIgpm}
      />
    </section>
  );
}

// ── PtaxCard ──────────────────────────────────────────────────────────────────

function PtaxCard({ rows, dailyRows }) {
  const meta = PTAX_META;
  const [range,      setRange]      = useState('LTM');
  const [chartStyle, setChartStyle] = useState('line');

  const opt     = PTAX_RANGE_OPTS.find(o => o.label === range) || PTAX_RANGE_OPTS[2];
  const isDaily = opt.daily;

  const monthlyFiltered = useMemo(
    () => filterRows(rows, opt.years ?? null),
    [rows, range]
  );

  const dailyFiltered = useMemo(() => {
    if (!isDaily || !dailyRows?.length) return [];
    const last     = dailyRows[dailyRows.length - 1];
    const lastDate = new Date(last.year, last.month - 1, last.day);
    const cutDate  = new Date(lastDate);
    cutDate.setMonth(cutDate.getMonth() - opt.months);
    return dailyRows.filter(r => new Date(r.year, r.month - 1, r.day) >= cutDate);
  }, [dailyRows, range]);

  const latest    = rows[rows.length - 1];
  const prev      = rows[rows.length - 2];
  const val       = latest?.value ?? null;
  const delta     = val != null && prev?.value != null ? val - prev.value : null;
  const isUp      = delta != null ? delta >= 0 : null;
  const fmtN      = (v, d) => v != null ? v.toFixed(d) : '—';
  const fmtD      = (v, d) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(d) : null;
  const dateLabel = latest
    ? `${MONTHS_ABR[latest.month - 1]}/${String(latest.year).slice(2)}`
    : '—';

  return (
    <section className="card card-full">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{meta.eyebrow}</div>
          <h3 className="card-title">{meta.label}</h3>
          <div className="card-price">
            <span className="card-value">{fmtN(val, meta.decimals)}</span>
            <span className="card-unit">{meta.unit}</span>
            {fmtD(delta, meta.decimals) && (
              <span className={`card-delta ${isUp ? 'is-up' : 'is-down'}`}>
                {fmtD(delta, meta.decimals)}
                <span className="card-delta-label"> MoM</span>
              </span>
            )}
            <span className="card-date">{dateLabel}</span>
          </div>
        </div>

        <div className="card-head-right">
          <div className="card-controls">
            <div className="card-ctrl-row">
              <div className="year-seg">
                {PTAX_RANGE_OPTS.map(o => (
                  <button key={o.label}
                    className={`year-seg-btn ${range === o.label ? 'is-on' : ''}`}
                    onClick={() => setRange(o.label)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-ctrl-row">
              <div className="seg">
                <button className={`seg-btn ${chartStyle==='line' ? 'is-on' : ''}`} onClick={() => setChartStyle('line')}>Linha</button>
                <button className={`seg-btn ${chartStyle==='area' ? 'is-on' : ''}`} onClick={() => setChartStyle('area')}>Área</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDaily ? (
        <PtaxDailyChart
          rows={dailyFiltered}
          accent={CHART_GREEN}
          unit={meta.unit}
          decimals={meta.decimals}
          height={220}
          chartStyle={chartStyle}
        />
      ) : (
        <window.ContinuousChart
          rows={monthlyFiltered}
          field="value"
          accent={CHART_GREEN}
          unit={meta.unit}
          decimals={meta.decimals}
          height={220}
          chartStyle={chartStyle}
        />
      )}
    </section>
  );
}

// ── MacroTab ──────────────────────────────────────────────────────────────────

function MacroTab() {
  const [macroData, setMacroData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    fetch('./macro-data.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setMacroData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <main className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--fg-dim)' }}>
      <span style={{ fontSize: 13 }}>Carregando dados macro…</span>
    </main>
  );

  const series  = macroData?.series ?? {};
  const hasData = Object.values(series).some(s => s?.length > 0);

  if (error || !hasData) return (
    <main className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12, color:'var(--fg-dim)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.35 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <div style={{ fontSize:14, color:'var(--fg)', opacity:0.55 }}>Dados não disponíveis</div>
        <div style={{ fontSize:12, color:'var(--fg-mute)', maxWidth:300, lineHeight:1.5 }}>
          Execute o workflow <strong>update-macro</strong> no GitHub Actions para buscar os dados das APIs.
        </div>
      </div>
    </main>
  );

  return (
    <main className="main">
      {SERIES_META.map(meta => {
        const rows = series[meta.id];
        if (!rows?.length) return null;
        return <MacroCard key={meta.id} meta={meta} rows={rows} />;
      })}
      {series['ptax']?.length > 0 && (
        <PtaxCard
          rows={series['ptax']}
          dailyRows={series['ptax_daily'] ?? []}
        />
      )}
    </main>
  );
}

window.MacroTab = MacroTab;
