import { describe, expect, it } from 'vitest';
import { exchangeOf, isOpenLocal, marketStatus } from '../src/data/markets.js';
import { COMPANIES } from '../src/data/companies.js';

const co = (t) => COMPANIES.find((c) => c.ticker === t);

describe('horaires des bourses', () => {
  it('identifie la place de cotation', () => {
    expect(exchangeOf(co('NVDA')).name).toBe('NYSE / Nasdaq');
    expect(exchangeOf(co('SU')).name).toBe('Euronext Paris');
    expect(exchangeOf(co('TEL')).name).toBe('Bourse de Tokyo');
    expect(exchangeOf(co('OPENAI'))).toBeNull();
  });
  it('New York : ouvert un mardi à 15 h UTC, fermé le samedi', () => {
    expect(isOpenLocal(co('NVDA'), new Date('2026-11-10T15:00:00Z'))).toBe(true);
    expect(isOpenLocal(co('NVDA'), new Date('2026-11-10T22:00:00Z'))).toBe(false);
    expect(isOpenLocal(co('NVDA'), new Date('2026-11-14T15:00:00Z'))).toBe(false);
  });
  it('Tokyo : pause déjeuner', () => {
    expect(isOpenLocal(co('TEL'), new Date('2026-11-10T01:00:00Z'))).toBe(true); // 10:00 JST
    expect(isOpenLocal(co('TEL'), new Date('2026-11-10T03:00:00Z'))).toBe(false); // 12:00 JST
  });
  it('Shanghai (pause méridienne) et Milan', () => {
    expect(exchangeOf(co('CAMBR')).name).toBe('Bourse de Shanghai');
    expect(isOpenLocal(co('CAMBR'), new Date('2026-11-10T02:00:00Z'))).toBe(true); // 10:00 Shanghai
    expect(isOpenLocal(co('CAMBR'), new Date('2026-11-10T04:00:00Z'))).toBe(false); // 12:00 Shanghai
    expect(exchangeOf(co('PRYSM')).name).toBe('Euronext Milan');
    expect(isOpenLocal(co('PRYSM'), new Date('2026-11-10T10:00:00Z'))).toBe(true); // 11:00 Rome
  });
  it("l'état fourni par Yahoo est prioritaire", () => {
    expect(marketStatus(co('NVDA'), { marketState: 'REGULAR' }, new Date('2026-11-14T15:00:00Z'))).toBe('open');
    expect(marketStatus(co('NVDA'), { marketState: 'POST' })).toBe('post');
    expect(marketStatus(co('NVDA'), { marketState: 'CLOSED' })).toBe('closed');
  });
});
