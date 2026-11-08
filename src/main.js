import './styles.css';
import { gsap } from 'gsap';
import { COMPANIES, DOMAINS } from './data/companies.js';
import { apiAvailable, createApiProvider, createFinnhubProvider, createSimProvider, createStore } from './data/feed.js';
import { createGalaxy } from './viz/galaxy.js';
import { createTicker } from './ui/ticker.js';
import { createWatchlist } from './ui/watchlist.js';
import { createPanel, createTooltip } from './ui/panel.js';
import { createSettings, getApiKey } from './ui/settings.js';
import { createAmbient } from './ui/ambient.js';
import { createSegmented, initGlass } from './ui/glass.js';
import { getTheme, onThemeChange, setTheme } from './ui/theme.js';
import { buildCaption, renderShareImage } from './ui/share.js';
import { createChat } from './ui/chat.js';
import { colorFor, fmtCap, fmtPct, reducedMotion } from './util.js';
import { capOf, isStale } from './data/derived.js';

const $ = (id) => document.getElementById(id);
const store = createStore();
const listed = COMPANIES.filter((c) => c.listed);

/* ---------- Source de données ---------- */
// Ordre de préférence :
//  1. /api disponible (site déployé sur Vercel) + clé Finnhub → US en temps réel, reste du monde différé
//  2. /api disponible sans clé → tout en différé (~1 min)
//  3. clé Finnhub seule → US en temps réel, international aux prix de référence
//  4. rien → DÉMO simulée
const providers = [];
let lastTrade = 0;
let statusBase = '';

function setStatus(mode, text) {
  $('status').dataset.mode = mode;
  $('status-text').textContent = text;
}

function startDemo(reason) {
  store.setMode('demo');
  const sim = createSimProvider(store);
  providers.push(sim);
  sim.start();
  setStatus(reason === 'error' ? 'error' : 'demo', reason === 'error' ? 'Clé invalide · DÉMO simulée' : 'DÉMO · cours simulés');
}

async function startFeed() {
  setStatus('demo', 'Connexion…');
  const key = getApiKey();
  const api = await apiAvailable();

  if (!api && !key) return startDemo();
  store.setMode('live');

  if (key) {
    const fh = createFinnhubProvider(store, key, {
      loadQuotes: !api,
      onStatus: (s) => {
        if (s === 'trade') lastTrade = Date.now();
        if (s === 'live') setStatus('live', statusBase);
        if (s === 'reconnecting') setStatus('error', 'Reconnexion…');
      },
    });
    statusBase = api ? 'LIVE · temps réel US + monde' : 'LIVE · temps réel US';
    try {
      await fh.start();
      providers.push(fh);
    } catch {
      if (!api) return startDemo('error');
      // Clé refusée mais /api disponible : on continue en différé.
    }
    if (api) {
      const usSymbols = new Set(fh.universe.map((c) => c.ticker));
      // Instantané initial des valeurs US (clôture veille + historique de séance)…
      createApiProvider(store, { companies: fh.universe, once: true, src: 'rt' }).start();
      // …puis rafraîchissement du reste du monde chaque minute.
      const rest = createApiProvider(store, { companies: listed.filter((c) => !usSymbols.has(c.ticker)) });
      providers.push(rest);
      rest.start();
    }
    return;
  }

  // /api sans clé : tout en différé.
  const all = createApiProvider(store, {
    onUpdate: (n, total, err) => {
      if (err) setStatus('error', 'Source indisponible · nouvel essai…');
      else setStatus('live', `LIVE · différé ~1 min (${n}/${total})`);
    },
  });
  providers.push(all);
  await all.start();
}

// En temps réel, si aucun échange depuis 1 min, le marché US est probablement fermé.
setInterval(() => {
  if (statusBase && $('status').dataset.mode === 'live' && lastTrade && Date.now() - lastTrade > 60000) {
    setStatus('live', 'LIVE · marché US calme/fermé');
  } else if (statusBase && $('status').dataset.mode === 'live' && Date.now() - lastTrade < 60000) {
    setStatus('live', statusBase);
  }
}, 10000);

startFeed();

