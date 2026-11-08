// GET /api/news?q=NVIDIA → { items: [{ title, link, publisher, time, thumb }] }  (entreprises du site uniquement)
import { ALLOWED_NEWS, news, params, send } from './_lib/yahoo.js';

export default async function handler(req, res) {
  const q = (params(req).get('q') || '').trim();
  if (!ALLOWED_NEWS.has(q.toLowerCase())) return send(res, 400, { error: 'requête non autorisée' });
  try {
    send(res, 200, { items: await news(q, 6) }, 600);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
}
