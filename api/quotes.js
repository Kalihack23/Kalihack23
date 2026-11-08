// GET /api/quotes?symbols=NVDA,SU.PA,0700.HK → { quotes: { SYMBOL: { price, prevClose, currency, time } } }
import { chart, params, send } from './_lib/yahoo.js';

export default async function handler(req, res) {
  const symbols = (params(req).get('symbols') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9.\-^=]{1,15}$/.test(s))
    .slice(0, 100);
  if (!symbols.length) return send(res, 400, { error: 'symbols manquants' });

  const quotes = {};
  // Par paquets de 10 pour rester raisonnable avec Yahoo.
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((s) => chart(s, '1d')));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value.price > 0) {
        const { price, prevClose, currency, time, points } = r.value;
        quotes[batch[j]] = { price, prevClose, currency, time, intraday: points.map((p) => p[1]) };
      }
    });
  }
  send(res, 200, { quotes, at: Date.now() }, 30);
}
