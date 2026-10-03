import { describe, expect, it } from 'vitest';
import { busy, entry, trip, WEEK } from '@test/calendar-fixtures';
import {
  allDayHeight, columnSpan, DAY_PX, HOUR_PX, itemsOnDay, layoutDay, MIN_ENTRY_PX, minutesOf, nextHalfHour,
  slotFromSelection, snapMinutes, stackBars, timedOn,
} from './calendar-layout';

const at = (h: number, m = 0) => ((h * 60 + m) / 60) * HOUR_PX;

describe('a slot on the grid (P12-T2 AC-4, AC-5)', () => {
  it('snaps a drag to a quarter hour', () => {
    expect(snapMinutes(at(10, 7))).toBe(600);
    expect(snapMinutes(at(10, 8))).toBe(615);
    expect(slotFromSelection(at(10), at(1, 30))).toEqual({ start: '10:00', end: '11:30' });
  });

  it('makes a click or a tap the prototype’s half hour (`:660-661`)', () => {
    expect(slotFromSelection(at(14, 5), 4)).toEqual({ start: '14:00', end: '14:30' });
  });

  it('ends a drag to the grid’s foot at 00:00, never 24:00 (contradiction 5)', () => {
    expect(slotFromSelection(at(23), DAY_PX - at(23))).toEqual({ start: '23:00', end: '00:00' });
  });

  it('clamps a click at 23:45 to midnight, never 24:15', () => {
    expect(slotFromSelection(at(23, 45), 2)).toEqual({ start: '23:45', end: '00:00' });
    expect(slotFromSelection(DAY_PX, 2)).toEqual({ start: '23:45', end: '00:00' });
  });

  it('turns a drag that ends where it began into the half hour', () => {
    // 8:53 snaps to 9:00, and 11px further is still 9:00: the half hour, as the prototype does (`:661`).
    expect(slotFromSelection(at(8, 53), 11)).toEqual({ start: '09:00', end: '09:30' });
  });
});

describe('the pill’s slot (D-block-key)', () => {
  it('is the next half hour of the office’s today', () => {
    expect(nextHalfHour(585)).toEqual({ start: '10:00', end: '10:30' });
    expect(nextHalfHour(600)).toEqual({ start: '10:30', end: '11:00' });
    expect(nextHalfHour(0)).toEqual({ start: '00:30', end: '01:00' });
  });

  it('is 23:30 to midnight once that has passed', () => {
    expect(nextHalfHour(1405)).toEqual({ start: '23:30', end: '00:00' });
    expect(nextHalfHour(1439)).toEqual({ start: '23:30', end: '00:00' });
  });
});

describe('overlap (P12-T2 AC-6, contradiction 7)', () => {
  it('reads an end of 00:00 as the end of the day', () => {
    expect(minutesOf({ start: '23:00', end: '00:00' })).toEqual({ start: 1380, end: 1440 });
  });

  it('draws an entry at its time, never shorter than the prototype’s 20px', () => {
    const [placed] = layoutDay([entry({ start: '09:00', end: '09:30' })]);
    expect(placed.top).toBe(9 * HOUR_PX);
    expect(placed.height).toBe(HOUR_PX / 2 - 2);
    expect(layoutDay([entry({ start: '09:00', end: '09:05' })])[0].height).toBe(MIN_ENTRY_PX);
    expect(placed.lanes).toBe(1);
  });

  it('puts entries that overlap side by side, and one that does not back at full width', () => {
    const placed = layoutDay([
      entry({ entryId: 'a', start: '09:00', end: '10:00' }),
      entry({ entryId: 'b', start: '09:30', end: '10:30' }),
      entry({ entryId: 'c', start: '10:00', end: '11:00' }),
      entry({ entryId: 'd', start: '13:00', end: '14:00' }),
    ]);
    const by = Object.fromEntries(placed.map((p) => [(p.item as { entryId: string }).entryId, p]));
    expect([by.a.lane, by.b.lane, by.c.lane]).toEqual([0, 1, 0]);
    expect([by.a.lanes, by.b.lanes, by.c.lanes]).toEqual([2, 2, 2]);
    expect(by.d).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('lays out busy blocks as it lays out entries', () => {
    expect(layoutDay([busy(), busy({ start: '13:30', end: '14:30' })]).map((p) => p.lanes)).toEqual([2, 2]);
  });
});

describe('the all-day row', () => {
  it('clips a trip at the week’s edges (contradiction 6)', () => {
    expect(columnSpan('2026-09-25', '2026-09-29', WEEK)).toEqual({ first: 0, last: 1 });
    expect(columnSpan('2026-10-03', '2026-10-09', WEEK)).toEqual({ first: 5, last: 6 });
    expect(columnSpan('2026-09-20', '2026-10-20', WEEK)).toEqual({ first: 0, last: 6 });
    expect(columnSpan('2026-10-05', '2026-10-06', WEEK)).toBeNull();
    expect(columnSpan('2026-09-01', '2026-09-27', WEEK)).toBeNull();
    expect(columnSpan('2026-09-28', '2026-09-28', [])).toBeNull();
  });

  it('stacks trips that overlap, and grows the row to hold them (P12-T2 AC-6)', () => {
    const { bars, lanes } = stackBars([
      trip({ entryId: 'a', startsOn: '2026-09-28', endsOn: '2026-09-29' }),
      trip({ entryId: 'b', startsOn: '2026-09-29', endsOn: '2026-10-01' }),
      trip({ entryId: 'c', startsOn: '2026-10-02', endsOn: '2026-10-02' }),
      trip({ entryId: 'd', startsOn: '2026-11-02', endsOn: '2026-11-03' }),
    ], WEEK);
    expect(bars.map((b) => [(b.item as { entryId: string }).entryId, b.first, b.last, b.lane])).toEqual([
      ['a', 0, 1, 0], ['b', 1, 3, 1], ['c', 4, 4, 0],
    ]);
    expect(lanes).toBe(2);
    expect(allDayHeight(0)).toBe(28);
    expect(allDayHeight(1)).toBe(28);
    expect(allDayHeight(2)).toBe(53);
  });
});

describe('what a day holds', () => {
  const items = [
    entry({ entryId: 'b', date: '2026-09-28', start: '14:00', end: '15:00' }),
    entry({ entryId: 'a', date: '2026-09-28', start: '09:00', end: '09:30' }),
    entry({ entryId: 'z', date: '2026-09-29' }),
    trip({ entryId: 't', startsOn: '2026-09-27', endsOn: '2026-09-28' }),
  ];

  it('gives the week’s column its timed entries only', () => {
    expect(timedOn(items, '2026-09-28').map((i) => (i as { entryId: string }).entryId)).toEqual(['b', 'a']);
  });

  it('P12-T3 AC-2 gives a month cell its entries by start, a trip first and on each day it spans', () => {
    const ids = (day: string) => itemsOnDay(items, day).map((i) => (i as { entryId: string }).entryId);
    expect(ids('2026-09-28')).toEqual(['t', 'a', 'b']);
    expect(ids('2026-09-27')).toEqual(['t']);
    expect(ids('2026-09-29')).toEqual(['z']);
    expect(ids('2026-09-30')).toEqual([]);
  });

  it('orders entries at one time by their id, and busy blocks without one', () => {
    const same = [entry({ entryId: 'y' }), entry({ entryId: 'x' }), busy({ date: '2026-09-28', start: '09:00', end: '09:30' })];
    expect(itemsOnDay(same, '2026-09-28').map((i) => ('entryId' in i ? i.entryId : 'busy'))).toEqual(['busy', 'x', 'y']);
  });
});
