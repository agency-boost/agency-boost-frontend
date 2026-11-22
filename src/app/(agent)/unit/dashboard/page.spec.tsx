import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  activities, AGUS_ME, dashboard, EMPTY, RATIOS, rp, UNITS,
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

/** The roster, as P19.18-T1 draws it: unit cards in a region named by its title (*Your team’s roster · 16*). */
const table = () => screen.findByRole('region', { name: /^Your team’s roster/ });
const writes = (calls: { init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');

/** jsdom cannot follow a link: a click on one is kept from trying, as a test of a drill needs only its address. */
const stayPut = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
};

/*
 * **The Unit Dashboard, UI V1** (Phase 18.11 T4; the owner's report of 2026-10-30): each ticket's *Done when* below, by
 * its id — UI-001 (the tabs, the Activities table and its ratio card), UI-002 (the phone's accordion), UI-003 (the
 * tiles), UI-005 (the pill), UI-007 (one ⓘ), UI-009 (the tablet's and the desktop's tables), UI-011 (a row opens the
 * person), UI-012 (the search pill), UI-028 (the lead counts and *Last updated*). The P15 tests of the states, who sees
 * what and *Update production* stand; those of the roster's old columns, its ⌄ and detail, *Chasing MDRT* and the
 * phone's cards were retired with what they tested (UI-002, UI-009, UI-011).
 */
describe('the Unit Dashboard (P15-T2; UI V1, Phase 18.11 T4)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
    document.addEventListener('click', stayPut);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  describe('UI-001 Overview | Activities (Phase 18.11 T4)', () => {
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
        // P19.18-T1 AC-1: *Tahun ini* first.
        'http://api.test/api/v1/unit/dashboard?period=year',
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
    /**
     * P19.18-T2 AC-1: every category starts closed. A test that reads a type's row opens them all first, as a hand would —
     * one tap each.
     */
    const openAll = async (grid: HTMLElement) => {
      for (const button of within(grid).getAllByRole('button', { name: /^Show / })) await userEvent.click(button);
    };

    it('UI-111 a person column shows their saved photo; a person without one, their initials', async () => {
      const photo = 'https://cdn.test/user/u-indah/avatar/a.jpg?sig=abc';
      const view = activities();
      view.people = view.people.map((p) => (p.name === 'Indah Lestari' ? { ...p, photoUrl: photo } : p));
      await openActivities(view);
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      expect(within(grid).getByRole('columnheader', { name: 'Indah Lestari' }).querySelector('img')).toHaveAttribute('src', photo);
      expect(within(grid).getByRole('columnheader', { name: 'Siti Rahma' }).querySelector('img')).toBeNull();
    });

    it('P19.18-T2 AC-2 one column per person: photo and FIRST NAME, no AB / AAB label, in the server’s order (AB → AAB → agents)', async () => {
      const view = activities();
      // The server's order, the office's whole downline for an Owner: the AB, an AAB, then the agents (ADR-0271 §4).
      view.people = [view.people[3], view.people[0], view.people[1], view.people[2]].map((p) => ({ ...p, inUnit: true }));
      await openActivities(view);
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const people = within(grid).getAllByRole('columnheader').slice(2);
      expect(people.map((h) => h.querySelector('.sr-only')?.textContent)).toEqual(['Arief Wibowo', 'Agus Santoso', 'Indah Lestari', 'Siti Rahma']);
      // The first name in capitals under the photo, and nothing else — no level label in a column's head.
      expect(people.map((h) => h.querySelector('[aria-hidden="true"].uppercase')?.textContent)).toEqual(['Arief', 'Agus', 'Indah', 'Siti']);
      expect(grid.querySelector('thead [data-rung-tag]')).toBeNull();
      // Initials where there is no photo (Avatar), a photo where there is one.
      for (const head of people) expect(head.querySelector('img, [aria-hidden="true"]')).not.toBeNull();
    });

    it('UI-001 the table: Aktivitas, the sticky Total, one column per person by first name; Total equals the sum of the person columns', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      await openAll(grid);
      expect(within(grid).getAllByRole('columnheader')).toHaveLength(5);
      for (const name of ['Activity', 'Total', 'Agus Santoso', 'Indah Lestari', 'Siti Rahma']) {
        expect(within(grid).getByRole('columnheader', { name })).toBeInTheDocument();
      }
      // The first name in capitals is what shows; the full name is what a screen reader hears.
      expect(within(within(grid).getByRole('columnheader', { name: 'Agus Santoso' })).getByText('Agus')).toHaveAttribute('aria-hidden', 'true');
      // The sticky columns: Aktivitas at the edge, Total beside it; only the person columns slide on a phone.
      expect(within(grid).getByRole('columnheader', { name: 'Activity' }).className).toMatch(/sticky left-0/);
      expect(grid.parentElement).toHaveClass('overflow-x-auto');
      for (const type of ['Set Appointment', 'Mendapatkan calon prospek baru', 'Sales meeting', 'Submission polis']) {
        const [totalCell, ...people] = cells(within(grid).getByRole('rowheader', { name: type }).closest('tr')!);
        expect({ type, total: totalCell }).toEqual({ type, total: people.reduce((s, n) => s + n, 0) });
      }
      const foot = within(grid).getByRole('rowheader', { name: 'Total' }).closest('tr')!;
      expect(cells(foot)).toEqual([21, 1, 20, 0]);
    });

    /*
     * **P19.11-T6 AC-2 (UX-5)**: the fixed layout at every width, the columns the `<colgroup>`'s, and *Total*'s `left` the
     * *Aktivitas* width itself — 132px on a phone (the Unit mockup), 7.5rem from 768px (P19.8-T4 AC-5), 12.5rem from 1024px.
     * That the two meet at every scroll position is measured in Chrome (`unit-activities.browser.spec.ts`).
     */
    it('P19.11-T6 AC-2 the table is fixed at every width, its colgroup sizing the two sticky columns, Total pinned at the Aktivitas width', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      await openAll(grid);
      expect(grid).toHaveClass('table-fixed', 'w-full', '[--act:8.25rem]', 'md:[--act:7.5rem]', 'lg:[--act:12.5rem]', '[--tot:2.75rem]', 'lg:[--tot:4rem]');
      expect(grid.className).not.toMatch(/\blg:table-fixed\b/);
      const cols = Array.from(grid.querySelectorAll('colgroup > col'));
      expect(cols.map((c) => c.getAttribute('data-col'))).toEqual(['activity', 'total', 'person', 'person', 'person']);
      expect(cols[0]).toHaveClass('w-[var(--act)]');
      expect(cols[1]).toHaveClass('w-[var(--tot)]');
      // A person's column takes its share, at least 56px: no width of its own, the table's min-width the sum.
      expect(cols[2].getAttribute('class')).toBeNull();
      // Every row type: the header, a subtotal row, a type's row and the navy foot.
      const rows = [
        grid.querySelector('thead tr')!, grid.querySelector('[data-subtotal]')!, grid.querySelector('[data-type]')!,
        grid.querySelector('tfoot tr')!,
      ];
      for (const row of rows) {
        const [activity, total, person] = Array.from(row.children);
        expect(activity).toHaveClass('sticky', 'left-0', 'z-[1]');
        expect(total).toHaveClass('sticky', 'left-[var(--act)]', 'z-[1]');
        // No cell sizes its column: the colgroup does.
        for (const cell of [activity, total, person]) expect(cell.className).not.toMatch(/(^|\s)(md:|lg:)?(min-)?w-/);
      }
      // The words clipped inside the cell: a type's name truncates within the column, the old 7.5rem cap gone.
      const label = within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' }).querySelector('span[title]')!;
      expect(label).toHaveClass('block', 'truncate');
      expect(label.className).not.toMatch(/max-w-/);
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

    /*
     * *Rewritten 2026-11-07* (P19.8-T4 AC-6; MOB UI-183; ADR-0229 §6): UI-001's heat map and a closed section's *· n*
     * gave way to plain numbers and a subtotal row per category, open or closed.
     */
    it('P19.8-T4 AC-6 MOB UI-183 cells are plain numbers, no tint; a zero is a light · a screen reader hears as 0', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      await openAll(grid);
      const row = within(grid).getByRole('rowheader', { name: 'Set Appointment' }).closest('tr')!;
      const [, agus, indah] = within(row).getAllByRole('cell');
      expect(agus).toHaveTextContent('·0');
      expect(indah).toHaveTextContent('9');
      expect(grid.querySelector('[class*="bg-primary"]')).toBeNull();
    });

    it('P19.18-T2 AC-1 every time the tab opens every category is closed, each still showing every person’s subtotal', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const toggles = within(grid).getAllByRole('button', { name: /^(Show|Hide) / });
      expect(toggles.map((b) => [b.textContent, b.getAttribute('aria-expanded')])).toEqual([
        ['Leads Generation', 'false'], ['Selling', 'false'], ['Recruitment', 'false'],
      ]);
      // Closed, and no type's row under any of them — but every person's subtotal on the category's own row.
      expect(grid.querySelector('[data-type]')).toBeNull();
      expect(cells(within(grid).getByRole('button', { name: 'Show Leads Generation' }).closest('tr')!)).toEqual([16, 1, 15, 0]);
      expect(cells(within(grid).getByRole('button', { name: 'Show Selling' }).closest('tr')!)).toEqual([5, 0, 5, 0]);
    });

    it('P19.18-T2 AC-1 a tap opens a category and a tap closes it; leaving the tab and coming back closes it again', async () => {
      nav.search = 'tab=activities';
      stubFetch({ 'GET /unit/dashboard': { body: dashboard() }, ...ACTIVITIES() });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      let grid = await screen.findByRole('table', { name: 'Activities · Unit' });
      await userEvent.click(within(grid).getByRole('button', { name: 'Show Leads Generation' }));
      expect(within(grid).getByRole('button', { name: 'Hide Leads Generation' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(grid).getByRole('rowheader', { name: 'Set Appointment' })).toBeInTheDocument();
      await userEvent.click(within(grid).getByRole('button', { name: 'Hide Leads Generation' }));
      expect(within(grid).queryByRole('rowheader', { name: 'Set Appointment' })).not.toBeInTheDocument();
      // Opened again, then the tab left and come back to: closed, as on every opening.
      await userEvent.click(within(grid).getByRole('button', { name: 'Show Leads Generation' }));
      const tabs = screen.getByRole('tablist', { name: 'Unit Dashboard' });
      await userEvent.click(within(tabs).getByRole('tab', { name: 'Overview' }));
      // The tab left: the table is gone (whatever the Overview draws in its place).
      await waitFor(() => expect(screen.queryByRole('table', { name: 'Activities · Unit' })).not.toBeInTheDocument());
      await userEvent.click(within(tabs).getByRole('tab', { name: 'Activities' }));
      grid = await screen.findByRole('table', { name: 'Activities · Unit' });
      expect(within(grid).getByRole('button', { name: 'Show Leads Generation' })).toHaveAttribute('aria-expanded', 'false');
      expect(grid.querySelector('[data-type]')).toBeNull();
    });

    it('P19.18-T2 AC-3 the ratio card under the table runs the width and lays its four ratios out as tiles from 768px', async () => {
      await openActivities();
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      expect(card).not.toHaveClass('lg:max-w-xl');
      expect(card.querySelector('[data-ratio-tiles]')).toHaveClass('md:grid');
    });

    it('P19.8-T4 AC-6 MOB UI-183 each category row is a subtotal row — its Total and a bold count per person, · for 0 — open or closed', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const subtotal = (label: string) => within(grid).getByRole('button', { name: label }).closest('tr')!;
      // Leads Generation, closed (P19.18-T2 AC-1): Agus 1, Indah 15, Siti 0 — and its Total, 16.
      expect(cells(subtotal('Show Leads Generation'))).toEqual([16, 1, 15, 0]);
      expect(within(subtotal('Show Leads Generation')).getAllByRole('cell')[2].querySelector('.font-extrabold')).toHaveTextContent('15');
      expect(within(subtotal('Show Leads Generation')).getAllByRole('cell')[3]).toHaveTextContent('·0');
      // Selling opened: the same subtotal row, its types under it.
      await userEvent.click(within(grid).getByRole('button', { name: 'Show Selling' }));
      expect(cells(subtotal('Hide Selling'))).toEqual([5, 0, 5, 0]);
      // Recruitment, closed — its subtotal row stays, at 0 in the Unit.
      const closed = within(grid).getByRole('button', { name: 'Show Recruitment' });
      expect(closed).toHaveAttribute('aria-expanded', 'false');
      expect(closed).toHaveTextContent(/^Recruitment$/);
      expect(cells(closed.closest('tr')!)).toEqual([0, 0, 0, 0]);
      await userEvent.click(closed);
      expect(within(grid).getByRole('rowheader', { name: 'Melakukan presentasi recruitment' })).toBeInTheDocument();
      // The Group: Arief's recruiting in Recruitment's subtotal, closed or open.
      await userEvent.click(within(screen.getAllByRole('group', { name: 'Unit or Group' })[0]).getByRole('button', { name: 'Group' }));
      const group = await screen.findByRole('table', { name: 'Activities · Group' });
      expect(cells(within(group).getByRole('button', { name: 'Hide Recruitment' }).closest('tr')!)).toEqual([4, 0, 0, 0, 4]);
    });

    it('P19.8-T4 AC-5 MOB UI-180 on a phone a type reads its short name on one line, a type with none its name on two; a tap shows the name in full', async () => {
      for (const px of [375, 360]) {
        atWidth(px);
        await openActivities();
        const grid = screen.getByRole('table', { name: 'Activities · Unit' });
        await openAll(grid);
        // A screen reader hears the office's name; the eye reads the short one.
        const prospect = within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' });
        expect(within(prospect).getByText('Prospek baru')).toBeInTheDocument();
        expect(within(prospect).getByText('Prospek baru').closest('button')).toHaveClass('whitespace-nowrap');
        // *Sales meeting* has no short name: its own name, on up to two lines.
        const meeting = within(grid).getByRole('rowheader', { name: 'Sales meeting' });
        expect(within(meeting).getAllByText('Sales meeting')[0].closest('button')).toHaveClass('line-clamp-2');
        await userEvent.click(within(prospect).getByRole('button', { name: 'Mendapatkan calon prospek baru' }));
        expect(within(prospect).getByRole('tooltip', { hidden: true })).toHaveTextContent('Mendapatkan calon prospek baru');
        expect(within(prospect).getByRole('tooltip', { hidden: true })).not.toHaveAttribute('hidden');
        cleanup();
        vi.unstubAllGlobals();
      }
    });

    it('P19.8-T4 AC-5 MOB UI-180 from 768px the table keeps the office’s names', async () => {
      atWidth(1024);
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      await openAll(grid);
      const prospect = within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' });
      expect(within(prospect).queryByText('Prospek baru')).not.toBeInTheDocument();
      expect(within(prospect).getByText('Mendapatkan calon prospek baru')).toHaveAttribute('title', 'Mendapatkan calon prospek baru');
    });

    /*
     * *Rewritten 2026-11-07* (P19.8-T4 AC-7; MOB UI-184; ADR-0229 §7): the card's *Unit | Group* became one picker, with
     * every person of the Group.
     */
    it('P19.8-T4 AC-7 MOB UI-184 the ratio card: one picker, Unit ⌄ — Unit, Group, PER PERSON, every person — Unit first', async () => {
      await openActivities();
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      expect(within(card).queryByRole('group', { name: 'Unit or Group' })).not.toBeInTheDocument();
      const picker = within(card).getByRole('button', { name: 'Ratio for Unit' });
      expect(within(card).getByText('Selling success rate').closest('li')).toHaveTextContent('18%');
      await userEvent.click(picker);
      const menu = screen.getByRole('listbox', { name: 'Ratio for' });
      expect(within(menu).getAllByRole('option').map((o) => o.textContent)).toEqual([
        expect.stringContaining('Unit'), 'Group', 'Agus Santoso', 'Indah Lestari', 'Siti Rahma', 'Arief Wibowo',
      ]);
      expect(within(menu).getByText('PER PERSON')).toBeInTheDocument();
      await userEvent.click(within(menu).getByRole('option', { name: 'Group' }));
      expect(within(card).getByText('Selling success rate').closest('li')).toHaveTextContent('33%');
      // The table's own switch is unchanged by the card's.
      expect(screen.getByRole('table', { name: 'Activities · Unit' })).toBeInTheDocument();
    });

    it('P19.8-T4 AC-7 MOB UI-184 picking a person reads their five ratios and shows them, green or red against the target; the table stays', async () => {
      const mine = activities();
      const hers = activities({
        ratios: {
          ...mine.ratios,
          person: {
            membershipId: 'mem-indah',
            ratios: [
              { ...RATIOS.ratios[0], value: 0.33, status: 'success' },
              { ...RATIOS.ratios[1], value: 0.2, status: 'alert' },
            ] as typeof mine.ratios.unit,
          },
        },
      });
      nav.search = 'tab=activities';
      const { calls } = stubFetch({ 'GET /unit/dashboard/activities': [{ body: mine }, { body: hers }] });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      await screen.findByRole('table', { name: 'Activities · Unit' });
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      await userEvent.click(within(card).getByRole('button', { name: 'Ratio for Unit' }));
      await userEvent.click(screen.getByRole('option', { name: 'Indah Lestari' }));
      await waitFor(() => expect(calls.at(-1)!.url).toBe('http://api.test/api/v1/unit/dashboard/activities?span=week&ratioFor=mem-indah'));
      expect(await within(card).findByRole('button', { name: 'Ratio for Indah Lestari' })).toBeInTheDocument();
      const selling = within(card).getByText('Selling success rate').closest('li')!;
      expect(selling).toHaveTextContent('33%');
      expect(selling.querySelector('.text-on-navy-green')).not.toBeNull();
      expect(within(card).getByText('Recruitment success rate').closest('li')!.querySelector('.text-on-navy-red')).not.toBeNull();
      expect(screen.getByRole('table', { name: 'Activities · Unit' })).toBeInTheDocument();
    });

    it('P19.8-T4 AC-8 MOB UI-185 the ratio card’s title is the section titles’ size, 14px / 700', async () => {
      await openActivities();
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      expect(within(card).getByRole('heading', { name: 'Ratio · last 30 days' })).toHaveClass('text-md', 'font-bold');
    });

    it('P19.8-T4 AC-12 MOB UI-171 Minggu | Bulan and Unit | Group: 13px / 600 / 44px at every size', async () => {
      for (const px of [375, 1280]) {
        atWidth(px);
        await openActivities();
        for (const group of [screen.getByRole('group', { name: 'Period' }), screen.getAllByRole('group', { name: 'Unit or Group' })[0]]) {
          for (const button of within(group).getAllByRole('button')) {
            expect(button).toHaveClass('min-h-11', 'text-base', 'font-semibold');
            expect(button.className).not.toMatch(/lg:min-h-8/);
          }
        }
        cleanup();
        vi.unstubAllGlobals();
      }
    });

    /* *Rewritten 2026-11-07* (P19.8-T4 AC-11; MOB UI-181; ADR-0229 §9): a leader by role sees the normal table. */
    it('P19.8-T4 AC-11 MOB UI-181 a leader by role with nobody yet: the normal table at 0, no person column, the ratio card with –', async () => {
      nav.search = 'tab=activities';
      const none = RATIOS.ratios.map((r) => ({ ...r, value: null, share: null, numeratorCount: 0, denominatorCount: 0, status: 'neutral' }));
      stubFetch(ACTIVITIES(activities({
        empty: true, people: [], totals: { unit: { counts: [], total: 0 }, group: { counts: [], total: 0 } },
        ratios: { ...activities().ratios, unit: none as never, group: none as never },
      })));
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      const grid = await screen.findByRole('table', { name: 'Activities · Unit' });
      expect(screen.queryByText('Nobody is in your unit yet.')).not.toBeInTheDocument();
      expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Activity', 'Total']);
      expect(cells(within(grid).getByRole('button', { name: 'Show Leads Generation' }).closest('tr')!)).toEqual([0]);
      expect(cells(within(grid).getByRole('rowheader', { name: 'Total' }).closest('tr')!)).toEqual([0]);
      const card = screen.getByRole('region', { name: 'Ratio · last 30 days' });
      expect(within(card).getByText('Selling success rate').closest('li')).toHaveTextContent('–');
    });

    it('UI-001 an Agent who leads nobody meets the empty unit on this tab', async () => {
      nav.search = 'tab=activities';
      stubFetch(ACTIVITIES(activities({ empty: true, people: [], totals: { unit: { counts: [], total: 0 }, group: { counts: [], total: 0 } } })));
      const agent = makeMe({ ...AGUS_ME, membership: { ...AGUS_ME.membership!, orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 } });
      renderWithSession(<UnitDashboardPage />, { me: agent });
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  /*
   * UI-003's tiles, UI-002's accordion, UI-009's tables, UI-005's pills and chips, UI-011's rows, P19.7-T2 AC-13's
   * *Proposal* column and P19.9-T4's level tags were pinned here: the Overview was redrawn by P19.18-T1 (ADR-0271 §3–§6;
   * the orange panel, unit cards at every size, no status pill, no *Proposal* — ADR-0266 §3), and its tests are in
   * `overview.spec.tsx`.
   */
  describe('UI-012 Search agent on the title row', () => {
    it('UI-012 below 1024px the title row’s search pill opens the agent search in a sheet', async () => {
      atWidth(375);
      stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() }, '/members/search': { body: { members: [] } } });
      renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
      await screen.findByRole('button', { name: /^Your Unit/ });
      const row = document.querySelector('[data-title-row]')!;
      await userEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Search agent' }));
      const sheet = await screen.findByRole('dialog', { name: 'Search agent' });
      expect(within(sheet).getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('the states the prototype lacks (AC-8)', () => {
    it('P15-T2 AC-8, P19.18-T1 waits in a skeleton shaped like the orange panel and the unit cards', async () => {
      stubFetch({ 'GET /unit/dashboard': { body: dashboard() } });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      expect(screen.getByText('Loading your team’s roster…').closest('[role="status"]')).toBeInTheDocument();
      expect(document.querySelector('[data-skeleton-panel]')).toHaveClass('rounded-[20px]');
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

    /* *Changed 2026-11-07* (P19.8-T4 AC-11; MOB UI-181; OD-280; ADR-0229 §9): no *No data yet* line; *0 of –*. */
    it('P15-T2 AC-8, P19-T4 AC-3, P19.8-T4 AC-11 MOB UI-181 shows a leader who leads nobody the normal layout at zero, 0 of –, and the Example', async () => {
      stubFetch({ 'GET /unit/dashboard': { body: EMPTY } });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      expect(await screen.findByText('Example')).toBeInTheDocument();
      expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
      // P19.18-T1 AC-3: the orange panel at zero — Tim Anda 0, Active Agent and Recruitment –, no chips.
      const panel = document.querySelector<HTMLElement>('[data-unit-panel]')!;
      expect([...panel.querySelectorAll('[data-number-size]')].map((n) => n.textContent)).toEqual(['0', '–', '–']);
      // The normal layout: the period picker, and the sample of the roster under the Example label, greyed and inert.
      expect(screen.getByRole('button', { name: 'Period This year' })).toBeInTheDocument();
      const sample = document.querySelector('[data-sample]')!;
      expect(sample).toHaveAttribute('aria-hidden', 'true');
      expect(sample.hasAttribute('inert')).toBe(true);
      expect(sample.textContent).toContain('Sample agent 1');
      expect(screen.getByText('Example')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      // No realistic person: every name the sample draws says it is one.
      expect(sample.textContent).not.toMatch(/Agus|Rina|Sari|Dewi/);
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
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=year');
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

/*
 * **P19.8-T4 — the owner's mobile review, the Overview's period and the three tabs through axe** (AC-12, AC-13, AC-15;
 * MOB UI-171; ADR-0227 §2; `unit-mobile-stopmotion-2026-11-07.html`, each `?tab=`).
 */
describe('P19.8-T4 the three tabs on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());
  const LEADER = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'unit_dashboard:read_potensi'] });
  const POTENSI = {
    month: '2026-10', currentMonth: '2026-10', today: '2026-10-08',
    head: { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: true },
    tiles: { aa: 0, rekrut: 0, potensi: { aa: 1, rekrut: 0 } },
    units: [{
      kind: 'direct', leader: { membershipId: 'mem-agus', name: 'Agus Santoso', rung: { code: 'AB', label: 'AB' } },
      people: [
        { membershipId: 'mem-agus', name: 'Agus Santoso', photoUrl: null, rung: { code: 'AB', label: 'AB' }, isLeader: true, isReader: true, opens: true, aa: { potensi: 0, aa: false, switched: 0 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 } },
        { membershipId: 'mem-indah', name: 'Indah Lestari', photoUrl: null, rung: { code: 'AGENT', label: 'Agent' }, isLeader: false, isReader: false, opens: true, aa: { potensi: 1, aa: false, switched: 1 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 } },
      ],
      totals: { aa: { potensi: 1, aa: 0, switchedPeople: 1, switchedPeopleAa: 0 }, rekrut: { potensi: 0, rekrut: 0, switchedPeople: 0, switchedPeopleRekrut: 0 } },
    }],
  };
  const open = async (tab: string, px: number) => {
    atWidth(px);
    nav.search = tab === 'overview' ? '' : `tab=${tab}`;
    stubFetch({
      ...SHELL,
      'GET /unit/dashboard': { body: dashboard() },
      'GET /unit/dashboard/activities': { body: activities() },
      'GET /unit/dashboard/potensi': { body: POTENSI },
    });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: LEADER });
    await screen.findByRole('tablist', { name: 'Unit Dashboard' });
    if (tab === 'overview') await screen.findByRole('button', { name: /^Your Unit/ });
    if (tab === 'activities') await screen.findByRole('table', { name: 'Activities · Unit' });
    if (tab === 'potensi') await screen.findByRole('radiogroup', { name: 'Active Agent or Rekrut' });
  };

  it.each([
    ['overview', 375], ['overview', 360], ['activities', 375], ['activities', 360], ['potensi', 375], ['potensi', 360],
  ] as const)('P19.8-T4 AC-13, AC-15 the %s tab at %ipx: no native select, the slider in place, axe clean', async (tab, px) => {
    await open(tab, px);
    expect(document.querySelector('select')).toBeNull();
    const slider = screen.getByRole('tablist', { name: 'Unit Dashboard' });
    expect(within(slider).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Activities', 'Potensi']);
    expect(slider).toHaveClass('max-md:basis-full');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  });

  it.each([375, 360])('P19.8-T4 AC-11, P19.18-T1 AC-3 at %ipx an empty unit: the panel at 0 and –, the Example roster, Add your first agent, no No data yet', async (px) => {
    atWidth(px);
    nav.search = '';
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: EMPTY } });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: LEADER });
    await screen.findByText('Example');
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(document.querySelector('[data-sample] [data-roster-units]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first agent' })).toHaveAttribute('href', '/user-management/add');
    const active = document.querySelector<HTMLElement>('[data-panel-tile="activeAgent"]')!;
    expect(active).toHaveTextContent('–');
    // The tile's label, *Active Agent*, and the month's chip at the right of the number, *Oct*.
    expect(active).toHaveTextContent('Oct');
  });

  it('P19.8-T4 AC-12 MOB UI-171 the Overview’s period: Last 7 days · This month · This year in a menu; a choice reads that period', async () => {
    await open('overview', 375);
    await userEvent.click(screen.getByRole('button', { name: 'Period This year' }));
    const menu = screen.getByRole('listbox', { name: 'Period' });
    expect(within(menu).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim())).toEqual(['Last 7 days', 'This month', 'This year']);
    await userEvent.click(within(menu).getByRole('option', { name: 'Last 7 days' }));
    expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard?period=7d', { scroll: false });
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
  /** *Since P19.5-T2* (R4) the year is the months' sum: read-only, under its heading, never a box. */
  const year = (dialog: HTMLElement, name: string) =>
    within(dialog).getByText(name).closest('tr')!.querySelector('[data-year-read-only]')!;

  it('P15-T3 AC-3 opens the dialog verbatim, its first box focused', async () => {
    render();
    const dialog = await open();
    // P19.5-T2 (R4): the prototype's *"month and year are updated independently"* is no longer true — the year is the
    // months' sum (a parity row says why).
    expect(dialog).toHaveAccessibleDescription(
      'Enter the latest month’s figures from the company report — the year is the sum of the months.',
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
    expect(year(dialog, 'Dimas Pratama')).toHaveTextContent('620,000,000');
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('');
    expect(year(dialog, 'Yanti Puspita')).toHaveTextContent('120,000,000');
    // P19.5-T2 (R4): no box for the year at all.
    expect(within(dialog).queryByRole('textbox', { name: /^Year achieved/ })).not.toBeInTheDocument();
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
    await userEvent.clear(box(dialog, 'Month', 'Budi Santoso'));
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
    expect(box(dialog, 'Month', 'Dimas Pratama')).not.toHaveAttribute('aria-invalid');
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
    expect(box(dialog, 'Month', 'Tono Saputra')).toBeInTheDocument();
    expect(year(dialog, 'Tono Saputra')).toBeInTheDocument();
  });
});
