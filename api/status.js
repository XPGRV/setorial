// GET /api/status — sinal de saúde dos dados do dashboard.
//
// Junta três coisas, no momento da consulta:
//   1. A data do último ponto de cada série (status-<dataset>.json, gravado
//      junto com cada publicação; se ainda não existir, cai para o data-*.json).
//   2. As execuções do "Coleta completa" no XPGRV/pythonsetorial: job por
//      planilha + anotações de erro, que dizem QUAL etapa falhou.
//   3. A última publicação (update-data.yml no XPGRV/setorial).
//
// As regras de cor e o mapa card -> fonte vivem em src/data-status.js.
//
// Variáveis (Vercel):
//   SUPABASE_SERVICE_ROLE  obrigatória (já usada pelos outros endpoints)
//   GITHUB_STATUS_TOKEN    opcional. Os repos são públicos, então funciona sem;
//                          o token só sobe o limite da API do GitHub de 60 para
//                          5000 consultas/hora. Fine-grained, "Actions: Read".
import {
  SOURCES, PLANILHAS, DATASET_LABELS, worstColor,
  summarizeLastDates, sourceDataDate,
  colorBloomberg, colorColeta, colorPublicacao, expectedBloombergDate,
} from '../src/data-status.js'

const SB_URL = process.env.SUPABASE_URL || 'https://wmxjdveucxbousoquwmc.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE
const GH_TOKEN = process.env.GITHUB_STATUS_TOKEN

const REPO_COLETA = 'XPGRV/pythonsetorial'
const WORKFLOW_COLETA = 'coleta-tudo.yml'
const REPO_DASH = 'XPGRV/setorial'
const WORKFLOW_DASH = 'update-data.yml'
// Quantas execuções da coleta olhar para trás procurando o último sucesso de
// cada etapa. 10 cobre ~5 dias com os dois ciclos diários.
const MAX_RUNS = 10

const DATASETS = Object.keys(DATASET_LABELS)

// ── GitHub ──────────────────────────────────────────────────────────────────
export async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'setorial-dashboard-status',
      ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
    },
  })
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    const hint = remaining === '0' ? ' (limite da API do GitHub esgotado — configure GITHUB_STATUS_TOKEN)' : ''
    throw new Error(`GitHub ${path}: HTTP ${res.status}${hint}`)
  }
  return res.json()
}

// "BeefBR: a etapa 'SECEX Comex Stat' falhou (exit code 1)..." -> 'SECEX Comex Stat'
const STEP_FAIL_RE = /a etapa (?:opcional )?'([^']+)' falhou/

async function jobOutcomes(run, ghFetch) {
  const { jobs = [] } = await ghFetch(`/repos/${REPO_COLETA}/actions/runs/${run.id}/jobs?per_page=50`)
  const out = {}
  await Promise.all(jobs.filter(j => PLANILHAS[j.name]).map(async job => {
    const info = {
      conclusion: job.conclusion || job.status,
      completedAt: job.completed_at,
      url: job.html_url,
      failedSteps: [],
      errors: [],
    }
    if (job.conclusion === 'failure') {
      try {
        const anns = await ghFetch(`/repos/${REPO_COLETA}/check-runs/${job.id}/annotations?per_page=50`)
        for (const a of anns) {
          if (a.annotation_level !== 'failure') continue
          const m = STEP_FAIL_RE.exec(a.message || '')
          if (m) info.failedSteps.push(m[1])
          else if (!/Process completed with exit code/.test(a.message || '')) info.errors.push(a.message)
        }
      } catch (e) {
        info.errors.push(`Não foi possível ler as anotações: ${e.message}`)
      }
    } else if (job.conclusion && job.conclusion !== 'success') {
      info.errors.push(job.conclusion === 'cancelled' ? 'Job cancelado (provável timeout)' : `Job terminou como ${job.conclusion}`)
    }
    out[job.name] = info
  }))
  return out
}

