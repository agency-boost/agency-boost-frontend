import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import { parse, renderable, SRC } from '@test/copy-scan';
import {
  officeState, PLATFORM_ANALYTICS_HEADINGS, rungWords, shareOf, signedInWords, tableRows,
  type PlatformAnalyticsView,
} from '@/lib/admin-analytics';
import PlatformAnalyticsPage from './page';
import { landingFor } from '@/lib/landing';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/analytics',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // The console's gate (`kpm:list_all`), then the route's own.
  permissions: ['kpm:list_all', 'platform_analytics:read'],
});

const PRU_LADDER = (agent: number, aab: number, ab: number) => [
  { code: 'AGENT', label: 'Agent', count: agent },
  { code: 'AAB', label: 'AAB', count: aab },
  { code: 'AB', label: 'AB', count: ab },
];

const adoption = (over: Partial<PlatformAnalyticsView['platform']> = {}) => ({
  members: 0, byRung: [], joinedThisMonth: 0, leftThisMonth: 0, signedIn7d: 0, signedIn30d: 0, ...over,
});

const PRU = { id: 'co-pru', name: 'Prudential' };
const MAN = { id: 'co-man', name: 'Manulife' };

/**
 * Two companies with different ladders, three offices, one of them suspended and one past its
 * subscription — the payload `GET /admin/analytics` sends, figures and nothing else.
 */
const VIEW: PlatformAnalyticsView = {
  month: '2026-10',
  offices: [
    {
      kpmId: 'kpm-0417', code: '0417', branch: 'BSD City Branch', company: PRU, state: 'active',
      members: 1340, byRung: PRU_LADDER(1300, 28, 12), joinedThisMonth: 14, leftThisMonth: 2,
      signedIn7d: 1072, signedIn30d: 1206,
    },
    {
      kpmId: 'kpm-0555', code: '0555', branch: 'Kelapa Gading Branch', company: PRU, state: 'suspended',
      members: 20, byRung: PRU_LADDER(16, 3, 1), joinedThisMonth: 0, leftThisMonth: 1,
      signedIn7d: 0, signedIn30d: 4,
    },
    {
      kpmId: 'kpm-0601', code: '0601', branch: 'Medan Branch', company: MAN, state: 'ended',
      members: 9, byRung: [{ code: 'FC', label: 'Financial Consultant', count: 8 }, { code: 'UM', label: 'Unit Manager', count: 1 }],
      joinedThisMonth: 1, leftThisMonth: 0, signedIn7d: 0, signedIn30d: 0,
    },
  ],
  companies: [
    {
      ...PRU, offices: 2, members: 1360, byRung: PRU_LADDER(1316, 31, 13), joinedThisMonth: 14, leftThisMonth: 3,
      signedIn7d: 1072, signedIn30d: 1210,
    },
    {
      ...MAN, offices: 1, members: 9, byRung: [{ code: 'FC', label: 'Financial Consultant', count: 8 }, { code: 'UM', label: 'Unit Manager', count: 1 }],
      joinedThisMonth: 1, leftThisMonth: 0, signedIn7d: 0, signedIn30d: 0,
    },
  ],
  platform: {
    offices: 3, companies: 2, members: 1369,
    byRung: [...PRU_LADDER(1316, 31, 13), { code: 'FC', label: 'Financial Consultant', count: 8 }, { code: 'UM', label: 'Unit Manager', count: 1 }],
    joinedThisMonth: 15, leftThisMonth: 3, signedIn7d: 1072, signedIn30d: 1210,
  },
};

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent?.replace(/\s+/g, ' ').trim());

async function renderLoaded(view: unknown = VIEW) {
  const stub = stubFetch({ '/admin/analytics': { body: view } });
  renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
  const table = await screen.findByRole('table', { name: 'Adoption by branch and company' });
  return { ...stub, table };
}

