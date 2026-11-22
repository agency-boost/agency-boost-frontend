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

const row = (title: string) => screen.getByText(title, { selector: 'p' }).closest('li') as HTMLElement;
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;
const ENGLISH = /\b(Missing|Complete|Uploaded|needs confirmation|Optional|Not uploaded yet|updated|View PDF|Replace|Upload (PDF|file)|is (complete|incomplete)|needs checking|Confirm this PDF|Ready|materials ready|Any format)\b/;

/**
 * **P18.10-T4, the recruitment pitch in ID mode** — *Settings › Recruitment pitch* and the agents' *Pitch Materials*,
 * one component: the cards' and the banner's words the approved glossary's Indonesian, *Recruitment pitch* and
 * *Recruitment Pitch* kept English (§A), the server's titles and labels and the office's file names as typed, a file's
 * size and day in Indonesian figures, and none of OD-39's six words. In English: `page.spec.tsx`.
 */
describe('P18.10-T4 the recruitment pitch in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-6 says the list in Indonesian — “2/6 materi siap”, Siap · Perlu dicek · Belum ada, Lihat · Ganti · Unggah file', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    await screen.findByText('FAQ');

    expect(screen.getByRole('heading', { name: 'Recruitment pitch', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('2 dari 6 materi siap')).toHaveTextContent('2/6');
    expect(screen.getAllByText('materi siap · dipakai agent di Recruitment › Pitch Materials')[0]).toBeInTheDocument();
    expect(within(row('Opportunity Overview')).getByText('Gambaran_Peluang_v3.pdf · 12 Okt 2026')).toBeInTheDocument();
    expect(within(row('Opportunity Overview')).getByText('Perlu dicek')).toBeInTheDocument();
    expect(within(row('Opportunity Overview')).getByRole('button', { name: /^Lihat Opportunity Overview/ })).toHaveTextContent('Lihat');
    expect(within(row('Proof & Credibility')).getByText('Siap')).toBeInTheDocument();
    expect(within(row('Proof & Credibility')).getByRole('button', { name: 'Ganti, Proof & Credibility' })).toHaveTextContent('Ganti');
    expect(within(row('FAQ')).getByText('Belum ada')).toBeInTheDocument();
    expect(within(row('FAQ')).getByText('Belum diunggah')).toBeInTheDocument();
    expect(within(row('FAQ')).getByRole('button', { name: 'Unggah file, FAQ' })).toHaveTextContent('Unggah file');
    expect(screen.getByText('Format apa saja: PDF, PowerPoint, Word, gambar, video, atau link')).toBeInTheDocument();
    expect(screen.queryByText('Opsional')).not.toBeInTheDocument();
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

  it('P19.21-T3 AC-6 refuses a file in Indonesian before anything is sent, its size in Indonesian figures', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    await screen.findByText('FAQ');
    const picker = row('FAQ').querySelector('input[type=file]') as HTMLInputElement;
    const huge = new File(['%PDF'], 'besar.mp4', { type: 'video/mp4' });
    Object.defineProperty(huge, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(picker, huge);

    expect(await within(row('FAQ')).findByText(
      '“besar.mp4” berukuran 26,0 MB. Ukuran file maksimal 25 MB — berikan video yang lebih besar sebagai link.',
    )).toBeInTheDocument();
    await userEvent.upload(picker, new File(['x'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), { applyAccept: false });
    expect(await within(row('FAQ')).findByText(
      '“data.xlsx” bukan format materi pitch. Unggah PDF, PowerPoint, Word, gambar, atau video — atau berikan link.',
    )).toBeInTheDocument();
  });

  it('AC-1 says a stale tick in Indonesian', async () => {
    stubFetch({
      'GET /recruitment/pitch-materials': { body: PITCH },
      'PUT /confirmations/support': {
        status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Berubah.', requestId: 'r-1' } },
      },
    });
    renderInIndonesian(<RecruitmentPitchPage />, { me: OWNER });
    await screen.findByText('FAQ');
    // P19.21-T3 AC-6: the ticks are behind *Lihat*, in the material's sheet.
    await userEvent.click(within(row('Opportunity Overview')).getByRole('button', { name: /^Lihat Opportunity Overview/ }));
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
 * **P18.10-T3's rule on the pitch, now that P18.10-T4 wired it**: under the app's own provider a reader who chose
 * nothing, while the switch is not live, reads English words and Indonesian figures — the cards as they were.
 */
describe('P18.10-T4 the pitch’s figures follow the reader’s choice', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetLanguage(); });

  it('not live and unchosen: English words, the size and the day Indonesian', async () => {
    stubFetch({ 'GET /recruitment/pitch-materials': { body: PITCH } });
    renderWithLanguage(<PitchMaterials audience="agent" />, {}, { live: false });
    const opportunity = await screen.findByRole('article', { name: 'Opportunity Overview' });
    expect(within(opportunity).getByText('2,4 MB · updated 12 Okt 2026')).toBeInTheDocument();
  });
});
