import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithLanguage, resetLanguage, stubFetch } from '@test/harness';
import { PitchMaterials } from '@/components/recruitment/pitch-materials';
import type { PitchMaterialsView, PitchSlot } from '@/lib/recruitment-pitch';
import RecruitmentPitchPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/recruitment-pitch',
}));

/** The server's checklist labels and slot titles: shown as they are served, in both languages. */
const LABELS = { income: 'Income Potential / compensation illustration', support: 'Support provided (training, coaching, tools)' };
const slot = (over: Partial<PitchSlot>): PitchSlot => ({
  slot: 'faq', title: 'FAQ', line: 'line', required: true, state: 'missing', file: null, checklist: [], version: 0, ...over,
});
const PITCH: PitchMaterialsView = {
  slots: [
    slot({
      slot: 'opportunity', title: 'Opportunity Overview', state: 'partial', version: 1,
      file: { name: 'Gambaran_Peluang_v3.pdf', bytes: 2.4 * 1024 * 1024, uploadedOn: '2026-10-12' },
      checklist: [{ code: 'income', label: LABELS.income, ticked: true }, { code: 'support', label: LABELS.support, ticked: false }],
    }),
    slot({ slot: 'proof', title: 'Proof & Credibility', state: 'uploaded', version: 1, file: { name: 'Bukti.pdf', bytes: 14_336, uploadedOn: '2026-08-30' } }),
    slot({ slot: 'faq', title: 'FAQ' }),
    slot({ slot: 'howtojoin', title: 'How to Join' }),
    slot({ slot: 'company', title: 'Company Profile', required: false, state: 'uploaded', version: 1, file: { name: 'Profil.pdf', bytes: 640, uploadedOn: '2026-09-26' } }),
    slot({ slot: 'agency', title: 'Agency Profile', required: false }),
  ],
  summary: { done: 1, total: 4, missing: 2, unconfirmed: 1 },
};
const COMPLETE: PitchMaterialsView = {
  slots: PITCH.slots.map((s) => (s.required ? { ...s, state: 'uploaded', file: s.file ?? { name: 'x.pdf', bytes: 2048, uploadedOn: '2026-10-01' } } : s)),
  summary: { done: 4, total: 4, missing: 0, unconfirmed: 0 },
};

const member = { membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const, status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0 };
const OWNER = makeMe({ membership: member, permissions: ['member:read_profile', 'kpm:read_profile', 'tenant_config:read', 'tenant_config:write', 'recruitment:read'] });

const card = (title: string) => screen.getByRole('article', { name: title });
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;
const ENGLISH = /\b(Missing|Complete|Uploaded|needs confirmation|Optional|Not uploaded yet|updated|View PDF|Replace|Upload PDF|is (complete|incomplete)|needs checking|Confirm this PDF)\b/;

