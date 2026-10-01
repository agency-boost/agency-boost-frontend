import { describe, expect, it } from 'vitest';
import {
  formatCalendarDay, formatDay, formatDayLong, formatMonth, formatShortDay, formatWeekday, monthInZone } from './format';

describe('formatDay', () => {
  it('writes a date the way the prototype does', () => {
    // `Overall.html:5457-5461`. It had drifted to en-GB — `4 Sep 2026`.
    expect(formatDay('2026-09-04')).toBe('Sep 4, 2026');
  });

  it('is the same shape whatever the reader’s language is', () => {
    // A date that changes shape with the browser's locale cannot be lined up in a column.
    expect(formatDay('2026-01-31')).toBe('Jan 31, 2026');
    expect(formatDay('2026-12-01')).toBe('Dec 1, 2026');
  });

  it('answers empty for something that is not a date, rather than "Invalid Date"', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
});

describe('formatDayLong', () => {
  it('spells the month out, for a sentence rather than a column', () => {
    expect(formatDayLong('2026-09-13')).toBe('September 13, 2026');
  });

  it('answers empty for something that is not a date', () => {
    expect(formatDayLong('nope')).toBe('');
  });
});

describe('formatCalendarDay', () => {
  it('spells an office calendar day for a sentence', () => {
    expect(formatCalendarDay('2026-10-07')).toBe('October 7, 2026');
  });

  it('never slips a day, whatever zone the browser is in — it is not an instant', () => {
    // Built from its numbers: there is no midnight-UTC to fall back across.
    expect(formatCalendarDay('2026-01-01')).toBe('January 1, 2026');
  });

  it('gives nothing for something that is not a day', () => {
    expect(formatCalendarDay('')).toBe('');
    expect(formatCalendarDay('soon')).toBe('');
  });
});

describe('formatMonth', () => {
  it('names an office calendar month', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
  });

  it('hands back what is not a month', () => {
    expect(formatMonth('soon')).toBe('soon');
  });
});

describe('formatShortDay and formatWeekday (P10-T1)', () => {
  it('writes a column’s day, and a range’s last one with its year', () => {
    expect(formatShortDay('2026-09-22')).toBe('Sep 22');
    expect(formatShortDay('2026-09-28', { year: true })).toBe('Sep 28, 2026');
  });

  it('names the weekday from the calendar day, not from an instant', () => {
    // 2026-09-28 is a Monday wherever the browser is; parsing it as UTC midnight would make it a
    // Sunday west of Greenwich.
    expect(formatWeekday('2026-09-28')).toBe('Mon');
    expect(formatWeekday('2026-03-01')).toBe('Sun');
  });

  it('writes nothing for something that is not a day', () => {
    expect(formatShortDay('')).toBe('');
    expect(formatWeekday('soon')).toBe('');
  });
});

describe('monthInZone (invariant §9)', () => {
  it('names the month an instant falls in, in the office’s zone', () => {
    // 01:00 on 1 October in Jakarta; 18:00 on 30 September in UTC.
    const at = new Date('2026-09-30T18:00:00Z');
    expect(monthInZone('Asia/Jakarta', at)).toBe('2026-10');
    expect(monthInZone('UTC', at)).toBe('2026-09');
  });
});
