import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { coreLeadersMessages } from '@/i18n/messages/core-leaders';
import type { CoreLeader, CoreLeadersView } from '@/lib/core-leaders';
import CoreLeadersPage from './page';

const query = { current: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/core-leaders',
  useSearchParams: () => new URLSearchParams(query.current),
}));

const WRITES = ['member:read_profile', 'member:read_tags', 'member:tag_group', 'member:tag_core_leader', 'advanced_analytics:write'];
const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 4,
  },
  permissions: WRITES,
});

const leader = (membershipId: string, name: string, over: Partial<CoreLeader> = {}): CoreLeader => ({
  membershipId, name, agentCode: `CODE-${membershipId}`, role: 'ab', groupId: null, isGroupLeader: false,
  isCoreLeader: false, targets: { aa: 3, rec: 6, isDefault: true }, ...over,
});

const VIEW: CoreLeadersView = {
  year: '2026',
  leaders: [
    leader('agus', 'Agus Prasetyo', { groupId: 'g-top', isCoreLeader: true, targets: { aa: 4, rec: 8, isDefault: false } }),
    leader('dewi', 'Dewi Lestari', { role: 'aab', groupId: 'g-muda' }),
    leader('maya', 'Maya Halim'),
    leader('wilson', 'Wilson Tanoto', { groupId: 'g-top', isGroupLeader: true }),
  ],
  groups: [
    { groupId: 'g-muda', name: 'LEADER MUDA', headMembershipId: null, headName: null, leaders: 1 },
    { groupId: 'g-top', name: 'TOP PRODUCERS', headMembershipId: 'wilson', headName: 'Wilson Tanoto', leaders: 2 },
  ],
  counts: { leaders: 4, core: 1, withGroup: 3, withoutGroup: 1 },
  canWrite: true,
  canEditTargets: true,
};
const EMPTY: CoreLeadersView = {
  ...VIEW,
  leaders: VIEW.leaders.map((l) => ({ ...l, groupId: null, isGroupLeader: false, isCoreLeader: false })),
  groups: [],
  counts: { leaders: 4, core: 0, withGroup: 0, withoutGroup: 4 },
};

function open(width: number, routes: Record<string, unknown> = {}, me = OWNER, view: CoreLeadersView = VIEW) {
  atWidth(width);
  const stub = stubFetch({ 'GET /members/core-leaders': { body: view }, ...routes } as never);
  renderInIndonesian(<CoreLeadersPage />, { me });
  return stub;
}
const sent = (calls: { url: string; init: RequestInit }[], method: string, path: string) => {
  const call = calls.find((c) => c.init.method === method && c.url.includes(path));
  return call ? JSON.parse(String(call.init.body ?? 'null')) : undefined;
};

