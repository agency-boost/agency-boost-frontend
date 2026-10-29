import { describe, expect, it } from 'vitest';
import { balanceAdvice, balanceSideNames } from '@/lib/ratio-balance';
import {
  DISPLAY_UNIT_LABEL, DISPLAY_UNIT_SUFFIX, displayUnitLabels, formatBenchmark, formatRatioForStatus, formatRatioValue,
} from '@/lib/ratio-format';

const SEED = { numerator: 'Selling', denominator: 'Recruitment' };

/**
 * **P18.98-T4: the words beside a ratio's figure are the catalogue's** (`i18n/messages/ratio-words.ts`). Each function
 * takes the words' language after the figures' — English when none is passed, so every screen not moved yet reads as
 * it did (`ratio-format.spec.ts` and `ratio-balance.spec.ts`, untouched) — and the two are independent: a reader with
 * no choice while the switch is not live reads English words and Indonesian figures (P18.98-T3).
 */
describe('P18.98-T4 a ratio’s words in each language', () => {
  it('names each unit with an example figure, in the words’ and the figures’ languages apart', () => {
    expect(displayUnitLabels('en', 'en')).toEqual({ percent: 'A percentage — 15%', decimal: 'A number — 0.30' });
    expect(displayUnitLabels('id', 'id')).toEqual({ percent: 'Persentase — 15%', decimal: 'Angka — 0,30' });
    expect(displayUnitLabels('en', 'id')).toEqual({ percent: 'A percentage — 15%', decimal: 'A number — 0,30' });
  });

  it('keeps the constants every screen not moved yet reads: English words, Indonesian figures', () => {
    expect(DISPLAY_UNIT_LABEL).toEqual({ percent: 'A percentage — 15%', decimal: 'A number — 0,30' });
    expect(DISPLAY_UNIT_SUFFIX.points).toBe('points either side');
  });

  it('writes a band’s benchmark with *poin* in Indonesian, *points* in English', () => {
    expect(formatBenchmark(30, 'points', 'id', 'id')).toBe('±30 poin');
    expect(formatBenchmark(25.5, 'points', 'id', 'id')).toBe('±25,5 poin');
    expect(formatBenchmark(25.5, 'points', 'en', 'en')).toBe('±25.5 points');
    // Indonesian figures, English words: a reader with no choice before the switch is live.
    expect(formatBenchmark(25.5, 'points', 'id')).toBe('±25,5 points');
    // A percentage and a number carry no word.
    expect(formatBenchmark(0.155, 'percent', 'id', 'id')).toBe('15,5%');
    expect(formatBenchmark(0.3, 'decimal', 'en', 'id')).toBe('0.30');
  });

  it('writes a lean in whole points — one form in Indonesian, a plural in English', () => {
    expect(formatRatioValue(1, 'points', 'id', 'id')).toBe('1 poin');
    expect(formatRatioValue(-24.4, 'points', 'id', 'id')).toBe('24 poin');
    expect(formatRatioValue(1, 'points', 'en', 'en')).toBe('1 point');
    expect(formatRatioValue(null, 'points', 'id', 'id')).toBe('–');
  });

  it('writes a lean just outside the band with its tenth, in each language', () => {
    expect(formatRatioForStatus(30.43, 'points', 30, 'alert', 'id', 'id')).toBe('30,4 poin');
    expect(formatRatioForStatus(30.43, 'points', 30, 'alert', 'en', 'en')).toBe('30.4 points');
    expect(formatRatioForStatus(-48, 'points', 30, 'alert', 'id', 'id')).toBe('48 poin');
  });

  it('names a side with no one section Sisi A or Sisi B in Indonesian, and a section as the office typed it', () => {
    expect(balanceSideNames(null, 'id')).toEqual({ first: 'Sisi A', second: 'Sisi B' });
    expect(balanceSideNames({ numerator: 'Penjualan', denominator: 'penjualan' }, 'id')).toEqual({ first: 'Sisi A', second: 'Sisi B' });
    expect(balanceSideNames(SEED, 'id')).toEqual({ first: 'Selling', second: 'Recruitment' });
    expect(balanceSideNames(null)).toEqual({ first: 'Side A', second: 'Side B' });
  });

  it('advises in Indonesian, the section as typed and the band in Indonesian figures', () => {
    expect(balanceAdvice(67, 30, 'alert', SEED, 'id', 'id')).toBe('Terlalu banyak Selling — jaga di 35%–65%');
    expect(balanceAdvice(70, 25, 'alert', SEED, 'id', 'id')).toBe('Terlalu banyak Selling — jaga di 37,5%–62,5%');
    expect(balanceAdvice(80, 30, 'alert', { numerator: null, denominator: 'Penjualan' }, 'id', 'id'))
      .toBe('Terlalu banyak Sisi A — jaga di 35%–65%');
    expect(balanceAdvice(80, 30, 'alert', { numerator: 'Penjualan', denominator: 'Penjualan' }, 'id', 'id'))
      .toBe('Terlalu banyak Sisi A — jaga di 35%–65%');
    // English as before: the section lower-cased, Side A as the track writes it.
    expect(balanceAdvice(67, 30, 'alert', SEED, 'en', 'en')).toBe('Too much selling — aim for 35%–65%');
    expect(balanceAdvice(62.2, 30, 'success', SEED, 'id', 'id')).toBeNull();
  });
});