// Resultado de UMA etapa num run: true (ok), false (falhou) ou null (o job
// nem aparece no run).
function stepOk(jobInfo, step) {
  if (!jobInfo) return null
  if (jobInfo.conclusion === 'success') return true
  // Job falhou e as anotações dizem quais etapas: as demais rodaram bem.
  if (jobInfo.conclusion === 'failure' && jobInfo.failedSteps.length) {
    return !jobInfo.failedSteps.includes(step)
  }
  // Falhou sem dizer onde (download, timeout, cancelado): não dá para confiar
  // em nenhuma etapa desse job.
  return false
}

export async function loadColeta(ghFetch = gh) {
  const { workflow_runs: runs = [] } = await ghFetch(
    `/repos/${REPO_COLETA}/actions/workflows/${WORKFLOW_COLETA}/runs?per_page=${MAX_RUNS}`)
  const completed = runs.filter(r => r.status === 'completed')
  const running = runs.find(r => r.status !== 'completed') || null

  // Etapas que precisamos resolver: as das fontes + o consolidador de cada job.
  const wanted = new Map()
  for (const s of Object.values(SOURCES)) {
    if (s.kind !== 'coleta') continue
    const steps = [s.step, PLANILHAS[s.job]?.consolidador].filter(Boolean)
    for (const st of steps) wanted.set(`${s.job}::${st}`, { job: s.job, step: st, lastOk: null, lastFail: null })
  }

  // Do mais novo para o mais velho, parando quando todas as etapas já têm um
  // sucesso — no dia a dia isso é 1 ou 2 runs, poupando a cota do GitHub.
  const runsInfo = []
  for (const run of completed) {
    const jobs = await jobOutcomes(run, ghFetch)
    runsInfo.push({ id: run.id, number: run.run_number, conclusion: run.conclusion,
      createdAt: run.created_at, url: run.html_url, jobs })
    for (const w of wanted.values()) {
      if (w.lastOk) continue
      const ok = stepOk(jobs[w.job], w.step)
      if (ok === true) w.lastOk = { at: run.created_at, run: run.run_number, url: run.html_url }
      else if (ok === false && !w.lastFail) {
        const j = jobs[w.job]
        w.lastFail = { at: run.created_at, run: run.run_number, url: j?.url || run.html_url,
          motivo: j?.failedSteps?.includes(w.step)
            ? `Etapa '${w.step}' falhou`
            : (j?.errors?.[0] || `Job ${w.job} falhou sem indicar a etapa (veja o log)`) }
      }
    }
    if ([...wanted.values()].every(w => w.lastOk)) break
  }

  return {
    steps: Object.fromEntries(wanted),
    runs: runsInfo,
    running: running ? { number: running.run_number, url: running.html_url, startedAt: running.created_at } : null,
  }
}

export async function loadPublicacao(ghFetch = gh) {
  const { workflow_runs: runs = [] } = await ghFetch(
    `/repos/${REPO_DASH}/actions/workflows/${WORKFLOW_DASH}/runs?per_page=5`)
  const last = runs.find(r => r.status === 'completed')
  const lastOk = runs.find(r => r.conclusion === 'success')
  const fmt = r => r && { number: r.run_number, conclusion: r.conclusion, at: r.updated_at, url: r.html_url }
  return { last: fmt(last), lastOk: fmt(lastOk) }
}

