import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, renderInIndonesian, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { activationView, leaderView, ROSTER, rinaItems, SARI, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, requestedTransfer, TODAY } from '@test/joining-fixtures';
import { activationMessages } from '@/i18n/messages/activation';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import NewHireDetailPage from './[membershipId]/page';
import NewHiresPage from './page';

/**
 * **New Hires in Indonesian** (P18.98-T4; **UI V1, UI-023 to UI-027**): `/new-hires` — *Aktivasi 3M*, *Menunggu
 * bergabung*, *Semua · Teraktivasi · Belum*, the leader tree, *Pecah telor di hari ke-X* / *Hari ke-X*, the invitations'
 * sheet, *+ Tambah agent*'s modal — and one hire's `/new-hires/[membershipId]` — the strip, *Hari*, *3M selesai*, *Koreksi
 * tanggal bergabung*, *Kapan pecah telor?*. The report's words where it gives them, each kept term English, and no
 * English message of these modules left (`englishShown`).
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

const ENGLISH = englishOnly(newHiresMessages, activationMessages, addAgentMessages);
const noEnglishLeft = (root: Element = document.body) => expect(englishShown(root, ENGLISH)).toEqual([]);

const AGUS = {
  ...SARI_ME,
  user: { ...SARI_ME.user, id: 'u-agus', fullName: 'Agus Prasetyo', preferredName: 'Agus', initials: 'AP' },
  membership: { ...SARI_ME.membership!, membershipId: 'mem-agus', hierarchyRole: 'ab' as const, orgLevelCode: 'AB' },
  permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS, 'calendar_entry:create', 'member:update_phone'],
};

const list = (routes: Record<string, StubReply | StubReply[]> = {}) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/new-hires': { body: ROSTER },
    '/new-hires/invites': { body: { today: TODAY, invites: [invite()] } },
    '/new-hires/transfers': { body: [requestedTransfer()] },
    '/join/requests': { body: [] },
    '/join/requests/routing': { body: [] },
    '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
    ...routes,
  });
  renderInIndonesian(<AgentLayout><NewHiresPage /></AgentLayout>, { me: AGUS });
  return stub;
};

const STANDING = {
  status: 'activated', activation3M: 'activated', joinDate: '2026-08-06', day: 59, firstSaleDate: '2026-09-04',
  firstSaleDay: 30, firstSaleSource: 'sales', leader: { ...SARI, role: 'aab' }, phone: null,
} as const;

const detail = (body: object = { ...leaderView(), newHire: STANDING }) => {
  stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body } });
  renderInIndonesian(<AgentLayout><NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} /></AgentLayout>, { me: AGUS });
};

afterEach(() => vi.unstubAllGlobals());

describe('UI V1 /new-hires in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same page in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(100);
    atWidth(375);
    stubFetch({ ...SHELL_STUBS, '/new-hires': { body: ROSTER } });
    renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
    await screen.findByRole('group', { name: 'Show' });
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['Show', 'No checklist', 'Activated after 3M']));
  });

  it('UI-023, UI-024 below 768px: Aktivasi 3M, Menunggu bergabung, the filter and the tree in the report’s words', async () => {
    atWidth(375);
    list();
    expect(await screen.findByRole('region', { name: 'Aktivasi 3M' })).toHaveTextContent(/^Aktivasi 3M80%$/);
    expect(screen.getByRole('button', { name: 'Menunggu bergabung: 2. Tampilkan' })).toBeInTheDocument();
    const filter = screen.getByRole('group', { name: 'Tampilkan' });
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua 9', 'Teraktivasi 5', 'Belum 4']);
    const own = await screen.findByRole('group', { name: 'Agus Prasetyo' });
    expect(own).toHaveTextContent('Anda · Direct Unit · 5');
    expect(own).toHaveTextContent('Pecah telor di hari ke-39');
    expect(own).toHaveTextContent('Hari ke-38');
    expect(own).toHaveTextContent('Tanpa checklist');
    expect(screen.getByRole('group', { name: 'Sari Puspita' })).toHaveTextContent('AAB · 2');
    // UI-025, UI-026: no Keluar, no Tandai keluar, no terlambat.
    expect(document.body).not.toHaveTextContent(/Keluar|Tandai keluar|terlambat/);
    noEnglishLeft();
  });

  it('UI-024 the invitations’ sheet and its ⋯ in Indonesian, Batalkan undangan last', async () => {
    atWidth(375);
    list();
    await userEvent.click(await screen.findByRole('button', { name: 'Menunggu bergabung: 2. Tampilkan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Menunggu bergabung' });
    expect(sheet).toHaveTextContent('Diundang, menunggu bergabung');
    expect(sheet).toHaveTextContent('Pemindahan diajukan');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Tindakan untuk Yusuf Hidayat' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Kirim ulang', 'Batalkan undangan']);
    noEnglishLeft(sheet);
  });

  it('UI-024 + Tambah agent: the centred modal’s share block and the four fields in the report’s words', async () => {
    atWidth(375);
    list();
    await userEvent.click((await screen.findAllByRole('button', { name: '+ Tambah agent' }))[0]);
    const modal = await screen.findByRole('dialog', { name: 'Tambah agent' });
    expect(await within(modal).findByText('AGUS01')).toBeInTheDocument();
    expect(modal).toHaveTextContent('Kode leader');
    expect(modal).toHaveTextContent('atau kirim undangan langsung');
    expect(modal).toHaveTextContent('Ada di kontrak agen.');
    expect(modal).toHaveTextContent('Link undangan dikirim ke nomor ini.');
    expect(within(modal).getByLabelText('Nama')).toHaveAttribute('placeholder', 'Nama lengkap');
    expect(screen.getByRole('button', { name: 'Tambah & kirim undangan' })).toBeDisabled();
    // No *Masih diperlukan…* line on the screen: a screen reader alone hears it.
    expect(within(modal.ownerDocument.body).getByText(/^Masih diperlukan/)).toHaveClass('sr-only');
  });

  it('UI-024 from 768px: Nama · Status · Checklist, the status pills, the right column', async () => {
    atWidth(1280);
    list();
    const table = await screen.findByRole('table', { name: 'New Hires' });
    expect(within(table).getAllByRole('columnheader').filter((h) => h.getAttribute('scope') === 'col').map((h) => h.textContent))
      .toEqual(['Nama', 'Status', 'Checklist']);
    expect(within(table).getByRole('link', { name: 'Lukman Hakim' }).closest('tr')).toHaveTextContent('Teraktivasi, lewat 3MPecah telor di hari ke-96');
    expect(within(table).getByRole('link', { name: 'Kemal Pratama' }).closest('tr')).toHaveTextContent('BelumHari ke-110');
    noEnglishLeft();
  });
});

describe('UI V1 /new-hires/[membershipId] in Indonesian', () => {
  it('UI-027 the header, the strip, Hari and the buttons; ⋯ → Koreksi tanggal bergabung', async () => {
    atWidth(375);
    detail();
    const header = await screen.findByTestId('hire-header-phone');
    expect(header).toHaveTextContent('AAB Sari Puspita · Bergabung 6 Agu 2026');
    expect(within(header).getByRole('link', { name: 'Kembali ke New Hires' })).toBeInTheDocument();
    expect(screen.getByTestId('first-sale-strip')).toHaveTextContent('Teraktivasi · pecah telor hari ke-30');
    expect(screen.getByText('Hari').parentElement).toHaveTextContent('Hari59 /90');
    expect(screen.getByRole('link', { name: 'Jadwalkan 1:1 dengan Rina Wijaya' })).toBeInTheDocument();
    await userEvent.click(within(header).getByRole('button', { name: 'Pilihan lain untuk Rina Wijaya' }));
    expect(screen.getByRole('menuitem', { name: 'Koreksi tanggal bergabung' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-023 after day 90: lewat 3M in amber, and 3M selesai', async () => {
    atWidth(375);
    detail({ ...leaderView({ day: 96 }), newHire: { ...STANDING, status: 'activated_late', day: 96, firstSaleDay: 96 } });
    expect(await screen.findByTestId('first-sale-strip')).toHaveTextContent('Teraktivasi · pecah telor hari ke-96 · lewat 3M');
    expect(screen.getByText('Hari').parentElement).toHaveTextContent('3M selesai');
  });

  it('D-26 Kapan pecah telor? — Isi tanggal, the range and Simpan', async () => {
    atWidth(375);
    const items = rinaItems().map((l) => l.map((it) => ({
      ...it, note: null, date: null,
      ...(it.code === 'FIRST_CASE_CLOSED' ? { done: false, doneAt: null, source: null, doneBy: null, record: null } : {}),
    })));
    detail({ ...activationView({}, items), newHire: { ...STANDING, status: 'not_yet', firstSaleDate: null, firstSaleDay: null, firstSaleSource: null } });
    await screen.findByTestId('hire-header-phone');
    await userEvent.click(screen.getByRole('button', { name: /Penjualan pertama|First Sale/ }));
    await userEvent.click(screen.getByRole('button', { name: /: Isi tanggal$/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Kapan pecah telor?' });
    expect(sheet).toHaveTextContent('Tanggal first case ditutup sendiri · antara 6 Agu 2026 dan hari ini');
    expect(within(sheet).getByLabelText('Tanggal pecah telor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });
});
