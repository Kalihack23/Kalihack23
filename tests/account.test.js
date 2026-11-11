import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../src/data/account.js';
import { describeAlert, evaluateAlerts } from '../src/data/alerts.js';
import { buildPortfolio, evaluatePortfolio, newSlug, presetWeights } from '../src/data/portfolio.js';
import { createStore } from '../src/data/feed.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('compte local (sans Supabase)', () => {
  it('liste de suivi, alertes, portefeuilles et préférences persistés sur l’appareil', async () => {
    const storage = memStorage();
    const acc = createAccount({ storage });
    await acc.init();
    expect(acc.configured).toBe(false);
    expect(await acc.toggleWatch('NVDA')).toBe(true);
    await acc.toggleWatch('CAT');
    expect(await acc.toggleWatch('NVDA')).toBe(false);
    await acc.saveAlert({ ticker: 'CAT', kind: 'above', value: 600 });
    await acc.savePrefs({ theme: 'light', sort: 'cap' });
    const again = createAccount({ storage });
    expect([...again.watchlist]).toEqual(['CAT']);
    expect(again.alerts[0]).toMatchObject({ ticker: 'CAT', kind: 'above', value: 600, active: true });
    expect(again.prefs).toEqual({ theme: 'light', sort: 'cap' });
    await again.deleteAlert(again.alerts[0].id);
    expect(createAccount({ storage }).alerts).toEqual([]);
  });
  it('se connecter sans configuration renvoie une erreur claire', async () => {
    const acc = createAccount({ storage: memStorage() });
    await expect(acc.signInWithEmail('a@b.fr')).rejects.toThrow('pas encore activés');
  });
});

// Faux client Supabase : tables en mémoire, utilisateur déjà connecté.
function fakeSupabase(tables = {}) {
  const db = { watchlist: [], alerts: [], portfolios: [], profiles: [{ id: 'u1', display_name: 'brandon', prefs: {} }], ...tables };
  const calls = [];
  const from = (name) => {
    const q = { filters: [], op: 'select', payload: null };
    const run = () => {
      calls.push({ name, ...q });
      let rows = db[name];
      const match = (r) => q.filters.every(([k, v]) => r[k] === v);
      if (q.op === 'insert' || q.op === 'upsert') {
        const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r) => ({ id: `id${db[name].length + 1}`, ...r }));
        db[name].push(...list);
        return { data: q.single ? list[0] : list, error: null };
      }
      if (q.op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, q.payload)); return { data: q.single ? rows.find(match) : rows, error: null }; }
      if (q.op === 'delete') { db[name] = rows.filter((r) => !match(r)); return { data: null, error: null }; }
      rows = rows.filter(match);
      return { data: q.single ? rows[0] || null : rows, error: null };
    };
    const chain = {
      select() { return chain; }, order() { return chain; },
      eq(k, v) { q.filters.push([k, v]); return chain; },
      insert(p) { q.op = 'insert'; q.payload = p; return chain; },
      upsert(p) { q.op = 'upsert'; q.payload = p; return chain; },
      update(p) { q.op = 'update'; q.payload = p; return chain; },
      delete() { q.op = 'delete'; return chain; },
      single() { q.single = true; return chain; }, maybeSingle() { q.single = true; return chain; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return chain;
  };
  const client = {
    from,
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'brandon@example.com' }, access_token: 't' } } }),
      signOut: async () => ({}),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
  };
  return { client, db, calls };
}

describe('compte Supabase', () => {
  it('connexion : charge le compte et fusionne les données de l’appareil', async () => {
    const storage = memStorage();
    const local = createAccount({ storage });
    await local.toggleWatch('NVDA');
    await local.saveAlert({ ticker: 'NVDA', kind: 'move', value: 5 });
    const { client, db } = fakeSupabase({ watchlist: [{ ticker: 'AMD', user_id: 'u1' }] });
    const acc = createAccount({ url: 'https://x.supabase.co', anonKey: 'anon', storage, createClient: () => client });
    const events = [];
    acc.onChange((e) => events.push(e.type));
    await acc.init();
    expect(acc.signedIn).toBe(true);
    expect(acc.user.name).toBe('brandon');
    expect([...acc.watchlist].sort()).toEqual(['AMD', 'NVDA']);
    expect(db.alerts.length).toBe(1);
    expect(events).toContain('signin');
    expect(JSON.parse(storage.getItem('aiorbit.account.v1')).watchlist).toEqual([]); // local vidé après import
  });
  it('les modifications partent dans la base', async () => {
    const { client, db } = fakeSupabase();
    const acc = createAccount({ url: 'https://x.supabase.co', anonKey: 'anon', storage: memStorage(), createClient: () => client });
    await acc.init();
    await acc.toggleWatch('CAT');
    expect(db.watchlist.map((r) => r.ticker)).toEqual(['CAT']);
    await acc.toggleWatch('CAT');
    expect(db.watchlist).toEqual([]);
    await acc.savePrefs({ theme: 'dark' });
    expect(db.profiles[0].prefs).toEqual({ theme: 'dark' });
    await acc.signInWithEmail('a@b.fr');
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.fr', options: expect.any(Object) });
  });
});

