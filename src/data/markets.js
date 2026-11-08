// Horaires des bourses (séance régulière, hors jours fériés) pour afficher « Marché ouvert / fermé ».
// Utilisé quand Yahoo ne fournit pas l'état du marché (marketState).
const EXCHANGES = {
  US: { name: 'NYSE / Nasdaq', tz: 'America/New_York', sessions: [[9.5, 16]] },
  PA: { name: 'Euronext Paris', tz: 'Europe/Paris', sessions: [[9, 17.5]] },
  AS: { name: 'Euronext Amsterdam', tz: 'Europe/Amsterdam', sessions: [[9, 17.5]] },
  DE: { name: 'Xetra', tz: 'Europe/Berlin', sessions: [[9, 17.5]] },
  SW: { name: 'SIX Suisse', tz: 'Europe/Zurich', sessions: [[9, 17.5]] },
  T: { name: 'Bourse de Tokyo', tz: 'Asia/Tokyo', sessions: [[9, 11.5], [12.5, 15.5]] },
  KS: { name: 'KRX Séoul', tz: 'Asia/Seoul', sessions: [[9, 15.5]] },
  HK: { name: 'HKEX', tz: 'Asia/Hong_Kong', sessions: [[9.5, 12], [13, 16]] },
  TW: { name: 'TWSE Taïwan', tz: 'Asia/Taipei', sessions: [[9, 13.5]] },
  SS: { name: 'Bourse de Shanghai', tz: 'Asia/Shanghai', sessions: [[9.5, 11.5], [13, 15]] },
  MI: { name: 'Euronext Milan', tz: 'Europe/Rome', sessions: [[9, 17.5]] },
};

export function exchangeOf(co) {
  if (!co.listed) return null;
  const suffix = co.symbol.includes('.') ? co.symbol.split('.').pop() : 'US';
  return EXCHANGES[suffix] || EXCHANGES.US;
}

const fmtCache = {};
function localParts(tz, date) {
  fmtCache[tz] ??= new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const parts = Object.fromEntries(fmtCache[tz].formatToParts(date).map((p) => [p.type, p.value]));
  return { weekday: parts.weekday, hour: +parts.hour + +parts.minute / 60 };
}

/** Estimation locale : la bourse de cette valeur est-elle en séance ? */
export function isOpenLocal(co, date = new Date()) {
  const ex = exchangeOf(co);
  if (!ex) return false;
  const { weekday, hour } = localParts(ex.tz, date);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return ex.sessions.some(([a, b]) => hour >= a && hour < b);
}

/** État du marché : Yahoo si connu (REGULAR = ouvert), sinon estimation par les horaires. */
export function marketStatus(co, q, date = new Date()) {
  if (!co.listed) return null;
  if (q?.marketState) {
    if (q.marketState === 'REGULAR') return 'open';
    if (q.marketState === 'PRE' || q.marketState === 'PREPRE') return 'pre';
    if (q.marketState === 'POST' || q.marketState === 'POSTPOST') return 'post';
    return 'closed';
  }
  return isOpenLocal(co, date) ? 'open' : 'closed';
}

export const STATUS_LABEL = {
  open: 'Marché ouvert',
  pre: 'Pré-ouverture',
  post: 'Après clôture',
  closed: 'Marché fermé',
};
