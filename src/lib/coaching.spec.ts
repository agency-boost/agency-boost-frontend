import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  capitalized, coacheeInitials, coacheeUnitLine, coachingArchiveHref, coachingSessionHref, coachingTabHref, coachingTabOf,
  finalizeRefusal, finalizeSession, lastOneOnOneOverdue, lastOneOnOneText, pastSessionSummary, PRONOUN_FORMS, readCoachee,
  readRoster, readSession, readSessionHistory, reopenSession, reopenWindowClosed, ROSTER_STATUS_LABEL, saveSessionDraft,
  startSession, type LastOneOnOne,
} from './coaching';
import {
  agreedVersions, firstName, goalHasTarget, myCoachingHref, printActionLine, printGoalLine, printLeadActionLine,
  readMySessions, readSessionPrint, readSessionShared, sessionTabHref,
} from './coaching';
import {
  capabilityTag, gridItems, gridNotApplicable, LEADER_NOTE_MAX, ladderStages, readCoachingProfile, readLeaderNotes,
  saveCoachingProfile, saveLeaderNote, stageMilestones, trackerGrids,
  type CapabilityGridRow, type CapabilityProfileCatalog, type CapabilityRow, type CapabilityStageRow,
} from './coaching';

const last = (days: number, overdue = false): LastOneOnOne => ({
  days, date: '2026-09-27', overdue, coach: { membershipId: 'mem-ab', name: 'Jordan Pratama' },
});

describe('the roster’s words (P11-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T6 AC-3 words Last 1:1 as the prototype does: none, today, one day, many days', () => {
    // `Overall.html:10619-10623`, verbatim, singular at one.
    expect(lastOneOnOneText(null)).toBe('No 1:1 yet');
    expect(lastOneOnOneText(last(0))).toBe('Today');
    expect(lastOneOnOneText(last(1))).toBe('1 day ago');
    expect(lastOneOnOneText(last(12))).toBe('12 days ago');
  });

  it('P11-T6 AC-3 marks red what the server marks overdue, and a member never coached — never by counting days here', () => {
    expect(lastOneOnOneOverdue(null)).toBe(true);
    // The office's threshold is the server's: 30 days and not overdue stays green, 3 days and overdue
    // turns red. The browser applies no 7 of its own, which is what the prototype hardcodes.
    expect(lastOneOnOneOverdue(last(30, false))).toBe(false);
    expect(lastOneOnOneOverdue(last(3, true))).toBe(true);
  });

  it('P11-T6 AC-4 names the four statuses, ADR-0080’s No goal set among them', () => {
    expect(ROSTER_STATUS_LABEL).toEqual({
      on_track: 'On track',
      watch_closely: 'Watch closely',
      needs_attention: 'Needs attention',
      no_goal_set: 'No goal set',
    });
  });

  it('P11-T6 AC-5 sends Coaching → to the person’s Coaching Session tab', () => {
    expect(coachingSessionHref('mem-7')).toBe('/coaching/mem-7/session');
    // An id is a path segment, never a path.
    expect(coachingSessionHref('a/b')).toBe('/coaching/a%2Fb/session');
  });

  it('reads the roster from GET /coaching/coachees, with no query', async () => {
    const roster = { today: '2026-10-02', overdueAfterDays: 7, directAgents: [], units: [] };
    const { calls } = stubFetch({ '/coaching/coachees': { body: roster } });
    await expect(readRoster()).resolves.toEqual(roster);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://api.test/api/v1/coaching/coachees');
    expect(calls[0].init.method).toBe('GET');
  });
});

