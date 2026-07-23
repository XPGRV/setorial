import React from 'react'
import { MultiContinuousCard, MultiContinuousChart } from './continuous-chart.jsx'
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
  { key: 'cbot', label: 'CT1 - Cotton CBOT', color: 'rgb(108 173 223)' },
  { key: 'barreiras', label: 'BACRBARR - Cotton Barreiras', color: COTTON_LINE_GREEN },
]

// Linhas do gráfico de preço da soja — CBOT no mesmo azul do algodão,
// Paranaguá no âmbar do accent da aba, Sorriso no verde padrão dos gráficos.
const SOY_PRICE_FIELDS = [
  { key: 'cbot', label: 'S 1 - Soybean CBOT', color: 'rgb(108 173 223)' },
  { key: 'paranagua', label: 'BASMSBPA - Soybean Paranaguá', color: SOJA_ACCENT },
  { key: 'sorriso', label: 'BASMSBSO - Soybean Sorriso', color: COTTON_LINE_GREEN },
]

// Curvas de futuros — Atual no verde esmeralda padrão; 1 semana atrás em
// laranja e 1 mês atrás em azul. As curvas passadas vão em pontilhado e cada
// série tem um marker próprio (bola / quadrado / triângulo).
const FUTURES_FIELDS = [
  { key: 'atual', label: 'Atual', color: 'rgb(0 176 112)', marker: 'circle' },
  { key: 'week_ago', label: '1 sem. atrás', color: 'rgb(255 137 74)', marker: 'square', dash: '2 5' },
  { key: 'month_ago', label: '1 mês atrás', color: 'rgb(108 173 223)', marker: 'triangle', dash: '2 5' },
]

const MONTH_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
const NO_EVENTS = []
const NO_HIDDEN = []
const PAST_KEYS = ['week_ago', 'month_ago']

// ── Card de desconto (algodão: Barreiras − CBOT · soja: Paranaguá − CBOT) ─────
// Um card, dois modos de visualização (Contínuo / Sazonal) e duas métricas
// (nominal / %). A série vem de discount_usd / discount_pct do dataset diário.
function DiscountCard({ series, cardId, title, sub, nominalUnit, nominalLabel, color }) {
  const [metric, setMetric] = React.useState('usd')    // 'usd' | 'pct'
  const [view, setView]     = React.useState('continuo') // 'continuo' | 'sazonal'

  const rows = React.useMemo(() => series
    .map(r => ({
      year: r.year, month: r.month, day: r.day,
      value: metric === 'usd'
        ? r.discount_usd
        : r.discount_pct == null ? null : r.discount_pct * 100,
    }))
    .filter(r => r.value != null), [series, metric])

  const unit = metric === 'usd' ? nominalUnit : '%'
  const decimals = metric === 'usd' ? 2 : 1

  // No "Todos", o eixo X começa junto com a série de preço acima — o desconto
  // pode começar depois (ex: Barreiras só a partir de nov/2003) e, sem isso,
  // os dois cards ficam descasados na comparação visual.
  const priceFirst = series[0]
  const domainStart = priceFirst
    ? { year: priceFirst.year, month: priceFirst.month, day: priceFirst.day }
    : null

  const metricToggle = (
    <div className="currency-toggle">
      <button className={`cur-btn ${metric==='usd'?'is-on':''}`} onClick={() => setMetric('usd')}>{nominalLabel}</button>
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
        cardId={cardId}
        title={title}
        sub={sub}
        rows={rows}
        fields={[{ key: 'value', label: 'Desconto', color }]}
        unit={unit}
        decimals={decimals}
        height={330}
        defaultRange="5"
        highlightZero
        zeroBaseline
        domainStart={domainStart}
        headerExtra={<>{viewToggle}{metricToggle}</>}
        showLegend={false}
      />
    )
  }
  return (
    <DiscountSeasonal
      rows={rows} unit={unit} decimals={decimals}
      cardId={cardId} title={title} sub={sub} accent={color}
      chartId={`${cardId}-${metric}`}
      toggles={<>{viewToggle}{metricToggle}</>}
    />
  )
}

// Visão sazonal do desconto — mesma mecânica do DailySeasonalCard (EdgeBeef):
// uma linha por ano sobre o dia-do-ano, com presets de anos, média+faixa etc.
function DiscountSeasonal({ rows, unit, decimals, cardId, title, sub, accent, chartId, toggles }) {
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
  const [pinnedYear, setPinnedYear]       = React.useState(null)

  React.useEffect(() => {
    if (allYears.length > 0 && selectedYears.filter(y => allYears.includes(y)).length === 0) {
      setSelectedYears(allYears.slice(-5))
    }
  }, [allYears.join(',')])

  React.useEffect(() => { setPinnedYear(null) }, [selectedYears.join(',')])

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
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
        showStats={showStats} showEvents={false}
        events={NO_EVENTS}
        accent={accent}
        unit={unit}
        decimals={decimals}
        chartId={chartId}
      />
    </section>
  )
}

