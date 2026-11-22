import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { BSD, CEMPAKA, CONSOLE_SUPER_ADMIN, DASHBOARD, GADING, HOLD, MAGNI, PRU } from '@test/console-fixtures';
import { enteredKpmId, leaveKpm } from '@/lib/super-admin-kpm';
import KpmListPage from './page';

const query = vi.hoisted(() => ({ value: new URLSearchParams() }));
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/tenants',
  useSearchParams: () => query.value,
}));

const RULES = { rules: { 'color-contrast': { enabled: false } } };
const card = (id: string) => within(document.querySelector(`[data-kpm-card="${id}"]`) as HTMLElement);

/**
 * ***KPM*** (P19.23-T2 AC-1 to AC-3; ADR-0277 §2, §3): the navy tiles, the search and the filter, one card per KPM with its
 * one warning line, ⋯ with its five actions, and *KPM baru* — four fields, the code made by the server, then the Owner's
 * invitation by WhatsApp.
 */
describe('/admin/tenants — the KPM list (P19.23-T2)', () => {
  beforeEach(() => {
    atWidth(1024);
    query.value = new URLSearchParams();
    stubFetch({ '/admin/dashboard': { body: DASHBOARD } });
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T2 AC-1 the tiles: KPM · Perusahaan · Anggota · Perlu tindakan', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    const tiles = await waitFor(() => {
      const el = document.querySelector('[data-kpm-tiles]');
      if (!el) throw new Error('no tiles yet');
      return el as HTMLElement;
    });
    expect(Array.from(tiles.querySelectorAll('dd')).map((d) => d.textContent)).toEqual(['5', '3', '33', '3']);
  });

  /*
   * Found 2026-11-20: the list summed every card's members — a suspended KPM's and an ended subscription's too — and said
   * 57 under *Anggota* while the Dashboard said 54. Both read the one answer, so both count §B.45's set: the active KPMs.
   */
  it('counts Anggota as the Dashboard does — the active KPMs’ members, never a suspended or ended one’s', async () => {
    const people = { leader: { members: 2, everUsed: 0, used14: 0, powerUsers: 0 }, agent: { members: 1, everUsed: 0, used14: 0, powerUsers: 0 } };
    const kpms = DASHBOARD.kpms.map((k) => (k.kpmId === GADING || k.kpmId === HOLD ? { ...k, usage: people } : k));
    stubFetch({ '/admin/dashboard': { body: { ...DASHBOARD, kpms } } });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const tiles = document.querySelector('[data-kpm-tiles]') as HTMLElement;
    // The two hold three members each on their cards; the tile is still the Dashboard's 11 leaders + 22 agents.
    expect(card(GADING).getByText('3 anggota')).toBeInTheDocument();
    expect(Array.from(tiles.querySelectorAll('dd')).map((d) => d.textContent)[2]).toBe('33');
  });

  it('P19.23-T2 AC-1 a card: initials, name, company, owner, members, Pakai 14 hari terakhir, one line — no Aktif pill', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const bsd = card(BSD);
    expect(bsd.getByText('BC')).toBeInTheDocument();
    expect(bsd.getByText('Prudential')).toBeInTheDocument();
    expect(bsd.getByText('WILSON TANOTO')).toBeInTheDocument();
    expect(bsd.getByText('30 anggota')).toBeInTheDocument();
    // 17 of 30 used in the last 14 days: 57%, yellow.
    expect(bsd.getByText('57%')).toHaveClass('bg-pill-amber');
    expect(bsd.getByText('Tidak ada yang perlu')).toBeInTheDocument();
    expect(bsd.queryByText('Aktif')).not.toBeInTheDocument();
    // OD-477: the issue says what it means, so it never contradicts the card's *1 anggota* (the owner).
    expect(card(MAGNI).getByText('Belum ada anggota selain owner')).toBeInTheDocument();
    expect(card(CEMPAKA).getByText('Owner belum diundang')).toBeInTheDocument();
    expect(card(GADING).getByText('Langganan berakhir')).toBeInTheDocument();
    expect(card(HOLD).getByText('Ditangguhkan · anggota tidak bisa masuk')).toBeInTheDocument();
    // A suspended KPM has no share to give.
    expect(card(HOLD).getByText('–')).toBeInTheDocument();
  });

  it('P19.23-T2 AC-1 search by KPM or owner name, and the filter: Perlu tindakan, a company', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const shown = () => Array.from(document.querySelectorAll('[data-kpm-card]')).map((c) => c.getAttribute('data-kpm-card'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cari nama KPM atau owner' }), 'hadi');
    expect(shown()).toEqual([CEMPAKA]);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Cari nama KPM atau owner' }));
    await userEvent.click(screen.getByRole('button', { name: 'Perlu tindakan 3' }));
    expect(shown()).toEqual([GADING, MAGNI, CEMPAKA]);
    await userEvent.click(screen.getByRole('button', { name: 'Sejahtera Baru Life' }));
    expect(shown()).toEqual([CEMPAKA]);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cari nama KPM atau owner' }), 'zzz');
    expect(screen.getByText('Tidak ada KPM yang cocok.')).toBeInTheDocument();
  });

  it('P19.23-T2 AC-1 Masuk ke KPM enters it and opens its page', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const link = card(BSD).getByRole('link', { name: /Masuk ke KPM/ });
    expect(link).toHaveAttribute('href', `/admin/tenants/${BSD}`);
    await userEvent.click(link);
    expect(enteredKpmId()).toBe(BSD);
  });

  it('P19.27-T3 AC-4 ⋯: Kelola owner · Pindah perusahaan · Tangguhkan · Arsipkan · Hapus KPM; Kelola owner opens the KPM page’s owners', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    await userEvent.click(card(BSD).getByRole('button', { name: 'Tindakan untuk BSD City Branch' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent?.trim());
    expect(items).toEqual(['Kelola owner', 'Pindah perusahaan', 'Tangguhkan', 'Arsipkan', 'Hapus KPM']);
    // *Hapus KPM* red and last (the Super Admin spec §5); the rest navy.
    expect(screen.getByRole('menuitem', { name: 'Hapus KPM' })).toHaveClass('text-alert');
    expect(screen.getByRole('menuitem', { name: 'Arsipkan' })).not.toHaveClass('text-alert');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Kelola owner' }));
    expect(push).toHaveBeenCalledWith(`/admin/tenants/${BSD}#owners`);
    expect(enteredKpmId()).toBe(BSD);
  });

  it('P19.23-T2 AC-2 a suspended KPM offers Aktifkan lagi where Tangguhkan stood', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('Suspended Branch');
    await userEvent.click(card(HOLD).getByRole('button', { name: 'Tindakan untuk Suspended Branch' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent?.trim()))
      .toEqual(['Kelola owner', 'Pindah perusahaan', 'Aktifkan lagi', 'Arsipkan', 'Hapus KPM']);
  });

  it('P19.23-T2 AC-2 Tangguhkan asks a reason, saves it, and the list reads again', async () => {
    const { calls } = stubFetch({
      '/admin/dashboard': { body: DASHBOARD },
      [`PATCH /admin/tenants/${BSD}/status`]: { body: { _id: BSD } },
    });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    await userEvent.click(card(BSD).getByRole('button', { name: 'Tindakan untuk BSD City Branch' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tangguhkan' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Tangguhkan BSD City Branch?' }));
    await userEvent.type(sheet.getByLabelText('Alasan'), 'Belum bayar');
    await userEvent.click(sheet.getByRole('button', { name: 'Tangguhkan' }));
    await waitFor(() => expect(calls.find((c) => c.url.includes('/status'))?.init.body).toBe(JSON.stringify({ status: 'suspended', reason: 'Belum bayar' })));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/admin/dashboard'))).toHaveLength(2));
  });

  it('P19.23-T2 AC-2 Hapus KPM on a KPM that holds people: why not, and Arsipkan instead (ADR-0191 §5, OD-419)', async () => {
    stubFetch({
      '/admin/dashboard': { body: DASHBOARD },
      [`/admin/tenants/${BSD}/contents`]: { body: { members: 30, records: 412, deletable: false } },
    });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    await userEvent.click(card(BSD).getByRole('button', { name: 'Tindakan untuk BSD City Branch' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus KPM' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Hapus BSD City Branch?' }));
    expect(await sheet.findByText('KPM ini masih punya 30 anggota dan 412 data, jadi tidak bisa dihapus. Arsipkan saja.')).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Hapus KPM' })).not.toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Arsipkan' })).toBeInTheDocument();
  });

  it('P19.23-T2 AC-3 KPM baru: four fields, checked; the KPM made with no code and its Owner named by WhatsApp', async () => {
    const { calls } = stubFetch({
      '/admin/dashboard': { body: DASHBOARD },
      'POST /admin/tenants': { status: 201, body: { _id: '66f00000000000000000aaaa', branchName: 'Serpong Branch', code: '0420', invitationSent: false } },
    });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    await userEvent.click(screen.getByRole('button', { name: 'KPM baru' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'KPM baru' }));
    expect(sheet.getByText('Kode KPM dibuat otomatis. Owner menerima undangan lewat WhatsApp.')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Buat KPM & undang owner' }));
    expect(sheet.getByText('Beri nama KPM minimal 2 karakter.')).toBeInTheDocument();
    expect(sheet.getByText('Pilih perusahaannya.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);

    await userEvent.type(sheet.getByLabelText('Nama KPM'), 'Serpong Branch');
    await userEvent.click(sheet.getByRole('button', { name: /Perusahaan/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Prudential' }));
    await userEvent.type(sheet.getByLabelText('Nama owner'), 'Budi Hartono');
    await userEvent.type(sheet.getByLabelText('WhatsApp owner'), '0812 3456 7890');
    await userEvent.click(sheet.getByRole('button', { name: 'Buat KPM & undang owner' }));

    await waitFor(() => expect(calls.find((c) => c.init.method === 'POST')?.init.body).toBe(JSON.stringify({
      companyId: PRU, branchName: 'Serpong Branch', owner: { fullName: 'Budi Hartono', phone: '+6281234567890' }, sendInvitation: false,
    })));
    expect(await screen.findByText('Serpong Branch sudah dibuat · kode 0420')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kirim undangan/ })).toBeInTheDocument();
  });

  it('?created=<id> — Buat KPM & jadikan owner landing here — puts that KPM first, the others in their order (stop motion B)', async () => {
    const order = () => Array.from(document.querySelectorAll('[data-kpm-card]')).map((el) => el.getAttribute('data-kpm-card'));
    const { unmount } = renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const before = order();
    expect(before[0]).not.toBe(CEMPAKA);
    unmount();
    query.value = new URLSearchParams(`created=${CEMPAKA}`);
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect(order()).toEqual([CEMPAKA, ...before.filter((id) => id !== CEMPAKA)]);
  });

  it('P19.23-T2 AC-3 ?baru=1 — the old three-step address — opens KPM baru', async () => {
    query.value = new URLSearchParams('baru=1');
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    expect(await screen.findByRole('dialog', { name: 'KPM baru' })).toBeInTheDocument();
  });

  it('P19.27-T3 AC-3 on a phone the filter is chips — Semua · Perlu tindakan · per company — 44px, wrapping; KPM baru full width', async () => {
    atWidth(375);
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect(screen.getByRole('button', { name: 'KPM baru' })).toHaveClass('max-md:w-full');
    const chips = document.querySelector('[role="group"][aria-label="Tampilkan"]') as HTMLElement;
    expect(chips).not.toHaveClass('max-md:hidden');
    // They wrap onto a second line rather than scroll in their own box, so none is cut (UI-207; the walk of 2026-11-22).
    expect(chips).toHaveClass('flex-wrap');
    expect(chips).not.toHaveClass('max-md:overflow-x-auto');
    expect(chips).not.toHaveClass('max-md:flex-nowrap');
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua 5', 'Perlu tindakan 3', 'Prudential', 'Sejahtera Baru Life']);
    expect(within(chips).getByRole('button', { name: 'Semua 5' })).toHaveClass('max-md:h-11');
    // No dropdown in its place any more.
    expect(screen.queryByRole('button', { name: /^Tampilkan/ })).not.toBeInTheDocument();
  });

  it('P19.27-T3 AC-1, AC-2 on a phone a card is one tap into the KPM: name, company · n anggota, ♛ FIRST OWNER +n, %, one warning', async () => {
    atWidth(375);
    const kpms = DASHBOARD.kpms.map((k) => (k.kpmId === BSD ? { ...k, ownerNames: ['WILSON TANOTO', 'SARI PUSPITA'] } : k));
    stubFetch({ '/admin/dashboard': { body: { ...DASHBOARD, kpms } } });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const bsd = document.querySelector(`[data-kpm-card="${BSD}"]`) as HTMLElement;
    expect(bsd).toHaveTextContent('Prudential · 30 anggota');
    expect(bsd).toHaveTextContent('WILSON TANOTO+1');
    expect(bsd).toHaveTextContent('dan 1 owner lain');
    // The whole card is the link; no *Masuk ke KPM →* row and no *Tidak ada yang perlu*.
    const link = card(BSD).getByRole('link', { name: 'Masuk ke KPM · BSD City Branch' });
    expect(link).toHaveAttribute('href', `/admin/tenants/${BSD}`);
    expect(bsd).not.toHaveTextContent('Tidak ada yang perlu');
    expect(card(BSD).getAllByRole('link')).toHaveLength(1);
    await userEvent.click(link);
    expect(enteredKpmId()).toBe(BSD);
    // One warning pill, only when there is one: Cempaka's first.
    expect(document.querySelector(`[data-kpm-card="${CEMPAKA}"] [data-kpm-issue]`)).toHaveTextContent('Owner belum diundang');
    expect(document.querySelector(`[data-kpm-card="${BSD}"] [data-kpm-issue]`)).toBeNull();
  });

  it('P19.27-T3 AC-2 a KPM with nobody besides its owner says “1 anggota” once, never beside “Belum ada anggota” (OD-454)', async () => {
    atWidth(375);
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('Magni');
    const magni = document.querySelector(`[data-kpm-card="${MAGNI}"]`) as HTMLElement;
    expect(magni).toHaveTextContent('Prudential · 1 anggota');
    expect(magni).not.toHaveTextContent('Belum ada anggota');
    expect(magni.querySelector('[data-kpm-issue]')).toBeNull();
    // Still *Perlu tindakan*: the filter finds it.
    await userEvent.click(screen.getByRole('button', { name: 'Perlu tindakan 3' }));
    expect(screen.getByText('Magni')).toBeInTheDocument();
  });

  it('OD-477 a KPM in its trial with nothing to act on reads *Trial n hari* on a phone; not from 768px', async () => {
    const trial = { ...DASHBOARD, kpms: DASHBOARD.kpms.map((k) => (k.kpmId === BSD ? { ...k, trialDaysLeft: 30 } : k)) };
    stubFetch({ '/admin/dashboard': { body: trial } });
    atWidth(375);
    const { unmount } = renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    const bsd = document.querySelector(`[data-kpm-card="${BSD}"]`) as HTMLElement;
    expect(bsd.querySelector('[data-kpm-trial]')).toHaveTextContent('Trial 30 hari');
    expect(bsd.querySelector('[data-kpm-issue]')).toBeNull();
    // A KPM with something to act on shows that, never the trial.
    expect(document.querySelector(`[data-kpm-card="${CEMPAKA}"] [data-kpm-trial]`)).toBeNull();
    unmount();
    atWidth(1024);
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect(document.querySelector('[data-kpm-trial]')).toBeNull();
  });

  it('P19.27-T3 AC-5 on a phone the two notes are not drawn; from 768px they read as before', async () => {
    atWidth(375);
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect(screen.getByText('Ketuk KPM = masuk sebagai owner-nya').closest('ul')).toHaveClass('max-md:hidden');
    expect(screen.getByText('⋯ = kelola owner, pindah perusahaan, tangguhkan, arsipkan, hapus')).toBeInTheDocument();
  });

  it('P19.27-T3 the search finds a KPM by any of its owners', async () => {
    const kpms = DASHBOARD.kpms.map((k) => (k.kpmId === BSD ? { ...k, ownerNames: ['WILSON TANOTO', 'SARI PUSPITA'] } : k));
    stubFetch({ '/admin/dashboard': { body: { ...DASHBOARD, kpms } } });
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    await userEvent.type(screen.getByRole('searchbox'), 'sari');
    expect(screen.getByText('BSD City Branch')).toBeInTheDocument();
    expect(screen.queryByText('Magni')).not.toBeInTheDocument();
  });

  it('P19.23-T2 axe on the populated list', async () => {
    const { container } = renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the console’s own is left', async () => {
    renderInIndonesian(<KpmListPage />, { me: CONSOLE_SUPER_ADMIN });
    await screen.findByText('BSD City Branch');
    expect(englishShown(document.body, englishOnly(adminConsoleMessages))).toEqual([]);
  });
});
