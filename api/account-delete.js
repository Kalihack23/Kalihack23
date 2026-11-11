// POST /api/account-delete (en-tête Authorization: Bearer <jeton de session Supabase>)
// Supprime le compte de l'utilisateur connecté (RGPD). Ses lignes (liste, alertes, portefeuilles,
// profil) sont effacées en cascade. La clé « service role » ne quitte jamais le serveur.
export default async function handler(req, res) {
  const json = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return json(503, { error: 'Suppression de compte non configurée (SUPABASE_SERVICE_ROLE_KEY manquante).' });

  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'non connecté' });

  // 1) Vérifie le jeton auprès de Supabase et récupère l'identifiant de l'utilisateur.
  let userId;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return json(401, { error: 'session invalide' });
    userId = (await r.json()).id;
  } catch {
    return json(502, { error: 'Supabase injoignable' });
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId || '')) return json(401, { error: 'session invalide' });

  // 2) Supprime l'utilisateur (API d'administration, clé service role).
  try {
    const r = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: service, Authorization: `Bearer ${service}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return json(502, { error: `suppression refusée (${r.status})` });
  } catch {
    return json(502, { error: 'Supabase injoignable' });
  }
  return json(200, { ok: true });
}
