import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sse = (chunks) => {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
};

const call = async (body, { method = 'POST', ip = '1.1.1.1' } = {}) => {
  const handler = (await import('../api/chat.js')).default;
  const res = {
    headers: {}, chunks: [],
    setHeader(k, v) { this.headers[k] = v; },
    write(c) { this.chunks.push(c); },
    end(b) { if (b) this.body = JSON.parse(b); this.ended = true; },
  };
  await handler({ method, body, headers: { 'x-forwarded-for': ip } }, res);
  return res;
};
const ask = (content) => ({ messages: [{ role: 'user', content }], context: { quotes: [{ ticker: 'NVDA', name: 'NVIDIA', price: '185 $', change: '+1 %', cap: '4,5 T$', market: 'Marché ouvert' }] } });

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('/api/chat', () => {
  it('503 sans clé Perplexity (l’interface passe en assistant local)', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');
    expect((await call(ask('bonjour'))).statusCode).toBe(503);
  });
  it('refuse les requêtes invalides ou trop grosses', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'k');
    expect((await call({ messages: [] }, { ip: 'a' })).statusCode).toBe(400);
    expect((await call(ask('x'), { method: 'GET', ip: 'b' })).statusCode).toBe(405);
    expect((await call(JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(20000) }] }), { ip: 'c' })).statusCode).toBe(413);
  });
  it('relaie le flux, envoie le contexte et les sources', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'k');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, body: sse([
      { choices: [{ delta: { content: 'NVIDIA (NVDA) ' } }] },
      { choices: [{ delta: { content: 'monte.' } }], search_results: [{ title: 'Reuters', url: 'https://reuters.com/a' }, { title: 'Piège', url: 'javascript:x' }] },
    ]) }));
    globalThis.fetch = fetchMock;
    const res = await call(ask('Pourquoi NVIDIA monte ?'), { ip: 'd' });
    expect(res.statusCode).toBe(200);
    const events = res.chunks.map((c) => JSON.parse(c.replace(/^data: /, '')));
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text).join('')).toBe('NVIDIA (NVDA) monte.');
    expect(events.find((e) => e.type === 'sources').items).toEqual([{ title: 'Reuters', url: 'https://reuters.com/a' }]);
    expect(events.at(-1).type).toBe('done');
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[0].content).toContain('NVDA NVIDIA : 185 $');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer k');
  });
  it('limite le nombre de questions par minute', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'k');
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body: sse([{ choices: [{ delta: { content: 'ok' } }] }]) }));
    const codes = [];
    for (let i = 0; i < 10; i++) codes.push((await call(ask('q'), { ip: 'same' })).statusCode);
    expect(codes.slice(0, 8).every((c) => c === 200)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});
