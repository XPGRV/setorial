import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './reactive.js'
import HomePage from './home.jsx'

function ProteinasLoading({ label = 'Proteinas' }) {
  return (
    <div className="proteinas-loading" role="status" aria-label="Carregando Proteinas">
      <div className="proteinas-loading-media">
        <img src="/xp-asset-logo.svg" alt="XP Asset Management" fetchPriority="high" />
      </div>
      <div className="proteinas-loading-text">
        <div className="proteinas-loading-title">{label}</div>
        <div className="proteinas-loading-sub">Carregando dados...</div>
      </div>
      <div className="proteinas-loading-bar" />
    </div>
  )
}

// ============================================================================
// Store global de dados — mesclado por dataset (network-first).
// Ao abrir uma seção, os datasets dela são SEMPRE buscados frescos na rede;
// o cache local (localStorage) só entra como fallback se a rede falhar.
// Cada planilha vive em dashboard/data-<dataset>.json no Storage; enquanto o
// arquivo separado não existir, o backend cai para o data.json combinado.
// ============================================================================
const DATA_VERSION = '9'
const SB_URL = 'https://wmxjdveucxbousoquwmc.supabase.co'
window.__SB_URL = SB_URL

// Chaves do data.json que pertencem a cada dataset (espelha parse-workbook.js).
// Usado p/ saber se um dataset está carregado e p/ recortar respostas do
// data.json combinado legado — que está congelado e NÃO pode sobrescrever
// os arquivos por-dataset frescos.
const DATASET_DATA_KEYS = {
  beef_us:    ['beef_us', 'edgebeef_daily', 'production'],
  beef_br:    ['beef', 'secex', 'abates', 'carne_mi_daily', 'carne_mi_usd_daily', 'boi_gordo_daily', 'spread_mi_daily'],
  poultry_br: ['frango', 'frango_mi_daily', 'feed_grain_daily', 'frango_spread_mi_daily', 'porco_mi_daily', 'processados'],
  poultry_us: ['broiler_production', 'frango_us_daily', 'frango_us_monthly', 'frango_us_nc_weekly', 'frango_us_nc_cols'],
  macro:      ['selic_snapshots'],
  weg:        ['weg_transformadores', 'weg_transformadores_exports', 'weg_transformadores_secex_price', 'weg_transformadores_secex_units', 'weg_eie_exports', 'weg_peers'],
  rental:     ['rental_car_prices', 'rental_peers'],
  transportes:['transport_grains', 'transport_freights'],
  agro:       ['agro_cotton_daily', 'agro_soy_daily', 'agro_cotton_futures', 'agro_soy_futures'],
}
const DATASET_META_KEYS = {
  beef_us: 'us', beef_br: 'br', poultry_br: 'poultry_br',
  poultry_us: 'poultry_us', macro: 'selic', weg: 'weg',
  rental: 'rental',
  transportes: 'transportes',
  agro: 'agro',
}
const SECTION_DATASETS = {
  proteinas:    ['beef_us', 'beef_br', 'poultry_br', 'poultry_us'],
  macro:        ['macro'],
  capitalgoods: ['weg'],
  rental:       ['rental'],
  transportes:  ['transportes'],
  agro:         ['agro'],
}

const normalizeDashboardPayload = (data, meta) => {
  if (data) {
    const fixPct = rows => rows?.map(r =>
      r.pct_femeas != null && r.pct_femeas > 100
        ? { ...r, pct_femeas: Math.round(r.pct_femeas * 10) / 1000 }
        : r
    )
    if (data.beef)    data.beef    = fixPct(data.beef)
    if (data.beef_us) data.beef_us = fixPct(data.beef_us)
  }
  if (meta && !meta.br && !meta.us && meta.updated) meta = { br: meta }
  return { data, meta: meta || {} }
}

function isDatasetLoaded(ds) {
  const data = window.__dashboardData
  if (!data) return false
  return (DATASET_DATA_KEYS[ds] || []).some(k => data[k] != null)
}

