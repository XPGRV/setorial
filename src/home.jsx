import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Beef, Car, Factory, Landmark,
  LayoutGrid, Layers, Newspaper, TrendingUp,
  Sun, Moon, Clock3, Search, ChevronRight,
} from 'lucide-react'

// ── Setores (esquerda) ────────────────────────────────────────────────────────
const SECTORS = [
  { label: 'Proteínas',       sub: 'Beef US · Beef BR · Poultry', icon: Beef,    tint: 'is-red',  route: '/proteinas', active: true },
  { label: 'Rental',          sub: 'Locadoras & mobilidade',      icon: Car,     tint: 'is-cyan' },
  { label: 'Bens de Capital', sub: 'Máquinas & equipamentos',     icon: Factory, tint: 'is-amber' },
]
const OUTROS = [
  { label: 'Macro', sub: 'Juros, câmbio & atividade', icon: Landmark, tint: 'is-blue', route: '/proteinas?dataset=macro', active: true },
]

// ── Ticker (topo) ─────────────────────────────────────────────────────────────
const TICKER = [
  { k: 'BOI',     v: '259,32',  u: '¢/lb',  d: +10.66 },
  { k: 'USD/BRL', v: '5,16',    u: 'R$',    d: -0.45 },
  { k: 'IBOV',    v: '129.842', u: '',      d: +0.72 },
  { k: 'MILHO',   v: '68,40',   u: 'R$/sc', d: -0.90 },
  { k: 'BRENT',   v: '84,20',   u: 'US$',   d: +0.84 },
  { k: 'SOJA',    v: '132,10',  u: 'R$/sc', d: +0.42 },
  { k: 'S&P 500', v: '5.431',   u: '',      d: +0.31 },
  { k: 'DXY',     v: '105,3',   u: '',      d: +0.22 },
]

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
const NEWS_FILTERS = ['Tudo', 'Proteínas', 'Macro', 'Commodities']
const TONE_LABEL = { alta: 'Alta', baixa: 'Baixa', neutro: 'Neutro' }

// ── Market Overview (direita) — estático ──────────────────────────────────────
const MARKET = {
  'Índices': [
    { name: 'IBOV',    sub: 'Pontos · B3',    val: '129.842', d: +0.72, spark: [4, 5, 4, 6, 7, 6, 8] },
    { name: 'S&P 500', sub: 'Pontos · CME',   val: '5.431',   d: +0.31, spark: [5, 4, 6, 5, 7, 6, 7] },
    { name: 'DXY',     sub: 'Índice · ICE',   val: '105,3',   d: +0.22, spark: [4, 5, 5, 6, 5, 6, 6] },
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

function Sparkbars({ up }) {
  const bars = up ? [3, 4, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 4, 3]
  return (
    <div className={`home-sparkbars ${up ? 'is-up' : 'is-down'}`}>
      {bars.map((h, i) => <i key={i} style={{ height: `${h * 12}%` }} />)}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, right }) {
  return (
    <div className="home-section-title">
      <div className="home-section-heading"><Icon size={14} />{title}</div>
      {right}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode] = React.useState(() => document.documentElement.dataset.mode === 'light' ? 'light' : 'dark')
  const [newsFilter, setNewsFilter] = React.useState('Tudo')
  const [query, setQuery] = React.useState('')
  const [marketTab, setMarketTab] = React.useState('Commodities')

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    document.documentElement.dataset.mode = next
    try { localStorage.setItem('rx-color-mode', next) } catch {}
  }

  const go = s => { if (s.active && s.route) navigate(s.route) }

  const filteredNews = NEWS.filter(item => {
    const matchesCat = newsFilter === 'Tudo' || item.cat === newsFilter
    const hay = `${item.title} ${item.summary} ${item.src} ${item.cat}`.toLowerCase()
    return matchesCat && hay.includes(query.trim().toLowerCase())
  })

  const renderSector = s => (
    <button
      key={s.label}
      className={`home-sector-item${s.active ? ' is-active' : ' is-soon'}`}
      onClick={() => go(s)}
      aria-disabled={!s.active}
    >
      <span className={`home-sector-icon ${s.tint}`}><s.icon size={18} /></span>
      <span className="home-sector-copy"><strong>{s.label}</strong><small>{s.sub}</small></span>
      {s.active ? <span className="home-abrir">Abrir</span> : <ChevronRight size={15} />}
    </button>
  )

  return (
    <div className="home-page">
      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-logo"><img src="/xp-asset-logo.svg" alt="XP Asset Management" /></div>
        </div>
        <button className="home-mode-btn" onClick={toggleMode}
          title={mode === 'dark' ? 'Tema: Escuro · clique p/ Claro' : 'Tema: Claro · clique p/ Escuro'}
          aria-label="Alternar tema claro/escuro">
          {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <div className="home-ticker">
        {TICKER.map(t => (
          <div className="home-ticker-item" key={t.k}>
            <span className="home-ticker-k">{t.k}</span>
            <span className="home-ticker-v">{t.v}</span>
            {t.u && <span className="home-ticker-u">{t.u}</span>}
            <span className={t.d >= 0 ? 'is-up' : 'is-down'}>{t.d >= 0 ? '▲' : '▼'} {fmtDelta(t.d)}</span>
          </div>
        ))}
      </div>

      <main className="home-workspace">
        {/* Esquerda — Setores */}
        <aside className="home-column home-sectors">
          <SectionTitle icon={LayoutGrid} title="Setores" right={<span>{SECTORS.length} áreas</span>} />
          <div className="home-sector-list">{SECTORS.map(renderSector)}</div>
          <SectionTitle icon={Layers} title="Outros" />
          <div className="home-sector-list">{OUTROS.map(renderSector)}</div>
        </aside>

        {/* Centro — News Hunter */}
        <section className="home-column home-news">
          <SectionTitle icon={Newspaper} title="News Hunter"
            right={<span className="home-live"><i />AO VIVO</span>} />
          <div className="home-news-tools">
            <label className="home-news-search">
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar tema ou empresa" />
            </label>
            <div className="home-news-tabs" aria-label="Filtrar notícias">
              {NEWS_FILTERS.map(f => (
                <button key={f} className={newsFilter === f ? 'is-on' : ''} onClick={() => setNewsFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="home-news-feed">
            {filteredNews.length ? filteredNews.map((item, i) => (
              <article className={`home-news-item${i === 0 ? ' is-lead' : ''}`} key={item.title}>
                <div className="home-news-meta">
                  <span className="home-news-source">{item.src}</span>
                  <span><Clock3 size={11} />{item.time}</span>
                  <span>· {item.cat}</span>
                  <span className={`home-news-tone is-${item.tone}`}>{TONE_LABEL[item.tone]}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
              </article>
            )) : (
              <div className="home-news-empty">Nenhuma notícia encontrada.</div>
            )}
          </div>
        </section>

        {/* Direita — Market Overview */}
        <aside className="home-column home-market">
          <SectionTitle icon={TrendingUp} title="Market Overview"
            right={<span className="home-clock">15:42</span>} />
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
                  <Sparkbars up={up} />
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
