// Classement animé des plus fortes hausses / baisses : les lignes glissent quand l'ordre change.
import { COMPANIES } from '../data/companies.js';
import { fmtPct } from '../util.js';

const ROW = 22;
const N = 5;

export function createMovers(gainersEl, losersEl, store, { onSelect } = {}) {
  const listed = COMPANIES.filter((c) => c.listed);
  const rows = { gainers: new Map(), losers: new Map() };

  function rowFor(kind, parent, co) {
    let li = rows[kind].get(co.ticker);
    if (!li) {
      li = document.createElement('li');
      li.innerHTML = `<span>${co.ticker}</span><span></span>`;
      li.style.opacity = '0';
      li.style.transform = `translateY(${N * ROW}px)`;
      li.addEventListener('click', () => onSelect?.(co));
      parent.appendChild(li);
      rows[kind].set(co.ticker, li);
    }
    return li;
  }

  function update() {
    const sorted = listed
      .map((co) => ({ co, pct: store.get(co.ticker).changePct }))
      .sort((a, b) => b.pct - a.pct);
    const sets = {
      gainers: sorted.slice(0, N),
      losers: sorted.slice(-N).reverse(),
    };
    for (const kind of ['gainers', 'losers']) {
      const parent = kind === 'gainers' ? gainersEl : losersEl;
      const keep = new Set(sets[kind].map((x) => x.co.ticker));
      sets[kind].forEach(({ co, pct }, i) => {
        const li = rowFor(kind, parent, co);
        li.children[1].textContent = fmtPct(pct);
        li.style.color = pct >= 0 ? 'var(--up)' : 'var(--down)';
        requestAnimationFrame(() => {
          li.style.opacity = '1';
          li.style.transform = `translateY(${i * ROW}px)`;
        });
      });
      for (const [t, li] of rows[kind]) {
        if (!keep.has(t)) {
          li.style.opacity = '0';
          li.style.transform = `translateY(${N * ROW}px)`;
          setTimeout(() => {
            if (li.style.opacity === '0') { li.remove(); rows[kind].delete(t); }
          }, 600);
        }
      }
    }
  }

  update();
  setInterval(update, 2000);
}
