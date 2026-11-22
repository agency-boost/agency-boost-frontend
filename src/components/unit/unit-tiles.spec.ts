import { describe, expect, it } from 'vitest';
import { teamLine } from './unit-tiles';

/**
 * **The team tile's line** (P18.7-T7 AC-1, ADR-0167 §7; the client's *Grey text* table, row 19): *4 direct · 8 under
 * AABs*, computed from the server's counts — the head's own unit, then the rest of their *Grup langsung* (ADR-0249 §3).
 */
describe('teamLine', () => {
  it('P18.7-T7 AC-1 counts the direct unit, then the AAB side heads and all — the client’s 4 + 3 + 5', () => {
    expect(teamLine({ direct: 4, aab: 8 })).toBe('4 direct · 8 under AABs');
  });

  it('P18.7-T7 AC-1 adds up whatever the counts, none at all included', () => {
    for (const team of [{ direct: 1, aab: 0 }, { direct: 0, aab: 0 }, { direct: 12, aab: 41 }]) {
      const [direct, under] = teamLine(team).match(/\d+/g)!.map(Number);
      expect(direct + under).toBe(team.direct + team.aab);
    }
    expect(teamLine({ direct: 1, aab: 0 })).toBe('1 direct · 0 under AABs');
  });
});

describe('P18.10-T4 teamLine in Indonesian', () => {
  it('says the two parts in Indonesian, AAB kept, one form for one and many', () => {
    expect(teamLine({ direct: 4, aab: 8 }, 'id')).toBe('4 langsung · 8 di bawah AAB');
    expect(teamLine({ direct: 1, aab: 0 }, 'id')).toBe('1 langsung · 0 di bawah AAB');
  });
});

/*
 * *Tim Anda*'s chips (P19.12-T6 AC-1) were pinned here: retired with the chips themselves by P19.18-T1 AC-3 (ADR-0271 §3,
 * *"no split chips — the downline filter does that"*). The panel's one number per tile is pinned in
 * `app/(agent)/unit/dashboard/page.spec.tsx`.
 */
