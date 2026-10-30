import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import { joinRequest } from '@test/joining-fixtures';
import { userManagementMessages } from '@/i18n/messages/user-management';
import AddAgentsPage from './add/page';
import RegisterKpmPage from './kpm/page';
import FindLeaderPage from './leader/page';
import PendingPage from './pending/page';

/**
 * **User Management in Indonesian** (P18.98-T4 AC-1 to AC-4, new hires and activation): the four screens of one
 * journey — *Register KPM*, *Find Your Leader*, *Add New Agents*, *Pending Requests* — and the tab row over them. The
 * approved glossary's words (`i18n/messages/user-management.ts`; *office* is *KPM*, §B.9), the title and the four tabs
 * kept English (§A.2, §A.3), an office's company, code and branch, names, agent codes and the leader code as stored,
 * and no English message of the module's own left (`englishShown`). English is the pages' own specs', unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/kpm',
}));

const ENGLISH = englishOnly(userManagementMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const NO_OFFICE = {
  kpmId: null, kpmLabel: null, registeredAt: null, leaderMembershipId: null, leaderName: null, status: 'none', pendingRequestTo: null,
};
const REGISTERED = { ...NO_OFFICE, kpmId: 'kpm-1', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', status: 'pending' };
const OFFICES = [{ kpmId: 'kpm-1', code: '0417', branchName: 'BSD City Branch', companyName: 'Prudential', city: 'Tangerang' }];
const NEWCOMER = makeMe({ membership: null, permissions: ['kpm:read_directory', 'kpm_registration:create'] });
const JOINER = makeMe({
  membership: {
    membershipId: 'mem-me', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    isKpmOwner: false, isKpmAdmin: false, status: 'active', directCount: 0,
  },
  permissions: ['leader:search_directory', 'leader_request:create', 'leader_request:cancel'],
});
const LEADER = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: [
    'member:invite', 'member:search_untagged_pool', 'member:change_role', 'member:remove_from_team',
    'leader_request:read_inbox', 'leader_request:approve',
  ],
});

const inIndonesian = (page: React.ReactElement, me: ReturnType<typeof makeMe>) =>
  renderInIndonesian(<AgentLayout>{page}</AgentLayout>, { me });

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 User Management in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same page in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(80);
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });
    await screen.findByText('Prudential — KPM 0417');
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['No office registered yet', 'Select']));
  });

  it('AC-1, AC-2 Register KPM: the title and tabs kept, the locked tab’s reason, the search and an office in Indonesian', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    inIndonesian(<RegisterKpmPage />, NEWCOMER);
    expect(await screen.findByText('Prudential — KPM 0417')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^User Management$/);
    const tabs = within(screen.getByRole('navigation', { name: 'User Management' }));
    expect(tabs.getByText('Register KPM')).toBeInTheDocument();
    expect(tabs.getByText('Find Your Leader')).toHaveAttribute('title', 'Daftarkan KPM terlebih dahulu');
    expect(screen.getByText('Temukan KPM tempat cabang Anda berada.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Belum ada KPM yang terdaftar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cari')).toHaveAttribute('placeholder', 'Kode KPM atau nama cabang');
    expect(screen.getByRole('button', { name: 'Pilih' })).toBeInTheDocument();
    // The branch and the city as stored.
    expect(screen.getByText('BSD City Branch · Tangerang')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ajukan KPM' }));
    expect(screen.getByLabelText('Apa nama cabang Anda?')).toHaveAttribute('placeholder', 'Cabang Surabaya');
    expect(screen.getByRole('button', { name: 'Kirim permintaan' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1 Register KPM once registered, and an empty directory, in Indonesian', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    inIndonesian(<RegisterKpmPage />, NEWCOMER);
    expect(await screen.findByText('KPM terdaftar')).toBeInTheDocument();
    expect(screen.getByText('Prudential — KPM 0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Anda sudah masuk KPM dan sedang menunggu leader menerima Anda.')).toBeInTheDocument();
    // The tab and the card's call to action: both the tab's kept name.
    expect(screen.getAllByRole('link', { name: 'Find Your Leader' })).toHaveLength(2);
    noEnglishLeft();
  });

  it('AC-1, AC-4 an office asked for and declined: the reason as typed, the rest in Indonesian', async () => {
    stubFetch({
      '/join/me': { body: NO_OFFICE },
      '/join/kpm-request': {
        body: { request: { requestId: 'r-1', branchName: 'Surabaya Branch', companyName: 'Prudential', status: 'declined', requestedAt: '2026-10-01T00:00:00.000Z', reason: null } },
      },
      '/join/kpms': { body: [] },
    });
    inIndonesian(<RegisterKpmPage />, NEWCOMER);
    expect(await screen.findByRole('heading', { name: 'Permintaan Anda untuk Surabaya Branch ditolak' })).toBeInTheDocument();
    expect(screen.getByText('Tidak ada alasan yang diberikan. Tanyakan kepada pengelola wilayah Anda.')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada KPM yang tersedia untuk diikuti.')).toBeInTheDocument();
  });

  it('UI-086 Find Your Leader with no office yet: the invite card, in Indonesian', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE } });
    inIndonesian(<FindLeaderPage />, NEWCOMER);
    expect(await screen.findByRole('heading', { name: /^Punya kode, tautan, atau QR dari leader\?/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gunakan undangan saja' })).toHaveAttribute('href', '/join');
  });

  it('AC-1, AC-2 Find Your Leader: the leaders, a request sent, and one at a time, in Indonesian', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
      '/join/leaders': {
        body: [
          { membershipId: 'mem-ab', fullName: 'Wilson Tanoto', role: 'ab', unitSize: 4, isCurrentLeader: false, requestSent: true },
          { membershipId: 'mem-aab', fullName: 'Dewi Lestari', role: 'aab', unitSize: 0, isCurrentLeader: false, requestSent: false },
        ],
      },
    });
    inIndonesian(<FindLeaderPage />, JOINER);
    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('Cari leader di KPM Anda dan minta untuk di-tag.')).toBeInTheDocument();
    // UI-086 (T16): no invite for somebody already in an office, with a leader or without — `/join` refuses them.
    expect(screen.queryByText(/^Punya kode, tautan, atau QR/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Cari leader' })).toBeInTheDocument();
    expect(screen.getByText('Dia perlu menyetujuinya.')).toBeInTheDocument();
    expect(screen.getByLabelText('Cari berdasarkan nama')).toHaveAttribute('placeholder', 'Nama');
    expect(screen.getByText('4 di unit-nya')).toBeInTheDocument();
    expect(screen.getByText('Belum punya unit — dia tetap dapat menerima Anda')).toBeInTheDocument();
    expect(screen.getByText('Permintaan terkirim')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tarik kembali' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim permintaan' })).toBeInTheDocument();
    expect(screen.getByText(/^Satu permintaan dalam satu waktu\./)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Find Your Leader before an office, with a leader, and with none to find, in Indonesian', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE } });
    const { unmount } = inIndonesian(<FindLeaderPage />, makeMe({ membership: null }));
    expect(await screen.findByRole('heading', { name: 'Daftarkan KPM terlebih dahulu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Register KPM' })).toHaveAttribute('href', '/user-management/kpm');
    unmount();

    stubFetch({ '/join/me': { body: { ...REGISTERED, status: 'active', leaderMembershipId: 'mem-ab', leaderName: 'Wilson Tanoto' } } });
    const second = inIndonesian(<FindLeaderPage />, JOINER);
    const card = await screen.findByTestId('reporting-to');
    expect(within(card).getAllByText('Penggantian leader dilakukan melalui Admin KPM Anda.').length).toBeGreaterThan(0);
    expect(within(card).getByText('Saat ini melapor ke')).toBeInTheDocument();
    // UI-086: no invite for somebody already under a leader.
    expect(screen.queryByText(/^Punya kode, tautan, atau QR/)).not.toBeInTheDocument();
    second.unmount();

    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: [] } });
    inIndonesian(<FindLeaderPage />, JOINER);
    expect(await screen.findByText('KPM ini belum punya AB atau AAB.')).toBeInTheDocument();
  });

  it('AC-1, AC-2, AC-4 Add New Agents: the leader code, the untagged pool and the team, in Indonesian', async () => {
    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/members/my-team': {
        body: [{ membershipId: 'mem-r', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '80001', role: 'agent', orgLevelCode: 'AGENT', directCount: 2, canChangeRole: true }],
      },
      '/join/untagged': { body: [{ membershipId: 'mem-b', fullName: 'Budi Santoso', initials: 'BS', agentCode: '80002' }] },
    });
    inIndonesian(<AddAgentsPage />, LEADER);
    expect((await screen.findAllByText('Budi Santoso')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Rina Wijaya')).length).toBeGreaterThan(0);
    expect(screen.getByText('Undang orang baru atau tag agen yang sudah ada ke tim Anda.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Undang seseorang' })).toBeInTheDocument();
    // UI-084: the share block's words, in both its layouts; *QR* and *WhatsApp* alike in both languages.
    expect(screen.getAllByRole('button', { name: 'Salin tautan' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Salin kode' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Tampilkan kode QR' })).toHaveTextContent('QR');
    expect(screen.getAllByRole('link', { name: 'Bagikan undangan lewat WhatsApp' })).toHaveLength(2);
    expect(screen.getAllByText('Kode leader')).toHaveLength(2);
    expect(screen.getByText('Tautan undangan')).toBeInTheDocument();
    // The leader code and its link as served.
    expect(screen.getAllByText('JOR417')).toHaveLength(2);
    expect(screen.getByText('Agen tanpa leader. Ketuk Tambahkan untuk memasukkannya ke unit Anda.')).toBeInTheDocument();
    expect(screen.getAllByText('80002 · tidak melapor ke siapa pun').length).toBeGreaterThan(0);
    // UI-082: the phone's + keeps the words as its name.
    await userEvent.click(screen.getAllByRole('button', { name: 'Tambahkan ke unit saya' })[0]);
    expect(screen.getAllByText('Tambahkan dia ke unit Anda?').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Konfirmasi' }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Batal' })[0]);

    expect(screen.getByRole('heading', { name: /^Tim Anda/ })).toBeInTheDocument();
    expect(screen.getAllByText('80001 · memimpin 2').length).toBeGreaterThan(0);
    // UI-083: the role pill, and the desktop table's columns and ⋮.
    expect(screen.getAllByRole('button', { name: 'Ubah peran Rina Wijaya, sekarang Agent' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tindakan untuk Rina Wijaya' })).toBeInTheDocument();
    expect(within(screen.getByTestId('team-table')).getByText('Kode')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 a removal asked: who reports to them counted, where they go, and REMOVE the same in both', async () => {
    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/members/my-team': {
        body: [{ membershipId: 'mem-r', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '80001', role: 'agent', orgLevelCode: 'AGENT', directCount: 2, canChangeRole: true }],
      },
      '/join/untagged': { body: [] },
    });
    inIndonesian(<AddAgentsPage />, LEADER);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ubah peran Rina Wijaya, sekarang Agent' }))[0]);
    // UI-083: *Keluarkan* last in the role sheet, red; it asks first.
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Rina Wijaya' })).getByRole('button', { name: 'Keluarkan' }));
    expect(screen.getByRole('heading', { name: 'Keluarkan Rina Wijaya?' })).toBeInTheDocument();
    expect(screen.getByText(/^Tidak ada yang dihapus\. .* di daftar Removed\.$/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '2 orang melapor kepadanya' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pindahkan mereka ke unit saya')).toBeChecked();
    expect(screen.getByLabelText('Biarkan mereka tanpa leader, untuk diambil leader lain')).toBeInTheDocument();
    expect(screen.getByLabelText('Alasan')).toHaveAttribute('placeholder', 'Keluar dari industri');
    const confirm = screen.getByLabelText('Ketik REMOVE untuk mengonfirmasi');
    expect(confirm).toHaveAttribute('placeholder', 'Ketik REMOVE');
    expect(screen.getByRole('button', { name: 'Keluarkan dari tim' })).toBeDisabled();
    await userEvent.type(confirm, 'REMOVE');
    expect(screen.getByRole('button', { name: 'Keluarkan dari tim' })).toBeEnabled();
    noEnglishLeft();
  });

  it('AC-1 a role change asked: its question and the reason’s hint in Indonesian, the role change log named', async () => {
    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/members/my-team': {
        body: [{ membershipId: 'mem-r', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '80001', role: 'agent', orgLevelCode: 'AGENT', directCount: 0, canChangeRole: true }],
      },
      '/join/untagged': { body: [] },
    });
    inIndonesian(<AddAgentsPage />, LEADER);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ubah peran Rina Wijaya, sekarang Agent' }))[0]);
    const sheet = screen.getByRole('dialog', { name: 'Rina Wijaya' });
    expect(within(sheet).getByRole('group', { name: /^Peran/ })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('radio', { name: 'AAB' }));
    // `roleChangeExplanation`'s sentence, handed the reader's language (`org.ts`).
    expect(screen.getByText(/^Rina Wijaya akan berubah dari Agent menjadi AAB\. Dia tetap melapor kepada Anda/)).toBeInTheDocument();
    expect(screen.getByLabelText('Alasan')).toHaveAccessibleDescription('Disimpan di Role change log, satu-satunya tempat ini dapat dibaca kembali.');
    expect(screen.getByRole('button', { name: 'Konfirmasi perubahan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Pending Requests: its line and the incoming requests in Indonesian, the inbox’s words its own', async () => {
    stubFetch({ '/join/requests/routing': { body: [] }, '/join/requests': { body: [joinRequest()] } });
    inIndonesian(<PendingPage />, LEADER);
    expect(await screen.findByText('Putri Anggraini')).toBeInTheDocument();
    expect(screen.getByText('Setujui atau tolak agen yang meminta di-tag ke Anda.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permintaan masuk' })).toBeInTheDocument();
    expect(screen.getByText('Setujui untuk menambahkan mereka ke unit Anda.')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'User Management' }));
    expect(tabs.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeInTheDocument();
    noEnglishLeft();
  });
});
