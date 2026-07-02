import React from 'react'
import { EVENTS, MONTHS_PT, availableYears, fmt, latestNonNull } from './data-utils.jsx'
import { SeasonalChart } from './seasonal-chart.jsx'
import { EdgebeeefChart, EdgebeeefControls } from './beef-us-tab.jsx'

// PriceCard / DailySeasonalCard — cards genéricos de série mensal/diária,
// usados pelo App (Beef BR) e pelos tabs de Poultry. Vivem num módulo próprio
// para evitar import circular app.jsx ↔ tabs.
const { useState, useEffect, useMemo, useRef } = React;

// ---------------- DailySeasonalCard ──────────────────────────────────────────
// Gráfico diário sazonal genérico — espelho do EdgebeeefCard.
// Usa EdgebeeefChart + EdgebeeefControls expostos em beef-us-tab.jsx.
const _MONTH_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function DailySeasonalCard({ data, accent, dailyKey, usdDailyKey, cardId, title, sub, unit, usdUnit, decimals = 2 }) {
  const hasUSD = !!usdDailyKey;
  const [currency, setCurrency] = useState('brl');
  const activeKey  = hasUSD && currency === 'usd' ? usdDailyKey : dailyKey;
  const activeUnit = hasUSD && currency === 'usd' ? (usdUnit || 'US$/kg') : unit;

  const rows = data[activeKey] || [];
  const events = EVENTS || [];

  const byYear = useMemo(() => {
    const out = {};
    for (const r of rows) {
      if (!out[r.year]) out[r.year] = [];
      out[r.year].push({ doy: _MONTH_DOY[r.month - 1] + r.day, value: r.value });
    }
    for (const yr of Object.keys(out)) out[yr].sort((a, b) => a.doy - b.doy);
    return out;
  }, [rows]);

  const allYears = useMemo(() => Object.keys(byYear).map(Number).sort((a, b) => a - b), [byYear]);

  const latestRaw = useMemo(() => {
    if (!rows.length) return null;
    return [...rows].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day
    ).at(-1);
  }, [rows]);

  const yoyRaw = useMemo(() => {
    if (!latestRaw) return null;
    const candidates = rows.filter(r => r.year === latestRaw.year - 1 && r.month === latestRaw.month);
    let best = null, bestD = Infinity;
    for (const r of candidates) {
      const d = Math.abs(r.day - latestRaw.day);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }, [rows, latestRaw]);

  const yoy = latestRaw && yoyRaw
    ? (latestRaw.value - yoyRaw.value) / Math.abs(yoyRaw.value)
    : null;
  const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

  const [selectedYears, setSelectedYears] = useState(() => allYears.slice(-5));
  const [chartStyle, setChartStyle]       = useState('line');
  const [showStats, setShowStats]         = useState(false);
  const [showEvents, setShowEvents]       = useState(true);
  const [pinnedYear, setPinnedYear]       = useState(null);

  useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0) {
      setSelectedYears(allYears.slice(-5));
    }
  }, [allYears.join(',')]);

  useEffect(() => { setPinnedYear(null); }, [selectedYears.join(',')]);

  const baseRows = data[dailyKey] || [];
  if (!baseRows.length) {
    return (
      <section className="card card-full" data-card-id={cardId}>
        <div className="card-head">
          <div>
            <div className="card-eyebrow">{sub}</div>
            <h3 className="card-title">{title}</h3>
            <div style={{fontSize:13, color:'var(--fg-dim)', marginTop:8}}>
              Atualize os dados para buscar as séries diárias mais recentes.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price">
            {latestRaw && (<>
              <span className="card-value">{fmt(latestRaw.value, {decimals})}</span>
              <span className="card-unit">{activeUnit}</span>
              <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
                {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
              </span>
              <span className="card-date">
                {MONTHS_PT[latestRaw.month - 1]}/{String(latestRaw.year).slice(-2)}
              </span>
            </>)}
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8}}>
          <EdgebeeefControls
            years={allYears}
            selectedYears={selectedYears} setSelectedYears={setSelectedYears}
            showStats={showStats} setShowStats={setShowStats}
            showEvents={showEvents} setShowEvents={setShowEvents}
            chartStyle={chartStyle} setChartStyle={setChartStyle}
          />
          {hasUSD && (
            <div className="currency-toggle">
              <button className={`cur-btn ${currency==='brl'?'is-on':''}`} onClick={() => setCurrency('brl')}>R$</button>
              <button className={`cur-btn ${currency==='usd'?'is-on':''}`} onClick={() => setCurrency('usd')}>US$</button>
            </div>
          )}
        </div>
      </div>
      <EdgebeeefChart
        byYear={byYear} allYears={allYears}
        selectedYears={selectedYears}
        pinnedYear={pinnedYear} setPinnedYear={setPinnedYear}
        chartStyle={chartStyle}
        showStats={showStats} showEvents={showEvents}
        events={events}
        accent={accent}
        unit={activeUnit}
        decimals={decimals}
        chartId={`${cardId}-${currency}`}
      />
    </section>
  );
}

