// Composants "Liquid Glass" inspirés d'Apple :
//  - reflet spéculaire qui suit le pointeur sur toutes les surfaces .glass
//  - effet "ressort" à l'appui sur les boutons
//  - contrôle segmenté avec une lentille de verre qui coulisse, s'étire et se tire au doigt
import { gsap } from 'gsap';
import { reducedMotion } from '../util.js';

const PRESSABLE = 'button, .chip, .seg-item, .tape-item, .movers li';

export function initGlass() {
  // Reflet spéculaire : position du pointeur en variables CSS sur la surface survolée.
  let lastEl = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.glass');
    if (lastEl && lastEl !== el) lastEl.style.removeProperty('--hover');
    lastEl = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.style.setProperty('--hover', '1');
  }, { passive: true });

  if (reducedMotion) return;
  // Appui "ressort" : on enfonce, puis rebond élastique au relâchement.
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.closest('.seg')) return;
    gsap.to(el, { scale: 0.94, duration: 0.14, ease: 'power2.out', overwrite: 'auto' });
    const up = () => {
      gsap.to(el, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.4)', overwrite: 'auto' });
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/**
 * Contrôle segmenté en verre liquide.
 * @param {HTMLElement} el conteneur (vidé puis rempli)
 * @param {{ items: {id: string, label: string}[], value: string, onChange: (id: string) => void, label?: string }} opts
 */
export function createSegmented(el, { items, value, onChange, label }) {
  el.classList.add('seg');
  el.setAttribute('role', 'tablist');
  if (label) el.setAttribute('aria-label', label);
  el.innerHTML = '';
  const lens = document.createElement('span');
  lens.className = 'seg-lens';
  lens.setAttribute('aria-hidden', 'true');
  el.appendChild(lens);

  const buttons = items.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-item';
    b.setAttribute('role', 'tab');
    b.dataset.id = it.id;
    b.textContent = it.label;
    el.appendChild(b);
    return b;
  });

  let current = value;
  let lensX = 0;
  let lensW = 0;

  const btnOf = (id) => buttons.find((b) => b.dataset.id === id) || buttons[0];

  function paintActive(id) {
    for (const b of buttons) {
      const on = b.dataset.id === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  function place(id, animate) {
    const b = btnOf(id);
    const x = b.offsetLeft;
    const w = b.offsetWidth;
    const dist = Math.abs(x - lensX);
    lensX = x;
    lensW = w;
    if (!animate || reducedMotion) {
      gsap.set(lens, { x, width: w, scaleX: 1, scaleY: 1 });
      return;
    }
    // Glissement à ressort + étirement proportionnel à la distance (squash & stretch).
    gsap.to(lens, { x, width: w, duration: 0.75, ease: 'elastic.out(1, 0.72)', overwrite: 'auto' });
    gsap.timeline({ overwrite: 'auto' })
      .to(lens, { scaleX: 1 + Math.min(dist / 260, 0.45), scaleY: 0.86, duration: 0.16, ease: 'power2.out' })
      .to(lens, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.4)' });
  }

  function select(id, { animate = true, emit = true } = {}) {
    const changed = id !== current;
    current = id;
    paintActive(id);
    place(id, animate);
    if (changed && emit) onChange?.(id);
  }

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));

  // Clavier : flèches gauche/droite.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = buttons.findIndex((b) => b.dataset.id === current);
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    select(buttons[j].dataset.id);
    buttons[j].focus();
    e.preventDefault();
  });

  // La lentille se tire au doigt / à la souris (on attrape le segment actif),
  // avec un étirement qui dépend de la vitesse du geste.
  let drag = null;
  const nearest = (center) => buttons.reduce((a, b) => (
    Math.abs(b.offsetLeft + b.offsetWidth / 2 - center) < Math.abs(a.offsetLeft + a.offsetWidth / 2 - center) ? b : a));
  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.seg-item');
    if (!b || b.dataset.id !== current || reducedMotion) return;
    el.setPointerCapture(e.pointerId);
    drag = { start: e.clientX, x0: lensX, lastX: e.clientX, lastT: performance.now(), moved: false };
    gsap.to(lens, { scaleX: 1.1, scaleY: 1.1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const max = el.clientWidth - lensW - 3;
    const x = Math.max(3, Math.min(max, drag.x0 + e.clientX - drag.start));
    const now = performance.now();
    const v = Math.abs(e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = now;
    if (Math.abs(e.clientX - drag.start) > 3) drag.moved = true;
    lensX = x;
    gsap.to(lens, { x, scaleX: 1.1 + Math.min(v * 0.35, 0.35), scaleY: 1.1 - Math.min(v * 0.12, 0.12), duration: 0.12, overwrite: 'auto' });
    paintActive(nearest(x + lensW / 2).dataset.id);
  });
  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    el.classList.remove('dragging');
    const target = nearest(lensX + lensW / 2).dataset.id;
    if (moved) {
      // Empêche le clic qui suit le glissement de resélectionner l'ancien segment.
      const eat = (ev) => ev.stopPropagation();
      el.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', eat, { capture: true }), 80);
    }
    current === target ? place(target, true) : select(target);
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  const relayout = () => place(current, false);
  new ResizeObserver(relayout).observe(el);
  document.fonts?.ready.then(relayout);

  paintActive(current);
  requestAnimationFrame(relayout);

  return {
    get value() { return current; },
    select,
  };
}
