// GET /api/quotes?symbols=NVDA,SU.PA,…  (symboles du site uniquement)
// → { quotes: { SYMBOL: { price, prevClose, currency, time, intraday[], marketCap, open, high, low, volume, marketState } },
//     fx: { EUR: 1.08, JPY: 0.0066, … } }   (taux vers l'USD, pour convertir les capitalisations)
import { FX_SYMBOLS, details, isAllowedSymbol, params, send, spark } from './_lib/yahoo.js';

export default async function handler(req, res) {
  const symbols = [...new Set((params(req).get('symbols') || '').split(',').map((s) => s.trim()))]
    .filter((s) => isAllowedSymbol(s) && !s.endsWith('=X'))
    .slice(0, 120);
  if (!symbols.length) return send(res, 400, { error: 'symboles manquants ou non autorisés' });

  const [prices, extra] = await Promise.all([spark([...symbols, ...FX_SYMBOLS]), details(symbols)]);

  const quotes = {};
  for (const s of symbols) {
    const p = prices[s];
    if (!p || !(p.price > 0)) continue;
    quotes[s] = {
      price: p.price,
      prevClose: p.prevClose,
      currency: p.currency,
      time: p.time,
      intraday: p.points.map((x) => x[1]),
      ...(extra[s] || {}),
    };
  }
  const fx = { USD: 1 };
  for (const f of FX_SYMBOLS) if (prices[f]?.price > 0) fx[f.slice(0, 3)] = prices[f].price;
  send(res, 200, { quotes, fx, at: Date.now() }, 60);
}