/**
 * **P18.98-T4, the recruitment pitch in ID mode** — *Settings › Recruitment pitch* and the agents' *Pitch Materials*,
 * one component: the cards' and the banner's words the approved glossary's Indonesian, *Recruitment pitch* and
 * *Recruitment Pitch* kept English (§A), the server's titles and labels and the office's file names as typed, a file's
 * size and day in Indonesian figures, and none of OD-39's six words. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 the recruitment pitch in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says the office’s page in Indonesian, its figures Indonesian and the server’s words as served', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    const opportunity = await screen.findByRole('article', { name: 'Opportunity Overview' });

    expect(screen.getByRole('heading', { name: 'Recruitment pitch', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Recruitment Pitch belum lengkap')).toBeInTheDocument();
    expect(screen.getByText('2 belum ada, 1 perlu dicek.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 dari 4 dokumen lengkap' })).toHaveTextContent('1/4');
    expect(within(opportunity).getByText('Terunggah · perlu konfirmasi')).toBeInTheDocument();
    expect(within(opportunity).getByText('Gambaran_Peluang_v3.pdf')).toBeInTheDocument();
    expect(within(opportunity).getByText('2,4 MB · diperbarui 12 Okt 2026')).toBeInTheDocument();
    expect(within(opportunity).getByRole('group', { name: 'Pastikan PDF ini benar-benar memuat' })).toBeInTheDocument();
    expect(within(opportunity).getByRole('checkbox', { name: LABELS.income })).toBeChecked();
    expect(within(opportunity).getByRole('button', { name: 'Lihat PDF, Opportunity Overview — terbuka di tab baru' }))
      .toHaveTextContent('Lihat PDF');
    expect(within(opportunity).getByRole('button', { name: 'Ganti, Opportunity Overview' })).toHaveTextContent('Ganti');
    expect(within(card('Proof & Credibility')).getByText('14 KB · diperbarui 30 Agu 2026')).toBeInTheDocument();
    expect(within(card('FAQ')).getByText('Belum ada')).toBeInTheDocument();
    expect(within(card('FAQ')).getByText('Belum diunggah')).toBeInTheDocument();
    expect(within(card('FAQ')).getByRole('button', { name: 'Unggah PDF, FAQ' })).toHaveTextContent('Unggah PDF');
    expect(within(card('Company Profile')).getByText('Opsional')).toBeInTheDocument();
    expect(within(card('Company Profile')).getByText('< 1 KB · diperbarui 26 Sep 2026')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
    expect(document.body.textContent).not.toMatch(SIX_WORDS);
  });

  it('AC-2 says the banner complete in Indonesian, the kept name English', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: COMPLETE } });
    renderInIndonesian(<PitchMaterials audience="agent" />);
    expect(await screen.findByText('Recruitment Pitch sudah lengkap')).toBeInTheDocument();
    expect(screen.getByText(
      'Semua 4 dokumen sudah diunggah dan dikonfirmasi penuh — siap ditunjukkan atau dikirim ke kandidat.',
    )).toBeInTheDocument();
    expect(screen.getAllByText('Terunggah').length).toBeGreaterThan(0);
  });

  it('AC-1 refuses a file in Indonesian before anything is sent, its size in Indonesian figures', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    await screen.findByRole('article', { name: 'FAQ' });
    const picker = card('FAQ').querySelector('input[type=file]') as HTMLInputElement;
    const huge = new File(['%PDF'], 'besar.pdf', { type: 'application/pdf' });
    Object.defineProperty(huge, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(picker, huge);

    expect(await within(card('FAQ')).findByText('“besar.pdf” berukuran 26,0 MB. Ukuran PDF maksimal 25 MB.')).toBeInTheDocument();
    await userEvent.upload(picker, new File(['x'], 'scan.pdf', { type: 'image/png' }));
    expect(await within(card('FAQ')).findByText('“scan.pdf” bukan PDF. Hanya PDF yang dapat diunggah di sini.')).toBeInTheDocument();
  });

  it('AC-1 says a stale tick in Indonesian', async () => {
    stubFetch({
      'GET /recruitment/pitch-materials': { body: PITCH },
      'PUT /confirmations/support': {
        status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Berubah.', requestId: 'r-1' } },
      },
    });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    const opportunity = await screen.findByRole('article', { name: 'Opportunity Overview' });
    await userEvent.click(within(opportunity).getByRole('checkbox', { name: LABELS.support }));

    expect(await within(opportunity).findByText(
      'PDF ini diganti saat halaman sedang terbuka, jadi centangnya dihapus. Periksa file baru, lalu centang lagi.',
    )).toBeInTheDocument();
  });

  it('AC-1 says a failed read in Indonesian, and offers to try again', async () => {
    stubFetch({
      'GET /recruitment/pitch-materials': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Rusak.', requestId: 'r-2' } } },
    });
    renderInIndonesian(<PitchMaterials audience="agent" />);
    expect(await screen.findByText('Tidak dapat membaca dokumen pitch.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});

/**
 * **P18.98-T3's rule on the pitch, now that P18.98-T4 wired it**: under the app's own provider a reader who chose
 * nothing, while the switch is not live, reads English words and Indonesian figures — the cards as they were.
 */
describe('P18.98-T4 the pitch’s figures follow the reader’s choice', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetLanguage(); });

  it('not live and unchosen: English words, the size and the day Indonesian', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderWithLanguage(<PitchMaterials audience="agent" />, {}, { live: false });
    const opportunity = await screen.findByRole('article', { name: 'Opportunity Overview' });
    expect(within(opportunity).getByText('2,4 MB · updated 12 Okt 2026')).toBeInTheDocument();
  });
});
