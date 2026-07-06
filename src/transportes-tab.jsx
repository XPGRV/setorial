import React from 'react'
import { PriceCard } from './price-card.jsx'

const NO_EVENTS = []
const LATEST_YEAR_ACCENT = 'oklch(0.82 0.18 155)'

function FretesComingSoon() {
  return <main className="main">
    <section className="card card-full">
      <div className="card-head"><div>
        <div className="card-eyebrow">Transportes · Fretes</div>
        <h3 className="card-title">Fretes</h3>
        <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>Indicadores semanais de frete em preparação.</div>
      </div></div>
    </section>
  </main>
}

function GrainCharts({ data, accent }) {
  if (!(data.transport_grains || []).length) {
    return <main className="main"><section className="card card-full"><div className="card-head"><div>
      <div className="card-eyebrow">Transportes · Grãos</div>
      <h3 className="card-title">Sem dados de grãos</h3>
      <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>Atualize a planilha Transportes.xlsm para carregar os dados da SECEX.</div>
    </div></div></section></main>
  }

  return <main className="main">
    <PriceCard
      cardId="card-transport-soy-volume" title="Exportação Soja"
      sub="SECEX · Volume de Soja Exportado."
      accent={LATEST_YEAR_ACCENT} data={data} dataset="transport_grains" field="soy_volume_kt"
      unit="1000 t" decimals={1} fullWidth events={NO_EVENTS}
    />
    <PriceCard
      cardId="card-transport-soy-price" title="Preço Soja · Mercado Externo"
      sub="SECEX · Preço Soja Exportação"
      accent={LATEST_YEAR_ACCENT} data={data} dataset="transport_grains"
      field="soy_brl_kg" usdField="soy_usd_kg" hasUSD
      unit="R$/kg" usdUnit="US$/kg" decimals={2} fullWidth events={NO_EVENTS}
    />
    <PriceCard
      cardId="card-transport-corn-volume" title="Exportação Milho"
      sub="SECEX · Volume de Milho Exportado."
      accent={LATEST_YEAR_ACCENT} data={data} dataset="transport_grains" field="corn_volume_kt"
      unit="1000 t" decimals={1} fullWidth events={NO_EVENTS}
    />
    <PriceCard
      cardId="card-transport-corn-price" title="Preço Milho · Mercado Externo"
      sub="SECEX · Preço Milho Exportação"
      accent={LATEST_YEAR_ACCENT} data={data} dataset="transport_grains"
      field="corn_brl_kg" usdField="corn_usd_kg" hasUSD
      unit="R$/kg" usdUnit="US$/kg" decimals={2} fullWidth events={NO_EVENTS}
    />
  </main>
}

export function TransportesTab({ data, accent, tab }) {
  return tab === 'fretes' ? <FretesComingSoon/> : <GrainCharts data={data} accent={accent}/>
}
