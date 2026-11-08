import { describe, expect, it } from 'vitest';
import { COMPANIES, DOMAINS } from '../src/data/companies.js';
import { exchangeOf } from '../src/data/markets.js';
import { FX_SYMBOLS } from '../api/_lib/yahoo.js';

const KNOWN_CURRENCIES = ['USD', 'EUR', 'JPY', 'KRW', 'TWD', 'HKD', 'CHF', 'CNY'];

describe('intégrité des données', () => {
  it('9 domaines, chacun utilisé', () => {
    expect(DOMAINS).toHaveLength(9);
    for (const d of DOMAINS) expect(COMPANIES.some((c) => c.domain === d.id)).toBe(true);
  });
  it('symboles et identifiants uniques', () => {
    const tickers = COMPANIES.map((c) => c.ticker);
    const symbols = COMPANIES.filter((c) => c.listed).map((c) => c.symbol);
    expect(new Set(tickers).size).toBe(tickers.length);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
  it('chaque entreprise a un domaine valide et un rôle décrit', () => {
    const ids = new Set(DOMAINS.map((d) => d.id));
    for (const c of COMPANIES) {
      expect(ids.has(c.domain), c.ticker).toBe(true);
      expect(c.role.length, c.ticker).toBeGreaterThan(10);
      expect(c.cap, c.ticker).toBeGreaterThan(0);
    }
  });
  it('privées ⇔ pas de cours ; cotées ⇔ prix, devise connue et taux de change', () => {
    for (const c of COMPANIES) {
      if (!c.listed) { expect(c.price, c.ticker).toBe(0); continue; }
      expect(c.price, c.ticker).toBeGreaterThan(0);
      expect(KNOWN_CURRENCIES, c.ticker).toContain(c.currency);
      if (c.currency !== 'USD') expect(FX_SYMBOLS, c.ticker).toContain(`${c.currency}USD=X`);
    }
  });
  it('pas de valeur de Londres (cotée en pence) et chaque place est connue', () => {
    for (const c of COMPANIES.filter((x) => x.listed)) {
      expect(c.symbol.endsWith('.L'), c.ticker).toBe(false);
      if (c.symbol.includes('.')) expect(exchangeOf(c).name, c.ticker).not.toBe('NYSE / Nasdaq');
    }
  });
  it('Caterpillar fait bien partie de la liste (énergie des datacenters)', () => {
    expect(COMPANIES.find((c) => c.ticker === 'CAT')?.domain).toBe('energy');
  });
});
