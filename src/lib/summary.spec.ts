import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { monthsOf, periodSearch, readSummary, summaryPeriodFrom, yearsOf } from './summary';

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
