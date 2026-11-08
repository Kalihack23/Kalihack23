// Sources de données ouvertes et gratuites (sans clé) pour l'agent Orbit et les fiches :
//  - Wikidata (CC0) + Wikipedia (CC BY-SA) : présentation et fiche d'identité de l'entreprise
//  - GDELT (données ouvertes) : actualités mondiales, mises à jour toutes les 15 min
//  - SEC EDGAR (domaine public) : comptes officiels et rapports des sociétés américaines
// Chaque source est indépendante : si l'une échoue, les autres sont quand même renvoyées.

const UA = 'AI-Orbit/1.0 (+https://github.com/Kalihack23/Kalihack23)';
const TIMEOUT = 6000;

/* ---------- utilitaires ---------- */
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return value;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) {
    const err = new Error(`http ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('not json'); // ex. message texte de limitation de GDELT
  }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const cleanName = (name) => name.replace(/\(.*?\)/g, '').trim();

/** Symbole « nu » pour Wikidata : 8035.T → 8035, SU.PA → SU, NVDA → NVDA. */
export const tickerCode = (co) => (co.symbol || co.ticker).split('.')[0];

/* ---------- Wikidata + Wikipedia ---------- */
const WD_API = 'https://www.wikidata.org/w/api.php';
const COMPANY_WORDS = ['entreprise', 'societe', 'company', 'corporation', 'groupe', 'fabricant', 'constructeur', 'manufacturer', 'conglomerat', 'conglomerate', 'firm', 'multinational', 'startup', 'laboratoire', 'semiconductor'];

async function resolveEntity(co) {
  return cached(`wd-id:${co.ticker}`, 24 * 3600e3, async () => {
    const name = norm(cleanName(co.name));
    // 1) Par symbole boursier (qualificatif P249 de P414 « place de cotation ») — très précis.
    if (co.listed) {
      const q = `SELECT ?item ?label WHERE { ?item p:P414 ?s . ?s pq:P249 "${tickerCode(co).replace(/"/g, '')}" . OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } } LIMIT 6`;
      try {
        const json = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { Accept: 'application/sparql-results+json' });
        const rows = (json.results?.bindings || []).map((b) => ({ id: b.item.value.split('/').pop(), label: norm(b.label?.value) }));
        if (rows.length) {
          const first = name.split(' ')[0];
          const best = rows.find((r) => r.label && (r.label.includes(first) || name.includes(r.label.split(' ')[0])));
          if (best) return best.id;
          if (rows.length === 1) return rows[0].id;
        }
      } catch { /* on tente la recherche par nom */ }
    }
    // 2) Par nom, en gardant un résultat décrit comme une entreprise.
    const json = await getJson(`${WD_API}?action=wbsearchentities&search=${encodeURIComponent(cleanName(co.name))}&language=fr&uselang=fr&type=item&limit=7&format=json&origin=*`);
    const results = json.search || [];
    const company = results.find((r) => COMPANY_WORDS.some((w) => norm(r.description).includes(w)));
    return (company || results[0])?.id || null;
  });
}

// Valeur « actuelle » d'une propriété : rang préféré, sinon sans date de fin, sinon la plus récente (P585).
function pickClaim(claims = []) {
  const valid = claims.filter((c) => c.mainsnak?.datavalue && c.rank !== 'deprecated');
  if (!valid.length) return null;
  const preferred = valid.filter((c) => c.rank === 'preferred');
  const pool = preferred.length ? preferred : valid.filter((c) => !c.qualifiers?.P582);
  const list = pool.length ? pool : valid;
  const when = (c) => c.qualifiers?.P585?.[0]?.datavalue?.value?.time || '';
  return [...list].sort((a, b) => when(b).localeCompare(when(a)))[0];
}

const CURRENCIES = { Q4917: 'USD', Q4916: 'EUR', Q8146: 'JPY', Q202040: 'KRW', Q208526: 'TWD', Q31015: 'HKD', Q25344: 'CHF', Q39099: 'CNY', Q25224: 'GBP', Q1104069: 'CAD', Q80524: 'INR' };

