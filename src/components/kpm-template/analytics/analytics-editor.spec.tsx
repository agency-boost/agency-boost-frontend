import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, renderWithSession, routeParams, stubFetch, wears, type StubReply } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { DEFAULT_TEMPLATE, PRUDENTIAL, SUPER_ADMIN, kindView } from '@test/kpm-template-fixtures';
import { analyticsV1, EDITOR_VIEW } from '@test/analytics-fixtures';
import type { AdvancedAnalyticsConfig } from '@/lib/advanced-analytics';
import SectionPage from '@/app/(admin)/admin/companies/[companyId]/templates/[templateId]/[section]/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/analytics',
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const KIND = '/admin/companies/c1/template/advanced_analytics';
const SAVED = { timeout: 3000 };

/** The section's read: version 1 published, the editor's view beside it. */
const read = (payload: AdvancedAnalyticsConfig = analyticsV1(), over: Record<string, unknown> = {}) =>
  kindView('advanced_analytics', payload as unknown as Record<string, unknown>, {
    analytics: EDITOR_VIEW, published: { id: 'row', version: 1, revision: 1, payload, publishedAt: null }, revision: 1, ...over,
  });

function render(tab: string, routes: Record<string, StubReply | StubReply[]> = {}, language: 'id' | 'en' = 'id') {
  window.history.replaceState(null, '', `/#${tab}`);
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE] },
    [KIND]: { body: read() },
    [`${KIND}/code-check`]: { body: { mismatched: 0, total: 5, examples: [], exampleMatches: true } },
    [`${KIND}/open-runs`]: { body: { nps: { runs: 0, kpms: 0 }, qual: { runs: 0, kpms: 0 } } },
    [`PUT ${KIND}`]: ({ body }) => ({ body: read((body as { payload: AdvancedAnalyticsConfig }).payload, { status: 'draft', version: 2, revision: 2 }) }),
    ...routes,
  });
  const ui = <SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section: 'analytics' })} />;
  const view = language === 'id' ? renderInIndonesian(ui, { me: SUPER_ADMIN }) : renderWithSession(ui, { me: SUPER_ADMIN });
  return { ...view, stub };
}

/** The draft the last save sent. */
const lastSaved = (stub: ReturnType<typeof stubFetch>) => {
  const puts = stub.calls.filter((c) => c.init.method === 'PUT');
  return (JSON.parse(String(puts[puts.length - 1].init.body)) as { payload: AdvancedAnalyticsConfig }).payload;
};

/**
 * **P19.5-T1 — the template's *Advanced analytics* section** (AC-1 and AC-4 to AC-15, AC-19): the mockup's four tabs,
 * their copy verbatim in Indonesian, the locks the API holds too, the code check, the publish dialogs, at a phone's
 * width and a laptop's.
 */
