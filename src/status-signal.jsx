// Sinal de status dos dados no front:
//   <DataStatusBadge/>  semáforo no cabeçalho + painel com o detalhe
//   bolinha por card    injetada em todo <section data-card-id> mapeado em
//                       CARD_SOURCES (src/data-status.js), com o detalhe no hover
//
// Os dados vêm de GET /api/status, buscado ao abrir e a cada 5 minutos.
import React from 'react'
import { createPortal } from 'react-dom'
import {
  CARD_SOURCES, SOURCES, DATASET_LABELS, DATASET_FILES, DATASET_JOB, STATUS_ORDER,
  cardColor, worstColor,
} from './data-status.js'
import './status-signal.css'

const POLL_MS = 5 * 60 * 1000

// ── Store (um fetch para a página toda) ─────────────────────────────────────
let state = { status: null, error: null, loading: true }
const listeners = new Set()
let timer = null

function setState(next) {
  state = { ...state, ...next }
  listeners.forEach(fn => fn(state))
}

async function refresh() {
  try {
    const res = await fetch(`/api/status?t=${Math.floor(Date.now() / 60000)}`)
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
    setState({ status: body, error: null, loading: false })
  } catch (e) {
    setState({ error: e.message || 'Falha ao consultar o status', loading: false })
  }
}

function useDataStatus() {
  const [s, setS] = React.useState(state)
  React.useEffect(() => {
    listeners.add(setS)
    if (!timer) {
      refresh()
      timer = setInterval(refresh, POLL_MS)
    }
    return () => {
      listeners.delete(setS)
      if (!listeners.size) { clearInterval(timer); timer = null }
    }
  }, [])
  return s
}

// ── Formatação ──────────────────────────────────────────────────────────────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtDataDate(d) {
  if (!d) return '—'
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  m = /^(\d{4})-(\d{2})$/.exec(d)
  if (m) return `${MESES[Number(m[2]) - 1]}/${m[1].slice(2)}`
  m = /^(\d{4})-Q(\d)$/.exec(d)
  if (m) return `${m[2]}T${m[1].slice(2)}`
  return d // snapshot ("out-26")
}

function fmtWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function fmtAgo(iso) {
  if (!iso) return 'nunca nas últimas execuções'
  const h = (Date.now() - new Date(iso)) / 3600000
  if (h < 1) return 'há menos de 1h'
  if (h < 36) return `há ${Math.round(h)}h`
  return `há ${Math.round(h / 24)} dias`
}

const COLOR_LABEL = { green: 'Em dia', yellow: 'Atenção', red: 'Problema', neutral: 'Manual', unknown: 'Sem informação' }
const OVERALL_LABEL = { green: 'Dados em dia', yellow: 'Dados com atenção', red: 'Dados com problema', unknown: 'Status indisponível' }
const CARD_LABEL = { green: 'Atualizado', yellow: 'Atenção', red: 'Desatualizado', neutral: 'Manual', unknown: 'Sem status' }
const KIND_LABEL ={ bloomberg: 'Bloomberg', coleta: 'Coleta', publicacao: 'Publicação', manual: 'Manual' }

function sourceLine(s) {
  if (!s) return 'Sem informação'
  if (s.kind === 'bloomberg') {
    if (s.color === 'green') return `Dado de ${fmtDataDate(s.dataDate)}`
    if (s.color === 'unknown') return 'Data do dado não encontrada'
    return `Dado de ${fmtDataDate(s.dataDate)} · esperado ${fmtDataDate(s.esperado)} (${s.atraso} dia${s.atraso > 1 ? 's' : ''} de atraso)`
  }
  if (s.kind === 'publicacao') {
    return s.color === 'green' ? `Publicado ${fmtWhen(s.publishedAt)}` : `Última publicação ${fmtWhen(s.publishedAt)}`
  }
  if (s.kind === 'manual') return `Preenchido à mão · último dado ${fmtDataDate(s.dataDate)}`
  if (s.kind === 'coleta') {
    const ok = s.lastOk ? `Rodou OK ${fmtAgo(s.lastOk.at)}` : 'Sem execução OK nas últimas rodadas'
    return `${ok} · último dado ${fmtDataDate(s.dataDate)}`
  }
  return ''
}

// ── Peças visuais ───────────────────────────────────────────────────────────
function Dot({ color, size = 8, pulse = false }) {
  return <span className={`ds-dot ds-${color || 'unknown'}${pulse ? ' ds-pulse' : ''}`} style={{ width: size, height: size }} aria-hidden="true"/>
}

