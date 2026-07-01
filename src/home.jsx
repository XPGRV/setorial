import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Beef,
  Building2,
  Car,
  ChevronRight,
  Clock3,
  Factory,
  Globe2,
  Landmark,
  Newspaper,
  Search,
  TrendingDown,
  TrendingUp,
  Wheat,
} from 'lucide-react'

const SECTORS = [
  { route: '/proteinas', label: 'Proteínas', detail: 'Beef e Poultry', icon: Beef, active: true, color: 'green' },
  { label: 'Bens de Capital', detail: 'Indústria e equipamentos', icon: Factory, color: 'blue' },
  { label: 'Locação', detail: 'Veículos e mobilidade', icon: Car, color: 'amber' },
  { label: 'Financeiro', detail: 'Bancos e serviços', icon: Landmark, color: 'cyan' },
  { label: 'Real Estate', detail: 'Shoppings e propriedades', icon: Building2, color: 'red' },
]

const NEWS = [
  {
    category: 'Proteínas',
    time: '08:42',
    source: 'Agência internacional',
    title: 'Exportações e oferta global permanecem no radar do setor de proteínas',
    summary: 'Fluxos comerciais e custos de alimentação seguem como os principais vetores acompanhados pelo mercado.',
    tone: 'green',
  },
  {
    category: 'Macro',
    time: '08:18',
    source: 'Relatório de mercado',
    title: 'Curva de juros e câmbio concentram a atenção na abertura',
    summary: 'Investidores avaliam o cenário externo e as próximas divulgações da agenda econômica.',
    tone: 'blue',
  },
  {
    category: 'Bens de Capital',
    time: '07:55',
    source: 'Imprensa financeira',
    title: 'Atividade industrial ganha espaço entre os temas corporativos do dia',
    summary: 'Indicadores antecedentes ajudam a calibrar expectativas para demanda e margens.',
    tone: 'amber',
  },
  {
    category: 'Proteínas',
    time: '07:31',
    source: 'Monitor setorial',
    title: 'Preços de grãos voltam ao foco nas cadeias de bovinos e aves',
    summary: 'Movimentos em milho e soja são acompanhados por seus efeitos sobre custos e spreads.',
    tone: 'green',
  },
]

const MARKETS = [
  { symbol: 'IBOV', name: 'Ibovespa', value: '128.420', changes: { '1D': 0.62, '5D': 1.18, '1M': -0.44 }, bars: [34, 48, 42, 56, 51, 68, 72, 64, 79, 84] },
  { symbol: 'USD/BRL', name: 'Dólar', value: '5,438', changes: { '1D': -0.31, '5D': 0.74, '1M': 1.92 }, bars: [68, 64, 72, 61, 58, 54, 59, 48, 44, 39] },
  { symbol: 'BEEF3', name: 'Minerva', value: '5,92', changes: { '1D': 1.54, '5D': 2.11, '1M': -3.28 }, bars: [30, 36, 33, 45, 51, 48, 62, 58, 69, 76] },
  { symbol: 'BRFS3', name: 'BRF', value: '19,84', changes: { '1D': -0.48, '5D': 0.32, '1M': 4.07 }, bars: [74, 70, 62, 66, 58, 61, 54, 49, 52, 46] },
  { symbol: 'WEGE3', name: 'WEG', value: '41,26', changes: { '1D': 0.87, '5D': -0.65, '1M': 2.36 }, bars: [38, 42, 47, 44, 53, 61, 57, 69, 73, 81] },
]

