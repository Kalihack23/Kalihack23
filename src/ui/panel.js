// Infobulle au survol + panneau de détail (mis à jour en direct).
import { gsap } from 'gsap';
import { domainById } from '../data/companies.js';
import { sparklineSVG } from '../viz/sparkline.js';
import { renderHistoryChart } from '../viz/historyChart.js';
import { fetchHistory, fetchNews } from '../data/history.js';
import { arrow, colorFor, fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';

const COUNTRY = { US: 'États-Unis', TW: 'Taïwan', NL: 'Pays-Bas', GB: 'Royaume-Uni', IE: 'Irlande', DE: 'Allemagne', CH: 'Suisse', FR: 'France', KR: 'Corée du Sud', JP: 'Japon', CN: 'Chine', IN: 'Inde' };

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
    return `<div class="tt-head"><b>${co.ticker}</b><span class="tt-pct" style="color:${c}">${arrow(q.changePct)} ${fmtPct(q.changePct)}</span></div>
      <div class="tt-name">${co.name} · <span style="color:${dom.color}">${dom.short}</span></div>
      <div class="tt-px">${fmtPrice(q.price, q.currency)}</div>
      ${sparklineSVG(q.history, { width: 190, height: 40, color: c, baseline: q.prevClose })}`;
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

const RANGES = [
  ['live', 'Séance'],
  ['5d', '5 J'],
  ['1mo', '1 M'],
  ['6mo', '6 M'],
  ['1y', '1 A'],
];

const rel = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(t) {
  const s = (t - Date.now()) / 1000;
  if (Math.abs(s) < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rel.format(Math.round(s / 3600), 'hour');
  return rel.format(Math.round(s / 86400), 'day');
}
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function createPanel(el, body, closeBtn, store, { onClose } = {}) {
  let current = null;
  let range = 'live';
  let reqId = 0;
  const shown = { price: 0 };

  function render(co) {
    const dom = domainById[co.domain];
    const q = store.get(co.ticker);
    const listed = co.listed;
    const c = listed ? colorFor(q.changePct) : dom.color;
    body.innerHTML = `
      <span class="p-domain"><i style="background:${dom.color};box-shadow:0 0 8px ${dom.color}"></i>${dom.name}</span>
      <h2 class="p-title">${esc(co.name)}</h2>
      <div class="p-ticker">${listed ? `${co.ticker}${co.symbol !== co.ticker ? ` · ${co.symbol}` : ''}` : 'Non coté'} · ${COUNTRY[co.country] || co.country}${listed ? ` · ${co.currency}` : ''}</div>
      <div class="p-price" id="p-price">${listed ? fmtPrice(q.price, q.currency) : fmtCap(co.cap)}</div>
      <div class="p-change" id="p-change" style="color:${c}">${listed ? `${arrow(q.changePct)} ${fmtPct(q.changePct)} aujourd’hui` : 'Valorisation privée estimée'}</div>
      ${listed ? `<div id="p-src">${srcBadge(q)}</div>
      <div class="p-tabs" role="tablist">${RANGES.map(([id, label]) => `<button role="tab" data-range="${id}" class="${id === range ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div class="p-chart" id="p-chart"></div>
      <div class="p-perf" id="p-perf"></div>` : ''}
      <p class="p-role">${esc(co.role)}</p>
      <div class="p-grid">
        ${listed ? `<div class="p-cell"><span>Clôture veille</span><b id="p-prev">${fmtPrice(q.prevClose, q.currency)}</b></div>` : ''}
        <div class="p-cell"><span>${listed ? 'Capitalisation' : 'Valorisation'}</span><b id="p-cap">${fmtCap(listed ? co.cap * (q.price / q.prevClose) : co.cap)}</b></div>
        ${listed ? `<div class="p-cell"><span>Volatilité (an.)</span><b>${Math.round(co.vol * 100)} %</b></div>` : ''}
        <div class="p-cell"><span>Domaine</span><b style="color:${dom.color}">${dom.short}</b></div>
      </div>
      <section class="p-news">
        <h3>Actualités</h3>
        <ul id="p-news"><li class="p-empty">Chargement…</li></ul>
      </section>
      <p class="p-note">Capitalisations et valorisations approximatives, données à titre informatif — pas un conseil en investissement.</p>`;
    shown.price = q.price;

    body.querySelectorAll('.p-tabs button').forEach((b) => b.addEventListener('click', () => {
      range = b.dataset.range;
      body.querySelectorAll('.p-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      drawChart(true);
    }));
    if (listed) drawChart(true);
    loadNews(co);
  }

  async function drawChart(animate) {
    const co = current;
    const chart = body.querySelector('#p-chart');
    const perf = body.querySelector('#p-perf');
    if (!co || !chart) return;
    const q = store.get(co.ticker);
    if (range === 'live') {
      const pts = q.history.map((p, i) => [i, p]);
      renderHistoryChart(chart, pts, { color: colorFor(q.changePct), currency: q.currency, baseline: q.prevClose, mode: 'live', animate });
      perf.textContent = '';
      return;
    }
    const id = ++reqId;
    chart.classList.add('loading');
    const data = await fetchHistory(co, range, q.price);
    if (id !== reqId || current !== co) return;
    chart.classList.remove('loading');
    const pts = data.points;
    const first = pts[0][1];
    const last = pts[pts.length - 1][1];
    const pct = ((last - first) / first) * 100;
    renderHistoryChart(chart, pts, { color: colorFor(pct / 3), currency: data.currency || q.currency, mode: range === '5d' ? 'intraday' : 'day', animate });
    const label = RANGES.find((r) => r[0] === range)[1];
    perf.innerHTML = `Sur ${label.replace(' ', ' ')} : <b style="color:${colorFor(pct / 3)}">${arrow(pct)} ${fmtPct(pct)}</b>${data.simulated ? ' <span class="p-sim">· historique simulé (démo)</span>' : ''}`;
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
          ${n.thumb ? `<img src="${esc(n.thumb)}" alt="" loading="lazy" />` : '<span class="p-news-dot"></span>'}
          <span><b>${esc(n.title)}</b><small>${esc(n.publisher)} · ${ago(n.time)}</small></span>
        </a></li>`).join('');
      if (!reducedMotion) gsap.from(ul.children, { opacity: 0, x: 16, stagger: 0.06, duration: 0.5, ease: 'power3.out' });
    } catch {
      if (current === co) ul.innerHTML = '<li class="p-empty">Les actualités s’affichent une fois le site déployé (Vercel).</li>';
    }
  }

  function update(q) {
    const priceEl = body.querySelector('#p-price');
    if (!priceEl) return;
    const c = colorFor(q.changePct);
    gsap.to(shown, {
      price: q.price,
      duration: reducedMotion ? 0 : 0.8,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => { priceEl.textContent = fmtPrice(shown.price, q.currency); },
    });
    const chEl = body.querySelector('#p-change');
    chEl.textContent = `${arrow(q.changePct)} ${fmtPct(q.changePct)} aujourd’hui`;
    chEl.style.color = c;
    body.querySelector('#p-src').innerHTML = srcBadge(q);
    body.querySelector('#p-prev').textContent = fmtPrice(q.prevClose, q.currency);
    body.querySelector('#p-cap').textContent = fmtCap(current.cap * (q.price / q.prevClose));
    if (range === 'live') drawChart(false);
  }

  function open(co) {
    current = co;
    render(co);
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    if (!reducedMotion) {
      gsap.fromTo(body.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out', delay: 0.1 });
    }
  }

  function close() {
    current = null;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    onClose?.();
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
  store.subscribe((q) => { if (current && current.listed && current.ticker === q.ticker) update(q); });

  return { open, close, get current() { return current; } };
}
