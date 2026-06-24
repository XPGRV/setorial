import React from 'react'
import { parseWorkbookData } from './parse-workbook.js'

// Lê o ArrayBuffer com o SheetJS (carregado via CDN no navegador) e delega o
// parsing ao módulo compartilhado parse-workbook.js — a MESMA lógica usada pelo
// script Node de atualização diária (scripts/update-dashboard.mjs).
async function parseWorkbook(arrayBuffer, opts = {}) {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const wb = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellStyles: true });
  return parseWorkbookData(wb, window.XLSX, opts);
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
