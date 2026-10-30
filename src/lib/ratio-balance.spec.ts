import { describe, expect, it } from 'vitest';
import {
  balanceAdvice, balanceBand, balanceSideNames, formatBalanceBand, formatBalanceSplit,
} from '@/lib/ratio-balance';

/** A balance read as each side's share of the two (P13.1-T6). */
describe('the balance as two shares (P13.1-T6)', () => {
  describe('AC-1: the split sums to 100', () => {
    it('UI-080 writes two selling and three recruiting as 40% and 60% — whole, as every percentage is', () => {
      expect(formatBalanceSplit(40, 30, 'success')).toEqual({ first: '40%', second: '60%' });
    });

    it('UI-080 writes an even split as 50% and 50%, and a tipped one whole, half up', () => {
      expect(formatBalanceSplit(50, 30, 'success')).toEqual({ first: '50%', second: '50%' });
      expect(formatBalanceSplit(50.04, 30, 'success')).toEqual({ first: '50%', second: '50%' });
      expect(formatBalanceSplit(50.5, 30, 'success')).toEqual({ first: '51%', second: '49%' });
    });

    it('rounds the first side and writes the second as what is left, never 99 or 101 between them', () => {
      expect(formatBalanceSplit(100 / 3, 40, 'success')).toEqual({ first: '33%', second: '67%' });
      expect(formatBalanceSplit(66.7, 40, 'success')).toEqual({ first: '67%', second: '33%' });
      expect(formatBalanceSplit(12.5, 40, 'alert')).toEqual({ first: '13%', second: '87%' });
    });
  });

  describe('UI-080: the status is judged on the unrounded share, never on the figure written', () => {
    it('writes a miss just past the band’s edge whole: 65,04% reads 65% beside the status the server judged', () => {
      expect(formatBalanceSplit(65.2, 30, 'alert')).toEqual({ first: '65%', second: '35%' });
      expect(formatBalanceSplit(65.04, 30, 'alert')).toEqual({ first: '65%', second: '35%' });
      expect(formatBalanceSplit(34.96, 30, 'alert')).toEqual({ first: '35%', second: '65%' });
    });

    it('writes 0,4% as 0%, as the owner asked, and keeps a real zero', () => {
      expect(formatBalanceSplit(99.6, 30, 'alert')).toEqual({ first: '100%', second: '0%' });
      expect(formatBalanceSplit(100, 30, 'alert')).toEqual({ first: '100%', second: '0%' });
      expect(formatBalanceSplit(0, 30, 'alert')).toEqual({ first: '0%', second: '100%' });
    });
  });

  describe('AC-2: the band, as the shares it allows', () => {
    it('P18.97-T3 AC-2 reads ±30 points as each side between 35% and 65%, the benchmark as typed', () => {
      expect(balanceBand(30)).toEqual({ low: 35, high: 65 });
      expect(formatBalanceBand(30)).toEqual({ low: '35%', high: '65%' });
    });

    it('P18.97-T3 AC-2 keeps a half percent where the band has one, and no ,0, within 0–100%', () => {
      expect(formatBalanceBand(25)).toEqual({ low: '37,5%', high: '62,5%' });
      expect(formatBalanceBand(25.5)).toEqual({ low: '37,25%', high: '62,75%' });
      expect(formatBalanceBand(0)).toEqual({ low: '50%', high: '50%' });
      expect(formatBalanceBand(250)).toEqual({ low: '0%', high: '100%' });
    });
  });

  describe('AC-6: what the ends are called', () => {
    it('takes the section each side counts, as the API names it', () => {
      expect(balanceSideNames({ numerator: 'Selling', denominator: 'Recruitment' }))
        .toEqual({ first: 'Selling', second: 'Recruitment' });
      expect(balanceSideNames({ numerator: 'Leads Generation', denominator: 'Selling' }))
        .toEqual({ first: 'Leads Generation', second: 'Selling' });
    });

    it('calls a side with no one section Side A or Side B, as the form does', () => {
      expect(balanceSideNames({ numerator: 'Selling', denominator: null }))
        .toEqual({ first: 'Selling', second: 'Side B' });
      expect(balanceSideNames(null)).toEqual({ first: 'Side A', second: 'Side B' });
    });

    it('calls both Side A and Side B when both count the same section', () => {
      expect(balanceSideNames({ numerator: 'Selling', denominator: 'selling' }))
        .toEqual({ first: 'Side A', second: 'Side B' });
    });
  });
});

