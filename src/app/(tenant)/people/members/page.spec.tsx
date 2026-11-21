import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch } from '@test/harness';
import { row } from '@test/people-fixtures';
import MembersPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const STEWARD = ['member:read_profile', 'member:tag_group', 'member:read_tags', 'member:read_role_change_log', 'member:transfer_approve', 'member:tag_core_leader', 'member:complete_personal'];

/** The KPM's Owner, with the grants a steward holds. */
export const OWNER = makeMe({
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 4,
  },
  permissions: STEWARD,
});

const dewi = row({
  membershipId: 'mem-dewi', agentCode: '80007', role: 'aab', orgLevelCode: 'AAB', fullName: 'Dewi Lestari',
  leaderId: 'mem-agus', leaderName: 'Agus Prasetyo', directCount: 0, subtreeCount: 0, isLeader: false, isCoreLeader: false,
  lastActivityDays: 23, lastActivityStatus: 'lapsed', canTagCoreLeader: true,
  groupPlace: { group: { groupId: 'g-top', name: 'Top Producers 2026' }, ab: { membershipId: 'mem-agus', name: 'Agus Prasetyo' }, isGroupLeader: false },
});
const wilson = row({
  membershipId: 'mem-wilson', agentCode: '80003', fullName: 'Wilson Tanoto', leaderId: null, leaderName: null,
  isKpmOwner: true, directCount: 4, subtreeCount: 29,
  groupPlace: { group: { groupId: 'g-top', name: 'Top Producers 2026' }, ab: { membershipId: 'mem-wilson', name: 'Wilson Tanoto' }, isGroupLeader: true },
});
const maya = row({
  membershipId: 'mem-maya', agentCode: '80004', fullName: 'Maya Halim', isKpmAdmin: true, isCoreLeader: true,
  groupPlace: { group: null, ab: { membershipId: 'mem-maya', name: 'Maya Halim' }, isGroupLeader: false },
});

/** One row of the table, by whom it is about: a name also appears in other rows' *Melapor ke*. */
const rowOf = (table: HTMLElement, membershipId: string) => table.querySelector(`[data-row="${membershipId}"]`) as HTMLElement;

const page = (members: unknown[], over: Record<string, unknown> = {}) => ({
  body: { members, nextCursor: null, counts: { directory: members.length, pending: 1, removed: 0 }, ...over },
});

