import React from 'react'

// =========================================================================
// REACTIVE — small runtime that adds: ripple coordinates, ticker bar,
// flash on value change, live dot, count-up entry, crosshair on charts,
// and a Theme switcher React component.
// =========================================================================

(function () {
  // --- Ripple coords for buttons (CSS reads --rx-x / --rx-y) -------------
  const rippleSelectors = '.tab, .seg-btn, .year-seg-btn, .ctrl-btn, .preset-btn, .cur-btn, .year-chip, .swatch, .type-btn, .upload-btn, .rx-theme-card';
  document.addEventListener('mousedown', (e) => {
    const t = e.target.closest(rippleSelectors);
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--rx-x', ((e.clientX - r.left) / r.width * 100) + '%');
    t.style.setProperty('--rx-y', ((e.clientY - r.top)  / r.height * 100) + '%');
  });

  // --- Flash card-value when its text changes ---------------------------
  const valueObservers = new WeakMap();
  function attachValueWatcher(node) {
    if (valueObservers.has(node)) return;
    let prev = node.textContent;
    let prevNum = parseFloat(prev.replace(/[^\d.,-]/g, '').replace(',', '.'));
    const obs = new MutationObserver(() => {
      const cur = node.textContent;
      if (cur === prev) return;
      const curNum = parseFloat(cur.replace(/[^\d.,-]/g, '').replace(',', '.'));
      node.classList.remove('rx-flash-up', 'rx-flash-down');
      // force reflow so animation restarts
      void node.offsetWidth;
      if (!isNaN(prevNum) && !isNaN(curNum)) {
        node.classList.add(curNum >= prevNum ? 'rx-flash-up' : 'rx-flash-down');
      }
      prev = cur;
      prevNum = curNum;
    });
    obs.observe(node, { childList: true, characterData: true, subtree: true });
    valueObservers.set(node, obs);
  }
  // --- Stroke length (--len) for chart line draw-on ----------------------
  // Sem polling: um MutationObserver único mede apenas paths novos (childList)
  // ou cujo `d` mudou (attributeFilter) — getTotalLength() força layout, então
  // só roda quando o gráfico realmente muda, agrupado num requestAnimationFrame.
  function measurePath(p) {
    p.__rxLenMeasured = true;
    try {
      const len = p.getTotalLength();
      if (len > 0) p.style.setProperty('--len', len);
    } catch {}
  }

  const dirtyPaths = new Set();
  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      document.querySelectorAll('.card-value').forEach(attachValueWatcher);
      document.querySelectorAll('.chart-svg path[stroke]:not([stroke="transparent"])').forEach(p => {
        if (!p.__rxLenMeasured) measurePath(p);
      });
      dirtyPaths.forEach(p => { if (p.isConnected) measurePath(p); });
      dirtyPaths.clear();
    });
  }

  const rootObs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') dirtyPaths.add(m.target);
    }
    scheduleScan();
  });
  const startObserver = () => {
    rootObs.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['d'],
    });
    scheduleScan();
  };
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  // --- Crosshair on chart hover -----------------------------------------
  let crosshairSvg = null; // svg com crosshair ativo — evita query em todo mousemove
  const hideCrosshair = (svg) => {
    const v = svg && svg.querySelector('.rx-crosshair');
    if (v) v.style.opacity = 0;
  };
  document.addEventListener('mousemove', (e) => {
    const svg = e.target.closest('.chart-svg');
    if (!svg) {
      if (crosshairSvg) { hideCrosshair(crosshairSvg); crosshairSvg = null; }
      return;
    }
    if (crosshairSvg && crosshairSvg !== svg) hideCrosshair(crosshairSvg);
    crosshairSvg = svg;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal;
    if (!vb) return;
    const px = (e.clientX - rect.left) / rect.width * vb.width;
    let v = svg.querySelector('.rx-crosshair');
    if (!v) {
      v = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      v.setAttribute('class', 'rx-crosshair');
      v.setAttribute('y1', 14);
      v.setAttribute('y2', vb.height - 32);
      svg.appendChild(v);
    }
    v.setAttribute('x1', px);
    v.setAttribute('x2', px);
    v.style.opacity = (px > 56 && px < vb.width - 64) ? 0.9 : 0;
  });
})();

