// Petites notifications en verre (en haut de l'écran), façon iOS.
import { gsap } from 'gsap';
import { reducedMotion } from '../util.js';

let host = null;
function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'toasts';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

/**
 * @param {string} title
 * @param {{ body?: string, action?: { label: string, onClick: Function }, duration?: number, tone?: 'info'|'up'|'down'|'error' }} [opts]
 */
export function toast(title, { body = '', action = null, duration = 5000, tone = 'info' } = {}) {
  const el = document.createElement('div');
  el.className = `toast glass tone-${tone}`;
  el.innerHTML = `<div class="toast-text"><b></b>${body ? '<span></span>' : ''}</div>${action ? '<button type="button" class="toast-action"></button>' : ''}<button type="button" class="toast-close" aria-label="Fermer">×</button>`;
  el.querySelector('b').textContent = title;
  if (body) el.querySelector('span').textContent = body;
  const close = () => {
    if (!el.isConnected) return;
    if (reducedMotion) { el.remove(); return; }
    gsap.to(el, { y: -16, opacity: 0, scale: 0.96, duration: 0.3, ease: 'power2.in', onComplete: () => el.remove() });
  };
  if (action) {
    const b = el.querySelector('.toast-action');
    b.textContent = action.label;
    b.addEventListener('click', () => { action.onClick(); close(); });
  }
  el.querySelector('.toast-close').addEventListener('click', close);
  ensureHost().appendChild(el);
  if (!reducedMotion) gsap.from(el, { y: -24, opacity: 0, scale: 0.95, duration: 0.6, ease: 'elastic.out(1, 0.7)' });
  if (duration) setTimeout(close, duration);
  return close;
}
