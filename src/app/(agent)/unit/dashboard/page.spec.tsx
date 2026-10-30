import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  activities, AGUS_ME, dashboard, EMPTY, NEW_HIRE_VIEW, RATIOS, rp, UNITS,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import AgentLayout from '../../layout';
import UnitDashboardPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

function render(
  view: UnitDashboardView | StubReply | StubReply[] = dashboard(),
  { me = AGUS_ME, period, routes = {} }: { me?: ReturnType<typeof makeMe>; period?: string; routes?: Record<string, StubReply | StubReply[]> } = {},
) {
  const reply = Array.isArray(view) || typeof view === 'function' || 'status' in view || 'body' in view ? view : { body: view };
  const stub = stubFetch({ 'GET /unit/dashboard': reply as StubReply, '/activity/ratios': { body: RATIOS }, ...routes });
  nav.search = new URLSearchParams(period ? { period } : {}).toString();
  renderWithSession(<UnitDashboardPage />, { me });
  return stub;
}

const table = () => screen.findByRole('table', { name: 'Your team’s roster' });
/** A person's row, found by the link their name is. */
const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!;
const writes = (calls: { init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');
/** A column's heading as drawn: its words, before an ⓘ and the bubble the ⓘ holds. */
const heading = (h: HTMLElement) => (h.textContent ?? '').split('ⓘ')[0];

/** jsdom cannot follow a link: a click on one is kept from trying, as a test of a drill needs only its address. */
const stayPut = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
};

/*
 * **The Unit Dashboard, UI V1** (Phase 18.99 T4; the owner's report of 2026-10-30): each ticket's *Done when* below, by
 * its id — UI-001 (the tabs, the Activities table and its ratio card), UI-002 (the phone's accordion), UI-003 (the
 * tiles), UI-005 (the pill), UI-007 (one ⓘ), UI-009 (the tablet's and the desktop's tables), UI-011 (a row opens the
 * person), UI-012 (the search pill), UI-028 (the lead counts and *Last updated*). The P15 tests of the states, who sees
 * what and *Update production* stand; those of the roster's old columns, its ⌄ and detail, *Chasing MDRT* and the
 * phone's cards were retired with what they tested (UI-002, UI-009, UI-011).
 */
describe('the Unit Dashboard (P15-T2; UI V1, Phase 18.99 T4)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
    document.addEventListener('click', stayPut);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  describe('UI-001 Overview | Activities (Phase 18.99 T4)', () => {
    const ACTIVITIES = (view = activities()) => ({ 'GET /unit/dashboard/activities': { body: view } });

    it('UI-001 draws the two tabs under the title, Overview first, and switches without a reload, the tab in the address', async () => {
      const { calls } = render(dashboard(), { routes: ACTIVITIES() });
      await table();
      const tabs = screen.getByRole('tablist', { name: 'Unit Dashboard' });
      expect(within(tabs).getAllByRole('tab').map((t) => [t.textContent, t.getAttribute('aria-selected')]))
        .toEqual([['Overview', 'true'], ['Activities', 'false']]);
      await userEvent.click(within(tabs).getByRole('tab', { name: 'Activities' }));
      expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard?tab=activities', { scroll: false });
      expect(await screen.findByRole('table', { name: 'Activities · Unit' })).toBeInTheDocument();
      expect(within(tabs).getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'true');
      // The Overview's period is not on this tab (UI-001).
      expect(screen.queryByRole('combobox', { name: 'Period' })).not.toBeInTheDocument();
      expect(calls.map((c) => c.url)).toEqual([
        'http://api.test/api/v1/unit/dashboard?period=month',
        'http://api.test/api/v1/unit/dashboard/activities?span=week',
      ]);
    });

    it('UI-001 opens on the address’s tab, reading only what it shows', async () => {
      nav.search = 'tab=activities';
      const { calls } = stubFetch({ 'GET /unit/dashboard': { body: dashboard() }, ...ACTIVITIES() });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      await screen.findByRole('table', { name: 'Activities · Unit' });
      expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/unit/dashboard/activities?span=week']);
    });

    const openActivities = async (view = activities()) => {
      nav.search = 'tab=activities';
      const stub = stubFetch({ ...ACTIVITIES(view) });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      await screen.findByRole('table', { name: 'Activities · Unit' });
      return stub;
    };
    /** A table's counts, a zero read as the 0 a screen reader hears. */
    const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => Number((c.textContent ?? '').replace('·', '')));

    it('UI-111 a person column shows their saved photo; a person without one, their initials', async () => {
      const photo = 'https://cdn.test/user/u-indah/avatar/a.jpg?sig=abc';
      const view = activities();
      view.people = view.people.map((p) => (p.name === 'Indah Lestari' ? { ...p, photoUrl: photo } : p));
      await openActivities(view);
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      expect(within(grid).getByRole('columnheader', { name: 'Indah Lestari' }).querySelector('img')).toHaveAttribute('src', photo);
      expect(within(grid).getByRole('columnheader', { name: 'Siti Rahma' }).querySelector('img')).toBeNull();
    });

    it('UI-001 the table: Aktivitas, the sticky Total, one column per person by first name; Total equals the sum of the person columns', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      expect(within(grid).getAllByRole('columnheader')).toHaveLength(5);
      for (const name of ['Activity', 'Total', 'Agus Santoso', 'Indah Lestari', 'Siti Rahma']) {
        expect(within(grid).getByRole('columnheader', { name })).toBeInTheDocument();
      }
      // The first name in capitals is what shows; the full name is what a screen reader hears.
      expect(within(within(grid).getByRole('columnheader', { name: 'Agus Santoso' })).getByText('Agus')).toHaveAttribute('aria-hidden', 'true');
      // The sticky columns: Aktivitas at the edge, Total beside it; only the person columns slide on a phone.
      expect(within(grid).getByRole('columnheader', { name: 'Activity' }).className).toMatch(/sticky left-0/);
      expect(within(grid).getByRole('columnheader', { name: 'Total' }).className).toMatch(/sticky left-\[7\.5rem\]/);
      expect(grid.parentElement).toHaveClass('overflow-x-auto');
      for (const type of ['Set Appointment', 'Mendapatkan calon prospek baru', 'Sales meeting', 'Submission polis']) {
        const [totalCell, ...people] = cells(within(grid).getByRole('rowheader', { name: type }).closest('tr')!);
        expect({ type, total: totalCell }).toEqual({ type, total: people.reduce((s, n) => s + n, 0) });
      }
      const foot = within(grid).getByRole('rowheader', { name: 'Total' }).closest('tr')!;
      expect(cells(foot)).toEqual([21, 1, 20, 0]);
    });

    it('UI-001 Unit | Group: the Group adds the AAB units’ people and their totals, without another read', async () => {
      const { calls } = await openActivities();
      await userEvent.click(within(screen.getAllByRole('group', { name: 'Unit or Group' })[0]).getByRole('button', { name: 'Group' }));
      const grid = await screen.findByRole('table', { name: 'Activities · Group' });
      expect(within(grid).getAllByRole('columnheader')).toHaveLength(6);
      expect(cells(within(grid).getByRole('rowheader', { name: 'Total' }).closest('tr')!)).toEqual([25, 1, 20, 0, 4]);
      expect(calls).toHaveLength(1);
    });

    it('UI-001 ‹ › move one period, › disabled on the current one; Minggu | Bulan reads the month', async () => {
      const { calls } = await openActivities();
      expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled();
      expect(screen.getByLabelText(/^Pick a date: 26 Oct – 1 Nov 2026$/)).toHaveAttribute('max', '2026-10-30');
      await userEvent.click(screen.getByRole('button', { name: 'Previous period' }));
      await waitFor(() => expect(calls.at(-1)!.url).toBe('http://api.test/api/v1/unit/dashboard/activities?span=week&date=2026-10-25'));
      await userEvent.click(within(screen.getByRole('group', { name: 'Period' })).getByRole('button', { name: 'Monthly' }));
      await waitFor(() => expect(calls.at(-1)!.url).toBe('http://api.test/api/v1/unit/dashboard/activities?span=month'));
    });

    it('UI-001 a zero is a light · a screen reader hears as 0; cells tint by size; a closed section shows its total', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const row = within(grid).getByRole('rowheader', { name: 'Set Appointment' }).closest('tr')!;
      const [, agus, indah] = within(row).getAllByRole('cell');
      expect(agus).toHaveTextContent('·0');
      expect(agus.className).not.toMatch(/bg-amber/);
      // Indah's 9 is the table's largest: the strongest tint; Agus's 1 on the next row the lightest.
      expect(indah.className).toMatch(/bg-amber\/45/);
      expect(within(within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' }).closest('tr')!).getAllByRole('cell')[1].className)
        .toMatch(/bg-amber\/10/);
      // Leads generation and Selling open; Recruitment closed, its total beside its name.
      const closed = within(grid).getByRole('button', { name: 'Show Recruitment' });
      expect(closed).toHaveAttribute('aria-expanded', 'false');
      expect(closed).toHaveTextContent('Recruitment · 0');
      await userEvent.click(closed);
      expect(within(grid).getByRole('rowheader', { name: 'Melakukan presentasi recruitment' })).toBeInTheDocument();
    });

    it('UI-001 the ratio card: Ratio · last 30 days, its own Unit | Group, Unit first; switching changes the values', async () => {
      await openActivities();
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      const switcher = within(card).getByRole('group', { name: 'Unit or Group' });
      expect(within(switcher).getByRole('button', { name: 'Unit' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(card).getByText('Selling success rate').closest('li')).toHaveTextContent('18%');
      await userEvent.click(within(switcher).getByRole('button', { name: 'Group' }));
      expect(within(card).getByText('Selling success rate').closest('li')).toHaveTextContent('33%');
      // The table's own switch is unchanged by the card's.
      expect(screen.getByRole('table', { name: 'Activities · Unit' })).toBeInTheDocument();
    });

    it('UI-001 somebody who leads nobody meets the empty unit on this tab too', async () => {
      nav.search = 'tab=activities';
      stubFetch(ACTIVITIES(activities({ empty: true, people: [], totals: { unit: { counts: [], total: 0 }, group: { counts: [], total: 0 } } })));
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('UI-003 the stat tiles', () => {
    const tile = (label: string) => screen.getByText(label).closest<HTMLElement>('[data-stat-tile]')!;

    it('UI-003 Tim Anda · Group production · Active Agent {month} · Recruitment {month}: one number each, its unit, its chips', async () => {
      render();
      await table();
      expect(tile('Your team')).toHaveTextContent('16agents4 direct12 AAB');
      expect(tile('Group production')).toHaveTextContent('78%IDR 1Bof IDR 1.3B');
      // UI-013: out of manpower, its ring the whole percentage, Unit then AAB.
      expect(tile('Active Agent October')).toHaveTextContent('12of 16');
      expect(within(tile('Active Agent October')).getByRole('img')).toHaveAccessibleName(/75%/);
      expect(tile('Active Agent October')).toHaveTextContent('Unit 3/4AAB 9/12');
      expect(tile('Recruitment October')).toHaveTextContent('2candidatesUnit 1AAB 1');
      // No names in a tile.
      expect(document.querySelector('[data-unit-tiles]')!.textContent).not.toMatch(/Agus|Sari|Arief/);
    });

    it('UI-003 two by two below 1024px, one row of four from it; the number on one line', async () => {
      render();
      await table();
      expect(document.querySelector('[data-unit-tiles]')).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
      expect(within(tile('Group production')).getByText('IDR 1')).toHaveClass('whitespace-nowrap');
    });

    it('UI-003 the month in the labels follows the office’s month', async () => {
      render(dashboard({ month: '2026-11' }));
      await table();
      expect(screen.getByText('Active Agent November')).toBeInTheDocument();
      expect(screen.getByText('Recruitment November')).toBeInTheDocument();
    });

    it('UI-003 the production tile names who it leaves out behind its ⓘ, and says Not uploaded yet, never 0', async () => {
      render(dashboard({
        tiles: { ...dashboard().tiles, directGroupProduction: { ...dashboard().tiles.directGroupProduction, actualMinor: null, attainmentPct: null, missing: 14 } },
      }));
      await table();
      expect(tile('Group production')).toHaveTextContent('Not uploaded yet');
      expect(within(tile('Group production')).getByRole('button', { name: /^Not uploaded yet for/ })).toBeInTheDocument();
    });
  });

  describe('UI-005, UI-007, UI-009, UI-028 the roster on a desktop', () => {
    it('UI-009 heads the table Name · Goal progress · Sales leads · Closing · Recruitment leads · Potential recruits · Activity · Last 1:1 · Status · ›', async () => {
      render();
      const grid = await table();
      expect(within(grid).getAllByRole('columnheader').map(heading)).toEqual([
        'Name', 'Goal progress', 'Sales leads', 'Closing', 'Recruitment leads', 'Potential recruits', 'Activity', 'Last 1:1',
        'Status', 'Details',
      ]);
      // No sideways scroll: a fixed table the card's width, its header sticky.
      expect(grid).toHaveClass('w-full', 'table-fixed');
      expect(grid.className).not.toMatch(/min-w-/);
      expect(grid.querySelector('thead')!.className).toMatch(/\[&_th\]:sticky/);
    });

    it('UI-009 every unit open, its header row its totals and Active n/m; the header closes it', async () => {
      render();
      const grid = await table();
      const own = within(grid).getByRole('button', { name: 'Your Unit · 4' });
      expect(own).toHaveAttribute('aria-expanded', 'true');
      expect(own.closest('tr')).toHaveTextContent('Active 3/4');
      expect(within(grid).getByRole('button', { name: 'Sari Wulandari’s Unit · 6' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(grid).getByRole('button', { name: 'Wulan Sari’s Unit · 2' })).toHaveAttribute('aria-expanded', 'true');
      await userEvent.click(own);
      expect(own).toHaveAttribute('aria-expanded', 'false');
      expect(within(grid).queryByRole('link', { name: 'Dimas Pratama' })).not.toBeInTheDocument();
    });

    it('UI-028 a row’s four lead counts and Closing, a zero a light ·, Closing in amber when above zero', async () => {
      render();
      await table();
      const indah = within(rowOf('Indah Lestari')).getAllByRole('cell');
      expect(indah.slice(1, 5).map((c) => c.textContent)).toEqual(['6', '2', '2', '1']);
      expect(within(indah[2]).getByText('2')).toHaveClass('text-pill-amber-ink');
      const dimas = within(rowOf('Dimas Pratama')).getAllByRole('cell');
      expect(dimas.slice(1, 5).map((c) => c.textContent)).toEqual(['9', '·0', '·0', '·0']);
    });

    it('UI-028 Last updated: the office’s latest production import, beside the title; none without one', async () => {
      render();
      await table();
      expect(screen.getByText('Last updated 7 Oct 26')).toBeInTheDocument();
      cleanup();
      vi.unstubAllGlobals();
      render(dashboard({ lastUpload: null }));
      await table();
      expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    });

    it('UI-005 the status pill: red, amber, green, grey, in its words, never a dot; the % red under 100 and green from it', async () => {
      render();
      await table();
      const pill = (name: string) => within(rowOf(name)).getAllByRole('cell')[7].querySelector('[data-tone]')!;
      expect([pill('Siti Rahma'), pill('Dimas Pratama'), pill('Indah Lestari'), pill('Sari Wulandari')].map((p) => [p.textContent, p.getAttribute('data-tone')]))
        .toEqual([['Needs attention', 'red'], ['Watch closely', 'amber'], ['On track', 'green'], ['No goal set', 'grey']]);
      expect(within(rowOf('Dimas Pratama')).getByText('82%')).toHaveClass('text-signal-red');
      expect(within(rowOf('You (Agus)')).getByText('135%')).toHaveClass('text-signal-green');
    });

    it.each(['7d', 'year'])('UI-005 no pill and no chips on %s: the status is the current month’s', async (period) => {
      render(dashboard({ period: period as UnitDashboardView['period'] }), { period });
      await table();
      expect(document.querySelector('[data-tone="red"]')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'How is status decided?' })).not.toBeInTheDocument();
    });

    it('UI-007 exactly one status ⓘ on the page, on the Status heading', async () => {
      render();
      const grid = await table();
      expect(screen.getAllByRole('button', { name: 'How is status decided?' })).toHaveLength(1);
      expect(within(within(grid).getAllByRole('columnheader')[8]).getByRole('button', { name: 'How is status decided?' })).toBeInTheDocument();
    });

    it('UI-002, UI-009 the chips filter the rows; their counts are the statuses’', async () => {
      render();
      const grid = await table();
      const chips = screen.getByRole('group', { name: 'Filter by status' });
      expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 14', 'Needs attention 4', 'Watch closely 6']);
      await userEvent.click(within(chips).getByRole('button', { name: 'Needs attention 4' }));
      expect(within(chips).getByRole('button', { name: 'Needs attention 4' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(grid).getAllByRole('link').map((a) => a.textContent).sort())
        .toEqual(['Budi Santoso', 'Dewi Kartika', 'Siti Rahma', 'Wahyu Hidayat']);
    });

    it('UI-009 + Add agent and Update production in the roster’s header row, beside the chips', async () => {
      render(dashboard(), { me: { ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] } });
      await table();
      const header = screen.getByRole('heading', { name: 'Your team’s roster' }).parentElement!;
      expect(within(header).getByRole('button', { name: '+ Add agent' })).toBeInTheDocument();
      expect(within(header).getByRole('button', { name: 'Update production' })).toBeInTheDocument();
      expect(within(header).getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    });
  });

  describe('UI-011 a row opens the person', () => {
    it('UI-011 a row is a link, whole: the person’s Personal Summary tab, ‹ back to this page; your own row to /summary', async () => {
      render(dashboard(), { period: '7d' });
      await table();
      expect(screen.getByRole('link', { name: 'Indah Lestari' })).toHaveAttribute('href', '/coaching/mem-indah/summary?from=%2Funit%2Fdashboard%3Fperiod%3D7d');
      expect(screen.getByRole('link', { name: 'You (Agus)' })).toHaveAttribute('href', '/summary');
      expect(screen.getByRole('link', { name: 'Indah Lestari' }).className).toMatch(/after:absolute after:inset-0/);
      expect(rowOf('Indah Lestari')).toHaveClass('relative');
      expect(screen.queryByRole('button', { name: /View details/ })).not.toBeInTheDocument();
    });

    it('UI-011 somebody whose pages the reader may not open is a row that goes nowhere', async () => {
      render(dashboard({ yourUnit: { ...dashboard().yourUnit, rows: dashboard().yourUnit.rows.map((r) => (r.isReader ? r : { ...r, coached: false })) } }));
      await table();
      expect(screen.queryByRole('link', { name: 'Dimas Pratama' })).not.toBeInTheDocument();
      expect(screen.getByText('Dimas Pratama')).toBeInTheDocument();
    });

    it('UI-011 ‹ comes back to the roster where it was left: the scroll kept on leaving, restored on return', async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      sessionStorage.clear();
      render();
      await table();
      Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
      await userEvent.click(screen.getByRole('link', { name: 'Indah Lestari' }));
      expect(JSON.parse(sessionStorage.getItem('unit-dashboard:return')!)).toEqual({ at: '/unit/dashboard', y: 640 });
      cleanup();
      render();
      await table();
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 640));
      expect(sessionStorage.getItem('unit-dashboard:return')).toBeNull();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    });
  });

  describe('UI-002 the roster on a phone', () => {
    beforeEach(() => { atWidth(375); });

    it('UI-002 an accordion by leader: Your Unit first and open, each AAB unit closed, no table, no ⌄', async () => {
      render();
      const own = await screen.findByRole('button', { name: /^Your Unit · 4/ });
      expect(own).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: /^Arief Wibowo’s Unit · 3/ })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: /^Sari Wulandari’s Unit · 6/ })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['You (Agus)', 'Dimas Pratama', 'Indah Lestari', 'Siti Rahma']);
      await userEvent.click(screen.getByRole('button', { name: /^Sari Wulandari’s Unit · 6/ }));
      // Sari's unit opens, and Wulan's inside it is its own, closed.
      expect(screen.getByRole('link', { name: 'Rina Wijaya' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Wulan Sari’s Unit · 2/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('UI-002 a 60px row whole: NAME, the goal’s bar, % and figures, the pill; no goal and no upload in words', async () => {
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const dimas = screen.getByRole('link', { name: 'Dimas Pratama' }).closest('[data-person-row]')!;
      expect(dimas).toHaveClass('min-h-[3.75rem]');
      expect(dimas).toHaveTextContent('82%IDR 65.6M / 80M');
      expect(dimas.querySelector('[data-goal-bar="82"]')).not.toBeNull();
      expect(dimas.querySelector('[data-tone="amber"]')).toHaveTextContent('Watch closely');
      const siti = screen.getByRole('link', { name: 'Siti Rahma' }).closest('[data-person-row]')!;
      expect(siti).toHaveTextContent('Not uploaded yet');
      expect(siti.querySelector('[data-goal-bar="none"]')).toHaveClass('border-dashed');
    });

    it('UI-111 a person with a saved photo shows it on their row; a person without one shows their initials', async () => {
      const photo = 'https://cdn.test/user/u-dimas/avatar/a.jpg?sig=abc';
      const view = dashboard();
      view.yourUnit.rows = view.yourUnit.rows.map((r) => (r.membershipId === 'mem-dimas' ? { ...r, photoUrl: photo } : r));
      render(view);
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const row = (name: string) => screen.getByRole('link', { name }).closest('[data-person-row]')!;
      expect(row('Dimas Pratama').querySelector('img')).toHaveAttribute('src', photo);
      expect(row('Indah Lestari').querySelector('img')).toBeNull();
      expect(row('Indah Lestari')).toHaveTextContent(/^IL/);
    });

    it('UI-002 the chips filter the list and open the units that hold a match', async () => {
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      await userEvent.click(screen.getByRole('button', { name: 'Needs attention 4' }));
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Siti Rahma', 'Wahyu Hidayat', 'Dewi Kartika', 'Budi Santoso']);
    });

    it('UI-002, UI-007 no + Add agent, no Update production, one status ⓘ beside the title, Last updated', async () => {
      render(dashboard(), { me: { ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] } });
      const heading = await screen.findByRole('heading', { name: 'Your team’s roster' });
      expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'How is status decided?' })).toHaveLength(1);
      expect(within(heading.parentElement!).getByRole('button', { name: 'How is status decided?' })).toBeInTheDocument();
      expect(within(heading.parentElement!).getByText('Last updated 7 Oct 26')).toBeInTheDocument();
    });
  });

  describe('UI-009 the roster on a tablet', () => {
    it('UI-009 Name · Goal progress · Activity · Status, every row a link', async () => {
      atWidth(800);
      render();
      const grid = await table();
      expect(within(grid).getAllByRole('columnheader').map(heading)).toEqual(['Name', 'Goal progress', 'Activity', 'Status', 'Details']);
      expect(grid).toHaveClass('table-fixed');
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).toHaveTextContent('82%IDR 65.6M / 80M');
      expect(screen.getByRole('link', { name: 'Dimas Pratama' })).toHaveAttribute('href', '/coaching/mem-dimas/summary?from=%2Funit%2Fdashboard');
    });
  });

  describe('UI-012 Search agent on the title row', () => {
    it('UI-012 below 1024px the title row’s search pill opens the agent search in a sheet', async () => {
      atWidth(375);
      stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() }, '/members/search': { body: { members: [] } } });
      renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const row = document.querySelector('[data-title-row]')!;
      await userEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Search agent' }));
      const sheet = await screen.findByRole('dialog', { name: 'Search agent' });
      expect(within(sheet).getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('a new hire before a first sale (P18.96-T5, ADR-0172)', () => {
    it('P18.96-T5 AC-3 tags her New hire, named for a screen reader; the production’s ⓘ names her', async () => {
      render(NEW_HIRE_VIEW);
      await table();
      expect(within(rowOf('Yanti Puspita')).getByText(/^New hire/)).toHaveTextContent('New hire, no first sale yet');
      expect(screen.getByText('Group production').closest('[data-stat-tile]')!.querySelector('button')!)
        .toHaveAccessibleName(/No first sale yet for Yanti Puspita/);
    });
  });


  describe('the states the prototype lacks (AC-8)', () => {
    it('P15-T2 AC-8 waits in a skeleton shaped like the tiles and the table', async () => {
      stubFetch({ 'GET /unit/dashboard': { body: dashboard() } });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      expect(screen.getByText('Loading your team’s roster…').closest('[role="status"]')).toBeInTheDocument();
      await table();
      expect(screen.queryByText('Loading your team’s roster…')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-8 fails with a retry that keeps the period', async () => {
      const { calls } = render([
        { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-9' } } },
        { body: dashboard({ period: 'year' }) },
      ], { period: 'year' });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await table();
      expect(calls.map((c) => c.url)).toEqual([
        'http://api.test/api/v1/unit/dashboard?period=year',
        'http://api.test/api/v1/unit/dashboard?period=year',
      ]);
    });

    it('P15-T2 AC-8 shows somebody who leads nobody an empty unit in plain words, pointing to their own screens', async () => {
      const { container } = (() => {
        stubFetch({ 'GET /unit/dashboard': { body: EMPTY } });
        return renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      })();
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Personal summary' })).toHaveAttribute('href', '/summary');
      expect(screen.getByRole('link', { name: 'Activity management' })).toHaveAttribute('href', '/activity/log');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Period' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      expect(container.textContent).not.toMatch(/\d|phase/i);
      expect(container.textContent).not.toMatch(/office|KPM|reports to|tagged to|untagged|unassigned/i);
    });
  });

  describe('who sees what (AC-10)', () => {
    const member = (over: Record<string, unknown>) => makeMe({
      membership: {
        membershipId: 'mem-x', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
      },
      permissions: ['unit_dashboard:read'],
    });

    it.each([
      ['an AB who leads', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 })],
      ['an AAB who leads', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 })],
      ['the Owner in their field view', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5, isKpmOwner: true })],
      ['the Admin in their field view', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1, isKpmAdmin: true })],
    ])('P15-T2 AC-10 reads the roster for %s', async (_who, me) => {
      const { calls } = render(dashboard(), { me });
      await table();
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=month');
    });

    it('P15-T2 AC-10 answers an Agent who leads nobody with the empty unit, not a refusal', async () => {
      render(EMPTY, { me: member({}) });
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.queryByText('Not available to you')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-10 refuses a reader without the grant, naming no code and asking for nothing', () => {
      const { calls } = render(dashboard(), { me: makeMe({ permissions: [] }) });
      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert').textContent).not.toMatch(/[a-z_]+:[a-z_]+/);
      expect(calls).toHaveLength(0);
    });

    it('P15-T2 AC-10 and P15-T3 AC-4 draw no Update production in a read-only support session', async () => {
      const support = makeMe({ ...AGUS_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'Root' });
      render(dashboard(), { me: support });
      await table();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    });

    it('P15-T3 AC-4 draws no Update production when the server says the reader may not use it', async () => {
      render(dashboard({ production: { month: '2026-10', revision: 7, locked: false, canUpdate: false } }));
      await table();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    });

    it('P15-T2 AC-1 sits inside the agent shell, with Unit dashboard the current item', async () => {
      stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() } });
      renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
      await table();
      const main = screen.getByRole('navigation', { name: 'Main' });
      // The field shell's sidebar since UI V1 (UI-004): *Unit Dashboard*, in its first section.
      expect(within(main).getByRole('link', { name: 'Unit Dashboard' })).toHaveAttribute('aria-current', 'page');
    });
  });
});

