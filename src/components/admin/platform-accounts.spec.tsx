import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import AllMembersPage from '@/app/(admin)/admin/members/page';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';

const nav = vi.hoisted(() => ({ pathname: '/admin/members', search: 'tab=accounts' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'company:crud', 'platform_members:read', 'platform_kpm_figures:read'],
});

/** The client's case (PZ-2): a leader who registered, signed in, and joined no KPM. */
const HADI = {
  userId: 'u-hadi', fullName: 'Hadi Santoso', email: 'hadi.leader@contoh.test', company: { id: 'co-1', name: 'Prudential' },
  registeredOn: '2026-11-09', emailVerified: true, lastSignInOn: '2026-11-10', kpmCount: 0,
};
/** Registered today, unverified, never signed in. */
const CITRA = {
  ...HADI, userId: 'u-citra', fullName: 'Citra Lestari', email: 'citra@contoh.test', company: null,
  registeredOn: '2026-11-11', emailVerified: false, lastSignInOn: null,
};
/** In two KPMs. */
const DUA = { ...HADI, userId: 'u-dua', fullName: 'Dua Kantor', email: 'dua+kantor@kpm0417.test', kpmCount: 2 };
const PAGE = { rows: [CITRA, HADI, DUA], page: 1, pageSize: 50, total: 3 };
const EMPTY = { rows: [], page: 1, pageSize: 50, total: 0 };

const show = (reply: Parameters<typeof stubFetch>[0][string] = { body: PAGE }, me = SUPER_ADMIN) => {
  const stub = stubFetch({ '/admin/users': reply, '/admin/companies': { body: [] }, '/admin/tenants': { body: [] } });
  const view = renderInLayout(AdminLayout, <AllMembersPage />, { me });
  return { ...stub, ...view };
};

afterEach(() => {
  vi.unstubAllGlobals();
  nav.pathname = '/admin/members';
  nav.search = 'tab=accounts';
});

