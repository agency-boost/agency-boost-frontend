import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clockMinutes, endMinutes, formatCalendarDay, formatCalendarDayLong, formatClock, formatDay, formatDayHeader, formatDayLong,
  formatHour, formatMonth, formatMonthSpan, formatShortDay, formatTimeSpan, formatTripWhen, formatWeekday, formatWeekdayDay,
  formatWeekRange, formatWhen, monthInZone,
} from './format';

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

describe('formatCalendarDayLong', () => {
  it('P11-T8 AC-1 writes the session header’s date as the prototype does, weekday first', () => {
    // `fmtToday()`, `Overall.html:10584`: en-US, weekday and month long.
    expect(formatCalendarDayLong('2026-10-02')).toBe('Friday, October 2, 2026');
  });

  it('builds the day from its numbers, so no zone can move it', () => {
    expect(formatCalendarDayLong('2026-01-01')).toBe('Thursday, January 1, 2026');
    expect(formatCalendarDayLong('not a day')).toBe('');
  });
});

/**
 * P12-T2 AC-3 and P12-T3 AC-1, AC-3: the calendar's shapes, each the prototype's for its own space,
 * and **the same in every zone the browser could be in** — run with the process clock in UTC, Jakarta
 * and New York (exit criterion 1). They spell what the read served; none of them can move a day.
 */
describe.each(['UTC', 'Asia/Jakarta', 'America/New_York'])('the calendar’s formats, with the clock in %s', (zone) => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = zone; });
  afterAll(() => { process.env.TZ = original; });

  it('labels a week `Sep 28 – Oct 4, 2026`, and one across a year with both years (`:285`)', () => {
    expect(formatWeekRange('2026-09-28', '2026-10-04')).toBe('Sep 28 – Oct 4, 2026');
    expect(formatWeekRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
    expect(formatWeekRange('2026-08-31', '2026-09-06')).toBe('Aug 31 – Sep 6, 2026');
    expect(formatWeekRange('nope', '2026-09-06')).toBe('');
  });

  it('heads a column with its weekday and number, `Oct 1` on the first (`:327-333`)', () => {
    expect(formatDayHeader('2026-09-28')).toEqual({ weekday: 'Mon', number: '28' });
    expect(formatDayHeader('2026-10-01')).toEqual({ weekday: 'Thu', number: 'Oct 1' });
    expect(formatDayHeader('2027-01-01')).toEqual({ weekday: 'Fri', number: 'Jan 1' });
    expect(formatDayHeader('')).toEqual({ weekday: '', number: '' });
  });

  it('labels the hours `12 AM` … `11 PM` (`:590`)', () => {
    expect([0, 1, 11, 12, 13, 23].map(formatHour)).toEqual(['12 AM', '1 AM', '11 AM', '12 PM', '1 PM', '11 PM']);
  });

  it('writes the week’s time `9:00 AM–9:30 AM`, an en dash with no spaces (`:611`)', () => {
    expect(formatTimeSpan('09:00', '09:30')).toBe('9:00 AM–9:30 AM');
    expect(formatTimeSpan('12:00', '13:30')).toBe('12:00 PM–1:30 PM');
    expect(formatTimeSpan('23:00', '00:00')).toBe('11:00 PM–12:00 AM');
    expect(formatClock('nope')).toBe('');
  });

  it('writes the detail’s *When* `Monday, Sep 28, 2026 · 9:00 AM – 9:30 AM` (`:827`)', () => {
    expect(formatWhen('2026-09-28', '09:00', '09:30')).toBe('Monday, Sep 28, 2026 · 9:00 AM – 9:30 AM');
    expect(formatWeekdayDay('bad')).toBe('');
  });

  it('writes a trip’s two dates joined by an en dash, or one for a one-day trip', () => {
    expect(formatTripWhen('2026-09-28', '2026-09-29')).toBe('Monday, Sep 28, 2026 – Tuesday, Sep 29, 2026');
    expect(formatTripWhen('2026-10-02', '2026-10-02')).toBe('Friday, Oct 2, 2026');
  });

  it('writes the month’s time `9-9.30`, `14-15`, 24-hour with an ASCII hyphen (`:1036-1040`)', () => {
    expect(formatMonthSpan('09:00', '09:30')).toBe('9-9.30');
    expect(formatMonthSpan('14:00', '15:00')).toBe('14-15');
    expect(formatMonthSpan('10:00', '11:30')).toBe('10-11.30');
    expect(formatMonthSpan('09:05', '09:30')).toBe('9.05-9.30');
    expect(formatMonthSpan('23:00', '00:00')).toBe('23-24');
    expect(formatMonthSpan('x', 'y')).toBe('-');
  });

  it('labels the month `September 2026` (`:1013`)', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2027-02')).toBe('February 2027');
  });
});

describe('office times', () => {
  it('reads `HH:mm` as minutes after midnight, and an end of 00:00 as the end of the day', () => {
    expect(clockMinutes('09:45')).toBe(585);
    expect(clockMinutes('24:00')).toBeNull();
    expect(clockMinutes('9.45')).toBeNull();
    expect(endMinutes('00:00')).toBe(1440);
    expect(endMinutes('10:30')).toBe(630);
    expect(endMinutes('')).toBeNull();
  });
});
