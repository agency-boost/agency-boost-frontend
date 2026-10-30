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
  /**
   * ***Profil saya*** (UI V1, 2026-10-30; UI-111): the report's words, and the mockup's (`profile-mobile`). The section
   * names, the locked fields, *KPM dan peran*, *Pengaturan*, *Keamanan* and the photo sheet. The rungs' long names are
   * names (§A), kept.
   */
  v1: {
    title: 'My profile',
    changePhoto: 'Change photo',
    /** The 84px photo's own name, as a button: it opens the same sheet as *Change photo*. */
    photoButton: 'Change your profile photo',
    personal: 'Personal details',
    kpmAndRole: 'KPM and role',
    settings: 'Preferences',
    security: 'Security',
    companyName: 'Insurance company',
    agentCode: 'Agent code',
    agentCodeHint: 'Cannot be changed. Ask your KPM admin if it is wrong.',
    /** Said after a locked field's value to a screen reader: the lock icon's meaning. */
    locked: 'cannot be changed here',
    email: 'Email',
    /*
     * UI V1 (UI-111, ADR-0181): the email is a field, changed through a link to the new address. The hint is the
     * report's; the rest is the password sheet and the line under the field once the link is sent.
     */
    emailHint: 'If you change it, a verification link is sent to the new address',
    emailInvalid: 'Write a whole email address, like name@example.com.',
    emailSheetTitle: 'Change email',
    /** `email` the new address, as typed. */
    emailSheetLine: ({ email }: { email: string }) => `Enter your password to send a verification link to ${email}.`,
    emailSend: 'Send link',
    emailSending: 'Sending…',
    emailSent: ({ email }: { email: string }) =>
      `A verification link was sent to ${email}. Your email changes once that link is opened.`,
    whatsapp: 'WhatsApp number',
    phoneInvalid: ({ min, max }: { min: number; max: number }) => `Write ${min} to ${max} digits after +62.`,
    /** A date's shape on its field (`DD / MM / YYYY`, `MM / YYYY`) when none is recorded yet. */
    dayShape: 'DD / MM / YYYY',
    monthShape: 'MM / YYYY',
    pickDay: ({ label }: { label: string }) => `${label}: choose a date`,
    pickMonth: ({ label }: { label: string }) => `${label}: choose a month`,
    kpm: kept('KPM'),
    role: 'Role',
    yourLeader: `Your ${kept('leader')}`,
    informalGroup: 'Informal group',
    yourGroup: 'Your group',
    /** *11 people · 3 AAB · 8 Agents*: `parts` are the roles' counts, joined by the caller. */
    groupLine: ({ people, parts }: { people: number; parts: string }) =>
      `${people} ${people === 1 ? 'person' : 'people'}${parts ? ` · ${parts}` : ''}`,
    rolesShort: {
      ab: ({ n }: { n: number }) => `${n} ${kept('AB')}`,
      aab: ({ n }: { n: number }) => `${n} ${kept('AAB')}`,
      agents: ({ n }: { n: number }) => `${n} ${n === 1 ? kept('Agent') : kept('Agents')}`,
    },
    /** The rungs' long names, after the short one: *AB · Agency Builder*. Names, kept. */
    rungNames: { AB: kept('Agency Builder'), AAB: kept('Associate Agency Builder') } as Record<string, string>,
    leaderCode: `${kept('Leader')} code`,
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Could not copy. Select the code and copy it yourself.',
    language: 'Language',
    hideCalendar: `Hide ${kept('Calendar')} activities`,
    hideCalendarLine: 'Your team still sees when you are busy, without the details',
    changePassword: 'Change password',
    /** *5 devices · this one: Chrome on Android*. */
    devicesLine: ({ n, current }: { n: number; current: string | null }) =>
      `${n} ${n === 1 ? 'device' : 'devices'}${current ? ` · this one: ${current}` : ''}`,
    saved: 'Saved',
    saveFailed: 'Not saved. Try again.',
    /** The photo sheet (`profile-mobile`'s *Foto profil*). */
    photoTitle: 'Profile photo',
    photoHint: 'Choose a photo, then drag and zoom it as you like',
    camera: 'Camera',
    gallery: 'Gallery',
    zoom: 'Zoom',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    move: 'Your photo in the circle. Drag it, or use the arrow keys, to move it.',
    savePhoto: 'Save photo',
    savingPhoto: 'Saving…',
    removePhoto: 'Remove photo',
    photoSaved: 'Photo saved',
    photoRemoved: 'Photo removed',
    notAnImage: 'That file is not a picture. Choose a photo.',
    photoFailed: 'The photo was not saved. Try again.',
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
  v1: {
    title: 'Profil saya',
    changePhoto: 'Ubah foto',
    photoButton: 'Ubah foto profil Anda',
    personal: 'Data diri',
    kpmAndRole: 'KPM dan peran',
    settings: 'Pengaturan',
    security: 'Keamanan',
    companyName: 'Perusahaan asuransi',
    agentCode: 'Kode agen',
    agentCodeHint: 'Tidak bisa diubah. Hubungi admin KPM jika salah.',
    locked: 'tidak bisa diubah di sini',
    email: 'Email',
    emailHint: 'Jika diubah, tautan verifikasi dikirim ke alamat baru',
    emailInvalid: 'Tulis alamat email yang lengkap, misalnya nama@contoh.com.',
    emailSheetTitle: 'Ubah email',
    emailSheetLine: ({ email }) => `Masukkan kata sandi Anda untuk mengirim tautan verifikasi ke ${email}.`,
    emailSend: 'Kirim tautan',
    emailSending: 'Mengirim…',
    emailSent: ({ email }) => `Tautan verifikasi dikirim ke ${email}. Email Anda berubah setelah tautan itu dibuka.`,
    whatsapp: 'Nomor WhatsApp',
    phoneInvalid: ({ min, max }) => `Tulis ${min} sampai ${max} digit setelah +62.`,
    dayShape: 'HH / BB / TTTT',
    monthShape: 'BB / TTTT',
    pickDay: ({ label }) => `${label}: pilih tanggal`,
    pickMonth: ({ label }) => `${label}: pilih bulan`,
    kpm: kept('KPM'),
    role: 'Peran',
    yourLeader: `${kept('Leader')} Anda`,
    informalGroup: 'Grup informal',
    yourGroup: 'Grup Anda',
    // Indonesian has one form for one and many (§B.0 rule 8): *1 orang*, *11 orang*.
    groupLine: ({ people, parts }) => `${people} orang${parts ? ` · ${parts}` : ''}`,
    rolesShort: {
      ab: ({ n }) => `${n} ${kept('AB')}`,
      aab: ({ n }) => `${n} ${kept('AAB')}`,
      // The mockup's *8 Agent*: a kept noun after a figure, one form (§B.0 rule 8).
      agents: ({ n }) => `${n} ${kept('Agent')}`,
    },
    rungNames: { AB: kept('Agency Builder'), AAB: kept('Associate Agency Builder') },
    leaderCode: `Kode ${kept('leader')}`,
    copy: 'Salin',
    copied: 'Tersalin',
    copyFailed: 'Tidak bisa disalin. Pilih kodenya, lalu salin sendiri.',
    language: 'Bahasa',
    hideCalendar: `Sembunyikan aktivitas ${kept('Calendar')}`,
    hideCalendarLine: 'Tim tetap melihat waktu Anda sibuk, tanpa detail',
    changePassword: 'Ubah kata sandi',
    devicesLine: ({ n, current }) => `${n} perangkat${current ? ` · ini: ${current}` : ''}`,
    saved: 'Tersimpan',
    saveFailed: 'Belum tersimpan. Coba lagi.',
    photoTitle: 'Foto profil',
    photoHint: 'Pilih foto, lalu geser dan perbesar sesuai keinginan',
    camera: 'Kamera',
    gallery: 'Galeri',
    zoom: 'Perbesar',
    zoomOut: 'Perkecil',
    zoomIn: 'Perbesar',
    move: 'Foto Anda di dalam lingkaran. Geser, atau pakai tombol panah, untuk memindahkannya.',
    savePhoto: 'Simpan foto',
    savingPhoto: 'Menyimpan…',
    removePhoto: 'Hapus foto',
    photoSaved: 'Foto tersimpan',
    photoRemoved: 'Foto dihapus',
    notAnImage: 'File itu bukan gambar. Pilih sebuah foto.',
    photoFailed: 'Foto belum tersimpan. Coba lagi.',
  },
};

export const accountMessages = defineMessages({ en, id });
