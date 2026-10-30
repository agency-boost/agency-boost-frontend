import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { InLanguage, makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import type { Language } from '@/i18n/language';
import { act } from 'react';
import CoachingPersonLayout from '../layout';
import CoachingSessionTabPage from './page';
import { sessionTag } from '@/components/coaching-session';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/session',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: [
    'coaching_session:read', 'coaching_session:create', 'coaching_session:edit', 'coaching_session:finalize',
    'coaching_session:reopen', 'coaching_session:export_pdf', 'personal_summary:read', 'goal:read', 'goal:update',
    'activity_ratios:read', 'lead:read', 'lead:create', 'lead:update', 'lead:mark_outcome',
  ],
});

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
};
const AGUS = { membershipId: 'mem-agus', name: 'Agus Santoso' };

const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      { id: 's1', pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
      { id: 's3', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
    ],
  },
  { pipeline: 'recruitment', statuses: [] },
];

const history = (over: Record<string, unknown> = {}) => ({
  today: '2026-10-02',
  current: null,
  sessions: [
    { sessionId: 's-0924', date: '2026-09-24', coach: AGUS, actionItemCount: 3, completedCount: 1 },
    { sessionId: 's-0917', date: '2026-09-17', coach: AGUS, actionItemCount: 1, completedCount: 1 },
  ],
  ...over,
});

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: AGUS,
  status: 'draft', version: 1, date: null, startedAt: '2026-10-02T02:00:00.000Z',
  finalizedAt: null, finalizedBy: null, reopenableUntil: null, defaultDueDate: '2026-10-09',
  lastWeek: { sessionId: 's-0924', date: '2026-09-24' },
  lastWeekItems: [
    { itemId: 'lw-1', text: 'Confirm submission paperwork with Bp. Andi', dueDate: '2026-09-24', lead: null, done: true },
    { itemId: 'lw-2', text: 'Follow up with Alvin Sanjaya — no contact in 8 days', dueDate: '2026-09-24', lead: { leadId: 'l-alvin', name: 'Alvin Sanjaya' }, done: false },
  ],
  leadActions: [
    { leadId: 'l-desi', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: 'Confirm submission paperwork' },
    { leadId: 'l-hana', leadName: 'Hana Permata', dueDate: '2026-10-07', text: null },
  ],
  actionItems: [{ itemId: 'a-1', text: 'Practice a tighter close for the Rp30M+ segment', dueDate: null }],
  tips: [{ tipId: 't-1', text: 'Slow down on the opening line — let the client finish before pitching.' }],
  ...over,
});

const finalized = (over: Record<string, unknown> = {}) => session({
  status: 'finalized', version: 3, date: '2026-10-02', finalizedAt: '2026-10-02T03:00:00.000Z', finalizedBy: AGUS,
  reopenableUntil: '2026-10-09', defaultDueDate: null, ...over,
});

const M = 1_000_000 * 100;
const figures = (target: number, actual: number | null, pct: number | null, gap: number | null) => ({
  targetMinor: target, actualMinor: actual, attainmentPct: pct, gapMinor: gap, overMinor: 0, policiesNeeded: 1, targetMet: false,
});
const activity = { from: '2026-10-01', to: '2026-10-02', targets: [], total: 0, sections: [] };
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-10', today: '2026-10-02',
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(80 * M, 65.6 * M, 82, 14.4 * M), source: { provenance: 'imported', month: '2026-09' } },
  yearly: { ...figures(960 * M, 620 * M, 65, 340 * M), source: { provenance: 'imported', month: '2026-09' } },
  pace: null,
  activity: { monthly: activity, yearly: activity },
  leads: { rows: [], total: 0 },
  insights: [],
  ...over,
});

const ratio = (over: Record<string, unknown> = {}) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
  tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
  value: 0.18, share: null, numeratorCount: 9, denominatorCount: 50, status: 'success', ...over,
});
const RATIOS = {
  membershipId: 'mem-rina', from: '2026-09-03', to: '2026-10-02', days: 30,
  ratios: [
    ratio(),
    ratio({ code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 0.35 }),
    ratio({ code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', value: null, status: 'neutral' }),
    ratio({
      code: 'SALES_VS_RECRUITMENT', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
      value: 40, share: 70, sides: { numerator: 'Selling', denominator: 'Recruitment' }, status: 'alert',
    }),
  ],
};

const WEEK = {
  from: '2026-09-26', to: '2026-10-02', totals: [], daysLogged: 5, totalCount: 22,
  targets: [
    { key: 'leads', code: 'LEADS_CONTACTED', logged: 14, target: 16 },
    { key: 'appointments', code: 'SELL_PRESENTATION', logged: 4, target: 5 },
    { key: 'closings', code: 'SELL_SUBMISSION', logged: 1, target: 1 },
  ],
  sections: [
    {
      code: 'RECRUITMENT', label: 'Recruitment', total: 0,
      rows: [{ code: 'REC_CANDIDATE', label: 'Candidate leads', count: 0 }, { code: 'REC_PRESENTATION', label: 'Recruitment presentations', count: 0 }],
    },
    {
      code: 'DEVELOPMENT', label: 'Development', total: 3,
      rows: [
        { code: 'DEV_TRAINING', label: 'Training attended', count: 1 },
        { code: 'DEV_COACHING_RECEIVED', label: 'Coaching sessions', count: 1 },
        { code: 'DEV_TEAM', label: 'Team activities', count: 1 },
      ],
    },
  ],
};

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l-desi', ownerMembershipId: 'mem-rina', type: 'sales', name: 'Desi Pratama',
  contact: { phone: null, email: null }, statusCode: 'FOLLOW_UP',
  thisMonth: true, remarks: 'Hot button: family', nextActionDate: '2026-10-05', nextActionNote: 'Confirm submission paperwork',
  outcome: null, source: null, dateRegistered: '2026-09-04T03:00:00.000Z', version: 3, flags: [], overdueDays: null,
  committedMonths: ['2026-10'], lastEditedBy: null, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const GOAL = {
  period: '2026', mode: 'from_savings', annualApeTargetMinor: 960 * M, savingsTargetMinor: 96 * M,
  commissionRatePct: 10, monthsLeft: 2.9, monthsLeftIsOverride: false, apeAchievedMinor: 0,
  achieved: { minor: 620 * M, provenance: 'imported', month: '2026-09' },
  caseSizeMinor: 18 * M, leadsToApptPct: 30, closingRatePct: 30,
  snapshot: { monthlyApeTargetMinor: 80 * M, policiesPerMonth: 5, appointmentsPerMonth: 16, leadsPerMonth: 53 },
  projected: null,
  cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  measured: null, savedAt: '2026-09-01T02:00:00.000Z', savedByMembershipId: 'mem-rina',
};

const refused = (status: number, code: string, message: string, details?: Record<string, unknown>) => ({
  status, body: { error: { code, message, requestId: 'req-1', ...(details ? { details } : {}) } },
});

/** A draft save that answers as the server does: the next version, and an id for every row. */
const echoSave: StubReply = ({ body }) => {
  const sent = body as { version: number; actionItems: { itemId?: string; text: string; dueDate: string | null }[]; tips: { tipId?: string; text: string }[] };
  return {
    body: {
      sessionId: 's-1',
      version: sent.version + 1,
      actionItems: sent.actionItems.map((a, i) => ({ itemId: a.itemId ?? `a-new-${i}`, text: a.text, dueDate: a.dueDate })),
      tips: sent.tips.map((t, i) => ({ tipId: t.tipId ?? `t-new-${i}`, text: t.text })),
    },
  };
};

/** The session tab, in English (every spec's default) or, asked for, in Indonesian (P18.98-T3). */
const show = (routes: Record<string, StubReply | StubReply[]> = {}, language?: Language) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
    '/kpm/org-levels': { body: [] },
    'GET /coaching/coachees/mem-rina': { body: RINA },
    'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'draft' } }) },
    'GET /coaching/sessions/s-1': { body: session() },
    'PUT /coaching/sessions/s-1': echoSave,
    '/summary?for=mem-rina': { body: summary() },
    '/activity/ratios?for=mem-rina': { body: RATIOS },
    '/activity/summary?': { body: WEEK },
    'GET /leads?owner=mem-rina': { body: page([lead()]) },
    'GET /goals/2026': { body: GOAL },
    'PUT /goals/2026': { body: GOAL },
    ...routes,
  });
  const tab = <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingSessionTabPage /></CoachingPersonLayout>;
  const view = language
    ? renderWithSession(<InLanguage language={language}><AgentLayout>{tab}</AgentLayout></InLanguage>, { me: LEADER })
    : renderInLayout(AgentLayout, tab, { me: LEADER });
  return { ...stub, ...view };
};