async function wikiFacts(co) {
  const id = await resolveEntity(co);
  if (!id) return null;
  return cached(`wd-facts:${id}`, 12 * 3600e3, async () => {
    const json = await getJson(`${WD_API}?action=wbgetentities&ids=${id}&props=claims|sitelinks|labels|descriptions&languages=fr|en&format=json&origin=*`);
    const e = json.entities?.[id];
    if (!e) return null;
    const c = e.claims || {};
    const ceo = pickClaim(c.P169)?.mainsnak.datavalue.value.id;
    const hq = pickClaim(c.P159)?.mainsnak.datavalue.value.id;
    const inception = pickClaim(c.P571)?.mainsnak.datavalue.value.time;
    const emp = pickClaim(c.P1128);
    const rev = pickClaim(c.P2139);
    const site = pickClaim(c.P856)?.mainsnak.datavalue.value;

    // Libellés français des entités liées (PDG, siège), en un seul appel.
    const ids = [ceo, hq].filter(Boolean);
    let labels = {};
    if (ids.length) {
      const lj = await getJson(`${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=fr|en&format=json&origin=*`).catch(() => ({}));
      labels = Object.fromEntries(Object.entries(lj.entities || {}).map(([k, v]) => [k, v.labels?.fr?.value || v.labels?.en?.value]));
    }
    const yearOf = (claim) => claim?.qualifiers?.P585?.[0]?.datavalue?.value?.time?.slice(1, 5) || null;
    const revUnit = rev?.mainsnak.datavalue.value.unit?.split('/').pop();
    return {
      id,
      frTitle: e.sitelinks?.frwiki?.title || null,
      enTitle: e.sitelinks?.enwiki?.title || null,
      description: e.descriptions?.fr?.value || e.descriptions?.en?.value || null,
      facts: {
        ceo: ceo ? labels[ceo] || null : null,
        hq: hq ? labels[hq] || null : null,
        founded: inception ? inception.slice(1, 5).replace(/^0+/, '') : null,
        employees: emp ? { value: Math.round(+emp.mainsnak.datavalue.value.amount), year: yearOf(emp) } : null,
        revenue: rev ? { value: +rev.mainsnak.datavalue.value.amount, currency: CURRENCIES[revUnit] || null, year: yearOf(rev) } : null,
        website: safeUrl(site),
      },
    };
  });
}

