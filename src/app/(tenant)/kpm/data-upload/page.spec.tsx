import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { cellsOf, statusOf, viewOf, V1_FILE_COLUMNS } from '@test/data-upload-fixtures';
import type { BatchView, MonthView, UploadPreview } from '@/lib/production';
import DataUploadPage from './page';
import { parseFigure } from './figure-marks';
import { monthsOf, yearsBetween } from './month-picker';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/data-upload',
}));

const EVERY = [
  'kpm:read_profile', 'data_upload:read', 'data_upload:download_template', 'data_upload:upload_and_preview',
  'data_upload:commit_import', 'data_upload:revert_batch', 'data_upload:read_history', 'data_upload:correct_cell',
  'data_upload:lock_month', 'data_upload:reopen_month',
];
const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: EVERY,
});
/** A core leader holds the Owner's Data upload (ADR-0268): the same page, the same controls. */
const CORE_LEADER = makeMe({
  membership: {
    membershipId: 'mem-cl', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4, isCoreLeader: true,
  } as never,
  permissions: EVERY,
});
const READER = makeMe({ permissions: ['kpm:read_profile', 'data_upload:read'] });
const AGENT = makeMe({ permissions: ['kpm:read_profile'] });

const OPEN = { month: '2026-11', revision: 3, locked: false, reason: 'open', editableUntil: '2026-12-07', changedAt: null, changedBy: null };
const imported = (value: number) => ({ value, provenance: 'imported' as const });

/** November 2026 as the server answers it: three members, one corrected, two codes nobody holds yet. */
function november(over: Partial<MonthView> = {}): MonthView {
  const view = viewOf([
    {
      membershipId: 'm-wilson', agentCode: '80003', name: 'Wilson Tanoto', role: 'ab', orgLevelCode: 'AB', leader: true,
      monthlyActiveAgent: true, metrics: { ape: { monthly: imported(213_540_000) }, policyCount: { monthly: imported(1) } },
    },
    {
      membershipId: 'm-dewi', agentCode: '80007', name: 'Dewi Lestari', role: 'aab', orgLevelCode: 'AAB', leader: true,
      monthlyActiveAgent: true,
      metrics: {
        ape: {
          monthly: {
            value: 71_830_000, provenance: 'corrected',
            correction: { by: 'Wilson Tanoto', at: '2026-11-19T03:42:00.000Z', reason: 'Polis susulan', fileValue: 61_830_000 },
          },
        },
      },
    },
    { membershipId: 'm-rina', agentCode: '80104', name: 'Rina Wijaya', role: 'agent', orgLevelCode: 'AGENT', monthlyActiveAgent: null },
  ], 2, '2026-11', OPEN, {
    months: [statusOf('2025-02'), statusOf('2025-03', 'missing'), statusOf('2026-10'), statusOf('2026-11')],
    completeness: statusOf('2026-11', 'incomplete'),
    unregistered: [
      { agentCode: '91200451', fileName: 'Rudi Hartono', values: { APE: { value: 124_000_000, provenance: 'imported', correction: null } }, ytd: {} },
      { agentCode: '91200452', fileName: 'Lina Marpaung', values: { APE: { value: 61_580_000, provenance: 'imported', correction: null } }, ytd: {} },
    ],
    ...over,
  });
  return view;
}

const BATCH: BatchView = {
  id: 'b-1', month: '2026-11', filename: 'template_nov_2026.xlsx', status: 'committed', templateVersion: 1, asOf: null,
  heldRowCount: 2, memberRowCount: 28, rowCount: 30, writtenRowCount: 30, cellCount: 90, issueCount: 0,
  committedAt: '2026-11-19T03:42:00.000Z', committedBy: 'Wilson Tanoto', revertedAt: null, revertedBy: null,
  restoredCellCount: 0, keptCellCount: 0, keptCorrectionCount: 0, replacedCorrectionCount: 0, canRevert: true,
};

const routes = (view: MonthView = november(), batches: BatchView[] = [BATCH]) => ({
  '/kpm/settings/branch-info': { body: { timezone: 'Asia/Jakarta' } },
  '/kpm/data-upload/history': { body: { month: view.month, batches } },
  '/kpm/data-upload/': { body: view },
});