// ---------------- PriceCard ----------------
function PriceCard({
  title, sub, accent, data, dataset, field, usdField,
  unit, usdUnit, hasUSD, decimals, big,
  fullWidth, height = 260, headerExtra, cardId, events: eventsProp, footerNote,
}) {
  const eventsData = eventsProp !== undefined ? eventsProp : (EVENTS || []);
  const years = useMemo(() => availableYears(data, dataset, field), [data, dataset, field]);
  const latest = years[years.length - 1];
  const defaultYears = useMemo(
    () => [latest, latest-1, latest-2, latest-3, latest-4].filter(y => years.includes(y)),
    [latest, years.join(',')]
  );

  const [selectedYears, setSelectedYears] = useState(defaultYears);
  const [showStats, setShowStats] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [chartStyle, setChartStyle] = useState('line');
  const [currency, setCurrency] = useState('brl');

  const activeField = (hasUSD && currency === 'usd' && usdField) ? usdField : field;
  const activeUnit  = (hasUSD && currency === 'usd') ? (usdUnit || 'US$/kg') : unit;

  const latestRow = latestNonNull(data, dataset, activeField);
  const latestValue = latestRow?.[activeField];
  const prevMonthRow = latestRow ? data[dataset].find(r => {
    const m2 = latestRow.month === 1 ? 12 : latestRow.month - 1;
    const y2 = latestRow.month === 1 ? latestRow.year - 1 : latestRow.year;
    return r.year === y2 && r.month === m2;
  }) : null;
  const yoyRow = latestRow ? data[dataset].find(r =>
    r.year === latestRow.year - 1 && r.month === latestRow.month
  ) : null;

  const pctChange = (a, b) => (a == null || b == null || b === 0) ? null : (a - b) / Math.abs(b);
  const mom = pctChange(latestValue, prevMonthRow?.[activeField]);
  const yoy = pctChange(latestValue, yoyRow?.[activeField]);
  const fmtPct = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + (v*100).toFixed(1) + '%';

  return (
    <section className={`card ${fullWidth ? 'card-full' : ''}`} data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price">
            <span className="card-value">{fmt(latestValue, {decimals, big})}</span>
            <span className="card-unit">{activeUnit}</span>
            <span className={`card-delta ${mom == null ? '' : mom >= 0 ? 'is-up' : 'is-down'}`}>
              {fmtPct(mom)}<span className="card-delta-label"> MoM</span>
            </span>
            <span className={`card-delta ${yoy == null ? '' : yoy >= 0 ? 'is-up' : 'is-down'}`}>
              {fmtPct(yoy)}<span className="card-delta-label"> YoY</span>
            </span>
            {latestRow && (
              <span className="card-date">{MONTHS_PT[latestRow.month-1]}/{String(latestRow.year).slice(-2)}</span>
            )}
          </div>
        </div>
        <div className="card-head-right">
          {headerExtra}
          <ChartControls
            years={years}
            selectedYears={selectedYears} setSelectedYears={setSelectedYears}
            showStats={showStats} setShowStats={setShowStats}
            showEvents={showEvents} setShowEvents={setShowEvents}
            chartStyle={chartStyle} setChartStyle={setChartStyle}
            currency={currency} setCurrency={setCurrency}
            hasUSD={hasUSD}
            events={eventsData}
          />
        </div>
      </div>

      <SeasonalChart
        data={data} dataset={dataset} field={activeField}
        selectedYears={selectedYears}
        showStats={showStats} showEvents={showEvents}
        events={eventsData} chartStyle={chartStyle}
        accent={accent} unit={activeUnit} decimals={decimals} big={big}
        height={height}
      />
      {footerNote && (
        <div style={{padding:'6px 0 4px',fontSize:11,color:'var(--fg-dim)',lineHeight:1.6}}>
          {footerNote}
        </div>
      )}
    </section>
  );
}

