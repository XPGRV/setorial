import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { parseWorkbookData } from '../src/parse-workbook.js';

const SB_URL = process.env.SUPABASE_URL || 'https://wmxjdveucxbousoquwmc.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;

const DATASETS = {
  beef_br: {
    fileName: 'BeefBR.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_BEEF_BR_FILE_ID',
    metaKey: 'br',
    opts: { parseBR: true, parseUS: false, parsePoultryUS: false, parseSelic: false },
  },
  beef_us: {
    fileName: 'BeefUS.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_BEEF_US_FILE_ID',
    metaKey: 'us',
    opts: { parseBR: false, parseUS: true, parsePoultryUS: false, parseSelic: false },
  },
  poultry_br: {
    fileName: 'FrangoBR.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_POULTRY_BR_FILE_ID',
    metaKey: 'poultry_br',
    opts: { parseBR: false, parseUS: false, parsePoultryUS: false, parseSelic: false },
  },
  poultry_us: {
    fileName: 'FrangoUS.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_POULTRY_US_FILE_ID',
    metaKey: 'poultry_us',
    opts: { parseBR: false, parseUS: false, parsePoultryUS: true, parseSelic: false },
  },
  macro: {
    fileName: 'Planilha - Selic.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_SELIC_FILE_ID',
    metaKey: 'selic',
    opts: { parseBR: false, parseUS: false, parsePoultryUS: false, parseSelic: true },
  },
  weg: {
    fileName: 'WEG - Setorial.xlsm',
    fileIdEnv: 'GOOGLE_DRIVE_WEG_FILE_ID',
    folderIdEnv: 'GOOGLE_DRIVE_DATABASE_FOLDER_ID', // WEG mora na pasta "Setorial - Database"
    metaKey: 'weg',
    opts: { parseBR: false, parseUS: false, parsePoultryUS: false, parseSelic: false },
  },
};

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Autorizacao: o cron (GitHub Actions) manda `Authorization: Bearer CRON_SECRET`;
// o botao da dashboard chega como requisicao same-origin do navegador.
// Sem CRON_SECRET configurada no Vercel, o endpoint fica aberto (comportamento antigo).
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if ((req.headers.authorization || '') === `Bearer ${secret}`) return true;
  const origin = req.headers.origin || req.headers.referer || '';
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function getPrivateKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, '\n') : null;
}

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error('Credenciais do Google Drive nao configuradas.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

async function resolveFileId(drive, cfg) {
  const directId = process.env[cfg.fileIdEnv];
  if (directId) return directId;

  const folderId = (cfg.folderIdEnv && process.env[cfg.folderIdEnv]) || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    const envs = [cfg.fileIdEnv, cfg.folderIdEnv, 'GOOGLE_DRIVE_FOLDER_ID'].filter(Boolean).join(' ou ');
    throw new Error(`Defina ${envs} no Vercel.`);
  }

  const escapedName = cfg.fileName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escapedName}' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const file = res.data.files?.[0];
  if (!file?.id) throw new Error(`Planilha nao encontrada no Drive: ${cfg.fileName}`);
  return file.id;
}

async function downloadWorkbookBuffer(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

async function uploadDataJson(objectName, payload) {
  if (!SB_KEY) throw new Error('SUPABASE_SERVICE_ROLE nao configurada.');

  const res = await fetch(`${SB_URL}/storage/v1/object/dashboard/${objectName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Falha no upload Supabase: HTTP ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Metodo nao permitido.' });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { error: 'Nao autorizado.' });
  }

  const dataset = String(req.query.dataset || '').trim();
  const cfg = DATASETS[dataset];
  if (!cfg) {
    return json(res, 400, { error: 'Dataset invalido.', datasets: Object.keys(DATASETS) });
  }

  try {
    const drive = getDriveClient();
    const fileId = await resolveFileId(drive, cfg);
    const buffer = await downloadWorkbookBuffer(drive, fileId);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellStyles: true });
    const parsed = parseWorkbookData(wb, XLSX, cfg.opts);

    // Cada dataset vive no proprio arquivo — nada de ler/mesclar o combinado,
    // o que tambem elimina a corrida entre atualizacoes simultaneas.
    const meta = {
      [cfg.metaKey]: { source: cfg.fileName, updated: new Date().toISOString() },
    };

    await uploadDataJson(`data-${dataset}.json`, { data: parsed, meta });

    return json(res, 200, {
      ok: true,
      dataset,
      fileName: cfg.fileName,
      parsedKeys: Object.keys(parsed),
      meta,
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Falha ao atualizar dashboard.' });
  }
}