describe('Update production (P15-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const open = async () => {
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Update production' }));
    return screen.getByRole('dialog', { name: 'Update production' });
  };
  const box = (dialog: HTMLElement, which: 'Month' | 'Year', name: string) =>
    within(dialog).getByRole('textbox', { name: `${which} achieved (IDR), ${name}` });

  it('P15-T3 AC-3 opens the dialog verbatim, its first box focused', async () => {
    render();
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription(
      'Enter the latest figures from the company report — month and year are updated independently.',
    );
    expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Name', 'Month achieved (IDR)', 'Year achieved (IDR)']);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveTextContent('✕');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save all' })).toBeInTheDocument();
    expect(box(dialog, 'Month', 'You (Agus)')).toHaveFocus();
  });

  it('P15-T3 AC-3 groups the rows as drawn, and prefills the month table’s figures, blank where it holds none', async () => {
    render();
    const dialog = await open();
    expect(within(dialog).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent))
      .toEqual(['Your direct agents', 'Arief Wibowo’s unit', 'Dewi Kartika’s unit', 'Sari Wulandari’s unit']);
    expect(box(dialog, 'Month', 'Dimas Pratama')).toHaveValue('65,600,000');
    expect(box(dialog, 'Year', 'Dimas Pratama')).toHaveValue('620,000,000');
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('');
    expect(box(dialog, 'Year', 'Yanti Puspita')).toHaveValue('120,000,000');
    // Nested beneath their head, one step further in for each level.
    expect((within(dialog).getByText('Tono Saputra') as HTMLElement).style.paddingLeft).toBe('36px');
  });

  it('P15-T3 AC-3 sends only the changed cells in minor units, toasts the rows changed, and reads the dashboard again', async () => {
    const { calls } = render([{ body: dashboard() }, { body: dashboard() }], {
      routes: { 'PATCH /unit/dashboard/production': { body: { updated: 2, state: {} } } },
    });
    const dialog = await open();
    await userEvent.clear(box(dialog, 'Month', 'Dimas Pratama'));
    await userEvent.type(box(dialog, 'Month', 'Dimas Pratama'), '70000000');
    expect(box(dialog, 'Month', 'Dimas Pratama')).toHaveValue('70,000,000');
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '12500000');
    // Emptied: unchanged, not cleared.
    await userEvent.clear(box(dialog, 'Year', 'Budi Santoso'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));

    expect(await screen.findByText('Production updated for 2 agents.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const save = writes(calls);
    expect(save).toHaveLength(1);
    expect(save[0].init.method).toBe('PATCH');
    expect(JSON.parse(save[0].init.body as string)).toEqual({
      month: '2026-10',
      revision: 7,
      rows: [
        { membershipId: 'mem-dimas', apeMonthlyMinor: rp(70) },
        { membershipId: 'mem-yanti', apeMonthlyMinor: rp(12.5) },
      ],
    });
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
  });

  it('P15-T3 AC-3 says one agent in the singular, and sends nothing when nothing changed', async () => {
    const { calls } = render([{ body: dashboard() }, { body: dashboard() }], {
      routes: { 'PATCH /unit/dashboard/production': { body: { updated: 1, state: {} } } },
    });
    let dialog = await open();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await screen.findByText('Production updated for 0 agents.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);

    dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await screen.findByText('Production updated for 1 agent.')).toBeInTheDocument();
  });

  it('P15-T3 AC-3 keeps what was typed when the month is locked, and shows why in the dialog', async () => {
    render(dashboard(), {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'Okt 2026 is locked.', requestId: 'r-2' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '9000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Okt 2026 is locked.');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('9,000,000');
  });

  it('P15-T3 AC-3 marks the box a figure out of bounds names', async () => {
    render(dashboard(), {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 422,
          body: {
            error: {
              code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'That figure is out of range.', requestId: 'r-3',
              details: { membershipId: 'mem-yanti', cadence: 'monthly' },
            },
          },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '999999999999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That figure is out of range.');
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveAttribute('aria-invalid', 'true');
    expect(box(dialog, 'Year', 'Yanti Puspita')).not.toHaveAttribute('aria-invalid');
  });

  it('P15-T3 AC-3 reads the dashboard again behind a stale revision, and pins the next save to the new one', async () => {
    const { calls } = render([
      { body: dashboard() },
      { body: dashboard({ production: { month: '2026-10', revision: 8, locked: false, canUpdate: true } }) },
    ], {
      routes: {
        'PATCH /unit/dashboard/production': [
          { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Somebody else changed these figures.', requestId: 'r-4' } } },
          { body: { updated: 1, state: {} } },
        ],
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Somebody else changed these figures.');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save all' }));
    await screen.findByText('Production updated for 1 agent.');
    const saves = writes(calls).map((c) => JSON.parse(c.init.body as string));
    expect(saves.map((s) => s.revision)).toEqual([7, 8]);
    expect(saves[1].rows).toEqual([{ membershipId: 'mem-yanti', apeMonthlyMinor: rp(5) }]);
  });

  it('P15-T3 AC-3 reads the dashboard again when the month was locked meanwhile, so the button takes the lock', async () => {
    const { calls } = render([
      { body: dashboard() },
      { body: dashboard({ production: { month: '2026-10', revision: 8, locked: true, canUpdate: true } }) },
    ], {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'Okt 2026 is locked.', requestId: 'r-5' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Okt 2026 is locked.');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
  });

  it('P15-T3 AC-3 closes on Cancel and on ✕, writing nothing', async () => {
    const { calls } = render();
    let dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    dialog = await open();
    // Opened again, it starts from the month table's figures, not from what was typed and cancelled.
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P15-T3 draws Update production unusable on a locked month, saying who reopens it', async () => {
    render(dashboard({ production: { month: '2026-10', revision: 7, locked: true, canUpdate: true } }));
    await table();
    const button = screen.getByRole('button', { name: 'Update production' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Production for Oct 2026 is locked. The Owner or Admin can reopen it.');
    await userEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P15-T3 AC-3 keeps the units’ other rows within reach of the dialog', async () => {
    render(dashboard({ units: [UNITS[2]] }));
    const dialog = await open();
    expect(box(dialog, 'Month', 'Wulan Sari')).toBeInTheDocument();
    expect(box(dialog, 'Year', 'Tono Saputra')).toBeInTheDocument();
  });
});
