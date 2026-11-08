// Historique des cours (5 jours → 1 an) et actualités, via les fonctions /api.
// Si l'API n'est pas disponible (mode démo / site non déployé), l'historique est simulé et signalé comme tel.

const cache = new Map();
const TTL = 5 * 60 * 1000;

const SIM_POINTS = { '5d': 65, '1mo': 22, '6mo': 126, '1y': 252 };
const SIM_STEP = { '5d': 30 * 60e3, '1mo': 86400e3, '6mo': 86400e3, '1y': 86400e3 };

function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
}

function simulate(co, range, lastPrice) {
  const n = SIM_POINTS[range];
  const step = SIM_STEP[range];
  const sigma = (co.vol || 0.4) / Math.sqrt(range === '5d' ? 252 * 13 : 252);
  const drift = range === '1y' ? 0.0012 : 0.0005;
  const pts = [];
  let p = lastPrice;
  let t = Date.now();
  for (let i = 0; i < n; i++) {
    pts.unshift([t, p]);
    p /= 1 + drift + gauss() * sigma;
    t -= step;
  }
  return { points: pts, prevClose: pts[0][1], currency: co.currency, simulated: true };
}

export async function fetchHistory(co, range, lastPrice) {
  const key = `${co.symbol}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  let data;
  try {
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(co.symbol)}&range=${range}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    if (!data.points?.length) throw new Error('vide');
  } catch {
    data = simulate(co, range, lastPrice);
  }
  cache.set(key, { at: Date.now(), data });
  return data;
}

const newsCache = new Map();

export async function fetchNews(co) {
  const q = co.listed && co.us ? co.ticker : co.name;
  const hit = newsCache.get(q);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.items;
  const res = await fetch(`/api/news?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(res.status);
  const { items } = await res.json();
  newsCache.set(q, { at: Date.now(), items });
  return items;
}

// Données ouvertes (Wikipedia/Wikidata, GDELT, SEC EDGAR) d'une entreprise, via /api/knowledge.
const knowledgeCache = new Map();
export function fetchKnowledge(co) {
  const hit = knowledgeCache.get(co.ticker);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.promise;
  const promise = fetch(`/api/knowledge?ticker=${encodeURIComponent(co.ticker)}`, { signal: AbortSignal.timeout(12000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  knowledgeCache.set(co.ticker, { at: Date.now(), promise });
  promise.then((k) => { if (!k) knowledgeCache.delete(co.ticker); });
  return promise;
}
