// Assistant local d'« Orbit » : répond sans clé API, à partir des données du site.
// Utilisé quand Perplexity n'est pas disponible (pas de clé, démo, réseau), et testable unitairement.
import { COMPANIES, DOMAINS } from './companies.js';
import { capOf } from './derived.js';
import { STATUS_LABEL, marketStatus } from './markets.js';
import { fmtCap, fmtPct, fmtPrice } from '../util.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

// Symboles qui sont aussi des mots courants : on ne les reconnaît qu'écrits en MAJUSCULES.
const AMBIGUOUS = new Set(['AI', 'ON', 'NOW', 'APP', 'BE', 'CAT', 'FN', 'ARM', 'NET', 'MU', 'SU', 'LR', 'CAP', 'TEL', 'SIE', 'DSY', 'SMR', 'IRM', 'HPE', 'PATH', 'SNOW', 'SAP', 'IBM', 'ABB', 'HF', 'SSI']);
// Premiers mots trop génériques pour désigner une entreprise à eux seuls.
const GENERIC = new Set(['applied', 'texas', 'super', 'palo', 'core', 'iron', 'safe', 'hugging', 'western', 'pure', 'digital', 'general', 'tokyo', 'samsung', 'sk', 'asm', 'arm', 'on', 'intuitive', 'constellation', 'mitsubishi', 'delta', 'serve', 'quanta', 'dell', 'scale', 'figure']);

const firstWordCount = {};
for (const c of COMPANIES) {
  const w = norm(c.name).split(/\s+/)[0];
  firstWordCount[w] = (firstWordCount[w] || 0) + 1;
}

/** Entreprises citées dans un texte (par nom ou par symbole). */
export function findCompanies(text) {
  const n = ` ${norm(text).replace(/[^a-z0-9.&-]+/g, ' ')} `;
  const found = [];
  for (const c of COMPANIES) {
    const name = norm(c.name).replace(/\(.*?\)/g, '').trim();
    const first = name.split(/\s+/)[0];
    const byName = n.includes(` ${name} `)
      || (first.length >= 4 && firstWordCount[first] === 1 && !GENERIC.has(first) && n.includes(` ${first} `));
    const tickerRe = new RegExp(`(^|[^A-Za-z0-9])${c.ticker.replace('.', '\\.')}([^A-Za-z0-9]|$)`, AMBIGUOUS.has(c.ticker) ? '' : 'i');
    const byTicker = c.ticker.length >= 2 && tickerRe.test(text);
    if (byName || byTicker) found.push(c);
  }
  // Ordre d'apparition dans la question.
  const pos = (c) => {
    const i = norm(text).indexOf(norm(c.name).split(/\s+/)[0]);
    return i >= 0 ? i : text.indexOf(c.ticker) >= 0 ? text.indexOf(c.ticker) : 999;
  };
  return found.sort((a, b) => pos(a) - pos(b));
}

const DOMAIN_WORDS = {
  chips: ['puce', 'semi', 'chip', 'gpu', 'fonderie', 'memoire', 'hbm'],
  hardware: ['serveur', 'reseau', 'stockage', 'optique', 'fibre', 'materiel', 'disque', 'connect'],
  energy: ['energie', 'electric', 'nucleaire', 'alimente', 'alimentation', 'turbine', 'uranium', 'courant'],
  datacenters: ['datacenter', 'data center', 'centre de donnees', 'centres de donnees', 'hebergement'],
  cloud: ['cloud', 'hyperscal'],
  software: ['logiciel', 'modele', 'software', 'application', 'saas'],
  data: ['cyber', 'securite', 'donnees', 'observabilite'],
  robotics: ['robot', 'autonome', 'humanoide', 'voiture', 'conduite'],
  private: ['prive', 'labo', 'laboratoire', 'startup', 'non cote', 'openai', 'anthropic'],
};

export function findDomain(text) {
  const n = norm(text);
  // « datacenters » avant « données » / « énergie » (plus spécifique)
  for (const id of ['datacenters', 'energy', 'hardware', 'chips', 'cloud', 'robotics', 'data', 'software', 'private']) {
    if (DOMAIN_WORDS[id].some((w) => n.includes(w))) return DOMAINS.find((d) => d.id === id);
  }
  return null;
}

const has = (n, words) => words.some((w) => n.includes(w));

function line(c, q, store) {
  if (!c.listed) return `**${c.name}** (non cotée) — valorisation estimée ${fmtCap(c.cap)}`;
  const st = store.mode === 'live' ? ` · ${STATUS_LABEL[marketStatus(c, q)].toLowerCase()}` : '';
  return `**${c.name} (${c.ticker})** — ${fmtPrice(q.price, q.currency)}, **${fmtPct(q.changePct)}** aujourd’hui · cap. ${fmtCap(capOf(c, q))}${st}`;
}