async function wikiSummary(facts) {
  const tries = [['fr', facts.frTitle], ['en', facts.enTitle]].filter(([, t]) => t);
  for (const [lang, title] of tries) {
    try {
      const s = await cached(`wp:${lang}:${title}`, 24 * 3600e3, () => getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`));
      if (s?.extract) {
        // 3 premières phrases maximum.
        const sentences = s.extract.match(/[^.!?]+[.!?]+(\s|$)/g) || [s.extract];
        return {
          lang,
          summary: sentences.slice(0, 3).join('').trim().slice(0, 600),
          url: safeUrl(s.content_urls?.desktop?.page) || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          thumb: safeUrl(s.thumbnail?.source),
        };
      }
    } catch { /* langue suivante */ }
  }
  return null;
}

export async function wiki(co) {
  const facts = await wikiFacts(co);
  if (!facts) return null;
  const summary = await wikiSummary(facts).catch(() => null);
  return {
    summary: summary?.summary || facts.description || null,
    url: summary?.url || `https://www.wikidata.org/wiki/${facts.id}`,
    thumb: summary?.thumb || null,
    lang: summary?.lang || null,
    wikidata: `https://www.wikidata.org/wiki/${facts.id}`,
    facts: facts.facts,
  };
}

/* ---------- GDELT : actualités ---------- */
// Noms trop courants : on ajoute un contexte « IA / bourse » à la recherche.
const AMBIGUOUS_NAMES = new Set(['apple', 'meta', 'oracle', 'intel', 'amazon', 'delta', 'flex', 'elastic', 'arm', 'cat', 'caterpillar', 'shopify', 'serve', 'figure', 'scale', 'iren', 'path', 'snowflake', 'disco', 'core', 'pure', 'safe']);
let gdeltQueue = Promise.resolve();
let lastGdelt = 0;

export function gdeltQuery(co) {
  const name = cleanName(co.name).replace(/["()]/g, '').trim();
  const first = norm(name).split(' ')[0];
  const ctx = AMBIGUOUS_NAMES.has(first) || AMBIGUOUS_NAMES.has(norm(name)) ? ' (AI OR stock OR shares OR bourse OR "intelligence artificielle")' : '';
  return `"${name}"${ctx} (sourcelang:french OR sourcelang:english)`;
}

export async function news(co) {
  return cached(`gdelt:${co.ticker}`, 15 * 60e3, () => {
    // GDELT tolère ~1 requête / 5 s par adresse IP : on sérialise les appels de l'instance.
    const run = gdeltQueue.then(async () => {
      const wait = Math.max(0, lastGdelt + 5200 - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastGdelt = Date.now();
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(gdeltQuery(co))}&mode=ArtList&format=json&maxrecords=8&sort=DateDesc&timespan=7d`;
      const json = await getJson(url);
      const seen = new Set();
      return (json.articles || [])
        .filter((a) => safeUrl(a.url) && a.title)
        .filter((a) => { const k = norm(a.title); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 6)
        .map((a) => ({
          title: a.title.trim(),
          url: a.url,
          source: a.domain || new URL(a.url).hostname,
          lang: /french/i.test(a.language) ? 'fr' : 'en',
          date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : null,
        }));
    });
    gdeltQueue = run.catch(() => {});
    return run;
  });
}

/* ---------- SEC EDGAR : comptes officiels (sociétés cotées aux États-Unis) ---------- */
const secHeaders = () => ({ 'User-Agent': process.env.SEC_USER_AGENT || UA });

async function cikOf(ticker) {
  const map = await cached('sec:tickers', 24 * 3600e3, async () => {
    const json = await getJson('https://www.sec.gov/files/company_tickers.json', secHeaders());
    return Object.fromEntries(Object.values(json).map((r) => [r.ticker.toUpperCase(), r.cik_str]));
  });
  return map[ticker.toUpperCase()] || null;
}

const days = (a, b) => (new Date(b) - new Date(a)) / 86400e3;

// Dernier exercice (10-K / 20-F, durée ~1 an) et dernier trimestre (~3 mois) + croissance sur un an.
export function summarizeConcept(units) {
  const rows = (units || []).filter((r) => r.start && r.end && Number.isFinite(r.val));
  const annual = rows.filter((r) => days(r.start, r.end) > 330 && days(r.start, r.end) < 380 && /10-K|20-F/.test(r.form || ''));
  const quarters = rows.filter((r) => days(r.start, r.end) > 80 && days(r.start, r.end) < 100);
  const latest = (list) => [...list].sort((a, b) => b.end.localeCompare(a.end) || (b.filed || '').localeCompare(a.filed || ''))[0] || null;
  const fy = latest(annual);
  const q = latest(quarters);
  let yoy = null;
  if (q) {
    const prev = quarters.find((r) => Math.abs(days(r.end, q.end) - 365) < 20);
    if (prev && prev.val) yoy = ((q.val - prev.val) / Math.abs(prev.val)) * 100;
  }
  return {
    fy: fy ? { end: fy.end, value: fy.val, fy: fy.fy } : null,
    quarter: q ? { end: q.end, value: q.val, yoy } : null,
  };
}

async function concept(cik, name) {
  const pad = String(cik).padStart(10, '0');
  const json = await getJson(`https://data.sec.gov/api/xbrl/companyconcept/CIK${pad}/us-gaap/${name}.json`, secHeaders());
  return json.units?.USD || [];
}

export async function sec(co) {
  if (!co.listed || !co.us) return null;
  return cached(`sec:${co.ticker}`, 6 * 3600e3, async () => {
    const cik = await cikOf(co.ticker);
    if (!cik) return null;
    const pad = String(cik).padStart(10, '0');
    const [subs, revs, ni] = await Promise.all([
      getJson(`https://data.sec.gov/submissions/CIK${pad}.json`, secHeaders()).catch(() => null),
      Promise.allSettled(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'].map((c) => concept(cik, c))),
      concept(cik, 'NetIncomeLoss').catch(() => []),
    ]);
    // Concept de chiffre d'affaires le plus à jour parmi ceux publiés.
    const revSummaries = revs.filter((r) => r.status === 'fulfilled').map((r) => summarizeConcept(r.value)).filter((s) => s.fy || s.quarter);
    const rev = revSummaries.sort((a, b) => (b.quarter?.end || b.fy?.end || '').localeCompare(a.quarter?.end || a.fy?.end || ''))[0] || { fy: null, quarter: null };
    const income = summarizeConcept(ni);

    const filings = [];
    const r = subs?.filings?.recent;
    if (r?.form) {
      for (let i = 0; i < r.form.length && filings.length < 5; i++) {
        if (!['10-K', '10-Q', '8-K', '20-F', '6-K'].includes(r.form[i])) continue;
        filings.push({
          form: r.form[i],
          date: r.filingDate[i],
          url: `https://www.sec.gov/Archives/edgar/data/${cik}/${String(r.accessionNumber[i]).replace(/-/g, '')}/${r.primaryDocument[i]}`,
        });
      }
    }
    if (!rev.fy && !rev.quarter && !filings.length) return null;
    return {
      cik,
      revenue: rev.fy,
      netIncome: income.fy,
      quarter: rev.quarter,
      filings,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${pad}`,
    };
  });
}

/* ---------- Agrégation ---------- */
export async function getKnowledge(co) {
  // Les actualités passent par une file d'attente (limite GDELT) : au-delà de 4 s, on répond sans elles
  // (l'appel continue en arrière-plan et remplit le cache pour la requête suivante).
  const newsOrTimeout = Promise.race([news(co), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))]);
  const [w, n, s] = await Promise.allSettled([wiki(co), newsOrTimeout, sec(co)]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  const out = {
    company: { ticker: co.ticker, name: co.name },
    wiki: val(w),
    news: val(n) || [],
    sec: val(s),
    unavailable: [w.status === 'rejected' && 'Wikipedia', n.status === 'rejected' && 'GDELT', s.status === 'rejected' && 'SEC EDGAR'].filter(Boolean),
  };
  out.sources = [
    out.wiki && { name: 'Wikipedia / Wikidata', url: out.wiki.url },
    out.news.length && { name: 'GDELT (actualités)', url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(gdeltQuery(co))}&mode=ArtList` },
    out.sec && { name: 'SEC EDGAR', url: out.sec.url },
  ].filter(Boolean);
  return out;
}

/** Résumé texte des données ouvertes, pour le contexte envoyé à Perplexity. */
export function knowledgeDigest(k) {
  if (!k) return '';
  const f = k.wiki?.facts || {};
  const lines = [`# ${k.company.name} (${k.company.ticker})`];
  if (k.wiki?.summary) lines.push(`Wikipedia : ${k.wiki.summary}`);
  const facts = [f.ceo && `PDG : ${f.ceo}`, f.hq && `siège : ${f.hq}`, f.founded && `fondée en ${f.founded}`, f.employees && `${f.employees.value} employés${f.employees.year ? ` (${f.employees.year})` : ''}`].filter(Boolean);
  if (facts.length) lines.push(`Fiche Wikidata : ${facts.join(', ')}.`);
  if (k.sec?.revenue) lines.push(`SEC : chiffre d'affaires exercice clos le ${k.sec.revenue.end} : ${(k.sec.revenue.value / 1e9).toFixed(1)} Md$${k.sec.netIncome ? ` ; résultat net : ${(k.sec.netIncome.value / 1e9).toFixed(1)} Md$` : ''}.`);
  if (k.sec?.quarter) lines.push(`SEC : dernier trimestre clos le ${k.sec.quarter.end} : ${(k.sec.quarter.value / 1e9).toFixed(1)} Md$${k.sec.quarter.yoy != null ? ` (${k.sec.quarter.yoy >= 0 ? '+' : ''}${k.sec.quarter.yoy.toFixed(0)} % sur un an)` : ''}.`);
  if (k.news?.length) lines.push(`Actualités récentes (GDELT) :\n${k.news.slice(0, 5).map((a) => `- ${a.date || ''} ${a.source} : ${a.title} (${a.url})`).join('\n')}`);
  return lines.join('\n');
}
