import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clockMinutes, endMinutes, formatCalendarDay, formatCalendarDayLong, formatClock, formatDay, formatDayHeader, formatDayLong,
  formatHour, formatMonth, formatMonthSpan, formatNoticeFull, formatNoticeShort, formatOfficeDay, formatShortDay, formatTimeSpan,
  formatTripWhen, formatWeekday, formatWeekdayDay, formatWeekRange, formatWhen, monthInZone, OFFICE_TIME_ZONE,
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

/**
 * P12.1-T3 AC-4, AC-6: a notification's time, on the office's calendar (ADR-0016) — and the same in
 * every zone the browser could be in, which is the point of passing the zone rather than the browser's.
 */
describe.each(['UTC', 'Asia/Jakarta', 'America/New_York'])('a notification’s time, with the clock in %s', (zone) => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = zone; });
  afterAll(() => { process.env.TZ = original; });

  // 10:00 on 3 October in Jakarta.
  const now = new Date('2026-10-03T03:00:00Z');

  it('P12.1-T3 AC-6 gives the time for one from the office’s today', () => {
    // 07:05 in Jakarta: still 2 October in UTC and New York, but today in the office.
    expect(formatNoticeShort('2026-10-03T00:05:00Z', now)).toBe('7:05 AM');
    expect(formatNoticeShort('2026-10-03T07:30:00Z', now)).toBe('2:30 PM');
  });

  it('P12.1-T3 AC-6 gives the day and month for an earlier one, and the year only when it is not this one', () => {
    // 23:30 on 2 October in Jakarta is yesterday there, whatever day it is in UTC.
    expect(formatNoticeShort('2026-10-02T16:30:00Z', now)).toBe('Oct 2');
    expect(formatNoticeShort('2026-09-01T00:00:00Z', now)).toBe('Sep 1');
    expect(formatNoticeShort('2025-10-03T03:00:00Z', now)).toBe('Oct 3, 2025');
  });

  it('P12.1-T3 AC-4 writes the date and time in full for the modal, in the office’s zone', () => {
    expect(formatNoticeFull('2026-09-30T18:05:00Z')).toBe('October 1, 2026 · 1:05 AM');
    expect(formatNoticeFull('2026-10-03T07:30:00Z')).toBe('October 3, 2026 · 2:30 PM');
  });

  it('answers empty for something that is not an instant', () => {
    expect(formatNoticeShort('not a date', now)).toBe('');
    expect(formatNoticeFull('')).toBe('');
  });
});

/**
 * P13-T4 AC-5: the day an activation item was ticked, a start date corrected or a note saved — the
 * office's, whatever zone the browser is in.
 */
describe.each(['UTC', 'Asia/Jakarta', 'America/New_York'])('formatOfficeDay, with the clock in %s', (zone) => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = zone; });
  afterAll(() => { process.env.TZ = original; });

  it('P13-T4 AC-5 gives the office’s day for an instant: 23:30 UTC is the next day in Jakarta', () => {
    expect(formatOfficeDay('2026-09-30T23:30:00Z')).toBe('Oct 1, 2026');
    expect(formatOfficeDay('2026-10-03T03:00:00Z')).toBe('Oct 3, 2026');
  });

  it('answers empty for something that is not an instant', () => {
    expect(formatOfficeDay('nope')).toBe('');
  });
});

describe('OFFICE_TIME_ZONE (ADR-0016, invariant §7)', () => {
  it('is the backend’s DEFAULT_TENANT_TIMEZONE, read from its constants module, so the two cannot drift', () => {
    const constants = readFileSync(
      join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'index.ts'), 'utf8',
    );
    const declared = /export const DEFAULT_TENANT_TIMEZONE = '([^']+)';/.exec(constants);
    expect(declared?.[1]).toBe(OFFICE_TIME_ZONE);
  });
});
