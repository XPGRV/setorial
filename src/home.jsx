import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Beef, Car, Factory, Landmark, Clock3, Search, ChevronRight, SlidersHorizontal, Sun, Moon } from 'lucide-react'

// ── Mesh reativo da topbar (canvas) ───────────────────────────────────────────
// Malha de pontos que reage ao cursor: fundo navy + accent, constelação e glow.
// Cores fixas de propósito (independentes do tema).
const hex2rgb = (h) => {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`

function TopbarMesh({ accent = '#2f8fc4', spacing = 12, intensity = 0.3, speed = 1, children }) {
  const canvasRef = React.useRef(null)
  const barRef = React.useRef(null)

  React.useEffect(() => {
    const cv = canvasRef.current
    const bar = barRef.current
    const ctx = cv.getContext('2d')

    const navy = [10, 21, 34]
    const acc = hex2rgb(accent)
    const hi = mix(acc, [232, 244, 255], 0.55)
    const dim = mix(navy, acc, 0.5)

    const g = { mx: -999, my: -999, tmx: -999, tmy: -999, pres: 0, tpres: 0,
                dots: [], cols: 0, rows: 0, w: 0, h: 0, sp: spacing }

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth, h = cv.clientHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.w = w; g.h = h
      const sp = g.sp
      const cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1
      const offx = (w - (cols - 1) * sp) / 2, offy = (h - (rows - 1) * sp) / 2
      g.cols = cols; g.rows = rows; g.dots = []
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          g.dots.push({ bx: offx + i * sp, by: offy + j * sp, x: 0, y: 0, act: 0 })
    }
    size()

    const ro = new ResizeObserver(size)
    ro.observe(cv)

    const move = (e) => {
      const r = bar.getBoundingClientRect()
      g.tmx = e.clientX - r.left; g.tmy = e.clientY - r.top; g.tpres = 1
    }
    const leave = () => { g.tpres = 0 }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerleave', leave)

    let raf, t = 0, prev = performance.now()
    const R = 150
    const k = intensity

    const frame = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now; t += dt * speed
      const { w, h } = g

      g.mx += (g.tmx - g.mx) * 0.16
      g.my += (g.tmy - g.my) * 0.16
      g.pres += (g.tpres - g.pres) * 0.08

      ctx.clearRect(0, 0, w, h)

      for (const d of g.dots) {
        const dx = d.bx - g.mx, dy = d.by - g.my, dist = Math.hypot(dx, dy)
        let act = g.pres * Math.max(0, 1 - dist / R); act = act * act
        const idle = 0.05 + 0.03 * Math.sin(d.bx * 0.045 + d.by * 0.03 + t * 1.4)
        d.act = Math.max(act, 0)
        const push = act * 14 * k
        const ux = dist > 0.001 ? dx / dist : 0, uy = dist > 0.001 ? dy / dist : 0
        d.x = d.bx + ux * push; d.y = d.by + uy * push
        const baseR = Math.max(0.5, g.sp / 26)
        const rad = baseR + act * (g.sp * 0.11)
        const col = mix(dim, hi, Math.min(1, act * 1.2))
        ctx.beginPath(); ctx.arc(d.x, d.y, rad, 0, 6.283)
        ctx.fillStyle = rgba(col, Math.min(1, idle + act * 0.9)); ctx.fill()
      }

      ctx.lineWidth = 1
      for (let j = 0; j < g.rows; j++)
        for (let i = 0; i < g.cols; i++) {
          const a = g.dots[j * g.cols + i]
          if (a.act < 0.12) continue
          const nb = []
          if (i + 1 < g.cols) nb.push(g.dots[j * g.cols + i + 1])
          if (j + 1 < g.rows) nb.push(g.dots[(j + 1) * g.cols + i])
          for (const b of nb) {
            const s = Math.min(a.act, b.act)
            if (s < 0.12) continue
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = rgba(hi, s * 0.55); ctx.stroke()
          }
        }

      if (g.pres > 0.02) {
        const gl = ctx.createRadialGradient(g.mx, g.my, 0, g.mx, g.my, R * 0.85)
        gl.addColorStop(0, rgba(hi, 0.16 * g.pres))
        gl.addColorStop(1, rgba(hi, 0))
        ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h)
      }

      ctx.fillStyle = rgba(hi, 0.5); ctx.fillRect(0, h - 1.5, w, 1.5)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerleave', leave)
    }
  }, [accent, spacing, intensity, speed])

  return (
    <header className="home-topbar" ref={barRef}>
      <canvas ref={canvasRef} className="home-topbar-canvas" />
      <span className="home-topbar-sheen" aria-hidden="true" />
      {children}
    </header>
  )
}

// ── Setores (esquerda) ────────────────────────────────────────────────────────
const SECTORS = [
  { label: 'Proteínas',       sub: 'Dados setoriais de preço e produção de Carne Bovina, Frango e Processados, no Brasil e EUA.', icon: Beef, route: '/proteinas', active: true },
  { label: 'Rental',          sub: 'Dados de locadoras, frotas, preços e mobilidade.', icon: Car },
  { label: 'Bens de Capital', sub: 'Acompanhamento setorial de empresas como: WEG, Marcopolo, Embraer, etc.', icon: Factory, route: '/capitalgoods', active: true },
]
const MACRO = [
  { label: 'Macro', sub: 'Estimativas da taxa de juros.', icon: Landmark, route: '/macro', active: true },
]

// ── Ticker (topo) ─────────────────────────────────────────────────────────────
// ── News Hunter (centro) — estático ───────────────────────────────────────────
const NEWS = [
  { src: 'XP',        time: '09:42', cat: 'Proteínas',   tone: 'alta',   title: 'Exportações de carne bovina sobem 8% em junho, puxadas pela China', summary: 'Volumes embarcados atingem recorde mensal; preço médio da tonelada avança com demanda asiática aquecida.' },
  { src: 'BLOOMBERG', time: '09:18', cat: 'Commodities', tone: 'alta',   title: 'Boi gordo renova máxima do ano com oferta restrita no Centro-Oeste', summary: 'Arroba negociada acima de R$ 258 em São Paulo; confinamentos seguram animais e pressionam a escala das plantas.' },
  { src: 'BCB',       time: '08:55', cat: 'Macro',       tone: 'neutro', title: 'Copom sinaliza manutenção da Selic e mercado revisa curva de juros', summary: 'Ata reforça cautela com inflação de serviços; DIs curtos operam praticamente estáveis após o comunicado.' },
  { src: 'REUTERS',   time: '08:30', cat: 'Proteínas',   tone: 'alta',   title: 'JBS anuncia expansão de capacidade em planta de frango nos EUA', summary: 'Investimento amplia processamento em 12% e mira exportação para o mercado asiático a partir de 2027.' },
  { src: 'BROADCAST', time: '08:12', cat: 'Macro',       tone: 'baixa',  title: 'Dólar recua para R$ 5,16 com fluxo estrangeiro positivo na B3', summary: 'Entrada líquida em renda variável e commodities firmes sustentam o real entre as moedas emergentes.' },
  { src: 'USDA',      time: '07:50', cat: 'Commodities', tone: 'baixa',  title: 'USDA reduz estimativa de abates e pressiona spreads de margem', summary: 'Relatório aponta rebanho americano em ciclo de baixa; margem dos frigoríficos segue negativa no acumulado.' },
  { src: 'VALOR',     time: '07:35', cat: 'Macro',       tone: 'neutro', title: 'Bancos ampliam provisões para o agro diante de clima adverso', summary: 'Carteira rural cresce, mas inadimplência preocupa; instituições reforçam colchão de perdas esperadas.' },
]

// ── Market Overview (direita) — estático ──────────────────────────────────────
const MARKET = {
  'Índices': [
    { name: 'IBOV',    sub: 'Pontos · B3',  val: '129.842', d: +0.72, spark: [4, 5, 4, 6, 7, 6, 8] },
    { name: 'S&P 500', sub: 'Pontos · CME', val: '5.431',   d: +0.31, spark: [5, 4, 6, 5, 7, 6, 7] },
    { name: 'DXY',     sub: 'Índice · ICE', val: '105,3',   d: +0.22, spark: [4, 5, 5, 6, 5, 6, 6] },
  ],
  'Commodities': [
    { name: 'Boi Gordo', sub: 'R$/@ · B3',       val: '258,30', d: +1.12, spark: [4, 5, 5, 6, 7, 7, 8] },
    { name: 'Bezerro',   sub: 'R$/cab · ESALQ',  val: '2.640',  d: +2.41, spark: [3, 4, 4, 5, 6, 7, 8] },
    { name: 'Milho',     sub: 'R$/sc · ESALQ',   val: '68,40',  d: -0.90, spark: [7, 6, 6, 5, 5, 4, 4] },
    { name: 'Soja',      sub: 'R$/sc · Paraná',  val: '132,10', d: +0.42, spark: [5, 5, 6, 5, 6, 6, 7] },
    { name: 'Frango',    sub: 'R$/kg · Atacado', val: '7,85',   d: -0.31, spark: [6, 6, 5, 5, 5, 4, 5] },
    { name: 'Brent',     sub: 'US$/BBL',         val: '84,20',  d: +0.84, spark: [4, 5, 4, 5, 6, 6, 7] },
  ],
  'Moedas': [
    { name: 'USD/BRL', sub: 'Spot', val: '5,16', d: -0.45, spark: [7, 6, 6, 5, 5, 5, 4] },
    { name: 'EUR/BRL', sub: 'Spot', val: '5,58', d: -0.30, spark: [6, 6, 5, 6, 5, 5, 5] },
    { name: 'CNY/BRL', sub: 'Spot', val: '0,71', d: +0.10, spark: [5, 5, 5, 6, 5, 6, 6] },
  ],
}
const MARKET_TABS = ['Índices', 'Commodities', 'Moedas']

const fmtDelta = d => `${d >= 0 ? '+' : ''}${d.toFixed(2).replace('.', ',')}%`

function Sparkline({ points, up }) {
  const w = 64, h = 26, pad = 2
  const max = Math.max(...points), min = Math.min(...points), span = max - min || 1
  const step = (w - pad * 2) / (points.length - 1)
  const d = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${(pad + i * step).toFixed(1)},${(pad + (h - pad * 2) * (1 - (p - min) / span)).toFixed(1)}`).join(' ')
  return (
    <svg className="home-sparkline" width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function SectionTitle({ title, right }) {
  return (
    <div className="home-section-title">
      <div className="home-section-heading"><span className="home-dot" />{title}</div>
      {right}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode] = React.useState(() => document.documentElement.dataset.mode === 'light' ? 'light' : 'dark')
  const [query, setQuery] = React.useState('')
  const [marketTab, setMarketTab] = React.useState('Commodities')

  const go = s => { if (s.active && s.route) navigate(s.route) }
  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    document.documentElement.dataset.mode = next
    try { localStorage.setItem('rx-color-mode', next) } catch {}
  }

  const filteredNews = NEWS.filter(item => {
    const hay = `${item.title} ${item.summary} ${item.src} ${item.cat}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })

  const renderSector = s => (
    <button
      key={s.label}
      className={`home-sector-item${s.active ? ' is-available' : ' is-soon'}`}
      onClick={() => go(s)}
      aria-disabled={!s.active}
    >
      <span className="home-sector-icon"><s.icon size={18} /></span>
      <span className="home-sector-copy"><strong>{s.label}</strong></span>
      {s.active ? <ChevronRight size={15} /> : <span className="home-soon">Em breve</span>}
      <span className="home-sector-tooltip" role="tooltip">
        <strong>{s.label}</strong>
        <span>{s.sub}</span>
      </span>
    </button>
  )

  return (
    <div className="home-page">
      <TopbarMesh>
        <div className="home-brand">
          <div className="home-brand-logo"><img src="/xp-asset-logo.svg" alt="XP Asset Management" /></div>
        </div>
        <button className="topbar-mode-btn" onClick={toggleMode}
          title={mode === 'dark' ? 'Tema: Escuro · clique p/ Claro' : 'Tema: Claro · clique p/ Escuro'}
          aria-label="Alternar tema claro/escuro">
          {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </TopbarMesh>

      <main className="home-workspace">
        {/* Esquerda — Setores */}
        <aside className="home-column home-sectors">
          <SectionTitle title="Setores" right={<span className="home-count">{SECTORS.length}</span>} />
          <div className="home-sector-list">{SECTORS.map(renderSector)}</div>
          <SectionTitle title="Macro" right={<span className="home-count">{MACRO.length}</span>} />
          <div className="home-sector-list">{MACRO.map(renderSector)}</div>
        </aside>

        {/* Centro — News Hunter */}
        <section className="home-column home-news">
          <SectionTitle title="News Hunter" right={<span className="home-live"><i />AO VIVO</span>} />
          <div className="home-news-tools">
            <label className="home-news-search">
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar tema ou empresa" />
            </label>
            <button className="home-news-filter-btn" type="button"><SlidersHorizontal size={14} />Filtros</button>
          </div>
          <div className="home-news-feed">
            {filteredNews.length ? filteredNews.map((item, i) => {
              return (
                <article className={`home-news-item${i === 0 ? ' is-lead' : ''}`} key={item.title}>
                  <div className="home-news-meta">
                    <span className="home-news-source">{item.src}</span>
                    <span><Clock3 size={11} />{item.time}</span>
                    <span>· {item.cat}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                </article>
              )
            }) : (
              <div className="home-news-empty">Nenhuma notícia encontrada.</div>
            )}
          </div>
        </section>

        {/* Direita — Market Overview */}
        <aside className="home-column home-market">
          <SectionTitle title="Market Overview" right={<span className="home-clock">15:42</span>} />
          <div className="home-market-periods">
            {MARKET_TABS.map(t => (
              <button key={t} className={marketTab === t ? 'is-on' : ''} onClick={() => setMarketTab(t)}>{t}</button>
            ))}
          </div>
          <div className="home-market-list">
            {MARKET[marketTab].map(row => {
              const up = row.d >= 0
              return (
                <div className="home-market-row" key={row.name}>
                  <div className="home-market-main"><strong>{row.name}</strong><span>{row.sub}</span></div>
                  <Sparkline points={row.spark} up={up} />
                  <div className="home-market-quote">
                    <strong>{row.val}</strong>
                    <span className={up ? 'is-up' : 'is-down'}>{up ? '▲' : '▼'} {fmtDelta(row.d)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </main>
    </div>
  )
}
