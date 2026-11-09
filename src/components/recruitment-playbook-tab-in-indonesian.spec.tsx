import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { useState } from 'react';
import { makeMe, renderInIndonesian } from '@test/harness';
import type { ApiError } from '@/lib/api-client';
import { adminTemplatePlaybookMessages } from '@/i18n/messages/admin-template-playbook';
import { planMessages } from '@/i18n/messages/plan';
import type { PlaybookBody } from '@/lib/recruitment-playbook';
import { placeViolations, RecruitmentPlaybookEditor } from './recruitment-playbook-tab';

/**
 * **P18.10-T6, a template's *Rekrutmen* section in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"; a section
 * since P19.4-T5, ADR-0210): the playbook's frame in the approved glossary's Indonesian (`admin-template-playbook.tsx`,
 * with the attack plans' *Cocok untuk* and *Kalimat pembuka*), *Playbook* and *recruitment* kept English (§A.6), every
 * word of the playbook and the brief's vocabulary as the template and the API wrote them (ADR-0179 §5). The same section
 * in English is `recruitment-playbook-tab.spec.tsx`.
 */
const ENGLISH = englishOnly(adminTemplatePlaybookMessages, planMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

/** The brief's vocabulary as the API serves it — in the reader's language, the API's (P18.10-T5). */
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
const PLAYBOOK = { defaults: BODY, vocabulary: VOCABULARY, limits: { textMax: 600, benefitsMax: 1 } };
const SUPER_ADMIN = makeMe({ permissions: ['company_template:read', 'company_template:write'] });

/** The section's editor over a draft held as the section page holds it, in Indonesian. */
function mount({ payload = BODY as unknown as Record<string, unknown>, refusal = null }: {
  payload?: Record<string, unknown>; refusal?: ApiError | null;
} = {}) {
  function Section() {
    const [draft, setDraft] = useState(payload);
    return <RecruitmentPlaybookEditor payload={draft} playbook={PLAYBOOK} refusal={refusal} onChange={setDraft} />;
  }
  renderInIndonesian(<Section />, { me: SUPER_ADMIN });
}

const card = (name: string) => within(screen.getByRole('group', { name }));

describe('P18.10-T6, P19.4-T5 AC-6 the Rekrutmen section in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Objections', 'Not published. Each field marked below needs a fix.']));
  });

  it('AC-1, AC-4 the playbook: its cards in Indonesian, its words as typed', () => {
    mount();
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

  it('P19.4-T5 AC-6 a Terbitkan refused field by field, in Indonesian', () => {
    mount({
      refusal: {
        code: 'VALIDATION_FAILED', message: 'Playbook ini tidak dapat diterbitkan: body.nextAction — Tidak boleh kosong.',
        requestId: 'r-1', details: { violations: [{ field: 'body.nextAction', message: 'Tidak boleh kosong.' }] },
      },
    });
    expect(screen.getByText('Belum terbit. Setiap kolom yang ditandai di bawah perlu diperbaiki.')).toBeInTheDocument();
    expect(card('Tindakan berikutnya').getByRole('textbox')).toHaveAccessibleDescription('Tidak boleh kosong.');
    noEnglishLeft();
  });

  it('P19.4-T5 AC-6 a template with none: its two starts in Indonesian', async () => {
    mount({ payload: {} });
    expect(screen.getByText(
      'Template ini belum punya playbook recruitment, jadi Attack Plan setiap KPM yang dibuat darinya belum punya bahan '
      + 'untuk disusun.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mulai dari kata-kata AgencyBoost' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mulai dari kosong' }));
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