describe('P19.20-T1 All members', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('P19.20-T1 AC-1 three tabs — Anggota (n), Menunggu with a red count, Riwayat — and Invite a member', async () => {
    stubFetch({ '/members': page([wilson, row(), dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    expect(await screen.findByRole('tab', { name: 'Members 3' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Waiting 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite a member' })).toHaveAttribute('href', '/user-management/add');
  });

  it('P19.20-T1 AC-2 a row: the label before the NAME, ★, the Owner / Admin chip by the code, no email', async () => {
    atWidth(1024);
    stubFetch({ '/members': page([wilson, maya, row(), dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    const wilsonRow = rowOf(table, 'mem-wilson');
    expect(wilsonRow).toHaveTextContent('ABWilson Tanoto★Core leader80003Owner');
    expect(rowOf(table, 'mem-maya')).toHaveTextContent('80004Admin');
    expect(table).not.toHaveTextContent('agus@kpm0417.test');
  });

  it('P19.20-T1 AC-2 Group: an AB’s chip opens the Group dialog, Group Leader under it; a follower’s is locked, ikut AB …; Tanpa group dashed', async () => {
    atWidth(1024);
    stubFetch({ '/members/groups': { body: { groups: [], ungrouped: { abs: [], counts: { leaders: 0, people: 0, abGroups: 0 } }, unplaced: 0, canWrite: true } }, '/members': page([wilson, maya, dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    expect(rowOf(table, 'mem-wilson')).toHaveTextContent('Top Producers 2026Group Leader');
    expect(rowOf(table, 'mem-maya')).toHaveTextContent('No group');
    const dewiRow = rowOf(table, 'mem-dewi');
    expect(dewiRow).toHaveTextContent('Top Producers 2026follows AB Agus');
    expect(within(dewiRow).queryByRole('button', { name: /Change the group/ })).not.toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Change the group of Wilson Tanoto' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('P19.20-T1 AC-2 Melapor ke with the unit under it, and the two coloured pills', async () => {
    atWidth(1024);
    stubFetch({ '/members': page([row(), dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    const agus = rowOf(table, 'mem-agus');
    expect(agus).toHaveTextContent('Wilson Tanoto9 direct · 18 in unit');
    expect(within(agus).getByText('Today').closest('[data-tone]')).toHaveAttribute('data-tone', 'green');
    expect(within(agus).getByText('Never').closest('[data-tone]')).toHaveAttribute('data-tone', 'red');
    const dewiRow = rowOf(table, 'mem-dewi');
    expect(dewiRow).toHaveTextContent('No team');
    expect(within(dewiRow).getByText('23 days ago').closest('[data-tone]')).toHaveAttribute('data-tone', 'amber');
  });

  it('P19.20-T1 AC-2 the search and the filter, ★ Core leader included, are the server’s', async () => {
    const { calls } = stubFetch({ '/members': page([row()]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await screen.findAllByText('Agus Prasetyo');
    await userEvent.click(screen.getByRole('button', { name: /★ Core leader/ }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('coreLeader=true'));
    await userEvent.click(screen.getByRole('button', { name: /^AAB/ }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('role=aab'));
    await userEvent.type(screen.getByPlaceholderText('Search name or agent code'), 'dewi');
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=dewi'));
  });

  it('P19.20-T1 AC-2 See all (n) reads every page after the first', async () => {
    const { calls } = stubFetch({
      '/members': [page([row()], { nextCursor: '25', counts: { directory: 30, pending: 0, removed: 0 } }), page([dewi])],
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'See all (30)' }));
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('cursor=25'))).toBe(true));
    expect((await screen.findAllByText('Dewi Lestari')).length).toBeGreaterThan(0);
  });

  it('P19.20-T1 AC-3 ⋯ on an AB: core leader, group leader · <group>, Ubah group, Ubah peran / leader, Keluarkan (red)', async () => {
    atWidth(1024);
    stubFetch({ '/members': page([row()]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Agus Prasetyo' }));
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual([
      'Remove from core leaders', 'Make group leader · Top Producers 2026', 'Change group', 'Change role / leader',
      'Remove from the KPM',
    ]);
  });

  it('P19.20-T1 AC-3 ⋯ on an AAB has no Ubah group: she follows her AB', async () => {
    atWidth(1024);
    stubFetch({ '/members': page([dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Dewi Lestari' }));
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual(['Make core leader', 'Change role / leader', 'Remove from the KPM']);
  });

  it('P19.20-T2 AC-4 Keluarkan dari KPM: a centred dialog, a reason, where the team goes, Batal and a red Keluarkan', async () => {
    atWidth(1024);
    const { calls } = stubFetch({ 'DELETE /members/mem-agus': { body: [] }, '/members': page([row()]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(within(await screen.findByRole('table')).getByRole('button', { name: 'Actions for Agus Prasetyo' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove from the KPM' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove AGUS PRASETYO from the KPM?' });
    expect(within(dialog).getByRole('radio', { name: 'Moves to WILSON TANOTO' })).toBeChecked();
    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Pindah kantor');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await vi.waitFor(() => {
      const call = calls.find((c) => c.init.method === 'DELETE');
      expect(JSON.parse(String(call?.init.body))).toEqual({
        confirmation: 'REMOVE', reason: 'Pindah kantor', subtree: { action: 'reassign', toMembershipId: 'mem-wilson' },
      });
    });
  });

  it('P19.20-T2 AC-4 Ubah peran / leader: the rung, the leader with Ganti leader, a reason — Batal and Simpan', async () => {
    atWidth(1024);
    const { calls } = stubFetch({ 'PATCH /members/mem-dewi/role': { body: [] }, '/members': page([dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(within(await screen.findByRole('table')).getByRole('button', { name: 'Actions for Dewi Lestari' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Change role / leader' }));
    const dialog = await screen.findByRole('dialog', { name: /Change role \/ leader/ });
    expect(dialog).toHaveTextContent('Agus Prasetyo');
    expect(within(dialog).getByRole('button', { name: 'Change leader' })).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'agent');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/mem-dewi/role'))).toBe(true));
  });

  it('P19.20-T1 AC-5 a core leader’s rows outside their downline are muted and do not open', async () => {
    atWidth(1024);
    stubFetch({ '/members': page([row({ openable: true }), row({ membershipId: 'mem-yosef', fullName: 'Yosef Tambunan', openable: false })]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('button', { name: 'Open Agus Prasetyo' })).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Open Yosef Tambunan' })).not.toBeInTheDocument();
    expect(rowOf(table, 'mem-yosef')).toHaveAttribute('data-muted');
  });

  it('P19.20-T2 AC-1 a name opens the member sheet over the list', async () => {
    atWidth(1024);
    stubFetch({ '/members/mem-agus/tags': { body: {} }, '/members/mem-agus': { body: row({ personal: { dateOfBirth: null, gender: null, companyJoinMonth: null, workStatus: null, phone: null, companyName: null } }) }, '/members': page([row()]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(within(await screen.findByRole('table')).getByRole('button', { name: 'Open Agus Prasetyo' }));
    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByText('Profile')).toBeInTheDocument();
  });

  it('P19.20-T1 AC-2 below 768px the same content as rows, in the same order', async () => {
    atWidth(390);
    stubFetch({ '/members': page([row(), dewi]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const list = await screen.findByRole('list', { name: 'The KPM’s members' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Agus Prasetyo');
    expect(items[0]).toHaveTextContent('Top Producers 2026');
    expect(items[1]).toHaveTextContent('follows AB Agus');
  });

  it('P19.20-T1 AC-2 an empty KPM and an empty filter say so apart', async () => {
    stubFetch({ '/members': page([]) });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    expect(await screen.findByText('This KPM has no members yet.')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Search name or agent code'), 'nobody');
    expect(await screen.findByText('Nobody matches.')).toBeInTheDocument();
  });

  it('P19.20-T1 AC-2 a refused read is said', async () => {
    stubFetch({ '/members': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  });

  describe('Menunggu (AC-4)', () => {
    const fajar = row({
      membershipId: 'mem-fajar', status: 'pending', role: 'agent', orgLevelCode: 'AGENT', fullName: 'Fajar Nugroho',
      agentCode: '80011', leaderId: null, leaderName: null, groupPlace: undefined, registeredAt: '2026-11-16T02:00:00.000Z',
    });

    it('P19.20-T1 AC-4 Sudah daftar, belum masuk unit: Pilih leader puts them under the one chosen', async () => {
      const { calls } = stubFetch({
        '/transfer-requests': { body: [] },
        '/join/requests': { body: [] },
        '/members/tree': { body: { nodes: [{ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', preferredName: null, initials: 'AP', agentCode: '80005', role: 'ab', depth: 1, layer: 1, leaderId: null, directCount: 9, directCounts: { ab: 0, aab: 3, agent: 6, total: 9 }, subtreeCount: 18, isLeader: true, isSelf: false, openable: true }], leader: null, rootIds: ['mem-agus'], selfId: null, counts: { ab: 1, aab: 0, agent: 0, total: 1 } } },
        'PUT /people/mem-fajar/placement': { body: row({ membershipId: 'mem-fajar' }) },
        '/members': (req: { url: string }) => (req.url.includes('status=pending') ? page([fajar]) : page([row()])),
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      await userEvent.click(await screen.findByRole('tab', { name: /Waiting/ }));
      const item = await screen.findByText('Fajar Nugroho');
      expect(item.closest('li')).toHaveTextContent(/Has not chosen a leader · registered/);
      await userEvent.click(screen.getByRole('button', { name: 'Choose a leader' }));
      const picker = await screen.findByRole('dialog');
      await userEvent.click(await within(picker).findByRole('radio'));
      await userEvent.click(within(picker).getByRole('button', { name: 'Choose a leader' }));

      await vi.waitFor(() => {
        const call = calls.find((c) => c.url.includes('/placement'));
        expect(JSON.parse(String(call?.init.body))).toEqual({ leaderMembershipId: 'mem-agus' });
      });
    });

    it('P19.20-T1 AC-4 nobody waiting reads so', async () => {
      stubFetch({
        '/transfer-requests': { body: [] },
        '/join/requests': { body: [] },
        '/members': (req: { url: string }) => (req.url.includes('status=pending') ? page([]) : page([row()])),
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      await userEvent.click(await screen.findByRole('tab', { name: /Waiting/ }));
      expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument();
    });
  });

  describe('Riwayat (AC-4)', () => {
    const entry = (over: Record<string, unknown>) => ({
      id: 'h-1', kind: 'role', membershipId: 'mem-dewi', fullName: 'Dewi Lestari', agentCode: '80007', role: 'aab',
      photoUrl: null, fromRole: 'agent', toRole: 'aab', fromLeaderName: null, toLeaderName: null,
      reason: 'Took the AAB track after Q2', actorName: 'Agus Prasetyo', at: '2026-10-07T02:00:00.000Z', openable: true, ...over,
    });

    it('P19.20-T1 AC-4 one list: a role change, a removal, a move — each with its pill and its day', async () => {
      stubFetch({
        '/people/history': { body: [
          entry({}),
          entry({ id: 'h-2', kind: 'removed', membershipId: 'mem-dimas', fullName: 'Dimas Pratama', reason: null, actorName: 'Wilson Tanoto', openable: false }),
          entry({ id: 'h-3', kind: 'moved', membershipId: 'mem-raka', fullName: 'Raka Aditama', role: 'agent', reason: null, fromLeaderName: 'Satria Nugraha', toLeaderName: 'Agus Prasetyo' }),
        ] },
        '/members': page([row()]),
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      await userEvent.click(await screen.findByRole('tab', { name: 'History' }));
      const list = await screen.findByRole('list', { name: 'History, newest first' });
      const [role, removed, moved] = within(list).getAllByRole('listitem');
      expect(role).toHaveTextContent('“Took the AAB track after Q2” · by AGUS PRASETYO');
      expect(role).toHaveTextContent('Agent → AAB');
      expect(removed).toHaveTextContent('Removed');
      expect(moved).toHaveTextContent('moved from SATRIA NUGRAHA to AGUS PRASETYO');
      expect(moved).toHaveTextContent('Moved unit');
    });

    it('P19.20-T1 AC-4 the filter is the server’s: Semua · Perubahan peran · Dikeluarkan · Pindah unit', async () => {
      const { calls } = stubFetch({ '/people/history': { body: [] }, '/members': page([row()]) });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      await userEvent.click(await screen.findByRole('tab', { name: 'History' }));
      expect(await screen.findByText('No history yet.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Moved unit' }));
      await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('/people/history?kind=moved'));
    });
  });

  it('P19.20-T1 AC-1 a notice’s ?tab=pending opens Menunggu', async () => {
    window.history.replaceState(null, '', '/people/members?tab=pending');
    stubFetch({
      '/transfer-requests': { body: [] },
      '/join/requests': { body: [] },
      '/members': page([]),
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    expect(await screen.findByRole('tab', { name: /Waiting/ })).toHaveAttribute('aria-selected', 'true');
  });
});
