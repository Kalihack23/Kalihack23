import * as d3 from 'd3';

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Échelle divergente rouge → neutre → vert, saturée à ±3 %.
export const colorScale = d3
  .scaleLinear()
  .domain([-3, -0.4, 0, 0.4, 3])
  .range(['#ff3b5c', '#c2415e', '#6b7299', '#2fae7a', '#19e68c'])
  .interpolate(d3.interpolateRgb)
  .clamp(true);

export const colorFor = (pct) => colorScale(pct || 0);

const priceFmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPrice = (p) => (p > 0 ? `${priceFmt.format(p)} $` : '—');
export const fmtPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')} %`;
export const arrow = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '•');

export function fmtCap(billions) {
  if (billions >= 1000) return `${(billions / 1000).toFixed(2).replace('.', ',')} T$`;
  if (billions >= 1) return `${Math.round(billions)} Md$`;
  return `${Math.round(billions * 1000)} M$`;
}
