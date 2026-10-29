import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { joinRequest, transfer } from '@test/joining-fixtures';
import { leaderLimitWords } from '@/components/leader-limit-notice';
import { unitBreakdown } from '@/components/org-tree/org-tree';
import { RequestInbox } from '@/components/request-inbox';
import { RosterImport } from '@/components/roster-import';
import { adminsMessages } from '@/i18n/messages/admins';
import { leaderLimitMessages } from '@/i18n/messages/leader-limit';
import { memberMessages } from '@/i18n/messages/member';
import { membersMessages } from '@/i18n/messages/members';
import { orgMessages } from '@/i18n/messages/org';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { requestsMessages } from '@/i18n/messages/requests';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { formatCalendarDay, dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { requestedChange } from '@/lib/leader-limit-requests';
import { roleChangeExplanation } from '@/lib/org';
import AdminsPage from './admins/page';
import PeopleImportPage from './import/page';
import MemberPage from './members/[membershipId]/page';
import MembersPage from './members/page';
import OrgTreePage from './org-tree/page';

/**
 * **The office's people screens in Indonesian** (P18.98-T4 AC-1 to AC-4, people and forum): *All Members* — the roster
 * as a table and as a phone's cards, *Pending* with its approvals, transfers and the leader limit, *Removed*, *Role
 * change log*, *Groups* — a member's page, *Manage KPM Admins*, *Org Tree* and *Import people*, and the request inbox a
 * leader decides from. Their words the approved glossary's, each kept term English (§A), what the office typed as typed,
 * and no English message of the module's own left on the screen (`englishShown`). English is every other spec's,
 * unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const PEOPLE_ENGLISH = englishOnly(
  membersMessages, memberMessages, orgMessages, adminsMessages, orgTreeMessages, rosterImportMessages, requestsMessages,
  leaderLimitMessages,
);
const noEnglishLeft = () => expect(englishShown(document.body, PEOPLE_ENGLISH)).toEqual([]);

const OWNER = makeMe({
  user: {
    id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson',
    pronoun: 'he', initials: 'WT', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: [
    'member:read_profile', 'member:transfer_approve', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list',
    'org_tree:read', 'kpm:import_roster', 'leader_request:read_inbox', 'leader_request:approve',
    'leader_limit_request:read',
  ],
});

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
  fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test', initials: 'RW',
  leaderId: 'mem-owner', leaderName: 'Wilson Tanoto', depth: 1, directCount: 0, subtreeCount: 0,
  isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

const ROSTER = [
  member({
    membershipId: 'mem-owner', fullName: 'Wilson Tanoto', preferredName: null, role: 'ab', isKpmOwner: true,
    leaderId: null, leaderName: null, depth: 0, isLeader: true, directCount: 2, subtreeCount: 5,
    canTagCoreLeader: true, lastActivityDays: 0, lastActivityOn: '2026-10-27', lastCoachedDays: 3,
  }),
  member({ lastActivityDays: 2, lastActivityOn: '2026-10-25', lastCoachedDays: 9 }),
];
const page = (members = ROSTER, over: Record<string, unknown> = {}) =>
  ({ body: { members, nextCursor: null, counts: { directory: 28, pending: 2, removed: 1 }, ...over } });

const openMembers = (routes: Record<string, unknown> = {}) => {
  const stub = stubFetch({ '/members': page(), '/join/requests': { body: [] }, '/members/leader-limit-requests': { body: [] }, ...routes } as never);
  renderInIndonesian(<TenantLayout><MembersPage /></TenantLayout>, { me: OWNER });
  return stub;
};

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 All Members in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same roster in English shows it', async () => {
    expect(PEOPLE_ENGLISH.length).toBeGreaterThan(200);
    stubFetch({ '/members': page(), '/join/requests': { body: [] } } as never);
    renderWithSession(<TenantLayout><MembersPage /></TenantLayout>, { me: OWNER });
    await screen.findByRole('table', { name: 'Office roster' });
    expect(englishShown(document.body, PEOPLE_ENGLISH)).toEqual(expect.arrayContaining(['Search', 'Office roster', 'Previous']));
  });

  it('P18.98-T4 AC-1, AC-2 the directory: its title and tabs kept, its line, filter, columns and rows Indonesian', async () => {
    openMembers();
    const table = await screen.findByRole('table', { name: 'Roster KPM' });
    expect(screen.getByRole('heading', { level: 1, name: 'All Members' })).toBeInTheDocument();
    expect(screen.getByText('Direktori, permintaan yang menunggu, anggota yang dikeluarkan, dan riwayat peran')).toBeInTheDocument();
    for (const name of ['Directory (28)', 'Pending (2)', 'Removed (1)', 'Role change log', 'Groups']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Cari')).toHaveAttribute('placeholder', 'Nama, email, atau kode agen');
    expect(within(screen.getByLabelText('Peran')).getByRole('option', { name: 'Semua peran' })).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Nama', 'Kode agen', 'Peran', 'Melapor ke', 'Aktivitas terakhir', 'Coaching terakhir', 'Unit', 'Status'],
    );
    const wilson = within(table).getByRole('row', { name: /^Wilson Tanoto/ });
    expect(wilson).toHaveTextContent('2 langsung · 5 di unit');
    expect(within(wilson).getByText('Owner')).toBeInTheDocument();
    expect(within(wilson).getByRole('button', { name: 'Tag Wilson Tanoto sebagai Core Leader' })).toHaveTextContent('+ Core Leader');
    expect(within(wilson).getByText('Aktif')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Rina/ })).toHaveTextContent('Tanpa tim');
    // Typed content as typed: the name, the agent code, the email.
    expect(within(table).getAllByText('KPM0417-001')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled();
    expect(screen.getByText('2 ditampilkan')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 an empty office and an empty filter, in Indonesian', async () => {
    openMembers({ '/members': page([]) });
    expect(await screen.findByText('KPM ini belum punya anggota.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Cari'), 'siapa');
    expect(await screen.findByText('Tidak ada yang cocok.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus filter' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 Removed: the column says when, Bergabung kembali {date} in Indonesian', async () => {
    openMembers({
      '/members': [page(), page([member({
        membershipId: 'mem-left', fullName: 'Yanti Kusuma', preferredName: null, status: 'removed',
        removedAt: '2026-08-10T03:00:00.000Z', rejoinedOn: '2026-10-01',
      })])],
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Removed/ }));
    const table = await screen.findByRole('table', { name: 'Anggota yang dikeluarkan' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Nama', 'Kode agen', 'Peran', 'Melapor ke', 'Unit', 'Dikeluarkan'],
    );
    expect(within(table).getByRole('row', { name: /Yanti/ })).toHaveTextContent('10 Agu 2026Bergabung kembali 1 Okt 2026');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 on a phone: a card per member, each value under its heading in Indonesian', async () => {
    atWidth(375);
    openMembers();
    const list = await screen.findByRole('list', { name: 'Roster KPM' });
    const rina = within(list).getByRole('link', { name: 'Rina' }).closest('li')!;
    const fields = Object.fromEntries([...rina.querySelectorAll('dl > div')]
      .map((field) => [field.querySelector('dt')!.textContent, field.querySelector('dd')!.textContent]));
    expect(Object.keys(fields)).toEqual(['Kode agen', 'Melapor ke', 'Aktivitas terakhir', 'Coaching terakhir', 'Unit']);
    expect(fields.Unit).toBe('Tanpa tim');
    expect(within(rina).getByText('Aktif')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1, AC-3 Pending: who waits on whom, the approval’s join date and its refusal, the transfers', async () => {
    const asked = member({ membershipId: 'mem-asked', fullName: 'Putri Anggraini', preferredName: null, status: 'pending' });
    const unasked = member({ membershipId: 'mem-unasked', fullName: 'Fajar Nugroho', preferredName: null, status: 'pending' });
    openMembers({
      '/members': [page(), page([asked, unasked])],
      '/join/requests': { body: [joinRequest({ membershipId: 'mem-asked', requestedAt: '2026-09-01T00:00:00.000Z' })] },
      '/transfer-requests': { body: [transfer()] },
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Pending/ }));
    const table = await screen.findByRole('table', { name: 'Sudah mendaftar, belum masuk unit' });
    expect(screen.getByText(/^Setujui atau tolak permintaan dari agen yang ingin bergabung ke KPM Anda/)).toBeInTheDocument();
    expect(screen.getByText('leader yang mereka minta').tagName).toBe('STRONG');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Siapa', 'Menunggu', 'Aksi']);
    const putri = within(table).getByRole('row', { name: /Putri/ });
    expect(putri).toHaveTextContent('KeputusanDiajukan 1 Sep 2026');
    const fajar = within(table).getByRole('row', { name: /Fajar/ });
    expect(fajar).toHaveTextContent('Tidak adaDia belum meminta leader mana pun — leader dapat mengambilnya dari Add New Agents');
    expect(within(putri).getByRole('button', { name: 'Tolak' })).toBeInTheDocument();

    await userEvent.click(within(putri).getByRole('button', { name: 'Setujui' }));
    const field = within(putri).getByLabelText('Tanggal bergabung');
    expect(within(putri).getByText('Hari dia bergabung. Hari ini, kecuali dia bergabung lebih awal.')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '2999-01-01' } });
    const today = formatCalendarDay(dayInZone(OFFICE_TIME_ZONE, new Date()), 'id');
    expect(within(putri).getByText(`Tanggal bergabung tidak boleh setelah hari ini, ${today}.`)).toBeInTheDocument();
    expect(within(putri).getByRole('button', { name: 'Batal' })).toBeInTheDocument();

    // The office's transfer requests, beside it.
    const transfers = await screen.findByRole('table', { name: 'Permintaan pemindahan, terlama dulu' });
    expect(screen.getByRole('heading', { name: 'Permintaan pemindahan' })).toBeInTheDocument();
    expect(within(transfers).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Siapa', 'Pemindahan', 'Diajukan oleh', 'Aksi']);
    const row = within(transfers).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Dari unit Satria Nugraha ke unit Agus Prasetyo');
    expect(row).toHaveTextContent('Agus Prasetyo, 26 Okt 2026');
    await userEvent.click(within(row).getByRole('button', { name: 'Setujui' }));
    expect(await screen.findByText('Pindahkan Raka Aditama ke unit Agus Prasetyo? Semua orang di bawahnya ikut pindah.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui pemindahan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-3 an approval at the leader limit: the refusal whole, the ask, and the line it waits on', async () => {
    const asked = member({ membershipId: 'mem-asked', fullName: 'Putri Anggraini', preferredName: null, status: 'pending' });
    const waitingRow = {
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
      subjectMembershipId: 'mem-asked', subjectName: 'Putri Anggraini', subjectAgentCode: '88008', action: 'activate',
      fromOrgLevelCode: 'AAB', toOrgLevelCode: null, reason: null, requestedByMembershipId: 'mem-owner',
      requestedByName: 'Wilson', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
      declineReason: null, maxLeaders: 3, leadersUsed: 3,
    };
    openMembers({
      '/members': [page(), page([asked])],
      '/join/requests': { body: [joinRequest({ membershipId: 'mem-asked', role: 'aab' })] },
      '/transfer-requests': { body: [] },
      '/join/requests/req-1/approve': {
        status: 409,
        body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', requestId: 'r-2', details: { maxLeaders: 3, leadersUsed: 3, canRequest: true } } },
      },
      '/members/leader-limit-requests': [{ body: [] }, { body: [waitingRow] }],
      'POST /members/mem-asked/leader-limit-request': { status: 201, body: waitingRow },
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Pending/ }));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Setujui' }));
    await userEvent.click(screen.getByRole('button', { name: 'Setujui' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'KPM ini sudah mencapai batas 3 leaders, sehingga tidak ada lagi yang dapat dijadikan AB atau AAB. Yang dihitung sebagai leader adalah AB dan AAB, termasuk Owner. Minta AgencyBoost menyetujui yang satu ini melewati batas, atau menaikkan batasnya.',
    );
    await userEvent.click(within(alert).getByRole('button', { name: 'Minta persetujuan AgencyBoost' }));
    expect(await screen.findByText('Menunggu persetujuan AgencyBoost')).toBeInTheDocument();
    expect(screen.getByText('Diterima sebagai AAB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batalkan permintaan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 Role change log: its columns, a change said to a screen reader, the day in Indonesian', async () => {
    openMembers({
      '/members/role-changes': {
        body: [{
          membershipId: 'mem-1', fullName: 'Rina Wijaya', agentCode: 'KPM0417-001', fromRole: 'agent', toRole: 'aab',
          reason: 'Siap memimpin', actorName: 'Wilson Tanoto', changedAt: '2026-08-14T03:20:00.000Z',
        }],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));
    const table = await screen.findByRole('table', { name: 'Perubahan peran, terbaru dulu' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Kapan', 'Siapa', 'Perubahan', 'Alasan', 'Diubah oleh'],
    );
    expect(within(table).getByText('14 Agu 2026, 10.20')).toBeInTheDocument();
    expect(within(table).getByLabelText('menjadi')).toBeInTheDocument();
    // The reason as typed.
    expect(within(table).getByText('Siap memimpin')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1, AC-4 Groups: the office’s own labels as typed, everything around them Indonesian', async () => {
    const office = {
      nodes: [{
        membershipId: 'mem-1', fullName: 'Rina Wijaya', preferredName: 'Rina', initials: 'RW', agentCode: 'KPM0417-001',
        role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0, isLeader: false, isSelf: false,
      }],
      leader: null, rootIds: ['mem-1'], selfId: null, counts: { ab: 0, aab: 0, agent: 1, total: 1 },
    };
    openMembers({
      '/members/groups': {
        body: [{ groupId: 'grp-1', name: 'Top Producers Circle', ownerMembershipId: 'mem-1', ownerName: 'Rina Wijaya', ownerHasLeft: true, memberCount: 2 }],
      },
      '/members/tree': { body: office },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Groups' }));
    const table = await screen.findByRole('table', { name: 'Grup informal' });
    expect(screen.getByText('bukan').tagName).toBe('STRONG');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Grup', 'Pemilik', 'Di-tag', 'Aksi']);
    // The office's own name for it, typed in English, stays English.
    expect(within(table).getByText('Top Producers Circle')).toBeInTheDocument();
    expect(within(table).getByText('Sudah tidak di KPM ini — serahkan kepada orang lain')).toBeInTheDocument();
    expect(within(table).getByText('2 orang')).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Nonaktifkan' }));
    expect(screen.getByRole('heading', { name: 'Nonaktifkan Top Producers Circle?' })).toBeInTheDocument();
    expect(screen.getByText(/^Grup ini tidak lagi ditawarkan dan tidak lagi dihitung. Tidak ada yang dihapus: semua 2 orang/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nonaktifkan grup' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Buat grup' }));
    expect(screen.getByLabelText('Nama grup')).toHaveAttribute('placeholder', 'Lingkar Mentoring Agen Baru');
    expect(within(screen.getByLabelText('Pemilik')).getByRole('option', { name: 'Pilih seseorang' })).toBeInTheDocument();
    expect(screen.getByText('Orang yang menjalankannya. Disimpan sebagai keanggotaannya, jadi mengganti namanya tidak mengubah apa pun.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 a member’s page in Indonesian', () => {
  const params = routeParams({ membershipId: 'mem-1' });
  const open = (over: Record<string, unknown> = {}) => {
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false, canBeCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/leader-limit-requests': { body: [] },
      '/members/mem-1': {
        body: member({ role: 'agent', joinDate: '2026-03-02', canChangeRole: true, canPromoteToAb: false, canRemove: true, ...over }),
      },
    });
    renderInIndonesian(<TenantLayout><MemberPage params={params} /></TenantLayout>, { me: OWNER });
  };

  it('P18.98-T4 AC-1, AC-4 their details, their unit and their tags: the terms Indonesian, the person as typed', async () => {
    open();
    const card = (await screen.findByRole('heading', { name: 'Pribadi' })).closest('div')!;
    const row = (term: string) => within(card).getByText(term).nextElementSibling?.textContent;
    expect(row('Nama lengkap')).toBe('Rina Wijaya');
    expect(row('Melapor ke')).toBe('Wilson Tanoto');
    expect(row('Tanggal bergabung')).toBe('2 Mar 2026');
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText(/^Agent, dan tidak memimpin siapa pun\. Kepemimpinan mengikuti pohon/)).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tag.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ubah tag' }));
    expect(screen.getByRole('link', { name: 'All members → Groups' })).toBeInTheDocument();
    expect(screen.getByText(/Hanya seorang leader yang dapat menjadi Core Leader: pindahkan dia ke jenjang leader dulu\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan tag' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-3 a role change and a removal, each sentence whole in Indonesian', async () => {
    open();
    await screen.findByRole('heading', { name: 'Ubah perannya' });
    expect(screen.getByText('Hanya KPM yang dapat menjadikan seseorang AB, atau mencabutnya.')).toBeInTheDocument();
    const select = screen.getByLabelText('Peran baru');
    expect(within(select).getByRole('option', { name: /— tanpa perubahan$/ })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'aab');
    expect(screen.getByText('Rina akan berubah dari Agent menjadi AAB. Tidak ada yang pindah — dia tetap melapor kepada leader yang sama seperti sekarang.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah peran' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Keluarkan dari KPM' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan Rina' }));
    expect(screen.getByLabelText('Ketik REMOVE untuk mengonfirmasi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keluarkan dia' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Yang melapor kepadanya' })).toBeInTheDocument();
    expect(screen.getByText('Tidak ada yang melapor kepadanya.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 Manage KPM Admins in Indonesian', () => {
  const OFFICE = {
    nodes: [
      { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', preferredName: null, initials: 'WT', agentCode: 'KPM0417-000', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0, isLeader: false, isSelf: true },
      { membershipId: 'mem-agus', fullName: 'Agus Prasetyo', preferredName: null, initials: 'AP', agentCode: 'KPM0417-003', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0, isLeader: false, isSelf: false },
    ],
    leader: null, rootIds: ['mem-owner'], selfId: 'mem-owner', counts: { ab: 1, aab: 0, agent: 0, total: 1 },
  };
  const admin = {
    membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH', agentCode: 'KPM0417-002', role: 'ab',
    grantedAt: '2026-10-14T00:00:00.000Z', grantedByName: 'Wilson Tanoto', canRevoke: true,
  };

  it('P18.98-T4 AC-1 the list, a grant and a revoke asked first: Indonesian, *KPM Admin* kept, counted in its English plural', async () => {
    stubFetch({ '/members/admins': { body: [admin] }, '/members/tree': { body: OFFICE } });
    renderInIndonesian(<TenantLayout><AdminsPage /></TenantLayout>, { me: OWNER });
    const table = await screen.findByRole('table', { name: 'KPM Admins' });
    expect(screen.getByRole('heading', { level: 1, name: 'Manage KPM Admins' })).toBeInTheDocument();
    expect(screen.getByText('Para Admin dapat melakukan semuanya, kecuali mengelola admin.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Beri akses admin kepada')).getByRole('option', { name: 'Pilih seseorang' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beri akses' })).toBeInTheDocument();
    expect(screen.getByText('1 KPM Admin, didelegasikan oleh Anda')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nama', 'Peran', 'Admin sejak', 'Diberikan oleh', 'Aksi']);
    expect(within(table).getByText('Okt 2026')).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Cabut' }));
    expect(screen.getByRole('heading', { name: 'Cabut akses admin Maya Halim?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cabut akses' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 on a phone: the card’s Revoke named for whose access it takes, in Indonesian', async () => {
    atWidth(375);
    stubFetch({ '/members/admins': { body: [admin] }, '/members/tree': { body: OFFICE } });
    renderInIndonesian(<TenantLayout><AdminsPage /></TenantLayout>, { me: OWNER });
    const list = await screen.findByRole('list', { name: 'KPM Admins' });
    expect(within(list).getByRole('button', { name: 'Cabut akses admin Maya Halim' })).toBeInTheDocument();
    expect(within(list).getByText('Admin sejak')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 nobody else administers the office', async () => {
    stubFetch({ '/members/admins': { body: [] }, '/members/tree': { body: OFFICE } });
    renderInIndonesian(<TenantLayout><AdminsPage /></TenantLayout>, { me: OWNER });
    expect(await screen.findByText('Tidak ada yang mengelola KPM ini selain Anda. Beri akses di atas untuk mendelegasikannya.')).toBeInTheDocument();
  });
});

describe('P18.98-T4 Org Tree in Indonesian', () => {
  const node = (over: Record<string, unknown>) => ({
    fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000', role: 'agent', depth: 0,
    layer: 1, leaderId: null, directCount: 0, directCounts: {}, subtreeCount: 0, isLeader: false, isSelf: false, ...over,
  });
  const OFFICE = {
    nodes: [
      node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', isLeader: true, directCount: 1, directCounts: { AGENT: 3, AAB: 1 }, isSelf: true }),
      node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 2, leaderId: 'mem-owner' }),
      node({ membershipId: 'mem-left', fullName: 'Fajar Nugroho', initials: 'FN', layer: 1 }),
    ],
    leader: null, rootIds: ['mem-owner', 'mem-left'], selfId: 'mem-owner', counts: { ab: 1, aab: 0, agent: 1, total: 2 },
  };

  it('P18.98-T4 AC-1 the canvas: its line, its layers, the reader marked, a unit and its control in Indonesian', async () => {
    stubFetch({ '/members/tree': { body: OFFICE } });
    renderInIndonesian(<TenantLayout><OrgTreePage /></TenantLayout>, { me: OWNER });
    expect(await screen.findByText('Lapisan 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Org Tree' })).toBeInTheDocument();
    expect(screen.getByText('Setiap AB di KPM ini beserta seluruh downline-nya')).toBeInTheDocument();
    expect(screen.getByText(/^2 orang tidak melapor kepada siapa pun\./)).toBeInTheDocument();
    expect(screen.getByText('2 di bawah Anda · 1 AB · 0 AAB · 1 Agent')).toBeInTheDocument();
    expect(screen.getByText('ANDA')).toBeInTheDocument();
    expect(screen.getByText('3 agen langsung, 1 AAB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sembunyikan yang melapor kepada Wilson Tanoto' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 on a phone: the indented list, its control in Indonesian', async () => {
    atWidth(375);
    stubFetch({ '/members/tree': { body: OFFICE } });
    renderInIndonesian(<TenantLayout><OrgTreePage /></TenantLayout>, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Sembunyikan yang melapor kepada Wilson Tanoto' })).toBeInTheDocument();
    expect(screen.queryByTestId('tree-canvas')).toBeNull();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 an office with nobody in it', async () => {
    stubFetch({ '/members/tree': { body: { ...OFFICE, nodes: [], rootIds: [], counts: { ab: 0, aab: 0, agent: 0, total: 0 } } } });
    renderInIndonesian(<TenantLayout><OrgTreePage /></TenantLayout>, { me: OWNER });
    expect(await screen.findByText(/^KPM ini belum punya anggota\. Orang muncul di sini/)).toBeInTheDocument();
  });
});

describe('P18.98-T4 Import people in Indonesian', () => {
  const HEADER = 'fullName,email,agentCode,role,leaderAgentCode,dateOfBirth,companyJoinMonth,workStatus,gender';
  const TEMPLATE = {
    '/admin/tenants/roster-template': {
      body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: [['Agus Prasetyo', 'agus@example.test', '88001', 'AB', '', '1984-05-12', '2012-03', 'full-time', 'male']] },
    },
  };

  it('P18.98-T4 AC-1, AC-4 the file’s columns in Indonesian, what a cell holds as the file writes it', async () => {
    stubFetch(TEMPLATE);
    renderInIndonesian(<TenantLayout><PeopleImportPage /></TenantLayout>, { me: OWNER });
    const guide = await screen.findByRole('table', { name: 'Kolom file, berurutan: satu baris per orang' });
    expect(screen.getByRole('heading', { level: 1, name: 'Import people' })).toBeInTheDocument();
    expect(screen.getByText('Buat beberapa orang sekaligus dari spreadsheet.')).toBeInTheDocument();
    expect(within(guide).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Kolom', 'Isinya']);
    expect(within(guide).getAllByRole('row').slice(1).map((r) => r.firstElementChild!.textContent)).toEqual([
      'Nama', 'Email', 'Kode agen', 'Peran', 'Kode agen leader (opsional)', 'Tanggal lahir', 'Bulan bergabung',
      'Penuh/paruh waktu', 'Jenis kelamin',
    ]);
    // The file's own codes, as typed in it, in either language.
    expect(within(guide).getByRole('row', { name: /^Peran/ })).toHaveTextContent('AB, AAB, atau Agent');
    expect(within(guide).getByRole('row', { name: /^Tanggal lahir/ })).toHaveTextContent('YYYY-MM-DD, minimal 18 tahun yang lalu');
    expect(within(guide).getByRole('row', { name: /^Jenis kelamin/ })).toHaveTextContent('male atau female');
    expect(await screen.findByRole('link', { name: 'Unduh templat' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bagaimana Anda menambahkan mereka?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tempel dari spreadsheet')).toBeChecked();
    expect(screen.getByLabelText('Baris dari spreadsheet Anda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Periksa file' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Impor 0' })).toBeDisabled();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1, AC-3 the check, its problems as the server wrote them, and the people made', async () => {
    stubFetch({
      ...TEMPLATE,
      '/admin/tenants/kpm-1/roster/preview': [
        { body: { willCreate: 0, rows: [], issues: [{ line: 2, column: 'email', message: '"nope" is not an email address.' }] } },
        { body: { willCreate: 1, rows: [], issues: [] } },
      ],
      '/admin/tenants/kpm-1/roster': {
        body: { created: [{ fullName: 'Agus Prasetyo', email: 'agus@example.test', agentCode: '88001', temporaryPassword: 'kuda-laut-42' }] },
      },
    } as never);
    renderInIndonesian(<RosterImport kpmId="kpm-1" backHref="/people/members" />, { me: OWNER });
    await userEvent.type(await screen.findByLabelText('Baris dari spreadsheet Anda'), 'A,nope,881,ab');
    await userEvent.click(screen.getByRole('button', { name: 'Periksa file' }));
    expect(await screen.findByRole('heading', { name: '1 masalah — tidak ada yang akan dibuat' })).toBeInTheDocument();
    const problems = screen.getByRole('table', { name: 'Yang salah dengan file ini' });
    expect(within(problems).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Baris', 'Kolom', 'Masalah']);
    expect(within(problems).getByText('"nope" is not an email address.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Periksa file' }));
    expect(await screen.findByText('1 orang siap diimpor. Belum ada yang dibuat.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Impor 1' }));
    expect(await screen.findByRole('heading', { name: '1 orang dibuat' })).toBeInTheDocument();
    expect(screen.getByText('AgencyBoost tidak mengirimkannya lewat email untuk Anda').tagName).toBe('STRONG');
    expect(screen.getByText('Lupa kata sandi?').tagName).toBe('EM');
    const created = screen.getByRole('table', { name: 'Orang yang dibuat, dan kata sandi awal masing-masing' });
    expect(within(created).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nama', 'Email', 'Kode agen', 'Kata sandi sementara']);
    expect(within(created).getByText('kuda-laut-42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali' })).toHaveAttribute('href', '/people/members');
    noEnglishLeft();
  });
});

describe('P18.98-T4 the request inbox in Indonesian (a leader’s Pending Requests, Review requests on /new-hires)', () => {
  it('P18.98-T4 AC-1, AC-3 a request, where it may go, and a decline asking why', async () => {
    stubFetch({
      '/join/requests/routing': { body: [{ membershipId: 'mem-dewi', fullName: 'Sari Dewi', unitSize: 5, forLeaderMembershipId: 'mem-owner' }] },
      '/join/requests': { body: [joinRequest({ leaderMembershipId: 'mem-owner', leaderName: 'Wilson Tanoto', routedFromName: 'Sari Puspita' })] },
      '/members/leader-limit-requests': { body: [] },
    });
    renderInIndonesian(<RequestInbox />, { me: OWNER });
    expect(await screen.findByText('Dikirim kepada Anda oleh Sari Puspita.')).toBeInTheDocument();
    const to = screen.getByLabelText('Tambahkan ke');
    expect(within(to).getAllByRole('option').map((o) => o.textContent)).toEqual(['Unit saya sendiri', 'Unit Sari Dewi (5)']);
    await userEvent.click(screen.getByRole('button', { name: 'Tolak' }));
    expect(screen.getByLabelText('Alasan')).toHaveAttribute('placeholder', 'Bukan wilayah saya — coba ke Sari');
    expect(screen.getByText('Dikirim kepadanya. Tanpa alasan, dia harus menebak apa yang sebaiknya dilakukan.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 nothing waiting', async () => {
    stubFetch({ '/join/requests/routing': { body: [] }, '/join/requests': { body: [] }, '/members/leader-limit-requests': { body: [] } });
    renderInIndonesian(<RequestInbox />, { me: OWNER });
    expect(await screen.findByText('Tidak ada permintaan yang menunggu saat ini.')).toBeInTheDocument();
  });
});

describe('P18.98-T4 the people module’s sentences in each language', () => {
  it('P18.98-T4 AC-3 the leader limit, whole in Indonesian for each thing that meets it', () => {
    const details = { maxLeaders: 1, leadersUsed: 1 };
    expect(leaderLimitWords({ details }, 'office', 'roster', 'id').said).toBe(
      'KPM ini sudah mencapai batas 1 leader, sehingga AB dan AAB di file ini tidak dapat ditambahkan. Yang dihitung sebagai leader adalah AB dan AAB, termasuk Owner. Impor mereka sebagai Agent, lalu naikkan perannya di halaman masing-masing: jika melewati batas, itu akan meminta persetujuan AgencyBoost.',
    );
    expect(leaderLimitWords({ details: {} }, 'office', 'role', 'id').said).toBe(
      'KPM ini sudah mencapai batas leader-nya, sehingga tidak ada lagi yang dapat dijadikan AB atau AAB. Yang dihitung sebagai leader adalah AB dan AAB, termasuk Owner. AgencyBoost dapat menaikkannya.',
    );
    const platform = leaderLimitWords({ details }, 'platform', 'owner', 'id');
    expect(platform).toEqual({
      said: 'KPM ini sudah mencapai batas 1 leader, sehingga Owner barunya tidak dapat ditambahkan sebagai AB. Yang dihitung sebagai leader adalah AB dan AAB, termasuk Owner.',
      platformAdvice: true,
    });
    // English unchanged.
    expect(leaderLimitWords({ details: {} }, 'office', 'role').said).toBe(
      'This office has reached its leader limit, so nobody else can be made an AB or an AAB. Leaders are ABs and AABs together, the Owner included. AgencyBoost can raise it.',
    );
  });

  it('P18.98-T4 AC-3 what a request asks for, a role change’s meaning and a unit, in Indonesian', () => {
    const label = (code: string) => code;
    expect(requestedChange({ action: 'activate', fromOrgLevelCode: 'AAB', toOrgLevelCode: null }, label, 'id')).toBe('Diterima sebagai AAB');
    expect(requestedChange({ action: 'promote', fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB' }, label, 'id')).toBe('AGENT → AAB');
    expect(roleChangeExplanation('Rina', 'agent', 'aab', 'their-leader', undefined, 'id')).toBe(
      'Rina akan berubah dari Agent menjadi AAB. Dia tetap melapor kepada Anda, dan kini dapat merekrut serta mengelola agen langsungnya sendiri.',
    );
    expect(roleChangeExplanation('Rina', 'aab', 'agent', 'their-leader', undefined, 'id')).toBe(
      'Rina akan kembali dari AAB menjadi Agent. Dia tetap melapor kepada Anda, tetapi tidak lagi mengelola agen langsungnya sendiri.',
    );
    expect(unitBreakdown({ AGENT: 1, AAB: 2 }, undefined, 'id')).toBe('1 agen langsung, 2 AAB');
    expect(unitBreakdown({ AGENT: 3 })).toBe('3 direct agents');
    // A role counted keeps its English plural (§B.0 rule 8); one is one.
    expect(adminsMessages.id.count({ n: 3 })).toBe('3 KPM Admins, didelegasikan oleh Anda');
    expect(adminsMessages.id.count({ n: 1 })).toBe('1 KPM Admin, didelegasikan oleh Anda');
  });

  it('P18.98-T4 AC-1 a member’s status, by its pill, in each language', async () => {
    await waitFor(() => expect(orgMessages.id.status).toEqual({ active: 'Aktif', pending: 'Menunggu', removed: 'Dikeluarkan' }));
    expect(orgMessages.en.status).toEqual({ active: 'Active', pending: 'Pending', removed: 'Removed' });
  });
});
