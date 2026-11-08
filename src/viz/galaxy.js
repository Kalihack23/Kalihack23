// Visualisation principale : les mêmes bulles se transforment entre
//  - "Galaxie" : circle packing (domaines = grands cercles, entreprises = bulles, taille = capitalisation)
//  - "Orbites" : système solaire (domaines = orbites concentriques, entreprises = planètes)
import * as d3 from 'd3';
import { gsap } from 'gsap';
import { COMPANIES, DOMAINS } from '../data/companies.js';
import { colorFor, fmtCap, fmtPct, reducedMotion } from '../util.js';

const ORBIT_ORDER = ['private', 'robotics', 'data', 'infra', 'cloud', 'software', 'chips'];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createGalaxy(svgEl, store, { onSelect, onHover, onLeave, onBackground } = {}) {
  const svg = d3.select(svgEl);
  let W = 0, H = 0;

  /* ---------- Modèle ---------- */
  const domains = DOMAINS.map((d) => ({
    ...d,
    pack: { x: 0, y: 0, r: 0 },
    orbit: { R: 0, w: 0 },
    vis: 1,
    s: 0,
    hl: 0,
  }));
  const domById = Object.fromEntries(domains.map((d) => [d.id, d]));

  const nodes = COMPANIES.map((co) => ({
    co,
    dom: domById[co.domain],
    pack: { x: 0, y: 0, r: 0 },
    orbR: 0,
    angle0: 0,
    vis: 1,
    s: 0,
    rip: 1,
    hl: 0,
    pct: 0,
    last: { tk: '', pc: '' },
  }));
  const byTicker = Object.fromEntries(nodes.map((n) => [n.co.ticker, n]));

  // Angle de départ de chaque planète sur son orbite.
  for (const d of domains) {
    const members = nodes.filter((n) => n.dom === d).sort((a, b) => b.co.cap - a.co.cap);
    const ring = ORBIT_ORDER.indexOf(d.id);
    members.forEach((n, i) => { n.angle0 = (i / members.length) * Math.PI * 2 + ring * 0.9; });
    const vols = members.map((n) => n.co.vol || 0.3);
    d.meanVol = d3.mean(vols);
  }

  const state = {
    mode: 'pack',
    blend: { m: 0 },
    view: { x: 0, y: 0, k: 1 },
    zoomed: null,
    t: 0,
    index: 0,
    mouse: { x: 0, y: 0, sx: 0, sy: 0 },
    core: { s: 0 },
  };

  /* ---------- DOM ---------- */
  const defs = svg.append('defs');
  const coreGrad = defs.append('radialGradient').attr('id', 'coreGrad');
  coreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.95);
  coreGrad.append('stop').attr('offset', '30%').attr('stop-color', '#9b85ff').attr('stop-opacity', 0.8);
  coreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#7c5cff').attr('stop-opacity', 0);
  const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', 6).attr('result', 'b');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'b');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const world = svg.append('g').attr('class', 'world');
  const coreG = world.append('g').attr('class', 'core').style('opacity', 0);
  const coreHalo = coreG.append('circle').attr('fill', 'url(#coreGrad)');
  const coreBall = coreG.append('circle').attr('fill', '#120f2b').attr('stroke', '#9b85ff').attr('stroke-width', 1.5).attr('filter', 'url(#glow)');
  const coreTitle = coreG.append('text').attr('fill', '#fff').attr('font-weight', 700).text('IA');
  const coreSub = coreG.append('text').attr('fill', '#8a91b4');

  const ringLayer = world.append('g');
  const nodeLayer = world.append('g');

  const domG = ringLayer
    .selectAll('g')
    .data(domains)
    .join('g')
    .attr('class', 'domain');
  domG.append('path').attr('id', (d) => `arc-${d.id}`).attr('fill', 'none');
  const domRing = domG
    .append('circle')
    .attr('class', 'domain-ring')
    .attr('stroke', (d) => d.color)
    .attr('stroke-opacity', 0.55)
    .on('click', (ev, d) => {
      ev.stopPropagation();
      if (state.mode === 'pack') zoomTo(state.zoomed === d ? null : d);
    })
    .on('mouseenter', (_, d) => gsap.to(d, { hl: 1, duration: 0.3 }))
    .on('mouseleave', (_, d) => gsap.to(d, { hl: 0, duration: 0.5 }));
  const domDash = domG.append('circle').attr('class', 'domain-dash').attr('stroke', (d) => d.color);
  const domLabel = domG
    .append('text')
    .attr('class', 'domain-label')
    .attr('fill', (d) => d.color)
    .append('textPath')
    .attr('href', (d) => `#arc-${d.id}`)
    .attr('startOffset', '50%')
    .text((d) => d.name);

  const nodeG = nodeLayer
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', (n) => `node${n.co.listed ? '' : ' private'}`)
    .on('mouseenter mousemove', (ev, n) => onHover?.(n.co, ev))
    .on('mouseleave', () => onLeave?.())
    .on('click', (ev, n) => {
      ev.stopPropagation();
      onSelect?.(n.co);
    });
  nodeG.append('circle').attr('class', 'halo');
  const bodies = nodeG
    .append('circle')
    .attr('class', 'body')
    .attr('fill', (n) => (n.co.listed ? colorFor(0) : n.dom.color))
    .attr('fill-opacity', (n) => (n.co.listed ? 0.22 : 0.06))
    .attr('stroke', (n) => (n.co.listed ? colorFor(0) : n.dom.color));
  nodeG.append('circle').attr('class', 'ripple');
  nodeG.append('text').attr('class', 'tk');
  nodeG.append('text').attr('class', 'pc');

  // Cache des éléments par nœud pour le rendu image par image.
  nodeG.each(function (n) {
    const g = d3.select(this);
    n.el = {
      g: this,
      halo: g.select('.halo').node(),
      body: g.select('.body').node(),
      ripple: g.select('.ripple').node(),
      tk: g.select('.tk').node(),
      pc: g.select('.pc').node(),
    };
  });
  domG.each(function (d) {
    const g = d3.select(this);
    d.el = {
      g: this,
      arc: g.select('path').node(),
      ring: g.select('.domain-ring').node(),
      dash: g.select('.domain-dash').node(),
      label: g.select('text').node(),
    };
  });

  svg.on('click', () => {
    if (state.zoomed) zoomTo(null);
    onBackground?.();
  });
  svg.on('mousemove', (ev) => {
    state.mouse.x = (ev.offsetX / (W || 1) - 0.5) * 2;
    state.mouse.y = (ev.offsetY / (H || 1) - 0.5) * 2;
  });

  /* ---------- Mises en page ---------- */
  function layoutPack(animate) {
    const visible = domains.filter((d) => d.active !== false);
    const root = d3
      .hierarchy({
        children: visible.map((d) => ({
          dom: d,
          children: nodes.filter((n) => n.dom === d && n.matchFilter !== false).map((n) => ({ node: n })),
        })),
      })
      .sum((d) => (d.node ? Math.pow(d.node.co.cap, 0.62) : 0))
      .sort((a, b) => b.value - a.value);
    const pad = Math.min(W, H) < 500 ? 16 : 26;
    d3.pack().size([W, H]).padding((d) => (d.depth === 0 ? pad : 4))(root);

    // Recadrage : on agrandit l'ensemble pour remplir la scène (marge pour les étiquettes).
    const kids = root.children || [];
    const margin = Math.min(W, H) < 500 ? 22 : 34;
    const x0 = d3.min(kids, (d) => d.x - d.r), x1 = d3.max(kids, (d) => d.x + d.r);
    const y0 = d3.min(kids, (d) => d.y - d.r), y1 = d3.max(kids, (d) => d.y + d.r);
    const s = kids.length ? Math.min((W - 2 * margin) / (x1 - x0), (H - 2 * margin) / (y1 - y0)) : 1;
    const fx = (x) => (x - (x0 + x1) / 2) * s + W / 2;
    const fy = (y) => (y - (y0 + y1) / 2) * s + H / 2;

    const dur = animate && !reducedMotion ? 1.1 : 0;
    for (const dn of kids) {
      gsap.to(dn.data.dom.pack, { x: fx(dn.x), y: fy(dn.y), r: dn.r * s, duration: dur, ease: 'expo.inOut' });
      for (const ln of dn.children || []) {
        gsap.to(ln.data.node.pack, { x: fx(ln.x), y: fy(ln.y), r: ln.r * s, duration: dur, ease: 'expo.inOut' });
      }
    }
  }

  function layoutOrbit() {
    const Rmax = Math.min(W, H) / 2 - (Math.min(W, H) < 500 ? 14 : 30);
    const Rmin = Rmax * 0.24;
    const step = (Rmax - Rmin) / (ORBIT_ORDER.length - 1);
    state.coreR = Rmin * 0.5;
    const rScale = d3.scaleSqrt([0, d3.max(COMPANIES, (c) => c.cap)], [0, step * 0.55]);
    ORBIT_ORDER.forEach((id, i) => {
      const d = domById[id];
      d.orbit.R = Rmin + i * step;
      // Plus l'orbite est proche et le secteur volatil, plus elle tourne vite.
      d.orbit.w = 0.05 * (0.6 + d.meanVol) * Math.sqrt(Rmin / d.orbit.R) * (i % 2 ? -1 : 1);
    });
    for (const n of nodes) n.orbR = Math.max(3, rScale(n.co.cap));
  }

  function resize() {
    const rect = svgEl.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    if (!state.zoomed) Object.assign(state.view, { x: W / 2, y: H / 2, k: 1 });
    layoutOrbit();
    layoutPack(false);
    if (state.zoomed) zoomTo(state.zoomed, true);
  }

  /* ---------- Interactions ---------- */
  function zoomTo(d, instant = false) {
    state.zoomed = d;
    const target = d
      ? { x: d.pack.x, y: d.pack.y, k: Math.min(W, H) / (2 * d.pack.r + 60) }
      : { x: W / 2, y: H / 2, k: 1 };
    gsap.to(state.view, { ...target, duration: instant || reducedMotion ? 0 : 1.2, ease: 'power3.inOut', overwrite: true });
    nodeG.style('cursor', 'pointer');
    domRing.style('cursor', d ? 'zoom-out' : 'zoom-in');
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    if (mode === 'orbit' && state.zoomed) zoomTo(null);
    domRing.classed('orbit', mode === 'orbit');
    gsap.to(state.blend, { m: mode === 'orbit' ? 1 : 0, duration: reducedMotion ? 0 : 1.6, ease: 'expo.inOut' });
    gsap.to(state.core, { s: mode === 'orbit' ? 1 : 0, duration: reducedMotion ? 0 : 1.2, delay: mode === 'orbit' ? 0.5 : 0, ease: 'back.out(1.6)' });
  }

  // Filtres : domaines actifs + recherche texte.
  function setFilter({ activeDomains, query }) {
    const q = (query || '').trim().toLowerCase();
    for (const d of domains) d.active = activeDomains.has(d.id);
    for (const n of nodes) {
      const domOk = n.dom.active;
      const qOk = !q
        || n.co.ticker.toLowerCase().includes(q)
        || n.co.name.toLowerCase().includes(q)
        || n.dom.name.toLowerCase().includes(q);
      n.matchFilter = domOk;
      gsap.to(n, { vis: domOk ? 1 : 0, duration: 0.8, ease: 'power3.inOut' });
      n.el.g.classList.toggle('dim', domOk && !!q && !qOk);
      gsap.to(n, { hl: q && qOk && domOk ? 1 : 0, duration: 0.4 });
    }
    for (const d of domains) gsap.to(d, { vis: d.active ? 1 : 0, duration: 0.8, ease: 'power3.inOut' });
    if (state.zoomed && !state.zoomed.active) zoomTo(null);
    layoutPack(true);
  }

  function setSelected(ticker) {
    for (const n of nodes) n.sel = n.co.ticker === ticker;
  }

  /* ---------- Cotations ---------- */
  function onQuote(q, animate = true) {
    const n = byTicker[q.ticker];
    if (!n || !n.co.listed) return;
    const c = colorFor(q.changePct);
    if (animate && !reducedMotion) {
      gsap.to(n.el.body, { attr: { fill: c, stroke: c }, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(n, { pct: q.changePct, duration: 0.9, ease: 'power2.out' });
      if (q.dir !== 0) {
        n.el.ripple.setAttribute('stroke', q.dir > 0 ? '#19e68c' : '#ff3b5c');
        gsap.fromTo(n, { rip: 0 }, { rip: 1, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      }
    } else {
      n.el.body.setAttribute('fill', c);
      n.el.body.setAttribute('stroke', c);
      n.pct = q.changePct;
    }
  }
  store.subscribe((q) => onQuote(q, true));

  function setIndex(pct) {
    state.index = pct;
  }

  /* ---------- Rendu image par image ---------- */
  function render(time, deltaMs) {
    const dt = Math.min(deltaMs, 64) / 1000;
    const e = state.blend.m;
    if (!reducedMotion) state.t += dt;

    // Parallaxe douce avec la souris.
    const ms = state.mouse;
    ms.sx = lerp(ms.sx, ms.x, 0.04);
    ms.sy = lerp(ms.sy, ms.y, 0.04);
    if (!reducedMotion) world.attr('transform', `translate(${(-ms.sx * 8).toFixed(2)},${(-ms.sy * 8).toFixed(2)})`);

    const { x: vx, y: vy, k } = state.view;
    const cx = W / 2, cy = H / 2;

    for (const d of domains) {
      const px = (d.pack.x - vx) * k + cx;
      const py = (d.pack.y - vy) * k + cy;
      const pr = d.pack.r * k;
      const x = lerp(px, cx, e);
      const y = lerp(py, cy, e);
      const r = Math.max(0, lerp(pr, d.orbit.R, e) * d.vis * d.s);
      d.cur = { x, y, r };
      d.el.ring.setAttribute('cx', x);
      d.el.ring.setAttribute('cy', y);
      d.el.ring.setAttribute('r', r);
      d.el.ring.setAttribute('stroke-opacity', (0.35 + d.hl * 0.5).toFixed(3));
      d.el.dash.setAttribute('cx', x);
      d.el.dash.setAttribute('cy', y);
      d.el.dash.setAttribute('r', r + 5);
      d.el.g.style.opacity = d.vis.toFixed(3);
      const lr = r + 9;
      d.el.arc.setAttribute('d', `M${x - lr},${y} A${lr},${lr} 0 0 1 ${x + lr},${y}`);
      // Masque les étiquettes quand on est zoomé sur un autre domaine.
      const lblOp = state.zoomed && e < 0.5 ? (state.zoomed === d ? 1 : 0.15) : 1;
      d.el.label.style.opacity = (lblOp * clamp(r / 40, 0, 1)).toFixed(3);
      d.el.label.style.fontSize = `${clamp(r / 14, 9, 13)}px`;
    }

    for (const n of nodes) {
      const px = (n.pack.x - vx) * k + cx;
      const py = (n.pack.y - vy) * k + cy;
      const pr = n.pack.r * k;
      const a = n.angle0 + state.t * n.dom.orbit.w;
      const ox = cx + Math.cos(a) * n.dom.orbit.R;
      const oy = cy + Math.sin(a) * n.dom.orbit.R;
      const x = lerp(px, ox, e);
      const y = lerp(py, oy, e);
      const r = Math.max(0, lerp(pr, n.orbR, e) * n.vis * n.s);

      n.el.g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
      n.el.body.setAttribute('r', r.toFixed(2));

      const haloOp = Math.max(n.hl, n.sel ? 1 : 0);
      n.el.halo.setAttribute('r', (r + 4 + Math.sin(time * 4) * 1.5).toFixed(2));
      n.el.halo.setAttribute('stroke', n.sel ? '#ffffff' : n.dom.color);
      n.el.halo.setAttribute('stroke-opacity', (haloOp * 0.9).toFixed(3));

      if (n.rip < 1) {
        n.el.ripple.setAttribute('r', (r * (1 + n.rip * 0.35) + 2 + n.rip * 6).toFixed(2));
        n.el.ripple.style.opacity = ((1 - n.rip) * 0.7).toFixed(3);
      } else if (n.el.ripple.style.opacity !== '0') {
        n.el.ripple.style.opacity = '0';
      }

      const fs = clamp(r * 0.36, 8, 24);
      const showTk = r > 13;
      const showPc = r > 24;
      const tk = showTk ? (n.co.ticker.length > 6 ? n.co.name.split(' ')[0] : n.co.ticker) : '';
      const pc = showPc ? (n.co.listed ? fmtPct(n.pct) : fmtCap(n.co.cap)) : '';
      if (tk !== n.last.tk) { n.el.tk.textContent = tk; n.last.tk = tk; }
      if (pc !== n.last.pc) { n.el.pc.textContent = pc; n.last.pc = pc; }
      if (showTk) {
        n.el.tk.setAttribute('font-size', fs.toFixed(1));
        n.el.tk.setAttribute('y', (showPc ? -fs * 0.08 : fs * 0.35).toFixed(1));
      }
      if (showPc) {
        n.el.pc.setAttribute('font-size', (fs * 0.68).toFixed(1));
        n.el.pc.setAttribute('y', (fs * 0.85).toFixed(1));
      }
    }

    // Noyau "IA" au centre du système solaire.
    const cs = state.core.s;
    coreG.style('opacity', clamp(cs, 0, 1));
    if (cs > 0.001) {
      const cr = (state.coreR || 30) * cs;
      const pulse = 1 + Math.sin(time * 2.2) * 0.06;
      coreHalo.attr('cx', cx).attr('cy', cy).attr('r', cr * 2.1 * pulse);
      coreBall.attr('cx', cx).attr('cy', cy).attr('r', cr).attr('stroke', colorFor(state.index));
      coreTitle.attr('x', cx).attr('y', cy + (cr > 26 ? -2 : cr * 0.15)).attr('font-size', clamp(cr * 0.55, 10, 26));
      coreSub
        .attr('x', cx)
        .attr('y', cy + cr * 0.48)
        .attr('font-size', clamp(cr * 0.26, 8, 13))
        .attr('fill', colorFor(state.index))
        .text(cr > 26 ? fmtPct(state.index) : '');
    }
  }

  /* ---------- Démarrage ---------- */
  function intro() {
    for (const q of store.quotes.values()) onQuote(q, false);
    if (reducedMotion) {
      for (const d of domains) d.s = 1;
      for (const n of nodes) n.s = 1;
      return;
    }
    const tl = gsap.timeline({ delay: 0.2 });
    tl.to(domains, { s: 1, duration: 1.4, ease: 'expo.out', stagger: 0.09 });
    tl.to(nodes, { s: 1, duration: 1.2, ease: 'elastic.out(1, 0.55)', stagger: { each: 0.018, from: 'random' } }, 0.35);
  }

  resize();
  new ResizeObserver(() => resize()).observe(svgEl);
  gsap.ticker.add(render);
  intro();

  return { setMode, setFilter, setSelected, setIndex, zoomTo: (id) => zoomTo(id ? domById[id] : null) };
}
