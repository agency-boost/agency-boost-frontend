import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import AdminsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/admins',
}));

const me = (owner: boolean) => makeMe({
  membership: {
    membershipId: owner ? 'mem-wilson' : 'mem-maya', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: owner, isKpmAdmin: !owner, status: 'active', directCount: 0,
  },
  permissions: owner ? ['member:read_profile', 'kpm_admin:list', 'kpm_admin:grant', 'kpm_admin:revoke'] : ['member:read_profile', 'kpm_admin:list'],
});

const maya = {
  membershipId: 'mem-maya', fullName: 'Maya Halim', initials: 'MH', agentCode: '80004', role: 'ab',
  grantedAt: '2026-03-02T02:00:00.000Z', grantedByName: 'Wilson Tanoto', canRevoke: true, photoUrl: null,
};
const stewards = {
  owner: { membershipId: 'mem-wilson', fullName: 'Wilson Tanoto', agentCode: '80003', role: 'ab', photoUrl: null },
  admins: 1,
  coreLeaders: 4,
};
const tree = {
  nodes: [
    { membershipId: 'mem-wilson', fullName: 'Wilson Tanoto', preferredName: null, initials: 'WT', agentCode: '80003', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 3, directCounts: { ab: 3, aab: 0, agent: 0, total: 3 }, subtreeCount: 3, isLeader: true, isSelf: true },
    { membershipId: 'mem-maya', fullName: 'Maya Halim', preferredName: null, initials: 'MH', agentCode: '80004', role: 'ab', depth: 1, layer: 2, leaderId: 'mem-wilson', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
    { membershipId: 'mem-agus', fullName: 'Agus Prasetyo', preferredName: null, initials: 'AP', agentCode: '80005', role: 'ab', depth: 1, layer: 2, leaderId: 'mem-wilson', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
    { membershipId: 'mem-sari', fullName: 'Sari Puspita', preferredName: null, initials: 'SP', agentCode: '80006', role: 'aab', depth: 1, layer: 2, leaderId: 'mem-wilson', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
  ],
  leader: null, rootIds: ['mem-wilson'], selfId: 'mem-wilson', counts: { ab: 2, aab: 1, agent: 0, total: 3 },
};

describe('P19.20-T4 KPM admins', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.20-T4 AC-1 three tiles say who can do what: the Owner by name, n Admins, n core leaders · set in All members', async () => {
    stubFetch({ '/members/admins': { body: [maya] }, '/people/stewards': { body: stewards } });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(true) });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('Everything in this KPM, adding and revoking admins included')).toBeInTheDocument();
    expect(screen.getByText('1 person')).toBeInTheDocument();
    expect(screen.getByText('4 people · set in All members')).toBeInTheDocument();
  });

  it('P19.20-T4 AC-2 an admin row: the label, the NAME, “code · admin since … · granted by …”, and Cabut', async () => {
    stubFetch({ '/members/admins': { body: [maya] }, '/people/stewards': { body: stewards } });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(true) });

    const list = await screen.findByRole('list', { name: 'The KPM’s admins' });
    const row = within(list).getByRole('listitem');
    expect(row).toHaveTextContent('ABMaya Halim');
    expect(row).toHaveTextContent('80004 · admin since Mar 2026 · granted by WILSON TANOTO');
    expect(within(row).getByRole('button', { name: 'Revoke Maya Halim’s admin access' })).toBeInTheDocument();
  });

  it('P19.20-T4 AC-2 Cabut asks once, says they stay a member, and revokes', async () => {
    const { calls } = stubFetch({
      'DELETE /members/mem-maya/admin': { body: [] },
      '/members/admins': { body: [maya] },
      '/people/stewards': { body: stewards },
    });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(true) });

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Maya Halim’s admin access' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Revoke MAYA HALIM’s admin access?');
    expect(dialog).toHaveTextContent('Maya stays a member of the KPM as AB; only the admin access is revoked.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await vi.waitFor(() => expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true));
  });

  it('P19.20-T4 AC-2 Tambah admin: the people picker — search, labels, never the reader or an admin — then Jadikan admin', async () => {
    const { calls } = stubFetch({
      'POST /members/mem-agus/admin': { body: [maya] },
      '/members/admins': { body: [maya] },
      '/people/stewards': { body: stewards },
      '/members/tree': { body: tree },
    });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(true) });

    await userEvent.click(await screen.findByRole('button', { name: 'Add admin' }));
    const picker = await screen.findByRole('dialog', { name: 'Add admin' });
    expect(await within(picker).findByText('Agus Prasetyo')).toBeInTheDocument();
    expect(within(picker).queryByText('Maya Halim')).not.toBeInTheDocument();
    expect(within(picker).queryByText('Wilson Tanoto')).not.toBeInTheDocument();
    expect(picker).toHaveTextContent('Test accounts are not shown.');
    await userEvent.type(within(picker).getByRole('searchbox'), 'sari');
    expect(within(picker).queryByText('Agus Prasetyo')).not.toBeInTheDocument();
    await userEvent.clear(within(picker).getByRole('searchbox'));
    await userEvent.click(within(picker).getAllByRole('radio')[0]);
    await userEvent.click(within(picker).getByRole('button', { name: 'Make admin' }));

    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/members/mem-agus/admin'))).toBe(true));
  });

  it('P19.20-T4 AC-3 an Admin reads it: no Tambah admin, no Cabut', async () => {
    stubFetch({ '/members/admins': { body: [{ ...maya, canRevoke: false }] }, '/people/stewards': { body: stewards } });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(false) });

    await screen.findByRole('list', { name: 'The KPM’s admins' });
    expect(screen.queryByRole('button', { name: 'Add admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Admins can see this page; only the KPM Owner can add or revoke admins/)).toBeInTheDocument();
  });

  it('P19.20-T4 AC-2 nobody but the Owner yet', async () => {
    stubFetch({ '/members/admins': { body: [] }, '/people/stewards': { body: { ...stewards, admins: 0 } } });
    renderInLayout(TenantLayout, <AdminsPage />, { me: me(true) });

    expect(await screen.findByText('No admin yet: only the KPM Owner looks after this KPM.')).toBeInTheDocument();
  });

  it('P19.20-T4 AC-1 in Indonesian, word for word', async () => {
    stubFetch({ '/members/admins': { body: [maya] }, '/people/stewards': { body: stewards } });
    renderInIndonesian(<AdminsPage />, { me: me(true) });

    expect(await screen.findByText('Semua di KPM ini, termasuk tambah / cabut admin')).toBeInTheDocument();
    expect(screen.getByText('Sama seperti owner: lihat dan ubah semua, buka semua anggota. Hanya tidak bisa tambah / cabut admin')).toBeInTheDocument();
    expect(screen.getByText('KPM + Pengaturan seperti owner; People hanya bisa membuka timnya')).toBeInTheDocument();
    expect(screen.getByText('4 orang · atur di All members')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah admin' })).toBeInTheDocument();
    expect(screen.getByText(/admin sejak Mar 2026 · diberikan oleh WILSON TANOTO/)).toBeInTheDocument();
  });
});
