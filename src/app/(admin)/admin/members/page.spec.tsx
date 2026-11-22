import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { smallTargets } from '@test/touch-audit';
import { adminMembersMessages } from '@/i18n/messages/admin-members';
import AnggotaPage from './page';

const nav = vi.hoisted(() => ({ pathname: '/admin/members', search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const entered = vi.hoisted(() => vi.fn());
vi.mock('@/lib/super-admin-kpm', async (original) => ({
  ...(await original<typeof import('@/lib/super-admin-kpm')>()),
  enterKpm: entered,
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'platform_members:read', 'test_account:set', 'company:crud'],
});

const KPM = '66f0000000000000000001a1';
const WILSON = {
  membershipId: 'm-1', userId: 'u-1', fullName: 'Wilson Tanoto', avatarUrl: null, agentCode: '70045001',
  company: { id: 'co-1', name: 'Prudential' }, kpm: { id: KPM, code: '0417', branch: 'BSD City Branch' },
  role: { code: 'AB', label: 'Agency Builder', class: 'ab', isOwner: true, isAdmin: false }, leader: null, status: 'active',
  invitation: 'signed_in', joinedOn: '2024-03-01', lastActiveOn: '2026-11-20', lastActive: { days: 0, status: 'recent' },
  testAccount: false,
};
const RINA = {
  ...WILSON, membershipId: 'm-2', userId: 'u-2', fullName: 'Rina Kurnia',
  role: { code: 'AGENT', label: 'Agent', class: 'agent', isOwner: false, isAdmin: false }, leader: { fullName: 'Sari Puspita' },
  lastActiveOn: null, lastActive: { days: null, status: 'never' },
};
const PAGE = { rows: [WILSON, RINA], page: 1, pageSize: 50, total: 2, kpmCount: 1 };
const LISTS = {
  '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer' }, { _id: 'co-2', name: 'Sejahtera Baru Life', kind: 'insurer' }] },
  '/admin/tenants': { body: [{ _id: KPM, companyId: 'co-1', companyName: 'Prudential', code: '0417', branchName: 'BSD City Branch' }] },
};
const DETAIL = { ...WILSON, phone: '+6281211112222', email: 'wilson@contoh.test' };

afterEach(() => {
  vi.unstubAllGlobals();
  nav.search = '';
  nav.push.mockClear();
  entered.mockClear();
});

const show = (routes: Record<string, unknown> = {}) => {
  const stub = stubFetch({ ...LISTS, '/admin/members': { body: PAGE }, ...routes } as never);
  renderInLayout(AdminLayout, <AnggotaPage />, { me: SUPER_ADMIN });
  return stub;
};

