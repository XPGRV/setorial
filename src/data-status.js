// ============================================================================
// Sinal de status dos dados — catálogo de fontes + regras de cor.
//
// Compartilhado entre o servidor (api/status.js, api/update-dashboard.js) e o
// front (status-signal.jsx). Nada aqui faz rede: só descreve DE ONDE vem cada
// gráfico e COMO decidir a cor a partir das datas e das execuções da coleta.
//
// Quatro tipos de fonte:
//   bloomberg  — série diária recalculada pelo Excel/Bloomberg no PC da esteira.
//                Verde se o último ponto é do dia esperado, vermelho se atrasou.
//   coleta     — etapa de um pipeline do pythonsetorial (GitHub Actions).
//                Verde se rodou com sucesso no último ciclo; amarelo se está
//                falhando há menos de 3 dias; vermelho a partir de 3 dias.
//   publicacao — dado sem data por linha (curvas de futuros, snapshots).
//                Usa a data em que a planilha foi publicada no dashboard.
//   manual     — preenchido à mão (APINCO, Nielsen). Sem cor: só mostra a data.
// ============================================================================

export const STATUS_ORDER = { red: 3, yellow: 2, green: 1, neutral: 0, unknown: 0 }

export function worstColor(colors) {
  let worst = null
  for (const c of colors) {
    if (!c) continue
    if (!worst || STATUS_ORDER[c] > STATUS_ORDER[worst]) worst = c
  }
  return worst || 'unknown'
}

// ── Regras (ajuste aqui) ────────────────────────────────────────────────────
export const RULES = {
  // Antes deste horário (BRT) o ciclo das 08:00 ainda pode estar rodando, então
  // o dado de ontem ainda conta como em dia. Depois dele, espera-se o de hoje.
  horaCorteBloomberg: 10,
  // Coleta: verde se a última execução OK foi há menos de X horas (o ciclo é
  // diário, 22:00, com repescagem às 08:00 — 26h dá a folga do horário).
  coletaVerdeHoras: 26,
  // Coleta: vermelho a partir de X dias sem rodar OK (entre os dois: amarelo).
  coletaVermelhoDias: 3,
}

// ── Planilhas (job do coleta-tudo.yml → dataset do dashboard) ───────────────
export const PLANILHAS = {
  BeefBR:      { dataset: 'beef_br',     consolidador: 'Consolidador BeefBR' },
  BeefUS:      { dataset: 'beef_us',     consolidador: 'Consolidador BeefUS' },
  FrangoBR:    { dataset: 'poultry_br',  consolidador: 'Consolidador FrangoBR' },
  FrangoUS:    { dataset: 'poultry_us',  consolidador: 'Consolidador FrangoUS' },
  WEG:         { dataset: 'weg' },
  Transportes: { dataset: 'transportes' },
  CarRental:   { dataset: 'rental',      consolidador: 'Consolidador CarRental' },
  Agro:        { dataset: 'agro' },
}

export const DATASET_LABELS = {
  beef_br: 'Beef BR', beef_us: 'Beef US', poultry_br: 'Frango BR', poultry_us: 'Frango US',
  macro: 'Macro', weg: 'WEG', rental: 'Rental', transportes: 'Transportes',
  agro: 'Agro', software: 'Software',
}

// ── Fontes ──────────────────────────────────────────────────────────────────
// data: { dataset, key, cols? } aponta para a série no data-<dataset>.json —
// é de onde sai a "data do dado". lagDias: séries que por construção fecham
// um dia depois (spreads e conversões que dependem de outra ponta).
const bbg = (label, dataset, key, cols, extra = {}) =>
  ({ kind: 'bloomberg', label, data: { dataset, key, cols }, ...extra })
const col = (label, job, step, dataset, key, cols, extra = {}) =>
  ({ kind: 'coleta', label, job, step, data: { dataset, key, cols }, ...extra })
const pub = (label, dataset) => ({ kind: 'publicacao', label, data: { dataset } })
const man = (label, dataset, key, cols) => ({ kind: 'manual', label, data: { dataset, key, cols } })

