// GET /api/history?symbol=NVDA&range=1mo → { points: [[ts, close], ...], prevClose, currency }
import { RANGES, chart, params, send } from './_lib/yahoo.js';

export default async function handler(req, res) {
  const p = params(req);
  const symbol = p.get('symbol') || '';
  const range = p.get('range') || '1mo';
  if (!/^[A-Za-z0-9.\-^=]{1,15}$/.test(symbol) || !RANGES[range]) return send(res, 400, { error: 'paramètres invalides' });
  try {
    const data = await chart(symbol, range);
    send(res, 200, data, range === '1d' ? 60 : 900);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
}
