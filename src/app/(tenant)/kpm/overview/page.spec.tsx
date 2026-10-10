import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { EMPTY, NOBODY, NOT_LOGGED, overviewView } from './overview-fixtures';
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
    it('AC-2: is titled KPM Overview, its sub-line composed from the office', async () => {
      render();
      await loaded();
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent(/^KPM Overview$/);
      expect(screen.getByText('Prudential · KPM 0417 — BSD City Branch')).toBeInTheDocument();
    });

    it('AC-2: draws the five sections in the prototype’s order, with their heads verbatim', async () => {
      render();
      await loaded();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Team composition', 'Engagement', 'Coaching coverage', 'Recruitment pipeline', 'Production — this year',
      ]);
      expect(within(section('Engagement')).getByText('Last 7 days')).toBeInTheDocument();
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
      const labels = [...region.querySelectorAll('p.mb-1\\.5')].map((p) => p.textContent);
      expect(labels).toEqual(['Total members', 'Agency Builder', 'Associate Agency Builder', 'Agent']);
      const counts = ['Agency Builder', 'Associate Agency Builder', 'Agent']
        .map((label) => Number(within(region).getByText(label).closest('p')?.nextElementSibling?.textContent));
      expect(counts).toEqual([8, 24, 155]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(187);
    });

    it('AC-3: each rung’s dot is the rung’s colour token, and its label says which rung', async () => {
      render();
      const region = await loaded();
      const dot = (label: string) => within(region).getByText(label).closest('p')?.querySelector('[aria-hidden="true"]');
      expect(dot('Agency Builder')?.className).toContain('bg-role-ab');
      expect(dot('Associate Agency Builder')?.className).toContain('bg-role-aab');
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

    it('AC-4: the trend is against last month to the same day, Up with its rise', async () => {
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
    it('AC-5: coached in the last 7 and 30 days, in the prototype’s status colours', async () => {
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

    it('AC-9: says so when no AB leads a team, and a rate over nobody is a dash, never 0%', async () => {
      render(OWNER, {}, NOBODY);
      await loaded();
      const coverage = within(section('Coaching coverage'));
      expect(coverage.getByText('No AB leads a team yet.')).toBeInTheDocument();
      expect(coverage.getAllByText('No rate: nobody to count')).toHaveLength(2);
      expect(section('Coaching coverage').textContent).not.toContain('0%');
    });
  });

  describe('Recruitment pipeline (AC-6)', () => {
    it('AC-6: the four tiles are figures, not links', async () => {
      render();
      await loaded();
      const pipeline = section('Recruitment pipeline');
      expect(within(pipeline).getByText('Expected to close').nextElementSibling).toHaveTextContent('13');
      expect(within(pipeline).getByText('Last month').nextElementSibling).toHaveTextContent('11');
      expect(within(pipeline).getByText('Pipeline now').nextElementSibling).toHaveTextContent('80');
      expect(within(pipeline).queryByRole('link')).not.toBeInTheDocument();
      expect(within(pipeline).queryByRole('button')).not.toBeInTheDocument();
    });

    it('AC-6: the Target is a labelled number input holding this month’s target, and the pill judges against it', async () => {
      render();
      await loaded();
      const input = screen.getByLabelText('Target');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveValue(15);
      expect(within(section('Recruitment pipeline')).getByText('2 short of target (13 of 15)').className).toContain('text-alert');
    });

    it('AC-6: the pill’s three sentences, verbatim, as the number is typed', async () => {
      render(OWNER, { 'PUT /kpm/overview/recruit-target': (call) => ({ body: call.body }) });
      await loaded();
      const input = screen.getByLabelText('Target');
      const pipeline = within(section('Recruitment pipeline'));

      await userEvent.clear(input);
      await userEvent.type(input, '13');
      expect(pipeline.getByText('On track to hit target (13 of 13)').className).toContain('text-success');

      await userEvent.clear(input);
      await userEvent.type(input, '10');
      expect(pipeline.getByText('3 ahead of target (13 of 10)').className).toContain('text-success');
    });

    it('AC-6: saves the target for the office’s current month once typing settles, and only then', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': (call) => ({ body: call.body }) });
      await loaded();
      const input = screen.getByLabelText('Target');
      await userEvent.clear(input);
      await userEvent.type(input, '18');

      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 18 });
      // No save for the 1 on the way to 18, and none for the empty box the clear left.
      expect(writes(calls)).toHaveLength(1);
    });

    it('AC-6: leaving the box saves what it holds at once, without waiting for the pause', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': (call) => ({ body: call.body }) });
      await loaded();
      const input = screen.getByLabelText('Target');
      await userEvent.clear(input);
      await userEvent.type(input, '22');
      await userEvent.tab();
      // Saved on leaving, not 600 ms later: a reader who types and moves on keeps what they typed.
      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 22 });
      // The pause then finds the value kept already, and sends nothing more.
      await act(() => new Promise((r) => { setTimeout(r, 700); }));
      expect(writes(calls)).toHaveLength(1);
    });

    it('AC-6: the server’s refusal is said, and the box goes back to what is kept', async () => {
      render(OWNER, {
        'PUT /kpm/overview/recruit-target': {
          status: 400,
          body: { error: { code: 'VALIDATION_FAILED', message: 'The target must be a whole number from 0.', requestId: 'r-2' } },
        },
      });
      await loaded();
      const input = screen.getByLabelText('Target');
      await userEvent.clear(input);
      await userEvent.type(input, '20');

      expect(await screen.findByRole('alert')).toHaveTextContent('The target was not saved. The target must be a whole number from 0.');
      await waitFor(() => expect(input).toHaveValue(15));
      expect(screen.getByText('2 short of target (13 of 15)')).toBeInTheDocument();
    });

    it('AC-6: sends nothing for a number that is not a whole number from 0, and says why', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': (call) => ({ body: call.body }) });
      await loaded();
      const input = screen.getByLabelText('Target');
      await userEvent.clear(input);
      await userEvent.type(input, '-3');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0.');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      await act(() => new Promise((r) => { setTimeout(r, 700); }));
      expect(writes(calls)).toHaveLength(0);
    });

    it('AC-6: no pill without a target, rather than one judged against the prototype’s 15', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      expect(screen.getByLabelText('Target')).toHaveValue(null);
      expect(within(section('Recruitment pipeline')).queryByText(/of target|target \(/)).not.toBeInTheDocument();
    });

    it.each([
      ['an Admin, who holds it too (ADR-0028)', ADMIN, true],
      ['an Owner', OWNER, true],
      ['a reader without the target’s permission', makeMe({ ...OWNER, permissions: READ }), false],
    ])('AC-1, AC-6: the Target input is offered to %s: %s', async (_who, me, offered) => {
      render(me);
      await loaded();
      const pipeline = within(section('Recruitment pipeline'));
      if (offered) {
        expect(pipeline.getByLabelText('Target')).toBeInTheDocument();
      } else {
        expect(pipeline.queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(pipeline.getByText('Target').nextElementSibling).toHaveTextContent('15');
        // The pill still reads against the target that is kept.
        expect(pipeline.getByText('2 short of target (13 of 15)')).toBeInTheDocument();
      }
    });

    it('AC-1, AC-6: a read-only support session sees the member’s Target input disabled, and writes nothing (roles §3.13)', async () => {
      const { calls } = render(SUPPORT_READ_ONLY);
      await loaded();
      const input = within(section('Recruitment pipeline')).getByLabelText('Target');
      expect(input).toBeDisabled();
      expect(input).toHaveValue(15);
      expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
    });

    it('AC-6: a reader who cannot set it and has none sees a dash, never a 0', async () => {
      render(makeMe({ ...OWNER, permissions: READ }), {}, EMPTY);
      await loaded();
      const tile = within(section('Recruitment pipeline')).getByText('Target').nextElementSibling!;
      expect(tile).toHaveTextContent('—No target set');
    });
  });

  describe('Production — this year (AC-7)', () => {
    it('AC-7: Rp achieved of Rp target, in the product’s money formatter, and its percentage', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByText('Rp 8.400.000.000')).toBeInTheDocument();
      expect(production.getByText('of Rp 12.500.000.000 target')).toBeInTheDocument();
      expect(production.getAllByText('67%')[0].className).toContain('text-alert');
      expect(section('Production — this year').textContent).not.toMatch(/\d(\.\d)?[BM]\b/);
    });

    it('AC-7: the projection marker and its label, and the bar’s two ends', async () => {
      render();
      await loaded();
      const production = within(section('Production — this year'));
      expect(production.getByText('Projected: Rp 11.900.000.000')).toBeInTheDocument();
      expect(production.getByText('Target: Rp 12.500.000.000')).toBeInTheDocument();
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
        name: 'Not uploaded yet for August 2026, so not counted in this total. 3 members have no goal set, so the target leaves them out.',
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
        '▸Hendra Wibowo AB41%Rp 620.000.000 / Rp 1.500.000.000 unit target',
        '▸Budi Santoso AB60%Rp 540.000.000 / Rp 900.000.000 unit target',
        '▸Fajar Nugroho AB64%Rp 700.000.000 / Rp 1.100.000.000 unit target',
        '▸Lina Chandra AB69%Rp 480.000.000 / Rp 700.000.000 unit target',
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
        'Ika Wirawan AAB42%Rp 210.000.000 / Rp 500.000.000',
        'Yoga Pratama AAB45%Rp 180.000.000 / Rp 400.000.000',
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
      expect(rudi).toHaveTextContent('Not uploaded yet / Rp 600.000.000 unit target');
      expect(rudi).toHaveTextContent('—');
      expect(rudi.textContent).not.toMatch(/\b0%/);
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
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KPM Overview');
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
      expect(section('Engagement').textContent).not.toMatch(/NaN|Infinity|\b0%/);
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