export const SOURCES = {
  // Beef BR
  'bbg:carne_mi':      bbg('Carne MI · BAMTCACA', 'beef_br', 'carne_mi_daily', ['value']),
  'bbg:carne_mi_usd':  bbg('Carne MI em US$', 'beef_br', 'carne_mi_usd_daily', ['value'], { lagDias: 1 }),
  'bbg:boi_gordo':     bbg('Boi gordo · BACAINDX', 'beef_br', 'boi_gordo_daily', ['value']),
  'bbg:spread_mi':     bbg('Spread MI (carne − boi)', 'beef_br', 'spread_mi_daily', ['value'], { lagDias: 1 }),
  'col:beefbr_px_exp': col('Preço de exportação bovina', 'BeefBR', 'Preco de exportacao bovina', 'beef_br', 'beef', ['beef_me_brl_kg']),
  'col:beefbr_sif':    col('Abates SIF', 'BeefBR', 'Abates SIF', 'beef_br', 'beef', ['abates_total', 'pct_femeas']),
  'col:beefbr_sidra':  col('Abates SIDRA', 'BeefBR', 'Abates SIDRA', 'beef_br', 'abates', ['total']),
  'col:beefbr_secex':  col('SECEX Comex Stat', 'BeefBR', 'SECEX Comex Stat', 'beef_br', 'secex', ['vol_bovina_br']),
  'col:beefbr_gats':   col('SECEX USDA GATS', 'BeefBR', 'SECEX USDA GATS', 'beef_br', 'secex', ['vol_bovina_eua']),

  // Beef US
  'bbg:edgebeef':      bbg('EdgeBeef · EDGEBEEF', 'beef_us', 'edgebeef_daily', ['value']),
  'col:beefus_abates': col('Abates USDA', 'BeefUS', 'Abates USDA', 'beef_us', 'beef_us', ['abates_total', 'pct_femeas']),
  'col:beefus_bezerro':col('Preço bezerro USDA NASS', 'BeefUS', 'Preco bezerro USDA NASS', 'beef_us', 'beef_us', ['preco_bezerro']),
  'col:beefus_ldp':    col('Forecasts ERS LDP', 'BeefUS', 'Forecasts ERS LDP', 'beef_us', 'production'),

  // Frango BR
  'bbg:frango_mi':     bbg('Frango MI · BACHSP', 'poultry_br', 'frango_mi_daily', ['value']),
  'bbg:porco_mi':      bbg('Porco MI · WPPKHACA', 'poultry_br', 'porco_mi_daily', ['value']),
  'bbg:feed_grain_br': bbg('Feed grain BR (milho + soja)', 'poultry_br', 'feed_grain_daily', ['value'], { lagDias: 1 }),
  'bbg:frango_spread': bbg('Spread MI frango', 'poultry_br', 'frango_spread_mi_daily', ['value'], { lagDias: 1 }),
  'col:frangobr_px_exp': col('Preço de exportação frango', 'FrangoBR', 'Preco exportacao', 'poultry_br', 'frango', ['frango_me_brl_kg']),
  'col:frangobr_sif':  col('Abates SIF', 'FrangoBR', 'Abates SIF', 'poultry_br', 'frango', ['abates_sif']),
  'col:frangobr_sidra':col('Abates SIDRA', 'FrangoBR', 'Abates SIDRA', 'poultry_br', 'frango', ['abates_sidra']),
  'col:frangobr_ipca': col('IPCA processados', 'FrangoBR', 'IPCA processados', 'poultry_br', 'processados', ['ipca_base100']),
  'man:apinco':        man('APINCO (manual)', 'poultry_br', 'frango', ['chick_placed']),
  'man:nielsen':       man('Nielsen (manual)', 'poultry_br', 'processados', ['growth_px_ind', 'growth_vol_ind']),

  // Frango US
  'bbg:frango_us_px':  bbg('Proxy XPG / Chicago', 'poultry_us', 'frango_us_daily', ['proxy', 'chic_bb', 'chic_tn']),
  'bbg:frango_us_feed':bbg('Feed grain EUA', 'poultry_us', 'frango_us_daily', ['feed_grain']),
  'bbg:frango_us_spread': bbg('Spread EUA', 'poultry_us', 'frango_us_daily', ['spread']),
  'bbg:frango_us_ratio':  bbg('Frango / boi', 'poultry_us', 'frango_us_daily', ['poultry_beef_ratio'], { lagDias: 1 }),
  'bbg:frango_us_ovos':   bbg('Ovos incubados · EGGSESUS', 'poultry_us', 'frango_us_daily', ['ovos_incubados']),
  'bbg:frango_us_hatch':  bbg('Hatchability · EGGSHCUS', 'poultry_us', 'frango_us_daily', ['hatchability']),
  'bbg:frango_us_chicks': bbg('Chicks placed · EGGSCPUS', 'poultry_us', 'frango_us_daily', ['chicks_placed']),
  'bbg:frango_us_abates': bbg('Abates · POSLHDYC', 'poultry_us', 'frango_us_daily', ['abates_frango']),
  'bbg:frango_us_peso':   bbg('Peso médio · POLSAWYC', 'poultry_us', 'frango_us_daily', ['peso_medio']),
  'bbg:frango_us_mort':   bbg('Mortalidade (cálculo)', 'poultry_us', 'frango_us_daily', ['mortality'], { lagDias: 1 }),
  'bbg:frango_us_prod':   bbg('Produção (cálculo)', 'poultry_us', 'frango_us_daily', ['producao'], { lagDias: 1 }),
  'col:frangous_usda':    col('USDA ERS (wholesale/feed)', 'FrangoUS', 'USDA FrangoUS', 'poultry_us', 'frango_us_monthly', ['usda_wholesale_price', 'usda_feed_cost']),
  'col:frangous_nc':      col('National composite (semanal)', 'FrangoUS', 'National composite', 'poultry_us', 'frango_us_nc_weekly', ['nc_w1']),
  'col:frangous_nc_px':   col('National composite price', 'FrangoUS', 'National composite price', 'poultry_us', 'frango_us_monthly', ['national_composite']),
  'col:frangous_ldp':     col('Forecast ERS LDP', 'FrangoUS', 'Forecast ERS LDP', 'poultry_us', 'broiler_production'),
  'col:frangous_plantel': col('Plantel de matrizes (NASS)', 'FrangoUS', 'Production', 'poultry_us', 'frango_us_monthly', ['plantel_matrizes']),
  'col:frangous_lay':     col('Rate of lay (NASS)', 'FrangoUS', 'Rate of lay', 'poultry_us', 'frango_us_monthly', ['produtividade_matrizes']),
  'col:frangous_hatched': col('Chicks hatched (NASS)', 'FrangoUS', 'Chicks hatched', 'poultry_us', 'frango_us_monthly', ['ovos_quebrados']),

  // Macro
  'pub:macro':         pub('Planilha Selic (publicação)', 'macro'),

  // WEG
  'bbg:weg_peers':     bbg('Peers WEG', 'weg', 'weg_peers', ['weg', 'abb', 'siemens', 'schneider']),
  'col:weg_secex_tr':  col('SECEX Transformadores', 'WEG', 'SECEX Transformadores', 'weg', 'weg_transformadores_exports', ['br_850421']),
  'col:weg_secex_mot': col('SECEX Motores', 'WEG', 'SECEX Motores', 'weg', 'weg_eie_exports', ['br_850120']),
  'col:weg_ppi':       col('PPI Transformadores (FRED)', 'WEG', 'PPI Transformadores (FRED)', 'weg', 'weg_transformadores', ['value']),

  // Rental
  'bbg:rental_peers':  bbg('Peers Rental', 'rental', 'rental_peers', ['localiza', 'movida', 'vamos']),
  'col:rental_ipca':   col('IPCA carros (SIDRA)', 'CarRental', 'IPCA carros (SIDRA)', 'rental', 'rental_car_prices', ['new_price_index']),

  // Transportes
  'col:transp_secex':  col('SECEX Grãos', 'Transportes', 'SECEX Graos', 'transportes', 'transport_grains', ['soy_volume_kt']),
  'col:transp_imea':   col('Frete de grãos (IMEA)', 'Transportes', 'Frete de graos (IMEA)', 'transportes', 'transport_freights', ['sorriso_santos', 'rondonopolis_santos', 'sorriso_rondonopolis']),

  // Agro
  'bbg:agro_cotton':   bbg('Algodão · CBOT/Barreiras', 'agro', 'agro_cotton_daily', ['cbot_usd', 'barreiras_usd']),
  'bbg:agro_cotton_disc': bbg('Desconto algodão', 'agro', 'agro_cotton_daily', ['discount_usd'], { lagDias: 1 }),
  'bbg:agro_soy':      bbg('Soja · CBOT/Paranaguá/Sorriso', 'agro', 'agro_soy_daily', ['cbot_usd_bu', 'paranagua_usd_bu', 'sorriso_usd_bu']),
  'bbg:agro_soy_disc': bbg('Desconto soja', 'agro', 'agro_soy_daily', ['discount_usd'], { lagDias: 1 }),
  'bbg:agro_corn':     bbg('Milho · CBOT/Campinas/Sorriso', 'agro', 'agro_corn_daily', ['cbot_usd_bu', 'campinas_usd_bu', 'sorriso_usd_bu']),
  'bbg:agro_corn_disc':bbg('Desconto milho', 'agro', 'agro_corn_daily', ['discount_usd'], { lagDias: 1 }),
  'pub:agro':          pub('Curvas de futuros (publicação)', 'agro'),

  // Software
  'bbg:software_peers':bbg('Peers Software', 'software', 'software_peers', ['sap', 'oracle', 'microsoft', 'totvs']),
}

