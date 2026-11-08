// GET /api/knowledge?ticker=NVDA → données ouvertes sur une entreprise du site :
//   wiki (Wikipedia + Wikidata), news (GDELT), sec (SEC EDGAR, sociétés US), sources
import { COMPANIES } from '../src/data/companies.js';
import { getKnowledge } from './_lib/open.js';
import { params, send } from './_lib/yahoo.js';

const byTicker = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c]));

export default async function handler(req, res) {
  const co = byTicker[(params(req).get('ticker') || '').trim()];
  if (!co) return send(res, 400, { error: 'entreprise inconnue' });
  try {
    const k = await getKnowledge(co);
    // 30 min de cache CDN (une seule requête vers les sources pour tous les visiteurs), 6 h de « stale ».
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=21600');
    res.end(JSON.stringify(k));
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
}