describe('the person shell’s words (P11-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T7 AC-1 reads one coachee from GET /coaching/coachees/:membershipId, the id a path segment', async () => {
    const person = {
      membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
      leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
    };
    const { calls } = stubFetch({ '/coaching/coachees/': { body: person } });
    await expect(readCoachee('mem-rina')).resolves.toEqual(person);
    expect(calls[0].url).toBe('http://api.test/api/v1/coaching/coachees/mem-rina');
    expect(calls[0].init.method).toBe('GET');

    await readCoachee('a/b');
    expect(calls[1].url).toBe('http://api.test/api/v1/coaching/coachees/a%2Fb');
  });

  it('P11-T7 AC-1 says Direct unit for the reader’s own, and whose unit otherwise, in none of ADR-0084’s six words', () => {
    const rung = { code: 'AGENT', label: 'Agent' };
    expect(coacheeUnitLine({ rung, direct: true, leader: { membershipId: 'm', name: 'Agus Santoso' } })).toBe('Agent · Direct unit');
    expect(coacheeUnitLine({ rung, direct: false, leader: { membershipId: 'm', name: 'Arief Nugroho' } })).toBe('Agent · Arief Nugroho’s unit');
    // A leader who can no longer be named: the rung alone, never *unassigned*.
    expect(coacheeUnitLine({ rung, direct: false, leader: null })).toBe('Agent');
  });

  it('P11-T7 AC-1 makes the avatar’s letters as the server does: first and last names, or a one-word name’s first two', () => {
    expect(coacheeInitials('Rina Wijaya')).toBe('RW');
    expect(coacheeInitials('  Ni Made Ayu Lestari ')).toBe('NL');
    expect(coacheeInitials('Sukarno')).toBe('SU');
    expect(coacheeInitials('   ')).toBe('?');
  });

  it('P11-T7 AC-2 addresses each tab under the person, and knows which one an address is on', () => {
    expect(coachingTabHref('mem-rina', 'goal-setting')).toBe('/coaching/mem-rina/goal-setting');
    expect(coachingTabOf('/coaching/mem-rina/summary', 'mem-rina')).toBe('summary');
    expect(coachingTabOf('/coaching/mem-rina/leader-notes', 'mem-rina')).toBe('leader-notes');
    expect(coachingTabOf('/coaching/mem-rina/archive/s-1', 'mem-rina')).toBeNull();
    expect(coachingTabOf('/coaching/mem-rina', 'mem-rina')).toBeNull();
    expect(coachingTabOf('/coaching/mem-dewi/summary', 'mem-rina')).toBeNull();
    expect(coachingTabOf(null, 'mem-rina')).toBeNull();
  });

  it('P11-T7 AC-4 has the words a sentence about somebody needs, for each pronoun', () => {
    expect(PRONOUN_FORMS.she).toMatchObject({ subject: 'she', object: 'her', possessive: 'her', have: 'has', s: 's' });
    expect(PRONOUN_FORMS.he).toMatchObject({ subject: 'he', object: 'him', possessive: 'his', have: 'has', s: 's' });
    expect(PRONOUN_FORMS.they).toMatchObject({ subject: 'they', object: 'them', possessive: 'their', have: 'have', s: '' });
    expect(PRONOUN_FORMS.they.isShort).toBe('they’re');
    expect(PRONOUN_FORMS.they.hasShort).toBe('they’ve');
    expect(capitalized('her')).toBe('Her');
    expect(capitalized('')).toBe('');
  });
});