describe('alertes', () => {
  const q = (price, changePct, src = 'api') => ({ price, changePct, src, currency: 'USD' });
  const now = new Date('2026-11-10T15:00:00');
  it('seuils haut, bas et variation, uniquement sur cours réels', () => {
    const quotes = { NVDA: q(210, 2), AMD: q(90, -6), CAT: q(500, 0.5, 'sim') };
    const alerts = [
      { id: 1, ticker: 'NVDA', kind: 'above', value: 200, active: true },
      { id: 2, ticker: 'NVDA', kind: 'below', value: 150, active: true },
      { id: 3, ticker: 'AMD', kind: 'move', value: 5, active: true },
      { id: 4, ticker: 'CAT', kind: 'above', value: 100, active: true },
      { id: 5, ticker: 'NVDA', kind: 'above', value: 100, active: false },
    ];
    expect(evaluateAlerts(alerts, (t) => quotes[t], now).map((h) => h.alert.id)).toEqual([1, 3]);
  });
  it('une seule fois par jour', () => {
    const a = { id: 1, ticker: 'NVDA', kind: 'above', value: 200, active: true, last_triggered_at: '2026-11-10T09:00:00' };
    expect(evaluateAlerts([a], () => q(210, 1), now)).toEqual([]);
    expect(evaluateAlerts([a], () => q(210, 1), new Date('2026-11-11T09:00:00')).length).toBe(1);
  });
  it('description lisible', () => {
    expect(describeAlert({ ticker: 'NVDA', kind: 'move', value: 5 })).toBe('NVDA varie de plus de ±5 %');
    expect(describeAlert({ ticker: 'NVDA', kind: 'above', value: 200 }).replace(/\s/g, ' ')).toBe('NVDA au-dessus de 200,00 $');
  });
});

describe('portefeuille virtuel', () => {
  it('performance depuis la création et comparaison à l’indice', () => {
    const store = createStore();
    store.set('NVDA', 100, 100);
    store.set('AMD', 100, 100);
    const pf = buildPortfolio('Test', [{ ticker: 'NVDA', weight: 50 }, { ticker: 'AMD', weight: 50 }], store);
    expect(pf.positions.map((p) => p.entry_price)).toEqual([100, 100]);
    store.set('NVDA', 120, 100);
    store.set('AMD', 90, 100);
    const e = evaluatePortfolio(pf, store);
    expect(e.perf).toBeCloseTo(5);
    expect(e.best.ticker).toBe('NVDA');
    expect(e.worst.ticker).toBe('AMD');
    expect(e.benchPerf).not.toBeNull();
  });
  it('modèles : pondérations qui somment à 100', () => {
    const store = createStore();
    const w = presetWeights('chips', store);
    expect(w.length).toBe(12);
    expect(w.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100, 0);
    expect(newSlug()).toMatch(/^[a-z0-9]{10}$/);
  });
});

describe('/api/account-delete', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  const call = async (headers = {}) => {
    const handler = (await import('../api/account-delete.js')).default;
    const res = { setHeader() {}, end(b) { this.body = JSON.parse(b); } };
    await handler({ method: 'POST', headers }, res);
    return res;
  };
  it('refuse sans configuration, sans jeton ou avec un jeton invalide', async () => {
    expect((await call({ authorization: 'Bearer x' })).statusCode).toBe(503);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    expect((await call()).statusCode).toBe(401);
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401 }));
    expect((await call({ authorization: 'Bearer bad' })).statusCode).toBe(401);
  });
  it('supprime l’utilisateur vérifié avec la clé service role (côté serveur)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    const fetchMock = vi.fn(async (url, opts = {}) => (opts.method === 'DELETE' ? { ok: true, status: 200 } : { ok: true, status: 200, json: async () => ({ id: '11111111-2222-3333-4444-555555555555' }) }));
    globalThis.fetch = fetchMock;
    const res = await call({ authorization: 'Bearer good' });
    expect(res.statusCode).toBe(200);
    const del = fetchMock.mock.calls.find(([, o]) => o?.method === 'DELETE');
    expect(del[0]).toBe('https://x.supabase.co/auth/v1/admin/users/11111111-2222-3333-4444-555555555555');
    expect(del[1].headers.Authorization).toBe('Bearer service');
  });
});
