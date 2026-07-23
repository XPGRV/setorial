// Parser puro das planilhas (.xlsm) → estrutura de dados da dashboard.
// FONTE DA VERDADE única: usado tanto pelo navegador (upload.jsx) quanto pelo
// script Node (scripts/update-dashboard.mjs). Não depende de React nem de
// `window`; recebe a instância do SheetJS (XLSX) por parâmetro.

let _XLSX = null;

export function parseNum(v) {
  if (v == null || v === '' || v === 'Sem Dados' || v === '-') return null;
  const s = String(v).replace(/,/g, '').replace(/\s/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export function parseMonthTag(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^([a-zA-Z]{3})[-/]?(\d{2,4})$/);
  if (!m) return null;
  const ALL_MO = {
    jan:1, fev:2, feb:2, mar:3, abr:4, apr:4, mai:5, may:5, jun:6,
    jul:7, ago:8, aug:8, set:9, sep:9, out:10, oct:10, nov:11, dez:12, dec:12
  };
  const mo = ALL_MO[m[1].toLowerCase()];
  if (!mo) return null;
  let yr = parseInt(m[2]);
  if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
  return { year: yr, month: mo };
}

export function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return { year: v.getFullYear(), month: v.getMonth()+1, day: v.getDate() };
  if (typeof v === 'string') {
    const tag = parseMonthTag(v);
    if (tag) return { year: tag.year, month: tag.month, day: 1 };
    const br = String(v).trim().match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (br) {
      let yr = parseInt(br[3], 10);
      if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
      return { year: yr, month: parseInt(br[2], 10), day: parseInt(br[1], 10) };
    }
    const d = new Date(v);
    if (!isNaN(d)) return { year: d.getUTCFullYear(), month: d.getUTCMonth()+1, day: d.getUTCDate() };
  }
  if (typeof v === 'number' && v > 20000) {
    if (_XLSX && _XLSX.SSF) {
      try { const p = _XLSX.SSF.parse_date_code(v); if (p) return { year: p.y, month: p.m, day: p.d }; } catch(_) {}
    }
  }
  return null;
}

function trimEmpty(arr) {
  return arr.filter(row =>
    Object.entries(row).some(([k, v]) => k !== 'year' && k !== 'month' && v != null)
  );
}

// Nula o campo para qualquer mês mais recente que (hoje - lagMonths).
// Ex: hoje = Abr/26, lag=2 → nula Mar/26 e Abr/26; Fev/26 fica intacto.
function trimSifLag(arr, field, lagMonths = 2) {
  const now = new Date();
  const cutoff = now.getFullYear() * 12 + now.getMonth() - lagMonths; // ordinal 0-indexed
  return arr.map(row => {
    const ord = row.year * 12 + (row.month - 1);
    return ord > cutoff ? { ...row, [field]: null } : row;
  });
}

