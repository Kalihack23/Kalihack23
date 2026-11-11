// POST /api/chat → assistant « Orbit ». Fournisseurs (API compatibles OpenAI), au choix :
//  - Groq      (GRATUIT, sans carte bancaire) : modèle open source gpt-oss-120b par défaut — GROQ_API_KEY
//  - Mistral   (GRATUIT en mode « free », vérification par téléphone) — MISTRAL_API_KEY
//  - Perplexity (payant, avec recherche web) — PERPLEXITY_API_KEY
// Ordre automatique : CHAT_PROVIDER si défini, sinon Groq → Mistral → Perplexity (premier dont la clé existe).
// Si un fournisseur échoue (quota, panne), on passe au suivant.
// Body : { messages: [{ role: 'user'|'assistant', content }], context: { quotes: [...], focus } }
// Réponse : flux SSE simplifié — {type:'delta', text} … {type:'sources', items:[{title,url}]} … {type:'done'}
// Sans aucune clé : 503 { error: 'no_key' } → l'interface bascule alors sur l'assistant local (sources ouvertes).
import { COMPANIES, DOMAINS } from '../src/data/companies.js';
import { findCompanies } from '../src/data/assistant.js';
import { getKnowledge, knowledgeDigest } from './_lib/open.js';

export const PROVIDERS = {
  groq: {
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    webSearch: false,
    // gpt-oss « réfléchit » avant de répondre : on lui laisse de la marge de jetons.
    extra: () => ({ max_tokens: 2000, temperature: 0.3 }),
  },
  mistral: {
    label: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    keyEnv: 'MISTRAL_API_KEY',
    model: () => process.env.MISTRAL_MODEL || 'mistral-large-latest',
    webSearch: false,
    extra: () => ({ max_tokens: 900, temperature: 0.3 }),
  },
  perplexity: {
    label: 'Perplexity',
    url: 'https://api.perplexity.ai/chat/completions',
    keyEnv: 'PERPLEXITY_API_KEY',
    model: () => process.env.PERPLEXITY_MODEL || 'sonar-pro',
    webSearch: true,
    extra: () => ({ max_tokens: 700, temperature: 0.2 }),
  },
};

/** Fournisseurs disponibles (clé présente), dans l'ordre d'essai. */
export function availableProviders(env = process.env) {
  const order = ['groq', 'mistral', 'perplexity'];
  const wanted = (env.CHAT_PROVIDER || '').toLowerCase();
  const sorted = PROVIDERS[wanted] ? [wanted, ...order.filter((p) => p !== wanted)] : order;
  return sorted.filter((id) => env[PROVIDERS[id].keyEnv]);
}
const MAX_BODY = 16 * 1024;
const MAX_MESSAGES = 10;
const MAX_CHARS = 600;
const RATE = { windowMs: 60_000, max: 8 };
const hits = new Map(); // ip → [timestamps] (limite « au mieux », par instance serveur)

const domainName = Object.fromEntries(DOMAINS.map((d) => [d.id, d.name]));

// Univers du site, compact : « NVDA NVIDIA — Puces… : rôle ».
const UNIVERSE = COMPANIES.map((c) => `${c.listed ? c.ticker : '(privé)'} ${c.name} — ${domainName[c.domain]} : ${c.role}`).join('\n');

const SYSTEM = `Tu es « Orbit », l'assistant du site AI Orbit, qui suit les entreprises cotées (et quelques laboratoires privés) qui construisent l'intelligence artificielle.
Règles :
- Réponds en français, de façon claire et concise (180 mots maximum), avec des listes courtes si utile.
- Concentre-toi sur ces entreprises, leur rôle dans l'IA, leur actualité et leurs cours. Si la question sort de ce cadre, ramène poliment vers ce sujet.
- Pour les cours du jour, utilise en priorité les données « Cours en direct » fournies ci-dessous (elles viennent du site). Appuie-toi aussi sur les « Données ouvertes » (Wikipedia/Wikidata, GDELT, SEC EDGAR) quand elles sont fournies, et cite-les.
- Mentionne les entreprises par leur symbole boursier entre parenthèses, par ex. NVIDIA (NVDA).
- Ne donne jamais de conseil d'investissement personnalisé (pas de « achetez / vendez ») ; tu peux expliquer des faits et des tendances.

Entreprises suivies par le site :
${UNIVERSE}`;

