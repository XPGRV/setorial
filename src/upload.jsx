import React from 'react'

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

async function refreshDashboard(onLoad, dataset) {
  const res = await fetch(`/api/update-dashboard?dataset=${encodeURIComponent(dataset || 'beef_br')}`, {
    method: 'POST',
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data) {
    throw new Error(json?.error || `Falha ao atualizar (${res.status})`);
  }
  const { data, meta } = json;
  window.__dashboardData = data;
  window.__dashboardMeta = meta || {};
  try {
    localStorage.setItem('dashboard_data', JSON.stringify(data));
    localStorage.setItem('dashboard_meta', JSON.stringify(meta || {}));
    localStorage.setItem('dashboard_version', '5');
  } catch (_) {}
  if (onLoad) onLoad(data, meta);
  return { data, meta };
}

const RefreshIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 11a8 8 0 0 0-14.6-4.5M4 5v5h5M4 13a8 8 0 0 0 14.6 4.5M20 19v-5h-5"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RefreshWidget = ({ onLoad, dataset, lastUpdate, currentSource }) => {
  const [status, setStatus] = React.useState(null);

  const handleRefresh = async () => {
    setStatus({ kind: 'loading', msg: 'Buscando planilha...' });
    try {
      await refreshDashboard(onLoad, dataset);
      setStatus({ kind: 'ok', msg: 'Planilha atualizada' });
      setTimeout(() => setStatus(null), 3500);
    } catch (e) {
      setStatus({ kind: 'err', msg: 'Erro ao buscar planilha' });
      setTimeout(() => setStatus(null), 5000);
    }
  };

  return (
    <div className="upload-widget">
      <button className="upload-btn" onClick={handleRefresh} disabled={status?.kind === 'loading'}>
        <RefreshIcon/>
        <span>Atualizar planilha</span>
      </button>
      <div className="upload-meta">
        {status ? (
          <span className={`upload-status is-${status.kind}`}>{status.msg}</span>
        ) : lastUpdate ? (
          <span className="upload-last">
            <span className="upload-last-src">{currentSource || 'data.json'}</span>
            <span className="upload-last-time">atualizado {formatRelative(lastUpdate)}</span>
          </span>
        ) : (
          <span className="upload-hint">buscar Drive</span>
        )}
      </div>
    </div>
  );
};

const META_LABELS = { br: 'BeefBR', us: 'BeefUS', poultry_br: 'FrangoBR', poultry_us: 'FrangoUS' };

const SidebarRefresh = ({ onLoad, dataset }) => {
  const [status, setStatus] = React.useState(null);

  const handleRefresh = async () => {
    setStatus({ kind: 'loading', msg: 'Buscando planilha...' });
    try {
      const { meta } = await refreshDashboard(onLoad, dataset);
      const tabs = Object.keys(meta || {}).map(k => META_LABELS[k]).filter(Boolean).join(' · ');
      setStatus({ kind: 'ok', msg: tabs ? `Atualizado: ${tabs}` : 'Planilha atualizada' });
      setTimeout(() => setStatus(null), 3500);
    } catch (e) {
      setStatus({ kind: 'err', msg: 'Erro ao buscar planilha' });
      setTimeout(() => setStatus(null), 5000);
    }
  };

  return (
    <div className="sidebar-upload-zone">
      <button className="sidebar-upload-btn" onClick={handleRefresh} disabled={status?.kind === 'loading'}>
        <RefreshIcon size={15}/>
        <span>Atualizar planilha</span>
      </button>
      {status && (
        <div className="sidebar-upload-hint">
          <span className={`upload-status is-${status.kind}`}>{status.msg}</span>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { RefreshWidget, SidebarRefresh });