// ── Card → fontes ───────────────────────────────────────────────────────────
// A chave é o data-card-id do <section class="card">. A cor do card é a pior
// entre as fontes. Card que não está aqui simplesmente não ganha bolinha.
export const CARD_SOURCES = {
  // Beef BR
  'card-carne-mi':      ['bbg:carne_mi', 'bbg:carne_mi_usd'],
  'card-carne-me':      ['col:beefbr_px_exp'],
  'card-cattle':        ['bbg:boi_gordo'],
  'card-spread-mi':     ['bbg:spread_mi'],
  'card-spread-me':     ['col:beefbr_px_exp', 'bbg:boi_gordo'],
  'card-abates':        ['col:beefbr_sif', 'col:beefbr_sidra'],
  'card-femeas':        ['col:beefbr_sif'],
  // Beef US
  'us-edgebeef':        ['bbg:edgebeef'],
  'us-ciclo':           ['col:beefus_abates', 'col:beefus_bezerro'],
  'us-production':      ['col:beefus_ldp'],
  'us-annual':          ['col:beefus_ldp'],
  // Frango BR
  'card-abates-frango': ['col:frangobr_sif', 'col:frangobr_sidra'],
  'card-chick-placed':  ['man:apinco'],
  'card-porco-mi':      ['bbg:porco_mi'],
  'card-ipca-processados': ['col:frangobr_ipca'],
  'card-growth-px':     ['man:nielsen'],
  'card-growth-vol':    ['man:nielsen'],
  'card-frango-mi':     ['bbg:frango_mi'],
  'card-frango-me':     ['col:frangobr_px_exp'],
  'card-feed-grain':    ['bbg:feed_grain_br'],
  'card-spread-mi-frango': ['bbg:frango_spread'],
  'card-spread-me-frango': ['col:frangobr_px_exp', 'bbg:feed_grain_br'],
  // Frango US
  'us-frango-price':    ['bbg:frango_us_px'],
  'us-national-composite': ['col:frangous_nc_px', 'col:frangous_nc'],
  'us-broiler-production': ['col:frangous_ldp'],
  'us-broiler-annual':  ['col:frangous_ldp'],
  'us-plantel-matrizes':['col:frangous_plantel'],
  'us-produtividade-matrizes': ['col:frangous_lay'],
  'us-ovos-quebrados':  ['col:frangous_hatched'],
  'us-ovos-incubados':  ['bbg:frango_us_ovos'],
  'us-hatchability':    ['bbg:frango_us_hatch'],
  'us-chicks-placed':   ['bbg:frango_us_chicks'],
  'us-mortality':       ['bbg:frango_us_mort'],
  'us-abates-frango':   ['bbg:frango_us_abates'],
  'us-peso-medio':      ['bbg:frango_us_peso'],
  'us-producao':        ['bbg:frango_us_prod'],
  'us-feed-grain':      ['bbg:frango_us_feed'],
  'us-spread':          ['bbg:frango_us_spread'],
  'us-poultry-beef':    ['bbg:frango_us_ratio'],
  'us-usda-price':      ['col:frangous_usda'],
  'us-usda-feed':       ['col:frangous_usda'],
  'us-usda-spread':     ['col:frangous_usda'],
  'us-price-comparison':['bbg:frango_us_px', 'col:frangous_usda', 'col:frangous_nc_px'],
  // Macro
  'card-macro-cdi':     ['pub:macro'],
  // WEG
  'card-weg-peers':     ['bbg:weg_peers'],
  'card-weg-peers-pe':  ['bbg:weg_peers'],
  'card-weg-transformadores-exportacoes': ['col:weg_secex_tr'],
  'card-weg-eie-exportacoes': ['col:weg_secex_mot'],
  'card-weg-transformadores': ['col:weg_ppi'],
  'card-weg-transformadores-preco-secex': ['col:weg_secex_tr'],
  'card-weg-transformadores-volume-unitario': ['col:weg_secex_tr'],
  // Rental
  'card-rental-car-prices': ['col:rental_ipca'],
  'card-rental-peers':  ['bbg:rental_peers'],
  'card-rental-peers-pe': ['bbg:rental_peers'],
  // Transportes
  'card-transport-freights': ['col:transp_imea'],
  'card-transport-soy-volume': ['col:transp_secex'],
  'card-transport-soy-mt-volume': ['col:transp_secex'],
  'card-transport-corn-volume': ['col:transp_secex'],
  'card-transport-corn-mt-volume': ['col:transp_secex'],
  // Agro
  'card-agro-cotton-price': ['bbg:agro_cotton'],
  'card-agro-cotton-discount': ['bbg:agro_cotton_disc'],
  'card-agro-cotton-futures': ['pub:agro'],
  'card-agro-cotton-dollar-futures': ['pub:agro'],
  'card-agro-soy-price': ['bbg:agro_soy'],
  'card-agro-soy-discount': ['bbg:agro_soy_disc'],
  'card-agro-soy-futures': ['pub:agro'],
  'card-agro-soy-dollar-futures': ['pub:agro'],
  'card-agro-corn-price': ['bbg:agro_corn'],
  'card-agro-corn-discount': ['bbg:agro_corn_disc'],
  'card-agro-corn-futures': ['pub:agro'],
  'card-agro-corn-dollar-futures': ['pub:agro'],
  // Software
  'card-software-peers': ['bbg:software_peers'],
  'card-software-peers-pe': ['bbg:software_peers'],
}

