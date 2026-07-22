import React from 'react'
import { MultiContinuousCard } from './continuous-chart.jsx'

// Accents das sub-abas do Agro: Soja herda o tom âmbar dos Grãos (Transportes);
// Algodão usa o verde da cultura (RGB 0,117,72).
const SOJA_ACCENT = 'rgb(255 203 112)'
const COTTON_ACCENT = 'rgb(0 117 72)'

// Cores das linhas do gráfico de preço do algodão — CBOT em azul (mesmo tom das
// rotas de frete), Barreiras num verde mais claro que o accent p/ leitura no dark.
const COTTON_PRICE_FIELDS = [
  { key: 'cbot', label: 'Cotton CBOT', color: 'rgb(108 173 223)' },
  { key: 'barreiras', label: 'Cotton Barreiras', color: 'rgb(0 176 112)' },
]

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
