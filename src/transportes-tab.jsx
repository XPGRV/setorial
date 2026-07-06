import React from 'react'
import brazilMap from '@svg-maps/brazil'
import { PriceCard } from './price-card.jsx'
import { MultiContinuousCard } from './continuous-chart.jsx'

const NO_EVENTS = []
const LATEST_YEAR_ACCENT = 'oklch(0.82 0.18 155)'
const FREIGHT_ACCENT = 'rgb(1 48 136)'
const FREIGHT_FIELDS = [
  { key: 'sorriso_santos', label: 'Sorriso → Santos', color: 'rgb(60 140 255)', from: 'Sorriso', to: 'Santos' },
  { key: 'rondonopolis_santos', label: 'Rondonópolis → Santos', color: 'rgb(204 242 97)', from: 'Rondonópolis', to: 'Santos' },
  { key: 'sorriso_rondonopolis', label: 'Sorriso → Rondonópolis', color: 'rgb(255 203 112)', from: 'Sorriso', to: 'Rondonópolis' },
]

const MAP_POINTS = {
  Sorriso: { x: 300, y: 303 },
  Rondonópolis: { x: 326, y: 371 },
  Santos: { x: 445, y: 493 },
}

function FreightRouteMap({ pinnedSeries, setPinnedSeries, fields, lastRow }) {
  const routes = fields.map(field => ({
    ...field,
    fromPoint: MAP_POINTS[field.from],
    toPoint: MAP_POINTS[field.to],
  }))
  const active = pinnedSeries || null
  const fmt = value => value == null ? '-' : Number(value).toFixed(0).replace('.', ',')
  const toggle = key => setPinnedSeries(current => current === key ? null : key)

  return (
    <div className="freight-map-panel">
      <div className="freight-map-copy">
        <div className="freight-map-title">Rotas IMEA</div>
        <div className="freight-map-sub">Selecione linha, legenda ou rota para destacar o trajeto.</div>
        <div className="freight-route-list">
          {routes.map(route => {
            const isOn = active === route.key
            const dimmed = active && !isOn
            return (
              <button key={route.key} className={`freight-route-chip ${isOn ? 'is-on' : ''}`}
                style={{'--route-color': route.color, opacity: dimmed ? 0.42 : 1}}
                onClick={() => toggle(route.key)}>
                <span className="freight-route-dot" />
                <span>{route.label}</span>
                <strong>{fmt(lastRow?.[route.key])}</strong>
              </button>
            )
          })}
        </div>
      </div>

      <svg className="freight-brazil-map" viewBox={brazilMap.viewBox} role="img" aria-label="Mapa do Brasil com rotas de frete">
        <g className="freight-map-states">
          {brazilMap.locations.map(state => (
            <path key={state.id} className={`freight-map-state freight-map-state-${state.id}`} d={state.path}>
              <title>{state.name}</title>
            </path>
          ))}
        </g>
        {routes.map(route => {
          const isOn = active === route.key
          const dimmed = active && !isOn
          const midX = (route.fromPoint.x + route.toPoint.x) / 2
          const midY = Math.min(route.fromPoint.y, route.toPoint.y) - 70
          const d = `M${route.fromPoint.x} ${route.fromPoint.y} Q${midX} ${midY} ${route.toPoint.x} ${route.toPoint.y}`
          return (
            <g key={route.key} className={`freight-map-route ${isOn ? 'is-on' : ''}`}
              style={{'--route-color': route.color, opacity: dimmed ? 0.18 : 1}}
              onClick={() => toggle(route.key)}>
              <path className="freight-map-route-glow" d={d} />
              <path className="freight-map-route-line" d={d} />
            </g>
          )
        })}
        {Object.entries(MAP_POINTS).map(([label, point]) => (
          <g key={label} className="freight-map-point">
            <circle cx={point.x} cy={point.y} r="5" />
            <text x={point.x + 9} y={point.y - 7}>{label}</text>
          </g>
        ))}
        <text className="freight-map-credit" x="610" y="635" textAnchor="end">Mapa: @svg-maps/brazil</text>
      </svg>
    </div>
  )
}

function FreightCharts({ data }) {
  const rows = React.useMemo(
    () => (data.transport_freights || []).filter(row => FREIGHT_FIELDS.some(field => row[field.key] != null)),
    [data.transport_freights]
  )
  if (!rows.length) {
    return <main className="main"><section className="card card-full"><div className="card-head"><div>
      <div className="card-eyebrow">Transportes · Fretes</div>
      <h3 className="card-title">Sem dados de fretes</h3>
      <div style={{fontSize:13,color:'var(--fg-dim)',marginTop:8}}>Atualize a planilha Transportes.xlsm para carregar os dados semanais do IMEA.</div>
    </div></div></section></main>
  }

  return (
    <main className="main">
      <MultiContinuousCard
        cardId="card-transport-freights"
        title="Preços de Frete"
        sub="IMEA · Rotas semanais · R$/ton"
        rows={rows}
        fields={FREIGHT_FIELDS}
        unit="R$/ton"
        decimals={0}
        height={330}
        defaultRange="5"
        beforeChart={({ pinnedSeries, setPinnedSeries, fields, lastRow }) => (
          <FreightRouteMap
            pinnedSeries={pinnedSeries}
            setPinnedSeries={setPinnedSeries}
            fields={fields}
            lastRow={lastRow}
          />
        )}
      />
    </main>
  )
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
  return tab === 'fretes' ? <FreightCharts data={data} accent={FREIGHT_ACCENT}/> : <GrainCharts data={data} accent={accent}/>
}
