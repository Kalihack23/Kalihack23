import './styles.css';
import { gsap } from 'gsap';
import { COMPANIES, DOMAINS } from './data/companies.js';
import { createFinnhubProvider, createSimProvider, createStore } from './data/feed.js';
import { createGalaxy } from './viz/galaxy.js';
import { createTicker } from './ui/ticker.js';
import { createMovers } from './ui/movers.js';
import { createPanel, createTooltip } from './ui/panel.js';
import { createSettings, getApiKey } from './ui/settings.js';
import { createStars } from './ui/stars.js';
import { colorFor, fmtCap, fmtPct, reducedMotion } from './util.js';

const $ = (id) => document.getElementById(id);
const store = createStore();
const listed = COMPANIES.filter((c) => c.listed);

/* ---------- Source de données ---------- */
let provider = null;
let lastLiveTick = 0;

function setStatus(mode, text) {
  $('status').dataset.mode = mode;
  $('status-text').textContent = text;
}

function startDemo(reason) {
  provider?.stop();
  provider = createSimProvider(store);
  provider.start();
  setStatus(reason === 'error' ? 'error' : 'demo', reason === 'error' ? 'Clé invalide · DÉMO simulée' : 'DÉMO · cours simulés');
}

function startLive(key) {
  provider?.stop();
  provider = createFinnhubProvider(store, key, {
    onStatus: (s) => {
      if (s === 'loading') setStatus('live', 'LIVE · chargement…');
      if (s === 'live') setStatus('live', 'LIVE · Finnhub');
      if (s === 'reconnecting') setStatus('error', 'Reconnexion…');
    },
  });
  provider.start().catch(() => startDemo('error'));
}

function startFeed() {
  const key = getApiKey();
  if (key) startLive(key);
  else startDemo();
}

// En live, si aucun échange depuis 1 min, le marché US est probablement fermé.
store.subscribe(() => { if (provider?.mode === 'live') lastLiveTick = Date.now(); });
setInterval(() => {
  if (provider?.mode === 'live' && $('status').dataset.mode === 'live' && Date.now() - lastLiveTick > 60000) {
    setStatus('live', 'LIVE · marché calme/fermé');
  }
}, 10000);

startFeed();

/* ---------- Vues ---------- */
createStars($('stars'));

const tooltip = createTooltip($('tooltip'), store);
let galaxy;
const panel = createPanel($('panel'), $('panel-body'), $('panel-close'), store, {
  onClose: () => galaxy?.setSelected(null),
});

function select(co) {
  tooltip.hide();
  galaxy.setSelected(co.ticker);
  panel.open(co);
}

galaxy = createGalaxy($('viz'), store, {
  onSelect: select,
  onHover: (co, ev) => tooltip.show(co, ev),
  onLeave: () => tooltip.hide(),
  onBackground: () => { if (panel.current) panel.close(); },
});

createTicker($('tape'), store, { onSelect: select });
createMovers($('gainers'), $('losers'), store, { onSelect: select });

/* ---------- Filtres ---------- */
const active = new Set(DOMAINS.map((d) => d.id));
const chipsEl = $('chips');
for (const d of DOMAINS) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.style.setProperty('--c', d.color);
  b.innerHTML = `<i></i>${d.short}<span class="n">${COMPANIES.filter((c) => c.domain === d.id).length}</span>`;
  b.title = d.name;
  b.addEventListener('click', () => {
    // Si tout est actif, un clic isole ce domaine ; sinon on bascule.
    if (active.size === DOMAINS.length) {
      active.clear();
      active.add(d.id);
    } else if (active.has(d.id)) {
      active.delete(d.id);
      if (active.size === 0) DOMAINS.forEach((x) => active.add(x.id));
    } else {
      active.add(d.id);
    }
    refreshChips();
    applyFilter();
  });
  chipsEl.appendChild(b);
}
function refreshChips() {
  [...chipsEl.children].forEach((b, i) => b.classList.toggle('off', !active.has(DOMAINS[i].id)));
}
const search = $('search');
function applyFilter() {
  galaxy.setFilter({ activeDomains: active, query: search.value });
}
search.addEventListener('input', applyFilter);
search.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const q = search.value.trim().toLowerCase();
  const hit = COMPANIES.find((c) => c.ticker.toLowerCase() === q)
    || COMPANIES.find((c) => c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().startsWith(q));
  if (hit) select(hit);
});

/* ---------- Bascule Galaxie / Orbites ---------- */
const toggle = document.querySelector('.view-toggle');
const pill = toggle.querySelector('.view-toggle-pill');
function placePill(btn) {
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
}
toggle.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    toggle.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    placePill(btn);
    galaxy.setMode(btn.dataset.view);
    $('hint').textContent = btn.dataset.view === 'orbit'
      ? 'Chaque orbite est un domaine · survolez une planète'
      : 'Cliquez sur un domaine pour zoomer · sur une bulle pour le détail';
  });
});
document.fonts?.ready.then(() => placePill(toggle.querySelector('button.active')));
placePill(toggle.querySelector('button.active'));
window.addEventListener('resize', () => placePill(toggle.querySelector('button.active')));

/* ---------- Statistiques globales ---------- */
const statShown = { index: 0, cap: 0 };
function updateStats() {
  let capNow = 0, weighted = 0, capBase = 0, up = 0, down = 0;
  for (const co of listed) {
    const q = store.get(co.ticker);
    const c = co.cap * (q.price / q.prevClose);
    capNow += c;
    capBase += co.cap;
    weighted += co.cap * q.changePct;
    if (q.changePct > 0) up++;
    else if (q.changePct < 0) down++;
  }
  const index = weighted / capBase;
  galaxy.setIndex(index);
  gsap.to(statShown, {
    index,
    cap: capNow,
    duration: reducedMotion ? 0 : 1,
    ease: 'power2.out',
    onUpdate: () => {
      const el = $('stat-index');
      el.textContent = fmtPct(statShown.index);
      el.style.color = colorFor(statShown.index * 2);
      $('stat-cap').textContent = fmtCap(statShown.cap);
    },
  });
  $('stat-up').textContent = up;
  $('stat-down').textContent = down;
}
updateStats();
setInterval(updateStats, 1500);

/* ---------- Réglages ---------- */
const settings = createSettings($('settings'), $('api-key'), { onChange: startFeed });
$('open-settings').addEventListener('click', settings.open);
$('status').addEventListener('click', settings.open);

/* ---------- Intro ---------- */
if (!reducedMotion) {
  gsap.from('.topbar', { y: -40, opacity: 0, duration: 1, ease: 'expo.out' });
  gsap.from('.tape', { opacity: 0, duration: 1, delay: 0.3 });
  gsap.from('#chips, .search', { y: 12, opacity: 0, duration: 0.7, stagger: 0.05, delay: 0.4, ease: 'power3.out' });
  gsap.from('.movers, .legend', { y: 30, opacity: 0, duration: 1, delay: 1.2, ease: 'expo.out' });
}
