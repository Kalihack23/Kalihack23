// Graphique d'historique interactif (ligne + aire + réticule au survol).
import * as d3 from 'd3';
import { fmtPct, fmtPrice } from '../util.js';

const dateFmt = {
  intraday: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  short: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  day: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }),
};

let gid = 0;

// points : [[timestamp|index, prix], ...]
export function renderHistoryChart(container, points, { color, currency, baseline, mode = 'day', animate = true } = {}) {
  container.innerHTML = '';
  if (!points || points.length < 2) {
    container.innerHTML = '<p class="p-empty">Pas assez de données pour le moment.</p>';
    return;
  }
  const W = 380, H = 180, padT = 18, padB = 34, padX = 4;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const lo = Math.min(...ys, baseline ?? Infinity);
  const hi = Math.max(...ys, baseline ?? -Infinity);
  const x = d3.scaleLinear([0, points.length - 1], [padX, W - padX]);
  const y = d3.scaleLinear([lo, hi === lo ? lo + 1 : hi], [H - padB, padT]);
  const id = `hg${++gid}`;
  const line = d3.line((_, i) => x(i), (p) => y(p[1])).curve(d3.curveMonotoneX);
  const area = d3.area((_, i) => x(i), H - padB, (p) => y(p[1])).curve(d3.curveMonotoneX);
  const fmtT = (t) => (mode === 'live' ? '' : (mode === 'intraday' ? dateFmt.short : dateFmt.day).format(new Date(t)));

  const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'hist-svg');
  const grad = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  grad.append('stop').attr('offset', 0).attr('stop-color', color).attr('stop-opacity', 0.35);
  grad.append('stop').attr('offset', 1).attr('stop-color', color).attr('stop-opacity', 0);

  if (baseline != null) {
    svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(baseline)).attr('y2', y(baseline))
      .attr('stroke', 'rgba(255,255,255,.18)').attr('stroke-dasharray', '3 4');
  }
  svg.append('path').attr('d', area(points)).attr('fill', `url(#${id})`);
  const path = svg.append('path').attr('d', line(points)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);

  // Min / max et bornes temporelles.
  const iMax = ys.indexOf(Math.max(...ys));
  const iMin = ys.indexOf(Math.min(...ys));
  const lbl = (i, dy) => svg.append('text').attr('class', 'hist-lbl')
    .attr('x', Math.min(Math.max(x(i), 40), W - 40)).attr('y', y(ys[i]) + dy).attr('text-anchor', 'middle')
    .text(fmtPrice(ys[i], currency));
  lbl(iMax, -6);
  if (iMin !== iMax) lbl(iMin, 14);
  if (mode !== 'live') {
    svg.append('text').attr('class', 'hist-lbl dim').attr('x', padX).attr('y', H - 5).text(fmtT(xs[0]));
    svg.append('text').attr('class', 'hist-lbl dim').attr('x', W - padX).attr('y', H - 5).attr('text-anchor', 'end').text(fmtT(xs[xs.length - 1]));
  }

  // Réticule interactif.
  const cross = svg.append('g').style('opacity', 0);
  cross.append('line').attr('y1', padT - 6).attr('y2', H - padB).attr('stroke', 'rgba(255,255,255,.35)');
  const dot = cross.append('circle').attr('r', 4).attr('fill', color).attr('stroke', '#05060d').attr('stroke-width', 2);
  const readout = cross.append('text').attr('class', 'hist-readout').attr('y', 10);
  const first = ys[0];
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [mx] = d3.pointer(ev);
      const i = Math.max(0, Math.min(points.length - 1, Math.round(x.invert(mx))));
      const px = x(i);
      cross.style('opacity', 1);
      cross.select('line').attr('x1', px).attr('x2', px);
      dot.attr('cx', px).attr('cy', y(ys[i]));
      const t = fmtT(xs[i]);
      readout
        .attr('x', Math.min(Math.max(px, 90), W - 90))
        .attr('text-anchor', 'middle')
        .text(`${fmtPrice(ys[i], currency)}  ${fmtPct(((ys[i] - first) / first) * 100)}${t ? `  · ${t}` : ''}`);
    })
    .on('pointerleave', () => cross.style('opacity', 0));

  if (animate) {
    const len = path.node().getTotalLength();
    path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
      .node().animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1100, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
  }
}
