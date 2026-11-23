import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import type { ConsoleKpmPeople } from '@/lib/admin-console';
import { KpmMembersCard } from './kpm-members-card';
import { NewKpmSheet } from './new-kpm-sheet';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/k1',
  useSearchParams: () => new URLSearchParams(),
}));

const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' },
  membership: null,
  permissions: ['kpm:create', 'member:add', 'member:place', 'platform_members:read', 'kpm:list_all'],
});
const KPM = '66f0000000000000000006a2';
const PEOPLE = {
  kpm: { kpmId: KPM, name: 'Bekasi Barat Branch', code: '0602', companyId: 'co-1', companyName: 'Prudential', status: 'active' },
  members: {
    total: 3, leaders: 2, agents: 1,
    first: [{ membershipId: 'm-1', fullName: 'Yohanes Saputra', class: 'ab', groupName: null, lastUsedDays: null, lastUsedStatus: 'never' }],
  },
} as unknown as ConsoleKpmPeople;
const OPTIONS = {
  kpm: { id: KPM, code: '0602', branch: 'Bekasi Barat Branch', company: { id: 'co-1', name: 'Prudential' } },
  company: { id: 'co-1', name: 'Prudential' },
  roles: [{ code: 'AGENT', label: 'Agent', class: 'agent' }, { code: 'AB', label: 'AB', class: 'ab' }],
  seniorCode: 'AB', leaders: [], mayMakeOwner: true, mayMakeKpm: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('P19.28-T2 AC-1 a KPM page’s Anggota card (F-1)', () => {
  it('P19.28-T2 AC-1 at 390px: ＋ Tambah user · Unggah file under the list; Tambah user opens the sheet with this KPM fixed', async () => {
    atWidth(390);
    stubFetch({ '/user-invitations/options': { body: OPTIONS } } as never);
    renderInIndonesian(<KpmMembersCard people={PEOPLE} />, { me: SUPER_ADMIN });
    const actions = document.querySelector('[data-members-card-actions]') as HTMLElement;
    expect(actions).toHaveClass('md:hidden');
    expect(within(actions).getByRole('link', { name: 'Unggah file' })).toHaveAttribute('href', '/people/import');
    await userEvent.click(within(actions).getByRole('button', { name: 'Tambah user' }));
    const sheet = await screen.findByRole('dialog', { name: 'Tambah user' });
    expect(within(sheet).queryByRole('button', { name: 'KPM' })).toBeNull();
    expect(within(sheet).getByText('Bekasi Barat Branch')).toBeInTheDocument();
    expect(within(sheet).getByText('Prudential · KPM 0602')).toBeInTheDocument();
  });

  it('P19.28-T2 AC-1 from 768px the two are pills in the card’s head, Import people keeping its name', async () => {
    atWidth(1280);
    stubFetch({} as never);
    renderWithSession(<KpmMembersCard people={PEOPLE} />, { me: SUPER_ADMIN });
    const head = screen.getByRole('heading', { name: /Members · 3/ }).parentElement as HTMLElement;
    // *Import people*'s outline, and from 1024px its round 40px form — the ＋ alone, named in its tooltip — so the head stays
    // one line beside the owners' card (the walk of 2026-11-22; measured in `kpm-page.browser.spec.ts`).
    const add = within(head).getByRole('button', { name: 'Add user' });
    expect(add).toHaveClass('border', 'border-hairline', 'h-10', 'lg:w-10', 'lg:px-0');
    expect(add).not.toHaveClass('bg-primary');
    expect(add).toHaveAttribute('title', 'Add user');
    expect(within(add).getByText('Add user')).toHaveClass('lg:sr-only');
    expect(within(head).getByRole('link', { name: 'Import people' })).toHaveAttribute('href', '/people/import');
    const all = within(head).getByRole('link', { name: /See all/ });
    expect(all).toHaveAttribute('href', '/people/members');
    // 44px tall on a phone (the walk's *Lihat semua* at 40px); 40px from 768px as before.
    expect(all).toHaveClass('min-h-10', 'max-md:min-h-11');
  });
});

describe('P19.28-T2 AC-9 KPM baru’s owner picker', () => {
  const WAITING = {
    rows: [{
      kind: 'unplaced', invitationId: null, userId: 'u-fajar', membershipId: 'm-fajar', fullName: 'Fajar Nugroho', avatarUrl: null,
      email: 'untagged@kpm0417.test', company: { id: 'co-1', name: 'Prudential' }, kpm: null, role: null, since: '2026-11-01',
      expired: false, testAccount: false,
    }],
    page: 1, pageSize: 50, total: 1, chips: { active: 1, pending: 1, removed: 0 },
  };

  it('P19.28-T2 AC-9 Pilih anggota yang sudah terdaftar: found by name, the KPM made and they its first owner in one step', async () => {
    atWidth(390);
    const opened = { location: { href: '' }, opener: {}, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    const { calls } = stubFetch({
      '/admin/waiting-members': { body: WAITING },
      'POST /admin/accounts/u-fajar/placement': { body: {
        outcome: 'placed', membershipId: 'm-new', kpm: { id: 'k-new', code: '0603', branch: 'Bintaro Branch', created: true },
        person: { userId: 'u-fajar', fullName: 'Fajar Nugroho', phone: null, email: 'untagged@kpm0417.test' }, appLink: 'https://app.test',
      } },
    } as never);
    const onCreated = vi.fn();
    renderInIndonesian(
      <NewKpmSheet companies={[{ companyId: 'co-1', name: 'Prudential' }]} onClose={vi.fn()} onCreated={onCreated} />,
      { me: SUPER_ADMIN },
    );
    const sheet = await screen.findByRole('dialog', { name: 'KPM baru' });
    // UI-213 (21 Nov): neither grey sentence on a phone.
    expect(within(sheet).queryByText('Pengaturan disalin dari template perusahaan')).toBeNull();
    expect(within(sheet).getByText(/Kode KPM dibuat otomatis/)).toHaveClass('max-md:hidden');
    await userEvent.type(within(sheet).getByLabelText('Nama KPM'), 'Bintaro Branch');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Pilih anggota yang sudah terdaftar' }));
    await userEvent.type(within(sheet).getByRole('searchbox', { name: 'Cari nama atau email' }), 'fajar');
    await userEvent.click(await within(sheet).findByRole('radio', { name: /FAJAR NUGROHO|Fajar Nugroho/ }));
    await userEvent.click(screen.getByRole('button', { name: /Buat KPM/ }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const sent = calls.find((c) => c.url.endsWith('/admin/accounts/u-fajar/placement'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ newKpm: { branchName: 'Bintaro Branch', companyId: 'co-1' } });
    expect(calls.some((c) => c.url.includes('/admin/waiting-members?q=fajar') && c.url.includes('companyId=co-1'))).toBe(true);
  });

  it('P19.28-T2 AC-9 Undang orang baru is the name and WhatsApp, as before', async () => {
    atWidth(1280);
    stubFetch({} as never);
    renderInIndonesian(
      <NewKpmSheet companies={[{ companyId: 'co-1', name: 'Prudential' }]} onClose={vi.fn()} onCreated={vi.fn()} />,
      { me: SUPER_ADMIN },
    );
    const sheet = await screen.findByRole('dialog', { name: 'KPM baru' });
    expect(within(sheet).getByRole('radio', { name: 'Undang orang baru' })).toHaveAttribute('aria-checked', 'true');
    expect(within(sheet).getByLabelText('Nama owner')).toBeInTheDocument();
    expect(within(sheet).getByText('Pengaturan disalin dari template perusahaan')).toBeInTheDocument();
  });
});
