import * as d3 from 'd3';

let gid = 0;

// Renvoie le balisage SVG d'une sparkline (aire en dégradé + ligne + point final).
export function sparklineSVG(values, { width = 180, height = 44, color = '#19e68c', baseline } = {}) {
  if (!values || values.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
  const pad = 3;
  const lo = Math.min(...values, baseline ?? Infinity);
  const hi = Math.max(...values, baseline ?? -Infinity);
  const x = d3.scaleLinear([0, values.length - 1], [pad, width - pad]);
  const y = d3.scaleLinear([lo, hi === lo ? lo + 1 : hi], [height - pad, pad]);
  const line = d3.line((_, i) => x(i), y).curve(d3.curveMonotoneX);
  const area = d3.area((_, i) => x(i), height, y).curve(d3.curveMonotoneX);
  const id = `sg${++gid}`;
  const last = values[values.length - 1];
  const base = baseline != null
    ? `<line x1="0" x2="${width}" y1="${y(baseline)}" y2="${y(baseline)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>`
    : '';
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${base}
    <path d="${area(values)}" fill="url(#${id})"/>
    <path class="spark-line" d="${line(values)}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(values.length - 1)}" cy="${y(last)}" r="3" fill="${color}"/>
  </svg>`;
}
