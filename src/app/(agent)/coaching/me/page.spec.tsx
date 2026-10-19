import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import MyCoachingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/me',
}));

const JORDAN = makeMe({
  user: {
    id: 'u-jordan', email: 'jordan@kpm0417.test', fullName: 'Jordan Reyes', preferredName: 'Jordan',
    pronoun: 'he', initials: 'JR', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-jordan', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['coaching_session:read', 'coaching_session:export_pdf'],
});

const AGENT = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['coaching_session:read', 'coaching_session:export_pdf'],
});

const WILSON = { membershipId: 'mem-wilson', name: 'Wilson Tanoto' };
const M = 1_000_000 * 100;

const MINE = {
  sessions: [
    { sessionId: 's-0924', date: '2026-09-24', coach: WILSON, actionItemCount: 2, completedCount: 1 },
    { sessionId: 's-0917', date: '2026-09-17', coach: { membershipId: 'mem-dewi', name: 'Dewi Kartika' }, actionItemCount: 3, completedCount: 3 },
  ],
  ledFormerly: [],
};

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's-0924', coachee: { membershipId: 'mem-jordan', name: 'Jordan Reyes' }, coach: WILSON,
  status: 'finalized', version: 3, date: '2026-09-24', startedAt: '2026-09-24T02:00:00.000Z',
  finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: WILSON, reopenableUntil: null,
  lastWeek: { sessionId: 's-0917', date: '2026-09-17' },
  lastWeekItems: [
    { itemId: 'lw-1', text: 'Review Q3 recruitment pitch with Dimas', dueDate: '2026-09-17', lead: null, done: true },
    { itemId: 'lw-2', text: 'Follow up with Hendra Wibowo on proposal timing', dueDate: '2026-09-17', lead: { leadId: 'l-h', name: 'Hendra Wibowo' }, done: false },
  ],
  leadActions: [{ leadId: 'l-h', leadName: 'Hendra Wibowo', dueDate: '2026-09-26', text: 'Send proposal' }],
  actionItems: [{ itemId: 'a-1', text: 'Delegate two AAB check-ins', dueDate: '2026-09-30' }],
  tips: [{ tipId: 't-1', text: 'Delegate more of the AAB check-ins to free up prospecting time.' }],
  snapshot: {
    takenAt: '2026-09-24T03:00:00.000Z',
    goal: {
      period: '2026', month: '2026-09', currency: 'IDR',
      monthly: { targetMinor: 100 * M, actualMinor: 108 * M, attainmentPct: 108, gapMinor: null, targetMet: true },
      yearly: { targetMinor: 1200 * M, actualMinor: 850 * M, attainmentPct: 71, gapMinor: 350 * M, targetMet: false },
      source: { provenance: 'imported', month: '2026-08' }, savedAt: null, savedByMembershipId: null, goalVersion: 1,
    },
    ratios: {
      from: '2026-08-26', to: '2026-09-24', days: 30,
      rows: [{ code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, value: 0.2, share: null, status: 'success' }],
    },
    activity: { from: '2026-09-18', to: '2026-09-24', targets: [{ key: 'leads', code: 'LEADS_CONTACTED', logged: 9, target: 10 }], sections: [] },
  },
  earlier: [],
  ...over,
});

const PRINT = {
  sessionId: 's-0924', version: 3, date: '2026-09-24', coachee: { name: 'Jordan Reyes' }, coach: { name: 'Wilson Tanoto' },
  lastWeekItems: [], goal: null, tips: [], leadActions: [], actionItems: [],
};

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = JORDAN, query: Record<string, string> = {}) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/coaching/me/sessions': { body: MINE },
    'GET /coaching/sessions/s-0924': { body: session() },
    'GET /coaching/sessions/s-0917': { body: session({ sessionId: 's-0917', date: '2026-09-17', lastWeek: null, coach: { membershipId: 'mem-dewi', name: 'Dewi Kartika' } }) },
    '/coaching/sessions/s-0924/print': { body: PRINT },
    ...routes,
  });
  const view = renderInLayout(AgentLayout, <MyCoachingPage searchParams={routeParams(query)} />, { me });
  return { ...stub, ...view };
};

