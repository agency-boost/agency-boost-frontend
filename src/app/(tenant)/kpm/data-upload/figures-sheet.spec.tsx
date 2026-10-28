import { describe, expect, it } from 'vitest';
import type { CorrectionResult } from '@/lib/production';
import { correctedWords, inSafeOrder } from './figures-sheet';

type Change = Parameters<typeof inSafeOrder>[0][number];
const change = (metric: Change['metric'], cadence: Change['cadence'], held: number | null, value: number | null): Change =>
  ({ metric, cadence, key: `${metric}:${cadence}`, held, value });
const order = (changes: Change[]) => inSafeOrder(changes).map((c) => c.key);

/**
 * **The sheet's figures go one `PATCH` at a time** (P18.97-T7 AC-2), and the server checks each against its pair as
 * it stands then: a month's figure never above the year to date (`breaksYtd`). So where both of a metric's change, the
 * one that keeps the pair whole is sent first.
 */
describe('P18.97-T7 AC-2 inSafeOrder: the order the sheet sends a metric’s month and year in', () => {
  it('P18.97-T7 AC-2 sends the year first when the month held fits under the new year — both raised', () => {
    // 1,5 jt / 9 jt held, 12 jt / 15 jt typed: the month first would read 12 jt over 9 jt and be refused.
    expect(order([change('ape', 'monthly', 150, 1200), change('ape', 'ytd', 900, 1500)])).toEqual(['ape:ytd', 'ape:monthly']);
  });

  it('P18.97-T7 AC-2 sends the month first when the new year falls under the month held — both lowered', () => {
    // 5 / 9 held, 1 / 3 typed: the year first would read 5 over 3 and be refused.
    expect(order([change('fyp', 'monthly', 5, 1), change('fyp', 'ytd', 9, 3)])).toEqual(['fyp:monthly', 'fyp:ytd']);
  });

  it('P18.97-T7 AC-2 sends the year first where either side is empty, which the rule does not check', () => {
    expect(order([change('policyCount', 'monthly', null, 2), change('policyCount', 'ytd', 4, 6)]))
      .toEqual(['policyCount:ytd', 'policyCount:monthly']);
    expect(order([change('policyCount', 'monthly', 2, 1), change('policyCount', 'ytd', 4, null)]))
      .toEqual(['policyCount:ytd', 'policyCount:monthly']);
  });

  it('P18.97-T7 AC-2 leaves a metric that changes once, and the others, in the table’s order', () => {
    expect(order([
      change('ape', 'monthly', 1, 2), change('persistency', 'monthly', 80, 81), change('ape', 'ytd', 9, 10),
      change('recruitment', 'ytd', 1, 2),
    ])).toEqual(['ape:ytd', 'ape:monthly', 'persistency:monthly', 'recruitment:ytd']);
    expect(order([change('persistency', 'ytd', 80, 81)])).toEqual(['persistency:ytd']);
  });
});

describe('P18.97-T7 AC-2 correctedWords: what the sheet did, in a sentence', () => {
  const result = (metric: CorrectionResult['metric'], cadence: CorrectionResult['cadence'], before: number | null, after: number | null, changed = true): CorrectionResult => ({
    membershipId: 'mem-rina', metric, cadence, changed,
    before: { value: before, provenance: 'imported', correction: null },
    after: { value: after, provenance: 'corrected', correction: null },
    state: { month: '2026-09', revision: 4, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
  });

  it('P18.97-T7 AC-2 says one figure in the panel’s own words', () => {
    expect(correctedWords('Rina Wijaya', [result('ape', 'monthly', 150_000_000, 200_000_000)]))
      .toBe('Corrected APE this month for Rina Wijaya: Rp 1.500.000 → Rp 2.000.000.');
  });

  it('P18.97-T7 AC-2 counts several and says each, in the order they were written', () => {
    expect(correctedWords('Rina Wijaya', [result('policyCount', 'monthly', 2, 3), result('persistency', 'ytd', 86, null)]))
      .toBe('Corrected 2 figures for Rina Wijaya: # of policy this month 2 → 3; Rolling persistency year to date 86% → nothing reported.');
  });

  it('P18.97-T7 AC-2 says when nothing changed, as the panel does', () => {
    expect(correctedWords('Rina Wijaya', [result('recruitment', 'ytd', 5, 5, false)]))
      .toBe('Recruitment year to date for Rina Wijaya already reads 5 — nothing was changed.');
  });
});