describe('the session’s calls and words (P11-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const methodAndUrl = (calls: { url: string; init: RequestInit }[]) =>
    calls.map((c) => [c.init.method ?? 'GET', c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(c.init.body as string) : undefined]);

  it('P11-T8 calls the lifecycle’s routes, each id a path segment and every write pinned', async () => {
    const { calls } = stubFetch({ '/coaching/': { body: {} } });

    await readSessionHistory('mem/rina');
    await startSession('mem-rina');
    await readSession('s-1');
    await saveSessionDraft('s-1', { version: 2, lastWeekItems: [], actionItems: [{ text: 'Call Desi', dueDate: null }], tips: [] });
    await finalizeSession('s-1', 3);
    await reopenSession('s-1', 4, 'Wrong date');

    expect(methodAndUrl(calls)).toEqual([
      ['GET', '/coaching/coachees/mem%2Frina/sessions', undefined],
      ['POST', '/coaching/coachees/mem-rina/sessions', undefined],
      ['GET', '/coaching/sessions/s-1', undefined],
      ['PUT', '/coaching/sessions/s-1', { version: 2, lastWeekItems: [], actionItems: [{ text: 'Call Desi', dueDate: null }], tips: [] }],
      ['POST', '/coaching/sessions/s-1/finalize', { version: 3 }],
      ['POST', '/coaching/sessions/s-1/reopen', { version: 4, reason: 'Wrong date' }],
    ]);
  });

  it('P11-T8 AC-1 addresses a past session’s archive under the person', () => {
    expect(coachingArchiveHref('mem-rina', 's-0924')).toBe('/coaching/mem-rina/archive/s-0924');
  });

  it('P11-T8 AC-1 words a history row as the prototype does, singular at one', () => {
    // `Overall.html:10688-10690`: *3 action items · 1 completed*.
    expect(pastSessionSummary({ actionItemCount: 3, completedCount: 1 })).toBe('3 action items · 1 completed');
    expect(pastSessionSummary({ actionItemCount: 1, completedCount: 0 })).toBe('1 action item · 0 completed');
  });

  it.each([
    ['NO_ACTION_ITEM', {}, 'Add at least one action item before finalizing.'],
    ['EMPTY_TIP', {}, 'Fill in or remove the empty coaching tip before finalizing.'],
    ['EMPTY_ACTION_ITEM', {}, 'Fill in or remove the empty action item before finalizing.'],
    ['UNDATED_ACTION_ITEM', {}, 'Every action item needs a date before finalizing.'],
    ['LEAD_THIS_MONTH_UNDATED', { leadName: 'Alvin Sanjaya' }, 'Alvin Sanjaya is tagged "this month" but has no next action date set — add one before finalizing.'],
    ['LEAD_THIS_MONTH_UNDATED', {}, 'A lead is tagged "this month" but has no next action date set — add one before finalizing.'],
  ])('P11-T8 AC-10 says %s in the prototype’s sentence (`Overall.html:11111-11117`)', (rule, extra, sentence) => {
    expect(finalizeRefusal({ rule, ...extra })).toBe(sentence);
  });

  it('P11-T8 AC-10 has no sentence of its own for a rule it does not know', () => {
    expect(finalizeRefusal({ rule: 'SOMETHING_NEW' })).toBeNull();
    expect(finalizeRefusal(undefined)).toBeNull();
  });

  it('P11-T8 AC-10 closes Edit again the day after the last day it could be used, by the server’s days', () => {
    expect(reopenWindowClosed('2026-10-09', '2026-10-09')).toBe(false);
    expect(reopenWindowClosed('2026-10-10', '2026-10-09')).toBe(true);
    expect(reopenWindowClosed('2026-12-31', null)).toBe(false);
  });
});

