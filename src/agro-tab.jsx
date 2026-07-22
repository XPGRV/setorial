import React from 'react'
import { MultiContinuousCard } from './continuous-chart.jsx'
import { EdgebeeefChart, EdgebeeefControls } from './beef-us-tab.jsx'
import { MONTHS_PT, fmt } from './data-utils.jsx'

// Accents das sub-abas do Agro: Soja herda o tom âmbar dos Grãos (Transportes);
// Algodão usa o verde da cultura (RGB 0,117,72).
const SOJA_ACCENT = 'rgb(255 203 112)'
const COTTON_ACCENT = 'rgb(0 117 72)'

// Cores das linhas do gráfico de preço do algodão — CBOT em azul (mesmo tom das
// rotas de frete), Barreiras num verde mais claro que o accent p/ leitura no dark.
const COTTON_LINE_GREEN = 'rgb(0 176 112)'
const COTTON_PRICE_FIELDS = [
  { key: 'cbot', label: 'Cotton CBOT', color: 'rgb(108 173 223)' },
  { key: 'barreiras', label: 'Cotton Barreiras', color: COTTON_LINE_GREEN },
]

const MONTH_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
const NO_EVENTS = []

// ── Desconto do Algodão (Barreiras − CBOT) ────────────────────────────────────
// Um card, dois modos de visualização (Contínuo / Sazonal) e duas métricas
// (USd/lp nominal / %). A série vem de agro_cotton_daily (colunas I e J).
function CottonDiscountCard({ data }) {
  const [metric, setMetric] = React.useState('usd')    // 'usd' | 'pct'
  const [view, setView]     = React.useState('continuo') // 'continuo' | 'sazonal'

  const rows = React.useMemo(() => (data.agro_cotton_daily || [])
    .map(r => ({
      year: r.year, month: r.month, day: r.day,
      value: metric === 'usd'
        ? r.discount_usd
        : r.discount_pct == null ? null : r.discount_pct * 100,
    }))
    .filter(r => r.value != null), [data.agro_cotton_daily, metric])

  const unit = metric === 'usd' ? 'USd/lp' : '%'
  const decimals = metric === 'usd' ? 2 : 1

  // No "Todos", o eixo X começa junto com a série de preço (jan/2000) — o
  // desconto só existe a partir de nov/2003 e, sem isso, os dois cards ficam
  // descasados na comparação visual.
  const priceFirst = (data.agro_cotton_daily || [])[0]
  const domainStart = priceFirst
    ? { year: priceFirst.year, month: priceFirst.month, day: priceFirst.day }
    : null

  const metricToggle = (
    <div className="currency-toggle">
      <button className={`cur-btn ${metric==='usd'?'is-on':''}`} onClick={() => setMetric('usd')}>USd</button>
      <button className={`cur-btn ${metric==='pct'?'is-on':''}`} onClick={() => setMetric('pct')}>%</button>
    </div>
  )
  const viewToggle = (
    <div className="seg">
      <button className={`seg-btn ${view==='continuo'?'is-on':''}`} onClick={() => setView('continuo')}>Contínuo</button>
      <button className={`seg-btn ${view==='sazonal'?'is-on':''}`} onClick={() => setView('sazonal')}>Sazonal</button>
    </div>
  )

  if (view === 'continuo') {
    return (
      <MultiContinuousCard
        cardId="card-agro-cotton-discount"
        title="Desconto do Algodão"
        sub="Bloomberg · Barreiras − CBOT · diário"
        rows={rows}
        fields={[{ key: 'value', label: 'Desconto', color: COTTON_LINE_GREEN }]}
        unit={unit}
        decimals={decimals}
        height={330}
        defaultRange="5"
        highlightZero
        zeroBaseline
        domainStart={domainStart}
        headerExtra={<>{viewToggle}{metricToggle}</>}
      />
    )
  }
  return (
    <CottonDiscountSeasonal
      rows={rows} unit={unit} decimals={decimals}
      chartId={`card-agro-cotton-discount-${metric}`}
      toggles={<>{viewToggle}{metricToggle}</>}
    />
  )
}

