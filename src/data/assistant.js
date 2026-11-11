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

/* ---------- Données ouvertes (Wikipedia/Wikidata, GDELT, SEC) ---------- */
const nf = new Intl.NumberFormat('fr-FR');
const bn = (v) => `${(v / 1e9).toFixed(v >= 1e11 ? 0 : 1).replace('.', ',')} Md$`;
const dateFr = (d) => (d ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '');

function factsLine(k) {
  const f = k?.wiki?.facts;
  if (!f) return '';
  const parts = [
    f.ceo && `PDG : **${f.ceo}**`,
    f.hq && `siège : ${f.hq}`,
    f.founded && `fondée en ${f.founded}`,
    f.employees && `${nf.format(f.employees.value)} employés${f.employees.year ? ` (${f.employees.year})` : ''}`,
  ].filter(Boolean);
  return parts.length ? `- ${parts.join(' · ')}` : '';
}

function secBlock(k) {
  const s = k?.sec;
  if (!s || (!s.revenue && !s.quarter)) return '';
  const lines = [];
  if (s.revenue) lines.push(`- Chiffre d’affaires (exercice clos le ${dateFr(s.revenue.end)}) : **${bn(s.revenue.value)}**${s.netIncome ? ` · résultat net : **${bn(s.netIncome.value)}**` : ''}`);
  if (s.quarter) lines.push(`- Dernier trimestre (clos le ${dateFr(s.quarter.end)}) : **${bn(s.quarter.value)}**${s.quarter.yoy != null ? ` (${s.quarter.yoy >= 0 ? '+' : '−'}${Math.abs(s.quarter.yoy).toFixed(0)} % sur un an)` : ''}`);
  const last = s.filings?.[0];
  if (last) lines.push(`- Dernier rapport : [${last.form} du ${dateFr(last.date)}](${last.url})`);
  return lines.join('\n');
}

function newsBlock(k, n = 3) {
  const items = k?.news?.slice(0, n) || [];
  if (!items.length) return '';
  return items.map((a) => `- [${a.title.replace(/[[\]]/g, '')}](${a.url}) — ${a.source}${a.date ? `, ${dateFr(a.date)}` : ''}`).join('\n');
}

function sourcesLine(ks) {
  const list = ks.flatMap((k) => k?.sources || []);
  if (!list.length) return '';
  const uniq = [...new Map(list.map((x) => [x.url, x])).values()].slice(0, 6);
  return `\n\n_Sources ouvertes :_ ${uniq.map((x) => `[${x.name}](${x.url})`).join(' · ')}`;
}

const SUGGEST = '\n\nEssayez par exemple : « Combien vaut NVIDIA ? », « Top hausses dans l’énergie », « Compare AMD et NVIDIA », « Que fait Vertiv ? ».';

/**
 * Réponse de l'assistant local (Markdown léger).
 * @param {string} question
 * @param {{ get: Function, mode: string }} store
 * @param {{ focus?: object, noKey?: boolean, knowledge?: Record<string, object> }} [opts] knowledge : données ouvertes par symbole
 */