/** What an off-balance reading says to do (P18.95-T5 AC-6; the client's UI review, UI-030). */
describe('P18.95-T5 AC-6: the balance says what to do', () => {
  const SEED = { numerator: 'Selling', denominator: 'Recruitment' };

  it('P18.95-T5 AC-6: names the side there is too much of, lower-cased, and the band to aim for', () => {
    expect(balanceAdvice(67, 30, 'alert', SEED)).toBe('Too much selling — aim for 35%–65%');
    expect(balanceAdvice(30, 30, 'alert', SEED)).toBe('Too much recruitment — aim for 35%–65%');
  });

  it('P18.95-T5 AC-6: reads the band from the ratio’s own benchmark — never a literal 35–65', () => {
    expect(balanceAdvice(70, 20, 'alert', SEED)).toBe('Too much selling — aim for 40%–60%');
    expect(balanceAdvice(90, 50, 'alert', SEED)).toBe('Too much selling — aim for 25%–75%');
  });

  it('P18.95-T5 AC-6: says nothing in the band, nor with nothing to read, so the screen keeps its own words', () => {
    expect(balanceAdvice(62.2, 30, 'success', SEED)).toBeNull();
    expect(balanceAdvice(null, 30, 'neutral', SEED)).toBeNull();
    expect(balanceAdvice(null, 30, 'alert', SEED)).toBeNull();
  });

  it('P18.95-T5 AC-6: an office’s own sections are lower-cased too, and Side A or B is written as the track writes it', () => {
    expect(balanceAdvice(75, 30, 'alert', { numerator: 'Leads Generation', denominator: 'Selling' }))
      .toBe('Too much leads generation — aim for 35%–65%');
    expect(balanceAdvice(80, 30, 'alert', { numerator: null, denominator: 'Selling' }))
      .toBe('Too much Side A — aim for 35%–65%');
    expect(balanceAdvice(20, 30, 'alert', { numerator: null, denominator: 'Selling' }))
      .toBe('Too much selling — aim for 35%–65%');
    // Both ends one section: the track says Side A and Side B, and so does the sentence.
    expect(balanceAdvice(80, 30, 'alert', { numerator: 'Selling', denominator: 'Selling' }))
      .toBe('Too much Side A — aim for 35%–65%');
  });
});

/**
 * **P18.98-T3: a balance in each language** (ADR-0174 §6; the glossary's §E): the same split and band, with a point in
 * English. Every Indonesian case above is unchanged. The places are chosen on the figures, so both languages carry the
 * same ones (AC-2); the sentence's words are the catalogue's, and move with the screen (P18.98-T4).
 */
describe('P18.98-T3 a balance in each language', () => {
  it('P18.98-T3 AC-1 writes the split 40% · 60% (UI-080) and the band 37.5%–62.5% in English', () => {
    expect(formatBalanceSplit(40, 30, 'success', 'en')).toEqual({ first: '40%', second: '60%' });
    expect(formatBalanceBand(25, 'en')).toEqual({ low: '37.5%', high: '62.5%' });
    expect(formatBalanceBand(30, 'en')).toEqual({ low: '35%', high: '65%' });
  });

  it('UI-080 writes the same whole split in both languages, whatever the status', () => {
    expect(formatBalanceSplit(65.04, 30, 'alert', 'id')).toEqual({ first: '65%', second: '35%' });
    expect(formatBalanceSplit(65.04, 30, 'alert', 'en')).toEqual({ first: '65%', second: '35%' });
    expect(formatBalanceSplit(99.96, 30, 'alert', 'en')).toEqual({ first: '100%', second: '0%' });
  });

  it('P18.98-T3 AC-1 writes the advice’s band in the reader’s marks', () => {
    expect(balanceAdvice(70, 25, 'alert', { numerator: 'Selling', denominator: 'Recruitment' }, 'en'))
      .toBe('Too much selling — aim for 37.5%–62.5%');
    expect(balanceAdvice(70, 25, 'alert', { numerator: 'Selling', denominator: 'Recruitment' }))
      .toBe('Too much selling — aim for 37,5%–62,5%');
  });
});
