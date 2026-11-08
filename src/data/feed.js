// Flux de cotations : un store commun + deux fournisseurs (LIVE Finnhub / DÉMO simulée).
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
      price: co.price,
      prevClose: co.price,
      changePct: 0,
      history: [],
      lastTs: 0,
      dir: 0,
    });
  }

  function set(ticker, price, prevClose, ts = Date.now()) {
    const q = quotes.get(ticker);
    if (!q || !Number.isFinite(price) || price <= 0) return;
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

  // État initial : une séance déjà entamée, avec historique synthétique.
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
    store.set(co.ticker, p, prevClose);
  }

  function tick() {
    // Facteur commun au marché + facteur sectoriel + bruit propre à chaque valeur.
    const market = gauss() * 0.0009;
    for (const co of listed) {
      if (!(co.domain in sectorDrift)) sectorDrift[co.domain] = 0;
    }
    for (const k in sectorDrift) sectorDrift[k] = sectorDrift[k] * 0.9 + gauss() * 0.0008;

    // On ne met à jour qu'une partie des valeurs à chaque tick : plus naturel visuellement.
    for (const co of listed) {
      if (Math.random() > 0.45) continue;
      const q = store.get(co.ticker);
      const sigma = (co.vol / Math.sqrt(252)) * 0.09;
      // Légère force de rappel pour éviter que la séance ne dérive à l'infini.
      const meanRevert = -((q.price - q.prevClose) / q.prevClose) * 0.01;
      const r = market + sectorDrift[co.domain] + gauss() * sigma + meanRevert;
      store.set(co.ticker, q.price * (1 + r));
    }
    timer = setTimeout(tick, 900 + Math.random() * 700);
  }

  return {
    mode: 'demo',
    start() { tick(); },
    stop() { clearTimeout(timer); },
  };
}

/* ---------- Fournisseur LIVE : Finnhub (REST pour la clôture veille + WebSocket pour les trades) ---------- */
export function createFinnhubProvider(store, apiKey, { onStatus } = {}) {
  const listed = COMPANIES.filter((c) => c.listed);
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

  async function loadQuotes() {
    // Plan gratuit : 60 requêtes/min → on espace les appels.
    let ok = 0;
    for (const co of listed) {
      if (stopped) return ok;
      try {
        const q = await fetchQuote(co.ticker);
        if (q && q.c > 0) {
          store.seedHistory(co.ticker, [q.pc || q.c, q.o || q.c, q.c]);
          store.set(co.ticker, q.c, q.pc, (q.t || 0) * 1000 || Date.now());
          ok++;
        }
      } catch (e) {
        if (e.message === 'auth') throw e;
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
    return ok;
  }

  function connect() {
    if (stopped) return;
    ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(apiKey)}`);
    ws.addEventListener('open', () => {
      retry = 0;
      onStatus?.('live');
      for (const co of listed) ws.send(JSON.stringify({ type: 'subscribe', symbol: co.ticker }));
    });
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type !== 'trade' || !Array.isArray(msg.data)) return;
      // Plusieurs trades par message : on garde le dernier par symbole.
      const last = {};
      for (const t of msg.data) last[t.s] = t;
      for (const s in last) store.set(s, last[s].p, undefined, last[s].t);
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
    async start() {
      onStatus?.('loading');
      // Le WebSocket démarre tout de suite ; les clôtures de la veille arrivent progressivement.
      connect();
      try {
        await loadQuotes();
      } catch (e) {
        onStatus?.('auth-error');
        this.stop();
        throw e;
      }
    },
    stop() {
      stopped = true;
      ws?.close();
    },
  };
}
