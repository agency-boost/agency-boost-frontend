import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  atWidth, makeMe, renderInIndonesian, renderInLayout, resetLanguage, stubFetch, wears, type StubReply,
} from '@test/harness';
import {
  ADMIN_ME, analyticsView, CORE_LEADER_ME, GROUPS, NO_AB, OWNER_ME, SHELL_STUBS, leaders, rp,
} from '@test/kpm-analytics-fixtures';
import { englishOnly, englishShown } from '@test/english-left';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { landingFor } from '@/lib/landing';
import KpmAnalyticsLayout from './layout';
import KpmAnalyticsPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/kpm/analytics', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const ANALYTICS = 'GET /kpm/analytics';

/** The three widths every ticket here is checked at: a phone, a tablet, a laptop. */
const SIZES = [375, 768, 1280] as const;

function open(
  reply: StubReply | StubReply[] = { body: analyticsView() },
  { me = OWNER_ME, query = {}, width = 1280 }: { me?: typeof OWNER_ME; query?: Record<string, string>; width?: number } = {},
) {
  atWidth(width);
  const stub = stubFetch({ ...SHELL_STUBS, [ANALYTICS]: reply });
  nav.search = new URLSearchParams(query).toString();
  renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me });
  return stub;
}

const reads = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/kpm/analytics')).map((c) => c.url.replace('http://api.test/api/v1', ''));
const leaderList = () => screen.findByRole('region', { name: 'Leader' });
const totals = () => document.querySelector('[data-totals]') as HTMLElement;
const tile = (label: RegExp) => [...totals().querySelectorAll('[data-stat-tile]')].find((t) => label.test(t.textContent ?? '')) as HTMLElement;
/** A leader's row below 1024px: the `PersonRow` holding their name's button. */
const rowOf = (name: string) => screen.getByRole('button', { name }).closest('[data-person-row]') as HTMLElement;
/** A leader's row of the table from 1024px. */
const tableRow = (id: string) => document.querySelector(`[data-leader="${id}"]`) as HTMLElement;

beforeEach(() => {
  nav.search = '';
  nav.pathname = '/kpm/analytics';
  try { sessionStorage.clear(); } catch { /* none */ }
});
afterEach(() => {
  vi.unstubAllGlobals();
  nav.replace.mockClear();
  resetLanguage();
});

/**
 * **KPM Analytics' Overview, every leader** (P19.3-T3; UI-152 and its Appendix D row, UI-091, UI-092, UI-094 to
 * UI-097, OWN UI-021, OWN UI-022; the `kpm-leaders` mockups of 3 November) — at 375, 768 and 1280px, for the Owner,
 * an Admin and a Core Leader, over `GET /kpm/analytics`, the period and the group in the address.
 */