// ── Datas ───────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')

function rowDate(r) {
  if (!r || typeof r !== 'object') return null
  if (r.date) return String(r.date).slice(0, 10)
  if (r.year && r.month) return `${r.year}-${pad(r.month)}` + (r.day ? `-${pad(r.day)}` : '')
  if (r.year && r.quarter) return `${r.year}-Q${r.quarter}`
  return null
}

const isValue = v => v != null && v !== '' && typeof v !== 'object' && !(typeof v === 'number' && Number.isNaN(v))

// Resumo leve de um payload parseado: para cada série, a data do último valor
// preenchido em cada coluna. É isto que vai para o status-<dataset>.json (alguns
// KB) em vez de o /api/status baixar os ~20 MB de dados a cada consulta.
export function summarizeLastDates(parsed) {
  const out = {}
  for (const [key, value] of Object.entries(parsed || {})) {
    if (Array.isArray(value)) {
      const cols = {}
      for (const row of value) {
        const d = rowDate(row)
        if (!d) continue
        for (const [c, v] of Object.entries(row)) {
          if (['year', 'month', 'day', 'date', 'quarter', 'week'].includes(c)) continue
          if (isValue(v) && (!cols[c] || d > cols[c])) cols[c] = d
        }
      }
      if (Object.keys(cols).length) out[key] = cols
    } else if (value && typeof value === 'object' && Array.isArray(value.snapshots)) {
      // Séries por revisão (LDP, Focus): a "data" é a revisão mais recente.
      const last = value.snapshots[value.snapshots.length - 1]
      if (last) out[key] = { _snapshot: String(last) }
    }
  }
  return out
}

