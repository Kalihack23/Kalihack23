// Liste de valeurs façon app Bourse d'Apple :
//  symbole en gras, nom en gris, mini-courbe de séance, pastille verte/rouge.
//  Toucher une pastille fait défiler l'affichage : variation % → prix → capitalisation (comme sur iOS).
//  La liste se retrie en douceur (animation FLIP) au fil des cotations.
import { gsap } from 'gsap';
import { COMPANIES, domainById } from '../data/companies.js';
import { miniChartSVG } from '../viz/historyChart.js';
import { fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';
import { capOf, isStale } from '../data/derived.js';
import { marketStatus } from '../data/markets.js';
import { createSegmented } from './glass.js';
import { onThemeChange } from './theme.js';

const PILL_MODES = ['pct', 'price', 'cap'];

export function createWatchlist(el, store, { onSelect, account, onSortChange } = {}) {
  const listed = COMPANIES.filter((c) => c.listed);
  let sort = 'change';
  let pillMode = 'pct';
  let filter = { domains: null, query: '' };
  let selected = null;
  let onlyMine = false;

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  el.innerHTML = `
    <header class="wl-head">
      <div>
        <h2>Valeurs</h2>
        <p class="wl-date" id="wl-date">${dateFmt.format(new Date())}</p>
      </div>
      <div class="wl-head-right">
        <button type="button" class="wl-mine" id="wl-mine" aria-pressed="false" title="N’afficher que les valeurs suivies">★ Ma liste</button>
        <span class="wl-count" id="wl-count"></span>
      </div>
    </header>
    <div class="wl-sort" id="wl-sort"></div>
    <ul class="wl-list" id="wl-list" aria-label="Valeurs"></ul>`;
  const ul = el.querySelector('#wl-list');
  // La date suit le jour (si la page reste ouverte après minuit).
  setInterval(() => { el.querySelector('#wl-date').textContent = dateFmt.format(new Date()); }, 60000);

  const sortSeg = createSegmented(el.querySelector('#wl-sort'), {
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
      onSortChange?.(id);
    },
  });

  const mineBtn = el.querySelector('#wl-mine');
  mineBtn.addEventListener('click', () => {
    onlyMine = !onlyMine;
    mineBtn.setAttribute('aria-pressed', String(onlyMine));
    reorder(true);
  });

  const rows = new Map();
  for (const co of listed) {
    const li = document.createElement('li');
    li.className = 'wl-row';
    // Deux boutons frères (pas de bouton dans un bouton) : la ligne ouvre la fiche, la pastille change l'affichage.
    li.innerHTML = `
      <button class="wl-main" type="button" aria-label="${co.name} (${co.ticker}) — ouvrir la fiche">
        <span class="wl-id"><b>${co.ticker}</b><small>${co.name}</small></span>
        <span class="wl-spark" aria-hidden="true"></span>
      </button>
      <button class="wl-star" type="button" aria-pressed="false" aria-label="Suivre ${co.name}">☆</button>
      <button class="wl-pill" type="button" title="Changer l’affichage (%, prix, capitalisation)"></button>`;
    li.style.setProperty('--dc', domainById[co.domain].color);
    li.querySelector('.wl-main').addEventListener('click', () => onSelect?.(co));
    li.querySelector('.wl-star').addEventListener('click', async (e) => {
      e.stopPropagation();
      const on = await account?.toggleWatch(co.ticker);
      if (!reducedMotion) gsap.fromTo(e.currentTarget, { scale: 0.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' });
      if (on === false && onlyMine) reorder(true);
    });
    li.querySelector('.wl-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      pillMode = PILL_MODES[(PILL_MODES.indexOf(pillMode) + 1) % PILL_MODES.length];
      for (const r of rows.values()) paint(r, false);
      // Petit rebond de toutes les pastilles, comme sur iOS.
      if (!reducedMotion) gsap.fromTo(ul.querySelectorAll('.wl-pill'), { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', stagger: 0.004 });
    });
    ul.appendChild(li);
    rows.set(co.ticker, { co, li, pill: li.querySelector('.wl-pill'), star: li.querySelector('.wl-star'), spark: li.querySelector('.wl-spark'), lastSpark: -Infinity });
  }

  function pillText(q, co) {
    if (pillMode === 'price') return fmtPrice(q.price, q.currency);
    if (pillMode === 'cap') return fmtCap(capOf(co, q));
    return fmtPct(q.changePct);
  }

  function paint(r, flash) {
    const q = store.get(r.co.ticker);
    const stale = isStale(store, q);
    const status = marketStatus(r.co, q);
    r.pill.textContent = stale && pillMode === 'pct' ? '—' : pillText(q, r.co);
    r.pill.classList.toggle('down', q.changePct < 0);
    r.pill.classList.toggle('stale', stale);
    r.pill.setAttribute('aria-label', stale ? `${r.co.ticker} : cours non actualisé` : `${r.co.ticker} : ${r.pill.textContent} — changer l’affichage`);
    // L'état du marché n'a de sens qu'avec des données réelles (en démo, les cours bougent en permanence).
    const live = store.mode === 'live';
    r.li.classList.toggle('closed', live && status !== 'open');
    r.li.title = stale ? 'Cours non actualisé (aucune source pour cette bourse)' : live && status !== 'open' ? 'Marché fermé' : '';
    const now = performance.now();
    // Mini-courbes : redessinées au plus toutes les 2 s par ligne.
    if (now - r.lastSpark > 2000 && q.history.length > 1) {
      r.spark.innerHTML = miniChartSVG(q.history.slice(-60), q.prevClose);
      r.lastSpark = now;
    }
    if (flash && q.dir && !reducedMotion) {
      r.pill.animate([{ filter: 'brightness(1.45)' }, { filter: 'none' }], { duration: 800, easing: 'ease-out' });
    }
  }

  const visible = (co) => {
    if (onlyMine && !account?.isWatched(co.ticker)) return false;
    if (filter.domains && !filter.domains.has(co.domain)) return false;
    const q = filter.query;
    return !q || co.ticker.toLowerCase().includes(q) || co.name.toLowerCase().includes(q) || domainById[co.domain].name.toLowerCase().includes(q);
  };

  // Tri avec animation FLIP : les lignes glissent vers leur nouvelle place.
  function reorder(animate) {
    const sorted = [...rows.values()].sort((a, b) => {
      if (sort === 'name') return a.co.name.localeCompare(b.co.name, 'fr');
      if (sort === 'cap') return capOf(b.co, store.get(b.co.ticker)) - capOf(a.co, store.get(a.co.ticker));
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
    ul.dataset.empty = onlyMine && !n ? 'Touchez ☆ pour suivre une valeur' : '';
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
  // Thème changé : mini-courbes redessinées aux nouvelles couleurs.
  onThemeChange(() => {
    for (const r of rows.values()) { r.lastSpark = -Infinity; paint(r, false); }
  });
  // Retri périodique par variation (évite que la liste « saute » à chaque cotation).
  setInterval(() => { if (sort === 'change' && !el.matches(':hover')) reorder(true); }, 4000);

  // Étoiles : reflètent la liste de suivi du compte.
  function paintStars() {
    for (const r of rows.values()) {
      const on = !!account?.isWatched(r.co.ticker);
      r.star.textContent = on ? '★' : '☆';
      r.star.classList.toggle('on', on);
      r.star.setAttribute('aria-pressed', String(on));
      r.star.setAttribute('aria-label', `${on ? 'Ne plus suivre' : 'Suivre'} ${r.co.name}`);
    }
    if (onlyMine) reorder(false);
  }
  account?.onChange((ev) => { if (ev.type === 'change' || ev.type === 'signin' || ev.type === 'signout') paintStars(); });
  paintStars();

  return {
    setSort(id) {
      if (id && id !== sort) sortSeg.select(id, { emit: false });
      if (id) { sort = id; reorder(true); }
    },
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
