// « Demander à Orbit » : chatbot sur les entreprises du site.
//  - Perplexity via /api/chat (réponses en continu + sources) quand la clé est configurée sur Vercel
//  - sinon assistant local (src/data/assistant.js), sans coût ni clé
import { gsap } from 'gsap';
import { COMPANIES } from '../data/companies.js';
import { capOf } from '../data/derived.js';
import { STATUS_LABEL, marketStatus } from '../data/markets.js';
import { findCompanies, localAnswer } from '../data/assistant.js';
import { fmtCap, fmtPct, fmtPrice, reducedMotion } from '../util.js';

const byTicker = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c]));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : null);

/** Markdown léger et sûr : gras, italique, liens http(s), listes, renvois [n], symboles cliquables. */
export function renderMarkdown(md, sources = []) {
  const inline = (t) => {
    let h = esc(t);
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[\s(])_(.+?)_(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    h = h.replace(/\[(\d{1,2})\]/g, (_, n) => {
      const s = sources[+n - 1];
      return s && safeUrl(s.url) ? `<sup><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${n}</a></sup>` : `<sup>${n}</sup>`;
    });
    // Symboles entre parenthèses, ex. « NVIDIA (NVDA) » → bouton qui ouvre la fiche.
    h = h.replace(/\(([A-Z0-9]{1,10})\)/g, (m, t) => (byTicker[t] ? `(<button type="button" class="tk-link" data-ticker="${t}">${t}</button>)` : m));
    return h;
  };
  const out = [];
  let list = null;
  for (const raw of md.split('\n')) {
    const ln = raw.trimEnd();
    const ul = ln.match(/^\s*[-•*]\s+(.*)$/);
    const ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        if (list) out.push(`</${list.type}>`);
        list = { type };
        out.push(`<${type}>`);
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { // suite d'un élément de liste
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, `<br>${inline(ln.trim())}</li>`);
      continue;
    }
    if (list) { out.push(`</${list.type}>`); list = null; }
    if (!ln.trim()) continue;
    const head = ln.match(/^#{1,4}\s+(.*)$/);
    out.push(head ? `<p><b>${inline(head[1])}</b></p>` : `<p>${inline(ln)}</p>`);
  }
  if (list) out.push(`</${list.type}>`);
  return out.join('');
}

export function createChat({ fab, el, store, onSelect, getFocus }) {
  const log = el.querySelector('#chat-log');
  const form = el.querySelector('#chat-form');
  const input = el.querySelector('#chat-input');
  const sendBtn = el.querySelector('#chat-send');
  const suggestEl = el.querySelector('#chat-suggest');
  const badge = el.querySelector('#chat-mode');
  const history = []; // { role, content }
  let mode = 'unknown'; // 'perplexity' | 'local'
  let busy = false;
  let lastFocus = null;
  el.inert = true;

  const setMode = (m) => {
    mode = m;
    badge.textContent = m === 'perplexity' ? 'Perplexity' : m === 'local' ? 'Assistant local' : '';
    badge.dataset.mode = m;
  };

  function suggestions() {
    const f = getFocus?.();
    const items = f
      ? [`Pourquoi ${f.name} bouge aujourd’hui ?`, `Que fait ${f.name} dans l’IA ?`, `Compare ${f.name} et NVIDIA`, 'Top hausses du jour']
      : ['Pourquoi NVIDIA bouge aujourd’hui ?', 'Top hausses du jour', 'Compare AMD et NVIDIA', 'Qui alimente les datacenters en énergie ?'];
    suggestEl.innerHTML = items.map((s) => `<button type="button" class="chip-suggest">${esc(s)}</button>`).join('');
    suggestEl.hidden = history.length > 0;
  }

  function bubble(role, html = '') {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="msg-body">${html}</div>`;
    log.appendChild(div);
    if (!reducedMotion) gsap.from(div, { y: 10, opacity: 0, scale: 0.98, duration: 0.45, ease: 'power3.out' });
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // Contexte transmis à Perplexity : entreprises citées, fiche ouverte, plus fortes variations.
  function context(question) {
    const focus = getFocus?.();
    const set = new Map();
    const add = (c) => {
      if (!c || !c.listed || set.has(c.ticker)) return;
      const q = store.get(c.ticker);
      if (!q) return;
      set.set(c.ticker, {
        ticker: c.ticker,
        name: c.name,
        price: fmtPrice(q.price, q.currency),
        change: fmtPct(q.changePct),
        cap: fmtCap(capOf(c, q)),
        market: store.mode === 'live' ? STATUS_LABEL[marketStatus(c, q)] : 'données simulées (démo)',
      });
    };
    findCompanies(question).forEach(add);
    add(focus);
    const listed = COMPANIES.filter((c) => c.listed).map((c) => ({ c, q: store.get(c.ticker) })).filter(({ q }) => q);
    listed.sort((a, b) => b.q.changePct - a.q.changePct);
    listed.slice(0, 5).forEach(({ c }) => add(c));
    listed.slice(-5).forEach(({ c }) => add(c));
    return { quotes: [...set.values()].slice(0, 25), focus: focus ? `${focus.name} (${focus.ticker})` : '' };
  }

  function answerLocally(question, div, noKey) {
    const text = localAnswer(question, store, { focus: getFocus?.(), noKey });
    div.querySelector('.msg-body').innerHTML = renderMarkdown(text);
    history.push({ role: 'assistant', content: text });
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    sendBtn.disabled = true;
    suggestEl.hidden = true;
    bubble('user', `<p>${esc(question)}</p>`);
    history.push({ role: 'user', content: question.slice(0, 600) });
    const div = bubble('bot', '<span class="typing" aria-label="Orbit écrit"><i></i><i></i><i></i></span>');
    const body = div.querySelector('.msg-body');

    if (mode === 'local' || store.mode === 'demo') {
      setMode('local');
      await new Promise((r) => setTimeout(r, reducedMotion ? 0 : 450));
      answerLocally(question, div, true);
      return finish();
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10), context: context(question) }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 503 || res.status === 404 || res.status === 405) {
        setMode('local');
        answerLocally(question, div, true);
        return finish();
      }
      if (res.status === 429) {
        body.innerHTML = '<p>Beaucoup de questions d’un coup — réessayez dans une minute.</p>';
        history.pop();
        return finish();
      }
      if (!res.ok || !res.body) throw new Error(res.status);
      setMode('perplexity');

      // Lecture du flux SSE et affichage au fil de l'eau.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let text = '';
      let sources = [];
      let pending = false;
      const paint = () => {
        pending = false;
        body.innerHTML = renderMarkdown(text, sources) || '<span class="typing"><i></i><i></i><i></i></span>';
        log.scrollTop = log.scrollHeight;
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const evt = buf.slice(0, i).replace(/^data:\s*/, '');
          buf = buf.slice(i + 2);
          let msg;
          try { msg = JSON.parse(evt); } catch { continue; }
          if (msg.type === 'delta') text += msg.text;
          if (msg.type === 'sources') sources = msg.items || [];
          if (!pending) { pending = true; requestAnimationFrame(paint); }
        }
      }
      paint();
      if (!text.trim()) throw new Error('empty');
      if (sources.length) {
        const s = document.createElement('div');
        s.className = 'msg-sources';
        s.innerHTML = `<span>Sources</span>${sources.map((x, k) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${k + 1}. ${esc(hostOf(x.url))}</a>`).join('')}`;
        div.appendChild(s);
      }
      history.push({ role: 'assistant', content: text.slice(0, 2000) });
    } catch {
      // Réseau indisponible ou erreur côté serveur : on répond quand même avec les données du site.
      answerLocally(question, div, mode !== 'perplexity');
      if (mode === 'unknown') setMode('local');
    }
    finish();
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
  }

  function finish() {
    busy = false;
    sendBtn.disabled = false;
    log.scrollTop = log.scrollHeight;
    input.focus({ preventScroll: true });
  }

  function open() {
    if (el.classList.contains('open')) return;
    lastFocus = document.activeElement;
    suggestions();
    el.inert = false;
    el.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    document.getElementById('chat-tab')?.setAttribute('aria-expanded', 'true');
    if (!history.length && !log.children.length) {
      bubble('bot', renderMarkdown(`Bonjour, je suis **Orbit**. Posez-moi vos questions sur les ${COMPANIES.length} entreprises qui construisent l’IA : cours, rôle, comparaisons, actualité.`));
    }
    setTimeout(() => input.focus({ preventScroll: true }), 80);
  }

  function close() {
    if (!el.classList.contains('open')) return;
    el.classList.remove('open');
    el.inert = true;
    fab.setAttribute('aria-expanded', 'false');
    document.getElementById('chat-tab')?.setAttribute('aria-expanded', 'false');
    lastFocus?.focus?.({ preventScroll: true });
  }

  fab.addEventListener('click', () => (el.classList.contains('open') ? close() : open()));
  el.querySelector('#chat-close').addEventListener('click', close);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    input.style.height = '';
    ask(q);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = '';
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
  });
  suggestEl.addEventListener('click', (e) => {
    const b = e.target.closest('.chip-suggest');
    if (b) ask(b.textContent);
  });
  log.addEventListener('click', (e) => {
    const t = e.target.closest('.tk-link');
    if (t && byTicker[t.dataset.ticker]) onSelect?.(byTicker[t.dataset.ticker]);
  });

  return { open, close, ask };
}