export function rateLimited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (list.length >= RATE.max) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // garde-fou mémoire
  return false;
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Valide et nettoie la conversation envoyée par le navigateur.
export function sanitize(payload) {
  if (!payload || !Array.isArray(payload.messages)) return null;
  const messages = payload.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_CHARS : 2000) }));
  // Perplexity exige une alternance user/assistant terminée par l'utilisateur.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const alternated = [];
  for (const m of messages) {
    if (alternated.length && alternated[alternated.length - 1].role === m.role) alternated[alternated.length - 1] = m;
    else alternated.push(m);
  }
  if (!alternated.length || alternated[alternated.length - 1].role !== 'user') return null;
  const quotes = Array.isArray(payload.context?.quotes) ? payload.context.quotes.slice(0, 25) : [];
  const live = quotes
    .filter((q) => q && typeof q.ticker === 'string')
    .map((q) => `${String(q.ticker).slice(0, 12)} ${String(q.name || '').slice(0, 40)} : ${String(q.price || '').slice(0, 20)} (${String(q.change || '').slice(0, 12)} aujourd'hui), cap. ${String(q.cap || '').slice(0, 16)}, ${String(q.market || '').slice(0, 20)}`)
    .join('\n');
  const focus = typeof payload.context?.focus === 'string' ? payload.context.focus.slice(0, 60) : '';
  const watchlist = Array.isArray(payload.context?.watchlist) ? payload.context.watchlist.filter((t) => typeof t === 'string').slice(0, 30).map((t) => t.slice(0, 12)) : [];
  return { messages: alternated, live, focus, watchlist };
}

const NO_WEB = `\n- Tu n'as pas d'accès direct au web : base-toi sur les données fournies ci-dessous (cours en direct, Wikipedia/Wikidata, GDELT, SEC) et sur tes connaissances générales. N'invente aucun chiffre ni aucune actualité ; si une information manque ou peut être datée, dis-le. Pour l'actualité, cite les articles GDELT fournis (titre + lien).`;
const WEB = `\n- Complète avec tes recherches web et cite tes sources.`;

async function callProvider(id, system, messages) {
  const p = PROVIDERS[id];
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[p.keyEnv]}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      model: p.model(),
      messages: [{ role: 'system', content: system + (p.webSearch ? WEB : NO_WEB) }, ...messages],
      stream: true,
      ...p.extra(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok || !res.body) {
    const err = new Error(`upstream_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const providers = availableProviders();
  if (!providers.length) return json(res, 503, { error: 'no_key' });

  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
  if (rateLimited(ip)) return json(res, 429, { error: 'rate_limited' });

  let payload;
  try {
    const raw = await readBody(req);
    if (raw.length > MAX_BODY) return json(res, 413, { error: 'too_large' });
    payload = sanitize(JSON.parse(raw));
  } catch (e) {
    return json(res, e.message === 'too_large' ? 413 : 400, { error: 'bad_request' });
  }
  if (!payload) return json(res, 400, { error: 'bad_request' });

  // Données ouvertes (Wikipedia/Wikidata, GDELT, SEC) sur les entreprises citées — récupérées côté serveur.
  const question = payload.messages[payload.messages.length - 1].content;
  let mentioned = findCompanies(question).slice(0, 2);
  if (!mentioned.length && payload.focus) mentioned = findCompanies(payload.focus).slice(0, 1);
  const knowledge = (await Promise.all(mentioned.map((c) => Promise.race([
    getKnowledge(c).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), 5000)),
  ])))).filter(Boolean);
  const openData = knowledge.map(knowledgeDigest).join('\n\n');

  const today = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'Europe/Paris' }).format(new Date());
  const system = `${SYSTEM}\n\nDate du jour : ${today}.${payload.focus ? `\nL'utilisateur consulte actuellement la fiche : ${payload.focus}.` : ''}${payload.watchlist.length ? `\nValeurs suivies par l'utilisateur (« sa liste ») : ${payload.watchlist.join(', ')}.` : ''}${payload.live ? `\n\nCours en direct (site AI Orbit) :\n${payload.live}` : ''}${openData ? `\n\nDonnées ouvertes (Wikipedia/Wikidata, GDELT, SEC EDGAR) :\n${openData}` : ''}`;

  // Premier fournisseur qui répond (bascule automatique en cas de quota dépassé ou de panne).
  let upstream = null;
  let provider = null;
  let lastError = 'upstream_unreachable';
  for (const id of providers) {
    try {
      upstream = await callProvider(id, system, payload.messages);
      provider = id;
      break;
    } catch (e) {
      lastError = e.message || lastError;
    }
  }
  if (!upstream) return json(res, 502, { error: lastError });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  send({ type: 'meta', provider, label: PROVIDERS[provider].label, model: PROVIDERS[provider].model() });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sources = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let chunk;
        try { chunk = JSON.parse(data); } catch { continue; }
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) send({ type: 'delta', text });
        if (Array.isArray(chunk.search_results) && chunk.search_results.length) {
          sources = chunk.search_results.map((s) => ({ title: s.title || s.url, url: s.url }));
        } else if (Array.isArray(chunk.citations) && chunk.citations.length && !sources.length) {
          sources = chunk.citations.map((u) => ({ title: u, url: u }));
        }
      }
    }
  } catch {
    send({ type: 'error', error: 'stream_interrupted' });
  }
  // Sources : celles du fournisseur (Perplexity), puis celles des données ouvertes utilisées.
  for (const k of knowledge) for (const src of k.sources || []) sources.push({ title: `${src.name} — ${k.company.name}`, url: src.url });
  const safe = sources
    .filter((s) => /^https?:\/\//.test(s.url || ''))
    .slice(0, 9)
    .map((s) => ({ title: String(s.title).slice(0, 120), url: s.url }));
  if (safe.length) send({ type: 'sources', items: safe });
  send({ type: 'done' });
  res.end();
}