function SourceRow({ id, s }) {
  const meta = SOURCES[id]
  const name = s?.label || meta?.label || id
  return (
    <div className="ds-row">
      <Dot color={s?.color}/>
      <div className="ds-row-main">
        <div className="ds-row-title">
          {name}
          {s?.kind === 'coleta' && <span className="ds-tag">{s.job}</span>}
        </div>
        <div className="ds-row-sub">{sourceLine(s)}</div>
        {s?.lastFail && s.color !== 'green' && (
          <div className="ds-row-err">
            {s.lastFail.motivo}
            {s.lastFail.url && <> · <a href={s.lastFail.url} target="_blank" rel="noreferrer">ver run #{s.lastFail.run}</a></>}
          </div>
        )}
      </div>
    </div>
  )
}

// Mantém o elemento montado durante a animação de saída: open=false troca a
// classe para "is-out" e só desmonta depois de `ms`. Reabrir no meio da saída
// cancela a desmontagem e volta para "is-in".
function usePresence(open, ms = 140) {
  const [mounted, setMounted] = React.useState(open)
  React.useEffect(() => {
    if (open) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])
  return { mounted: open || mounted, phase: open ? 'is-in' : 'is-out' }
}

// ── Bolinha por card ────────────────────────────────────────────────────────
function CardDot({ cardId, host, status }) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState(null)
  const ref = React.useRef(null)
  const ids = CARD_SOURCES[cardId] || []
  const color = cardColor(cardId, status.sources)
  const { mounted, phase } = usePresence(open)

  const show = () => {
    // A bolinha fica no canto inferior direito do card: o detalhe abre acima
    // dela, alinhado pela direita.
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ bottom: window.innerHeight - r.top + 8, left: Math.max(8, Math.min(r.right - 340, window.innerWidth - 348)) })
    setOpen(true)
  }

  return createPortal(
    <>
      <button ref={ref} type="button" className="ds-card-dot" aria-label={`Status dos dados: ${COLOR_LABEL[color]}`}
        onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)}
        onClick={e => { e.stopPropagation(); open ? setOpen(false) : show() }}>
        <span className="ds-card-label">{CARD_LABEL[color] || CARD_LABEL.unknown}</span>
        <Dot color={color} size={9}/>
      </button>
      {mounted && pos && createPortal(
        <div className={`ds-pop ${phase}`} style={{ bottom: pos.bottom, left: pos.left }} role="tooltip">
          <div className="ds-pop-head">
            <Dot color={color}/> <strong>{COLOR_LABEL[color]}</strong>
            <span className="ds-pop-kind">{[...new Set(ids.map(id => KIND_LABEL[SOURCES[id]?.kind]))].join(' + ')}</span>
          </div>
          {ids.map(id => <SourceRow key={id} id={id} s={status.sources[id]}/>)}
        </div>,
        document.body
      )}
    </>,
    host
  )
}

// Procura os cards na página (as abas montam e desmontam o tempo todo) e cria,
// dentro de cada <section data-card-id> mapeado, um nó onde a bolinha é
// renderizada. O nó fica no canto do card (posição absoluta, no padding), sem
// mexer no layout nem nos componentes de gráfico.
let hostSeq = 0

function useCardHosts() {
  const [hosts, setHosts] = React.useState([])
  React.useEffect(() => {
    let raf = 0
    const scan = () => {
      raf = 0
      const found = []
      document.querySelectorAll('section.card[data-card-id]').forEach(sec => {
        const id = sec.getAttribute('data-card-id')
        if (!CARD_SOURCES[id]) return
        // Um card pode reservar um lugar para o status dentro do próprio
        // layout (ex.: na linha de legenda) com um elemento [data-ds-slot].
        // Sem isso, o status fica no canto inferior direito do card.
        const slot = sec.querySelector('[data-ds-slot]')
        const container = slot || sec
        let host = sec.querySelector('.ds-card-host')
        if (!host) {
          host = document.createElement('span')
          host.className = 'ds-card-host'
          host.dataset.dsKey = String(++hostSeq)
        }
        if (host.parentElement !== container) container.appendChild(host)
        host.classList.toggle('is-inline', !!slot)
        found.push({ id, host })
      })
      setHosts(prev => (prev.length === found.length && prev.every((h, i) => h.host === found[i].host && h.id === found[i].id)) ? prev : found)
    }
    const obs = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan) })
    obs.observe(document.body, { childList: true, subtree: true })
    scan()
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return hosts
}

