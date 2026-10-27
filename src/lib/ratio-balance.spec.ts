import { describe, expect, it } from 'vitest';
import {
  balanceAdvice, balanceBand, balanceSideNames, formatBalanceBand, formatBalanceSplit,
} from '@/lib/ratio-balance';

/** A balance read as each side's share of the two (P13.1-T6). */
describe('the balance as two shares (P13.1-T6)', () => {
  describe('AC-1: the split sums to 100', () => {
    it('writes two selling and three recruiting as 40,0% and 60,0% (ADR-0167 §1: one decimal)', () => {
      expect(formatBalanceSplit(40, 30, 'success')).toEqual({ first: '40,0%', second: '60,0%' });
    });

    it('writes an even split as 50,0% and 50,0%, and a tipped one to its tenth', () => {
      expect(formatBalanceSplit(50, 30, 'success')).toEqual({ first: '50,0%', second: '50,0%' });
      expect(formatBalanceSplit(50.04, 30, 'success')).toEqual({ first: '50,0%', second: '50,0%' });
      expect(formatBalanceSplit(50.25, 30, 'success')).toEqual({ first: '50,3%', second: '49,7%' });
    });

    it('rounds the first side and writes the second as what is left, never 99,9 or 100,1 between them', () => {
      // 33.35 and 66.65 would each round up, and read 33,4% · 66,7%.
      expect(formatBalanceSplit(33.35, 40, 'success')).toEqual({ first: '33,4%', second: '66,6%' });
      expect(formatBalanceSplit(100 / 3, 40, 'success')).toEqual({ first: '33,3%', second: '66,7%' });
    });
  });

  describe('AC-5: a split never reads as the other side of its status', () => {
    it('writes a miss just past the band’s edge with the decimal that shows it is past', () => {
      // 65.04% is outside 35–65%; `65,0% · 35,0%` would read as inside it.
      expect(formatBalanceSplit(65.2, 30, 'alert')).toEqual({ first: '65,2%', second: '34,8%' });
      expect(formatBalanceSplit(65.04, 30, 'alert')).toEqual({ first: '65,04%', second: '34,96%' });
      expect(formatBalanceSplit(34.96, 30, 'alert')).toEqual({ first: '34,96%', second: '65,04%' });
    });

    it('keeps an on-track split inside an odd band’s half-percent edges', () => {
      // ±25 points is 37.5%–62.5%; a 62.5% share is on track.
      expect(formatBalanceSplit(62.5, 25, 'success')).toEqual({ first: '62,5%', second: '37,5%' });
    });

    it('never writes a side with activity on it as 0,0%, and keeps a real zero', () => {
      expect(formatBalanceSplit(99.6, 30, 'alert')).toEqual({ first: '99,6%', second: '0,4%' });
      expect(formatBalanceSplit(99.96, 30, 'alert')).toEqual({ first: '99,96%', second: '0,04%' });
      expect(formatBalanceSplit(100, 30, 'alert')).toEqual({ first: '100,0%', second: '0,0%' });
      expect(formatBalanceSplit(0, 30, 'alert')).toEqual({ first: '0,0%', second: '100,0%' });
    });
  });

  describe('AC-2: the band, as the shares it allows', () => {
    it('reads ±30 points as each side between 35% and 65%', () => {
      expect(balanceBand(30)).toEqual({ low: 35, high: 65 });
      expect(formatBalanceBand(30)).toEqual({ low: '35,0%', high: '65,0%' });
    });

    it('keeps a half percent where the band has one, and stays within 0–100%', () => {
      expect(formatBalanceBand(25)).toEqual({ low: '37,5%', high: '62,5%' });
      expect(formatBalanceBand(25.5)).toEqual({ low: '37,25%', high: '62,75%' });
      expect(formatBalanceBand(0)).toEqual({ low: '50,0%', high: '50,0%' });
      expect(formatBalanceBand(250)).toEqual({ low: '0,0%', high: '100,0%' });
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
    expect(balanceAdvice(67, 30, 'alert', SEED)).toBe('Too much selling — aim for 35,0%–65,0%');
    expect(balanceAdvice(30, 30, 'alert', SEED)).toBe('Too much recruitment — aim for 35,0%–65,0%');
  });

  it('P18.95-T5 AC-6: reads the band from the ratio’s own benchmark — never a literal 35–65', () => {
    expect(balanceAdvice(70, 20, 'alert', SEED)).toBe('Too much selling — aim for 40,0%–60,0%');
    expect(balanceAdvice(90, 50, 'alert', SEED)).toBe('Too much selling — aim for 25,0%–75,0%');
  });

  it('P18.95-T5 AC-6: says nothing in the band, nor with nothing to read, so the screen keeps its own words', () => {
    expect(balanceAdvice(62.2, 30, 'success', SEED)).toBeNull();
    expect(balanceAdvice(null, 30, 'neutral', SEED)).toBeNull();
    expect(balanceAdvice(null, 30, 'alert', SEED)).toBeNull();
  });

  it('P18.95-T5 AC-6: an office’s own sections are lower-cased too, and Side A or B is written as the track writes it', () => {
    expect(balanceAdvice(75, 30, 'alert', { numerator: 'Leads Generation', denominator: 'Selling' }))
      .toBe('Too much leads generation — aim for 35,0%–65,0%');
    expect(balanceAdvice(80, 30, 'alert', { numerator: null, denominator: 'Selling' }))
      .toBe('Too much Side A — aim for 35,0%–65,0%');
    expect(balanceAdvice(20, 30, 'alert', { numerator: null, denominator: 'Selling' }))
      .toBe('Too much selling — aim for 35,0%–65,0%');
    // Both ends one section: the track says Side A and Side B, and so does the sentence.
    expect(balanceAdvice(80, 30, 'alert', { numerator: 'Selling', denominator: 'Selling' }))
      .toBe('Too much Side A — aim for 35,0%–65,0%');
  });
});
