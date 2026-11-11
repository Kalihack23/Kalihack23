// Portefeuilles virtuels (« Mon ETF IA ») : modèles, création, performance. Fonctions pures.
import { COMPANIES } from './companies.js';
import { capOf } from './derived.js';

/** Modèles prêts à l'emploi. */
export const PRESETS = [
  { id: 'all', label: 'Le top 30 de l’IA (pondéré par la capitalisation)', pick: () => COMPANIES.filter((c) => c.listed), n: 30, byCap: true },
  { id: 'chips', label: '100 % puces', pick: () => COMPANIES.filter((c) => c.listed && c.domain === 'chips'), n: 12, byCap: true },
  { id: 'energy', label: 'Énergie & datacenters', pick: () => COMPANIES.filter((c) => c.listed && (c.domain === 'energy' || c.domain === 'datacenters')), n: 12, byCap: false },
  { id: 'cloud', label: 'Cloud & logiciels', pick: () => COMPANIES.filter((c) => c.listed && (c.domain === 'cloud' || c.domain === 'software')), n: 12, byCap: true },
  { id: 'europe', label: 'IA européenne', pick: () => COMPANIES.filter((c) => c.listed && ['FR', 'DE', 'NL', 'IT', 'CH', 'IE'].includes(c.country)), n: 12, byCap: false },
];

const byTicker = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c]));
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Pondérations d'un modèle (somme = 100). */
export function presetWeights(presetId, store) {
  const p = PRESETS.find((x) => x.id === presetId);
  if (!p) return [];
  const list = p.pick()
    .map((c) => ({ c, cap: capOf(c, store.get(c.ticker)) }))
    .sort((a, b) => b.cap - a.cap)
    .slice(0, p.n);
  const total = list.reduce((s, x) => s + (p.byCap ? x.cap : 1), 0);
  return list.map(({ c, cap }) => ({ ticker: c.ticker, weight: round(((p.byCap ? cap : 1) / total) * 100, 2) }));
}

/** Crée un portefeuille : prix d'entrée figés + référence (indice AI Orbit, pondéré par la cap.). */
export function buildPortfolio(name, weights, store, now = new Date()) {
  const positions = weights
    .filter((w) => byTicker[w.ticker]?.listed && w.weight > 0)
    .map((w) => ({ ticker: w.ticker, weight: +w.weight, entry_price: store.get(w.ticker)?.price || null }))
    .filter((p) => p.entry_price > 0);
  const bench = {};
  for (const c of COMPANIES.filter((x) => x.listed)) {
    const q = store.get(c.ticker);
    if (q?.price > 0) bench[c.ticker] = [round(capOf(c, q), 1), q.price];
  }
  return { name: String(name || 'Mon ETF IA').slice(0, 60), positions, bench, created_at: now.toISOString(), is_public: false, share_slug: null };
}

/** Performance (base 100) d'un ensemble pondéré { ticker: [poids, prix d'entrée] }. */
function perfOf(entries, store) {
  let w = 0, acc = 0;
  for (const [ticker, weight, entry] of entries) {
    const q = store.get(ticker);
    if (!q?.price || !entry) continue;
    w += weight;
    acc += weight * (q.price / entry);
  }
  return w ? (acc / w) * 100 : null;
}

/** Valeur actuelle du portefeuille vs indice AI Orbit depuis sa création, et contribution de chaque ligne. */
export function evaluatePortfolio(p, store) {
  const value = perfOf(p.positions.map((x) => [x.ticker, x.weight, x.entry_price]), store);
  const benchValue = p.bench ? perfOf(Object.entries(p.bench).map(([t, [w, price]]) => [t, w, price]), store) : null;
  const totalW = p.positions.reduce((s, x) => s + x.weight, 0) || 1;
  const lines = p.positions.map((x) => {
    const q = store.get(x.ticker);
    const perf = q?.price && x.entry_price ? (q.price / x.entry_price - 1) * 100 : 0;
    return { ticker: x.ticker, name: byTicker[x.ticker]?.name || x.ticker, weight: x.weight, perf, contribution: (perf * x.weight) / totalW };
  }).sort((a, b) => b.perf - a.perf);
  return {
    value,
    perf: value != null ? value - 100 : null,
    benchPerf: benchValue != null ? benchValue - 100 : null,
    best: lines[0] || null,
    worst: lines[lines.length - 1] || null,
    lines,
  };
}

/** Identifiant de partage aléatoire (a-z0-9). */
export function newSlug(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}
