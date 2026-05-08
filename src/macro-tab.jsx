import React from 'react'

const { useState, useEffect, useMemo } = React;

const MONTHS_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SERIES_META = [
  { id: 'ipca',   label: 'IPCA',   eyebrow: 'IBGE-SIDRA · Variação Mensal', unit: '%',      decimals: 2 },
  { id: 'selic',  label: 'SELIC',  eyebrow: 'BCB SGS 432 · Meta',           unit: '% a.a.', decimals: 2 },
  { id: 'igpm',   label: 'IGP-M',  eyebrow: 'BCB SGS 189 · FGV',            unit: '%',      decimals: 2 },
  { id: 'tjlp',   label: 'TJLP',   eyebrow: 'BCB SGS 4175',                  unit: '% a.a.', decimals: 2 },
  { id: 'ptax',   label: 'PTAX',   eyebrow: 'BCB SGS 1 · Fim de Mês',       unit: 'R$/USD', decimals: 4 },
  { id: 'cpi_us', label: 'CPI-US', eyebrow: 'BLS CUUR0000SA0 · All Items',  unit: 'idx',    decimals: 1 },
];

const RANGE_OPTS = [
  { label: '2a',   years: 2   },
  { label: '5a',   years: 5   },
  { label: '10a',  years: 10  },
  { label: 'Todos', years: null },
];

function filterRows(rows, years) {
  if (!years || !rows.length) return rows;
  const last = rows[rows.length - 1];
  const cutMonths = last.year * 12 + last.month - years * 12;
  return rows.filter(r => r.year * 12 + r.month >= cutMonths);
}

function MacroCard({ meta, rows, accent, range, chartStyle }) {
  const filtered = useMemo(() => filterRows(rows, range), [rows, range]);

  const latest  = rows[rows.length - 1];
  const prev    = rows[rows.length - 2];
  const val     = latest?.value ?? null;
  const prevVal = prev?.value ?? null;
  const delta   = val != null && prevVal != null ? val - prevVal : null;
  const isUp    = delta != null ? delta >= 0 : null;

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
      </div>
      <window.ContinuousChart
        rows={filtered}
        field="value"
        accent={accent}
        unit={meta.unit}
        decimals={meta.decimals}
        height={220}
        chartStyle={chartStyle}
      />
    </section>
  );
}

function MacroTab({ accent }) {
  const [macroData, setMacroData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [range,     setRange]     = useState(10);
  const [chartStyle, setChartStyle] = useState('line');

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

  const series = macroData?.series ?? {};
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
      <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:4, flexWrap:'wrap' }}>
        <div className="year-seg">
          {RANGE_OPTS.map(o => (
            <button key={o.label}
              className={`year-seg-btn ${range === o.years ? 'is-on' : ''}`}
              onClick={() => setRange(o.years)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg" style={{ marginLeft:'auto' }}>
          <button className={`seg-btn ${chartStyle==='line' ? 'is-on' : ''}`} onClick={() => setChartStyle('line')}>Linha</button>
          <button className={`seg-btn ${chartStyle==='area' ? 'is-on' : ''}`} onClick={() => setChartStyle('area')}>Área</button>
        </div>
      </div>

      {SERIES_META.map(meta => {
        const rows = series[meta.id];
        if (!rows?.length) return null;
        return (
          <MacroCard
            key={meta.id}
            meta={meta}
            rows={rows}
            accent={accent}
            range={range}
            chartStyle={chartStyle}
          />
        );
      })}
    </main>
  );
}

window.MacroTab = MacroTab;
