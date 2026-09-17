import { describe, expect, it } from 'vitest';
import { suggestCode } from './config-code';

describe('a code suggested from a label (P5-T1)', () => {
  it('writes the label as upper snake', () => {
    expect(suggestCode('Referral Generation Techniques')).toBe('REFERRAL_GENERATION_TECHNIQUES');
    expect(suggestCode('  Cross-sell & retention ')).toBe('CROSS_SELL_RETENTION');
  });

  it('drops accents rather than characters', () => {
    expect(suggestCode('Présentation produit')).toBe('PRESENTATION_PRODUIT');
  });

  it('starts with a letter, and stays within forty characters without a trailing underscore', () => {
    expect(suggestCode('10 tips for closing')).toBe('TIPS_FOR_CLOSING');
    const long = suggestCode('Conducting a financial needs analysis for young families');
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('_')).toBe(false);
  });

  it('suggests nothing from a label with no letters or digits', () => {
    expect(suggestCode('—')).toBe('');
  });
});
