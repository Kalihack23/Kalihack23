// Graphique façon app Bourse d'Apple :
//  - ligne unique verte/rouge (selon la performance de la période) + dégradé dessous
//  - échelle de prix à droite, quadrillage très léger, clôture veille en pointillés
//  - « scrubbing » : on parcourt la courbe au doigt / à la souris ; un callback remonte
//    le point survolé pour mettre à jour l'en-tête (prix, variation, date), comme sur iOS.
import * as d3 from '../d3.js';
import { themeColors } from '../util.js';

const fmt = {
  hour: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }),
  dayMonth: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }),
  month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }),
  full: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  fullDay: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
};

// Libellé de date affiché pendant le scrubbing.
export function scrubLabel(t, mode) {
  if (mode === 'live') return 'Séance';
  return (mode === 'intraday' ? fmt.full : fmt.fullDay).format(new Date(t));
}

let gid = 0;

// Échelle de droite : nombres seuls, sans devise (comme l'app Bourse).
const axisNum = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2, minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v);

/**
 * @param {HTMLElement} container
 * @param {[number, number][]} points [[timestamp|index, prix], ...]
 * @param {{ currency?: string, baseline?: number, mode?: 'live'|'intraday'|'day', range?: string,
 *           animate?: boolean, onScrub?: (p: {t:number, price:number, i:number}|null) => void }} opts
 */
export function renderHistoryChart(container, points, { baseline, mode = 'day', range = '1mo', animate = true, onScrub } = {}) {
  container.innerHTML = '';
  if (!points || points.length < 2) {
    container.innerHTML = '<p class="p-empty">Pas assez de données pour le moment.</p>';
    return { color: themeColors().up };
  }
  const W = 380, H = 210, padT = 10, padB = 24, gutter = 46;
  const plotW = W - gutter;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const ref = baseline ?? ys[0];
  const tc = themeColors();
  const color = ys[ys.length - 1] >= ref ? tc.up : tc.down;

  let lo = Math.min(...ys, baseline ?? Infinity);
  let hi = Math.max(...ys, baseline ?? -Infinity);
  const padY = (hi - lo || hi * 0.01 || 1) * 0.08;
  lo -= padY;
  hi += padY;
  const x = d3.scaleLinear([0, points.length - 1], [0, plotW]);
  const y = d3.scaleLinear([lo, hi], [H - padB, padT]).nice(4);
  const id = `hg${++gid}`;

  const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'hist-svg');
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  grad.append('stop').attr('offset', 0).attr('stop-color', color).attr('stop-opacity', 0.32);
  grad.append('stop').attr('offset', 1).attr('stop-color', color).attr('stop-opacity', 0);
  const clipId = `${id}c`;
  const clipRect = defs.append('clipPath').attr('id', clipId).append('rect').attr('x', 0).attr('y', 0).attr('width', plotW).attr('height', H);

  // Quadrillage + échelle de prix à droite.
  const ticks = y.ticks(4);
  const grid = svg.append('g').attr('class', 'hist-grid');
  for (const v of ticks) {
    grid.append('line').attr('x1', 0).attr('x2', plotW).attr('y1', y(v)).attr('y2', y(v));
    grid.append('text').attr('class', 'hist-lbl dim').attr('x', W - 2).attr('y', y(v) + 3.5).attr('text-anchor', 'end')
      .text(axisNum(v));
  }

  // Graduations temporelles (bas).
  if (mode !== 'live') {
    const n = points.length;
    const count = range === '5d' ? 5 : 4;
    const seen = new Set();
    for (let k = 0; k < count; k++) {
      const i = Math.round((k + 0.5) * (n / count));
      if (i >= n) continue;
      const t = new Date(xs[i]);
      const label = range === '5d' ? fmt.weekday.format(t) : range === '1mo' ? fmt.dayMonth.format(t) : fmt.month.format(t);
      if (seen.has(label)) continue;
      seen.add(label);
      svg.append('text').attr('class', 'hist-lbl dim').attr('x', x(i)).attr('y', H - 6).attr('text-anchor', 'middle').text(label);
    }
  }

  if (baseline != null) {
    svg.append('line').attr('class', 'hist-base').attr('x1', 0).attr('x2', plotW).attr('y1', y(baseline)).attr('y2', y(baseline));
  }

  const line = d3.line((_, i) => x(i), (p) => y(p[1])).curve(d3.curveMonotoneX);
  const area = d3.area((_, i) => x(i), H - padB, (p) => y(p[1])).curve(d3.curveMonotoneX);
  const plot = svg.append('g').attr('clip-path', `url(#${clipId})`);
  plot.append('path').attr('d', area(points)).attr('fill', `url(#${id})`);
  plot.append('path').attr('d', line(points)).attr('fill', 'none').attr('stroke', color)
    .attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');

  // Voile qui assombrit la partie à droite du doigt pendant le scrubbing.
  const veil = svg.append('rect').attr('class', 'hist-veil').attr('y', 0).attr('height', H - padB).attr('width', 0).attr('x', plotW);
  const cross = svg.append('g').attr('class', 'hist-cross').style('opacity', 0);
  cross.append('line').attr('y1', 0).attr('y2', H - padB);
  const dot = cross.append('circle').attr('r', 5).attr('fill', color);

  const hit = svg.append('rect').attr('width', plotW).attr('height', H).attr('fill', 'transparent').style('cursor', 'crosshair');
  const move = (ev) => {
    const [mx] = d3.pointer(ev);
    const i = Math.max(0, Math.min(points.length - 1, Math.round(x.invert(mx))));
    const px = x(i);
    cross.style('opacity', 1);
    cross.select('line').attr('x1', px).attr('x2', px);
    dot.attr('cx', px).attr('cy', y(ys[i]));
    veil.attr('x', px).attr('width', plotW - px);
    onScrub?.({ t: xs[i], price: ys[i], i });
  };
  const leave = () => {
    cross.style('opacity', 0);
    veil.attr('x', plotW).attr('width', 0);
    onScrub?.(null);
  };
  hit.on('pointerdown pointermove', move).on('pointerleave pointercancel', leave);

  if (animate) {
    // Révélation de gauche à droite, comme l'app Bourse.
    clipRect.attr('width', 0).node().animate([{ width: '0px' }, { width: `${plotW}px` }], { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    setTimeout(() => clipRect.attr('width', plotW), 950);
  }
  return { color, first: ys[0], last: ys[ys.length - 1], ref };
}

// Mini-courbe pour la liste de valeurs (comme dans la liste de l'app Bourse).
export function miniChartSVG(values, baseline, { width = 64, height = 30 } = {}) {
  if (!values || values.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
  const lo = Math.min(...values, baseline);
  const hi = Math.max(...values, baseline);
  const x = d3.scaleLinear([0, values.length - 1], [1, width - 1]);
  const y = d3.scaleLinear([lo, hi === lo ? lo + 1 : hi], [height - 2, 2]);
  const tc = themeColors();
  const color = values[values.length - 1] >= baseline ? tc.up : tc.down;
  const d = d3.line((_, i) => x(i), y).curve(d3.curveMonotoneX)(values);
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <line x1="0" x2="${width}" y1="${y(baseline).toFixed(1)}" y2="${y(baseline).toFixed(1)}" stroke="${tc.baseline}" stroke-dasharray="1.5 2.5"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
