import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage } from '@test/harness';
import {
  ActivationChecklistEditor, CampaignKindsEditor, CapabilityLadderEditor, EventTypesEditor, PipelineEditor,
  RatioSetEditor, TaxonomyEditor, TrainingEditor,
  type ActivationChecklistPayload, type CampaignKindsPayload, type CapabilityLadderPayload, type EventTypesPayload,
  type PipelinePayload, type RatioSetPayload, type TaxonomyPayload, type TrainingTaxonomyPayload,
} from '@/components/template-editor';
import { activationMessages } from '@/i18n/messages/activation';
import { activityBindingMessages } from '@/i18n/messages/activity-binding';
import { adminTemplateEditorMessages } from '@/i18n/messages/admin-template-editor';
import { activityTypesMessages } from '@/i18n/messages/settings-activity-types';
import { capabilityMessages } from '@/i18n/messages/settings-capability';
import { checklistMessages } from '@/i18n/messages/settings-checklist';
import { leadStatusesMessages } from '@/i18n/messages/settings-lead-statuses';
import { ratioBenchmarksMessages } from '@/i18n/messages/settings-ratio-benchmarks';
import { ratioWordMessages } from '@/i18n/messages/ratio-words';
import { settingsMessages } from '@/i18n/messages/settings';
import type { TemplateLinkKinds } from '@/lib/admin';

/**
 * **P18.98-T6, the Company template's editors in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"): each kind
 * of preset in the approved glossary's Indonesian (`admin-template-editor.tsx`, and the office's settings' words it
 * shares), the tabs and stages a sentence names kept English (§A), what a template holds as typed (ADR-0179 §5), and its
 * figures in Indonesian (`InLanguage` is a chosen Indonesian: words and figures). The same editors in English are
 * `template-editor.spec.tsx`, whose words are untouched.
 *
 * **English left** (`englishShown`) is read against every area these editors draw words from; *Code*, a read-only
 * code's label, is `CodeField`'s (`components/ui/`), the shared pieces', and is left out.
 */
const ENGLISH = englishOnly(
  adminTemplateEditorMessages, settingsMessages, activityTypesMessages, leadStatusesMessages, ratioBenchmarksMessages,
  ratioWordMessages, checklistMessages, capabilityMessages, activationMessages, activityBindingMessages,
).filter((words) => words !== 'Code');
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const inIndonesian = (ui: React.ReactElement) => render(<InLanguage language="id">{ui}</InLanguage>);

