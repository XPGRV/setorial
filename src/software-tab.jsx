import React from 'react'
import { Dropdown, WegPeersChart } from './weg-tab.jsx'

// Aba Software — dados da planilha TOTVS - Setorial.xlsm (aba Peers).
// Mesma mecânica da subseção Peers da WEG (WegPeersChart/Dropdown reaproveitados),
// com grupos ERP / Non-ERP e dois índices (IGV, SOXX) só no gráfico de preço.

// TOTVS é a empresa-referência (análoga à WEG em Capital Goods): sempre
// preservada ao aplicar um grupo. IGV (software) e SOXX (semicondutores) são
// índices de benchmark: sem classificação ERP/Non-ERP e sem P/E.
// Cores das empresas = cores oficiais de marca (definidas pelo usuário); TOTVS usa
// um roxo do universo TOTVS. IGV/SOXX: cinza e teal, fora da paleta das marcas.
const ENTITIES = [
  { key: 'totvs',      label: 'TOTVS',      kind: 'subject', color: '#8A4FFF' },
  { key: 'sap',        label: 'SAP',        kind: 'company', color: '#011449' },
  { key: 'sage',       label: 'SAGE',       kind: 'company', color: '#00D639' },
  { key: 'oracle',     label: 'Oracle',     kind: 'company', color: '#C74634' },
  { key: 'salesforce', label: 'Salesforce', kind: 'company', color: '#00A1E0' },
  { key: 'adobe',      label: 'Adobe',      kind: 'company', color: '#FF0000' },
  { key: 'microsoft',  label: 'Microsoft',  kind: 'company', color: '#FFB900' },
  { key: 'igv',        label: 'IGV',        kind: 'index',   color: '#8B8F99' },
  { key: 'soxx',       label: 'SOXX',       kind: 'index',   color: '#1FB5A8' },
]

const GROUPS = [
  { key: 'erp',    label: 'ERP Peers',     members: ['sap', 'sage'] },
  { key: 'nonerp', label: 'Non-ERP Peers', members: ['oracle', 'salesforce', 'adobe', 'microsoft'] },
]

const sameSet = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',')

// Qual grupo (se algum) corresponde à seleção atual. Só as empresas-peer contam:
// TOTVS e os índices não pertencem a grupo, então marcá-los não vira "Personalizado".
function groupOf(selected) {
  const companies = ENTITIES.filter(e => e.kind === 'company' && selected.has(e.key)).map(e => e.key)
  for (const g of GROUPS) if (sameSet(companies, g.members)) return g.key
  return companies.length ? 'custom' : 'none'
}

// 'price' = rebaseado em Base 100 (preços absolutos, em moedas diferentes, não são
// comparáveis); 'pe' = valor absoluto (o múltiplo já é comparável) e sem índices.
const METRICS = {
  price: {
    chartId: 'sw-price', suffix: '', rebase: true, indices: true, decimals: 1,
    cardId: 'card-software-peers', title: 'Peers · Comparação de Preço',
    eyebrow: 'Bloomberg · Preço das ações e índices · Base 100 (início da janela) · moeda local',
    dropdownLabel: 'Empresas e Índices',
  },
  pe: {
    chartId: 'sw-pe', suffix: '_pe', rebase: false, indices: false, decimals: 1,
    cardId: 'card-software-peers-pe', title: 'Peers · Comparação de P/E',
    eyebrow: 'Bloomberg · Múltiplo Preço/Lucro (P/E) Forward 12M',
    dropdownLabel: 'Empresas',
  },
}

const tOf = r => r.year + (r.month - 1) / 12 + (r.day - 0.5) / 365.25

