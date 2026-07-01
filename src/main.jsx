import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './reactive.js'
import HomePage from './home.jsx'

const ProteinasApp = lazy(() => import('./proteinas-entry.jsx'))

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

;(async () => {
  const DATA_VERSION = '5'
  const SB_URL = 'https://wmxjdveucxbousoquwmc.supabase.co'
  window.__SB_URL = SB_URL

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

  async function fetchCloudDashboardData(timeoutMs = 8000) {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await fetch(
        `/api/dashboard-data?t=${Date.now()}`,
        { cache: 'no-store', signal: ctrl.signal }
      )
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      if (!json?.data) throw new Error('data.json sem dados')
      const payload = normalizeDashboardPayload(json.data, json.meta || null)
      try {
        localStorage.setItem('dashboard_data', JSON.stringify(payload.data))
        localStorage.setItem('dashboard_meta', JSON.stringify(payload.meta))
        localStorage.setItem('dashboard_version', DATA_VERSION)
      } catch {}
      window.__dashboardData = payload.data
      window.__dashboardMeta = payload.meta
      return payload
    } finally {
      clearTimeout(tid)
    }
  }

  window.refreshDashboardData = async () => {
    const payload = await fetchCloudDashboardData()
    window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: payload }))
    return payload
  }

  let data = null, meta = null

  try {
    const payload = await fetchCloudDashboardData(15000)
    data = payload.data
    meta = payload.meta
  } catch {}

  // Fallback 1 — localStorage
  if (!data) {
    try {
      const cached        = localStorage.getItem('dashboard_data')
      const cachedMeta    = localStorage.getItem('dashboard_meta')
      const cachedVersion = localStorage.getItem('dashboard_version')
      if (cached && cachedVersion === DATA_VERSION) {
        data = JSON.parse(cached)
        meta = cachedMeta ? JSON.parse(cachedMeta) : null
      } else {
        localStorage.removeItem('dashboard_data')
        localStorage.removeItem('dashboard_meta')
        localStorage.removeItem('dashboard_version')
      }
    } catch {}
  }

  // Fallback 2 — data.json embutido
  if (!data) {
    try {
      const resp = await fetch('./data.json')
      if (resp.ok) {
        const json = await resp.json()
        if (json) { data = json; meta = { source: 'planilha inicial', updated: null } }
      }
    } catch {}
  }

  ;({ data, meta } = normalizeDashboardPayload(data, meta))

  window.__dashboardData = data
  window.__dashboardMeta = meta

  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/home" replace />} />
        <Route path="/home"      element={<HomePage />} />
        <Route path="/proteinas" element={
          <Suspense fallback={<div className="sector-loading">Carregando…</div>}>
            <ProteinasApp initialData={data} initialMeta={meta} />
          </Suspense>
        } />
      </Routes>
    </BrowserRouter>
  )

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
})()
