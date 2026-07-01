// Atualização diária da dashboard SEM navegador.
// Lê as planilhas .xlsm, usa o MESMO parser do front (src/parse-workbook.js) e
// sobe o data.json direto pro Supabase Storage com a chave service_role.
//
// Pré-requisitos:
//   - Node 18+ (fetch global)
//   - npm install   (instala o SheetJS — ver package.json)
//
// Variáveis de ambiente (NÃO commitar a service_role):
//   SUPABASE_SERVICE_ROLE  (obrigatória)  — chave service_role do Supabase
//   SUPABASE_URL           (opcional)     — default abaixo
//   SETORIAL_DIR           (opcional)     — pasta das planilhas; default abaixo
//
// Uso:
//   SUPABASE_SERVICE_ROLE=xxxxx node scripts/update-dashboard.mjs
//   (ou definir a env var no agendador/sistema e rodar `npm run update`)

import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseWorkbookData } from '../src/parse-workbook.js';

const PASTA    = process.env.SETORIAL_DIR || 'G:\\Meu Drive\\Arquivos\\Setorial - Proteínas';
const DB_DIR   = process.env.DATABASE_DIR || 'G:\\Meu Drive\\Arquivos\\Setorial - Database';
// Cada item: { dir, nome }. As planilhas de proteína vêm da pasta Proteínas;
// as de "base de dados" (ex: WEG) vêm da pasta Database.
const ARQUIVOS = [
  { dir: PASTA,  nome: 'FrangoUS.xlsm' },
  { dir: PASTA,  nome: 'BeefBR.xlsm' },
  { dir: PASTA,  nome: 'BeefUS.xlsm' },
  { dir: PASTA,  nome: 'FrangoBR.xlsm' },
  { dir: PASTA,  nome: 'Planilha - Selic.xlsm' },
  { dir: DB_DIR, nome: 'WEG - Setorial.xlsm' },
];
const SB_URL   = process.env.SUPABASE_URL || 'https://wmxjdveucxbousoquwmc.supabase.co';
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE;

// Mesma detecção por nome de arquivo usada no front (upload.jsx)
function flagsFor(nome) {
  const lc = nome.toLowerCase();
  const forceUS        = lc.includes('beefus');
  const forcePoultryBR = lc.includes('frango') && !lc.includes('us');
  const forcePoultryUS = lc.includes('frangous') || (lc.includes('frango') && lc.includes('us'));
  const forcePoultry   = forcePoultryBR || forcePoultryUS;
  const forceSelic     = lc.includes('selic');
  const forceWeg       = lc.includes('weg');
  return {
    opts: {
      parseBR: !forceUS && !forcePoultry && !forceSelic && !forceWeg,
      parseUS: forceUS,
      parsePoultryUS: forcePoultryUS,
      parseSelic: forceSelic,
    },
    metaKey: forceWeg ? 'weg' : forceSelic ? 'selic' : forceUS ? 'us' : forcePoultryUS ? 'poultry_us' : forcePoultryBR ? 'poultry_br' : 'br',
  };
}

// Busca o data.json atual pra MESCLAR (assim um arquivo ausente não apaga a seção)
async function fetchExisting() {
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/public/dashboard/data.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return { data: json.data, meta: json.meta || {} };
    }
  } catch (_) {}
  return { data: {}, meta: {} };
}

async function main() {
  if (!SB_KEY) {
    console.error('ERRO: defina a variável de ambiente SUPABASE_SERVICE_ROLE.');
    process.exit(1);
  }

  const { data: baseData, meta: baseMeta } = await fetchExisting();
  let data = { ...baseData };
  let meta = { ...baseMeta };
  let okCount = 0;

  for (const { dir, nome } of ARQUIVOS) {
    const caminho = path.join(dir, nome);
    if (!fs.existsSync(caminho)) {
      console.warn(`! não encontrado, mantendo dados anteriores: ${caminho}`);
      continue;
    }
    try {
      const buf = fs.readFileSync(caminho);
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellStyles: true });
      const { opts, metaKey } = flagsFor(nome);
      const parsed = parseWorkbookData(wb, XLSX, opts);
      data = { ...data, ...parsed };
      meta = { ...meta, [metaKey]: { source: nome, updated: new Date().toISOString() } };
      okCount++;
      console.log(`✓ ${nome} → ${Object.keys(parsed).join(', ')}`);
    } catch (e) {
      console.error(`✗ ${nome} — ERRO ao parsear: ${e.message} (mantendo dados anteriores)`);
    }
  }

  if (okCount === 0) {
    console.error('Nenhuma planilha processada com sucesso — abortando upload.');
    process.exit(1);
  }

  const payload = JSON.stringify({ data, meta });
  const res = await fetch(`${SB_URL}/storage/v1/object/dashboard/data.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: payload,
  });

  if (!res.ok) {
    console.error('Falha no upload pro Supabase:', res.status, await res.text());
    process.exit(1);
  }
  console.log(`\n☁ data.json atualizado (${(payload.length / 1024).toFixed(0)} KB · ${okCount}/${ARQUIVOS.length} planilhas).`);
}

main().catch(e => { console.error(e); process.exit(1); });
