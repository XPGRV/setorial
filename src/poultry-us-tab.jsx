// Poultry US Tab — FrangoUS.xlsm · BBG_Dados

const MONTH_DOY_US = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

const FRANGO_US_SERIES = [
  { key: 'proxy',   label: 'Proxy XPG',       unit: 'USD/Kg', note: '41% BB · 48% Legs · 11% Wings' },
  { key: 'chic_bb', label: 'Boneless Breast',  unit: 'USD/Kg', ticker: 'CHICNEBB' },
  { key: 'chic_tn', label: 'Tender',           unit: 'USD/Kg', ticker: 'CHICNETN' },
  { key: 'chic_lq', label: 'Legs',             unit: 'USD/Kg', ticker: 'CHICNELQ' },
  { key: 'chic_wi', label: 'Wings',            unit: 'USD/Kg', ticker: 'CHICNEWI' },
];

const EVENTS_FRANGO_US = [
  { year: 2003, month: 12, label: 'BSE nos EUA — demanda migra para frango como substituto de bovina' },
  { year: 2008, month: 7,  label: 'Crise financeira global — maior queda no consumo de carnes desde 1982' },
  { year: 2014, month: 8,  label: 'Embargo russo — EUA perde ~$153M em exportações de frango' },
  { year: 2015, month: 3,  label: 'HPAI H5N2 — ~50M aves; 17 países fecham mercado; -$869M em exportações' },
  { year: 2018, month: 7,  label: 'Guerra comercial EUA-China — tarifas retaliatórias de 15%+ sobre frango' },
  { year: 2019, month: 6,  label: 'Gripe suína africana (ASF) na China — rebanho suíno -40%; demanda global de proteínas sobe' },
  { year: 2020, month: 4,  label: 'COVID-19 — fechamento de plantas processadoras; -15% capacidade de abate' },
  { year: 2021, month: 2,  label: 'Winter Storm Uri — queda de energia no Sul dos EUA; mortalidade em granjas e plantas de abate paralisadas' },
  { year: 2022, month: 2,  label: 'HPAI H5N1 reemergência — 168M aves afetadas; maior surto histórico' },
  { year: 2023, month: 8,  label: 'Tyson fecha 4 plantas de frango nos EUA — 3.000+ demissões' },
  { year: 2024, month: 3,  label: 'HPAI confirmada em bovinos leiteiros (spillover para mamíferos)' },
];

const EVENTS_FEED_GRAIN = [
  { year: 2005, month: 8,  label: 'RFS (Renewable Fuel Standard) — mandato federal de etanol pressiona demanda estrutural de milho' },
  { year: 2007, month: 12, label: 'Expansão do RFS — obrigação de etanol dobra; milho +30% estrutural' },
  { year: 2008, month: 6,  label: 'Crise alimentar global — milho a $7,50/bu (+119% a/a); custo de ração dobra' },
  { year: 2012, month: 7,  label: 'Seca severa EUA — 78% da safra de milho afetada; alta histórica de grãos' },
  { year: 2020, month: 4,  label: 'COVID-19 — disrupção de cadeias de suprimento' },
  { year: 2022, month: 2,  label: 'Invasão da Ucrânia — choque em commodities agrícolas; milho e soja disparam' },
];

const EVENTS_SPREAD = [
  { year: 2008, month: 6,  label: 'Crise alimentar — custo de ração dobra + recessão; spread espremido ao mínimo' },
  { year: 2015, month: 3,  label: 'HPAI H5N2 — redução de oferta eleva preços; spread em alta' },
  { year: 2019, month: 6,  label: 'ASF na China — preços de frango EUA sobem; grãos em baixa; spread favorável' },
  { year: 2020, month: 4,  label: 'COVID-19 — fechamento de plantas comprime spread' },
  { year: 2022, month: 2,  label: 'HPAI H5N1 + guerra na Ucrânia — duplo choque de oferta e custo' },
  { year: 2024, month: 12, label: 'Pico HPAI invernal — 41M aves em 2 meses; ovos +60% a/a' },
];