// Data do último ponto de uma fonte, a partir do resumo do dataset.
export function sourceDataDate(source, lastDates) {
  const d = source?.data
  if (!d?.key || !lastDates) return null
  const series = lastDates[d.key]
  if (!series) return null
  if (series._snapshot) return series._snapshot
  const cols = d.cols?.length ? d.cols : Object.keys(series)
  let best = null
  for (const c of cols) if (series[c] && (!best || series[c] > best)) best = series[c]
  return best
}

// "Hoje" no fuso de Brasília, como { date: 'AAAA-MM-DD', hour }.
export function nowBRT(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = t => parts.find(p => p.type === t)?.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000)
}

// Data que uma série diária do Bloomberg deveria ter agora. A esteira roda
// todos os dias (inclusive fim de semana, com o último preço repetido), às
// 22:00 e às 08:00. Até a hora de corte, o dado de ontem ainda está em dia.
export function expectedBloombergDate(now = new Date()) {
  const { date, hour } = nowBRT(now)
  return hour < RULES.horaCorteBloomberg ? addDays(date, -1) : date
}

// ── Cores ───────────────────────────────────────────────────────────────────
export function colorBloomberg(dataDate, lagDias = 0, now = new Date()) {
  if (!dataDate || dataDate.length < 10) return { color: 'unknown', atraso: null }
  const esperado = addDays(expectedBloombergDate(now), -lagDias)
  const atraso = Math.max(0, daysBetween(dataDate.slice(0, 10), esperado))
  return { color: atraso === 0 ? 'green' : 'red', atraso, esperado }
}

export function colorPublicacao(publishedAt, now = new Date()) {
  if (!publishedAt) return { color: 'unknown', atraso: null }
  const pubDate = nowBRT(new Date(publishedAt)).date
  const esperado = expectedBloombergDate(now)
  const atraso = Math.max(0, daysBetween(pubDate, esperado))
  return { color: atraso === 0 ? 'green' : 'red', atraso, esperado }
}

// lastOkAt: ISO da última execução em que a etapa terminou bem (ou null se não
// achou nenhuma nas execuções olhadas).
export function colorColeta(lastOkAt, now = new Date()) {
  if (!lastOkAt) return { color: 'red', horasSemOk: null }
  const horas = (now - new Date(lastOkAt)) / 3600000
  if (horas < RULES.coletaVerdeHoras) return { color: 'green', horasSemOk: horas }
  if (horas < RULES.coletaVermelhoDias * 24) return { color: 'yellow', horasSemOk: horas }
  return { color: 'red', horasSemOk: horas }
}

export function cardColor(cardId, sourcesStatus) {
  const ids = CARD_SOURCES[cardId]
  if (!ids || !sourcesStatus) return null
  return worstColor(ids.map(id => sourcesStatus[id]?.color))
}
