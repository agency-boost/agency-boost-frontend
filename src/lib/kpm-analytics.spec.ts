import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { DEWI, HENDRA, MOC_MET, MOC_NOT_MET, MOC_UNKNOWN, analyticsView, leader, leaders, rp } from '@test/kpm-analytics-fixtures';
import {
  activeWords, analyticsGroupFrom, analyticsPeriodFrom, analyticsQuery, chartBars, CLUB_TERM_KEYS, clubTermFirsts,
  criterionPair, criterionValue, criterionVerdict, firstName, groupSplit, groupTreeHref, headName, leaderManpower, leadersIn,
  leadsWords, manpowerSplit, memberPageHref, mocButtonName, mocTermName, mocTip, moneyWords, orgTreeHref, OWN_COPY,
  periodWords, PROTOTYPE_COPY, rateWords, readKpmAnalytics, shortMonth, unitDashboardHref,
} from './kpm-analytics';
import { TERMS } from './terms';

/** A row's *Producing* figures as the server serves them: the count, its share, and the manpower beside it. */
const producing = (activeAgents: number | null, activePct: number | null, total: number) =>
  ({ activeAgents, activePct, manpower: { ab: 0, aab: 0, agents: total, total } });

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

  it('P18-T2 AC-3, P18.9-T3 AC-1, AC-3 writes an APE cell: the figure and "of {target} target" compact, the pill whole', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70)).toEqual({
      actual: 'Rp 620 Jt',
      uploaded: true,
      of: 'of Rp 1,5 M target',
      pill: { text: '41%', tone: 'alert' },
    });
  });

  it('P18.9-T3 AC-3 writes the table’s Rp 5.672.500.000 as Rp 5,7 M (UI-019): compact in a table too', () => {
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
      actual: 'Not uploaded yet', uploaded: false, of: 'of Rp 75 Jt target', pill: null,
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
  });

  it('P18-T2 AC-2 counts the ABs the prototype typed (contradiction 11)', () => {
    expect(PROTOTYPE_COPY.unitComparisonSub(8)).toBe('All 8 ABs, this year — peer benchmark, always shown at group level');
    expect(PROTOTYPE_COPY.total(8)).toBe('Total — all 8 ABs');
    expect(PROTOTYPE_COPY.total(1)).toBe('Total — all 1 AB');
  });

  it('P19.3-T3 (T1 AC-9, ADR-0200 §1) names the columns as the mockups do: Active this month, Active last month, APE YTD', () => {
    expect(PROTOTYPE_COPY.headActive('this_month')).toBe('Active this month');
    expect(PROTOTYPE_COPY.headActive('previous_month')).toBe('Active last month');
    // *Active* is production in the upload (D1), never a logging count, and the year to date is never *Annual*.
    expect(PROTOTYPE_COPY.headApeAnnual).toBe('APE YTD');
    expect(Object.values(PROTOTYPE_COPY).filter((v) => typeof v === 'string').join(' ')).not.toMatch(/Annual|Producing|Net APE/);
  });

  it('P18.9-T3 AC-10 writes the server’s share and divides nothing: 23 of 40 served as 58 reads 58%, never 57%', () => {
    expect(activeWords(producing(23, 58, 40))).toEqual({ main: '23 / 40', pct: '58%' });
    // Whatever the screen could divide, it writes what it was served (invariant §7).
    expect(activeWords(producing(23, 41, 40)).pct).toBe('41%');
    expect(activeWords(producing(5, null, 0)).pct).toBe('—');
  });

  it('P19.3-T3 AC-5 the rows say once what they count — Current members — and nothing names a sum the total leaves out', () => {
    expect(OWN_COPY.currentMembersOnly).toBe('Current members');
    expect(Object.keys(OWN_COPY)).not.toContain('leaversLeftOut');
  });

  it('P18.9-T3 AC-8 the MOC ⓘ says what MOC is — the glossary’s line — above the company’s rules', () => {
    expect(mocTermName).toBe('What is MOC?');
    expect(mocTip('AAB: Net APE ≥ Rp 200 Jt.')).toBe(`${TERMS.MOC.definition}\n\nAAB: Net APE ≥ Rp 200 Jt.`);
    // A company with no MOC rule still has the term explained.
    expect(mocTip('')).toBe(TERMS.MOC.definition);
  });

  it('P18.9-T3 AC-8 each club’s ⓘ goes on the first badge that shows it, read from the badge’s own words', () => {
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
    expect(criterionValue('MOC_APE', rp(600))).toBe('Rp 600 Jt');
    // P19.3-T1 AC-5: a stored `NET_APE` reads as rupiah all the same; P19.3-T1 AC-14, *Monthly2 AA* is an average.
    expect(criterionValue('NET_APE', rp(600))).toBe('Rp 600 Jt');
    expect(criterionValue('MONTHLY2_AA_DU', 7 / 3)).toBe('2,33');
    // A persistency keeps the places it has and no ,0 (P18.9-T3 AC-2): the rule's 75%, the carrier's 74,96%.
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
    expect(bars.map((b) => b.value)).toEqual(['Rp 400 Jt', 'Not uploaded yet', 'Rp 800 Jt', 'Rp 0']);
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
    ({ activeAgents, activePct, activeOf, manpower: { ab: 0, aab: 0, agents: total, total } });

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
 * **P18.10-T4 the module's words in Indonesian** (`i18n/messages/kpm-analytics.ts`): the functions outside React write
 * the reader's words, and their figures in the figures' language — each passed apart, as the screen passes them.
 */
describe('P18.10-T4 KPM analytics’ words, language by language', () => {
  it('P18.10-T4 writes an APE cell in Indonesian words and figures: dari target Rp 1,5 M, Belum diunggah, Goal belum diatur', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'id', 'id')).toEqual({
      actual: 'Rp 620 Jt', uploaded: true, of: 'dari target Rp 1,5 M', pill: { text: '41%', tone: 'alert' },
    });
    expect(moneyWords({ achievedMinor: null, targetMinor: null, pct: null }, 70, 'id', 'id'))
      .toMatchObject({ actual: 'Belum diunggah', of: 'Goal belum diatur' });
  });

  it('P18.10-T4 keeps words and figures apart: English words with Indonesian figures, as an unchosen reader reads them', () => {
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'en', 'id').of).toBe('of Rp 1,5 M target');
    expect(moneyWords({ achievedMinor: rp(620), targetMinor: rp(1500), pct: 41 }, 70, 'en', 'en').of).toBe('of IDR 1.5B target');
  });

  it('P18.10-T4 writes the lines and names in Indonesian, the roles kept and a kept noun in its English plural', () => {
    expect(leadsWords({ sales: 15, salesPotential: 9, recruit: 8, recruitPotential: 5 }, 'id').sub)
      .toBe('15 penjualan (9 potensial) · 8 rekrut (5 potensial)');
    expect(manpowerSplit({ ab: 0, aab: 2, agents: 29 }, 'id')).toBe('2 AAB · 29 Agents');
    expect(manpowerSplit({ ab: 0, aab: 0, agents: 1 }, 'id')).toBe('0 AAB · 1 Agent');
    expect(leaderManpower({ ab: 5, aab: 4, agents: 19, total: 28 }, 'id')).toBe('9 leader · 19 agent');
    expect(headName({ membershipId: 'm', name: 'Wilson Tanoto', isReader: true, leads: true }, 'id')).toBe('Wilson Tanoto (Anda)');
    expect(activeWords(producing(null, null, 31), 'id')).toEqual({ main: 'Belum diunggah', pct: null });
  });

  it('P18.10-T4 names MOC’s button and its verdicts in Indonesian, the server’s sentence as it came', () => {
    expect(mocButtonName(MOC_MET, 'Hendra Wibowo', 'id')).toBe('Syarat MOC terpenuhi untuk Hendra Wibowo');
    expect(mocButtonName(MOC_NOT_MET, 'Budi Santoso', 'id')).toBe('Syarat MOC belum terpenuhi untuk Budi Santoso');
    expect(mocButtonName(MOC_UNKNOWN, 'Wilson Tanoto', 'id')).toBe('MOC untuk Wilson Tanoto — Not uploaded yet: Rolling Persistency — DU/DG.');
    expect([criterionVerdict(true, 'id'), criterionVerdict(false, 'id'), criterionVerdict(null, 'id')])
      .toEqual(['Terpenuhi', 'Gap', 'Belum diunggah']);
  });

  it('P18.10-T4 writes a criterion, a period and a bar in the figures’ language alone', () => {
    expect(criterionValue('MOC_APE', rp(600), 'en')).toBe('IDR 600M');
    expect(criterionValue('MOC_PERSISTENCY', 74.96, 'en')).toBe('74.96%');
    expect(periodWords('2026-08..2026-09', 'en')).toBe('Aug – Sep 2026');
    expect(shortMonth('2026-10', 'en')).toBe('Oct');
    expect(chartBars([{ month: '2026-08', apeMinor: null }, { month: '2026-09', apeMinor: rp(800) }], 'id', 'en')
      .map((b) => b.value)).toEqual(['Belum diunggah', 'IDR 800M']);
  });
});

