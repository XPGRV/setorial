import React from 'react'

// Parse a workbook (ArrayBuffer) into the {beef, secex, abates} shape
// Assumes SheetJS (XLSX) is loaded globally

function parseNum(v) {
  if (v == null || v === '' || v === 'Sem Dados' || v === '-') return null;
  const s = String(v).replace(/,/g, '').replace(/\s/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function parseMonthTag(s) {
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

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return { year: v.getFullYear(), month: v.getMonth()+1, day: v.getDate() };
  if (typeof v === 'string') {
    const tag = parseMonthTag(v);
    if (tag) return { year: tag.year, month: tag.month, day: 1 };
    const d = new Date(v);
    if (!isNaN(d)) return { year: d.getUTCFullYear(), month: d.getUTCMonth()+1, day: d.getUTCDate() };
  }
  if (typeof v === 'number' && v > 20000) {
    if (window.XLSX && window.XLSX.SSF) {
      try { const p = XLSX.SSF.parse_date_code(v); if (p) return { year: p.y, month: p.m, day: p.d }; } catch(_) {}
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

async function parseWorkbook(arrayBuffer, { parseBR = true, parseUS = true, parsePoultryUS = false, parseSelic = false } = {}) {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellStyles: true });
  const sheets = wb.SheetNames;
  // Case-insensitive sheet lookup
  const findSheet = name => sheets.find(s => s.toLowerCase() === name.toLowerCase()) || null;
  const result = {};

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
      const value = parseNum(r[4]); // coluna E — EdgeBeef margin
      if (value == null) continue;
      bbgEdgebeefByMonth[`${year}-${month}`] = value; // último valor do mês
      edgebeef_daily.push({ year, month, day, value });
    }
    result.edgebeef_daily = edgebeef_daily;
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
          if (!window.COLOR_LOG) window.COLOR_LOG = [];
          if (window.COLOR_LOG.length < 60) window.COLOR_LOG.push({ r: ri, c: ci, v: cell.v, fc: JSON.stringify(fc) });

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

          if (!window.PARSER_LOG) window.PARSER_LOG = [];
          window.PARSER_LOG.push({ snap: snap.label, year, quarter, isForecast });

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
  // col D (3) = data · col E (4) = Frango MI BRL/kg · col K (10) = Feed Grain · col L (11) = Spread MI
  if (findSheet('FrangoBR') && findSheet('BBG_Dados')) {
    const bgRaw = XLSX.utils.sheet_to_json(wb.Sheets[findSheet('BBG_Dados')], { header: 1, raw: true });
    const frango_mi_daily        = [];
    const feed_grain_daily       = [];
    const frango_spread_mi_daily = [];
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
      const hasAny = r[4] != null || r[10] != null || r[11] != null;
      if (!hasAny) continue;
      const year = bgDate.getUTCFullYear(), month = bgDate.getUTCMonth() + 1, day = bgDate.getUTCDate();
      const frangoMI  = parseNum(r[4]);   // col E — Frango MI BRL/kg
      const feedGrain = parseNum(r[10]);  // col K — Feed Grain
      const spreadMI  = parseNum(r[11]);  // col L — Spread MI
      if (frangoMI  != null) frango_mi_daily.push({ year, month, day, value: frangoMI });
      if (feedGrain != null) feed_grain_daily.push({ year, month, day, value: feedGrain });
      if (spreadMI  != null) frango_spread_mi_daily.push({ year, month, day, value: spreadMI });
    }
    if (frango_mi_daily.length)        result.frango_mi_daily        = frango_mi_daily;
    if (feed_grain_daily.length)       result.feed_grain_daily       = feed_grain_daily;
    if (frango_spread_mi_daily.length) result.frango_spread_mi_daily = frango_spread_mi_daily;
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
    console.log('[SELIC] row0:', JSON.stringify(row0));
    console.log('[SELIC] row1:', JSON.stringify(row1));
    const snapshotDefs = [];
    for (let c = 0; c < row0.length; c++) {
      const tag = parseMonthTag(String(row0[c] || '').trim());
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
    for (const snap of snapshotDefs) {
      const snapOrd = snap.year * 12 + snap.month;
      const cutOrd  = snapOrd - 6;
      const entries = [];

      // 6 meses de histórico antes do snapshot (linha sólida)
      for (const e of Object.values(histMap)) {
        const ord = e.year * 12 + e.month;
        if (ord >= cutOrd && ord <= snapOrd)
          entries.push({ year: e.year, month: e.month, value: e.value, isForecast: false });
      }

      // Forecast: CDI da snapshot, linhas 5+ (idx 4+), datas após o mês da snapshot (pontilhado)
      for (let i = 4; i < bgRaw.length; i++) {
        const r = bgRaw[i];
        if (!r) continue;
        const pd = parseDate(r[snap.fDateCol]);
        if (!pd) continue;
        const val = parseNum(r[snap.fValueCol]);
        if (val == null) continue;
        const ord = pd.year * 12 + pd.month;
        if (ord <= snapOrd) continue; // mês da snapshot já coberto pelo histórico
        entries.push({ year: pd.year, month: pd.month, value: val, isForecast: true });
      }

      entries.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      if (entries.length > 0) { bySnapshot[snap.label] = entries; snapshots.push(snap.label); }
    }
    if (snapshots.length > 0) result.selic_snapshots = { snapshots, bySnapshot };
  }

  if (Object.keys(result).length === 0) throw new Error(`Nenhuma aba reconhecida. Abas encontradas: ${sheets.join(', ')}`);
  return result;
}

// Upload widget component
const UploadWidget = ({ onLoad, lastUpdate, currentSource }) => {
  const [status, setStatus] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus({ kind: 'loading', msg: 'Processando ' + file.name + '…' });
    try {
      const ab = await file.arrayBuffer();
      // Detecção pelo nome do arquivo para evitar ler abas erradas
      // (BeefBR.xlsm também tem BBG_Dados mas não deve atualizar o BeefUS)
      const nameLC       = file.name.toLowerCase();
      const forceUS        = nameLC.includes('beefus');
      const forcePoultryBR = nameLC.includes('frango') && !nameLC.includes('us');
      const forcePoultryUS = nameLC.includes('frangous') || (nameLC.includes('frango') && nameLC.includes('us'));
      const forcePoultry   = forcePoultryBR || forcePoultryUS;
      const forceSelic     = nameLC.includes('selic');
      const parsed = await parseWorkbook(ab, { parseBR: !forceUS && !forcePoultry && !forceSelic, parseUS: forceUS, parsePoultryUS: forcePoultryUS, parseSelic: forceSelic });

      // Mescla com dados existentes para preservar beef_us / edgebeef_daily
      const fullData = { ...(window.__dashboardData || {}), ...parsed };
      window.__dashboardData = fullData;

      // Meta separado por planilha — não sobrescreve o log da outra aba
      const metaEntry = { source: file.name, updated: new Date().toISOString() };
      const metaKey   = forceSelic ? 'selic' : forceUS ? 'us' : forcePoultryUS ? 'poultry_us' : forcePoultryBR ? 'poultry_br' : 'br';
      const prevMeta  = window.__dashboardMeta || {};
      const fullMeta  = { ...prevMeta, [metaKey]: metaEntry };
      window.__dashboardMeta = fullMeta;

      // 1. Salva localmente
      try {
        localStorage.setItem('dashboard_data', JSON.stringify(fullData));
        localStorage.setItem('dashboard_meta', JSON.stringify(fullMeta));
        localStorage.setItem('dashboard_version', '5');
      } catch (_) {}

      // 2. Sobe para Supabase Storage
      setStatus({ kind: 'loading', msg: '☁ Salvando na nuvem…' });
      let cloudOk = false;
      try {
        const payload = JSON.stringify({ data: fullData, meta: fullMeta });
        const res = await fetch(
          `${window.__SB_URL}/storage/v1/object/dashboard/data.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${window.__SB_KEY}`,
              'Content-Type': 'application/json',
              'x-upsert': 'true',
            },
            body: payload,
          }
        );
        cloudOk = res.ok;
        if (!res.ok) console.warn('Supabase upload HTTP', res.status, await res.text());
      } catch (e) {
        console.warn('Supabase upload falhou:', e);
      }

      onLoad(fullData, fullMeta);
      const parts = [];
      if (parsed.beef)           parts.push(`${parsed.beef.length}L BeefBR`);
      if (parsed.secex)          parts.push(`${parsed.secex.length} SECEX`);
      if (parsed.abates)         parts.push(`${parsed.abates.length} Abates`);
      if (parsed.carne_mi_daily)   parts.push(`${parsed.carne_mi_daily.length} Carne MI diário`);
      if (parsed.spread_mi_daily)  parts.push(`${parsed.spread_mi_daily.length} Spread MI diário`);
      if (parsed.boi_gordo_daily) parts.push(`${parsed.boi_gordo_daily.length} Boi Gordo diário`);
      if (parsed.edgebeef_daily) parts.push(`${parsed.edgebeef_daily.length} Edgebeef diário`);
      if (parsed.beef_us)        parts.push(`${parsed.beef_us.length}L BeefUS`);
      if (parsed.production)          parts.push(`${parsed.production.snapshots.length} snapshots Produção`);
      if (parsed.broiler_production)  parts.push(`${parsed.broiler_production.snapshots.length} snapshots Broiler`);
      if (parsed.frango_us_daily)   parts.push(`${parsed.frango_us_daily.length} FrangoUS diário`);
      if (parsed.frango_us_monthly) parts.push(`${parsed.frango_us_monthly.length}L FrangoUS USDA`);
      if (parsed.frango)                parts.push(`${parsed.frango.length}L FrangoBR`);
      if (parsed.frango_mi_daily)       parts.push(`${parsed.frango_mi_daily.length} Frango MI diário`);
      if (parsed.feed_grain_daily)      parts.push(`${parsed.feed_grain_daily.length} Feed Grain diário`);
      if (parsed.frango_spread_mi_daily) parts.push(`${parsed.frango_spread_mi_daily.length} Spread MI diário`);
      if (parsed.selic_snapshots) parts.push(`${parsed.selic_snapshots.snapshots.length} snapshots SELIC`);
      const cloudBadge = cloudOk ? ' · ☁ nuvem atualizada' : ' · ⚠ nuvem offline';
      setStatus({ kind: 'ok', msg: `✓ ${parts.join(' · ')}${cloudBadge}` });
      setTimeout(() => setStatus(null), 5000);
    } catch (e) {
      console.error(e);
      setStatus({ kind: 'err', msg: 'Erro: ' + (e.message || 'falha ao ler planilha') });
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div className={`upload-widget ${dragging ? 'is-drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm"
        style={{display:'none'}}
        onChange={e => handleFile(e.target.files[0])}
      />
      <button className="upload-btn" onClick={() => inputRef.current.click()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7,2 L7,10 M3,6 L7,2 L11,6 M2,12 L12,12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        <span>Atualizar planilha</span>
      </button>
      <div className="upload-meta">
        {status ? (
          <span className={`upload-status is-${status.kind}`}>{status.msg}</span>
        ) : lastUpdate ? (
          <span className="upload-last">
            <span className="upload-last-src">{currentSource || 'planilha'}</span>
            <span className="upload-last-time">· atualizado {formatRelative(lastUpdate)}</span>
          </span>
        ) : (
          <span className="upload-hint">ou arraste o .xlsx aqui</span>
        )}
      </div>
    </div>
  );
};

function formatRelative(iso) {
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff/60) + ' min atrás';
    if (diff < 86400) return Math.floor(diff/3600) + ' h atrás';
    const days = Math.floor(diff/86400);
    if (days < 30) return days + ' d atrás';
    return d.toLocaleDateString('pt-BR');
  } catch { return ''; }
}

const META_LABELS = { br: 'BeefBR', us: 'BeefUS', poultry_br: 'FrangoBR', poultry_us: 'FrangoUS' };

const SidebarUpload = ({ onLoad }) => {
  const [status, setStatus] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef(null);

  const processFiles = async (fileList) => {
    const files = Array.from(fileList).filter(f => /\.(xlsx|xls|xlsm)$/i.test(f.name));
    if (!files.length) return;

    let fullData = { ...(window.__dashboardData || {}) };
    let fullMeta = { ...(window.__dashboardMeta || {}) };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const label = files.length > 1 ? `${i + 1}/${files.length} · ${file.name}` : file.name;
        setStatus({ kind: 'loading', msg: label });

        const ab = await file.arrayBuffer();
        const nameLC = file.name.toLowerCase();
        const forceUS        = nameLC.includes('beefus');
        const forcePoultryBR = nameLC.includes('frango') && !nameLC.includes('us');
        const forcePoultryUS = nameLC.includes('frangous') || (nameLC.includes('frango') && nameLC.includes('us'));
        const forcePoultry   = forcePoultryBR || forcePoultryUS;
        const forceSelic     = nameLC.includes('selic');
        const parsed = await parseWorkbook(ab, {
          parseBR: !forceUS && !forcePoultry && !forceSelic,
          parseUS: forceUS,
          parsePoultryUS: forcePoultryUS,
          parseSelic: forceSelic,
        });
        fullData = { ...fullData, ...parsed };
        const metaKey = forceSelic ? 'selic' : forceUS ? 'us' : forcePoultryUS ? 'poultry_us' : forcePoultryBR ? 'poultry_br' : 'br';
        fullMeta = { ...fullMeta, [metaKey]: { source: file.name, updated: new Date().toISOString() } };
      }

      window.__dashboardData = fullData;
      window.__dashboardMeta = fullMeta;

      try {
        localStorage.setItem('dashboard_data', JSON.stringify(fullData));
        localStorage.setItem('dashboard_meta', JSON.stringify(fullMeta));
        localStorage.setItem('dashboard_version', '5');
      } catch (_) {}

      setStatus({ kind: 'loading', msg: '☁ Salvando na nuvem…' });
      let cloudOk = false;
      try {
        const payload = JSON.stringify({ data: fullData, meta: fullMeta });
        const res = await fetch(
          `${window.__SB_URL}/storage/v1/object/dashboard/data.json`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${window.__SB_KEY}`, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: payload }
        );
        cloudOk = res.ok;
        if (!res.ok) console.warn('Supabase upload HTTP', res.status, await res.text());
      } catch (e) {
        console.warn('Supabase upload falhou:', e);
      }

      onLoad(fullData, fullMeta);
      const tabs = Object.keys(fullMeta).map(k => META_LABELS[k]).filter(Boolean).join(' · ');
      setStatus({ kind: 'ok', msg: `✓ ${tabs} · ${cloudOk ? '☁ ok' : '⚠ offline'}` });
      setTimeout(() => setStatus(null), 5000);
    } catch (e) {
      console.error(e);
      setStatus({ kind: 'err', msg: 'Erro: ' + (e.message || 'falha ao ler planilha') });
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`sidebar-upload-zone${dragging ? ' is-drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm"
        multiple
        style={{ display: 'none' }}
        onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
      />
      <button className="sidebar-upload-btn" onClick={() => inputRef.current.click()}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 2v8M4 5l3.5-3.5L11 5M2 13h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Atualizar planilhas</span>
      </button>
      {status && (
        <div className="sidebar-upload-hint">
          <span className={`upload-status is-${status.kind}`}>{status.msg}</span>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { parseWorkbook, UploadWidget, SidebarUpload });
