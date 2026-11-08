import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPANIES } from '../src/data/companies.js';

const co = (t) => COMPANIES.find((c) => c.ticker === t);
const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

// Réponses factices des sources ouvertes, aiguillées par URL.
function mockOpen({ sparql = true, sec403 = false, frSummary = true } = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith('https://query.wikidata.org/sparql')) {
      return ok({ results: { bindings: sparql ? [{ item: { value: 'http://www.wikidata.org/entity/Q182477' }, label: { value: 'Nvidia' } }] : [] } });
    }
    if (u.includes('action=wbsearchentities')) return ok({ search: [{ id: 'Q999', description: 'chanteur' }, { id: 'Q182477', description: 'entreprise américaine' }] });
    if (u.includes('action=wbgetentities') && u.includes('ids=Q182477&props=claims')) {
      return ok({ entities: { Q182477: {
        descriptions: { fr: { value: 'entreprise américaine' } },
        sitelinks: { frwiki: { title: 'Nvidia' }, enwiki: { title: 'Nvidia' } },
        claims: {
          P169: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q1' } } }, qualifiers: { P582: [{}] } }, { rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q2' } } } }],
          P159: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q3' } } } }],
          P571: [{ rank: 'normal', mainsnak: { datavalue: { value: { time: '+1993-04-05T00:00:00Z' } } } }],
          P1128: [
            { rank: 'normal', mainsnak: { datavalue: { value: { amount: '+29600' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2024-01-01T00:00:00Z' } } }] } },
            { rank: 'normal', mainsnak: { datavalue: { value: { amount: '+36000' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2025-01-01T00:00:00Z' } } }] } },
          ],
          P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://www.nvidia.com' } } }],
        },
      } } });
    }
    if (u.includes('action=wbgetentities') && u.includes('props=labels')) {
      return ok({ entities: { Q2: { labels: { fr: { value: 'Jensen Huang' } } }, Q3: { labels: { fr: { value: 'Santa Clara' } } } } });
    }
    if (u.startsWith('https://fr.wikipedia.org')) {
      return frSummary ? ok({ extract: 'Nvidia est une entreprise américaine. Elle conçoit des GPU. Troisième phrase. Quatrième phrase.', content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Nvidia' } } }) : { ok: false, status: 404, text: async () => '' };
    }
    if (u.startsWith('https://en.wikipedia.org')) return ok({ extract: 'Nvidia is an American company.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Nvidia' } } });
    if (u.startsWith('https://api.gdeltproject.org')) {
      return ok({ articles: [
        { url: 'https://www.lesechos.fr/a', title: 'Nvidia bat les attentes', seendate: '20261107T120000Z', domain: 'lesechos.fr', language: 'French' },
        { url: 'https://www.lesechos.fr/b', title: 'Nvidia bat les attentes', seendate: '20261107T110000Z', domain: 'lesechos.fr', language: 'French' },
        { url: 'javascript:alert(1)', title: 'Piège', seendate: '20261107T100000Z', domain: 'x', language: 'English' },
        { url: 'https://reuters.com/c', title: 'Nvidia shares rise', seendate: '20261106T100000Z', domain: 'reuters.com', language: 'English' },
      ] });
    }
    if (u.includes('sec.gov')) {
      if (sec403) return { ok: false, status: 403, text: async () => '' };
      if (u.endsWith('company_tickers.json')) return ok({ 0: { cik_str: 1045810, ticker: 'NVDA', title: 'NVIDIA CORP' } });
      if (u.includes('/submissions/')) return ok({ filings: { recent: { form: ['4', '10-Q', '8-K'], filingDate: ['2026-11-01', '2026-10-25', '2026-10-01'], accessionNumber: ['1', '0001045810-26-000100', '0001045810-26-000090'], primaryDocument: ['a.xml', 'nvda-10q.htm', 'nvda-8k.htm'] } } });
      if (u.includes('/Revenues.json')) {
        return ok({ units: { USD: [
          { start: '2025-01-27', end: '2026-01-25', val: 130e9, form: '10-K', fy: 2025, filed: '2026-02-20' },
          { start: '2025-07-28', end: '2025-10-26', val: 35e9, form: '10-Q', filed: '2025-11-20' },
          { start: '2026-07-27', end: '2026-10-25', val: 57e9, form: '10-Q', filed: '2026-11-19' },
        ] } });
      }
      if (u.includes('/NetIncomeLoss.json')) return ok({ units: { USD: [{ start: '2025-01-27', end: '2026-01-25', val: 72e9, form: '10-K', filed: '2026-02-20' }] } });
      return { ok: false, status: 404, text: async () => '' };
    }
    return { ok: false, status: 404, text: async () => '' };
  });
  return calls;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe('données ouvertes', () => {
  it('Wikidata par symbole + fiche + résumé Wikipedia (3 phrases)', async () => {
    mockOpen();
    const { wiki } = await import('../api/_lib/open.js');
    const w = await wiki(co('NVDA'));
    expect(w.facts).toMatchObject({ ceo: 'Jensen Huang', hq: 'Santa Clara', founded: '1993', employees: { value: 36000, year: '2025' }, website: 'https://www.nvidia.com' });
    expect(w.summary).toBe('Nvidia est une entreprise américaine. Elle conçoit des GPU. Troisième phrase.');
    expect(w.url).toBe('https://fr.wikipedia.org/wiki/Nvidia');
  });
  it('repli : recherche par nom (entité « entreprise ») et résumé anglais', async () => {
    const calls = mockOpen({ sparql: false, frSummary: false });
    const { wiki } = await import('../api/_lib/open.js');
    const w = await wiki(co('NVDA'));
    expect(calls.some((u) => u.includes('wbsearchentities'))).toBe(true);
    expect(w.summary).toBe('Nvidia is an American company.');
  });
  it('GDELT : doublons et liens non http(s) écartés', async () => {
    mockOpen();
    const { news, gdeltQuery } = await import('../api/_lib/open.js');
    const items = await news(co('NVDA'));
    expect(items.map((a) => a.url)).toEqual(['https://www.lesechos.fr/a', 'https://reuters.com/c']);
    expect(items[0]).toMatchObject({ source: 'lesechos.fr', lang: 'fr', date: '2026-11-07' });
    expect(gdeltQuery(co('AAPL'))).toContain('(AI OR stock');
    expect(gdeltQuery(co('NVDA'))).not.toContain('(AI OR stock');
  });
  it('SEC : CA annuel, résultat net, trimestre + croissance, rapports', async () => {
    mockOpen();
    const { sec } = await import('../api/_lib/open.js');
    const s = await sec(co('NVDA'));
    expect(s.revenue.value).toBe(130e9);
    expect(s.netIncome.value).toBe(72e9);
    expect(s.quarter.value).toBe(57e9);
    expect(Math.round(s.quarter.yoy)).toBe(63);
    expect(s.filings.map((f) => f.form)).toEqual(['10-Q', '8-K']);
    expect(s.filings[0].url).toBe('https://www.sec.gov/Archives/edgar/data/1045810/000104581026000100/nvda-10q.htm');
  });
  it('agrégation : une source en échec (SEC 403) n’empêche pas les autres', async () => {
    mockOpen({ sec403: true });
    const { getKnowledge, knowledgeDigest } = await import('../api/_lib/open.js');
    const k = await getKnowledge(co('NVDA'));
    expect(k.wiki.facts.ceo).toBe('Jensen Huang');
    expect(k.news.length).toBe(2);
    expect(k.sec).toBeNull();
    expect(k.unavailable).toContain('SEC EDGAR');
    expect(k.sources.map((s) => s.name)).toEqual(['Wikipedia / Wikidata', 'GDELT (actualités)']);
    expect(knowledgeDigest(k)).toContain('PDG : Jensen Huang');
  });
  it('pas de SEC pour une valeur non américaine ni pour un labo privé', async () => {
    mockOpen();
    const { sec } = await import('../api/_lib/open.js');
    expect(await sec(co('SU'))).toBeNull();
    expect(await sec(co('OPENAI'))).toBeNull();
  });
});

describe('/api/knowledge', () => {
  it('refuse une entreprise hors liste, sert les autres avec cache CDN', async () => {
    mockOpen();
    const handler = (await import('../api/knowledge.js')).default;
    const mk = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } });
    const bad = mk();
    await handler({ url: '/api/knowledge?ticker=FOO' }, bad);
    expect(bad.statusCode).toBe(400);
    const good = mk();
    await handler({ url: '/api/knowledge?ticker=NVDA' }, good);
    expect(good.statusCode).toBe(200);
    expect(good.headers['Cache-Control']).toContain('s-maxage=1800');
    expect(good.body.company.ticker).toBe('NVDA');
  });
});
