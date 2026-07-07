const normalize = value => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const DATASET_LABELS = {
  beef_br: 'Beef BR', beef_us: 'Beef US',
  poultry_br: 'Poultry BR', poultry_us: 'Poultry US',
  macro: 'Macro', weg: 'WEG', rental: 'Rental', transportes: 'Transportes',
}

const TAB_LABELS = {
  precos: 'Preços & Spreads', abates: 'Produção',
  ipca: 'Processados', producao: 'Produção',
  graos: 'Grãos', fretes: 'Fretes',
}

const DATASET_KEYWORDS = {
  beef_br: 'beef boi carne gado bovino brasil br',
  beef_us: 'beef boi carne gado bovino eua usa us estados unidos america',
  poultry_br: 'poultry frango chicken aves ave brasil br',
  poultry_us: 'poultry frango chicken aves ave eua usa us estados unidos america',
  macro: 'macro cenario',
  weg: 'weg capital goods bens de capital industria equipamentos transformadores motores',
  rental: 'rental locadoras carros automoveis veiculos pesados peers mobilidade',
  transportes: 'transportes logistica frete fretes graos soja milho exportacao secex',
}

const RAW_ITEMS = [
  ['beef_br','precos',null,'Beef BR · Preços & Spreads','preco precos spread'],
  ['beef_br','abates',null,'Beef BR · Produção','producao abate abates ciclo femeas slaughter'],
  ['beef_us',null,null,'Beef US','producao abate edgebeef ciclo forecast preco'],
  ['poultry_br','precos',null,'Poultry BR · Preços & Spreads','preco precos spread'],
  ['poultry_br','abates',null,'Poultry BR · Produção','producao abate abates pintos chick'],
  ['poultry_br','ipca',null,'Poultry BR · Processados','processados ipca growth nielsen industrializados inflacao'],
  ['poultry_us','precos',null,'Poultry US · Preços & Spreads','preco precos spread'],
  ['poultry_us','producao',null,'Poultry US · Produção','producao production broiler matrizes ovos pintos'],
  ['macro',null,null,'Macro · CDI','cdi selic juros taxa banco central bcb cenario macro'],
  ['weg',null,null,'WEG','capital goods bens de capital industria equipamentos transformadores motores peers'],
  ['rental','precos',null,'Rental · Carros','rental carros automoveis veiculos precos spreads'],
  ['rental','precos','card-rental-car-prices','Preços e Spreads · Carros','automovel novo usado spread preco indice'],
  ['rental','peers','card-rental-peers','Peers · Comparação de Preço','localiza movida vamos rent3 movi3 vamo3 cotacao preco base 100'],
  ['rental','peers','card-rental-peers-pe','Peers · Comparação de P/E','localiza movida vamos rent3 movi3 vamo3 pe price earnings multiplo'],
  ['transportes','fretes',null,'Transportes · Fretes','frete fretes logistica imea mato grosso santos sorriso rondonopolis'],
  ['transportes','fretes','card-transport-freights','Preços de Frete','frete fretes rota rotas sorriso santos rondonopolis rs ton'],
  ['transportes','graos',null,'Transportes · Grãos','soja milho exportacao secex volume'],
  ['transportes','graos','card-transport-soy-volume','Exportação Soja','soja volume exportado exportacao 1000 toneladas'],
  ['transportes','graos','card-transport-corn-volume','Exportação Milho','milho volume exportado exportacao 1000 toneladas'],
  ['weg',null,'card-weg-transformadores','Preço de Transformadores','transformador transformadores transformer ppi electric power specialty manufacturing'],
  ['weg',null,'card-weg-peers','Peers · Comparação de Preço','peers cotacao preco price weg abb nidec regal rexnord eaton siemens schneider ge vernova hitachi hyosung eie gtd'],
  ['weg',null,'card-weg-peers-pe','Peers · Comparação de P/E','peers pe price earnings valuation multiplo weg abb nidec regal rexnord eaton siemens schneider ge vernova hitachi hyosung eie gtd'],
  ['beef_br','precos','card-carne-mi','Preço Carne · Mercado Interno','carne mercado interno mi domestic price'],
  ['beef_br','precos','card-carne-me','Preço Carne · Mercado Externo','carne mercado externo me exportacao export'],
  ['beef_br','precos','card-cattle','Preço Boi Gordo','boi gordo arroba cattle live bacaindx'],
  ['beef_br','precos','card-spread-mi','Spread MI','spread mercado interno mi'],
  ['beef_br','precos','card-spread-me','Spread ME','spread mercado externo me'],
  ['beef_br','abates','card-abates','Abates Totais','abate abates totais slaughter cabecas sidra sif'],
  ['beef_br','abates','card-ciclo','Ciclo do Boi','ciclo femeas boi bezerro cattle cycle'],
  ['beef_us',null,'us-edgebeef','EdgeBeef','edgebeef edge margem frigorifico margin packer'],
  ['beef_us',null,'us-ciclo','Ciclo do Boi','ciclo femeas boi bezerro cattle cycle'],
  ['beef_us',null,'us-production','Revisão de Forecast','producao forecast revisao usda trimestral quarterly'],
  ['beef_us',null,'us-annual','Revisão de Forecast · Anual','producao forecast anual annual usda'],
  ['poultry_br','precos','card-frango-mi','Preço Frango · Mercado Interno','frango mercado interno mi'],
  ['poultry_br','precos','card-frango-me','Preço Frango · Mercado Externo','frango mercado externo me exportacao secex'],
  ['poultry_br','precos','card-feed-grain','Feed Grain','feed grain racao milho soja corn soybean custo'],
  ['poultry_br','precos','card-porco-mi','Preço Porco · Mercado Interno','porco suino suinos carne suina pork hog swine mercado interno preco'],
  ['poultry_br','precos','card-spread-mi-frango','Spread MI','spread mercado interno mi'],
  ['poultry_br','precos','card-spread-me-frango','Spread ME','spread mercado externo me'],
  ['poultry_br','abates','card-abates-frango','Abates de Frango','abate abates slaughter sidra sif'],
  ['poultry_br','abates','card-chick-placed','Chick Placed','chick placed pintos alojados apinco'],
  ['poultry_br','ipca','card-ipca-processados','IPCA Processados','ipca processados industrializados inflacao'],
  ['poultry_br','ipca','card-growth-px','Growth Like-for-Like Pricing','growth pricing preco nielsen brf seara'],
  ['poultry_br','ipca','card-growth-vol','Growth Volume','growth volume nielsen brf seara'],
  ['poultry_us','precos','us-frango-price','Preço Frango','frango preco price'],
  ['poultry_us','precos','us-feed-grain','Feed Grain','feed grain racao milho soja corn soybean custo'],
  ['poultry_us','precos','us-spread','Spread · Frango - Ração','spread frango racao feed'],
  ['poultry_us','precos','us-poultry-beef','Poultry / Beef','poultry beef ratio razao frango boi'],
  ['poultry_us','precos','us-national-composite','National Composite','national composite whole bird wogs atacado wholesale'],
  ['poultry_us','precos','us-usda-price','Broilers · Preço','broilers preco price usda'],
  ['poultry_us','precos','us-usda-feed','Broilers · Feed Costs','broilers feed costs racao usda'],
  ['poultry_us','precos','us-usda-spread','Broilers · Spread','broilers spread usda'],
  ['poultry_us','producao','us-broiler-production','Revisão de Forecast','producao forecast broiler usda trimestral'],
  ['poultry_us','producao','us-broiler-annual','Revisão de Forecast · Anual','producao forecast anual broiler usda'],
  ['poultry_us','producao','us-plantel-matrizes','Plantel de Matrizes','plantel matrizes breeder hatching layers'],
  ['poultry_us','producao','us-produtividade-matrizes','Produtividade das Matrizes','produtividade matrizes eggs per layer'],
  ['poultry_us','producao','us-ovos-incubados','Ovos Incubados','ovos incubados eggs set incubacao'],
  ['poultry_us','producao','us-ovos-quebrados','Ovos Quebrados','ovos quebrados eggs broken'],
  ['poultry_us','producao','us-hatchability','Hatchability','hatchability eclodibilidade eclosao'],
  ['poultry_us','producao','us-chicks-placed','Chicks Placed','chicks placed pintos alojados'],
  ['poultry_us','producao','us-mortality','Mortality','mortality mortalidade'],
  ['poultry_us','producao','us-abates-frango','Abates de Frango','abate abates slaughter'],
  ['poultry_us','producao','us-peso-medio','Peso Médio','peso medio average weight'],
  ['poultry_us','producao','us-producao','Produção de Frango','producao production output'],
]

const INDEX = RAW_ITEMS.map(([dataset, tab, cardId, label, keywords]) => {
  const breadcrumb = DATASET_LABELS[dataset] + (tab && TAB_LABELS[tab] ? ` · ${TAB_LABELS[tab]}` : '')
  return {
    dataset, tab, cardId, label, breadcrumb,
    _text: normalize(`${label} ${breadcrumb} ${keywords} ${DATASET_KEYWORDS[dataset]}`),
  }
})

export function searchDestinations(query) {
  const tokens = normalize(query).split(' ').filter(Boolean)
  if (!tokens.length) return []
  return INDEX.map(item => {
    let score = item.cardId ? 0 : 1.2
    for (const token of tokens) {
      const index = item._text.indexOf(token)
      if (index < 0) return null
      score += (item._text.startsWith(token) ? 3 : 1) + Math.max(0, 4 - index / 12)
    }
    return { item, score }
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(result => result.item)
}

export function dashboardPathForDataset(dataset) {
  if (dataset === 'macro') return '/macro'
  if (dataset === 'weg') return '/capitalgoods'
  if (dataset === 'rental') return '/rental'
  if (dataset === 'transportes') return '/transportes'
  return '/proteinas'
}