describe('Cross-platform analytics (P18-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-4: the screen', () => {
    it('is titled as the nav names it, and is the current nav item', async () => {
      await renderLoaded();
      expect(screen.getByRole('heading', { level: 1, name: 'Cross-platform analytics' })).toBeInTheDocument();
      const item = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Cross-platform analytics' });
      expect(item).toHaveAttribute('href', '/admin/analytics');
      expect(item).toHaveAttribute('aria-current', 'page');
    });

    it('is one table, with All KPMs’ first four headings and then the figures, in order', async () => {
      const { table, calls } = await renderLoaded();
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
        'Code', 'Branch', 'Company', 'Status', 'Members', 'By rung',
        'Joined in October 2026', 'Left in October 2026', 'Signed in within 7 days', 'Signed in within 30 days',
      ]);
      expect(screen.getAllByRole('table')).toHaveLength(1);
      // One request, whatever the number of offices.
      expect(calls.filter((c) => c.url.includes('/admin/analytics'))).toHaveLength(1);
    });

    it('draws a row per office as All KPMs does: the code a link to the office, the state its pill', async () => {
      const { table } = await renderLoaded();
      const row = within(table).getByRole('row', { name: /^0417/ });
      expect(cells(row)).toEqual([
        '0417', 'BSD City Branch', 'Prudential', 'Active', '1,340', 'Agent 1,300 · AAB 28 · AB 12',
        '14', '2', '1,072 (80%)', '1,206 (90%)',
      ]);
      expect(within(row).getByRole('link', { name: '0417' })).toHaveAttribute('href', '/admin/tenants/kpm-0417');
    });

    it('AC-2: a suspended or ended office is counted as it is, its state shown as All KPMs shows it', async () => {
      const { table } = await renderLoaded();
      const suspended = within(table).getByRole('row', { name: /^0555/ });
      expect(within(suspended).getByText('Suspended')).toBeInTheDocument();
      expect(cells(suspended).slice(4)).toEqual(['20', 'Agent 16 · AAB 3 · AB 1', '0', '1', '0 (0%)', '4 (20%)']);
      const ended = within(table).getByRole('row', { name: /^0601/ });
      expect(within(ended).getByText('Ended')).toBeInTheDocument();
      // Its own company's ladder, in that company's words.
      expect(cells(ended)[5]).toBe('Financial Consultant 8 · Unit Manager 1');
    });

    it('puts each company’s total under its offices, and the platform’s last', async () => {
      const { table } = await renderLoaded();
      const body = within(table).getAllByRole('row').slice(1);
      expect(body.map((r) => cells(r)[0])).toEqual([
        '0417', '0555', 'Prudential — Total (2 branches)', '0601', 'Manulife — Total (1 branch)',
        'Platform — Total (2 companies, 3 branches)',
      ]);
      const pru = body[2];
      expect(cells(pru)).toEqual([
        'Prudential — Total (2 branches)', '1,360', 'Agent 1,316 · AAB 31 · AB 13', '14', '3', '1,072 (79%)', '1,210 (89%)',
      ]);
      expect(within(pru).getAllByRole('cell')[0]).toHaveAttribute('colspan', '4');
      const platform = body[5];
      expect(cells(platform)).toEqual([
        'Platform — Total (2 companies, 3 branches)', '1,369',
        'Agent 1,316 · AAB 31 · AB 13 · Financial Consultant 8 · Unit Manager 1', '15', '3', '1,072 (78%)', '1,210 (88%)',
      ]);
    });

    it('scrolls inside its card: a minimum width on the table, and the scroll box positioned', async () => {
      const { table } = await renderLoaded();
      expect(table.className).toContain('min-w-[64rem]');
      expect(table.className).toContain('relative');
      const box = table.parentElement!;
      expect(box.className).toContain('overflow-x-auto');
      expect(box.className).toContain('relative');
    });

    it('is not sortable, as All KPMs is not', async () => {
      const { table } = await renderLoaded();
      expect(within(table).queryAllByRole('button')).toEqual([]);
      for (const heading of within(table).getAllByRole('columnheader')) expect(heading).not.toHaveAttribute('aria-sort');
    });
  });

  describe('AC-3: nothing on it names a member', () => {
    it('renders only the aggregates: every figure is a count, every label the office’s or a total’s', async () => {
      const { table } = await renderLoaded();
      const COUNT = /^[\d,]+$/;
      const SHARE = /^[\d,]+( \(\d+%\))?$/;
      const RUNGS = /^(—|[^·]+ [\d,]+( · [^·]+ [\d,]+)*)$/;
      const labels = new Set([
        ...VIEW.offices.flatMap((o) => [o.code, o.branch, o.company.name, officeState(o.state).word]),
      ]);
      for (const row of within(table).getAllByRole('row').slice(1)) {
        const all = cells(row);
        const total = all.length === 7;
        const head = total ? all.slice(0, 1) : all.slice(0, 4);
        const [members, rungs, joined, left, in7, in30] = all.slice(head.length);
        if (total) expect(head[0]).toMatch(/^(Prudential|Manulife|Platform) — Total \(/);
        else for (const label of head) expect(labels).toContain(label);
        expect(members).toMatch(COUNT);
        expect(rungs).toMatch(RUNGS);
        expect(joined).toMatch(COUNT);
        expect(left).toMatch(COUNT);
        expect(in7).toMatch(SHARE);
        expect(in30).toMatch(SHARE);
      }
    });

    it('draws nothing it does not declare, even if a read were to carry a person', async () => {
      // A field the screen's shapes do not have cannot reach the page: a row of the table is drawn from
      // the declared figures alone.
      const leaky = {
        ...VIEW,
        offices: VIEW.offices.map((o) => ({ ...o, owner: { membershipId: 'mem-1', name: 'Rina Wijaya' } })),
      };
      await renderLoaded(leaky);
      expect(screen.queryByText(/Rina Wijaya/)).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain('mem-1');
    });

    it('links nowhere a person is: the only links in the table are offices', async () => {
      const { table } = await renderLoaded();
      const hrefs = within(table).getAllByRole('link').map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual(['/admin/tenants/kpm-0417', '/admin/tenants/kpm-0555', '/admin/tenants/kpm-0601']);
    });
  });

  describe('the console’s states', () => {
    it('loading: a skeleton of the same table, said once', () => {
      stubFetch({ '/admin/analytics': { body: VIEW } });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
      expect(screen.getByRole('status')).toHaveTextContent('Loading adoption by branch and company…');
      expect(screen.getByRole('heading', { level: 1, name: 'Cross-platform analytics' })).toBeInTheDocument();
    });

    it('empty: no offices on the platform says so, with no table and no zero totals', async () => {
      stubFetch({
        '/admin/analytics': { body: { offices: [], companies: [], platform: { ...adoption(), offices: 0, companies: 0 } } },
      });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
      expect(await screen.findByText('No branches on the platform yet.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('error: the envelope with its request id, and Try again reads once more', async () => {
      const { calls } = stubFetch({
        '/admin/analytics': [
          { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'req-9' } } },
          { body: VIEW },
        ],
      });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Something went wrong.');
      expect(alert).toHaveTextContent('req-9');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('table')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/admin/analytics'))).toHaveLength(2);
    });
  });

  describe('AC-1: the Super Admin’s alone', () => {
    it('the Super Admin holding the platform read sees the table', async () => {
      const { table } = await renderLoaded();
      expect(table).toBeInTheDocument();
    });

    it('a Super Admin without the platform read is refused, and asks the API for nothing', () => {
      const { calls } = stubFetch({ '/admin/analytics': { body: VIEW } });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] } });
      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'platform_analytics:read');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/admin/analytics'))).toEqual([]);
    });

    it.each([
      ['a KPM Owner', { isKpmOwner: true, isKpmAdmin: false, hierarchyRole: 'agent' as const }, ['kpm_overview:read', 'kpm_analytics:read']],
      ['a KPM Admin', { isKpmOwner: false, isKpmAdmin: true, hierarchyRole: 'agent' as const }, ['kpm_overview:read', 'kpm_analytics:read']],
      ['an AB', { isKpmOwner: false, isKpmAdmin: false, hierarchyRole: 'ab' as const }, ['activity_log:create_own']],
      ['an AAB', { isKpmOwner: false, isKpmAdmin: false, hierarchyRole: 'aab' as const }, ['activity_log:create_own']],
      ['an agent', { isKpmOwner: false, isKpmAdmin: false, hierarchyRole: 'agent' as const }, ['activity_log:create_own']],
    ])('%s never reaches the console: sent to their own landing, and nothing is asked of the API', (_who, membership, permissions) => {
      // It was refused at the console's gate; since 2026-10-11 the console's shell sends anybody but a Super
      // Admin to their own landing (`familyAllows`), before any gate is asked.
      const { calls } = stubFetch({ '/admin/analytics': { body: VIEW } });
      const base = makeMe({ permissions });
      const me = { ...base, membership: { ...base.membership!, ...membership } };
      router.replace.mockClear();
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me });
      expect(router.replace.mock.calls).toEqual([[landingFor(me)]]);
      expect(screen.queryByText('SUPERADMIN')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Cross-platform analytics' })).not.toBeInTheDocument();
      expect(calls.filter((c) => c.url.includes('/admin/analytics'))).toEqual([]);
    });
  });

  describe('the words', () => {
    it('reads an office’s state from its code or its word, as All KPMs writes it', () => {
      expect(officeState('active')).toEqual({ word: 'Active', tone: 'success' });
      expect(officeState('suspended')).toEqual({ word: 'Suspended', tone: 'alert' });
      expect(officeState('archived')).toEqual({ word: 'Archived', tone: 'neutral' });
      expect(officeState('ended')).toEqual({ word: 'Ended', tone: 'alert' });
      expect(officeState('ended_kept_active')).toEqual({ word: 'Ended — kept active', tone: 'watch' });
      expect(officeState('Ended — kept active')).toEqual({ word: 'Ended — kept active', tone: 'watch' });
      expect(officeState('Suspended')).toEqual({ word: 'Suspended', tone: 'alert' });
      // Something it does not know is printed as it came, and claims no state.
      expect(officeState('paused')).toEqual({ word: 'paused', tone: 'neutral' });
    });

    it('writes a share over nobody as no share at all', () => {
      expect(shareOf(4, 5)).toBe(80);
      expect(shareOf(0, 0)).toBeNull();
      expect(signedInWords(0, 0)).toBe('0');
      expect(signedInWords(1, 3)).toBe('1 (33%)');
      expect(rungWords([])).toBe('—');
    });

    it('keeps every row the read sent, even an office whose company it did not total', () => {
      const orphan = { ...VIEW.offices[0], kpmId: 'kpm-x', company: { id: 'co-x', name: 'Elsewhere' } };
      const rows = tableRows({ ...VIEW, offices: [...VIEW.offices, orphan] });
      expect(rows.map((r) => r.kind)).toEqual(['office', 'office', 'company', 'office', 'company', 'office', 'platform']);
    });

    it('the headings are the table’s', () => {
      expect(PLATFORM_ANALYTICS_HEADINGS).toHaveLength(10);
    });
  });

  describe('copy scan: the screen’s own strings', () => {
    const MINE = ['app/(admin)/admin/analytics/page.tsx', 'lib/admin-analytics.ts'];
    /** OD-39’s six words (D-copy), a gendered pronoun, a phase, or a permission code. */
    const FORBIDDEN = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned|\b(he|she|him|her|his|hers)\b|\bphase\b|\b[a-z_]+:[a-z_]+\b/i;

    const strings = (file: string): string[] => {
      const sf = parse(file, readFileSync(join(SRC, file), 'utf8'));
      const found: string[] = [];
      const visit = (node: ts.Node): void => {
        const text = renderable(node);
        // A literal with no space in it is a code, a path or a class list, not copy.
        if (text !== null && /\s/.test(text.trim())) found.push(text.replace(/\s+/g, ' ').trim());
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return found;
    };

    it('finds the strings, so a silent zero cannot pass', () => {
      expect(MINE.flatMap(strings)).toEqual(expect.arrayContaining([
        'Adoption across every company on AgencyBoost', 'No branches on the platform yet.',
      ]));
    });

    it('writes none of OD-39’s six words, no gendered pronoun, no phase and no permission code', () => {
      const offenders = MINE.flatMap((f) => strings(f).filter((s) => FORBIDDEN.test(s)).map((s) => `${f}: ${s}`));
      expect(offenders).toEqual([]);
    });
  });
});
