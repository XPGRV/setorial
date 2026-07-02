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
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Falha ao atualizar (${res.status})`);
  }
  const metaKeys = {
    beef_us: 'us', beef_br: 'br', poultry_us: 'poultry_us',
    poultry_br: 'poultry_br', macro: 'selic', weg: 'weg',
  };
  const metaKey = metaKeys[dataset] || 'br';
  const expectedUpdate = json.meta?.[metaKey]?.updated;
  let result = null;

  // O Storage pode levar um instante para servir a nova versao do arquivo.
  // Confirma o timestamp antes de redesenhar os graficos.
  for (let attempt = 0; attempt < 6; attempt++) {
    result = await window.refreshDashboardData(dataset);
    if (!expectedUpdate || result.meta?.[metaKey]?.updated === expectedUpdate) break;
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  const { data, meta } = result;
  if (expectedUpdate && meta?.[metaKey]?.updated !== expectedUpdate) {
    throw new Error('A nova versao ainda nao esta disponivel.');
  }
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
      window.dispatchEvent(new CustomEvent('dashboard-refresh-success'));
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

const ALL_DATASETS = [
  { key: 'beef_us',    label: 'BeefUS'   },
  { key: 'beef_br',   label: 'BeefBR'   },
  { key: 'poultry_us', label: 'FrangoUS' },
  { key: 'poultry_br', label: 'FrangoBR' },
  { key: 'macro',     label: 'Macro'    },
  { key: 'weg',       label: 'WEG'      },
];

const SidebarRefresh = ({ onLoad }) => {
  const [status, setStatus] = React.useState(null);

  const handleRefresh = async () => {
    let lastData = null, lastMeta = null, failed = [];
    for (let i = 0; i < ALL_DATASETS.length; i++) {
      const { key, label } = ALL_DATASETS[i];
      setStatus({ kind: 'loading', msg: `${label} (${i + 1}/${ALL_DATASETS.length})…` });
      try {
        const result = await refreshDashboard(null, key);
        lastData = result.data;
        lastMeta = result.meta;
      } catch {
        failed.push(label);
      }
    }
    if (lastData && onLoad) onLoad(lastData, lastMeta);
    if (lastData) window.dispatchEvent(new CustomEvent('dashboard-refresh-success'));
    if (failed.length) {
      setStatus({ kind: 'err', msg: `Erro: ${failed.join(', ')}` });
      setTimeout(() => setStatus(null), 6000);
    } else {
      setStatus({ kind: 'ok', msg: 'Todas as planilhas atualizadas' });
      setTimeout(() => setStatus(null), 3500);
    }
  };

  return (
    <div className="sidebar-upload-zone">
      <button className="sidebar-upload-btn" onClick={handleRefresh} disabled={status?.kind === 'loading'}>
        <RefreshIcon size={15}/>
        <span>Atualizar tudo</span>
      </button>
      {status && (
        <div className="sidebar-upload-hint">
          <span className={`upload-status is-${status.kind}`}>{status.msg}</span>
        </div>
      )}
    </div>
  );
};

export { RefreshWidget, SidebarRefresh };