/** A template's taxonomy: what it holds is the platform's words, Indonesian since OD-238 (P18.98-T7's to migrate). */
const TAXONOMY: TaxonomyPayload = {
  categories: [
    { code: 'SELLING', label: 'Penjualan', displayOrder: 1 },
    { code: 'RECRUITING', label: 'Rekrutmen', displayOrder: 2 },
  ],
  types: [
    { code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi', description: null, displayOrder: 1 },
    { code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: 'Kirim SPAJ', displayOrder: 2 },
    { code: 'RECRUIT_APPROACH', categoryCode: 'RECRUITING', label: 'Pendekatan', description: null, displayOrder: 3 },
  ],
};

describe('P18.98-T6 the Company template’s editors in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(150);
    expect(ENGLISH).toEqual(expect.arrayContaining(['Add a section', 'Edit binding', 'Production clubs', 'Reached by']));
  });

  it('AC-1, AC-3 Activity types: the count in one form, the sections and types as typed, the controls in Indonesian', async () => {
    inIndonesian(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    expect(screen.getByText('3 jenis aktivitas di 2 bagian')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Penjualan' })).toBeInTheDocument();
    expect(screen.getByText('Kirim SPAJ')).toBeInTheDocument();
    expect(screen.getByText('2 item')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hapus' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tambah bagian' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tambah jenis aktivitas' })).toHaveLength(2);
    // The template's binding, not set: what its offices count instead.
    const binding = screen.getByRole('heading', { name: 'Pengaitan aktivitas' }).closest('.rounded-lg') as HTMLElement;
    expect(binding).toHaveTextContent('Belum diatur: KPM yang dibuat dari templat ini menghitung aktivitas default platform.');
    expect(within(binding).getByRole('button', { name: 'Ubah pengaitan' })).toBeInTheDocument();
    noEnglishLeft();

    // A section's own edit: its tile in the office's words (`settings-activity-types.ts`).
    const section = screen.getByRole('heading', { name: 'Penjualan' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(section).getAllByRole('button', { name: 'Ubah' })[0]);
    expect(within(section).getByLabelText('Nama')).toHaveValue('Penjualan');
    expect(within(section).getByLabelText('Kotak ringkasan')).toHaveAccessibleDescription(
      'Bagian dengan kotak yang sama dihitung bersama. Biarkan kosong agar bagian ini punya kotak sendiri.',
    );
    expect(within(section).getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2 the binding’s lines name the three stages in English, the types as typed', async () => {
    inIndonesian(<TaxonomyEditor
      payload={{ ...TAXONOMY, bindings: { leads: ['RECRUIT_APPROACH'], appointments: ['SELL_PRESENTATION'], closings: [] } }}
      onChange={vi.fn()}
    />);
    const binding = screen.getByRole('heading', { name: 'Pengaitan aktivitas' }).closest('.rounded-lg') as HTMLElement;
    expect(binding).toHaveTextContent('Aktivitas mana yang dihitung ringkasan dan rencana goal di setiap tahap, di setiap KPM');
    expect(within(binding).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Set appointment: Pendekatan', 'Sales meeting: Presentasi', 'Submission polis: —',
    ]);
    await userEvent.click(within(binding).getByRole('button', { name: 'Ubah pengaitan' }));
    expect(within(binding).getByRole('button', { name: 'Selesai' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a new row: its code’s hint and a taken code refused, whole per kind of row', async () => {
    inIndonesian(<TrainingEditor
      payload={{ categories: [{ code: 'SALES', label: 'Penjualan' }], skills: [], modules: [] }}
      section="categories"
      onChange={vi.fn()}
    />);
    await userEvent.click(screen.getByRole('button', { name: 'Tambah kategori' }));
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Diisi dari nama. Permanen setelah diterbitkan.');
    expect(screen.getByLabelText('Deskripsi')).toHaveAccessibleDescription('Opsional. Agent membacanya di bawah kategori.');
    await userEvent.type(screen.getByLabelText('Kode'), 'SALES');
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription(
      expect.stringContaining('Templat ini sudah punya kategori dengan kode ini.'),
    );
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1, AC-2 Lead statuses: the count, the badges and the switch’s kept name', async () => {
    const payload: PipelinePayload = {
      statuses: [
        { pipeline: 'sales', code: 'NOT_YET', label: 'Belum didekati', rank: 1, isTerminal: false, isLateStage: false },
        { pipeline: 'sales', code: 'PAID', label: 'Dibayar dan terbit', rank: 2, isTerminal: true },
      ],
    };
    inIndonesian(<PipelineEditor payload={payload} pipeline="sales" onChange={vi.fn()} />);

    expect(screen.getByText('2 status — urutannya menentukan alur tahap dalam pipeline.')).toBeInTheDocument();
    expect(screen.getByText('Terbuka')).toBeInTheDocument();
    expect(screen.getByText('Menutup pipeline')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Expected to close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jadikan penutup pipeline' })).toBeInTheDocument();
    const closing = screen.getByText('Dibayar dan terbit').closest('li')!;
    expect(within(closing).getByRole('button', { name: 'Hapus' }))
      .toHaveAttribute('title', 'Jadikan tahap lain penutup pipeline terlebih dahulu.');
    expect(screen.getByRole('button', { name: 'Tambah tahap Sales' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Ratio benchmarks: the benchmark in Indonesian figures, the formula’s sides, the bold word in its order', async () => {
    const ratio = (over: Partial<RatioSetPayload['ratios'][number]>) => ({
      code: 'LEADS_PER_ACTIVITY', label: 'Leads per aktivitas', numerator: ['A'], denominator: ['B'], benchmark: 0.3,
      comparison: 'gte' as const, displayUnit: 'decimal' as const, displayOrder: 1, ...over,
    });
    inIndonesian(<RatioSetEditor
      available={[]}
      onChange={vi.fn()}
      payload={{ ratios: [
        ratio({}),
        ratio({ code: 'BALANCE', label: 'Keseimbangan', benchmark: 30, comparison: 'band', displayUnit: 'points', displayOrder: 2 }),
      ] }}
    />);

    expect(screen.getByText('0,30')).toBeInTheDocument();
    expect(screen.getByText('±30 poin')).toBeInTheDocument();
    expect(screen.getAllByText(/^Sesuai target jika minimal/)).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Yang dihitung' })).toHaveLength(2);
    expect(screen.getAllByRole('group', { name: 'Dari' })).toHaveLength(2);
    expect(screen.getAllByText('A — tambahkan jenis aktivitas di tab Activity types terlebih dahulu.')).toHaveLength(2);
    const lead = screen.getAllByText(/^Inilah yang menjadi awal setiap KPM baru perusahaan ini/)[0];
    expect(within(lead).getByText('berikutnya').tagName).toBe('STRONG');
    noEnglishLeft();

    // The benchmark's field and its unit, while the ratio is edited: the examples in Indonesian figures.
    const card = screen.getByText('Leads per aktivitas').closest('[data-row]') as HTMLElement;
    await userEvent.click(within(card).getAllByRole('button', { name: 'Ubah' })[0]);
    expect(within(card).getByLabelText('Sesuai target jika minimal')).toHaveValue('0,3');
    expect(within(card).getByLabelText('Sesuai target jika minimal')).toHaveAccessibleDescription(
      'Ketik seperti yang ditampilkan — 15 untuk 15% sebagai persentase, 0,30 sebagai angka.',
    );
    expect(within(within(card).getByLabelText('Ditampilkan sebagai')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Persentase — 15%', 'Angka — 0,30']);
    noEnglishLeft();
  });

  it('AC-1, AC-3 Training: the counts in one form, a kept noun in its English plural, publish state in Indonesian', async () => {
    const payload: TrainingTaxonomyPayload = {
      categories: [{ code: 'SALES', label: 'Penjualan' }],
      skills: [
        { code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' },
        { code: 'CLOSING', categoryCode: 'SALES', label: 'Closing' },
      ],
      modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Menyusun daftar prospek', publishState: 'published' }],
    };
    const { rerender } = inIndonesian(<TrainingEditor payload={payload} section="categories" onChange={vi.fn()} />);
    expect(screen.getByText('1 kategori')).toBeInTheDocument();
    expect(screen.getByText('2 skills · 1 modul diterbitkan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus' })).toHaveAttribute('title', 'Hapus skill-nya terlebih dahulu.');
    noEnglishLeft();

    rerender(<InLanguage language="id"><TrainingEditor payload={payload} section="skills" onChange={vi.fn()} /></InLanguage>);
    expect(screen.getByLabelText('Kategori')).toBeInTheDocument();
    expect(screen.getByText('1 modul')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah skill' })).toBeInTheDocument();
    noEnglishLeft();

    rerender(<InLanguage language="id"><TrainingEditor payload={payload} section="modules" onChange={vi.fn()} /></InLanguage>);
    expect(within(screen.getByLabelText('Skill')).getByRole('option', { name: 'Semua skill' })).toBeInTheDocument();
    expect(screen.getByText('Pilih skill untuk menambahkan modul ke dalamnya.')).toBeInTheDocument();
    expect(screen.getByText('Diterbitkan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    expect(screen.getByLabelText('Judul')).toHaveValue('Menyusun daftar prospek');
    expect(within(screen.getByLabelText('Status terbit')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Draf', 'Diterbitkan']);
    noEnglishLeft();
  });

  it('AC-1, AC-2 Activation checklist: the badges in the activation’s words, the features kept, a module as typed', async () => {
    const payload: ActivationChecklistPayload = {
      aspects: [{
        code: 'SETUP', label: 'Persiapan awal',
        items: [
          { code: 'GOAL_SETTING', label: 'Mengatur goal', autoLink: 'feature:goals' },
          { code: 'LEADS', label: 'Menambah leads', autoLink: 'feature:leads' },
          { code: 'BASICS', label: 'Mempelajari dasar asuransi', autoLink: null },
        ],
      }],
    };
    // The server's sentence for what completes an item is the server's, in the reader's language (P18.98-T5).
    const linkKinds: TemplateLinkKinds = {
      'feature:goals': { label: 'Goal Settings', route: '/goals', completesWhen: 'new hire sudah menyimpan goal', live: true },
      'feature:leads': { label: 'Leads Management', route: '/leads', completesWhen: 'new hire menambah lead', live: false },
    };
    inIndonesian(<ActivationChecklistEditor
      payload={payload}
      modules={[{ code: 'PROSPECT_LIST', title: 'Menyusun daftar prospek' }]}
      linkKinds={linkKinds}
      onChange={vi.fn()}
    />);

    expect(screen.getByText('3 item di 1 aspek')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otomatis — selesai saat new hire sudah menyimpan goal' }))
      .toHaveTextContent('Otomatis');
    expect(screen.getByRole('button', { name: /^Dicentang manual/ })).toHaveTextContent('Dicentang manual');
    expect(screen.getByText('Goal Settings')).toBeInTheDocument();
    const aspect = screen.getByRole('heading', { name: 'Persiapan awal' }).closest('.rounded-lg') as HTMLElement;
    expect(within(aspect).getAllByRole('button', { name: 'Hapus' })[0])
      .toHaveAttribute('title', 'Menghapus Persiapan awal beserta 3 itemnya.');
    noEnglishLeft();

    const row = screen.getByText('Mempelajari dasar asuransi').closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));
    expect(within(row).getByLabelText('Item')).toHaveValue('Mempelajari dasar asuransi');
    const link = within(row).getByLabelText('Diselesaikan dari');
    expect(link).toHaveAccessibleDescription(
      'Item yang tertaut akan selesai dengan sendirinya saat agent melakukan tindakan itu.',
    );
    expect(within(link).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Tanpa tautan (manual)', 'Goal Settings', 'Leads Management', 'Activity Management',
      'Training · Menyusun daftar prospek',
    ]);
    noEnglishLeft();
  });

  it('AC-1 Event types: the count and the empty list in Indonesian, a type as typed', async () => {
    const payload: EventTypesPayload = {
      types: [{ code: 'KICKOFF', label: 'Kick-off bulanan', description: null, emoji: '🚀', color: null, displayOrder: 1 }],
    };
    const { rerender } = inIndonesian(<EventTypesEditor payload={payload} onChange={vi.fn()} />);
    expect(screen.getByText('1 jenis yang menjadi awal setiap KPM baru perusahaan ini')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    expect(screen.getByLabelText('Emoji')).toHaveAccessibleDescription('Opsional. Satu karakter, untuk daftar.');
    expect(screen.getByLabelText('Warna')).toHaveAccessibleDescription(
      'Opsional. Pilih satu, atau tempel warna yang sudah dipakai perusahaan Anda.',
    );
    noEnglishLeft();

    rerender(<InLanguage language="id"><EventTypesEditor payload={{ types: [] }} onChange={vi.fn()} /></InLanguage>);
    expect(screen.getByText(/^Belum ada jenis\. KPM tanpa jenis tidak punya tempat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah jenis event' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 the carrier rules: a criterion in Indonesian figures, its comparator in words, a kind kept', async () => {
    const payload: CampaignKindsPayload = {
      rules: [{
        kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', rank: 1, reward: 'Bonus promosi', groupMode: 'all',
        criteriaGroups: [
          { mode: 'all', criteria: [{ metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 120_000_000_000 }] },
          { mode: 'any', criteria: [{ metricKey: 'NOT_BUILT', comparator: 'gt', value: 1200 }] },
        ],
      }],
    };
    const metrics = [{ key: 'APE_ACHIEVED', label: 'APE achieved', unit: 'idr_minor' }];
    const { rerender } = inIndonesian(<CampaignKindsEditor payload={payload} metrics={metrics} section="production_club" onChange={vi.fn()} />);

    expect(screen.getByText(/^Ini aturan milik perusahaan asuransi sendiri/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Klub produksi' })).toBeInTheDocument();
    expect(screen.getByText('Tingkat penghargaan tahunan.')).toBeInTheDocument();
    expect(screen.getByText('1 aturan')).toBeInTheDocument();
    expect(screen.getByText('Peringkat 1')).toBeInTheDocument();
    expect(screen.getByText('Bonus promosi')).toBeInTheDocument();
    // A rule in words: the metric's name kept (§A.4), the comparator Indonesian, the sum in Indonesian figures.
    expect(screen.getByText(/^APE achieved/).closest('p')).toHaveTextContent('APE achieved minimal (≥) Rp 1,2 M');
    expect(screen.getByText('semua ini')).toBeInTheDocument();
    const second = screen.getByText('salah satu dari ini').closest('p')!;
    expect(within(second).getByText('dan').tagName).toBe('STRONG');
    // A metric nothing measures yet: the console's *Soon*, in its words.
    expect(screen.getByText('Segera hadir').closest('[title]')).toHaveAttribute('title', 'Belum diukur');
    expect(screen.getByText(/NOT_BUILT/).closest('p')).toHaveTextContent('lebih dari (>) 1.200');
    noEnglishLeft();

    const criterion = screen.getByText(/^APE achieved/).closest('li')!;
    await userEvent.click(within(criterion).getByRole('button', { name: 'Ubah' }));
    expect(within(criterion).getByLabelText('Metrik')).toBeInTheDocument();
    expect(within(within(criterion).getByLabelText('Perbandingan')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['minimal (≥)', 'lebih dari (>)', 'maksimal (≤)', 'kurang dari (<)', 'tepat (=)']);
    expect(within(criterion).getByLabelText('Nilai'))
      .toHaveAccessibleDescription('Uang dalam sen — Rp 1.200.000.000 adalah 120000000000.');
    noEnglishLeft();

    rerender(<InLanguage language="id"><CampaignKindsEditor payload={{ rules: [] }} metrics={metrics} section="moc" onChange={vi.fn()} /></InLanguage>);
    expect(screen.getByRole('heading', { name: 'Maintenance of Contract' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah aturan Maintenance of Contract' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Capability Mapping: the ladder and the grids in Indonesian, every name as typed', async () => {
    const payload: CapabilityLadderPayload = {
      stages: [
        { code: 'COMPETENT', label: 'Kompeten', requiredMilestoneCodes: ['SELLS', 'GONE'], stageOrder: 1 },
      ],
      milestones: [{ code: 'SELLS', label: 'Menjual sendiri' }],
      grids: [{ code: 'LEADING', label: 'Memimpin', requiresDownline: true, items: [{ code: 'COACH', label: 'Melatih' }] }],
    };
    const { rerender } = inIndonesian(<CapabilityLadderEditor payload={payload} section="ladder" onChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Milestone' })).toBeInTheDocument();
    expect(screen.getByText('Cara sebuah tahap dicapai.')).toBeInTheDocument();
    expect(screen.getByText('1 milestone')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tahap' })).toBeInTheDocument();
    expect(screen.getByText('Senioritas ditentukan oleh peringkat, bukan oleh posisi di halaman ini.')).toBeInTheDocument();
    expect(screen.getByText('1 tahap')).toBeInTheDocument();
    expect(screen.getByText('Peringkat 1')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dicapai dengan' })).toBeInTheDocument();
    noEnglishLeft();

    rerender(<InLanguage language="id"><CapabilityLadderEditor payload={payload} section="skills" onChange={vi.fn()} /></InLanguage>);
    expect(screen.getByText('Hanya untuk yang memiliki downline')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tambah grid' }));
    expect(within(screen.getByLabelText('Berlaku untuk siapa')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Semua orang', 'Hanya untuk yang memiliki downline']);
    noEnglishLeft();
  });
});