const card = (name: string | RegExp) => screen.findByRole('region', { name });
/** The session card (UI-032): *Sesi hari ini*, the day and the tag, in either language. */
const sessionCard = () => document.querySelector('[data-session-card="session"]') as HTMLElement;
const sent = (calls: { url: string; init: RequestInit }[], method: string, fragment: string) =>
  calls.filter((c) => (c.init.method ?? 'GET') === method && c.url.includes(fragment));
const bodyOf = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
/** A toast says this, in the polite live region (`components-and-patterns.md`, *Toast*). */
const toastSays = async (message: string) => {
  const text = await screen.findByText(message);
  expect(text.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
};

/** The six words coaching's own strings never use (ADR-0084). */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('the session workspace (P11-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the header and the start', () => {
    it('P11-T8 AC-1, P18.95-T7 AC-2, UI-032 heads the tab with the office’s today and Not started, before anything starts', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });

      await screen.findByRole('button', { name: 'Start coaching session' });
      const heading = within(sessionCard()).getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(/^Today’s session ?Friday, 2 Oct 2026$/);
      // P18.95-T7 AC-2 (UI-021): *Not started*, not the prototype's *Draft* of a session nobody has opened.
      expect(within(sessionCard()).getByText('Not started')).toHaveAttribute('data-tone', 'grey');
      expect(sessionCard()).not.toHaveTextContent('Draft');
    });

    it('P18.95-T7 AC-2 tags a session Draft once it is open, and Finalized once it is done', () => {
      expect(sessionTag(null)).toBe('Not started');
      expect(sessionTag({ status: 'draft' })).toBe('Draft');
      expect(sessionTag({ status: 'reopened' })).toBe('Draft');
      expect(sessionTag({ status: 'finalized' })).toBe('Finalized');
    });

    it('UI-032 one card: the day, the tag and Start coaching session in it, past sessions as rows under it without a tap', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });
      const start = await screen.findByRole('button', { name: 'Start coaching session' });
      // One card for one action: the button is inside the session card, 48px, a line icon and no ▶.
      expect(sessionCard()).toContainElement(start);
      expect(start).toHaveClass('h-12');
      expect(start).not.toHaveTextContent('▶');
      expect(start.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('button', { name: /View past sessions/ })).not.toBeInTheDocument();
      const rows = within(sessionCard()).getAllByRole('link');
      expect(rows.map((r) => [r.textContent, r.getAttribute('href')])).toEqual([
        ['24 Sep 2026 · 3 action items · 1 completed', '/coaching/mem-rina/archive/s-0924'],
        ['17 Sep 2026 · 1 action item · 1 completed', '/coaching/mem-rina/archive/s-0917'],
      ]);
      for (const row of rows) expect(row).toHaveClass('min-h-[52px]');
    });

    it('UI-032 shows three past sessions, then All (n), which shows the rest and folds them again', async () => {
      const sessions = ['09-24', '09-17', '09-10', '09-03', '08-27'].map((d) => ({
        sessionId: `s-${d}`, date: `2026-${d}`, coach: AGUS, actionItemCount: 2, completedCount: 1,
      }));
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history({ sessions }) } });
      await screen.findByRole('button', { name: 'Start coaching session' });
      expect(within(sessionCard()).getAllByRole('link')).toHaveLength(3);

      const all = within(sessionCard()).getByRole('button', { name: 'All (5)' });
      await userEvent.click(all);
      expect(within(sessionCard()).getAllByRole('link')).toHaveLength(5);
      expect(within(sessionCard()).getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('UI-032, D-08 draws no past-session list when there is none', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history({ sessions: [] }) } });
      await screen.findByRole('button', { name: 'Start coaching session' });
      expect(within(sessionCard()).queryAllByRole('link')).toHaveLength(0);
      expect(screen.queryByText('No past sessions yet.')).not.toBeInTheDocument();
    });

    it('P11-T8 AC-2, UI-032 opens on Start coaching session with no line under it, and reads nothing about her until it starts', async () => {
      const { calls } = show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });

      await screen.findByRole('button', { name: 'Start coaching session' });
      // UI-032: the line under the button went at every size.
      expect(screen.queryByText(/Opens last week's items/)).not.toBeInTheDocument();
      // Every one of these reads is audited; the pre-start state draws none of them.
      expect(calls.some((c) => /\/summary\?|\/activity\/|\/leads|\/goals\//.test(c.url))).toBe(false);
      expect(screen.queryByRole('region', { name: 'Goal' })).not.toBeInTheDocument();
    });

    it('P11-T8 AC-2 starts: one POST, the prototype’s toast, and last week’s unfinished items and tips carried in', async () => {
      const { calls } = show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history() },
        'POST /coaching/coachees/mem-rina/sessions': { status: 201, body: session() },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Start coaching session' }));

      // *Session started ✓* first since 2026-10-26 (P18.95-T1 AC-6), the prototype's sentence after it.
      await toastSays('Session started ✓ — unfinished items and tips from last week carried forward.');
      expect(sent(calls, 'POST', '/coaching/coachees/mem-rina/sessions')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Start coaching session' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Action item 1' })).toHaveValue('Practice a tighter close for the Rp30M+ segment');
      expect(screen.getByRole('textbox', { name: 'Tip 1' })).toHaveValue('Slow down on the opening line — let the client finish before pitching.');
      expect(await card('Goal')).toBeInTheDocument();
    });

    it('P11-T8 AC-2 says only that it started when there was no session before, and draws no Last week card', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ sessions: [] }) },
        'POST /coaching/coachees/mem-rina/sessions': { status: 201, body: session({ lastWeek: null, lastWeekItems: [], actionItems: [], tips: [] }) },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Start coaching session' }));

      await toastSays('Session started ✓');
      expect(screen.queryByText(/carried forward/)).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: "Last week's action items" })).not.toBeInTheDocument();
    });

    it('P11-T8 AC-2 shows a refused start where the button is', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history() },
        'POST /coaching/coachees/mem-rina/sessions': refused(404, 'NOT_FOUND', 'Not found'),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Start coaching session' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
    });

    it('P11-T8 AC-1 opens on the reader’s open draft with her, without Start', async () => {
      show();
      expect(await card("Last week's action items")).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start coaching session' })).not.toBeInTheDocument();
    });

    it('shows a failed history read, and offers nothing to start', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': refused(500, 'INTERNAL_ERROR', 'Something went wrong.') });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(screen.queryByRole('button', { name: 'Start coaching session' })).not.toBeInTheDocument();
    });
  });

  describe('last week’s action items', () => {
    it('P11-T8 AC-3, UI-061 lists them under From {date} session in the compact row: date, text, lead after a person icon, checkbox', async () => {
      show();
      const lastWeek = await card("Last week's action items");

      expect(within(lastWeek).getByText('From 24 Sep session')).toBeInTheDocument();
      const done = within(lastWeek).getByRole('checkbox', { name: 'Done: Confirm submission paperwork with Bp. Andi' });
      expect(done).toBeChecked();
      expect(within(lastWeek).getByText('Confirm submission paperwork with Bp. Andi')).toHaveClass('line-through');
      const open = within(lastWeek).getByRole('checkbox', { name: /^Done: Follow up with Alvin Sanjaya/ });
      expect(open).not.toBeChecked();
      // UI-061: the lead in 12px grey after a person icon, on the same line — no chip.
      expect(within(lastWeek).getByText('Alvin Sanjaya')).toHaveClass('text-sm', 'text-signal-grey');
      expect(within(lastWeek).queryByText('Leads · Alvin Sanjaya')).not.toBeInTheDocument();
      expect(within(lastWeek).getAllByLabelText(/^Change the date: /).map((d) => (d as HTMLInputElement).value)).toEqual(['2026-09-24', '2026-09-24']);
      // One date format: *24 Sep*, the year only when it is not this year.
      expect(lastWeek.querySelectorAll('[data-action-row]')).toHaveLength(2);
      expect(lastWeek).toHaveTextContent('24 Sep');
      expect(lastWeek).not.toHaveTextContent('24 Sep 2026');
    });

    it('P11-T8 AC-3 writes a tick on this session, the whole state at the version it read', async () => {
      const { calls } = show();
      const lastWeek = await card("Last week's action items");

      await userEvent.click(within(lastWeek).getByRole('checkbox', { name: /Follow up with Alvin Sanjaya/ }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0])).toEqual({
        version: 1,
        lastWeekItems: [
          { itemId: 'lw-1', done: true, dueDate: '2026-09-24' },
          { itemId: 'lw-2', done: true, dueDate: '2026-09-24' },
        ],
        actionItems: [{ itemId: 'a-1', text: 'Practice a tighter close for the Rp30M+ segment', dueDate: null }],
        tips: [{ tipId: 't-1', text: 'Slow down on the opening line — let the client finish before pitching.' }],
      });
      expect(within(lastWeek).getByText(/^Follow up with Alvin Sanjaya/)).toHaveClass('line-through');
    });

    it('P11-T8 AC-3 moves an item’s date, and the next save carries the version the last one answered', async () => {
      const { calls } = show();
      const lastWeek = await card("Last week's action items");

      await userEvent.click(within(lastWeek).getByRole('checkbox', { name: /Follow up with Alvin Sanjaya/ }));
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      const date = within(lastWeek).getByLabelText('Change the date: Follow up with Alvin Sanjaya — no contact in 8 days');
      fireEvent.change(date, { target: { value: '2026-10-06' } });

      await waitFor(() => expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1').at(-1)!).lastWeekItems[1])
        .toEqual({ itemId: 'lw-2', done: true, dueDate: '2026-10-06' }));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1').at(-1)!).version).toBeGreaterThan(1);
    });
  });

  describe('the Goal card', () => {
    it('P18.98-T3 AC-1 in Indonesian: the header’s day, the Goal tiles’ sums in juta and the ratios whole', async () => {
      show({}, 'id');
      const goal = await card('Goal');
      await within(goal).findByText(/Rp 65,6 jt/);
      expect(goal).toHaveTextContent('Bulan ini');
      expect(goal).toHaveTextContent('Tahun ini');
      expect(goal).toHaveTextContent('Rp 65,6 jt/ Rp 80 jt · 82%');
      expect(within(sessionCard()).getByRole('heading', { level: 2 })).toHaveTextContent(/^Sesi hari ini ?Jumat, 2 Okt 2026$/);
      const ratios = await card('Ratio · 30 hari terakhir');
      expect(await within(ratios).findByText('18%')).toBeInTheDocument();
      // The box holds the target's digits in its marks, its prefix *Rp*.
      expect(within(goal).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rp 960 jt, target tahun ini — ubah']);
      await userEvent.click(within(goal).getByRole('button', { name: /target tahun ini — ubah/ }));
      expect(within(goal).getByLabelText('Target APE tahunan')).toHaveValue('960.000.000');
    });

    it('P11-T8 AC-4, UI-062 shows the month and the year as two tiles, as her Summary does, the attainment whole', async () => {
      const { calls } = show();
      const goal = await card('Goal');

      await within(goal).findByText(/IDR 65.6M/);
      const tiles = goal.querySelectorAll('[data-goal-tile]');
      expect(tiles).toHaveLength(2);
      expect(tiles[0]).toHaveTextContent('This monthIDR 65.6M/ IDR 80M · 82%');
      expect(tiles[1]).toHaveTextContent('This yearIDR 620M/ IDR 960M, this year’s target — edit · 65%');
      expect(goal).not.toHaveTextContent('82.0%');
      expect(within(goal).getByRole('progressbar', { name: 'This month’s target' })).toHaveAttribute('aria-valuenow', '82');
      expect(within(goal).getByText('Tap this year’s target to edit')).toHaveClass('max-md:hidden');
      // One control on the card: the annual target. This month's target is a figure.
      expect(within(goal).getAllByRole('button').map((b) => b.textContent)).toEqual(['IDR 960M, this year’s target — edit']);
      expect(calls.filter((c) => c.url.includes('/summary?for=mem-rina')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/summary?for=mem-rina']);
    });

    it('P11-T8 AC-4 saves the annual target deliberately, in the session, with the plan the server holds', async () => {
      const { calls } = show();
      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));

      const field = within(goal).getByLabelText('Annual APE target');
      expect(field).toHaveFocus();
      expect(field).toHaveValue('960,000,000');
      await userEvent.clear(field);
      await userEvent.type(field, '1200000000');
      expect(field).toHaveValue('1,200,000,000');
      // Leaving the box saves nothing: only Save does (ADR-0075).
      await userEvent.tab();
      expect(sent(calls, 'PUT', '/goals/')).toHaveLength(0);

      await userEvent.click(within(goal).getByRole('button', { name: 'Save' }));

      await toastSays('Goal updated — reflected across both tabs.');
      const [put] = sent(calls, 'PUT', '/goals/');
      expect(put.url).toBe('http://api.test/api/v1/goals/2026?for=mem-rina&session=s-1');
      expect(bodyOf(put)).toEqual({
        mode: 'direct', annualApeTargetMinor: 1_200_000_000_00, savingsTargetMinor: 96 * M, commissionRatePct: 10,
        monthsLeft: null, apeAchievedMinor: 0, caseSizeMinor: 18 * M, leadsToApptPct: 30, closingRatePct: 30,
      });
      expect(sent(calls, 'GET', '/goals/2026?for=mem-rina')).toHaveLength(1);
      // The figures are read again, so this month's target moves by its formula, not by a hand.
      await waitFor(() => expect(calls.filter((c) => c.url.includes('/summary?for=mem-rina'))).toHaveLength(2));
      expect(within(goal).queryByLabelText('Annual APE target')).not.toBeInTheDocument();
    });

    it('P11-T8 AC-4 puts the box away on Escape, writing nothing', async () => {
      const { calls } = show();
      const goal = await card('Goal');
      const edit = await within(goal).findByRole('button', { name: /this year’s target — edit/ });
      await userEvent.click(edit);
      await userEvent.type(within(goal).getByLabelText('Annual APE target'), '{Escape}');

      expect(within(goal).queryByLabelText('Annual APE target')).not.toBeInTheDocument();
      await waitFor(() => expect(within(goal).getByRole('button', { name: /this year’s target — edit/ })).toHaveFocus());
      expect(sent(calls, 'PUT', '/goals/')).toHaveLength(0);
    });

    it('P11-T8 AC-4 shows a refused save where the target is, and keeps what was typed', async () => {
      show({ 'PUT /goals/2026': refused(409, 'COACHING_SESSION_FINALIZED', 'This session is finalized.') });
      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));
      await userEvent.click(within(goal).getByRole('button', { name: 'Save' }));

      expect(await within(goal).findByRole('alert')).toHaveTextContent('This session is finalized.');
      expect(within(goal).getByLabelText('Annual APE target')).toHaveValue('960,000,000');
    });

    it('P11-T8 AC-4 says No goal set, and the annual target can still be set', async () => {
      const { calls } = show({ '/summary?for=mem-rina': { body: summary({ goal: { set: false, savedAt: null } }) } });
      const goal = await card('Goal');

      expect(await within(goal).findByText('No goal set')).toBeInTheDocument();
      expect(within(goal).queryByText('Tap this year’s target to edit')).not.toBeInTheDocument();
      await userEvent.click(within(goal).getByRole('button', { name: 'Set this year’s target' }));
      await userEvent.type(within(goal).getByLabelText('Annual APE target'), '500000000{Enter}');

      await waitFor(() => expect(sent(calls, 'PUT', '/goals/')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/goals/')[0]).annualApeTargetMinor).toBe(500 * M);
    });

    it('P11-T8 AC-4 says Not uploaded yet for a month whose production has not arrived', async () => {
      show({
        '/summary?for=mem-rina': {
          body: summary({ monthly: { ...figures(80 * M, null, null, null), source: null } }),
        },
      });
      const goal = await card('Goal');
      expect(await within(goal).findByText('Not uploaded yet')).toBeInTheDocument();
      expect(within(goal).queryByRole('progressbar', { name: 'This month’s target' })).not.toBeInTheDocument();
    });

    it('shows a failed Summary read in the Goal card alone', async () => {
      show({ '/summary?for=mem-rina': refused(404, 'NOT_FOUND', 'Not found') });
      const goal = await card('Goal');
      expect(await within(goal).findByRole('alert')).toHaveTextContent('Not found');
      expect(await card('Ratio · last 30 days')).toBeInTheDocument();
    });
  });

  describe('Ratios and Activity', () => {
    it('P11-T8 AC-5, UI-062, O-3 reads her ratios on her rung, the last 30 days, in the shared card as rows, every percentage whole', async () => {
      const { calls } = show();
      const ratios = await card('Ratio · last 30 days');

      expect(ratios).toHaveAttribute('data-ratio-card');
      await within(ratios).findByText('18%');
      expect(within(ratios).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Selling success rateTarget 15%18%',
        'Leads per activityTarget 0.300.35',
        'Recruitment success rateTarget 15%–Not enough data',
      ]);
      // The balance as the split bar, each side's share.
      expect(within(ratios).getByRole('img')).toHaveAccessibleName('Selling 70% · Recruitment 30%');
      expect(sent(calls, 'GET', '/activity/ratios').map((c) => c.url)).toEqual(['http://api.test/api/v1/activity/ratios?for=mem-rina']);
    });

    it('P11-T8 AC-5 says when her role has no ratios', async () => {
      show({ '/activity/ratios?for=mem-rina': { body: { ...RATIOS, ratios: [] } } });
      const ratios = await card('Ratio · last 30 days');
      expect(await within(ratios).findByText('No ratio applies here yet.')).toBeInTheDocument();
    });

    it('P11-T8 AC-6, UI-062 shows the last 7 days as three tiles against pro-rated targets, then one line for the sections', async () => {
      const { calls } = show();
      const week = await card('Activity');

      await within(week).findByText('Set appointment');
      const tiles = week.querySelectorAll('[data-week-tile]');
      expect([...tiles].map((t) => t.textContent)).toEqual([
        'Set appointment14 / 16 / 16 pro-rated', 'Sales meeting4 / 5 / 5 pro-rated', 'Submission polis1 / 1 / 1 pro-rated',
      ]);
      expect(within(week).getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-haspopup', 'dialog');
      const line = within(week).getByRole('button', { name: 'Recruitment 0 · Development 3' });
      expect(line).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(line);
      expect(line).toHaveAttribute('aria-expanded', 'true');
      expect(within(week).getByText('Training attended')).toBeVisible();
      expect(sent(calls, 'GET', '/activity/summary').map((c) => c.url))
        .toEqual(['http://api.test/api/v1/activity/summary?membershipId=mem-rina&period=ROLLING_7D']);
    });

    it('P11-T8 AC-6 says No target yet where there is no APE target to scale', async () => {
      show({ '/activity/summary?': { body: { ...WEEK, targets: WEEK.targets.map((t) => ({ ...t, target: null })) } } });
      const week = await card(/^Activity/);
      expect(await within(week).findAllByText('No target yet')).toHaveLength(3);
    });

    it('P11-T8 AC-6 drills into the week in a dialog in the page, which closes back to where it was opened', async () => {
      show();
      const week = await card(/^Activity/);
      const drill = within(week).getByRole('button', { name: 'Last 7 days' });
      await waitFor(() => expect(drill).toBeEnabled());

      await userEvent.click(drill);

      // Its module is fetched on the first opening (P18.99-T16).
      const dialog = await screen.findByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
      expect(dialog).toHaveAccessibleDescription('Last 7 days · category breakdown');
      const rows = within(dialog).getAllByRole('row').map((r) => [...r.children].map((c) => c.textContent));
      expect(rows).toEqual([
        ['Category', 'Logged', 'Target (pro-rated)'],
        ['Set appointment', '14', '16'],
        ['Sales meeting', '4', '5'],
        ['Submission polis', '1', '1'],
        ['Candidate leads', '0', '–'],
        ['Recruitment presentations', '0', '–'],
        ['Training attended', '1', '–'],
        ['Coaching sessions', '1', '–'],
        ['Team activities', '1', '–'],
      ]);
      // It starts on itself, at its title: a box that starts on Close, at its foot, opens scrolled past it.
      expect(dialog).toHaveFocus();
      await userEvent.tab();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(drill).toHaveFocus();
    });
  });

  describe('the Leads card (UI-062, UI-081)', () => {
    /** Ibu Shinta has no next action at all; Pak Gilang a note and no date; Desi is dated; Hana late. */
    const SHINTA = lead({ id: 'l-shinta', name: 'Ibu Shinta Maharani', nextActionDate: null, nextActionNote: null, statusCode: 'NOT_YET_APPROACHED', version: 1 });
    const GILANG = lead({ id: 'l-gilang', name: 'Pak Gilang Ramadhan', nextActionDate: null, nextActionNote: 'Second meeting, with his wife.', version: 2 });
    const HANA = lead({ id: 'l-hana', name: 'Hana Permata', nextActionDate: '2026-09-30', nextActionNote: 'Call back', flags: ['overdue'], overdueDays: 2, contact: { phone: '+6281234567890', email: null } });
    const WON = lead({ id: 'l-won', name: 'Won One', outcome: 'won' });
    const rowsOf = (leads: HTMLElement) => [...leads.querySelectorAll('[data-coachee-lead]')].map((li) => li.getAttribute('data-coachee-lead'));

    it('UI-062 compact rows: the name, type and stage pills, one next-action line, WhatsApp and Call; read once, by owner', async () => {
      const { calls } = show({ 'GET /leads?owner=mem-rina': { body: page([lead(), HANA, WON]) } });
      const leads = await card(/^Leads/);
      await within(leads).findByRole('button', { name: 'Desi Pratama' });

      expect(within(leads).getByRole('heading', { level: 2 })).toHaveTextContent('Leads· 2');
      const desi = leads.querySelector('[data-coachee-lead="l-desi"]') as HTMLElement;
      expect(within(desi).getByText('Sales')).toBeInTheDocument();
      expect(within(desi).getByText('Follow-up')).toHaveAttribute('data-tone', 'grey');
      expect(desi.querySelector('[data-next-action]')).toHaveTextContent('5 Oct· Confirm submission paperwork');
      // UI-081: both, enabled, round and solid; no disabled button, no 📞.
      const whatsApp = within(desi).getByRole('button', { name: 'Send a WhatsApp message to Desi Pratama' });
      expect(whatsApp).toBeEnabled();
      expect(within(desi).getByRole('button', { name: 'Call Desi Pratama' })).toBeEnabled();
      expect(leads.textContent).not.toContain('📞');
      // A number saved: one tap opens WhatsApp, no sheet.
      const hana = leads.querySelector('[data-coachee-lead="l-hana"]') as HTMLElement;
      expect(within(hana).getByRole('link', { name: 'Send a WhatsApp message to Hana Permata' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/62/));
      // The closed lead is the one line, never a row.
      expect(rowsOf(leads)).toEqual(['l-hana', 'l-desi']);
      expect(leads.querySelector('[data-closed-line]')).toHaveTextContent('Closed: Won 1 · Lost 0');
      const reads = calls.filter((c) => c.url.includes('/leads?'));
      expect(reads.map((c) => new URL(c.url).searchParams.get('owner'))).toEqual(['mem-rina']);
    });

    it('UI-062 Ibu Shinta shows Isi tindakan and Pak Gilang Isi tanggal: no lead disappears for lack of a date, and they come first', async () => {
      show({ 'GET /leads?owner=mem-rina': { body: page([lead(), HANA, GILANG, SHINTA]) } });
      const leads = await card(/^Leads/);
      await within(leads).findByRole('button', { name: 'Ibu Shinta Maharani' });

      expect(rowsOf(leads)).toEqual(['l-gilang', 'l-shinta', 'l-hana', 'l-desi']);
      const shinta = leads.querySelector('[data-coachee-lead="l-shinta"]') as HTMLElement;
      const fill = within(shinta).getByRole('button', { name: 'Add an action' });
      expect(fill).toHaveClass('text-pill-red-ink');
      expect(fill.querySelector('svg')).not.toBeNull();
      const gilang = leads.querySelector('[data-coachee-lead="l-gilang"]') as HTMLElement;
      expect(within(gilang).getByLabelText('Next action date for Pak Gilang Ramadhan')).toHaveAttribute('type', 'date');
      expect(gilang).toHaveTextContent('Add a date· Second meeting, with his wife.');
      // Hidden on a phone when there is nothing closed (D-08).
      expect(leads.querySelector('[data-closed-line]')).toHaveClass('max-md:hidden');
    });

    it('UI-062 Isi tanggal saves the date to the lead, pinned to its version, and reads the session again for Dari leads', async () => {
      const { calls } = show({
        'GET /leads?owner=mem-rina': { body: page([GILANG]) },
        'PATCH /leads/l-gilang': ({ body }) => ({ body: { ...GILANG, nextActionDate: (body as { nextActionDate: string }).nextActionDate, version: 3 } }),
      });
      const leads = await card(/^Leads/);
      const before = sent(calls, 'GET', '/coaching/sessions/s-1').length;
      fireEvent.change(await within(leads).findByLabelText('Next action date for Pak Gilang Ramadhan'), { target: { value: '2026-10-06' } });

      await waitFor(() => expect(sent(calls, 'PATCH', '/leads/l-gilang')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PATCH', '/leads/l-gilang')[0])).toEqual({ nextActionDate: '2026-10-06', version: 2 });
      await waitFor(() => expect(sent(calls, 'GET', '/coaching/sessions/s-1').length).toBeGreaterThan(before));
      expect((leads.querySelector('[data-coachee-lead="l-gilang"]') as HTMLElement).querySelector('[data-next-action]')).toHaveTextContent('6 Oct');
    });

    it('UI-062 a row opens the lead sheet; Isi tindakan opens it too; + Add lead opens a new one', async () => {
      show({ 'GET /leads?owner=mem-rina': { body: page([lead(), SHINTA]) }, 'GET /leads/l-desi': { body: { ...lead(), history: [] } }, 'GET /leads/l-shinta': { body: { ...SHINTA, history: [] } } });
      const leads = await card(/^Leads/);
      await userEvent.click(await within(leads).findByRole('button', { name: 'Desi Pratama' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await userEvent.click(within(leads).getByRole('button', { name: 'Add an action' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await userEvent.click(within(leads).getByRole('button', { name: '+ Add lead' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('UI-062 shows five rows and Show all (n) with six or more; open, Show fewer at the foot; a search shows every match', async () => {
      const many = Array.from({ length: 7 }, (_, i) => lead({ id: `l-${i}`, name: `Lead Number ${i}`, nextActionDate: `2026-10-1${i}` }));
      show({ 'GET /leads?owner=mem-rina': { body: page(many) } });
      const leads = await card(/^Leads/);
      await within(leads).findByRole('button', { name: 'Lead Number 0' });

      expect(rowsOf(leads)).toHaveLength(5);
      const more = within(leads).getByRole('button', { name: 'Show all (7)' });
      expect(more).toHaveClass('h-11');
      await userEvent.click(more);
      expect(rowsOf(leads)).toHaveLength(7);
      expect(within(leads).getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
      await userEvent.click(within(leads).getByRole('button', { name: 'Show fewer' }));
      expect(rowsOf(leads)).toHaveLength(5);

      await userEvent.type(within(leads).getByRole('searchbox'), 'number');
      expect(rowsOf(leads)).toHaveLength(7);
      expect(within(leads).queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    });

    it('UI-062 fewer than six leads: no toggle', async () => {
      show();
      const leads = await card(/^Leads/);
      await within(leads).findByRole('button', { name: 'Desi Pratama' });
      expect(within(leads).queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    });

    it('UI-081 with no number, WhatsApp asks for one, saves it to the lead and then opens WhatsApp; a bad number says so inline', async () => {
      const open = vi.fn(() => ({ location: { href: '' }, close: vi.fn() }));
      vi.stubGlobal('open', open);
      const { calls } = show({
        'PATCH /leads/l-desi': ({ body }) => ({ body: lead({ contact: (body as { contact: { phone: string } }).contact, version: 4 }) }),
      });
      const leads = await card(/^Leads/);
      await userEvent.click(await within(leads).findByRole('button', { name: 'Send a WhatsApp message to Desi Pratama' }));
      const sheet = await screen.findByRole('dialog', { name: 'Enter WhatsApp number' });
      const field = within(sheet).getByLabelText('WhatsApp number');
      await userEvent.type(field, '12');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
      expect(await within(sheet).findByText(/Enter 9 to 13 digits after \+62\./)).toBeInTheDocument();
      expect(sent(calls, 'PATCH', '/leads/l-desi')).toHaveLength(0);

      await userEvent.clear(field);
      await userEvent.type(field, '0812 3456 7890');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(sent(calls, 'PATCH', '/leads/l-desi')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PATCH', '/leads/l-desi')[0]).contact.phone).toBe('+6281234567890');
    });

    it('UI-062 a finalized session adds no lead and dates nothing: Isi tanggal is words, the rows still open read-only', async () => {
      show({
        'GET /coaching/sessions/s-1': { body: finalized() },
        'GET /leads?owner=mem-rina': { body: page([GILANG, SHINTA]) },
      });
      const leads = await card(/^Leads/);
      await within(leads).findByRole('button', { name: 'Pak Gilang Ramadhan' });
      expect(within(leads).queryByRole('button', { name: '+ Add lead' })).not.toBeInTheDocument();
      expect(within(leads).queryByLabelText(/Next action date for/)).not.toBeInTheDocument();
      expect(within(leads).queryByRole('button', { name: 'Add an action' })).not.toBeInTheDocument();
      expect(leads).toHaveTextContent('Add an action');
      expect(leads).toHaveTextContent('Add a date');
    });
  });

  describe('tips and action items', () => {
    it('ADR-0137: each round + is the primary — amber with navy text, an action — and a real button', async () => {
      show();
      const tips = await card('Coaching tips');
      const next = await card('Next action items');
      for (const add of [within(tips).getByRole('button', { name: 'Add tip' }), within(next).getByRole('button', { name: 'Add action' })]) {
        expect(add).toHaveClass('bg-amber', 'text-navy', 'rounded-full');
        expect(add).not.toHaveClass('bg-navy');
        expect(add).toHaveAttribute('type', 'button');
      }
    });

    it('P11-T8 AC-8 adds a tip with +, focused on Type the tip…, saved once it is left', async () => {
      const { calls } = show();
      const tips = await card('Coaching tips');

      await userEvent.click(within(tips).getByRole('button', { name: 'Add tip' }));
      const blank = within(tips).getByLabelText('Tip 2');
      expect(blank).toHaveFocus();
      expect(blank).toHaveAttribute('placeholder', 'Type the tip…');
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(0);

      await userEvent.type(blank, 'Ask one more question before the pitch');
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(0);
      await userEvent.tab();

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).tips).toEqual([
        { tipId: 't-1', text: 'Slow down on the opening line — let the client finish before pitching.' },
        { text: 'Ask one more question before the pitch' },
      ]);
      // Left again unchanged, it writes nothing more; the server's id is kept for the next save.
      await userEvent.click(within(tips).getByLabelText('Tip 2'));
      await userEvent.tab();
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1);
    });

    it('P11-T8 AC-8 removes a tip with ✕, and says the + is above once there is none', async () => {
      const { calls } = show();
      const tips = await card('Coaching tips');

      await userEvent.click(within(tips).getByRole('button', { name: 'Remove tip 1' }));

      expect(within(tips).getByText('No tips added yet — tap + above to add one.')).toBeInTheDocument();
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).tips).toEqual([]);
    });

    it('P11-T8 AC-9 lists her leads’ next actions, nearest first, falling back to Follow up with {name}', async () => {
      show();
      const next = await card('Next action items');

      // UI-061: sentence case, the ⚡ with its ⓘ in place of *(OTOMATIS)*.
      const heading = within(next).getByRole('heading', { name: /From leads$/ });
      expect(heading.querySelector('[data-auto-marker]')).not.toBeNull();
      expect(within(next).getByRole('heading', { name: 'Other' })).toBeInTheDocument();
      expect(next.textContent).not.toMatch(/AUTOMATIC|OTOMATIS|\(automatic\)/);
      const fromLeads = within(next).getAllByRole('list')[0];
      expect(within(fromLeads).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        '5 OctConfirm submission paperworkDesi Pratama',
        '7 OctFollow up with Hana PermataHana Permata',
      ]);
      // A lead's action links into its lead, with no ✕: it is the lead's.
      expect(within(fromLeads).getByRole('button', { name: 'Open Desi Pratama’s lead' })).toBeInTheDocument();
      expect(within(fromLeads).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    });

    it('P11-T8 AC-9 says when no lead has a next action date, and when nothing else is planned', async () => {
      show({ 'GET /coaching/sessions/s-1': { body: session({ leadActions: [], actionItems: [] }) } });
      const next = await card('Next action items');
      expect(within(next).getByText('No leads have a next action date set yet.')).toBeInTheDocument();
      expect(within(next).getByText('No other action items yet — tap + above to add one.')).toBeInTheDocument();
    });

    it('UI-060 adds an action dated a week ahead — the server’s defaultDueDate — and refuses a second blank one', async () => {
      const { calls } = show({ 'GET /coaching/sessions/s-1': { body: session({ actionItems: [] }) } });
      const next = await card('Next action items');

      await userEvent.click(within(next).getByRole('button', { name: 'Add action' }));
      const text = within(next).getByLabelText('Action item 1');
      expect(text).toHaveFocus();
      expect(text).toHaveAttribute('placeholder', 'What needs to happen…');
      // Every action always has a date (UI-060): the office's today, 2 October, plus seven — never blank.
      expect(within(next).getByLabelText('Change the date: Action item 1')).toHaveValue('2026-10-09');

      await userEvent.click(within(next).getByRole('button', { name: 'Add action' }));
      expect(within(next).getByRole('alert')).toHaveTextContent('Fill in the action item you already started before adding another.');
      expect(within(next).getAllByLabelText(/^Action item \d$/)).toHaveLength(1);
      expect(text).toHaveFocus();

      await userEvent.type(text, 'Book the field visit with Desi');
      expect(within(next).queryByRole('alert')).not.toBeInTheDocument();
      await userEvent.tab();
      // The blank row was saved as the focus left it for +, as the prototype allows; the server named it,
      // and the text goes to that row.
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(2));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).actionItems).toEqual([{ text: '', dueDate: '2026-10-09' }]);
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[1]).actionItems)
        .toEqual([{ itemId: 'a-new-0', text: 'Book the field visit with Desi', dueDate: '2026-10-09' }]);
    });

    it('P11-T8 AC-9 orders other items by date, undated last, and removes one with ✕', async () => {
      const { calls } = show({
        'GET /coaching/sessions/s-1': {
          body: session({
            actionItems: [
              { itemId: 'a-1', text: 'Undated', dueDate: null },
              { itemId: 'a-2', text: 'Later', dueDate: '2026-10-09' },
              { itemId: 'a-3', text: 'Sooner', dueDate: '2026-10-04' },
            ],
          }),
        },
      });
      const next = await card('Next action items');
      expect(within(next).getAllByLabelText(/^Action item \d$/).map((i) => (i as HTMLInputElement).value)).toEqual(['Sooner', 'Later', 'Undated']);

      await userEvent.click(within(next).getByRole('button', { name: 'Remove: Undated' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).actionItems.map((a: { itemId: string }) => a.itemId)).toEqual(['a-2', 'a-3']);
    });
  });

  describe('finalize and Edit again', () => {
    it('P11-T8 AC-10, UI-060 saves what is unsaved, finalizes at the version that answered, says Saved, and locks the session', async () => {
      const { calls } = show({ 'POST /coaching/sessions/s-1/finalize': { body: finalized() } });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByRole('textbox', { name: 'Tip 1' }), '!');

      const bar = document.querySelector('[data-finalize-bar="draft"]') as HTMLElement;
      // UI-062: pinned above the tab bar below 1024px, the sticky column's foot from 1024px; *Draf · n tindakan* beside it.
      expect(bar).toHaveClass('fixed', 'bottom-[var(--tab-bar-space,0px)]', 'lg:static');
      expect(bar).toHaveTextContent('Draft · 3 actions');
      const finalize = within(bar).getByRole('button', { name: 'Finalize this session' });
      expect(finalize).not.toHaveTextContent('✓');
      expect(screen.queryByText(/Coaching is only counted as done once finalized/)).not.toBeInTheDocument();
      await userEvent.click(finalize);

      // UI-060: *Tersimpan*, then the green strip.
      await toastSays('Saved');
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1);
      expect(bodyOf(sent(calls, 'POST', '/finalize')[0])).toEqual({ version: 2 });

      const done = document.querySelector('[data-finalize-bar="finalized"]') as HTMLElement;
      expect(done).toHaveTextContent('Finalized 2 Oct');
      expect(within(done).getByRole('button', { name: 'Edit again' })).toHaveClass('h-11', 'rounded-pill');
      expect(within(sessionCard()).getByText('Finalized')).toHaveAttribute('data-tone', 'green');
      // The lock (`Overall.html:1389-1417`): no add, no remove, inputs as text, the target not a control.
      for (const name of ['Add tip', 'Add action', '+ Add lead', 'Remove tip 1', 'Finalize this session']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('textbox', { name: 'Tip 1' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /^Action item/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox', { name: /Bp\. Andi/ })[0]).toBeDisabled();
      const goal = await card('Goal');
      expect(within(goal).queryByRole('button')).not.toBeInTheDocument();
      // The history is read again, so the finalized session is among the past ones.
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/sessions').length).toBeGreaterThan(1);
    });

    it('UI-060 a cleared date: Finalkan scrolls to it, outlines it red with Pilih tanggal, and says the count above the button', async () => {
      const scrolled = vi.fn();
      Element.prototype.scrollIntoView = scrolled;
      const { calls } = show({
        'GET /coaching/sessions/s-1': {
          body: session({
            actionItems: [
              { itemId: 'a-1', text: 'Dated', dueDate: '2026-10-09' },
              { itemId: 'a-2', text: 'Run the comparison', dueDate: null },
              { itemId: 'a-3', text: 'Block Tuesday mornings', dueDate: null },
            ],
          }),
        },
        'POST /coaching/sessions/s-1/finalize': refused(422, 'COACHING_SESSION_INCOMPLETE', 'Every action item needs a date.', {
          rule: 'UNDATED_ACTION_ITEM', count: 2, itemIds: ['a-2', 'a-3'],
        }),
      });
      const next = await card('Next action items');
      const finalize = screen.getByRole('button', { name: 'Finalize this session' });
      await userEvent.click(finalize);

      const message = await screen.findByRole('alert');
      expect(message).toHaveTextContent('Every action item needs a date before finalizing. (2)');
      expect(message).toHaveClass('text-md', 'text-pill-red-ink');
      expect(message.querySelector('svg')).not.toBeNull();
      // Right above the button, in the same bar; the button still enabled.
      expect(message.closest('[data-finalize-bar]')).toContainElement(finalize);
      expect(finalize).toBeEnabled();
      const invalid = next.querySelectorAll('[data-action-row][data-invalid]');
      expect(invalid).toHaveLength(2);
      for (const row of invalid) expect(row).toHaveTextContent('Choose a date');
      expect(within(invalid[0] as HTMLElement).getByLabelText(/^Change the date:/)).toHaveAttribute('aria-invalid', 'true');
      expect(scrolled).toHaveBeenCalled();
      expect(sent(calls, 'POST', '/finalize')).toHaveLength(1);

      // Dating one counts down; dating the last takes the message away.
      fireEvent.change(within(invalid[0] as HTMLElement).getByLabelText(/^Change the date:/), { target: { value: '2026-10-10' } });
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('(1)'));
    });

    it.each([
      [{ rule: 'NO_ACTION_ITEM' }, 'Add at least one action item before finalizing.'],
      [{ rule: 'EMPTY_TIP' }, 'Fill in or remove the empty coaching tip before finalizing.'],
      [{ rule: 'EMPTY_ACTION_ITEM' }, 'Fill in or remove the empty action item before finalizing.'],
      [{ rule: 'UNDATED_ACTION_ITEM' }, 'Every action item needs a date before finalizing.'],
      [{ rule: 'LEAD_THIS_MONTH_UNDATED', leadId: 'l-alvin', leadName: 'Alvin Sanjaya' }, 'Alvin Sanjaya is tagged "this month" but has no next action date set — add one before finalizing.'],
    ])('P11-T8 AC-10 says a refused finalize in the prototype’s sentence, from %o', async (details, sentence) => {
      show({ 'POST /coaching/sessions/s-1/finalize': refused(422, 'COACHING_SESSION_INCOMPLETE', 'The server’s own words', details) });
      await card('Coaching tips');

      await userEvent.click(screen.getByRole('button', { name: 'Finalize this session' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(sentence);
      expect(screen.queryByText('The server’s own words')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Finalize this session' })).toBeEnabled();
    });

    it('P11-T8 AC-10 shows any other refusal as the server words it', async () => {
      show({ 'POST /coaching/sessions/s-1/finalize': refused(404, 'NOT_FOUND', 'Not found') });
      await card('Coaching tips');
      await userEvent.click(screen.getByRole('button', { name: 'Finalize this session' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
    });

    it('P11-T8 AC-10 asks the reason for Edit again, saying she reads it, and reopens', async () => {
      const { calls } = show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized() },
        'POST /coaching/sessions/s-1/reopen': { body: session({ status: 'reopened', version: 4, date: '2026-10-02' }) },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Edit again' }));

      // Its module is fetched on the first opening (P18.99-T16).
      const dialog = await screen.findByRole('dialog', { name: 'Edit this session again?' });
      expect(dialog).toHaveAccessibleDescription(
        'Say why it needs changing. The reason stays with the session, and everyone who reads the session reads it — Rina Wijaya included.',
      );
      const reason = within(dialog).getByLabelText('Reason');
      expect(reason).toHaveFocus();
      const confirm = within(dialog).getByRole('button', { name: 'Edit again' });
      expect(confirm).toBeDisabled();
      await userEvent.type(reason, '  Wrong date on the follow-up  ');
      await userEvent.click(confirm);

      await toastSays('Reopened for editing — finalize again when you’re done.');
      expect(bodyOf(sent(calls, 'POST', '/reopen')[0])).toEqual({ version: 3, reason: 'Wrong date on the follow-up' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(sessionCard()).toHaveTextContent('Friday, 2 Oct 2026');
      expect(within(sessionCard()).getByText('Draft')).toBeInTheDocument();
      // UI-060: reopening keeps every field as it was.
      expect(screen.getByRole('textbox', { name: 'Tip 1' })).toHaveValue('Slow down on the opening line — let the client finish before pitching.');
      expect(screen.getByRole('button', { name: 'Finalize this session' })).toBeInTheDocument();
    });

    it('P11-T8 AC-10 shows a refused reopen in the dialog, and Cancel closes it writing nothing', async () => {
      const { calls } = show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized() },
        'POST /coaching/sessions/s-1/reopen': refused(409, 'COACHING_REOPEN_WINDOW_CLOSED', 'This session can no longer be reopened.'),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit again' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Typo');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Edit again' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('This session can no longer be reopened.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(sent(calls, 'POST', '/reopen')).toHaveLength(1);
    });

    it('P11-T8 AC-10 draws Edit again locked past the window, with a title saying until when', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ today: '2026-10-12', current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized({ date: '2026-10-02', reopenableUntil: '2026-10-09' }) },
      });

      const edit = await screen.findByRole('button', { name: 'Edit again' });
      expect(edit).toHaveAttribute('aria-disabled', 'true');
      expect(edit).toHaveAttribute('title', 'This session could be reopened until 9 Oct 2026.');
      expect(edit).toHaveAccessibleDescription('This session could be reopened until 9 Oct 2026.');
      await userEvent.click(edit);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The header names the session's own date, not the office's today (a Fix).
      expect(sessionCard()).toHaveTextContent('Friday, 2 Oct 2026');
    });

    it('P11-T8 AC-10 a finalized session still opens its past sessions, its closed leads and the Activity drill', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized({ reopenableUntil: null }) },
      });
      const week = await card(/^Activity/);
      // A reader who may not reopen it sees no Edit again at all.
      expect(screen.queryByRole('button', { name: 'Edit again' })).not.toBeInTheDocument();

      expect(screen.getByRole('link', { name: /24 Sep 2026/ })).toBeInTheDocument();
      const drill = within(week).getByRole('button', { name: 'Last 7 days' });
      await waitFor(() => expect(drill).toBeEnabled());
      await userEvent.click(drill);
      expect(await screen.findByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' })).toBeInTheDocument();
      expect(document.querySelector('[data-closed-line]')).toBeInTheDocument();
    });

    it('P11-T8 AC-8 and AC-9 say what was added once a session is finalized with nothing in it', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized({ tips: [], actionItems: [] }) },
      });
      expect(await screen.findByText('No tips were added this session.')).toBeInTheDocument();
      expect(screen.getByText('No other action items were added this session.')).toBeInTheDocument();
    });

    it('P11-T8 AC-10 a stale save reads the session again and says so in one line', async () => {
      const { calls } = show({
        'PUT /coaching/sessions/s-1': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/sessions/s-1': [
          { body: session() },
          { body: session({ version: 5, tips: [{ tipId: 't-1', text: 'Saved on the other device' }] }) },
        ],
      });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), ' more');
      await userEvent.tab();

      expect(await screen.findByText('This session was changed somewhere else, so it has been read again.')).toHaveAttribute('role', 'status');
      expect(within(tips).getByLabelText('Tip 1')).toHaveValue('Saved on the other device');
      expect(sent(calls, 'GET', '/coaching/sessions/s-1')).toHaveLength(2);
      expect(screen.queryByText('Somebody saved first.')).not.toBeInTheDocument();
    });

    it('shows any other refused save above the session', async () => {
      show({ 'PUT /coaching/sessions/s-1': refused(400, 'VALIDATION_FAILED', 'At most 50 tips.') });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), '!');
      await userEvent.tab();
      expect(await screen.findByRole('alert')).toHaveTextContent('At most 50 tips.');
    });
  });

  /**
   * **A field that saves itself says so** (P18.95-T1 AC-5; ADR-0167 §5; the client's UI review of 2026-10-26, UI-007):
   * the draft is saved as it is edited, and each field — a tip, an action item, last week's tick and date — says
   * *Saving… → Saved ✓* beside it, or *Couldn't save — retry*.
   */
  describe('P18.95-T1 AC-5 — the draft’s fields say their save', () => {
    const tip = 'Slow down on the opening line — let the client finish before pitching.';

    it('P18.95-T1 AC-5: a tip left changed says Saved ✓ under it; one left untouched says nothing', async () => {
      const { calls } = show();
      const tips = await card('Coaching tips');
      const box = within(tips).getByLabelText('Tip 1');
      await userEvent.click(box);
      await userEvent.tab();
      expect(within(tips).queryByRole('status')).not.toBeInTheDocument();
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(0);

      await userEvent.type(box, '!');
      await userEvent.tab();

      const said = await within(tips).findByText('Saved ✓');
      expect(box.parentElement).toContainElement(said);
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1);
    });

    it('P18.95-T1 AC-5: a refused save offers the retry beside the tip, which sends the same words again', async () => {
      const { calls } = show({
        'PUT /coaching/sessions/s-1': [refused(500, 'INTERNAL_ERROR', 'Something went wrong.'), echoSave],
      });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), '!');
      await userEvent.tab();

      const retry = await within(tips).findByRole('button', { name: "Couldn't save — retry: Tip 1" });
      // The banner above the session still says why.
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(retry);

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(2));
      const [first, second] = sent(calls, 'PUT', '/coaching/sessions/s-1').map(bodyOf);
      expect(second.tips[0].text).toBe(`${tip}!`);
      expect(second.tips).toEqual(first.tips);
      expect(await within(tips).findByText('Saved ✓')).toBeInTheDocument();
      expect(within(tips).getByLabelText('Tip 1')).toHaveFocus();
    });

    it('P18.95-T1 AC-5: the draft is saved whole, so a later save that lands takes an earlier failure’s retry away', async () => {
      show({ 'PUT /coaching/sessions/s-1': [refused(500, 'INTERNAL_ERROR', 'Something went wrong.'), echoSave] });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), '!');
      await userEvent.tab();
      expect(await within(tips).findByRole('button', { name: "Couldn't save — retry: Tip 1" })).toBeInTheDocument();

      const lastWeek = await card("Last week's action items");
      await userEvent.click(within(lastWeek).getByRole('checkbox', { name: 'Done: Follow up with Alvin Sanjaya — no contact in 8 days' }));

      expect(await within(lastWeek).findByText('Saved ✓')).toBeInTheDocument();
      expect(within(tips).queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: last week’s tick says Saved ✓ at its row’s end', async () => {
      show();
      const lastWeek = await card("Last week's action items");
      const box = within(lastWeek).getByRole('checkbox', { name: 'Done: Follow up with Alvin Sanjaya — no contact in 8 days' });
      await userEvent.click(box);

      const said = await within(lastWeek).findByText('Saved ✓');
      expect(box.closest('li')).toContainElement(said);
    });

    it('P18.95-T1 AC-5: a stale save reads the session again and leaves nothing to retry', async () => {
      show({
        'PUT /coaching/sessions/s-1': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/sessions/s-1': [
          { body: session() },
          { body: session({ version: 5, tips: [{ tipId: 't-1', text: 'Saved on the other device' }] }) },
        ],
      });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), ' more');
      await userEvent.tab();

      expect(await screen.findByText('This session was changed somewhere else, so it has been read again.')).toBeInTheDocument();
      await waitFor(() => expect(within(tips).getByLabelText('Tip 1')).toHaveValue('Saved on the other device'));
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });
  });

  describe('the record’s controls and the reads (P11-T10, P11-T8’s browser walk)', () => {
    /**
     * `show`, with chosen reads held until the test lets them go: what has gone out while they wait is
     * what was asked for in parallel. Each request is noted as it is made, before it is answered.
     */
    const showHeld = (held: Record<string, Promise<void>>, routes: Record<string, StubReply | StubReply[]> = {}, query: Record<string, string> = {}) => {
      const stub = stubFetch({
        '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
        '/kpm/org-levels': { body: [] },
        'GET /coaching/coachees/mem-rina': { body: RINA },
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'draft' } }) },
        'GET /coaching/sessions/s-1': { body: session() },
        '/summary?for=mem-rina': { body: summary() },
        '/activity/ratios?for=mem-rina': { body: RATIOS },
        '/activity/summary?': { body: WEEK },
        'GET /leads?owner=mem-rina': { body: page([lead()]) },
        ...routes,
      });
      const answer = stub.mock.getMockImplementation()!;
      const asked: string[] = [];
      stub.mock.mockImplementation(async (url: string, init?: RequestInit) => {
        asked.push(url.replace('http://api.test/api/v1', ''));
        const wait = Object.entries(held).find(([fragment]) => url.endsWith(fragment))?.[1];
        if (wait) await wait;
        return answer(url, init);
      });
      nav.search = new URLSearchParams(query).toString();
      const view = renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>
          <CoachingSessionTabPage />
        </CoachingPersonLayout>,
        { me: LEADER },
      );
      return { ...stub, ...view, asked };
    };
    const gate = () => {
      let open!: () => void;
      const shut = new Promise<void>((resolve) => { open = resolve; });
      return { shut, open: () => act(async () => { open(); }) };
    };

    it('P11-T8’s walk: reads the history beside the person, not after them', async () => {
      const person = gate();
      const { asked } = showHeld({ '/coaching/coachees/mem-rina': person.shut });

      await waitFor(() => expect(asked).toContain('/coaching/coachees/mem-rina/sessions'));
      expect(asked).toContain('/coaching/coachees/mem-rina');
      await person.open();
      expect(await card("Last week's action items")).toBeInTheDocument();
      // Taken once: the workspace did not ask again for what the shell already had.
      expect(asked.filter((u) => u === '/coaching/coachees/mem-rina/sessions')).toHaveLength(1);
    });

    it('P11-T8’s walk: once the history names the session, the cards read beside the session, not after it', async () => {
      const held = gate();
      const { asked } = showHeld({ '/coaching/sessions/s-1': held.shut });

      await waitFor(() => expect(asked).toEqual(expect.arrayContaining([
        '/coaching/sessions/s-1',
        '/summary?for=mem-rina',
        '/activity/ratios?for=mem-rina',
        '/activity/summary?membershipId=mem-rina&period=ROLLING_7D',
      ])));
      await waitFor(() => expect(asked.some((u) => u.startsWith('/leads?') && u.includes('owner=mem-rina'))).toBe(true));
      // The session is still on its way: its parts wait in a skeleton, and nothing can be edited yet.
      expect(screen.queryByRole('region', { name: 'Coaching tips' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('status').some((el) => el.textContent === 'Opening the session…')).toBe(true);
      expect(screen.queryByRole('button', { name: /this year’s target — edit/ })).not.toBeInTheDocument();

      await held.open();
      expect(await card('Coaching tips')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /this year’s target — edit/ })).toBeInTheDocument();
    });

    it('P11-T10 opens the session the address names, read beside the history, rather than the one the server would open on', async () => {
      const { asked } = showHeld({}, {
        'GET /coaching/sessions/s-0924': { body: session({ sessionId: 's-0924', status: 'reopened', version: 6, date: '2026-09-24', tips: [{ tipId: 't-9', text: 'The correction' }] }) },
      }, { session: 's-0924' });

      const tips = await card('Coaching tips');
      expect(within(tips).getByLabelText('Tip 1')).toHaveValue('The correction');
      expect(asked.filter((u) => u.startsWith('/coaching/sessions/'))).toEqual(['/coaching/sessions/s-0924']);
      expect(screen.getByRole('button', { name: 'Finalize this session' })).toBeInTheDocument();
    });

    it('P11-T10 AC-3 offers ⬇ Download as PDF beside Edit again on the finalized session, printing its frozen read', async () => {
      const print = vi.fn();
      vi.stubGlobal('print', print);
      const { calls } = show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized() },
        '/coaching/sessions/s-1/print': {
          body: {
            sessionId: 's-1', version: 3, date: '2026-10-02', coachee: { name: 'Rina Wijaya' }, coach: { name: 'Agus Santoso' },
            lastWeekItems: [], goal: null, tips: [], leadActions: [], actionItems: [],
          },
        },
      });

      // From 1024px under the strip and *Edit again*, in the sticky column; below it, a row of its own (UI-060).
      await screen.findByRole('button', { name: 'Edit again' });
      const [inBar, below] = screen.getAllByRole('button', { name: 'Download as PDF' });
      expect(inBar.closest('[data-finalize-bar]')).toContainElement(screen.getByRole('button', { name: 'Edit again' }));
      expect(inBar.parentElement).toHaveClass('max-lg:hidden');
      expect(below.parentElement).toHaveClass('lg:hidden');
      const download = inBar;
      await userEvent.click(download);

      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
      expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-1/print'))).toHaveLength(1);
      // Its coach printed it: the paper does not name them.
      expect(document.querySelector('[data-print-view] p')).toHaveTextContent(/^Friday, 2 Oct 2026 · Finalized$/);
      act(() => { window.dispatchEvent(new Event('afterprint')); });
    });

    it('P11-T10 AC-3 offers no download on a draft', async () => {
      show();
      await card('Coaching tips');
      expect(screen.queryByRole('button', { name: 'Download as PDF' })).not.toBeInTheDocument();
    });

    it('P11-T8’s walk: says the goal was updated only once the card shows it, the box holding what was saved meanwhile', async () => {
      const reread = gate();
      let summaries = 0;
      const { calls, mock } = show({
        '/summary?for=mem-rina': () => {
          summaries += 1;
          return { body: summaries === 1 ? summary() : summary({ yearly: { ...figures(1200 * M, 620 * M, 52, 580 * M), source: null } }) };
        },
      });
      // Hold the second read of the Summary — the one after the save.
      const answer = mock.getMockImplementation()!;
      mock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/summary?for=mem-rina') && summaries >= 1) await reread.shut;
        return answer(url, init);
      });

      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));
      const field = within(goal).getByLabelText('Annual APE target');
      await userEvent.clear(field);
      await userEvent.type(field, '1200000000');
      await userEvent.click(within(goal).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT' && c.url.includes('/goals/'))).toHaveLength(1));
      // Saved, not yet shown: the box stays, on what was saved, and nothing is said yet.
      expect(within(goal).getByLabelText('Annual APE target')).toHaveValue('1,200,000,000');
      expect(screen.queryByText('Goal updated — reflected across both tabs.')).not.toBeInTheDocument();

      await reread.open();
      await toastSays('Goal updated — reflected across both tabs.');
      expect(within(goal).queryByLabelText('Annual APE target')).not.toBeInTheDocument();
      expect(goal).toHaveTextContent('IDR 620M/ IDR 1.2B');
    });

    it('P11-T8’s walk: reads the last 7 days again once the annual target is saved, since its pro-rated targets follow the goal', async () => {
      const { calls } = show({
        '/activity/summary?': [
          { body: WEEK },
          { body: { ...WEEK, targets: WEEK.targets.map((t) => (t.key === 'leads' ? { ...t, target: 20 } : t)) } },
        ],
      });
      const week = await card(/^Activity/);
      expect(await within(week).findByText(/\/ 16 pro-rated/)).toBeInTheDocument();

      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));
      await userEvent.click(within(goal).getByRole('button', { name: 'Save' }));

      await toastSays('Goal updated — reflected across both tabs.');
      await waitFor(() => expect(calls.filter((c) => c.url.includes('/activity/summary'))).toHaveLength(2));
      expect(await within(week).findByText(/\/ 20 pro-rated/)).toBeInTheDocument();
    });

    it('P11-T8’s walk: a failed read after a save says so in the card, never the old target under the toast', async () => {
      show({
        '/summary?for=mem-rina': [{ body: summary() }, refused(500, 'INTERNAL_ERROR', 'Summary down')],
      });
      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));
      await userEvent.click(within(goal).getByRole('button', { name: 'Save' }));

      expect(await within(goal).findByRole('alert')).toHaveTextContent('Summary down');
      expect(goal).not.toHaveTextContent('IDR 960M');
      await toastSays('Goal updated — reflected across both tabs.');
    });
  });

  it('P11-T8 AC-11 writes none of ADR-0084’s six words, and no phase', async () => {
    show();
    const leads = await card(/^Leads/);
    await within(leads).findByRole('button', { name: 'Desi Pratama' });
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(SIX_WORDS);
    expect(main.textContent).not.toMatch(/\bphase\b/i);
  });
});
