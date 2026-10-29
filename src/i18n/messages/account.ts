import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Your account*** — `/profile` (P18.98-T4, public and account; `api/auth-and-sessions.md`, *Sessions*, *A person's own
 * account*, *The screens' own strings*): *Your details* with what a person records, *Password*, and *Where you are
 * signed in* (`components/session-list.tsx`). *Language* on it is T2's (`language.ts`), the four a person records are
 * `personal.ts`'.
 *
 * **English is the source**, word for word as the page wrote it. The Indonesian is the approved glossary's — the title
 * (§A.2: *Akun Anda*), *Simpan*, *Keluar* (§B.1), *Menyimpan…*, *Tersimpan.*, *Sedang keluar…* (§B.2), *Nama lengkap*,
 * *Nama panggilan*, *Tanggal lahir*, *Jenis kelamin*, *Kata sandi*, *Kata sandi baru* (§B.4), *Kedua kata sandi tidak
 * sama.* (§B.5); a support session is a *sesi dukungan* (§A.2), a person *dia* (§B.0 rule 8), *insurer* *perusahaan
 * asuransi* (§B.10) — with what it lacked proposed in the glossary for approval's §B.10 (*Data diri Anda*, *Kata ganti*,
 * *Perangkat tempat Anda masuk* …). **Kept** (§A): *coaching*, *leader*, and the pronoun's three options — English
 * pronouns, which only English sentences use (Indonesian writes *dia* for everybody), proposed in §B.10.
 *
 * **Typed content stays as typed**: the account's email, an address, a device's browser and system by their own names
 * (*Chrome*, *Android*), the server's refusals. **A figure is never a message's**: a session's last use is written by the
 * list in the figures' language and passed in.
 *
 * @moved app/profile/
 * @moved components/session-list.tsx
 */
const en = {
  title: 'Your account',
  signingOut: 'Signing out…',
  signOut: 'Sign out',
  /** *Your details* (ADR-0158 §3 for the four a person records). */
  details: {
    heading: 'Your details',
    saved: 'Saved.',
    locked: 'Only they can change this, not a support session.',
    fullName: 'Full name',
    preferredName: 'Preferred name',
    preferredNameHint: 'What colleagues call you day to day.',
    pronoun: 'Pronoun',
    pronounHint: `Yours to set. It appears in the commitment sentence your ${kept('leader')} reads back to you in ${kept('coaching')}.`,
    /** The pronoun's three options: English pronouns, the same in both languages. */
    pronouns: { she: kept('she / her'), he: kept('he / him'), they: kept('they / them') },
    dateOfBirth: 'Date of birth',
    gender: 'Gender',
    joined: 'Joined your insurer',
    joinedHint: 'The month and year you joined them.',
    /** A month box's shape, where a browser draws a plain box for it. */
    monthShape: 'YYYY-MM',
    status: 'Status',
    saving: 'Saving…',
    save: 'Save',
  },
  /** *Password*: changing it here signs out the other sessions (P4-T13). */
  password: {
    heading: 'Password',
    line: 'Changing it signs out your other sessions. This one stays open.',
    changed: 'Password changed. Your other sessions were signed out.',
    current: 'Current password',
    newPassword: 'New password',
    hint: ({ n }: { n: number }) => `At least ${n} characters. Length beats symbols.`,
    confirm: 'Confirm new password',
    mismatch: 'The two passwords do not match.',
    tooShort: ({ n }: { n: number }) => `The new password needs at least ${n} characters.`,
    fix: 'Fix the passwords above.',
    changing: 'Changing…',
    change: 'Change password',
  },
  /** *Where you are signed in* (P4-T13). */
  sessions: {
    heading: 'Where you are signed in',
    line: 'One row per device. If you do not recognise one, sign it out.',
    thisDevice: 'This device',
    /** `when` the moment it was last used, written in the figures' language. */
    lastUsed: ({ address, when }: { address: string; when: string }) => `${address} · last used ${when}`,
    unknownAddress: 'Unknown address',
    unknownWhen: 'unknown',
    signOutOne: 'Sign this one out',
    signOutEverywhere: 'Sign out everywhere',
    everywhereLine: 'Ends every session including this one. Use this if you lose your phone.',
    /** A device by what its browser says: `describeDevice`. The browser's and the system's names are their own. */
    unknownDevice: 'Unknown device',
    iPhoneOrIPad: 'iPhone or iPad',
    browserOn: ({ browser, platform }: { browser: string; platform: string }) => `${browser} on ${platform}`,
  },
};

const id: MessagesOf<typeof en> = {
  title: 'Akun Anda',
  signingOut: 'Sedang keluar…',
  signOut: 'Keluar',
  details: {
    heading: 'Data diri Anda',
    saved: 'Tersimpan.',
    locked: 'Hanya dia yang dapat mengubah ini, bukan sesi dukungan.',
    fullName: 'Nama lengkap',
    preferredName: 'Nama panggilan',
    preferredNameHint: 'Nama yang dipakai rekan kerja untuk memanggil Anda sehari-hari.',
    pronoun: 'Kata ganti',
    pronounHint: `Anda yang menentukan. Dipakai di kalimat komitmen berbahasa Inggris yang dibacakan ${kept('leader')} `
      + `Anda kepada Anda saat ${kept('coaching')}.`,
    pronouns: { she: kept('she / her'), he: kept('he / him'), they: kept('they / them') },
    dateOfBirth: 'Tanggal lahir',
    gender: 'Jenis kelamin',
    joined: 'Bergabung di perusahaan asuransi Anda',
    joinedHint: 'Bulan dan tahun Anda bergabung di perusahaan itu.',
    monthShape: 'TTTT-BB',
    status: 'Status',
    saving: 'Menyimpan…',
    save: 'Simpan',
  },
  password: {
    heading: 'Kata sandi',
    line: 'Mengubahnya akan mengeluarkan Anda dari sesi lain. Sesi ini tetap terbuka.',
    changed: 'Kata sandi diubah. Anda sudah dikeluarkan dari sesi lain.',
    current: 'Kata sandi saat ini',
    newPassword: 'Kata sandi baru',
    hint: ({ n }) => `Minimal ${n} karakter. Panjang lebih penting daripada simbol.`,
    confirm: 'Konfirmasi kata sandi baru',
    mismatch: 'Kedua kata sandi tidak sama.',
    tooShort: ({ n }) => `Kata sandi baru minimal ${n} karakter.`,
    fix: 'Perbaiki kata sandi di atas.',
    changing: 'Mengubah…',
    change: 'Ubah kata sandi',
  },
  sessions: {
    heading: 'Perangkat tempat Anda masuk',
    line: 'Satu baris per perangkat. Jika ada yang tidak Anda kenali, keluarkan perangkat itu.',
    thisDevice: 'Perangkat ini',
    lastUsed: ({ address, when }) => `${address} · terakhir dipakai ${when}`,
    unknownAddress: 'Alamat tidak dikenal',
    unknownWhen: 'tidak diketahui',
    signOutOne: 'Keluarkan perangkat ini',
    signOutEverywhere: 'Keluar dari semua perangkat',
    everywhereLine: 'Mengakhiri semua sesi, termasuk sesi ini. Gunakan ini jika ponsel Anda hilang.',
    unknownDevice: 'Perangkat tidak dikenal',
    iPhoneOrIPad: 'iPhone atau iPad',
    browserOn: ({ browser, platform }) => `${browser} di ${platform}`,
  },
};

export const accountMessages = defineMessages({ en, id });
