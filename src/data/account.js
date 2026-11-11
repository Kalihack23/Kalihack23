// Compte utilisateur : liste de suivi, alertes, portefeuilles, préférences.
// Un seul adaptateur, deux stockages :
//  - Supabase (compte en ligne, synchronisé entre appareils) quand le site est configuré et l'utilisateur connecté
//  - localStorage (sur cet appareil) sinon — tout fonctionne aussi sans compte
// À la connexion, les données locales sont fusionnées dans le compte.

const LOCAL_KEY = 'aiorbit.account.v1';
const empty = () => ({ watchlist: [], alerts: [], portfolios: [], prefs: {} });

function readLocal(storage) {
  try {
    const d = JSON.parse(storage?.getItem(LOCAL_KEY) || 'null');
    return d ? { ...empty(), ...d } : empty();
  } catch {
    return empty();
  }
}
function writeLocal(storage, data) {
  try { storage?.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/**
 * @param {{ url?: string, anonKey?: string, storage?: Storage, createClient?: Function, redirectTo?: string }} cfg
 */
export function createAccount(cfg = {}) {
  const storage = cfg.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const configured = !!(cfg.url && cfg.anonKey);
  const listeners = new Set();
  let client = null;
  let user = null; // { id, email, name }
  let profileName = '';
  let data = readLocal(storage);

  const emit = (type, extra = {}) => { for (const fn of listeners) { try { fn({ type, ...extra }); } catch (e) { console.error(e); } } };
  const online = () => !!(client && user);
  const persistLocal = () => { if (!online()) writeLocal(storage, data); };

  async function getClient() {
    if (!configured) return null;
    if (client) return client;
    const create = cfg.createClient || (await import('@supabase/supabase-js')).createClient;
    client = create(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
    return client;
  }

  // Charge toutes les données du compte en ligne.
  async function loadRemote() {
    const [w, a, p, prof] = await Promise.all([
      client.from('watchlist').select('ticker, note, added_at'),
      client.from('alerts').select('*').order('created_at'),
      client.from('portfolios').select('*').order('created_at'),
      client.from('profiles').select('display_name, prefs').eq('id', user.id).maybeSingle(),
    ]);
    for (const r of [w, a, p, prof]) if (r.error) throw r.error;
    data = {
      watchlist: (w.data || []).map((x) => x.ticker),
      alerts: a.data || [],
      portfolios: p.data || [],
      prefs: prof.data?.prefs || {},
    };
    profileName = prof.data?.display_name || '';
  }

  // Fusion des données de cet appareil dans le compte (une seule fois, puis on vide le local).
  async function importLocal() {
    const local = readLocal(storage);
    const added = { watchlist: 0, alerts: 0, portfolios: 0 };
    const newTickers = local.watchlist.filter((t) => !data.watchlist.includes(t));
    if (newTickers.length) {
      const { error } = await client.from('watchlist').upsert(newTickers.map((ticker) => ({ ticker })), { onConflict: 'user_id,ticker', ignoreDuplicates: true });
      if (!error) { data.watchlist.push(...newTickers); added.watchlist = newTickers.length; }
    }
    for (const al of local.alerts) {
      const { id: _id, user_id: _u, ...row } = al;
      const { data: ins, error } = await client.from('alerts').insert(row).select().single();
      if (!error) { data.alerts.push(ins); added.alerts++; }
    }
    for (const pf of local.portfolios) {
      const { id: _id, user_id: _u, ...row } = pf;
      const { data: ins, error } = await client.from('portfolios').insert({ ...row, is_public: false, share_slug: null }).select().single();
      if (!error) { data.portfolios.push(ins); added.portfolios++; }
    }
    if (Object.keys(local.prefs || {}).length && !Object.keys(data.prefs).length) {
      data.prefs = { ...local.prefs };
      await client.from('profiles').update({ prefs: data.prefs }).eq('id', user.id);
    }
    writeLocal(storage, empty());
    return added;
  }

  async function onSignedIn(sessionUser) {
    user = { id: sessionUser.id, email: sessionUser.email || '', name: '' };
    try {
      await loadRemote();
      user.name = profileName || (user.email.split('@')[0] || '');
      const added = await importLocal();
      emit('signin', { added });
    } catch (e) {
      emit('error', { message: e.message || String(e) });
    }
    emit('change');
  }

  function onSignedOut() {
    user = null;
    data = readLocal(storage);
    emit('signout');
    emit('change');
  }

  /* ---------- Opérations (optimistes : l'interface change tout de suite, retour arrière si erreur) ---------- */
  async function remote(fn, rollback) {
    if (!online()) { persistLocal(); emit('change'); return true; }
    emit('change');
    const { error } = await fn(client);
    if (error) {
      rollback?.();
      emit('error', { message: error.message });
      emit('change');
      return false;
    }
    return true;
  }

  const api = {
    get configured() { return configured; },
    get user() { return user; },
    get signedIn() { return online(); },
    get watchlist() { return new Set(data.watchlist); },
    get alerts() { return [...data.alerts]; },
    get portfolios() { return [...data.portfolios]; },
    get prefs() { return { ...data.prefs }; },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async init() {
      const c = await getClient();
      if (!c) { emit('change'); return; }
      c.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user && (!user || user.id !== session.user.id)) onSignedIn(session.user);
        if (event === 'SIGNED_OUT') onSignedOut();
      });
      const { data: s } = await c.auth.getSession();
      if (s?.session?.user && !user) await onSignedIn(s.session.user);
      else emit('change');
    },

    async signInWithEmail(email) {
      const c = await getClient();
      if (!c) throw new Error('Les comptes ne sont pas encore activés sur ce site.');
      const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: cfg.redirectTo || globalThis.location?.origin } });
      if (error) throw error;
    },
    async signInWithGoogle() {
      const c = await getClient();
      if (!c) throw new Error('Les comptes ne sont pas encore activés sur ce site.');
      const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cfg.redirectTo || globalThis.location?.origin } });
      if (error) throw error;
    },
    async signOut() {
      if (client) await client.auth.signOut();
      onSignedOut();
    },
    async deleteAccount() {
      if (!online()) return;
      const { data: s } = await client.auth.getSession();
      const res = await fetch('/api/account-delete', { method: 'POST', headers: { Authorization: `Bearer ${s?.session?.access_token || ''}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Suppression impossible');
      await client.auth.signOut().catch(() => {});
      onSignedOut();
    },

    isWatched(ticker) { return data.watchlist.includes(ticker); },
    async toggleWatch(ticker) {
      const had = data.watchlist.includes(ticker);
      data.watchlist = had ? data.watchlist.filter((t) => t !== ticker) : [...data.watchlist, ticker];
      await remote(
        (c) => (had ? c.from('watchlist').delete().eq('ticker', ticker) : c.from('watchlist').insert({ ticker })),
        () => { data.watchlist = had ? [...data.watchlist, ticker] : data.watchlist.filter((t) => t !== ticker); },
      );
      return !had;
    },

    async saveAlert(alert) {
      const row = { ticker: alert.ticker, kind: alert.kind, value: +alert.value, active: alert.active !== false, last_triggered_at: alert.last_triggered_at || null };
      if (!online()) {
        const existing = alert.id && data.alerts.find((a) => a.id === alert.id);
        if (existing) Object.assign(existing, row);
        else data.alerts.push({ id: uid(), created_at: new Date().toISOString(), ...row });
        persistLocal();
        emit('change');
        return true;
      }
      const q = alert.id ? client.from('alerts').update(row).eq('id', alert.id).select().single() : client.from('alerts').insert(row).select().single();
      const { data: saved, error } = await q;
      if (error) { emit('error', { message: error.message }); return false; }
      const i = data.alerts.findIndex((a) => a.id === saved.id);
      if (i >= 0) data.alerts[i] = saved; else data.alerts.push(saved);
      emit('change');
      return true;
    },
    async deleteAlert(id) {
      const before = data.alerts;
      data.alerts = data.alerts.filter((a) => a.id !== id);
      return remote((c) => c.from('alerts').delete().eq('id', id), () => { data.alerts = before; });
    },
    // Marque une alerte déclenchée (anti-répétition : une fois par jour).
    async markTriggered(id, when = new Date()) {
      const a = data.alerts.find((x) => x.id === id);
      if (!a) return;
      a.last_triggered_at = when.toISOString();
      if (!online()) { persistLocal(); return; }
      await client.from('alerts').update({ last_triggered_at: a.last_triggered_at }).eq('id', id);
    },

    async savePortfolio(p) {
      if (!online()) {
        const existing = p.id && data.portfolios.find((x) => x.id === p.id);
        if (existing) Object.assign(existing, p);
        else data.portfolios.push({ id: uid(), ...p });
        persistLocal();
        emit('change');
        return data.portfolios.find((x) => x.id === (p.id || data.portfolios[data.portfolios.length - 1].id));
      }
      const { id, user_id: _u, ...row } = p;
      const q = id ? client.from('portfolios').update(row).eq('id', id).select().single() : client.from('portfolios').insert(row).select().single();
      const { data: saved, error } = await q;
      if (error) { emit('error', { message: error.message }); return null; }
      const i = data.portfolios.findIndex((x) => x.id === saved.id);
      if (i >= 0) data.portfolios[i] = saved; else data.portfolios.push(saved);
      emit('change');
      return saved;
    },
    async deletePortfolio(id) {
      const before = data.portfolios;
      data.portfolios = data.portfolios.filter((p) => p.id !== id);
      return remote((c) => c.from('portfolios').delete().eq('id', id), () => { data.portfolios = before; });
    },
    // Portefeuille partagé (lecture publique, sans connexion).
    async getSharedPortfolio(slug) {
      const c = await getClient();
      if (!c || !/^[a-z0-9]{6,16}$/.test(slug)) return null;
      const { data: row } = await c.from('portfolios').select('name, positions, bench, created_at, share_slug').eq('share_slug', slug).eq('is_public', true).maybeSingle();
      return row || null;
    },

    async savePrefs(patch) {
      data.prefs = { ...data.prefs, ...patch };
      if (!online()) { persistLocal(); return; }
      await client.from('profiles').update({ prefs: data.prefs }).eq('id', user.id);
    },
  };
  return api;
}