function persistCache() {
  try {
    localStorage.setItem('dashboard_data', JSON.stringify(window.__dashboardData))
    localStorage.setItem('dashboard_meta', JSON.stringify(window.__dashboardMeta))
    localStorage.setItem('dashboard_version', DATA_VERSION)
  } catch {}
}

function mergePayload(data, meta) {
  const norm = normalizeDashboardPayload(data, meta)
  window.__dashboardData = { ...(window.__dashboardData || {}), ...(norm.data || {}) }
  window.__dashboardMeta = { ...(window.__dashboardMeta || {}), ...(norm.meta || {}) }
  persistCache()
  return { data: window.__dashboardData, meta: window.__dashboardMeta }
}

function currentPayload() {
  return { data: window.__dashboardData || null, meta: window.__dashboardMeta || {} }
}

function notifyDataUpdated() {
  window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: currentPayload() }))
}

// Datasets já buscados frescos na rede nesta sessão
const freshDatasets = new Set()

async function fetchDatasetPayload(dataset, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const resp = await fetch(
      `/api/dashboard-data?dataset=${encodeURIComponent(dataset)}&t=${Date.now()}`,
      { cache: 'no-store', signal: ctrl.signal }
    )
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const json = await resp.json()
    if (!json?.data) throw new Error('payload sem dados')
    let data = json.data
    let meta = json.meta || null
    // Resposta contém chaves de OUTROS datasets? Então veio do data.json
    // combinado legado (fallback de migração). Recorta só o dataset pedido:
    // o combinado está congelado e não pode sobrescrever dados frescos.
    const otherKeys = Object.entries(DATASET_DATA_KEYS)
      .filter(([ds]) => ds !== dataset)
      .flatMap(([, keys]) => keys)
    if (otherKeys.some(k => data[k] != null)) {
      const ownKeys = DATASET_DATA_KEYS[dataset] || []
      data = Object.fromEntries(ownKeys.filter(k => json.data[k] != null).map(k => [k, json.data[k]]))
      const mk = DATASET_META_KEYS[dataset]
      meta = (mk && json.meta?.[mk]) ? { [mk]: json.meta[mk] } : {}
    }
    freshDatasets.add(dataset)
    return mergePayload(data, meta)
  } finally {
    clearTimeout(tid)
  }
}

// Dedupe de fetches simultâneos do mesmo dataset
const inflight = new Map()
function fetchDatasetOnce(ds) {
  if (!inflight.has(ds)) {
    inflight.set(ds, fetchDatasetPayload(ds).finally(() => inflight.delete(ds)))
  }
  return inflight.get(ds)
}

// Garante dados FRESCOS de uma seção antes de renderizar (network-first):
// busca cada dataset na rede uma vez por sessão (em paralelo), bloqueando o
// render até chegar. Se a rede falhar, o cache local segura a tela.
async function ensureSectionData(section) {
  const wanted = SECTION_DATASETS[section] || []
  const pending = wanted.filter(ds => !freshDatasets.has(ds))
  if (pending.length) await Promise.allSettled(pending.map(fetchDatasetOnce))

  // Fallback final — data.json embutido no build (sem rede e sem cache)
  if (!window.__dashboardData) {
    try {
      const resp = await fetch('./data.json')
      if (resp.ok) {
        const json = await resp.json()
        if (json) mergePayload(json, { source: 'planilha inicial', updated: null })
      }
    } catch {}
  }

  // Modo offline: algum dataset da seção não veio fresco da rede — a UI mostra
  // um aviso de que os dados exibidos são os últimos salvos localmente
  window.__dashboardOffline = wanted.some(ds => !freshDatasets.has(ds))

  return currentPayload()
}

// Força busca na rede (usado pelo botão "Atualizar planilha" após o update)
window.refreshDashboardData = async (dataset) => {
  const targets = dataset
    ? [dataset]
    : Object.keys(DATASET_DATA_KEYS).filter(isDatasetLoaded)
  if (!targets.length) targets.push('beef_us')
  let payload = currentPayload()
  for (const ds of targets) payload = await fetchDatasetPayload(ds)
  window.__dashboardOffline = false
  notifyDataUpdated()
  return payload
}

