import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, renderWithLanguage, resetLanguage, stubFetch } from '@test/harness';
import { describeDevice } from '@/components/session-list';
import { accountMessages } from '@/i18n/messages/account';
import ProfilePage from './page';

/**
 * ***Your account* in Indonesian** (P18.98-T4 AC-1 to AC-4, public and account): *Your details* with what a person
 * records, *Password* with what it waits for, and *Where you are signed in*. The approved glossary's words
 * (`i18n/messages/account.ts`; the §A.2 title *Akun Anda*, a person *dia*), the pronoun's options kept English (English
 * pronouns, which only English sentences use), the email, an address and a browser's and a system's names as they come,
 * a session's last use in the reader's figures, and none of the area's English left. English is the page's own specs'.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

const ENGLISH = englishOnly(accountMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const ME = makeMe({ permissions: ['profile:read_self'], user: { ...makeMe().user, gender: null, workStatus: null } });
const SESSIONS = [
  {
    sessionId: 's1', userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit Chrome/120 Mobile Safari', ip: '103.10.1.2',
    lastUsedAt: '2026-09-10T08:00:00.000Z', startedAt: '2026-09-01T08:00:00.000Z', expiresAt: '2026-10-01T08:00:00.000Z', current: true,
  },
  {
    sessionId: 's2', userAgent: 'curl/8.4.0', ip: null, lastUsedAt: null,
    startedAt: '2026-09-01T08:00:00.000Z', expiresAt: '2026-10-01T08:00:00.000Z', current: false,
  },
];
const READS = { '/auth/sessions': { body: SESSIONS }, '/notifications': { body: { items: [], unread: 0 } } };

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('P18.98-T4 Your account in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(30);
    expect(ENGLISH).toEqual(expect.arrayContaining(['Your details', 'Where you are signed in']));
    // The pronoun's options are kept, so they are not among what ID mode must not show.
    expect(ENGLISH).not.toContain('she / her');
  });

  it('AC-1, AC-2 Your details: the title, every field and its hint, the pronoun’s options kept, Not recorded', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    expect(screen.getByRole('heading', { level: 1, name: 'Akun Anda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Data diri Anda' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama lengkap')).toHaveValue('Rina Wijaya');
    expect(screen.getByLabelText('Nama panggilan')).toHaveAccessibleDescription('Nama yang dipakai rekan kerja untuk memanggil Anda sehari-hari.');
    const pronoun = screen.getByLabelText<HTMLSelectElement>('Kata ganti');
    expect(pronoun).toHaveAccessibleDescription(/^Anda yang menentukan\. Dipakai di kalimat komitmen berbahasa Inggris/);
    expect([...pronoun.options].map((o) => o.text)).toEqual(['she / her', 'he / him', 'they / them']);
    expect(screen.getByLabelText<HTMLSelectElement>('Jenis kelamin').selectedOptions[0].text).toBe('Belum dicatat');
    expect(screen.getByLabelText<HTMLSelectElement>('Status').selectedOptions[0].text).toBe('Belum dicatat');
    expect(screen.getByLabelText('Bergabung di perusahaan asuransi Anda')).toHaveAttribute('placeholder', 'TTTT-BB');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    await screen.findByText('Perangkat ini');
    noEnglishLeft();
  });

  it('AC-1 saved, in Indonesian', async () => {
    stubFetch({ ...READS, '/auth/me': { body: {} } });
    renderInIndonesian(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Tersimpan.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a support session: every field shown and not offered, its reason in Indonesian', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: makeMe({ ...ME, isImpersonating: true, impersonatedBy: 'u-root' }) });
    expect(screen.getAllByText('Hanya dia yang dapat mengubah ini, bukan sesi dukungan.').length).toBeGreaterThan(5);
    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();
    await screen.findByText('Perangkat ini');
    noEnglishLeft();
  });

  it('AC-1, AC-3 Password: the line, the fields, the rules and what the button waits for, then changed', async () => {
    stubFetch({ ...READS, '/auth/change-password': { body: { status: 'changed' } } });
    renderInIndonesian(<ProfilePage />, { me: ME });
    expect(screen.getByRole('heading', { name: 'Kata sandi' })).toBeInTheDocument();
    expect(screen.getByText('Mengubahnya akan mengeluarkan Anda dari sesi lain. Sesi ini tetap terbuka.')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Ubah kata sandi' });
    // What the button waits for, in Indonesian: the shared sentence, handed the reader's language (P18.98-T4).
    expect(screen.getByText(/^Masih diperlukan: Kata sandi saat ini, /)).toBeInTheDocument();
    expect(screen.getByLabelText('Kata sandi baru')).toHaveAccessibleDescription('Minimal 10 karakter. Panjang lebih penting daripada simbol.');
    await userEvent.type(screen.getByLabelText('Kata sandi saat ini'), 'old password');
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'short');
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi baru'), 'short');
    expect(submit).toHaveAccessibleDescription('Kata sandi baru minimal 10 karakter.');
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), ' but now long enough');
    expect(submit).toHaveAccessibleDescription('Perbaiki kata sandi di atas.');
    expect(screen.getByText('Kedua kata sandi tidak sama.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi baru'), ' but now long enough');
    await userEvent.click(submit);
    expect(await screen.findByText('Kata sandi diubah. Anda sudah dikeluarkan dari sesi lain.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3, AC-4 Where you are signed in: devices by their own names, the last use in Indonesian figures', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    expect(await screen.findByText('Perangkat ini')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perangkat tempat Anda masuk' })).toBeInTheDocument();
    expect(screen.getByText('Chrome di Android')).toBeInTheDocument();
    expect(screen.getByText('103.10.1.2 · terakhir dipakai 10 Sep 2026, 15.00')).toBeInTheDocument();
    expect(screen.getByText('Perangkat tidak dikenal')).toBeInTheDocument();
    expect(screen.getByText('Alamat tidak dikenal · terakhir dipakai tidak diketahui')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Keluarkan perangkat ini' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Keluar dari semua perangkat' })).toBeInTheDocument();
    expect(screen.getByText('Mengakhiri semua sesi, termasuk sesi ini. Gunakan ini jika ponsel Anda hilang.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T3 a reader who chose nothing reads English words and a session’s last use in Indonesian figures, not live', async () => {
    stubFetch(READS);
    renderWithLanguage(<ProfilePage />, { me: ME }, { live: false });
    expect(await screen.findByText('103.10.1.2 · last used 10 Sep 2026, 15.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument();
  });
});

describe('P18.98-T4 describeDevice, in the words’ language', () => {
  it('names a device in Indonesian, a browser’s and a system’s names their own', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari', 'id')).toBe('Chrome di Android');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit', 'id')).toBe('iPhone atau iPad');
    expect(describeDevice(null, 'id')).toBe('Perangkat tidak dikenal');
    expect(describeDevice('curl/8.4.0', 'id')).toBe('Perangkat tidak dikenal');
  });

  it('reads English when no language is passed, as its spec always has', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605')).toBe('Safari on Mac');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit')).toBe('iPhone or iPad');
  });
});
