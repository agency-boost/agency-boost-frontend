import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { teamChips, teamLine } from './unit-tiles';

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

/**
 * ***Tim Anda*'s chips** (P19.12-T6 AC-1; the client's message of 11 November 2026, item 5 — *"Wilson: 28 AAB"*):
 * an AB below is never counted as an AAB. *{n} langsung · {n} AAB*, and *{n} AB* only while the view holds somebody
 * outside the head's *Grup langsung*.
 */
describe('P19.12-T6 teamChips', () => {
  const text = (chips: ReturnType<typeof teamChips>) => chips.map((c) => renderToStaticMarkup(createElement(Fragment, null, c.label)).replace(/<\/?b>/g, ''));

  it('P19.12-T6 AC-1 Grup langsung: two chips, no AB inside the AAB count', () => {
    expect(text(teamChips({ direct: 4, aab: 8, ab: 0 }, 'id'))).toEqual(['4 langsung', '8 AAB']);
  });

  it('P19.12-T6 AC-1 a view holding ABs below: the third chip, the three adding up to the tile', () => {
    const chips = text(teamChips({ direct: 1, aab: 0, ab: 28 }, 'id'));
    expect(chips).toEqual(['1 langsung', '0 AAB', '28 AB']);
    expect(chips.map((c) => Number(c.match(/\d+/)![0])).reduce((a, b) => a + b, 0)).toBe(29);
    expect(text(teamChips({ direct: 3, aab: 8, ab: 2 }))).toEqual(['3 direct', '8 AAB', '2 AB']);
  });
});