describe('Leader Notes’ calls and words (P11-T9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const row = (code: string, displayOrder: number, status: CapabilityRow['status'] = 'active'): CapabilityRow => ({
    code, label: code.toLowerCase(), displayOrder, status,
  });
  const stage = (code: string, stageOrder: number, displayOrder: number, required: string[], status: CapabilityRow['status'] = 'active'): CapabilityStageRow => ({
    ...row(code, displayOrder, status), stageOrder, requiredMilestoneCodes: required,
  });
  const grid = (code: string, displayOrder: number, items: CapabilityRow[], over: Partial<CapabilityGridRow> = {}): CapabilityGridRow => ({
    ...row(code, displayOrder), requiresDownline: false, items, ...over,
  });
  const catalog = (over: Partial<CapabilityProfileCatalog> = {}): CapabilityProfileCatalog => ({
    stages: [stage('JUNIOR', 1, 2, ['A']), stage('SENIOR', 2, 1, ['A', 'B'])],
    milestones: [row('B', 2), row('A', 1), row('GONE', 3, 'archived')],
    grids: [],
    ...over,
  });

  it('P11-T9 calls the profile and the notes under the person, each id a path segment and every save pinned', async () => {
    const { calls } = stubFetch({ '/coaching/': { body: {} } });

    await readCoachingProfile('mem/rina');
    await saveCoachingProfile('mem-rina', { version: 3, milestoneCodes: ['A'], skillCodes: ['X'] });
    await readLeaderNotes('mem-rina');
    await saveLeaderNote('mem-rina', { version: 0, text: '' });

    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(c.init.body as string) : undefined])).toEqual([
      ['GET', '/coaching/coachees/mem%2Frina/profile', undefined],
      ['PUT', '/coaching/coachees/mem-rina/profile', { version: 3, milestoneCodes: ['A'], skillCodes: ['X'] }],
      ['GET', '/coaching/coachees/mem-rina/leader-notes', undefined],
      ['PUT', '/coaching/coachees/mem-rina/leader-notes', { version: 0, text: '' }],
    ]);
  });

  it('P11-T9 AC-4 keeps a note to the server’s 4,000 characters', () => {
    expect(LEADER_NOTE_MAX).toBe(4000);
  });

  it('P11-T9 AC-1 draws the ladder in display order, an archived stage only while it is the current one', () => {
    expect(ladderStages(catalog(), null).map((s) => s.code)).toEqual(['SENIOR', 'JUNIOR']);
    const archived = catalog({ stages: [stage('JUNIOR', 1, 1, ['A']), stage('OLD', 2, 2, ['A'], 'archived')] });
    expect(ladderStages(archived, null).map((s) => s.code)).toEqual(['JUNIOR']);
    expect(ladderStages(archived, 'OLD').map((s) => s.code)).toEqual(['JUNIOR', 'OLD']);
  });

  it('P11-T9 AC-1 lists a stage’s milestones in their display order, an archived one only where it is ticked', () => {
    const c = catalog();
    const senior = stage('SENIOR', 2, 1, ['B', 'A', 'GONE']);
    expect(stageMilestones(senior, c, new Set()).map((m) => m.code)).toEqual(['A', 'B']);
    expect(stageMilestones(senior, c, new Set(['GONE'])).map((m) => m.code)).toEqual(['A', 'B', 'GONE']);
  });

  it('P11-T9 AC-1 tags the server’s stage, or Not yet at the most junior one by seniority', () => {
    // `Overall.html:4349`, `:11221`.
    expect(capabilityTag(catalog(), 'SENIOR')).toBe('Current: senior');
    expect(capabilityTag(catalog(), null)).toBe('Not yet at junior');
    // The most junior active one; an archived junior is passed over while another is active.
    const archived = catalog({ stages: [stage('OLDEST', 0, 1, [], 'archived'), stage('JUNIOR', 1, 2, ['A'])] });
    expect(capabilityTag(archived, null)).toBe('Not yet at junior');
    expect(capabilityTag(catalog({ stages: [stage('OLDEST', 0, 1, [], 'archived')] }), null)).toBe('Not yet at oldest');
    // Nothing to name: no tag rather than a wrong one.
    expect(capabilityTag(catalog({ stages: [] }), null)).toBeNull();
    expect(capabilityTag(catalog(), 'UNKNOWN')).toBeNull();
  });

  it('P11-T9 AC-3 draws an archived section or item only where something in it is ticked', () => {
    const sections = [
      grid('LIVE', 2, [row('X', 2), row('Y', 1), row('Z', 3, 'archived')]),
      grid('RETIRED', 1, [row('R', 1)], { status: 'archived' }),
    ];
    expect(trackerGrids(catalog({ grids: sections }), new Set()).map((g) => g.code)).toEqual(['LIVE']);
    expect(trackerGrids(catalog({ grids: sections }), new Set(['R'])).map((g) => g.code)).toEqual(['RETIRED', 'LIVE']);
    expect(gridItems(sections[0], new Set()).map((i) => i.code)).toEqual(['Y', 'X']);
    expect(gridItems(sections[0], new Set(['Z'])).map((i) => i.code)).toEqual(['Y', 'X', 'Z']);
  });

  it('P11-T9 AC-2 says a downline section does not apply, in the person’s pronoun, from their downline counts', () => {
    // `Overall.html:4366`, `:4371`.
    const agents = grid('DEVELOPING_DOWNLINE_AGENT', 3, [], { requiresDownline: true });
    const leaders = grid('DEVELOPING_DOWNLINE_LEADER', 4, [], { requiresDownline: true });
    const selling = grid('PERSONAL_SELLING', 1, []);
    const none = { members: 0, leaders: 0 };

    expect(gridNotApplicable(agents, none, 'she')).toBe('Not applicable — she has no agents under her yet.');
    expect(gridNotApplicable(leaders, none, 'she')).toBe('Not applicable — she has no downline leaders yet.');
    expect(gridNotApplicable(agents, none, 'he')).toBe('Not applicable — he has no agents under him yet.');
    expect(gridNotApplicable(agents, none, 'they')).toBe('Not applicable — they have no agents under them yet.');
    expect(gridNotApplicable(leaders, { members: 3, leaders: 0 }, 'they')).toBe('Not applicable — they have no downline leaders yet.');
    expect(gridNotApplicable(agents, { members: 3, leaders: 0 }, 'she')).toBeNull();
    expect(gridNotApplicable(leaders, { members: 3, leaders: 1 }, 'she')).toBeNull();
    expect(gridNotApplicable(selling, none, 'she')).toBeNull();
  });
});

