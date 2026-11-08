// Infobulle au survol + panneau de détail (mis à jour en direct).
import { gsap } from 'gsap';
import { domainById } from '../data/companies.js';
import { miniChartSVG, renderHistoryChart, scrubLabel } from '../viz/historyChart.js';
import { capIsEstimate, capOf, isStale } from '../data/derived.js';
import { STATUS_LABEL, exchangeOf, marketStatus } from '../data/markets.js';
import { fetchHistory, fetchKnowledge, fetchNews } from '../data/history.js';
import { createSegmented } from './glass.js';
import { onThemeChange } from './theme.js';
import { arrow, colorFor, fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';

const COUNTRY = { US: 'États-Unis', TW: 'Taïwan', NL: 'Pays-Bas', GB: 'Royaume-Uni', IE: 'Irlande', DE: 'Allemagne', CH: 'Suisse', FR: 'France', KR: 'Corée du Sud', JP: 'Japon', CN: 'Chine', IN: 'Inde', CA: 'Canada', AU: 'Australie', IL: 'Israël', IT: 'Italie' };

export function createTooltip(el, store) {
  let current = null;

  function html(co) {
    const dom = domainById[co.domain];
    if (!co.listed) {
      return `<div class="tt-head"><b>${co.name}</b><span style="color:${dom.color}">●</span></div>
        <div class="tt-name">${dom.name}</div>
        <div class="tt-px">${fmtCap(co.cap)}</div>
        <div class="tt-name">Valorisation privée estimée · non cotée</div>`;
    }
    const q = store.get(co.ticker);
    const c = colorFor(q.changePct);
    const stale = isStale(store, q);
    const status = marketStatus(co, q);
    return `<div class="tt-head"><b>${co.ticker}</b><span class="tt-pct" style="color:${stale ? 'var(--text-2)' : c}">${stale ? '—' : `${arrow(q.changePct)} ${fmtPct(q.changePct)}`}</span></div>
      <div class="tt-name">${co.name} · <span style="color:${dom.color}">${dom.short}</span></div>
      <div class="tt-px">${fmtPrice(q.price, q.currency)}</div>
      ${stale ? '<div class="tt-name">Cours non actualisé</div>' : store.mode === 'live' ? `<div class="tt-name">${STATUS_LABEL[status]}</div>` : ''}
      ${stale ? '' : miniChartSVG(q.history.slice(-80), q.prevClose, { width: 190, height: 40 })}`;
  }

  function show(co, ev) {
    if (current !== co) {
      current = co;
      el.innerHTML = html(co);
    }
    const pad = 16;
    const r = el.getBoundingClientRect();
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.add('show');
  }

  function hide() {
    current = null;
    el.classList.remove('show');
  }

  store.subscribe((q) => {
    if (current && current.ticker === q.ticker) el.innerHTML = html(current);
  });

  return { show, hide };
}

const SRC_LABEL = {
  rt: ['live', 'Temps réel'],
  api: ['delayed', 'Différé ~1 min'],
  sim: ['sim', 'Simulé (démo)'],
};
const srcBadge = (q) => {
  const [cls, txt] = SRC_LABEL[q.src] || ['ref', 'Prix de référence'];
  return `<span class="p-src ${cls}"><i></i>${txt}</span>`;
};

// Périodes, avec les libellés de l'app Bourse.
const RANGES = [
  ['live', '1J', 'Aujourd’hui'],
  ['5d', '1S', 'Sur 1 semaine'],
  ['1mo', '1M', 'Sur 1 mois'],
  ['6mo', '6M', 'Sur 6 mois'],
  ['1y', '1A', 'Sur 1 an'],
];

const rel = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(t) {
  const s = (t - Date.now()) / 1000;
  if (Math.abs(s) < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rel.format(Math.round(s / 3600), 'hour');
  return rel.format(Math.round(s / 86400), 'day');
}
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const numFmt = (v, cur) => fmtPrice(v, cur).replace(/\s?[^\d\s,.\u202f-]+$/u, '').trim();
const signed = (v, cur) => `${v >= 0 ? '+' : '−'}${numFmt(Math.abs(v), cur)}`;

export function createPanel(el, body, closeBtn, store, { onClose } = {}) {
  let current = null;
  let range = 'live';
  let reqId = 0;
  let scrubbing = false;
  let period = null; // { first, last, ref, label } pour la période affichée
  const shown = { price: 0 };

  function stat(label, value, id = '') {
    return `<div class="p-stat"><span>${label}</span><b${id ? ` id="${id}"` : ''}>${value}</b></div>`;
  }

  // Haut / bas : données de marché si disponibles, sinon cours reçus pendant la séance.
  function sessionHiLo(q) {
    const h = q.history.length ? q.history : [q.price];
    return [q.high ? Math.max(q.high, q.price) : Math.max(...h, q.price), q.low ? Math.min(q.low, q.price) : Math.min(...h, q.price)];
  }
  const fmtVol = (v) => (v ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : '—');
  const capText = (co, q) => `${capIsEstimate(co, q) ? '≈ ' : ''}${fmtCap(capOf(co, q))}`;
  function paintMarket(co, q) {
    const el2 = body.querySelector('#p-market');
    if (!el2) return;
    if (isStale(store, q)) {
      el2.textContent = 'Cours non actualisé';
      el2.className = 'p-market stale';
      return;
    }
    if (store.mode !== 'live') {
      el2.textContent = '';
      el2.className = 'p-market';
      el2.hidden = true;
      return;
    }
    el2.hidden = false;
    const st = marketStatus(co, q);
    el2.textContent = STATUS_LABEL[st];
    el2.className = `p-market ${st}`;
  }

  function render(co) {
    const dom = domainById[co.domain];
    const q = store.get(co.ticker);
    const listed = co.listed;
    const [hi, lo] = sessionHiLo(q);
    body.innerHTML = `
      <header class="p-head">
        <h2 class="p-symbol">${listed ? esc(co.ticker) : esc(co.name)}</h2>
        <div class="p-name">${listed ? `${esc(co.name)} · ` : ''}<span style="color:${dom.color}">${dom.short}</span></div>
      </header>
      <div class="p-quote">
        <div class="p-price-row"><span class="p-price" id="p-price">${listed ? numFmt(q.price, q.currency) : fmtCap(co.cap)}</span>${listed ? `<span class="p-cur">${co.currency}</span>` : ''}</div>
        ${listed ? `<div class="p-change" id="p-change"></div>
        <div class="p-when"><span id="p-when">Aujourd’hui</span> · <span id="p-src">${srcBadge(q)}</span><span class="p-market-wrap"> · <span id="p-market"></span></span></div>` : '<div class="p-when">Valorisation privée estimée · non coté</div>'}
      </div>
      ${listed ? `<div class="p-tabs glass" id="p-tabs"></div>
      <div class="p-chart" id="p-chart"></div>
      <div class="p-sim" id="p-sim"></div>
      <div class="p-stats">
        <div>${stat('Ouverture', q.open ? numFmt(q.open, q.currency) : '—', 'p-open')}${stat('Haut', numFmt(hi, q.currency), 'p-hi')}${stat('Bas', numFmt(lo, q.currency), 'p-lo')}${stat('Clôture veille', numFmt(q.prevClose, q.currency), 'p-prev')}${stat('Volume', fmtVol(q.volume), 'p-vol')}</div>
        <div>${stat('Cap. boursière', capText(co, q), 'p-cap')}${stat('Volatilité (an.)', `${Math.round(co.vol * 100)} %`)}${stat('Devise', co.currency)}${stat('Pays', COUNTRY[co.country] || co.country)}${stat('Place', exchangeOf(co)?.name || '—')}</div>
      </div>` : `<div class="p-stats single"><div>${stat('Valorisation', fmtCap(co.cap))}${stat('Pays', COUNTRY[co.country] || co.country)}${stat('Domaine', dom.short)}</div></div>`}
      <section class="p-section">
        <h3>À propos</h3>
        <p class="p-role">${esc(co.role)}</p>
        <div id="p-about" class="p-about"></div>
      </section>
      <section class="p-section p-news">
        <h3>Actualités</h3>
        <ul id="p-news"><li class="p-empty">Chargement…</li></ul>
      </section>
      <p class="p-note">Capitalisations et valorisations approximatives, données à titre informatif — pas un conseil en investissement.</p>`;
    shown.price = q.price;

    const tabs = body.querySelector('#p-tabs');
    if (tabs) {
      createSegmented(tabs, {
        label: 'Période',
        value: range,
        items: RANGES.map(([id, label]) => ({ id, label })),
        onChange: (id) => {
          range = id;
          drawChart(true);
        },
      });
    }
    if (listed) {
      paintMarket(co, q);
      drawChart(true);
    }
    loadNews(co);
    loadAbout(co);
  }

  // En-tête : prix, variation (valeur et %) et libellé de période / date survolée.
  function paintHeader({ price, ref, label, animate = false }) {
    const q = store.get(current.ticker);
    const priceEl = body.querySelector('#p-price');
    const chEl = body.querySelector('#p-change');
    const whenEl = body.querySelector('#p-when');
    if (!priceEl || !chEl) return;
    const diff = price - ref;
    const pct = (diff / ref) * 100;
    if (animate && !reducedMotion) {
      gsap.to(shown, {
        price,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => { priceEl.textContent = numFmt(shown.price, q.currency); },
      });
    } else {
      gsap.killTweensOf(shown);
      shown.price = price;
      priceEl.textContent = numFmt(price, q.currency);
    }
    chEl.textContent = `${signed(diff, q.currency)} (${fmtPct(pct)})`;
    chEl.style.color = diff >= 0 ? 'var(--up)' : 'var(--down)';
    whenEl.textContent = label;
  }

  function restoreHeader(animate = false) {
    if (!current || !period) return;
    const q = store.get(current.ticker);
    const price = range === 'live' ? q.price : period.last;
    paintHeader({ price, ref: period.ref, label: period.label, animate });
  }

  // Alternative textuelle du graphique pour les lecteurs d'écran.
  function describeChart(chart, co, from, to, cur, period) {
    const svgEl = chart.querySelector('svg');
    if (!svgEl || !from) return;
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', `Cours de ${co.name} ${period} : de ${fmtPrice(from, cur)} à ${fmtPrice(to, cur)} (${fmtPct(((to - from) / from) * 100)}).`);
  }

  async function drawChart(animate) {
    const co = current;
    const chart = body.querySelector('#p-chart');
    const simEl = body.querySelector('#p-sim');
    if (!co || !chart) return;
    const q = store.get(co.ticker);
    const label = RANGES.find((r) => r[0] === range)[2];
    const onScrub = (pt) => {
      scrubbing = !!pt;
      if (!pt) return restoreHeader();
      paintHeader({ price: pt.price, ref: period.ref, label: scrubLabel(pt.t, range === 'live' ? 'live' : range === '5d' ? 'intraday' : 'day') });
    };
    if (range === 'live') {
      const pts = q.history.map((p, i) => [i, p]);
      const r = renderHistoryChart(chart, pts, { currency: q.currency, baseline: q.prevClose, mode: 'live', range, animate, onScrub });
      period = { ...r, ref: q.prevClose, label };
      describeChart(chart, co, q.prevClose, q.price, q.currency, 'aujourd’hui');
      simEl.textContent = '';
      if (!scrubbing) restoreHeader();
      return;
    }
    const id = ++reqId;
    chart.classList.add('loading');
    const data = await fetchHistory(co, range, q.price);
    if (id !== reqId || current !== co) return;
    chart.classList.remove('loading');
    const r = renderHistoryChart(chart, data.points, { currency: data.currency || q.currency, mode: range === '5d' ? 'intraday' : 'day', range, animate, onScrub });
    period = { ...r, ref: r.first, label };
    describeChart(chart, co, r.first, r.last, data.currency || q.currency, label.toLowerCase());
    simEl.textContent = data.simulated ? 'Historique simulé (démo)' : '';
    restoreHeader(true);
  }

  // Données ouvertes : résumé Wikipedia, fiche Wikidata et résultats SEC (invisibles si indisponibles).
  async function loadAbout(co) {
    const k = await fetchKnowledge(co);
    const box = body.querySelector('#p-about');
    if (!k || current !== co || !box) return;
    const f = k.wiki?.facts || {};
    const nfmt = new Intl.NumberFormat('fr-FR');
    const bn = (v) => `${(v / 1e9).toFixed(v >= 1e11 ? 0 : 1).replace('.', ',')}\u00a0Md$`;
    const rows = [
      f.ceo && stat('PDG', esc(f.ceo)),
      f.hq && stat('Siège', esc(f.hq)),
      f.founded && stat('Création', esc(f.founded)),
      f.employees && stat('Employés', `${nfmt.format(f.employees.value)}${f.employees.year ? ` <small>(${esc(f.employees.year)})</small>` : ''}`),
      k.sec?.revenue && stat('CA annuel (SEC)', bn(k.sec.revenue.value)),
      k.sec?.netIncome && stat('Résultat net (SEC)', bn(k.sec.netIncome.value)),
      k.sec?.quarter && stat('Dernier trimestre', `${bn(k.sec.quarter.value)}${k.sec.quarter.yoy != null ? ` <small>(${k.sec.quarter.yoy >= 0 ? '+' : '−'}${Math.abs(k.sec.quarter.yoy).toFixed(0)}\u00a0%)</small>` : ''}`),
    ].filter(Boolean);
    const summary = k.wiki?.summary ? `<p class="p-wiki">${esc(k.wiki.summary)} ${k.wiki.url ? `<a href="${esc(k.wiki.url)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>` : ''}</p>` : '';
    const filing = k.sec?.filings?.[0] ? `<p class="p-filing">Dernier rapport officiel : <a href="${esc(k.sec.filings[0].url)}" target="_blank" rel="noopener noreferrer">${esc(k.sec.filings[0].form)} du ${esc(k.sec.filings[0].date)}</a></p>` : '';
    if (!summary && !rows.length) return;
    box.innerHTML = `${summary}${rows.length ? `<div class="p-stats single p-facts"><div>${rows.join('')}</div></div>` : ''}${filing}`;
    if (!reducedMotion) gsap.from(box, { opacity: 0, y: 8, duration: 0.5, ease: 'power3.out' });
  }

  async function loadNews(co) {
    const ul = body.querySelector('#p-news');
    try {
      const items = await fetchNews(co);
      if (current !== co) return;
      if (!items.length) {
        ul.innerHTML = '<li class="p-empty">Aucune actualité récente.</li>';
        return;
      }
      ul.innerHTML = items.slice(0, 5).map((n) => `
        <li><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
          <span class="p-news-text"><small class="p-news-src">${esc(n.publisher)}</small><b>${esc(n.title)}</b><small>${ago(n.time)}</small></span>
          ${n.thumb ? `<img src="${esc(n.thumb)}" alt="" loading="lazy" />` : ''}
        </a></li>`).join('');
      if (!reducedMotion) gsap.from(ul.children, { opacity: 0, y: 10, stagger: 0.05, duration: 0.5, ease: 'power3.out' });
    } catch {
      if (current === co) ul.innerHTML = '<li class="p-empty">Les actualités s’affichent une fois le site déployé (Vercel).</li>';
    }
  }

  function update(q) {
    if (!body.querySelector('#p-price')) return;
    const [hi, lo] = sessionHiLo(q);
    body.querySelector('#p-src').innerHTML = srcBadge(q);
    body.querySelector('#p-prev').textContent = numFmt(q.prevClose, q.currency);
    body.querySelector('#p-hi').textContent = numFmt(hi, q.currency);
    body.querySelector('#p-lo').textContent = numFmt(lo, q.currency);
    body.querySelector('#p-cap').textContent = capText(current, q);
    body.querySelector('#p-open').textContent = q.open ? numFmt(q.open, q.currency) : '—';
    body.querySelector('#p-vol').textContent = fmtVol(q.volume);
    paintMarket(current, q);
    // Pendant le scrubbing, on ne touche ni à la courbe ni à l'en-tête.
    if (range === 'live' && !scrubbing) {
      drawChart(false);
      paintHeader({ price: q.price, ref: q.prevClose, label: RANGES[0][2], animate: true });
    }
  }

  let lastFocus = null;
  el.inert = true;
  el.removeAttribute('aria-hidden');

  function open(co) {
    if (!current) lastFocus = document.activeElement;
    current = co;
    scrubbing = false;
    render(co);
    el.classList.add('open');
    el.inert = false;
    el.removeAttribute('aria-hidden');
    el.scrollTop = 0;
    if (!reducedMotion) {
      gsap.fromTo(body.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out', delay: 0.1 });
    }
    // Le focus clavier passe dans la fiche (Échap la ferme et le rend à l'élément d'origine).
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 50);
  }

  function close() {
    current = null;
    el.classList.remove('open');
    // Panneau fermé : retiré du clavier et des lecteurs d'écran.
    el.inert = true;
    onClose?.();
    lastFocus?.focus?.();
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
  store.subscribe((q) => { if (current && current.listed && current.ticker === q.ticker) update(q); });
  // Thème changé : on redessine la courbe avec les nouvelles couleurs.
  onThemeChange(() => { if (current && current.listed) drawChart(false); });

  return { open, close, get current() { return current; } };
}