describe('P19.12-T2 AC-2 All members › Akun terdaftar (ADR-0245 §1)', () => {
  it('P19.12-T2 AC-2 the page has two tabs in the address; Registered accounts reads every account', async () => {
    atWidth(1280);
    const { calls } = show();
    const tabs = await screen.findByRole('navigation', { name: 'All members' });
    expect(within(tabs).getByRole('link', { name: 'KPM members' })).toHaveAttribute('href', '/admin/members');
    const accounts = within(tabs).getByRole('link', { name: 'Registered accounts' });
    expect(accounts).toHaveAttribute('href', '/admin/members?tab=accounts');
    expect(accounts).toHaveAttribute('aria-current', 'page');
    await screen.findByRole('table', { name: 'Every registered account' });
    expect(calls.map((c) => c.url).filter((u) => u.includes('/admin/'))).toEqual([expect.stringMatching(/\/admin\/users\?$/)]);
  });

  it('P19.12-T2 AC-2 KPM members stays the default tab, and reads the memberships as before', async () => {
    atWidth(1280);
    nav.search = '';
    const stub = stubFetch({
      '/admin/members': { body: EMPTY }, '/admin/users': { body: PAGE },
      '/admin/companies': { body: [] }, '/admin/tenants': { body: [] },
    });
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'KPM members' })).toHaveAttribute('aria-current', 'page');
    await screen.findByText('No members yet. Members appear here once a KPM imports people.');
    expect(stub.calls.some((c) => c.url.includes('/admin/users'))).toBe(false);
  });

  it('P19.12-T2 AC-2 at 1280px a row: name and email, company, registered, verified, last sign-in, and its KPMs', async () => {
    atWidth(1280);
    show();
    const table = await screen.findByRole('table', { name: 'Every registered account' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name', 'Company', 'Registered', 'Email', 'Last signed in', 'KPM',
    ]);
    const [citra, hadi, dua] = within(table).getAllByRole('row').slice(1);
    expect(within(hadi).getByText('Hadi Santoso')).toBeInTheDocument();
    expect(within(hadi).getByText('hadi.leader@contoh.test')).toHaveClass('text-muted');
    expect(within(hadi).getByText('Prudential')).toBeInTheDocument();
    expect(within(hadi).getByText('Verified')).toBeInTheDocument();
    expect(within(hadi).getByText('No KPM yet')).toBeInTheDocument();
    expect(within(citra).getByText('Not verified')).toBeInTheDocument();
    expect(within(citra).getByText('Never')).toBeInTheDocument();
    expect(within(citra).getByText('—')).toBeInTheDocument();
    // *n KPM* opens the *KPM members* tab searched for the account's email; nothing changes a person.
    const link = within(dua).getByRole('link', { name: '2 KPM · Dua Kantor, in KPM members' });
    expect(link).toHaveTextContent('2 KPM');
    expect(link).toHaveAttribute('href', `/admin/members?q=${encodeURIComponent('dua+kantor@kpm0417.test')}`);
    expect(within(table).queryByRole('button')).toBeNull();
    expect(screen.getByText('3 accounts')).toBeInTheDocument();
  });

  it('P19.12-T2 AC-2 a search and the KPM filter go to the server', async () => {
    atWidth(1280);
    const { calls } = show();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('Search by name or email'), 'hadi.leader@{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/users?q=hadi.leader%40'))).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText('KPM'), 'none');
    await waitFor(() => expect(calls.some((c) => c.url.includes('kpm=none'))).toBe(true));
    expect([...screen.getByLabelText<HTMLSelectElement>('KPM').options].map((o) => o.text)).toEqual(['All', 'No KPM', 'Has a KPM']);
  });

  it('P19.12-T2 AC-2 the address’s search and filter start the tab: a link from KPM members lands searched', async () => {
    atWidth(1280);
    nav.search = 'tab=accounts&q=hadi&kpm=none';
    const { calls } = show();
    await screen.findByRole('table');
    expect(calls.some((c) => c.url.includes('/admin/users?q=hadi&kpm=none'))).toBe(true);
    expect(screen.getByLabelText('Search by name or email')).toHaveValue('hadi');
  });

  it.each([375, 768])('P19.12-T2 AC-2 at %ipx row cards and a KPM pill, no table and no select; no target under 44px', async (px) => {
    atWidth(px);
    const { calls } = show();
    const list = await screen.findByRole('list', { name: 'Every registered account' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
    expect(within(list).getByText('hadi.leader@contoh.test')).toBeInTheDocument();
    expect(within(list).getAllByText('No KPM yet')).toHaveLength(2);
    expect(within(list).getByRole('link', { name: '2 KPM · Dua Kantor, in KPM members' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'KPM: All' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: /^Choose kpm$/i })).getByRole('radio', { name: 'No KPM' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('kpm=none'))).toBe(true));
    expect(screen.getByRole('button', { name: 'KPM: No KPM' })).toBeInTheDocument();
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it('P19.12-T2 AC-2 while it loads: a skeleton shaped like the list', async () => {
    atWidth(1280);
    stubFetch({ '/admin/users': () => new Promise(() => undefined) as never });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => /Loading the accounts/.test(s.textContent ?? ''))).toBe(true));
    expect(screen.queryByRole('table', { name: 'Every registered account' })).toBeNull();
  });

  it('P19.12-T2 AC-2 empty: No accounts yet; filtered: no account matches', async () => {
    atWidth(1280);
    show({ body: EMPTY });
    expect(await screen.findByText('No accounts yet.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    nav.search = 'tab=accounts&kpm=some';
    document.body.innerHTML = '';
    show({ body: EMPTY });
    expect(await screen.findByText('No account matches these filters.')).toBeInTheDocument();
  });

  it('P19.12-T2 AC-2 a refusal is said in the server’s words, and Try again asks again', async () => {
    atWidth(1280);
    const { calls } = show([
      { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Type at least two characters of a name or an email address.', requestId: 'r' } } },
      { body: PAGE },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Type at least two characters of a name or an email address.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('table', { name: 'Every registered account' });
    expect(calls.filter((c) => c.url.includes('/admin/users'))).toHaveLength(2);
  });

  it('P19.12-T2 AC-1 a reader without the grant is shown nothing of it, and nothing is read', async () => {
    atWidth(1280);
    const { calls } = show({ body: PAGE }, makeMe());
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(calls.some((c) => c.url.includes('/admin/users'))).toBe(false);
  });

  it('P19.12-T2 AC-2 a KPM members search that finds nobody offers the same search in Registered accounts', async () => {
    atWidth(1280);
    nav.search = 'q=hadi.leader%40contoh.test';
    stubFetch({ '/admin/members': { body: EMPTY }, '/admin/companies': { body: [] }, '/admin/tenants': { body: [] } });
    renderInLayout(AdminLayout, <AllMembersPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('No member matches these filters.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search in Registered accounts' }))
      .toHaveAttribute('href', `/admin/members?tab=accounts&q=${encodeURIComponent('hadi.leader@contoh.test')}`);
  });

  it('P19.12-T2 AC-2 in Indonesian: Akun terdaftar, Tanpa KPM, Belum punya KPM, Terverifikasi — no English left', async () => {
    atWidth(1280);
    stubFetch({ '/admin/users': { body: PAGE } });
    renderInIndonesian(<AllMembersPage />, { me: SUPER_ADMIN });
    const table = await screen.findByRole('table', { name: 'Semua akun terdaftar' });
    expect(screen.getByRole('link', { name: 'Akun terdaftar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Anggota KPM' })).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Nama', 'Perusahaan', 'Terdaftar', 'Email', 'Terakhir masuk', 'KPM',
    ]);
    expect(within(table).getAllByText('Belum punya KPM')).toHaveLength(2);
    expect(within(table).getAllByText('Terverifikasi')).toHaveLength(2);
    expect(within(table).getByText('Belum diverifikasi')).toBeInTheDocument();
    expect(within(table).getByText('Belum pernah')).toBeInTheDocument();
    expect([...screen.getByLabelText<HTMLSelectElement>('KPM').options].map((o) => o.text)).toEqual(['Semua', 'Tanpa KPM', 'Punya KPM']);
    expect(englishShown(document.body, englishOnly(adminPlatformReadsMessages))).toEqual([]);
  });

  it.each([375, 1280])('P19.12-T2 AC-2 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Hadi Santoso');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