// ── Curva de futuros (Soja e Algodão) ─────────────────────────────────────────
// Eixo X = vencimento do contrato (decodificado do ticker na planilha); três
// curvas comparando a precificação atual com 1 semana e 1 mês atrás. Janela:
// Janela: sempre os 2 próximos vencimentos do "mês terminal" do ciclo (Nov
// pra soja, Dez pro algodão — descoberto direto da série, sem hardcode por
// commodity). Contando o mais próximo: hoje (jul/26) mostra até nov-27; se
// rodar em dez/26, já passou o nov-26, então mostra até nov-28. Sempre 2.
function FuturesCurveCard({ series, cardId, title, sub, unit, scale = 1 }) {
  const [pinnedSeries, setPinnedSeries] = React.useState(null)
  const [showPast, setShowPast] = React.useState(true)

  const rows = React.useMemo(() => {
    const src = series || []
    if (!src.length) return []
    const now = new Date()
    const curOrd = now.getFullYear() * 12 + now.getMonth()
    const terminalMonth = Math.max(...src.map(r => r.month))
    const terminalOrds = src
      .filter(r => r.month === terminalMonth)
      .map(r => r.year * 12 + r.month - 1)
      .filter(ord => ord >= curOrd)
      .sort((a, b) => a - b)
    // Sem o 2º vencimento terminal na série (ex: dólar coletado só até
    // out/27), mostra tudo que houver em vez de cortar no 1º dezembro.
    const cutoffOrd = terminalOrds.length >= 2 ? terminalOrds[1] : Infinity
    const sc = v => v == null ? null : v * scale
    return src
      .filter(r => {
        const ord = r.year * 12 + r.month - 1
        return ord >= curOrd && ord <= cutoffOrd
      })
      .map(r => ({ ...r, atual: sc(r.atual), week_ago: sc(r.week_ago), month_ago: sc(r.month_ago) }))
  }, [series, scale])

  if (!rows.length) {
    return (
      <section className="card card-full" data-card-id={cardId}>
        <div className="card-head"><div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>
            Sem dados — preencha as colunas Atual / 1 sem. / 1 mês na planilha Agro.xlsm e atualize.
          </div>
        </div></div>
      </section>
    )
  }

  const lastRow = rows[0] // 1º vencimento (contrato mais próximo)
  const fmtVal = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',')

  // Com as linhas passadas desligadas, elas seguem montadas e escondidas via
  // hiddenSeries — o fade in/out fica por conta das transições de opacidade.
  // Se uma delas estivesse pinada, o pin não faz mais sentido e é limpo.
  const hiddenKeys = showPast ? NO_HIDDEN : PAST_KEYS
  React.useEffect(() => {
    if (!showPast && pinnedSeries && pinnedSeries !== 'atual') setPinnedSeries(null)
  }, [showPast, pinnedSeries])

  // Fade rápido dos itens de header/legenda das séries escondidas
  const fadeStyle = key => hiddenKeys.includes(key)
    ? { opacity: 0, pointerEvents: 'none' }
    : { opacity: 1 }

  return (
    <section className="card card-full" data-card-id={cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{sub}</div>
          <h3 className="card-title">{title}</h3>
          <div className="card-price" style={{flexWrap:'wrap', gap:'8px 20px'}}>
            {FUTURES_FIELDS.map(f => (
              <span key={f.key} style={{display:'inline-flex', alignItems:'center', gap:4,
                transition:'opacity 0.25s ease', ...fadeStyle(f.key)}}>
                <span style={{width:8, height:8, borderRadius:'50%', background:f.color,
                  display:'inline-block', flexShrink:0}}/>
                <span className="card-value" style={{color: f.color}}>{fmtVal(lastRow?.[f.key])}</span>
                <span className="card-unit">{unit}</span>
                <span style={{fontSize:11, color:'var(--fg-dim)', marginLeft:2}}>{f.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="card-controls" style={{alignSelf:'center'}}>
          <div className="ctrl-btn-group">
            <button className={`ctrl-btn ${showPast ? 'is-on' : ''}`} onClick={() => setShowPast(v => !v)}>
              LINHAS PASSADAS
            </button>
          </div>
        </div>
      </div>

      <MultiContinuousChart
        rows={rows}
        fields={FUTURES_FIELDS}
        unit={unit}
        decimals={2}
        height={330}
        chartId={cardId}
        chartStyle="line"
        showDots
        monthlyTicks
        drawIn
        hiddenSeries={hiddenKeys}
        pinnedSeries={pinnedSeries}
        setPinnedSeries={setPinnedSeries}
      />

      <div className="ciclo-legend" style={{marginTop: 8}}>
        {FUTURES_FIELDS.map(f => (
          <span key={f.key} className="legend-year"
            style={{
              userSelect:'none', padding:'2px 6px', cursor:'pointer',
              transition:'opacity 0.25s ease',
              outline: pinnedSeries === f.key ? `1px solid ${f.color}` : 'none',
              borderRadius: 4,
              ...fadeStyle(f.key),
              ...(pinnedSeries && pinnedSeries !== f.key && !hiddenKeys.includes(f.key) ? { opacity: 0.3 } : {}),
            }}
            onClick={() => setPinnedSeries(p => p === f.key ? null : f.key)}>
            <span className="legend-line" style={{background: f.color}}/>
            {f.label}
          </span>
        ))}
      </div>
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
        sub="Bloomberg · CT1 Comdty × BACRBARR Index"
        rows={rows}
        fields={COTTON_PRICE_FIELDS}
        unit={currency === 'usd' ? 'USd/lp' : 'BRL/lp'}
        decimals={2}
        height={330}
        defaultRange="5"
        enableZoom
        headerExtra={
          <div className="currency-toggle">
            <button className={`cur-btn ${currency==='usd'?'is-on':''}`} onClick={() => setCurrency('usd')}>USd</button>
            <button className={`cur-btn ${currency==='brl'?'is-on':''}`} onClick={() => setCurrency('brl')}>R$</button>
          </div>
        }
      />

      <DiscountCard
        series={data.agro_cotton_daily || []}
        cardId="card-agro-cotton-discount"
        title="Desconto do Algodão"
        sub="Bloomberg · Desconto Algodão Barreiras vs. CBOT"
        nominalUnit="USd/lp" nominalLabel="USd"
        color={COTTON_LINE_GREEN}
      />

      <FuturesCurveCard
        series={data.agro_cotton_futures}
        cardId="card-agro-cotton-futures"
        title="Futuros do Algodão"
        sub="Bloomberg · CT Comdty · Contratos Futuros"
        unit="USd/lp"
      />

      <FuturesCurveCard
        series={data.agro_dollar_futures}
        cardId="card-agro-cotton-dollar-futures"
        title="Futuros do Dólar"
        sub="Bloomberg · UC Curncy · Contratos Futuros"
        unit="R$/US$"
        scale={0.001}
      />
    </main>
  )
}

function SojaCharts({ data }) {
  const [currency, setCurrency] = React.useState('usd')

  // Mesmas chaves nas duas moedas — trocar US$↔R$ preserva range, estilo e
  // série pinada. Atenção: a unidade muda junto (USD/bu ↔ BRL/sc).
  const rows = React.useMemo(() => {
    const usd = currency === 'usd'
    return (data.agro_soy_daily || [])
      .map(r => ({
        year: r.year, month: r.month, day: r.day,
        cbot: usd ? r.cbot_usd_bu : r.cbot_brl_sc,
        paranagua: usd ? r.paranagua_usd_bu : r.paranagua_brl_sc,
        sorriso: usd ? r.sorriso_usd_bu : r.sorriso_brl_sc,
      }))
      .filter(r => r.cbot != null || r.paranagua != null || r.sorriso != null)
  }, [data.agro_soy_daily, currency])

  if (!rows.length) {
    return <main className="main"><section className="card card-full"><div className="card-head"><div>
      <div className="card-eyebrow">Agro · Soja</div>
      <h3 className="card-title">Sem dados de soja</h3>
      <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>Atualize a planilha Agro.xlsm para carregar as séries diárias da Bloomberg.</div>
    </div></div></section></main>
  }

  return (
    <main className="main">
      <MultiContinuousCard
        cardId="card-agro-soy-price"
        title="Preço da Soja"
        sub="Bloomberg · S 1 Comdty × BASMSBPA Index × BASMSBSO Index"
        rows={rows}
        fields={SOY_PRICE_FIELDS}
        unit={currency === 'usd' ? 'USD/bu' : 'BRL/sc'}
        decimals={2}
        height={330}
        defaultRange="5"
        enableZoom
        headerExtra={
          <div className="currency-toggle">
            <button className={`cur-btn ${currency==='usd'?'is-on':''}`} onClick={() => setCurrency('usd')}>US$</button>
            <button className={`cur-btn ${currency==='brl'?'is-on':''}`} onClick={() => setCurrency('brl')}>R$</button>
          </div>
        }
      />

      <DiscountCard
        series={data.agro_soy_daily || []}
        cardId="card-agro-soy-discount"
        title="Desconto da Soja"
        sub="Bloomberg · Desconto Soja Paranaguá vs. CBOT"
        nominalUnit="USD/bu" nominalLabel="US$"
        color={COTTON_LINE_GREEN}
      />

      <FuturesCurveCard
        series={data.agro_soy_futures}
        cardId="card-agro-soy-futures"
        title="Futuros da Soja"
        sub="Bloomberg · S Comdty · Contratos Futuros"
        unit="USD/bu"
        scale={0.01}
      />

      <FuturesCurveCard
        series={data.agro_dollar_futures}
        cardId="card-agro-soy-dollar-futures"
        title="Futuros do Dólar"
        sub="Bloomberg · UC Curncy · Contratos Futuros"
        unit="R$/US$"
        scale={0.001}
      />
    </main>
  )
}

export function AgroTab({ data, accent, tab }) {
  return tab === 'soja' ? <SojaCharts data={data}/> : <CottonCharts data={data}/>
}

export { SOJA_ACCENT, COTTON_ACCENT }