describe('P19.23-T3 AC-1 — Anggota (/admin/members)', () => {
  it.each([1280, 1024])('P19.23-T3 AC-1 at %ipx: one row per member — photo, label and NAME, Owner, KPM by its name, company', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Members of every KPM' });
    const wilson = within(list).getByRole('button', { name: /Details of Wilson Tanoto/ });
    expect(wilson).toHaveTextContent('AB');
    expect(wilson).toHaveTextContent('Owner');
    expect(wilson).toHaveTextContent('BSD City Branch');
    expect(wilson).toHaveTextContent('Prudential');
    // The orange rung label is an AB's and an AAB's; an Agent has none.
    expect(wilson.querySelector('[data-rung-label]')).toHaveTextContent('AB');
    expect(within(list).getByRole('button', { name: /Rina Kurnia/ }).querySelector('[data-rung-label]')).toBeNull();
    // Never the KPM's code alone.
    expect(within(list).queryByText('0417')).toBeNull();
    expect(screen.getByText('2 members in 1 KPM · test accounts are not counted')).toBeInTheDocument();
  });

  it('P19.23-T3 AC-1 at 390px: cards, the column’s name above each value, the filters under the search (§12)', async () => {
    atWidth(390);
    show();
    const list = await screen.findByRole('list', { name: 'Members of every KPM' });
    const card = within(list).getByRole('button', { name: /Details of Wilson Tanoto/ });
    expect(card).toHaveTextContent(/KPMBSD City Branch/);
    expect(card).toHaveTextContent(/CompanyPrudential/);
    for (const name of ['All companies: All companies', 'Every KPM: Every KPM', 'All statuses: All statuses']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(smallTargets(document.querySelector('main')!, 390)).toEqual([]);
  });

  it('P19.23-T3 AC-1 searches name, phone or email on the server; the tabs are the class; Akun tes lists the test accounts', async () => {
    atWidth(1280);
    const { calls } = show();
    await screen.findByRole('list', { name: 'Members of every KPM' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search name, phone, email' }), '0812 1111{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=0812+1111'))).toBe(true));
    await userEvent.click(screen.getByRole('tab', { name: 'AAB' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('role=aab'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'All statuses: All statuses' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: 'Test accounts' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('testAccount=only'))).toBe(true));
    expect(calls.some((c) => c.url.includes('status=test'))).toBe(false);
  });

  it('P19.23-T3 AC-1 a KPM filter names each KPM with its company, never its code alone', async () => {
    atWidth(1280);
    show();
    await screen.findByRole('list', { name: 'Members of every KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Every KPM: Every KPM' }));
    expect(within(await screen.findByRole('dialog')).getByRole('radio', { name: 'BSD City Branch · Prudential' })).toBeInTheDocument();
  });

  it('P19.23-T3 AC-1 tapping a row opens the detail: phone, email, joined, last used, status, upline, WhatsApp, Buka di KPM', async () => {
    atWidth(1280);
    show({ '/admin/members/m-1': { body: DETAIL } });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Wilson Tanoto/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    expect(await within(sheet).findByText('+6281211112222')).toBeInTheDocument();
    expect(within(sheet).getByText('wilson@contoh.test')).toBeInTheDocument();
    expect(within(sheet).getByText('Mar 2024')).toBeInTheDocument();
    expect(within(sheet).getByText('Today')).toBeInTheDocument();
    expect(within(sheet).getByText('Active')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281211112222');
    expect(within(sheet).getByText(/inside their KPM/)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Open in KPM' }));
    expect(entered).toHaveBeenCalledWith(KPM);
    expect(nav.push).toHaveBeenCalledWith('/people/members/m-1');
  });

  it('P19.23-T3 AC-1 the detail with no number offers no WhatsApp link, and an upline in capitals', async () => {
    atWidth(1280);
    show({ '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } } });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    expect(await within(sheet).findByText('No number yet')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'WhatsApp' })).toBeDisabled();
    expect(within(sheet).getByText('Never')).toBeInTheDocument();
    expect(within(sheet).getByText('Sari Puspita')).toHaveClass('uppercase');
  });

  it('P19.23-T3 AC-1 the Akun tes switch flags the account, says so, and the list is read again', async () => {
    atWidth(1280);
    const { calls } = show({
      '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } },
      'PATCH /admin/users/u-2/test-account': { body: { userId: 'u-2', testAccount: true, memberships: 1 } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    const reads = calls.filter((c) => c.url.includes('/admin/members?')).length;
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Test account' }));
    const sent = calls.find((c) => c.url.endsWith('/admin/users/u-2/test-account'));
    expect(sent?.init.method).toBe('PATCH');
    expect(JSON.parse(String(sent?.init.body))).toEqual({ testAccount: true });
    expect(await screen.findByText('Rina Kurnia is now a test account.')).toBeInTheDocument();
    expect(within(sheet).getByRole('switch', { name: 'Test account' })).toBeChecked();
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/admin/members?')).length).toBeGreaterThan(reads));
  });

  it('P19.23-T3 AC-1 a refused switch says why, and stays as it was', async () => {
    atWidth(1280);
    show({
      '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } },
      'PATCH /admin/users/u-2/test-account': {
        status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission to perform this action.' } },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Test account' }));
    expect(await within(sheet).findByText('You do not have permission to perform this action.')).toBeInTheDocument();
    expect(within(sheet).getByRole('switch', { name: 'Test account' })).not.toBeChecked();
  });

  it('P19.23-T3 AC-1 empty, no match, and a refusal with Try again', async () => {
    atWidth(1280);
    stubFetch({ ...LISTS, '/admin/members': { body: { rows: [], page: 1, pageSize: 50, total: 0, kpmCount: 0 } } });
    renderInLayout(AdminLayout, <AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('No member in any KPM yet.')).toBeInTheDocument();
    vi.unstubAllGlobals();

    nav.search = 'q=zzz';
    stubFetch({ ...LISTS, '/admin/members': { body: { rows: [], page: 1, pageSize: 50, total: 0, kpmCount: 0 } } });
    renderInLayout(AdminLayout, <AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('No member matches.')).toBeInTheDocument();
    vi.unstubAllGlobals();

    nav.search = '';
    stubFetch({
      ...LISTS,
      '/admin/members': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
        { body: PAGE },
      ],
    });
    renderInLayout(AdminLayout, <AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    expect((await screen.findAllByRole('button', { name: /Details of Wilson Tanoto/ })).length).toBeGreaterThan(0);
  });

  it('P19.23-T3 AC-1 Akun terdaftar and KPM Owners & Admins (Kelola data produk) stay one link away (ADR-0245, ADR-0260)', async () => {
    atWidth(1280);
    show();
    await screen.findByRole('list', { name: 'Members of every KPM' });
    expect(screen.getByRole('link', { name: 'Registered accounts, with or without a KPM' }))
      .toHaveAttribute('href', '/admin/members?tab=accounts');
    expect(screen.getByRole('link', { name: 'Owner & admin · Manage product data' })).toHaveAttribute('href', '/admin/tenant-admins');
  });

  it.each([390, 1280])('P19.23-T3 AC-1 at %ipx the list and the open detail have no axe violations', async (px) => {
    atWidth(px);
    show({ '/admin/members/m-1': { body: DETAIL } });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Wilson Tanoto/ }));
    await screen.findByText('wilson@contoh.test');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('P19.23-T3 AC-1 in Indonesian: the mockup’s words, and no English left', async () => {
    atWidth(1280);
    stubFetch({ ...LISTS, '/admin/members': { body: PAGE }, '/admin/members/m-1': { body: DETAIL } });
    renderInIndonesian(<AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('searchbox', { name: 'Cari nama, telepon, email' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Semua' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('2 anggota di 1 KPM · akun tes tidak dihitung')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Detail Wilson Tanoto/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Detail anggota' });
    for (const label of ['Telepon', 'Email', 'Bergabung', 'Terakhir pakai', 'Status', 'Upline']) {
      expect(within(sheet).getByText(label)).toBeInTheDocument();
    }
    expect(within(sheet).getByRole('button', { name: 'Buka di KPM' })).toBeInTheDocument();
    expect(within(sheet).getByText('Ubah peran, leader, atau keluarkan: dari All members di dalam KPM-nya')).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(adminMembersMessages))).toEqual([]);
  });
});
