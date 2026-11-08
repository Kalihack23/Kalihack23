// Infobulle au survol + panneau de détail (mis à jour en direct).
import { gsap } from 'gsap';
import { domainById } from '../data/companies.js';
import { sparklineSVG } from '../viz/sparkline.js';
import { arrow, colorFor, fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';

const COUNTRY = { US: 'États-Unis', TW: 'Taïwan', NL: 'Pays-Bas', GB: 'Royaume-Uni', IE: 'Irlande', DE: 'Allemagne', CH: 'Suisse', FR: 'France' };

export function createTooltip(el, store) {
  let current = null;

  function html(co) {
    const dom = domainById[co.domain];
    if (!co.listed) {
      return `<div class="tt-head"><b>${co.name}</b><span style="color:${dom.color}">●</span></div>
        <div class="tt-name">${dom.name}</div>
        <div class="tt-px">${fmtCap(co.cap)}</div>
        <div class="tt-name">Valorisation privée estimée · non cotée</div>`;
    }
    const q = store.get(co.ticker);
    const c = colorFor(q.changePct);
    return `<div class="tt-head"><b>${co.ticker}</b><span class="tt-pct" style="color:${c}">${arrow(q.changePct)} ${fmtPct(q.changePct)}</span></div>
      <div class="tt-name">${co.name} · <span style="color:${dom.color}">${dom.short}</span></div>
      <div class="tt-px">${fmtPrice(q.price)}</div>
      ${sparklineSVG(q.history, { width: 190, height: 40, color: c, baseline: q.prevClose })}`;
  }

  function show(co, ev) {
    if (current !== co) {
      current = co;
      el.innerHTML = html(co);
    }
    const pad = 16;
    const r = el.getBoundingClientRect();
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.add('show');
  }

  function hide() {
    current = null;
    el.classList.remove('show');
  }

  store.subscribe((q) => {
    if (current && current.ticker === q.ticker) el.innerHTML = html(current);
  });

  return { show, hide };
}

export function createPanel(el, body, closeBtn, store, { onClose } = {}) {
  let current = null;
  const shown = { price: 0 };

  function render(co) {
    const dom = domainById[co.domain];
    const q = store.get(co.ticker);
    const listed = co.listed;
    const c = listed ? colorFor(q.changePct) : dom.color;
    body.innerHTML = `
      <span class="p-domain"><i style="background:${dom.color};box-shadow:0 0 8px ${dom.color}"></i>${dom.name}</span>
      <h2 class="p-title">${co.name}</h2>
      <div class="p-ticker">${listed ? co.ticker : 'Non coté'} · ${COUNTRY[co.country] || co.country}</div>
      <div class="p-price" id="p-price">${listed ? fmtPrice(q.price) : fmtCap(co.cap)}</div>
      <div class="p-change" id="p-change" style="color:${c}">${listed ? `${arrow(q.changePct)} ${fmtPct(q.changePct)} aujourd’hui` : 'Valorisation privée estimée'}</div>
      ${listed ? `<div class="p-chart" id="p-chart">${sparklineSVG(q.history, { width: 380, height: 160, color: c, baseline: q.prevClose })}</div>` : ''}
      <p class="p-role">${co.role}</p>
      <div class="p-grid">
        ${listed ? `<div class="p-cell"><span>Clôture veille</span><b>${fmtPrice(q.prevClose)}</b></div>` : ''}
        <div class="p-cell"><span>${listed ? 'Capitalisation' : 'Valorisation'}</span><b id="p-cap">${fmtCap(listed ? co.cap * (q.price / q.prevClose) : co.cap)}</b></div>
        ${listed ? `<div class="p-cell"><span>Volatilité (an.)</span><b>${Math.round(co.vol * 100)} %</b></div>` : ''}
        <div class="p-cell"><span>Domaine</span><b style="color:${dom.color}">${dom.short}</b></div>
      </div>
      <p class="p-note">Capitalisations et valorisations approximatives, données à titre informatif — pas un conseil en investissement.</p>`;
    shown.price = q.price;
  }

  function update(q) {
    const priceEl = body.querySelector('#p-price');
    const chEl = body.querySelector('#p-change');
    const chart = body.querySelector('#p-chart');
    const capEl = body.querySelector('#p-cap');
    if (!priceEl) return;
    const c = colorFor(q.changePct);
    // Compteur animé du prix.
    gsap.to(shown, {
      price: q.price,
      duration: reducedMotion ? 0 : 0.8,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => { priceEl.textContent = fmtPrice(shown.price); },
    });
    chEl.textContent = `${arrow(q.changePct)} ${fmtPct(q.changePct)} aujourd’hui`;
    chEl.style.color = c;
    if (chart) chart.innerHTML = sparklineSVG(q.history, { width: 380, height: 160, color: c, baseline: q.prevClose });
    if (capEl) capEl.textContent = fmtCap(current.cap * (q.price / q.prevClose));
  }

  function open(co) {
    current = co;
    render(co);
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    if (!reducedMotion) {
      gsap.fromTo(body.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out', delay: 0.1 });
      const line = body.querySelector('.spark-line');
      if (line) {
        const len = line.getTotalLength();
        gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', delay: 0.2 });
      }
    }
  }

  function close() {
    current = null;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    onClose?.();
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
  store.subscribe((q) => { if (current && current.listed && current.ticker === q.ticker) update(q); });

  return { open, close, get current() { return current; } };
}
