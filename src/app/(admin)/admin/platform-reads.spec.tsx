import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, routeParams, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { analyticsView } from '@test/kpm-analytics-fixtures';
import { englishOnly, englishShown } from '@test/english-left';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { complianceView } from '@test/kpm-compliance-fixtures';
import PlatformAnalyticsPage from './analytics/page';
import CompanyKpmsPage from './companies/[companyId]/kpms/page';
import AllMembersPage from './members/page';
import LookAsKpmPage from './tenants/[kpmId]/analytics/page';

const nav = vi.hoisted(() => ({ pathname: '/admin/members', search: '' }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: [
    'kpm:list_all', 'kpm:read_profile', 'company:crud', 'company_template:read', 'platform_analytics:read',
    'platform_members:read', 'platform_kpm_figures:read',
  ],
});

const ROW = {
  membershipId: 'm-1', fullName: 'Indah Permatasari', agentCode: '70045001',
  company: { id: 'co-1', name: 'Prudential' }, kpm: { id: 'kpm-1', code: '0417', branch: 'Bandung' },
  role: { code: 'AB', label: 'AB', isOwner: true, isAdmin: false }, leader: null, status: 'active',
  invitation: 'signed_in', joinedOn: '2024-03-01', lastActiveOn: '2026-11-03',
};
const NEVER = {
  ...ROW, membershipId: 'm-2', fullName: 'Bayu Saputra', role: { code: 'AGENT', label: 'Agent', isOwner: false, isAdmin: false },
  leader: { fullName: 'Agus Salim' }, status: 'removed', lastActiveOn: null,
};
const PAGE = { rows: [ROW, NEVER], page: 1, pageSize: 50, total: 2 };
const LISTS = {
  '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer' }, { _id: 'co-2', name: 'Manulife', kind: 'insurer' }] },
  '/admin/tenants': { body: [] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  nav.search = '';
});

