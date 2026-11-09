import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, wears, type StubReply } from '@test/harness';
import {
  activities, AGUS_ME, dashboard, EMPTY, NEW_HIRE_VIEW, RATIOS, rp, UNITS,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView, UnitGroup, UnitRow } from '@/lib/unit-dashboard';
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
      // 132px for *Aktivitas* on a phone (the Unit mockup), 7.5rem from 768px (P19.8-T4 AC-5).
      expect(within(grid).getByRole('columnheader', { name: 'Total' }).className).toMatch(/sticky left-\[8\.25rem\] .*md:left-\[7\.5rem\]/);
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

    /*
     * *Rewritten 2026-11-07* (P19.8-T4 AC-6; MOB UI-183; ADR-0229 §6): UI-001's heat map and a closed section's *· n*
     * gave way to plain numbers and a subtotal row per category, open or closed.
     */
    it('P19.8-T4 AC-6 MOB UI-183 cells are plain numbers, no tint; a zero is a light · a screen reader hears as 0', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const row = within(grid).getByRole('rowheader', { name: 'Set Appointment' }).closest('tr')!;
      const [, agus, indah] = within(row).getAllByRole('cell');
      expect(agus).toHaveTextContent('·0');
      expect(indah).toHaveTextContent('9');
      expect(grid.querySelector('[class*="bg-primary"]')).toBeNull();
    });

    it('P19.8-T4 AC-6 MOB UI-183 each category row is a subtotal row — its Total and a bold count per person, · for 0 — open or closed', async () => {
      await openActivities();
      const grid = screen.getByRole('table', { name: 'Activities · Unit' });
      const subtotal = (label: string) => within(grid).getByRole('button', { name: label }).closest('tr')!;
      // Leads Generation, open: Agus 1, Indah 15, Siti 0 — and its Total, 16.
      expect(cells(subtotal('Hide Leads Generation'))).toEqual([16, 1, 15, 0]);
      expect(within(subtotal('Hide Leads Generation')).getAllByRole('cell')[2].querySelector('.font-extrabold')).toHaveTextContent('15');
      expect(within(subtotal('Hide Leads Generation')).getAllByRole('cell')[3]).toHaveTextContent('·0');
      // Selling, open; Recruitment, closed — its subtotal row stays, at 0 in the Unit.
      expect(cells(subtotal('Hide Selling'))).toEqual([5, 0, 5, 0]);
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
      expect(cells(within(grid).getByRole('button', { name: 'Hide Leads Generation' }).closest('tr')!)).toEqual([0]);
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
    it('UI-009, P19.7-T2 AC-13 heads the table Name · Goal progress · Sales leads · Closing · Recruitment leads · Potential recruits · Proposal · Activity · Last 1:1 · Status · ›', async () => {
      render();
      const grid = await table();
      // P19.1-T1 AC-3 (UI-114): the leads columns grouped — *Sales leads → Leads | Closing*, *Recruitment leads → Leads |
      // Potensi* — a short name with its ⓘ for the long one, so no header breaks inside a word at 1024.
      expect(within(grid).getAllByRole('columnheader').map(heading)).toEqual([
        // P19.7-T2 AC-13 (ADR-0221 §7): *Proposal*, after *Potensi rekrut*.
        'Name', 'Goal progress', 'Sales leads', 'Recruitment leads', 'Proposal', 'Activity', 'Last 1:1', 'Status', 'Details',
        'Leads', 'Closing', 'Leads', 'Potensi',
      ]);
      const [sales, recruit] = within(grid).getAllByRole('columnheader').slice(2, 4);
      expect(sales).toHaveAttribute('colspan', '2');
      expect(recruit).toHaveAttribute('colspan', '2');
      expect(within(grid).getByRole('button', { name: 'Potential recruits' })).toBeInTheDocument();
      // No sideways scroll: a fixed table the card's width, its header sticky.
      expect(grid).toHaveClass('w-full', 'table-fixed');
      expect(grid.className).not.toMatch(/min-w-/);
      expect(grid.querySelector('thead')!.className).toMatch(/\[&_th\]:sticky/);
      // Below the top inset, never under a Home Screen app's clock (staging review, 2026-10-31).
      expect(grid.querySelector('thead')).toHaveClass('[&_th]:top-[env(safe-area-inset-top)]');
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
      // The ninth cell since *Proposal* (P19.7-T2 AC-13) joined the row after *Potensi rekrut*.
      const pill = (name: string) => within(rowOf(name)).getAllByRole('cell')[8].querySelector('[data-tone]')!;
      expect([pill('Wahyu Hidayat'), pill('Dimas Pratama'), pill('Indah Lestari'), pill('Sari Wulandari')].map((p) => [p.textContent, p.getAttribute('data-tone')]))
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
      // The Status heading is the eighth of the first header row since the laptop's grouped headers (UI-114) and *Proposal*
      // (P19.7-T2 AC-13).
      expect(within(within(grid).getAllByRole('columnheader')[7]).getByRole('button', { name: 'How is status decided?' })).toBeInTheDocument();
    });

    it('UI-002, UI-009 the chips filter the rows; their counts are the statuses’ of the rows uploaded (MOB UI-177)', async () => {
      render();
      const grid = await table();
      const chips = screen.getByRole('group', { name: 'Filter by status' });
      // Siti and Yanti have no figure this month: in *All*, in no status (P19.8-T4 AC-2).
      expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 14', 'Needs attention 3', 'Watch closely 5']);
      await userEvent.click(within(chips).getByRole('button', { name: 'Needs attention 3' }));
      expect(within(chips).getByRole('button', { name: 'Needs attention 3' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(grid).getAllByRole('link').map((a) => a.textContent).sort())
        .toEqual(['Budi Santoso', 'Dewi Kartika', 'Wahyu Hidayat']);
    });

    it('P19.8-T4 AC-2 MOB UI-177 a row with no production: the dashed bar, Not uploaded yet, and no pill — at every size', async () => {
      for (const px of [1280, 800]) {
        atWidth(px);
        render();
        await table();
        const siti = rowOf('Siti Rahma');
        expect(siti).toHaveTextContent('Not uploaded yet');
        expect(siti.querySelector('[data-goal-bar="none"]')).toHaveClass('border-dashed');
        expect(siti.querySelector('[data-tone]')).toBeNull();
        expect(rowOf('Yanti Puspita').querySelector('[data-tone]')).toBeNull();
        cleanup();
        vi.unstubAllGlobals();
      }
    });

    it('P19.8-T4 AC-2 MOB UI-177 only All left: no chip row, and the title reads Your team’s roster · 14', async () => {
      const unuploaded = (r: UnitRow): UnitRow => ({ ...r, goal: { ...r.goal, actualMinor: null, attainmentPct: null } });
      const view = dashboard();
      render(dashboard({
        yourUnit: { ...view.yourUnit, rows: view.yourUnit.rows.map(unuploaded) },
        units: view.units.map(function strip(u: UnitGroup): UnitGroup {
          return { ...u, head: unuploaded(u.head), members: u.members.map(unuploaded), units: u.units.map(strip) };
        }),
      }));
      await screen.findByRole('table', { name: 'Your team’s roster · 14' });
      expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Your team’s roster · 14' })).toBeInTheDocument();
      expect(document.querySelector('[data-tone]')).toBeNull();
    });

    it('P19.8-T4 AC-8 MOB UI-185 Your team’s roster is the section titles’ size, 14px / 700', async () => {
      render();
      await table();
      expect(screen.getByRole('heading', { name: 'Your team’s roster' })).toHaveClass('text-md', 'font-bold', 'text-ink');
    });

    it('P19.8-T4 AC-12 MOB UI-171 the status chips are header controls, 13px / 600 / 44px', async () => {
      render();
      await table();
      for (const chip of within(screen.getByRole('group', { name: 'Filter by status' })).getAllByRole('button')) {
        expect(chip).toHaveClass('min-h-11', 'text-base', 'font-semibold');
      }
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
      // The rows' own links — P19.9-T4 AC-1 adds Indah's WhatsApp beside hers.
      const rows = screen.getAllByRole('link').filter((a) => a.hasAttribute('data-row-main'));
      expect(rows.map((a) => a.textContent)).toEqual(['You (Agus)', 'Dimas Pratama', 'Indah Lestari', 'Siti Rahma']);
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

    it('UI-002 the count tiles filter the list and open the units that hold a match', async () => {
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      await userEvent.click(screen.getByRole('button', { name: '3 Needs attention' }));
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Wahyu Hidayat', 'Dewi Kartika', 'Budi Santoso']);
    });

    it('UI-002, UI-007 no + Add agent, no Update production, one status ⓘ beside the title, ⟳ and the day', async () => {
      render(dashboard(), { me: { ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] } });
      const heading = await screen.findByRole('heading', { name: 'Your team’s roster' });
      expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'How is status decided?' })).toHaveLength(1);
      expect(within(heading.parentElement!).getByRole('button', { name: 'How is status decided?' })).toBeInTheDocument();
      // The phone's *⟳ 7 Oct 26* (the Unit mockup); *Last updated* for a screen reader.
      const updated = heading.parentElement!.querySelector('[data-last-updated]')!;
      expect(updated).toHaveTextContent('Last updated7 Oct 26');
      expect(within(updated as HTMLElement).getByText('Last updated')).toHaveClass('sr-only');
    });

    it.each([375, 360])('P19.8-T4 AC-3 MOB UI-178 at %ipx: equal count tiles — the count 16px / 800 over its words — in one row', async (px) => {
      atWidth(px);
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const tiles = screen.getByRole('group', { name: 'Filter by status' });
      expect(tiles).toHaveClass('grid', 'grid-cols-3');
      expect(within(tiles).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['14 All', '3 Needs attention', '5 Watch closely']);
      for (const tile of within(tiles).getAllByRole('button')) {
        expect(tile.querySelector('[data-count]')).toHaveClass('text-lg', 'font-extrabold');
        expect(tile).toHaveClass('text-sm');
      }
      expect(within(tiles).getByRole('button', { name: '14 All' })).toHaveClass('bg-secondary');
    });

    it.each([375, 360])('P19.8-T4 AC-3 MOB UI-178 at %ipx: a row — NAME never cut, % and Rp x / y, a 5px bar across the name column, the pill, ›', async (px) => {
      atWidth(px);
      const long = 'Mohammad Rizky Pratama Wijayakusuma Hadi';
      const view = dashboard();
      view.yourUnit.rows = view.yourUnit.rows.map((r) => (r.membershipId === 'mem-dimas' ? { ...r, name: long } : r));
      render(view);
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const name = screen.getByRole('link', { name: long });
      // Since P19.9-T4 AC-1 the name's line is a block holding the level tag and the link: it wraps, never cut.
      expect(name.parentElement!.className).toMatch(/max-md:whitespace-normal/);
      expect(name.parentElement).toHaveClass('text-base');
      const row = name.closest('[data-person-row]')!;
      expect(row).toHaveTextContent('82%IDR 65.6M / 80M');
      const bar = row.querySelector('[data-goal-bar="82"]')!;
      expect(bar).toHaveClass('h-[5px]', 'w-full');
      expect(bar.firstElementChild).toHaveClass('bg-signal-red');
      expect(row.querySelector('[data-tone="amber"]')).toHaveTextContent('Watch closely');
      // The whole row a target, with ›.
      expect(name.className).toMatch(/after:absolute after:inset-0/);
      expect(row.querySelectorAll('svg').length).toBeGreaterThan(0);
      // Agus at 135%: green.
      const agus = screen.getByRole('link', { name: 'You (Agus)' }).closest('[data-person-row]')!;
      expect(agus.querySelector('[data-goal-bar="100"]')!.firstElementChild).toHaveClass('bg-signal-green');
      expect(within(agus as HTMLElement).getByText('135%')).toHaveClass('text-signal-green');
    });

    it.each([375, 360])('P19.8-T4 AC-1 MOB UI-176 at %ipx: the slider full width on its own row, 44px; Bulan ini on the row below', async (px) => {
      atWidth(px);
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const slider = screen.getByRole('tablist', { name: 'Unit Dashboard' });
      expect(slider).toHaveClass('max-md:basis-full', 'max-md:p-0');
      for (const tab of within(slider).getAllByRole('tab')) expect(tab).toHaveClass('flex-1', 'min-h-11', 'text-base', 'font-semibold');
      expect(slider.parentElement).toHaveClass('max-md:flex-wrap');
      // The period is the picker after the slider in its row, which wraps to the next line below 768px.
      const period = screen.getByRole('button', { name: 'Period This month' });
      expect(slider.parentElement!.contains(period)).toBe(true);
      expect(slider.compareDocumentPosition(period) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(period).toHaveClass('min-h-11', 'text-base', 'font-semibold');
      expect(document.querySelector('select')).toBeNull();
    });
  });

  describe('UI-009 the roster on a tablet', () => {
    it('UI-009, P19.7-T2 AC-13 Name · Goal progress · Proposal · Activity · Status, every row a link', async () => {
      atWidth(800);
      render();
      const grid = await table();
      expect(within(grid).getAllByRole('columnheader').map(heading)).toEqual(['Name', 'Goal progress', 'Proposal', 'Activity', 'Status', 'Details']);
      expect(grid).toHaveClass('table-fixed');
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).toHaveTextContent('82%IDR 65.6M / 80M');
      expect(screen.getByRole('link', { name: 'Dimas Pratama' })).toHaveAttribute('href', '/coaching/mem-dimas/summary?from=%2Funit%2Fdashboard');
    });
  });

  /*
   * **P19.7-T2 AC-13 — how many proposals each person made, and nothing about the clients** (ADR-0221 §7; the proposal
   * spec's decision 4): `proposalsMade` (`PROPOSALS_MADE`) as a *Proposal* column on a laptop and a tablet, its unit's sum
   * on the header row, and on a phone the document icon with the count beside the name, only above zero.
   */
  describe('P19.7-T2 AC-13 the proposals each person made', () => {
    const withProposals = () => {
      const view = dashboard();
      view.yourUnit.rows = view.yourUnit.rows.map((r) => (r.membershipId === 'mem-dimas' ? { ...r, proposalsMade: 3 } : r));
      view.yourUnit.total = { ...view.yourUnit.total, proposalsMade: 3 };
      return view;
    };

    it('P19.7-T2 AC-13 a laptop draws Proposal after Potensi rekrut: each person’s count, the unit’s sum, a light · for none', async () => {
      render(withProposals());
      const grid = await table();
      const proposalCell = (tr: Element) => tr.querySelector('td[data-proposals-made]')!;
      expect(proposalCell(rowOf('Dimas Pratama'))).toHaveAttribute('data-proposals-made', '3');
      expect(proposalCell(rowOf('Dimas Pratama'))).toHaveTextContent('3');
      expect(proposalCell(rowOf('Indah Lestari'))).toHaveTextContent('·');
      const header = within(grid).getByRole('button', { name: 'Your Unit · 4' }).closest('tr')!;
      expect(proposalCell(header)).toHaveAttribute('data-proposals-made', '3');
      // Nothing about a client, a product or a premium: the cell holds the count alone.
      expect(proposalCell(rowOf('Dimas Pratama')).textContent).toBe('3');
    });

    it('P19.7-T2 AC-13 a tablet draws the same column, before Aktivitas', async () => {
      atWidth(800);
      render(withProposals());
      const grid = await table();
      expect(within(grid).getAllByRole('columnheader').map(heading)).toContain('Proposal');
      expect(rowOf('Dimas Pratama').querySelector('td[data-proposals-made="3"]')).not.toBeNull();
    });

    it('P19.7-T2 AC-13 a phone shows the document icon and the count beside the name only above zero, heard as “3 proposals”', async () => {
      atWidth(375);
      render(withProposals());
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const dimas = screen.getByRole('link', { name: 'Dimas Pratama' }).closest('[data-person-row]')!;
      expect(within(dimas as HTMLElement).getByRole('img', { name: '3 proposals' })).toHaveAttribute('data-proposals-made', '3');
      const indah = screen.getByRole('link', { name: 'Indah Lestari' }).closest('[data-person-row]')!;
      expect(indah.querySelector('[data-proposals-made]')).toBeNull();
    });
  });

  /*
   * **P19.9-T4 — the level and WhatsApp on every row, and each unit's amount** (R6, R7; ADR-0235, OD-291; parity
   * I-916–I-918): every row, at every period and size, carries the person's level — the navy tag *Potensi* draws — and a
   * WhatsApp button by Home's rule; each unit's header carries its *Rp x / y* on a phone, and on a laptop below 1280px.
   */
  describe('P19.9-T4 the level and WhatsApp on every row, each unit’s amount', () => {
    const SAVER = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:update_phone'] });
    const tagOf = (row: Element) => row.querySelector('[data-rung-tag]');
    /** The row's WhatsApp — a link with a number on file, a button that asks for one — named for the person. */
    const whatsAppIn = (row: Element) => {
      const found = row.querySelector<HTMLElement>('[data-channel="whatsapp"]');
      if (found) expect(found).toHaveAccessibleName(/^Send a WhatsApp message to /);
      return found;
    };
    const phoneRow = (name: string) => screen.getByRole('link', { name }).closest('[data-person-row]')!;

    it.each(['7d', 'month', 'year'])('P19.9-T4 AC-1 at 375px, period=%s: every row’s level tag before the name, in the company’s short name', async (period) => {
      atWidth(375);
      render(dashboard({ period: period as UnitDashboardView['period'] }), { period });
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      const tags = ['You (Agus)', 'Dimas Pratama', 'Indah Lestari', 'Siti Rahma'].map((name) => tagOf(phoneRow(name)));
      expect(tags.map((tag) => tag?.textContent)).toEqual(['AB', 'Agent', 'Agent', 'Agent']);
      // Before the name, outside the row's link: the row is still named by the person alone, its level read first.
      const name = screen.getByRole('link', { name: 'Dimas Pratama' });
      expect(tags[1]!.nextElementSibling).toBe(name);
      expect(tags[1]).toHaveClass('bg-secondary', 'text-secondary-contrast', 'normal-case');
      // Unit Arief's AAB, once his unit is open.
      await userEvent.click(screen.getByRole('button', { name: /^Arief Wibowo’s Unit · 3/ }));
      expect(tagOf(phoneRow('Arief Wibowo'))).toHaveTextContent('AAB');
    });

    it.each(['month', 'year'])('P19.9-T4 AC-1 at 375px, period=%s: WhatsApp straight through with a number, Isi nomor for a reader who may save one, never on the reader’s row', async (period) => {
      atWidth(375);
      render(dashboard({ period: period as UnitDashboardView['period'] }), { me: SAVER, period });
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      expect(whatsAppIn(phoneRow('Indah Lestari'))).toHaveAttribute('href', 'https://wa.me/6281234567001');
      const dimas = whatsAppIn(phoneRow('Dimas Pratama'))!;
      expect(dimas.tagName).toBe('BUTTON');
      expect(whatsAppIn(phoneRow('You (Agus)'))).toBeNull();
      // On *Bulan ini* WhatsApp sits under the pill, the two in one column beside the ›.
      const pill = phoneRow('Dimas Pratama').querySelector('[data-tone]');
      if (period === 'month') expect(pill!.parentElement!.contains(dimas)).toBe(true);
      else expect(pill).toBeNull();
      await userEvent.click(dimas);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('P19.9-T4 AC-1 a reader who may not save a number gets WhatsApp only where one is on file (Home’s rule)', async () => {
      atWidth(375);
      render();
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      expect(whatsAppIn(phoneRow('Indah Lestari'))).toHaveAttribute('href', 'https://wa.me/6281234567001');
      for (const name of ['Dimas Pratama', 'Siti Rahma', 'You (Agus)']) expect(whatsAppIn(phoneRow(name))).toBeNull();
    });

    it('P19.9-T4 AC-1 the office’s read-only view draws every level and no WhatsApp at all', async () => {
      atWidth(375);
      const view = dashboard({ readOnly: true, head: { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: false } });
      render(view, { me: makeMe({ ...SAVER, membership: { ...SAVER.membership!, isKpmOwner: true } }) });
      await screen.findByRole('button', { name: /^Agus Santoso’s Unit · 4/ });
      expect(document.querySelectorAll('[data-rung-tag]').length).toBe(4);
      expect(document.querySelectorAll('[data-channel="whatsapp"]')).toHaveLength(0);
    });

    it.each([[1024, 'month'], [1280, 'year']])('P19.9-T4 AC-1 at %ipx, period=%s: the level under the name, WhatsApp beside the ›', async (px, period) => {
      atWidth(px);
      render(dashboard({ period: period as UnitDashboardView['period'] }), { me: SAVER, period });
      await table();
      const header = rowOf('Dimas Pratama').querySelector('th')!;
      expect(tagOf(header)).toHaveTextContent('Agent');
      expect(header.querySelector('a')!.compareDocumentPosition(tagOf(header)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const last = [...rowOf('Indah Lestari').querySelectorAll('td')].at(-1)!;
      expect(within(last).getByRole('link', { name: 'Send a WhatsApp message to Indah Lestari' })).toHaveAttribute('href', 'https://wa.me/6281234567001');
      expect(last.querySelector('svg:last-child')).not.toBeNull();
      expect(whatsAppIn(rowOf('You (Agus)'))).toBeNull();
    });

    it('P19.9-T4 AC-1 a tablet draws the same: the level under the name, WhatsApp beside the ›', async () => {
      atWidth(800);
      render(dashboard(), { me: SAVER });
      await table();
      expect(tagOf(rowOf('Siti Rahma'))).toHaveTextContent('Agent');
      expect(whatsAppIn(rowOf('Siti Rahma'))).not.toBeNull();
    });

    it('P19.9-T4 AC-2 at 375px each unit’s header shows its amount under its label, the bar and the % kept; Not uploaded yet with none', async () => {
      atWidth(375);
      const view = dashboard();
      view.units = view.units.map((u, i) => (i === 1
        ? { ...u, total: { ...u.total, goal: { ...u.total.goal, actualMinor: null, attainmentPct: null } } } : u));
      render(view);
      const own = await screen.findByRole('button', { name: /^Your Unit · 4/ });
      expect(own.querySelector('[data-unit-amount]')).toHaveTextContent('IDR 262.4M / 320M');
      expect(own).toHaveTextContent('82%');
      expect(screen.getByRole('button', { name: /^Sari Wulandari’s Unit · 6/ }).querySelector('[data-unit-amount]')).toHaveTextContent('IDR 131.2M / 240M');
      expect(screen.getByRole('button', { name: /^Dewi Kartika’s Unit · 1/ }).querySelector('[data-unit-amount]')).toHaveTextContent('Not uploaded yet');
    });

    it('P19.9-T4 AC-2 a laptop below 1280px shows the unit’s amount on its own line, where it was read only by a screen reader', async () => {
      atWidth(1024);
      render();
      await table();
      const header = within(await table()).getByRole('button', { name: 'Your Unit · 4' }).closest('tr')!;
      const amount = header.querySelector('[data-unit-amount]')!;
      expect(amount).toHaveTextContent('IDR 262.4M / 320M');
      const line = amount.parentElement!;
      expect(wears(line, 1100).split(' ')).toEqual(expect.arrayContaining(['block']));
      expect(wears(line, 1100).split(' ')).not.toContain('sr-only');
      // From 1280px it sits beside the %, after a ·, as before.
      expect(wears(line, 1280).split(' ')).not.toContain('block');
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

  describe('a new hire before a first sale (P18.8-T5, ADR-0172)', () => {
    it('P18.8-T5 AC-3 tags her New hire, named for a screen reader; the production’s ⓘ names her', async () => {
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

    /* *Changed 2026-11-07* (P19.8-T4 AC-11; MOB UI-181; OD-280; ADR-0229 §9): no *No data yet* line; *0 of –*. */
    it('P15-T2 AC-8, P19-T4 AC-3, P19.8-T4 AC-11 MOB UI-181 shows a leader who leads nobody the normal layout at zero, 0 of –, and the Example', async () => {
      stubFetch({ 'GET /unit/dashboard': { body: EMPTY } });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      expect(await screen.findByText('Example')).toBeInTheDocument();
      expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
      const active = screen.getByText('Active Agent October').closest<HTMLElement>('[data-stat-tile]')!;
      expect(active).toHaveTextContent('0of –');
      expect(active).toHaveTextContent('Unit 0/–AAB 0/–');
      expect(within(active).getByRole('img')).toHaveAccessibleName(/–/);
      // The normal layout: the period picker, and the sample of the roster under the Example label, greyed and inert.
      expect(screen.getByRole('button', { name: 'Period This month' })).toBeInTheDocument();
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
    if (tab === 'overview') await screen.findByRole('button', { name: /^Your Unit · 4/ });
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

  it.each([375, 360])('P19.8-T4 AC-11 MOB UI-181 at %ipx an empty unit: 0 of –, the Example roster’s count tiles on one row, Add your first agent, no No data yet', async (px) => {
    atWidth(px);
    nav.search = '';
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: EMPTY } });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: LEADER });
    await screen.findByText('Example');
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(document.querySelector('[data-sample] [data-count-tiles]')).toHaveClass('grid', 'grid-cols-3');
    expect(screen.getByRole('link', { name: 'Add your first agent' })).toHaveAttribute('href', '/user-management/add');
    const active = document.querySelector('[data-label-long]')!.closest<HTMLElement>('[data-stat-tile]')!;
    expect(active).toHaveTextContent('0of –');
    // The phone's label: *Active Agent* and the month's chip, *Oct*.
    expect(active.querySelector('[data-month-chip]')).toHaveTextContent('Oct');
  });

  it('P19.8-T4 AC-12 MOB UI-171 the Overview’s period: Last 7 days · This month · This year in a menu; a choice reads that period', async () => {
    await open('overview', 375);
    await userEvent.click(screen.getByRole('button', { name: 'Period This month' }));
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
