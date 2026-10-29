import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import {
  browserChose, makeMe, renderInIndonesian, renderWithLanguage, renderWithSession, resetLanguage, routeParams, stubFetch,
} from '@test/harness';
import { authMessages } from '@/i18n/messages/auth';
import ChooseAPasswordPage from '../choose-a-password/page';
import ForgotPasswordPage from './forgot-password/page';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import ResetPasswordPage from './reset-password/[token]/page';
import VerifyEmailPage from './verify-email/[token]/page';

/**
 * **The pages before a session, in Indonesian** (P18.98-T4 AC-1 to AC-4, public and account): sign-in with the
 * development accounts panel, registration (on a leader's invite too), the two password pages, email verification and
 * *Choose your own password*. The approved glossary's words (`i18n/messages/auth.tsx`; the §A.2 titles, *office* is
 * *KPM*), *AgencyBoost* kept, what a person or the company typed as typed, and none of the area's English left
 * (`englishShown`). English is the pages' own specs', unchanged. **Before sign-in the language is the visitor's choice**:
 * the cookie's, read by the app's own provider.
 */
const query = { current: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(query.current),
}));

const ENGLISH = englishOnly(authMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const INSURERS = [{ _id: 'co-1', name: 'Allianz' }, { _id: 'co-2', name: 'Prudential' }];
const BANNER = {
  leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-2', companyName: 'Prudential',
  agentCode: '80777', joinDate: '2026-10-27', fullName: 'Yusuf Hidayat', existingAccount: false, expiresAt: '2026-11-10T03:00:00.000Z',
};
const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_ENV;

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
  query.current = '';
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_ENV;
});

