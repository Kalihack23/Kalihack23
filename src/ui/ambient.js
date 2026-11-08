// Fond d'ambiance façon Apple : quelques halos de lumière très diffus qui dérivent lentement
// sur un fond graphite. Rendu en basse résolution (c'est flou par nature) et à ~30 i/s.
import { reducedMotion } from '../util.js';
import { getTheme, onThemeChange } from './theme.js';

const LIGHT_BLOBS = [
  { c: [0, 122, 255], a: 0.1, r: 0.55, sx: 0.07, sy: 0.05, ox: 0.75, oy: 0.2 },
  { c: [175, 82, 222], a: 0.07, r: 0.5, sx: 0.05, sy: 0.08, ox: 0.2, oy: 0.75 },
  { c: [90, 200, 250], a: 0.08, r: 0.45, sx: 0.09, sy: 0.04, ox: 0.5, oy: 0.55 },
  { c: [255, 255, 255], a: 0.7, r: 0.6, sx: 0.03, sy: 0.06, ox: 0.3, oy: 0.15 },
];

const BLOBS = [
  { c: [10, 132, 255], a: 0.16, r: 0.55, sx: 0.07, sy: 0.05, ox: 0.75, oy: 0.2 },
  { c: [191, 90, 242], a: 0.1, r: 0.5, sx: 0.05, sy: 0.08, ox: 0.2, oy: 0.75 },
  { c: [100, 210, 255], a: 0.08, r: 0.45, sx: 0.09, sy: 0.04, ox: 0.5, oy: 0.55 },
  { c: [255, 255, 255], a: 0.045, r: 0.6, sx: 0.03, sy: 0.06, ox: 0.3, oy: 0.15 },
];
const SCALE = 0.25;

export function createAmbient(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, last = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

  function resize() {
    w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
    h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
    canvas.width = w;
    canvas.height = h;
    draw(performance.now());
  }

  function draw(t) {
    const s = t / 1000;
    mouse.sx += (mouse.x - mouse.sx) * 0.03;
    mouse.sy += (mouse.y - mouse.sy) * 0.03;
    const light = getTheme() === 'light';
    ctx.fillStyle = light ? '#f2f2f7' : '#1c1c1e';
    ctx.fillRect(0, 0, w, h);
    // En sombre, les halos s'additionnent (lumière) ; en clair, ils se superposent simplement.
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    const m = Math.max(w, h);
    (light ? LIGHT_BLOBS : BLOBS).forEach((b, i) => {
      const x = (b.ox + Math.sin(s * b.sx + i) * 0.12 + mouse.sx * 0.03 * (i + 1)) * w;
      const y = (b.oy + Math.cos(s * b.sy + i * 2) * 0.1 + mouse.sy * 0.03 * (i + 1)) * h;
      const r = b.r * m;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${b.c},${b.a})`);
      g.addColorStop(1, `rgba(${b.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    ctx.globalCompositeOperation = 'source-over';
    if (light) return;
    // Vignette douce.
    const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, m * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function loop(t) {
    if (t - last > 33) {
      draw(t);
      last = t;
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  onThemeChange(() => draw(performance.now()));
  resize();
  if (!reducedMotion) requestAnimationFrame(loop);
}
