// Flux de cotations : un store commun + trois fournisseurs
//  - API  : /api/quotes (fonction Vercel → Yahoo Finance), toutes bourses, rafraîchi chaque minute (différé)
//  - Finnhub : WebSocket temps réel pour les valeurs cotées aux États-Unis (clé gratuite)
//  - DÉMO : simulation, quand aucune source réelle n'est disponible
import { COMPANIES } from './companies.js';

const HISTORY_MAX = 120;

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createStore() {
  const quotes = new Map();
  const listeners = new Set();

  for (const co of COMPANIES) {
    quotes.set(co.ticker, {
      ticker: co.ticker,
      currency: co.currency,
      price: co.price,
      prevClose: co.price,
      changePct: 0,
      history: [],
      lastTs: 0,
      dir: 0,
      src: null, // 'rt' temps réel | 'api' différé | 'sim' simulé | null référence
    });
  }

  function set(ticker, price, prevClose, ts = Date.now(), src = null) {
    const q = quotes.get(ticker);
    if (!q || !Number.isFinite(price) || price <= 0) return;
    if (src) q.src = src;
    if (Number.isFinite(prevClose) && prevClose > 0) q.prevClose = prevClose;
    q.dir = Math.sign(price - q.price);
    q.price = price;
    q.changePct = ((price - q.prevClose) / q.prevClose) * 100;
    q.lastTs = ts;
    q.history.push(price);
    if (q.history.length > HISTORY_MAX) q.history.shift();
    for (const fn of listeners) {
      try { fn(q); } catch (e) { console.error(e); }
    }
  }

  return {
    quotes,
    get: (t) => quotes.get(t),
    set,
    seedHistory(ticker, arr) {
      const q = quotes.get(ticker);
      if (q) q.history = arr.slice(-HISTORY_MAX);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ---------- Fournisseur DÉMO : mouvement brownien géométrique corrélé par secteur ---------- */
export function createSimProvider(store) {
  const listed = COMPANIES.filter((c) => c.listed);
  const sectorDrift = {};
  let timer = null;

  for (const co of listed) {
    const dailySigma = co.vol / Math.sqrt(252);
    const prevClose = co.price;
    let p = prevClose;
    const hist = [p];
    for (let i = 0; i < 60; i++) {
      p *= 1 + gauss() * dailySigma * 0.12;
      hist.push(p);
    }
    store.seedHistory(co.ticker, hist);
    store.set(co.ticker, p, prevClose, Date.now(), 'sim');
  }

  function tick() {
    timer = setTimeout(tick, 900 + Math.random() * 700);
    const market = gauss() * 0.0009;
    for (const co of listed) if (!(co.domain in sectorDrift)) sectorDrift[co.domain] = 0;
    for (const k in sectorDrift) sectorDrift[k] = sectorDrift[k] * 0.9 + gauss() * 0.0008;
    for (const co of listed) {
      if (Math.random() > 0.45) continue;
      const q = store.get(co.ticker);
      const sigma = (co.vol / Math.sqrt(252)) * 0.09;
      const meanRevert = -((q.price - q.prevClose) / q.prevClose) * 0.01;
      store.set(co.ticker, q.price * (1 + market + sectorDrift[co.domain] + gauss() * sigma + meanRevert), undefined, Date.now(), 'sim');
    }
  }

  return {
    mode: 'demo',
    start() { tick(); },
    stop() { clearTimeout(timer); },
  };
}

/* ---------- Fournisseur API : /api/quotes (Yahoo Finance via la fonction serveur) ---------- */
export async function apiAvailable() {
  try {
    const res = await fetch('/api/quotes?symbols=NVDA', { cache: 'no-store' });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json?.quotes?.NVDA?.price;
  } catch {
    return false;
  }
}

export function createApiProvider(store, { companies, intervalMs = 60000, once = false, src = 'api', onUpdate } = {}) {
  const list = (companies || COMPANIES.filter((c) => c.listed));
  const bySymbol = Object.fromEntries(list.map((c) => [c.symbol, c]));
  let timer = null;
  let first = true;

  async function poll() {
    if (!once) timer = setTimeout(poll, intervalMs);
    try {
      const res = await fetch(`/api/quotes?symbols=${list.map((c) => encodeURIComponent(c.symbol)).join(',')}`);
      if (!res.ok) throw new Error(res.status);
      const { quotes } = await res.json();
      let n = 0;
      for (const sym in quotes) {
        const co = bySymbol[sym];
        const q = quotes[sym];
        if (!co) continue;
        if (first && q.intraday?.length > 1) store.seedHistory(co.ticker, q.intraday);
        store.set(co.ticker, q.price, q.prevClose, q.time, src);
        n++;
      }
      first = false;
      onUpdate?.(n, list.length);
    } catch (e) {
      onUpdate?.(0, list.length, e);
    }
  }

  return {
    mode: 'api',
    start() { return poll(); },
    stop() { clearTimeout(timer); },
  };
}

/* ---------- Fournisseur Finnhub : WebSocket temps réel (valeurs US) ---------- */
// Le plan gratuit limite le WebSocket à 50 symboles : on garde les 50 plus grosses capitalisations US.
export function finnhubUniverse() {
  return COMPANIES.filter((c) => c.us).sort((a, b) => b.cap - a.cap).slice(0, 50);
}

export function createFinnhubProvider(store, apiKey, { onStatus, loadQuotes = true } = {}) {
  const list = finnhubUniverse();
  let ws = null;
  let stopped = false;
  let retry = 0;

  async function fetchQuote(symbol) {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
    );
    if (res.status === 401 || res.status === 403) throw new Error('auth');
    if (!res.ok) throw new Error(`http ${res.status}`);
    return res.json(); // { c, d, dp, h, l, o, pc, t }
  }

  // Sans /api : clôture de la veille via REST, espacée (60 requêtes/min sur le plan gratuit).
  async function loadAll() {
    for (const co of list) {
      if (stopped) return;
      try {
        const q = await fetchQuote(co.symbol);
        if (q && q.c > 0) {
          store.seedHistory(co.ticker, [q.pc || q.c, q.o || q.c, q.c]);
          store.set(co.ticker, q.c, q.pc, (q.t || 0) * 1000 || Date.now(), 'rt');
        }
      } catch (e) {
        if (e.message === 'auth') throw e;
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  function connect() {
    if (stopped) return;
    ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(apiKey)}`);
    ws.addEventListener('open', () => {
      retry = 0;
      onStatus?.('live');
      for (const co of list) ws.send(JSON.stringify({ type: 'subscribe', symbol: co.symbol }));
    });
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type !== 'trade' || !Array.isArray(msg.data)) return;
      const last = {};
      for (const t of msg.data) last[t.s] = t;
      for (const s in last) {
        const co = list.find((c) => c.symbol === s);
        if (co) store.set(co.ticker, last[s].p, undefined, last[s].t, 'rt');
      }
      onStatus?.('trade');
    });
    ws.addEventListener('close', () => {
      if (stopped) return;
      onStatus?.('reconnecting');
      retry = Math.min(retry + 1, 6);
      setTimeout(connect, 1000 * 2 ** retry);
    });
  }

  return {
    mode: 'live',
    universe: list,
    async start() {
      // Vérifie la clé avant d'ouvrir le WebSocket.
      try {
        await fetchQuote('AAPL');
      } catch (e) {
        if (e.message === 'auth') {
          onStatus?.('auth-error');
          throw e;
        }
      }
      connect();
      if (loadQuotes) await loadAll();
    },
    stop() {
      stopped = true;
      ws?.close();
    },
  };
}
