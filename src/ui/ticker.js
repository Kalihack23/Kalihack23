// Bandeau défilant des cours (contenu dupliqué pour une boucle sans couture).
import { COMPANIES } from '../data/companies.js';
import { arrow, colorFor, fmtPct, fmtPrice } from '../util.js';

export function createTicker(el, store, { onSelect } = {}) {
  const listed = COMPANIES.filter((c) => c.listed).sort((a, b) => b.cap - a.cap);
  const items = new Map();

  for (let pass = 0; pass < 2; pass++) {
    for (const co of listed) {
      const node = document.createElement('span');
      node.className = 'tape-item';
      node.innerHTML = `<b>${co.ticker}</b><span class="px"></span><span class="pct"></span>`;
      node.addEventListener('click', () => onSelect?.(co));
      el.appendChild(node);
      if (!items.has(co.ticker)) items.set(co.ticker, []);
      items.get(co.ticker).push(node);
    }
  }

  function paint(q, flash) {
    const nodes = items.get(q.ticker);
    if (!nodes) return;
    for (const node of nodes) {
      node.children[1].textContent = fmtPrice(q.price, q.currency);
      const pct = node.children[2];
      pct.textContent = `${arrow(q.changePct)} ${fmtPct(q.changePct)}`;
      pct.style.color = colorFor(q.changePct * 2);
      if (flash && q.dir) {
        node.classList.remove('flash-up', 'flash-down');
        void node.offsetWidth;
        node.classList.add(q.dir > 0 ? 'flash-up' : 'flash-down');
      }
    }
  }

  for (const q of store.quotes.values()) paint(q, false);
  store.subscribe((q) => paint(q, true));
}
