// Calculs partagés entre les vues.

/**
 * Capitalisation en milliards USD : valeur réelle (Yahoo, convertie en USD) si connue,
 * sinon estimation = capitalisation de référence × variation du jour.
 */
export function capOf(co, q) {
  if (!co.listed || !q) return co.cap;
  if (q.capUSD > 0) return q.capUSD;
  return co.cap * (q.price / q.prevClose);
}

/** Vrai si la capitalisation affichée est une estimation (pas une donnée de marché). */
export const capIsEstimate = (co, q) => co.listed && !(q?.capUSD > 0);

/**
 * Valeur « non actualisée » : en mode réel, aucune donnée n'a été reçue pour elle
 * (par ex. valeur internationale avec seulement une clé Finnhub). Elle reste à son prix de référence.
 */
export const isStale = (store, q) => store.mode === 'live' && q && !q.src;
