import { describe, expect, it, vi } from 'vitest';
import { createSimProvider, createStore } from '../src/data/feed.js';
import { capIsEstimate, capOf, isStale } from '../src/data/derived.js';
import { COMPANIES } from '../src/data/companies.js';

describe('store de cotations', () => {
  it('calcule la variation par rapport à la clôture de la veille', () => {
    const store = createStore();
    store.set('NVDA', 110, 100);
    expect(store.get('NVDA').changePct).toBeCloseTo(10);
    expect(store.get('NVDA').dir).toBe(-1); // le prix de référence (185) était plus haut
  });
  it('ignore les prix invalides', () => {
    const store = createStore();
    const before = store.get('NVDA').price;
    store.set('NVDA', NaN);
    store.set('NVDA', -1);
    expect(store.get('NVDA').price).toBe(before);
  });
  it("un abonné qui plante n'empêche pas les autres d'être prévenus", () => {
    const store = createStore();
    const ok = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.subscribe(() => { throw new Error('boom'); });
    store.subscribe(ok);
    store.set('NVDA', 120, 100);
    expect(ok).toHaveBeenCalledTimes(1);
  });
  it('changer de mode prévient toutes les vues (pour griser les valeurs non actualisées)', () => {
    const store = createStore();
    const seen = new Set();
    store.subscribe((q) => seen.add(q.ticker));
    store.setMode('live');
    expect(store.mode).toBe('live');
    expect(seen.size).toBe(COMPANIES.length);
  });
  it('le mode démo fournit un prix simulé pour chaque valeur cotée', () => {
    const store = createStore();
    createSimProvider(store);
    for (const co of COMPANIES.filter((c) => c.listed)) {
      const q = store.get(co.ticker);
      expect(q.src).toBe('sim');
      expect(q.price).toBeGreaterThan(0);
      expect(q.history.length).toBeGreaterThan(10);
    }
  });
});

describe('calculs dérivés', () => {
  const nvda = COMPANIES.find((c) => c.ticker === 'NVDA');
  it('capitalisation réelle si connue, sinon estimation', () => {
    expect(capOf(nvda, { price: 110, prevClose: 100, capUSD: 4321 })).toBe(4321);
    expect(capOf(nvda, { price: 110, prevClose: 100 })).toBeCloseTo(nvda.cap * 1.1);
    expect(capIsEstimate(nvda, { capUSD: 4321 })).toBe(false);
    expect(capIsEstimate(nvda, {})).toBe(true);
  });
  it('valeur non actualisée seulement en mode réel sans source', () => {
    expect(isStale({ mode: 'live' }, { src: null })).toBe(true);
    expect(isStale({ mode: 'live' }, { src: 'api' })).toBe(false);
    expect(isStale({ mode: 'demo' }, { src: null })).toBe(false);
  });
});
