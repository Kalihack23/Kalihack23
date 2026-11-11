// Fenêtre « Compte » : connexion (lien magique / Google), Ma liste, Alertes, Portefeuilles, Préférences.
import { gsap } from 'gsap';
import { COMPANIES } from '../data/companies.js';
import { ALERT_KINDS, describeAlert } from '../data/alerts.js';
import { PRESETS, buildPortfolio, evaluatePortfolio, newSlug, presetWeights } from '../data/portfolio.js';
import { colorFor, fmtPct, fmtPrice, reducedMotion } from '../util.js';
import { createSegmented } from './glass.js';
import { toast } from './toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const byTicker = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c]));
const listed = COMPANIES.filter((c) => c.listed).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function createAccountUI({ dialog, button, account, store, onSelect, prefs }) {
  const body = dialog.querySelector('#account-body');
  let tab = 'list';
  let shared = null; // portefeuille partagé affiché (lecture seule)

  function initials() {
    const u = account.user;
    if (!u) return '';
    return (u.name || u.email || '?').slice(0, 2).toUpperCase();
  }
  function paintButton() {
    const i = initials();
    button.classList.toggle('signed-in', !!i);
    button.querySelector('.acct-initials').textContent = i;
    button.setAttribute('aria-label', i ? `Mon compte (${account.user.email})` : 'Se connecter / mon compte');
  }

  /* ---------- En-tête : état de connexion ---------- */
  function headerHTML() {
    if (account.signedIn) {
      const u = account.user;
      return `<div class="acct-who"><span class="acct-avatar" aria-hidden="true">${esc(initials())}</span>
        <div><b>${esc(u.name || 'Mon compte')}</b><small>${esc(u.email)} · synchronisé sur tous vos appareils</small></div></div>
        <div class="acct-actions"><button type="button" class="ghost glass" data-act="signout">Se déconnecter</button></div>`;
    }
    if (!account.configured) {
      return `<p class="acct-note">Les comptes en ligne ne sont pas encore activés sur ce site. Votre liste, vos alertes et vos portefeuilles sont enregistrés <b>sur cet appareil</b>.</p>`;
    }
    return `<form class="acct-login" data-form="login">
        <p>Connectez-vous pour retrouver votre liste, vos alertes et vos portefeuilles sur tous vos appareils. Pas de mot de passe : vous recevez un lien par e-mail.</p>
        <div class="acct-row">
          <input type="email" name="email" required autocomplete="email" placeholder="votre@email.fr" aria-label="Adresse e-mail" />
          <button type="submit" class="primary glass tinted">Recevoir le lien</button>
        </div>
        <button type="button" class="ghost glass acct-google" data-act="google">Continuer avec Google</button>
        <small class="acct-hint">Sans compte, tout reste enregistré sur cet appareil.</small>
      </form>`;
  }

  /* ---------- Onglets ---------- */
  function quotePill(t) {
    const q = store.get(t);
    if (!q) return '';
    return `<span class="acct-pill ${q.changePct < 0 ? 'down' : ''}">${fmtPct(q.changePct)}</span>`;
  }

  function listHTML() {
    const w = [...account.watchlist].filter((t) => byTicker[t]);
    if (!w.length) return '<p class="acct-empty">Touchez l’étoile ☆ d’une valeur (dans la liste ou sa fiche) pour la suivre ici.</p>';
    return `<ul class="acct-items">${w.map((t) => {
      const c = byTicker[t];
      const q = store.get(t);
      return `<li><button type="button" class="acct-open" data-open="${t}"><b>${esc(c.ticker)}</b><small>${esc(c.name)}</small></button>
        <span class="acct-price">${c.listed ? fmtPrice(q.price, q.currency) : ''}</span>${c.listed ? quotePill(t) : ''}
        <button type="button" class="acct-star on" data-unwatch="${t}" aria-label="Ne plus suivre ${esc(c.name)}">★</button></li>`;
    }).join('')}</ul>`;
  }

  function alertsHTML() {
    const items = account.alerts;
    const list = items.length
      ? `<ul class="acct-items">${items.map((a) => `<li class="${a.active ? '' : 'off'}">
          <span class="acct-alert">${esc(describeAlert(a, store.get(a.ticker)?.currency))}${a.last_triggered_at ? `<small>Déclenchée le ${new Date(a.last_triggered_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>` : ''}</span>
          <label class="switch" title="Activer / désactiver"><input type="checkbox" data-toggle-alert="${a.id}" ${a.active ? 'checked' : ''} /><i></i><span class="sr">Active</span></label>
          <button type="button" class="acct-del" data-del-alert="${a.id}" aria-label="Supprimer l’alerte">Supprimer</button></li>`).join('')}</ul>`
      : '<p class="acct-empty">Aucune alerte pour l’instant.</p>';
    const options = listed.map((c) => `<option value="${c.ticker}">${esc(c.name)} (${c.ticker})</option>`).join('');
    return `${list}
      <form class="acct-form" data-form="alert">
        <h4>Nouvelle alerte</h4>
        <div class="acct-grid">
          <label>Valeur<select name="ticker">${options}</select></label>
          <label>Condition<select name="kind">${Object.entries(ALERT_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>Seuil<input name="value" type="number" step="any" min="0" required inputmode="decimal" /></label>
        </div>
        <button type="submit" class="primary glass tinted">Créer l’alerte</button>
        <small class="acct-hint">Vous êtes prévenu par une notification tant que le site est ouvert (les alertes ne se déclenchent que sur des cours réels).</small>
      </form>`;
  }

  function portfolioCard(p, readonly = false) {
    const e = evaluatePortfolio(p, store);
    const perf = e.perf == null ? '—' : fmtPct(e.perf);
    const bench = e.benchPerf == null ? '—' : fmtPct(e.benchPerf);
    const beat = e.perf != null && e.benchPerf != null ? e.perf - e.benchPerf : null;
    const bars = e.lines.slice(0, 8).map((l) => `<li><button type="button" class="acct-open" data-open="${l.ticker}"><b>${esc(l.ticker)}</b><small>${String(l.weight.toFixed(1)).replace('.', ',')} %</small></button>
      <span class="bar"><i style="width:${Math.min(100, Math.abs(l.perf) * 4)}%;background:${colorFor(l.perf)}"></i></span><span class="acct-pct" style="color:${colorFor(l.perf)}">${fmtPct(l.perf)}</span></li>`).join('');
    return `<article class="pf-card">
      <header><div><b>${esc(p.name)}</b><small>Créé le ${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p.positions.length} valeurs</small></div>
        <div class="pf-perf" style="color:${e.perf == null ? 'inherit' : colorFor(e.perf)}">${perf}</div></header>
      <p class="pf-vs">Indice AI Orbit sur la même période : <b>${bench}</b>${beat != null ? ` · ${beat >= 0 ? 'vous battez l’indice de' : 'en retard de'} <b>${Math.abs(beat).toFixed(2).replace('.', ',')} pt</b>` : ''}</p>
      <ul class="pf-lines">${bars}</ul>
      ${e.lines.length > 8 ? `<small class="acct-hint">+ ${e.lines.length - 8} autres valeurs</small>` : ''}
      ${readonly ? '' : `<div class="pf-actions">
        <button type="button" class="ghost glass" data-share-pf="${p.id}">${p.is_public ? 'Copier le lien de partage' : 'Partager'}</button>
        ${p.is_public ? `<button type="button" class="ghost glass" data-unshare-pf="${p.id}">Ne plus partager</button>` : ''}
        <button type="button" class="acct-del" data-del-pf="${p.id}">Supprimer</button></div>`}
    </article>`;
  }

  function portfoliosHTML() {
    const cards = account.portfolios.map((p) => portfolioCard(p)).join('') || '<p class="acct-empty">Composez votre « ETF IA » fictif et suivez-le face à l’indice AI Orbit.</p>';
    const presets = PRESETS.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
    return `${cards}
      <form class="acct-form" data-form="portfolio">
        <h4>Nouveau portefeuille</h4>
        <div class="acct-grid two">
          <label>Nom<input name="name" maxlength="60" placeholder="Mon ETF IA" /></label>
          <label>Composition<select name="preset">${presets}<option value="watchlist">Ma liste (poids égaux)</option></select></label>
        </div>
        <button type="submit" class="primary glass tinted">Créer au cours actuel</button>
        <small class="acct-hint">Investissement fictif : les cours de création sont figés, la performance se calcule ensuite en direct.</small>
      </form>`;
  }

  function prefsHTML() {
    return `<div class="acct-prefs">
      <div class="settings-row"><span>Thème</span><div class="glass" id="pref-theme"></div></div>
      <div class="settings-row"><span>Vue au démarrage</span><div class="glass" id="pref-view"></div></div>
      <div class="settings-row"><span>Tri de la liste</span><div class="glass" id="pref-sort"></div></div>
      <p class="acct-hint">${account.signedIn ? 'Vos préférences sont synchronisées avec votre compte.' : 'Préférences enregistrées sur cet appareil.'}</p>
      ${account.signedIn ? '<button type="button" class="acct-del danger" data-act="delete">Supprimer mon compte et mes données</button>' : ''}
    </div>`;
  }

  function sharedHTML() {
    return `<p class="acct-note">Portefeuille partagé (lecture seule).</p>${portfolioCard(shared, true)}
      <button type="button" class="ghost glass" data-act="close-shared">Voir mon compte</button>`;
  }

  /* ---------- Rendu ---------- */
  function render() {
    if (shared) {
      body.innerHTML = sharedHTML();
      return;
    }
    body.innerHTML = `<section class="acct-head">${headerHTML()}</section>
      <div class="acct-tabs glass" id="acct-tabs"></div>
      <section class="acct-panel" id="acct-panel"></section>`;
    createSegmented(body.querySelector('#acct-tabs'), {
      label: 'Sections du compte',
      value: tab,
      items: [{ id: 'list', label: 'Ma liste' }, { id: 'alerts', label: 'Alertes' }, { id: 'portfolios', label: 'Portefeuilles' }, { id: 'prefs', label: 'Préférences' }],
      onChange: (id) => { tab = id; renderPanel(true); },
    });
    renderPanel(false);
  }

  function renderPanel(animate) {
    const panel = body.querySelector('#acct-panel');
    if (!panel) return;
    panel.innerHTML = tab === 'list' ? listHTML() : tab === 'alerts' ? alertsHTML() : tab === 'portfolios' ? portfoliosHTML() : prefsHTML();
    if (tab === 'alerts') prefillAlert();
    if (tab === 'prefs') mountPrefs();
    if (animate && !reducedMotion) gsap.from(panel.children, { opacity: 0, y: 8, duration: 0.35, stagger: 0.03, ease: 'power2.out' });
  }

  function prefillAlert() {
    const form = body.querySelector('[data-form="alert"]');
    if (!form) return;
    const focus = prefs.getFocus?.();
    if (focus?.listed) form.ticker.value = focus.ticker;
    const fill = () => {
      const q = store.get(form.ticker.value);
      form.value.value = form.kind.value === 'move' ? 5 : q ? +(q.price * (form.kind.value === 'above' ? 1.05 : 0.95)).toPrecision(5) : '';
    };
    form.ticker.addEventListener('change', fill);
    form.kind.addEventListener('change', fill);
    fill();
  }

  function mountPrefs() {
    const cur = prefs.current();
    createSegmented(body.querySelector('#pref-theme'), { label: 'Thème', value: cur.theme, items: [{ id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }], onChange: (v) => prefs.set({ theme: v }) });
    createSegmented(body.querySelector('#pref-view'), { label: 'Vue au démarrage', value: cur.view || 'pack', items: [{ id: 'pack', label: 'Galaxie' }, { id: 'bubbles', label: 'Bulles' }, { id: 'orbit', label: 'Orbites' }], onChange: (v) => prefs.set({ view: v }) });
    createSegmented(body.querySelector('#pref-sort'), { label: 'Tri de la liste', value: cur.sort || 'change', items: [{ id: 'change', label: 'Variation' }, { id: 'cap', label: 'Capitalisation' }, { id: 'name', label: 'A–Z' }], onChange: (v) => prefs.set({ sort: v }) });
  }

  /* ---------- Actions ---------- */
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const kind = form.dataset.form;
    try {
      if (kind === 'login') {
        const email = form.email.value.trim();
        await account.signInWithEmail(email);
        toast('Lien envoyé', { body: `Ouvrez l’e-mail envoyé à ${email} pour vous connecter.`, tone: 'up' });
      }
      if (kind === 'alert') {
        const ok = await account.saveAlert({ ticker: form.ticker.value, kind: form.kind.value, value: parseFloat(String(form.value.value).replace(',', '.')) });
        if (ok) {
          toast('Alerte créée', { body: describeAlert({ ticker: form.ticker.value, kind: form.kind.value, value: form.value.value }, store.get(form.ticker.value)?.currency) });
          if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
        }
      }
      if (kind === 'portfolio') {
        const weights = form.preset.value === 'watchlist'
          ? [...account.watchlist].filter((t) => byTicker[t]?.listed).map((t, _i, arr) => ({ ticker: t, weight: 100 / arr.length }))
          : presetWeights(form.preset.value, store);
        if (!weights.length) { toast('Ma liste est vide', { body: 'Ajoutez d’abord des valeurs avec l’étoile ☆.', tone: 'error' }); return; }
        const pf = buildPortfolio(form.name.value.trim() || 'Mon ETF IA', weights, store);
        if (await account.savePortfolio(pf)) toast('Portefeuille créé', { body: `${pf.name} · ${pf.positions.length} valeurs, au cours actuel.`, tone: 'up' });
      }
    } catch (err) {
      toast('Oups', { body: err.message || String(err), tone: 'error' });
    }
  });

  body.addEventListener('click', async (e) => {
    const t = e.target.closest('button, input');
    if (!t) return;
    const d = t.dataset;
    try {
      if (d.act === 'google') await account.signInWithGoogle();
      if (d.act === 'signout') { await account.signOut(); toast('Déconnecté'); }
      if (d.act === 'delete') {
        if (!window.confirm('Supprimer définitivement votre compte, votre liste, vos alertes et vos portefeuilles ?')) return;
        await account.deleteAccount();
        toast('Compte supprimé', { body: 'Toutes vos données en ligne ont été effacées.' });
      }
      if (d.act === 'close-shared') { shared = null; history.replaceState(null, '', location.pathname); render(); }
      if (d.open) { close(); onSelect?.(byTicker[d.open]); }
      if (d.unwatch) await account.toggleWatch(d.unwatch);
      if (d.toggleAlert) {
        const a = account.alerts.find((x) => x.id === d.toggleAlert);
        if (a) await account.saveAlert({ ...a, active: t.checked });
      }
      if (d.delAlert) await account.deleteAlert(d.delAlert);
      if (d.delPf && window.confirm('Supprimer ce portefeuille ?')) await account.deletePortfolio(d.delPf);
      if (d.unsharePf) {
        const p = account.portfolios.find((x) => x.id === d.unsharePf);
        if (p) await account.savePortfolio({ ...p, is_public: false });
      }
      if (d.sharePf) {
        if (!account.signedIn) { toast('Connexion nécessaire', { body: 'Connectez-vous pour partager un portefeuille par lien.' }); return; }
        let p = account.portfolios.find((x) => x.id === d.sharePf);
        if (!p.is_public || !p.share_slug) p = await account.savePortfolio({ ...p, is_public: true, share_slug: p.share_slug || newSlug() });
        if (!p) return;
        const link = `${location.origin}/?portfolio=${p.share_slug}`;
        if (navigator.share) await navigator.share({ title: p.name, text: `Mon ETF IA « ${p.name} » sur AI Orbit`, url: link }).catch(() => {});
        else { await navigator.clipboard?.writeText(link); toast('Lien copié', { body: link }); }
      }
    } catch (err) {
      toast('Oups', { body: err.message || String(err), tone: 'error' });
    }
  });

  /* ---------- Ouverture ---------- */
  function open(section) {
    if (section) tab = section;
    render();
    if (!dialog.open) dialog.showModal();
  }
  function close() { if (dialog.open) dialog.close(); }

  async function openShared(slug) {
    const p = await account.getSharedPortfolio(slug);
    if (!p) { toast('Portefeuille introuvable', { body: 'Le lien a peut-être été désactivé.', tone: 'error' }); return; }
    shared = p;
    render();
    if (!dialog.open) dialog.showModal();
  }

  button.addEventListener('click', () => open());
  account.onChange((ev) => {
    paintButton();
    if (ev.type === 'signin' && ev.added) {
      const n = ev.added.watchlist + ev.added.alerts + ev.added.portfolios;
      toast(`Bonjour ${account.user?.name || ''} 👋`, { body: n ? 'Les données de cet appareil ont été ajoutées à votre compte.' : 'Votre compte est synchronisé.', tone: 'up' });
    }
    if (ev.type === 'error') toast('Synchronisation impossible', { body: ev.message, tone: 'error' });
    if (dialog.open && !shared && ev.type !== 'error') {
      if (ev.type === 'change') renderPanel(false);
      else render();
    }
  });
  // Les cours bougent : on rafraîchit les chiffres si la fenêtre est ouverte (au plus toutes les 3 s).
  setInterval(() => { if (dialog.open && !shared && tab === 'list') renderPanel(false); }, 3000);
  paintButton();

  return { open, close, openShared };
}