// =========================================================================
// THEMES list & React component (consumed by TweaksPanel)
// =========================================================================
window.THEMES = {
  flux:      { name: 'Obsidian Flux', sub: 'Design base · Claro/Escuro', accent: 'oklch(0.82 0.18 155)' },
  refined:   { name: 'Refined',      sub: 'Linear · Vercel',         accent: 'oklch(0.82 0.18 155)' },
  terminal:  { name: 'Terminal',     sub: 'Bloomberg · Mono',        accent: 'oklch(0.86 0.20 95)'  },
  aurora:    { name: 'Aurora',       sub: 'Glass · Gradients',       accent: 'oklch(0.78 0.18 290)' },
  neon:      { name: 'Neon HUD',     sub: 'Cyber · Glow',            accent: 'oklch(0.85 0.20 195)' },
  brutalist: { name: 'Brutalist',    sub: 'Hard edge',               accent: 'oklch(0.88 0.22 95)'  },
  editorial: { name: 'Editorial',    sub: 'Display · Hierarchy',     accent: 'oklch(0.78 0.17 30)'  },
  ember:     { name: 'Ember',        sub: 'Laranja · Quente',        accent: 'oklch(0.76 0.20 45)'  },
};

// Mini SVG preview for each theme card
window.ThemePreview = function ThemePreview({ theme }) {
  const t = window.THEMES[theme];
  const styles = {
    flux: {
      background: 'linear-gradient(135deg, #121316, #1f1f23)',
      accent: t.accent
    },
    refined: {
      background: 'linear-gradient(135deg, oklch(0.16 0.006 260), oklch(0.22 0.012 260))',
      accent: t.accent
    },
    terminal: {
      background: 'oklch(0.12 0.005 250)',
      accent: t.accent,
      pattern: 'repeating-linear-gradient(0deg, transparent 0 2px, oklch(1 0 0 / 0.04) 2px 3px)'
    },
    aurora: {
      background: 'radial-gradient(ellipse 80% 80% at 30% 0%, oklch(0.58 0.25 290 / 0.5), transparent), radial-gradient(ellipse 80% 60% at 80% 100%, oklch(0.62 0.22 200 / 0.4), transparent), oklch(0.14 0.02 280)',
      accent: t.accent
    },
    neon: {
      background: 'oklch(0.10 0.012 230)',
      accent: t.accent,
      pattern: 'repeating-linear-gradient(0deg, transparent 0 3px, oklch(1 0 0 / 0.03) 3px 4px)'
    },
    brutalist: {
      background: 'oklch(0.08 0 0)',
      accent: t.accent
    },
    editorial: {
      background: 'oklch(0.15 0.004 280)',
      accent: t.accent
    },
    ember: {
      background: 'radial-gradient(ellipse 80% 80% at 15% 0%, oklch(0.55 0.22 45 / 0.55), transparent), radial-gradient(ellipse 70% 60% at 85% 100%, oklch(0.50 0.18 30 / 0.40), transparent), oklch(0.13 0.018 45)',
      accent: t.accent
    }
  }[theme];
  return React.createElement('div', {
    className: 'rx-theme-preview',
    style: {
      background: styles.background,
      position: 'relative'
    }
  },
    styles.pattern && React.createElement('div', {
      style: { position: 'absolute', inset: 0, background: styles.pattern, pointerEvents: 'none' }
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        bottom: 4,
        left: 6, right: 6,
        height: 3,
        background: theme === 'brutalist' ? styles.accent : `linear-gradient(90deg, transparent, ${styles.accent}, transparent)`,
        borderRadius: theme === 'brutalist' ? 0 : 2,
        boxShadow: theme === 'neon' ? `0 0 8px ${styles.accent}` : 'none'
      }
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 6, left: 6,
        width: 6, height: 6,
        borderRadius: theme === 'brutalist' ? 0 : '50%',
        background: styles.accent,
        boxShadow: theme === 'neon' ? `0 0 6px ${styles.accent}` : 'none'
      }
    })
  );
};

// Theme picker React component (used inside the TweaksPanel)
window.ThemePicker = function ThemePicker({ value, onChange }) {
  return React.createElement('div', { className: 'rx-theme-grid' },
    Object.entries(window.THEMES).map(([k, t]) =>
      React.createElement('button', {
        key: k,
        className: `rx-theme-card ${value === k ? 'is-on' : ''}`,
        onClick: () => onChange(k)
      },
        React.createElement(window.ThemePreview, { theme: k }),
        React.createElement('div', null,
          React.createElement('div', { className: 'rx-theme-name' }, t.name),
          React.createElement('div', { className: 'rx-theme-sub' }, t.sub)
        )
      )
    )
  );
};
