import { describe, expect, it } from 'vitest';
import { colorFor, fmtCap, fmtPct, fmtPrice } from '../src/util.js';

const nb = (s) => s.replace(/[\u202f\u00a0]/g, ' ');

describe('formatage', () => {
  it('prix selon la devise (décimales adaptées)', () => {
    expect(nb(fmtPrice(185.5, 'USD'))).toBe('185,50 $');
    expect(nb(fmtPrice(95000, 'KRW'))).toBe('95 000 ₩');
    expect(nb(fmtPrice(30000, 'JPY'))).toMatch(/^30 000 [¥￥]$/);
    expect(nb(fmtPrice(151.3, 'EUR'))).toBe('151,30 €');
    expect(fmtPrice(0)).toBe('—');
  });
  it('variation signée avec le vrai signe moins', () => {
    expect(fmtPct(1.234)).toBe('+1,23 %');
    expect(fmtPct(-0.5)).toBe('−0,50 %');
    expect(fmtPct(0)).toBe('+0,00 %');
  });
  it('capitalisation en Md$ / T$', () => {
    expect(fmtCap(4500)).toBe('4,50 T$');
    expect(fmtCap(28)).toBe('28 Md$');
    expect(fmtCap(0.5)).toBe('500 M$');
  });
  it('couleur : rouge en baisse, vert en hausse, saturée à ±3 %', () => {
    expect(colorFor(-10)).toBe(colorFor(-3));
    expect(colorFor(5)).toBe(colorFor(3));
    expect(colorFor(-3)).not.toBe(colorFor(3));
  });
});
