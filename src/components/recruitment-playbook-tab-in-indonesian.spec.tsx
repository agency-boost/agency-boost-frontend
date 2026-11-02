import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import { adminTemplatePlaybookMessages } from '@/i18n/messages/admin-template-playbook';
import { planMessages } from '@/i18n/messages/plan';
import type { PlaybookBody, PlaybookDto } from '@/lib/recruitment-playbook';
import { placeViolations, RecruitmentPlaybookTab } from './recruitment-playbook-tab';

/**
 * **P18.98-T6, the Company template's *Recruitment* tab in ID mode** (AC-1 as T4's AC-1 to AC-3; area
 * "admin-template"): the playbook's frame in the approved glossary's Indonesian (`admin-template-playbook.tsx`, with the
 * attack plans' *Cocok untuk* and *Kalimat pembuka*), *Playbook* and *recruitment* kept English (§A.6), every word of
 * the playbook and the brief's vocabulary as the company and the API wrote them (ADR-0179 §5), and when it was saved in
 * Indonesian figures. The same tab in English is `recruitment-playbook-tab.spec.tsx`.
 */
const ENGLISH = englishOnly(adminTemplatePlaybookMessages, planMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

/** The brief's vocabulary as the API serves it — in the reader's language, the API's (P18.98-T5). */
const VOCABULARY = {
  types: [{ code: 'fresh-grad', label: 'Lulusan baru' }],
  motivations: [{ code: 'side-income', label: 'Penghasilan tambahan' }],
  hesitations: [
    { code: 'time', label: 'Khawatir soal waktu' },
    { code: 'no-network', label: 'Tidak punya jaringan' },
  ],
};
const BODY: PlaybookBody = {
  profiles: {
    'fresh-grad': {
      label: 'Lulusan baru', tagline: 'Baru masuk dunia kerja.', goodFitFor: 'Yang sedang menimbang pekerjaan pertama.',
      benefits: ['Tanpa pengalaman.'], openings: { 'side-income': 'Mau penghasilan tambahan?' },
    },
  },
  objections: {
    time: { theySay: 'Butuh berapa lama?', youSay: 'Yang diukur aktivitas, bukan jam.' },
    'no-network': { theySay: 'Saya tidak kenal banyak orang.', youSay: 'Kita mulai dari yang dekat.' },
  },
  profileObjections: { 'fresh-grad': { time: { theySay: 'Saya masih kuliah.', youSay: 'Bisa disesuaikan.' } } },
  nextAction: 'Kirimkan Opportunity Overview.',
};
const STORED: PlaybookDto = {
  companyId: 'c1', version: 3, body: BODY, updatedAt: '2026-10-09T07:05:00.000Z', updatedBy: { name: 'Root' },
};
const PATH = '/admin/companies/c1/recruitment-playbook';
const read = (playbook: PlaybookDto | null) =>
  ({ body: { playbook, defaults: BODY, vocabulary: VOCABULARY, limits: { textMax: 600, benefitsMax: 1 } } });
const WRITER = makeMe({ permissions: ['company_template:read', 'recruitment_playbook:write'] });

function mount({ get = [read(STORED)], put = [] }: { get?: StubReply[]; put?: StubReply[] } = {}) {
  stubFetch({ [`GET ${PATH}`]: get, ...(put.length > 0 ? { [`PUT ${PATH}`]: put } : {}) });
  renderInIndonesian(<RecruitmentPlaybookTab companyId="c1" />, { me: WRITER });
}

const card = (name: string) => within(screen.getByRole('group', { name }));

describe('P18.98-T6 the Recruitment tab in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['This playbook is live.', 'Save playbook', 'Objections']));
  });

  it('AC-1, AC-4 the playbook live: the frame in Indonesian, when it was saved in Indonesian figures, its words as typed', async () => {
    mount();
    expect(await screen.findByText('Playbook ini langsung berlaku.')).toBeInTheDocument();
    expect(screen.getByText('Setiap penyimpanan sampai ke setiap agent perusahaan ini pada rencana berikutnya.'))
      .toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Versi 3 · disimpan oleh Root pada 9 Okt 2026, 14.05');
    expect(screen.getByRole('button', { name: 'Simpan playbook' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buang perubahan' })).toBeDisabled();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Lulusan baru', 'Keberatan', 'Tindakan berikutnya']);
    expect(card('Lulusan baru').getByText('Baru masuk dunia kerja.')).toBeInTheDocument();
    expect(card('Keberatan').getByText('Jawaban untuk setiap keraguan, bagi setiap jenis kandidat yang belum punya jawabannya sendiri.'))
      .toBeInTheDocument();
    expect(card('Tindakan berikutnya').getByText('Kirimkan Opportunity Overview.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 a candidate type opened: its fields in Indonesian, a hidden word in its order', async () => {
    mount();
    await screen.findByText('Playbook ini langsung berlaku.');
    await userEvent.click(card('Lulusan baru').getByRole('button', { name: 'Ubah' }));
    const fresh = card('Lulusan baru');

    expect(fresh.getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    expect(fresh.getByLabelText('Label')).toHaveValue('Lulusan baru');
    expect(fresh.getByLabelText('Deskripsi singkat')).toHaveValue('Baru masuk dunia kerja.');
    expect(fresh.getByLabelText('Cocok untuk')).toBeInTheDocument();
    expect(fresh.getByRole('group', { name: 'Manfaat' })).toBeInTheDocument();
    expect(fresh.getByLabelText('Manfaat 1')).toHaveValue('Tanpa pengalaman.');
    // The last benefit cannot go, and says why; at the API's most, none is added.
    expect(fresh.getByRole('button', { name: 'Hapus manfaat 1' }))
      .toHaveAttribute('title', 'Setiap jenis kandidat mencantumkan setidaknya satu manfaat.');
    expect(fresh.getByRole('button', { name: '+ Tambah manfaat' }))
      .toHaveAccessibleDescription('Setiap jenis kandidat mencantumkan paling banyak 1 manfaat.');
    expect(fresh.getByRole('heading', { name: 'Kalimat pembuka' })).toBeInTheDocument();
    expect(fresh.getByLabelText('Penghasilan tambahan')).toHaveValue('Mau penghasilan tambahan?');
    expect(fresh.getByRole('heading', { name: 'Keberatan khususnya' })).toBeInTheDocument();
    const own = within(fresh.getByRole('group', { name: 'Khawatir soal waktu' }));
    expect(own.getByLabelText('Dia berkata')).toHaveValue('Saya masih kuliah.');
    expect(own.getByLabelText('Anda menjawab')).toHaveValue('Bisa disesuaikan.');
    expect(own.getByRole('button', { name: 'Hapus keberatan khusus untuk Khawatir soal waktu' })).toBeInTheDocument();
    expect(fresh.getByText('Tambah keberatan khusus untuk')).toBeInTheDocument();
    expect(fresh.getByRole('button', { name: '+ Tidak punya jaringan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a field left empty, refused before anything is sent, in Indonesian', async () => {
    mount();
    await screen.findByText('Playbook ini langsung berlaku.');
    await userEvent.click(card('Tindakan berikutnya').getByRole('button', { name: 'Ubah' }));
    await userEvent.clear(card('Tindakan berikutnya').getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan playbook' }));
    expect(screen.getByText('Tidak tersimpan. Setiap kolom yang ditandai di bawah perlu diperbaiki.')).toBeInTheDocument();
    expect(card('Tindakan berikutnya').getByRole('textbox')).toHaveAccessibleDescription('Isi ini sebelum menyimpan.');
    noEnglishLeft();
  });

  it('AC-1 somebody saved first: which version is stored now, in Indonesian and Indonesian figures', async () => {
    const fresh: PlaybookDto = { ...STORED, version: 4, updatedAt: '2026-10-09T07:10:00.000Z', updatedBy: { name: 'Asih' } };
    mount({
      get: [read(STORED), read(fresh)],
      put: [{ status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Data ini berubah.', requestId: 'r-1' } } }],
    });
    await screen.findByText('Playbook ini langsung berlaku.');
    await userEvent.click(card('Tindakan berikutnya').getByRole('button', { name: 'Ubah' }));
    await userEvent.type(card('Tindakan berikutnya').getByRole('textbox'), ' Hari ini.');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan playbook' }));

    const notice = (await screen.findByText('Playbook ini diubah di tempat lain.')).closest('[role="alert"]') as HTMLElement;
    expect(notice).toHaveTextContent(
      'Sekarang versi 4, disimpan oleh Asih pada 9 Okt 2026, 14.10. Perubahan Anda masih ada di sini, dan menyimpannya '
      + 'akan menggantikan versi itu.',
    );
    expect(within(notice).getByRole('button', { name: 'Muat versi 4' })).toBeInTheDocument();
    expect(within(notice).getByRole('button', { name: 'Pertahankan perubahan saya' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a company with none: its two starts in Indonesian', async () => {
    mount({ get: [read(null)] });
    expect(await screen.findByText(
      'Perusahaan ini belum punya playbook recruitment, jadi Attack Plan agent-nya belum punya bahan untuk disusun.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mulai dari kata-kata AgencyBoost' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mulai dari kosong' }));
    expect(screen.getByText('Belum disimpan.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang sampai ke agent perusahaan ini sampai Anda menyimpannya.')).toBeInTheDocument();
    expect(screen.getAllByText('Belum ditulis.').length).toBeGreaterThan(0);
    noEnglishLeft();
  });

  it('AC-1 a refusal with no words of its own says so in the reader’s language', () => {
    const slots = new Set(['nextAction']);
    expect(placeViolations({ violations: [{ field: 'body.nextAction' }] }, slots, 'id').placed)
      .toEqual({ nextAction: 'Ditolak oleh server.' });
    expect(placeViolations({ violations: [{ field: 'body.nextAction' }] }, slots).placed)
      .toEqual({ nextAction: 'Refused by the server.' });
  });
});
