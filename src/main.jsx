import React from 'react'
import ReactDOM from 'react-dom/client'

// Importa em ordem de dependência (reactive primeiro, app por último)
import './reactive.js'
import './data-utils.jsx'
import './upload.jsx'
import './seasonal-chart.jsx'
import './ciclo-boi.jsx'
import './beef-us-tab.jsx'
import './production-chart.jsx'
import './bimonthly-chart.jsx'
import './continuous-chart.jsx'
import './poultry-br-tab.jsx'
import './poultry-us-tab.jsx'
import './app.jsx'

// Aplica tema antes do primeiro paint
document.documentElement.dataset.theme   = 'aurora'
document.documentElement.dataset.density = 'comfortable'
document.documentElement.style.setProperty('--accent', 'oklch(0.82 0.18 155)')

;(async () => {
  const DATA_VERSION = '5'
  const SB_URL = 'https://wmxjdveucxbousoquwmc.supabase.co'
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGpkdmV1Y3hib3Vzb3F1d21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDAwMDMsImV4cCI6MjA5MjUxNjAwM30.tCSFE_aRcjrVRziuyqINPuxBYFEbG8AQjTdX2vHiwfw'
  window.__SB_URL = SB_URL
  window.__SB_KEY = SB_KEY

  let data = null, meta = null

  // 1. Supabase — versão mais recente do último upload
  try {
    const resp = await fetch(
      `${SB_URL}/storage/v1/object/public/dashboard/data.json?t=${Date.now()}`,
      { cache: 'no-store' }
    )
    if (resp.ok) {
      const json = await resp.json()
      if (json?.data) { data = json.data; meta = json.meta || null }
    }
  } catch {}

  // 2. localStorage — cache local do browser
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

  // 3. Fallback — data.json embutido no repositório
  if (!data) {
    try {
      const resp = await fetch('./data.json')
      if (resp.ok) {
        const json = await resp.json()
        if (json) { data = json; meta = { source: 'planilha inicial', updated: null } }
      }
    } catch {}
  }

  // Normaliza pct_femeas (dados antigos salvos como 3925 em vez de 39.25)
  if (data) {
    const fixPct = rows => rows?.map(r =>
      r.pct_femeas != null && r.pct_femeas > 100
        ? { ...r, pct_femeas: Math.round(r.pct_femeas * 10) / 1000 }
        : r
    )
    if (data.beef)    data.beef    = fixPct(data.beef)
    if (data.beef_us) data.beef_us = fixPct(data.beef_us)
  }

  // Migra meta antigo para novo formato { br, us }
  if (meta && !meta.br && !meta.us && meta.updated) meta = { br: meta }

  window.__dashboardData = data
  window.__dashboardMeta = meta || {}

  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(<window.App initialData={data} initialMeta={meta} />)

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
