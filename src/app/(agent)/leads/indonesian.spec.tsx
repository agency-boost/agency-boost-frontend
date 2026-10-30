import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { leadsMessages } from '@/i18n/messages/leads';
import { flagLabel, phoneHeld } from '@/lib/leads';
import { PHONE_QUERY } from '@/lib/use-phone';
import LeadsPage from './page';
import { LeadsTable } from '@/components/leads-table';

/**
 * **Leads Management in ID mode** (P18.98-T4 AC-1 to AC-4, field selling): `/leads` — the table, its search and
 * filters, its ⋮ menu and questions, the lead's details, the closed cards, and on a phone the cards and the edit sheet —
 * in the approved glossary's Indonesian, each kept term English (§A: the title, *lead* / *leads*, *Sales*, *Recruit*,
 * *Closing*), what the office and the agent typed as typed, the figures Indonesian, and no English message of the
 * module's own left on the screen (`englishShown`). English is `page.spec.tsx`'s, unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

const LEADS_ENGLISH = englishOnly(leadsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, LEADS_ENGLISH)).toEqual([]);

const AGENT = makeMe({
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

/** The office's two ladders, in its own words — shown as typed in both languages. */
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      { id: 's1', pipeline: 'sales', code: 'BELUM_DIDEKATI', label: 'Belum didekati', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Sudah di-follow up', rank: 2, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
      { id: 's3', pipeline: 'sales', code: 'POLIS_TERBIT', label: 'Polis terbit', rank: 3, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      { id: 'r1', pipeline: 'recruitment', code: 'AAJI', label: 'Lulus AAJI', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
    ],
  },
];

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Pak Budi', contact: { phone: null, email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, remarks: 'Hobi golf', nextActionDate: '2026-10-02',
  nextActionNote: 'Kopi jam 10', outcome: null, source: null, dateRegistered: '2026-10-04T03:00:00.000Z', version: 2,
  flags: [], overdueDays: null, committedMonths: [], lastEditedBy: null, ...over,
});

const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({
  rows, total: rows.length, page: 1, pageSize: 200, ...over,
});

const BASE = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'outcome=won': { body: page([]) },
  'outcome=lost': { body: page([]) },
};

const render = (routes: Record<string, unknown>) => {
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInIndonesian(<AgentLayout><LeadsPage /></AgentLayout>, { me: AGENT });
  return stub;
};

/** A phone, as far as the screen can ask: `matchMedia`, which jsdom does not have. */
const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  media: query, matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
})));

