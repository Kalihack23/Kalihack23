// Visualisation principale. Les mêmes bulles vivent dans trois modes :
//  - "pack"    (Galaxie) : regroupées par domaine, taille = capitalisation, flottent et se bousculent
//  - "bubbles" (Bulles)  : façon CoinGecko, libres, taille = variation du jour
//  - "orbit"   (Orbites) : système solaire, domaines = orbites
// Une simulation physique (d3-force) tourne en continu : dérive douce, collisions, glisser-lancer.
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
    active: true,
  }));
  const domById = Object.fromEntries(domains.map((d) => [d.id, d]));

  const nodes = COMPANIES.map((co, i) => ({
    co,
    dom: domById[co.domain],
    pack: { x: 0, y: 0, r: 0 },
    bubR: 10,
    orbR: 0,
    angle0: 0,
    vis: 1,
    s: 0,
    hov: 1,
    rip: 1,
    hl: 0,
    pct: 0,
    phase: i * 1.7,
    last: { tk: '', pc: '' },
  }));
  const byTicker = Object.fromEntries(nodes.map((n) => [n.co.ticker, n]));

  for (const d of domains) {
    const members = nodes.filter((n) => n.dom === d).sort((a, b) => b.co.cap - a.co.cap);
    const ring = ORBIT_ORDER.indexOf(d.id);
    members.forEach((n, i) => { n.angle0 = (i / members.length) * Math.PI * 2 + ring * 0.9; });
    d.meanVol = d3.mean(members, (n) => n.co.vol || 0.3);
  }

  const state = {
    mode: 'pack',
    blend: { m: 0 }, // 0 = position physique, 1 = orbite
    mix: { b: 0 }, // 0 = tailles Galaxie, 1 = tailles Bulles
    view: { x: 0, y: 0, k: 1 },
    zoomed: null,
    t: 0,
    index: 0,
    mouse: { x: 0, y: 0, sx: 0, sy: 0 },
    core: { s: 0 },
    query: '',
    dragging: null,
  };

  /* ---------- DOM ---------- */
  const defs = svg.append('defs');
  const coreGrad = defs.append('radialGradient').attr('id', 'coreGrad');
  coreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.9);
  coreGrad.append('stop').attr('offset', '35%').attr('stop-color', '#64d2ff').attr('stop-opacity', 0.45);
  coreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0a84ff').attr('stop-opacity', 0);
  // Reflet "perle de verre" partagé par toutes les bulles.
  const sheen = defs.append('radialGradient').attr('id', 'sheen').attr('cx', '35%').attr('cy', '28%').attr('r', '75%');
  sheen.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.32);
  sheen.append('stop').attr('offset', '45%').attr('stop-color', '#fff').attr('stop-opacity', 0.05);
  sheen.append('stop').attr('offset', '100%').attr('stop-color', '#fff').attr('stop-opacity', 0);

  const world = svg.append('g').attr('class', 'world');
  const coreG = world.append('g').attr('class', 'core').style('opacity', 0);
  const coreHalo = coreG.append('circle').attr('fill', 'url(#coreGrad)');
  const coreBall = coreG.append('circle').attr('fill', '#2c2c2e').attr('stroke-width', 1.5);
  const coreShine = coreG.append('circle').attr('fill', 'url(#sheen)');
  const coreTitle = coreG.append('text').attr('fill', '#f5f5f7').attr('font-weight', 700).text('IA');
  const coreSub = coreG.append('text');

  const ringLayer = world.append('g');
  const nodeLayer = world.append('g');

  const domG = ringLayer.selectAll('g').data(domains).join('g').attr('class', 'domain');
  domG.append('path').attr('id', (d) => `arc-${d.id}`).attr('fill', 'none');
  const domRing = domG
    .append('circle')
    .attr('class', 'domain-ring')
    .attr('stroke', (d) => d.color)
    .on('click', (ev, d) => {
      ev.stopPropagation();
      if (state.mode === 'pack') zoomTo(state.zoomed === d ? null : d);
    })
    .on('mouseenter', (_, d) => gsap.to(d, { hl: 1, duration: 0.3 }))
    .on('mouseleave', (_, d) => gsap.to(d, { hl: 0, duration: 0.5 }));
  domG.append('circle').attr('class', 'domain-dash').attr('stroke', (d) => d.color);
  domG
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
    .on('mouseenter', (ev, n) => {
      if (!state.dragging) gsap.to(n, { hov: 1.1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      onHover?.(n.co, ev);
    })
    .on('mousemove', (ev, n) => { if (!state.dragging) onHover?.(n.co, ev); })
    .on('mouseleave', (_, n) => {
      gsap.to(n, { hov: 1, duration: 0.4, ease: 'power2.out' });
      onLeave?.();
    })
    .on('click', (ev, n) => {
      ev.stopPropagation();
      onSelect?.(n.co);
    });
  nodeG.append('circle').attr('class', 'glow');
  nodeG.append('circle').attr('class', 'halo');
  nodeG
    .append('circle')
    .attr('class', 'body')
    .attr('fill', (n) => (n.co.listed ? colorFor(0) : n.dom.color))
    .attr('fill-opacity', (n) => (n.co.listed ? 0.2 : 0.05))
    .attr('stroke', (n) => (n.co.listed ? colorFor(0) : n.dom.color));
  nodeG.append('circle').attr('class', 'shine').attr('fill', 'url(#sheen)');
  nodeG.append('circle').attr('class', 'ripple');
  nodeG.append('text').attr('class', 'tk');
  nodeG.append('text').attr('class', 'pc');

  nodeG.each(function (n) {
    const g = d3.select(this);
    n.el = {
      g: this,
      glow: g.select('.glow').node(),
      halo: g.select('.halo').node(),
      body: g.select('.body').node(),
      shine: g.select('.shine').node(),
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

  /* ---------- Physique ---------- */
  // Rayon "physique" (espace monde, sans zoom) selon le mélange Galaxie ⇄ Bulles.
  const physR = (n) => lerp(n.pack.r, n.bubR, state.mix.b) * n.hov;
  const alive = (n) => n.show !== false; // visibilité cible (n.vis est la valeur animée)

  const collide = d3.forceCollide().strength(0.75).iterations(2);
  const fx = d3.forceX();
  const fy = d3.forceY();

  function targetX(n) {
    if (state.mode === 'bubbles' && alive(n)) return W / 2;
    return n.pack.x;
  }
  function targetY(n) {
    if (state.mode === 'bubbles' && alive(n)) return H / 2;
    return n.pack.y;
  }

  // Dérive douce (bruit sinusoïdal) : les bulles "respirent" comme sur CoinGecko.
  function drift() {
    if (reducedMotion) return;
    // amplitude ≈ amp / force de rappel → ~4 px de flottement en Galaxie, davantage en Bulles
    const amp = state.mode === 'bubbles' ? 0.16 : 0.32;
    const t = state.t;
    for (const n of nodes) {
      if (n.fx != null) continue;
      n.vx += Math.sin(t * 0.7 + n.phase) * amp;
      n.vy += Math.cos(t * 0.53 + n.phase * 1.3) * amp;
    }
  }

  // Rebonds contre les bords de la scène en mode Bulles.
  function bounds() {
    if (state.mode !== 'bubbles') return;
    for (const n of nodes) {
      if (!alive(n)) continue;
      const r = physR(n);
      if (n.x < r) { n.x = r; n.vx = Math.abs(n.vx) * 0.8; }
      if (n.x > W - r) { n.x = W - r; n.vx = -Math.abs(n.vx) * 0.8; }
      if (n.y < r) { n.y = r; n.vy = Math.abs(n.vy) * 0.8; }
      if (n.y > H - r) { n.y = H - r; n.vy = -Math.abs(n.vy) * 0.8; }
    }
  }

  const sim = d3
    .forceSimulation(nodes)
    .alpha(1)
    .alphaDecay(0)
    .velocityDecay(0.35)
    .force('x', fx)
    .force('y', fy)
    .force('collide', collide)
    .force('drift', drift)
    .force('bounds', bounds)
    .stop();

  // d3 met en cache cibles et forces : on les réapplique à chaque changement de mise en page / mode.
  function refreshForces() {
    const bub = state.mode === 'bubbles';
    fx.x(targetX).strength((n) => (bub && alive(n) ? 0.012 : 0.08));
    fy.y(targetY).strength((n) => (bub && alive(n) ? 0.016 : 0.08));
    sim.velocityDecay(state.mode === 'bubbles' ? 0.22 : 0.38);
  }

  /* ---------- Glisser-lancer ---------- */
  const toWorld = (sx, sy) => {
    const { x, y, k } = state.view;
    return [(sx - W / 2) / k + x, (sy - H / 2) / k + y];
  };
  let trail = [];
  nodeG.call(
    d3
      .drag()
      .container(svgEl)
      .subject((ev) => ({ x: ev.x, y: ev.y }))
      .clickDistance(5)
      .filter((ev) => !ev.button && state.blend.m < 0.5 && !reducedMotion)
      .on('start', (ev, n) => {
        state.dragging = n;
        const [wx, wy] = toWorld(ev.x, ev.y);
        n.fx = wx;
        n.fy = wy;
        trail = [{ x: wx, y: wy, t: performance.now() }];
        n.el.g.classList.add('grabbed');
        gsap.to(n, { hov: 1.15, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
        onLeave?.();
      })
      .on('drag', (ev, n) => {
        const [wx, wy] = toWorld(ev.x, ev.y);
        n.fx = wx;
        n.fy = wy;
        trail.push({ x: wx, y: wy, t: performance.now() });
        if (trail.length > 6) trail.shift();
      })
      .on('end', (ev, n) => {
        // Vitesse de lancer à partir des derniers points du geste.
        const a = trail[0], b = trail[trail.length - 1];
        const dt = Math.max(16, b.t - a.t);
        n.vx = clamp(((b.x - a.x) / dt) * 16, -40, 40);
        n.vy = clamp(((b.y - a.y) / dt) * 16, -40, 40);
        n.fx = null;
        n.fy = null;
        state.dragging = null;
        n.el.g.classList.remove('grabbed');
        gsap.to(n, { hov: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      }),
  );

  /* ---------- Mises en page ---------- */
  function layoutPack(animate) {
    const visible = domains.filter((d) => d.active);
    const root = d3
      .hierarchy({
        children: visible.map((d) => ({
          dom: d,
          children: nodes.filter((n) => n.dom === d).map((n) => ({ node: n })),
        })),
      })
      .sum((d) => (d.node ? Math.pow(d.node.co.cap, 0.62) : 0))
      .sort((a, b) => b.value - a.value);
    const pad = Math.min(W, H) < 500 ? 16 : 26;
    d3.pack().size([W, H]).padding((d) => (d.depth === 0 ? pad : 5))(root);

    const kids = root.children || [];
    const margin = Math.min(W, H) < 500 ? 22 : 34;
    const x0 = d3.min(kids, (d) => d.x - d.r), x1 = d3.max(kids, (d) => d.x + d.r);
    const y0 = d3.min(kids, (d) => d.y - d.r), y1 = d3.max(kids, (d) => d.y + d.r);
    const s = kids.length ? Math.min((W - 2 * margin) / (x1 - x0), (H - 2 * margin) / (y1 - y0)) : 1;
    const tx = (x) => (x - (x0 + x1) / 2) * s + W / 2;
    const ty = (y) => (y - (y0 + y1) / 2) * s + H / 2;

    const dur = animate && !reducedMotion ? 1.1 : 0;
    for (const dn of kids) {
      gsap.to(dn.data.dom.pack, { x: tx(dn.x), y: ty(dn.y), r: dn.r * s, duration: dur, ease: 'expo.inOut' });
      for (const ln of dn.children || []) {
        // La position cible est immédiate : la physique fait le trajet en douceur.
        Object.assign(ln.data.node.pack, { x: tx(ln.x), y: ty(ln.y) });
        gsap.to(ln.data.node.pack, { r: ln.r * s, duration: dur, ease: 'expo.inOut' });
      }
    }
  }

  // Mode Bulles : surface totale ≈ 42 % de la scène (36 % sur petit écran), rayon ∝ √(0,35 + |variation|).
  function layoutBubbles(animate = true) {
    const listed = nodes.filter((n) => n.co.listed && n.dom.active);
    if (!listed.length) return;
    const weight = (n) => 0.35 + Math.min(Math.abs(n.pct), 12);
    const total = d3.sum(listed, weight);
    const k = Math.sqrt((W * H * (Math.min(W, H) < 600 ? 0.36 : 0.42)) / (Math.PI * total));
    const maxR = Math.min(W, H) * 0.2;
    for (const n of nodes) {
      const r = n.co.listed ? clamp(k * Math.sqrt(weight(n)), 6, maxR) : 0;
      if (animate && !reducedMotion) gsap.to(n, { bubR: r, duration: 1.4, ease: 'elastic.out(1, 0.6)' });
      else n.bubR = r;
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
      d.orbit.w = 0.05 * (0.6 + d.meanVol) * Math.sqrt(Rmin / d.orbit.R) * (i % 2 ? -1 : 1);
    });
    for (const n of nodes) n.orbR = Math.max(3, rScale(n.co.cap));
  }

  let first = true;
  function resize() {
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    W = rect.width;
    H = rect.height;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    if (!state.zoomed) Object.assign(state.view, { x: W / 2, y: H / 2, k: 1 });
    layoutOrbit();
    layoutPack(false);
    layoutBubbles(false);
    if (first) {
      for (const n of nodes) { n.x = n.pack.x; n.y = n.pack.y; n.vx = 0; n.vy = 0; }
      first = false;
    }
    refreshForces();
    if (state.zoomed) zoomTo(state.zoomed, true);
  }

  /* ---------- Visibilité (filtres + mode) ---------- */
  function updateVisibility() {
    const q = state.query;
    for (const n of nodes) {
      const domOk = n.dom.active;
      const modeOk = !(state.mode === 'bubbles' && !n.co.listed);
      const show = domOk && modeOk;
      n.show = show;
      const qOk = !q
        || n.co.ticker.toLowerCase().includes(q)
        || n.co.name.toLowerCase().includes(q)
        || n.dom.name.toLowerCase().includes(q);
      gsap.to(n, { vis: show ? 1 : 0, duration: 0.7, ease: 'power3.inOut' });
      n.el.g.classList.toggle('dim', show && !!q && !qOk);
      n.el.g.style.pointerEvents = show ? '' : 'none';
      gsap.to(n, { hl: q && qOk && show ? 1 : 0, duration: 0.4 });
    }
    for (const d of domains) gsap.to(d, { vis: d.active ? 1 : 0, duration: 0.8, ease: 'power3.inOut' });
  }

  /* ---------- Interactions ---------- */
  function zoomTo(d, instant = false) {
    state.zoomed = d;
    const target = d
      ? { x: d.pack.x, y: d.pack.y, k: Math.min(W, H) / (2 * d.pack.r + 60) }
      : { x: W / 2, y: H / 2, k: 1 };
    gsap.to(state.view, { ...target, duration: instant || reducedMotion ? 0 : 1.2, ease: 'power3.inOut', overwrite: true });
    domRing.style('cursor', d ? 'zoom-out' : 'zoom-in');
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    const prev = state.mode;
    state.mode = mode;
    if (mode !== 'pack' && state.zoomed) zoomTo(null);
    domRing.classed('orbit', mode === 'orbit');
    svgEl.dataset.mode = mode;
    const dur = reducedMotion ? 0 : 1.5;
    gsap.to(state.blend, { m: mode === 'orbit' ? 1 : 0, duration: dur, ease: 'expo.inOut' });
    if (mode !== 'orbit') gsap.to(state.mix, { b: mode === 'bubbles' ? 1 : 0, duration: dur * 0.8, ease: 'power3.inOut' });
    gsap.to(state.core, { s: mode === 'orbit' ? 1 : 0, duration: reducedMotion ? 0 : 1.2, delay: mode === 'orbit' ? 0.5 : 0, ease: 'back.out(1.6)' });
    if (mode === 'bubbles') {
      layoutBubbles(false);
      // Petite impulsion pour que les bulles se dispersent joyeusement.
      if (!reducedMotion) for (const n of nodes) { n.vx += (Math.random() - 0.5) * 14; n.vy += (Math.random() - 0.5) * 14; }
    }
    if (prev === 'bubbles' || mode === 'bubbles') updateVisibility();
    refreshForces();
  }

  function setFilter({ activeDomains, query }) {
    state.query = (query || '').trim().toLowerCase();
    for (const d of domains) d.active = activeDomains.has(d.id);
    if (state.zoomed && !state.zoomed.active) zoomTo(null);
    updateVisibility();
    layoutPack(true);
    layoutBubbles(true);
    refreshForces();
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
      gsap.to([n.el.body, n.el.glow], { attr: { fill: c, stroke: c }, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(n, { pct: q.changePct, duration: 0.9, ease: 'power2.out' });
      if (q.dir !== 0) {
        n.el.ripple.setAttribute('stroke', q.dir > 0 ? '#30d158' : '#ff453a');
        gsap.fromTo(n, { rip: 0 }, { rip: 1, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      }
    } else {
      for (const el of [n.el.body, n.el.glow]) {
        el.setAttribute('fill', c);
        el.setAttribute('stroke', c);
      }
      n.pct = q.changePct;
    }
  }
  store.subscribe((q) => onQuote(q, true));
  // En mode Bulles, les tailles suivent les variations.
  setInterval(() => { if (state.mode === 'bubbles') layoutBubbles(true); }, 2000);

  function setIndex(pct) {
    state.index = pct;
  }

  /* ---------- Rendu image par image ---------- */
  function render(time, deltaMs) {
    if (!W) return;
    const dt = Math.min(deltaMs, 64) / 1000;
    if (!reducedMotion) state.t += dt;

    // Physique : rayons de collision à jour puis un pas de simulation.
    collide.radius((n) => (alive(n) ? physR(n) + (state.mode === 'bubbles' ? 2 : 1.2) : 0));
    sim.tick();

    const e = state.blend.m;
    const b = state.mix.b;
    const ms = state.mouse;
    ms.sx = lerp(ms.sx, ms.x, 0.04);
    ms.sy = lerp(ms.sy, ms.y, 0.04);
    if (!reducedMotion) world.attr('transform', `translate(${(-ms.sx * 6).toFixed(2)},${(-ms.sy * 6).toFixed(2)})`);

    const { x: vx, y: vy, k } = state.view;
    const cx = W / 2, cy = H / 2;

    for (const d of domains) {
      const px = (d.pack.x - vx) * k + cx;
      const py = (d.pack.y - vy) * k + cy;
      const pr = d.pack.r * k;
      const x = lerp(px, cx, e);
      const y = lerp(py, cy, e);
      const r = Math.max(0, lerp(pr, d.orbit.R, e) * d.vis * d.s);
      const ringOp = d.vis * Math.max(e, 1 - b);
      d.cur = { x, y, r };
      d.el.g.style.opacity = ringOp.toFixed(3);
      d.el.g.style.pointerEvents = ringOp > 0.3 ? '' : 'none';
      if (ringOp < 0.01) continue;
      d.el.ring.setAttribute('cx', x);
      d.el.ring.setAttribute('cy', y);
      d.el.ring.setAttribute('r', r);
      d.el.ring.setAttribute('stroke-opacity', (0.28 + d.hl * 0.45).toFixed(3));
      d.el.dash.setAttribute('cx', x);
      d.el.dash.setAttribute('cy', y);
      d.el.dash.setAttribute('r', r + 5);
      const lr = r + 9;
      d.el.arc.setAttribute('d', `M${x - lr},${y} A${lr},${lr} 0 0 1 ${x + lr},${y}`);
      const lblOp = state.zoomed && e < 0.5 ? (state.zoomed === d ? 1 : 0.15) : 1;
      d.el.label.style.opacity = (lblOp * clamp(r / 40, 0, 1)).toFixed(3);
      d.el.label.style.fontSize = `${clamp(r / 14, 9, 13)}px`;
    }

    for (const n of nodes) {
      const sx = (n.x - vx) * k + cx;
      const sy = (n.y - vy) * k + cy;
      const sr = physR(n) * k;
      const a = n.angle0 + state.t * n.dom.orbit.w;
      const ox = cx + Math.cos(a) * n.dom.orbit.R;
      const oy = cy + Math.sin(a) * n.dom.orbit.R;
      const x = lerp(sx, ox, e);
      const y = lerp(sy, oy, e);
      const r = Math.max(0, lerp(sr, n.orbR * n.hov, e) * n.vis * n.s);
      n.cur = { x, y, r };

      n.el.g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
      if (r < 0.3) {
        if (n.el.g.style.display !== 'none') n.el.g.style.display = 'none';
        continue;
      }
      if (n.el.g.style.display === 'none') n.el.g.style.display = '';
      const rs = r.toFixed(2);
      n.el.body.setAttribute('r', rs);
      n.el.shine.setAttribute('r', rs);

      // Halo lumineux pour les fortes variations (surtout en mode Bulles).
      const big = Math.min(1, Math.abs(n.pct) / 4);
      const glowOp = n.co.listed ? 0.22 * b * (1 - e) * big : 0; // halo : mode Bulles uniquement
      n.el.glow.setAttribute('r', (r + 2 + Math.min(r * 0.12, 6) * big).toFixed(2));
      n.el.glow.setAttribute('fill-opacity', glowOp.toFixed(3));

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

      const fs = clamp(r * 0.36, 8, 26);
      const showTk = r > 13;
      const showPc = r > 22;
      const tk = showTk ? (n.co.ticker.length > 6 ? n.co.name.split(' ')[0] : n.co.ticker) : '';
      const pc = showPc ? (n.co.listed ? fmtPct(n.pct) : fmtCap(n.co.cap)) : '';
      if (tk !== n.last.tk) { n.el.tk.textContent = tk; n.last.tk = tk; }
      if (pc !== n.last.pc) { n.el.pc.textContent = pc; n.last.pc = pc; }
      if (showTk) {
        n.el.tk.setAttribute('font-size', fs.toFixed(1));
        n.el.tk.setAttribute('y', (showPc ? -fs * 0.08 : fs * 0.35).toFixed(1));
      }
      if (showPc) {
        n.el.pc.setAttribute('font-size', (fs * 0.66).toFixed(1));
        n.el.pc.setAttribute('y', (fs * 0.85).toFixed(1));
      }
    }

    const cs = state.core.s;
    coreG.style('opacity', clamp(cs, 0, 1));
    if (cs > 0.001) {
      const cr = (state.coreR || 30) * cs;
      const pulse = 1 + Math.sin(time * 2.2) * 0.05;
      const ic = colorFor(state.index);
      coreHalo.attr('cx', cx).attr('cy', cy).attr('r', cr * 2 * pulse);
      coreBall.attr('cx', cx).attr('cy', cy).attr('r', cr).attr('stroke', ic);
      coreShine.attr('cx', cx).attr('cy', cy).attr('r', cr);
      coreTitle.attr('x', cx).attr('y', cy + (cr > 26 ? -2 : cr * 0.15)).attr('font-size', clamp(cr * 0.55, 10, 26));
      coreSub.attr('x', cx).attr('y', cy + cr * 0.48).attr('font-size', clamp(cr * 0.26, 8, 13)).attr('fill', ic)
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
    tl.to(nodes, { s: 1, duration: 1.2, ease: 'elastic.out(1, 0.55)', stagger: { each: 0.016, from: 'random' } }, 0.35);
  }

  svgEl.dataset.mode = 'pack';
  resize();
  new ResizeObserver(() => resize()).observe(svgEl);
  gsap.ticker.add(render);
  intro();

  function snapshot() {
    return {
      width: W,
      height: H,
      mode: state.mode,
      core: state.core.s > 0.5 ? { x: W / 2, y: H / 2, r: state.coreR, index: state.index } : null,
      domains: state.mode === 'bubbles' ? [] : domains.filter((d) => d.cur && d.cur.r > 1 && d.vis > 0.5).map((d) => ({ ...d.cur, color: d.color, name: d.name })),
      nodes: nodes.filter((n) => n.cur && n.cur.r > 0.5).map((n) => ({
        ...n.cur,
        ticker: n.co.ticker,
        name: n.co.name,
        listed: n.co.listed,
        pct: n.pct,
        cap: n.co.cap,
        color: n.co.listed ? n.el.body.getAttribute('fill') : n.dom.color,
      })),
    };
  }

  return { setMode, setFilter, setSelected, setIndex, snapshot, zoomTo: (id) => zoomTo(id ? domById[id] : null) };
}