describe('the record after the meeting (P11-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const agreement = (tip: string) => ({
    lastWeekItems: [], leadActions: [], actionItems: [], tips: [{ tipId: tip, text: tip }],
  });
  const earlier = (tip: string, reason: string) => ({
    ...agreement(tip),
    finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: { membershipId: 'mem-ab', name: 'Agus' },
    reopenedAt: '2026-09-25T03:00:00.000Z', reopenedBy: { membershipId: 'mem-ab', name: 'Agus' }, reason,
  });
  const session = (over: Record<string, unknown>) => ({
    sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina' }, coach: { membershipId: 'mem-ab', name: 'Agus' },
    status: 'finalized', version: 3, date: '2026-09-24', startedAt: '2026-09-24T02:00:00.000Z', finalizedAt: null, finalizedBy: null,
    reopenableUntil: null, lastWeek: null, snapshot: null, earlier: [], ...agreement('now'), ...over,
  }) as unknown as Parameters<typeof agreedVersions>[0];

  it('P11-T10 AC-1 a finalized session is its own record, with the versions it replaced before it', () => {
    const one = earlier('first', 'Wrong dates.');
    const record = agreedVersions(session({ earlier: [one] }))!;
    expect(record.agreed.tips[0].text).toBe('now');
    expect(record.earlier).toEqual([one]);
  });

  it('P11-T10 AC-1 a correction in progress reads as the version it replaces, which leaves the earlier list', () => {
    const one = earlier('first', 'Wrong dates.');
    const two = earlier('second', 'One more change.');
    const record = agreedVersions(session({ status: 'reopened', earlier: [one, two] }))!;
    expect(record.agreed.tips[0].text).toBe('second');
    expect(record.earlier).toEqual([one]);
  });

  it('P11-T10 a draft has agreed nothing yet, and a reopened session with nothing replaced has no record', () => {
    expect(agreedVersions(session({ status: 'draft' }))).toBeNull();
    expect(agreedVersions(session({ status: 'reopened', earlier: [] }))).toBeNull();
    expect(agreedVersions(session({ earlier: undefined }))!.earlier).toEqual([]);
  });

  it('P11-T10 AC-3 writes the print’s lines as the prototype’s export does, in the one money formatter', () => {
    const money = (minor: number) => `Rp ${minor / 100}`;
    expect(printGoalLine('This month', { targetMinor: 8000, actualMinor: 6500 }, money)).toBe('This month: Rp 65 / Rp 80');
    expect(printGoalLine('This year', { targetMinor: null, actualMinor: null }, money)).toBe('This year: Not uploaded yet / —');
    const day = (d: string) => `<${d}>`;
    expect(printLeadActionLine(0, { dueDate: '2026-10-03', text: 'Collect the SPAJ.', leadName: 'Desi' }, day))
      .toBe('1. <2026-10-03> — Collect the SPAJ. (Leads: Desi)');
    expect(printLeadActionLine(1, { dueDate: '2026-10-03', text: '', leadName: 'Desi' }, day))
      .toBe('2. <2026-10-03> — Follow up with Desi (Leads: Desi)');
    expect(printActionLine(0, { dueDate: '2026-10-07', text: 'Shadow Sari' }, day)).toBe('1. <2026-10-07> — Shadow Sari');
    expect(printActionLine(2, { dueDate: null, text: 'Undated' }, day)).toBe('3. Undated');
  });

  it('P11 final walk F2 has one condition for No goal set: no goal, or a goal with no yearly target', () => {
    const period = (targetMinor: number | null) => ({ targetMinor, actualMinor: null });
    expect(goalHasTarget(null)).toBe(false);
    expect(goalHasTarget({ monthly: period(8000), yearly: period(null) })).toBe(false);
    expect(goalHasTarget({ monthly: period(null), yearly: period(96000) })).toBe(true);
    expect(goalHasTarget({ monthly: period(8000), yearly: period(96000) })).toBe(true);
  });

  it('P11 final walk F5 joins an identical read of a person or an archived session while one is out, and never the workspace’s', async () => {
    const { calls } = stubFetch({ '/coaching/': { body: {} } });

    await Promise.all([readCoachee('mem-rina'), readCoachee('mem-rina'), readCoachee('mem-dewi')]);
    await Promise.all([readSessionShared('s-1'), readSessionShared('s-1')]);
    // Settled, so the next read goes out: joined, never cached.
    await readSessionShared('s-1');
    // The workspace reads after it writes, so its reads are never joined.
    await Promise.all([readSession('s-1'), readSession('s-1')]);

    expect(calls.map((c) => c.url.replace('http://api.test/api/v1', ''))).toEqual([
      '/coaching/coachees/mem-rina',
      '/coaching/coachees/mem-dewi',
      '/coaching/sessions/s-1',
      '/coaching/sessions/s-1',
      '/coaching/sessions/s-1',
      '/coaching/sessions/s-1',
    ]);
  });

  it('P11-T10 names the addresses: the notice’s, the reader’s own, and the session tab opened on one session', () => {
    expect(myCoachingHref()).toBe('/coaching/me');
    expect(myCoachingHref('s 1')).toBe('/coaching/me?session=s%201');
    expect(sessionTabHref('mem-rina', 's-1')).toBe('/coaching/mem-rina/session?session=s-1');
    expect(firstName('  Wilson   Tanoto ')).toBe('Wilson');
    expect(firstName('')).toBe('');
  });

  it('P11-T10 reads the print and the reader’s own sessions from their own routes', async () => {
    const { calls } = stubFetch({
      '/coaching/me/sessions': { body: { sessions: [], ledFormerly: [] } },
      '/print': { body: { sessionId: 's/1' } },
    });
    await readMySessions();
    await readSessionPrint('s/1');
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/coaching/me/sessions',
      'http://api.test/api/v1/coaching/sessions/s%2F1/print',
    ]);
  });
});