describe('P18.98-T4 Leads Management in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 heads the table, its toolbar and its closed cards in Indonesian, the title and the kept terms English', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    expect(screen.getByRole('heading', { name: 'Leads Management', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Pantau dan follow up leads sales dan recruitment Anda.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Leads Anda' });
    // A sortable heading's ⇅ is its button's glyph, not a word.
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent!.replace(/[⇅↑↓]/g, ''))).toEqual([
      'Baris', 'Nama lead', 'Jenis', 'Status', 'Bulan ini', 'Keterangan', 'Tindakan berikutnya', 'Aksi',
    ]);
    expect(screen.getByText('1 lead aktif')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah lead' })).toBeInTheDocument();

    // The search and its two filters (P18.95-T4 AC-2): *Sales* and *Recruit* are the two types' names, kept.
    const bar = within(screen.getByRole('search', { name: 'Cari dan filter leads' }));
    expect(bar.getByRole('searchbox', { name: 'Cari leads' })).toHaveAttribute('placeholder', 'Cari leads…');
    const options = (label: string) => within(bar.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);
    expect(options('Filter menurut jenis')).toEqual(['Semua jenis', 'Sales', 'Recruit']);
    expect(options('Filter menurut status')[0]).toBe('Semua status');

    // A row's controls, named for their row; the promise beside the box says which it is.
    expect(screen.getByRole('textbox', { name: 'Nama lead, baris 1' })).toHaveAttribute('placeholder', 'Nama lengkap');
    expect(screen.getByRole('combobox', { name: 'Jenis, baris 1' })).toHaveValue('sales');
    expect(screen.getByRole('checkbox', { name: 'Closing bulan ini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aksi untuk Pak Budi' })).toBeInTheDocument();

    // The closed cards.
    expect(screen.getByRole('heading', { name: 'Leads yang ditutup' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '✓ Berhasil' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '✕ Tidak berhasil' })).toBeInTheDocument();
    expect(await screen.findByText('Belum ada leads yang berhasil.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada leads yang tidak berhasil.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-4 shows what the agent and the office typed as typed: the lead, its remark and the office’s stages', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    expect(screen.getByDisplayValue('Hobi golf')).toBeInTheDocument();
    const status = screen.getByRole('combobox', { name: 'Status, baris 1' });
    expect(within(status).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Pilih status', 'Belum didekati', 'Sudah di-follow up', 'Polis terbit']);
  });

  it('AC-1 says the ⋮ menu, its held reason, and the questions in Indonesian', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Pak Budi' }));
    const menu = within(screen.getByRole('menu'));
    expect(menu.getByRole('menuitem', { name: 'Detail lead' })).toBeInTheDocument();
    const won = menu.getByRole('menuitem', { name: 'Tandai berhasil' });
    expect(won).toHaveAccessibleDescription('Tersedia setelah status mencapai tahap akhir');
    expect(menu.getByRole('menuitem', { name: 'Hapus' })).toBeInTheDocument();
    await userEvent.click(menu.getByRole('menuitem', { name: 'Tandai tidak berhasil' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Tandai Pak Budi sebagai tidak berhasil? Ini memindahkannya ke daftar yang ditutup.'))
      .toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Tandai tidak berhasil' })).toBeInTheDocument();
  });

  it('AC-1 asks before changing the type, in Indonesian', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Jenis, baris 1' }), 'recruitment');
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/^Mengubah jenis akan menghapus tahap lead ini/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Ubah jenis' })).toBeInTheDocument();
  });

  it('AC-1 opens the lead’s details in Indonesian, the day in Indonesian figures', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Pak Budi' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Detail lead' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail lead untuk Pak Budi' }));
    expect(dialog.getByLabelText('Telepon')).toBeInTheDocument();
    expect(dialog.getByLabelText('Email')).toBeInTheDocument();
    expect(dialog.getByLabelText('Sumber lead')).toHaveAttribute('placeholder', 'mis. Referensi dari Desi');
    expect(dialog.getByText('Terdaftar', { exact: false })).toHaveTextContent('Terdaftar 4 Okt 2026');
    expect(dialog.getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 refuses a name too short beneath it, in one Indonesian sentence', async () => {
    render({ '/leads': { body: page([]) } });
    expect(await screen.findByText('Belum ada leads — tambahkan yang pertama di atas.')).toBeInTheDocument();
    expect(screen.getByText('0 leads aktif')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ Tambah lead' }));
    expect(screen.getByRole('button', { name: 'Aksi untuk lead baru' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Nama lead, baris 1' }), 'A');
    await userEvent.tab();
    expect(await screen.findByText('Nama lead minimal 2 karakter.')).toBeInTheDocument();
  });

  it('AC-3 counts what a filter matched, a kept noun in its English plural', async () => {
    render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati' })]) } });
    await screen.findByDisplayValue('Pak Budi');
    expect(screen.getByText('2 leads aktif')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter menurut jenis'), 'sales');
    expect(await screen.findByText('2 leads aktif yang cocok')).toBeInTheDocument();
  });

  it('AC-1 holds 📞 and WhatsApp with the reason in Indonesian', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    for (const name of ['Telepon Pak Budi', 'Kirim pesan WhatsApp ke Pak Budi']) {
      const held = screen.getByRole('button', { name });
      expect(held).toHaveAccessibleDescription('Belum ada nomor telepon — tambahkan di Detail lead.');
    }
  });

  // The table's own phone layout, which the coaching session's card still draws: `/leads` draws the compact list (UI-105).
  it('AC-1 draws the table’s phone card and its edit sheet in Indonesian, the day in Indonesian figures', async () => {
    onPhone();
    stubFetch({ ...BASE, '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati', type: null, statusCode: null, remarks: null, nextActionDate: null, nextActionNote: null })]) } } as Parameters<typeof stubFetch>[0]);
    renderInIndonesian(<AgentLayout><LeadsTable /></AgentLayout>, { me: AGENT });
    const list = await screen.findByRole('list', { name: 'Leads Anda' });
    const [budi, wati] = within(list).getAllByRole('listitem');

    expect(within(budi).getByRole('button', { name: 'Ubah Pak Budi' })).toBeInTheDocument();
    expect(within(budi).getByText('Sales')).toBeInTheDocument();
    expect(within(budi).getByText('Sudah di-follow up')).toBeInTheDocument();
    expect(within(budi).getByText('Tindakan berikutnya')).toBeInTheDocument();
    expect(within(budi).getByText('2 Okt 2026 · Kopi jam 10')).toBeInTheDocument();
    expect(within(budi).getByText('Keterangan')).toBeInTheDocument();
    expect(within(wati).getByText('Belum ada jenis')).toBeInTheDocument();

    const sort = screen.getByRole('combobox', { name: 'Urutkan leads' });
    expect(within(sort).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Urutan tersimpan', 'Nama A–Z', 'Nama Z–A', 'Sales lebih dulu', 'Recruit lebih dulu',
      'Tahap paling awal lebih dulu', 'Tahap paling jauh lebih dulu',
    ]);

    await userEvent.click(within(budi).getByRole('button', { name: 'Ubah Pak Budi' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ubah Pak Budi' }));
    for (const label of ['Nama lead', 'Jenis', 'Status', 'Keterangan', 'Tanggal tindakan berikutnya', 'Catatan tindakan berikutnya']) {
      expect(sheet.getByLabelText(label)).toBeInTheDocument();
    }
    expect(sheet.getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-105 says the compact list in Indonesian: the search, the chips, the strip, the cards and the + — the stages as typed', async () => {
    onPhone();
    render({
      '/leads': { body: page([
        lead(),
        lead({ id: 'l2', name: 'Ibu Wati', statusCode: 'BELUM_DIDEKATI', nextActionDate: null, nextActionNote: null }),
        lead({ id: 'l3', name: 'Mas Andi', type: 'recruitment', statusCode: 'AAJI' }),
      ]) },
    });
    const list = await screen.findByRole('list', { name: 'Leads Anda' });

    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari nama lead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter dan urutan' })).toBeInTheDocument();
    const chips = screen.getByRole('group', { name: 'Jenis lead' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua3', 'Sales2', 'Recruit1']);
    const strip = screen.getByRole('group', { name: 'Pipeline Sales' });
    // A seeded stage's short word by its code (D-18's *Follow-up*); a stage the office added, in its own words.
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual(['1Belum didekati', '1Follow-up', '0Polis terbit']);
    expect(within(strip).getByRole('button', { name: 'Follow-up (Sudah di-follow up), 1 lead' })).toBeInTheDocument();
    const [budi, wati] = within(list).getAllByRole('listitem');
    expect(within(budi).getByText('Sudah di-follow up')).toBeInTheDocument();
    expect(within(wati).getByText('Isi tindakan')).toBeInTheDocument();
    expect(within(budi).getByRole('button', { name: 'Kirim pesan WhatsApp ke Pak Budi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah lead' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-105 says the lead sheet in Indonesian: Jenis, Status, Tindakan berikutnya, Keterangan, Riwayat, Hapus and Simpan', async () => {
    onPhone();
    render({
      '/leads': { body: page([lead()]) },
      '/leads/l1': { body: { ...lead(), history: [{ at: '2026-10-27T03:00:00.000Z', fromStatusCode: null, toStatusCode: 'FOLLOW_UP' }] } },
    });
    const list = await screen.findByRole('list', { name: 'Leads Anda' });
    await userEvent.click(within(list).getByRole('button', { name: 'Pak Budi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pak Budi' });
    const sheet = within(dialog);
    expect(dialog).toHaveAccessibleDescription('Sudah di-follow up · Sales');
    for (const label of ['Jenis', 'Status', 'Tindakan berikutnya', 'Detail']) expect(sheet.getByText(label)).toBeInTheDocument();
    expect(sheet.getByLabelText('Keterangan')).toHaveValue('Hobi golf');
    expect(await sheet.findByText('27 Okt')).toBeInTheDocument();
    expect(sheet.getByText(/Status → Sudah di-follow up/)).toBeInTheDocument();
    expect(sheet.getByText(/Lead ditambahkan/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Hapus' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(sheet.getByText('Tersimpan ✓')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('radio', { name: 'Recruit' }));
    expect(sheet.getByText('Belum disimpan')).toBeInTheDocument();
    expect(sheet.getByRole('radio', { name: 'Lulus AAJI' })).toBeChecked();
    noEnglishLeft();
  });
});

describe('P18.98-T4 lib/leads in Indonesian', () => {
  it('names a flag in the reader’s words, the server’s count of days in both', () => {
    expect(flagLabel('overdue', 14, 'id')).toBe('Terlambat 14 hari');
    expect(flagLabel('overdue', 1, 'id')).toBe('Terlambat 1 hari');
    expect(flagLabel('overdue', null, 'id')).toBe('Terlambat');
    expect(flagLabel('no-next-action', null, 'id')).toBe('Tanpa tindakan berikutnya');
    expect(flagLabel('no-remarks', null, 'id')).toBe('Tanpa keterangan');
    // English when no language is passed: every caller not moved reads as before.
    expect(flagLabel('overdue', 14)).toBe('Overdue 14 days');
    expect(flagLabel('overdue', 1)).toBe('Overdue 1 day');
  });

  it('says why a phone is held in the reader’s words', () => {
    expect(phoneHeld(null, 'id')).toBe('Belum ada nomor telepon — tambahkan di Detail lead.');
    expect(phoneHeld('123', 'id')).toBe('Nomor ini tidak dapat dihubungi — periksa di Detail lead.');
    expect(phoneHeld('0812-1100-2200', 'id')).toBeNull();
    expect(phoneHeld(null)).toBe('No phone number yet — add one in Lead details.');
  });

  it('lists, as the module’s English a screen in Indonesian must not show, its own words and none it keeps', () => {
    expect(LEADS_ENGLISH).toEqual(expect.arrayContaining(['Lead name', 'Show more', 'Closed leads']));
    for (const keptTerm of ['Sales', 'Recruit', 'Leads Management', 'Status', 'Email', 'WhatsApp']) {
      expect(LEADS_ENGLISH).not.toContain(keptTerm);
    }
  });
});
