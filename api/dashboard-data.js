const SB_URL = process.env.SUPABASE_URL || 'https://wmxjdveucxbousoquwmc.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
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
    const response = await fetch(`${SB_URL}/storage/v1/object/dashboard/data.json`, {
      headers: { Authorization: `Bearer ${SB_KEY}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Falha ao ler Supabase: HTTP ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    if (!payload?.data) throw new Error('data.json sem dados.');
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || 'Falha ao carregar dashboard.' });
  }
}
