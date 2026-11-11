import * as d3 from './d3.js';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
export const reducedMotion = hasDOM && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Échelles divergentes (couleurs système Apple) rouge → gris → vert, saturées à ±3 %,
// une par thème (le vert et le rouge d'iOS diffèrent entre mode clair et sombre).
const makeScale = (range) => d3.scaleLinear().domain([-3, -0.4, 0, 0.4, 3]).range(range).interpolate(d3.interpolateRgb).clamp(true);
const SCALES = {
  dark: makeScale(['#ff453a', '#c2524a', '#8e8e93', '#3fa864', '#30d158']),
  light: makeScale(['#ff3b30', '#e0665e', '#aeaeb2', '#5cc777', '#34c759']),
};
const isLight = () => hasDOM && document.documentElement.dataset.theme === 'light';

export const colorFor = (pct) => (isLight() ? SCALES.light : SCALES.dark)(pct || 0);

// Valeurs des variables CSS du thème courant (pour le SVG / canvas dessinés en JS).
let cache = null;
let cacheTheme = null;
export function themeColors() {
  const t = isLight() ? 'light' : 'dark';
  if (cache && cacheTheme === t) return cache;
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  cache = {
    theme: t,
    bg: v('--bg'),
    bg2: v('--bg-2'),
    text: v('--text'),
    text2: v('--text-2'),
    text3: v('--text-3'),
    up: v('--up'),
    down: v('--down'),
    sep: v('--sep'),
    baseline: v('--baseline'),
    bubbleFillOp: +v('--bubble-fill-op') || 0.2,
    privateFillOp: +v('--private-fill-op') || 0.05,
    shineOp: +v('--shine-op') || 0.32,
    coreFill: v('--core-fill') || '#2c2c2e',
    gold: v('--gold') || '#ffd60a',
  };
  cacheTheme = t;
  return cache;
}

const fmtCache = {};
function priceFormatter(currency) {
  if (!fmtCache[currency]) {
    const noDecimals = ['JPY', 'KRW', 'TWD'].includes(currency);
    fmtCache[currency] = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    });
  }
  return fmtCache[currency];
}

export const fmtPrice = (p, currency = 'USD') => (p > 0 ? priceFormatter(currency).format(p) : '—');
// Espaces insécables (\u00a0) : « 1,07 % » ou « 36,90 T$ » ne se coupent jamais en deux lignes.
export const fmtPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')}\u00a0%`;
export const arrow = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '•');

export function fmtCap(billions) {
  if (billions >= 1000) return `${(billions / 1000).toFixed(2).replace('.', ',')}\u00a0T$`;
  if (billions >= 1) return `${Math.round(billions)}\u00a0Md$`;
  return `${Math.round(billions * 1000)}\u00a0M$`;
}