describe('Core leaders & groups (P19.13-T3; UI-199)', () => {
  afterEach(() => { vi.unstubAllGlobals(); query.current = ''; });

  it('P19.13-T3 AC-1 the title is the menu name, and the page reads GET /members/core-leaders behind member:read_tags', async () => {
    const { calls } = open(375);
    expect(await screen.findByRole('heading', { level: 1, name: 'Core leaders & groups' })).toBeInTheDocument();
    expect(calls[0].url).toContain('/members/core-leaders');
  });

  it('P19.13-T3 AC-1 a member without member:read_tags is not shown the page', async () => {
    stubFetch({ 'GET /members/core-leaders': { body: VIEW } });
    atWidth(375);
    renderInIndonesian(<CoreLeadersPage />, { me: { ...OWNER, permissions: ['member:read_profile'] } });
    await waitFor(() => expect(screen.queryByText('AGUS PRASETYO')).toBeNull());
    expect(screen.queryByText('Agus Prasetyo')).toBeNull();
  });

  describe('AC-8 the phone (375)', () => {
    it('P19.13-T3 AC-8 tiles, Kelola group, search and Pilih, one chip row, rows with ★ Core — the mockup’s words', async () => {
      open(375);
      const row = (await screen.findByText('Agus Prasetyo')).closest('li')!;
      expect(screen.getByRole('button', { name: /Core leader\s*1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Punya group\s*3/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tanpa group\s*1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Kelola group/ })).toHaveTextContent('2 group · 1 group leader');
      expect(screen.getByPlaceholderText('Cari nama atau kode')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pilih' })).toBeInTheDocument();
      const chips = within(screen.getByRole('group', { name: 'Saring leader' }));
      expect(chips.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Semua · 4', '★ Core · 1', 'LEADER MUDA · 1', 'TOP PRODUCERS · 2', 'Tanpa group · 1', '+ Group baru',
      ]);
      expect(row).toHaveTextContent('TOP PRODUCERS');
      expect(within(row).getByText('Agus Prasetyo')).toHaveClass('uppercase');
      const wilson = screen.getByText('Wilson Tanoto').closest('li')!;
      expect(wilson).toHaveTextContent('★ Group leader');
      expect(screen.getByText('Maya Halim').closest('li')).toHaveTextContent('Tanpa group');
    });

    it('P19.13-T3 AC-3 ★ Core toggles in one tap with a toast, and the count follows', async () => {
      const { calls } = open(375, {
        'PUT /members/maya/core-leader': { body: { membershipId: 'maya', fullName: 'Maya Halim', groupIds: [], isCoreLeader: true, canBeCoreLeader: true } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Core leader · Maya Halim' }));
      expect(sent(calls, 'PUT', '/members/maya/core-leader')).toEqual({ isCoreLeader: true });
      expect(await screen.findByText('Core leader ✓ · MAYA HALIM')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Core leader · Maya Halim' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Core leader\s*2/ })).toBeInTheDocument();
    });

    it('P19.13-T3 AC-2 a row’s sheet: group as choice rows, ★ held off without a group, Core, Target 2026, Simpan — one write each', async () => {
      const { calls } = open(375, {
        'PUT /members/core-leaders/maya': { body: VIEW },
        'PUT /kpm/advanced-analytics/targets/subgroup/maya': { body: { headMembershipId: 'maya', year: '2026', aaTarget: 4, recTarget: 6 } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Ubah Maya Halim' }));
      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByRole('switch', { name: '★ Group leader' })).toBeDisabled();
      expect(within(sheet).getByText('Pilih group dulu')).toBeInTheDocument();
      expect(within(sheet).getByText('Target 2026')).toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole('radio', { name: 'TOP PRODUCERS' }));
      expect(within(sheet).getByRole('switch', { name: '★ Group leader' })).toBeEnabled();
      await userEvent.click(within(sheet).getByRole('switch', { name: '★ Group leader' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Tambah Target AA' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Simpan' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/members/core-leaders/maya')).toEqual({ groupId: 'g-top', isGroupLeader: true, isCoreLeader: false }));
      await waitFor(() => expect(sent(calls, 'PUT', '/targets/subgroup/maya')).toEqual({ aaTarget: 4, recTarget: 6 }));
      expect(await screen.findByText('Tersimpan')).toBeInTheDocument();
    });

    it('P19.13-T3 AC-5 Pilih → tick → ★ Jadikan core: every ticked leader in one request', async () => {
      const { calls } = open(375, { 'PUT /members/core-leaders/bulk': { body: VIEW } });
      await userEvent.click(await screen.findByRole('button', { name: 'Pilih' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih Maya Halim' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih Dewi Lestari' }));
      const bar = screen.getByRole('region', { name: '2 dipilih' });
      await userEvent.click(within(bar).getByRole('button', { name: '★ Jadikan core' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/members/core-leaders/bulk')).toEqual({
        membershipIds: ['maya', 'dewi'], isCoreLeader: true,
      }));
    });

    it('P19.13-T3 AC-5 Pilih → Atur group: the choice sheet, one request for all', async () => {
      const { calls } = open(375, { 'PUT /members/core-leaders/bulk': { body: VIEW } });
      await userEvent.click(await screen.findByRole('button', { name: 'Pilih' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih Maya Halim' }));
      await userEvent.click(within(screen.getByRole('region', { name: '1 dipilih' })).getByRole('button', { name: 'Atur group' }));
      const sheet = await screen.findByRole('dialog');
      await userEvent.click(within(sheet).getByRole('radio', { name: 'LEADER MUDA' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Simpan' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/members/core-leaders/bulk')).toEqual({ membershipIds: ['maya'], groupId: 'g-muda' }));
    });

    it('P19.13-T3 AC-4 Kelola group lists each group with its ★ or Belum ada group leader; Hapus asks first', async () => {
      const { calls } = open(375, { 'DELETE /members/groups/g-muda': { body: [] } });
      await userEvent.click(await screen.findByRole('button', { name: /Kelola group/ }));
      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByRole('button', { name: /TOP PRODUCERS/ })).toHaveTextContent('★ Wilson Tanoto · 2 leader');
      expect(within(sheet).getByRole('button', { name: /LEADER MUDA/ })).toHaveTextContent('Belum ada group leader · 1 leader');
      await userEvent.click(within(sheet).getByRole('button', { name: /LEADER MUDA/ }));
      const group = await screen.findByRole('dialog');
      expect(within(group).getByRole('radio', { name: 'Belum ditunjuk' })).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(within(group).getByRole('button', { name: 'Hapus' }));
      const confirm = await screen.findByRole('dialog');
      expect(confirm).toHaveTextContent('Hapus group LEADER MUDA?');
      expect(confirm).toHaveTextContent('1 leader di group ini akan jadi Tanpa group. Tag Core leader tetap.');
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
      await userEvent.click(within(confirm).getByRole('button', { name: 'Hapus' }));
      await waitFor(() => expect(calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/members/groups/g-muda'))).toBe(true));
      expect(await screen.findByText('Group LEADER MUDA dihapus')).toBeInTheDocument();
    });

    it('P19.13-T3 AC-4 + Group baru makes a group with no ★, its name in capitals', async () => {
      const { calls } = open(375, {
        'POST /members/groups': { status: 201, body: [] },
        'GET /members/core-leaders': [{ body: VIEW }, { body: VIEW }, { body: VIEW }],
      });
      await userEvent.click(await screen.findByRole('button', { name: '+ Group baru' }));
      const sheet = await screen.findByRole('dialog');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Simpan' }));
      expect(within(sheet).getByRole('alert')).toHaveTextContent('Isi nama group');
      await userEvent.type(within(sheet).getByLabelText('Nama group'), 'cahyo');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Simpan' }));
      await waitFor(() => expect(sent(calls, 'POST', '/members/groups')).toEqual({ name: 'CAHYO', ownerMembershipId: null }));
      expect(await screen.findByText('Group CAHYO dibuat')).toBeInTheDocument();
    });

    it('P19.13-T3 AC-1 a view-as session reads it, every write hidden: no Pilih, no Kelola group, ★ Core not pressable', async () => {
      open(375, {}, { ...OWNER, permissions: ['member:read_profile', 'member:read_tags'] }, { ...VIEW, canWrite: false, canEditTargets: false });
      expect(await screen.findByText('Agus Prasetyo')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pilih' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Kelola group/ })).toBeNull();
      expect(screen.queryByRole('button', { name: '+ Group baru' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Core leader · Agus Prasetyo' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Ubah Agus Prasetyo' })).toBeNull();
    });

    it('P19.13-T3 AC-8 twelve rows, then Lihat semua n ›', async () => {
      const many = { ...EMPTY, leaders: Array.from({ length: 15 }, (_, i) => leader(`m${i}`, `Leader ${String(i).padStart(2, '0')}`)) };
      open(375, {}, OWNER, many);
      await screen.findByText('Leader 00');
      expect(screen.queryByText('Leader 12')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Lihat semua 15 ›' }));
      expect(screen.getByText('Leader 14')).toBeInTheDocument();
    });
  });

  describe('AC-8 the desktop (1280)', () => {
    it('P19.13-T3 AC-7 a KPM with no groups: tiles at 0, Semua · ★ Core leader · Tanpa group · + Group baru; every leader Tanpa group', async () => {
      open(1280, {}, OWNER, EMPTY);
      const pane = within(await screen.findByRole('navigation', { name: 'Group' }));
      expect(pane.getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua4', '★ Core leader0', 'Tanpa group4', '+ Group baru']);
      expect(screen.getByRole('button', { name: /^Core leader\s*0$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Punya group\s*0$/ })).toBeInTheDocument();
    });

    it('P19.13-T3 AC-8 the Group pane filters the table; a group shows its ★; Kelola group opens its popup', async () => {
      open(1280);
      const pane = within(await screen.findByRole('navigation', { name: 'Group' }));
      expect(pane.getByRole('button', { name: /LEADER MUDA/ })).toHaveTextContent('Belum ada group leader');
      await userEvent.click(pane.getByRole('button', { name: /TOP PRODUCERS/ }));
      const table = screen.getByRole('table');
      expect(within(table).getAllByRole('row')).toHaveLength(3);
      expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '★ Group leader: Wilson Tanoto')).toBeInTheDocument();
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
        ['', 'Nama', 'Group', 'Group leader', 'Core', 'Target AA', 'Target rekrut', 'Simpan'],
      );
      await userEvent.click(screen.getByRole('button', { name: 'Kelola group' }));
      const popup = await screen.findByRole('dialog');
      expect(within(popup).getByLabelText('Nama group')).toHaveValue('TOP PRODUCERS');
      expect(within(popup).getByRole('radio', { name: /Wilson Tanoto/ })).toHaveAttribute('aria-checked', 'true');
      expect(within(popup).getByRole('radio', { name: /Agus Prasetyo/ })).toHaveTextContent('★ Core');
    });

    it('P19.13-T3 AC-2 Tunjuk appoints a ★ through the group’s own write; the row’s group pill moves a leader', async () => {
      const { calls } = open(1280, {
        'PUT /members/groups/g-top': { body: [] },
        'PUT /members/core-leaders/bulk': { body: VIEW },
      });
      const agus = (await screen.findByText('Agus Prasetyo')).closest('tr')!;
      await userEvent.click(within(agus).getByRole('button', { name: '★ Group leader · Agus Prasetyo' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/members/groups/g-top')).toEqual({ name: 'TOP PRODUCERS', ownerMembershipId: 'agus' }));
      const maya = screen.getByText('Maya Halim').closest('tr')!;
      expect(within(maya).getByRole('button', { name: '★ Group leader · Maya Halim' })).toBeDisabled();
      await userEvent.click(within(maya).getByRole('button', { name: /Group Maya Halim/ }));
      await userEvent.click(await screen.findByRole('option', { name: 'LEADER MUDA' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/members/core-leaders/bulk')).toEqual({ membershipIds: ['maya'], groupId: 'g-muda' }));
    });

    it('P19.13-T3 AC-5 ticking rows raises the navy bar: n dipilih · Atur group · ★ Jadikan core · Batal', async () => {
      open(1280);
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Pilih Maya Halim' }));
      const bar = within(screen.getByRole('region', { name: '1 dipilih' }));
      expect(bar.getByRole('button', { name: /Atur group/ })).toBeInTheDocument();
      expect(bar.getByRole('button', { name: '★ Jadikan core' })).toBeInTheDocument();
      await userEvent.click(bar.getByRole('button', { name: 'Batal' }));
      expect(screen.queryByRole('region', { name: '1 dipilih' })).toBeNull();
    });
  });

  it('P19.13-T3 ?group=none opens the page on Tanpa group: Perbaikan sub-group’s Ubah target', async () => {
    query.current = 'group=none';
    open(1280);
    await screen.findByRole('table');
    expect(screen.getByRole('heading', { level: 2, name: 'Tanpa group' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('P19.13-T3 a read that fails says so, and Coba lagi reads again', async () => {
    const { calls } = (() => {
      atWidth(375);
      const stub = stubFetch({ 'GET /members/core-leaders': [{ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Boom' } } }, { body: VIEW }] });
      renderInIndonesian(<CoreLeadersPage />, { me: OWNER });
      return stub;
    })();
    await userEvent.click(await screen.findByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Agus Prasetyo')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/members/core-leaders'))).toHaveLength(2);
  });

  it.each([375, 1280])('P18.10-T7 AC-1 P19.13-T3 the page in Indonesian at %ipx leaves no English the glossary does not keep', async (width) => {
    open(width);
    await screen.findByText('Agus Prasetyo');
    expect(englishShown(document.body, englishOnly(coreLeadersMessages))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Ubah Maya Halim' }));
    await screen.findByRole('dialog');
    expect(englishShown(document.body, englishOnly(coreLeadersMessages))).toEqual([]);
  });

  it.each([375, 1280])('P19.13-T3 AC-8 axe is clean at %ipx, the list and a leader’s edit open', async (width) => {
    open(width);
    await screen.findByText('Agus Prasetyo');
    // jsdom paints nothing (contrast is the tokens' spec), and the shell, not rendered here, holds the landmarks.
    const NO_CONTRAST = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, NO_CONTRAST)).violations).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Ubah Maya Halim' }));
    await screen.findByRole('dialog');
    expect((await axe(document.body, NO_CONTRAST)).violations).toEqual([]);
  });

  it('P19.13-T3 the English words, the same page', async () => {
    atWidth(375);
    stubFetch({ 'GET /members/core-leaders': { body: VIEW } });
    renderWithSession(<CoreLeadersPage />, { me: OWNER });
    expect(await screen.findByRole('button', { name: /Manage groups/ })).toHaveTextContent('2 groups · 1 group leader');
    expect(screen.getByRole('button', { name: /In a group\s*3/ })).toBeInTheDocument();
  });
});