const card = (name: string | RegExp) => screen.findByRole('region', { name });
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('/coaching/me, the reader’s own coaching (P11-T10 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T10 AC-4 is headed as the prototype heads it: the title, the reader’s name and “{rung} · Your own coaching”', async () => {
    show();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Coaching Session$/);
    expect(await screen.findByRole('heading', { level: 2, name: 'Jordan Reyes' })).toBeInTheDocument();
    expect(screen.getByText('Agency Builder · Your own coaching')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('JR')).toHaveAttribute('aria-hidden', 'true');
  });

  it('P11-T10 AC-4, P18.5-T4 AC-3 has the tabs without Leader Notes: the reader’s own Summary, Goal Settings, Activity, Training and Activation, this page current', async () => {
    show();
    const tabs = await screen.findByRole('navigation', { name: 'Coaching' });
    // P13-T9 AC-4: *Activation* opens the reader's own checklist (D-coaching-me). P13.1-T9: *Activity*
    // mirrors the person shell's, the reader's own Dashboard, as Summary and Goal Setting open their own.
    // P18.5-T4 AC-3: *Training* opens the reader's own training, a tab route as Activation's is.
    expect(within(tabs).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-disabled')])).toEqual([
      ['Personal Summary', '/summary', null],
      ['Goal Setting', '/goals', null],
      ['Activity', '/activity/dashboard', null],
      ['Training', '/coaching/me/training', null],
      ['Activation', '/coaching/me/activation', null],
      ['Coaching Session', '/coaching/me', null],
    ]);
    expect(within(tabs).getByRole('link', { name: 'Activation' })).not.toHaveAttribute('aria-current');
    expect(within(tabs).getByRole('link', { name: 'Training' })).not.toHaveAttribute('aria-current');
    expect(within(tabs).getByRole('link', { name: 'Coaching Session' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText(/Leader Notes/)).not.toBeInTheDocument();
  });

  it('P11-T10 AC-4 opens on the latest finalized session, read-only, as it was frozen', async () => {
    const { calls } = show();

    const tips = await card('Coaching tips from Wilson');
    expect(tips).toHaveTextContent('Delegate more of the AAB check-ins to free up prospecting time.');
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^Session — /.test(el.textContent ?? '')))
      .toHaveTextContent('Session — Thursday, September 24, 2026 Finalized');
    expect(screen.getByText('Coached by Wilson Tanoto', { selector: 'p' })).toBeInTheDocument();

    const lastWeek = await card("Last week's action items");
    // Who led last week's session, as the prototype tags it (`Overall.html:4463`).
    expect(within(lastWeek).getByText('From Sep 17 session · Dewi Kartika')).toBeInTheDocument();
    expect(within(lastWeek).getByRole('checkbox', { name: 'Review Q3 recruitment pitch with Dimas' })).toBeDisabled();

    const goal = await card('Goal');
    expect(goal).toHaveTextContent('Rp 108.000.000 / Rp 100.000.000');
    expect(goal).toHaveTextContent('Rp 850.000.000 / Rp 1.200.000.000');
    expect(await card('Ratios')).toHaveTextContent('Selling success rate20.0%');
    expect(await card('Next action items')).toHaveTextContent('Sep 26Leads · Hendra WibowoSend proposal');

    // Read-only: nothing to start, finalize, reopen or edit, and no Leads or Activity card.
    for (const name of ['Start coaching session', 'Finalize this session', 'Edit again', 'Add tip', 'Add action', '+ Add lead']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('region', { name: 'Leads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Activity/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Finalized Thursday, September 24, 2026')).toBeInTheDocument();
    // Its own record: no note is asked for, and nothing about anybody's figures as they are now.
    expect(calls.some((c) => /leader-notes|profile|\/summary|\/activity\/|\/leads|\/goals\//.test(c.url))).toBe(false);
  });

  it('P11-T10 AC-4 lists the history behind View past sessions ▾, each row Coached by its leader, opening that session', async () => {
    show();
    const toggle = await screen.findByRole('button', { name: 'View past sessions' });
    await userEvent.click(toggle);

    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(list).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['Sep 24, 2026 — 2 action items · 1 completedCoached by Wilson Tanoto', '/coaching/me?session=s-0924', 'true'],
      ['Sep 17, 2026 — 3 action items · 3 completedCoached by Dewi Kartika', '/coaching/me?session=s-0917', null],
    ]);
    expect(within(list).queryByText('Sessions you led')).not.toBeInTheDocument();
  });

  it('P11-T10 AC-8 opens on the session the address names — the finalize notice’s', async () => {
    const { calls } = show({}, JORDAN, { session: 's-0917' });
    expect(await screen.findByText('Coached by Dewi Kartika', { selector: 'p' })).toBeInTheDocument();
    expect(await card('Coaching tips from Dewi')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/coaching/sessions/')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/coaching/sessions/s-0917']);
  });

  it('P11-T10 AC-8 opens on the latest when the address names a session that is not the reader’s', async () => {
    show({}, JORDAN, { session: 's-somebody-else' });
    expect(await card('Coaching tips from Wilson')).toBeInTheDocument();
  });

  it('P11-T10 AC-4 says so when there is no session yet, and offers no list', async () => {
    const { calls } = show({ '/coaching/me/sessions': { body: { sessions: [], ledFormerly: [] } } }, AGENT);
    expect(await screen.findByText('No coaching sessions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View past sessions' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/coaching/sessions/'))).toBe(false);
  });

  it('P11-T10 AC-4 shows every earlier version with its reason, which was written for the reader to read', async () => {
    show({
      'GET /coaching/sessions/s-0924': {
        body: session({
          earlier: [{
            finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: WILSON, reopenedAt: '2026-09-25T03:00:00.000Z', reopenedBy: WILSON,
            reason: 'The proposal date was wrong.', lastWeekItems: [], leadActions: [], actionItems: [], tips: [],
          }],
        }),
      },
    });
    expect(await card('Earlier versions')).toHaveTextContent('Reason: The proposal date was wrong.');
  });

  it('P11-T10 AC-3 prints the session for its coachee, naming who led it', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const { calls } = show();
    await userEvent.click(await screen.findByRole('button', { name: 'Download as PDF' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(calls.some((c) => c.url.endsWith('/coaching/sessions/s-0924/print'))).toBe(true);
    expect(document.querySelector('[data-print-view] p')).toHaveTextContent('Thursday, September 24, 2026 · Coached by Wilson Tanoto · Finalized');
  });

  it('P11-T10 AC-4 offers a leader the way back to the roster, and an Agent, who leads nobody, none', async () => {
    show();
    expect(await screen.findByRole('link', { name: '← Back to Coaching Session' })).toHaveAttribute('href', '/coaching');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({}, AGENT);
    expect(await screen.findByText('Agent · Your own coaching')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '← Back to Coaching Session' })).not.toBeInTheDocument();
  });

  it('shows a failed read of the sessions, and of the session', async () => {
    show({ '/coaching/me/sessions': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Down', requestId: 'r-1' } } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Down');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ 'GET /coaching/sessions/s-0924': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-2' } } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('is refused to a reader without coaching_session:read, with no read', async () => {
    const { calls } = show({}, { ...AGENT, permissions: [] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'coaching_session:read');
    expect(calls.some((c) => c.url.includes('/coaching/'))).toBe(false);
  });

  it('P11-T10 writes none of ADR-0084’s six words, and no phase', async () => {
    show();
    await card('Coaching tips from Wilson');
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
    expect(screen.getByRole('main').textContent).not.toMatch(/\bphase\b/i);
  });
});

/**
 * ADR-0088 (OD-106), P11-T10 AC-10: **a former coach reaches the sessions they led from an existing
 * control.** The same *View past sessions ▾* list, a second group under its own heading, each row
 * opening its archive. Nothing is added to the page: no card, no strip, no nav entry.
 */
describe('/coaching/me, the sessions the reader led with somebody they no longer coach (P11-T10 AC-10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LED = [
    { sessionId: 's-led-1', date: '2026-08-20', coachee: { membershipId: 'mem-bayu', name: 'Bayu Pratama' }, actionItemCount: 2, completedCount: 1 },
    { sessionId: 's-led-2', date: '2026-08-13', coachee: { membershipId: 'mem-bayu', name: 'Bayu Pratama' }, actionItemCount: 1, completedCount: 0 },
  ];

  it('P11-T10 AC-10 lists them as Sessions you led, after the reader’s own, each View → to its archive', async () => {
    show({ '/coaching/me/sessions': { body: { ...MINE, ledFormerly: LED } } });
    const toggle = await screen.findByRole('button', { name: 'View past sessions' });
    await userEvent.click(toggle);

    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    const heading = within(list).getByRole('heading', { name: 'Sessions you led' });
    expect(heading.tagName).toBe('H3');
    const lists = within(list).getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(within(lists[1]).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Aug 20, 2026 — Bayu Pratama · 2 action items · 1 completedView →', '/coaching/mem-bayu/archive/s-led-1'],
      ['Aug 13, 2026 — Bayu Pratama · 1 action item · 0 completedView →', '/coaching/mem-bayu/archive/s-led-2'],
    ]);
    expect(list.textContent).not.toMatch(SIX_WORDS);
  });

  it('P11-T10 AC-10 offers the list to a former coach who has no session of their own', async () => {
    show({ '/coaching/me/sessions': { body: { sessions: [], ledFormerly: LED } } });
    expect(await screen.findByText('No coaching sessions yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View past sessions' }));
    expect(screen.getByRole('heading', { name: 'Sessions you led' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Aug 20, 2026 — Bayu Pratama/ })).toHaveAttribute('href', '/coaching/mem-bayu/archive/s-led-1');
  });
});