// Recebe um workbook JÁ LIDO pelo SheetJS (com cellDates:true, cellStyles:true)
// e a instância XLSX, e devolve o objeto de dados.
export function parseWorkbookData(wb, XLSX, { parseBR = true, parseUS = true, parsePoultryUS = false, parseSelic = false, parseRental = false, parseTransportes = false, parseAgro = false } = {}) {
  _XLSX = XLSX;
  const sheets = wb.SheetNames;
  // Case-insensitive sheet lookup
  const findSheet = name => sheets.find(s => s.toLowerCase() === name.toLowerCase()) || null;
  const result = {};

  const normalizeSheetName = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const findSheetByWords = words => sheets.find(sheet =>
    words.every(word => normalizeSheetName(sheet).includes(word))
  ) || null;
  const freightSheet = findSheetByWords(['frete']);
  if (parseTransportes && freightSheet) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[freightSheet], { header: 1, raw: true });
    const transport_freights = [];
    for (let i = 3; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const wd = parseDate(r[2]) || parseDate(r[1]) || parseMonthTag(r[1]);
      if (!wd) continue;
      const row = {
        year: wd.year, month: wd.month, day: wd.day || 1,
        sorriso_santos: parseNum(r[3]),
        rondonopolis_santos: parseNum(r[4]),
        sorriso_rondonopolis: parseNum(r[5]),
      };
      if (Object.entries(row).some(([key, value]) => !['year','month','day'].includes(key) && value != null)) {
        transport_freights.push(row);
      }
    }
    if (transport_freights.length) result.transport_freights = transport_freights;
  }

  // Transportes · Grãos (Transportes.xlsm · aba SECEX)
  // B=mês; D=Soja, E=Soja-MT, F=Milho, G=Milho-MT (volumes em 1000 t).
  if (parseTransportes && findSheet('SECEX')) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('SECEX')], { header: 1, raw: true });
    const transport_grains = [];
    for (let i = 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const md = parseDate(r[1]) || parseMonthTag(r[1]);
      if (!md) continue;
      const row = {
        year: md.year, month: md.month,
        soy_volume_kt: parseNum(r[3]),      // D — Soja (Brasil)
        soy_mt_volume_kt: parseNum(r[4]),   // E — Soja MT
        corn_volume_kt: parseNum(r[5]),     // F — Milho (Brasil)
        corn_mt_volume_kt: parseNum(r[6]),  // G — Milho MT
      };
      if (Object.entries(row).some(([key, value]) => !['year','month'].includes(key) && value != null)) {
        transport_grains.push(row);
      }
    }
    if (transport_grains.length) result.transport_grains = transport_grains;
  }

  // ── Agro (Agro.xlsm · aba BBG_Dados) ────────────────────────────────────────
  // D=data diária; Algodão: E=CT1 USd/lp, F=CT1 BRL/lp, G=BACRBARR USd/lp,
  // H=BACRBARR BRL/lp, I=Desconto USd/lp, J=Desconto %.
  // Soja: K=CBOT USD/bu, L=CBOT BRL/sc, M=Paranaguá USD/bu, N=Paranaguá BRL/sc,
  // O=Sorriso USD/bu, P=Sorriso BRL/sc, Q=Desconto USD/bu, R=Desconto %.
  // Séries do Agro: arredonda p/ 5 casas p/ reduzir o JSON (~10k linhas diárias).
  const r5 = v => { const n = parseNum(v); return n == null ? null : Math.round(n * 1e5) / 1e5; };

  if (parseAgro && findSheet('BBG_Dados')) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const agro_cotton_daily = [];
    const agro_soy_daily = [];
    let curDate = null;
    for (let i = 3; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const pd = parseDate(r[3]);
      if (pd) {
        curDate = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
      } else if (curDate) {
        curDate = new Date(curDate.getTime() + 86400000);
      } else continue;
      const year = curDate.getUTCFullYear(), month = curDate.getUTCMonth() + 1, day = curDate.getUTCDate();
      const cotton = {
        year, month, day,
        cbot_usd:      r5(r[4]),  // E — Cotton CBOT USd/lp
        cbot_brl:      r5(r[5]),  // F — Cotton CBOT BRL/lp
        barreiras_usd: r5(r[6]),  // G — Cotton Barreiras USd/lp
        barreiras_brl: r5(r[7]),  // H — Cotton Barreiras BRL/lp
        discount_usd:  r5(r[8]),  // I — Desconto USd/lp
        discount_pct:  r5(r[9]),  // J — Desconto %
      };
      if (Object.entries(cotton).some(([k, v]) => !['year','month','day'].includes(k) && v != null)) {
        agro_cotton_daily.push(cotton);
      }
      const soy = {
        year, month, day,
        cbot_usd_bu:      r5(r[10]), // K — Soybean CBOT USD/bu
        cbot_brl_sc:      r5(r[11]), // L — Soybean CBOT BRL/sc
        paranagua_usd_bu: r5(r[12]), // M — Soybean Paranaguá USD/bu
        paranagua_brl_sc: r5(r[13]), // N — Soybean Paranaguá BRL/sc
        sorriso_usd_bu:   r5(r[14]), // O — Soybean Sorriso USD/bu
        sorriso_brl_sc:   r5(r[15]), // P — Soybean Sorriso BRL/sc
        discount_usd:     r5(r[16]), // Q — Desconto USD/bu (Paranaguá − CBOT)
        discount_pct:     r5(r[17]), // R — Desconto %
      };
      if (Object.entries(soy).some(([k, v]) => !['year','month','day'].includes(k) && v != null)) {
        agro_soy_daily.push(soy);
      }
    }
    if (agro_cotton_daily.length) result.agro_cotton_daily = agro_cotton_daily;
    if (agro_soy_daily.length)    result.agro_soy_daily    = agro_soy_daily;
  }

  // ── Curvas de futuros do Agro (aba "Futuros"; legado: abas "Soja"/"Algodão") ──
  // Três blocos lado a lado na aba Futuros — Soja (ticker na col B), Algodão
  // (col K) e Dólar (col T); em cada bloco: ticker, Atual, 1 sem., 1 mês.
  // Vencimento decodificado do ticker: letra = mês (F,G,H,J,K,M,N,Q,U,V,X,Z =
  // Jan..Dez) e ano com 1 dígito ("S Q6 Comdty") ou 2 ("UCQ26 Curncy").
  if (parseAgro) {
    const MONTH_CODES = { F:1, G:2, H:3, J:4, K:5, M:6, N:7, Q:8, U:9, V:10, X:11, Z:12 };
    const nowYear = new Date().getFullYear();
    const parseFuturesBlock = (sheetName, tickerCol) => {
      const sh = findSheet(sheetName);
      if (!sh) return null;
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, raw: true });
      const out = [];
      // O bloco de exibição é contíguo a partir da linha 5; abaixo dele (após
      // uma linha vazia) fica a lista auxiliar da coleta com os mesmos tickers
      // — parar no primeiro gap evita duplicar os contratos.
      let started = false;
      for (let i = 3; i < raw.length; i++) {
        const r = raw[i];
        const ticker = r && r[tickerCol];
        if (!ticker) {
          if (started) break;
          continue;
        }
        const m = String(ticker).trim().match(/([FGHJKMNQUVXZ])(\d{1,2})\s+(?:Comdty|Curncy)$/i);
        if (!m) continue;
        started = true;
        const month = MONTH_CODES[m[1].toUpperCase()];
        let year;
        if (m[2].length === 2) {
          year = 2000 + parseInt(m[2], 10); // 2 dígitos: 26 → 2026
        } else {
          // Dígito único → resolve na década corrente (6 → 2026);
          // se cair mais de 1 ano no passado, é da década seguinte.
          year = Math.floor(nowYear / 10) * 10 + parseInt(m[2], 10);
          if (year < nowYear - 1) year += 10;
        }
        const row = {
          year, month,
          atual:     r5(r[tickerCol + 1]), // Atual
          week_ago:  r5(r[tickerCol + 2]), // 1 semana atrás
          month_ago: r5(r[tickerCol + 3]), // 1 mês atrás
        };
        if (row.atual != null || row.week_ago != null || row.month_ago != null) out.push(row);
      }
      out.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      return out.length ? out : null;
    };
    const hasFuturos = !!findSheet('Futuros');
    const soyFutures    = hasFuturos ? parseFuturesBlock('Futuros', 1)  : parseFuturesBlock('Soja', 1);
    const cottonFutures = hasFuturos ? parseFuturesBlock('Futuros', 10) : parseFuturesBlock('Algodão', 1);
    const dollarFutures = hasFuturos ? parseFuturesBlock('Futuros', 19) : null;
    if (soyFutures)    result.agro_soy_futures    = soyFutures;
    if (cottonFutures) result.agro_cotton_futures = cottonFutures;
    if (dollarFutures) result.agro_dollar_futures = dollarFutures;
  }

  // Rental · Carros (CarRental.xlsm · aba "Preço Carros")
  // B = mês, J = preço novo (base 100), L = usado ajustado, M = spread usado/novo.
  const rentalSheet = findSheet('Preço Carros') || findSheet('Preços Carros');
  if (parseRental && rentalSheet) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[rentalSheet], { header: 1, raw: true });
    const rental_car_prices = [];
    for (let i = 4; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const md = parseDate(r[1]) || parseMonthTag(r[1]);
      if (!md) continue;
      const new_price_index = parseNum(r[9]);
      const used_price_index = parseNum(r[11]);
      const used_new_spread = parseNum(r[12]);
      const new_price_mom = parseNum(r[3]);
      const used_price_mom = parseNum(r[5]);
      if (new_price_index == null && used_price_index == null && used_new_spread == null && new_price_mom == null && used_price_mom == null) continue;
      rental_car_prices.push({ year: md.year, month: md.month, new_price_index, used_price_index, used_new_spread, new_price_mom, used_price_mom });
    }
    if (rental_car_prices.length) result.rental_car_prices = rental_car_prices;
  }

  // Rental · Peers (CarRental.xlsm · aba Peers)
  // A=data; B:D=preços em BRL (Localiza, Movida, Vamos); F:H=P/E Forward 12M.
  if (parseRental && findSheet('Peers')) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Peers')], { header: 1, raw: true });
    const rental_peers = [];
    for (let i = 4; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const pd = r[0] instanceof Date
        ? { year: r[0].getUTCFullYear(), month: r[0].getUTCMonth() + 1, day: r[0].getUTCDate() }
        : parseDate(r[0]);
      if (!pd) continue;
      const row = {
        year: pd.year, month: pd.month, day: pd.day,
        localiza: parseNum(r[1]), movida: parseNum(r[2]), vamos: parseNum(r[3]),
        localiza_pe: parseNum(r[5]), movida_pe: parseNum(r[6]), vamos_pe: parseNum(r[7]),
      };
      if (Object.entries(row).some(([k, v]) => !['year','month','day'].includes(k) && v != null)) rental_peers.push(row);
    }
    if (rental_peers.length) result.rental_peers = rental_peers;
  }

  // ── BeefBR (abas: BeefBR, SECEX, Abates) ────────────────────────────────────
  if (parseBR && findSheet('BeefBR')) {
    const beefRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BeefBR')], { header: 1, raw: false });
    const beef = [];
    for (let i = 4; i < beefRaw.length; i++) {
      const r = beefRaw[i];
      if (!r || !r[1]) continue;
      const md = parseMonthTag(r[1]);
      if (!md) continue;
      beef.push({
        year: md.year, month: md.month,
        beef_carcass_brl_kg: parseNum(r[3]),
        beef_me_usd_kg:      parseNum(r[4]),
        beef_me_brl_kg:      parseNum(r[5]),
        cattle_brl_arroba:   parseNum(r[6]),
        cattle_brl_kg:       parseNum(r[7]),
        cattle_usd_kg:       parseNum(r[8]),
        px_secex_brl_kg:     parseNum(r[9]),
        spread_mi:           parseNum(r[11]),
        spread_me:           parseNum(r[13]),
        spread_me_usd:       parseNum(r[15]),
        spread_me_mi_pct:    parseNum(r[17]),
        abates_total:        parseNum(r[31]),
        abates_yoy:          parseNum(r[33]),
        abates_femeas:       parseNum(r[34]),
        pct_femeas: (() => { const v = parseNum(r[35]); if (v == null) return null; return v > 1 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 10; })(),
        usdbrl:              parseNum(r[39]),
      });
    }
    result.beef = trimSifLag(trimEmpty(beef), 'abates_total');
  }

  if (parseBR && findSheet('SECEX')) {
    const secexRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('SECEX')], { header: 1, raw: false });
    const secex = [];
    for (let i = 2; i < secexRaw.length; i++) {
      const r = secexRaw[i];
      if (!r || !r[1]) continue;
      const md = parseMonthTag(r[1]);
      if (!md) continue;
      secex.push({
        year: md.year, month: md.month,
        vol_suina_br:    parseNum(r[3]),
        vol_bovina_br:   parseNum(r[4]),
        vol_frango_br:   parseNum(r[5]),
        px_suina_usd:    parseNum(r[7]),
        px_suina_brl:    parseNum(r[8]),
        px_bovina_usd:   parseNum(r[9]),
        px_bovina_brl:   parseNum(r[10]),
        px_frango_usd:   parseNum(r[11]),
        px_frango_brl:   parseNum(r[12]),
        fx:              parseNum(r[14]),
        vol_suina_eua:   parseNum(r[17]),
        vol_bovina_eua:  parseNum(r[18]),
        vol_frango_eua:  parseNum(r[19]),
        px_suina_eua:    parseNum(r[21]),
        px_bovina_eua:   parseNum(r[22]),
        px_frango_eua:   parseNum(r[23]),
      });
    }
    result.secex = trimEmpty(secex);
  }

  if (parseBR && findSheet('Abates')) {
    const abatesRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Abates')], { header: 1, raw: false });
    const abates = [];
    for (let i = 2; i < abatesRaw.length; i++) {
      const r = abatesRaw[i];
      if (!r || !r[1]) continue;
      const md = parseMonthTag(r[1]);
      if (!md) continue;
      abates.push({
        year: md.year, month: md.month,
        bois:        parseNum(r[2]),
        vacas:       parseNum(r[3]),
        novilhos:    parseNum(r[4]),
        novilhas:    parseNum(r[5]),
        vitelos:     parseNum(r[6]),
        total:       parseNum(r[7]),
        pct_bois:    parseNum(r[8]),
        pct_vacas:   parseNum(r[9]),
        pct_novilhos: parseNum(r[10]),
        pct_novilhas: parseNum(r[11]),
        pct_vitelos: parseNum(r[12]),
        peso_total:  parseNum(r[19]),
      });
    }
    result.abates = trimEmpty(abates);
  }

  // ── Dados diários do BeefBR (aba BBG_Dados do BeefBR.xlsm) ──────────────────
  // col D (3) = data · col E (4) = Carne MI BRL/kg · col F (5) = Boi Gordo BRL/@ · col I (8) = Carne MI USD/kg
  if (parseBR && findSheet('BBG_Dados')) {
    const bgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const carne_mi_daily     = [];
    const carne_mi_usd_daily = [];
    const boi_gordo_daily    = [];
    const spread_mi_daily    = [];
    let bgDate = null;
    for (let i = 3; i < bgRaw.length; i++) {
      const r = bgRaw[i];
      if (!r) continue;
      const pd = parseDate(r[3]);
      if (pd) {
        bgDate = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
      } else if (bgDate) {
        bgDate = new Date(bgDate.getTime() + 86400000);
      } else continue;
      const hasAny = r[4] != null || r[5] != null || r[8] != null || r[9] != null;
      if (!hasAny) continue;
      const year = bgDate.getUTCFullYear(), month = bgDate.getUTCMonth() + 1, day = bgDate.getUTCDate();
      const carneMI    = parseNum(r[4]); // col E — Carne MI BRL/kg
      const boiGordo   = parseNum(r[5]); // col F — Boi Gordo BRL/@
      const carneMIUSD = parseNum(r[8]); // col I — Carne MI USD/kg
      const spreadMI   = parseNum(r[9]); // col J — Spread MI BRL/kg
      if (carneMI    != null) carne_mi_daily.push({ year, month, day, value: carneMI });
      if (boiGordo   != null) boi_gordo_daily.push({ year, month, day, value: boiGordo });
      if (carneMIUSD != null) carne_mi_usd_daily.push({ year, month, day, value: carneMIUSD });
      if (spreadMI   != null) spread_mi_daily.push({ year, month, day, value: spreadMI });
    }
    if (carne_mi_daily.length)     result.carne_mi_daily     = carne_mi_daily;
    if (carne_mi_usd_daily.length) result.carne_mi_usd_daily = carne_mi_usd_daily;
    if (boi_gordo_daily.length)    result.boi_gordo_daily    = boi_gordo_daily;
    if (spread_mi_daily.length)    result.spread_mi_daily    = spread_mi_daily;
  }

  // ── BeefUS (abas: BBG_Dados, BeefUS) ────────────────────────────────────────
  // Agregados mensais do BBG_Dados (col E=edgebeef, col F=câmbio): usados no BeefUS
  const bbgEdgebeefByMonth = {};
  const bbgCambioByMonth   = {};
  const bbgLiveCattleSamplesByMonth = {};
  const bbgLiveCattleByMonth = {};
  if (parseUS && findSheet('BBG_Dados')) {
    // Edgebeef diário: col D=data, col E=valor (Edge Beef Margin USD/cwt)
    // Câmbio: col F (índice 5)
    const bbgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    // r[3]=data (Date obj só nas primeiras linhas; resto null por fórmula sem cache)
    // Rastreia data incrementando 1 dia por linha de dados
    const edgebeef_daily = [];
    let curDate = null;
    for (let i = 3; i < bbgRaw.length; i++) {
      const r = bbgRaw[i];
      if (!r) continue;
      const hasData = r[4] != null || r[5] != null || r[6] != null;
      if (!hasData) continue;
      const pd = parseDate(r[3]);
      if (pd) {
        curDate = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
      } else if (curDate) {
        curDate = new Date(curDate.getTime() + 86400000); // +1 dia
      } else continue;
      const year = curDate.getUTCFullYear(), month = curDate.getUTCMonth()+1, day = curDate.getUTCDate();
      // Câmbio (col F = índice 5): último valor do mês prevalece
      const usdbrl = parseNum(r[5]);
      if (usdbrl != null) bbgCambioByMonth[`${year}-${month}`] = usdbrl;
      const liveCattle = parseNum(r[6]);
      if (liveCattle != null) {
        const key = `${year}-${month}`;
        if (!bbgLiveCattleSamplesByMonth[key]) bbgLiveCattleSamplesByMonth[key] = [];
        bbgLiveCattleSamplesByMonth[key].push(liveCattle);
      }

      const value = parseNum(r[4]); // coluna E — EdgeBeef margin
      if (value == null) continue;
      bbgEdgebeefByMonth[`${year}-${month}`] = value; // último valor do mês
      edgebeef_daily.push({ year, month, day, value });
    }
    result.edgebeef_daily = edgebeef_daily;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    for (const [key, values] of Object.entries(bbgLiveCattleSamplesByMonth)) {
      bbgLiveCattleByMonth[key] = key === currentKey
        ? values[values.length - 1]
        : values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }

  // Formula cells can arrive without cached results, so rebuild the USDA
  // aggregates directly from the source sheet.
  const usSlaughterByMonth = {};
  if (parseUS && findSheet('Abates')) {
    const slaughterRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Abates')], { header: 1, raw: true });
    for (let i = 2; i < slaughterRaw.length; i++) {
      const r = slaughterRaw[i];
      if (!r) continue;
      const pd = parseDate(r[1]);
      if (!pd) continue;
      const steers = parseNum(r[2]);
      const heifers = parseNum(r[3]);
      const beefCows = parseNum(r[4]);
      const dairyCows = parseNum(r[5]);
      const bulls = parseNum(r[6]);
      const parts = [steers, heifers, beefCows, dairyCows, bulls];
      if (parts.some(value => value == null)) continue;
      const total = parts.reduce((sum, value) => sum + value, 0);
      const females = heifers + beefCows + dairyCows;
      usSlaughterByMonth[`${pd.year}-${pd.month}`] = {
        total,
        pctFemales: total > 0 ? (females / total) * 100 : null,
      };
    }
  }

  if (parseUS && findSheet('BeefUS')) {
    const usRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BeefUS')], { header: 1, raw: true });

    let femCol = 7, boiCol = 15;
    let femFound = false, boiFound = false;
    for (let i = 0; i < Math.min(50, usRaw.length); i++) {
      const r = usRaw[i];
      if (!r) continue;
      for (let j = 0; j < r.length; j++) {
        const val = String(r[j] || '').toLowerCase().trim();
        const isFemMatch = val.includes('% fêmea') || val.includes('% femea') || val.includes('fêmeas') || val.includes('heifer and cow') || val.includes('pct_femeas') || val.includes('% female') || val === 'femeas' || val.includes('cow slaughter');
        const isBoiMatch = val.includes('boi/bezerro') || val.includes('boi bezerro') || val.includes('steer/calf') || val.includes('steer / calf') || val.includes('steer and calf') || val.includes('steer & calf') || val.includes('boi_bezerro');

        if (isFemMatch && !val.includes('avg') && !val.includes('média')) {
          // Explicitly prefer index 7 (Column H) if it matches
          if (j === 7) {
            femCol = 7;
            femFound = true;
          } else if (!femFound) {
            femCol = j;
            femFound = true;
          }
        }
        if (isBoiMatch && !val.includes('avg') && !val.includes('média')) {
          if (!boiFound) {
            boiCol = j;
            boiFound = true;
          }
        }
      }
    }

    const beef_us = [];
    for (let i = 1; i < usRaw.length; i++) {
      const r = usRaw[i];
      if (!r) continue;
      const pd = parseDate(r[1]);
      if (!pd) continue;
      const year  = pd.year;
      const month = pd.month;
      const pct_femeas       = (() => { const v = parseNum(r[femCol]);  if (v == null) return null; return v > 1 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 10; })();
      const boi_bezerro_mm12 = parseNum(r[boiCol]);
      const abates_total     = (() => { const v = parseNum(r[3]); return v != null ? Math.round(v * 1000) : null; })(); // col D, dado em 000 cabeças → cabeças
      const preco_boi        = parseNum(r[12]);  // col M
      const preco_bezerro    = parseNum(r[13]);  // col N
      const usdbrl           = bbgCambioByMonth[`${year}-${month}`]   ?? null;
      const edgebeef_value   = bbgEdgebeefByMonth[`${year}-${month}`] ?? null;
      beef_us.push({ year, month, pct_femeas, boi_bezerro_mm12, abates_total, preco_boi, preco_bezerro, usdbrl, edgebeef_value, raw: r.slice(0, 20) });
    }

    const cattleRatios = beef_us.map(row => {
      const key = `${row.year}-${row.month}`;
      const slaughter = usSlaughterByMonth[key];
      if (row.pct_femeas == null && slaughter?.pctFemales != null) {
        row.pct_femeas = Math.round(slaughter.pctFemales * 10) / 10;
      }
      if (row.abates_total == null && slaughter?.total != null) {
        row.abates_total = Math.round(slaughter.total * 1000);
      }
      if (row.preco_boi == null && bbgLiveCattleByMonth[key] != null) {
        row.preco_boi = bbgLiveCattleByMonth[key];
      }
      const cachedRatio = parseNum(row.raw?.[14]);
      if (cachedRatio != null) return cachedRatio;
      return row.preco_boi != null && row.preco_bezerro != null && row.preco_bezerro !== 0
        ? row.preco_boi / row.preco_bezerro
        : null;
    });

    // Rebuild the formula in column P when its cached result is unavailable.
    for (let i = 0; i < beef_us.length; i++) {
      if (beef_us[i].boi_bezerro_mm12 != null) continue;
      const window = cattleRatios
        .slice(Math.max(0, i - 11), i + 1)
        .filter(value => value != null && Number.isFinite(value));
      if (window.length === 12) {
        beef_us[i].boi_bezerro_mm12 = window.reduce((sum, value) => sum + value, 0) / window.length;
      }
    }
    result.beef_us = beef_us;
  }

  // ── Production (aba: Production) ─────────────────────────────────────────────
  if (parseUS && findSheet('Production')) {
    const ws   = wb.Sheets[findSheet('Production')];
    const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

    // Months in EN and PT (lowercase) → number
    const ALL_MO = {
      jan:1, fev:2, feb:2, mar:3, abr:4, apr:4, mai:5, may:5, jun:6,
      jul:7, ago:8, aug:8, set:9, sep:9, out:10, oct:10, nov:11, dez:12, dec:12
    };

    // Row 0: "Total Production          dez-25" — extract trailing "mmm-yy" token
    const hdrRow = raw[0] || [];
    const snapshotCols = [];
    for (let c = 2; c < hdrRow.length; c++) {
      const h = String(hdrRow[c] || '').trim();
      const token = h.split(/\s+/).pop() || '';
      const m = token.match(/^([a-z]{3})-(\d{2,4})$/i);
      if (m) {
        const mo = ALL_MO[m[1].toLowerCase()];
        let yr = parseInt(m[2]);
        if (yr < 100) yr += 2000;
        if (mo && yr) snapshotCols.push({ col: c, label: token.toLowerCase(), year: yr, month: mo });
      }
    }

    if (snapshotCols.length >= 1) {
      // Detect forecast via font color (orange = forecast; green = historical)
      // SheetJS stores colors either as direct RGB or as theme index — handle both.
      const isForecastCell = (ri, ci) => {
        try {
          const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
          if (!cell?.s) return null;
          const fc = cell.s.font?.color || {};

          // 1. Direct RGB (stored as AARRGGBB or RRGGBB)
          const rgb = (fc.rgb || '').toUpperCase().replace(/^FF/, '');
          if (rgb) {
            if (['ED7D31','E36C09','FFC000','F79646','E26B0A'].some(c => rgb.startsWith(c))) return true;
            if (['00B050','70AD47','92D050'].some(c => rgb.startsWith(c))) return false;
          }

          // 2. Theme color index (default Office theme, 0-indexed)
          //    theme 5 = Accent2 = Orange #ED7D31 → forecast
          //    theme 9 = Accent6 = Green  #70AD47 → realized
          if (fc.theme !== undefined) {
            if (fc.theme === 5) return true;   // orange
            if (fc.theme === 9) return false;  // green
          }

          // 3. Log unrecognised style for debug (first 60 cells only)
          if (typeof window !== 'undefined') {
            if (!window.COLOR_LOG) window.COLOR_LOG = [];
            if (window.COLOR_LOG.length < 60) window.COLOR_LOG.push({ r: ri, c: ci, v: cell.v, fc: JSON.stringify(fc) });
          }

        } catch (_) {}
        return null;
      };

      // Quarter label: "1Q25", "Q1 25", "1T25", "T1 25", "1Q2025", etc.
      const parseQLabel = s => {
        let m;
        if ((m = s.match(/^([1-4])[QT](\d{2})$/i)))    return { q: +m[1], y: 2000 + +m[2] };
        if ((m = s.match(/^[QT]([1-4])\s*(\d{2})$/i))) return { q: +m[1], y: 2000 + +m[2] };
        if ((m = s.match(/^([1-4])[QT](\d{4})$/i)))    return { q: +m[1], y: +m[2] };
        if ((m = s.match(/^[QT]([1-4])\s*(\d{4})$/i))) return { q: +m[1], y: +m[2] };
        // "Jan-00", "Apr-25" → Q1-Q4 (mês inicial do trimestre)
        if ((m = s.match(/^([a-z]{3})[-/]?(\d{2,4})$/i))) {
          const Q = {jan:1,feb:1,mar:1,apr:2,may:2,jun:2,jul:3,aug:3,sep:3,oct:4,nov:4,dec:4,
                     fev:1,abr:2,mai:2,ago:3,set:3,out:4,dez:4};
          const q = Q[m[1].toLowerCase()];
          let yr = parseInt(m[2]);
          if (yr < 100) yr += 2000;
          if (q) return { q, y: yr };
        }
        return null;
      };

      const bySnapshot = {};

      for (let ri = 2; ri < raw.length; ri++) {
        const row    = raw[ri];
        if (!row) continue;

        let qm = null;
        let qLabel = '';
        // Look for the quarter label in the first 3 columns
        for (let c = 0; c <= 2; c++) {
          qLabel = String(row[c] || '').trim();
          qm = parseQLabel(qLabel);
          if (qm) break;
        }

        if (!qm) continue;
        const quarter = qm.q;
        const year    = qm.y;

        for (const snap of snapshotCols) {
          const v = parseNum(row[snap.col]);

          if (v == null || v <= 0) continue;

          const qEndMonth = quarter * 3;
          const colorFC   = isForecastCell(ri, snap.col);
          // Date fallback: quarter is forecast until the snapshot is at least 3 months
          // after the quarter ends (USDA publishes prior-quarter data with ~1 quarter lag).
          // e.g. Q1 (ends Mar) is still forecast in Apr, May, Jun → only realized from Jul.
          const isForecast = colorFC !== null
            ? colorFC
            : (year > snap.year || (year === snap.year && qEndMonth + 3 >= snap.month));

          if (typeof window !== 'undefined') {
            if (!window.PARSER_LOG) window.PARSER_LOG = [];
            window.PARSER_LOG.push({ snap: snap.label, year, quarter, isForecast });
          }

          if (!bySnapshot[snap.label]) bySnapshot[snap.label] = [];
          bySnapshot[snap.label].push({ year, quarter, value: v, isForecast });
        }
      }

      // Propagate historical values forward: newer snapshots may have formula cells
      // (=adjacent column) whose cache SheetJS can't read, resulting in missing history.
      // Any year/quarter present in snapshot[i-1] but absent in snapshot[i] is copied forward.
      for (let si = 1; si < snapshotCols.length; si++) {
        const curr = snapshotCols[si].label;
        const prev = snapshotCols[si - 1].label;
        if (!bySnapshot[curr] || !bySnapshot[prev]) continue;
        const have = new Set(bySnapshot[curr].map(d => `${d.year}-${d.quarter}`));
        for (const entry of bySnapshot[prev]) {
          if (!have.has(`${entry.year}-${entry.quarter}`)) {
            bySnapshot[curr].push({ year: entry.year, quarter: entry.quarter, value: entry.value, isForecast: entry.isForecast });
          }
        }
      }

      // Only keep snapshots that actually have data
      const snapshots = snapshotCols
        .map(s => s.label)
        .filter(label => bySnapshot[label] && bySnapshot[label].length > 0);

      result.production = { snapshots, bySnapshot };
    }
  }

  // ── Broiler Production (aba: Forecast da FrangoUS.xlsm) ──────────────────────
  if (parsePoultryUS && findSheet('Forecast')) {
    const ws   = wb.Sheets[findSheet('Forecast')];
    const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

    const ALL_MO = {
      jan:1, fev:2, feb:2, mar:3, abr:4, apr:4, mai:5, may:5, jun:6,
      jul:7, ago:8, aug:8, set:9, sep:9, out:10, oct:10, nov:11, dez:12, dec:12,
    };

    const hdrRow = raw[0] || [];
    const snapshotCols = [];
    for (let c = 2; c < hdrRow.length; c++) {
      const h = String(hdrRow[c] || '').trim();
      const token = h.split(/\s+/).pop() || '';
      const m = token.match(/^([a-z]{3})-(\d{2,4})$/i);
      if (m) {
        const mo = ALL_MO[m[1].toLowerCase()];
        let yr = parseInt(m[2]);
        if (yr < 100) yr += 2000;
        if (mo && yr) snapshotCols.push({ col: c, label: token.toLowerCase(), year: yr, month: mo });
      }
    }

    if (snapshotCols.length >= 1) {
      const isForecastCell = (ri, ci) => {
        try {
          const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
          if (!cell?.s) return null;
          const fc = cell.s.font?.color || {};
          const rgb = (fc.rgb || '').toUpperCase().replace(/^FF/, '');
          if (rgb) {
            if (['ED7D31','E36C09','FFC000','F79646','E26B0A'].some(c => rgb.startsWith(c))) return true;
            if (['00B050','70AD47','92D050'].some(c => rgb.startsWith(c))) return false;
          }
          if (fc.theme !== undefined) {
            if (fc.theme === 5) return true;
            if (fc.theme === 9) return false;
          }
        } catch (_) {}
        return null;
      };

      const parseQLabel = s => {
        let m;
        if ((m = s.match(/^([1-4])[QT](\d{2})$/i)))    return { q: +m[1], y: 2000 + +m[2] };
        if ((m = s.match(/^[QT]([1-4])\s*(\d{2})$/i))) return { q: +m[1], y: 2000 + +m[2] };
        if ((m = s.match(/^([1-4])[QT](\d{4})$/i)))    return { q: +m[1], y: +m[2] };
        if ((m = s.match(/^[QT]([1-4])\s*(\d{4})$/i))) return { q: +m[1], y: +m[2] };
        if ((m = s.match(/^([a-z]{3})[-/]?(\d{2,4})$/i))) {
          const Q = {jan:1,feb:1,mar:1,apr:2,may:2,jun:2,jul:3,aug:3,sep:3,oct:4,nov:4,dec:4,
                     fev:1,abr:2,mai:2,ago:3,set:3,out:4,dez:4};
          const q = Q[m[1].toLowerCase()];
          let yr = parseInt(m[2]);
          if (yr < 100) yr += 2000;
          if (q) return { q, y: yr };
        }
        return null;
      };

      const bySnapshot = {};

      for (let ri = 2; ri < raw.length; ri++) {
        const row = raw[ri];
        if (!row) continue;

        let qm = null;
        let qLabel = '';
        for (let c = 0; c <= 2; c++) {
          qLabel = String(row[c] || '').trim();
          qm = parseQLabel(qLabel);
          if (qm) break;
        }

        if (!qm) continue;
        const quarter = qm.q;
        const year    = qm.y;

        for (const snap of snapshotCols) {
          const v = parseNum(row[snap.col]);
          if (v == null || v <= 0) continue;
          const qEndMonth  = quarter * 3;
          const colorFC    = isForecastCell(ri, snap.col);
          const isForecast = colorFC !== null
            ? colorFC
            : (year > snap.year || (year === snap.year && qEndMonth + 3 >= snap.month));
          if (!bySnapshot[snap.label]) bySnapshot[snap.label] = [];
          bySnapshot[snap.label].push({ year, quarter, value: v, isForecast });
        }
      }

      // Same forward propagation for formula cells with empty cache
      for (let si = 1; si < snapshotCols.length; si++) {
        const curr = snapshotCols[si].label;
        const prev = snapshotCols[si - 1].label;
        if (!bySnapshot[curr] || !bySnapshot[prev]) continue;
        const have = new Set(bySnapshot[curr].map(d => `${d.year}-${d.quarter}`));
        for (const entry of bySnapshot[prev]) {
          if (!have.has(`${entry.year}-${entry.quarter}`)) {
            bySnapshot[curr].push({ year: entry.year, quarter: entry.quarter, value: entry.value, isForecast: entry.isForecast });
          }
        }
      }

      const snapshots = snapshotCols
        .map(s => s.label)
        .filter(label => bySnapshot[label] && bySnapshot[label].length > 0);

      result.broiler_production = { snapshots, bySnapshot };
    }
  }

  // ── FrangoUS (BBG_Dados da FrangoUS.xlsm) ────────────────────────────────────
  // cols: D=3(data), E=4(CHICNEBB bb), F=5(CHICNETN tn), G=6(CHICNELQ lq), H=7(CHICNEWI wi)
  // Proxy XPG = (bb*41% + tn*0% + lq*48% + wi*11%) / 100 * 2.20462  → USD/Kg
  if (parsePoultryUS && findSheet('BBG_Dados')) {
    const bbgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const W = 0.022046; // USd/lb → USD/Kg
    const frango_us_daily = [];
    let curDate = null;
    for (let i = 3; i < bbgRaw.length; i++) {
      const r = bbgRaw[i];
      if (!r) continue;
      const pd = parseDate(r[3]);
      if (pd) {
        curDate = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
      } else if (curDate) {
        curDate = new Date(curDate.getTime() + 86400000);
      } else continue;
      const bb    = parseNum(r[4]);
      const tn    = parseNum(r[5]);
      const lq    = parseNum(r[6]);
      const wi    = parseNum(r[7]);
      const ratio = parseNum(r[11]); // col L — Poultry/Beef ratio
      const n     = parseNum(r[13]); // Corn USDc/bu
      const p     = parseNum(r[15]); // Soy  USDc/bu
      const ovos   = parseNum(r[19]); // col T — Ovos Incubados (Bloomberg)
      const hatch  = parseNum(r[20]); // col U — Hatchability (Bloomberg)
      const pinto  = parseNum(r[21]); // col V — Pintos que Eclodiram (Bloomberg)
      const chkPlc = parseNum(r[22]); // col W — Chicks Placed (Bloomberg)
      const mort   = parseNum(r[23]); // col X — Mortality (Bloomberg)
      const abates = parseNum(r[24]); // col Y — Abates de Frango (Bloomberg)
      const peso   = parseNum(r[25]); // col Z — Peso Médio (Bloomberg)
      const prod   = parseNum(r[26]); // col AA — Produção (Bloomberg)
      if (bb == null && tn == null && lq == null && wi == null && ratio == null && n == null && p == null && ovos == null && hatch == null && pinto == null && chkPlc == null && mort == null && abates == null && peso == null && prod == null) continue;
      const year = curDate.getUTCFullYear(), month = curDate.getUTCMonth()+1, day = curDate.getUTCDate();
      const proxy = (bb != null && lq != null && wi != null)
        ? +((bb * 0.41 + lq * 0.48 + wi * 0.11) / 100 * 2.20462).toFixed(4)
        : null;
      // Feed Grain: (65% Corn + 35% Soy) × FCR 1.9, USD/kg
      // USc/bu → USD/kg: × 2.20462 / (100 × bush_lbs)
      const corn_kg    = n != null ? n * 2.20462 / (100 * 56) : null;
      const soy_kg     = p != null ? p * 2.20462 / (100 * 60) : null;
      const feed_grain = (corn_kg != null && soy_kg != null)
        ? +((0.65 * corn_kg + 0.35 * soy_kg) * 1.9).toFixed(4)
        : null;
      const spread = (proxy != null && feed_grain != null) ? +(proxy - feed_grain).toFixed(4) : null;
      frango_us_daily.push({
        year, month, day,
        proxy,
        chic_bb: bb != null ? +(bb * W).toFixed(4) : null,
        chic_tn: tn != null ? +(tn * W).toFixed(4) : null,
        chic_lq: lq != null ? +(lq * W).toFixed(4) : null,
        chic_wi: wi != null ? +(wi * W).toFixed(4) : null,
        feed_grain,
        spread,
        poultry_beef_ratio: ratio,
        ovos_incubados: ovos,
        hatchability: hatch,
        pintos_eclodiram: pinto,
        chicks_placed: chkPlc,
        mortality: mort,
        abates_frango: abates,
        peso_medio: peso,
        producao: prod,
      });
    }
    result.frango_us_daily = frango_us_daily;
  }

  // ── FrangoUS mensal — dados USDA (aba FrangoUS) ──────────────────────────────
  // col Q (16) = Feed Costs per Lb · col R (17) = Composite Wholesale Price · col S (18) = Spread · col T (19) = Broiler Composite · col U (20) = National Composite
  if (parsePoultryUS && findSheet('FrangoUS')) {
    const usdaSheet = wb.Sheets[findSheet('FrangoUS')];
    const usdaRaw   = XLSX.utils.sheet_to_json(usdaSheet, { header: 1, raw: false });
    const usdaRawV  = XLSX.utils.sheet_to_json(usdaSheet, { header: 1, raw: true, defval: null });
    let dataStart = 4;
    for (let i = 2; i < Math.min(10, usdaRaw.length); i++) {
      if (usdaRaw[i] && usdaRaw[i][1] && parseMonthTag(usdaRaw[i][1])) { dataStart = i; break; }
    }

    // Plantel e Produtividade das Matrizes — fórmulas cross-sheet, lê direto da origem
    const plantelMap = {}, produtividadeMap = {}, pintosMap = {};
    if (findSheet('Production')) {
      const prodRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Production')], { header: 1, raw: false, defval: null });
      for (let i = 0; i < prodRaw.length; i++) {
        const r = prodRaw[i];
        if (!r) continue;
        const md = parseMonthTag(r[0]) || parseMonthTag(r[1]);
        if (!md) continue;
        const vc = parseNum(r[2]); // col C — Plantel de Matrizes
        if (vc != null) plantelMap[`${md.year}-${md.month}`] = vc;
        const vd = parseNum(r[3]); // col D — Produtividade das Matrizes
        if (vd != null) produtividadeMap[`${md.year}-${md.month}`] = vd;
        const vg = parseNum(r[6]); // col G — Pintos que Eclodiram
        if (vg != null) pintosMap[`${md.year}-${md.month}`] = vg;
      }
    }

    const frango_us_monthly = [];
    for (let i = dataStart; i < usdaRaw.length; i++) {
      const r = usdaRaw[i];
      if (!r || !r[1]) continue;
      const md = parseMonthTag(r[1]);
      if (!md) continue;
      frango_us_monthly.push({
        year: md.year, month: md.month,
        usda_feed_cost:          parseNum(r[16]),
        usda_wholesale_price:    parseNum(r[17]),
        usda_spread:             parseNum(r[18]),
        usda_broiler_composite:  parseNum(r[19]),  // col T
        national_composite:      parseNum(r[20]),  // col U
        plantel_matrizes:        plantelMap[`${md.year}-${md.month}`]      ?? null,
        produtividade_matrizes:  produtividadeMap[`${md.year}-${md.month}`] ?? null,
        ovos_quebrados:          typeof usdaRawV[i]?.[29] === 'number' ? usdaRawV[i][29] : parseNum(r[29]),  // col AD — raw para preservar decimais
        ovos_incubados:          parseNum(r[30]),  // col AE
        hatchability:            typeof usdaRawV[i]?.[31] === 'number' ? usdaRawV[i][31] : parseNum(r[31]),  // col AF — raw para preservar decimais
        chicks_placed:           parseNum(r[36]),  // col AK
        mortality:               parseNum(r[38]),  // col AM
        abates_frango:           parseNum(r[39]),  // col AN
        peso_medio:              parseNum(r[41]),  // col AP
        producao:                parseNum(r[43]),  // col AR
        pintos_eclodiram:        pintosMap[`${md.year}-${md.month}`] ?? null,
      });
    }
    result.frango_us_monthly = trimEmpty(frango_us_monthly);
  }

  // ── NationalComposite semanal ─────────────────────────────────────────────────
  // Aba 'NationalComposite' da FrangoUS.xlsm:
  //   col A (0) = Trimestre (ignorar), col B (1) = Mês (ignorar)
  //   col C (2) = Dia início da semana · col D (3) = Whole Bird
  //   col E (4) = WOGS · col F (5) = National Composite
  // Dados: 02/09/2022 → 01/05/2026, semanais.
  if (parsePoultryUS && findSheet('NationalComposite')) {
    // raw:true → datas chegam como número serial do Excel; XLSX.SSF converte com dia exato
    const ncRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('NationalComposite')], { header: 1, raw: true });
    const nc_cols = [
      { key: 'nc_w1', label: 'Whole Bird' },
      { key: 'nc_w2', label: 'WOGS' },
      { key: 'nc_w3', label: 'National Composite' },
    ];
    const nc_weekly = [];
    for (let i = 0; i < ncRaw.length; i++) {
      const r = ncRaw[i] || [];
      if (!r[2]) continue;
      const d = parseDate(r[2]);
      // Aceita apenas datas dentro do intervalo esperado (2020-2030)
      if (!d || d.year < 2020 || d.year > 2030) continue;
      const v1 = parseNum(r[3]), v2 = parseNum(r[4]), v3 = parseNum(r[5]);
      if (v1 == null && v2 == null && v3 == null) continue;
      nc_weekly.push({ year: d.year, month: d.month, day: d.day || 1, nc_w1: v1, nc_w2: v2, nc_w3: v3 });
    }
    nc_weekly.sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.day - b.day));
    result.frango_us_nc_weekly = nc_weekly;
    result.frango_us_nc_cols   = nc_cols;
  }

  // ── FrangoBR ─────────────────────────────────────────────────────────────────
  if (findSheet('FrangoBR')) {
    const frangoRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('FrangoBR')], { header: 1, raw: false });

    // Auto-detect column positions by scanning headers in the first 6 rows.
    // Falls back to user-confirmed positions (W=22, X=23) if headers aren't found.
    let colSif = 22, colSidra = 23;
    const SIF_KEYS   = ['sif', 'abate sif', 'abates sif'];
    const SIDRA_KEYS = ['sidra', 'abate sidra', 'abates sidra'];
    for (let hi = 0; hi < Math.min(6, frangoRaw.length); hi++) {
      const hr = frangoRaw[hi] || [];
      for (let c = 0; c < hr.length; c++) {
        const cell = String(hr[c] || '').toLowerCase().trim();
        if (SIF_KEYS.some(k   => cell === k || cell.endsWith(k))) colSif   = c;
        if (SIDRA_KEYS.some(k => cell === k || cell.endsWith(k))) colSidra = c;
      }
    }

    // Chick Placed — lê direto da aba Production (col J = índice 9) porque a col Z
    // do FrangoBR é fórmula cross-sheet sem cache, invisível pro SheetJS.
    // Linha 3 em diante (índice 2); dados reais começam em jan/2009 (linha ~111).
    const chickMap = {};
    if (findSheet('Production')) {
      const prodRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Production')], { header: 1, raw: false });
      for (let i = 2; i < prodRaw.length; i++) {
        const r = prodRaw[i];
        if (!r) continue;
        const md = parseMonthTag(r[0]) || parseMonthTag(r[1]);
        if (!md) continue;
        const v = parseNum(r[9]); // col J
        if (v != null) chickMap[`${md.year}-${md.month}`] = v;
      }
    }

    // Auto-detect data start row: first row (after row 2) where col B parses as a month tag.
    let dataStart = 4;
    for (let i = 2; i < Math.min(10, frangoRaw.length); i++) {
      const r = frangoRaw[i];
      if (r && r[1] && parseMonthTag(r[1])) { dataStart = i; break; }
    }

    const frango = [];
    for (let i = dataStart; i < frangoRaw.length; i++) {
      const r = frangoRaw[i];
      if (!r || !r[1]) continue;
      const md = parseMonthTag(r[1]);
      if (!md) continue;
      frango.push({
        year: md.year, month: md.month,
        feed_grain_brl_kg: parseNum(r[7]),
        frango_mi_brl_kg:  parseNum(r[11]),
        frango_me_brl_kg:  parseNum(r[13]),
        spread_mi:         parseNum(r[14]),
        spread_me:         parseNum(r[16]),
        abates_sif:        parseNum(r[colSif]),
        abates_sidra:      parseNum(r[colSidra]),
        chick_placed:      chickMap[`${md.year}-${md.month}`] ?? null,
      });
    }
    result.frango = trimSifLag(trimEmpty(frango), 'abates_sif');
  }

  // ── Dados diários do FrangoBR (aba BBG_Dados do FrangoBR.xlsm) ─────────────────
  // col D (3) = data · col E (4) = Frango MI BRL/kg · col K (10) = Feed Grain · col L (11) = Spread MI · col M (12) = Porco MI (WPPKHACA Index)
  if (findSheet('FrangoBR') && findSheet('BBG_Dados')) {
    const bgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const frango_mi_daily        = [];
    const feed_grain_daily       = [];
    const frango_spread_mi_daily = [];
    const porco_mi_daily         = [];
    let bgDate = null;
    for (let i = 3; i < bgRaw.length; i++) {
      const r = bgRaw[i];
      if (!r) continue;
      const pd = parseDate(r[3]);
      if (pd) {
        bgDate = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
      } else if (bgDate) {
        bgDate = new Date(bgDate.getTime() + 86400000);
      } else continue;
      const hasAny = r[4] != null || r[10] != null || r[11] != null || r[12] != null;
      if (!hasAny) continue;
      const year = bgDate.getUTCFullYear(), month = bgDate.getUTCMonth() + 1, day = bgDate.getUTCDate();
      const frangoMI  = parseNum(r[4]);   // col E — Frango MI BRL/kg
      const feedGrain = parseNum(r[10]);  // col K — Feed Grain
      const spreadMI  = parseNum(r[11]);  // col L — Spread MI
      const porcoMI   = parseNum(r[12]);  // col M — Porco MI (WPPKHACA Index)
      if (frangoMI  != null) frango_mi_daily.push({ year, month, day, value: frangoMI });
      if (feedGrain != null) feed_grain_daily.push({ year, month, day, value: feedGrain });
      if (spreadMI  != null) frango_spread_mi_daily.push({ year, month, day, value: spreadMI });
      if (porcoMI   != null) porco_mi_daily.push({ year, month, day, value: porcoMI });
    }
    if (frango_mi_daily.length)        result.frango_mi_daily        = frango_mi_daily;
    if (feed_grain_daily.length)       result.feed_grain_daily       = feed_grain_daily;
    if (frango_spread_mi_daily.length) result.frango_spread_mi_daily = frango_spread_mi_daily;
    if (porco_mi_daily.length)         result.porco_mi_daily         = porco_mi_daily;
  }

  // ── Processados (aba Processados · col P = índice 15) ─────────────────────────
  if (findSheet('Processados')) {
    const procRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Processados')], { header: 1, raw: false });
    let procStart = 2;
    for (let i = 1; i < Math.min(10, procRaw.length); i++) {
      const r = procRaw[i];
      if (r && (parseMonthTag(r[1]) || parseMonthTag(r[0]))) { procStart = i; break; }
    }
    const processados = [];
    for (let i = procStart; i < procRaw.length; i++) {
      const r = procRaw[i];
      if (!r) continue;
      const md = parseMonthTag(r[1]) || parseMonthTag(r[0]);
      if (!md) continue;
      const row = {
        year: md.year, month: md.month,
        ipca_base100:    parseNum(r[15]), // col P
        growth_vol_ind:  parseNum(r[17]), // col R — Industry Avg Vol
        growth_px_ind:   parseNum(r[18]), // col S — Industry Avg Px
        growth_vol_brf:  parseNum(r[19]), // col T — BRF Vol
        growth_px_brf:   parseNum(r[20]), // col U — BRF Px
        growth_vol_seara:parseNum(r[21]), // col V — Seara Vol
        growth_px_seara: parseNum(r[22]), // col W — Seara Px
        px_base100_ind:   parseNum(r[24]), // col Y — Industry Avg Px Base 100
        px_base100_brf:   parseNum(r[25]), // col Z  — BRF Px Base 100
        px_base100_seara: parseNum(r[26]), // col AA — Seara Px Base 100
      };
      if (Object.values(row).every((v, i) => i < 2 || v == null)) continue; // skip all-null
      processados.push(row);
    }
    if (processados.length) result.processados = processados;
  }

  // ── SELIC Snapshots (Planilha - Selic.xlsm · aba BBG_Dados) ──────────────────
  // Estrutura: cols A-D = histórico diário/mensal. A partir da col F, blocos de snapshot:
  //   row 1 = nome do snapshot (ex: "abr/26"), row 2 = "CDI" na coluna de valor
  //   data = CDI col - 2, dados a partir da linha 5 (index 4)
  // Histórico: col C (idx 2) = mês, col D (idx 3) = Selic % mensal
  if (parseSelic && findSheet('BBG_Dados')) {
    const bgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const MO_ABR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

    // Auto-detecção dos blocos de snapshot via headers
    const row0 = bgRaw[0] || [];
    const row1 = bgRaw[1] || [];
    const snapshotDefs = [];
    for (let c = 0; c < row0.length; c++) {
      const cell = row0[c];
      // "abr/26" pode estar armazenada como data Excel → Date object com cellDates:true
      let tag = null;
      if (cell instanceof Date) {
        tag = { year: cell.getUTCFullYear(), month: cell.getUTCMonth() + 1 };
      } else if (typeof cell === 'number' && cell > 20000) {
        try { const p = XLSX.SSF.parse_date_code(cell); if (p) tag = { year: p.y, month: p.m }; } catch(_) {}
      } else {
        tag = parseMonthTag(String(cell || '').trim());
      }
      if (!tag) continue;
      // Procura "CDI" nas próximas 5 colunas (row 2)
      let cdiCol = -1;
      for (let dc = 0; dc <= 5; dc++) {
        if (String(row1[c + dc] || '').trim().toLowerCase() === 'cdi') { cdiCol = c + dc; break; }
      }
      if (cdiCol < 0) continue;
      const label = `${MO_ABR[tag.month - 1]}-${String(tag.year).slice(2)}`;
      snapshotDefs.push({ label, year: tag.year, month: tag.month, fDateCol: cdiCol - 2, fValueCol: cdiCol });
    }

    // Histórico mensal: col C (idx 2) = datas, col D (idx 3) = Selic %
    const histMap = {};
    for (let i = 4; i < bgRaw.length; i++) {
      const r = bgRaw[i];
      if (!r) continue;
      const pd = parseDate(r[2]);
      if (!pd) continue;
      const val = parseNum(r[3]);
      if (val == null) continue;
      histMap[`${pd.year}-${pd.month}`] = { year: pd.year, month: pd.month, value: val };
    }

    const bySnapshot = {};
    const snapshots  = [];
    // Snapshot mais recente: pode mostrar histórico além da sua data (ex: jun/26 num snapshot de mai/26)
    const maxSnapOrd = Math.max(...snapshotDefs.map(s => s.year * 12 + s.month));

    for (const snap of snapshotDefs) {
      const snapOrd  = snap.year * 12 + snap.month;
      const isLatest = snapOrd === maxSnapOrd;
      const entries  = [];

      // Histórico: snapshots antigos cortam em snapOrd; o mais recente inclui todo o histMap
      for (const e of Object.values(histMap)) {
        const ord = e.year * 12 + e.month;
        if (isLatest || ord <= snapOrd)
          entries.push({ year: e.year, month: e.month, value: e.value, isForecast: false });
      }

      // Forecast: pula meses já no histMap (latest) ou já no histórico (outros)
      for (let i = 4; i < bgRaw.length; i++) {
        const r = bgRaw[i];
        if (!r) continue;
        const pd = parseDate(r[snap.fDateCol]);
        if (!pd) continue;
        const val = parseNum(r[snap.fValueCol]);
        if (val == null) continue;
        const ord = pd.year * 12 + pd.month;
        const skip = isLatest
          ? histMap[`${pd.year}-${pd.month}`] != null  // já tem dado real
          : ord <= snapOrd;                             // dentro do histórico
        if (skip) continue;
        entries.push({ year: pd.year, month: pd.month, value: val, isForecast: true });
      }

      entries.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      if (entries.length > 0) { bySnapshot[snap.label] = entries; snapshots.push(snap.label); }
    }
    if (snapshots.length > 0) result.selic_snapshots = { snapshots, bySnapshot };
  }

  // ── WEG · Transformadores (WEG - Setorial.xlsm · aba Transformadores) ─────────
  // Série mensal contínua. Coluna C (idx 2) = preço; linha 5 (idx 4) = jan/2000.
  // O mês é derivado da posição da linha (1 mês por linha a partir de jan/2000).
  if (findSheet('Transformadores')) {
    const tRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Transformadores')], { header: 1, raw: true });
    const weg_transformadores = [];
    for (let i = 4; i < tRaw.length; i++) {
      const r = tRaw[i];
      const val = r ? parseNum(r[2]) : null; // col C
      if (val == null) continue;
      const off   = i - 4;                    // 0 = jan/2000
      const year  = 2000 + Math.floor(off / 12);
      const month = (off % 12) + 1;
      weg_transformadores.push({ year, month, value: val });
    }
    if (weg_transformadores.length) result.weg_transformadores = weg_transformadores;

    const header3 = tRaw[2] || [];
    const oldStateLayout = String(header3[7] || '').toLowerCase().includes('minas');
    const transformerExportCols = oldStateLayout
      ? [
          ['850421', 5, 6], ['850422', 9, 10], ['850423', 13, 14], ['850431', 17, 18],
          ['850432', 21, 22], ['850433', 25, 26], ['850434', 29, 30], ['850490', 33, 34],
        ]
      : [
          ['850421', 5, 6], ['850422', 7, 8], ['850423', 9, 10], ['850431', 11, 12],
          ['850432', 13, 14], ['850433', 15, 16], ['850434', 17, 18], ['850490', 19, 20],
        ];
    const weg_transformadores_exports = [];
    for (let i = 4; i < tRaw.length; i++) {
      const r = tRaw[i];
      if (!r) continue;
      const md = parseDate(r[1]) || parseMonthTag(r[1]);
      const off = i - 4;
      const year = md?.year ?? 2000 + Math.floor(off / 12);
      const month = md?.month ?? (off % 12) + 1;
      const row = { year, month };
      for (const [code, brCol, scCol] of transformerExportCols) {
        row[`br_${code}`] = parseNum(r[brCol]);
        row[`sc_${code}`] = parseNum(r[scCol]);
      }
      if (Object.entries(row).some(([key, value]) => !['year','month'].includes(key) && value != null)) {
        weg_transformadores_exports.push(row);
      }
    }
    if (weg_transformadores_exports.length) result.weg_transformadores_exports = weg_transformadores_exports;

    // Preço SECEX (col W, idx 22): US$/unid, Transformadores Dielétricos
    // Líquido > 10.000 kVA. Só existe no layout novo — no antigo, o idx 22
    // é coluna de exportação (sc_850432).
    if (!oldStateLayout) {
      const weg_transformadores_secex_price = [];
      for (let i = 4; i < tRaw.length; i++) {
        const r = tRaw[i];
        if (!r) continue;
        const val = parseNum(r[22]);
        if (val == null) continue;
        const md = parseDate(r[1]) || parseMonthTag(r[1]);
        const off = i - 4;
        const year = md?.year ?? 2000 + Math.floor(off / 12);
        const month = md?.month ?? (off % 12) + 1;
        if (year === 2016 && month === 10) continue;
        weg_transformadores_secex_price.push({ year, month, value: val });
      }
      if (weg_transformadores_secex_price.length) result.weg_transformadores_secex_price = weg_transformadores_secex_price;

      const weg_transformadores_secex_units = [];
      for (let i = 4; i < tRaw.length; i++) {
        const r = tRaw[i];
        if (!r) continue;
        const val = parseNum(r[23]);
        if (val == null) continue;
        const md = parseDate(r[1]) || parseMonthTag(r[1]);
        const off = i - 4;
        const year = md?.year ?? 2000 + Math.floor(off / 12);
        const month = md?.month ?? (off % 12) + 1;
        if (year === 2016 && month === 10) continue;
        weg_transformadores_secex_units.push({ year, month, value: val });
      }
      if (weg_transformadores_secex_units.length) result.weg_transformadores_secex_units = weg_transformadores_secex_units;
    }
  }

  // ── WEG · Peers (WEG - Setorial.xlsm · aba Peers) ────────────────────────────
  // Preços diários das ações (USD). Colunas F..O (idx 5..14):
  //   F=WEG G=ABB H=Nidec I=Regal Rexnord J=Eaton K=Siemens L=Schneider
  //   M=GE Vernova N=Hitachi O=Hyosung. A coluna de data é autodetectada (A..E).
  // WEG · EIE (WEG - Setorial.xlsm · aba Motores)
  if (findSheet('Motores')) {
    const mRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Motores')], { header: 1, raw: true });
    const motorExportCols = [
      ['850120', 3, 4], ['850131', 5, 6], ['850132', 7, 8], ['850133', 9, 10], ['850134', 11, 12],
      ['850140', 13, 14], ['850151', 15, 16], ['850152', 17, 18], ['850153', 19, 20],
      ['850440', 22, 23], ['850450', 24, 25], ['853620', 26, 27], ['853521', 28, 29], ['853641', 30, 31],
      ['853649', 32, 33], ['853650', 34, 35], ['853690', 36, 37], ['853710', 38, 39], ['853720', 40, 41],
    ];
    const weg_eie_exports = [];
    for (let i = 4; i < mRaw.length; i++) {
      const r = mRaw[i];
      if (!r) continue;
      const md = parseDate(r[1]) || parseMonthTag(r[1]);
      const off = i - 4;
      const year = md?.year ?? 2000 + Math.floor(off / 12);
      const month = md?.month ?? (off % 12) + 1;
      const row = { year, month };
      for (const [code, brCol, scCol] of motorExportCols) {
        row[`br_${code}`] = parseNum(r[brCol]);
        row[`sc_${code}`] = parseNum(r[scCol]);
      }
      if (Object.entries(row).some(([key, value]) => !['year','month'].includes(key) && value != null)) {
        weg_eie_exports.push(row);
      }
    }
    if (weg_eie_exports.length) result.weg_eie_exports = weg_eie_exports;
  }

  if (!parseRental && findSheet('Peers')) {
    const pRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('Peers')], { header: 1, raw: true });
    // Preço: F..O (5..14). P/E: Q..Z (16..25). Mesma ordem de empresas.
    const PEER_COLS = {
      weg: 5, abb: 6, nidec: 7, regal: 8, eaton: 9,
      siemens: 10, schneider: 11, gevernova: 12, hitachi: 13, hyosung: 14,
      weg_pe: 16, abb_pe: 17, nidec_pe: 18, regal_pe: 19, eaton_pe: 20,
      siemens_pe: 21, schneider_pe: 22, gevernova_pe: 23, hitachi_pe: 24, hyosung_pe: 25,
    };
    // Autodetecta a coluna de data entre A..E (a que mais parseia como data)
    let dateCol = -1, bestHits = 0;
    for (let c = 0; c <= 4; c++) {
      let hits = 0;
      for (let i = 1; i < Math.min(pRaw.length, 60); i++) {
        if (pRaw[i] && parseDate(pRaw[i][c])) hits++;
      }
      if (hits > bestHits) { bestHits = hits; dateCol = c; }
    }
    const weg_peers = [];
    if (dateCol >= 0) {
      for (let i = 1; i < pRaw.length; i++) {
        const r = pRaw[i];
        if (!r) continue;
        const pd = parseDate(r[dateCol]);
        if (!pd) continue;
        const row = { year: pd.year, month: pd.month, day: pd.day };
        let hasAny = false;
        for (const [key, col] of Object.entries(PEER_COLS)) {
          const v = parseNum(r[col]);
          if (v != null) { row[key] = v; hasAny = true; }
        }
        if (hasAny) weg_peers.push(row);
      }
    }
    if (weg_peers.length) {
      weg_peers.sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day);
      result.weg_peers = weg_peers;
    }
  }

  if (Object.keys(result).length === 0) throw new Error(`Nenhuma aba reconhecida. Abas encontradas: ${sheets.join(', ')}`);
  return result;
}
