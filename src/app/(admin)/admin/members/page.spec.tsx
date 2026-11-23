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

  /*
   * *Changed 2026-11-22 (P19.28-T3 AC-1, AC-2; UI-208 (21 Nov)):* below 768px a 60px row — photo · label + NAME · *KPM ·
   * company* · › — and one row of search and *Filter*, no *Cari*; the role tabs in the Filter sheet.
   */
  it('P19.28-T3 AC-1, AC-2 at 390px: 60px rows with KPM · company, one row of search and Filter, no Cari', async () => {
    atWidth(390);
    show();
    const list = await screen.findByRole('list', { name: 'Members of every KPM' });
    const row = within(list).getByRole('button', { name: /Details of Wilson Tanoto/ });
    expect(row).toHaveClass('min-h-[60px]');
    expect(row).toHaveTextContent('BSD City Branch · Prudential');
    expect(row).toHaveTextContent('Owner');
    // The role tabs are the filter sheet's on a phone: no room left where they stood — the list one gap under the chips and
    // the switch (the integration round's walk, 2026-11-22: about 30px of nothing).
    const panel = list.closest('[role="tabpanel"]') as HTMLElement;
    expect(panel).toHaveClass('mt-3.5', 'max-md:mt-0');
    expect(panel.firstElementChild).toHaveClass('max-md:pt-0');
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    for (const label of ['Company', 'Role']) expect(within(sheet).getAllByText(label).length).toBeGreaterThan(0);
    expect(within(sheet).getByRole('button', { name: 'AAB' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(smallTargets(document.querySelector('main')!, 390)).toEqual([]);
  });

  it('P19.28-T3 AC-4 searches name, phone or email on the server; the tabs are the class; Tampilkan akun tes is a switch', async () => {
    atWidth(1280);
    const { calls } = show();
    await screen.findByRole('list', { name: 'Members of every KPM' });
    // *Aktif* is the chip a page opens on (UI-209).
    expect(calls.some((c) => c.url.includes('/admin/members?status=active'))).toBe(true);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search name, phone, email' }), '0812 1111{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=0812+1111'))).toBe(true));
    await userEvent.click(screen.getByRole('tab', { name: 'AAB' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('role=aab'))).toBe(true));
    // *Semua status* and its *Akun tes* are gone (OD-421 superseded): the switch lists them beside the others.
    expect(screen.queryByRole('button', { name: 'All statuses: All statuses' })).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Show test accounts' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('testAccount=include'))).toBe(true));
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

  it('P19.28-T4 AC-2 the detail with no number: WhatsApp opens Isi nomor WhatsApp, saved as the KPM’s Owner; an upline in capitals', async () => {
    atWidth(1280);
    const opened = { location: { href: '' }, opener: {}, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    const { calls } = show({
      '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } },
      'PUT /members/m-2/phone': { body: { membershipId: 'm-2', phone: '+6281299998888' } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    expect(await within(sheet).findByText('No number yet')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'WhatsApp' })).toBeNull();
    expect(within(sheet).getByText('Never')).toBeInTheDocument();
    expect(within(sheet).getByText('Sari Puspita')).toHaveClass('uppercase');
    await userEvent.click(within(sheet).getByRole('button', { name: 'WhatsApp' }));
    const ask = await screen.findByRole('dialog', { name: /WhatsApp/ });
    await userEvent.type(within(ask).getByRole('textbox'), '0812 9999 8888');
    await userEvent.click(within(ask).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/members/m-2/phone'))).toBe(true));
    const put = calls.find((c) => c.url.endsWith('/members/m-2/phone'))!;
    // Through the member's KPM, as its Owner, for this call alone (ADR-0268 §3).
    expect((put.init.headers as Record<string, string>)['X-Kpm-Id']).toBe(KPM);
    expect(entered).not.toHaveBeenCalled();
  });

  it('P19.28-T4 AC-1 Akun tes is behind ⋯ with a confirmation: it flags the account, says so, and the list is read again', async () => {
    atWidth(1280);
    const { calls } = show({
      '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } },
      'PATCH /admin/users/u-2/test-account': { body: { userId: 'u-2', testAccount: true, memberships: 1 } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Member details' });
    const reads = calls.filter((c) => c.url.includes('/admin/members?')).length;
    expect(within(sheet).queryByRole('switch')).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'More for Rina Kurnia' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mark as test account' }));
    const confirm = await screen.findByRole('dialog', { name: 'Make Rina Kurnia a test account?' });
    expect(calls.some((c) => c.url.endsWith('/admin/users/u-2/test-account'))).toBe(false);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Yes, test account' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/users/u-2/test-account'))).toBe(true));
    const sent = calls.find((c) => c.url.endsWith('/admin/users/u-2/test-account'));
    expect(sent?.init.method).toBe('PATCH');
    expect(JSON.parse(String(sent?.init.body))).toEqual({ testAccount: true });
    expect(await screen.findByText('Rina Kurnia is now a test account.')).toBeInTheDocument();
    expect(within(sheet).getByText('Test account')).toBeInTheDocument();
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
    await userEvent.click(within(sheet).getByRole('button', { name: 'More for Rina Kurnia' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mark as test account' }));
    const confirm = await screen.findByRole('dialog', { name: 'Make Rina Kurnia a test account?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Yes, test account' }));
    expect(await within(confirm).findByText('You do not have permission to perform this action.')).toBeInTheDocument();
    expect(within(sheet).queryByText('Test account')).toBeNull();
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

  it('P19.26-T1 AC-2 the footer counts the counted members, whatever the rows list (ADR-0284 §1)', async () => {
    atWidth(1280);
    // Two rows listed, one of them pending; the server counts one counted member in one KPM.
    stubFetch({ ...LISTS, '/admin/members': { body: { ...PAGE, counted: { members: 1, kpms: 1 } } } });
    renderInIndonesian(<AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('1 anggota di 1 KPM · akun tes tidak dihitung')).toBeInTheDocument();
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

/*
 * P19.28-T3 (UI-208, UI-209, UI-213 (21 Nov); ADR-0286): the chips, *Menunggu*'s two kinds of row and their actions,
 * *Keluar*'s month, and the floating *＋ Tambah user*.
 */
describe('P19.28-T3 — Anggota’s chips and pills', () => {
  const CHIPS = { active: 50, pending: 2, removed: 3 };
  const RINA_INVITED = {
    kind: 'invited', invitationId: 'inv-1', userId: null, membershipId: null, fullName: 'Rina Kartika', avatarUrl: null,
    email: null, company: { id: 'co-1', name: 'Prudential' }, kpm: { id: KPM, code: '0602', branch: 'Bekasi Barat Branch' },
    role: { code: 'AGENT', label: 'Agent', class: 'agent' }, since: '2026-11-20', expired: false, testAccount: false,
  };
  const FAJAR = {
    kind: 'unplaced', invitationId: null, userId: 'u-fajar', membershipId: 'm-fajar', fullName: 'Fajar Nugroho', avatarUrl: null,
    email: 'untagged@kpm0417.test', company: { id: 'co-1', name: 'Prudential' }, kpm: { id: KPM, code: '0417', branch: 'BSD City Branch' },
    role: null, since: '2026-11-01', expired: false, testAccount: false,
  };
  const WAITING = { rows: [FAJAR, RINA_INVITED], page: 1, pageSize: 50, total: 2, chips: CHIPS };

  it.each([390, 1280])('P19.28-T3 AC-4 at %ipx: Aktif n · Menunggu n · Keluar n, Aktif first and chosen', async (px) => {
    atWidth(px);
    show({ '/admin/members': { body: { ...PAGE, chips: CHIPS } } });
    const chips = await screen.findByRole('radiogroup', { name: 'Status' });
    await waitFor(() => expect(within(chips).getByRole('radio', { name: 'Active 50' })).toHaveAttribute('aria-checked', 'true'));
    expect(within(chips).getByRole('radio', { name: 'Waiting 2' })).toBeInTheDocument();
    expect(within(chips).getByRole('radio', { name: 'Left 3' })).toBeInTheDocument();
  });

  it('P19.28-T3 AC-5 Menunggu: Diundang · <date> with ⋯ Kirim ulang · Batalkan, Belum ada KPM with Masukkan', async () => {
    atWidth(390);
    const opened = { location: { href: '' }, opener: {}, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    const { calls } = show({
      '/admin/members': { body: { ...PAGE, chips: CHIPS } },
      '/admin/waiting-members': { body: WAITING },
      'POST /user-invitations/inv-1/resend': { body: {
        invitation: { id: 'inv-1', kpmId: KPM, fullName: 'Rina Kartika', phone: '+6281277884410', email: null,
          role: { code: 'AGENT', class: 'agent' }, leaderMembershipId: 'm-9', makeOwner: false, state: 'pending',
          invitedAt: '2026-11-22T03:00:00.000Z', expiresAt: '2026-12-06T03:00:00.000Z' },
        link: 'https://app.test/user-invite/k.s',
      } },
      'DELETE /user-invitations/inv-1': { body: { invitation: { id: 'inv-1', state: 'cancelled' } } },
    });
    await userEvent.click(await screen.findByRole('radio', { name: /Waiting/ }));
    const list = await screen.findByRole('list', { name: 'Waiting' });
    expect(within(list).getByText('Invited · 20 Nov')).toBeInTheDocument();
    expect(within(list).getByText('No KPM yet')).toBeInTheDocument();
    expect(within(list).getByText('untagged@kpm0417.test')).toBeInTheDocument();
    expect(within(list).getByText('Bekasi Barat Branch · Prudential')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/waiting-members'))).toBe(true);

    await userEvent.click(within(list).getByRole('button', { name: 'Invitation of Rina Kartika' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Send again' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/user-invitations/inv-1/resend'))).toBe(true));
    expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/6281277884410\?text=/);
    expect(decodeURIComponent(opened.location.href)).toContain('https://app.test/user-invite/k.s');

    await userEvent.click(within(list).getByRole('button', { name: 'Invitation of Rina Kartika' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancel' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/user-invitations/inv-1') && c.init.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('Rina Kartika’s invitation cancelled.'.replace('’', "'"))).toBeInTheDocument();
  });

  /*
   * **P19.31-T2 (ADR-0289): *Hapus akun*** — the Super Admin's alone (`account:retire`): in red, last in the member
   * sheet's ⋯; and for an account in no KPM, a ⋯ beside *Masukkan* (OD-487). Done, the sheet closes, the toast names
   * them, and the lists are read again.
   */
  describe('P19.31-T2 Hapus akun', () => {
    const RETIRER = makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'account:retire'] });
    const PREVIEW_RINA = {
      userId: 'u-2', fullName: 'Rina Kurnia', email: 'rina@contoh.test', kpmsWithHistory: 1, refusal: null,
      membership: { membershipId: 'm-2', kpmId: KPM, kpmName: 'BSD City Branch', kpmCode: '0417', status: 'active' },
    };
    const showAs = (me: typeof SUPER_ADMIN, routes: Record<string, unknown> = {}) => {
      const stub = stubFetch({ ...LISTS, '/admin/members': { body: { ...PAGE, chips: CHIPS } }, ...routes } as never);
      renderInLayout(AdminLayout, <AnggotaPage />, { me });
      return stub;
    };

    it('P19.31-T2 AC-1, AC-3 the sheet’s ⋯ holds Hapus akun in red, last; done, the toast names them and the list is read again', async () => {
      atWidth(1280);
      const { calls } = showAs(RETIRER, {
        '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } },
        'GET /admin/accounts/u-2/retirement': { body: PREVIEW_RINA },
        'POST /admin/accounts/u-2/retirement': { body: { userId: 'u-2', fullName: 'Rina Kurnia', retiredAt: '2026-11-23T03:00:00.000Z', membershipEnded: { membershipId: 'm-2', kpmId: KPM }, invitationsCancelled: 0 } },
      });
      await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Member details' });
      await userEvent.click(within(sheet).getByRole('button', { name: 'More for Rina Kurnia' }));
      const items = await screen.findAllByRole('menuitem');
      expect(items.map((i) => i.textContent)).toEqual(['Mark as test account', 'Delete account']);
      expect(items[1]).toHaveClass('text-alert');
      const reads = calls.filter((c) => c.url.includes('/admin/members?')).length;
      await userEvent.click(items[1]);
      const confirm = await screen.findByRole('dialog', { name: 'Delete account' });
      await within(confirm).findByRole('region', { name: 'What ends' });
      await userEvent.type(within(confirm).getByLabelText('Reason'), 'Dibuat ulang.');
      await userEvent.type(within(confirm).getByLabelText('Type “Rina Kurnia” to confirm'), 'Rina Kurnia');
      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete account' }));
      expect(await screen.findByText('Account RINA KURNIA deleted.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Member details' })).toBeNull();
      await waitFor(() => expect(calls.filter((c) => c.url.includes('/admin/members?')).length).toBeGreaterThan(reads));
    });

    it('P19.31-T2 AC-1 without account:retire the ⋯ holds Akun tes alone', async () => {
      atWidth(1280);
      showAs(SUPER_ADMIN, { '/admin/members/m-2': { body: { ...RINA, phone: null, email: 'rina@contoh.test' } } });
      await userEvent.click(await screen.findByRole('button', { name: /Details of Rina Kurnia/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Member details' });
      await userEvent.click(within(sheet).getByRole('button', { name: 'More for Rina Kurnia' }));
      expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual(['Mark as test account']);
    });

    it('P19.31-T2 an account in no KPM: a ⋯ beside Masukkan holds Hapus akun (OD-487), in Indonesian', async () => {
      atWidth(390);
      stubFetch({
        ...LISTS, '/admin/members': { body: { ...PAGE, chips: CHIPS } }, '/admin/waiting-members': { body: WAITING },
        'GET /admin/accounts/u-fajar/retirement': { body: { ...PREVIEW_RINA, userId: 'u-fajar', fullName: 'Fajar Nugroho', email: 'untagged@kpm0417.test', membership: null, kpmsWithHistory: 0 } },
      } as never);
      renderInIndonesian(<AnggotaPage />, { me: RETIRER });
      await userEvent.click(await screen.findByRole('radio', { name: /Menunggu/ }));
      const list = await screen.findByRole('list', { name: 'Menunggu' });
      await userEvent.click(within(list).getByRole('button', { name: 'Lainnya untuk Fajar Nugroho' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Hapus akun' }));
      const confirm = await screen.findByRole('dialog', { name: 'Hapus akun' });
      expect(await within(confirm).findByRole('region', { name: 'Yang tetap' })).toHaveTextContent('Tidak ada yang lain');
      // The invited row (no account) has no such ⋯.
      expect(within(list).queryByRole('button', { name: 'Lainnya untuk Rina Kartika' })).toBeNull();
    });
  });

  it('P19.28-T2 AC-5 Masukkan opens the sheet as Masukkan ke KPM — NAME and email, the KPM it registered to prefilled', async () => {
    atWidth(390);
    show({
      '/admin/members': { body: { ...PAGE, chips: CHIPS } },
      '/admin/waiting-members': { body: WAITING },
      '/user-invitations/options': { body: {
        kpm: { id: KPM, code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' } },
        company: { id: 'co-1', name: 'Prudential' },
        roles: [{ code: 'AGENT', label: 'Agent', class: 'agent' }, { code: 'AAB', label: 'AAB', class: 'aab' }, { code: 'AB', label: 'AB', class: 'ab' }],
        seniorCode: 'AB', leaders: [], mayMakeOwner: true, mayMakeKpm: true,
      } },
    });
    await userEvent.click(await screen.findByRole('radio', { name: /Waiting/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Fajar Nugroho to a KPM' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add to a KPM' });
    expect(within(sheet).getByText('Fajar Nugroho')).toHaveClass('uppercase');
    expect(within(sheet).getByText('untagged@kpm0417.test')).toBeInTheDocument();
    expect(within(sheet).queryByLabelText('Full name')).toBeNull();
    expect(await within(sheet).findByText('BSD City Branch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to BSD City Branch' })).toBeInTheDocument();
  });

  it('P19.28-T3 AC-5 Keluar: each row says the month it left', async () => {
    atWidth(1280);
    show({ '/admin/members': { body: { ...PAGE, rows: [{ ...RINA, status: 'removed', leftOn: '2026-09-14' }], total: 1, chips: CHIPS } } });
    await userEvent.click(await screen.findByRole('radio', { name: /Left/ }));
    expect(await screen.findByText('Left Sep 2026')).toBeInTheDocument();
  });

  it('Buat KPM & jadikan owner: the KPM list with the new KPM first, and the toast "<KPM> created · <Name> is its owner" (stop motion B)', async () => {
    atWidth(390);
    const roles = [{ code: 'AGENT', label: 'Agent', class: 'agent' }, { code: 'AB', label: 'AB', class: 'ab' }];
    const options = { kpm: null, company: { id: 'co-1', name: 'Prudential' }, roles, seniorCode: 'AB', leaders: [], mayMakeOwner: true, mayMakeKpm: true };
    vi.stubGlobal('open', vi.fn(() => ({ location: { href: '' }, opener: {}, close: vi.fn() })));
    stubFetch({
      ...LISTS,
      '/admin/members': { body: { ...PAGE, chips: CHIPS } },
      '/user-invitations/options': { body: options },
      'POST /user-invitations': { body: {
        outcome: 'invited', link: 'https://app.test/user-invite/t', kpm: { id: 'k-new', code: '0603', branch: 'Bintaro Branch', created: true },
        invitation: { id: 'inv-9', kpmId: 'k-new', fullName: 'Rina Kartika', phone: '+6281277884410', email: null, role: roles[1],
          leaderMembershipId: null, makeOwner: true, state: 'pending', invitedAt: '2026-11-22T03:00:00.000Z', expiresAt: '2026-12-06T03:00:00.000Z' },
      } },
    } as never);
    renderInLayout(AdminLayout, <AnggotaPage />, {
      me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'kpm:create', 'member:add', 'member:place'] }),
    });
    await screen.findByRole('list', { name: 'Members of every KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Rina Kartika');
    await userEvent.type(within(sheet).getByLabelText('WhatsApp number'), '81277884410');
    await userEvent.click(within(sheet).getByRole('button', { name: 'KPM' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose KPM' })).getByRole('button', { name: /New KPM/ }));
    const form = await screen.findByRole('dialog', { name: 'Add user' });
    const box = form.querySelector('[data-add-user-new-kpm]') as HTMLElement;
    await userEvent.type(within(box).getByLabelText(/KPM name/), 'Bintaro Branch');
    await userEvent.click(within(box).getByRole('button', { name: /Choose company|Company/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Prudential' }).catch(() => screen.findByRole('option', { name: 'Prudential' })));
    await waitFor(() => expect(within(form).getByRole('radio', { name: 'AB' })).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(within(form).getByRole('button', { name: 'Create KPM & make owner' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/admin/tenants?created=k-new'));
    expect(await screen.findByText('Bintaro Branch created · Rina Kartika is its owner')).toBeInTheDocument();
  });

  it('P19.28-T2 AC-1 the floating ＋ Tambah user opens the shared sheet', async () => {
    atWidth(390);
    show({ '/admin/members': { body: { ...PAGE, chips: CHIPS } } });
    await screen.findByRole('list', { name: 'Members of every KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(await screen.findByRole('dialog', { name: 'Add user' })).toBeInTheDocument();
  });

  it('P19.28-T3 in Indonesian: the stop motion’s words — chips, switch, pills, Kirim ulang · Batalkan, Masukkan', async () => {
    atWidth(390);
    stubFetch({ ...LISTS, '/admin/members': { body: { ...PAGE, chips: CHIPS } }, '/admin/waiting-members': { body: WAITING } } as never);
    renderInIndonesian(<AnggotaPage />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('radio', { name: 'Aktif 50' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Tampilkan akun tes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah user' })).toBeInTheDocument();
    // UI-213 (21 Nov): neither grey line on a phone.
    expect(screen.queryByText('Ketuk = detail anggota (bisa diubah)')).toBeNull();
    expect(screen.queryByText('Akun terdaftar, dengan atau tanpa KPM')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Menunggu 2' }));
    expect(await screen.findByText('Diundang · 20 Nov')).toBeInTheDocument();
    expect(screen.getByText('Belum ada KPM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masukkan Fajar Nugroho ke KPM' })).toHaveTextContent('Masukkan');
    expect(englishShown(document.body, englishOnly(adminMembersMessages))).toEqual([]);
  });
});