function CardDots({ status }) {
  const hosts = useCardHosts()
  if (!status?.sources) return null
  return hosts.map(({ id, host }) => <CardDot key={host.dataset.dsKey} cardId={id} host={host} status={status}/>)
}

// ── Painel ──────────────────────────────────────────────────────────────────
function groupBy(arr, fn) {
  const m = new Map()
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x) }
  return m
}

function Panel({ open, ...props }) {
  const { mounted, phase } = usePresence(open, 160)
  return mounted ? <PanelLayer {...props} phase={phase}/> : null
}

function PanelLayer({ phase, ...props }) {
  // Vai direto no <body>: o cabeçalho cria contextos de empilhamento que
  // deixariam o painel atrás dos cards.
  const [pos, setPos] = React.useState(null)
  React.useLayoutEffect(() => {
    const place = () => {
      const r = props.anchor.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 8, right: Math.max(16, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [props.anchor])
  if (!pos) return null
  return createPortal(<div className={`ds-panel-layer ${phase}`} style={pos}><PanelBody {...props}/></div>, document.body)
}

function PanelBody({ status, error, onClose }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('.ds-badge')) onClose() }
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  if (!status) {
    return <div className="ds-panel" ref={ref}><div className="ds-panel-empty">{error ? `Não foi possível consultar o status: ${error}` : 'Consultando...'}</div></div>
  }

  const entries = Object.entries(status.sources)
  const problems = entries.filter(([, s]) => s.color === 'red' || s.color === 'yellow')
    .sort((a, b) => (b[1].color === 'red') - (a[1].color === 'red'))
  const bbg = entries.filter(([, s]) => s.kind === 'bloomberg' || s.kind === 'publicacao')
  const col = entries.filter(([, s]) => s.kind === 'coleta')
  const man = entries.filter(([, s]) => s.kind === 'manual')
  const latest = status.coleta?.latest
  const running = status.coleta?.running
  const pub = status.publicacao?.last

  const byDataset = groupBy(bbg, ([, s]) => s.dataset)
  const byJob = groupBy(col, ([, s]) => s.job)

  return (
    <div className="ds-panel" ref={ref} role="dialog" aria-label="Status dos dados">
      <div className="ds-panel-head">
        <Dot color={status.overall} size={10}/>
        <strong>{OVERALL_LABEL[status.overall]}</strong>
        <button className="ds-close" onClick={onClose} aria-label="Fechar">×</button>
      </div>

      <div className="ds-summary">
        <div>
          <span className="ds-k">Coleta</span>
          {running
            ? <a href={running.url} target="_blank" rel="noreferrer">rodando agora (#{running.number})</a>
            : latest
              ? <a href={latest.url} target="_blank" rel="noreferrer">#{latest.number} · {fmtWhen(latest.at)} · {latest.conclusion === 'success' ? 'OK' : 'com falhas'}</a>
              : '—'}
        </div>
        <div>
          <span className="ds-k">Publicação</span>
          {pub ? <a href={pub.url} target="_blank" rel="noreferrer">{fmtWhen(pub.at)} · {pub.conclusion === 'success' ? 'OK' : pub.conclusion}</a> : '—'}
        </div>
        <div><span className="ds-k">Bloomberg esperado</span>{fmtDataDate(status.expectedBloomberg)}</div>
      </div>

      {status.errors?.length > 0 && (
        <div className="ds-warn">Informação parcial: {status.errors.join(' · ')}</div>
      )}

      {problems.length > 0 && (
        <section className="ds-sec">
          <h4>Precisa de atenção ({problems.length})</h4>
          {problems.map(([id, s]) => <SourceRow key={id} id={id} s={s}/>)}
        </section>
      )}

      <details className="ds-sec">
        <summary>
          <Dot color={worstColor(col.map(([, s]) => s.color))}/> Coletas de API ({col.length})
        </summary>
        {[...byJob.entries()].map(([job, rows]) => {
          const j = latest?.jobs?.[job]
          return (
            <div key={job} className="ds-group">
              <div className="ds-group-title">
                {job}
                {j && <a href={j.url} target="_blank" rel="noreferrer" className={`ds-job ds-job-${j.conclusion}`}>{j.conclusion === 'success' ? 'último run OK' : `último run: ${j.conclusion}`}</a>}
              </div>
              {rows.map(([id, s]) => <SourceRow key={id} id={id} s={s}/>)}
            </div>
          )
        })}
      </details>

      <details className="ds-sec">
        <summary>
          <Dot color={worstColor(bbg.map(([, s]) => s.color))}/> Bloomberg e publicação ({bbg.length})
        </summary>
        {[...byDataset.entries()].map(([ds, rows]) => (
          <div key={ds} className="ds-group">
            <div className="ds-group-title">{status.datasets?.[ds]?.label || ds}
              <span className="ds-muted">publicado {fmtWhen(status.datasets?.[ds]?.publishedAt)}</span>
            </div>
            {rows.map(([id, s]) => <SourceRow key={id} id={id} s={s}/>)}
          </div>
        ))}
      </details>

      {man.length > 0 && (
        <details className="ds-sec">
          <summary><Dot color="neutral"/> Preenchidos à mão ({man.length})</summary>
          {man.map(([id, s]) => <SourceRow key={id} id={id} s={s}/>)}
        </details>
      )}

      <div className="ds-foot">Atualizado {fmtWhen(status.generatedAt)} · consulta a cada 5 min</div>
    </div>
  )
}

export function DataStatusBadge() {
  const { status, error, loading } = useDataStatus()
  const [open, setOpen] = React.useState(false)
  const color = status?.overall || (error ? 'unknown' : null)
  const label = loading && !status ? 'Status...' : OVERALL_LABEL[color || 'unknown']
  const close = React.useCallback(() => setOpen(false), [])
  const anchor = React.useRef(null)

  return (
    <div className="ds-wrap">
      <button ref={anchor} type="button" className={`ds-badge ds-badge-${color || 'loading'}`} onClick={() => setOpen(o => !o)}
        aria-expanded={open} title="Status das coletas e do Bloomberg">
        <Dot color={color} size={9} pulse={color === 'red'}/>
        <span className="ds-badge-label">{label}</span>
      </button>
      <Panel open={open} status={status} error={error} onClose={close} anchor={anchor}/>
    </div>
  )
}

// ── Quadro por planilha (Home) ──────────────────────────────────────────────
function datasetSummary(ds, status) {
  const rows = Object.entries(status.sources).filter(([, s]) => s.dataset === ds)
  const bbg = rows.filter(([, s]) => s.kind === 'bloomberg' || s.kind === 'publicacao')
  const col = rows.filter(([, s]) => s.kind === 'coleta')
  const man = rows.filter(([, s]) => s.kind === 'manual')
  const bbgDates = bbg.map(([, s]) => s.dataDate).filter(d => d && d.length === 10).sort()
  const colBad = col.filter(([, s]) => s.color !== 'green')
  const job = DATASET_JOB[ds]
  return {
    rows, bbg, col, man, job,
    color: worstColor(rows.map(([, s]) => s.color)),
    bbgColor: bbg.length ? worstColor(bbg.map(([, s]) => s.color)) : null,
    colColor: col.length ? worstColor(col.map(([, s]) => s.color)) : null,
    bbgDate: bbgDates[bbgDates.length - 1] || null,
    colBad,
    jobRun: job ? status.coleta?.latest?.jobs?.[job] : null,
    publishedAt: status.datasets?.[ds]?.publishedAt,
  }
}

function Chip({ color, children, title }) {
  return <span className="ds-chip" title={title}><Dot color={color} size={6}/>{children}</span>
}

function DatasetRow({ ds, status, onOpenDashboard }) {
  const [open, setOpen] = React.useState(false)
  const s = datasetSummary(ds, status)
  const label = DATASET_LABELS[ds] || ds
  const problems = s.rows.filter(([, x]) => x.color === 'red' || x.color === 'yellow')
  const shown = open ? (problems.length ? problems : s.rows) : []

  return (
    <div className={`ds-board-row${open ? ' is-open' : ''}`}>
      <button type="button" className="ds-board-main" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Dot color={s.color} size={8}/>
        <span className="ds-board-name">
          <strong>{label}</strong>
          <small>{DATASET_FILES[ds]}</small>
        </span>
        <span className="ds-board-chips">
          {s.bbgColor && (
            <Chip color={s.bbgColor} title="Data do último ponto das séries do Bloomberg">
              Bloomberg {s.bbgDate ? fmtDataDate(s.bbgDate).slice(0, 5) : (s.bbg.some(([, x]) => x.kind === 'publicacao') ? fmtWhen(s.publishedAt).split(',')[0] : '—')}
            </Chip>
          )}
          {s.colColor
            ? <Chip color={s.colColor} title="Coletas de API (pythonsetorial)">
                {s.colBad.length ? `Coleta: ${s.colBad.length} de ${s.col.length} com falha` : 'Coleta OK'}
              </Chip>
            : s.jobRun
              // Tem job na coleta, mas nenhuma fonte de API mapeada (ex.: Agro, que
              // só arrasta fórmulas): mostra o resultado do job.
              ? <Chip color={s.jobRun.conclusion === 'success' ? 'green' : 'yellow'} title={`Job ${s.job} no último run da coleta`}>
                  {s.jobRun.conclusion === 'success' ? 'Coleta OK' : `Coleta: ${s.jobRun.conclusion}`}
                </Chip>
              : <Chip color="neutral" title="Esta planilha não tem coleta de API">Sem coleta</Chip>}
          {s.man.length > 0 && <Chip color="neutral" title="Séries preenchidas à mão">{s.man.length} manual</Chip>}
        </span>
        <span className={`ds-board-state ds-text-${s.color}`}>{CARD_LABEL[s.color] || CARD_LABEL.unknown}</span>
        <span className="ds-board-caret" aria-hidden="true">▸</span>
      </button>
      {open && (
        <div className="ds-board-detail">
          {problems.length > 0 && problems.length < s.rows.length && (
            <div className="ds-board-note">{problems.length} fonte{problems.length > 1 ? 's' : ''} com atenção · {s.rows.length - problems.length} em dia</div>
          )}
          {shown.map(([id, x]) => <SourceRow key={id} id={id} s={x}/>)}
          <div className="ds-board-foot">
            <span>Publicado {fmtWhen(s.publishedAt)}</span>
            {s.jobRun && <a href={s.jobRun.url} target="_blank" rel="noreferrer">último run de {s.job}: {s.jobRun.conclusion === 'success' ? 'OK' : s.jobRun.conclusion}</a>}
            {onOpenDashboard && <button type="button" className="ds-board-link" onClick={() => onOpenDashboard(ds)}>Abrir dashboard →</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// Resumo para o título da seção: "2 com problema · 1 atenção" ou "tudo em dia".
export function DataStatusSummary() {
  const { status } = useDataStatus()
  if (!status) return null
  const cols = Object.keys(DATASET_LABELS).map(ds => datasetSummary(ds, status).color)
  const red = cols.filter(c => c === 'red').length
  const yellow = cols.filter(c => c === 'yellow').length
  const parts = []
  if (red) parts.push(`${red} desatualizada${red > 1 ? 's' : ''}`)
  if (yellow) parts.push(`${yellow} atenção`)
  return <span>{parts.length ? parts.join(' · ') : 'tudo em dia'}</span>
}

export function DataStatusBoard({ onOpenDashboard }) {
  const { status, error, loading } = useDataStatus()
  if (!status) {
    return <div className="ds-board-empty">{loading ? 'Consultando status…' : `Status indisponível${error ? `: ${error}` : ''}`}</div>
  }
  // Problemas primeiro; dentro do mesmo nível, a ordem do catálogo.
  const order = Object.keys(DATASET_LABELS)
  const sorted = [...order].sort((a, b) =>
    (STATUS_ORDER[datasetSummary(b, status).color] - STATUS_ORDER[datasetSummary(a, status).color]) || (order.indexOf(a) - order.indexOf(b)))
  const latest = status.coleta?.latest
  return (
    <div className="ds-board">
      {sorted.map(ds => <DatasetRow key={ds} ds={ds} status={status} onOpenDashboard={onOpenDashboard}/>)}
      <div className="ds-board-meta">
        {latest && <a href={latest.url} target="_blank" rel="noreferrer">Coleta #{latest.number} · {fmtWhen(latest.at)}</a>}
        {status.publicacao?.last && <a href={status.publicacao.last.url} target="_blank" rel="noreferrer">Publicação {fmtWhen(status.publicacao.last.at)}</a>}
        <span>Consultado {fmtWhen(status.generatedAt)}</span>
      </div>
    </div>
  )
}

// Só as bolinhas dos cards (páginas de dashboard). O semáforo geral fica na
// Home; os dois compartilham o mesmo fetch de /api/status.
export function DataStatusCards() {
  const { status } = useDataStatus()
  return <CardDots status={status}/>
}

export default DataStatusBadge
