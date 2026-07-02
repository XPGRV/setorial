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
// Store global de dados — mesclado por dataset (stale-while-revalidate).
// Cada planilha vive em dashboard/data-<dataset>.json no Storage; enquanto o
// arquivo separado não existir, o backend cai para o data.json combinado.
// ============================================================================
const DATA_VERSION = '5'
const SB_URL = 'https://wmxjdveucxbousoquwmc.supabase.co'
window.__SB_URL = SB_URL

// Basta UMA dessas chaves presente no data para considerar o dataset carregado
const DATASET_PROBE_KEYS = {
  beef_us:    ['beef_us', 'edgebeef_daily', 'production'],
  beef_br:    ['beef', 'abates', 'secex'],
  poultry_br: ['frango', 'processados'],
  poultry_us: ['frango_us_daily', 'frango_us_monthly', 'broiler_production'],
  macro:      ['selic_snapshots'],
  weg:        ['weg_peers', 'weg_transformadores'],
}
const SECTION_DATASETS = {
  proteinas:    ['beef_us', 'beef_br', 'poultry_br', 'poultry_us'],
  macro:        ['macro'],
  capitalgoods: ['weg'],
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
  return (DATASET_PROBE_KEYS[ds] || []).some(k => data[k] != null)
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
    return mergePayload(json.data, json.meta || null)
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

// Datasets já revalidados na rede nesta sessão (evita refetch a cada navegação)
const revalidated = new Set()

// Garante os dados de uma seção antes de renderizar:
//  - dataset nunca carregado → bloqueia até baixar (1º o ativo; o backend pode
//    responder com o data.json combinado e suprir os demais de uma vez)
//  - dataset já em cache → resolve imediatamente e revalida em background
async function ensureSectionData(section, initialDataset) {
  const wanted = SECTION_DATASETS[section] || []
  const loadedBefore = new Set(Object.keys(DATASET_PROBE_KEYS).filter(isDatasetLoaded))
  const missing = wanted.filter(ds => !loadedBefore.has(ds))

  if (missing.length) {
    const first = missing.includes(initialDataset) ? initialDataset : missing[0]
    try { await fetchDatasetOnce(first) } catch {}
    const stillMissing = wanted.filter(ds => !isDatasetLoaded(ds))
    if (stillMissing.length) await Promise.allSettled(stillMissing.map(fetchDatasetOnce))
    // Tudo que carregou nesta chamada veio fresco da rede
    for (const ds of Object.keys(DATASET_PROBE_KEYS)) {
      if (!loadedBefore.has(ds) && isDatasetLoaded(ds)) revalidated.add(ds)
    }
  }

  // Fallback final — data.json embutido no build (primeira visita sem rede)
  if (!window.__dashboardData && !wanted.every(isDatasetLoaded)) {
    try {
      const resp = await fetch('./data.json')
      if (resp.ok) {
        const json = await resp.json()
        if (json) mergePayload(json, { source: 'planilha inicial', updated: null })
      }
    } catch {}
  }

  // Revalidação em background do que veio do cache local
  const stale = wanted.filter(ds => loadedBefore.has(ds) && !revalidated.has(ds))
  stale.forEach(ds => revalidated.add(ds))
  if (stale.length) {
    Promise.allSettled(stale.map(fetchDatasetOnce)).then(results => {
      if (results.some(r => r.status === 'fulfilled')) notifyDataUpdated()
    })
  }

  return currentPayload()
}

// Força busca na rede (usado pelo botão "Atualizar planilha" após o update)
window.refreshDashboardData = async (dataset) => {
  const targets = dataset
    ? [dataset]
    : Object.keys(DATASET_PROBE_KEYS).filter(isDatasetLoaded)
  if (!targets.length) targets.push('beef_us')
  let payload = currentPayload()
  for (const ds of targets) payload = await fetchDatasetPayload(ds)
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

// Cache local → primeiro paint instantâneo; a revalidação acontece por seção
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
      ensureSectionData(dashboardSection, initialDataset),
    ]).then(([module, payload]) => {
      if (active) setReady({ Component: module.default, ...payload })
    })
    return () => { active = false }
  }, [dashboardSection, initialDataset])

  if (!ready) {
    const label = dashboardSection === 'macro' ? 'Macro' : dashboardSection === 'capitalgoods' ? 'Capital Goods' : 'Proteinas'
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
