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
  TrendingUp,
} from 'lucide-react'

const SECTORS = [
  { route: '/proteinas', label: 'Proteínas', contents: 'Dados setoriais de Beef US, Beef BR, Poultry US, Poultry BR e cenário macro.', icon: Beef, active: true },
  { label: 'Bens de Capital', contents: 'Indicadores operacionais, mercado e acompanhamento de empresas industriais.', icon: Factory },
  { label: 'Locação', contents: 'Dados de locação de veículos, frotas, preços e dinâmica competitiva.', icon: Car },
  { label: 'Financeiro', contents: 'Indicadores de bancos, crédito, spreads e serviços financeiros.', icon: Landmark },
  { label: 'Real Estate', contents: 'Dados de shoppings, propriedades comerciais e mercado imobiliário.', icon: Building2 },
]

const NEWS = [
  {
    category: 'Proteínas',
    time: '08:42',
    source: 'Agência internacional',
    title: 'Exportações e oferta global permanecem no radar do setor de proteínas',
    summary: 'Fluxos comerciais e custos de alimentação seguem como os principais vetores acompanhados pelo mercado.',
    tone: 'blue',
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
    tone: 'blue',
  },
  {
    category: 'Proteínas',
    time: '07:31',
    source: 'Monitor setorial',
    title: 'Preços de grãos voltam ao foco nas cadeias de bovinos e aves',
    summary: 'Movimentos em milho e soja são acompanhados por seus efeitos sobre custos e spreads.',
    tone: 'blue',
  },
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
        </div>
      </header>

      <main className="home-workspace">
        <aside className="home-column home-sectors">
          <SectionTitle icon={Globe2} title="Setores" detail={`${SECTORS.length} áreas`} />
          <div className="home-sector-list">
            {SECTORS.map(({ route, label, contents, icon: Icon, active }) => (
              <button
                key={label}
                className={`home-sector-item${active ? ' is-active' : ' is-soon'}`}
                onClick={() => active && navigate(route)}
                aria-disabled={!active}
              >
                <span className="home-sector-icon"><Icon size={18} /></span>
                <span className="home-sector-copy"><strong>{label}</strong></span>
                {active ? <ChevronRight size={15} /> : <span className="home-soon">Em breve</span>}
                <span className="home-sector-tooltip" role="tooltip">
                  <strong>{label}</strong>
                  <span>{contents}</span>
                </span>
              </button>
            ))}
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
          <SectionTitle icon={TrendingUp} title="Market Overview" />
          <div className="home-market-empty">
            <div className="home-market-empty-line" />
            <span>Sem dados no momento</span>
          </div>
        </aside>
      </main>
    </div>
  )
}
