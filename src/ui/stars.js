// Champ d'étoiles animé en arrière-plan (canvas), avec légère parallaxe.
import { reducedMotion } from '../util.js';

export function createStars(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, stars = [];
  const mouse = { x: 0, y: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reducedMotion) {
        s.x -= s.z * 0.06;
        if (s.x < -2) s.x = w + 2;
      }
      const a = 0.25 + 0.55 * s.z * (0.6 + 0.4 * Math.sin(t / 900 + s.tw));
      const px = s.x - mouse.x * 14 * s.z;
      const py = s.y - mouse.y * 14 * s.z;
      ctx.fillStyle = `rgba(200,210,255,${a.toFixed(3)})`;
      ctx.fillRect(px, py, s.z * 1.6, s.z * 1.6);
    }
    if (!reducedMotion) requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  });
  resize();
  requestAnimationFrame(frame);
}
