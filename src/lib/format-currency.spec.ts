import { describe, expect, it } from 'vitest';
import { formatCurrencies, formatMoneyInFull, formatRupiah } from './format';

/**
 * **A product's currencies, and a sum in full in its own currency** (P19.4-T4 AC-12; ADR-0209 §8; §B.25).
 */
describe('P19.4-T4 AC-12 currencies', () => {
  it('P19.4-T4 AC-12 writes a product’s currencies as codes: IDR, USD, IDR + USD', () => {
    expect(formatCurrencies(['IDR'])).toBe('IDR');
    expect(formatCurrencies(['USD'])).toBe('USD');
    expect(formatCurrencies(['IDR', 'USD'])).toBe('IDR + USD');
  });

  it('P19.4-T4 AC-12 writes a USD amount in full with its code, never compact, in each language’s marks', () => {
    expect(formatMoneyInFull(125_000, 'USD', 'id')).toBe('USD 1.250,00');
    expect(formatMoneyInFull(125_000, 'USD', 'en')).toBe('USD 1,250.00');
    expect(formatMoneyInFull(123_456_789, 'USD', 'id')).toBe('USD 1.234.567,89');
    expect(formatMoneyInFull(-5, 'USD', 'en')).toBe('-USD 0.05');
  });

  it('P19.4-T4 AC-12 leaves IDR to the rupiah formatter, unchanged', () => {
    expect(formatMoneyInFull(50_000_000, 'IDR', 'id')).toBe(formatRupiah(50_000_000, 'id'));
    expect(formatMoneyInFull(50_000_000, 'IDR', 'en')).toBe(formatRupiah(50_000_000, 'en'));
  });
});