describe('P18.98-T4 the pages before a session in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same page in English shows it', () => {
    expect(ENGLISH.length).toBeGreaterThan(60);
    renderWithSession(<LoginPage />, { me: null });
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['Sign in to continue.', 'Forgot your password?']));
  });

  it('AC-1, AC-2 sign-in: the product’s name kept, the line, the fields and the links in Indonesian', () => {
    renderInIndonesian(<LoginPage />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'AgencyBoost' })).toBeInTheDocument();
    expect(screen.getByText('Masuk untuk melanjutkan.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Kata sandi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lupa kata sandi?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Buat akun' })).toHaveAttribute('href', '/register');
    noEnglishLeft();
  });

  it('AC-1 sign-in after a session ended says so in Indonesian (ADR-0168 §1)', () => {
    query.current = 'next=%2Fprofile&reason=expired';
    renderInIndonesian(<LoginPage />, { me: null });
    expect(screen.getByText('Sesi Anda telah berakhir. Silakan masuk lagi.')).toBeInTheDocument();
    expect(screen.queryByText('Masuk untuk melanjutkan.')).not.toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the resend after an unverified sign-in, in Indonesian', async () => {
    const { ApiRequestError } = await import('@/lib/api-client');
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(403, {
        code: 'AUTH_EMAIL_NOT_VERIFIED', message: 'Verifikasi alamat email Anda sebelum masuk. Periksa kotak masuk email Anda.', requestId: 'r',
      });
    });
    stubFetch({ '/auth/resend-verification': { status: 202, body: { status: 'accepted' } } });
    renderInIndonesian(<LoginPage />, { me: null, signIn });
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'a password');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Kirim ulang email verifikasi' }));
    expect(await screen.findByText('Email sedang dikirim, jika ada akun yang menunggu di alamat itu.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 the development accounts panel: its own words Indonesian, the seeded accounts as the seed writes them', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    renderInIndonesian(<LoginPage />, { me: null });
    expect(screen.getByRole('heading', { name: 'Akun pengembangan' })).toBeInTheDocument();
    const command = screen.getByText('pnpm seed:demo');
    expect(command.tagName).toBe('CODE');
    expect(command.parentElement).toHaveTextContent(/^Dibuat oleh pnpm seed:demo\. .*lingkungan pengembangan dan staging\.$/);
    await userEvent.click(screen.getByRole('button', { name: /^Tampilkan semua \d+ akun$/ }));
    expect(screen.getByRole('button', { name: 'Sembunyikan' })).toHaveAttribute('aria-expanded', 'true');
    // The accounts are the seed's data, in `lib/demo-accounts.ts` and nowhere in the catalogue.
    expect(screen.getByRole('heading', { level: 3, name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByText('superadmin@agencyboost.test · demo super admin')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 registration: the title, the line, every field and its hint, the join month named after the insurer', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderInIndonesian(<RegisterPage />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Buat akun Anda' })).toBeInTheDocument();
    expect(screen.getByText('KPM Anda ditambahkan secara terpisah. Ini hanya akun untuk masuk.')).toBeInTheDocument();
    expect(screen.getByLabelText('Kode agen')).toHaveAccessibleDescription('Tertera di kontrak Anda');
    expect(screen.getByLabelText('Bergabung di perusahaan asuransi Anda')).toHaveAttribute('placeholder', 'TTTT-BB');
    await screen.findByRole('option', { name: 'Prudential' });
    expect(screen.getByLabelText<HTMLSelectElement>('Perusahaan asuransi').options[0].text).toBe('Pilih perusahaan asuransi Anda');
    await userEvent.selectOptions(screen.getByLabelText('Perusahaan asuransi'), 'co-2');
    // The insurer's own name, as stored.
    expect(screen.getByLabelText('Bergabung di Prudential')).toHaveAttribute('type', 'month');
    expect([...screen.getByLabelText<HTMLSelectElement>('Jenis kelamin').options].map((o) => o.text))
      .toEqual(['Pilih', 'Laki-laki', 'Perempuan']);
    expect([...screen.getByLabelText<HTMLSelectElement>('Status').options].map((o) => o.text))
      .toEqual(['Pilih', 'Penuh waktu', 'Paruh waktu']);
    expect(screen.getByLabelText('Kata sandi')).toHaveAccessibleDescription('Minimal 10 karakter. Panjang lebih penting daripada simbol.');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'short ');
    expect(screen.getByText('Gunakan minimal 10 karakter.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi'), 'other');
    expect(screen.getByText('Kedua kata sandi tidak sama.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat akun' })).toBeDisabled();
    // What it waits for, in Indonesian: the shared sentence, handed the reader's language (P18.98-T4).
    expect(screen.getByText(/^Masih diperlukan: /)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sudah punya akun? Masuk' })).toHaveAttribute('href', '/login');
    noEnglishLeft();
  });

  it('AC-1, AC-4 registration done: the address as typed, bold, in one Indonesian sentence', async () => {
    stubFetch({ '/companies': { body: INSURERS }, '/auth/register': { status: 201, body: { status: 'verification_sent' } } });
    renderInIndonesian(<RegisterPage />, { me: null });
    await userEvent.type(screen.getByLabelText('Nama lengkap'), 'Rina Wijaya');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi'), 'a long enough password');
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Perusahaan asuransi'), 'co-2');
    await userEvent.type(screen.getByLabelText('Kode agen'), '88213');
    fireEvent.change(screen.getByLabelText('Tanggal lahir'), { target: { value: '1990-03-15' } });
    fireEvent.change(screen.getByLabelText('Bergabung di Prudential'), { target: { value: '2021-07' } });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'full_time');
    await userEvent.selectOptions(screen.getByLabelText('Jenis kelamin'), 'female');
    await userEvent.click(screen.getByRole('button', { name: 'Buat akun' }));

    const sent = await screen.findByText(/tautan verifikasi sedang dikirim/);
    expect(sent).toHaveTextContent(/^Jika rina@kpm0417\.test dapat didaftarkan, tautan verifikasi sedang dikirim\.$/);
    expect(screen.getByText('rina@kpm0417.test').tagName).toBe('STRONG');
    expect(screen.getByText(/berlaku 24 jam dan hanya bisa dipakai sekali/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke halaman masuk' })).toHaveAttribute('href', '/login');
    noEnglishLeft();
  });

  it('AC-1, AC-3, AC-4 registration on a leader’s invite: the banner whole, the leader, office and company as stored', async () => {
    query.current = 'invite=kpm-1.secret';
    stubFetch({ '/companies': { body: INSURERS }, '/invites/': { body: BANNER } });
    renderInIndonesian(<RegisterPage />, { me: null });
    expect(await screen.findByText('Anda bergabung ke tim Agus Prasetyo · KPM 0417')).toBeInTheDocument();
    expect(screen.getByText('BSD City Branch · Prudential. Kode agen dan tanggal bergabung Anda sudah tercantum di undangan.'))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Tanggal bergabung')).toHaveValue('2026-10-27');
    noEnglishLeft();
  });

  it('AC-1 an invite for an account that exists, in Indonesian', async () => {
    query.current = 'invite=kpm-1.secret';
    stubFetch({ '/companies': { body: INSURERS }, '/invites/': { body: { ...BANNER, existingAccount: true } } });
    renderInIndonesian(<RegisterPage />, { me: null });
    expect(await screen.findByText('Undangan ini untuk akun yang sudah ada. Masuk untuk menerimanya.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk untuk menerima' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 an invite link that opens nothing: the server’s sentence, then the two ways on in Indonesian', async () => {
    query.current = 'invite=kpm-1.secret';
    stubFetch({
      '/companies': { body: INSURERS },
      '/invites/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Undangan ini sudah kedaluwarsa.', requestId: 'r' } } },
    });
    renderInIndonesian(<RegisterPage />, { me: null });
    expect(await screen.findByText('Undangan ini sudah kedaluwarsa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Buat akun tanpa undangan' })).toHaveAttribute('href', '/register');
    noEnglishLeft();
  });

  it('AC-1, AC-4 reset your password: the form, then the same confirmation for any address', async () => {
    stubFetch({ '/auth/forgot-password': { status: 202, body: {} } });
    renderInIndonesian(<ForgotPasswordPage />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Atur ulang kata sandi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Kami akan mengirim tautan atur ulang kata sandi ke alamat ini.');
    noEnglishLeft();
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim tautan atur ulang' }));
    expect(await screen.findByText(/tautan atur ulang kata sandi sedang dikirim/))
      .toHaveTextContent(/^Jika ada akun untuk rina@kpm0417\.test, tautan atur ulang kata sandi sedang dikirim\.$/);
    expect(screen.getByText(/kedaluwarsa dalam 30 menit/)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 choose a new password: the rules, the mismatch and the link inside its sentence', async () => {
    renderInIndonesian(<ResetPasswordPage params={routeParams({ token: 'tok-1' })} />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Buat kata sandi baru' })).toBeInTheDocument();
    expect(screen.getByText(/^Ini membuat Anda keluar di semua perangkat lain/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'short');
    expect(screen.getByText('Gunakan minimal 10 karakter.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi'), 'other');
    expect(screen.getByText('Kedua kata sandi tidak sama.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atur kata sandi baru' })).toBeDisabled();
    const link = screen.getByRole('link', { name: 'Minta tautan baru' });
    expect(link).toHaveAttribute('href', '/forgot-password');
    expect(link.parentElement).toHaveTextContent(/^Tautan sudah kedaluwarsa\? Minta tautan baru\.$/);
    noEnglishLeft();
  });

  it('AC-1 verify your email: the wait, then verified, then a link that failed', async () => {
    stubFetch({ '/auth/verify-email': { body: { status: 'verified' } } });
    const { unmount } = renderInIndonesian(<VerifyEmailPage params={routeParams({ token: 'tok-1' })} />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Verifikasi email Anda' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa tautan Anda…');
    expect(await screen.findByText('Email Anda sudah terverifikasi. Sekarang Anda dapat masuk.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka halaman masuk' })).toHaveAttribute('href', '/login');
    noEnglishLeft();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({
      '/auth/verify-email': { status: 400, body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'Tautan itu sudah tidak berlaku. Minta tautan baru.', requestId: 'r' } } },
    });
    renderInIndonesian(<VerifyEmailPage params={routeParams({ token: 'tok-2' })} />, { me: null });
    expect(await screen.findByText(/^Tautan verifikasi hanya bisa dipakai sekali dan kedaluwarsa setelah 24 jam\./)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 choose your own password: the line, the account’s address bold, the rules and the button', async () => {
    renderInIndonesian(<ChooseAPasswordPage />, { me: makeMe({ mustChangePassword: true }) });
    expect(screen.getByRole('heading', { level: 1, name: 'Buat kata sandi Anda sendiri' })).toBeInTheDocument();
    expect(screen.getByText(/diteruskan oleh KPM Anda, jadi orang lain sudah pernah melihatnya/)).toBeInTheDocument();
    expect(screen.getByText('rina@kpm0417.test').parentElement).toHaveTextContent(/^Masuk sebagai rina@kpm0417\.test\.$/);
    const sent = 'kfmp-3xqz-7bdn-r4vw';
    await userEvent.type(screen.getByLabelText('Kata sandi yang dikirimkan kepada Anda'), sent);
    await userEvent.type(screen.getByLabelText('Kata sandi baru Anda'), sent);
    expect(screen.getByText('Pilih kata sandi yang berbeda dari yang dikirimkan kepada Anda.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi baru Anda'), 'x');
    expect(screen.getByText('Kedua kata sandi tidak sama.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan dan masuk lagi' })).toBeDisabled();
    expect(screen.getByText('Anda akan keluar dari semua perangkat dan diminta masuk dengan kata sandi baru.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

/**
 * **Before sign-in the language is the visitor's choice** (P18.98-T2 AC-5; ADR-0179 §2): there is no account to read,
 * so a public page reads the `ab_lang` cookie the app's own provider finds on its first commit — and, while the switch
 * is not live, a visitor who chose nothing reads English, as every page did before the phase.
 */
describe('P18.98-T4 a public page in the visitor’s language, under the app’s provider', () => {
  it('reads Indonesian for a browser that chose it, before anybody signs in', () => {
    browserChose('id');
    renderWithLanguage(<LoginPage />, { me: null }, { live: false });
    expect(screen.getByText('Masuk untuk melanjutkan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('reads English for a visitor who chose nothing while the switch is not live, and Indonesian once it is', () => {
    const { unmount } = renderWithLanguage(<ForgotPasswordPage />, { me: null }, { live: false });
    expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();
    unmount();
    // A fresh browser: the provider above wrote `<html lang>`, which the next one would read as the browser's choice.
    resetLanguage();
    renderWithLanguage(<ForgotPasswordPage />, { me: null }, { live: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Atur ulang kata sandi' })).toBeInTheDocument();
  });
});
