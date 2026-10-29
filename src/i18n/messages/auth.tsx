import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The pages somebody meets before they are anybody** (P18.98-T4, public and account; `api/auth-and-sessions.md`, *The
 * screens' own strings*): sign-in (`/login`) with the development accounts panel's own words, registration
 * (`/register`, on a leader's invite too), *Reset your password* (`/forgot-password`), *Choose a new password*
 * (`/reset-password/[token]`), *Verify your email* (`/verify-email/[token]`), and *Choose your own password*
 * (`/choose-a-password`), with the password rules the four forms share.
 *
 * **English is the source**, word for word as the pages wrote it. The Indonesian is the approved glossary's — the five
 * titles that are sentences (§A.2: *Buat akun Anda*, *Atur ulang kata sandi*, *Buat kata sandi baru*, *Verifikasi email
 * Anda*, *Buat kata sandi Anda sendiri*), *Masuk*, *Lupa kata sandi?*, *Buat akun*, *Kirim ulang* (§B.1), *Sedang
 * masuk…*, *Menyimpan…*, *Mengirim…* (§B.2), *Nama lengkap*, *Kata sandi*, *Konfirmasi kata sandi*, *Kode agen*,
 * *Tanggal bergabung* (§B.4), *Kedua kata sandi tidak sama.*, *Gunakan minimal {n} karakter.* (§B.5), *Sesi Anda telah
 * berakhir. Silakan masuk lagi.*, *Masuk untuk melanjutkan.* (§B.6); *office* is *KPM* (§B.9), *link* *tautan* (§B.0
 * rule 6), *expired* *kedaluwarsa* and *insurer* *perusahaan asuransi* (§B.10) — with what it lacked proposed in the
 * glossary for approval's §B.10 (*tautan atur ulang*, *Akun pengembangan*, *TTTT-BB* …). **Kept** (§A): *AgencyBoost*,
 * *KPM*, *leader*.
 *
 * **Typed content stays as typed**: an insurer's name (*Joined Prudential*), a leader's name, an office's code and
 * branch, a company's name, an email address, an agent code, the server's sentences. **The development accounts' own
 * data is not here** — each account's role, where it lands and its group stay in `lib/demo-accounts.ts`, behind the
 * literal `NEXT_PUBLIC_APP_ENV` comparison that folds them out of every other build with the credentials beside them
 * (ADR-0041; the frontend's *Hiding is not excluding*): a catalogue area ships in every build. **A figure is never a
 * message's**: the invite's join date is the shared date field's.
 *
 * @moved app/(auth)/
 * @moved app/choose-a-password/
 * @moved components/demo-accounts-panel.tsx
 * @moved components/auth-page.ts
 */

/** Words drawn otherwise: a code, a link. */
type Wrap = (words: string) => ReactNode;

const en = {
  /** `/login` (ADR-0168 §1 for its line). */
  signIn: {
    title: kept('AgencyBoost'),
    sessionEnded: 'Your session ended. Sign in again.',
    toContinue: 'Sign in to continue.',
    /** The one refusal a person can act on from here (P4-T13). */
    resend: 'Send the verification email again',
    resent: 'On its way, if that address has an account waiting.',
    email: 'Email',
    password: 'Password',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    forgot: 'Forgot your password?',
    createAccount: 'Create an account',
  },
  /** The development accounts panel's own words (development and staging only; ADR-0041). Not the accounts. */
  demo: {
    heading: 'Development accounts',
    /** `code` draws the seed's command as code. */
    line: ({ code }: { code: Wrap }) => (
      <>
        Seeded by {code('pnpm seed:demo')}. Choosing one fills the form and
        signs in. This panel appears in development and staging only.
      </>
    ),
    hide: 'Hide',
    showAll: ({ n }: { n: number }) => `Show all ${n} accounts`,
  },
  /** The rules every form that makes a password applies, and says. */
  password: {
    hint: ({ n }: { n: number }) => `At least ${n} characters. Length beats symbols.`,
    tooShort: ({ n }: { n: number }) => `Use at least ${n} characters.`,
    padded: 'Do not begin or end with a space.',
    mismatch: 'The two passwords do not match.',
    saving: 'Saving…',
  },
  /** `/register` (ADR-0017, ADR-0158; on a leader's invite, P18.96-T3 AC-4). */
  register: {
    title: 'Create your account',
    line: 'Your office is added separately. This is just your login.',
    /** `email` the address typed, drawn bold. */
    sent: ({ email }: { email: ReactNode }) => <>If {email} can be registered, a verification link is on its way.</>,
    sentLine: 'Open it to finish setting up your account. The link lasts 24 hours and works once.',
    backToSignIn: 'Back to sign in',
    fullName: 'Full name',
    dateOfBirth: 'Date of birth',
    gender: 'Gender',
    choose: 'Choose',
    insurer: 'Insurer',
    insurerHint: 'Whoever issued your agent code.',
    loading: 'Loading…',
    chooseInsurer: 'Choose your insurer',
    agentCode: 'Agent code',
    agentCodeHint: 'Found on your contract',
    /** The join month's label: the insurer's own name once one is chosen, as stored. */
    joined: ({ insurer }: { insurer: string | null }) => `Joined ${insurer ?? 'your insurer'}`,
    joinedHint: 'The month and year you joined them.',
    /** A month box's shape, where a browser draws a plain box for it. */
    monthShape: 'YYYY-MM',
    status: 'Status',
    email: 'Email',
    emailHint: 'Your verification link goes here.',
    password: 'Password',
    confirmPassword: 'Confirm password',
    creating: 'Creating…',
    create: 'Create account',
    fixPassword: 'Fix the password above.',
    haveAccount: 'Already have an account? Sign in',
    signIn: 'Sign in',
    /** On a leader's invite: the banner, its line, the join date, and the two ways a link that opens nothing leaves. */
    invite: {
      banner: ({ leader, kpm }: { leader: string; kpm: string }) => `You're joining ${leader}'s team · ${kept('KPM')} ${kpm}`,
      bannerLine: ({ branch, company }: { branch: string; company: string }) =>
        `${branch} · ${company}. Your agent code and join date come with the invite.`,
      joinDate: 'Join date',
      existing: 'This invite is for an account that already exists. Sign in to accept it.',
      signInToAccept: 'Sign in to accept',
      withoutInvite: 'Create an account without an invite',
      doneLine: ({ leader }: { leader: string }) => `Once you have verified it and signed in, you are in ${leader}'s team.`,
      checking: 'Checking your invite…',
    },
  },
  /** `/forgot-password`. */
  forgot: {
    title: 'Reset your password',
    /** `email` the address typed, drawn bold. */
    sent: ({ email }: { email: ReactNode }) => <>If an account exists for {email}, a reset link is on its way.</>,
    sentLine: 'The link expires in 30 minutes. Check your spam folder before requesting another.',
    backToSignIn: 'Back to sign in',
    email: 'Email',
    emailHint: 'We will send a reset link to this address.',
    sending: 'Sending…',
    send: 'Send reset link',
  },
  /** `/reset-password/[token]`. */
  reset: {
    title: 'Choose a new password',
    line: 'This signs you out everywhere else — a reset is what you do when you think someone else has your password.',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    set: 'Set new password',
    /** `link` draws its words as the link to `/forgot-password`. */
    expired: ({ link }: { link: Wrap }) => <>Link expired? {link('Ask for another')}.</>,
  },
  /** `/verify-email/[token]`. */
  verify: {
    title: 'Verify your email',
    checking: 'Checking your link…',
    verified: 'Your email is verified. You can sign in now.',
    goToSignIn: 'Go to sign in',
    failedLine: 'Verification links are single-use and expire after 24 hours. Sign in to request a new one.',
  },
  /** `/choose-a-password` (P3.6-T4): an account whose password an operator generated. */
  choose: {
    title: 'Choose your own password',
    line: `The password you signed in with was generated for you and passed on by your office, so somebody else has seen it. Nothing else in ${kept('AgencyBoost')} opens until you replace it.`,
    /** `email` the account's, drawn bold. */
    signedInAs: ({ email }: { email: ReactNode }) => <>Signed in as {email}.</>,
    current: 'The password you were sent',
    currentHint: 'The one your office sent you.',
    newPassword: 'Your new password',
    unchanged: 'Choose something different from the one you were sent.',
    confirm: 'Confirm your new password',
    save: 'Save and sign in again',
    afterLine: 'You will be signed out everywhere and asked to sign in with the new one.',
  },
};

const id: MessagesOf<typeof en> = {
  signIn: {
    title: kept('AgencyBoost'),
    sessionEnded: 'Sesi Anda telah berakhir. Silakan masuk lagi.',
    toContinue: 'Masuk untuk melanjutkan.',
    resend: 'Kirim ulang email verifikasi',
    resent: 'Email sedang dikirim, jika ada akun yang menunggu di alamat itu.',
    email: 'Email',
    password: 'Kata sandi',
    signingIn: 'Sedang masuk…',
    signIn: 'Masuk',
    forgot: 'Lupa kata sandi?',
    createAccount: 'Buat akun',
  },
  demo: {
    heading: 'Akun pengembangan',
    line: ({ code }) => (
      <>
        Dibuat oleh {code('pnpm seed:demo')}. Memilih salah satu akan mengisi formulir lalu
        langsung masuk. Panel ini hanya muncul di lingkungan pengembangan dan staging.
      </>
    ),
    hide: 'Sembunyikan',
    showAll: ({ n }) => `Tampilkan semua ${n} akun`,
  },
  password: {
    hint: ({ n }) => `Minimal ${n} karakter. Panjang lebih penting daripada simbol.`,
    tooShort: ({ n }) => `Gunakan minimal ${n} karakter.`,
    padded: 'Jangan diawali atau diakhiri spasi.',
    mismatch: 'Kedua kata sandi tidak sama.',
    saving: 'Menyimpan…',
  },
  register: {
    title: 'Buat akun Anda',
    line: `${kept('KPM')} Anda ditambahkan secara terpisah. Ini hanya akun untuk masuk.`,
    sent: ({ email }) => <>Jika {email} dapat didaftarkan, tautan verifikasi sedang dikirim.</>,
    sentLine: 'Buka tautan itu untuk menyelesaikan pembuatan akun Anda. Tautan berlaku 24 jam dan hanya bisa dipakai sekali.',
    backToSignIn: 'Kembali ke halaman masuk',
    fullName: 'Nama lengkap',
    dateOfBirth: 'Tanggal lahir',
    gender: 'Jenis kelamin',
    choose: 'Pilih',
    insurer: 'Perusahaan asuransi',
    insurerHint: 'Perusahaan yang menerbitkan kode agen Anda.',
    loading: 'Memuat…',
    chooseInsurer: 'Pilih perusahaan asuransi Anda',
    agentCode: 'Kode agen',
    agentCodeHint: 'Tertera di kontrak Anda',
    joined: ({ insurer }) => `Bergabung di ${insurer ?? 'perusahaan asuransi Anda'}`,
    joinedHint: 'Bulan dan tahun Anda bergabung di perusahaan itu.',
    monthShape: 'TTTT-BB',
    status: 'Status',
    email: 'Email',
    emailHint: 'Tautan verifikasi Anda dikirim ke alamat ini.',
    password: 'Kata sandi',
    confirmPassword: 'Konfirmasi kata sandi',
    creating: 'Membuat…',
    create: 'Buat akun',
    fixPassword: 'Perbaiki kata sandi di atas.',
    haveAccount: 'Sudah punya akun? Masuk',
    signIn: 'Masuk',
    invite: {
      banner: ({ leader, kpm }) => `Anda bergabung ke tim ${leader} · ${kept('KPM')} ${kpm}`,
      bannerLine: ({ branch, company }) =>
        `${branch} · ${company}. Kode agen dan tanggal bergabung Anda sudah tercantum di undangan.`,
      joinDate: 'Tanggal bergabung',
      existing: 'Undangan ini untuk akun yang sudah ada. Masuk untuk menerimanya.',
      signInToAccept: 'Masuk untuk menerima',
      withoutInvite: 'Buat akun tanpa undangan',
      doneLine: ({ leader }) => `Setelah Anda memverifikasinya dan masuk, Anda sudah berada di tim ${leader}.`,
      checking: 'Memeriksa undangan Anda…',
    },
  },
  forgot: {
    title: 'Atur ulang kata sandi',
    sent: ({ email }) => <>Jika ada akun untuk {email}, tautan atur ulang kata sandi sedang dikirim.</>,
    sentLine: 'Tautan ini kedaluwarsa dalam 30 menit. Periksa folder spam Anda sebelum meminta tautan lain.',
    backToSignIn: 'Kembali ke halaman masuk',
    email: 'Email',
    emailHint: 'Kami akan mengirim tautan atur ulang kata sandi ke alamat ini.',
    sending: 'Mengirim…',
    send: 'Kirim tautan atur ulang',
  },
  reset: {
    title: 'Buat kata sandi baru',
    line: 'Ini membuat Anda keluar di semua perangkat lain — kata sandi diatur ulang saat Anda mengira orang lain '
      + 'mengetahuinya.',
    newPassword: 'Kata sandi baru',
    confirmPassword: 'Konfirmasi kata sandi',
    set: 'Atur kata sandi baru',
    expired: ({ link }) => <>Tautan sudah kedaluwarsa? {link('Minta tautan baru')}.</>,
  },
  verify: {
    title: 'Verifikasi email Anda',
    checking: 'Memeriksa tautan Anda…',
    verified: 'Email Anda sudah terverifikasi. Sekarang Anda dapat masuk.',
    goToSignIn: 'Buka halaman masuk',
    failedLine: 'Tautan verifikasi hanya bisa dipakai sekali dan kedaluwarsa setelah 24 jam. Masuk untuk meminta tautan '
      + 'baru.',
  },
  choose: {
    title: 'Buat kata sandi Anda sendiri',
    line: `Kata sandi yang Anda pakai untuk masuk dibuat untuk Anda dan diteruskan oleh ${kept('KPM')} Anda, jadi orang `
      + `lain sudah pernah melihatnya. Tidak ada bagian lain di ${kept('AgencyBoost')} yang terbuka sampai Anda `
      + 'menggantinya.',
    signedInAs: ({ email }) => <>Masuk sebagai {email}.</>,
    current: 'Kata sandi yang dikirimkan kepada Anda',
    currentHint: `Kata sandi yang dikirim oleh ${kept('KPM')} Anda.`,
    newPassword: 'Kata sandi baru Anda',
    unchanged: 'Pilih kata sandi yang berbeda dari yang dikirimkan kepada Anda.',
    confirm: 'Konfirmasi kata sandi baru Anda',
    save: 'Simpan dan masuk lagi',
    afterLine: 'Anda akan keluar dari semua perangkat dan diminta masuk dengan kata sandi baru.',
  },
};

export const authMessages = defineMessages({ en, id });