// ── Boot síncrono ────────────────────────────────────────────────────────────
// Aplica tema antes do primeiro paint
document.documentElement.dataset.theme   = 'flux'
document.documentElement.dataset.density = 'comfortable'

// Resolve modo claro/escuro antes do paint (evita flash de tema errado)
const savedMode = (() => { try { return localStorage.getItem('rx-color-mode') } catch { return null } })()
const sysDark   = window.matchMedia('(prefers-color-scheme: dark)').matches
const resolved  = (savedMode === 'light' || savedMode === 'dark') ? savedMode : (sysDark ? 'dark' : 'light')
document.documentElement.dataset.mode = resolved
document.documentElement.style.setProperty('--accent',
  resolved === 'light' ? 'oklch(0.55 0.18 155)' : 'oklch(0.82 0.18 155)')

// Cache local → apenas fallback offline; a abertura sempre busca dados frescos
try {
  const cached        = localStorage.getItem('dashboard_data')
  const cachedVersion = localStorage.getItem('dashboard_version')
  if (cached && cachedVersion === DATA_VERSION) {
    window.__dashboardData = JSON.parse(cached)
    const cachedMeta = localStorage.getItem('dashboard_meta')
    window.__dashboardMeta = cachedMeta ? JSON.parse(cachedMeta) : {}
  } else {
    localStorage.removeItem('dashboard_data')
    localStorage.removeItem('dashboard_meta')
    localStorage.removeItem('dashboard_version')
  }
} catch {}

function ProteinasRoute({ initialDataset = 'beef_us', dashboardSection = 'proteinas' }) {
  const [ready, setReady] = React.useState(null)

  React.useEffect(() => {
    let active = true
    Promise.all([
      import('./proteinas-entry.jsx'),
      ensureSectionData(dashboardSection),
    ]).then(([module, payload]) => {
      if (active) setReady({ Component: module.default, ...payload })
    })
    return () => { active = false }
  }, [dashboardSection, initialDataset])

  if (!ready) {
    const label = dashboardSection === 'macro' ? 'Macro' : dashboardSection === 'capitalgoods' ? 'Capital Goods' : dashboardSection === 'rental' ? 'Rental' : dashboardSection === 'transportes' ? 'Transportes' : dashboardSection === 'agro' ? 'Agro' : 'Proteinas'
    return <ProteinasLoading label={label} />
  }
  const { Component } = ready
  return <Component initialData={ready.data} initialMeta={ready.meta}
    initialDataset={initialDataset} dashboardSection={dashboardSection} />
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/"          element={<Navigate to="/home" replace />} />
      <Route path="/home"      element={<HomePage />} />
      <Route path="/proteinas" element={
        <ProteinasRoute initialDataset="beef_us" dashboardSection="proteinas" />
      } />
      <Route path="/macro" element={
        <ProteinasRoute initialDataset="macro" dashboardSection="macro" />
      } />
      <Route path="/capitalgoods" element={
        <ProteinasRoute initialDataset="weg" dashboardSection="capitalgoods" />
      } />
      <Route path="/rental" element={
        <ProteinasRoute initialDataset="rental" dashboardSection="rental" />
      } />
      <Route path="/transportes" element={
        <ProteinasRoute initialDataset="transportes" dashboardSection="transportes" />
      } />
      <Route path="/agro" element={
        <ProteinasRoute initialDataset="agro" dashboardSection="agro" />
      } />
    </Routes>
  </BrowserRouter>
)

// Pré-aquece o chunk das dashboards enquanto o usuário está na home
setTimeout(() => { import('./proteinas-entry.jsx') }, 2500)

// Esconde loading screen após o browser pintar o React
requestAnimationFrame(() => requestAnimationFrame(() => {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen')
    if (ls) {
      ls.classList.add('is-hidden')
      ls.addEventListener('transitionend', () => ls.remove(), { once: true })
    }
  }, 120)
}))
