// Bandeau défilant des cours (contenu dupliqué pour une boucle sans couture).
import { COMPANIES } from '../data/companies.js';
import { arrow, colorFor, fmtPct, fmtPrice, reducedMotion } from '../util.js';
import { isStale } from '../data/derived.js';
import { onThemeChange } from './theme.js';

export function createTicker(el, store, { onSelect } = {}) {
  const listed = COMPANIES.filter((c) => c.listed).sort((a, b) => b.cap - a.cap);
  const items = new Map();

  for (let pass = 0; pass < 2; pass++) {
    for (const co of listed) {
      const node = document.createElement('span');
      node.className = 'tape-item';
      if (pass === 1) node.setAttribute('aria-hidden', 'true'); // 2e copie : uniquement pour la boucle visuelle
      node.innerHTML = `<b>${co.ticker}</b><span class="px"></span><span class="pct"></span>`;
      node.addEventListener('click', () => onSelect?.(co));
      el.appendChild(node);
      if (!items.has(co.ticker)) items.set(co.ticker, []);
      items.get(co.ticker).push(node);
    }
  }

  function paint(q, flash) {
    const nodes = items.get(q.ticker);
    if (!nodes) return;
    for (const node of nodes) {
      node.children[1].textContent = fmtPrice(q.price, q.currency);
      const pct = node.children[2];
      const stale = isStale(store, q);
      pct.textContent = stale ? '—' : `${arrow(q.changePct)} ${fmtPct(q.changePct)}`;
      pct.style.color = stale ? 'var(--text-3)' : colorFor(q.changePct * 2);
      // Flash via Web Animations : pas de recalcul de mise en page forcé (offsetWidth) à chaque cotation.
      if (flash && q.dir && !reducedMotion && node.isConnected) {
        node.animate(
          [{ backgroundColor: `color-mix(in srgb, var(${q.dir > 0 ? '--up' : '--down'}) 20%, transparent)` }, { backgroundColor: 'transparent' }],
          { duration: 900, easing: 'ease-out' },
        );
      }
    }
  }

  // Vitesse constante façon bandeau de Wall Street (~55 px/s, 40 sur mobile), quelle que soit la longueur.
  const tape = el.parentElement;
  function setSpeed() {
    const half = el.scrollWidth / 2;
    if (!half) return;
    const pxPerSec = window.innerWidth < 760 ? 40 : 55;
    el.style.animationDuration = `${(half / pxPerSec).toFixed(1)}s`;
  }
  new ResizeObserver(setSpeed).observe(tape);
  document.fonts?.ready.then(setSpeed);
  setSpeed();

  for (const q of store.quotes.values()) paint(q, false);
  store.subscribe((q) => paint(q, true));
  onThemeChange(() => { for (const q of store.quotes.values()) paint(q, false); });
}
