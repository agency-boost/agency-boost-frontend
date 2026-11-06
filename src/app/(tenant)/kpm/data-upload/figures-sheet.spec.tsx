import { describe, expect, it } from 'vitest';
import { V1_COLUMNS, KOMISI } from '@test/data-upload-fixtures';
import type { CorrectionResult } from '@/lib/production';
import { correctedWords } from './figures-sheet';

/*
 * *Changed 2026-11-05 (P19.5-T2; R4, ADR-0214 §10):* the sheet sent a metric's month and year in the order that kept the
 * pair whole (`inSafeOrder`), because the server refused a month above its year to date. A summed year to date is the
 * months' now, never typed, so nothing pairs a month with a year and the rule went with it: the sheet sends each figure
 * in the order it lists them (`page.spec.tsx`, *saves each changed figure by kode*).
 */

describe('P18.9-T7 AC-2 correctedWords: what the sheet did, in a sentence', () => {
  const columns = [...V1_COLUMNS, KOMISI];
  const result = (kode: string, ytd: boolean, before: number | null, after: number | null, changed = true): CorrectionResult => ({
    membershipId: 'mem-rina', kode, ytd, changed,
    before: { value: before, provenance: 'imported', correction: null },
    after: { value: after, provenance: 'corrected', correction: null },
    state: { month: '2026-09', revision: 4, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
  });

  it('P18.9-T7 AC-2, P19.5-T2 says one figure in the panel’s own words, its column named by the template', () => {
    expect(correctedWords('Rina Wijaya', [result('APE', false, 150_000_000, 200_000_000)], columns, 'id'))
      .toBe('Corrected APE this month for Rina Wijaya: Rp 1.500.000 → Rp 2.000.000.');
  });

  it('P18.9-T7 AC-2, P19.5-T2 counts several and says each, in the order they were written — an uploaded YTD among them', () => {
    expect(correctedWords('Rina Wijaya', [result('POLICY_COUNT', false, 2, 3), result('KOMISI', true, 86_000_000, null)], columns, 'id'))
      .toBe('Corrected 2 figures for Rina Wijaya: # of policy (case issued) this month 2 → 3; Commission year to date Rp 860.000 → nothing reported.');
  });

  it('P18.9-T7 AC-2 says when nothing changed, as the panel does', () => {
    expect(correctedWords('Rina Wijaya', [result('RECRUITMENT', false, 5, 5, false)], columns, 'id'))
      .toBe('Recruitment this month for Rina Wijaya already reads 5 — nothing was changed.');
  });

  it('P18.10-T3 AC-4 writes the figures in full in the reader’s language: IDR 1,500,000 in English', () => {
    expect(correctedWords('Rina Wijaya', [result('APE', false, 150_000_000, 200_000_000)], columns, 'en'))
      .toBe('Corrected APE this month for Rina Wijaya: IDR 1,500,000 → IDR 2,000,000.');
  });

  it('P19.5-T2 names a column in the reader’s language: Persistensi rolling in Indonesian', () => {
    expect(correctedWords('Rina Wijaya', [result('PERSISTENCY', false, 86, 88)], columns, 'id', 'id'))
      .toBe('Persistensi rolling bulan ini untuk Rina Wijaya dikoreksi: 86% → 88%.');
  });
});
