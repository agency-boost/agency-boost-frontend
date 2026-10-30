import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { daysLeftIn, monthsOf, periodSearch, readSummary, summaryPeriodFrom, yearsOf } from './summary';

/** The Summary's period, as the address and the read carry it (P18.8-T11, ADR-0161 §4). */
describe('the Summary’s period (P18.8-T11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.8-T11 AC-2 the months run from this one back to the office’s first, across a new year', () => {
    expect(monthsOf({ firstMonth: '2025-11', thisMonth: '2026-02' })).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(monthsOf({ firstMonth: '2026-02', thisMonth: '2026-02' })).toEqual(['2026-02']);
  });

  it('P18.8-T11 AC-2 the years run from this one back to the first month’s', () => {
    expect(yearsOf({ firstMonth: '2024-07', thisMonth: '2026-02' })).toEqual(['2026', '2025', '2024']);
    expect(yearsOf({ firstMonth: '2026-01', thisMonth: '2026-10' })).toEqual(['2026']);
  });

  it.each([
    [{ month: '2026-08' }, { month: '2026-08' }],
    [{ year: '2025' }, { year: '2025' }],
    [{ month: '2026-08', year: '2025' }, { month: '2026-08' }],
    [{ month: '2026-13' }, {}],
    [{ month: '2026-13', year: '2025' }, { year: '2025' }],
    [{ year: '25' }, {}],
    [{ month: ['2026-08', '2026-07'] }, {}],
    [{}, {}],
  ])('P18.8-T11 AC-2 reads the address %j as %j: a malformed period is not sent', (query, period) => {
    expect(summaryPeriodFrom(query)).toEqual(period);
  });

  it('P18.8-T11 AC-2 writes the address, and the current month is no address at all', () => {
    expect(periodSearch({ month: '2026-08' })).toBe('?month=2026-08');
    expect(periodSearch({ year: '2025' })).toBe('?year=2025');
    expect(periodSearch({})).toBe('');
  });

  it('P18.8-T11 AC-2 reads with for, the period, both, or neither', async () => {
    const { calls } = stubFetch({ '/summary': { body: {} } });
    await readSummary();
    await readSummary(undefined, { month: '2026-08' });
    await readSummary('mem-rina');
    await readSummary('mem-rina', { year: '2025' });

    expect(calls.map((c) => new URL(c.url).search)).toEqual(['', '?month=2026-08', '?for=mem-rina', '?for=mem-rina&year=2025']);
  });
});

/** UI-054: *sisa 1 hari bulan ini* — the days left after the office's today, from the date the server sent. */
describe('the days left in the month or the year (UI-054)', () => {
  it('UI-054 the 30th of October leaves 1; the last day 0; the first day the rest of the month', () => {
    expect(daysLeftIn('2026-10-30', 'month')).toBe(1);
    expect(daysLeftIn('2026-10-31', 'month')).toBe(0);
    expect(daysLeftIn('2026-10-01', 'month')).toBe(30);
    expect(daysLeftIn('2026-09-30', 'month')).toBe(0);
  });

  it('UI-054 February, in a leap year and not', () => {
    expect(daysLeftIn('2028-02-01', 'month')).toBe(28);
    expect(daysLeftIn('2026-02-01', 'month')).toBe(27);
    expect(daysLeftIn('2026-02-28', 'month')).toBe(0);
  });

  it('UI-054 the year: 31 December leaves 0, 1 January 364, 365 in a leap year', () => {
    expect(daysLeftIn('2026-12-31', 'year')).toBe(0);
    expect(daysLeftIn('2026-01-01', 'year')).toBe(364);
    expect(daysLeftIn('2028-01-01', 'year')).toBe(365);
    expect(daysLeftIn('2026-09-14', 'year')).toBe(108);
  });

  it('UI-054 reads no clock and no zone: the same answer at any hour, in any browser zone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T23:30:00-08:00'));
    expect(daysLeftIn('2026-03-08', 'month')).toBe(23);
    vi.useRealTimers();
  });
});
