// Alertes de prix : évaluation pure (testable), indépendante de l'interface et du stockage.
import { fmtPct, fmtPrice } from '../util.js';

export const ALERT_KINDS = {
  above: 'Passe au-dessus de',
  below: 'Passe en dessous de',
  move: 'Varie de plus de (± %)',
};

const sameDay = (a, b) => {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

/** Description lisible d'une alerte. */
export function describeAlert(a, currency = 'USD') {
  if (a.kind === 'move') return `${a.ticker} varie de plus de ±${String(a.value).replace('.', ',')} %`;
  return `${a.ticker} ${a.kind === 'above' ? 'au-dessus de' : 'en dessous de'} ${fmtPrice(+a.value, currency)}`;
}

/**
 * Alertes déclenchées par les cours actuels.
 * Une alerte ne se déclenche qu'une fois par jour (last_triggered_at), et seulement sur des cours réels.
 * @param {Array} alerts
 * @param {(ticker: string) => object|undefined} getQuote
 * @param {Date} [now]
 */
export function evaluateAlerts(alerts, getQuote, now = new Date()) {
  const fired = [];
  for (const a of alerts) {
    if (!a.active) continue;
    if (a.last_triggered_at && sameDay(a.last_triggered_at, now)) continue;
    const q = getQuote(a.ticker);
    if (!q || !(q.price > 0) || !q.src || q.src === 'sim') continue;
    const v = +a.value;
    let hit = false;
    if (a.kind === 'above') hit = q.price >= v;
    else if (a.kind === 'below') hit = q.price <= v;
    else if (a.kind === 'move') hit = Math.abs(q.changePct) >= v;
    if (!hit) continue;
    const detail = a.kind === 'move'
      ? `${fmtPct(q.changePct)} aujourd’hui`
      : `${fmtPrice(q.price, q.currency)} (${fmtPct(q.changePct)})`;
    fired.push({ alert: a, quote: q, title: `Alerte ${a.ticker}`, body: `${describeAlert(a, q.currency)} — ${detail}` });
  }
  return fired;
}
