// Liste de valeurs façon app Bourse d'Apple :
//  symbole en gras, nom en gris, mini-courbe de séance, pastille verte/rouge.
//  Toucher une pastille fait défiler l'affichage : variation % → prix → capitalisation (comme sur iOS).
//  La liste se retrie en douceur (animation FLIP) au fil des cotations.
import { gsap } from 'gsap';
import { COMPANIES, domainById } from '../data/companies.js';
import { miniChartSVG } from '../viz/historyChart.js';
import { fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';
import { createSegmented } from './glass.js';

const PILL_MODES = ['pct', 'price', 'cap'];

export function createWatchlist(el, store, { onSelect } = {}) {
  const listed = COMPANIES.filter((c) => c.listed);
  let sort = 'change';
  let pillMode = 'pct';
  let filter = { domains: null, query: '' };
  let selected = null;

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  el.innerHTML = `
    <header class="wl-head">
      <div>
        <h2>Valeurs</h2>
        <p class="wl-date">${dateFmt.format(new Date())}</p>
      </div>
      <span class="wl-count" id="wl-count"></span>
    </header>
    <div class="wl-sort" id="wl-sort"></div>
    <ul class="wl-list" id="wl-list" role="listbox" aria-label="Valeurs"></ul>`;
  const ul = el.querySelector('#wl-list');

  createSegmented(el.querySelector('#wl-sort'), {
    label: 'Tri',
    value: sort,
    items: [
      { id: 'change', label: 'Variation' },
      { id: 'cap', label: 'Capitalisation' },
      { id: 'name', label: 'A–Z' },
    ],
    onChange: (id) => {
      sort = id;
      reorder(true);
    },
  });

  const rows = new Map();
  for (const co of listed) {
    const li = document.createElement('li');
    li.className = 'wl-row';
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.innerHTML = `
      <span class="wl-id"><b>${co.ticker}</b><small>${co.name}</small></span>
      <span class="wl-spark"></span>
      <button class="wl-pill" type="button" title="Changer l’affichage (%, prix, capitalisation)"></button>`;
    li.style.setProperty('--dc', domainById[co.domain].color);
    li.addEventListener('click', () => onSelect?.(co));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSelect?.(co); });
    li.querySelector('.wl-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      pillMode = PILL_MODES[(PILL_MODES.indexOf(pillMode) + 1) % PILL_MODES.length];
      for (const r of rows.values()) paint(r, false);
      // Petit rebond de toutes les pastilles, comme sur iOS.
      if (!reducedMotion) gsap.fromTo(ul.querySelectorAll('.wl-pill'), { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', stagger: 0.004 });
    });
    ul.appendChild(li);
    rows.set(co.ticker, { co, li, pill: li.querySelector('.wl-pill'), spark: li.querySelector('.wl-spark'), lastSpark: -Infinity });
  }

  function pillText(q, co) {
    if (pillMode === 'price') return fmtPrice(q.price, q.currency);
    if (pillMode === 'cap') return fmtCap(co.cap * (q.price / q.prevClose));
    return fmtPct(q.changePct);
  }

  function paint(r, flash) {
    const q = store.get(r.co.ticker);
    r.pill.textContent = pillText(q, r.co);
    r.pill.classList.toggle('down', q.changePct < 0);
    const now = performance.now();
    // Mini-courbes : redessinées au plus toutes les 2 s par ligne.
    if (now - r.lastSpark > 2000 && q.history.length > 1) {
      r.spark.innerHTML = miniChartSVG(q.history.slice(-60), q.prevClose);
      r.lastSpark = now;
    }
    if (flash && q.dir && !reducedMotion) {
      r.pill.classList.remove('flash');
      void r.pill.offsetWidth;
      r.pill.classList.add('flash');
    }
  }

  const visible = (co) => {
    if (filter.domains && !filter.domains.has(co.domain)) return false;
    const q = filter.query;
    return !q || co.ticker.toLowerCase().includes(q) || co.name.toLowerCase().includes(q) || domainById[co.domain].name.toLowerCase().includes(q);
  };

  // Tri avec animation FLIP : les lignes glissent vers leur nouvelle place.
  function reorder(animate) {
    const sorted = [...rows.values()].sort((a, b) => {
      if (sort === 'name') return a.co.name.localeCompare(b.co.name, 'fr');
      if (sort === 'cap') return b.co.cap - a.co.cap;
      return store.get(b.co.ticker).changePct - store.get(a.co.ticker).changePct;
    });
    const before = new Map();
    if (animate && !reducedMotion) for (const r of sorted) before.set(r, r.li.getBoundingClientRect().top);
    let n = 0;
    for (const r of sorted) {
      const show = visible(r.co);
      r.li.hidden = !show;
      if (show) n++;
      ul.appendChild(r.li);
    }
    el.querySelector('#wl-count').textContent = `${n}`;
    if (animate && !reducedMotion) {
      for (const r of sorted) {
        if (r.li.hidden) continue;
        const dy = before.get(r) - r.li.getBoundingClientRect().top;
        if (Math.abs(dy) > 1 && Math.abs(dy) < 2000) gsap.fromTo(r.li, { y: dy }, { y: 0, duration: 0.6, ease: 'power3.out', overwrite: true });
      }
    }
  }

  for (const r of rows.values()) paint(r, false);
  reorder(false);

  store.subscribe((q) => {
    const r = rows.get(q.ticker);
    if (r) paint(r, true);
  });
  // Retri périodique par variation (évite que la liste « saute » à chaque cotation).
  setInterval(() => { if (sort === 'change' && !el.matches(':hover')) reorder(true); }, 4000);

  return {
    setFilter({ activeDomains, query }) {
      filter = { domains: activeDomains, query: (query || '').trim().toLowerCase() };
      reorder(false);
    },
    setSelected(ticker) {
      if (selected) rows.get(selected)?.li.classList.remove('selected');
      selected = ticker;
      if (ticker) rows.get(ticker)?.li.classList.add('selected');
    },
  };
}
