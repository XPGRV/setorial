import React from 'react'
import { useNavigate } from 'react-router-dom'
import { searchDestinations as searchCatalog } from './search-catalog.js'
import { runRouteTransition } from './route-transition.js'
import { THEMES, ThemePicker } from './reactive.js'
import { RefreshWidget, SidebarRefresh } from './upload.jsx'
import { BeefUSTab, EdgebeeefChart, EdgebeeefControls } from './beef-us-tab.jsx'
import { PoultryBRTab } from './poultry-br-tab.jsx'
import { PoultryUSTab } from './poultry-us-tab.jsx'
import { MacroTab } from './macro-tab.jsx'
import { WegTab } from './weg-tab.jsx'
import { CicloDoBoi } from './ciclo-boi.jsx'
import { EVENTS, MONTHS_PT, availableYears, fmt, latestNonNull } from './data-utils.jsx'
import { PriceCard, DailySeasonalCard } from './price-card.jsx'

// Main app — 2 tabs (Preços/Spreads, Abates)
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const PALETTES = {
  neon:       { name: 'Néon',       accent: 'oklch(0.82 0.18 155)' },
  cyan:       { name: 'Ciano',      accent: 'oklch(0.78 0.14 210)' },
  amber:      { name: 'Âmbar',      accent: 'oklch(0.78 0.16 75)' },
  magenta:    { name: 'Magenta',    accent: 'oklch(0.72 0.20 340)' },
  terracotta: { name: 'Terracota',  accent: 'oklch(0.65 0.13 45)' },
  ice:        { name: 'Gelo',       accent: 'oklch(0.88 0.04 240)' },
};

const TYPE_STACKS = {
  modern:    { name: 'Moderno',    sans: '"Inter Tight", system-ui, sans-serif',  mono: '"Geist Mono", ui-monospace, monospace' },
  editorial: { name: 'Editorial',  sans: '"Instrument Serif", Georgia, serif',    mono: '"JetBrains Mono", monospace' },
  swiss:     { name: 'Suíça',      sans: '"Space Grotesk", system-ui, sans-serif', mono: '"Space Mono", ui-monospace, monospace' },
  humanist:  { name: 'Humanista',  sans: '"Work Sans", system-ui, sans-serif',     mono: '"IBM Plex Mono", ui-monospace, monospace' },
};