function SoftwarePeersCard({ data, metric }) {
  const m = METRICS[metric]
  const allRows = React.useMemo(() => data.software_peers || [], [data])
  const entities = React.useMemo(() => ENTITIES.filter(e => m.indices || e.kind !== 'index'), [m])
  const [range, setRange] = React.useState('5')
  const [chartStyle, setChartStyle] = React.useState('line')
  // Abre com TOTVS + ERP Peers (== grupo "ERP Peers")
  const [selected, setSelected] = React.useState(() => new Set(['totvs', ...GROUPS[0].members]))
  const [pinnedKey, setPinnedKey] = React.useState(null)
  const [zoom, setZoom] = React.useState(null) // { t0, t1 } | null — brush zoom (sobrepõe o range)

  const rangeNum = range === 'all' ? 'all' : parseInt(range)
  const filtered = React.useMemo(() => {
    if (!allRows.length) return allRows
    if (zoom) return allRows.filter(r => { const t = tOf(r); return t >= zoom.t0 && t <= zoom.t1 })
    if (rangeNum === 'all') return allRows
    const last = allRows[allRows.length - 1]
    const cutOrd = last.year * 12 + last.month - rangeNum * 12
    return allRows.filter(r => r.year * 12 + r.month > cutOrd)
  }, [allRows, rangeNum, zoom])

  // Aplica o zoom só se houver pelo menos 2 pontos na janela (evita zoom vazio).
  const applyZoom = z => {
    let cnt = 0
    for (const r of allRows) { const t = tOf(r); if (t >= z.t0 && t <= z.t1) cnt++; if (cnt >= 2) break }
    if (cnt >= 2) setZoom(z)
  }

  // Lê cada série da coluna certa (suffix) e, no preço, rebaseia ao 1º valor da
  // janela visível (séries que começam depois — ex: IGV — partem de 100 na própria data).
  const rows = React.useMemo(() => {
    const firsts = {}
    return filtered.map(r => {
      const nr = { year: r.year, month: r.month, day: r.day }
      for (const e of entities) {
        const v = r[e.key + m.suffix]
        if (v == null) continue
        if (m.rebase) {
          if (firsts[e.key] == null && v !== 0) firsts[e.key] = v
          if (firsts[e.key] != null) nr[e.key] = (v / firsts[e.key]) * 100
        } else {
          nr[e.key] = v
        }
      }
      return nr
    })
  }, [filtered, entities, m])

  const peers = React.useMemo(() => entities.filter(e => selected.has(e.key)), [entities, selected])
  const curGroup = groupOf(selected)
  const groupLabel = curGroup === 'custom' ? 'Personalizado'
    : curGroup === 'none' ? 'Nenhum'
    : GROUPS.find(g => g.key === curGroup)?.label

  const toggleEntity = key => setSelected(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
  // Grupo é um atalho que troca só as empresas-peer; preserva TOTVS e os índices marcados.
  const applyGroup = g => setSelected(prev => {
    const next = new Set(g.members)
    for (const e of ENTITIES) if (e.kind !== 'company' && prev.has(e.key)) next.add(e.key)
    return next
  })

  const renderCheck = e => (
    <label key={e.key} className="weg-dd-check">
      <input type="checkbox" checked={selected.has(e.key)} onChange={() => toggleEntity(e.key)}/>
      <span className="weg-dd-dot" style={{ background: e.color }}/>
      <span>{e.label}</span>
    </label>
  )

  return (
    <section className="card card-full" data-card-id={m.cardId}>
      <div className="card-head">
        <div>
          <div className="card-eyebrow">{m.eyebrow}</div>
          <h3 className="card-title">{m.title}</h3>
        </div>

        <div className="card-controls">
          <div className="card-ctrl-row">
            <div className="year-seg">
              {[['3a', 3], ['5a', 5], ['10a', 10], ['Todos', 'all']].map(([label, val]) => (
                <button key={label} className={`year-seg-btn ${!zoom && range === String(val) ? 'is-on' : ''}`}
                  onClick={() => { setZoom(null); setRange(String(val)) }}>{label}</button>
              ))}
            </div>
            {zoom && (
              <button className="seg-btn weg-zoom-reset" onClick={() => setZoom(null)} title="Duplo-clique no gráfico também reseta">
                ⤢ Reset zoom
              </button>
            )}
            <div className="seg">
              {[['line', 'Linha'], ['area', 'Área']].map(([v, l]) => (
                <button key={v} className={`seg-btn ${chartStyle === v ? 'is-on' : ''}`}
                  onClick={() => setChartStyle(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="card-ctrl-row">
            <Dropdown label={`Grupo: ${groupLabel}`} width={190}>
              {GROUPS.map(g => (
                <button key={g.key} className={`weg-dd-opt ${curGroup === g.key ? 'is-on' : ''}`}
                  onClick={() => applyGroup(g)}>{g.label}</button>
              ))}
            </Dropdown>
            <Dropdown label={`${m.dropdownLabel} (${peers.length})`} width={210}>
              {entities.filter(e => e.kind !== 'index').map(renderCheck)}
              {m.indices && <div className="weg-dd-sep"/>}
              {m.indices && entities.filter(e => e.kind === 'index').map(renderCheck)}
            </Dropdown>
          </div>
        </div>
      </div>

      <WegPeersChart rows={rows} peers={peers} chartStyle={chartStyle}
        pinnedKey={pinnedKey} setPinnedKey={setPinnedKey}
        chartId={m.chartId} decimals={m.decimals}
        onZoom={applyZoom} onResetZoom={() => setZoom(null)}/>
    </section>
  )
}

export function SoftwareTab({ data }) {
  if (!(data.software_peers || []).length) {
    return (
      <main className="main">
        <section className="card card-full">
          <div className="card-head"><div>
            <div className="card-eyebrow">Software · Peers</div>
            <h3 className="card-title">Sem dados de peers</h3>
            <div style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 8 }}>
              Atualize a planilha TOTVS - Setorial.xlsm para carregar TOTVS, SAP, SAGE, Oracle, Salesforce, Adobe, Microsoft, IGV e SOXX.
            </div>
          </div></div>
        </section>
      </main>
    )
  }
  return (
    <main className="main">
      <SoftwarePeersCard data={data} metric="price"/>
      <SoftwarePeersCard data={data} metric="pe"/>
    </main>
  )
}
