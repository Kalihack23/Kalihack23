// GET /api/news?q=NVIDIA → { items: [{ title, link, publisher, time, thumb }] }
import { news, params, send } from './_lib/yahoo.js';

export default async function handler(req, res) {
  const q = (params(req).get('q') || '').slice(0, 60);
  if (!q) return send(res, 400, { error: 'q manquant' });
  try {
    send(res, 200, { items: await news(q, 6) }, 600);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
}