// Fontes das tipografias alternativas — só o stack padrão (modern) vem no
// index.html; os demais são injetados aqui quando o usuário os seleciona.
const FONT_STACK_URLS = {
  editorial: 'https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap',
  swiss:     'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Space+Mono:wght@400&display=swap',
  humanist:  'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
};
function ensureFontStack(key) {
  const href = FONT_STACK_URLS[key];
  if (!href) return;
  const id = `rx-fonts-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// Escurece um accent oklch p/ garantir contraste sobre fundo claro (light mode).
// Só afeta a cor de UI (--accent); as cores das linhas dos gráficos são separadas.
const darkenAccent = (str, maxL = 0.55) => {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(str || '');
  if (!m) return str;
  return `oklch(${Math.min(parseFloat(m[1]), maxL)} ${m[2]} ${m[3]})`;
};

// Accents das empresas de Capital Goods (além da WEG)
const MARCOPOLO_ACCENT = 'oklch(0.706 0.169 52)';  // laranja Marcopolo (RGB 244,129,32)
const EMBRAER_ACCENT   = 'oklch(0.50 0.20 272)';   // azul-royal Embraer — distinto do azul WEG


function App({ data: propData, initialData, initialMeta, initialDataset = 'beef_us', dashboardSection = 'proteinas' }) {
  const TWEAK_DEFAULTS = { palette: 'neon', typography: 'modern', density: 'comfortable', theme: 'flux' };
  const routeNavigate = useNavigate();

  // ── Todos os hooks ANTES de qualquer return condicional ──────────────────────
  const [data, setData] = useState(propData || initialData);
  const [meta, setMeta] = useState(initialMeta || null);
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState('precos');
  // Dataset inicial: aceita ?dataset=... da URL (ex: home → /proteinas?dataset=macro)
  const [activeDataset, setActiveDataset] = useState(() => {
    try {
      const d = new URLSearchParams(window.location.search).get('dataset');
      if (['beef_us', 'beef_br', 'poultry_br', 'poultry_us', 'macro', 'weg'].includes(d)) return d;
    } catch {}
    return initialDataset;
  });

  // Modo claro/escuro (binário, persistido). Padrão inicial = preferência do
  // sistema, mas só até o usuário escolher; depois é o que ele setou.
  const [colorMode, setColorMode] = useState(() => {
    try {
      const s = localStorage.getItem('rx-color-mode');
      if (s === 'light' || s === 'dark') return s;
    } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const cycleMode = () => setColorMode(m => m === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.dataset.mode = colorMode;
    try { localStorage.setItem('rx-color-mode', colorMode); } catch {}
  }, [colorMode]);

  // Aviso de dados offline (rede falhou → exibindo cache local)
  const [offline, setOffline] = useState(() => !!window.__dashboardOffline);

  useEffect(() => {
    const onUpload = (e) => {
      if (e.detail?.data) { setData(e.detail.data); setMeta(e.detail.meta || null); }
      setOffline(!!window.__dashboardOffline);
    };
    window.addEventListener('dashboard-data-updated', onUpload);
    // Sincroniza com o store global caso uma revalidação em background tenha
    // terminado entre o resolve da rota e o mount deste componente
    if (window.__dashboardData && window.__dashboardData !== (propData || initialData)) {
      setData(window.__dashboardData);
      setMeta(window.__dashboardMeta || null);
    }
    return () => window.removeEventListener('dashboard-data-updated', onUpload);
  }, []);

  // Cross-tab navigation from the ticker (clicking ABATES on Preços tab → switch
  // to Abates and let the ticker re-trigger the scroll once the card is mounted).
  useEffect(() => {
    const onGoto = (e) => {
      const t = e.detail?.target || '';
      const precosCards  = ['card-cattle','card-carne-mi','card-carne-me','card-spread-mi','card-spread-me'];
      const abatesCards  = ['card-abates','card-femeas','card-ciclo'];
      const poultryCards    = ['card-frango-mi','card-frango-me','card-feed-grain','card-spread-mi-frango','card-spread-me-frango','card-abates-frango','card-chick-placed','card-ipca-processados'];
      const poultryUSPrecos = ['us-frango-price','us-feed-grain','us-spread','us-poultry-beef','us-national-composite','us-usda-price','us-usda-feed','us-usda-spread'];
      const poultryUSProd   = ['us-broiler-production','us-broiler-annual','us-chicks-placed','us-abates-frango','us-producao','us-plantel-matrizes','us-produtividade-matrizes','us-ovos-incubados','us-hatchability','us-pintos-eclodiram','us-mortality','us-peso-medio'];
      if (poultryCards.includes(t)) {
        setActiveDataset('poultry_br');
        const newTab = ['card-abates-frango','card-chick-placed'].includes(t) ? 'abates'
                     : t === 'card-ipca-processados' ? 'ipca'
                     : 'precos';
        setTab(newTab);
      } else if (poultryUSPrecos.includes(t)) {
        setActiveDataset('poultry_us');
        setTab('precos');
      } else if (poultryUSProd.includes(t)) {
        setActiveDataset('poultry_us');
        setTab('producao');
      } else {
        if (activeDataset !== 'beef_br') setActiveDataset('beef_br');
        if (precosCards.includes(t)) setTab('precos');
        else if (abatesCards.includes(t)) setTab('abates');
      }
    };
    window.addEventListener('rx-goto-card', onGoto);
    return () => window.removeEventListener('rx-goto-card', onGoto);
  }, [activeDataset]);

  useEffect(() => {
    const onMsg = (e) => {
      const m = e.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === '__activate_edit_mode') setEditMode(true);
      else if (m.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (key, val) => {
    setTweaks(prev => {
      const next = { ...prev, [key]: val };
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
      return next;
    });
  };

  // chartAccent — cor passada aos gráficos (linha do ano mais recente, barras)
  const accent = activeDataset === 'beef_us'
    ? 'oklch(0.72 0.18 240)'
    : activeDataset === 'poultry_us'
    ? 'oklch(0.76 0.20 45)'
    : activeDataset === 'macro'
    ? 'oklch(0.70 0.19 160)'
    : activeDataset === 'weg'
    ? 'oklch(0.491 0.131 247.6)'
    : activeDataset === 'embraer'
    ? EMBRAER_ACCENT
    : activeDataset === 'marcopolo'
    ? MARCOPOLO_ACCENT
    : tweaks.accent || PALETTES[tweaks.palette].accent;

  // uiAccent — CSS var, sidebar highlights, logo box
  const uiAccent = activeDataset === 'beef_us'
    ? 'oklch(0.72 0.18 240)'
    : activeDataset === 'poultry_br'
    ? 'oklch(0.78 0.18 85)'
    : activeDataset === 'poultry_us'
    ? 'oklch(0.76 0.20 45)'
    : activeDataset === 'macro'
    ? 'oklch(0.70 0.19 160)'
    : activeDataset === 'weg'
    ? 'oklch(0.491 0.131 247.6)'
    : activeDataset === 'embraer'
    ? EMBRAER_ACCENT
    : activeDataset === 'marcopolo'
    ? MARCOPOLO_ACCENT
    : accent;

  const typeStack = TYPE_STACKS[tweaks.typography];

  useEffect(() => {
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.theme = tweaks.theme || 'flux';
    const themeAccent = (THEMES && THEMES[tweaks.theme]?.accent) || uiAccent;
    let finalAccent = activeDataset === 'beef_us'
      ? 'oklch(0.72 0.18 240)'
      : activeDataset === 'poultry_br'
      ? 'oklch(0.78 0.18 85)'
      : activeDataset === 'poultry_us'
      ? 'oklch(0.76 0.20 45)'
      : activeDataset === 'macro'
      ? 'oklch(0.70 0.19 160)'
      : activeDataset === 'weg'
      ? 'oklch(0.491 0.131 247.6)'
      : activeDataset === 'embraer'
      ? EMBRAER_ACCENT
      : activeDataset === 'marcopolo'
      ? MARCOPOLO_ACCENT
      : themeAccent;
    // No modo claro, escurece o accent de UI p/ contraste (gráficos não são afetados)
    if (colorMode === 'light') finalAccent = darkenAccent(finalAccent);
    document.documentElement.style.setProperty('--accent', finalAccent);
    ensureFontStack(tweaks.typography);
    document.documentElement.style.setProperty('--font-sans', typeStack.sans);
    document.documentElement.style.setProperty('--font-mono', typeStack.mono);
  }, [uiAccent, typeStack, tweaks.density, tweaks.theme, activeDataset, colorMode]);

  const onUpload = (d, m) => { setData(d); setMeta(m); window.__dashboardData = d; window.__dashboardMeta = m; };

  // Navega para um destino da busca: troca dataset/aba e rola até o gráfico.
  const navigateTo = useCallback((dest) => {
    if (!dest) return;
    const targetSection = dest.dataset === 'macro'
      ? 'macro'
      : (dest.dataset === 'weg' || dest.dataset === 'embraer' || dest.dataset === 'marcopolo')
      ? 'capitalgoods'
      : 'proteinas';
    if (targetSection !== dashboardSection) {
      try { sessionStorage.setItem('dashboard-search-destination', JSON.stringify(dest)); } catch {}
      runRouteTransition(() => routeNavigate(targetSection === 'proteinas' ? '/proteinas' : `/${targetSection}`));
      return;
    }
    setActiveDataset(dest.dataset);
    if (dest.tab) setTab(dest.tab);
    let tries = 0;
    const go = () => {
      if (dest.cardId) {
        const el = document.querySelector(`[data-card-id="${dest.cardId}"]`);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
          rxHighlightCard(el);
          return;
        }
        if (tries++ < 12) { setTimeout(go, 80); return; }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    setTimeout(go, 70);
  }, [dashboardSection, routeNavigate]);

  useEffect(() => {
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem('dashboard-search-destination') || 'null');
    } catch {}
    if (!pending) return;
    const pendingSection = pending.dataset === 'macro'
      ? 'macro'
      : (pending.dataset === 'weg' || pending.dataset === 'embraer' || pending.dataset === 'marcopolo')
      ? 'capitalgoods'
      : 'proteinas';
    if (pendingSection !== dashboardSection) return;
    try { sessionStorage.removeItem('dashboard-search-destination'); } catch {}
    const timer = setTimeout(() => navigateTo(pending), 100);
    return () => clearTimeout(timer);
  }, [dashboardSection, navigateTo]);

  if (!data) {
    return (
      <div className="app app-empty">
        <header className="topbar topbar-slim">
          <div className="topbar-title">
            <h1>Setorial</h1>
            <div className="topbar-sub">acompanhamento setorial</div>
          </div>
          <div className="topbar-spacer"/>
          <RefreshWidget onLoad={onUpload} dataset={activeDataset} lastUpdate={null} currentSource={null}/>
        </header>
        <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
          </svg>
          <div style={{fontSize:16,fontWeight:500,color:'var(--fg)'}}>Nenhum dado encontrado</div>
          <div style={{fontSize:13,textAlign:'center',maxWidth:320}}>Atualize os dados para buscar o data.json mais recente.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar tab={tab} setTab={setTab}
        activeDataset={activeDataset} setActiveDataset={setActiveDataset}
        onUpload={onUpload} dashboardSection={dashboardSection}/>
      <div className="app-content">
        <TopBar meta={meta} onUpload={onUpload} activeDataset={activeDataset}
          colorMode={colorMode} onCycleMode={cycleMode} onNavigate={navigateTo}
          dashboardSection={dashboardSection}/>
        {offline && (
          <div className="rx-offline-banner" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>
            </svg>
            Sem conexão com a base de dados — exibindo os últimos dados salvos neste navegador.
          </div>
        )}
        <TickerBar data={data} activeDataset={activeDataset}/>
        {activeDataset === 'beef_us' ? (
          <BeefUSTab data={data} accent={accent}/>
        ) : activeDataset === 'poultry_br' ? (
          <PoultryBRTab data={data} accent={accent} tab={tab}/>
        ) : activeDataset === 'poultry_us' ? (
          <PoultryUSTab data={data} accent={accent} tab={tab}/>
        ) : activeDataset === 'macro' ? (
          <MacroTab data={data} accent={accent}/>
        ) : activeDataset === 'weg' ? (
          <WegTab data={data} accent={accent} tab={tab}/>
        ) : activeDataset === 'embraer' ? (
          <ComingSoon name="Embraer" icon={SIcon.embraer}/>
        ) : activeDataset === 'marcopolo' ? (
          <ComingSoon name="Marcopolo" icon={SIcon.marcopolo}/>
        ) : tab === 'precos' ? (
          <PrecosTab data={data} accent={accent}/>
        ) : (
          <AbatesTab data={data} accent={accent}/>
        )}
      </div>
      {editMode && <TweaksPanel tweaks={tweaks} updateTweak={updateTweak}/>}
    </div>
  );
}

// ---------------- Sidebar ----------------
const SIcon = {
  bar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="14" rx="1"/><rect x="17" y="9" width="4" height="11" rx="1"/></svg>,
  abates: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18l5-6 4 4 4-7 5 9"/><path d="M3 21h18"/></svg>,
  cow: <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M512,237.3c-0.008-14.331-1.105-28.117-4.601-40.405c-1.748-6.136-4.102-11.914-7.285-17.14c-3.166-5.226-7.17-9.899-12.101-13.733l-0.054-0.036c-9.399-7.161-18.112-11.896-27.287-14.732c-9.176-2.836-18.647-3.754-29.544-3.754c-12.324,0-26.583,1.15-45.006,2.229c-16.454,0.973-38.747,1.142-59.132,1.142c-10.853,0-21.171-0.045-29.829-0.045c-11.931,0.009-31.631-1.748-51.704-4.548c-20.065-2.782-40.664-6.635-54.504-10.647c-12.823-3.71-24.21-8.48-34.047-12.423c-4.922-1.97-9.47-3.736-13.698-5.056c-1.56-0.472-3.058-0.874-4.547-1.222c2.051-4.86,2.809-9.675,2.809-13.742c0-2.291-0.223-4.351-0.668-6.206c-0.224-0.928-0.5-1.802-0.892-2.685c-0.401-0.883-0.874-1.783-1.854-2.792v0.009c-1.454-1.426-3.05-2.22-4.771-2.79c-1.73-0.554-3.612-0.838-5.636-0.838c-3.825,0-8.204,1.07-12.68,3.486c-0.838-5.155-2.72-10.05-4.958-14.313c-1.534-2.889-3.246-5.475-5.056-7.669c-1.837-2.185-3.674-3.995-6.028-5.324c-2.818-1.56-5.716-2.426-8.632-2.434c-2.479,0-5.082,0.651-7.268,2.434c-1.07,0.882-1.997,2.051-2.604,3.38c-0.606,1.32-0.891,2.764-0.882,4.164c0,1.695,0.384,3.318,1.016,4.842c0.9,2.167,1.774,4.869,2.39,7.589c0.624,2.72,0.99,5.484,0.99,7.687c0,1.417-0.152,2.594-0.365,3.326c-0.089,0.303-0.179,0.508-0.241,0.651c-1.828,1.115-6.43,3.942-11.414,7.026c-3.211,1.98-6.563,4.058-9.408,5.832c-2.844,1.784-5.145,3.237-6.411,4.076c-0.803,0.544-1.293,1.016-1.89,1.57c-1.079,1.026-2.283,2.318-3.71,3.906c-4.931,5.511-12.315,14.482-19.04,22.419c-3.352,3.96-6.536,7.651-9.078,10.434c-1.266,1.382-2.38,2.551-3.228,3.371c-0.419,0.402-0.767,0.722-0.999,0.918l-0.232,0.178c-2.577,1.472-6.394,3.576-9.774,5.814c-1.712,1.15-3.318,2.319-4.753,3.692c-0.722,0.705-1.409,1.454-2.06,2.462c-0.32,0.508-0.633,1.088-0.883,1.792C0.187,169.91,0,170.765,0,171.747c0.018,1.07,0.161,1.614,0.303,2.211c0.277,1.062,0.633,2.078,1.106,3.265c1.641,4.066,4.566,9.871,7.928,15.062c1.694,2.586,3.46,4.994,5.431,7.009c0.999,1.007,2.051,1.935,3.335,2.728c1.276,0.775,2.881,1.516,5.048,1.542c0.356-0.008,1.748,0.071,3.593,0.223c6.572,0.544,19.788,1.972,34.502,3.496c13.635,1.417,28.554,2.925,40.985,3.932c1.998,3.353,5.761,9.845,10.015,17.924c5.565,10.559,11.95,23.837,16.203,36.081c1.177,3.389,2.453,7.964,3.763,13.046c1.989,7.633,4.076,16.426,6.341,24.541c1.132,4.066,2.31,7.964,3.558,11.504c1.248,3.548,2.56,6.733,4.084,9.47c7.232,12.939,14.508,24.817,19.859,34.93c2.666,5.047,4.86,9.658,6.323,13.644c1.48,3.968,2.193,7.303,2.175,9.64c0,12.225,0,37.935,0,42.876l-5.234,17.745l3.746,2.337c0.678,0.437,7.794,4.664,20.421,4.664c3.531,0,6.662-0.66,9.3-1.935c1.972-0.954,3.639-2.247,4.932-3.683c1.935-2.167,3.022-4.566,3.629-6.706c0.606-2.149,0.767-4.057,0.767-5.556c0-1.881,0-16.016,0-29.669c0-6.83,0-13.546,0-18.557c0-5.003,0-8.284,0-8.302v-0.597l-0.133-0.598l-0.028-0.142c-0.152-0.74-0.874-4.343-1.56-8.739c-0.686-4.379-1.301-9.622-1.293-13.287c-0.008-0.526,0.134-2.158,0.456-4.2c1.061-7.099,3.825-19.806,6.447-31.551c4.244,1.213,10.104,2.854,16.56,4.557c6.411,1.686,13.394,3.434,19.966,4.887c6.59,1.453,12.698,2.612,17.63,3.103c24.576,2.461,43.437,4.94,73.801,4.94c6.688,0,13.938-0.125,21.928-0.384c23.622-0.784,41.11-6.269,52.738-11.655c4.94-2.292,8.756-4.53,11.619-6.412c4.556,11.852,10.87,21.09,16.837,27.894c4.53,5.181,8.864,9.034,11.985,11.682c1.106,0.928,2.051,1.712,2.773,2.319c-0.045,0.633-0.099,1.328-0.152,2.158c-0.562,7.883-1.819,24.229-2.934,38.596c-0.554,7.178-1.07,13.866-1.454,18.762c-0.249,3.246-0.446,5.672-0.544,6.956l-8.846,19.342l4.04,2.773c0.749,0.526,7.446,4.762,20.064,4.753c3.398,0,6.492-0.509,9.248-1.596c2.069-0.812,3.924-1.953,5.484-3.362c2.336-2.122,3.924-4.78,4.86-7.517c0.946-2.747,1.293-5.591,1.293-8.409c-0.008-0.054,0.036-0.66,0.134-1.463c0.384-3.139,1.57-9.515,3.121-17.148c2.31-11.486,5.44-26.021,7.99-38.453c1.274-6.215,2.408-11.905,3.228-16.479c0.41-2.283,0.749-4.29,0.99-5.975c0.232-1.712,0.393-2.997,0.402-4.334c0-0.446-0.009-0.892-0.125-1.579c-0.999-5.645-1.427-12.315-1.418-19.681c-0.009-12.422,1.168-26.779,2.372-41.708C510.787,267.726,512,252.21,512,237.3z"/></svg>,
  pig: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13a7 6 0 0114 0v3a3 3 0 01-3 3h-1l-1 2h-2l-1-2H8a3 3 0 01-3-3z"/><circle cx="9" cy="12" r="0.6" fill="currentColor"/><path d="M16 11l2-2"/></svg>,
  globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>,
  factory: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V9l6 4V9l6 4V9l6 4v8z"/><path d="M3 21h18M8 21v-4M13 21v-4"/></svg>,
  weg: <svg width="16" height="16" viewBox="0 0 5991 4192" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><polygon points="461,466 461,2795 922,2795 922,932 1383,932 1383,2795 1844,2795 1844,932 2304,932 2304,3261 0,3261 0,0 5991,0 5991,466 "/><path d="M4148 2329l0 -1397 -1383 0 0 2329 1383 0 0 -466 -922 0 0 -466 922 0zm-461 -466l-461 0 0 -466 461 0 0 466z"/><path d="M5991 932l-1382 0 0 2329 922 0 0 466 -5531 0 0 465 5991 0 0 -3260zm-461 1863l-461 0 0 -1398 461 0 0 1398z"/></svg>,
  embraer: <svg width="16" height="16" viewBox="0 0 1550 1550" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m1239.6 0.6l-929.2 712.5h-186.1l-123.7 123.8h309.8l929.2 712.5h309.8l-619.7-712.5h616.6v-123.8h-616.6l619.7-712.5z"/></svg>,
  marcopolo: <svg width="16" height="16" viewBox="0 0 1495 1492" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m745.6 1084.8c-187 0-338.1-151-338.1-337.8 0-186.8 151.1-337.8 338.1-337.8 187 0 338.1 151 338.1 337.8 0 186.8-151.1 337.8-338.1 337.8z"/><path d="m128.7 1164c77.9-100.7 256.6-143.7 396.6-71.2 148.8 77.1 214.2 250.3 168.5 391.3-134.2 17.9-426-93.6-565.1-320.1z"/><path d="m700.7 0.8c44.3 132.6-10 307-158.6 388.8-144.8 79.6-320.2 37.1-409.4-69.6 140-192.6 327.3-299.9 568-319.2z"/><path d="m810.2 8.1c200.9-3.7 457.7 149.5 557.3 328.6-63.6 86.6-245.9 151.2-405.2 59.8-137.2-78.7-206.2-254.2-152.1-388.4z"/><path d="m77.9 1069.9c-102-166.4-104.9-472.3-0.2-647.7 145.1 24.9 260.8 172.3 258 328.6-2.5 155.6-121.1 302.3-257.8 319.1z"/><path d="m1362.9 1168.8c-139.8 193.3-325.6 301.7-561.6 323-54.1-131.2 12.2-303.5 144-383.5 157.4-95.5 341.1-36.4 417.6 60.5z"/><path d="m1415.6 1076.4c-154.5-39.2-258.3-177.4-253.9-335.6 4-150.3 114.7-286.2 255.1-313.5 100.9 163.9 107 461.5-1.2 649.1z"/></svg>,
  chicken: <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M78.131,72.577c1.653,0,3.267,0.03,4.836,0.05c1.415,0.03,2.785,0.04,4.126,0.04c12.733,0,24.693,3.783,35.341,9.959c10.332-12.382,15.5-23.72,15.5-32.199c0-10.524-8.534-19.063-19.068-19.063c-5.74,0-10.892,2.552-14.388,6.583c0.06-0.606,0.1-1.202,0.1-1.817c0-10.535-8.548-19.063-19.068-19.063c-10.534,0-19.068,8.528-19.068,19.063c0,0.288,0.03,0.576,0.045,0.854c-3.028-2.512-6.925-4.031-11.159-4.031c-9.652,0-17.485,7.834-17.485,17.474c0,6.513,3.654,15.102,11.875,26.372C59.605,73.46,69.037,72.577,78.131,72.577z"/><path d="M34.455,166.909c0,0-11.602,12.571-27.076,42.545c-17.539,33.996,30.759,56.088,41.393,23.203C55.936,210.537,39.295,166.423,34.455,166.909z"/><path d="M33.601,150.477c-4.413-14.824-7.893-27.889-11.234-40.171c-6.578,7.038-13.504,15.895-20.797,27.105c-8.191,12.609,17.926,11.209,26.123,11.596C29.748,149.108,31.715,149.634,33.601,150.477z"/><path d="M499.146,138.862c-34.87-36.906-104.446-43.518-149.423,2.898c-48.238,49.812-36.448,108.8-95.738,108.8c-59.289,0-94.283-49.326-100.097-94.284c0-7.069-1.112-13.86-3.198-20.224c-8.504-26.163-34.536-52.304-63.524-52.304c-14.6,0-33.644-2.333-57.691,19.539c4.925,17.921,9.834,36.976,17.355,60.556c16.556,27.86,22.905,89.368,17.971,135.776c-7.839,67.892,10.986,123.286,70.236,167.091c66.721,49.326,229.2,52.225,248.055-143.62c30.074,7.853,55.407-40.858,35.7-59.056c39.873,18.398,80.751-33.997,44.088-58.441C513.647,214.29,523.809,164.963,499.146,138.862z M75.56,137.779c-6.608,0-11.974-5.361-11.974-11.974c0-6.612,5.366-11.964,11.974-11.964c6.608,0,11.964,5.352,11.964,11.964C87.524,132.418,82.168,137.779,75.56,137.779z M256.437,403.781c-32.497,0-60.417-10.306-82.424-25.17c-22.037-14.874-38.266-34.195-47.911-52.781c-6.394-12.411-9.964-24.484-9.993-35.247c0-0.933,0.03-1.856,0.084-2.76l14.476,0.904c-0.045,0.596-0.06,1.211-0.06,1.856c-0.014,5.56,1.5,12.758,4.682,20.582c3.157,7.804,7.938,16.274,14.203,24.574c12.53,16.631,30.987,32.626,54.221,42.694c15.484,6.722,33.112,10.833,52.722,10.833c24.092,0,51.267-6.206,81.228-21.834l6.706,12.867C312.629,396.87,283.056,403.781,256.437,403.781z"/></svg>,
};

// Placeholder para empresas ainda sem dados (Capital Goods). Herda o accent
// da empresa ativa via var(--accent) — logo e textos ficam na cor da aba.
function ComingSoon({ name, icon }) {
  return (
    <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
      <div className="coming-soon-logo" style={{color:'var(--accent)'}}>{icon}</div>
      <div style={{fontSize:16,fontWeight:600,color:'var(--fg)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{name}</div>
      <div style={{fontSize:13,textAlign:'center',maxWidth:340}}>Em breve — dados e gráficos desta empresa serão adicionados aqui.</div>
    </main>
  );
}

function Sidebar({ tab, setTab, activeDataset, setActiveDataset, onUpload, dashboardSection = 'proteinas' }) {
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState(() => new Set([activeDataset]));
  const [logoPulse, setLogoPulse] = useState(false);

  useEffect(() => {
    let timer;
    const pulse = () => {
      setLogoPulse(false);
      requestAnimationFrame(() => {
        setLogoPulse(true);
        timer = setTimeout(() => setLogoPulse(false), 1100);
      });
    };
    window.addEventListener('dashboard-refresh-success', pulse);
    return () => {
      window.removeEventListener('dashboard-refresh-success', pulse);
      clearTimeout(timer);
    };
  }, []);

  const goHome = () => runRouteTransition(() => navigate('/home'));

  const onPick = (ds, sub) => {
    const targetPath = ds === 'macro'
      ? '/macro'
      : (ds === 'weg' || ds === 'embraer' || ds === 'marcopolo')
      ? '/capitalgoods'
      : `/proteinas${ds === 'beef_us' ? '' : `?dataset=${ds}`}`;
    const applyDestination = () => {
      navigate(targetPath);
      setActiveDataset(ds);
      if (sub) setTab(sub);
    };
    if (`${window.location.pathname}${window.location.search}` !== targetPath) {
      runRouteTransition(applyDestination);
    } else {
      setActiveDataset(ds);
      if (sub) setTab(sub);
    }
  };

  const toggleGroup = (groupId) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };
  const openGroup = { has: id => openGroups.has(id) };

  const isBR        = activeDataset === 'beef_br';
  const isUS        = activeDataset === 'beef_us';
  const isPoultry   = activeDataset === 'poultry_br';
  const isPoultryUS = activeDataset === 'poultry_us';
  const isMacro     = activeDataset === 'macro';
  const isWeg       = activeDataset === 'weg';
  const isEmbraer   = activeDataset === 'embraer';
  const isMarcopolo = activeDataset === 'marcopolo';
  // Sub-aba efetiva da WEG p/ destaque na sidebar — espelha o fallback do WegTab
  // (qualquer valor que não seja 'peers' cai em Transformadores).
  const wegTab      = tab === 'peers' ? 'peers' : 'transformadores';

  const PT_MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const _now = new Date();
  const currentMonthSub = `Dashboard · ${PT_MONTHS[_now.getMonth()]}/${String(_now.getFullYear()).slice(2)}`;
  const sectionTitle = dashboardSection === 'macro'
    ? 'Macro'
    : dashboardSection === 'capitalgoods'
    ? 'Capital Goods'
    : 'Proteínas';

  const Chevron = ({ open }) => (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.45, flexShrink: 0, transition: 'transform 0.18s ease', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <path d="M4 2l4 4-4 4"/>
    </svg>
  );

  const GroupHeader = ({ groupId, icon, label, labelStyle, isActive }) => (
    <div className="sidebar-group-header" onClick={() => toggleGroup(groupId)}
      role="button" tabIndex={0} aria-expanded={openGroup.has(groupId)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(groupId); } }}
      style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          className={`sidebar-item-icon${isActive ? ' is-icon-breathing' : ''}`}
          style={isActive ? undefined : { color: 'var(--fg-dim)', opacity: 0.6 }}
        >{icon}</span>
        <span style={labelStyle}>{label}</span>
      </div>
      <Chevron open={openGroup.has(groupId)}/>
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className={`sidebar-brand-logobox${logoPulse ? ' is-refresh-pulse' : ''}`}>
          <div className="sidebar-brand-logo-surface" style={isPoultry ? {background:'oklch(0.83 0.20 88)'} : {}}>
            <img src="./xp-asset-logo.svg" alt="XP Asset Management" className="sidebar-brand-logo"
              style={isPoultry ? {filter:'brightness(0)'} : {}}/>
          </div>
        </div>
        <div className="sidebar-brand-row">
          <button className="sidebar-back-btn" onClick={goHome} title="Voltar ao início" aria-label="Voltar ao início">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 7.2 8 2.5l5.5 4.7M4 6v6.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V6"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">{sectionTitle}</div>
            <div className="sidebar-brand-sub">{currentMonthSub}</div>
          </div>
        </div>
      </div>

      {dashboardSection === 'proteinas' && <div className="sidebar-section">
        <button className={`sidebar-item ${isUS ? 'is-on' : ''}`} onClick={() => onPick('beef_us')}>
          <span className={`sidebar-item-icon${isUS ? ' is-icon-breathing' : ''}`}>{SIcon.cow}</span>
          <span className="sidebar-item-label" style={{textTransform:'uppercase', letterSpacing:'0.1em', fontSize:11}}>Beef US</span>
        </button>

        <div className="sidebar-group" style={{marginTop:6}}>
          <GroupHeader groupId="beef_br" icon={SIcon.cow} label="Beef BR" isActive={isBR}/>
          {openGroup.has('beef_br') && (<>
            <button className={`sidebar-item ${isBR && tab==='precos' ? 'is-on' : ''}`} onClick={() => onPick('beef_br', 'precos')}>
              <span className="sidebar-item-icon">{SIcon.bar}</span>
              <span className="sidebar-item-label">Preços & Spreads</span>
            </button>
            <button className={`sidebar-item ${isBR && tab==='abates' ? 'is-on' : ''}`} onClick={() => onPick('beef_br', 'abates')}>
              <span className="sidebar-item-icon">{SIcon.abates}</span>
              <span className="sidebar-item-label">Produção</span>
            </button>
          </>)}
        </div>

        <div className="sidebar-group" style={{marginTop:6}}>
          <GroupHeader groupId="poultry_br" icon={SIcon.chicken} label="Poultry BR" isActive={isPoultry}/>
          {openGroup.has('poultry_br') && (<>
            <button className={`sidebar-item ${isPoultry && tab==='precos' ? 'is-on' : ''}`} onClick={() => onPick('poultry_br', 'precos')}>
              <span className="sidebar-item-icon">{SIcon.bar}</span>
              <span className="sidebar-item-label">Preços & Spreads</span>
            </button>
            <button className={`sidebar-item ${isPoultry && tab==='abates' ? 'is-on' : ''}`} onClick={() => onPick('poultry_br', 'abates')}>
              <span className="sidebar-item-icon">{SIcon.abates}</span>
              <span className="sidebar-item-label">Produção</span>
            </button>
            <button className={`sidebar-item ${isPoultry && tab==='ipca' ? 'is-on' : ''}`} onClick={() => onPick('poultry_br', 'ipca')}>
              <span className="sidebar-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </span>
              <span className="sidebar-item-label">Processados</span>
            </button>
          </>)}
        </div>

        <div className="sidebar-group" style={{marginTop:6}}>
          <GroupHeader groupId="poultry_us" icon={SIcon.chicken} isActive={isPoultryUS}
            label="Poultry US" labelStyle={{textTransform:'uppercase', letterSpacing:'0.08em', fontSize:11}}/>
          {openGroup.has('poultry_us') && (<>
            <button className={`sidebar-item ${isPoultryUS && tab==='precos' ? 'is-on' : ''}`} onClick={() => onPick('poultry_us', 'precos')}>
              <span className="sidebar-item-icon">{SIcon.bar}</span>
              <span className="sidebar-item-label">Preços & Spreads</span>
            </button>
            <button className={`sidebar-item ${isPoultryUS && tab==='producao' ? 'is-on' : ''}`} onClick={() => onPick('poultry_us', 'producao')}>
              <span className="sidebar-item-icon">{SIcon.abates}</span>
              <span className="sidebar-item-label">Produção</span>
            </button>
          </>)}
        </div>
      </div>}

      {dashboardSection !== 'proteinas' && <div style={{display:'flex', flexDirection:'column', gap:2}}>
        <div className="sidebar-section-label" style={{paddingTop:0}}>
          {dashboardSection === 'macro' ? 'Cenário' : 'Empresas'}
        </div>
        {dashboardSection === 'macro' && <button className={`sidebar-item ${isMacro ? 'is-on' : ''}`} onClick={() => onPick('macro')}>
          <span className={`sidebar-item-icon${isMacro ? ' is-icon-breathing' : ''}`}>{SIcon.globe}</span>
          <span className="sidebar-item-label" style={{textTransform:'uppercase', letterSpacing:'0.1em', fontSize:11}}>MACRO</span>
        </button>}
        {dashboardSection === 'capitalgoods' && <>
          <div className="sidebar-group">
            <GroupHeader groupId="weg" icon={SIcon.weg} isActive={isWeg}
              label="WEG" labelStyle={{textTransform:'uppercase', letterSpacing:'0.1em', fontSize:11}}/>
            {openGroup.has('weg') && (<>
              <button className={`sidebar-item ${isWeg && wegTab==='transformadores' ? 'is-on' : ''}`} onClick={() => onPick('weg', 'transformadores')}>
                <span className="sidebar-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7z"/>
                  </svg>
                </span>
                <span className="sidebar-item-label">Transformadores</span>
              </button>
              <button className={`sidebar-item ${isWeg && wegTab==='peers' ? 'is-on' : ''}`} onClick={() => onPick('weg', 'peers')}>
                <span className="sidebar-item-icon">{SIcon.bar}</span>
                <span className="sidebar-item-label">Peers</span>
              </button>
            </>)}
          </div>
          <button className={`sidebar-item ${isEmbraer ? 'is-on' : ''}`} style={{marginTop:6}} onClick={() => onPick('embraer')}>
            <span className={`sidebar-item-icon${isEmbraer ? ' is-icon-breathing' : ''}`}>{SIcon.embraer}</span>
            <span className="sidebar-item-label" style={{textTransform:'uppercase', letterSpacing:'0.1em', fontSize:11}}>Embraer</span>
            <span className="sidebar-soon">em breve</span>
          </button>
          <button className={`sidebar-item ${isMarcopolo ? 'is-on' : ''}`} onClick={() => onPick('marcopolo')}>
            <span className={`sidebar-item-icon${isMarcopolo ? ' is-icon-breathing' : ''}`}>{SIcon.marcopolo}</span>
            <span className="sidebar-item-label" style={{textTransform:'uppercase', letterSpacing:'0.1em', fontSize:11}}>Marcopolo</span>
            <span className="sidebar-soon">em breve</span>
          </button>
        </>}
      </div>}

      <div className="sidebar-spacer"/>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Base de Dados</div>
        <SidebarRefresh onLoad={onUpload} dataset={activeDataset}/>
      </div>
    </aside>
  );
}

// ============================ Busca global ============================
// Realça um card com pulso na cor de destaque (Web Animations API)
function rxHighlightCard(el) {
  if (!el) return;
  const accentRaw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  if (el._rxCardAnim) { try { el._rxCardAnim.cancel(); } catch (_) {} }
  el._rxCardAnim = el.animate([
    { boxShadow: `0 0 0 0 color-mix(in oklch, ${accentRaw} 60%, transparent)` },
    { boxShadow: `0 0 0 10px color-mix(in oklch, ${accentRaw} 0%, transparent)`, offset: 0.6 },
    { boxShadow: '0 0 0 0 transparent' },
  ], { duration: 1400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'none' });
}

function GlobalSearch({ onNavigate }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return searchCatalog(q).slice(0, 8);
  }, [q]);
  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Atalho "/" foca a busca
  useEffect(() => {
    const h = e => {
      const tag = ((document.activeElement && document.activeElement.tagName) || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') {
        e.preventDefault(); setOpen(true); if (inputRef.current) inputRef.current.focus();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const choose = (r) => {
    if (!r) return;
    onNavigate(r);
    setQ(''); setOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); if (inputRef.current) inputRef.current.blur(); }
  };

  return (
    <div className="rx-search" ref={wrapRef}>
      <svg className="rx-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
      </svg>
      <input ref={inputRef} className="rx-search-input" type="text" placeholder="Buscar aba ou gráfico…"
        value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} aria-label="Buscar"/>
      {open && q.trim() && (
        <div className="rx-search-results">
          {results.length === 0 ? (
            <div className="rx-search-empty">Nada encontrado</div>
          ) : results.map((r, i) => (
            <button key={r.dataset + '/' + r.tab + '/' + (r.cardId || '') + i}
              className={`rx-search-item ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}>
              <span className="rx-search-item-label">{r.label}</span>
              <span className="rx-search-item-crumb">{r.breadcrumb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Ícones do toggle de tema (Claro / Escuro) — mostra o estado atual
const MODE_ICON = {
  light:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
  dark:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>,
};
const MODE_LABEL = { light: 'Tema: Claro · clique p/ Escuro', dark: 'Tema: Escuro · clique p/ Claro' };

function TopBar({ meta, onUpload, activeDataset, colorMode = 'dark', onCycleMode, onNavigate, dashboardSection }) {
  const title  = activeDataset === 'macro' ? 'MACRO' : activeDataset === 'weg' ? 'WEG' : activeDataset === 'embraer' ? 'EMBRAER' : activeDataset === 'marcopolo' ? 'MARCOPOLO' : (activeDataset === 'poultry_br' || activeDataset === 'poultry_us') ? 'POULTRY' : 'BEEF';
  const suffix = (activeDataset === 'macro' || activeDataset === 'weg' || activeDataset === 'embraer' || activeDataset === 'marcopolo') ? '' : (activeDataset === 'beef_us' || activeDataset === 'poultry_us') ? 'US' : 'BR';
  const currentMeta = activeDataset === 'beef_us'
    ? (meta?.us ?? null)
    : activeDataset === 'poultry_br'
    ? (meta?.poultry_br ?? null)
    : activeDataset === 'poultry_us'
    ? (meta?.poultry_us ?? null)
    : activeDataset === 'macro'
    ? (meta?.selic ?? null)
    : activeDataset === 'weg'
    ? (meta?.weg ?? null)
    : (activeDataset === 'embraer' || activeDataset === 'marcopolo')
    ? null
    : (meta?.br ?? (meta?.updated ? meta : null));
  return (
    <header className="topbar topbar-slim">
      <div className="topbar-title">
        <h1 style={{ color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          {title} <span style={{ color: 'var(--accent)' }}>{suffix}</span>
        </h1>
      </div>
      <div className="topbar-spacer"/>
      <div className="topbar-actions">
        <GlobalSearch onNavigate={onNavigate}/>
        <button className="topbar-mode-btn" onClick={onCycleMode}
          title={MODE_LABEL[colorMode]} aria-label={MODE_LABEL[colorMode]}>
          {MODE_ICON[colorMode]}
        </button>
        <RefreshWidget onLoad={onUpload} dataset={activeDataset} lastUpdate={currentMeta?.updated} currentSource={currentMeta?.source}/>
      </div>
    </header>
  );
}

// ---------------- Preços Tab ----------------
function PrecosTab({ data, accent }) {
  return (
    <main className="main">
      <DailySeasonalCard
        data={data} accent={accent}
        dailyKey="carne_mi_daily" usdDailyKey="carne_mi_usd_daily"
        cardId="card-carne-mi"
        title="Preço Carne · Mercado Interno" sub="Bloomberg · BAMTCACA Index"
        unit="R$/kg" usdUnit="US$/kg" decimals={2}
      />

      <PriceCard cardId="card-carne-me" title="Preço Carne · Mercado Externo" sub="SECEX · Preço Carne Exportação"
        accent={accent} data={data} dataset="beef"
        field="beef_me_brl_kg" usdField="beef_me_usd_kg"
        unit="R$/kg" usdUnit="US$/kg" hasUSD decimals={2}/>

      <DailySeasonalCard
        data={data} accent={accent}
        dailyKey="boi_gordo_daily" cardId="card-cattle"
        title="Preço Boi Gordo" sub="Bloomberg · BACAINDX Index"
        unit="BRL/@" decimals={2}
      />

      <div className="section-header"><h2>Spreads</h2></div>

      <DailySeasonalCard
        data={data} accent={accent}
        dailyKey="spread_mi_daily" cardId="card-spread-mi"
        title="Spread MI" sub="Cálculo próprio · Preço Carne MI − Preço Boi"
        unit="R$/kg" decimals={2}
      />

      <div className="grid-spreads">
        <PriceCard cardId="card-spread-me" title="Spread ME" sub="Cálculo próprio · Preço Carne ME − Preço Boi"
          accent={accent} data={data} dataset="beef"
          field="spread_me" unit="R$/kg" decimals={2}/>
      </div>
    </main>
  );
}

// ---------------- Abates Tab ----------------
function AbatesTab({ data, accent }) {
  const [abatesSource, setAbatesSource] = useState('sidra');
  const [showEventsCiclo, setShowEventsCiclo] = useState(true);
  const abatesDataset = abatesSource === 'sidra' ? 'abates' : 'beef';
  const abatesField   = abatesSource === 'sidra' ? 'total'  : 'abates_total';
  const abatesSub     = abatesSource === 'sidra' ? 'SIDRA · Cabeças abatidas' : 'SIF · Cabeças abatidas';

  return (
    <main className="main">
      <PriceCard
        key={`abates-${abatesSource}`}
        cardId="card-abates"
        title="Abates Totais" sub={abatesSub}
        accent={accent} data={data}
        dataset={abatesDataset} field={abatesField}
        unit="cab." big fullWidth
        headerExtra={
          <div className="seg" style={{marginBottom: 4}}>
            <button className={`seg-btn ${abatesSource==='sidra'?'is-on':''}`} onClick={() => setAbatesSource('sidra')}>SIDRA</button>
            <button className={`seg-btn ${abatesSource==='sif'?'is-on':''}`} onClick={() => setAbatesSource('sif')}>SIF</button>
          </div>
        }
      />

      <section className="card card-full" data-card-id="card-ciclo">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">SIF · Ciclo pecuário</div>
            <h3 className="card-title">Ciclo do Boi</h3>
            <div className="card-sub">Série mensal + média móvel 12 meses (MM12)</div>
          </div>
          <div className="card-controls" style={{alignSelf:'center'}}>
            <div className="ctrl-btn-group">
              <button className={`ctrl-btn ${showEventsCiclo ? 'is-on' : ''}`} onClick={() => setShowEventsCiclo(v => !v)}>EVENTOS</button>
            </div>
          </div>
        </div>
        <CicloDoBoi data={data} accent={accent} events={EVENTS || []} showEvents={showEventsCiclo}/>
      </section>

      <PriceCard
        cardId="card-femeas"
        title="% Fêmeas no Abate" sub="SIF · sazonal mês-a-mês"
        accent={accent} data={data}
        dataset="beef" field="pct_femeas"
        unit="%" decimals={0}/>

    </main>
  );
}

// ---------------- Toggle ----------------
function Toggle({ label, value, onChange, disabled }) {
  return (
    <label className="toggle" style={disabled ? {opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none'} : {}}>
      <span className={`toggle-box ${value && !disabled ? 'is-on' : ''}`}>
        {value && !disabled && <svg viewBox="0 0 10 10" width="10" height="10"><path d="M2,5 L4,7 L8,3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>}
      </span>
      <input type="checkbox" checked={value && !disabled} onChange={e => onChange(e.target.checked)} disabled={disabled} style={{display:'none'}}/>
      <span>{label}</span>
    </label>
  );
}

// ---------------- TweaksPanel ----------------
function TweaksPanel({ tweaks, updateTweak }) {
  // Painel aberto → carrega as fontes alternativas p/ os previews de tipografia
  useEffect(() => { Object.keys(FONT_STACK_URLS).forEach(ensureFontStack); }, []);
  return (
    <aside className="tweaks">
      <div className="tweaks-head">
        <div className="tweaks-title">Tweaks</div>
        <div className="tweaks-sub">Ajustes em tempo real</div>
      </div>
      <div className="tweak-block">
        <div className="tweak-label">Tema</div>
        {ThemePicker && <ThemePicker value={tweaks.theme || 'refined'} onChange={(v) => updateTweak('theme', v)}/>}
      </div>
      <div className="tweak-block">
        <div className="tweak-label">Paleta (accent)</div>
        <div className="swatch-row">
          {Object.entries(PALETTES).map(([k, p]) => (
            <button key={k} className={`swatch ${tweaks.palette===k?'is-on':''}`} onClick={() => updateTweak('palette', k)}>
              <span className="swatch-dot" style={{background: p.accent}}/>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tweak-block">
        <div className="tweak-label">Tipografia</div>
        <div className="type-list">
          {Object.entries(TYPE_STACKS).map(([k, t]) => (
            <button key={k} className={`type-btn ${tweaks.typography===k?'is-on':''}`}
              onClick={() => updateTweak('typography', k)} style={{fontFamily: t.sans}}>
              <span>{t.name}</span>
              <span className="type-sample" style={{fontFamily: t.mono}}>R$ 285,42</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tweak-block">
        <div className="tweak-label">Densidade</div>
        <div className="seg-inline">
          {[['compact','Compacta'],['comfortable','Confortável']].map(([v, l]) => (
            <button key={v} className={`seg-btn ${tweaks.density===v?'is-on':''}`} onClick={() => updateTweak('density', v)}>{l}</button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ---------------- TickerBar ----------------
// Maps each ticker symbol → the data-card-id of the chart card it represents.
// The card itself sets that data-card-id (see PriceCard / AbatesTab below).
function TickerBar({ data, activeDataset }) {
  const trackRef = useRef(null);
  const hoveredRef = useRef(false);
  const posRef = useRef(0);
  const velRef = useRef(0.8);
  const requestRef = useRef();

  const items = useMemo(() => {
    if (activeDataset === 'macro' || activeDataset === 'embraer' || activeDataset === 'marcopolo') return [];
    const ds = activeDataset === 'beef_us'    ? 'beef_us'
             : activeDataset === 'poultry_br'  ? 'frango'
             : activeDataset === 'poultry_us'  ? 'frango_us_daily'
             : activeDataset === 'weg'         ? 'weg_peers'
             : 'beef';
    if (!data[ds] || !data[ds].length) return [];
    // [sym, field, unit, cardTarget, dsOverride?]
    const fields = activeDataset === 'weg'
      ? [
          ['WEG',           'weg',          'USD',    'card-weg-peers'],
          ['WEG·P/E',       'weg_pe',       'x',      'card-weg-peers-pe'],
          ['TRANSFORM.',    'value',        'Índice', 'card-weg-transformadores', 'weg_transformadores'],
          ['ABB',           'abb',          'USD',    'card-weg-peers'],
          ['EATON',         'eaton',        'USD',    'card-weg-peers'],
          ['SIEMENS',       'siemens',      'USD',    'card-weg-peers'],
          ['SCHNEIDER',     'schneider',    'USD',    'card-weg-peers'],
        ]
      : activeDataset === 'beef_us'
      ? [
          ['EDGEBEEF',    'edgebeef_value',       '$/cwt',   'us-edgebeef'],
          ['%FÊMEAS',     'pct_femeas',           '%',       'us-ciclo'],
          ['USD/BRL',     'usdbrl',               'R$',      null],
          ['ABATES',      'abates_total',         'cab',     'us-production'],
          ['BOI',         'preco_boi',            '¢/lb',    'us-ciclo'],
          ['BEZERRO',     'preco_bezerro',        '¢/lb',    'us-ciclo'],
        ]
      : activeDataset === 'poultry_us'
      ? [
          ['BBG·PROXY',    'proxy',                 'USD/kg',  'us-frango-price'],
          ['BBG·FEED',     'feed_grain',            'USD/kg',  'us-feed-grain'],
          ['BBG·SPREAD',   'spread',                'USD/kg',  'us-spread'],
          ['BBG·PTY/BEEF', 'poultry_beef_ratio',    'x',       'us-poultry-beef'],
          ['CHICKS·PL',    'chicks_placed',         '000',     'us-chicks-placed'],
          ['SLAUGHTER',    'abates_frango',         '000',     'us-abates-frango'],
          ['PRODUÇÃO',     'producao',              'Ton',     'us-producao'],
        ]
      : activeDataset === 'poultry_br'
      ? [
          ['FRANGO·MI',   'frango_mi_brl_kg',     'R$/kg',   'card-frango-mi'],
          ['FRANGO·ME',   'frango_me_brl_kg',     'R$/kg',   'card-frango-me'],
          ['FEED·GRAIN',  'feed_grain_brl_kg',    'R$/kg',   'card-feed-grain'],
          ['SPREAD·MI',   'spread_mi',            'R$/kg',   'card-spread-mi-frango'],
          ['SPREAD·ME',   'spread_me',            'R$/kg',   'card-spread-me-frango'],
          ['ABATES·SIF',  'abates_sif',           'cab',     'card-abates-frango'],
          ['CHICK·PL',    'chick_placed',         'cab',     'card-chick-placed'],
          ['PROCESSADOS', 'ipca_base100',         'Base 100','card-ipca-processados', 'processados'],
        ]
      : [
          ['BOI',         'cattle_brl_kg',        'R$/kg',   'card-cattle'],
          ['CARNE·MI',    'beef_carcass_brl_kg',  'R$/kg',   'card-carne-mi'],
          ['CARNE·ME',    'beef_me_brl_kg',       'R$/kg',   'card-carne-me'],
          ['SPREAD·MI',   'spread_mi',            'R$/kg',   'card-spread-mi'],
          ['SPREAD·ME',   'spread_me',            'R$/kg',   'card-spread-me'],
          ['USD/BRL',     'usdbrl',               'R$',      null],
          ['ABATES',      'abates_total',         'cab',     'card-abates'],
          ['%FÊMEAS',     'pct_femeas',           '%',       'card-femeas'],
        ];
    return fields.map(([sym, f, u, target, dsOverride]) => {
      const rows = data[dsOverride || ds] || [];
      let last = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][f] != null) { last = rows[i]; break; }
      }
      if (!last) return null;
      const v = last[f];
      let prev = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][f] != null && rows[i].year === last.year - 1 && rows[i].month === last.month) {
          prev = rows[i]; break;
        }
      }
      const p = prev?.[f];
      const delta = (p == null || p === 0) ? null : (v - p) / Math.abs(p);
      return { sym, value: v, unit: u, delta, field: f, target };
    }).filter(Boolean);
  }, [data, activeDataset]);

  const COPIES = 4; // cópias suficientes para sempre ter buffer à direita
  const oneWidthRef = useRef(0); // largura de uma cópia, medida após mount

  // Reset posição e largura sempre que o dataset mudar — evita o "tilt"
  // causado por oneWidthRef desatualizado ao trocar de aba
  useEffect(() => {
    posRef.current = 0;
    oneWidthRef.current = 0;
  }, [activeDataset]);

  const animate = useCallback(() => {
    if (!trackRef.current) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    const targetVel = hoveredRef.current ? 0 : 0.8;
    velRef.current += (targetVel - velRef.current) * 0.04;
    if (hoveredRef.current && velRef.current < 0.001) velRef.current = 0;

    posRef.current -= velRef.current;

    // Mede a largura de uma cópia na primeira vez (ou após reset de dataset)
    if (oneWidthRef.current === 0 && trackRef.current.scrollWidth > 0) {
      oneWidthRef.current = trackRef.current.scrollWidth / COPIES;
    }
    // while em vez de if: corrige qualquer drift acumulado no mesmo frame
    while (oneWidthRef.current > 0 && posRef.current <= -oneWidthRef.current) {
      posRef.current += oneWidthRef.current;
    }

    trackRef.current.style.transform = `translateX(${posRef.current.toFixed(2)}px)`;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Usuário pediu menos movimento → ticker fica parado (conteúdo continua visível)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const onMouseEnter = () => { hoveredRef.current = true; };
  const onMouseLeave = () => { hoveredRef.current = false; };

  const onItemClick = (target) => {
    if (!target) return;
    const el = document.querySelector(`[data-card-id="${target}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      // Web Animations API — sem manipular classes CSS, sem interferir com rx-fade-up
      const accentRaw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (el._rxCardAnim) { try { el._rxCardAnim.cancel(); } catch (_) {} }
      el._rxCardAnim = el.animate([
        { boxShadow: `0 0 0 0 color-mix(in oklch, ${accentRaw} 60%, transparent)` },
        { boxShadow: `0 0 0 10px color-mix(in oklch, ${accentRaw} 0%, transparent)`, offset: 0.6 },
        { boxShadow: '0 0 0 0 transparent' },
      ], { duration: 1400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'none' });
    } else {
      window.dispatchEvent(new CustomEvent('rx-goto-card', { detail: { target } }));
      setTimeout(() => {
        const el2 = document.getElementById(target);
        if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  if (!items.length) return null;
  const tape = Array.from({ length: COPIES }, () => items).flat();
  return (
    <div className="rx-ticker" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="rx-ticker-track" ref={trackRef} style={{animation: 'none'}}>
        {tape.map((it, i) => {
          const fmt = (it.unit === 'cab' || it.unit === '000' || it.unit === 'Ton')
                      ? Math.round(it.value).toLocaleString('pt-BR') :
                      it.unit === '%' ? it.value.toFixed(1) :
                      it.value.toFixed(2).replace('.', ',');
          const dir = it.delta == null ? '' : it.delta >= 0 ? 'is-up' : 'is-down';
          const arrow = it.delta == null ? '' : it.delta >= 0 ? '▲' : '▼';
          const pct = it.delta == null ? '' : ((it.delta >= 0 ? '+' : '') + (it.delta * 100).toFixed(2) + '%');
          return (
            <span className="rx-ticker-item" key={i}
                  onClick={() => onItemClick(it.target)}
                  title={it.target ? 'Ir para o gráfico' : ''}>
              <span className="rx-ticker-symbol">{it.sym}</span>
              <span className="rx-ticker-value">{fmt}</span>
              <span style={{color:'var(--fg-mute)', fontSize:10}}>{it.unit}</span>
              {it.delta != null && (
                <span className={`rx-ticker-delta ${dir}`}>{arrow} {pct}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { App };
export default App;
