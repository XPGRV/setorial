import React from 'react'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const BLUE = '#4387d9'
const RED = '#dc4d43'
const GRAY = '#90979d'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const pathFor = (rows, field, x, y) => rows.reduce((d, row, i) => {
  const value = row[field]
  if (value == null) return d
  return `${d}${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`
}, '')

function RentalPriceChart({ rows }) {
  const [hover, setHover] = React.useState(null)
  const W = 1100, H = 390
  const pad = { l: 58, r: 62, t: 24, b: 48 }
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b
  const priceValues = rows.flatMap(r => [r.new_price_index, r.used_price_index]).filter(Number.isFinite)
  const spreadValues = rows.map(r => r.used_new_spread).filter(Number.isFinite)
  const priceMin = Math.floor(Math.min(...priceValues, 0) / 20) * 20
  const priceMax = Math.ceil(Math.max(...priceValues) / 20) * 20
  const spreadMin = Math.floor(Math.min(...spreadValues) * 20) / 20
  const spreadMax = Math.max(0, Math.ceil(Math.max(...spreadValues) * 20) / 20)
  const x = i => pad.l + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * innerW
  const yPrice = v => pad.t + (priceMax - v) / (priceMax - priceMin || 1) * innerH
  const ySpread = v => pad.t + (spreadMax - v) / (spreadMax - spreadMin || 1) * innerH
  const priceTicks = Array.from({ length: 6 }, (_, i) => priceMin + (priceMax - priceMin) * i / 5)
  const spreadTicks = Array.from({ length: 6 }, (_, i) => spreadMin + (spreadMax - spreadMin) * i / 5)
  const yearTicks = rows.map((r, i) => ({ ...r, i })).filter(r => r.month === 1 && (rows.length < 150 || r.year % 2 === 0))
  const spreadPath = pathFor(rows, 'used_new_spread', x, ySpread)
  const zeroY = ySpread(0)
  const areaPath = spreadPath ? `${spreadPath}L${x(rows.length - 1)},${zeroY}L${x(0)},${zeroY}Z` : ''

  const onMove = e => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - box.left) / box.width * W
    setHover(clamp(Math.round((px - pad.l) / innerW * (rows.length - 1)), 0, rows.length - 1))
  }

  return <div className="rental-chart-wrap">
    <svg className="rental-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Preço de automóveis novos e usados e spread usado sobre novo"
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {priceTicks.map((v, i) => {
        const yy = yPrice(v)
        return <g key={v}><line x1={pad.l} x2={W-pad.r} y1={yy} y2={yy} className="rental-grid"/><text x={pad.l-10} y={yy+4} textAnchor="end" className="rental-axis">{v.toFixed(0)}</text><text x={W-pad.r+10} y={yy+4} className="rental-axis">{(spreadTicks[i]*100).toFixed(0)}%</text></g>
      })}
      {yearTicks.map(r => <text key={`${r.year}-${r.i}`} x={x(r.i)} y={H-18} textAnchor="middle" className="rental-axis">{String(r.year).slice(-2)}</text>)}
      <path d={areaPath} fill="color-mix(in srgb, var(--fg-dim) 14%, transparent)"/>
      <path d={spreadPath} fill="none" stroke={GRAY} strokeWidth="1.5"/>
      <path d={pathFor(rows, 'new_price_index', x, yPrice)} fill="none" stroke={BLUE} strokeWidth="2.5"/>
      <path d={pathFor(rows, 'used_price_index', x, yPrice)} fill="none" stroke={RED} strokeWidth="2.5"/>
      {hover != null && <>
        <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H-pad.b} className="rental-crosshair"/>
        {rows[hover].new_price_index != null && <circle cx={x(hover)} cy={yPrice(rows[hover].new_price_index)} r="4" fill={BLUE}/>} 
        {rows[hover].used_price_index != null && <circle cx={x(hover)} cy={yPrice(rows[hover].used_price_index)} r="4" fill={RED}/>} 
      </>}
    </svg>
    {hover != null && <div className="rental-tooltip" style={{ left: `${clamp(x(hover) / W * 100, 11, 78)}%` }}>
      <strong>{MONTHS[rows[hover].month-1]}/{String(rows[hover].year).slice(-2)}</strong>
      <span><i style={{background:BLUE}}/>Novo <b>{rows[hover].new_price_index?.toFixed(1)}</b></span>
      <span><i style={{background:RED}}/>Usado ajustado <b>{rows[hover].used_price_index?.toFixed(1)}</b></span>
      <span><i style={{background:GRAY}}/>Spread <b>{rows[hover].used_new_spread == null ? '—' : `${(rows[hover].used_new_spread*100).toFixed(1)}%`}</b></span>
    </div>}
  </div>
}

export function RentalTab({ data }) {
  const rows = data.rental_car_prices || []
  const [range, setRange] = React.useState('5a')
  if (!rows.length) return <main className="main"><section className="card card-full"><div className="card-head"><div><div className="card-eyebrow">Carros</div><h3 className="card-title">Preços e Spreads</h3><div className="rental-empty">Atualize a planilha CarRental.xlsm para visualizar o gráfico.</div></div></div></section></main>
  const latest = rows.at(-1)
  const yearsByRange = { '3a': 3, '5a': 5, '10a': 10 }
  const visibleRows = range === 'Todos'
    ? rows
    : rows.filter(row => row.year >= latest.year - yearsByRange[range] + 1)
  return <main className="main">
    <section className="card card-full" data-card-id="card-rental-car-prices">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Cálculo Próprio · IPCA Mensal</div>
          <h3 className="card-title">Preços e Spreads</h3>
          <div className="rental-latest">
            <span className="rental-latest-item" style={{color:BLUE}}><b>{latest.new_price_index.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</b><small>Novo</small></span>
            <span className="rental-latest-item" style={{color:RED}}><b>{latest.used_price_index.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</b><small>Usado</small></span>
            <span className="card-unit">Base 100</span>
            <span className="card-date">{MONTHS[latest.month-1]}/{String(latest.year).slice(-2)}</span>
          </div>
        </div>
        <div className="card-controls"><div className="card-ctrl-row"><div className="year-seg">
          {['3a','5a','10a','Todos'].map(option => <button key={option} className={`year-seg-btn ${range === option ? 'is-on' : ''}`} onClick={() => setRange(option)}>{option}</button>)}
        </div></div></div>
      </div>
      <RentalPriceChart rows={visibleRows}/>
      <div className="ciclo-legend">
        <span className="legend-year" style={{padding:'2px 6px'}}><span className="legend-line" style={{background:BLUE}}/>Automóvel novo</span>
        <span className="legend-year" style={{padding:'2px 6px'}}><span className="legend-line" style={{background:RED}}/>Automóvel usado ajustado</span>
        <span className="legend-year" style={{padding:'2px 6px'}}><span className="legend-line" style={{background:GRAY}}/>Spread usado / novo</span>
      </div>
    </section>
  </main>
}