// Visão sazonal do desconto — mesma mecânica do DailySeasonalCard (EdgeBeef):
// uma linha por ano sobre o dia-do-ano, com presets de anos, média+faixa etc.
function CottonDiscountSeasonal({ rows, unit, decimals, chartId, toggles }) {
  const byYear = React.useMemo(() => {
    const out = {}
    for (const r of rows) {
      if (!out[r.year]) out[r.year] = []
      out[r.year].push({ doy: MONTH_DOY[r.month - 1] + r.day, value: r.value })
    }
    for (const yr of Object.keys(out)) out[yr].sort((a, b) => a.doy - b.doy)
    return out
  }, [rows])

  const allYears = React.useMemo(() => Object.keys(byYear).map(Number).sort((a, b) => a - b), [byYear])

  const latestRaw = React.useMemo(() => {
    if (!rows.length) return null
    return [...rows].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day
    ).at(-1)
  }, [rows])

  const [selectedYears, setSelectedYears] = React.useState(() => allYears.slice(-5))
  const [chartStyle, setChartStyle]       = React.useState('line')
  const [showStats, setShowStats]         = React.useState(false)
  const [showEvents, setShowEvents]       = React.useState(false)
  const [pinnedYear, setPinnedYear]       = React.useState(null)

  React.useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0) {
      setSelectedYears(allYears.slice(-5))
    }
  }, [allYears.join(',')])

  React.useEffect(() => { setPinnedYear(null) }, [selectedYears.join(',')])

  return (
    <section className="card card-full" data-card-id="card-agro-cotton-discount">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Bloomberg · Barreiras − CBOT · diário</div>
          <h3 className="card-title">Desconto do Algodão</h3>
          <div className="card-price">
            {latestRaw && (<>
              <span className="card-value">{fmt(latestRaw.value, { decimals })}</span>
              <span className="card-unit">{unit}</span>
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
          <div style={{display:'flex', alignItems:'center', gap:8}}>{toggles}</div>
        </div>
      </div>
      <EdgebeeefChart
        byYear={byYear} allYears={allYears}
        selectedYears={selectedYears}
        pinnedYear={pinnedYear} setPinnedYear={setPinnedYear}
        chartStyle={chartStyle}
        showStats={showStats} showEvents={showEvents}
        events={NO_EVENTS}
        accent={COTTON_LINE_GREEN}
        unit={unit}
        decimals={decimals}
        chartId={chartId}
      />
    </section>
  )
}

function CottonCharts({ data }) {
  const [currency, setCurrency] = React.useState('usd')

  // Mesmas chaves (cbot/barreiras) nas duas moedas — trocar USd↔BRL preserva
  // range, estilo e série pinada do MultiContinuousCard.
  const rows = React.useMemo(() => {
    const usd = currency === 'usd'
    return (data.agro_cotton_daily || [])
      .map(r => ({
        year: r.year, month: r.month, day: r.day,
        cbot: usd ? r.cbot_usd : r.cbot_brl,
        barreiras: usd ? r.barreiras_usd : r.barreiras_brl,
      }))
      .filter(r => r.cbot != null || r.barreiras != null)
  }, [data.agro_cotton_daily, currency])

  if (!rows.length) {
    return <main className="main"><section className="card card-full"><div className="card-head"><div>
      <div className="card-eyebrow">Agro · Algodão</div>
      <h3 className="card-title">Sem dados de algodão</h3>
      <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>Atualize a planilha Agro.xlsm para carregar as séries diárias da Bloomberg.</div>
    </div></div></section></main>
  }

  return (
    <main className="main">
      <MultiContinuousCard
        cardId="card-agro-cotton-price"
        title="Preço do Algodão"
        sub="Bloomberg · CT1 Comdty × BACRBARR Index · diário"
        rows={rows}
        fields={COTTON_PRICE_FIELDS}
        unit={currency === 'usd' ? 'USd/lp' : 'BRL/lp'}
        decimals={2}
        height={330}
        defaultRange="5"
        headerExtra={
          <div className="currency-toggle">
            <button className={`cur-btn ${currency==='usd'?'is-on':''}`} onClick={() => setCurrency('usd')}>USd</button>
            <button className={`cur-btn ${currency==='brl'?'is-on':''}`} onClick={() => setCurrency('brl')}>R$</button>
          </div>
        }
      />

      <CottonDiscountCard data={data}/>
    </main>
  )
}

function SojaCharts() {
  return (
    <main className="main">
      <section className="card card-full">
        <div className="card-head"><div>
          <div className="card-eyebrow">Agro · Soja</div>
          <h3 className="card-title">Em breve</h3>
          <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>
            Os gráficos de preço e desconto da soja (CBOT, Paranaguá e Sorriso) serão adicionados aqui.
          </div>
        </div></div>
      </section>
    </main>
  )
}

export function AgroTab({ data, accent, tab }) {
  return tab === 'soja' ? <SojaCharts/> : <CottonCharts data={data}/>
}

export { SOJA_ACCENT, COTTON_ACCENT }
