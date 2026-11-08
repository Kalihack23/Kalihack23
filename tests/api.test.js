import { afterEach, describe, expect, it, vi } from 'vitest';

const sparkItem = (symbol, price, prevClose, currency = 'USD') => ({
  symbol,
  response: [{
    meta: { symbol, currency, regularMarketPrice: price, previousClose: prevClose, regularMarketTime: 1700000000 },
    timestamp: [1, 2, 3],
    indicators: { quote: [{ close: [prevClose, null, price] }] },
  }],
});

function mockYahoo({ crumbOk = false } = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.pathname.includes('/v7/finance/spark')) {
      const symbols = u.searchParams.get('symbols').split(',');
      return { ok: true, json: async () => ({ spark: { result: symbols.filter((s) => s !== 'SU.PA').map((s) => (s.endsWith('=X') ? sparkItem(s, 1.1, 1.1) : sparkItem(s, 101, 100))) } }) };
    }
    if (u.pathname.includes('/v8/finance/chart/')) {
      return { ok: true, json: async () => ({ chart: { result: [sparkItem('SU.PA', 230, 228, 'EUR').response[0]] } }) };
    }
    if (u.hostname === 'fc.yahoo.com') return { ok: true, headers: { get: () => (crumbOk ? 'A=1; path=/' : '') } };
    if (u.pathname.includes('getcrumb')) return { ok: true, text: async () => 'abc' };
    if (u.pathname.includes('/v7/finance/quote')) {
      return { ok: true, json: async () => ({ quoteResponse: { result: [{ symbol: 'NVDA', marketCap: 4.5e12, regularMarketOpen: 99, regularMarketDayHigh: 102, regularMarketDayLow: 98, regularMarketVolume: 1e8, marketState: 'REGULAR' }] } }) };
    }
    if (u.pathname.includes('/v1/finance/search')) {
      return { ok: true, json: async () => ({ news: [
        { title: 'OK', link: 'https://example.com/a', publisher: 'Reuters', providerPublishTime: 1 },
        { title: 'Piège', link: 'javascript:alert(1)', publisher: 'X', providerPublishTime: 1 },
      ] }) };
    }
    return { ok: false, status: 404 };
  });
  return calls;
}

const call = async (mod, url) => {
  vi.resetModules();
  const handler = (await import(`../api/${mod}.js`)).default;
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } };
  await handler({ url }, res);
  return res;
};

afterEach(() => vi.restoreAllMocks());

describe('/api/quotes', () => {
  it('refuse les symboles hors liste (pas de proxy ouvert)', async () => {
    mockYahoo();
    const res = await call('quotes', '/api/quotes?symbols=FOO,BAR');
    expect(res.statusCode).toBe(400);
  });
  it('groupe les appels, complète les manquants et fournit les taux de change', async () => {
    const calls = mockYahoo();
    const res = await call('quotes', '/api/quotes?symbols=NVDA,SU.PA,EVIL');
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body.quotes).sort()).toEqual(['NVDA', 'SU.PA']);
    expect(res.body.quotes.NVDA).toMatchObject({ price: 101, prevClose: 100, intraday: [100, 101] });
    expect(res.body.fx.EUR).toBe(1.1);
    expect(calls.filter((c) => c.includes('/spark')).length).toBe(1); // 2 symboles + 6 devises = 1 lot
    expect(calls.some((c) => c.includes('/chart/SU.PA'))).toBe(true); // repli pour le manquant
  });
  it('ajoute capitalisation et données de séance quand Yahoo les donne', async () => {
    mockYahoo({ crumbOk: true });
    const res = await call('quotes', '/api/quotes?symbols=NVDA');
    expect(res.body.quotes.NVDA).toMatchObject({ marketCap: 4.5e12, open: 99, high: 102, low: 98, marketState: 'REGULAR' });
  });
});

describe('/api/history', () => {
  it('refuse un symbole hors liste ou une période inconnue', async () => {
    mockYahoo();
    expect((await call('history', '/api/history?symbol=FOO&range=1mo')).statusCode).toBe(400);
    expect((await call('history', '/api/history?symbol=NVDA&range=10y')).statusCode).toBe(400);
  });
});

describe('/api/news', () => {
  it('ne garde que les liens http(s)', async () => {
    mockYahoo();
    const res = await call('news', '/api/news?q=NVIDIA');
    expect(res.statusCode).toBe(200);
    expect(res.body.items.map((i) => i.title)).toEqual(['OK']);
  });
  it('refuse une recherche hors entreprises du site', async () => {
    mockYahoo();
    expect((await call('news', '/api/news?q=bitcoin')).statusCode).toBe(400);
  });
});