describe('P19.3-T3 KPM Analytics — every leader', () => {
  describe('AC-1 the Leader list', () => {
    it.each(SIZES)('P19.3-T3 AC-1 at %ipx lists every AB and AAB, with the chips Semua · AB · AAB, needs-attention first', async (width) => {
      open(undefined, { width });
      const list = await leaderList();
      const chips = within(within(list).getByRole('group', { name: 'Show' })).getAllByRole('button');
      expect(chips.map((c) => [c.textContent, c.getAttribute('aria-pressed')])).toEqual([['All 7', 'true'], ['AB 4', 'false'], ['AAB 3', 'false']]);
      expect(within(list).getByText('Needs attention first')).toBeInTheDocument();
      // The server's order, kept: Hendra 41%, Ika 52%, the Owner 100%, then those with no %.
      const names = width < 1024
        ? [...list.querySelectorAll('[data-person-row] [data-row-main]')].map((n) => n.textContent)
        : [...list.querySelectorAll('[data-leader] th button')].map((b) => b.textContent);
      expect(names.slice(0, 3)).toEqual(['Hendra Wibowo', 'Ika Wirawan', 'Wilson Tanoto']);
      expect(names).toHaveLength(7);
    });

    it('P19.3-T3 AC-1 the chips filter by class, and the list keeps its order', async () => {
      open(undefined, { width: 375 });
      const list = await leaderList();
      await userEvent.click(within(list).getByRole('button', { name: 'AAB 3' }));
      expect([...list.querySelectorAll('[data-row-main]')].map((n) => n.textContent)).toEqual(['Ika Wirawan', 'Dewi Lestari', 'Yoga Pratama']);
      await userEvent.click(within(list).getByRole('button', { name: 'AB 4' }));
      expect([...list.querySelectorAll('[data-row-main]')].map((n) => n.textContent)).toEqual(['Hendra Wibowo', 'Wilson Tanoto', 'Budi Santoso', 'Fajar Nugroho']);
    });

    it.each([375, 768] as const)('P19.3-T3 AC-1, AC-13 at %ipx a 60px row: the pill, the APE bar and %, the APE, n people or to <first name>, MOC for an AB', async (width) => {
      open(undefined, { width });
      await leaderList();
      const hendra = rowOf('Hendra Wibowo');
      expect(hendra).toHaveClass('min-h-[3.75rem]');
      expect(hendra).toHaveTextContent('Star Club');
      expect(hendra).toHaveTextContent('41%');
      expect(hendra).toHaveTextContent('IDR 62M · 31 people');
      expect(within(hendra).getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' })).toBeInTheDocument();
      const ika = rowOf('Ika Wirawan');
      expect(ika).toHaveTextContent('AAB');
      expect(ika).toHaveTextContent('to Hendra');
      // An AAB's row draws no MOC pill (UI-152).
      expect(within(ika).queryByRole('button', { name: /MOC/ })).not.toBeInTheDocument();
      expect(rowOf('Wilson Tanoto')).toHaveTextContent('You');
      expect(rowOf('Fajar Nugroho')).toHaveTextContent('No goal set');
      // A tablet reads the phone's rows (UI-097): no table below 1024px.
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('P19.3-T3 AC-1, AC-13 at 1280px a table: Nama · Leader dari · Group · APE bulan ini · Active · Coached 7D · Club · MOC · ›', async () => {
      open();
      const list = await leaderList();
      const table = within(list).getByRole('table', { name: 'Leader' });
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
        .toEqual(['Name', 'Leader of', 'Group', 'APE this month', 'Active', 'Coached 7D', 'Club', 'MOC', 'Open']);
      // UI-097: headers 12px, sentence case; MOC a tinted pill.
      for (const header of within(table).getAllByRole('columnheader')) expect(header).toHaveClass('text-xs', 'font-semibold');
      expect(within(table).getAllByRole('columnheader')[0]).not.toHaveClass('uppercase');
      const hendra = tableRow('mem-hendra');
      expect(within(hendra).getAllByRole('cell').map((c) => c.textContent)).toEqual(
        ['Wilson', '31', '41%IDR 62M', '21 / 31', '6 / 31', 'Star Club', 'MOC', ''],
      );
      expect(hendra.querySelector('[data-moc-pill="met"] [data-tone="green"]')).not.toBeNull();
      expect(within(tableRow('mem-ika')).getAllByRole('cell')[0]).toHaveTextContent('Hendra');
      expect(within(tableRow('mem-owner')).getAllByRole('cell')[0]).toHaveTextContent('—');
      expect(within(tableRow('mem-budi')).getAllByRole('cell')[3]).toHaveTextContent('Not uploaded yet');
    });

    it('P19.3-T3 AC-13 the table fits 1280 and 1024 without scrolling sideways: fixed columns, no minimum width, no scroll box', async () => {
      for (const width of [1280, 1024]) {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
        open(undefined, { width });
        const table = within(await leaderList()).getByRole('table');
        expect(table).toHaveClass('w-full', 'table-fixed');
        expect(table.className).not.toMatch(/min-w-/);
        expect(table.closest('.overflow-x-auto')).toBeNull();
      }
    });
  });

  describe('AC-2 the leader sheet, or side panel from 1024px', () => {
    it.each(SIZES)('P19.3-T3 AC-2 at %ipx a row opens the leader: who they are, four tiles, and the links', async (width) => {
      open(undefined, { width });
      await leaderList();
      if (width < 1024) await userEvent.click(screen.getByRole('button', { name: 'Hendra Wibowo' }));
      else await userEvent.click(within(tableRow('mem-hendra')).getByRole('button', { name: 'Hendra Wibowo' }));
      const sheet = await screen.findByRole('dialog', { name: 'HENDRA WIBOWO' });
      // The sheet below 1024px; a side panel at the screen's right edge from it (the `drawer` placement).
      expect(sheet.closest('[data-modal-root]')).toHaveAttribute('data-placement', 'drawer');
      expect(sheet).toHaveAccessibleDescription('AB · 31 in Group · 9 in Unit · Star Club');
      // UI-094, AC-10: the Group's split, one format.
      expect(sheet).toHaveTextContent('1 AB · 3 AAB · 26 Agents');
      const tiles = [...sheet.querySelectorAll('[data-stat-tile]')].map((t) => t.textContent);
      expect(tiles).toEqual([
        'APE this monthIDR 62M41% of target',
        'Active this month21/ 31Unit 6/9 · AAB 15/22',
        'Coached 7 days6/ 3119%',
        expect.stringMatching(/^MOCMet\d of 5 requirements$/),
      ]);
      // AC-13: the leads cell, *"(n potensial)"* behind its ⓘ.
      expect(sheet.querySelector('[data-leads]')).toHaveTextContent('Leads 67 · 48 sales · 19 recruit');
      expect(within(sheet).getByRole('button', { name: '(14 potential)' })).toBeInTheDocument();
      const links = within(within(sheet).getByRole('navigation')).getAllByRole('link');
      expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
        ['Unit Dashboard', '/unit/dashboard/mem-hendra'],
        ['Group Tree', '/group-tree/mem-hendra'],
        ['Member page', '/people/members/mem-hendra'],
      ]);
      // UI-095: each in the same tab.
      for (const link of links) expect(link).not.toHaveAttribute('target');
      expect(wears(sheet, width)).toMatch(width >= 1024 ? /max-w-\[25rem\]/ : /max-h-\[90dvh\]/);
    });

    it('P19.3-T3 AC-2 an AAB who leads nobody opens no Unit Dashboard — there is none — and keeps the Group Tree', async () => {
      open(undefined, { width: 375 });
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'Dewi Lestari' }));
      const sheet = await screen.findByRole('dialog', { name: 'DEWI LESTARI' });
      expect(sheet).toHaveTextContent('0 AAB · 0 Agents');
      expect(within(sheet).getAllByRole('link').map((l) => l.textContent)).toEqual(['Group Tree', 'Member page']);
    });

    it('P19.3-T3 AC-3, AC-16 a Core Leader follows only the links the server says are theirs, and never the member page', async () => {
      const own = leaders().map((l) => (l.head.membershipId === 'mem-ika' || l.head.membershipId === 'mem-hendra' ? l : { ...l, opens: false }));
      open({ body: analyticsView('this_month', { leaders: own }) }, { me: CORE_LEADER_ME, width: 375 });
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'Ika Wirawan' }));
      let sheet = await screen.findByRole('dialog', { name: 'IKA WIRAWAN' });
      expect(within(sheet).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/unit/dashboard/mem-ika', '/group-tree/mem-ika']);
      await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
      await userEvent.click(screen.getByRole('button', { name: 'Budi Santoso' }));
      sheet = await screen.findByRole('dialog', { name: 'BUDI SANTOSO' });
      expect(within(sheet).queryAllByRole('link')).toHaveLength(0);
    });

    it('P19.3-T3 AC-11 a link keeps the page’s place: Back returns to the same scroll, the same chip and the same leader open', async () => {
      open(undefined, { width: 375 });
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'AAB 3' }));
      await userEvent.click(screen.getByRole('button', { name: 'Ika Wirawan' }));
      const sheet = await screen.findByRole('dialog', { name: 'IKA WIRAWAN' });
      Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
      within(sheet).getByRole('link', { name: 'Group Tree' }).addEventListener('click', (e) => e.preventDefault());
      await userEvent.click(within(sheet).getByRole('link', { name: 'Group Tree' }));
      expect(JSON.parse(sessionStorage.getItem('kpm-analytics:return')!)).toEqual({ at: '/kpm/analytics', y: 640, leader: 'mem-ika', chip: 'aab' });
      // *Back*: the page mounts again over the same address.
      cleanup();
      vi.unstubAllGlobals();
      const scrolled = vi.fn();
      vi.stubGlobal('scrollTo', scrolled);
      vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 0; });
      open(undefined, { width: 375 });
      expect(await screen.findByRole('dialog', { name: 'IKA WIRAWAN' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'AAB 3' })).toHaveAttribute('aria-pressed', 'true');
      expect(scrolled).toHaveBeenCalledWith(0, 640);
      expect(sessionStorage.getItem('kpm-analytics:return')).toBeNull();
    });

    it('P19.3-T3 AC-12 the MOC pill opens the requirements, its money with the shared formatter (UI-096)', async () => {
      open(undefined, { width: 375 });
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' }));
      const dialog = screen.getByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' });
      expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('APE');
      expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('IDR 1.3B / IDR 600M — Met');
      expect(dialog.textContent).not.toMatch(/\d{1,3}(\.\d{3}){2,}/);
      expect(dialog.textContent).not.toContain('Net APE');
    });
  });

  describe('AC-4, AC-5 the KPM’s totals', () => {
    it.each(SIZES)('P19.3-T3 AC-4 at %ipx six tiles above the list, Manpower reading “n leader · n agent”', async (width) => {
      open(undefined, { width });
      await leaderList();
      const grid = totals();
      expect(grid.querySelectorAll('[data-stat-tile]')).toHaveLength(6);
      // Two across on a phone, three on a tablet, six in a row from 1024px.
      expect(wears(grid, width)).toContain(width < 768 ? 'grid-cols-2' : width < 1024 ? 'grid-cols-3' : 'grid-cols-6');
      expect(tile(/^Manpower/)).toHaveTextContent('Manpower687 leader · 61 agent');
      // The list follows the tiles.
      expect(grid.compareDocumentPosition(screen.getByRole('region', { name: 'Leader' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('P19.3-T3 AC-5 APE YTD is the KPM’s one production total — no ⓘ about leavers — and the rows say “Current members” once', async () => {
      open();
      await leaderList();
      expect(tile(/^APE YTD/)).toHaveTextContent('APE YTDIDR 5.8B');
      expect(screen.queryByText(/Leaves out|Tidak menghitung/)).not.toBeInTheDocument();
      expect(screen.getAllByText('Current members')).toHaveLength(1);
      expect(document.body.textContent).not.toMatch(/APE — Annual|Producing|Net APE/);
      // T1 AC-9 and ADR-0200 §1, carried by this screen: *Active this month*, *APE YTD*.
      expect(tile(/^Active this month/)).toHaveTextContent('Active this month54/ 6879%');
    });
  });

  describe('AC-7 Monthly production (UI-091)', () => {
    it.each(SIZES)('P19.3-T3 AC-7 at %ipx six bars ending with this month: one colour, this month in the accent, a missing month hatched with –', async (width) => {
      open(undefined, { width });
      await leaderList();
      const chart = document.querySelector('[data-monthly-chart]') as HTMLElement;
      const bars = [...chart.querySelectorAll('[data-bar]')];
      expect(bars.map((b) => b.getAttribute('data-bar'))).toEqual(['month', 'month', 'month', 'none', 'month', 'current']);
      expect(bars.filter((b) => b.getAttribute('data-bar') === 'month').every((b) => b.classList.contains('bg-line'))).toBe(true);
      expect(bars.at(-1)).toHaveClass('bg-primary');
      expect(bars[3].className).toMatch(/repeating-linear-gradient/);
      const months = within(screen.getByRole('list', { name: 'Monthly production' })).getAllByRole('listitem');
      expect(months.map((m) => m.querySelector('.sr-only')!.textContent)).toEqual([
        'May 2026: IDR 610M', 'Jun 2026: IDR 580M', 'Jul 2026: IDR 700M', 'Aug 2026: not uploaded', 'Sep 2026: IDR 800M', 'Oct 2026: IDR 302M',
      ]);
      // It fits 375px: six columns sharing the card, no minimum width, no scroll box.
      expect(chart.className).not.toMatch(/min-w|overflow-x/);
      expect(chart.querySelector('ul')!.getAttribute('style')).toContain('repeat(6, minmax(0, 1fr))');
      // No footnote (D-35).
      expect(chart.parentElement!.textContent).not.toMatch(/Last 6 months|combined APE/);
    });
  });

  describe('AC-8 the sentences (UI-092)', () => {
    it('P19.3-T3 AC-8 no sub-line says “this year” under a month, and no ⓘ sends the reader to this page', async () => {
      open({ body: analyticsView('this_month') }, { query: { period: 'this_month' } });
      await leaderList();
      expect(screen.queryByText(/this year — peer benchmark|Unit comparisons, club qualification/)).not.toBeInTheDocument();
      expect(screen.queryByText(/the Overview’s year counts it/)).not.toBeInTheDocument();
      // The month's own words follow the period chosen.
      expect(tile(/^APE — This Month/)).toBeTruthy();
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
      open({ body: analyticsView('previous_month') }, { query: { period: 'previous_month' } });
      await leaderList();
      expect(tile(/^APE — Last Month/)).toBeTruthy();
      expect(tile(/^Active last month/)).toBeTruthy();
      expect(within(screen.getByRole('table')).getAllByRole('columnheader')[3]).toHaveTextContent('APE last month');
    });
  });

  describe('AC-15 Lihat untuk: a custom group (OD-258)', () => {
    it.each(SIZES)('P19.3-T3 AC-15 at %ipx the pill sits by the period and opens the whole KPM, each group and Manage groups', async (width) => {
      open(undefined, { width });
      await leaderList();
      const pill = screen.getByRole('button', { name: 'View for: Whole KPM' });
      expect(pill.parentElement).toContainElement(screen.getByRole('combobox', { name: 'Period' }));
      await userEvent.click(pill);
      const sheet = await screen.findByRole('dialog', { name: 'View for' });
      expect(within(sheet).getAllByRole('radio').map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
        ['Whole KPM68 people', 'true'], ['Core LeaderGroup · 3 people', 'false'], ['Top Producers 2026Group · 6 people', 'false'],
      ]);
      expect(within(sheet).getByRole('link', { name: 'Manage groups in All members' })).toHaveAttribute('href', '/people/members?tab=groups');
    });

    it('P19.3-T3 AC-15 picking a group re-reads every number over it, the address carries it, and the pill shows its name', async () => {
      const core = analyticsView('this_month', {
        group: GROUPS[0],
        total: { ...analyticsView().total, manpower: { ab: 1, aab: 1, agents: 1, total: 3 }, apeAnnual: { achievedMinor: rp(900), targetMinor: rp(1000), pct: 90 } },
        leaders: leaders().filter((l) => ['mem-hendra', 'mem-ika'].includes(l.head.membershipId)),
      });
      const { calls } = open([{ body: analyticsView() }, { body: core }]);
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'View for: Whole KPM' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: 'View for' })).getByRole('radio', { name: /^Core Leader/ }));
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics?group=grp-core', { scroll: false });
      await waitFor(() => expect(reads(calls)).toEqual(['/kpm/analytics?period=this_month', '/kpm/analytics?period=this_month&group=grp-core']));
      expect(await screen.findByRole('button', { name: 'View for: Core Leader' })).toBeInTheDocument();
      expect(tile(/^Manpower/)).toHaveTextContent('Manpower32 leader · 1 agent');
      expect(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'All 2' })).toBeInTheDocument();
      // A group's production is its members', all current, and says so.
      expect(document.querySelector('[data-group-members]')).toHaveTextContent('Current members');
      // Overview | Compliance carry the group across.
      const tabs = within(screen.getByRole('navigation', { name: 'KPM Analytics' }));
      expect(tabs.getByRole('link', { name: 'Compliance' })).toHaveAttribute('href', '/kpm/analytics/compliance');
    });

    it('P19.3-T3 AC-15 the address’s group is read on arrival, beside the period, and both tabs carry it', async () => {
      const { calls } = open({ body: analyticsView('previous_month', { group: GROUPS[1] }) }, { query: { period: 'previous_month', group: 'grp-top' } });
      await leaderList();
      expect(reads(calls)).toEqual(['/kpm/analytics?period=previous_month&group=grp-top']);
      const tabs = within(screen.getByRole('navigation', { name: 'KPM Analytics' }));
      expect(tabs.getByRole('link', { name: 'Compliance' })).toHaveAttribute('href', '/kpm/analytics/compliance?group=grp-top');
      expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    });

    it('P19.3-T3 AC-15 another office’s group answers 404, said as an error with a retry', async () => {
      open({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Group not found.', requestId: 'r' } } }, { query: { group: 'grp-other' } });
      expect(await screen.findByRole('alert')).toHaveTextContent('Group not found.');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('P19.3-T3 AC-15 a Core Leader may pick a group, but is not offered to manage them', async () => {
      open(undefined, { me: CORE_LEADER_ME, width: 375 });
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'View for: Whole KPM' }));
      expect(within(await screen.findByRole('dialog', { name: 'View for' })).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('AC-16 who reads it, and the states', () => {
    it('P19.3-T3 AC-16 gives the Admin the same screen', async () => {
      open(undefined, { me: ADMIN_ME });
      expect(within(await leaderList()).getByRole('table')).toBeInTheDocument();
    });

    it.each([
      ['an AB who is no Core Leader', makeMe({
        membership: {
          membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 3, isCoreLeader: false,
        },
        permissions: ['member:read_profile', 'org_tree:read', 'kpm_analytics:read'],
      })],
      ['an Agent', makeMe({ permissions: ['member:read_profile'] })],
    ])('P19.3-T3 AC-16 refuses %s, and asks the API for nothing', async (_who, me) => {
      const { calls } = open(undefined, { me });
      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      expect(nav.replace).not.toHaveBeenCalledWith(landingFor(me));
      expect(reads(calls)).toEqual([]);
    });

    it('P19.3-T3 AC-16 a Core Leader reads the whole office in their own shell', async () => {
      const { calls } = open(undefined, { me: CORE_LEADER_ME });
      expect(await leaderList()).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'KPM Analytics' })).toHaveAttribute('aria-current', 'page');
      expect(reads(calls)).toEqual(['/kpm/analytics?period=this_month']);
    });

    it('shows a skeleton while the analytics are read', () => {
      atWidth(1280);
      stubFetch({ ...SHELL_STUBS, [ANALYTICS]: { body: analyticsView() } });
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
      renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me: OWNER_ME });
      expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading the analytics…');
    });

    it('shows an error with a retry that keeps the period and the group', async () => {
      const failure = { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } };
      const { calls } = open([failure, { body: analyticsView('previous_month') }], { query: { period: 'previous_month', group: 'grp-core' } });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await leaderList();
      expect(reads(calls)).toEqual(['/kpm/analytics?period=previous_month&group=grp-core', '/kpm/analytics?period=previous_month&group=grp-core']);
    });

    it('keeps the period in the address: choosing Previous month re-reads it and replaces the address', async () => {
      const { calls } = open([{ body: analyticsView() }, { body: analyticsView('previous_month') }]);
      await leaderList();
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'previous_month');
      expect(nav.replace).toHaveBeenLastCalledWith('/kpm/analytics?period=previous_month', { scroll: false });
      await waitFor(() => expect(reads(calls)).toContain('/kpm/analytics?period=previous_month'));
    });

    it('says so for an office with no leader yet, and still draws the months', async () => {
      open({ body: NO_AB });
      expect(await screen.findByText('No AB or AAB yet.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(within(screen.getByRole('list', { name: 'Monthly production' })).getAllByRole('listitem')).toHaveLength(6);
    });

    it('writes nothing: choosing, opening and filtering only read', async () => {
      const { mock } = open();
      await leaderList();
      await userEvent.click(screen.getByRole('button', { name: 'AB 4' }));
      await userEvent.click(within(tableRow('mem-hendra')).getByRole('button', { name: 'Hendra Wibowo' }));
      expect(mock.mock.calls.every(([, init]) => ((init as RequestInit | undefined)?.method ?? 'GET') === 'GET')).toBe(true);
    });

    it('draws the tabs as one segmented control at every size, and no sub-line', async () => {
      for (const width of SIZES) {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
        open(undefined, { width });
        await leaderList();
        expect(screen.getByRole('navigation', { name: 'KPM Analytics' })).toHaveAttribute('data-route-segments');
        expect(screen.queryByText('Unit comparisons, club qualification, and trends')).not.toBeInTheDocument();
      }
    });
  });
});

