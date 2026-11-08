// Accès Yahoo Finance côté serveur (pas de CORS ni de clé).
//  - liste blanche : uniquement les symboles du site (évite de servir de proxy ouvert)
//  - délai maximum sur chaque appel
//  - cours groupés (endpoint "spark", 20 symboles par appel) au lieu d'un appel par valeur
//  - détails (capitalisation, ouverture, haut, bas, volume, état du marché) via /v7/quote
//    avec le jeton "crumb" de Yahoo ; si indisponible, on s'en passe.
import { COMPANIES } from '../../src/data/companies.js';

const UA = 'Mozilla/5.0 (compatible; ai-orbit/1.0)';
const BASE = 'https://query1.finance.yahoo.com';
const TIMEOUT_MS = 6000;

export const ALLOWED_SYMBOLS = new Set(COMPANIES.filter((c) => c.listed).map((c) => c.symbol));
const CURRENCIES = [...new Set(COMPANIES.filter((c) => c.listed).map((c) => c.currency))].filter((c) => c !== 'USD');
export const FX_SYMBOLS = CURRENCIES.map((c) => `${c}USD=X`);
const ALLOWED_ANY = new Set([...ALLOWED_SYMBOLS, ...FX_SYMBOLS]);

// Requêtes d'actualités autorisées : symboles + noms des entreprises du site.
export const ALLOWED_NEWS = new Set(COMPANIES.flatMap((c) => [c.ticker, c.name]).map((s) => s.toLowerCase()));

export const RANGES = {
  '1d': { range: '1d', interval: '5m' },
  '5d': { range: '5d', interval: '30m' },
  '1mo': { range: '1mo', interval: '1d' },
  '6mo': { range: '6mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
};

export function isAllowedSymbol(s) {
  return ALLOWED_ANY.has(s);
}

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res;
}

async function getJson(url, headers) {
  const res = await get(url, headers);
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  return res.json();
}

function parseChartResult(result, range = '1d') {
  const m = result.meta || {};
  const closes = result.indicators?.quote?.[0]?.close || [];
  const ts = result.timestamp || [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] != null) points.push([ts[i] * 1000, Math.round(closes[i] * 10000) / 10000]);
  }
  return {
    symbol: m.symbol,
    currency: m.currency,
    price: m.regularMarketPrice,
    prevClose: range === '1d' ? (m.previousClose ?? m.chartPreviousClose) : m.chartPreviousClose,
    time: (m.regularMarketTime || 0) * 1000,
    points,
  };
}

export async function chart(symbol, range = '1d') {
  const r = RANGES[range] || RANGES['1d'];
  const json = await getJson(`${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r.range}&interval=${r.interval}&includePrePost=false`);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('no data');
  return parseChartResult(result, range);
}

// Cours de séance groupés : 20 symboles par appel.
export async function spark(symbols) {
  const out = {};
  const batches = [];
  for (let i = 0; i < symbols.length; i += 20) batches.push(symbols.slice(i, i + 20));
  await Promise.all(batches.map(async (batch) => {
    try {
      const json = await getJson(`${BASE}/v7/finance/spark?symbols=${batch.map(encodeURIComponent).join(',')}&range=1d&interval=5m&includePrePost=false`);
      for (const item of json?.spark?.result || []) {
        const result = item?.response?.[0];
        if (!result) continue;
        const parsed = parseChartResult(result, '1d');
        if (parsed.price > 0) out[item.symbol] = parsed;
      }
    } catch { /* lot ignoré : on retentera symbole par symbole */ }
  }));
  // Repli : les symboles manquants via l'endpoint "chart" (un appel chacun).
  const missing = symbols.filter((s) => !out[s]);
  await Promise.all(missing.map(async (s) => {
    try { out[s] = await chart(s, '1d'); } catch { /* indisponible */ }
  }));
  return out;
}

// Jeton "crumb" (nécessaire pour /v7/finance/quote), mis en cache dans l'instance serveur.
let crumbCache = null;
async function getCrumb() {
  if (crumbCache && Date.now() - crumbCache.at < 3600e3) return crumbCache;
  const r1 = await get('https://fc.yahoo.com/');
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('no cookie');
  const r2 = await get(`${BASE}/v1/test/getcrumb`, { Cookie: cookie });
  const crumb = (await r2.text()).trim();
  if (!r2.ok || !crumb || crumb.includes('<')) throw new Error('no crumb');
  crumbCache = { cookie, crumb, at: Date.now() };
  return crumbCache;
}

// Détails par symbole : capitalisation, ouverture, haut, bas, volume, état du marché.
export async function details(symbols) {
  try {
    const { cookie, crumb } = await getCrumb();
    const out = {};
    for (let i = 0; i < symbols.length; i += 50) {
      const batch = symbols.slice(i, i + 50);
      const json = await getJson(`${BASE}/v7/finance/quote?symbols=${batch.map(encodeURIComponent).join(',')}&crumb=${encodeURIComponent(crumb)}`, { Cookie: cookie });
      for (const q of json?.quoteResponse?.result || []) {
        out[q.symbol] = {
          marketCap: q.marketCap ?? null,
          open: q.regularMarketOpen ?? null,
          high: q.regularMarketDayHigh ?? null,
          low: q.regularMarketDayLow ?? null,
          volume: q.regularMarketVolume ?? null,
          marketState: q.marketState ?? null,
        };
      }
    }
    return out;
  } catch {
    crumbCache = null;
    return {};
  }
}

const safeUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

export async function news(query, count = 6) {
  const json = await getJson(`${BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${count}`);
  return (json.news || [])
    .map((n) => ({
      title: n.title,
      link: safeUrl(n.link),
      publisher: n.publisher,
      time: (n.providerPublishTime || 0) * 1000,
      thumb: safeUrl(n.thumbnail?.resolutions?.find((t) => t.width <= 200)?.url || n.thumbnail?.resolutions?.[0]?.url || ''),
    }))
    .filter((n) => n.link && n.title);
}

export function send(res, status, body, maxAge = 30) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` : 'no-store');
  res.end(JSON.stringify(body));
}

export function params(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}
