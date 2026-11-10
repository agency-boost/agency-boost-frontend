import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { busy, entry, trip, WEEK } from '@test/calendar-fixtures';
import {
  allDayHeight, columnSpan, DAY_PX, ENTRY_LEADING, ENTRY_PAD_Y_PX, ENTRY_TIME_PX, ENTRY_TITLE_LINES_MAX, ENTRY_TITLE_PX,
  ENTRY_WITH_TIME_PX, HOUR_PX, isWeekend, itemsOnDay, layoutDay, MIN_ENTRY_PX, minutesOf, nextHalfHour, OPEN_AT_HOUR,
  openingHour, showsTime, slotFromSelection, snapMinutes, stackBars, timedOn, titleLines,
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

describe('what an entry has room for (P13.1-T8 AC-1)', () => {
  const heightOf = (start: string, end: string) => layoutDay([entry({ start, end })])[0].height;

  it('is the prototype’s padding and its two lines at 1.25: 4 + 13.75 + 12.5 + 4', () => {
    expect([ENTRY_PAD_Y_PX, ENTRY_LEADING, ENTRY_TITLE_PX, ENTRY_TIME_PX]).toEqual([4, 1.25, 11, 10]);
    expect(ENTRY_WITH_TIME_PX).toBe(34.25);
  });

  it('draws a half-hour entry’s title alone — the case the client saw cut — and an hour’s title and time', () => {
    expect(heightOf('09:00', '09:30')).toBe(26);
    expect(showsTime(heightOf('09:00', '09:30'))).toBe(false);
    expect(showsTime(heightOf('09:00', '09:45'))).toBe(true);
    expect(showsTime(heightOf('09:00', '10:00'))).toBe(true);
  });

  it('turns at 39 minutes, the first length both lines fit in whole', () => {
    expect(showsTime(heightOf('09:00', '09:38'))).toBe(false);
    expect(showsTime(heightOf('09:00', '09:39'))).toBe(true);
    expect(showsTime(ENTRY_WITH_TIME_PX)).toBe(true);
    expect(showsTime(ENTRY_WITH_TIME_PX - 0.01)).toBe(false);
  });

  it('never cuts the title: at the shortest an entry is drawn, its title still ends inside it', () => {
    expect(ENTRY_PAD_Y_PX + ENTRY_TITLE_PX * ENTRY_LEADING).toBeLessThanOrEqual(MIN_ENTRY_PX);
    expect(showsTime(MIN_ENTRY_PX)).toBe(false);
  });
});

/**
 * **P19.11-T1 AC-6 (UX-6) — every block shows its title**: one line when short or narrow, two or three when tall, the
 * time under it where it fits; navy on each block's pastel tone at 4.5:1 or more.
 */
describe('P19.11-T1 AC-6 a block’s title lines and its contrast', () => {
  const heightOf = (start: string, end: string) => layoutDay([entry({ start, end })])[0].height;
  const linesOf = (start: string, end: string, narrow = false) => {
    const height = heightOf(start, end);
    return titleLines(height, showsTime(height), narrow);
  };

  it('P19.11-T1 AC-6 a short block’s title is one line; an hour’s two, with its time; two hours’ three, never more', () => {
    expect(ENTRY_TITLE_LINES_MAX).toBe(3);
    expect(linesOf('09:00', '09:15')).toBe(1);
    expect(linesOf('09:00', '09:30')).toBe(1);
    expect(linesOf('09:00', '09:45')).toBe(1);
    expect(linesOf('09:00', '10:00')).toBe(2);
    expect(linesOf('09:00', '11:00')).toBe(3);
    expect(linesOf('09:00', '13:00')).toBe(3);
  });

  it('P19.11-T1 AC-6 every line it is given fits inside the block, under its padding and its time', () => {
    for (let minutes = 15; minutes <= 240; minutes += 5) {
      const height = Math.max(MIN_ENTRY_PX, (minutes / 60) * HOUR_PX - 2);
      const lines = titleLines(height, showsTime(height));
      const used = 2 * ENTRY_PAD_Y_PX + lines * ENTRY_TITLE_PX * ENTRY_LEADING + (showsTime(height) ? ENTRY_TIME_PX * ENTRY_LEADING : 0);
      // One line always, even where the shortest block's padding runs into it (`MIN_ENTRY_PX`, cut with an ellipsis).
      if (lines > 1) expect([minutes, used <= height]).toEqual([minutes, true]);
    }
  });

  it('P19.11-T1 AC-6 a narrow block — a phone’s Week — keeps one line whatever its height', () => {
    expect(linesOf('09:00', '13:00', true)).toBe(1);
    expect(linesOf('09:00', '09:30', true)).toBe(1);
  });

  it('P19.11-T1 AC-6 navy titles read at 4.5:1 or more on every block’s tone, over the card and over today’s shade', () => {
    const globals = readFileSync(join(__dirname, '../styles/globals.css'), 'utf8');
    const hex = (name: string) => globals.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'))![1];
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const over = (top: string, alpha: number, under: string) => rgb(top).map((c, i) => Math.round(c * alpha + rgb(under)[i] * (1 - alpha)));
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    // `ENTRY_TONE`, `EVENT_TONE` and the busy block's: each colour at its alpha.
    const tones: [string, number][] = [
      ['navy-soft', 0.12], ['amber', 0.18], ['alert', 0.1], ['success', 0.1], ['teal', 0.12], ['lavender', 0.14], ['navy', 0.06],
    ];
    for (const ground of ['card', 'today']) {
      for (const [tone, alpha] of tones) {
        const r = ratio(rgb(hex('navy')), over(hex(tone), alpha, hex(ground)));
        expect([ground, tone, r >= 4.5]).toEqual([ground, tone, true]);
      }
    }
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

describe('P19.1-T3 — the one time grid and the Agenda’s bands', () => {
  it('P19.1-T3 AC-4 opens an hour before now when today is in view, and at 07.00 on any other days', () => {
    // *now 10.20 − 1 h* opens at 09.00 (the 2 Nov mockups); 09.45 at 08.00.
    expect(openingHour(WEEK, '2026-09-28', 10 * 60 + 20)).toBe(9);
    expect(openingHour(WEEK, '2026-09-28', 585)).toBe(8);
    expect(openingHour(WEEK, '2026-09-28', 30)).toBe(0);
    expect(openingHour(WEEK, '2026-10-07', 585)).toBe(OPEN_AT_HOUR);
    expect(openingHour(WEEK, '2026-09-28', null)).toBe(7);
  });

  it('P19.1-T3 AC-4 knows a weekend from its date alone', () => {
    expect(WEEK.map(isWeekend)).toEqual([false, false, false, false, false, true, true]);
  });
});
