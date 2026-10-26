import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import AgentLoading from '@/app/(agent)/loading';
import { makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import CoachingPersonLayout from '../../layout';
import CoachingArchivePage from './page';

const nav = vi.hoisted(() => ({
  pathname: '/coaching/mem-rina/archive/s-0924',
  params: { membershipId: 'mem-rina', sessionId: 's-0924' },
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  // The page reads its ids from the router, which does not suspend (F5 of P11's final walk).
  useParams: () => nav.params,
}));

const AGUS = { membershipId: 'mem-agus', name: 'Agus Santoso' };

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read', 'coaching_session:reopen', 'coaching_session:export_pdf'],
});

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: AGUS, direct: true, downline: { members: 0, leaders: 0 }, today: '2026-09-28',
};

const M = 1_000_000 * 100;

const SNAPSHOT = {
  takenAt: '2026-09-24T03:00:00.000Z',
  goal: {
    period: '2026', month: '2026-09', currency: 'IDR',
    monthly: { targetMinor: 80 * M, actualMinor: 65.6 * M, attainmentPct: 82, gapMinor: 14.4 * M, targetMet: false },
    yearly: { targetMinor: 960 * M, actualMinor: 620 * M, attainmentPct: 65, gapMinor: 340 * M, targetMet: false },
    source: { provenance: 'imported', month: '2026-08' }, savedAt: '2026-09-01T02:00:00.000Z', savedByMembershipId: 'mem-rina', goalVersion: 2,
  },
  ratios: {
    from: '2026-08-26', to: '2026-09-24', days: 30,
    rows: [
      { code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, value: 0.18, share: null, status: 'success' },
      { code: 'BALANCE', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30, value: 40, share: 70, status: 'alert', sides: { numerator: 'Sales', denominator: 'Recruitment' } },
    ],
  },
  activity: {
    from: '2026-09-18', to: '2026-09-24',
    targets: [
      { key: 'leads', code: 'LEADS_CONTACTED', logged: 14, target: 16 },
      { key: 'appointments', code: 'SELL_PRESENTATION', logged: 4, target: 5 },
      { key: 'closings', code: 'SELL_SUBMISSION', logged: 1, target: 1 },
    ],
    sections: [{ code: 'DEVELOPMENT', label: 'Development', total: 2, rows: [{ code: 'DEV_TRAINING', label: 'Training attended', count: 2 }] }],
  },
};

const EARLIER = {
  finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: AGUS,
  reopenedAt: '2026-09-25T03:00:00.000Z', reopenedBy: AGUS,
  reason: 'Two action items had the wrong dates.',
  lastWeekItems: [],
  leadActions: [],
  actionItems: [{ itemId: 'a-old', text: 'Shadow Sari on one presentation', dueDate: '2026-09-30' }],
  tips: [{ tipId: 't-old', text: 'The tip as first agreed.' }],
};

const archived = (over: Record<string, unknown> = {}) => ({
  sessionId: 's-0924', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: AGUS,
  status: 'finalized', version: 5, date: '2026-09-24', startedAt: '2026-09-24T02:00:00.000Z',
  finalizedAt: '2026-09-26T03:00:00.000Z', finalizedBy: AGUS, reopenableUntil: '2026-10-01',
  lastWeek: { sessionId: 's-0917', date: '2026-09-17' },
  lastWeekItems: [
    { itemId: 'lw-1', text: 'Confirm submission paperwork with Bp. Andi', dueDate: '2026-09-17', lead: null, done: true },
    { itemId: 'lw-2', text: 'Follow up with Alvin Sanjaya', dueDate: '2026-09-17', lead: { leadId: 'l-alvin', name: 'Alvin Sanjaya' }, done: false },
  ],
  leadActions: [{ leadId: 'l-desi', leadName: 'Desi Pratama', dueDate: '2026-09-26', text: 'Collect the signed SPAJ.' }],
  actionItems: [{ itemId: 'a-1', text: 'Shadow Sari on one presentation', dueDate: '2026-10-01' }],
  tips: [{ tipId: 't-1', text: 'Confirm the next meeting before you leave the current one.' }],
  snapshot: SNAPSHOT,
  earlier: [EARLIER],
  ...over,
});