/**
 * **P19.3-T3 the Leader list's words and drills** (UI-152, UI-094, UI-095, UI-096; `kpm-leaders` mockups): the reads
 * carry the period and the group; one split in one format; the drills in the same tab.
 */
describe('P19.3-T3 KPM Analytics — every leader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.3-T3 AC-15 reads the group from the address, and asks for it beside the period', async () => {
    expect(analyticsGroupFrom('grp-core')).toBe('grp-core');
    expect(analyticsGroupFrom(['grp-core', 'x'])).toBe('grp-core');
    expect(analyticsGroupFrom(undefined)).toBeNull();
    expect(analyticsGroupFrom('')).toBeNull();
    expect(analyticsQuery('this_month', null)).toBe('');
    expect(analyticsQuery('previous_month', 'grp-core')).toBe('?period=previous_month&group=grp-core');
    const { calls } = stubFetch({ '/kpm/analytics': { body: analyticsView() } });
    await readKpmAnalytics('this_month', 'grp core');
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/kpm/analytics?period=this_month&group=grp%20core']);
  });

  it('P19.3-T3 AC-10 writes one split in one format, every AAB counted, the leader taken off once (UI-094)', () => {
    expect(manpowerSplit({ ab: 5, aab: 4, agents: 19 })).toBe('5 AB · 4 AAB · 19 Agents');
    expect(manpowerSplit({ ab: 0, aab: 1, agents: 3 })).toBe('1 AAB · 3 Agents');
    // Hendra, an AB: his Group is himself, another AB, three AAB and 26 agents.
    expect(groupSplit(leader(HENDRA, 'ab', { manpower: { ab: 2, aab: 3, agents: 26, total: 31 } }))).toBe('1 AB · 3 AAB · 26 Agents');
    // Dewi, an AAB who leads nobody: nobody below her, said in the same format.
    expect(groupSplit(leader(DEWI, 'aab', { manpower: { ab: 0, aab: 1, agents: 0, total: 1 } }))).toBe('0 AAB · 0 Agents');
  });

  it('P19.3-T3 AC-4 writes Manpower’s line as the mockup does: n leader · n agent', () => {
    expect(leaderManpower({ ab: 5, aab: 4, agents: 19, total: 28 })).toBe('9 leader · 19 agent');
  });

  it('P19.3-T3 AC-1 counts the chips over the list, and filters it by class', () => {
    const list = leaders();
    expect([leadersIn(list, 'all').length, leadersIn(list, 'ab').length, leadersIn(list, 'aab').length]).toEqual([7, 4, 3]);
    expect(leadersIn(list, 'aab').every((l) => l.role === 'aab')).toBe(true);
    expect(firstName('Agus Prasetyo')).toBe('Agus');
    expect(firstName('  Sari  ')).toBe('Sari');
  });

  it('P19.3-T3 AC-11 drills to a leader’s Unit Dashboard, Group Tree and member page, the reader to their own', () => {
    expect(unitDashboardHref({ membershipId: 'mem-sari', isReader: false })).toBe('/unit/dashboard/mem-sari');
    expect(groupTreeHref({ membershipId: 'mem-sari', isReader: false })).toBe('/group-tree/mem-sari');
    expect(groupTreeHref({ membershipId: 'mem-owner', isReader: true })).toBe('/group-tree');
    expect(memberPageHref('mem-sari')).toBe('/people/members/mem-sari');
  });

  it('P19.3-T3 AC-12 the MOC dialog writes money with the shared formatter: Rp 3,1 M / Rp 600 Jt (UI-096)', () => {
    expect(criterionPair('MOC_APE', 3_094_500_000 * 100, rp(600))).toEqual(['Rp 3,1 M', 'Rp 600 Jt']);
    expect(criterionPair('MOC_APE', 3_094_500_000 * 100, rp(600), 'en')).toEqual(['IDR 3.1B', 'IDR 600M']);
    // Two different sums that compact writing would make equal are written in full (ADR-0167 §1 kept).
    expect(criterionPair('MOC_APE', rp(599.96), rp(600))).toEqual(['Rp 599.960.000', 'Rp 600 Jt']);
    expect(criterionPair('MOC_APE', null, rp(600))).toEqual(['—', 'Rp 600 Jt']);
    expect(criterionPair('MOC_PERSISTENCY', 74.96, 75)).toEqual(['74,96%', '75%']);
  });
});