describe('P19.3-T3 KPM Analytics in Indonesian', () => {
  function openInIndonesian(width = 1280) {
    atWidth(width);
    stubFetch({ ...SHELL_STUBS, [ANALYTICS]: { body: analyticsView() } });
    renderInIndonesian(<KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, { me: OWNER_ME });
  }

  it('P19.3-T3 AC-1, AC-6 writes the list, the sheet and the filter in Indonesian: Leader dari, n di Group, ke Hendra, Seluruh KPM', async () => {
    openInIndonesian(1280);
    const list = await screen.findByRole('region', { name: 'Leader' });
    expect(within(list).getByRole('button', { name: 'Semua 7' })).toBeInTheDocument();
    expect(within(list).getByText('Perlu perhatian dulu')).toBeInTheDocument();
    expect(within(list).getByText('Anggota saat ini')).toBeInTheDocument();
    expect(within(within(list).getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent).slice(0, 4))
      .toEqual(['Nama', 'Leader dari', 'Group', 'APE bulan ini']);
    await userEvent.click(within(tableRow('mem-hendra')).getByRole('button', { name: 'Hendra Wibowo' }));
    const sheet = await screen.findByRole('dialog', { name: 'HENDRA WIBOWO' });
    // OWN UI-022: *n di Group*, never *dalam tim*, *di unit* or *orang di agensi*.
    expect(sheet).toHaveAccessibleDescription('AB · 31 di Group · 9 di Unit · Star Club');
    expect(sheet).toHaveTextContent('1 AB · 3 AAB · 26 Agents');
    expect(sheet).toHaveTextContent('Coached 7 hari');
    expect(sheet).toHaveTextContent('Leads 67 · 48 penjualan · 19 rekrut');
    expect(document.body.textContent).not.toMatch(/dalam tim|orang di agensi|Seluruh unit/);
    expect(screen.getByRole('button', { name: 'Lihat untuk: Seluruh KPM' })).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(kpmAnalyticsMessages))).toEqual([]);
  });

  it('P19.3-T3 AC-1 writes the phone’s rows in Indonesian: n orang, ke Hendra, Goal belum diatur', async () => {
    openInIndonesian(375);
    await screen.findByRole('region', { name: 'Leader' });
    expect(rowOf('Hendra Wibowo')).toHaveTextContent('Rp 62 jt · 31 orang');
    expect(rowOf('Ika Wirawan')).toHaveTextContent('ke Hendra');
    expect(rowOf('Fajar Nugroho')).toHaveTextContent('Goal belum diatur');
    expect(rowOf('Wilson Tanoto')).toHaveTextContent('Anda');
  });
});
