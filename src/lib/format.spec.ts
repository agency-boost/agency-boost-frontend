import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clockMinutes, endMinutes, formatCalendarDay, formatCalendarDayLong, formatClock, formatDateTime, formatDay, formatDayClock, formatDayHeader,
  formatDayLong, formatHour, formatMonth, formatMonthName, formatMonthSpan, formatNoticeFull, formatNoticeShort, formatNumber,
  formatOfficeDay, formatOfficeMonth, formatOfficeTime, formatPercent, formatRupiah, formatRupiahCompact, formatRupiahCompactPair, formatShortDay, formatTimeSpan, formatTripWhen,
  formatWeekday, formatWeekdayDay, formatWeekRange, formatWhen, MINOR_UNITS_PER_MAJOR, monthInZone, OFFICE_TIME_ZONE, parseDecimal,
  PERCENT_LOSSLESS_MAX_DECIMALS, percentOf, RUPIAH_PER_UNIT, toMajor, toMinor,
} from './format';

describe('formatDay', () => {
  it('P18.95-T1 AC-1 writes a date in id-ID, `4 Sep 2026`', () => {
    expect(formatDay('2026-09-04')).toBe('4 Sep 2026');
  });

  it('P18.95-T1 AC-1 uses id-ID’s own month names, whatever the reader’s language is', () => {
    // A date that changes shape with the browser's locale cannot be lined up in a column.
    expect(formatDay('2026-01-31')).toBe('31 Jan 2026');
    expect(formatDay('2026-12-01')).toBe('1 Des 2026');
    expect(formatDay('2026-05-02')).toBe('2 Mei 2026');
    expect(formatDay('2026-08-17')).toBe('17 Agu 2026');
    expect(formatDay('2026-10-26')).toBe('26 Okt 2026');
  });

  it('answers empty for something that is not a date, rather than "Invalid Date"', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
});

describe('formatDayLong', () => {
  it('P18.95-T1 AC-1 writes a sentence’s date in the one shape, `13 Sep 2026`', () => {
    expect(formatDayLong('2026-09-13')).toBe('13 Sep 2026');
  });

  it('answers empty for something that is not a date', () => {
    expect(formatDayLong('nope')).toBe('');
  });
});

describe('formatCalendarDay', () => {
  it('P18.95-T1 AC-1 writes an office calendar day `7 Okt 2026`', () => {
    expect(formatCalendarDay('2026-10-07')).toBe('7 Okt 2026');
  });

  it('never slips a day, whatever zone the browser is in — it is not an instant', () => {
    // Built from its numbers: there is no midnight-UTC to fall back across.
    expect(formatCalendarDay('2026-01-01')).toBe('1 Jan 2026');
  });

  it('gives nothing for something that is not a day', () => {
    expect(formatCalendarDay('')).toBe('');
    expect(formatCalendarDay('soon')).toBe('');
  });
});

describe('formatMonth', () => {
  it('P18.95-T1 AC-1 names an office calendar month `Okt 2026`', () => {
    expect(formatMonth('2026-10')).toBe('Okt 2026');
    expect(formatMonth('2027-01')).toBe('Jan 2027');
  });

  it('names a month alone for an axis or a date block', () => {
    expect(formatMonthName('2026-10')).toBe('Okt');
    expect(formatMonthName('2026-08-13')).toBe('Agu');
    expect(formatMonthName('soon')).toBe('');
  });

  it('hands back what is not a month', () => {
    expect(formatMonth('soon')).toBe('soon');
  });
});

describe('formatShortDay and formatWeekday (P10-T1)', () => {
  it('writes a column’s day, and a range’s last one with its year', () => {
    expect(formatShortDay('2026-09-22')).toBe('22 Sep');
    expect(formatShortDay('2026-09-28', { year: true })).toBe('28 Sep 2026');
  });

  it('names the weekday from the calendar day, not from an instant', () => {
    // 2026-09-28 is a Monday wherever the browser is; parsing it as UTC midnight would make it a
    // Sunday west of Greenwich.
    expect(formatWeekday('2026-09-28')).toBe('Sen');
    expect(formatWeekday('2026-03-01')).toBe('Min');
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
  it('P11-T8 AC-1, P18.95-T1 AC-1 writes the session header’s date weekday first, `Jumat, 2 Okt 2026`', () => {
    expect(formatCalendarDayLong('2026-10-02')).toBe('Jumat, 2 Okt 2026');
    expect(formatCalendarDayLong('2026-10-26')).toBe('Senin, 26 Okt 2026');
  });

  it('names every weekday as id-ID does', () => {
    expect(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']
      .map((d) => formatCalendarDayLong(d).split(',')[0]))
      .toEqual(['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']);
  });

  it('builds the day from its numbers, so no zone can move it', () => {
    expect(formatCalendarDayLong('2026-01-01')).toBe('Kamis, 1 Jan 2026');
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

  it('labels a week `28 Sep – 4 Okt 2026`, and one across a year with both years (`:285`)', () => {
    expect(formatWeekRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Okt 2026');
    expect(formatWeekRange('2026-12-28', '2027-01-03')).toBe('28 Des 2026 – 3 Jan 2027');
    expect(formatWeekRange('2026-08-31', '2026-09-06')).toBe('31 Agu – 6 Sep 2026');
    expect(formatWeekRange('nope', '2026-09-06')).toBe('');
  });

  it('heads a column with its weekday and number, `1 Okt` on the first (`:327-333`)', () => {
    expect(formatDayHeader('2026-09-28')).toEqual({ weekday: 'Sen', number: '28' });
    expect(formatDayHeader('2026-10-01')).toEqual({ weekday: 'Kam', number: '1 Okt' });
    expect(formatDayHeader('2027-01-01')).toEqual({ weekday: 'Jum', number: '1 Jan' });
    expect(formatDayHeader('')).toEqual({ weekday: '', number: '' });
  });

  it('P18.95-T1 AC-1 labels the hours `00.00` … `23.00`, 24-hour (`:590`)', () => {
    expect([0, 1, 11, 12, 13, 23, 24].map(formatHour)).toEqual(['00.00', '01.00', '11.00', '12.00', '13.00', '23.00', '00.00']);
  });

  it('P18.95-T1 AC-1 writes the week’s time `09.00–09.30`, an en dash with no spaces (`:611`)', () => {
    expect(formatTimeSpan('09:00', '09:30')).toBe('09.00–09.30');
    expect(formatTimeSpan('12:00', '13:05')).toBe('12.00–13.05');
    expect(formatTimeSpan('23:00', '00:00')).toBe('23.00–00.00');
    expect(formatClock('13:05')).toBe('13.05');
    expect(formatClock('nope')).toBe('');
  });

  it('writes the detail’s *When* `Senin, 28 Sep 2026 · 09.00 – 09.30` (`:827`)', () => {
    expect(formatWhen('2026-09-28', '09:00', '09:30')).toBe('Senin, 28 Sep 2026 · 09.00 – 09.30');
    expect(formatWeekdayDay('bad')).toBe('');
  });

  it('writes a trip’s two dates joined by an en dash, or one for a one-day trip', () => {
    expect(formatTripWhen('2026-09-28', '2026-09-29')).toBe('Senin, 28 Sep 2026 – Selasa, 29 Sep 2026');
    expect(formatTripWhen('2026-10-02', '2026-10-02')).toBe('Jumat, 2 Okt 2026');
  });

  it('writes the month’s time `9-9.30`, `14-15`, 24-hour with an ASCII hyphen (`:1036-1040`)', () => {
    expect(formatMonthSpan('09:00', '09:30')).toBe('9-9.30');
    expect(formatMonthSpan('14:00', '15:00')).toBe('14-15');
    expect(formatMonthSpan('10:00', '11:30')).toBe('10-11.30');
    expect(formatMonthSpan('09:05', '09:30')).toBe('9.05-9.30');
    expect(formatMonthSpan('23:00', '00:00')).toBe('23-24');
    expect(formatMonthSpan('x', 'y')).toBe('-');
  });

  it('labels the month `Sep 2026` (`:1013`)', () => {
    expect(formatMonth('2026-09')).toBe('Sep 2026');
    expect(formatMonth('2027-02')).toBe('Feb 2027');
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
    expect(formatNoticeShort('2026-10-03T00:05:00Z', now)).toBe('07.05');
    expect(formatNoticeShort('2026-10-03T07:30:00Z', now)).toBe('14.30');
  });

  it('P12.1-T3 AC-6 gives the day and month for an earlier one, and the year only when it is not this one', () => {
    // 23:30 on 2 October in Jakarta is yesterday there, whatever day it is in UTC.
    expect(formatNoticeShort('2026-10-02T16:30:00Z', now)).toBe('2 Okt');
    expect(formatNoticeShort('2026-09-01T00:00:00Z', now)).toBe('1 Sep');
    expect(formatNoticeShort('2025-10-03T03:00:00Z', now)).toBe('3 Okt 2025');
  });

  it('P12.1-T3 AC-4 writes the date and time in full for the modal, in the office’s zone', () => {
    expect(formatNoticeFull('2026-09-30T18:05:00Z')).toBe('1 Okt 2026, 01.05');
    expect(formatNoticeFull('2026-10-03T07:30:00Z')).toBe('3 Okt 2026, 14.30');
  });

  it('P18.95-T1 AC-1 writes any instant’s date and time `26 Okt 2026, 13.05`, and its time alone, in the office’s zone', () => {
    expect(formatDateTime('2026-10-26T06:05:00Z')).toBe('26 Okt 2026, 13.05');
    expect(formatDateTime('2026-10-26T06:05:00Z', 'UTC')).toBe('26 Okt 2026, 06.05');
    expect(formatOfficeTime('2026-10-26T06:05:00Z')).toBe('13.05');
    expect(formatDateTime('nope')).toBe('');
    expect(formatOfficeTime('')).toBe('');
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
    expect(formatOfficeDay('2026-09-30T23:30:00Z')).toBe('1 Okt 2026');
    expect(formatOfficeDay('2026-10-03T03:00:00Z')).toBe('3 Okt 2026');
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

/** Rupiah in sen, for the money specs: `rp(500_000_000)` is Rp 500.000.000. */
const rp = (rupiah: number) => rupiah * MINOR_UNITS_PER_MAJOR;

/** ADR-0167 §1, AC-2: the full form, for a table's cell, an input and an export. */
describe('formatRupiah, in full (P18.95-T1 AC-2)', () => {
  it('writes whole rupiah from sen, grouped with dots', () => {
    expect(formatRupiah(rp(500_000_000))).toBe('Rp 500.000.000');
    expect(formatRupiah(rp(1_250))).toBe('Rp 1.250');
    expect(formatRupiah(rp(999))).toBe('Rp 999');
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('keeps a negative’s minus in front of Rp', () => {
    expect(formatRupiah(rp(-20_000))).toBe('-Rp 20.000');
    expect(formatRupiah(-10)).toBe('Rp 0');
  });

  it('writes nothing for what is not a sum, in either form', () => {
    expect(formatRupiah(Number.NaN)).toBe('');
    expect(formatRupiahCompact(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('converts sen through the one unit', () => {
    expect(MINOR_UNITS_PER_MAJOR).toBe(100);
    expect(toMajor(150_000)).toBe(1_500);
    expect(toMinor(1_500)).toBe(150_000);
  });

  it('P18.97-T1 AC-15 holds each compact unit’s size once, by its mark — what the forum’s header units read (ADR-0174 §4, §5)', () => {
    expect(RUPIAH_PER_UNIT).toEqual({ M: 1_000_000_000, jt: 1_000_000, rb: 1_000 });
    for (const [mark, size] of Object.entries(RUPIAH_PER_UNIT)) expect(formatRupiahCompact(rp(size))).toBe(`Rp 1 ${mark}`);
  });
});

/** ADR-0167 §1, AC-2: the compact form, at each threshold and edge (`metrics-and-definitions.md` §B.25). */
describe('formatRupiahCompact (P18.95-T1 AC-2)', () => {
  it.each([
    [0, 'Rp 0'],
    [999, 'Rp 999'],
    [1_000, 'Rp 1 rb'],
    [750_000, 'Rp 750 rb'],
    [999_999, 'Rp 1 jt'],
    [1_000_000, 'Rp 1 jt'],
    [500_000_000, 'Rp 500 jt'],
    [357_500_000, 'Rp 357,5 jt'],
    [712_666_667, 'Rp 712,7 jt'],
    [999_949_999, 'Rp 999,9 jt'],
    [999_950_000, 'Rp 1 M'],
    [1_000_000_000, 'Rp 1 M'],
    [1_200_000_000, 'Rp 1,2 M'],
    [2_450_000_000, 'Rp 2,5 M'],
    [1_500_000_000_000, 'Rp 1.500 M'],
  ])('writes Rp %i as %s', (rupiah, text) => {
    expect(formatRupiahCompact(rp(rupiah))).toBe(text);
  });

  it('rounds half up on the digit shown, in integers — 1.150 is never the float’s 1,1 rb', () => {
    expect(formatRupiahCompact(rp(1_150))).toBe('Rp 1,2 rb');
    expect(formatRupiahCompact(rp(1_149))).toBe('Rp 1,1 rb');
    expect(formatRupiahCompact(rp(1_050_000))).toBe('Rp 1,1 jt');
    expect(formatRupiahCompact(rp(1_049_999))).toBe('Rp 1 jt');
  });

  it('never writes a trailing ,0, nor more than one decimal', () => {
    expect(formatRupiahCompact(rp(2_000_000))).toBe('Rp 2 jt');
    expect(formatRupiahCompact(rp(2_040_000))).toBe('Rp 2 jt');
    expect(formatRupiahCompact(rp(2_345_678))).toBe('Rp 2,3 jt');
  });

  it('keeps a negative’s minus in front', () => {
    expect(formatRupiahCompact(rp(-750_000))).toBe('-Rp 750 rb');
    expect(formatRupiahCompact(rp(-1_200_000_000))).toBe('-Rp 1,2 M');
    expect(formatRupiahCompact(rp(-999))).toBe('-Rp 999');
  });

  it('`lossless` writes a threshold in full rather than round it into a different rule', () => {
    expect(formatRupiahCompact(rp(2_400_000_000), { lossless: true })).toBe('Rp 2,4 M');
    expect(formatRupiahCompact(rp(2_450_000_000), { lossless: true })).toBe('Rp 2.450.000.000');
    expect(formatRupiahCompact(rp(999_950_000), { lossless: true })).toBe('Rp 999.950.000');
    expect(formatRupiahCompact(rp(500), { lossless: true })).toBe('Rp 500');
  });
});

/**
 * ADR-0174 §4 (OD-227), P18.97-T3 AC-3: **money in Indonesian units, compact wherever it is drawn** — a table too —
 * and in full only where precision matters. Each unit's boundary, from both sides.
 */
describe('money in miliar, juta and ribu (P18.97-T3 AC-3)', () => {
  it.each([
    [999, 'Rp 999'],
    [1_000, 'Rp 1 rb'],
    [999_949, 'Rp 999,9 rb'],
    [999_950, 'Rp 1 jt'],
    [1_000_000, 'Rp 1 jt'],
    [150_000_000, 'Rp 150 jt'],
    [999_949_999, 'Rp 999,9 jt'],
    [999_950_000, 'Rp 1 M'],
    [1_000_000_000, 'Rp 1 M'],
    [5_672_500_000, 'Rp 5,7 M'],
    [5_800_000_000, 'Rp 5,8 M'],
    [999_949_999_999, 'Rp 999,9 M'],
    [1_000_000_000_000, 'Rp 1.000 M'],
    [1_500_000_000_000, 'Rp 1.500 M'],
  ])('P18.97-T3 AC-3 writes Rp %i compact as %s', (rupiah, text) => {
    expect(formatRupiahCompact(rp(rupiah))).toBe(text);
  });

  it('P18.97-T3 AC-3 has no triliun: a thousand miliar and more stays in M, grouped', () => {
    expect(formatRupiahCompact(rp(2_345_600_000_000))).toBe('Rp 2.345,6 M');
  });

  it('P18.97-T3 AC-3 writes the analytics’ Rp 5.672.500.000 as Rp 5,7 M, at most one decimal and no ,0 (UI-019)', () => {
    expect(formatRupiahCompact(rp(5_672_500_000))).toBe('Rp 5,7 M');
    expect(formatRupiahCompact(rp(6_000_000_000))).toBe('Rp 6 M');
    expect(formatRupiahCompactPair(rp(5_672_500_000), rp(6_000_000_000), 'of')).toBe('Rp 5,7 M of 6 M');
  });

  it('P18.97-T3 AC-3 keeps the full form for where precision matters — Data upload, an input’s echo, a price', () => {
    // The one full formatter those three call: the carrier's figure to the rupiah, a typed figure as typed, a price.
    expect(formatRupiah(rp(5_672_500_000))).toBe('Rp 5.672.500.000');
    expect(formatRupiah(rp(350_000))).toBe('Rp 350.000');
    expect(formatRupiah(rp(-20_000))).toBe('-Rp 20.000');
  });
});

/** ADR-0167 §1, AC-3: numbers in id-ID. */
describe('formatNumber (P18.95-T1 AC-3)', () => {
  it('groups a thousand with a dot and writes a decimal with a comma', () => {
    expect(formatNumber(1_250)).toBe('1.250');
    expect(formatNumber(1_250_000)).toBe('1.250.000');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(2.13, { decimals: 2 })).toBe('2,13');
    expect(formatNumber(2.1, { decimals: 2 })).toBe('2,10');
    expect(formatNumber(1.4, { maxDecimals: 1 })).toBe('1,4');
    expect(formatNumber(2, { maxDecimals: 1 })).toBe('2');
    expect(formatNumber(1_234.56, { maxDecimals: 1 })).toBe('1.234,6');
  });

  it('writes a figure that rounds to nothing without a sign, and nothing for what is not a number', () => {
    expect(formatNumber(-0.04, { maxDecimals: 1 })).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('');
  });

});

/**
 * ADR-0174 §1–§3 (OD-226, OD-213), P18.97-T3: **a percentage is whole**, rounded half up, with no *,0*; a ratio
 * beside its benchmark keeps its tenth; a figure stated as a rule or a record keeps the places it has. The same
 * cases are pinned in `backend/src/common/format/format.spec.ts`, which writes the API's own sentences.
 */
describe('formatPercent (P18.97-T3 AC-1, AC-2)', () => {
  it.each([
    [0, '0%'],
    [0.04, '0%'],
    [0.05, '0%'],
    [0.4, '0%'],
    [0.5, '1%'],
    [15, '15%'],
    [57.4, '57%'],
    [57.5, '58%'],
    [96.4, '96%'],
    [99.4, '99%'],
    [99.5, '100%'],
    [100, '100%'],
    [999, '999%'],
    [1_250, '1.250%'],
  ])('P18.97-T3 AC-1 writes %d%% whole, rounded half up, with no ,0: %s', (value, text) => {
    expect(formatPercent(value)).toBe(text);
  });

  it('P18.97-T3 AC-1 writes 27 of 28 as 96%, the whole percent the server served (UI-018)', () => {
    // `rateOver` rounds 96,43 once, in integers; the screen writes the 96 it was given, and never a ,0 after it.
    expect(formatPercent(96)).toBe('96%');
    expect(formatPercent(57)).toBe('57%');
  });

  it('P18.97-T3 AC-1 writes a negative change whole, half away from zero, and one that rounds to nothing unsigned', () => {
    expect(formatPercent(-12)).toBe('-12%');
    expect(formatPercent(-12.5)).toBe('-13%');
    expect(formatPercent(-12.4)).toBe('-12%');
    expect(formatPercent(-0.4)).toBe('0%');
    expect(formatPercent(-0.01, { decimals: 1 })).toBe('0,0%');
  });

  it('P18.97-T3 AC-1 writes nothing for what is not a number — a missing rate is the caller’s —', () => {
    expect(formatPercent(Number.NaN)).toBe('');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('');
  });

  it.each([
    [0, '0,0%'],
    [0.04, '0,0%'],
    [0.05, '0,1%'],
    [0.5, '0,5%'],
    [9.14, '9,1%'],
    [29.6, '29,6%'],
    [30, '30,0%'],
    [99.5, '99,5%'],
    [99.96, '100,0%'],
    [100, '100,0%'],
  ])('P18.97-T3 AC-2 keeps a ratio’s tenth where it is asked for, `{ decimals: 1 }`: %d is %s', (value, text) => {
    expect(formatPercent(value, { decimals: 1 })).toBe(text);
  });

  it('P18.97-T3 AC-2 keeps a second place only up to the most it is asked for, never fewer than the fixed ones', () => {
    expect(formatPercent(65.04, { decimals: 1, maxDecimals: 2 })).toBe('65,04%');
    expect(formatPercent(40, { decimals: 1, maxDecimals: 2 })).toBe('40,0%');
    expect(formatPercent(29.63, { decimals: 2 })).toBe('29,63%');
    expect(formatPercent(14.96, { decimals: 2 })).toBe('14,96%');
  });

  it.each([
    [30, '30%'],
    [7.25, '7,25%'],
    [87.35, '87,35%'],
    [75.55, '75,55%'],
    [15.5, '15,5%'],
    [40, '40%'],
    [0, '0%'],
  ])('P18.97-T3 AC-2 `lossless`: a rule or a record keeps the places it has, and no ,0 — %d is %s', (value, text) => {
    expect(formatPercent(value, { lossless: true })).toBe(text);
  });

  it('P18.97-T3 AC-2 `lossless` keeps at most four places, so a proportion’s binary noise is never written', () => {
    expect(PERCENT_LOSSLESS_MAX_DECIMALS).toBe(4);
    // `0.0725 × 100` is 7.249999999999999, `0.57 × 100` 56.99999999999999 and `0.07 × 100` 7.000000000000001.
    expect(formatPercent(0.0725 * 100, { lossless: true })).toBe('7,25%');
    expect(formatPercent(0.57 * 100, { lossless: true })).toBe('57%');
    expect(formatPercent(0.07 * 100, { lossless: true })).toBe('7%');
    expect(formatPercent(87.3456, { lossless: true })).toBe('87,3456%');
    expect(formatPercent(87.34567, { lossless: true })).toBe('87,3457%');
  });

  it('P18.97-T3 F-254 percentOf: an exact half rounds up in integers — 23 of 40 is 58, which Math.round makes 57', () => {
    expect(Math.round((23 / 40) * 100)).toBe(57);
    expect(percentOf(23, 40)).toBe(58);
    expect(formatPercent(percentOf(23, 40)!)).toBe('58%');
  });

  it.each([
    [27, 28, 96], [4, 28, 14], [9, 28, 32], [1, 11, 9], [2, 9, 22], [1, 8, 13], [4, 138, 3], [0, 5, 0], [5, 5, 100], [7, 5, 140],
  ])('P18.97-T3 F-254 percentOf %i of %i is %i, the server’s rateOver rule (UI-018)', (part, of, pct) => {
    expect(percentOf(part, of)).toBe(pct);
  });

  it('P18.97-T3 F-254 percentOf rounds a negative half toward +∞ as Math.round does, and is null over nobody', () => {
    expect(percentOf(-23, 40)).toBe(-57);
    expect(percentOf(3, 0)).toBeNull();
    expect(percentOf(3, -2)).toBeNull();
    expect(percentOf(Number.NaN, 4)).toBeNull();
    expect(percentOf(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('P18.97-T3 AC-2 no percentage is rounded twice: a whole one the server served is written as it came', () => {
    // A rate rounded to a tenth and then to a whole moves a tie: 50,45 → 50,5 → 51 where once it is 50. The server
    // serves a share whole, from its counts (`rateOver`), so the screen's whole rounding of it changes nothing.
    for (const whole of [0, 1, 50, 57, 96, 100]) expect(formatPercent(whole)).toBe(`${whole}%`);
    expect(formatPercent(50.45)).toBe('50%');
  });
});

/** ADR-0167 §1, AC-3: a decimal typed with a comma or a point. */
describe('parseDecimal (P18.95-T1 AC-3)', () => {
  it('reads a comma or a point as the decimal', () => {
    expect(parseDecimal('1,4')).toBe(1.4);
    expect(parseDecimal('1.4')).toBe(1.4);
    expect(parseDecimal('15')).toBe(15);
    expect(parseDecimal(' 0,30 ')).toBe(0.3);
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal('-2,5')).toBe(-2.5);
  });

  it('reads one point without a comma as a decimal — `1.250` is 1,25, the small value a rate is', () => {
    expect(parseDecimal('1.250')).toBe(1.25);
  });

  it('reads points as thousands once a comma is the decimal, or when there are two of them', () => {
    expect(parseDecimal('1.250,5')).toBe(1250.5);
    expect(parseDecimal('1.250.000')).toBe(1_250_000);
  });

  it('is NaN for what is not a number, and for an empty field', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('   ')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
    expect(parseDecimal('1,2.3')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1e3')).toBeNaN();
  });
});

/** ADR-0167 §1: the remaining shapes — a day and an office clock, an instant's month, a pair of sums. */
describe('formatDayClock, formatOfficeMonth and formatRupiahCompactPair (P18.95-T1 AC-1, AC-2)', () => {
  it('writes an office day and wall-clock time as one moment, `20 Sep 2026, 18.00`', () => {
    expect(formatDayClock('2026-09-20', '18:00')).toBe('20 Sep 2026, 18.00');
    expect(formatDayClock('2026-09-20', 'later')).toBe('20 Sep 2026');
    expect(formatDayClock('soon', '18:00')).toBe('18.00');
  });

  it('names the office’s month an instant fell in, not the browser’s', () => {
    // 18:00 on 30 September in UTC is 1 October in Jakarta.
    expect(formatOfficeMonth('2026-09-30T18:00:00Z')).toBe('Okt 2026');
    expect(formatOfficeMonth('2026-09-30T18:00:00Z', 'UTC')).toBe('Sep 2026');
    expect(formatOfficeMonth('nope')).toBe('');
  });

  it('writes two sums with one Rp between them, in the word the screen uses (UI-030)', () => {
    expect(formatRupiahCompactPair(rp(357_500_000), rp(712_666_667), 'of')).toBe('Rp 357,5 jt of 712,7 jt');
    expect(formatRupiahCompactPair(rp(620_000_000), rp(1_500_000_000), '/')).toBe('Rp 620 jt / 1,5 M');
    expect(formatRupiahCompactPair(rp(-5_000), rp(-750_000), '/')).toBe('-Rp 5 rb / -750 rb');
  });
});

/**
 * **One rule in two places, pinned to each other** (ADR-0167 §1, invariant §7): the API writes its own sentences
 * through `backend/src/common/format/format.ts`, which shares this module's forms. Read from its source, as
 * `OFFICE_TIME_ZONE` is, so the month names and the compact units cannot drift between a refusal and a screen.
 */
describe('the backend formatter writes what this one writes (P18.95-T1 AC-4)', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'common', 'format', 'format.ts'), 'utf8',
  );

  it('names the months as this module does', () => {
    const months = /const MONTHS = \[([^\]]+)\]/.exec(source)?.[1].match(/'([^']+)'/g)?.map((m) => m.slice(1, -1));
    expect(months).toEqual(Array.from({ length: 12 }, (_, i) => formatMonthName(`2026-${String(i + 1).padStart(2, '0')}`)));
  });

  it('names the weekdays as this module does', () => {
    const days = /const WEEKDAYS = \[([^\]]+)\]/.exec(source)?.[1].match(/'([^']+)'/g)?.map((d) => d.slice(1, -1));
    // 2026-10-25 is a Sunday, the first in both tables.
    expect(days).toEqual(['25', '26', '27', '28', '29', '30', '31'].map((d) => formatCalendarDayLong(`2026-10-${d}`).split(',')[0]));
  });

  it('holds the same compact units, each written as this module writes it', () => {
    const units = [...source.matchAll(/\{ value: ([\d_]+), suffix: '([^']+)' \}/g)].map((m) => ({ size: Number(m[1].replace(/_/g, '')), mark: m[2] }));
    expect(units.map((u) => u.mark)).toEqual(['M', 'jt', 'rb']);
    for (const { size, mark } of units) expect(formatRupiahCompact(rp(size))).toBe(`Rp 1 ${mark}`);
  });
});
