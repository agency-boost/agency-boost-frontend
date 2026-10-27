import { describe, expect, it } from 'vitest';
import { teamLine } from './unit-tiles';

/**
 * **The team tile's line** (P18.95-T7 AC-1, ADR-0167 §7; the client's *Grey text* table, row 19): *4 direct · 8 under
 * AABs*, computed from the server's counts — the head's own unit, then every AAB unit with everybody in it.
 */
describe('teamLine', () => {
  it('P18.95-T7 AC-1 counts the direct unit, then the AAB units heads and all — the client’s 4 + 3 + 5', () => {
    expect(teamLine({ direct: 4, units: 3, underUnits: 5 })).toBe('4 direct · 8 under AABs');
  });

  it('P18.95-T7 AC-1 adds up to the headline whatever the counts, none at all included', () => {
    for (const team of [{ direct: 1, units: 0, underUnits: 0 }, { direct: 0, units: 0, underUnits: 0 }, { direct: 12, units: 4, underUnits: 37 }]) {
      const [direct, under] = teamLine(team).match(/\d+/g)!.map(Number);
      expect(direct + under).toBe(team.direct + team.units + team.underUnits);
    }
    expect(teamLine({ direct: 1, units: 0, underUnits: 0 })).toBe('1 direct · 0 under AABs');
  });
});