// ── Daily stats (igual ao beef-us-tab) ───────────────────────────────────────
function buildDailyStatsUS(byYear, histYears) {
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

// ── Chart ─────────────────────────────────────────────────────────────────────
const FrangoUSChart = ({
  byYear, allYears, selectedYears, pinnedYear, setPinnedYear,
  chartStyle, showStats, showEvents, events, accent, unit, decimals = 3, chartId = 'us',
}) => {
  const W = 1000, H = 380;
  const padL = 68, padR = 24, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const latestYear = Math.max(...selectedYears);
  const sortedAsc  = [...selectedYears].sort((a, b) => a - b);
  const { displayYears, isLeaving } = window.useTrackedYears(selectedYears);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = window.useFadeOut(chartStyle === 'area', 400);
  const { shouldRender: showStatsRender, isLeaving: statsLeaving } = window.useFadeOut(showStats, 500);
  const { shouldRender: showEventsRender, isLeaving: eventsLeaving } = window.useFadeOut(showEvents, 400);

  const [hover, setHover] = React.useState(null);
  const [mouseY, setMouseY] = React.useState(0);
  React.useEffect(() => { setHover(null); }, [selectedYears.join(',')]);

  const { vMin, vMax, step } = React.useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const yr of selectedYears) {
      for (const p of (byYear[yr] || [])) {
        if (p.value < lo) lo = p.value;
        if (p.value > hi) hi = p.value;
      }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const range = hi - lo;
    const raw = range / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => range / s <= 8) || mag * 10;
    return {
      vMin: Math.floor((lo - range * 0.05) / step) * step,
      vMax: Math.ceil( (hi + range * 0.15) / step) * step,
      step,
    };
  }, [byYear, selectedYears.join(',')]);

  const stats = React.useMemo(() => {
    if (!showStatsRender) return {};
    const latest = Math.max(...allYears);
    const fromYr = Math.max(allYears[0], latest - 10);
    const histYears = allYears.filter(y => y >= fromYr && y < latest);
    return buildDailyStatsUS(byYear, histYears);
  }, [byYear, allYears, showStatsRender]);

  const xFn = doy => padL + ((doy - 1) / 364) * chartW;
  const yFn = v   => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;

  const LATEST_COLOR = 'oklch(0.82 0.18 155)';
  const yearColor = yr => {
    const palette = ['oklch(0.75 0.15 200)','oklch(0.68 0.16 255)','oklch(0.74 0.15 310)','oklch(0.78 0.17 35)','oklch(0.80 0.15 60)','oklch(0.72 0.16 0)','oklch(0.76 0.13 170)'];
    const age = latestYear - yr;
    if (age === 0) return LATEST_COLOR;
    return age - 1 < palette.length ? palette[age - 1] : 'oklch(0.48 0.01 260)';
  };
  const seriesOpacity = yr => (!pinnedYear ? (yr === latestYear ? 1 : 0.7) : (yr === pinnedYear ? 1 : 0.1));
  const seriesWidth   = yr => (pinnedYear ? (yr === pinnedYear ? 2.5 : 1) : (yr === latestYear ? 2 : 1.25));

  const buildPath = pts =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFn(p.doy).toFixed(1)},${yFn(p.value).toFixed(1)}`).join(' ');

  const buildArea = pts => {
    if (!pts.length) return '';
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFn(p.doy).toFixed(1)},${yFn(p.value).toFixed(1)}`).join(' ');
    return top + ` L${xFn(pts[pts.length-1].doy).toFixed(1)},${yFn(0).toFixed(1)} L${xFn(pts[0].doy).toFixed(1)},${yFn(0).toFixed(1)} Z`;
  };

  const yTicks = [];
  for (let v = vMin; v <= vMax + step * 0.01; v = Math.round((v + step) * 1e6) / 1e6) yTicks.push(v);

  const statsDoys    = Object.keys(stats).map(Number).sort((a,b)=>a-b);
  const statsMaxPath = statsDoys.map((d,i)=>`${i===0?'M':'L'}${xFn(d).toFixed(1)},${yFn(stats[d].max).toFixed(1)}`).join(' ');
  const statsMinPath = [...statsDoys].reverse().map(d=>`L${xFn(d).toFixed(1)},${yFn(stats[d].min).toFixed(1)}`).join(' ');
  const statsP75Path = statsDoys.map((d,i)=>`${i===0?'M':'L'}${xFn(d).toFixed(1)},${yFn(stats[d].p75).toFixed(1)}`).join(' ');
  const statsP25Path = [...statsDoys].reverse().map(d=>`L${xFn(d).toFixed(1)},${yFn(stats[d].p25).toFixed(1)}`).join(' ');
  const statsMeanPath= statsDoys.map((d,i)=>`${i===0?'M':'L'}${xFn(d).toFixed(1)},${yFn(stats[d].mean).toFixed(1)}`).join(' ');

  const eventsInView = React.useMemo(() => {
    if (!showEventsRender) return [];
    return (events||[]).filter(e => selectedYears.includes(e.year) && (!pinnedYear || e.year === pinnedYear));
  }, [showEventsRender, selectedYears, pinnedYear, events]);

  const EVENT_COLOR = 'oklch(0.85 0.18 80)';

  const getHoverPoint = (yr, doy) => {
    const pts = byYear[yr] || [];
    let best = null, bestD = Infinity;
    for (const p of pts) { const d = Math.abs(p.doy - doy); if (d < bestD) { bestD = d; best = p; } }
    return bestD <= 4 ? best : null;
  };

  const doyToLabel = doy => {
    let mo = 0;
    for (let m = 11; m >= 0; m--) { if (doy > MONTH_DOY_US[m]) { mo = m; break; } }
    return `${doy - MONTH_DOY_US[mo]} ${window.MONTHS_PT[mo]}`;
  };

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const doy = Math.round(1 + ((px - padL) / chartW) * 364);
    setHover(Math.max(1, Math.min(365, doy)));
    setMouseY(py);
  };

  const gradId = `frango-us-grad-${chartId}`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {sortedAsc.map(yr => {
            const pts = byYear[yr] || [];
            const zeroY = yFn(0);
            const extremeY = pts.length ? pts.reduce((best, p) => {
              const py = yFn(p.value);
              return Math.abs(py - zeroY) > Math.abs(best - zeroY) ? py : best;
            }, yFn(pts[0].value)) : zeroY - 50;
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

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W-padR} y1={yFn(v)} y2={yFn(v)} className="grid-line"/>
            <text x={padL-6} y={yFn(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {window.fmt(v, {decimals})}
            </text>
          </g>
        ))}

        {MONTH_DOY_US.map((doy, mi) => (
          <g key={mi}>
            <line x1={xFn(doy+1)} x2={xFn(doy+1)} y1={padT} y2={H-padB} className="grid-line" opacity="0.3"/>
            <text x={xFn(doy+16)} y={H-padB+16} className="tick-label" textAnchor="middle">{window.MONTHS_PT[mi]}</text>
          </g>
        ))}

        {showStatsRender && statsDoys.length > 0 && (
          <g clipPath={`url(#clip-${gradId})`}>
            <path d={statsMaxPath + ' ' + statsMinPath + ' Z'} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.05}}/>
            <path d={statsP75Path + ' ' + statsP25Path + ' Z'} fill="var(--fg)" className={`rx-stat-band${statsLeaving ? ' rx-stat-leaving' : ''}`} style={{'--rx-stat-op': 0.08}}/>
            <path d={statsMeanPath} stroke="var(--fg)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" fill="none" className={`rx-stat-mean${statsLeaving ? ' rx-stat-leaving' : ''}`}/>
          </g>
        )}

        <g clipPath={`url(#clip-${gradId})`}>
          {showAreaRender && displayYears.map(yr => {
            const pts = byYear[yr] || [];
            if (!pts.length) return null;
            const leaving = isLeaving(yr);
            return <path key={yr} d={buildArea(pts)} fill={`url(#${gradId}-${yr})`}
              style={{'--rx-area-op': seriesOpacity(yr)}}
              className={`rx-area ${leaving ? 'rx-leaving' : ''} ${areaLeaving ? 'rx-area-leaving' : ''}`}/>;
          })}
          {displayYears.map(yr => {
            const pts = byYear[yr] || [];
            if (!pts.length) return null;
            const leaving = isLeaving(yr);
            return (
              <g key={yr}>
                <path
                  ref={el => { if (el) { try { el.style.setProperty('--len', el.getTotalLength()); } catch(_){} } }}
                  d={buildPath(pts)} fill="none" stroke={yearColor(yr)}
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

        {eventsInView.map((ev, i) => {
          const doy = MONTH_DOY_US[ev.month - 1] + 15;
          const pts = byYear[ev.year] || [];
          let best = null, bestD = Infinity;
          for (const p of pts) { const d = Math.abs(p.doy - doy); if (d < bestD) { bestD = d; best = p; } }
          if (!best) return null;
          const cx = xFn(best.doy), cy = yFn(best.value);
          const isPinned = ev.year === pinnedYear;

          const leftThird  = padL + chartW / 3;
          const rightThird = padL + (chartW * 2) / 3;
          let anchor, lx;
          if (cx < leftThird)       { anchor = 'start'; lx = Math.max(padL, cx); }
          else if (cx > rightThird) { anchor = 'end';   lx = Math.min(W - padR, cx); }
          else                      { anchor = 'middle'; lx = cx; }

          const wrapLines = (() => {
            const words = ev.label.split(' ');
            const lines = [];
            let cur = '';
            for (const w of words) {
              const candidate = cur ? cur + ' ' + w : w;
              if (candidate.length <= 48) { cur = candidate; }
              else { if (cur) lines.push(cur); cur = w; }
            }
            if (cur) lines.push(cur);
            return lines;
          })();

          return (
            <g key={i} className={eventsLeaving ? 'rx-events-leaving' : ''}>
              <window.EventDot cx={cx} cy={cy} r={isPinned ? 5 : 3}
                fill={isPinned ? 'var(--bg)' : EVENT_COLOR} stroke={EVENT_COLOR} strokeWidth={1.5}
                delaySec={0}/>
              {isPinned && <line className="rx-event-beam" x1={cx} y1={padT + wrapLines.length * 13 + 4} x2={cx} y2={cy-6} stroke={EVENT_COLOR} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.6}/>}
              {isPinned && (
                <text x={lx} y={padT} textAnchor={anchor} dominantBaseline="hanging"
                  style={{fontFamily:'var(--font-mono)', fontSize:10, fill:EVENT_COLOR, fontWeight:600}}>
                  {wrapLines.map((line, li) => (
                    <tspan key={li} x={lx} dy={li === 0 ? 0 : 13}>{line}</tspan>
                  ))}
                </text>
              )}
            </g>
          );
        })}

        {hover != null && (
          <g>
            <line x1={xFn(hover)} x2={xFn(hover)} y1={padT} y2={H-padB} stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            {sortedAsc.map(yr => {
              const pt = getHoverPoint(yr, hover);
              if (!pt) return null;
              return (
                <circle key={yr} cx={xFn(pt.doy)} cy={yFn(pt.value)}
                  r={yr === pinnedYear ? 5 : yr === latestYear ? 4 : 3}
                  fill="var(--bg)" stroke={yearColor(yr)}
                  strokeWidth={yr === pinnedYear ? 2.5 : yr === latestYear ? 2 : 1.25}
                  className="rx-no-anim"
                  style={{cursor:'pointer'}}
                  onClick={() => setPinnedYear(p => p === yr ? null : yr)}/>
              );
            })}
          </g>
        )}

        <line x1={padL} x2={W-padR} y1={H-padB} y2={H-padB} className="axis-line"/>
        <line x1={padL} x2={padL}   y1={padT}    y2={H-padB} className="axis-line"/>
      </svg>

      {hover != null && (() => {
        const rows = [...sortedAsc].reverse()
          .map(yr => ({ yr, pt: getHoverPoint(yr, hover) }))
          .filter(r => r.pt);
        if (!rows.length) return null;
        const statEntry = stats[hover] || stats[hover-1] || stats[hover+1];
        const xPos = xFn(hover);
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
                  <span className="hover-val">{window.fmt(pt.value, {decimals})}<span className="hover-unit"> {unit}</span></span>
                </div>
              ))}
              {showStats && statEntry && (
                <div className="hover-row hover-stat">
                  <span className="hover-year">média {statEntry.n}a</span>
                  <span className="hover-val">{window.fmt(statEntry.mean, {decimals})}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

const CUTS = FRANGO_US_SERIES.filter(s => s.key !== 'proxy');

// ── Controls (price card — com dropdown de corte) ─────────────────────────────
function FrangoUSControls({
  years, selectedYears, setSelectedYears,
  showStats, setShowStats, showEvents, setShowEvents,
  chartStyle, setChartStyle,
  activeSeries, setActiveSeries,
}) {
  const { useState, useEffect, useRef } = React;
  const [yearDropOpen, setYearDropOpen] = useState(false);
  const [cutDropOpen,  setCutDropOpen]  = useState(false);
  const yearDropRef = useRef(null);
  const cutDropRef  = useRef(null);

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
    prev.includes(yr) ? (prev.length === 1 ? prev : prev.filter(y => y !== yr)) : [...prev, yr].sort((a,b)=>a-b)
  );

  useEffect(() => {
    if (!yearDropOpen) return;
    const h = e => { if (yearDropRef.current && !yearDropRef.current.contains(e.target)) setYearDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [yearDropOpen]);

  useEffect(() => {
    if (!cutDropOpen) return;
    const h = e => { if (cutDropRef.current && !cutDropRef.current.contains(e.target)) setCutDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [cutDropOpen]);

  const activeCut  = CUTS.find(s => s.key === activeSeries);
  const cutLabel   = activeCut ? activeCut.label : 'Corte';

  const selectCut = key => {
    setActiveSeries(key === activeSeries ? 'proxy' : key);
    setCutDropOpen(false);
  };

  return (
    <div className="card-controls">
      <div className="card-ctrl-row">
        <div className="year-seg">
          {presets.map(p => (
            <button key={p.label}
              className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`}
              onClick={() => setSelectedYears(p.yrs.filter(y => years.includes(y)))}>
              {p.label}
            </button>
          ))}
          <div className="year-drop-wrap" ref={yearDropRef}>
            <button className={`year-seg-btn ${yearDropOpen ? 'is-active' : ''} ${!activePreset && !yearDropOpen ? 'is-on' : ''}`}
              onClick={() => setYearDropOpen(o => !o)}>
              Anos ▾
            </button>
            {yearDropOpen && (
              <div className="year-drop">
                {years.slice().reverse().map(yr => (
                  <div key={yr} className={`year-drop-item ${selectedYears.includes(yr) ? 'is-on' : ''}`}
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

      <div className="card-ctrl-row">
        <div className="ctrl-btn-group">
          <button className={`ctrl-btn ${showStats ? 'is-on' : ''}`} onClick={() => setShowStats(s => !s)}>MÉDIA + FAIXA</button>
          <button className={`ctrl-btn ${showEvents ? 'is-on' : ''}`} onClick={() => setShowEvents(s => !s)}>EVENTOS</button>
          <div className="year-drop-wrap" ref={cutDropRef}>
            <button className={`ctrl-btn ${activeCut ? 'is-on' : ''} ${cutDropOpen ? 'is-active' : ''}`}
              onClick={() => setCutDropOpen(o => !o)}>
              {cutLabel} ▾
            </button>
            {cutDropOpen && (
              <div className="year-drop">
                {CUTS.map(s => (
                  <div key={s.key} className={`year-drop-item ${activeSeries === s.key ? 'is-on' : ''}`}
                    onClick={() => selectCut(s.key)}
                    style={{justifyContent:'space-between'}}>
                    <span style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{width:12, flexShrink:0, textAlign:'center', fontSize:10, color:'var(--accent)'}}>
                        {activeSeries === s.key ? '✓' : ''}
                      </span>
                      {s.label}
                    </span>
                    {s.ticker && <span style={{opacity:0.5, fontSize:10, flexShrink:0}}>{s.ticker}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
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

// ── Controls simples (Feed Grain e Spread — sem dropdown de corte) ────────────
function FrangoUSSimpleControls({
  years, selectedYears, setSelectedYears,
  showStats, setShowStats, showEvents, setShowEvents,
  chartStyle, setChartStyle,
}) {
  const { useState, useEffect, useRef } = React;
  const [yearDropOpen, setYearDropOpen] = useState(false);
  const yearDropRef = useRef(null);

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
    prev.includes(yr) ? (prev.length === 1 ? prev : prev.filter(y => y !== yr)) : [...prev, yr].sort((a,b)=>a-b)
  );

  useEffect(() => {
    if (!yearDropOpen) return;
    const h = e => { if (yearDropRef.current && !yearDropRef.current.contains(e.target)) setYearDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [yearDropOpen]);

  return (
    <div className="card-controls">
      <div className="card-ctrl-row">
        <div className="year-seg">
          {presets.map(p => (
            <button key={p.label}
              className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`}
              onClick={() => setSelectedYears(p.yrs.filter(y => years.includes(y)))}>
              {p.label}
            </button>
          ))}
          <div className="year-drop-wrap" ref={yearDropRef}>
            <button className={`year-seg-btn ${yearDropOpen ? 'is-active' : ''} ${!activePreset && !yearDropOpen ? 'is-on' : ''}`}
              onClick={() => setYearDropOpen(o => !o)}>
              Anos ▾
            </button>
            {yearDropOpen && (
              <div className="year-drop">
                {years.slice().reverse().map(yr => (
                  <div key={yr} className={`year-drop-item ${selectedYears.includes(yr) ? 'is-on' : ''}`}
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
      <div className="card-ctrl-row">
        <div className="ctrl-btn-group">
          <button className={`ctrl-btn ${showStats ? 'is-on' : ''}`} onClick={() => setShowStats(s => !s)}>MÉDIA + FAIXA</button>
          <button className={`ctrl-btn ${showEvents ? 'is-on' : ''}`} onClick={() => setShowEvents(s => !s)}>EVENTOS</button>
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

// ── Price Card ────────────────────────────────────────────────────────────────
const FrangoUSPriceCard = ({ data, accent }) => {
  const allPoints = React.useMemo(() => data.frango_us_daily || [], [data]);

  const [activeSeries, setActiveSeries] = React.useState('proxy');
  const [chartStyle, setChartStyle]     = React.useState('line');
  const [showStats, setShowStats]       = React.useState(false);
  const [showEvents, setShowEvents]     = React.useState(true);
  const [pinnedYear, setPinnedYear]     = React.useState(null);

  const seriesMeta = FRANGO_US_SERIES.find(s => s.key === activeSeries);

  const byYear = React.useMemo(() => {
    const out = {};
    for (const r of allPoints) {
      const v = r[activeSeries];
      if (v == null) continue;
      if (!out[r.year]) out[r.year] = [];
      out[r.year].push({ doy: MONTH_DOY_US[r.month - 1] + r.day, value: v });
    }
    for (const yr of Object.keys(out)) out[yr].sort((a, b) => a.doy - b.doy);
    return out;
  }, [allPoints, activeSeries]);

  const allYears = React.useMemo(() => Object.keys(byYear).map(Number).sort((a,b)=>a-b), [byYear]);

  const [selectedYears, setSelectedYears] = React.useState(() => allYears.slice(-5));

  React.useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0)
      setSelectedYears(allYears.slice(-5));
  }, [allYears.join(',')]);

  React.useEffect(() => { setPinnedYear(null); }, [selectedYears.join(','), activeSeries]);

  const latestRaw = React.useMemo(() => {
    return [...allPoints].filter(r => r[activeSeries] != null)
      .sort((a,b) => a.year!==b.year ? a.year-b.year : a.month!==b.month ? a.month-b.month : a.day-b.day)
      .slice(-1)[0] || null;
  }, [allPoints, activeSeries]);

  const yoyRaw = React.useMemo(() => {
    if (!latestRaw) return null;
    const candidates = allPoints.filter(r =>
      r.year === latestRaw.year - 1 && r.month === latestRaw.month && r[activeSeries] != null
    );
    let best = null, bestD = Infinity;
    for (const r of candidates) { const d = Math.abs(r.day - latestRaw.day); if (d < bestD) { bestD = d; best = r; } }
    return best;
  }, [allPoints, latestRaw, activeSeries]);

  const yoy = latestRaw && yoyRaw
    ? (latestRaw[activeSeries] - yoyRaw[activeSeries]) / Math.abs(yoyRaw[activeSeries])
    : null;
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

  return (
    <section className="card card-full" data-card-id="us-frango-price">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">
            Bloomberg · {seriesMeta.ticker || 'Proxy XPG'} · Preço Frango EUA
            {seriesMeta.note && <span style={{marginLeft:8,opacity:0.6,fontSize:10}}>{seriesMeta.note}</span>}
          </div>
          <h3 className="card-title">{seriesMeta.label}</h3>
          <div className="card-price">
            {latestRaw && (<>
              <span className="card-value">{window.fmt(latestRaw[activeSeries], {decimals:3})}</span>
              <span className="card-unit">{seriesMeta.unit}</span>
              <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
              </span>
              <span className="card-date" style={{marginLeft:0}}>
                {window.MONTHS_PT[latestRaw.month - 1]}/{String(latestRaw.year).slice(-2)}
              </span>
            </>)}
          </div>
        </div>
        <FrangoUSControls
          years={allYears}
          selectedYears={selectedYears} setSelectedYears={setSelectedYears}
          showStats={showStats} setShowStats={setShowStats}
          showEvents={showEvents} setShowEvents={setShowEvents}
          chartStyle={chartStyle} setChartStyle={setChartStyle}
          activeSeries={activeSeries} setActiveSeries={setActiveSeries}
        />
      </div>
      <FrangoUSChart
        byYear={byYear} allYears={allYears}
        selectedYears={selectedYears}
        pinnedYear={pinnedYear} setPinnedYear={setPinnedYear}
        chartStyle={chartStyle}
        showStats={showStats} showEvents={showEvents}
        events={EVENTS_FRANGO_US}
        accent={accent}
        unit={seriesMeta.unit}
        chartId="us-frango-price"
      />
    </section>
  );
};

// ── Card genérico para Feed Grain e Spread ────────────────────────────────────
const FrangoUSSimpleCard = ({ data, seriesKey, cardId, title, eyebrow, unit, events, accent, defaultYears, decimals = 3, scale = 1 }) => {
  const allPoints = React.useMemo(() => data.frango_us_daily || [], [data]);

  const [chartStyle, setChartStyle] = React.useState('line');
  const [showStats, setShowStats]   = React.useState(false);
  const [showEvents, setShowEvents] = React.useState(true);
  const [pinnedYear, setPinnedYear] = React.useState(null);

  const byYear = React.useMemo(() => {
    const out = {};
    for (const r of allPoints) {
      const v = r[seriesKey];
      if (v == null) continue;
      if (!out[r.year]) out[r.year] = [];
      out[r.year].push({ doy: MONTH_DOY_US[r.month - 1] + r.day, value: v * scale });
    }
    for (const yr of Object.keys(out)) out[yr].sort((a, b) => a.doy - b.doy);
    return out;
  }, [allPoints, seriesKey, scale]);

  const allYears = React.useMemo(() => Object.keys(byYear).map(Number).sort((a,b)=>a-b), [byYear]);

  const initYears = () => allYears.slice(-(defaultYears || 5));
  const [selectedYears, setSelectedYears] = React.useState(initYears);

  React.useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0)
      setSelectedYears(allYears.slice(-(defaultYears || 5)));
  }, [allYears.join(',')]);

  React.useEffect(() => { setPinnedYear(null); }, [selectedYears.join(',')]);

  const latestRaw = React.useMemo(() => {
    return [...allPoints].filter(r => r[seriesKey] != null)
      .sort((a,b) => a.year!==b.year ? a.year-b.year : a.month!==b.month ? a.month-b.month : a.day-b.day)
      .slice(-1)[0] || null;
  }, [allPoints, seriesKey]);

  const yoyRaw = React.useMemo(() => {
    if (!latestRaw) return null;
    const candidates = allPoints.filter(r =>
      r.year === latestRaw.year - 1 && r.month === latestRaw.month && r[seriesKey] != null
    );
    let best = null, bestD = Infinity;
    for (const r of candidates) { const d = Math.abs(r.day - latestRaw.day); if (d < bestD) { bestD = d; best = r; } }
    return best;
  }, [allPoints, latestRaw, seriesKey]);

  const yoy = latestRaw && yoyRaw
    ? (latestRaw[seriesKey] - yoyRaw[seriesKey]) / Math.abs(yoyRaw[seriesKey])
    : null;
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

  if (!allYears.length) return null;

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{eyebrow}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price">
            {latestRaw && (<>
              <span className="card-value">{window.fmt(latestRaw[seriesKey] * scale, {decimals})}</span>
              <span className="card-unit">{unit}</span>
              <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
              </span>
              <span className="card-date" style={{marginLeft:0}}>
                {window.MONTHS_PT[latestRaw.month - 1]}/{String(latestRaw.year).slice(-2)}
              </span>
            </>)}
          </div>
        </div>
        <FrangoUSSimpleControls
          years={allYears}
          selectedYears={selectedYears} setSelectedYears={setSelectedYears}
          showStats={showStats} setShowStats={setShowStats}
          showEvents={showEvents} setShowEvents={setShowEvents}
          chartStyle={chartStyle} setChartStyle={setChartStyle}
        />
      </div>
      <FrangoUSChart
        byYear={byYear} allYears={allYears}
        selectedYears={selectedYears}
        pinnedYear={pinnedYear} setPinnedYear={setPinnedYear}
        chartStyle={chartStyle}
        showStats={showStats} showEvents={showEvents}
        events={events}
        accent={accent}
        unit={unit}
        decimals={decimals}
        chartId={cardId}
      />
    </section>
  );
};

// ── Poultry / Beef Ratio ─────────────────────────────────────────────────────

const RATIO_ACCENT = 'oklch(0.82 0.18 155)';

function filterRatioByRange(rows, rangeYears) {
  if (!rows.length || rangeYears === 'all') return rows;
  const last = rows[rows.length - 1];
  const cutOrd = last.year * 12 + last.month - rangeYears * 12;
  return rows.filter(r => r.year * 12 + r.month > cutOrd);
}

const PoultryBeefChart = ({ allRows, filteredRows, mean, chartStyle, prevFirstT = null }) => {
  const W = 1000, H = 340;
  const padL = 64, padR = 24, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const rows = filteredRows;
  const [hover, setHover] = React.useState(null);
  const [mouseY, setMouseY] = React.useState(0);
  const { shouldRender: showAreaRender, isLeaving: areaLeaving } = window.useFadeOut(chartStyle === 'area', 400);

  if (!rows.length) return null;

  const vals   = rows.map(r => r.poultry_beef_ratio);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const pad    = (rawMax - rawMin) * 0.1 || 0.05;
  const vMin   = Math.min(rawMin - pad, mean - pad * 2);
  const vMax   = Math.max(rawMax + pad, mean + pad * 2);

  const tOf    = r => r.year + (r.month - 1) / 12 + (r.day - 0.5) / 365.25;
  const tFirst = tOf(rows[0]);
  const tLast  = tOf(rows[rows.length - 1]);
  const span   = tLast - tFirst || 1;
  const xOf    = r => padL + ((tOf(r) - tFirst) / span) * chartW;
  const yOf    = v => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;
  const meanY  = yOf(mean);

  // Draw animation: when expanding range, only animate the newly revealed (left) portion
  const hasPartial   = prevFirstT != null && prevFirstT > tFirst;
  const clipStartPct = hasPartial
    ? ((padL + ((prevFirstT - tFirst) / span) * chartW) / W * 100).toFixed(1) + '%'
    : null;
  const lineAnim = hasPartial
    ? 'bm-line-draw-partial 1.2s cubic-bezier(0.4, 0, 0.2, 1) backwards'
    : 'bm-line-draw 1.2s cubic-bezier(0.4, 0, 0.2, 1) backwards';

  // Y ticks
  const vRange   = vMax - vMin;
  const rawStep  = vRange / 5;
  const mag      = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceStep = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => vRange / s <= 8) || mag * 10;
  const yTicks   = [];
  for (let v = Math.ceil(vMin / niceStep) * niceStep; v <= vMax + niceStep * 0.01; v = Math.round((v + niceStep) * 1e6) / 1e6)
    yTicks.push(v);

  // X ticks
  const spanYears  = tLast - tFirst;
  const stepMons   = spanYears <= 3.5 ? 6 : spanYears <= 6 ? 12 : 24;
  const firstOrd   = rows[0].year * 12 + rows[0].month - 1;
  const lastOrd    = rows[rows.length - 1].year * 12 + rows[rows.length - 1].month - 1;
  const tickStart  = Math.ceil(firstOrd / stepMons) * stepMons;
  const xTicks     = [];
  for (let ord = tickStart; ord <= lastOrd; ord += stepMons) {
    const yr    = Math.floor(ord / 12);
    const mo    = (ord % 12) + 1;
    const t     = yr + (mo - 1) / 12;
    const xx    = padL + ((t - tFirst) / span) * chartW;
    const label = stepMons === 6
      ? `${window.MONTHS_PT[mo - 1]}/${String(yr).slice(-2)}`
      : String(yr);
    xTicks.push({ x: xx, label });
  }

  const linePath = rows.map((r, i) =>
    `${i === 0 ? 'M' : 'L'}${xOf(r).toFixed(1)},${yOf(r.poultry_beef_ratio).toFixed(1)}`
  ).join(' ');

  // Area closes at the mean line
  const areaPath = linePath
    + ` L${xOf(rows[rows.length - 1]).toFixed(1)},${meanY.toFixed(1)}`
    + ` L${xOf(rows[0]).toFixed(1)},${meanY.toFixed(1)} Z`;

  const gradId  = 'pbr-grad';
  const clipId  = 'pbr-clip';
  // 3-stop gradient: opaque at top, transparent at mean, opaque at bottom
  const topPx   = padT;
  const botPx   = padT + chartH;
  const meanPct = ((meanY - topPx) / (botPx - topPx) * 100).toFixed(1);

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px   = (e.clientX - rect.left) * (W / rect.width);
    const py   = (e.clientY - rect.top)  * (H / rect.height);
    const t    = tFirst + ((px - padL) / chartW) * span;
    let best = null, bestD = Infinity;
    for (const r of rows) { const d = Math.abs(tOf(r) - t); if (d < bestD) { bestD = d; best = r; } }
    setHover(best || null);
    setMouseY(py);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0"
            y1={topPx} y2={botPx} gradientUnits="userSpaceOnUse">
            <stop offset="0%"            stopColor={RATIO_ACCENT} stopOpacity="0.28"/>
            <stop offset={`${meanPct}%`} stopColor={RATIO_ACCENT} stopOpacity="0"/>
            <stop offset="100%"          stopColor={RATIO_ACCENT} stopOpacity="0.28"/>
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
        </defs>

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} className="grid-line"/>
            <text x={padL - 6} y={yOf(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {window.fmt(v, {decimals: 2})}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT} y2={H - padB} className="grid-line" opacity="0.3"/>
            <text x={t.x} y={H - padB + 16} className="tick-label" textAnchor="middle">{t.label}</text>
          </g>
        ))}

        {showAreaRender && (
          <path d={areaPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`}
            style={{'--rx-area-op': 1}}
            className={`rx-area${areaLeaving ? ' rx-area-leaving' : ''}`}/>
        )}

        <path d={linePath} fill="none" stroke={RATIO_ACCENT} strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`}
          style={{'--bm-clip-left': clipStartPct ?? '100%', animation: lineAnim}}/>

        {/* Média histórica — linha pontilhada */}
        <line x1={padL} x2={W - padR} y1={meanY} y2={meanY}
          stroke="var(--fg)" strokeOpacity="0.45" strokeWidth={1} strokeDasharray="4 3"/>

        {hover && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={padT} y2={H - padB}
              stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            <circle cx={xOf(hover)} cy={yOf(hover.poultry_beef_ratio)} r={4}
              fill="var(--bg)" stroke={RATIO_ACCENT} strokeWidth={2}/>
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis-line"/>
        <line x1={padL} x2={padL}     y1={padT}     y2={H - padB} className="axis-line"/>
      </svg>

      {hover && (() => {
        const xPos    = xOf(hover);
        const isRight = xPos > W * 0.75;
        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 120, mouseY - 40)),
            transform: isRight ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">{window.MONTHS_PT[hover.month - 1]}/{hover.year}</div>
            <div className="hover-rows">
              <div className="hover-row">
                <span className="hover-year" style={{color: RATIO_ACCENT}}>Ratio</span>
                <span className="hover-val">{window.fmt(hover.poultry_beef_ratio, {decimals: 3})}</span>
              </div>
              <div className="hover-row hover-stat">
                <span className="hover-year">Média hist.</span>
                <span className="hover-val">{window.fmt(mean, {decimals: 3})}</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="ciclo-legend">
        <span className="legend-year" style={{userSelect: 'none', padding: '2px 6px'}}>
          <span className="legend-line" style={{background: RATIO_ACCENT}}/>
          Poultry / Beef
        </span>
        <span className="legend-year" style={{opacity: 0.6, userSelect: 'none', padding: '2px 6px'}}>
          <span style={{display:'inline-block',width:16,height:2,borderTop:'2px dashed var(--fg)',opacity:0.5,verticalAlign:'middle',marginRight:2}}/>
          Média histórica
        </span>
      </div>
    </div>
  );
};

const PoultryBeefCard = ({ data }) => {
  const allRows = React.useMemo(
    () => (data.frango_us_daily || []).filter(r => r.poultry_beef_ratio != null),
    [data]
  );
  const [range, setRange]           = React.useState('5');
  const [chartStyle, setChartStyle] = React.useState('line');
  const [prevFirstT, setPrevFirstT] = React.useState(null);

  const mean = React.useMemo(() => {
    if (!allRows.length) return 0;
    return allRows.reduce((s, r) => s + r.poultry_beef_ratio, 0) / allRows.length;
  }, [allRows]);

  const rangeNum     = range === 'all' ? 'all' : parseInt(range);
  const filteredRows = React.useMemo(() => filterRatioByRange(allRows, rangeNum), [allRows, rangeNum]);

  const tOf = r => r.year + (r.month - 1) / 12 + (r.day - 0.5) / 365.25;
  const changeRange = React.useCallback((val) => {
    const oldN = range === 'all' ? Infinity : parseInt(range);
    const newN = val   === 'all' ? Infinity : parseInt(val);
    if (newN > oldN && filteredRows.length) {
      setPrevFirstT(tOf(filteredRows[0]));
    } else {
      setPrevFirstT(null);
    }
    setRange(val);
  }, [range, filteredRows]);

  if (!allRows.length) return null;

  const last   = allRows[allRows.length - 1];
  const yoyRow = [...allRows].reverse().find(r => r.year === last.year - 1 && r.month === last.month);
  const yoy    = yoyRow
    ? (last.poultry_beef_ratio - yoyRow.poultry_beef_ratio) / Math.abs(yoyRow.poultry_beef_ratio)
    : null;
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

  return (
    <section className="card card-full" data-card-id="us-poultry-beef">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Bloomberg · Relação de Preços Diária</div>
          <h3 className="card-title">Poultry / Beef Ratio</h3>
          <div className="card-price">
            <span className="card-value">{window.fmt(last.poultry_beef_ratio, {decimals: 3})}</span>
            <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
              {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
            </span>
            <span className="card-date">
              {window.MONTHS_PT[last.month - 1]}/{String(last.year).slice(-2)}
            </span>
          </div>
        </div>
        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a','3'],['5a','5'],['10a','10'],['Todos','all']].map(([label, val]) => (
                <button key={label}
                  className={`year-seg-btn ${range === val ? 'is-on' : ''}`}
                  onClick={() => changeRange(val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-ctrl-row">
            <div className="seg">
              <button className={`seg-btn ${chartStyle === 'line' ? 'is-on' : ''}`} onClick={() => setChartStyle('line')}>Linha</button>
              <button className={`seg-btn ${chartStyle === 'area' ? 'is-on' : ''}`} onClick={() => setChartStyle('area')}>Área</button>
            </div>
          </div>
        </div>
      </div>
      <PoultryBeefChart
        allRows={allRows}
        filteredRows={filteredRows}
        mean={mean}
        chartStyle={chartStyle}
        prevFirstT={prevFirstT}
      />
    </section>
  );
};

const USDC_LB_TO_USD_KG = 0.0220462; // ÷100 (USDc→USD) × 2.20462 (lb→kg)

// ── National Composite · gráfico semanal ─────────────────────────────────────
const NC_WEEKLY_COLORS = [
  'oklch(0.76 0.20 45)',   // âmbar
  'oklch(0.72 0.18 155)',  // verde
  'oklch(0.65 0.18 280)',  // lilás
];

function NcWeeklyChart({ rows, fields, chartStyle, pinnedSeries, setPinnedSeries }) {
  const W = 1000, H = 360;
  const padL = 64, padR = 24, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const [hover, setHover] = React.useState(null);
  const [mouseY, setMouseY] = React.useState(0);

  const tOf = r => r.year + (r.month - 1) / 12 + (r.day - 1) / 365.25;

  if (!rows.length) return (
    <div style={{height: H, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:13}}>
      Sem dados semanais — faça upload da planilha FrangoUS.xlsm
    </div>
  );

  const allVals = rows.flatMap(r => fields.map(f => r[f.key]).filter(v => v != null));
  if (!allVals.length) return null;

  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const spanV = maxV - minV || 1;
  const vMin = minV - spanV * 0.04, vMax = maxV + spanV * 0.04;

  const tFirst = tOf(rows[0]), tLast = tOf(rows[rows.length - 1]);
  const span = tLast - tFirst || 1;
  const xOf = r => padL + ((tOf(r) - tFirst) / span) * chartW;
  const yOf = v => padT + (1 - (v - vMin) / (vMax - vMin)) * chartH;

  // Y ticks
  const yTicks = Array.from({length: 5}, (_, i) => vMin + (vMax - vMin) * (i / 4));

  // X ticks
  const spanYears = tLast - tFirst;
  const stepMons = spanYears <= 3.5 ? 6 : spanYears <= 6 ? 12 : 24;
  const firstOrd = rows[0].year * 12 + rows[0].month - 1;
  const lastOrd  = rows[rows.length - 1].year * 12 + rows[rows.length - 1].month - 1;
  const tickStart = Math.ceil(firstOrd / stepMons) * stepMons;
  const xTicks = [];
  for (let ord = tickStart; ord <= lastOrd; ord += stepMons) {
    const yr = Math.floor(ord / 12), mo = (ord % 12) + 1;
    const xx = padL + ((yr + (mo - 1) / 12 - tFirst) / span) * chartW;
    const label = stepMons === 6
      ? `${window.MONTHS_PT[mo - 1]}/${String(yr).slice(-2)}`
      : String(yr);
    xTicks.push({ x: xx, label });
  }

  const buildPath = key => {
    let path = '', inPath = false;
    for (const r of rows) {
      const v = r[key];
      if (v != null) {
        const pt = `${xOf(r).toFixed(1)},${yOf(v).toFixed(1)}`;
        path += inPath ? `L${pt}` : `M${pt}`; inPath = true;
      } else { inPath = false; }
    }
    return path;
  };

  const buildAreaPath = key => {
    const pts = rows.filter(r => r[key] != null);
    if (!pts.length) return '';
    const line = pts.map(r => `${xOf(r).toFixed(1)},${yOf(r[key]).toFixed(1)}`).join('L');
    const base = (padT + chartH).toFixed(1);
    return `M${line}L${xOf(pts[pts.length-1]).toFixed(1)},${base}L${xOf(pts[0]).toFixed(1)},${base}Z`;
  };

  const gradId = 'nc-wkly-grad', clipId = 'nc-wkly-clip';

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top)  * (H / rect.height);
    const t = tFirst + ((px - padL) / chartW) * span;
    let best = null, bestD = Infinity;
    for (const r of rows) { const d = Math.abs(tOf(r) - t); if (d < bestD) { bestD = d; best = r; } }
    setHover(best || null);
    setMouseY(py);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {fields.map((f, i) => (
            <linearGradient key={f.key} id={`${gradId}-${i}`} x1="0" x2="0"
              y1={padT} y2={padT + chartH} gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={f.color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={f.color} stopOpacity="0.01"/>
            </linearGradient>
          ))}
          <clipPath id={clipId}>
            <rect x={padL} y={padT} width={chartW} height={chartH + 4}/>
          </clipPath>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} className="grid-line"/>
            <text x={padL - 6} y={yOf(v)} className="tick-label" textAnchor="end" dominantBaseline="middle">
              {window.fmt(v, {decimals: 2})}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={padT} y2={H - padB} className="grid-line" opacity="0.3"/>
            <text x={t.x} y={H - padB + 16} className="tick-label" textAnchor="middle">{t.label}</text>
          </g>
        ))}

        <g clipPath={`url(#${clipId})`}>
          {chartStyle === 'area' && fields.map((f, i) => (
            <path key={`area-${f.key}`} d={buildAreaPath(f.key)} fill={`url(#${gradId}-${i})`}
              opacity={pinnedSeries && pinnedSeries !== f.key ? 0.05 : 1}/>
          ))}
          {fields.map(f => (
            <g key={f.key}>
              <path d={buildPath(f.key)} fill="none" stroke={f.color}
                strokeWidth={pinnedSeries === f.key ? 2.5 : 1.5}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={pinnedSeries && pinnedSeries !== f.key ? 0.1 : 1}/>
              {/* hitbox invisível mais largo para facilitar o clique */}
              <path d={buildPath(f.key)} fill="none" stroke="transparent" strokeWidth={10}
                style={{cursor:'pointer'}}
                onClick={() => setPinnedSeries(p => p === f.key ? null : f.key)}/>
            </g>
          ))}
        </g>

        {hover && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={padT} y2={H - padB}
              stroke="var(--fg)" strokeOpacity="0.2" strokeWidth="1"/>
            {fields.map(f => {
              const v = hover[f.key];
              if (v == null) return null;
              const isPinned = pinnedSeries === f.key;
              const isDimmed = pinnedSeries && !isPinned;
              return <circle key={f.key} cx={xOf(hover)} cy={yOf(v)}
                r={isPinned ? 5 : 4}
                fill="var(--bg)" stroke={f.color}
                strokeWidth={isPinned ? 2.5 : 2}
                opacity={isDimmed ? 0.2 : 1}
                style={{cursor:'pointer'}}
                onClick={() => setPinnedSeries(p => p === f.key ? null : f.key)}/>;
            })}
          </g>
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis-line"/>
        <line x1={padL} x2={padL}     y1={padT}     y2={H - padB} className="axis-line"/>
      </svg>

      {hover && (() => {
        const xPos = xOf(hover), isRight = xPos > W * 0.75;
        return (
          <div className="hover-card" style={{
            left: `${(xPos / W * 100).toFixed(1)}%`,
            top: Math.max(10, Math.min(H - 120, mouseY - 40)),
            transform: isRight ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
          }}>
            <div className="hover-month">
              {String(hover.day).padStart(2,'0')}/{window.MONTHS_PT[hover.month - 1]}/{hover.year}
            </div>
            <div className="hover-rows">
              {fields.map(f => {
                const v = hover[f.key];
                if (v == null) return null;
                return (
                  <div key={f.key} className="hover-row">
                    <span className="hover-year" style={{color: f.color}}>{f.label}</span>
                    <span className="hover-val">{window.fmt(v, {decimals: 2})}<span className="hover-unit"> USDc/lb</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="ciclo-legend">
        {fields.map(f => (
          <span key={f.key} className="legend-year"
            onClick={() => setPinnedSeries(p => p === f.key ? null : f.key)}
            style={{
              cursor:'pointer', userSelect:'none', padding:'2px 6px',
              opacity: pinnedSeries && pinnedSeries !== f.key ? 0.3 : 1,
              outline: pinnedSeries === f.key ? `1px solid ${f.color}` : 'none',
              borderRadius: 4,
            }}>
            <span className="legend-line" style={{background: f.color}}/>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function NcWeeklyCard({ data, modeToggle }) {
  const [range, setRange]               = React.useState('5');
  const [chartStyle, setChartStyle]     = React.useState('line');
  const [pinnedSeries, setPinnedSeries] = React.useState(null);

  const allRows = React.useMemo(() => data.frango_us_nc_weekly || [], [data]);
  const ncCols  = data.frango_us_nc_cols || [
    { key: 'nc_w1', label: 'Série 1' },
    { key: 'nc_w2', label: 'Série 2' },
    { key: 'nc_w3', label: 'Série 3' },
  ];
  const fields = ncCols.map((c, i) => ({
    key: c.key, label: c.label,
    color: NC_WEEKLY_COLORS[i] || 'oklch(0.7 0.15 0)',
  }));

  const rangeNum = range === 'all' ? 'all' : parseInt(range);
  const rows = React.useMemo(() => {
    if (!allRows.length || rangeNum === 'all') return allRows;
    const last = allRows[allRows.length - 1];
    const lastT = last.year + (last.month - 1) / 12 + (last.day - 1) / 365.25;
    const cutT  = lastT - rangeNum;
    return allRows.filter(r => r.year + (r.month - 1) / 12 + (r.day - 1) / 365.25 >= cutT);
  }, [allRows, rangeNum]);

  const lastRow = allRows[allRows.length - 1] || null;

  return (
    <section className="card card-full" data-card-id="us-national-composite">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">USDA · National Composite · Semanal</div>
          <h3 className="card-title">National Composite</h3>
          <div className="card-price" style={{flexWrap:'wrap', gap:'8px 20px'}}>
            {fields.map(f => (
              <span key={f.key} style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <span style={{width:8, height:8, borderRadius:'50%', background:f.color, display:'inline-block', flexShrink:0}}/>
                <span className="card-value" style={{color: f.color}}>
                  {lastRow?.[f.key] != null ? window.fmt(lastRow[f.key], {decimals:2}) : '—'}
                </span>
                <span className="card-unit">USDc/lb</span>
                <span style={{fontSize:11, color:'var(--fg-dim)', marginLeft:2}}>{f.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a','3'],['5a','5'],['10a','10'],['Todos','all']].map(([label, val]) => (
                <button key={label}
                  className={`year-seg-btn ${range === val ? 'is-on' : ''}`}
                  onClick={() => setRange(val)}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{marginLeft:12}}>{modeToggle}</div>
          </div>
          <div className="card-ctrl-row">
            <div className="seg">
              <button className={`seg-btn ${chartStyle==='line'?'is-on':''}`} onClick={() => setChartStyle('line')}>Linha</button>
              <button className={`seg-btn ${chartStyle==='area'?'is-on':''}`} onClick={() => setChartStyle('area')}>Área</button>
            </div>
          </div>
        </div>
      </div>

      <NcWeeklyChart rows={rows} fields={fields} chartStyle={chartStyle}
        pinnedSeries={pinnedSeries} setPinnedSeries={setPinnedSeries}/>
    </section>
  );
}

function NationalCompositeSection({ data, accent }) {
  const [mode, setMode] = React.useState('mensal');

  const modeToggle = (
    <div className="seg">
      <button className={`seg-btn ${mode==='semanal'?'is-on':''}`} onClick={() => setMode('semanal')}>Semanal</button>
      <button className={`seg-btn ${mode==='mensal'?'is-on':''}`}  onClick={() => setMode('mensal')}>Mensal</button>
    </div>
  );

  if (mode === 'semanal') {
    return <NcWeeklyCard data={data} modeToggle={modeToggle}/>;
  }

  return (
    <window.PriceCard
      cardId="us-national-composite"
      title="National Composite"
      sub="USDA · National Composite Price"
      accent="oklch(0.82 0.18 155)"
      data={data}
      dataset="frango_us_monthly"
      field="national_composite"
      unit="USDc/lb"
      decimals={2}
      fullWidth
      events={EVENTS_FRANGO_US}
      headerExtra={modeToggle}
    />
  );
}

// ── Broiler Production Section ────────────────────────────────────────────────
function BroilerProductionSection({ data }) {
  const chartAccent = 'oklch(0.78 0.15 160)';
  const [pairIdx, setPairIdx] = React.useState(0);
  if (!data.broiler_production?.snapshots?.length) {
    return (
      <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
        </svg>
        <div style={{fontSize:16,fontWeight:500,color:'var(--fg)'}}>Sem dados de produção Broiler</div>
        <div style={{fontSize:13,textAlign:'center',maxWidth:320}}>
          Faça upload da planilha FrangoUS.xlsm para visualizar as revisões de forecast.
        </div>
      </main>
    );
  }
  return (
    <main className="main">
      <window.ProductionCard
        data={data}
        accent={chartAccent}
        productionKey="broiler_production"
        summariesFile="ldp_pdf_summaries_broiler.txt"
        eyebrow="USDA · Produção Broiler trimestral · 000 lb"
        title="Revisão de Forecast"
        cardId="us-broiler-production"
        pairIdx={pairIdx}
        onPairChange={setPairIdx}
        events={EVENTS_FRANGO_US}
      />
      <window.AnnualProductionCard
        data={data}
        accent={chartAccent}
        productionKey="broiler_production"
        eyebrow="USDA · Produção Broiler anual · 000 lb"
        title="Revisão de Forecast · Anual"
        cardId="us-broiler-annual"
        pairIdx={pairIdx}
      />
      <window.PriceCard
        cardId="us-plantel-matrizes"
        title="Plantel de Matrizes"
        sub="USDA · Broiler Breeders"
        accent={chartAccent}
        data={data}
        dataset="frango_us_monthly"
        field="plantel_matrizes"
        unit="000 cab"
        decimals={0}
        fullWidth
        events={EVENTS_FRANGO_US}
      />
      <window.PriceCard
        cardId="us-produtividade-matrizes"
        title="Produtividade das Matrizes"
        sub="USDA · Broiler Breeders · Rate of Lay"
        accent={chartAccent}
        data={data}
        dataset="frango_us_monthly"
        field="produtividade_matrizes"
        unit="eggs/100 matrizes"
        decimals={1}
        fullWidth
        events={EVENTS_FRANGO_US}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="ovos_incubados"
        cardId="us-ovos-incubados"
        title="Ovos Incubados"
        eyebrow="Bloomberg · EGGSESUS Index · Broiler Eggs Set In Incubators"
        unit="000 Eggs"
        decimals={0}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="hatchability"
        cardId="us-hatchability"
        title="Hatchability"
        eyebrow="Bloomberg · EGGSHCUS Index · Broiler Eggs Hatched Ratio"
        unit="%"
        decimals={1}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="pintos_eclodiram"
        cardId="us-pintos-eclodiram"
        title="Pintos que Eclodiram"
        eyebrow="Bloomberg · Cálculo Próprio · Eggs Sets * Hatchability"
        unit="000 Chicks"
        decimals={0}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="chicks_placed"
        cardId="us-chicks-placed"
        title="Chicks Placed"
        eyebrow="Bloomberg · EGGSCPUS Index · Broiler Chicks Placed"
        unit="000 Chicks"
        decimals={0}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="mortality"
        cardId="us-mortality"
        title="Mortality"
        eyebrow="Bloomberg · Cálculo Próprio · Chicks Placed - Slaughter"
        unit="%"
        decimals={1}
        scale={100}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="abates_frango"
        cardId="us-abates-frango"
        title="Abates de Frango"
        eyebrow="Bloomberg · POSLHDYC Index · Poultry Slaughter Head Count"
        unit="000 Heads"
        decimals={0}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="peso_medio"
        cardId="us-peso-medio"
        title="Peso Médio"
        eyebrow="Bloomberg · POSLAWYC Index · Poultry Slaughter Average Weight"
        unit="lb"
        decimals={2}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
      <FrangoUSSimpleCard
        data={data}
        seriesKey="producao"
        cardId="us-producao"
        title="Produção de Frango"
        eyebrow="Bloomberg · Cálculo Próprio · Poultry Slaughter Head Count * Poultry Slaughter Avg. Weight"
        unit="Ton"
        decimals={0}
        events={EVENTS_FRANGO_US}
        accent={chartAccent}
        defaultYears={5}
      />
    </main>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────
const PoultryUSTab = ({ data, accent, tab }) => {
  if (tab === 'producao') {
    return <BroilerProductionSection data={data} />;
  }

  if (!data.frango_us_daily || !data.frango_us_daily.length) {
    return (
      <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
        </svg>
        <div style={{fontSize:16,fontWeight:500,color:'var(--fg)'}}>Sem dados de Frango US</div>
        <div style={{fontSize:13,textAlign:'center',maxWidth:320}}>
          Faça upload da planilha FrangoUS.xlsm para visualizar os gráficos.
        </div>
      </main>
    );
  }
  const hasUsda = data.frango_us_monthly && data.frango_us_monthly.length > 0;

  const combinedPriceRows = React.useMemo(() => {
    if (!hasUsda) return [];
    const daily   = data.frango_us_daily   || [];
    const monthly = data.frango_us_monthly || [];
    const proxyAcc = {};
    for (const r of daily) {
      if (r.proxy == null) continue;
      const k = `${r.year}-${r.month}`;
      if (!proxyAcc[k]) proxyAcc[k] = { sum: 0, n: 0 };
      proxyAcc[k].sum += r.proxy;
      proxyAcc[k].n++;
    }
    return monthly.map(r => {
      const acc = proxyAcc[`${r.year}-${r.month}`];
      return {
        year:      r.year,
        month:     r.month,
        proxy_xpg: acc ? acc.sum / acc.n : null,
        wholesale: r.usda_broiler_composite != null ? r.usda_broiler_composite * USDC_LB_TO_USD_KG : null,
        national:  r.national_composite     != null ? r.national_composite     * USDC_LB_TO_USD_KG : null,
      };
    });
  }, [data.frango_us_daily, data.frango_us_monthly, hasUsda]);

  if (tab === 'precos') {
    return (
      <main className="main">
        <FrangoUSPriceCard data={data} accent={accent}/>
        <FrangoUSSimpleCard
          data={data}
          seriesKey="feed_grain"
          cardId="us-feed-grain"
          title="Feed Grain"
          eyebrow="Bloomberg · Milho + Soja · Custo de Ração EUA"
          unit="USD/Kg"
          events={EVENTS_FEED_GRAIN}
          accent={accent}
          defaultYears={5}
        />
        <FrangoUSSimpleCard
          data={data}
          seriesKey="spread"
          cardId="us-spread"
          title="Spread · Frango - Ração"
          eyebrow="Bloomberg · Proxy XPG − Feed Grain · Margem EUA"
          unit="USD/Kg"
          events={EVENTS_SPREAD}
          accent={accent}
          defaultYears={5}
        />
        <PoultryBeefCard data={data}/>
        {hasUsda && <>
          <window.PriceCard
            cardId="us-usda-price"
            title="Broilers · Preço"
            sub="USDA · Broilers Composite Wholesale Price"
            accent="oklch(0.82 0.18 155)"
            data={data}
            dataset="frango_us_monthly"
            field="usda_wholesale_price"
            unit="INDEX"
            decimals={2}
            fullWidth
            events={EVENTS_FRANGO_US}
          />
          <window.PriceCard
            cardId="us-usda-feed"
            title="Broilers · Feed Costs"
            sub="USDA · Broilers Feed Costs per Lb"
            accent="oklch(0.82 0.18 155)"
            data={data}
            dataset="frango_us_monthly"
            field="usda_feed_cost"
            unit="INDEX"
            decimals={2}
            fullWidth
            events={EVENTS_FEED_GRAIN}
          />
          <window.PriceCard
            cardId="us-usda-spread"
            title="Broilers · Spread · Frango - Ração"
            sub="USDA · Composite Wholesale Price − Feed Costs"
            accent="oklch(0.82 0.18 155)"
            data={data}
            dataset="frango_us_monthly"
            field="usda_spread"
            unit="INDEX"
            decimals={2}
            fullWidth
            events={EVENTS_SPREAD}
          />
          <NationalCompositeSection data={data} accent={accent}/>
          {combinedPriceRows.length > 0 && (
            <window.MultiContinuousCard
              cardId="us-price-comparison"
              title="Preços · Comparativo"
              sub="Bloomberg · USDA · Proxy XPG · Wholesale · National Composite · USD/Kg"
              rows={combinedPriceRows}
              fields={[
                { key: 'proxy_xpg', label: 'Proxy XPG',          color: 'oklch(0.76 0.20 45)'  },
                { key: 'wholesale', label: 'Wholesale Composite', color: 'oklch(0.72 0.18 155)' },
                { key: 'national',  label: 'National Composite',  color: 'oklch(0.65 0.18 280)' },
              ]}
              unit="USD/Kg"
              decimals={3}
              height={380}
            />
          )}
        </>}
      </main>
    );
  }
  return null;
};

window.PoultryUSTab = PoultryUSTab;
