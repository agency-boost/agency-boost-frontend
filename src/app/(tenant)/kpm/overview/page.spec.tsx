import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { EMPTY, NOBODY, NOT_LOGGED, noTeam, overviewView } from './overview-fixtures';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const READ = ['member:read_profile', 'kpm_overview:read'];
const WRITE = [...READ, 'kpm_overview:set_recruit_target'];

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: WRITE,
});

const ADMIN = makeMe({
  membership: {
    membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: true, directCount: 0,
  },
  permissions: WRITE,
});

/** An AB in the field: the tenant shell's gate lets them in, the Overview's does not (roles §3.9). */
const FIELD_AB = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['member:read_profile'],
});

/** A Super Admin outside a support session holds no office permission at all. */
const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create'],
});

/** The same Super Admin inside a read-only support session: the member's reads, no writes (roles §3.13). */
const SUPPORT_READ_ONLY = makeMe({
  ...OWNER,
  // What `/auth/me` answers inside a read-only session: the member's reads, and no write verb at all.
  permissions: (OWNER.permissions ?? []).filter((p) => p !== 'kpm_overview:set_recruit_target'),
  isImpersonating: true,
  impersonationReadOnly: true,
});

const main = () => screen.getByRole('main');
const section = (name: string) => screen.getByRole('region', { name });
const overviewCalls = (calls: { url: string }[]) => calls.filter((c) => /\/kpm\/overview$/.test(c.url));
const listCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/kpm/overview/not-logged'));
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => c.url.includes('/kpm/overview/recruit-target') && c.init.method === 'PUT');

function render(
  me = OWNER,
  routes: Record<string, StubReply | StubReply[]> = {},
  view = overviewView(),
) {
  const stub = stubFetch({ '/kpm/overview': { body: view }, ...routes });
  renderWithSession(<KpmOverviewPage />, { me });
  return stub;
}

const loaded = () => screen.findByRole('region', { name: 'Team composition' });

