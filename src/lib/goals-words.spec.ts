import { describe, expect, it } from 'vitest';
import { monthsLeftInWords, producedFrom } from './goals';

/**
 * **P18.98-T4: `lib/goals.ts`' words in each language** (field selling; `i18n/messages/goal-words.ts`). The marker
 * beside the APE produced and the months left in words take the figures' language and then the words' — English words
 * and Indonesian figures when neither is passed, as `goals.spec.ts` reads them, unchanged. In Indonesian a coachee is
 * *-nya* whatever their pronoun, and no word names the office about them (ADR-0084).
 */
describe('P18.98-T4 producedFrom in Indonesian', () => {
  it('AC-1 names the office’s upload, a correction and who made it, the month written Indonesian', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'month', undefined, 'id', 'id'))
      .toBe('Dari unggahan KPM Anda, Agu 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'id', 'id')).toBe('Per Okt 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-09' }, 'month', undefined, 'id', 'id'))
      .toBe('Dikoreksi manual, Sep 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-08', correctedBy: { name: 'Sari Puspita' } }, 'year', undefined, 'id', 'id'))
      .toBe('Dikoreksi oleh Sari Puspita, sejak awal tahun per Agu 2026');
    expect(producedFrom({ provenance: 'imported', month: null }, 'month', undefined, 'id', 'id')).toBe('Dari unggahan KPM Anda');
  });

  it('AC-3 names the reader’s own figure, and a coachee’s as theirs whatever their pronoun', () => {
    const own = { provenance: 'self_reported', month: null } as const;
    expect(producedFrom(own, 'year', undefined, 'id', 'id')).toBe('Angka Anda sendiri, diisi di Goal Settings');
    for (const pronoun of ['she', 'he', 'they'] as const) {
      expect(producedFrom(own, 'year', pronoun, 'id', 'id')).toBe('Angkanya sendiri, diisi di Goal Settings');
    }
  });

  it('AC-3 names a coachee’s upload and its correction without the office, the corrector last', () => {
    const words = [
      producedFrom({ provenance: 'imported', month: '2026-09' }, 'month', 'she', 'id', 'id'),
      producedFrom({ provenance: 'corrected', month: '2026-08' }, 'year', 'he', 'id', 'id'),
      producedFrom({ provenance: 'imported', month: null }, 'year', 'they', 'id', 'id'),
      producedFrom({ provenance: 'corrected', month: '2026-08', correctedBy: { name: 'Sari Puspita' } }, 'year', 'they', 'id', 'id'),
    ];
    expect(words).toEqual([
      'Dari unggahan produksi, Sep 2026',
      'Dikoreksi setelah unggahan produksi, sejak awal tahun per Agu 2026',
      'Dari unggahan produksi',
      'Dikoreksi setelah unggahan produksi, sejak awal tahun per Agu 2026, oleh Sari Puspita',
    ]);
    for (const w of words) expect(w).not.toMatch(/\bKPM\b|kantor/i);
  });

  it('P18.98-T3 keeps the figures’ language apart from the words’: a reader with no choice reads English words, Indonesian months', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year')).toBe('As of Okt 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'id', 'en')).toBe('As of Okt 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'en', 'id')).toBe('Per Oct 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'en', 'en')).toBe('As of Oct 2026');
  });
});

describe('P18.98-T4 monthsLeftInWords in Indonesian', () => {
  it.each([
    [2.2, 'sekitar 2 bulan'],
    [2.5, 'sekitar 3 bulan'],
    [1.4, 'sekitar 1 bulan'],
    [0.5, 'sekitar 1 bulan'],
    [11.9, 'sekitar 12 bulan'],
  ])('AC-3 %s months reads %s — one form for one and many (§B.0 rule 8)', (months, words) => {
    expect(monthsLeftInWords(months, 'id', 'id')).toBe(words);
  });

  it.each([0.49, 0, -1, Number.NaN])('AC-3 %s months — below half a month — reads kurang dari sebulan', (months) => {
    expect(monthsLeftInWords(months, 'id', 'id')).toBe('kurang dari sebulan');
  });

  it('keeps English the words when none is passed, as goals.spec.ts reads them', () => {
    expect(monthsLeftInWords(2.2)).toBe('about 2 months');
    expect(monthsLeftInWords(1.2, 'en', 'en')).toBe('about 1 month');
  });
});
