// Atualização diária da dashboard SEM navegador.
// Lê as planilhas .xlsm, usa o MESMO parser do front (src/parse-workbook.js) e
// sobe um data-<dataset>.json por planilha direto pro Supabase Storage.
// (O front lê esses arquivos separados; o data.json combinado antigo fica
// apenas como fallback de leitura para datasets nunca atualizados.)
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
  const metaKey = forceWeg ? 'weg' : forceSelic ? 'selic' : forceUS ? 'us' : forcePoultryUS ? 'poultry_us' : forcePoultryBR ? 'poultry_br' : 'br';
  // Nome do dataset = nome do arquivo no Storage (data-<dataset>.json)
  const dataset = { weg: 'weg', selic: 'macro', us: 'beef_us', poultry_us: 'poultry_us', poultry_br: 'poultry_br', br: 'beef_br' }[metaKey];
  return {
    opts: {
      parseBR: !forceUS && !forcePoultry && !forceSelic && !forceWeg,
      parseUS: forceUS,
      parsePoultryUS: forcePoultryUS,
      parseSelic: forceSelic,
    },
    metaKey,
    dataset,
  };
}

async function uploadObject(objectName, payload) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${SB_URL}/storage/v1/object/dashboard/${objectName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) throw new Error(`upload HTTP ${res.status} ${await res.text()}`);
  return body.length;
}

async function main() {
  if (!SB_KEY) {
    console.error('ERRO: defina a variável de ambiente SUPABASE_SERVICE_ROLE.');
    process.exit(1);
  }

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
      const { opts, metaKey, dataset } = flagsFor(nome);
      const parsed = parseWorkbookData(wb, XLSX, opts);
      const meta = { [metaKey]: { source: nome, updated: new Date().toISOString() } };
      const bytes = await uploadObject(`data-${dataset}.json`, { data: parsed, meta });
      okCount++;
      console.log(`✓ ${nome} → data-${dataset}.json (${(bytes / 1024).toFixed(0)} KB · ${Object.keys(parsed).join(', ')})`);
    } catch (e) {
      console.error(`✗ ${nome} — ERRO: ${e.message} (mantendo dados anteriores)`);
    }
  }

  if (okCount === 0) {
    console.error('Nenhuma planilha processada com sucesso.');
    process.exit(1);
  }
  console.log(`\n☁ ${okCount}/${ARQUIVOS.length} planilhas atualizadas no Supabase.`);
}

main().catch(e => { console.error(e); process.exit(1); });
