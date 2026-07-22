const SB_URL = process.env.SUPABASE_URL || 'https://wmxjdveucxbousoquwmc.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;

// Um arquivo por planilha no Storage. O data.json combinado fica como fallback
// de leitura para datasets que ainda nao foram atualizados no novo formato.
const DATASET_OBJECTS = {
  beef_br: 'data-beef_br.json',
  beef_us: 'data-beef_us.json',
  poultry_br: 'data-poultry_br.json',
  poultry_us: 'data-poultry_us.json',
  macro: 'data-macro.json',
  weg: 'data-weg.json',
  rental: 'data-rental.json',
  transportes: 'data-transportes.json',
  agro: 'data-agro.json',
};
const LEGACY_OBJECT = 'data.json';

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

async function signObject(object) {
  const response = await fetch(`${SB_URL}/storage/v1/object/sign/dashboard/${object}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      apikey: SB_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload?.signedURL) return null;
  return payload.signedURL.startsWith('http')
    ? payload.signedURL
    : `${SB_URL}/storage/v1${payload.signedURL}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  }

  if (!SB_KEY) {
    return sendJson(res, 500, { error: 'SUPABASE_SERVICE_ROLE nao configurada.' });
  }

  try {
    const dataset = String(req.query.dataset || '').trim();
    const object = DATASET_OBJECTS[dataset];

    let signedLocation = object ? await signObject(object) : null;
    if (!signedLocation) signedLocation = await signObject(LEGACY_OBJECT);
    if (!signedLocation) throw new Error('Falha ao assinar dados do Supabase.');

    const separator = signedLocation.includes('?') ? '&' : '?';
    const location = `${signedLocation}${separator}v=${encodeURIComponent(req.query.t || Date.now())}`;

    res.statusCode = 307;
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Location', location);
    return res.end();
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || 'Falha ao carregar dashboard.' });
  }
}