function movers(store, domain, dir, n = 5) {
  const rows = COMPANIES.filter((c) => c.listed && (!domain || c.domain === domain.id))
    .map((c) => ({ c, q: store.get(c.ticker) }))
    .filter(({ q }) => q && (store.mode !== 'live' || q.src))
    .sort((a, b) => (dir > 0 ? b.q.changePct - a.q.changePct : a.q.changePct - b.q.changePct));
  return rows.slice(0, n);
}

const SUGGEST = '\n\nEssayez par exemple : « Combien vaut NVIDIA ? », « Top hausses dans l’énergie », « Compare AMD et NVIDIA », « Que fait Vertiv ? ».';

/**
 * Réponse de l'assistant local (Markdown léger).
 * @param {string} question
 * @param {{ get: Function, mode: string }} store
 * @param {{ focus?: object, noKey?: boolean }} [opts]
 */
export function localAnswer(question, store, { focus = null, noKey = false } = {}) {
  const n = norm(question);
  let cos = findCompanies(question);
  if (!cos.length && focus && has(n, ['elle', 'cette', 'ce titre', 'cette action', 'pourquoi', 'que fait', 'combien', 'prix', 'cours'])) cos = [focus];
  const domain = findDomain(question);
  const footer = noKey ? '\n\n_Mode local : pour des réponses complètes (actualité, analyses), le site doit être relié à Perplexity._' : '';

  const wantsUp = has(n, ['hausse', 'monte', 'gagn', 'meilleur', 'top', 'progress', 'grimpe']);
  const wantsDown = has(n, ['baisse', 'chute', 'perd', 'pire', 'recul', 'flop', 'degringol']);

  // Classements (globaux ou par domaine)
  if ((wantsUp || wantsDown) && cos.length < 2) {
    const dir = wantsDown && !wantsUp ? -1 : 1;
    const rows = movers(store, domain, dir);
    if (!rows.length) return `Je n’ai pas encore de cours pour faire ce classement.${footer}`;
    const title = `${dir > 0 ? 'Plus fortes hausses' : 'Plus fortes baisses'}${domain ? ` · ${domain.name}` : ''} aujourd’hui :`;
    return `${title}\n${rows.map(({ c, q }, i) => `${i + 1}. ${line(c, q, store)}`).join('\n')}${footer}`;
  }

  // Comparaison
  if (cos.length >= 2 && (has(n, ['compar', ' vs', 'versus', 'ou ', 'difference', 'mieux']) || cos.length === 2)) {
    const [a, b] = cos;
    const qa = store.get(a.ticker), qb = store.get(b.ticker);
    let verdict = '';
    if (a.listed && b.listed) {
      const better = qa.changePct >= qb.changePct ? a : b;
      verdict = `\n\nAujourd’hui, **${better.name}** fait mieux. En capitalisation, ${capOf(a, qa) >= capOf(b, qb) ? a.name : b.name} est la plus grande.`;
    }
    return `Comparaison :\n- ${line(a, qa, store)}\n  _${a.role}_\n- ${line(b, qb, store)}\n  _${b.role}_${verdict}${footer}`;
  }

  // Une entreprise : cours + rôle
  if (cos.length === 1) {
    const c = cos[0];
    const q = store.get(c.ticker);
    const dom = DOMAINS.find((d) => d.id === c.domain);
    const why = has(n, ['pourquoi', 'raison', 'actualite', 'news']) ? '\n\nJe ne peux pas lire l’actualité en mode local : ouvrez la fiche pour les dernières nouvelles.' : '';
    return `${line(c, q, store)}\n\n**Rôle dans l’IA** (${dom.name}) : ${c.role}${why}${footer}`;
  }

  // Liste d'un domaine
  if (domain) {
    const list = COMPANIES.filter((c) => c.domain === domain.id).sort((a, b) => capOf(b, store.get(b.ticker)) - capOf(a, store.get(a.ticker)));
    const shown = list.slice(0, 8).map((c) => `- ${line(c, store.get(c.ticker), store)}`).join('\n');
    return `**${domain.name}** — ${list.length} entreprises suivies. Les plus grandes :\n${shown}${footer}`;
  }

  if (has(n, ['bonjour', 'salut', 'hello', 'coucou'])) {
    return `Bonjour ! Je suis **Orbit**. Posez-moi vos questions sur les ${COMPANIES.length} entreprises qui construisent l’IA.${SUGGEST}`;
  }
  return `Je n’ai pas trouvé d’entreprise ou de domaine dans votre question.${SUGGEST}${footer}`;
}