// ── Supabase ────────────────────────────────────────────────────────────────
async function sbGet(object) {
  const res = await fetch(`${SB_URL}/storage/v1/object/dashboard/${object}`, {
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY },
  })
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Supabase ${object}: HTTP ${res.status}`)
  return res.json()
}

// Resumo de datas de um dataset. O status-*.json é gravado a cada publicação;
// enquanto não existir (antes da primeira publicação com esta versão), calcula
// a partir do arquivo de dados inteiro.
export async function loadDatasetDates(dataset) {
  const small = await sbGet(`status-${dataset}.json`)
  if (small?.lastDates) return small
  const full = await sbGet(`data-${dataset}.json`)
  if (!full?.data) return null
  const metaEntry = Object.values(full.meta || {})[0]
  return { dataset, publishedAt: metaEntry?.updated || null, lastDates: summarizeLastDates(full.data) }
}

// ── Montagem ────────────────────────────────────────────────────────────────
export async function buildStatus({ loadDates = loadDatasetDates, ghFetch = gh, now = new Date() } = {}) {
  const errors = []
  const [datesList, coleta, publicacao] = await Promise.all([
    Promise.all(DATASETS.map(ds => loadDates(ds).catch(e => { errors.push(e.message); return null }))),
    loadColeta(ghFetch).catch(e => { errors.push(e.message); return null }),
    loadPublicacao(ghFetch).catch(e => { errors.push(e.message); return null }),
  ])
  const dates = Object.fromEntries(DATASETS.map((ds, i) => [ds, datesList[i]]))

  const sources = {}
  for (const [id, s] of Object.entries(SOURCES)) {
    const ds = dates[s.data.dataset]
    const dataDate = sourceDataDate(s, ds?.lastDates)
    const base = { kind: s.kind, label: s.label, dataset: s.data.dataset, dataDate }

    if (s.kind === 'bloomberg') {
      sources[id] = { ...base, ...colorBloomberg(dataDate, s.lagDias || 0, now), lagDias: s.lagDias || 0 }
    } else if (s.kind === 'publicacao') {
      sources[id] = { ...base, publishedAt: ds?.publishedAt || null, ...colorPublicacao(ds?.publishedAt, now) }
    } else if (s.kind === 'manual') {
      sources[id] = { ...base, color: 'neutral' }
    } else if (s.kind === 'coleta') {
      if (!coleta) { sources[id] = { ...base, color: 'unknown', job: s.job, step: s.step }; continue }
      const own = coleta.steps[`${s.job}::${s.step}`]
      const cons = PLANILHAS[s.job]?.consolidador && coleta.steps[`${s.job}::${PLANILHAS[s.job].consolidador}`]
      const ownColor = colorColeta(own?.lastOk?.at, now)
      const consColor = cons ? colorColeta(cons.lastOk?.at, now) : null
      const color = worstColor([ownColor.color, consColor?.color])
      // Se a etapa está ok mas o consolidador da planilha não, o motivo é ele.
      const culpado = ownColor.color === color ? own : cons
      sources[id] = {
        ...base, color, job: s.job, step: s.step,
        lastOk: own?.lastOk || null,
        lastFail: color === 'green' ? null : (culpado?.lastFail || null),
        horasSemOk: ownColor.horasSemOk,
      }
    }
  }

  const overall = worstColor(Object.values(sources).map(s => s.color))
  const latestRun = coleta?.runs?.[0] || null

  return {
    generatedAt: now.toISOString(),
    expectedBloomberg: expectedBloombergDate(now),
    overall,
    sources,
    datasets: Object.fromEntries(DATASETS.map(ds => [ds, { label: DATASET_LABELS[ds], publishedAt: dates[ds]?.publishedAt || null }])),
    coleta: coleta && {
      running: coleta.running,
      latest: latestRun && {
        number: latestRun.number, conclusion: latestRun.conclusion, at: latestRun.createdAt, url: latestRun.url,
        jobs: Object.fromEntries(Object.entries(latestRun.jobs).map(([k, j]) => [k, { conclusion: j.conclusion, url: j.url, failedSteps: j.failedSteps, errors: j.errors }])),
      },
    },
    publicacao,
    errors,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }
  if (!SB_KEY) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE nao configurada.' })
    return
  }
  try {
    const body = await buildStatus()
    // Cache na CDN do Vercel: 5 min fresco + até 30 min servindo o anterior
    // enquanto recalcula. Segura a cota do GitHub mesmo com muita gente
    // abrindo o dashboard, e 5 min é bem menor que o ritmo dos dados.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
    res.status(200).json(body)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'Falha ao montar o status.' })
  }
}
