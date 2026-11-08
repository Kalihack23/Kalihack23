// Petites fonctions d'accès à Yahoo Finance (côté serveur : pas de CORS ni de clé).
const UA = 'Mozilla/5.0 (compatible; ai-orbit/1.0)';
const BASE = 'https://query1.finance.yahoo.com';

export const RANGES = {
  '1d': { range: '1d', interval: '5m' },
  '5d': { range: '5d', interval: '30m' },
  '1mo': { range: '1mo', interval: '1d' },
  '6mo': { range: '6mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
};

export async function chart(symbol, range = '1d') {
  const r = RANGES[range] || RANGES['1d'];
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r.range}&interval=${r.interval}&includePrePost=false`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('no data');
  const m = result.meta || {};
  const closes = result.indicators?.quote?.[0]?.close || [];
  const ts = result.timestamp || [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] != null) points.push([ts[i] * 1000, Math.round(closes[i] * 10000) / 10000]);
  }
  return {
    symbol,
    currency: m.currency,
    price: m.regularMarketPrice,
    prevClose: range === '1d' ? (m.previousClose ?? m.chartPreviousClose) : m.chartPreviousClose,
    time: (m.regularMarketTime || 0) * 1000,
    points,
  };
}

export async function news(query, count = 6) {
  const url = `${BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${count}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  return (json.news || []).map((n) => ({
    title: n.title,
    link: n.link,
    publisher: n.publisher,
    time: (n.providerPublishTime || 0) * 1000,
    thumb: n.thumbnail?.resolutions?.find((t) => t.width <= 200)?.url || n.thumbnail?.resolutions?.[0]?.url || null,
  }));
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
