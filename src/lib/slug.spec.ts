import { describe, expect, it } from 'vitest';
import { SLUG_MAX, toSlug } from './slug';

/** The server's own pattern, so the property below is checked against the real contract. */
const SERVER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('toSlug (P3.5-T14 AC-7)', () => {
  it.each([
    ['Prudential', 'prudential'],
    ['PT Prudential Life Assurance', 'pt-prudential-life-assurance'],
    ['Chubb Life & General', 'chubb-life-general'],
    ['  AXA  Mandiri  ', 'axa-mandiri'],
    ['21st Century', '21st-century'],
    ['Allianz (Indonesia)', 'allianz-indonesia'],
    ['Café Assurance', 'cafe-assurance'],
  ])('derives %s → %s', (name, expected) => {
    expect(toSlug(name)).toBe(expected);
  });

  it('never emits the shapes the server refuses', () => {
    for (const name of ['---', '&&&', 'a  --  b', '-lead-', 'Prudential']) {
      const slug = toSlug(name);
      if (slug !== '') expect(slug).toMatch(SERVER);
    }
  });

  it('derives nothing rather than inventing a name it cannot read', () => {
    // Non-Latin branding folds away entirely. A blank required field is honest; a
    // fabricated `company-1` is the id-shaped value AC-7 removes.
    expect(toSlug('株式会社')).toBe('');
    expect(toSlug('!!!')).toBe('');
  });

  it('truncates on a hyphen, so a long name never ends mid-word', () => {
    const slug = toSlug('PT Asuransi Jiwa Sinarmas MSIG Life Tbk Cabang Jakarta Selatan Raya');
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(SERVER);
    expect(slug.endsWith('-')).toBe(false);
  });
});
