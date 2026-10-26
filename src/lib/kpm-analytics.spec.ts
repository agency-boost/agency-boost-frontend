import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { MOC_MET, MOC_NOT_MET, MOC_UNKNOWN, analyticsView, rp } from '@test/kpm-analytics-fixtures';
import {
  activeWords, agentsSub, analyticsPeriodFrom, chartBars, criterionValue, criterionVerdict,
  headName, leadsWords, manpowerSub, mocButtonName, moneyWords, orgTreeHref, OWN_COPY, periodWords, PROTOTYPE_COPY,
  rateWords, readKpmAnalytics, shortMonth, unitDashboardHref,
} from './kpm-analytics';

describe('KPM analytics’ client (P18-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18-T2 AC-3 reads the period from the address, This month when it names none or one the read does not know', () => {
    expect(analyticsPeriodFrom('this_month')).toBe('this_month');
    expect(analyticsPeriodFrom('previous_month')).toBe('previous_month');
    expect(analyticsPeriodFrom(['previous_month', 'this_month'])).toBe('previous_month');
    expect(analyticsPeriodFrom(undefined)).toBe('this_month');
    expect(analyticsPeriodFrom(null)).toBe('this_month');
    // The prototype's own option values, and anything else: the read would refuse them with a 400.
    expect(analyticsPeriodFrom('previous')).toBe('this_month');
    expect(analyticsPeriodFrom('last_month')).toBe('this_month');
  });

  it('P18-T2 AC-3 asks GET /kpm/analytics for one of the two periods it offers, and nothing else', async () => {
    const { calls } = stubFetch({ '/kpm/analytics': { body: analyticsView() } });
    await readKpmAnalytics('previous_month');
    await readKpmAnalytics();
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url])).toEqual([
      ['GET', 'http://api.test/api/v1/kpm/analytics?period=previous_month'],
      ['GET', 'http://api.test/api/v1/kpm/analytics?period=this_month'],
    ]);
  });

  it('P18-T2 AC-3 writes an APE cell as the prototype does: the figure, "of {target} target" and the pill', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70)).toEqual({
      actual: 'Rp 620.000.000',
      uploaded: true,
      of: 'of Rp 1.500.000.000 target',
      pill: { text: '41,0%', tone: 'alert' },
    });
  });

  it('P18-T2 AC-3 splits the pill where the server says (thresholds.statusSplitPct, the prototype’s 70%), at or above it success', () => {
    const tone = (pct: number, split = 70) => moneyWords({ achievedMinor: 1, targetMinor: 1, pct }, split).pill?.tone;
    expect(tone(69)).toBe('alert');
    expect(tone(70)).toBe('success');
    expect(tone(212)).toBe('success');
    // The screen keeps no copy of its own: another split moves the colour with it.
    expect(tone(70, 75)).toBe('alert');
  });

  it('P18-T2 AC-3 never writes 0 for want of data: Not uploaded yet, No goal set, and no pill', () => {
    expect(moneyWords({ achievedMinor: null, targetMinor: rp(75), pct: null }, 70)).toEqual({
      actual: 'Not uploaded yet', uploaded: false, of: 'of Rp 75.000.000 target', pill: null,
    });
    expect(moneyWords({ achievedMinor: rp(10), targetMinor: null, pct: null }, 70).of).toBe('No goal set');
    expect(rateWords({ count: 0, of: 0, pct: null })).toEqual({ main: '0 / 0', pct: '—' });
    expect(activeWords(null, 31)).toEqual({ main: 'Not uploaded yet', pct: null });
    expect(activeWords(0, 0)).toEqual({ main: '0 / 0', pct: '—' });
  });

  it('P18-T2 AC-3 writes Coached, Active, Total leads and Manpower as the prototype does (:3240, :3341-3343)', () => {
    expect(rateWords({ count: 6, of: 31, pct: 19 })).toEqual({ main: '6 / 31', pct: '19,0%' });
    expect(activeWords(21, 31)).toEqual({ main: '21 / 31', pct: '68,0%' });
    expect(leadsWords({ sales: 15, salesPotential: 9, recruit: 8, recruitPotential: 5 })).toEqual({
      total: 23,
      sub: '15 sales (9 potential) · 8 recruit (5 potential)',
    });
    expect(manpowerSub({ aab: 2, agents: 29, total: 31 })).toBe('2 AAB · 29 Agents');
    expect(agentsSub({ aab: 0, agents: 8, total: 9 })).toBe('8 Agents');
  });

  it('P18-T2 AC-2 counts the ABs the prototype typed (contradiction 11)', () => {
    expect(PROTOTYPE_COPY.unitComparisonSub(8)).toBe('All 8 ABs, this year — peer benchmark, always shown at group level');
    expect(PROTOTYPE_COPY.total(8)).toBe('Total — all 8 ABs');
    expect(PROTOTYPE_COPY.total(1)).toBe('Total — all 1 AB');
    expect(PROTOTYPE_COPY.headActive('this_month')).toBe('Active this month');
    expect(PROTOTYPE_COPY.headActive('previous_month')).toBe('Active last month');
  });

  it('D-units marks the reader’s own agency (you), as :3108 does', () => {
    expect(headName({ membershipId: 'm', name: 'Wilson Tanoto', isReader: true, leads: true })).toBe('Wilson Tanoto (you)');
    expect(headName({ membershipId: 'm', name: 'Hendra Wibowo', isReader: false, leads: true })).toBe('Hendra Wibowo');
  });

  it('P18-T2 AC-7 drills a leader to their Unit Dashboard, and the reader to their own (D-drill)', () => {
    expect(unitDashboardHref({ membershipId: 'mem-hendra', isReader: false })).toBe('/unit/dashboard/mem-hendra');
    // The page of one's own id answers "not a unit you can open" (P15-T4 AC-2).
    expect(unitDashboardHref({ membershipId: 'mem-owner', isReader: true })).toBe('/unit/dashboard');
  });

  it('P18-T2 AC-7 drills an org-tree card by whether its person leads anybody', () => {
    expect(orgTreeHref({ membershipId: 'mem-ab', directCount: 3, isSelf: false })).toBe('/unit/dashboard/mem-ab');
    expect(orgTreeHref({ membershipId: 'mem-owner', directCount: 2, isSelf: true })).toBe('/unit/dashboard');
    expect(orgTreeHref({ membershipId: 'mem-agent', directCount: 0, isSelf: false })).toBe('/people/members/mem-agent');
    // Somebody who leads nobody keeps the person page, the reader included, as built (parity I-34).
    expect(orgTreeHref({ membershipId: 'mem-admin', directCount: 0, isSelf: true })).toBe('/people/members/mem-admin');
  });

  it('P18-T2 AC-4 names the MOC button for its leader, and an unknown one with the sentence saying why', () => {
    expect(mocButtonName(MOC_MET, 'Hendra Wibowo')).toBe('MOC requirements met for Hendra Wibowo');
    expect(mocButtonName(MOC_NOT_MET, 'Budi Santoso')).toBe('MOC requirements not yet met for Budi Santoso');
    expect(mocButtonName(MOC_UNKNOWN, 'Wilson Tanoto'))
      .toBe('MOC for Wilson Tanoto — Not uploaded yet: Rolling Persistency — DU/DG.');
    expect(mocButtonName({ ...MOC_UNKNOWN, missing: null }, 'Wilson Tanoto')).toBe('MOC for Wilson Tanoto — Not uploaded yet');
  });

  it('P18-T2 AC-4 writes each criterion in its own unit, and never Gap for a figure nobody has', () => {
    expect(criterionValue('NET_APE', rp(600))).toBe('Rp 600 jt');
    // Compact only where that loses nothing: a figure it would round is written in full (ADR-0167 §1).
    expect(criterionValue('NET_APE', rp(599.96))).toBe('Rp 599.960.000');
    expect(criterionValue('MOC_PERSISTENCY', 75)).toBe('75,0%');
    expect(criterionValue('MOC_PERSISTENCY', 75.55)).toBe('75,55%');
    expect(criterionValue('MONTHLY2_AA_DU', 4)).toBe('4');
    expect(criterionValue('DIRECT_AB_COUNT', 0)).toBe('0');
    expect(criterionValue('MOC_PERSISTENCY', null)).toBe('—');
    expect(criterionVerdict(true)).toBe('Met');
    expect(criterionVerdict(false)).toBe('Gap');
    expect(criterionVerdict(null)).toBe('Not uploaded yet');
  });

  it('P18-T2 AC-4 says the period a criterion was read over as a sentence would', () => {
    expect(periodWords('2026-09')).toBe('Sep 2026');
    expect(periodWords('2026-08..2026-09')).toBe('Agu – Sep 2026');
    expect(periodWords('2025-12/2026-01')).toBe('Des 2025 – Jan 2026');
    expect(periodWords('2026-09..2026-09')).toBe('Sep 2026');
    expect(periodWords('Year to date')).toBe('Year to date');
  });

  it('P18-T2 AC-6 draws a month with no file as a gap, never as a zero bar', () => {
    const bars = chartBars([
      { month: '2026-07', apeMinor: rp(400) },
      { month: '2026-08', apeMinor: null },
      { month: '2026-09', apeMinor: rp(800) },
      { month: '2026-10', apeMinor: 0 },
    ]);
    expect(bars.map((b) => b.height)).toEqual([50, null, 100, 0]);
    expect(bars.map((b) => b.value)).toEqual(['Rp 400 jt', 'Not uploaded yet', 'Rp 800 jt', 'Rp 0']);
    expect(chartBars([{ month: '2026-08', apeMinor: null }])[0].height).toBeNull();
    expect(shortMonth('2026-03')).toBe('Mar');
    expect(shortMonth('2025-12')).toBe('Des');
    expect(shortMonth('2026-10')).toBe('Okt');
  });

  it('D-copy: the strings this module writes itself use none of OD-39’s six words and name no phase', () => {
    const own = Object.values(OWN_COPY).map((v) => (typeof v === 'function' ? (v as (...a: string[]) => string)('{n}', '{m}') : v));
    for (const text of own) {
      expect(text).not.toMatch(/\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned|phase/i);
    }
  });
});
