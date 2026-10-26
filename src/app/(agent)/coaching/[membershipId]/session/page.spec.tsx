import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { act } from 'react';
import CoachingPersonLayout from '../layout';
import CoachingSessionTabPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/session',
}));

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
  finalizedAt: null, finalizedBy: null, reopenableUntil: null,
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
  reopenableUntil: '2026-10-09', ...over,
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

const show = (routes: Record<string, StubReply | StubReply[]> = {}) => {
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
    'outcome=open': { body: page([lead()]) },
    'outcome=won': { body: page([]) },
    'outcome=lost': { body: page([]) },
    'GET /goals/2026': { body: GOAL },
    'PUT /goals/2026': { body: GOAL },
    ...routes,
  });
  const view = renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingSessionTabPage /></CoachingPersonLayout>,
    { me: LEADER },
  );
  return { ...stub, ...view };
};

const card = (name: string | RegExp) => screen.findByRole('region', { name });
/** *Today's session — {date}* and its tag: one line, across its `<strong>` and its tag. */
const headerLine = () => screen.getByText((_, el) => el?.tagName === 'P' && /^Today's session — /.test(el.textContent ?? ''));
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
    it('P11-T8 AC-1 heads the tab with the office’s today and the Draft tag, before anything starts', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });

      await screen.findByRole('button', { name: 'Start coaching session' });
      const header = headerLine();
      expect(header).toHaveTextContent("Today's session — Friday, October 2, 2026 Draft");
      expect(within(header).getByText('Friday, October 2, 2026').tagName).toBe('STRONG');
    });

    it('P11-T8 AC-1 lists past sessions behind View past sessions ▾, each a row that opens its archive', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });
      const toggle = await screen.findByRole('button', { name: 'View past sessions' });
      expect(toggle).toHaveTextContent('View past sessions ▾');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: /Sep 24, 2026/ })).not.toBeInTheDocument();

      await userEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveTextContent('Hide past sessions ▴');
      const rows = within(document.getElementById(toggle.getAttribute('aria-controls')!)!).getAllByRole('link');
      expect(rows.map((r) => [r.textContent, r.getAttribute('href')])).toEqual([
        ['Sep 24, 2026 — 3 action items · 1 completedView →', '/coaching/mem-rina/archive/s-0924'],
        ['Sep 17, 2026 — 1 action item · 1 completedView →', '/coaching/mem-rina/archive/s-0917'],
      ]);

      await userEvent.click(toggle);
      expect(screen.queryByRole('link', { name: /Sep 24, 2026/ })).not.toBeInTheDocument();
    });

    it('P11-T8 AC-1 says so when there is no past session yet', async () => {
      show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history({ sessions: [] }) } });
      await userEvent.click(await screen.findByRole('button', { name: 'View past sessions' }));
      expect(screen.getByText('No past sessions yet.')).toBeInTheDocument();
    });

    it('P11-T8 AC-2 opens on ▶ Start coaching session and its line, and reads nothing about her until it starts', async () => {
      const { calls } = show({ 'GET /coaching/coachees/mem-rina/sessions': { body: history() } });

      const start = await screen.findByRole('button', { name: 'Start coaching session' });
      expect(start).toHaveTextContent('▶ Start coaching session');
      expect(screen.getByText("Opens last week's items, goals, leads, and everything else for today's 1-on-1.")).toBeInTheDocument();
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

      await toastSays('Session started — unfinished items and tips from last week carried forward.');
      expect(sent(calls, 'POST', '/coaching/coachees/mem-rina/sessions')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Start coaching session' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Action item 1')).toHaveValue('Practice a tighter close for the Rp30M+ segment');
      expect(screen.getByLabelText('Tip 1')).toHaveValue('Slow down on the opening line — let the client finish before pitching.');
      expect(await card('Goal')).toBeInTheDocument();
    });

    it('P11-T8 AC-2 says only that it started when there was no session before, and draws no Last week card', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ sessions: [] }) },
        'POST /coaching/coachees/mem-rina/sessions': { status: 201, body: session({ lastWeek: null, lastWeekItems: [], actionItems: [], tips: [] }) },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Start coaching session' }));

      await toastSays('Session started.');
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
    it('P11-T8 AC-3 lists them under From {date} session: a checkbox, a date, the Leads tag and the text, struck when done', async () => {
      show();
      const lastWeek = await card("Last week's action items");

      expect(within(lastWeek).getByText('From Sep 24 session')).toBeInTheDocument();
      const done = within(lastWeek).getByRole('checkbox', { name: 'Confirm submission paperwork with Bp. Andi' });
      expect(done).toBeChecked();
      expect(within(lastWeek).getByText('Confirm submission paperwork with Bp. Andi')).toHaveClass('line-through');
      const open = within(lastWeek).getByRole('checkbox', { name: 'Follow up with Alvin Sanjaya — no contact in 8 days' });
      expect(open).not.toBeChecked();
      expect(within(lastWeek).getByText('Follow up with Alvin Sanjaya — no contact in 8 days')).not.toHaveClass('line-through');
      expect(within(lastWeek).getByText('Leads · Alvin Sanjaya')).toBeInTheDocument();
      expect(within(lastWeek).getAllByLabelText(/^Date, /).map((d) => (d as HTMLInputElement).value)).toEqual(['2026-09-24', '2026-09-24']);
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
      const date = within(lastWeek).getByLabelText('Date, Follow up with Alvin Sanjaya — no contact in 8 days');
      await userEvent.clear(date);
      await userEvent.type(date, '2026-10-06');

      await waitFor(() => expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1').at(-1)!).lastWeekItems[1])
        .toEqual({ itemId: 'lw-2', done: true, dueDate: '2026-10-06' }));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1').at(-1)!).version).toBeGreaterThan(1);
    });
  });

  describe('the Goal card', () => {
    it('P11-T8 AC-4 shows the month and the year as her Summary does, in one money formatter, with what remains', async () => {
      const { calls } = show();
      const goal = await card('Goal');

      await within(goal).findByText(/Rp 65\.600\.000/);
      expect(goal).toHaveTextContent('Rp 65.600.000 / Rp 80.000.000');
      expect(goal).toHaveTextContent('82%');
      expect(goal).toHaveTextContent('Rp 14.400.000 remaining this month.');
      expect(goal).toHaveTextContent('Rp 620.000.000 / Rp 960.000.000');
      expect(goal).toHaveTextContent('65%');
      expect(goal).toHaveTextContent('Rp 340.000.000 remaining this year.');
      expect(within(goal).getByRole('progressbar', { name: 'This month’s target' })).toHaveAttribute('aria-valuenow', '82');
      expect(within(goal).getByText('Click this year’s target to edit')).toBeInTheDocument();
      // One control on the card: the annual target. This month's target is a figure.
      expect(within(goal).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rp 960.000.000, this year’s target — edit']);
      expect(calls.filter((c) => c.url.includes('/summary?for=mem-rina')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/summary?for=mem-rina']);
    });

    it('P11-T8 AC-4 saves the annual target deliberately, in the session, with the plan the server holds', async () => {
      const { calls } = show();
      const goal = await card('Goal');
      await userEvent.click(await within(goal).findByRole('button', { name: /this year’s target — edit/ }));

      const field = within(goal).getByLabelText('Annual APE target');
      expect(field).toHaveFocus();
      expect(field).toHaveValue('960.000.000');
      await userEvent.clear(field);
      await userEvent.type(field, '1200000000');
      expect(field).toHaveValue('1.200.000.000');
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
      expect(within(goal).getByLabelText('Annual APE target')).toHaveValue('960.000.000');
    });

    it('P11-T8 AC-4 says No goal set, and the annual target can still be set', async () => {
      const { calls } = show({ '/summary?for=mem-rina': { body: summary({ goal: { set: false, savedAt: null } }) } });
      const goal = await card('Goal');

      expect(await within(goal).findByText('No goal set')).toBeInTheDocument();
      expect(within(goal).queryByText('Click this year’s target to edit')).not.toBeInTheDocument();
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
      expect(await card('Ratios')).toBeInTheDocument();
    });
  });

  describe('Ratios and Activity', () => {
    it('P11-T8 AC-5 reads her ratios on her rung, the last 30 days, each against its benchmark', async () => {
      const { calls } = show();
      const ratios = await card('Ratios');

      expect(within(ratios).getByText('Last 30 days')).toBeInTheDocument();
      await within(ratios).findByText('18.0%');
      const lines = within(ratios).getAllByRole('listitem').map((li) => li.textContent);
      expect(lines).toEqual([
        'Selling success rate18.0%Benchmark: 15.0%',
        'Leads per activity0.35Benchmark: 0.30',
        'Recruitment success rate–Benchmark: 15.0%',
        // Each side's share of the two, as her own Activity Ratios card writes it (P13.1-T6 AC-7).
        'Sales vs. Recruitment70% Selling · 30% RecruitmentBenchmark: 35%–65% each side',
      ]);
      expect(within(ratios).getByText('18.0%')).toHaveClass('text-success');
      expect(within(ratios).getByText('–')).toHaveClass('text-muted');
      expect(sent(calls, 'GET', '/activity/ratios').map((c) => c.url)).toEqual(['http://api.test/api/v1/activity/ratios?for=mem-rina']);
    });

    it('P11-T8 AC-5 says when her role has no ratios', async () => {
      show({ '/activity/ratios?for=mem-rina': { body: { ...RATIOS, ratios: [] } } });
      const ratios = await card('Ratios');
      expect(await within(ratios).findByText('There are no ratios for her role yet.')).toBeInTheDocument();
    });

    it('P11-T8 AC-6 shows the last 7 days against pro-rated targets, then the section chips as the Summary groups them', async () => {
      const { calls } = show();
      const week = await card(/^Activity → view full dashboard/);

      expect(within(week).getByText('Last 7 days')).toBeInTheDocument();
      await within(week).findByText('Set appointment');
      expect(week).toHaveTextContent('Set appointment14 / 16 pro-rated');
      expect(week).toHaveTextContent('Sales meeting4 / 5 pro-rated');
      expect(week).toHaveTextContent('Submission polis1 / 1 pro-rated');
      expect(within(week).getByRole('region', { name: 'Recruitment' })).toHaveTextContent('Recruitment0Candidate leads0Recruitment presentations0');
      expect(within(week).getByRole('region', { name: 'Development' })).toHaveTextContent('Development3Training attended1Coaching sessions1Team activities1');
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
      const drill = within(week).getByRole('button', { name: '→ view full dashboard' });
      await waitFor(() => expect(drill).toBeEnabled());

      await userEvent.click(drill);

      const dialog = screen.getByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
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

  describe('the Leads card', () => {
    it('P11-T8 AC-7 mounts the leads table for her: the card’s toolbar, her leads only, read and closed, and no delete', async () => {
      const { calls } = show();
      const leads = await card('Leads');

      expect(await within(leads).findByDisplayValue('Desi Pratama')).toBeInTheDocument();
      expect(within(leads).getByRole('table', { name: 'Her leads' })).toBeInTheDocument();
      expect(within(leads).getByRole('searchbox', { name: 'Search leads' })).toHaveAttribute('placeholder', 'Search leads…');
      expect(within(leads).getByLabelText('Filter by type')).toHaveDisplayValue('All types');
      expect(within(leads).getByRole('button', { name: '+ Add lead' })).toBeInTheDocument();
      expect(within(leads).queryByRole('button', { name: 'Delete lead' })).not.toBeInTheDocument();
      const reads = calls.filter((c) => c.url.includes('/leads?')).map((c) => new URL(c.url).searchParams.get('owner'));
      expect(reads.length).toBe(3);
      expect(new Set(reads)).toEqual(new Set(['mem-rina']));
    });

    it('P11-T8 AC-7 pins a write to the version its row was read at, and reads the session again when it moves a next action', async () => {
      const { calls } = show({
        'PATCH /leads/l-desi': ({ body }) => ({ body: lead({ ...(body as object), version: 4 }) }),
      });
      const leads = await card('Leads');
      await within(leads).findByDisplayValue('Desi Pratama');
      const before = sent(calls, 'GET', '/coaching/sessions/s-1').length;

      fireEvent.change(within(leads).getByLabelText('Next action date, row 1'), { target: { value: '2026-10-09' } });

      await waitFor(() => expect(sent(calls, 'PATCH', '/leads/l-desi')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PATCH', '/leads/l-desi')[0])).toEqual({ nextActionDate: '2026-10-09', version: 3 });
      await waitFor(() => expect(sent(calls, 'GET', '/coaching/sessions/s-1').length).toBeGreaterThan(before));
    });

    it('P11-T8 AC-7 toasts a status move in the prototype’s words', async () => {
      show({ 'PATCH /leads/l-desi/status': ({ body }) => ({ body: lead({ statusCode: (body as { statusCode: string }).statusCode, version: 4 }) }) });
      const leads = await card('Leads');
      await within(leads).findByDisplayValue('Desi Pratama');

      await userEvent.selectOptions(within(leads).getByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      await toastSays('Desi Pratama\'s status updated to "Paid and issued".');
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

      expect(within(tips).getByText('No tips added yet — click + above to add one.')).toBeInTheDocument();
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).tips).toEqual([]);
    });

    it('P11-T8 AC-9 lists her leads’ next actions, nearest first, falling back to Follow up with {name}', async () => {
      show();
      const next = await card('Next action items');

      expect(within(next).getByRole('heading', { name: 'From leads (automatic)' })).toBeInTheDocument();
      const fromLeads = within(next).getAllByRole('list')[0];
      expect(within(fromLeads).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Oct 5Leads · Desi PratamaConfirm submission paperwork',
        'Oct 7Leads · Hana PermataFollow up with Hana Permata',
      ]);
    });

    it('P11-T8 AC-9 says when no lead has a next action date, and when nothing else is planned', async () => {
      show({ 'GET /coaching/sessions/s-1': { body: session({ leadActions: [], actionItems: [] }) } });
      const next = await card('Next action items');
      expect(within(next).getByText('No leads have a next action date set yet.')).toBeInTheDocument();
      expect(within(next).getByText('No other action items yet — click + above to add one.')).toBeInTheDocument();
    });

    it('P11-T8 AC-9 adds an action dated the office’s today, and refuses a second blank one in the prototype’s words', async () => {
      const { calls } = show({ 'GET /coaching/sessions/s-1': { body: session({ actionItems: [] }) } });
      const next = await card('Next action items');

      await userEvent.click(within(next).getByRole('button', { name: 'Add action' }));
      const text = within(next).getByLabelText('Action item 1');
      expect(text).toHaveFocus();
      expect(text).toHaveAttribute('placeholder', 'What needs to happen…');
      expect(within(next).getByLabelText('Date, action item 1')).toHaveValue('2026-10-02');

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
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).actionItems).toEqual([{ text: '', dueDate: '2026-10-02' }]);
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[1]).actionItems)
        .toEqual([{ itemId: 'a-new-0', text: 'Book the field visit with Desi', dueDate: '2026-10-02' }]);
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

      await userEvent.click(within(next).getByRole('button', { name: 'Remove action item 3' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/sessions/s-1')[0]).actionItems.map((a: { itemId: string }) => a.itemId)).toEqual(['a-2', 'a-3']);
    });
  });

  describe('finalize and Edit again', () => {
    it('P11-T8 AC-10 saves what is unsaved, finalizes at the version that answered, and locks the session', async () => {
      const { calls } = show({ 'POST /coaching/sessions/s-1/finalize': { body: finalized() } });
      const tips = await card('Coaching tips');
      await userEvent.type(within(tips).getByLabelText('Tip 1'), '!');

      const finalize = screen.getByRole('button', { name: 'Finalize this session' });
      expect(finalize).toHaveTextContent('✓ Finalize this session');
      expect(screen.getByText('Coaching is only counted as done once finalized. You can keep editing everything until then.')).toBeInTheDocument();
      await userEvent.click(finalize);

      await toastSays('Session finalized — this coaching is now marked done, and locked to view-only.');
      expect(sent(calls, 'PUT', '/coaching/sessions/s-1')).toHaveLength(1);
      expect(bodyOf(sent(calls, 'POST', '/finalize')[0])).toEqual({ version: 2 });

      expect(screen.getByText('✓ Finalized Friday, October 2, 2026')).toBeInTheDocument();
      expect(headerLine()).toHaveTextContent('Finalized');
      // The lock (`Overall.html:1389-1417`): no add, no remove, inputs as text, the target not a control.
      for (const name of ['Add tip', 'Add action', '+ Add lead', 'Remove tip 1', 'Finalize this session']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByLabelText('Tip 1')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Action item/)).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox', { name: /Bp\. Andi/ })[0]).toBeDisabled();
      expect(screen.getByRole('searchbox', { name: 'Search leads' })).toBeDisabled();
      const goal = await card('Goal');
      expect(within(goal).queryByRole('button')).not.toBeInTheDocument();
      expect(within(goal).queryByText('Click this year’s target to edit')).not.toBeInTheDocument();
      // The history is read again, so the finalized session is among the past ones.
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/sessions').length).toBeGreaterThan(1);
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

      expect(await screen.findByText(sentence)).toHaveAttribute('role', 'alert');
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

      const dialog = screen.getByRole('dialog', { name: 'Edit this session again?' });
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
      expect(headerLine()).toHaveTextContent('Friday, October 2, 2026 Draft');
      expect(screen.getByLabelText('Tip 1')).toBeInTheDocument();
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
      expect(edit).toHaveAttribute('title', 'This session could be reopened until Oct 9, 2026.');
      expect(edit).toHaveAccessibleDescription('This session could be reopened until Oct 9, 2026.');
      await userEvent.click(edit);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The header names the session's own date, not the office's today (a Fix).
      expect(headerLine()).toHaveTextContent('Friday, October 2, 2026');
    });

    it('P11-T8 AC-10 a finalized session still opens its past sessions, its closed leads and the Activity drill', async () => {
      show({
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'finalized' } }) },
        'GET /coaching/sessions/s-1': { body: finalized({ reopenableUntil: null }) },
      });
      const week = await card(/^Activity/);
      // A reader who may not reopen it sees no Edit again at all.
      expect(screen.queryByRole('button', { name: 'Edit again' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'View past sessions' }));
      expect(screen.getByRole('link', { name: /Sep 24, 2026/ })).toBeInTheDocument();
      const drill = within(week).getByRole('button', { name: '→ view full dashboard' });
      await waitFor(() => expect(drill).toBeEnabled());
      await userEvent.click(drill);
      expect(screen.getByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Closed leads' })).toBeInTheDocument();
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

  describe('the record’s controls and the reads (P11-T10, P11-T8’s browser walk)', () => {
    /**
     * `show`, with chosen reads held until the test lets them go: what has gone out while they wait is
     * what was asked for in parallel. Each request is noted as it is made, before it is answered.
     */
    const showHeld = (held: Record<string, Promise<void>>, routes: Record<string, StubReply | StubReply[]> = {}, searchParams?: Record<string, string>) => {
      const stub = stubFetch({
        '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
        '/kpm/org-levels': { body: [] },
        'GET /coaching/coachees/mem-rina': { body: RINA },
        'GET /coaching/coachees/mem-rina/sessions': { body: history({ current: { sessionId: 's-1', status: 'draft' } }) },
        'GET /coaching/sessions/s-1': { body: session() },
        '/summary?for=mem-rina': { body: summary() },
        '/activity/ratios?for=mem-rina': { body: RATIOS },
        '/activity/summary?': { body: WEEK },
        'outcome=open': { body: page([lead()]) },
        'outcome=won': { body: page([]) },
        'outcome=lost': { body: page([]) },
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
      const view = renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>
          <CoachingSessionTabPage searchParams={searchParams ? routeParams(searchParams) : undefined} />
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

      const download = await screen.findByRole('button', { name: 'Download as PDF' });
      expect(download.parentElement).toContainElement(screen.getByRole('button', { name: 'Edit again' }));
      await userEvent.click(download);

      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
      expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-1/print'))).toHaveLength(1);
      // Its coach printed it: the paper does not name them.
      expect(document.querySelector('[data-print-view] p')).toHaveTextContent(/^Friday, October 2, 2026 · Finalized$/);
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
      expect(within(goal).getByLabelText('Annual APE target')).toHaveValue('1.200.000.000');
      expect(screen.queryByText('Goal updated — reflected across both tabs.')).not.toBeInTheDocument();

      await reread.open();
      await toastSays('Goal updated — reflected across both tabs.');
      expect(within(goal).queryByLabelText('Annual APE target')).not.toBeInTheDocument();
      expect(goal).toHaveTextContent('Rp 620.000.000 / Rp 1.200.000.000');
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
      expect(goal).not.toHaveTextContent('Rp 960.000.000');
      await toastSays('Goal updated — reflected across both tabs.');
    });
  });

  it('P11-T8 AC-11 writes none of ADR-0084’s six words, and no phase', async () => {
    show();
    await card('Leads');
    await screen.findByDisplayValue('Desi Pratama');
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(SIX_WORDS);
    expect(main.textContent).not.toMatch(/\bphase\b/i);
  });
});
