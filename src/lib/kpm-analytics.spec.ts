import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { MOC_MET, MOC_NOT_MET, MOC_UNKNOWN, analyticsView, rp } from '@test/kpm-analytics-fixtures';
import {
  activeWords, agentsSub, analyticsPeriodFrom, chartBars, CLUB_TERM_KEYS, clubTermFirsts, criterionValue, criterionVerdict,
  headName, leadsWords, manpowerSub, mocButtonName, mocTermName, mocTip, moneyWords, orgTreeHref, OWN_COPY, periodWords,
  PROTOTYPE_COPY, rateWords, readKpmAnalytics, shortMonth, unitDashboardHref,
} from './kpm-analytics';
import { TERMS } from './terms';

/** A row's *Producing* figures as the server serves them: the count, its share, and the manpower beside it. */
const producing = (activeAgents: number | null, activePct: number | null, total: number) =>
  ({ activeAgents, activePct, manpower: { aab: 0, agents: total, total } });

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

  it('P18-T2 AC-3, P18.97-T3 AC-1, AC-3 writes an APE cell: the figure and "of {target} target" compact, the pill whole', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70)).toEqual({
      actual: 'Rp 620 jt',
      uploaded: true,
      of: 'of Rp 1,5 M target',
      pill: { text: '41%', tone: 'alert' },
    });
  });

  it('P18.97-T3 AC-3 writes the table’s Rp 5.672.500.000 as Rp 5,7 M (UI-019): compact in a table too', () => {
    expect(moneyWords({ achievedMinor: rp(5_672.5), targetMinor: rp(6_000), pct: 95 }, 70)).toMatchObject({
      actual: 'Rp 5,7 M', of: 'of Rp 6 M target', pill: { text: '95%', tone: 'success' },
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
      actual: 'Not uploaded yet', uploaded: false, of: 'of Rp 75 jt target', pill: null,
    });
    expect(moneyWords({ achievedMinor: rp(10), targetMinor: null, pct: null }, 70).of).toBe('No goal set');
    expect(rateWords({ count: 0, of: 0, pct: null })).toEqual({ main: '0 / 0', pct: '—' });
    expect(activeWords(producing(null, null, 31))).toEqual({ main: 'Not uploaded yet', pct: null });
    expect(activeWords(producing(0, null, 0))).toEqual({ main: '0 / 0', pct: '—' });
  });

  it('P18-T2 AC-3 writes Coached, Active, Total leads and Manpower as the prototype does (:3240, :3341-3343)', () => {
    expect(rateWords({ count: 6, of: 31, pct: 19 })).toEqual({ main: '6 / 31', pct: '19%' });
    expect(activeWords(producing(21, 68, 31))).toEqual({ main: '21 / 31', pct: '68%' });
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
  });

  it('P18.97-T3 AC-9 names the column for what it counts — Producing this month, Producing last month (UI-021)', () => {
    expect(PROTOTYPE_COPY.headActive('this_month')).toBe('Producing this month');
    expect(PROTOTYPE_COPY.headActive('previous_month')).toBe('Producing last month');
    // Never the Overview's logging card's word, nor the prototype's *Active* (ADR-0127, ADR-0176 §3).
    for (const period of ['this_month', 'previous_month'] as const) expect(PROTOTYPE_COPY.headActive(period)).not.toMatch(/Active|logged/);
  });

  it('P18.97-T3 AC-10 writes the server’s share and divides nothing: 23 of 40 served as 58 reads 58%, never 57%', () => {
    expect(activeWords(producing(23, 58, 40))).toEqual({ main: '23 / 40', pct: '58%' });
    // Whatever the screen could divide, it writes what it was served (invariant §7).
    expect(activeWords(producing(23, 41, 40)).pct).toBe('41%');
    expect(activeWords(producing(5, null, 0)).pct).toBe('—');
  });

  it('P18.97-T3 AC-4 the total’s APE says what it counts: Current members only', () => {
    expect(OWN_COPY.currentMembersOnly).toBe('Current members only');
    // Its ⓘ still names the sum it leaves out.
    expect(OWN_COPY.leaversLeftOut('Rp 98 jt')).toBe('Leaves out Rp 98 jt produced this year by members who have since left; the Overview’s year counts it.');
  });

  it('P18.97-T3 AC-8 the MOC ⓘ says what MOC is — the glossary’s line — above the company’s rules', () => {
    expect(mocTermName).toBe('What is MOC?');
    expect(mocTip('AAB: Net APE ≥ Rp 200 jt.')).toBe(`${TERMS.MOC.definition}\n\nAAB: Net APE ≥ Rp 200 jt.`);
    // A company with no MOC rule still has the term explained.
    expect(mocTip('')).toBe(TERMS.MOC.definition);
  });

  it('P18.97-T3 AC-8 each club’s ⓘ goes on the first badge that shows it, read from the badge’s own words', () => {
    const row = (id: string, club: { code: string; label: string } | null) =>
      ({ head: { membershipId: id, name: id, isReader: false, leads: true }, club });
    const firsts = clubTermFirsts([
      row('a', null),
      row('b', { code: 'STAR_CLUB', label: 'Star Club' }),
      row('c', { code: 'STAR_CLUB', label: 'Star Club' }),
      row('d', { code: 'CHAIRMANS_CLUB', label: "Chairman's Club" }),
      row('e', { code: 'GOLD', label: 'Gold Circle' }),
      row('f', { code: 'ELITE_CLUB', label: 'Elite Club' }),
    ]);
    expect([...firsts]).toEqual([['b', 'STAR_CLUB'], ['d', 'CHAIRMANS_CLUB'], ['f', 'ELITE_CLUB']]);
    expect(CLUB_TERM_KEYS).toEqual(['STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB']);
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
    // A persistency keeps the places it has and no ,0 (P18.97-T3 AC-2): the rule's 75%, the carrier's 74,96%.
    expect(criterionValue('MOC_PERSISTENCY', 75)).toBe('75%');
    expect(criterionValue('MOC_PERSISTENCY', 75.55)).toBe('75,55%');
    expect(criterionValue('MOC_PERSISTENCY', 74.96)).toBe('74,96%');
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

/**
 * **OD-235, clarified 2026-10-29**: *Producing*'s count is over the same members as its percent — the share's base the
 * server serves beside it (`activeOf`): a past month's members, a leaver since included — so *4 / 5 · 80%*, never
 * *4 / 3 · 80%*. *Manpower* beside it stays today's.
 */
describe('OD-235 the Producing cell over the share’s own base', () => {
  const based = (activeAgents: number | null, activePct: number | null, activeOf: number, total: number) =>
    ({ activeAgents, activePct, activeOf, manpower: { aab: 0, agents: total, total } });

  it('OD-235 writes a past month’s count over the base it was served, never over today’s manpower', () => {
    expect(activeWords(based(4, 80, 5, 3))).toEqual({ main: '4 / 5', pct: '80%' });
    expect(activeWords(based(4, 80, 5, 3)).main).not.toBe('4 / 3');
  });

  it('OD-235 writes this month’s over today’s manpower, which is its base', () => {
    expect(activeWords(based(21, 68, 31, 31))).toEqual({ main: '21 / 31', pct: '68%' });
  });

  it('OD-235 keeps Not uploaded yet and the dash over nobody as they were', () => {
    expect(activeWords(based(null, null, 5, 3))).toEqual({ main: 'Not uploaded yet', pct: null });
    expect(activeWords(based(0, null, 0, 0))).toEqual({ main: '0 / 0', pct: '—' });
  });
});

/**
 * **P18.98-T4 the module's words in Indonesian** (`i18n/messages/kpm-analytics.ts`): the functions outside React write
 * the reader's words, and their figures in the figures' language — each passed apart, as the screen passes them.
 */
describe('P18.98-T4 KPM analytics’ words, language by language', () => {
  it('P18.98-T4 writes an APE cell in Indonesian words and figures: dari target Rp 1,5 M, Belum diunggah, Goal belum diatur', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'id', 'id')).toEqual({
      actual: 'Rp 620 jt', uploaded: true, of: 'dari target Rp 1,5 M', pill: { text: '41%', tone: 'alert' },
    });
    expect(moneyWords({ achievedMinor: null, targetMinor: null, pct: null }, 70, 'id', 'id'))
      .toMatchObject({ actual: 'Belum diunggah', of: 'Goal belum diatur' });
  });

  it('P18.98-T4 keeps words and figures apart: English words with Indonesian figures, as an unchosen reader reads them', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'en', 'id').of).toBe('of Rp 1,5 M target');
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'en', 'en').of).toBe('of IDR 1.5B target');
  });

  it('P18.98-T4 writes the lines and names in Indonesian, the roles kept and a kept noun in its English plural', () => {
    expect(leadsWords({ sales: 15, salesPotential: 9, recruit: 8, recruitPotential: 5 }, 'id').sub)
      .toBe('15 penjualan (9 potensial) · 8 rekrut (5 potensial)');
    expect(manpowerSub({ aab: 2, agents: 29, total: 31 }, 'id')).toBe('2 AAB · 29 Agents');
    expect(agentsSub({ aab: 0, agents: 1, total: 1 }, 'id')).toBe('1 Agent');
    expect(headName({ membershipId: 'm', name: 'Wilson Tanoto', isReader: true, leads: true }, 'id')).toBe('Wilson Tanoto (Anda)');
    expect(activeWords(producing(null, null, 31), 'id')).toEqual({ main: 'Belum diunggah', pct: null });
  });

  it('P18.98-T4 names MOC’s button and its verdicts in Indonesian, the server’s sentence as it came', () => {
    expect(mocButtonName(MOC_MET, 'Hendra Wibowo', 'id')).toBe('Syarat MOC terpenuhi untuk Hendra Wibowo');
    expect(mocButtonName(MOC_NOT_MET, 'Budi Santoso', 'id')).toBe('Syarat MOC belum terpenuhi untuk Budi Santoso');
    expect(mocButtonName(MOC_UNKNOWN, 'Wilson Tanoto', 'id')).toBe('MOC untuk Wilson Tanoto — Not uploaded yet: Rolling Persistency — DU/DG.');
    expect([criterionVerdict(true, 'id'), criterionVerdict(false, 'id'), criterionVerdict(null, 'id')])
      .toEqual(['Terpenuhi', 'Gap', 'Belum diunggah']);
  });

  it('P18.98-T4 writes a criterion, a period and a bar in the figures’ language alone', () => {
    expect(criterionValue('NET_APE', rp(600), 'en')).toBe('IDR 600M');
    expect(criterionValue('MOC_PERSISTENCY', 74.96, 'en')).toBe('74.96%');
    expect(periodWords('2026-08..2026-09', 'en')).toBe('Aug – Sep 2026');
    expect(shortMonth('2026-10', 'en')).toBe('Oct');
    expect(chartBars([{ month: '2026-08', apeMinor: null }, { month: '2026-09', apeMinor: rp(800) }], 'id', 'en')
      .map((b) => b.value)).toEqual(['Belum diunggah', 'IDR 800M']);
  });
});
