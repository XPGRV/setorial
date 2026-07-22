function rows(data, key) {
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function countField(data, key, field) {
  return rows(data, key).filter(row => row?.[field] != null).length;
}

function countAny(data, key, fields) {
  return rows(data, key).filter(row =>
    fields.some(field => row?.[field] != null)
  ).length;
}

function countSnapshotPoints(data, key) {
  const source = data?.[key];
  if (!source?.bySnapshot) return 0;
  return Object.values(source.bySnapshot).reduce((sum, entries) =>
    sum + (Array.isArray(entries) ? entries.length : 0), 0);
}

function fail(message) {
  return { ok: false, message };
}

function pass() {
  return { ok: true, message: null };
}

const CHECKS = {
  beef_br: [
    { label: 'Preco carne BR', min: 24, count: data => countField(data, 'beef', 'beef_carcass_brl_kg') },
    { label: 'Boi gordo BR', min: 24, count: data => countField(data, 'beef', 'cattle_brl_arroba') },
    { label: 'Spread Beef BR', min: 24, count: data => countField(data, 'beef', 'spread_mi') },
    { label: 'SECEX Beef BR', min: 24, count: data => countAny(data, 'secex', ['vol_bovina_br', 'px_bovina_brl', 'vol_frango_br']) },
    { label: 'Abates Beef BR', min: 24, count: data => countField(data, 'abates', 'total') },
    { label: 'BBG Beef BR diario', min: 20, count: data => countField(data, 'boi_gordo_daily', 'value') },
  ],
  beef_us: [
    { label: 'Pct femeas Beef US', min: 24, count: data => countField(data, 'beef_us', 'pct_femeas') },
    { label: 'Boi/Bezerro Beef US', min: 12, count: data => countField(data, 'beef_us', 'boi_bezerro_mm12') },
    { label: 'EdgeBeef', min: 20, count: data => countField(data, 'edgebeef_daily', 'value') },
  ],
  poultry_br: [
    { label: 'Frango MI BR', min: 24, count: data => countField(data, 'frango', 'frango_mi_brl_kg') },
    { label: 'Feed Grain BR', min: 24, count: data => countField(data, 'frango', 'feed_grain_brl_kg') },
    { label: 'Spread Frango BR', min: 24, count: data => countField(data, 'frango', 'spread_mi') },
    { label: 'Processados', min: 24, count: data => countAny(data, 'processados', ['ipca_base100', 'growth_vol_ind', 'px_base100_ind']) },
  ],
  poultry_us: [
    { label: 'Poultry US preco', min: 20, count: data => countField(data, 'frango_us_daily', 'proxy') },
    { label: 'Poultry US feed grain', min: 20, count: data => countField(data, 'frango_us_daily', 'feed_grain') },
    { label: 'Poultry US spread', min: 20, count: data => countField(data, 'frango_us_daily', 'spread') },
    { label: 'Poultry US mensal', min: 12, count: data => countAny(data, 'frango_us_monthly', ['chicks_placed', 'abates_frango', 'producao']) },
  ],
  macro: [
    { label: 'CDI/SELIC', min: 24, count: data => countSnapshotPoints(data, 'selic_snapshots') },
  ],
  weg: [
    { label: 'Preco Transformadores', min: 24, count: data => countField(data, 'weg_transformadores', 'value') },
    { label: 'Exportacoes Transformadores', min: 24, count: data => countAny(data, 'weg_transformadores_exports', ['br_850421', 'br_850422', 'br_850423', 'br_850431', 'br_850432', 'br_850433', 'br_850434', 'br_850490']) },
    { label: 'Exportacoes EIE', min: 24, count: data => countAny(data, 'weg_eie_exports', ['br_850120', 'br_850131', 'br_850132', 'br_850440', 'br_853710']) },
    { label: 'Peers WEG', min: 20, count: data => countAny(data, 'weg_peers', ['weg', 'abb', 'eaton', 'siemens']) },
  ],
  rental: [
    { label: 'Preco carro novo', min: 24, count: data => countField(data, 'rental_car_prices', 'new_price_index') },
    { label: 'Preco carro usado', min: 24, count: data => countField(data, 'rental_car_prices', 'used_price_index') },
    { label: 'Spread usado/novo', min: 24, count: data => countField(data, 'rental_car_prices', 'used_new_spread') },
    { label: 'Peers Rental', min: 20, count: data => countAny(data, 'rental_peers', ['localiza', 'movida', 'vamos']) },
  ],
  transportes: [
    { label: 'Fretes', min: 12, count: data => countAny(data, 'transport_freights', ['sorriso_santos', 'rondonopolis_santos', 'sorriso_rondonopolis']) },
    { label: 'Graos SECEX', min: 24, count: data => countAny(data, 'transport_grains', ['soy_volume_kt', 'soy_mt_volume_kt', 'corn_volume_kt', 'corn_mt_volume_kt']) },
  ],
  agro: [
    { label: 'Cotton CBOT diario', min: 20, count: data => countAny(data, 'agro_cotton_daily', ['cbot_usd', 'cbot_brl']) },
    { label: 'Cotton Barreiras diario', min: 20, count: data => countAny(data, 'agro_cotton_daily', ['barreiras_usd', 'barreiras_brl']) },
    { label: 'Soja diario', min: 20, count: data => countAny(data, 'agro_soy_daily', ['cbot_usd_bu', 'paranagua_usd_bu', 'sorriso_usd_bu']) },
  ],
};

export function validateDashboardPayload(dataset, parsed) {
  const checks = CHECKS[dataset];
  if (!checks) return pass();

  const failures = [];
  for (const check of checks) {
    const points = check.count(parsed);
    if (points < check.min) failures.push(`${check.label}: ${points}/${check.min} pontos`);
  }

  if (failures.length) {
    return fail(`${dataset} com series criticas vazias ou incompletas (${failures.join('; ')}); upload anterior preservado.`);
  }
  return pass();
}
