// Thème clair / sombre : choix mémorisé, sinon réglage de l'appareil.
// Le thème est porté par <html data-theme="light|dark"> ; tout le reste lit des variables CSS.
const KEY = 'aiorbit.theme';
const listeners = new Set();

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function stored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function apply(t) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'light' ? '#f2f2f7' : '#1c1c1e';
  for (const fn of listeners) {
    try { fn(t); } catch (e) { console.error(e); }
  }
}

/**
 * Change de thème. Avec `origin` (événement de clic), révélation circulaire depuis le bouton
 * via l'API View Transitions quand le navigateur la propose ; sinon fondu des couleurs.
 */
export function setTheme(t, origin) {
  if (t === getTheme()) return;
  try { localStorage.setItem(KEY, t); } catch { /* stockage indisponible */ }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && origin && !reduce) {
    const x = origin.clientX ?? window.innerWidth - 40;
    const y = origin.clientY ?? 30;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(() => apply(t));
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    return;
  }
  const root = document.documentElement;
  if (!reduce) root.classList.add('theme-anim');
  apply(t);
  setTimeout(() => root.classList.remove('theme-anim'), 600);
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Si l'utilisateur n'a rien choisi, on suit les changements du réglage système.
window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (e) => {
  if (!stored()) apply(e.matches ? 'light' : 'dark');
});