// ---------------- ChartControls ----------------
function ChartControls({
  years, selectedYears, setSelectedYears,
  showStats, setShowStats,
  showEvents, setShowEvents,
  chartStyle, setChartStyle,
  currency, setCurrency, hasUSD, events,
}) {
  const eventsData = events || EVENTS || [];
  const latest = years[years.length - 1];
  const [dropOpen, setDropOpen] = useState(false);
  const [showEventsList, setShowEventsList] = useState(false);
  const dropRef = useRef(null);
  const eventsTimerRef = useRef(null);

  const presets = [
    { label: '3a',    yrs: [latest, latest-1, latest-2] },
    { label: '5a',    yrs: [latest, latest-1, latest-2, latest-3, latest-4] },
    { label: '10a',   yrs: Array.from({length:10}, (_, i) => latest - i) },
    { label: 'Todos', yrs: years },
  ];

  const applyPreset = (yrs) => setSelectedYears(yrs.filter(y => years.includes(y)));

  const activePreset = presets.find(p => {
    const valid = p.yrs.filter(y => years.includes(y));
    return valid.length === selectedYears.length && valid.every(y => selectedYears.includes(y));
  });

  const toggleYear = (yr) => {
    setSelectedYears(prev => prev.includes(yr)
      ? (prev.length === 1 ? prev : prev.filter(y => y !== yr))
      : [...prev, yr].sort((a, b) => a - b));
  };

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const onEventsEnter = () => {
    eventsTimerRef.current = setTimeout(() => setShowEventsList(true), 3000);
  };
  const onEventsLeave = () => {
    clearTimeout(eventsTimerRef.current);
    setShowEventsList(false);
  };

  const activeEvents = eventsData.filter(e => selectedYears.includes(e.year));

  return (
    <div className="card-controls">
      {/* Row 1: year presets as unified segmented control */}
      <div className="card-ctrl-row">
        <div className="year-seg">
          {presets.map(p => (
            <button key={p.label} className={`year-seg-btn ${activePreset?.label === p.label ? 'is-on' : ''}`} onClick={() => applyPreset(p.yrs)}>{p.label}</button>
          ))}
          <div className="year-drop-wrap" ref={dropRef}>
            <button className={`year-seg-btn ${dropOpen ? 'is-active' : ''} ${!activePreset && !dropOpen ? 'is-on' : ''}`} onClick={() => setDropOpen(o => !o)}>
              Anos ▾
            </button>
            {dropOpen && (
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

      {/* Row 2: toggles + chart style + currency */}
      <div className="card-ctrl-row">
        <div className="ctrl-btn-group">
          <button
            className={`ctrl-btn ${showStats && chartStyle !== 'bars' ? 'is-on' : ''} ${chartStyle === 'bars' ? 'is-disabled' : ''}`}
            onClick={() => chartStyle !== 'bars' && setShowStats(v => !v)}>
            MÉDIA + FAIXA
          </button>
          <div className="events-toggle-wrap" onMouseEnter={onEventsEnter} onMouseLeave={onEventsLeave}>
            <button className={`ctrl-btn ${showEvents ? 'is-on' : ''}`} onClick={() => setShowEvents(v => !v)}>
              EVENTOS
            </button>
          {showEventsList && (
            <div className="events-list-popup">
              <div className="events-list-title">Eventos nos anos selecionados</div>
              {activeEvents.length === 0 ? (
                <div style={{fontSize:11, color:'var(--fg-dim)'}}>Nenhum evento nos anos selecionados.</div>
              ) : activeEvents.map((ev, i) => (
                <div key={i} className="events-list-item">
                  <span className="events-list-date">{MONTHS_PT[ev.month-1]}/{ev.year}</span>
                  <span className="events-list-label">{ev.label}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
        <div style={{marginLeft: 16}}>
          <div className="seg">
            {[['line','Linha'],['area','Área'],['bars','Barras']].map(([v, l]) => (
              <button key={v} className={`seg-btn ${chartStyle===v?'is-on':''}`} onClick={() => setChartStyle(v)}>{l}</button>
            ))}
          </div>
        </div>
        {hasUSD && (
          <div className="currency-toggle" style={{marginLeft: 16}}>
            <button className={`cur-btn ${currency==='brl'?'is-on':''}`} onClick={() => setCurrency('brl')}>R$</button>
            <button className={`cur-btn ${currency==='usd'?'is-on':''}`} onClick={() => setCurrency('usd')}>US$</button>
          </div>
        )}
      </div>
    </div>
  );
}


export { PriceCard, DailySeasonalCard, ChartControls };