export function localAnswer(question, store, { focus = null, noKey = false, knowledge = null, watchlist = [] } = {}) {
  const n = norm(question);
  let cos = findCompanies(question);
  if (!cos.length && focus && has(n, ['elle', 'cette', 'ce titre', 'cette action', 'pourquoi', 'que fait', 'combien', 'prix', 'cours'])) cos = [focus];
  const domain = findDomain(question);
  const footer = noKey && !knowledge ? '\n\n_Mode local : pour des réponses plus complètes, le site doit être en ligne (sources ouvertes) ou relié à une IA (Groq gratuit, Mistral ou Perplexity)._' : '';

  // « Ma liste » : bilan des valeurs suivies.
  if (has(n, ['ma liste', 'mes valeurs', 'mes favoris', 'mes actions', 'mon suivi'])) {
    const rows = watchlist.map((t) => COMPANIES.find((c) => c.ticker === t)).filter((c) => c?.listed)
      .map((c) => ({ c, q: store.get(c.ticker) })).filter(({ q }) => q)
      .sort((a, b) => b.q.changePct - a.q.changePct);
    if (!rows.length) return `Votre liste est vide : touchez l’étoile ☆ d’une valeur pour la suivre.${SUGGEST}`;
    const avg = rows.reduce((s2, r) => s2 + r.q.changePct, 0) / rows.length;
    return `**Votre liste** (${rows.length} valeurs) : en moyenne **${fmtPct(avg)}** aujourd’hui.\n${rows.slice(0, 10).map(({ c, q }) => `- ${line(c, q, store)}`).join('\n')}${rows.length > 10 ? `\n_+ ${rows.length - 10} autres_` : ''}${footer}`;
  }

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
    const extra = (c) => {
      const k = knowledge?.[c.ticker];
      const bits = [k?.sec?.revenue && `CA ${bn(k.sec.revenue.value)}`, k?.wiki?.facts?.employees && `${nf.format(k.wiki.facts.employees.value)} employés`].filter(Boolean);
      return bits.length ? ` · ${bits.join(' · ')}` : '';
    };
    return `Comparaison :\n- ${line(a, qa, store)}${extra(a)}\n  _${a.role}_\n- ${line(b, qb, store)}${extra(b)}\n  _${b.role}_${verdict}${sourcesLine([knowledge?.[a.ticker], knowledge?.[b.ticker]])}${footer}`;
  }

  // Une entreprise : selon la question, présentation, actualités, résultats ou fiche d'identité.
  if (cos.length === 1) {
    const c = cos[0];
    const q = store.get(c.ticker);
    const k = knowledge?.[c.ticker];
    const dom = DOMAINS.find((d) => d.id === c.domain);
    const f = k?.wiki?.facts || {};
    const out = [line(c, q, store)];
    const wantsNews = has(n, ['pourquoi', 'raison', 'actualite', 'actu', 'news', 'nouvelle', 'bouge', 'se passe']);
    const wantsFin = has(n, ['chiffre d affaires', 'ca ', 'revenu', 'benefice', 'resultat', 'croissance', 'finance', 'comptes', 'trimestre', 'marge']);
    const wantsFacts = has(n, ['pdg', 'ceo', 'patron', 'dirige', 'siege', 'fondee', 'fonde', 'creation', 'cree', 'employe', 'salarie', 'effectif']);

    if (wantsFacts) {
      const bits = [];
      if (has(n, ['pdg', 'ceo', 'patron', 'dirige'])) bits.push(f.ceo ? `**${c.name}** est dirigée par **${f.ceo}**.` : `Je n’ai pas trouvé le nom du dirigeant de ${c.name} dans Wikidata.`);
      if (has(n, ['siege'])) bits.push(f.hq ? `Siège : **${f.hq}**.` : 'Siège non renseigné dans Wikidata.');
      if (has(n, ['fondee', 'fonde', 'creation', 'cree'])) bits.push(f.founded ? `Fondée en **${f.founded}**.` : 'Date de création non renseignée.');
      if (has(n, ['employe', 'salarie', 'effectif'])) bits.push(f.employees ? `Environ **${nf.format(f.employees.value)}** employés${f.employees.year ? ` (${f.employees.year})` : ''}.` : 'Effectif non renseigné.');
      out.unshift(bits.join(' '));
    } else if (wantsFin) {
      const block = secBlock(k);
      if (block) out.push(`**Résultats officiels (SEC EDGAR)** :\n${block}`);
      else if (f.revenue) out.push(`**Chiffre d’affaires** (Wikidata${f.revenue.year ? `, ${f.revenue.year}` : ''}) : ${nf.format(Math.round(f.revenue.value / 1e6))} millions ${f.revenue.currency || ''}${c.us ? '' : '\n_(Société non américaine : pas de comptes SEC.)_'}`);
      else out.push(k ? 'Je n’ai pas trouvé de résultats financiers publiés pour cette entreprise.' : 'Les résultats financiers s’affichent une fois le site en ligne (sources ouvertes indisponibles ici).');
    } else if (wantsNews) {
      const block = newsBlock(k, 4);
      out.push(block ? `**Dernières actualités** (GDELT) :\n${block}` : (k ? 'Je n’ai pas trouvé d’article récent sur cette entreprise.' : 'Les actualités s’affichent une fois le site en ligne (sources ouvertes indisponibles ici).'));
    } else {
      if (k?.wiki?.summary) out.push(k.wiki.summary);
      const fl = factsLine(k);
      if (fl) out.push(fl);
    }
    out.push(`**Rôle dans l’IA** (${dom.name}) : ${c.role}`);
    if (!wantsNews && !wantsFin && !wantsFacts) {
      const nb = newsBlock(k, 2);
      if (nb) out.push(`**À la une** :\n${nb}`);
    }
    return `${out.join('\n\n')}${sourcesLine([k])}${footer}`;
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