/* ---------- Vues ---------- */
createAmbient($('ambient'));
initGlass();
// Réfraction "Liquid Glass" : backdrop-filter avec filtre SVG, rendu correctement par Chromium uniquement.
if (/Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'blur(1px)')) {
  document.documentElement.classList.add('liquid-ok');
}

const tooltip = createTooltip($('tooltip'), store);
let galaxy;
const panel = createPanel($('panel'), $('panel-body'), $('panel-close'), store, {
  onClose: () => {
    galaxy?.setSelected(null);
    watchlist?.setSelected(null);
  },
});

function select(co) {
  tooltip.hide();
  galaxy.setSelected(co.ticker);
  watchlist?.setSelected(co.ticker);
  panel.open(co);
}

galaxy = createGalaxy($('viz'), store, {
  capOf: (co) => capOf(co, store.get(co.ticker)),
  onSelect: select,
  onHover: (co, ev) => tooltip.show(co, ev),
  onLeave: () => tooltip.hide(),
  onBackground: () => { if (panel.current) panel.close(); },
});

createTicker($('tape'), store, { onSelect: select });

// Dès que de vraies capitalisations arrivent (Yahoo), on recalcule la taille des bulles.
let capsKnown = 0;
let relayoutTimer = null;
store.subscribe(() => {
  const n = listed.filter((co) => store.get(co.ticker).capUSD > 0).length;
  if (n === capsKnown) return;
  capsKnown = n;
  clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(() => galaxy.relayout(), 800);
});
const watchlist = createWatchlist($('watchlist'), store, { onSelect: select });

/* ---------- Chatbot « Orbit » ---------- */
createChat({
  fab: $('chat-open'),
  el: $('chat'),
  store,
  onSelect: select,
  getFocus: () => panel.current,
});

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
  watchlist.setFilter({ activeDomains: active, query: search.value });
}
search.addEventListener('input', applyFilter);
search.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const q = search.value.trim().toLowerCase();
  const hit = COMPANIES.find((c) => c.ticker.toLowerCase() === q)
    || COMPANIES.find((c) => c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().startsWith(q));
  if (hit) select(hit);
});

/* ---------- Vues : Galaxie · Bulles · Orbites ---------- */
document.body.dataset.view = 'pack';
const HINTS = {
  pack: 'Attrapez et lancez les bulles · cliquez sur un domaine pour zoomer',
  bubbles: 'Taille = variation du jour · attrapez, lancez, faites-les rebondir',
  orbit: 'Chaque orbite est un domaine · survolez une planète',
};
const viewSeg = createSegmented($('view-seg'), {
  label: 'Vue',
  value: 'pack',
  items: [
    { id: 'pack', label: 'Galaxie' },
    { id: 'bubbles', label: 'Bulles' },
    { id: 'orbit', label: 'Orbites' },
    { id: 'list', label: 'Liste', className: 'mobile-only' },
  ],
  onChange: (mode) => {
    document.body.dataset.view = mode;
    if (mode === 'list') return; // mobile : la liste de valeurs remplace la scène
    galaxy.setMode(mode);
    showHint(HINTS[mode]);
  },
});

// Astuce éphémère : affichée quelques secondes au démarrage et à chaque changement de vue, puis s'efface.
let hintTimer = null;
function showHint(text) {
  const hint = $('hint');
  clearTimeout(hintTimer);
  gsap.killTweensOf(hint);
  gsap.to(hint, {
    opacity: 0,
    duration: reducedMotion ? 0 : 0.2,
    onComplete: () => {
      hint.textContent = text;
      gsap.to(hint, { opacity: 1, duration: reducedMotion ? 0 : 0.4, ease: 'power3.out' });
      hintTimer = setTimeout(() => gsap.to(hint, { opacity: 0, duration: reducedMotion ? 0 : 0.8, ease: 'power2.out' }), 6000);
    },
  });
}
showHint(HINTS.pack);

// L'onglet « Liste » n'existe que sur mobile : si on agrandit la fenêtre, on revient à la Galaxie.
const wide = window.matchMedia('(min-width: 761px)');
wide.addEventListener('change', () => {
  if (wide.matches && viewSeg.value === 'list') viewSeg.select('pack');
});