describe('KPM Overview (P18-T1)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('the page, verbatim (AC-2)', () => {
    it('AC-2, P18.95-T9 AC-2: is titled Overview, the nav item’s word, its sub-line composed from the office', async () => {
      render();
      await loaded();
      const title = screen.getByRole('heading', { level: 1 });
      // The prototype titled it *KPM Overview* under a nav item reading *Overview* (UI-027).
      expect(title).toHaveTextContent(/^Overview$/);
      expect(screen.getByText('Prudential · KPM 0417 — BSD City Branch')).toBeInTheDocument();
    });

    it('AC-2: draws the five sections in the prototype’s order, with their heads verbatim', async () => {
      render();
      await loaded();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Team composition', 'Engagement', 'Coaching coverage', 'Recruitment pipeline', 'Production — this year',
      ]);
      // P18.97-T3 AC-6 (UI-020): the sub-line names the two periods its cards read, where it read *Last 7 days* alone.
      expect(within(section('Engagement')).getByText('This month · Last 7 days')).toBeInTheDocument();
      expect(within(section('Engagement')).queryByText('Last 7 days')).not.toBeInTheDocument();
    });

    it('AC-2: is no longer a sign — nothing upcoming, nothing pointing elsewhere', async () => {
      render();
      await loaded();
      expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/phase/i);
    });

    it('AC-2: asks for the Overview once, with no query parameter', async () => {
      const { calls } = render();
      await loaded();
      expect(overviewCalls(calls)).toHaveLength(1);
      expect(overviewCalls(calls)[0].url).not.toContain('?');
      expect(listCalls(calls)).toHaveLength(0);
    });
  });

  describe('Team composition (AC-3)', () => {
    it('AC-3: Total members is the headcount, with how many are new this month', async () => {
      render();
      const tiles = within(await loaded());
      expect(tiles.getByText('Total members').nextElementSibling).toHaveTextContent('187');
      expect(tiles.getByText('+6 new this month')).toBeInTheDocument();
    });

    it('AC-3: one tile per rung, in the ladder’s order, labelled by the ladder, summing to the total', async () => {
      render();
      const region = await loaded();
      // Each rung by its badge's name (P18.95-T9 AC-1), *AAB* with its ⓘ (AC-3), which the words leave out here.
      const tiles = [...region.querySelectorAll('p.mb-1\\.5')];
      const labels = tiles.map((p) => p.textContent!.replace(/ ⓘ.*$/, ''));
      expect(labels).toEqual(['Total members', 'AB', 'AAB', 'Agent']);
      expect(within(tiles[2] as HTMLElement).getByRole('button', { name: 'What is AAB?' })).toBeInTheDocument();
      const counts = ['AB', 'AAB', 'Agent']
        .map((label) => Number(tiles[labels.indexOf(label)].nextElementSibling?.textContent));
      expect(counts).toEqual([8, 24, 155]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(187);
    });

    it('AC-3: each rung’s dot is the rung’s colour token, and its label says which rung', async () => {
      render();
      const region = await loaded();
      const tiles = [...region.querySelectorAll('p.mb-1\\.5')];
      const dot = (label: string) => tiles.find((p) => p.textContent!.replace(/ ⓘ.*$/, '') === label)?.querySelector('[aria-hidden="true"]');
      expect(dot('AB')?.className).toContain('bg-role-ab');
      expect(dot('AAB')?.className).toContain('bg-role-aab');
      expect(dot('Agent')?.className).toContain('bg-role-agent');
    });
  });

  describe('Engagement (AC-4)', () => {
    it('AC-4 (OD-142): the first card is titled for what it counts, over the prototype’s sub-line', async () => {
      render();
      await loaded();
      const card = within(section('Engagement')).getByRole('heading', { name: 'Agents who logged activity this month' }).parentElement!;
      expect(within(card).getByText('Logged at least one activity this month')).toBeInTheDocument();
      expect(card).toHaveTextContent('142/ 18776%');
      expect(screen.queryByText('Monthly active agents')).not.toBeInTheDocument();
    });

    it('AC-4, P18.97-T3 AC-1: the trend is against last month to the same day, Up with its rise, whole', async () => {
      render();
      await loaded();
      expect(within(section('Engagement')).getByText(/^Up from 138 last month/)).toHaveTextContent('Up from 138 last month (+3%)');
    });

    it('AC-4: Down, with its fall, when fewer have logged than by this day last month', async () => {
      render(OWNER, {}, overviewView({
        engagement: { loggedThisMonth: { count: 120, of: 187, pct: 64, lastMonthToDate: 150 }, loggedThisWeek: { logged: 1, notLogged: 0, pct: 100 } },
      }));
      await loaded();
      expect(within(section('Engagement')).getByText(/^Down from 150 last month/)).toHaveTextContent('Down from 150 last month (−20%)');
    });

    it('AC-4: no trend line when there is nothing to compare against', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      expect(within(section('Engagement')).queryByText(/from .* last month|Same as last month/)).not.toBeInTheDocument();
    });

    it('AC-4: the week card says who has and has not logged, and its rate', async () => {
      render();
      await loaded();
      const card = within(section('Engagement')).getByRole('heading', { name: 'Activity logging — this week' }).parentElement!;
      expect(within(card).getByText("Who has and hasn't logged in the last 7 days")).toBeInTheDocument();
      expect(card).toHaveTextContent('118logged · 69 not logged63%');
    });

    it('AC-4 (D-audit): the list is read only when the reveal is opened, and once', async () => {
      const { calls } = render(OWNER, { '/kpm/overview/not-logged': { body: NOT_LOGGED } });
      await loaded();
      const reveal = screen.getByRole('button', { name: "View who hasn't logged →" });
      expect(reveal).toHaveAttribute('aria-expanded', 'false');
      expect(listCalls(calls)).toHaveLength(0);

      await userEvent.click(reveal);
      expect(reveal).toHaveAttribute('aria-expanded', 'true');
      expect(await screen.findByText('Sinta Halim — Agent')).toBeInTheDocument();
      expect(listCalls(calls)).toHaveLength(1);

      // Closed and opened again: nothing more is read, so one look writes one set of entries.
      await userEvent.click(reveal);
      expect(reveal).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(reveal);
      expect(screen.getByText('Sinta Halim — Agent')).toBeVisible();
      expect(listCalls(calls)).toHaveLength(1);
    });

    it('AC-4: names the three longest silent, then points to the full list on All members', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: NOT_LOGGED } });
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: "View who hasn't logged →" }));
      const list = await within(section('Engagement')).findByRole('list');
      const rows = within(list).getAllByRole('listitem');
      expect(rows.map((r) => r.textContent)).toEqual([
        'SHSinta Halim — AgentNever logged',
        'DPDedy Pranata — AgentLast logged 12 days ago',
        'RARina Agustina — AABLast logged 9 days ago',
      ]);
      expect(screen.queryByText(/Tono Wibisono/)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: '+ 66 more — full list on the People screen' })).toHaveAttribute('href', '/people/members');
    });

    it('AC-4: draws no more-line when the three are everybody', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: { total: 2, members: NOT_LOGGED.members.slice(0, 2) } } });
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: "View who hasn't logged →" }));
      await screen.findByText('Sinta Halim — Agent');
      expect(screen.queryByRole('link', { name: /more — full list/ })).not.toBeInTheDocument();
    });

    it('AC-4: says so when everybody has logged by the time the list is read', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: { total: 0, members: [] } } });
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: "View who hasn't logged →" }));
      expect(await screen.findByText('Everybody has logged in the last 7 days.')).toBeInTheDocument();
    });

    it('AC-9: a list that fails to load says so, and tries again', async () => {
      const { calls } = render(OWNER, {
        '/kpm/overview/not-logged': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
          { body: NOT_LOGGED },
        ],
      });
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: "View who hasn't logged →" }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Sinta Halim — Agent')).toBeInTheDocument();
      expect(listCalls(calls)).toHaveLength(2);
    });

    it('AC-4: offers no reveal when nobody is missing from the week', async () => {
      render(OWNER, {}, overviewView({
        engagement: { loggedThisMonth: { count: 187, of: 187, pct: 100, lastMonthToDate: 187 }, loggedThisWeek: { logged: 187, notLogged: 0, pct: 100 } },
      }));
      await loaded();
      expect(screen.queryByRole('button', { name: "View who hasn't logged →" })).not.toBeInTheDocument();
      expect(within(section('Engagement')).getByText('Same as last month (187)')).toBeInTheDocument();
    });
  });

  describe('Coaching coverage (AC-5)', () => {
    it('AC-5, P18.97-T3 AC-1: coached in the last 7 and 30 days, whole, in the prototype’s status colours', async () => {
      render();
      await loaded();
      const coverage = within(section('Coaching coverage'));
      const seven = coverage.getByText('Coached in last 7 days').nextElementSibling!;
      const thirty = coverage.getByText('Coached in last 30 days').nextElementSibling!;
      expect(seven).toHaveTextContent('112/ 18760%');
      expect(thirty).toHaveTextContent('148/ 18779%');
      expect(within(seven as HTMLElement).getByText('60%').className).toContain('text-alert');
      expect(within(thirty as HTMLElement).getByText('79%').className).toContain('text-success');
    });

    it('AC-5: AB coaching frequency, lowest first, four shown, with each AB’s team and share', async () => {
      render();
      await loaded();
      const board = within(section('Coaching coverage'));
      expect(board.getByRole('heading', { name: 'AB coaching frequency' })).toBeInTheDocument();
      const rows = board.getAllByRole('listitem');
      expect(rows.map((r) => r.textContent)).toEqual([
        'Hendra Wibowo · 31 in team6/31 · 19%',
        'Budi Santoso · 18 in team5/18 · 28%',
        'Fajar Nugroho · 22 in team9/22 · 41%',
        'Lina Chandra · 15 in team8/15 · 53%',
      ]);
      expect(board.getByText(/^Showing 4 of 8 ABs/)).toBeInTheDocument();
    });

    it('AC-5 (D-coverage): view full ranking expands the same card in place, and folds back', async () => {
      const { calls } = render();
      await loaded();
      const board = within(section('Coaching coverage'));
      const more = board.getByRole('button', { name: 'view full ranking →' });
      expect(more).toHaveAttribute('aria-expanded', 'false');
      const before = calls.length;

      await userEvent.click(more);
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(board.getAllByRole('listitem')).toHaveLength(8);
      expect(board.getByText(/^Showing 8 of 8 ABs/)).toBeInTheDocument();
      expect(board.getByText('Wilson Tanoto').closest('li')).toHaveTextContent('23/28 · 82%');
      expect(calls.length).toBe(before);

      await userEvent.click(board.getByRole('button', { name: 'show fewer' }));
      expect(board.getAllByRole('listitem')).toHaveLength(4);
    });

    it('P18.97-T3 AC-5: every AB is listed — one who leads nobody last, No team where the rate would be (UI-017)', async () => {
      const view = overviewView();
      const leaderboard = [...view.coaching.leaderboard, noTeam('mem-maya-h', 'Maya Halim')];
      render(OWNER, {}, { ...view, coaching: { ...view.coaching, leaderboard } });
      await loaded();
      const board = within(section('Coaching coverage'));
      // *"Showing 4 of {n} ABs"* counts them all: the eight who lead somebody and Maya.
      expect(board.getByText(/^Showing 4 of 9 ABs/)).toBeInTheDocument();
      await userEvent.click(board.getByRole('button', { name: 'view full ranking →' }));
      const rows = board.getAllByRole('listitem');
      expect(rows).toHaveLength(9);
      expect(rows[8]).toHaveTextContent(/^Maya HalimNo team$/);
      // No bar, no *0 in team*, no 0% and no dash: a team nobody leads is not a team nobody coached.
      expect(rows[8].querySelector('[aria-hidden="true"].rounded-pill')).toBeNull();
      expect(rows[8].textContent).not.toMatch(/0%|in team|—/);
      expect(within(rows[8]).getByText('No team').className).toContain('text-muted');
    });

    it('AC-9: says so when no AB leads a team, and a rate over nobody is a dash, never 0%', async () => {
      render(OWNER, {}, NOBODY);
      await loaded();
      const coverage = within(section('Coaching coverage'));
      expect(coverage.getByText('No AB leads a team yet.')).toBeInTheDocument();
      expect(coverage.getAllByText('No rate: nobody to count')).toHaveLength(2);
      expect(section('Coaching coverage').textContent).not.toMatch(/(^|[^\d,])0(,0)?%/);
    });
  });

  describe('Recruitment pipeline (AC-6; P18.97-T3 AC-7 — the Target a value with Edit)', () => {
    const pipeline = () => within(section('Recruitment pipeline'));
    /** The *Target* tile: its label, and what is under it. */
    const tile = () => pipeline().getByText('Target').parentElement as HTMLElement;
    const edit = () => pipeline().getByRole('button', { name: 'Edit target' });
    const box = () => screen.getByLabelText('Target') as HTMLInputElement;
    const accept = { 'PUT /kpm/overview/recruit-target': (call: { body: unknown }) => ({ body: call.body }) };
    const refused = {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } },
    };
    /** Edit, and the box emptied: ready for a number. */
    const openBox = async () => {
      await userEvent.click(edit());
      await userEvent.clear(box());
    };

    it('AC-6: the four tiles are figures, not links; the one control is the Target’s Edit', async () => {
      render();
      await loaded();
      expect(pipeline().getByText('Expected to close').nextElementSibling).toHaveTextContent('13');
      expect(pipeline().getByText('Last month').nextElementSibling).toHaveTextContent('11');
      expect(pipeline().getByText('Pipeline now').nextElementSibling).toHaveTextContent('80');
      expect(pipeline().queryByRole('link')).not.toBeInTheDocument();
      expect(pipeline().getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Edit target']);
    });

    it('P18.97-T3 AC-7: the Target reads as a labelled value — Target, 15 — with Edit, and no box until Edit is pressed', async () => {
      render();
      await loaded();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
      // The visible word is *Edit*; its name says what it edits (WCAG 2.5.3: the words are in the name).
      expect(edit()).toHaveTextContent(/^Edit$/);
      expect(pipeline().getByText('2 short of target (13 of 15)').className).toContain('text-alert');
    });

    it('P18.97-T3 AC-7: Edit opens the labelled number input in the value’s place, holding the target, focused', async () => {
      render();
      await loaded();
      await userEvent.click(edit());
      expect(box()).toHaveAttribute('type', 'number');
      expect(box()).toHaveValue(15);
      expect(box()).toHaveFocus();
      expect(pipeline().queryByRole('button', { name: 'Edit target' })).not.toBeInTheDocument();
    });

    it('P18.97-T3 AC-7: Enter saves the office’s current month, reads as a value again, and the toast says Target saved ✓', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '18{Enter}');

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target18Edit$/));
      expect(writes(calls)).toHaveLength(1);
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 18 });
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      // The field's own *Saved ✓* is the toast's now (OD-200), and the keyboard is back on *Edit*.
      expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
      expect(edit()).toHaveFocus();
      expect(pipeline().getByText('5 short of target (13 of 18)')).toBeInTheDocument();
    });

    it('P18.97-T3 AC-7: leaving the box saves what it holds at once, and the toast confirms it', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '22');
      expect(writes(calls)).toHaveLength(0);
      await userEvent.tab();

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target22Edit$/));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 22 });
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      // Nothing is sent while typing, nor after: no pause saves anything (OD-200's autosave is Enter or leaving).
      await act(() => new Promise((r) => { setTimeout(r, 700); }));
      expect(writes(calls)).toHaveLength(1);
    });

    it('P18.97-T3 AC-7: Escape leaves without saving, the value as it was, and gives the keyboard back to Edit', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '30');
      // The pill judges what is typed, as `updateRecruitStatus()` does — and goes back with the value.
      expect(pipeline().getByText('17 short of target (13 of 30)')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(edit()).toHaveFocus();
      expect(pipeline().getByText('2 short of target (13 of 15)')).toBeInTheDocument();
      await act(() => new Promise((r) => { setTimeout(r, 50); }));
      expect(writes(calls)).toHaveLength(0);
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.97-T3 AC-7: the pill’s three sentences, verbatim, as the number is typed', async () => {
      render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '13');
      expect(pipeline().getByText('On track to hit target (13 of 13)').className).toContain('text-success');

      await userEvent.clear(box());
      await userEvent.type(box(), '10');
      expect(pipeline().getByText('3 ahead of target (13 of 10)').className).toContain('text-success');
    });

    it('P18.97-T3 AC-7: the target kept already sends nothing, and reads as the value again', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await userEvent.click(edit());
      await userEvent.keyboard('{Enter}');

      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(writes(calls)).toHaveLength(0);
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.97-T3 AC-7: a number that is not a whole number from 0 is never sent, the box says why, and leaving it keeps 15', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '-3{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0.');
      expect(box()).toHaveAttribute('aria-invalid', 'true');
      await userEvent.tab();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
    });

    it('P18.97-T3 AC-7: Enter on an empty box says what it takes; leaving it empty clears nothing', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.keyboard('{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0.');
      expect(box()).toHaveFocus();
      await userEvent.tab();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(writes(calls)).toHaveLength(0);
    });

    it('P18.97-T3 AC-7: a refusal keeps the box with Couldn’t save — retry, and the retry sends the same target again', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': [refused, (call) => ({ body: call.body })] });
      await loaded();
      await openBox();
      await userEvent.type(box(), '20{Enter}');

      const retry = await within(tile()).findByRole('button', { name: "Couldn't save — retry: Target" });
      // The box stays, holding what was refused, and the refusal's reason is said under the tiles.
      expect(box()).toHaveValue(20);
      expect(screen.getByRole('alert')).toHaveTextContent('The target was not saved. Something went wrong.');
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();

      await userEvent.click(retry);

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target20Edit$/));
      // The retry sent it once more; leaving the box towards the retry sent nothing of its own.
      expect(writes(calls).map((c) => JSON.parse(c.init.body as string))).toEqual([
        { month: '2026-10', target: 20 }, { month: '2026-10', target: 20 },
      ]);
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(edit()).toHaveFocus();
    });

    it('P18.97-T3 AC-7: a newer target typed after a refusal is saved in its place, and the retry goes', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': [refused, (call) => ({ body: call.body })] });
      await loaded();
      await openBox();
      await userEvent.type(box(), '20{Enter}');
      await within(tile()).findByRole('button', { name: "Couldn't save — retry: Target" });

      await userEvent.clear(box());
      await userEvent.type(box(), '17{Enter}');

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target17Edit$/));
      expect(writes(calls).map((c) => JSON.parse(c.init.body as string).target)).toEqual([20, 17]);
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5, P18.97-T3 AC-7: says Saving… beside the box while the target is on its way, then the toast', async () => {
      const { mock } = stubFetch({ '/kpm/overview': { body: overviewView() } });
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'PUT') return mock(url, init);
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, status: 200, json: async () => ({ month: '2026-10', target: 18 }) } as Response;
      }));
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      await loaded();
      await openBox();
      await userEvent.type(box(), '18{Enter}');

      await waitFor(() => expect(within(tile()).getByText('Saving…')).toBeInTheDocument());
      // Inside the Target's own tile, and the box holds still while it goes.
      expect(box()).toHaveAttribute('readonly');
      await act(async () => { release(); });
      await waitFor(() => expect(tile()).toHaveTextContent(/^Target18Edit$/));
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5, P18.97-T3 AC-7: leaving the page with the box open still sends what it holds, with nothing drawn', async () => {
      const { calls } = stubFetch({ '/kpm/overview': { body: overviewView() }, ...accept });
      const { unmount } = renderWithSession(<KpmOverviewPage />, { me: OWNER });
      await loaded();
      await openBox();
      await userEvent.type(box(), '30');
      expect(writes(calls)).toHaveLength(0);

      unmount();

      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 30 });
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.97-T3 AC-7: none set reads No target set with Edit — and no pill judged against the prototype’s 15', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      expect(tile()).toHaveTextContent(/^TargetNo target setEdit$/);
      expect(pipeline().queryByText(/of target|target \(/)).not.toBeInTheDocument();
      await userEvent.click(edit());
      expect(box()).toHaveValue(null);
    });

    it.each([
      ['an Admin, who holds it too (ADR-0028)', ADMIN, true],
      ['an Owner', OWNER, true],
      ['a reader without the target’s permission', makeMe({ ...OWNER, permissions: READ }), false],
    ])('AC-1, P18.97-T3 AC-7: Edit is offered to %s: %s', async (_who, me, offered) => {
      render(me);
      await loaded();
      if (offered) {
        expect(edit()).toBeEnabled();
      } else {
        expect(pipeline().queryByRole('button', { name: 'Edit target' })).not.toBeInTheDocument();
        expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(tile()).toHaveTextContent(/^Target15$/);
        // The pill still reads against the target that is kept.
        expect(pipeline().getByText('2 short of target (13 of 15)')).toBeInTheDocument();
      }
    });

    it('AC-1, P18.97-T3 AC-7: a read-only support session sees the member’s Edit disabled, and writes nothing (roles §3.13)', async () => {
      const { calls } = render(SUPPORT_READ_ONLY);
      await loaded();
      expect(edit()).toBeDisabled();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
    });

    it('AC-6, P18.97-T3 AC-7: a reader who cannot set it and has none reads No target set, never a 0', async () => {
      render(makeMe({ ...OWNER, permissions: READ }), {}, EMPTY);
      await loaded();
      expect(tile()).toHaveTextContent(/^TargetNo target set$/);
    });
  });

  describe('Production — this year (AC-7)', () => {
    it('AC-7: Rp achieved of Rp target, in the product’s money formatter, and its percentage', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByText('Rp 8,4 M')).toBeInTheDocument();
      expect(production.getByText('of Rp 12,5 M target')).toBeInTheDocument();
      expect(production.getAllByText('67%')[0].className).toContain('text-alert');
      expect(section('Production — this year').textContent).not.toMatch(/\d(\.\d)?[BM]\b/);
    });

    it('AC-7: the projection marker and its label, and the bar’s two ends', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByText('Projected: Rp 11,9 M')).toBeInTheDocument();
      expect(production.getByText('Target: Rp 12,5 M')).toBeInTheDocument();
      expect(production.getByText('0')).toBeInTheDocument();
      const marker = section('Production — this year').querySelector('span.absolute.w-0\\.5[aria-hidden="true"]') as HTMLElement;
      expect(marker.style.left).toBe(`${(11900 / 12500) * 100}%`);
    });

    it('AC-7: no projection until a month of the year is held', async () => {
      const view = overviewView();
      render(OWNER, {}, overviewView({ production: { ...view.production, projectionMinor: null } }));
      await loaded();
      expect(within(section('Production — this year')).queryByText(/Projected:/)).not.toBeInTheDocument();
    });

    it('AC-7: the total names in its tooltip the months and the members it leaves out', async () => {
      render();
      await loaded();
      expect(within(section('Production — this year')).getByRole('button', {
        name: 'Not uploaded yet for Agu 2026, so not counted in this total. 3 members have no goal set, so the target leaves them out.',
      })).toBeInTheDocument();
    });

    it('AC-7: Units furthest behind target — four, lowest first, each with its unit target', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByRole('heading', { name: 'Units furthest behind target' })).toBeInTheDocument();
      expect(production.getByText('Tap a row to see the AABs inside that unit')).toBeInTheDocument();
      const rows = production.getAllByRole('button', { expanded: false }).filter((b) => b.closest('li'));
      expect(rows.map((r) => r.textContent)).toEqual([
        '▸Hendra Wibowo AB41%Rp 620 jt / 1,5 M unit target',
        '▸Budi Santoso AB60%Rp 540 jt / 900 jt unit target',
        '▸Fajar Nugroho AB64%Rp 700 jt / 1,1 M unit target',
        '▸Lina Chandra AB69%Rp 480 jt / 700 jt unit target',
      ]);
    });

    it('AC-7: a row opens to the AAB units inside it, and a unit with none says so', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      const hendra = production.getByRole('button', { name: /^Hendra Wibowo/ });
      await userEvent.click(hendra);
      expect(hendra).toHaveAttribute('aria-expanded', 'true');
      const panel = document.getElementById(hendra.getAttribute('aria-controls')!)!;
      expect(panel).toBeVisible();
      expect(within(panel).getAllByRole('listitem').map((r) => r.textContent)).toEqual([
        'Ika Wirawan AAB42%Rp 210 jt / 500 jt',
        'Yoga Pratama AAB45%Rp 180 jt / 400 jt',
      ]);

      const lina = production.getByRole('button', { name: /^Lina Chandra/ });
      await userEvent.click(lina);
      expect(within(document.getElementById(lina.getAttribute('aria-controls')!)!).getByText('No AAB in this unit yet')).toBeInTheDocument();
    });

    it('AC-7: view full ranking shows every agency in place, a figure not held as a dash', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByText(/^Showing 4 of 6 ABs/)).toBeInTheDocument();
      await userEvent.click(production.getByRole('button', { name: 'view full ranking →' }));
      const rudi = production.getByRole('button', { name: /^Rudi Hartono/ });
      expect(rudi).toHaveTextContent('Not uploaded yet / Rp 600 jt unit target');
      expect(rudi).toHaveTextContent('—');
      expect(rudi.textContent).not.toMatch(/\b0(,0)?%/);
    });

    it('AC-9: a year with no file, and nobody with a goal, says so — no figure is 0', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getAllByText('Not uploaded yet')[0]).toBeInTheDocument();
      expect(production.getByText('No goal set')).toBeInTheDocument();
      expect(production.queryByText(/Projected:/)).not.toBeInTheDocument();
      expect(production.queryByText('Rp 0')).not.toBeInTheDocument();
      await userEvent.click(production.getByRole('button', { name: /^Hadi Gunawan/ }));
      expect(production.getByText('No AAB in this unit yet')).toBeInTheDocument();
      expect(production.getByRole('button', { name: /^Hadi Gunawan/ })).toHaveTextContent('Not uploaded yet · No goal set');
    });

    it('AC-9: an office with no AB agency says so', async () => {
      render(OWNER, {}, NOBODY);
      await loaded();
      expect(within(section('Production — this year')).getByText('No AB leads a unit yet.')).toBeInTheDocument();
    });
  });

  describe('the states the prototype lacks (AC-9)', () => {
    it('AC-9: the five sections in outline while the read is on its way', async () => {
      let answer: (value: unknown) => void = () => undefined;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { answer = resolve; })));
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      expect(screen.getByRole('status')).toHaveTextContent('Loading the overview…');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Overview$/);
      await act(async () => answer({ ok: true, status: 200, json: async () => overviewView() }));
      expect(await loaded()).toBeInTheDocument();
      expect(screen.queryByText('Loading the overview…')).not.toBeInTheDocument();
    });

    it('AC-9: an error with a retry, which reads again', async () => {
      const { calls } = stubFetch({
        '/kpm/overview': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } },
          { body: overviewView() },
        ],
      });
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await loaded()).toBeInTheDocument();
      expect(overviewCalls(calls)).toHaveLength(2);
    });

    it('AC-9: an office with nobody in it divides nothing by zero', async () => {
      render(OWNER, {}, NOBODY);
      await loaded();
      expect(within(section('Team composition')).getByText('+0 new this month')).toBeInTheDocument();
      expect(section('Engagement').textContent).not.toMatch(/NaN|Infinity|(^|[^\d,])0(,0)?%/);
      expect(within(section('Engagement')).getAllByText('No rate: nobody to count')).toHaveLength(2);
    });
  });

  describe('accessibility and phones (AC-10)', () => {
    it('AC-10: the reveal and both expanders are buttons that say whether they are open', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: NOT_LOGGED } });
      await loaded();
      for (const name of ["View who hasn't logged →", 'view full ranking →']) {
        for (const button of screen.getAllByRole('button', { name })) {
          expect(button).toHaveAttribute('aria-expanded', 'false');
          expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeNull();
        }
      }
    });

    it('AC-10: every bar is a picture of a figure printed beside it, hidden from assistive technology', async () => {
      render();
      await loaded();
      const bars = [...document.body.querySelectorAll('span.rounded-pill.border-hairline.bg-base')];
      expect(bars.length).toBeGreaterThan(8);
      for (const bar of bars) expect(bar).toHaveAttribute('aria-hidden', 'true');
    });

    it('AC-10: colours are tokens — no raw hex anywhere in the page’s markup', async () => {
      render();
      await loaded();
      expect(document.body.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });
  });

  describe('who may open it (AC-1)', () => {
    it.each([
      ['an Owner', OWNER],
      ['an Admin', ADMIN],
    ])('AC-1: %s reads the Overview', async (_who, me) => {
      const { calls } = render(me);
      expect(await loaded()).toBeInTheDocument();
      expect(overviewCalls(calls)).toHaveLength(1);
    });

    it('AC-1: a support session reads what its member reads', async () => {
      render(SUPPORT_READ_ONLY);
      expect(await loaded()).toBeInTheDocument();
    });

    it.each([
      ['a field AB', FIELD_AB],
      ['a Super Admin outside a support session', SUPER_ADMIN],
    ])('AC-1: %s is refused, and nothing is asked of the API', async (_who, me) => {
      const { calls } = stubFetch({ '/kpm/overview': { body: overviewView() } });
      renderWithSession(<KpmOverviewPage />, { me });
      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_overview:read');
      expect(overviewCalls(calls)).toHaveLength(0);
    });

    it('AC-1: inside the tenant shell, as the Owner lands on it', async () => {
      stubFetch({ '/kpm/overview': { body: overviewView() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });
      expect(await within(main()).findByRole('region', { name: 'Team composition' })).toBeInTheDocument();
    });
  });
});