const PRINT = {
  sessionId: 's-0924', version: 5, date: '2026-09-24',
  coachee: { name: 'Rina Wijaya' }, coach: { name: 'Agus Santoso' },
  lastWeekItems: [
    { text: 'Confirm submission paperwork with Bp. Andi', done: true },
    { text: 'Follow up with Alvin Sanjaya', done: false },
  ],
  goal: { currency: 'IDR', monthly: { targetMinor: 80 * M, actualMinor: 65.6 * M }, yearly: { targetMinor: 960 * M, actualMinor: null } },
  tips: [{ text: 'Confirm the next meeting before you leave the current one.' }],
  leadActions: [{ dueDate: '2026-09-26', text: 'Collect the signed SPAJ.', leadName: 'Desi Pratama' }],
  actionItems: [{ dueDate: '2026-10-01', text: 'Shadow Sari on one presentation' }, { dueDate: null, text: 'Undated' }],
};

const refused = (status: number, code: string, message: string) => ({
  status, body: { error: { code, message, requestId: 'req-1' } },
});

/**
 * What the archive must not read: the person's figures as they are now. Each is stubbed with a figure
 * that changed after the session was finalized, so a read of any of them would show on the page.
 */
const LIVE_SINCE = {
  '/summary': { body: { changed: 'after finalize' } },
  '/activity/': { body: { changed: 'after finalize' } },
  '/leads': { body: { changed: 'after finalize' } },
  '/goals/': { body: { changed: 'after finalize' } },
};

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = LEADER) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    'GET /coaching/coachees/mem-rina': { body: RINA },
    'GET /coaching/sessions/s-0924': { body: archived() },
    '/coaching/sessions/s-0924/print': { body: PRINT },
    ...LIVE_SINCE,
    ...routes,
  });
  const view = renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>
      <CoachingArchivePage />
    </CoachingPersonLayout>,
    { me },
  );
  return { ...stub, ...view };
};

/** Somebody who leads nobody now (ADR-0087): an AB whose last direct report has moved. */
const LEADS_NOBODY = makeMe({
  ...LEADER,
  membership: { ...LEADER.membership!, directCount: 0 },
});

const card = (name: string | RegExp) => screen.findByRole('region', { name });
const headerLine = () => screen.getByText((_, el) => el?.tagName === 'P' && /^Session — /.test(el.textContent ?? ''));
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

/** A `print` that notes the title the browser would name its PDF after, and the paper on the page. */
function stubPrint() {
  const seen: { title: string; paper: string | null }[] = [];
  const print = vi.fn(() => {
    seen.push({ title: document.title, paper: document.querySelector('[data-print-view]')?.textContent ?? null });
  });
  vi.stubGlobal('print', print);
  return { print, seen };
}