/* ---------- Statistiques globales ---------- */
const statShown = { index: 0, cap: 0 };
let lastStats = { index: 0, cap: 0, up: 0, down: 0 };
function updateStats() {
  let capNow = 0, weighted = 0, capBase = 0, up = 0, down = 0;
  for (const co of listed) {
    const q = store.get(co.ticker);
    const c = capOf(co, q);
    capNow += c;
    if (isStale(store, q)) continue; // valeur non actualisée : exclue de l'indice et du décompte
    capBase += c;
    weighted += c * q.changePct;
    if (q.changePct > 0) up++;
    else if (q.changePct < 0) down++;
  }
  const index = capBase ? weighted / capBase : 0;
  lastStats = { index, cap: capNow, up, down };
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

/* ---------- Thème clair / sombre ---------- */
$('theme-toggle').addEventListener('click', (ev) => setTheme(getTheme() === 'light' ? 'dark' : 'light', ev));
const themeSeg = createSegmented($('theme-seg'), {
  label: 'Thème',
  value: getTheme(),
  items: [
    { id: 'light', label: 'Clair' },
    { id: 'dark', label: 'Sombre' },
  ],
  onChange: (t) => setTheme(t),
});
onThemeChange((t) => {
  themeSeg.select(t, { emit: false });
  $('theme-toggle').setAttribute('aria-label', t === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair');
  updateStats();
});

/* ---------- Réglages ---------- */
const settings = createSettings($('settings'), $('api-key'), { onChange: () => location.reload() });
$('open-settings').addEventListener('click', settings.open);
$('status').addEventListener('click', settings.open);

/* ---------- Intro ---------- */
if (!reducedMotion) {
  gsap.from('.topbar', { y: -40, opacity: 0, duration: 1, ease: 'expo.out' });
  gsap.from('.tape', { opacity: 0, duration: 1, delay: 0.3 });
  gsap.from('#chips, .search, #view-seg', { y: 12, opacity: 0, duration: 0.7, stagger: 0.05, delay: 0.4, ease: 'power3.out' });
  gsap.from('.watchlist, .chat-fab', { y: 30, opacity: 0, duration: 1, delay: 1.2, ease: 'expo.out' });
}

/* ---------- Partage ---------- */
const shareDlg = $('share');
let shareBlob = null; // Promise<Blob>

function currentMovers() {
  const rows = listed
    .filter((co) => !isStale(store, store.get(co.ticker)))
    .map((co) => ({ ticker: co.ticker, pct: store.get(co.ticker).changePct }))
    .sort((a, b) => b.pct - a.pct);
  return { gainers: rows.slice(0, 3), losers: rows.slice(-3).reverse() };
}

$('open-share').addEventListener('click', async () => {
  const data = { snapshot: galaxy.snapshot(), stats: lastStats, movers: currentMovers(), sourceLabel: $('status-text').textContent };
  $('share-preview').textContent = 'Génération…';
  $('share-caption').value = buildCaption(data);
  $('share-native').hidden = !navigator.canShare;
  shareDlg.showModal();
  const canvas = await renderShareImage(data);
  // Aperçu immédiat ; l'encodage PNG (plus lent) se fait en arrière-plan.
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Aperçu de l’image à partager');
  $('share-preview').replaceChildren(canvas);
  shareBlob = new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!reducedMotion) gsap.from(canvas, { opacity: 0, scale: 0.96, duration: 0.6, ease: 'power3.out' });
});

const shareFileName = () => `ai-orbit-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;

$('share-download').addEventListener('click', async () => {
  if (!shareBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await shareBlob);
  a.download = shareFileName();
  a.click();
});

$('share-copy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText($('share-caption').value);
    e.target.textContent = 'Copié ✓';
  } catch {
    $('share-caption').select();
    e.target.textContent = 'Sélectionné — Ctrl+C';
  }
  setTimeout(() => { e.target.textContent = 'Copier la légende'; }, 2000);
});

$('share-native').addEventListener('click', async () => {
  if (!shareBlob) return;
  const file = new File([await shareBlob], shareFileName(), { type: 'image/png' });
  const payload = { files: [file], title: 'AI Orbit', text: $('share-caption').value };
  try {
    if (navigator.canShare?.(payload)) await navigator.share(payload);
    else await navigator.share({ title: 'AI Orbit', text: $('share-caption').value, url: location.href });
  } catch { /* partage annulé */ }
});
