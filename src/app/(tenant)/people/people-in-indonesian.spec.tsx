import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { joinRequest, transfer } from '@test/joining-fixtures';
import { row } from '@test/people-fixtures';
import { leaderLimitWords } from '@/components/leader-limit-notice';
import { RequestInbox } from '@/components/request-inbox';
import { adminsMessages } from '@/i18n/messages/admins';
import { leaderLimitMessages } from '@/i18n/messages/leader-limit';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { membersMessages } from '@/i18n/messages/members';
import { orgMessages } from '@/i18n/messages/org';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { requestsMessages } from '@/i18n/messages/requests';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { requestedChange } from '@/lib/leader-limit-requests';
import { roleChangeExplanation } from '@/lib/org';
import MembersPage from './members/page';

/**
 * **The KPM's People screens in Indonesian** (P19.20; earlier P18.10-T4 AC-1 to AC-4): *All members* — its tabs, the
 * roster, the ⋯, *Menunggu* and *Riwayat* — in the approved mockups' words, each kept term English (§A), what the KPM
 * typed as typed, and no English message of the module's own left on the screen (`englishShown`). The member sheet, the
 * Org tree, KPM admins and Import people each read their Indonesian in their own spec; the request inbox a leader
 * decides from, and the module's sentences, here.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const PEOPLE_ENGLISH = englishOnly(
  membersMessages, memberSheetMessages, orgMessages, adminsMessages, orgTreeMessages, rosterImportMessages, requestsMessages,
  leaderLimitMessages,
);
const noEnglishLeft = () => expect(englishShown(document.body, PEOPLE_ENGLISH)).toEqual([]);

const OWNER = makeMe({
  user: {
    id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson',
    pronoun: 'he', initials: 'WT', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: [
    'member:read_profile', 'member:transfer_approve', 'member:tag_group', 'member:read_role_change_log',
    'leader_request:read_inbox', 'leader_request:approve', 'leader_limit_request:read', 'member:complete_personal',
  ],
});

const dewi = row({
  membershipId: 'mem-dewi', role: 'aab', orgLevelCode: 'AAB', fullName: 'Dewi Lestari', isCoreLeader: false, isLeader: false,
  directCount: 0, subtreeCount: 0, lastActivityDays: 23, lastActivityStatus: 'lapsed', lastCoachedDays: 16, lastCoachedStatus: 'lapsed',
});
const openMembers = () => stubFetch({
  '/transfer-requests': { body: [transfer()] },
  '/join/requests': { body: [] },
  '/people/history': { body: [{ id: 'h-1', kind: 'removed', membershipId: 'mem-dimas', fullName: 'Dimas Pratama', agentCode: '80102', role: 'agent', photoUrl: null, fromRole: null, toRole: null, fromLeaderName: null, toLeaderName: null, reason: null, actorName: 'Wilson Tanoto', at: '2026-10-29T02:00:00.000Z', openable: false }] },
  '/members': (req: { url: string }) => ({
    body: {
      members: req.url.includes('status=pending') ? [row({ membershipId: 'mem-fajar', fullName: 'Fajar Nugroho', status: 'pending', role: 'agent', orgLevelCode: 'AGENT', groupPlace: undefined, registeredAt: null })] : [row(), dewi],
      nextCursor: null,
      counts: { directory: 30, pending: 1, removed: 0 },
    },
  }),
} as never);

afterEach(() => vi.unstubAllGlobals());

describe('P19.20-T1 All members in Indonesian', () => {
  it('P19.20-T1 AC-1, AC-2 the tabs, Undang anggota, the filter, the columns and the pills, word for word', async () => {
    openMembers();
    renderInIndonesian(<TenantLayout><MembersPage /></TenantLayout>, { me: OWNER });

    expect(await screen.findByRole('tab', { name: 'Anggota 30' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Menunggu/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Riwayat' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Undang anggota' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari nama atau kode agen')).toBeInTheDocument();
    for (const chip of ['Semua', 'AB', 'AAB', 'Agent', '★ Core leader']) expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    await screen.findAllByText('Dewi Lestari');
    expect(document.body).toHaveTextContent('ikut AB Agus');
    expect(document.body).toHaveTextContent('9 langsung · 18 di unit');
    expect(document.body).toHaveTextContent('Hari ini');
    expect(document.body).toHaveTextContent('23 hari lalu');
    noEnglishLeft();
  });

  it('P19.20-T1 AC-3 the ⋯ in Indonesian', async () => {
    openMembers();
    renderInIndonesian(<TenantLayout><MembersPage /></TenantLayout>, { me: OWNER });

    const [first] = await screen.findAllByRole('button', { name: 'Tindakan untuk Agus Prasetyo' });
    await userEvent.click(first);
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual([
      'Hapus dari core leader', 'Jadikan group leader · Top Producers 2026', 'Ubah group', 'Ubah peran / leader', 'Keluarkan dari KPM',
    ]);
  });

  it('P19.20-T1 AC-4 Menunggu and Riwayat in Indonesian', async () => {
    openMembers();
    renderInIndonesian(<TenantLayout><MembersPage /></TenantLayout>, { me: OWNER });

    await userEvent.click(await screen.findByRole('tab', { name: /^Menunggu/ }));
    expect(await screen.findByText('Sudah daftar, belum masuk unit')).toBeInTheDocument();
    expect(await screen.findByText('Permintaan pindah unit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pilih leader' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Riwayat' }));
    for (const chip of ['Semua', 'Perubahan peran', 'Dikeluarkan', 'Pindah unit']) expect(await screen.findByRole('button', { name: chip })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Riwayat, terbaru dulu' });
    expect(within(list).getByRole('listitem')).toHaveTextContent('oleh WILSON TANOTO');
    noEnglishLeft();
  });
});

describe('P18.10-T4 the request inbox in Indonesian (a leader’s Pending Requests, Review requests on /new-hires)', () => {
  it('P18.10-T4 AC-1, AC-3 a request, where it may go, and a decline asking why', async () => {
    stubFetch({
      '/join/requests/routing': { body: [{ membershipId: 'mem-dewi', fullName: 'Sari Dewi', unitSize: 5, forLeaderMembershipId: 'mem-wilson' }] },
      '/join/requests': { body: [joinRequest({ leaderMembershipId: 'mem-wilson', leaderName: 'Wilson Tanoto', routedFromName: 'Sari Puspita' })] },
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

  it('P18.10-T4 AC-1 nothing waiting', async () => {
    stubFetch({ '/join/requests/routing': { body: [] }, '/join/requests': { body: [] }, '/members/leader-limit-requests': { body: [] } });
    renderInIndonesian(<RequestInbox />, { me: OWNER });
    expect(await screen.findByText('Tidak ada permintaan yang menunggu saat ini.')).toBeInTheDocument();
  });
});

describe('P18.10-T4 the people module’s sentences in each language', () => {
  it('P18.10-T4 AC-3 the leader limit, whole in Indonesian for each thing that meets it', () => {
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

  it('P18.10-T4 AC-3 what a request asks for, a role change’s meaning and a unit, in Indonesian', () => {
    const label = (code: string) => code;
    expect(requestedChange({ action: 'activate', fromOrgLevelCode: 'AAB', toOrgLevelCode: null }, label, 'id')).toBe('Diterima sebagai AAB');
    expect(requestedChange({ action: 'promote', fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB' }, label, 'id')).toBe('AGENT → AAB');
    expect(roleChangeExplanation('Rina', 'agent', 'aab', 'their-leader', undefined, 'id')).toBe(
      'Rina akan berubah dari Agent menjadi AAB. Dia tetap melapor kepada Anda, dan kini dapat merekrut serta mengelola agen langsungnya sendiri.',
    );
    expect(roleChangeExplanation('Rina', 'aab', 'agent', 'their-leader', undefined, 'id')).toBe(
      'Rina akan kembali dari AAB menjadi Agent. Dia tetap melapor kepada Anda, tetapi tidak lagi mengelola agen langsungnya sendiri.',
    );
  });

  // P19.12-T5 AC-4 (ADR-0248 §4): and an active member who never signed in, *Diundang* or *Belum diundang*.
  it('P18.10-T4 AC-1, P19.12-T5 AC-4 a member’s status, by its pill, in each language', async () => {
    await waitFor(() => expect(orgMessages.id.status).toEqual({
      active: 'Aktif', pending: 'Menunggu', removed: 'Dikeluarkan', invited: 'Diundang', not_invited: 'Belum diundang',
    }));
    expect(orgMessages.en.status).toEqual({
      active: 'Active', pending: 'Pending', removed: 'Removed', invited: 'Invited', not_invited: 'Not invited',
    });
  });
});