describe('P19.5-T1 the template’s Advanced analytics section', () => {
  beforeEach(() => atWidth(1280));
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-1 the section and its four pill tabs', () => {
    it('P19.5-T1 AC-1 is named Advanced analytics, with its four tabs, the save bar and the ID|EN switch', async () => {
      render('bagian');
      expect(await screen.findByRole('heading', { level: 1, name: 'Advanced analytics' })).toBeInTheDocument();
      const pills = await screen.findByRole('navigation', { name: /Advanced analytics/ });
      expect(within(pills).getAllByRole('link').map((a) => a.textContent))
        .toEqual(['Bagian', 'Data upload', 'Survei', 'Ambang & benchmark']);
      expect(within(pills).getByRole('link', { name: 'Bagian' })).toHaveAttribute('aria-current', 'page');
      expect(await screen.findByText('Terbit v1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'ID' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('AC-4 Bagian', () => {
    it('P19.5-T1 AC-4 lists the six sections with their kode, description, needs, ↑ ↓ and a switch; says nothing about hiding Data upload', async () => {
      render('bagian');
      expect(await screen.findByRole('heading', { name: 'Bagian yang tampil di KPM' })).toBeInTheDocument();
      expect(screen.getByText('KPM tidak bisa menyalakan bagian yang dimatikan di sini. Urutan di sini adalah urutan tab di KPM.')).toBeInTheDocument();
      expect(screen.getByText('6 dari 6 aktif')).toBeInTheDocument();
      for (const name of ['Demografi KPM', 'MAPA driver', 'NPS KPM', 'Analitik kuantitatif', 'Analitik kualitatif', 'Perbaikan sub-group']) {
        expect(screen.getByRole('switch', { name: `Tampilkan ${name}` })).toBeChecked();
      }
      expect(screen.getAllByText('Butuh: Data upload')).toHaveLength(3);
      expect(screen.getByText('Mematikan sebuah bagian tidak menghapus datanya. Menyalakannya lagi akan menampilkan data lama.')).toBeInTheDocument();
      expect(screen.queryByText(/Data upload disembunyikan/)).toBeNull();
      await clean();
    });

    it('P19.5-T1 AC-4 turns a section off and moves one down, the order being the KPM’s tab order', async () => {
      const { stub } = render('bagian');
      await userEvent.click(await screen.findByRole('switch', { name: 'Tampilkan Demografi KPM' }));
      await userEvent.click(screen.getByRole('button', { name: /MAPA driver.*(turun|down)|(Turunkan|Move).*MAPA driver/i }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
      const saved = lastSaved(stub);
      expect(saved.sections.map((s) => s.kode)).toEqual(['DEMOGRAPHICS', 'NPS', 'MAPA', 'QUANT', 'QUAL', 'SUBGROUP']);
      expect(saved.sections[0].enabled).toBe(false);
    });

    it('P19.5-T1 AC-4 (AA UI-022) asks before NPS is hidden while a survey runs, and saves nothing on Batal', async () => {
      const { stub } = render('bagian', { [`${KIND}/open-runs`]: { body: { nps: { runs: 1, kpms: 1 }, qual: { runs: 0, kpms: 0 } } } });
      await userEvent.click(await screen.findByRole('switch', { name: 'Tampilkan NPS KPM' }));
      const dialog = await screen.findByRole('dialog', { name: 'Sembunyikan NPS KPM?' });
      expect(within(dialog).getByText('1 survei sedang berjalan di 1 KPM. Survei itu tetap selesai dan hasilnya disimpan. Tab hilang dari KPM setelah survei berakhir.'))
        .toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
      expect(screen.getByRole('switch', { name: 'Tampilkan NPS KPM' })).toBeChecked();
      expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(false);
    });
  });

  describe('Data upload', () => {
    it('P19.5-T1 AC-5 (AA UI-011) marks the four system columns Sistem; their Hapus cannot be pressed and says why', async () => {
      render('data');
      expect(await screen.findByRole('heading', { name: 'Kolom data bulanan' })).toBeInTheDocument();
      const table = screen.getByRole('table', { name: 'Kolom data bulanan' });
      const remove = within(table).getByRole('button', { name: 'Hapus APE: kolom sistem, tidak bisa dihapus' });
      expect(remove).toBeDisabled();
      expect(remove).toHaveAttribute('title', 'Kolom sistem: bisa diganti nama, tidak bisa dihapus');
      expect(within(table).getAllByText('Sistem')).toHaveLength(4);
      expect(within(table).getByRole('button', { name: 'Hapus FYP' })).toBeEnabled();
    });

    it('P19.5-T1 AC-6 opens Kolom baru: errors under their fields, next month by default, and Baru · mulai Des 2026', async () => {
      const { stub } = render('data');
      await userEvent.click(await screen.findByRole('button', { name: 'Tambah kolom' }));
      const form = screen.getByRole('heading', { name: 'Kolom baru' }).parentElement as HTMLElement;
      expect(within(form).getByLabelText('Berlaku mulai')).toHaveValue('2026-12');
      await userEvent.click(within(form).getByRole('button', { name: 'Simpan' }));
      expect(within(form).getByText('Isi kode.')).toBeInTheDocument();
      expect(within(form).getByText('Isi nama.')).toBeInTheDocument();
      await userEvent.type(within(form).getByLabelText('Kode'), 'fyp');
      expect(within(form).getByLabelText('Kode')).toHaveValue('FYP');
      expect(within(form).getByText('Kode ini sudah dipakai.')).toBeInTheDocument();
      await userEvent.clear(within(form).getByLabelText('Kode'));
      await userEvent.type(within(form).getByLabelText('Kode'), 'fyc');
      await userEvent.type(within(form).getByLabelText('Nama (ID)'), 'Komisi tahun pertama');
      await userEvent.type(within(form).getByLabelText('Nilai terkecil'), '5');
      await userEvent.type(within(form).getByLabelText('Nilai terbesar'), '1');
      expect(within(form).getByText('Nilai terkecil tidak boleh lebih besar dari nilai terbesar.')).toBeInTheDocument();
      await userEvent.clear(within(form).getByLabelText('Nilai terbesar'));
      await userEvent.click(within(form).getByLabelText('Wajib diisi untuk setiap agen'));
      await userEvent.click(within(form).getByRole('button', { name: 'Simpan' }));
      expect((await screen.findAllByText('Baru · mulai Des 2026')).length).toBeGreaterThan(0);
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
      expect(lastSaved(stub).uploadFields.at(-1)).toMatchObject({
        kode: 'FYC', label: { id: 'Komisi tahun pertama' }, effectiveFrom: '2026-12', required: true, min: 5, system: false,
      });
    });

    it('P19.5-T1 AC-7 (AA UI-017) locks Satuan and Berlaku mulai once a KPM holds data for the kode', async () => {
      render('data');
      const table = await screen.findByRole('table', { name: 'Kolom data bulanan' });
      await userEvent.click(within(table).getByRole('button', { name: 'Ubah Persistensi rolling' }));
      expect(screen.getByLabelText('Satuan')).toBeDisabled();
      expect(screen.getByText('Satuan terkunci karena sudah ada data. Buat kolom baru untuk satuan lain.')).toBeInTheDocument();
      expect(screen.getByLabelText('Berlaku mulai')).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Kode')).toHaveAttribute('readonly');
    });

    it('P19.5-T1 AC-5 a system column’s unit is fixed, and it can be renamed', async () => {
      const { stub } = render('data');
      const table = await screen.findByRole('table', { name: 'Kolom data bulanan' });
      await userEvent.click(within(table).getByRole('button', { name: 'Ubah APE' }));
      expect(screen.getByLabelText('Satuan')).toBeDisabled();
      expect(screen.getByText('Kolom sistem: satuan tetap.')).toBeInTheDocument();
      await userEvent.clear(screen.getByLabelText('Nama (ID)'));
      await userEvent.type(screen.getByLabelText('Nama (ID)'), 'APE bersih');
      await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
      expect(lastSaved(stub).uploadFields[0]).toMatchObject({ kode: 'APE', label: { id: 'APE bersih' }, unit: 'rp_million', system: true });
    });

    it('P19.5-T1 AC-8 deletes a custom column into the archive, naming where it is used and that its data is kept', async () => {
      const { stub } = render('data');
      const table = await screen.findByRole('table', { name: 'Kolom data bulanan' });
      await userEvent.click(within(table).getByRole('button', { name: 'Hapus FYP' }));
      const dialog = await screen.findByRole('dialog', { name: 'Hapus kolom FYP?' });
      expect(within(dialog).getByText(/Kolom ini dipakai di: Campaign/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Kolom diarsipkan dan bisa dipulihkan dengan menambah kolom berkode FYP lagi/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus kolom' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
      const saved = lastSaved(stub);
      expect(saved.uploadFields.map((f) => f.kode)).not.toContain('FYP');
      expect(saved.archivedFields.map((f) => f.kode)).toEqual(['FYP']);
    });

    it('P19.5-T1 AC-10 shows Dipakai di from the server, Belum dipakai otherwise, and MAA fixed at APE and Jumlah polis', async () => {
      render('data');
      const table = await screen.findByRole('table', { name: 'Kolom data bulanan' });
      expect(within(table).getAllByText('MAA aktif').length).toBeGreaterThan(0);
      expect(within(table).getAllByText('Belum dipakai').length).toBeGreaterThan(0);
      const maa = screen.getByText(/Agen aktif \(MAA\)/).closest('div') as HTMLElement;
      expect(within(maa).getByRole('checkbox', { name: 'APE' })).toBeChecked();
      expect(within(maa).getByRole('checkbox', { name: 'Jumlah polis (case issued)' })).toBeChecked();
      expect(within(maa).getByRole('checkbox', { name: 'Rekrutmen' })).not.toBeChecked();
      for (const box of within(maa).getAllByRole('checkbox')) expect(box).toBeDisabled();
      expect(screen.getByText('Hanya kolom sistem, supaya semua KPM di perusahaan dihitung sama. Agen tanpa data bulan itu tampil "—", bukan "Tidak aktif".'))
        .toBeInTheDocument();
    });

    it('P19.5-T1 AC-11 (AA UI-018) tests the agent-code format over the registered codes as it is typed', async () => {
      const { stub } = render('data', {
        [`${KIND}/code-check`]: ({ url }) => ({
          body: url.includes(encodeURIComponent('^[0-9]{8}$'))
            ? { mismatched: 312, total: 1840, examples: ['80777', '12345', '555'], exampleMatches: true }
            : { mismatched: 0, total: 1840, examples: [], exampleMatches: true },
        }),
      });
      const field = await screen.findByLabelText('Format kode agen');
      await userEvent.clear(field);
      await userEvent.type(field, '^[[0-9]{{8}$');
      expect(await screen.findByText('312 dari 1840 kode terdaftar tidak cocok (mis. 80777, 12345, 555). Template tidak bisa diterbitkan sampai ini beres.', {}, SAVED))
        .toBeInTheDocument();
      expect(screen.getByText('12 bulan sebelum KPM bergabung')).toBeInTheDocument();
      expect(screen.getByLabelText('Kode agen yang belum terdaftar')).toHaveValue('reject');
      // No uploaded YTD column: no tolerance to set.
      expect(screen.queryByLabelText('Toleransi cek YTD')).toBeNull();
      expect(stub.calls.some((c) => c.url.includes('/code-check'))).toBe(true);
    });

    it('P19.5-T1 AC-12 previews exactly the header a KPM downloads', async () => {
      render('data');
      await screen.findByRole('heading', { name: 'Pratinjau template CSV' });
      const preview = screen.getByRole('table', { name: 'Pratinjau template CSV' });
      const headers = within(preview).getAllByRole('columnheader').map((h) => h.textContent);
      expect(headers).toEqual([
        'Agent Code', 'Agent Name', 'APE (Rp juta) [APE]', 'Persistensi rolling (%) [PERSISTENCY]', 'Rekrutmen [RECRUITMENT]',
        'Agen aktif baru [NEW_ACTIVE_AGENTS]', 'FYP (Rp juta) [FYP]', 'Jumlah polis (case issued) [POLICY_COUNT]',
        'Unit persistency (%) [UNIT_PERSISTENCY]',
      ]);
      // The ID|EN switch shows the template's words in English.
      await userEvent.click(screen.getByRole('button', { name: 'EN' }));
      expect(within(screen.getByRole('table', { name: 'Pratinjau template CSV' })).getByText('Recruitment [RECRUITMENT]')).toBeInTheDocument();
    });

    it('P19.5-T1 AC-19 draws a table at 1280 px', async () => {
      render('data');
      expect(await screen.findByRole('table', { name: 'Kolom data bulanan' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Kolom data bulanan' })).toBeNull();
      await clean();
    });

    it('P19.5-T1 AC-19 draws cards at 375 px, each with 44 px targets', async () => {
      atWidth(375);
      render('data');
      const cards = await screen.findByRole('list', { name: 'Kolom data bulanan' });
      expect(screen.queryByRole('table', { name: 'Kolom data bulanan' })).toBeNull();
      expect(within(cards).getAllByRole('listitem')).toHaveLength(7);
      const edit = within(cards).getAllByRole('button', { name: /^Ubah / })[0];
      expect(wears(edit, 375)).toContain('min-h-11');
      expect(within(cards).getByRole('button', { name: 'Hapus APE: kolom sistem, tidak bisa dihapus' })).toBeDisabled();
      await clean();
    });
  });

  describe('AC-13 Survei', () => {
    it('P19.5-T1 AC-13 holds the NPS schedule, the defaults, the reminder always on, and refuses a passive cut-off not below the promoter', async () => {
      const { stub } = render('survei');
      expect(await screen.findByRole('heading', { name: 'Survei NPS' })).toBeInTheDocument();
      expect(screen.getByText('Skala 0–10. Skor NPS = % promotor − % detraktor.')).toBeInTheDocument();
      expect(screen.getByLabelText('Jadwal')).toHaveValue('quarter');
      expect(screen.getByText('Ingatkan 1 hari sebelum berakhir — selalu')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /hari sebelum berakhir/ })).toBeNull();
      const passive = screen.getByLabelText('Batas pasif');
      await userEvent.clear(passive);
      await userEvent.type(passive, '9');
      expect(screen.getByText('Batas pasif harus lebih kecil dari promotor.')).toBeInTheDocument();
      expect(screen.getByText(/Setiap periode survei menyimpan batasnya sendiri/)).toBeInTheDocument();
      await act(() => new Promise((r) => setTimeout(r, 1000)));
      expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(false);
    });

    it('P19.5-T1 AC-13 edits a question with the mockup’s warning, adds a score question, and never removes the last', async () => {
      const { stub } = render('survei');
      const items = await screen.findAllByRole('button', { name: 'Ubah' });
      await userEvent.click(items[0]);
      const dialog = await screen.findByRole('dialog', { name: 'Ubah pertanyaan' });
      expect(within(dialog).getByText(/Mengubah teks pertanyaan yang sudah berjalan memutus perbandingan/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
      await userEvent.click(screen.getByRole('button', { name: 'Tambah pertanyaan skor' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Simpan' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
      expect(lastSaved(stub).nps.questions.map((q) => q.kode)).toEqual(['P1', 'P2', 'P3']);
      expect(screen.getByText('Dikirim Juni dan Desember. Agen mendapat versi pendek (bagian bertanda "Semua").')).toBeInTheDocument();
      expect(screen.getByText('Teks pertanyaan boleh memakai {perusahaan} dan {kpm}.')).toBeInTheDocument();
    });

    it('P19.5-T1 AC-13 holds the last score question', async () => {
      const one = analyticsV1();
      one.nps.questions = one.nps.questions.slice(0, 1);
      render('survei', { [KIND]: { body: read(one) } });
      const remove = (await screen.findAllByRole('button', { name: 'Hapus' }))[0];
      expect(remove).toBeDisabled();
      expect(remove).toHaveAttribute('title', 'Pertanyaan skor terakhir tidak bisa dihapus.');
    });
  });

  describe('AC-14 Ambang & benchmark', () => {
    it('P19.5-T1 AC-14 draws a card per section with Aktif or Mati, the peers’ copy, 3 KPM, and holds Perlu perhatian below Masalah besar', async () => {
      const off = analyticsV1();
      off.sections[3].enabled = false;
      const { stub } = render('ambang', { [KIND]: { body: read(off) } });
      expect(await screen.findByText('Batas warna dan pembanding yang dipakai grafik. Semua KPM di template ini memakai angka yang sama.')).toBeInTheDocument();
      const quant = screen.getByRole('region', { name: 'Analitik kuantitatif' });
      expect(within(quant).getByText('Mati')).toBeInTheDocument();
      expect(within(quant).getByText('Pembanding: median KPM lain di perusahaan ini')).toBeInTheDocument();
      expect(within(quant).getByText('3 KPM')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Demografi' })).getByText('Gen Z 17–29 · Gen Y 30–45 · Gen X 46+ (tahun)')).toBeInTheDocument();
      const watch = screen.getByLabelText('Perlu perhatian');
      await userEvent.clear(watch);
      await userEvent.type(watch, '70');
      expect(screen.getByText('"Perlu perhatian" harus lebih kecil dari "Masalah besar".')).toBeInTheDocument();
      await userEvent.clear(screen.getByLabelText('Capaian hijau'));
      await userEvent.type(screen.getByLabelText('Capaian hijau'), '75');
      await waitFor(() => expect(lastSaved(stub).thresholds.subgroupOkPct).toBe(75), SAVED);
      // A crossed pair is never saved: whatever was sent kept *Perlu perhatian* below *Masalah besar*.
      for (const call of stub.calls.filter((c) => c.init.method === 'PUT')) {
        const { thresholds } = (JSON.parse(String(call.init.body)) as { payload: AdvancedAnalyticsConfig }).payload;
        expect(thresholds.qualWatchPct).toBeLessThan(thresholds.qualBigPct);
      }
    });

    it('P19.5-T1 AC-19 puts the cards in two columns on a desktop and one on a tablet', async () => {
      render('ambang');
      const grid = (await screen.findByRole('region', { name: 'Demografi' })).parentElement as HTMLElement;
      expect(wears(grid, 1280)).toContain('grid-cols-2');
      expect(wears(grid, 768)).not.toContain('grid-cols-2');
      await clean();
    });
  });

  describe('AC-11, AC-15 Terbitkan', () => {
    const drafted = () => read(analyticsV1(), { status: 'draft', version: 2, revision: 2 });

    it('P19.5-T1 AC-11 opens Belum bisa diterbitkan while registered codes do not match, naming up to five', async () => {
      const payload = analyticsV1();
      payload.uploadRules.agentCodePattern = '^[0-9]{8}$';
      const { stub } = render('data', {
        [KIND]: { body: read(payload, { status: 'draft', version: 2, revision: 2 }) },
        [`${KIND}/code-check`]: { body: { mismatched: 312, total: 1840, examples: ['80777', '12345'], exampleMatches: true } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Terbitkan' }));
      const dialog = await screen.findByRole('dialog', { name: 'Belum bisa diterbitkan' });
      expect(within(dialog).getByText('312 dari 1840 kode agen terdaftar tidak cocok dengan format baru ^[0-9]{8}$, misalnya 80777, 12345.'))
        .toBeInTheDocument();
      expect(stub.calls.some((c) => c.url.includes('/publish'))).toBe(false);
    });

    it('P19.5-T1 AC-15 says the section applies to every KPM on the template and how many, then publishes', async () => {
      const payload = analyticsV1();
      payload.sections[0].enabled = false;
      payload.uploadFields.push({ ...payload.uploadFields[4], kode: 'FYC', system: false, label: { id: 'FYC', en: 'FYC' }, effectiveFrom: '2026-12' });
      const { stub } = render('bagian', {
        [KIND]: {
          body: read(payload, {
            status: 'draft', version: 2, revision: 2,
            published: { id: 'row', version: 1, revision: 1, payload: analyticsV1(), publishedAt: null },
          }),
        },
        [`POST ${KIND}/publish`]: { body: read(payload, { version: 2, publishedVersion: 2 }) },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Terbitkan' }));
      const dialog = await screen.findByRole('dialog', { name: 'Terbitkan Advanced analytics v2?' });
      expect(within(dialog).getByText(/bagian ini berlaku untuk semua KPM di template ini, termasuk yang sudah dibuat. Saat ini dipakai 12 KPM./))
        .toBeInTheDocument();
      expect(within(dialog).getByText(/8 kolom data upload, 1 baru mulai Des 2026/)).toBeInTheDocument();
      expect(within(dialog).getByText('KPM Owner dan Admin di setiap KPM mendapat notifikasi.')).toBeInTheDocument();
      expect(within(dialog).getByText(/5 dari 6 bagian tampil \(disembunyikan: Demografi KPM\)/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Survei yang sedang berjalan tetap memakai pertanyaan dan batas NPS lama/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Terbitkan' }));
      await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/publish') && c.init.method === 'POST')).toBe(true));
      void drafted;
    });

    it('P19.5-T1 AC-11 opens Belum bisa diterbitkan when the server refuses the publish (409 ANALYTICS_CODE_PATTERN_MISMATCH)', async () => {
      render('bagian', {
        [KIND]: { body: drafted() },
        [`POST ${KIND}/publish`]: {
          status: 409,
          body: { error: { code: 'ANALYTICS_CODE_PATTERN_MISMATCH', message: 'x', requestId: 'r', details: { mismatched: 2, total: 9, examples: ['1', '2'], pattern: '^[0-9]{8}$' } } },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Terbitkan' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: 'Terbitkan Advanced analytics v2?' })).getByRole('button', { name: 'Terbitkan' }));
      expect(await screen.findByRole('dialog', { name: 'Belum bisa diterbitkan' })).toBeInTheDocument();
    });
  });
});

/**
 * **P19.2-T2 — the section's two selects below 1024px** (UI-134: *no native select on /admin at 375 or 768*; UI-135):
 * *Survei*'s *Jadwal*, *Data upload*'s *Kode agen yang belum terdaftar* and a column's *Satuan* as choice rows on a phone
 * and a tablet, each saved as its select saved it; the laptop keeps the selects (the P19.5-T1 tests above, at 1280).
 */
describe('P19.2-T2 the template’s Advanced analytics below 1024px (UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx Survei’s Jadwal is two choice rows, its help its description, and a choice saves', async (px) => {
    atWidth(px);
    const { stub } = render('survei');
    const cadence = await screen.findByRole('radiogroup', { name: 'Jadwal' });
    expect(document.querySelector('select')).toBeNull();
    expect(within(cadence).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Setiap kuartal', 'Setiap semester']);
    expect(within(cadence).getByRole('radio', { name: 'Setiap kuartal' })).toBeChecked();
    expect(cadence).toHaveAccessibleDescription(expect.stringContaining('KPM'));
    await userEvent.click(within(cadence).getByRole('radio', { name: 'Setiap semester' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
    expect(lastSaved(stub).nps.cadence).toBe('half');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx Data upload: an unregistered code’s rule and a new column’s unit are choice rows', async (px) => {
    atWidth(px);
    const { stub } = render('data');
    const rule = await screen.findByRole('radiogroup', { name: 'Kode agen yang belum terdaftar' });
    expect(within(rule).getByRole('radio', { name: 'Lewati baris' })).toBeChecked();
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah kolom' }));
    const unit = await screen.findByRole('radiogroup', { name: 'Satuan' });
    expect(within(unit).getAllByRole('radio')).toHaveLength(3);
    expect(document.querySelector('select')).toBeNull();
    await userEvent.click(within(rule).getByRole('radio', { name: 'Simpan dan tandai "Belum terdaftar"' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(true), SAVED);
    expect(lastSaved(stub).uploadRules.unknownAgent).toBe('flag');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx a system column’s unit is fixed: its rows cannot be pressed, and say why', async (px) => {
    atWidth(px);
    render('data');
    // A phone's cards or a tablet's table (P19.5-T1 AC-19): either opens the column.
    const box = await screen.findByRole('list', { name: 'Kolom data bulanan' });
    await userEvent.click(within(box).getByRole('button', { name: 'Ubah APE' }));
    const unit = await screen.findByRole('radiogroup', { name: 'Satuan' });
    for (const radio of within(unit).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(unit).toHaveAccessibleDescription('Kolom sistem: satuan tetap.');
  });

  it.each([
    [375, 'list'], [768, 'list'], [1024, 'table'], [1280, 'table'],
  ] as const)('P19.2-T2 AC-1 at %ipx Data upload’s columns are a %s', async (px, shape) => {
    atWidth(px);
    render('data');
    expect(await screen.findByRole(shape, { name: 'Kolom data bulanan' })).toBeInTheDocument();
    expect(screen.queryByRole(shape === 'list' ? 'table' : 'list', { name: 'Kolom data bulanan' })).toBeNull();
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx keeps the selects on a laptop', async (px) => {
    atWidth(px);
    render('survei');
    expect((await screen.findByLabelText('Jadwal')).tagName).toBe('SELECT');
  });

  it.each([
    ['survei', 375], ['survei', 768], ['data', 375], ['data', 768], ['bagian', 375], ['bagian', 768], ['ambang', 375],
    ['ambang', 768],
  ] as const)('P19.2-T2 AC-5 %s at %ipx finds no target under 44px in the page', async (tab, px) => {
    atWidth(px);
    window.history.replaceState(null, '', `/#${tab}`);
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL] },
      '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE] },
      [KIND]: { body: read() },
      [`${KIND}/code-check`]: { body: { mismatched: 0, total: 5, examples: [], exampleMatches: true } },
      [`${KIND}/open-runs`]: { body: { nps: { runs: 0, kpms: 0 }, qual: { runs: 0, kpms: 0 } } },
    });
    renderInIndonesian(
      <div data-surface="v1"><main><SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section: 'analytics' })} /></main></div>,
      { me: SUPER_ADMIN },
    );
    if (tab === 'survei' || tab === 'data') {
      await screen.findByRole('radiogroup', { name: tab === 'survei' ? 'Jadwal' : 'Kode agen yang belum terdaftar' });
    } else if (tab === 'bagian') {
      expect((await screen.findAllByRole('switch')).length).toBeGreaterThan(0);
    } else {
      await screen.findByRole('region', { name: 'Analitik kuantitatif' });
    }
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-4 at %ipx Survei has no axe violations', async (px) => {
    atWidth(px);
    render('survei');
    await screen.findByRole('heading', { name: 'Survei NPS' });
    await clean();
  });
});