function SectionTitle({ icon: Icon, title, detail }) {
  return (
    <div className="home-section-title">
      <div className="home-section-heading"><Icon size={15} />{title}</div>
      {detail && <span>{detail}</span>}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [newsFilter, setNewsFilter] = React.useState('Todas')
  const [query, setQuery] = React.useState('')
  const [period, setPeriod] = React.useState('1D')

  const filteredNews = NEWS.filter(item => {
    const matchesCategory = newsFilter === 'Todas' || item.category === newsFilter
    const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase()
    return matchesCategory && haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="home-page">
      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-logo"><img src="/xp-asset-logo.svg" alt="XP Asset Management" /></div>
          <div>
            <div className="home-brand-title">Setorial Intelligence</div>
            <div className="home-brand-sub">Research workspace</div>
          </div>
        </div>
        <div className="home-topbar-status">
          <span className="home-status-dot" />
          Estrutura visual
        </div>
      </header>

      <main className="home-workspace">
        <aside className="home-column home-sectors">
          <SectionTitle icon={Globe2} title="Setores" detail={`${SECTORS.length} áreas`} />
          <div className="home-sector-list">
            {SECTORS.map(({ route, label, detail, icon: Icon, active, color }) => (
              <button
                key={label}
                className={`home-sector-item${active ? ' is-active' : ''}`}
                onClick={() => active && navigate(route)}
                disabled={!active}
              >
                <span className={`home-sector-icon is-${color}`}><Icon size={17} /></span>
                <span className="home-sector-copy">
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                {active ? <ChevronRight size={15} /> : <span className="home-soon">Em breve</span>}
              </button>
            ))}
          </div>

          <div className="home-watch-block">
            <div className="home-watch-label"><Wheat size={14} /> Radar setorial</div>
            <div className="home-watch-row"><span>Milho</span><strong className="is-up">+0,8%</strong></div>
            <div className="home-watch-row"><span>Boi gordo</span><strong className="is-down">-0,3%</strong></div>
            <div className="home-watch-note">Dados ilustrativos</div>
          </div>
        </aside>

        <section className="home-column home-news">
          <SectionTitle icon={Newspaper} title="News Hunter" detail="Feed demonstrativo" />
          <div className="home-news-tools">
            <label className="home-news-search">
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar tema ou empresa" />
            </label>
            <div className="home-news-tabs" aria-label="Filtrar notícias">
              {['Todas', 'Proteínas', 'Macro'].map(filter => (
                <button key={filter} className={newsFilter === filter ? 'is-on' : ''} onClick={() => setNewsFilter(filter)}>{filter}</button>
              ))}
            </div>
          </div>

          <div className="home-news-feed">
            {filteredNews.length ? filteredNews.map((item, index) => (
              <article className={`home-news-item${index === 0 ? ' is-lead' : ''}`} key={`${item.time}-${item.title}`}>
                <div className="home-news-meta">
                  <span className={`home-news-tag is-${item.tone}`}>{item.category}</span>
                  <span><Clock3 size={12} />{item.time}</span>
                  <span>{item.source}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <button className="home-news-open" title="Abrir notícia demonstrativa"><ArrowUpRight size={15} /></button>
              </article>
            )) : (
              <div className="home-news-empty">Nenhuma notícia encontrada.</div>
            )}
          </div>
        </section>

        <aside className="home-column home-market">
          <SectionTitle icon={TrendingUp} title="Market Overview" detail="Dados ilustrativos" />
          <div className="home-market-periods" aria-label="Período do mercado">
            {['1D', '5D', '1M'].map(value => (
              <button key={value} className={period === value ? 'is-on' : ''} onClick={() => setPeriod(value)}>{value}</button>
            ))}
          </div>

          <div className="home-market-list">
            {MARKETS.map(item => {
              const change = item.changes[period]
              const positive = change >= 0
              const TrendIcon = positive ? TrendingUp : TrendingDown
              return (
                <div className="home-market-row" key={item.symbol}>
                  <div className="home-market-main">
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </div>
                  <div className={`home-sparkbars${positive ? ' is-up' : ' is-down'}`} aria-hidden="true">
                    {item.bars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                  </div>
                  <div className="home-market-quote">
                    <strong>{item.value}</strong>
                    <span className={positive ? 'is-up' : 'is-down'}><TrendIcon size={12} />{positive ? '+' : ''}{change.toFixed(2).replace('.', ',')}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="home-market-footer">
            <span><span className="home-status-dot" />Mercado aberto</span>
            <button>Ver painel <ChevronRight size={14} /></button>
          </div>
        </aside>
      </main>
    </div>
  )
}