describe('P19.21-T1 Data upload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
    window.history.replaceState(null, '', '/kpm/data-upload');
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('P19.21-T1 AC-1 offers 2024 to this year and this year’s months up to this one, green or red', () => {
    expect(yearsBetween('2024-01', '2026-11')).toEqual(['2024', '2025', '2026']);
    expect(monthsOf('2026', '2026-11')).toHaveLength(11);
    expect(monthsOf('2025', '2026-11')).toHaveLength(12);
  });

  it('P19.21-T1 AC-1 AC-2 draws Pilih bulan, then the navy month card with its count, its lock and its two buttons', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByRole('heading', { name: 'Pilih bulan' })).toBeInTheDocument();
    const months = screen.getByRole('group', { name: 'Bulan di 2026' });
    expect(within(months).getByRole('button', { name: 'Nov 2026, sudah diunggah' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(months).getAllByRole('button')).toHaveLength(11);
    expect(screen.getByText(/bulan belum diunggah di 2026 · hijau = sudah · merah = belum · data wajib sejak Jan 2024/)).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'November 2026' });
    expect(within(card).getByText('dari 3 anggota sudah punya angka')).toBeInTheDocument();
    expect(within(card).getByText('Terbuka sampai 7 Des 2026')).toBeInTheDocument();
    expect(within(card).getByText('lalu terkunci otomatis')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Kunci sekarang' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Unggah data' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'Unduh template' })).toBeInTheDocument();
    expect(within(card).getByText(/Prudential template v1/)).toBeInTheDocument();
  });

  it('P19.21-T1 AC-1 switches the year and opens an older month, missing ones red', async () => {
    const { calls } = stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    fireEvent.click(await screen.findByRole('button', { name: '2025' }));
    const months = screen.getByRole('group', { name: 'Bulan di 2025' });
    expect(within(months).getAllByRole('button')).toHaveLength(12);
    fireEvent.click(within(months).getByRole('button', { name: 'Mar 2025, belum diunggah' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/data-upload/2025-03'))).toBe(true));
  });

  it('P19.21-T1 AC-2 a past month never uploaded reads Terkunci, belum diunggah, masih bisa diunggah — and takes an upload', async () => {
    stubFetch(routes(november({
      month: '2025-03',
      state: { ...OPEN, month: '2025-03', reason: 'history', editableUntil: '2026-11-27' },
      completeness: statusOf('2025-03', 'missing'),
    })));
    window.history.replaceState(null, '', '/kpm/data-upload?month=2025-03');
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const card = await screen.findByRole('region', { name: 'Maret 2025' });
    expect(within(card).getByText('Terkunci')).toBeInTheDocument();
    expect(within(card).getByText('belum diunggah, masih bisa diunggah')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Unggah data' })).toBeEnabled();
  });

  it('P19.21-T1 AC-8 a locked month refuses the upload, and offers Buka kembali to whoever may reopen it', async () => {
    stubFetch(routes(november({ state: { ...OPEN, locked: true, reason: 'schedule', editableUntil: '2026-12-07' } })));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const card = await screen.findByRole('region', { name: 'November 2026' });
    expect(within(card).getByText('Terkunci')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Unggah data' })).toBeDisabled();
    expect(within(card).getByRole('button', { name: 'Buka kembali' })).toBeInTheDocument();
  });

  it('P19.21-T1 AC-3 the table: photo, orange AB / AAB label, NAME, code, exact rupiah, a faint dash, Aktif ✓', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table', { name: 'Angka November 2026' });
    const wilson = within(table).getByRole('rowheader', { name: /WILSON TANOTO|Wilson Tanoto/ });
    expect(wilson).toHaveTextContent('AB');
    expect(wilson).toHaveTextContent('80003');
    expect(within(table).getByRole('button', { name: /Rp 2\.135\.400$/ })).toBeInTheDocument();
    expect(within(table).getAllByLabelText('Aktif').length).toBeGreaterThan(0);
    const rina = within(table).getByRole('rowheader', { name: /Rina Wijaya/ });
    expect(rina).not.toHaveTextContent(/^AB/);
    // Found 2026-11-20 at 1280: *Rp* over *34.000.000*. Every figure is one line; the table scrolls in its own box.
    const cells = table.querySelectorAll('td[data-kode]');
    expect(cells.length).toBeGreaterThan(0);
    expect([...cells].every((cell) => cell.classList.contains('whitespace-nowrap'))).toBe(true);
  });

  it('P19.21-T1 AC-3 filters Semua · Belum dilaporkan · Dikoreksi · Belum jadi anggota, and searches by name', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const filters = await screen.findByRole('group', { name: 'Tampilkan' });
    expect(within(filters).getByRole('button', { name: 'Semua 3' })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'Dikoreksi 1' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
    fireEvent.click(within(filters).getByRole('button', { name: 'Belum jadi anggota 2' }));
    expect(within(table).getByText('Rudi Hartono')).toBeInTheDocument();
    expect(within(table).queryByText('Wilson Tanoto')).toBeNull();
    fireEvent.click(within(filters).getByRole('button', { name: 'Semua 3' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cari nama' }), { target: { value: 'dewi' } });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
  });

  it('P19.21-T1 AC-3 shows eight rows, then Lihat semua (n)', async () => {
    const people = Array.from({ length: 10 }, (_, i) => ({
      membershipId: `m-${i}`, agentCode: `8000${i}`, name: `Orang ${i}`, monthlyActiveAgent: null,
    }));
    stubFetch(routes(viewOf(people, 0, '2026-11', OPEN, { months: [statusOf('2026-11', 'missing')] })));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Lihat semua (10)' }));
    expect(within(table).getAllByRole('rowheader')).toHaveLength(10);
  });

  it('P19.21-T1 AC-9 the address fills the month and the search: the person’s row is the one shown', async () => {
    const { calls } = stubFetch(routes());
    window.history.replaceState(null, '', '/kpm/data-upload?month=2026-11&q=Dewi%20Lestari');
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table');
    expect(screen.getByRole('searchbox', { name: 'Cari nama' })).toHaveValue('Dewi Lestari');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
    expect(calls.some((c) => c.url.includes('/kpm/data-upload/2026-11'))).toBe(true);
  });

  it('P19.21-T1 AC-6 lists Belum jadi anggota after the members: grey icon, code, belum terdaftar · Undang', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Belum jadi anggota · data disimpan, masuk otomatis saat terdaftar')).toBeInTheDocument();
    const rudi = within(table).getByRole('rowheader', { name: /Rudi Hartono/ });
    expect(rudi).toHaveTextContent('91200451 · belum terdaftar · Undang');
    expect(within(rudi).getByRole('link', { name: 'Undang Rudi Hartono' })).toHaveAttribute('href', '/user-management/add');
  });

  it('P19.21-T1 AC-7 Riwayat unggah: file, day and time, by whom, n ke anggota, n belum jadi anggota', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const history = await screen.findByRole('region', { name: 'Riwayat unggah · November 2026' });
    expect(within(history).getByText('template_nov_2026.xlsx')).toBeInTheDocument();
    expect(within(history).getByText('19 Nov 2026, 10.42 · oleh Wilson Tanoto')).toBeInTheDocument();
    expect(within(history).getByText('28 ke anggota')).toBeInTheDocument();
    expect(within(history).getByText('2 belum jadi anggota')).toBeInTheDocument();
  });

  it('P19.21-T1 AC-7 says when nothing has been uploaded for the month', async () => {
    stubFetch(routes(november(), []));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByText('Belum ada unggahan untuk November 2026.')).toBeInTheDocument();
  });

  it('P19.21-T1 AC-4 a tapped number opens Koreksi with the file’s number; the reason is required; it saves', async () => {
    const { calls } = stubFetch({
      ...routes(),
      'PATCH /kpm/data-upload/cell': {
        body: { membershipId: 'm-wilson', kode: 'APE', ytd: false, changed: true, before: imported(213_540_000), after: { value: 261_200_000, provenance: 'corrected' }, state: OPEN },
      },
    });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    fireEvent.click(await screen.findByRole('button', { name: /Koreksi APE bulan ini Wilson Tanoto/ }));
    const dialog = screen.getByRole('dialog', { name: 'Koreksi APE · Wilson Tanoto' });
    expect(within(dialog).getByText('November 2026 · dari file: Rp 2.135.400')).toBeInTheDocument();
    expect(within(dialog).getByText('Tercatat: siapa, kapan, alasan. Bisa dikembalikan ke angka dari file.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('APE (Rp)'), { target: { value: '2.612.000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan koreksi' }));
    expect(await within(dialog).findByText('Tulis alasan koreksinya.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Alasan (wajib)'), { target: { value: 'Polis susulan dari laporan perusahaan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan koreksi' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent).toMatchObject({ month: '2026-11', membershipId: 'm-wilson', kode: 'APE', ytd: false, value: 261_200_000, revision: 3 });
  });

  it('P19.21-T1 AC-4 a corrected cell has its tint and ✎, says who and why, and goes back to the file’s number', async () => {
    const { calls } = stubFetch({
      ...routes(),
      'POST /kpm/data-upload/cell/restore': {
        body: { membershipId: 'm-dewi', kode: 'APE', ytd: false, changed: true, before: { value: 71_830_000, provenance: 'corrected' }, after: imported(61_830_000), state: OPEN },
      },
    });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table');
    const cell = table.querySelector('tr[data-member="m-dewi"] td[data-kode="APE"]')!;
    expect(cell).toHaveAttribute('data-corrected');
    fireEvent.click(within(cell as HTMLElement).getByRole('button'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('November 2026 · dari file: Rp 618.300')).toBeInTheDocument();
    expect(within(dialog).getByText(/Dikoreksi Wilson Tanoto · 19 Nov 2026, 10\.42: Polis susulan/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kembalikan ke angka dari file (Rp 618.300)' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/cell/restore'))).toBe(true));
    expect(await screen.findByRole('status')).toHaveTextContent('kembali ke angka dari file');
  });

  it('P19.21-T1 AC-5 Unggah data: pick a file, Lanjut, the three tiles and the sentence, then Simpan semua', async () => {
    const preview: UploadPreview = {
      month: '2026-11', filename: 'template_nov_2026.xlsx', templateVersion: 1, format: 'xlsx', encoding: 'utf-8', delimiter: ',',
      revision: 3, columns: [...V1_FILE_COLUMNS], notes: [],
      summary: { rows: 3, ready: 1, refused: 0, held: 2, newCells: 3, changedCells: 0, unchangedCells: 0, notProvidedCells: 0, refusedCells: 0, correctionCells: 0, notInFile: 2 },
      rows: [
        { line: 2, agentCode: '80003', membershipId: 'm-wilson', resolvedAgentCode: '80003', name: 'Wilson Tanoto', fileName: 'Wilson', nameDiffers: false, codeRecovered: false, status: 'ready', issues: [], cells: cellsOf({ ape: { status: 'new', after: 100 } }) },
        { line: 3, agentCode: '91200451', membershipId: null, resolvedAgentCode: null, name: null, fileName: 'Rudi Hartono', nameDiffers: false, codeRecovered: false, status: 'held', issues: [], cells: cellsOf({ ape: { status: 'new', after: 100 } }) },
        { line: 4, agentCode: '91200452', membershipId: null, resolvedAgentCode: null, name: null, fileName: 'Lina Marpaung', nameDiffers: false, codeRecovered: false, status: 'held', issues: [], cells: cellsOf({ ape: { status: 'new', after: 100 } }) },
      ],
    };
    const { calls } = stubFetch({
      ...routes(),
      'POST /kpm/data-upload/preview': { body: preview },
      'POST /kpm/data-upload/commit': { status: 201, body: { batch: { ...BATCH, rowCount: 3 }, state: OPEN } },
    });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    fireEvent.click(await screen.findByRole('button', { name: 'Unggah data' }));
    const dialog = screen.getByRole('dialog', { name: 'Unggah data November 2026' });
    expect(within(dialog).getByText('Pilih file atau tarik ke sini')).toBeInTheDocument();
    const input = dialog.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'template_nov_2026.xlsx')] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjut' }));
    expect(await within(dialog).findByText('3 baris')).toBeInTheDocument();
    expect(within(dialog).getByText('belum jadi anggota')).toBeInTheDocument();
    expect(within(dialog).getByText('semua disimpan')).toBeInTheDocument();
    expect(within(dialog).getByText(/Semua baris disimpan\. Rudi Hartono dan Lina Marpaung belum terdaftar: .* Angka dari file mengganti koreksi manual sebelumnya\./)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan semua (3 baris)' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/commit'))).toBe(true));
    const form = calls.find((c) => c.url.includes('/commit'))!.init.body as FormData;
    expect(form.get('replace')).toBeNull();
    expect(form.get('revision')).toBe('3');
    expect(await screen.findByRole('status')).toHaveTextContent('3 baris disimpan ke November 2026.');
  });

  it('P19.21-T1 AC-5 a file with a problem lists each one, and Simpan semua stays off — nothing is skipped', async () => {
    const preview = {
      month: '2026-11', filename: 'f.csv', templateVersion: 1, format: 'csv', encoding: 'utf-8', delimiter: ',', revision: 3,
      columns: [...V1_FILE_COLUMNS], notes: [],
      summary: { rows: 1, ready: 0, refused: 1, held: 0, newCells: 0, changedCells: 0, unchangedCells: 0, notProvidedCells: 0, refusedCells: 0, correctionCells: 0, notInFile: 3 },
      rows: [{ line: 2, agentCode: '', membershipId: null, resolvedAgentCode: null, name: null, fileName: 'X', nameDiffers: false, codeRecovered: false, status: 'refused', issues: [{ code: 'UPLOAD_UNKNOWN_AGENT_CODE', message: 'Baris ini tidak punya kode agen.', kode: null, ytd: null }], cells: [] }],
    };
    stubFetch({ ...routes(), 'POST /kpm/data-upload/preview': { body: preview } });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    fireEvent.click(await screen.findByRole('button', { name: 'Unggah data' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(dialog.ownerDocument.querySelector('input[type="file"]')!, { target: { files: [new File(['x'], 'f.csv')] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjut' }));
    expect(await within(dialog).findByText('1 hal perlu diperbaiki di file sebelum bisa disimpan — belum ada yang disimpan.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Baris ini tidak punya kode agen\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Simpan semua (1 baris)' })).toBeDisabled();
  });

  it('P19.21-T1 says nothing of impor anywhere on the page', async () => {
    stubFetch(routes());
    const { container } = renderInIndonesian(<DataUploadPage />, { me: OWNER });
    await screen.findByRole('table');
    expect(container.textContent?.toLowerCase()).not.toMatch(/impor/);
  });

  it('P19.21-T1 a core leader gets the same page and controls (ADR-0268)', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: CORE_LEADER });
    const card = await screen.findByRole('region', { name: 'November 2026' });
    expect(within(card).getByRole('button', { name: 'Unggah data' })).toBeInTheDocument();
  });

  it('P19.21-T1 a reader who may only read sees no upload, no lock and no tappable figure', async () => {
    stubFetch(routes());
    renderInIndonesian(<DataUploadPage />, { me: READER });
    const card = await screen.findByRole('region', { name: 'November 2026' });
    expect(within(card).queryByRole('button', { name: 'Unggah data' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Kunci sekarang' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Koreksi/ })).toBeNull();
  });

  it('P19.21-T1 refuses somebody without data_upload:read before reading anything', async () => {
    const { calls } = stubFetch(routes());
    renderWithSession(<DataUploadPage />, { me: AGENT });
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/data-upload/2026'))).toBe(false));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('P19.21-T1 shows the error and a way to try again when the month cannot be read', async () => {
    stubFetch({ ...routes(), '/kpm/data-upload/': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Boom', requestId: 'r-1' } } } });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  it('P19.21-T1 the populated page passes axe', async () => {
    stubFetch(routes());
    const { container } = renderInIndonesian(<DataUploadPage />, { me: OWNER });
    await screen.findByRole('table');
    // Colour contrast is jsdom's blind spot (no canvas); the tokens carry it (`tokens.md`).
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toEqual([]);
  });
});

describe('P19.21-T1 AC-4 what a correction’s field reads', () => {
  it('reads money as whole rupiah into sen, whatever marks group it; a percentage or a count with a decimal comma', () => {
    expect(parseFigure('rp_million', '1.612.000')).toBe(161_200_000);
    expect(parseFigure('rp_million', 'Rp 1,612,000')).toBe(161_200_000);
    expect(parseFigure('percent', '92,5')).toBe(92.5);
    expect(parseFigure('count', '3')).toBe(3);
    expect(parseFigure('count', '')).toBeNull();
    expect(parseFigure('rp_million', 'abc')).toBeUndefined();
  });
});