describe('a past session’s archive (P11-T10)', () => {
  beforeEach(() => {
    nav.pathname = '/coaching/mem-rina/archive/s-0924';
    nav.params = { membershipId: 'mem-rina', sessionId: 's-0924' };
    nav.push.mockReset();
    document.title = 'AgencyBoost';
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the frozen snapshot', () => {
    it('P11-T10 AC-1 shows the session as it was agreed: its day, who led it, the ticks, the tips and the next actions', async () => {
      show();
      await screen.findByText('Confirm submission paperwork with Bp. Andi');

      expect(headerLine()).toHaveTextContent('Session — Thursday, September 24, 2026 Finalized');
      expect(screen.getByText('Coached by Agus Santoso')).toBeInTheDocument();

      const lastWeek = await card("Last week's action items");
      expect(within(lastWeek).getByText('From Sep 17 session')).toBeInTheDocument();
      const ticked = within(lastWeek).getByRole('checkbox', { name: 'Confirm submission paperwork with Bp. Andi' });
      expect(ticked).toBeChecked();
      expect(ticked).toBeDisabled();
      expect(within(lastWeek).getByText('Confirm submission paperwork with Bp. Andi')).toHaveClass('line-through');
      expect(within(lastWeek).getByText('Leads · Alvin Sanjaya')).toBeInTheDocument();

      const tips = await card('Coaching tips');
      expect(tips).toHaveTextContent('1Confirm the next meeting before you leave the current one.');
      expect(within(tips).queryByRole('textbox')).not.toBeInTheDocument();

      const next = await card('Next action items');
      expect(next).toHaveTextContent('Sep 26Leads · Desi PratamaCollect the signed SPAJ.');
      expect(next).toHaveTextContent('1Oct 1Shadow Sari on one presentation');
      // A record: nothing to add, remove, start or finalize.
      for (const name of ['Add tip', 'Add action', 'Start coaching session', 'Finalize this session', '+ Add lead']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    it('P11-T10 AC-1 shows the figures the 1:1 looked at, from the snapshot, and reads none of her figures as they are now', async () => {
      const { calls } = show();

      const goal = await card('Goal');
      expect(goal).toHaveTextContent('Rp 65.600.000 / Rp 80.000.000');
      expect(goal).toHaveTextContent('82%');
      expect(goal).toHaveTextContent('Rp 14.400.000 remaining this month.');
      expect(goal).toHaveTextContent('Rp 620.000.000 / Rp 960.000.000');
      expect(within(goal).queryByRole('button')).not.toBeInTheDocument();

      const ratios = await card('Ratios');
      expect(within(ratios).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Selling success rate18.0%Benchmark: 15.0%',
        // The snapshot keeps the sides as the live read named them that day, and reads as two shares (P13.1-T6 AC-7).
        'Sales vs. Recruitment70% Sales · 30% RecruitmentBenchmark: 35%–65% each side',
      ]);

      const week = await card(/^Activity/);
      expect(week).toHaveTextContent('Set appointment14 / 16 pro-rated');
      expect(within(week).getByRole('region', { name: 'Development' })).toHaveTextContent('Development2Training attended2');

      // A goal, a lead and a day changed after finalize are stubbed above; none of them is read.
      expect(calls.some((c) => /\/summary|\/activity\/|\/leads|\/goals\//.test(c.url))).toBe(false);
      expect(calls.filter((c) => c.url.includes('/coaching/sessions/')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/coaching/sessions/s-0924']);
    });

    it('P13.1-T6 AC-7 reads a snapshot frozen before it named the sides in points, how far and not which way', async () => {
      const balance = {
        code: 'BALANCE', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
        value: 40, share: 70, status: 'alert',
      };
      show({
        'GET /coaching/sessions/s-0924': { body: archived({ snapshot: { ...SNAPSHOT, ratios: { ...SNAPSHOT.ratios, rows: [balance] } } }) },
      });
      const ratios = await card('Ratios');
      expect(within(ratios).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Sales vs. Recruitment40 pointsBenchmark: ±30 points',
      ]);
    });

    it('P11-T10 AC-1 opens the frozen week’s drill, as the finalized state still does', async () => {
      show();
      const week = await card(/^Activity/);
      await userEvent.click(within(week).getByRole('button', { name: '→ view full dashboard' }));
      const dialog = screen.getByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
      expect(within(dialog).getAllByRole('row').map((r) => [...r.children].map((c) => c.textContent))).toEqual([
        ['Category', 'Logged', 'Target (pro-rated)'],
        ['Set appointment', '14', '16'],
        ['Sales meeting', '4', '5'],
        ['Submission polis', '1', '1'],
        ['Training attended', '2', '–'],
      ]);
    });

    it('P11-T10 AC-1 says No goal set for a session whose snapshot holds none, and draws no figures for one that holds no snapshot', async () => {
      show({ 'GET /coaching/sessions/s-0924': { body: archived({ snapshot: { ...SNAPSHOT, goal: null } }) } });
      expect(within(await card('Goal')).getByText('No goal set')).toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = '';

      show({ 'GET /coaching/sessions/s-0924': { body: archived({ snapshot: null, lastWeek: null, earlier: [] }) } });
      await card('Coaching tips');
      expect(screen.queryByRole('region', { name: 'Goal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: "Last week's action items" })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Earlier versions' })).not.toBeInTheDocument();
    });

    it('P11-T10 AC-1 says what a session with nothing in a list agreed', async () => {
      show({ 'GET /coaching/sessions/s-0924': { body: archived({ tips: [], actionItems: [], leadActions: [] }) } });
      expect(within(await card('Coaching tips')).getByText('No tips were added this session.')).toBeInTheDocument();
      const next = await card('Next action items');
      expect(within(next).getByText('No other action items were added this session.')).toBeInTheDocument();
      expect(within(next).getByText('No leads have a next action date set yet.')).toBeInTheDocument();
    });
  });

  describe('earlier versions', () => {
    it('P11-T10 AC-1 lists each earlier version with who finalized it, who reopened it, when and why, and opens what it agreed', async () => {
      show();
      const earlier = await card('Earlier versions');

      expect(earlier).toHaveTextContent('Finalized Sep 24, 2026 by Agus Santoso');
      expect(earlier).toHaveTextContent('Reopened Sep 25, 2026 by Agus Santoso');
      expect(earlier).toHaveTextContent('Reason: Two action items had the wrong dates.');
      expect(within(earlier).queryByText('The tip as first agreed.')).not.toBeVisible();

      const toggle = within(earlier).getByRole('button', { name: 'View what it agreed' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveTextContent('Hide what it agreed ▴');
      expect(within(earlier).getByText('The tip as first agreed.')).toBeVisible();
      expect(within(earlier).getByText('No leads have a next action date set yet.')).toBeVisible();
    });

    it('P11-T10 AC-1 reads a correction its coach has open as the version that still counts, and offers the correction', async () => {
      show({
        'GET /coaching/sessions/s-0924': {
          body: archived({
            status: 'reopened', reopenableUntil: null,
            // The correction in progress, which is the workspace's to show.
            tips: [{ tipId: 't-draft', text: 'Being rewritten' }],
            earlier: [EARLIER, { ...EARLIER, reason: 'One more change.', tips: [{ tipId: 't-2', text: 'The version that counts.' }] }],
          }),
        },
      });

      const tips = await card('Coaching tips');
      expect(tips).toHaveTextContent('The version that counts.');
      expect(screen.queryByText('Being rewritten')).not.toBeInTheDocument();
      expect(await card('Earlier versions')).toHaveTextContent('Reason: Two action items had the wrong dates.');
      expect(screen.queryByText('Reason: One more change.')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Edit again' })).toHaveAttribute('href', '/coaching/mem-rina/session?session=s-0924');
    });
  });

  describe('Edit again', () => {
    it('P11-T10 asks the reason, reopens at the version read, and opens the correction on the session tab', async () => {
      const { calls } = show({
        'POST /coaching/sessions/s-0924/reopen': { body: archived({ status: 'reopened', version: 6 }) },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit again' }));

      const dialog = screen.getByRole('dialog', { name: 'Edit this session again?' });
      expect(dialog).toHaveAccessibleDescription(
        'Say why it needs changing. The reason stays with the session, and everyone who reads the session reads it — Rina Wijaya included.',
      );
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Wrong date on the follow-up');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Edit again' }));

      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/coaching/mem-rina/session?session=s-0924'));
      const reopen = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(String(reopen.init.body))).toEqual({ version: 5, reason: 'Wrong date on the follow-up' });
    });

    it('P11-T10 reads the session again after a reopen that is not the reader’s to finish', async () => {
      const { calls } = show({
        'GET /coaching/sessions/s-0924': { body: archived({ coach: { membershipId: 'mem-wulan', name: 'Wulan Sari' } }) },
        'POST /coaching/sessions/s-0924/reopen': { body: archived({ coach: { membershipId: 'mem-wulan', name: 'Wulan Sari' }, status: 'reopened' }) },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit again' }));
      await userEvent.type(screen.getByLabelText('Reason'), 'A typo');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit again' }));

      await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-0924'))).toHaveLength(2));
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('P11-T10 reads the session again on a version conflict, and closes the dialog', async () => {
      const { calls } = show({ 'POST /coaching/sessions/s-0924/reopen': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.') });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit again' }));
      await userEvent.type(screen.getByLabelText('Reason'), 'A typo');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit again' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-0924'))).toHaveLength(2);
    });

    it('P11-T10 draws Edit again locked past the window, in the office’s calendar', async () => {
      show({ 'GET /coaching/coachees/mem-rina': { body: { ...RINA, today: '2026-10-05' } } });
      const edit = await screen.findByRole('button', { name: 'Edit again' });
      expect(edit).toHaveAttribute('aria-disabled', 'true');
      expect(edit).toHaveAccessibleDescription('This session could be reopened until Oct 1, 2026.');
      await userEvent.click(edit);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('P11-T10 offers no Edit again to a reader who may not reopen it', async () => {
      show({ 'GET /coaching/sessions/s-0924': { body: archived({ reopenableUntil: null }) } });
      await card('Coaching tips');
      expect(screen.queryByRole('button', { name: 'Edit again' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Edit again' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download as PDF' })).toBeInTheDocument();
    });
  });

  describe('⬇ Download as PDF', () => {
    it('P11-T10 AC-3 prints the session from its own read, under a title naming her and the day, and takes the paper away after', async () => {
      const { seen, print } = stubPrint();
      const { calls } = show();
      const download = await screen.findByRole('button', { name: 'Download as PDF' });
      expect(download).toHaveTextContent('⬇Download as PDF');

      await userEvent.click(download);

      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
      expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-0924/print'))).toHaveLength(1);
      expect(seen[0].title).toBe('Coaching Session – Rina Wijaya – September 24, 2026');
      const paper = document.querySelector('[data-print-view]')!;
      expect(paper.parentElement).toBe(document.body);
      expect(paper).toHaveClass('hidden', 'print:block');
      expect([...paper.querySelectorAll('h1, h2, p')].map((el) => el.textContent)).toEqual([
        'Coaching Session — Rina Wijaya',
        // The day it was held, never today's; the reader led it, so the paper does not name them.
        'Thursday, September 24, 2026  ·  Finalized',
        "Last week's action items",
        '[x] Confirm submission paperwork with Bp. Andi',
        '[ ] Follow up with Alvin Sanjaya',
        'Goal',
        'This month: Rp 65.600.000 / Rp 80.000.000',
        'This year: Not uploaded yet / Rp 960.000.000',
        'Coaching tips',
        '1. Confirm the next meeting before you leave the current one.',
        'Next action items — from leads',
        '1. Sep 26 — Collect the signed SPAJ. (Leads: Desi Pratama)',
        'Next action items — other',
        '1. Oct 1 — Shadow Sari on one presentation',
        '2. Undated',
      ]);

      act(() => { window.dispatchEvent(new Event('afterprint')); });
      await waitFor(() => expect(document.querySelector('[data-print-view]')).toBeNull());
      expect(document.title).toBe('AgencyBoost');
      // Nothing a leader keeps to themselves is read to print it.
      expect(calls.some((c) => /leader-notes|profile/.test(c.url))).toBe(false);
    });

    it('P11-T10 AC-3 prints the prototype’s empty words, and names who led it for a reader who did not', async () => {
      stubPrint();
      show({
        'GET /coaching/sessions/s-0924': { body: archived({ coach: { membershipId: 'mem-wulan', name: 'Wulan Sari' } }) },
        '/coaching/sessions/s-0924/print': {
          body: { ...PRINT, coach: { name: 'Wulan Sari' }, lastWeekItems: [], goal: null, tips: [], leadActions: [], actionItems: [] },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Download as PDF' }));

      await waitFor(() => expect(document.querySelector('[data-print-view]')).not.toBeNull());
      const paper = document.querySelector('[data-print-view]')!;
      expect([...paper.querySelectorAll('h1, h2, p')].map((el) => el.textContent)).toEqual([
        'Coaching Session — Rina Wijaya',
        'Thursday, September 24, 2026  ·  Coached by Wulan Sari  ·  Finalized',
        'Goal',
        'No goal set',
        'Coaching tips',
        'None added.',
        'Next action items — from leads',
        'None.',
        'Next action items — other',
        'None added.',
      ]);
    });

    it('P11 final walk F1 numbers the other action items as the screen does: by date, undated last', async () => {
      stubPrint();
      const items = [
        { itemId: 'a-u', text: 'Undated', dueDate: null },
        { itemId: 'a-7', text: 'Call the new referral', dueDate: '2026-10-07' },
        { itemId: 'a-1', text: 'Shadow Sari on one presentation', dueDate: '2026-10-01' },
      ];
      show({
        'GET /coaching/sessions/s-0924': { body: archived({ actionItems: items }) },
        // The print's read holds them in the order they were added, as the session's does.
        '/coaching/sessions/s-0924/print': { body: { ...PRINT, actionItems: items.map(({ text, dueDate }) => ({ text, dueDate })) } },
      });

      const next = await card('Next action items');
      const lists = within(next).getAllByRole('list');
      expect(within(lists[lists.length - 1]).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        '1Oct 1Shadow Sari on one presentation',
        '2Oct 7Call the new referral',
        '3—Undated',
      ]);

      await userEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
      await waitFor(() => expect(document.querySelector('[data-print-view]')).not.toBeNull());
      const lines = [...document.querySelector('[data-print-view]')!.querySelectorAll('h2, p')].map((el) => el.textContent);
      expect(lines.slice(lines.indexOf('Next action items — other') + 1)).toEqual([
        '1. Oct 1 — Shadow Sari on one presentation',
        '2. Oct 7 — Call the new referral',
        '3. Undated',
      ]);
    });

    it('P11 final walk F2 prints No goal set where the archive says it: a frozen goal with no yearly target', async () => {
      stubPrint();
      const goal = SNAPSHOT.goal;
      show({
        'GET /coaching/sessions/s-0924': {
          body: archived({
            snapshot: {
              ...SNAPSHOT,
              goal: {
                ...goal,
                monthly: { ...goal.monthly, targetMinor: null, actualMinor: null, attainmentPct: null, gapMinor: null },
                yearly: { ...goal.yearly, targetMinor: null, actualMinor: 0, attainmentPct: null, gapMinor: null },
              },
            },
          }),
        },
        '/coaching/sessions/s-0924/print': {
          body: { ...PRINT, goal: { currency: 'IDR', monthly: { targetMinor: null, actualMinor: null }, yearly: { targetMinor: null, actualMinor: 0 } } },
        },
      });
      expect(within(await card('Goal')).getByText('No goal set')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
      await waitFor(() => expect(document.querySelector('[data-print-view]')).not.toBeNull());
      const paper = document.querySelector('[data-print-view]')!;
      const lines = [...paper.querySelectorAll('h2, p')].map((el) => el.textContent);
      expect(lines[lines.indexOf('Goal') + 1]).toBe('No goal set');
      expect(paper.textContent).not.toMatch(/This month|This year|Not uploaded yet|Rp 0/);
    });

    it('P11 final walk F3 lets the date line wrap on narrow paper, keeping the prototype’s spacing', async () => {
      stubPrint();
      show({
        'GET /coaching/sessions/s-0924': { body: archived({ coach: { membershipId: 'mem-wulan', name: 'Wulan Sari' } }) },
        '/coaching/sessions/s-0924/print': { body: { ...PRINT, coach: { name: 'Wulan Sari' } } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Download as PDF' }));
      await waitFor(() => expect(document.querySelector('[data-print-view]')).not.toBeNull());

      const dateLine = document.querySelector('[data-print-view] h1')!.nextElementSibling!;
      expect(dateLine).toHaveTextContent('Thursday, September 24, 2026  ·  Coached by Wulan Sari  ·  Finalized', { normalizeWhitespace: false });
      // `pre-wrap` keeps the two spaces each side of the dot and breaks the line where it must; `pre` never did.
      expect(dateLine).toHaveClass('whitespace-pre-wrap');
      expect(dateLine).not.toHaveClass('whitespace-pre');
    });

    it('P11-T10 AC-3 shows a refused print beside the button, and prints nothing', async () => {
      const { print } = stubPrint();
      show({ '/coaching/sessions/s-0924/print': refused(409, 'COACHING_SESSION_NOT_FINALIZED', 'This session has not been finalized yet.') });
      await userEvent.click(await screen.findByRole('button', { name: 'Download as PDF' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('This session has not been finalized yet.');
      expect(print).not.toHaveBeenCalled();
    });

    it('P11-T10 AC-3 is not offered to a reader without the export', async () => {
      show({}, { ...LEADER, permissions: ['coaching_session:read', 'coaching_session:reopen'] });
      await card('Coaching tips');
      expect(screen.queryByRole('button', { name: 'Download as PDF' })).not.toBeInTheDocument();
    });
  });

  describe('who reads it', () => {
    it('P11-T10 AC-9 serves a former coach at its address, on its own: the way back and the session, without the header’s tabs', async () => {
      stubPrint();
      const { calls } = show({
        'GET /coaching/coachees/mem-rina': refused(404, 'NOT_FOUND', 'Not found'),
        'GET /coaching/sessions/s-0924': { body: archived({ reopenableUntil: null }) },
      });

      expect(await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '← Back to Coaching Session' })).toHaveAttribute('href', '/coaching');
      expect(screen.queryByRole('navigation', { name: 'Coaching' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
      expect(screen.queryByText('This person isn’t someone you coach.')).not.toBeInTheDocument();
      expect(await card('Goal')).toHaveTextContent('Rp 65.600.000 / Rp 80.000.000');
      expect(screen.queryByRole('button', { name: 'Edit again' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Download as PDF' }));
      await waitFor(() => expect(calls.some((c) => c.url.endsWith('/print'))).toBe(true));
    });

    it('P11-T10 AC-9 says not found for a session the reader may not read, in the same words whoever it is', async () => {
      show({ 'GET /coaching/sessions/s-0924': refused(404, 'NOT_FOUND', 'Not found') });
      const heading = await screen.findByRole('heading', { name: 'This session isn’t one you can open.' });
      expect(heading.nextElementSibling).toHaveTextContent(/^The address may be mistyped\. Everyone you coach is on Coaching Session\.$/);
      expect(screen.queryByRole('button', { name: 'Download as PDF' })).not.toBeInTheDocument();
    });

    it('P11 final walk F4 sends a former coach who leads nobody now back to their own coaching, not to an empty roster', async () => {
      show({
        'GET /coaching/coachees/mem-rina': refused(404, 'NOT_FOUND', 'Not found'),
        'GET /coaching/sessions/s-0924': { body: archived({ reopenableUntil: null }) },
      }, LEADS_NOBODY);

      await card('Coaching tips');
      expect(screen.getByRole('link', { name: '← Back to My Coaching Notes' })).toHaveAttribute('href', '/coaching/me');
      expect(screen.queryByRole('link', { name: '← Back to Coaching Session' })).not.toBeInTheDocument();
    });

    it('P11 final walk F4 says not found to a reader who leads nobody without pointing at an empty roster', async () => {
      show({
        'GET /coaching/coachees/mem-rina': refused(404, 'NOT_FOUND', 'Not found'),
        'GET /coaching/sessions/s-0924': refused(404, 'NOT_FOUND', 'Not found'),
      }, LEADS_NOBODY);

      const heading = await screen.findByRole('heading', { name: 'This session isn’t one you can open.' });
      expect(heading.nextElementSibling).toHaveTextContent(/^The address may be mistyped\.$/);
      expect(screen.getByRole('link', { name: '← Back to My Coaching Notes' })).toHaveAttribute('href', '/coaching/me');
      const main = screen.getByRole('main');
      expect(main.textContent).not.toMatch(/Everyone you coach|Back to Coaching Session/);
      expect(main.textContent).not.toMatch(SIX_WORDS);
    });

    it('P11-T10 says not found for an address that puts the session under somebody else', async () => {
      show({ 'GET /coaching/sessions/s-0924': { body: archived({ coachee: { membershipId: 'mem-other', name: 'Somebody Else' } }) } });
      expect(await screen.findByRole('heading', { name: 'This session isn’t one you can open.' })).toBeInTheDocument();
      expect(screen.queryByText('Somebody Else')).not.toBeInTheDocument();
    });

    it('P11-T10 sends its coach to the tab for a session not finalized yet', async () => {
      show({ 'GET /coaching/sessions/s-0924': { body: archived({ status: 'draft', date: null, earlier: [], snapshot: null }) } });
      expect(await screen.findByRole('heading', { name: 'This session hasn’t been finalized yet.' })).toBeInTheDocument();
      // The shell's tab and the card's link both go there.
      expect(screen.getAllByRole('link', { name: 'Coaching Session' }).map((a) => a.getAttribute('href')))
        .toContain('/coaching/mem-rina/session');
    });

    it('shows any other failure of the read', async () => {
      show({ 'GET /coaching/sessions/s-0924': refused(500, 'INTERNAL_ERROR', 'Something went wrong.') });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    });
  });

  describe('the final browser walk (P11)', () => {
    it('F5 reads the session once and the person once, under StrictMode, with the layout’s params suspending as the App Router’s do', async () => {
      const { calls } = stubFetch({
        '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
        '/kpm/org-levels': { body: [] },
        'GET /coaching/coachees/mem-rina': { body: RINA },
        'GET /coaching/sessions/s-0924': { body: archived() },
      });
      await act(async () => {
        renderWithSession(
          <StrictMode>
            <AgentLayout>
              {/* `(agent)/loading.tsx`'s boundary, which the App Router puts between the agent shell and the route. */}
              <Suspense fallback={<AgentLoading />}>
                {/* A promise React has not seen settle, as the App Router hands a client layout its params. */}
                <CoachingPersonLayout params={Promise.resolve({ membershipId: 'mem-rina' })}>
                  <CoachingArchivePage />
                </CoachingPersonLayout>
              </Suspense>
            </AgentLayout>
          </StrictMode>,
          { me: LEADER },
        );
      });

      await card('Earlier versions');
      // Anything a second mount would read has had its chance to go out.
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
      // Each read of the session by somebody who is not its coachee is an audit entry: one view, one.
      expect(calls.filter((c) => c.url.endsWith('/coaching/sessions/s-0924'))).toHaveLength(1);
      expect(calls.filter((c) => c.url.endsWith('/coaching/coachees/mem-rina'))).toHaveLength(1);
    });

    it('F6 marks Coaching Session the current tab on a past session, and reads no history for it', async () => {
      const { calls } = show();
      await card('Coaching tips');

      const tabs = screen.getByRole('navigation', { name: 'Coaching' });
      expect(within(tabs).getByRole('link', { name: 'Coaching Session' })).toHaveAttribute('aria-current', 'page');
      expect(within(tabs).getAllByRole('link').filter((tab) => tab.hasAttribute('aria-current'))).toHaveLength(1);
      // The tab's history is read beside the person only when the shell opens on the tab itself.
      expect(calls.some((c) => c.url.endsWith('/coaching/coachees/mem-rina/sessions'))).toBe(false);
    });
  });

  it('P11-T10 writes none of ADR-0084’s six words, no phase and no id', async () => {
    show();
    await card('Earlier versions');
    await userEvent.click(screen.getByRole('button', { name: 'View what it agreed' }));
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(SIX_WORDS);
    expect(main.textContent).not.toMatch(/\bphase\b|s-0924|mem-rina/i);
  });
});