describe('P19.4-T3 AC-1, AC-2 — All members (/admin/members)', () => {
  it.each([375, 1280])('P19.4-T3 AC-1 at %ipx: one row per membership — name, KPM, role with its badge, status, last active', async (px) => {
    atWidth(px);
    nav.pathname = '/admin/members';
    stubFetch({ ...LISTS, '/admin/members': { body: PAGE } });
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    // Cards below 1024px since P19.2-T2 AC-1 (a phone's alone before), the table from it.
    const list = px < 1024
      ? await screen.findByRole('list', { name: 'Every member on the platform' })
      : await screen.findByRole('table', { name: 'Every member on the platform' });
    expect(within(list).getByText('Indah Permatasari')).toBeInTheDocument();
    expect(within(list).getByText('Owner')).toBeInTheDocument();
    expect(within(list).getAllByRole('link', { name: 'Open KPM 0417' })[0]).toHaveAttribute('href', '/admin/tenants/kpm-1');
    expect(within(list).getByText('Never')).toBeInTheDocument();
    expect(within(list).getByText('Removed')).toBeInTheDocument();
    // View-only (OD-260 OQ2): no control that changes a person.
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('P19.4-T3 AC-1 *ABS* opens it filtered to AB, and a search goes to the server', async () => {
    nav.search = 'role=AB';
    const { calls } = stubFetch({ ...LISTS, '/admin/members': { body: PAGE } });
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    expect(calls.some((c) => c.url.includes('/admin/members?role=ab'))).toBe(true);
    await userEvent.type(screen.getByLabelText('Search by name, phone or email'), '0812 3450{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=0812+3450'))).toBe(true));
  });

  it('P19.4-T3 AC-1 empty: “No members yet. Members appear here once a KPM imports people.” — in Indonesian too', async () => {
    stubFetch({ ...LISTS, '/admin/members': { body: { rows: [], page: 1, pageSize: 50, total: 0 } } });
    renderInIndonesian(<AllMembersPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Belum ada anggota. Anggota muncul di sini setelah KPM mengimpor orang.')).toBeInTheDocument();
  });

  it('P19.4-T3 AC-1 the list has no accessibility violations', async () => {
    stubFetch({ ...LISTS, '/admin/members': { body: PAGE } });
    const { container } = renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    const results = await axe(container.ownerDocument.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

const COMPARISON = {
  rows: [{
    kpmId: 'kpm-1', code: '0417', branch: 'Bandung', company: { id: 'co-1', name: 'Prudential' }, members: 16,
    activeThisMonth: { count: 5, of: 16, pct: 31, month: '2026-11' }, activeUsers: { logged: 12, notLogged: 4, pct: 75 },
    coached: { d7: { count: 4, of: 16, pct: 25 }, d30: { count: 9, of: 16, pct: 56 } },
    production: { achievedMinor: 120_000_000_000, targetMinor: 240_000_000_000, pct: 50 }, recruitment: { pipeline: 7, target: 10 },
  }],
  page: 1, pageSize: 50, total: 1, sort: 'kpm',
};
const ADOPTION = { month: '2026-11', offices: [], companies: [], platform: null };

describe('P19.4-T3 AC-3, AC-13 — the KPM comparison on /admin/analytics', () => {
  it.each([375, 1280])('P19.4-T3 AC-3 at %ipx: one row per KPM, the Overview’s figures; a row opens its analytics read-only', async (px) => {
    atWidth(px);
    nav.pathname = '/admin/analytics';
    stubFetch({ ...LISTS, '/admin/analytics/kpms': { body: COMPARISON }, '/admin/analytics': { body: ADOPTION } });
    renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
    // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126): below 1024px the comparison is rows, the same figures and link on each.
    const row = px < 1024
      ? within(await screen.findByRole('list', { name: 'Each KPM’s own figures, as its Overview shows them' })).getAllByRole('listitem')[0]
      : within(await screen.findByRole('table', { name: 'Each KPM’s own figures, as its Overview shows them' })).getByRole('row', { name: /0417/ });
    expect(row).toHaveTextContent('5 / 16 · 31%');
    expect(row).toHaveTextContent('25% · 56%');
    expect(within(row).getByRole('link', { name: 'Open KPM 0417’s analytics, read-only' }))
      .toHaveAttribute('href', '/admin/tenants/kpm-1/analytics');
  });

  it('P19.4-T3 AC-3 sorts on the server by a column, and filters by company', async () => {
    const { calls } = stubFetch({ ...LISTS, '/admin/analytics/kpms': { body: COMPARISON }, '/admin/analytics': { body: ADOPTION } });
    renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table', { name: 'Each KPM’s own figures, as its Overview shows them' });
    await userEvent.click(screen.getByRole('button', { name: /Production this year/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/analytics/kpms?sort=production'))).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText('Company'), 'co-2');
    await waitFor(() => expect(calls.some((c) => c.url.includes('companyId=co-2'))).toBe(true));
  });

  it('P19.4-T3 AC-13 (SA UI-018) an empty platform reads “Belum ada KPM di platform.”, never cabang', async () => {
    stubFetch({
      ...LISTS, '/admin/analytics/kpms': { body: { ...COMPARISON, rows: [], total: 0 } }, '/admin/analytics': { body: ADOPTION },
    });
    renderInIndonesian(<PlatformAnalyticsPage />, { me: SUPER_ADMIN });
    expect((await screen.findAllByText('Belum ada KPM di platform.')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/cabang/)).not.toBeInTheDocument();
  });

  it('P19.4-T3 AC-16 a reader without the comparison’s grant is shown adoption alone, and nothing reads the figures', async () => {
    const { calls } = stubFetch({ ...LISTS, '/admin/analytics': { body: ADOPTION } });
    renderInLayout(AdminLayout, <PlatformAnalyticsPage />, {
      me: { ...SUPER_ADMIN, permissions: ['kpm:list_all', 'platform_analytics:read'] },
    });
    await screen.findByText('No KPMs on the platform yet.');
    expect(calls.some((c) => c.url.includes('/admin/analytics/kpms'))).toBe(false);
  });
});

describe('P19.4-T3 AC-4 — Lihat sebagai KPM (and P19.4-T2 AC-6)', () => {
  const KPM = {
    _id: 'kpm-1', companyId: 'co-1', companyName: 'Prudential', code: '0417', branchName: 'Bandung', status: 'active',
    timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', settings: {}, createdAt: '2026-01-01T00:00:00.000Z',
  };
  const params = routeParams({ kpmId: 'kpm-1' });

  it.each([375, 1280])('P19.4-T3 AC-4 at %ipx the navy banner, Keluar, and the Owner’s Overview read through the platform', async (px) => {
    atWidth(px);
    nav.pathname = '/admin/tenants/kpm-1/analytics';
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/analytics': { body: analyticsView() }, '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <LookAsKpmPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByText(/This visit is recorded in the Audit log\./)).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exit' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    await waitFor(() => expect(calls.some((c) => /\/admin\/tenants\/kpm-1\/analytics(\?|$)/.test(c.url))).toBe(true));
    expect(calls.some((c) => c.url.includes('/kpm/analytics'))).toBe(false);
    // No control that writes: no form field takes a value, nothing is saved.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save|simpan|override|tambah/i })).not.toBeInTheDocument();
  });

  it('P19.4-T3 AC-4 the Compliance tab reads the platform’s compliance, and its tab stays in the address', async () => {
    nav.search = 'tab=compliance';
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/analytics/compliance': { body: complianceView('training', null) },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <LookAsKpmPage params={params} />, { me: SUPER_ADMIN });
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/tenants/kpm-1/analytics/compliance'))).toBe(true));
    const tabs = screen.getByRole('navigation', { name: 'The KPM’s analytics tabs' });
    expect(within(tabs).getByRole('link', { name: 'Compliance' })).toHaveAttribute('aria-current', 'page');
    expect(calls.some((c) => c.url.includes('/kpm/analytics/compliance'))).toBe(false);
  });

  it('P19.4-T3 AC-4 in Indonesian: “Hanya lihat … Kunjungan ini tercatat di Audit log” and “Keluar”', async () => {
    stubFetch({ '/admin/tenants/kpm-1/analytics': { body: analyticsView() }, '/admin/tenants/kpm-1': { body: KPM } });
    renderInIndonesian(<LookAsKpmPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Hanya lihat')).toBeInTheDocument();
    expect(await screen.findByText(/Anda melihat KPM 0417 seperti pemiliknya\. .*Kunjungan ini tercatat di Audit log\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Keluar' })).toBeInTheDocument();
  });
});

describe('P19.4-T3 AC-15 — KPM & data', () => {
  const VIEW = {
    company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
    tiles: { kpms: 2, activeOwners: 1, members: 40, notSignedIn: 6, complete: 1, needed: 3 },
    rows: [
      {
        kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 30, maa: 12, apeYtdMinor: 150_000_000_000, recruitmentYtd: 9,
        data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
      },
      {
        kpmId: 'kpm-2', code: '0555', branch: 'Medan', manpower: 10, maa: null, apeYtdMinor: null, recruitmentYtd: null,
        data: 'missing', peers: { status: 'not_counted', count: 0, needed: 3 },
      },
    ],
  };
  const params = routeParams({ companyId: 'co-1' });

  it.each([375, 1280])('P19.4-T3 AC-15 at %ipx: three tiles, the company’s KPMs, the D4 peer status, no company upload', async (px) => {
    atWidth(px);
    nav.pathname = '/admin/companies/co-1/kpms';
    stubFetch({
      '/admin/companies/co-1/kpms': { body: VIEW },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
    });
    renderInLayout(AdminLayout, <CompanyKpmsPage params={params} />, { me: SUPER_ADMIN });
    // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126): below 1024px a row per KPM, the same peer status on each.
    const box = await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'All KPMs · Oct 2026' });
    const [bandung, medan] = px < 1024
      ? within(box).getAllByRole('listitem')
      : ['0417', '0555'].map((code) => within(box).getByRole('row', { name: new RegExp(code) }));
    expect(bandung).toHaveTextContent('Not enough peer KPMs (0 of 3)');
    expect(medan).toHaveTextContent('Not counted');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Comparing KPMs needs at least 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload|unggah/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'KPMs and data' })).toHaveAttribute('aria-current', 'page');
  });
});

/*
 * **The three new pages in ID mode** (P18.10-T7 AC-1): no English of this area left on any of them.
 */
describe('P19.4-T3 the Super Admin’s new pages in Indonesian', () => {
  const english = () => englishOnly(adminPlatformReadsMessages);

  it('P19.4-T3 AC-1 /admin/members in Indonesian', async () => {
    stubFetch({ ...LISTS, '/admin/members': { body: PAGE } });
    renderInIndonesian(<AllMembersPage />, { me: SUPER_ADMIN });
    await screen.findByText('Indah Permatasari');
    expect(englishShown(document.body, english())).toEqual([]);
  });

  it('P19.4-T3 AC-4 /admin/tenants/[kpmId]/analytics in Indonesian', async () => {
    stubFetch({
      '/admin/tenants/kpm-1/analytics': { body: analyticsView() },
      '/admin/tenants/kpm-1': { body: { _id: 'kpm-1', code: '0417', branchName: 'Bandung', companyName: 'Prudential', status: 'active' } },
    });
    renderInIndonesian(<LookAsKpmPage params={routeParams({ kpmId: 'kpm-1' })} />, { me: SUPER_ADMIN });
    await screen.findByText('Hanya lihat');
    expect(englishShown(document.body, english())).toEqual([]);
  });

  it('P19.4-T3 AC-15 /admin/companies/[companyId]/kpms in Indonesian', async () => {
    stubFetch({
      '/admin/companies/co-1/kpms': {
        body: {
          company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
          tiles: { kpms: 1, activeOwners: 1, members: 5, notSignedIn: 0, complete: 1, needed: 3 },
          rows: [{
            kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 5, maa: 2, apeYtdMinor: null, recruitmentYtd: null,
            data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
          }],
        },
      },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
    });
    renderInIndonesian(<CompanyKpmsPage params={routeParams({ companyId: 'co-1' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Belum cukup KPM pembanding (0 dari 3)')).toBeInTheDocument();
    expect(englishShown(document.body, english())).toEqual([]);
  });
});

/**
 * **P19.2-T2 — the comparison and *KPM & data* below 1024px** (UI-126, UI-134, UI-135): rows; the comparison's company and
 * sort as pills, sorting on the server as the headings do; the laptop keeps its tables and its select.
 */
describe('P19.2-T2 the comparison and KPM & data below 1024px (UI-126, UI-134, UI-135)', () => {
  const showComparison = () => {
    nav.pathname = '/admin/analytics';
    const stub = stubFetch({ ...LISTS, '/admin/analytics/kpms': { body: COMPARISON }, '/admin/analytics': { body: ADOPTION } });
    renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: SUPER_ADMIN });
    return stub;
  };
  const CAPTION = 'Each KPM’s own figures, as its Overview shows them';

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx a comparison row: code · branch opening its analytics, each figure after its column', async (px) => {
    atWidth(px);
    showComparison();
    const list = await screen.findByRole('list', { name: CAPTION });
    expect(screen.queryByRole('table', { name: CAPTION })).toBeNull();
    const [row] = within(list).getAllByRole('listitem');
    expect(wears(row, px)).toContain('min-h-14');
    expect(row).toHaveTextContent('0417 · Bandung');
    expect(row).toHaveTextContent('Prudential');
    expect(row).toHaveTextContent('Total members 16 · Active (this month) 5 / 16 · 31%');
    expect(row).toHaveTextContent('Active users (7 days) 75% · Coached 7 days · 30 days 25% · 56%');
    expect(row).toHaveTextContent('Production this year IDR 1.2B · 50% of IDR 2.4B');
    expect(row).toHaveTextContent('Pipeline (recruitment) 7 · of 10');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx the company and the sort are pills; each asks the server, as the select and the headings do', async (px) => {
    atWidth(px);
    const { calls } = showComparison();
    await screen.findByRole('list', { name: CAPTION });
    expect(document.querySelector('select')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Company: All companies' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose company' })).getByRole('radio', { name: 'Manulife' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('companyId=co-2'))).toBe(true));
    // Sorting: a column as its heading's first press, the same one again the other way.
    const sort = screen.getByRole('button', { name: 'Sort order: KPM ↑' });
    await userEvent.click(sort);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose sort order' })).getByRole('radio', { name: 'Production this year' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('sort=production'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Sort order: Production this year ↑' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose sort order' })).getByRole('radio', { name: 'Production this year ↑' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('sort=-production'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Sort order: Production this year ↓' })).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 AC-4 at %ipx keeps the comparison’s table and its select', async (px) => {
    atWidth(px);
    showComparison();
    const table = await screen.findByRole('table', { name: CAPTION });
    expect(table.className).not.toMatch(/min-w-\[/);
    expect(screen.getByLabelText('Company').tagName).toBe('SELECT');
    expect(screen.queryByRole('button', { name: /^Sort order/ })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in /admin/analytics’ main', async (px) => {
    atWidth(px);
    showComparison();
    await screen.findByRole('list', { name: CAPTION });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx the comparison has no axe violations', async (px) => {
    atWidth(px);
    showComparison();
    await screen.findByText(/0417/);
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  describe('KPM & data', () => {
    const VIEW = {
      company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
      tiles: { kpms: 1, activeOwners: 1, members: 30, notSignedIn: 6, complete: 1, needed: 3 },
      rows: [{
        kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 30, maa: 12, apeYtdMinor: 150_000_000_000, recruitmentYtd: 9,
        data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
      }],
    };
    const show = () => {
      nav.pathname = '/admin/companies/co-1/kpms';
      stubFetch({
        '/admin/companies/co-1/kpms': { body: VIEW },
        '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
      });
      renderInLayout(AdminLayout, <CompanyKpmsPage params={routeParams({ companyId: 'co-1' })} />, { me: SUPER_ADMIN });
    };

    it.each([375, 768])('P19.2-T2 AC-1 at %ipx a row per KPM: KPM 0417 opening it, the branch, the figures, the data status', async (px) => {
      atWidth(px);
      show();
      const list = await screen.findByRole('list', { name: 'All KPMs · Oct 2026' });
      expect(screen.queryByRole('table')).toBeNull();
      const [row] = within(list).getAllByRole('listitem');
      expect(within(row).getByRole('link', { name: 'KPM 0417' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
      expect(row).toHaveTextContent('Bandung');
      expect(row).toHaveTextContent('Manpower 30 · Active agents (MAA) 12');
      expect(row).toHaveTextContent('Recruitment YTD 9');
      expect(within(row).getByText('Complete')).toBeInTheDocument();
    });

    it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table at the content’s width', async (px) => {
      atWidth(px);
      show();
      const table = await screen.findByRole('table', { name: 'All KPMs · Oct 2026' });
      expect(table.className).not.toMatch(/min-w-\[/);
    });

    it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
      atWidth(px);
      show();
      await screen.findByRole('list', { name: 'All KPMs · Oct 2026' });
      expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
    });

    it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
      atWidth(px);
      show();
      await screen.findByText(/0417/);
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations).toEqual([]);
    });
  });
});

/**
 * **P19.2-T2 — All members below 1024px** (UI-126, UI-134, UI-135): the phone's cards on a tablet too, the four filters
 * as pills under the search — each asking the server as its select did — and 44px targets. A laptop keeps its table and
 * its selects.
 */
describe('P19.2-T2 All members below 1024px (UI-126, UI-134, UI-135)', () => {
  const show = () => {
    nav.pathname = '/admin/members';
    const stub = stubFetch({ ...LISTS, '/admin/members': { body: PAGE } });
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    return stub;
  };

  it.each([375, 768])('P19.2-T2 AC-1 AC-4 at %ipx cards and four pills, no table and no select; a pill filters on the server', async (px) => {
    atWidth(px);
    const { calls } = show();
    await screen.findByRole('list', { name: 'Every member on the platform' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
    // Each says *All* until it narrows the list, as its select's empty option did.
    for (const name of ['Company: All', 'KPM: All', 'Role: All', 'Status: All']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Role: All' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose role' })).getByRole('radio', { name: 'AB' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('role=ab'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Role: AB' })).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx keeps the table and the four selects', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('table', { name: 'Every member on the platform' });
    expect(document.querySelectorAll('select')).toHaveLength(4);
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Every member on the platform' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Indah Permatasari');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
