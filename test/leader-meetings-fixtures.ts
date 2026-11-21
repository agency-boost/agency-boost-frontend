import type { Scorecard, ScorecardCell } from '@/lib/leader-meeting-tabs';

/**
 * **A scorecard as the server computed it in the reference slide's shape** (P18.9-T1): *Full Year*, both *YTD*s and
 * *This Month, Last Year* held, this year's *YTD* leaving August out, *This Month* not yet uploaded, FLC *pending data*
 * (OD-26), and *Avg. Case Size* over no policies in *YTD* — what `lib/leader-meeting-tabs.ts`' formatting is pinned
 * against, which Advanced analytics' *MAPA driver* reads. The forum's own meeting fixtures are
 * `app/leader-meetings/forum-fixtures.ts` since P19.22 (ADR-0276).
 */

/** Rupiah to minor units (sen). */
export const sen = (rupiah: number) => Math.round(rupiah * 100);
/** *Miliar* of rupiah, as *APE (Rp M)* reads, to minor units. */
export const billions = (b: number) => sen(b * 1e9);
/** *Juta* of rupiah, as *Avg. Case Size (Rp Jt)* reads, to minor units. */
export const millions = (m: number) => sen(m * 1e6);

const fig = (value: number, leavesOut: string[] = []): ScorecardCell => ({ kind: 'figure', value, leavesOut });
const PENDING: ScorecardCell = { kind: 'pending' };
const BLOCKED: ScorecardCell = { kind: 'blocked' };
const NONE: ScorecardCell = { kind: 'none' };

export function makeScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  const fy = (value: number, leavesOut: string[] = []) => fig(value, leavesOut);
  const target = (rate: number | null, value: number | null, version: number, typed: string | null = null) =>
    ({ rate, value, typed, version });
  return {
    periods: {
      fy: { from: '2025-01', to: '2025-12' },
      ytdLastYear: { from: '2025-01', to: '2025-09' },
      ytd: { from: '2026-01', to: '2026-09' },
      thisMonthLastYear: { from: '2025-09', to: '2025-09' },
      lastMonth: { from: '2026-08', to: '2026-08' },
      thisMonth: { from: '2026-09', to: '2026-09' },
    },
    chips: { manpower: 187, agents: 155, units: 32, ab: 8, aab: 24 },
    rows: [
      {
        key: 'ape',
        unit: 'idr_minor',
        cells: {
          fy: fy(billions(12.1)),
          ytdLastYear: fig(billions(7.9)),
          ytd: fig(billions(8.4), ['2026-08']),
          thisMonthLastYear: fig(billions(0.75)),
          lastMonth: PENDING,
          thisMonth: PENDING,
        },
        ytdChange: { kind: 'figure', value: 6, unit: 'percent' },
        monthlyTarget: target(null, null, 2),
      },
      {
        key: 'manpower',
        unit: 'count',
        cells: { fy: fig(201), ytdLastYear: fig(190), ytd: fig(187), thisMonthLastYear: fig(196), lastMonth: fig(181), thisMonth: fig(187) },
        ytdChange: { kind: 'figure', value: -2, unit: 'percent' },
        monthlyTarget: target(null, null, 0),
      },
      {
        key: 'flc',
        unit: 'count',
        cells: { fy: PENDING, ytdLastYear: PENDING, ytd: PENDING, thisMonthLastYear: PENDING, lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'none' },
        monthlyTarget: target(1, 32, 1),
      },
      {
        key: 'producing_agents',
        unit: 'count',
        cells: { fy: fig(96), ytdLastYear: fig(80), ytd: fig(71, ['2026-08']), thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'figure', value: -11, unit: 'percent' },
        monthlyTarget: null,
      },
      {
        key: 'new_agent_3m',
        unit: 'percentage',
        cells: { fy: fig(30), ytdLastYear: fig(25), ytd: PENDING, thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'none' },
        monthlyTarget: null,
      },
      {
        key: 'avg_monthly_aa',
        unit: 'count',
        cells: { fy: fig(14.4), ytdLastYear: fig(12), ytd: fig(11), thisMonthLastYear: fig(10), lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'figure', value: -8, unit: 'percent' },
        monthlyTarget: target(3, 96, 1),
      },
      {
        key: 'case_submission',
        unit: 'count',
        cells: { fy: fig(420), ytdLastYear: fig(300), ytd: fig(198, ['2026-08']), thisMonthLastYear: fig(27), lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'figure', value: -34, unit: 'percent' },
        monthlyTarget: target(null, null, 1),
      },
      {
        key: 'cases_per_producing_agent',
        unit: 'ratio',
        cells: { fy: fig(420 / 96), ytdLastYear: fig(3.75), ytd: fig(198 / 71, ['2026-08']), thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'figure', value: -26, unit: 'percent' },
        monthlyTarget: null,
      },
      {
        key: 'average_case_size',
        unit: 'idr_minor',
        cells: { fy: fig(millions(19.8)), ytdLastYear: fig(millions(17.6)), ytd: NONE, thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'none' },
        monthlyTarget: null,
      },
    ],
    asOf: { kind: 'date', date: '2026-09-05' },
    partialPeriods: [{ column: 'ytd', leavesOut: ['2026-08'] }],
    frozenAt: null,
    definitions: 'data_sources',
    ...overrides,
  };
}

/**
 * **A scorecard kept before the reference slide's table** (P18.9-T1 AC-19), as the server reads it tolerantly: *YTD
 * {Y−1}* and *Cases/producing agents* *unrecorded*, *AS OF* unrecorded, *# of units* the five it was kept with.
 */
export function makeScorecardKeptBefore(): Scorecard {
  const now = makeScorecard();
  const UNRECORDED: ScorecardCell = { kind: 'unrecorded' };
  return {
    ...now,
    chips: { manpower: 26, agents: 17, units: 5, ab: 5, aab: 4 },
    rows: now.rows.map((row) => ({
      ...row,
      cells: row.key === 'cases_per_producing_agent'
        ? { ...row.cells, fy: UNRECORDED, ytdLastYear: UNRECORDED, ytd: UNRECORDED }
        : { ...row.cells, ytdLastYear: UNRECORDED },
      ytdChange: { kind: 'none' },
      monthlyTarget: row.monthlyTarget && row.monthlyTarget.rate !== null
        ? { ...row.monthlyTarget, value: row.monthlyTarget.rate * 5 }
        : row.monthlyTarget,
    })),
    asOf: { kind: 'unrecorded' },
    frozenAt: '2026-09-13T02:00:00.000Z',
    // Kept before the data sources of 3 November: it stores none, and is served as the reference slide's (P19.3-T1).
    definitions: 'reference_slide',
  };
}
