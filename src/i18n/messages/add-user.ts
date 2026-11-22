import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Tambah user* and *Masukkan ke KPM*** (P19.28-T2; ADR-0286; the 21 November brief, F-1): the one shared sheet
 * (`components/admin/add-user-sheet.tsx`) with *Pilih KPM* and *＋ KPM baru* inside it, the messages WhatsApp opens with
 * (`lib/add-user.ts`), the page the invitation link opens (`app/user-invite/[token]`), and *KPM baru*'s owner picker.
 *
 * **The Indonesian is the stop motion's, verbatim** (`superadmin-flows-stopmotion-2026-11-22.html`, `tambahSheet`,
 * `pilihKPM`, `masukkan`; side-by-side screens 2, 4, 4b, 4c): *Nama lengkap*, *Nomor WhatsApp*, *Email · opsional*,
 * *Pilih KPM*, *Peran*, *Leader*, *Jadikan KPM Owner*, *Tambah & kirim undangan WhatsApp*, *Cari nama KPM atau kode*,
 * *KPM baru* · *Belum ada KPM untuk orang ini*, *Ganti*, *Nama KPM* · *Contoh: Bintaro Branch*, *Perusahaan* · *Pilih
 * perusahaan*, *KPM Owner* · *Owner pertama KPM ini* · *Ya*, *Buat KPM & jadikan owner*, *Masukkan ke <KPM>*, and the
 * toast *"<Nama> ditambahkan ke <KPM> · Lihat"*. **Kept** (§A): *KPM*, *Owner*, *WhatsApp*, *Email*, *leader*, *AB*.
 * **The WhatsApp messages are the invitee's**, in the language a person who has chosen none reads (`INVITEE_LANGUAGE`).
 */
const en = {
  title: 'Add user',
  placeTitle: `Add to a ${kept('KPM')}`,
  close: 'Close',
  back: 'Back',
  fullName: 'Full name',
  fullNamePlaceholder: 'Name as on the ID card',
  phone: `WhatsApp number`,
  email: 'Email',
  optional: 'optional',
  emailPlaceholder: 'name@email.com',
  kpm: kept('KPM'),
  chooseKpm: `Choose ${kept('KPM')}`,
  /** Under the KPM's name: its company and its code. */
  kpmLine: ({ company, code }: { company: string; code: string }) => `${company} · ${kept('KPM')} ${code}`,
  role: 'Role',
  leader: kept('Leader'),
  chooseLeader: `Choose ${kept('leader')}`,
  noLeaders: `No ${kept('AB')} or ${kept('AAB')} in this ${kept('KPM')} yet`,
  ownerTag: kept('Owner'),
  makeOwner: `Make ${kept('KPM')} ${kept('Owner')}`,
  submit: `Add & send WhatsApp invitation`,
  submitPlace: ({ kpm }: { kpm: string }) => `Add to ${kpm}`,
  submitNewKpm: `Create ${kept('KPM')} & make owner`,
  saving: 'Saving…',
  /** *Pilih KPM*: the sheet's content, replaced. */
  pickTitle: `Choose ${kept('KPM')}`,
  pickSearch: `Search ${kept('KPM')} name or code`,
  newKpm: `New ${kept('KPM')}`,
  newKpmLine: `No ${kept('KPM')} for this person yet`,
  noKpms: `No ${kept('KPM')} matches.`,
  /** *＋ KPM baru*'s box. */
  change: 'Change',
  kpmName: `${kept('KPM')} name`,
  kpmNamePlaceholder: 'Example: Bintaro Branch',
  company: 'Company',
  chooseCompany: 'Choose company',
  ownerRow: `${kept('KPM')} ${kept('Owner')}`,
  firstOwner: `First owner of this ${kept('KPM')}`,
  yes: 'Yes',
  /** The field's own errors, under it. */
  problems: {
    fullName: 'Enter their full name.',
    kpm: `Choose a ${kept('KPM')}.`,
    role: 'Choose a role.',
    leader: `Choose a ${kept('leader')}.`,
    kpmName: `Enter the ${kept('KPM')} name.`,
    company: 'Choose a company.',
  },
  loadingOptions: 'Loading the roles…',
  /** The toasts. */
  added: ({ name, kpm }: { name: string; kpm: string }) => `${name} added to ${kpm}`,
  placed: ({ name, kpm }: { name: string; kpm: string }) => `${name} added to ${kpm}`,
  createdWithOwner: ({ name, kpm }: { name: string; kpm: string }) => `${kpm} created · ${name} is its owner`,
  view: 'View',
  /** A KPM page's *Anggota* card: today's *Import people*, named as the mockup names it on a phone. */
  uploadFile: 'Upload file',
  blocked: `Saved. The browser blocked the WhatsApp window — allow pop-ups, then send again.`,
  /** The messages WhatsApp opens with, to the person. */
  whatsApp: {
    invitation: ({ name, kpm, link }: { name: string; kpm: string; link: string }) =>
      `Hello ${name}, you are invited to join ${kpm} on AgencyBoost. Open this link to create your account and join: ${link}`,
    placed: ({ name, kpm, link }: { name: string; kpm: string; link: string }) =>
      `Hello ${name}, you have been added to ${kpm} on AgencyBoost. Sign in at ${link} to start.`,
  },
  /** *KPM baru*'s owner picker (P19.28-T2 AC-9). */
  ownerPicker: {
    label: `${kept('KPM')} ${kept('Owner')}`,
    existing: 'Choose a registered member',
    invite: 'Invite someone new',
    search: 'Search name or email',
    none: `Nobody registered without a ${kept('KPM')} matches.`,
    choose: 'Choose the owner.',
  },
  /** The page the invitation link opens. */
  page: {
    title: 'Invitation',
    checking: 'Checking this invitation…',
    kpm: ({ kpm, company }: { kpm: string; company: string }) => `${kept('KPM')} ${kpm} · ${company}`,
    forName: ({ name }: { name: string }) => `For ${name}`,
    role: ({ role }: { role: string }) => `Role: ${role}`,
    owner: `You will also be an owner of this ${kept('KPM')}.`,
    expires: ({ date }: { date: string }) => `This link works until ${date}.`,
    signedOut: 'Sign in to accept this invitation.',
    signIn: 'Sign in',
    noAccount: 'No account yet?',
    register: 'Sign up',
    afterRegister: 'Once you have signed up, open this link again to accept.',
    signedInAs: ({ name }: { name: string }) => `Signed in as ${name}.`,
    accept: 'Accept & join',
    accepting: 'Joining…',
  },
};

const id: MessagesOf<typeof en> = {
  title: 'Tambah user',
  placeTitle: `Masukkan ke ${kept('KPM')}`,
  close: 'Tutup',
  back: 'Kembali',
  fullName: 'Nama lengkap',
  fullNamePlaceholder: 'Nama sesuai KTP',
  phone: `Nomor WhatsApp`,
  email: 'Email',
  optional: 'opsional',
  emailPlaceholder: 'nama@email.com',
  kpm: kept('KPM'),
  chooseKpm: `Pilih ${kept('KPM')}`,
  kpmLine: ({ company, code }) => `${company} · ${kept('KPM')} ${code}`,
  role: 'Peran',
  leader: kept('Leader'),
  chooseLeader: `Pilih ${kept('leader')}`,
  noLeaders: `Belum ada ${kept('AB')} atau ${kept('AAB')} di ${kept('KPM')} ini`,
  ownerTag: kept('Owner'),
  makeOwner: `Jadikan ${kept('KPM')} ${kept('Owner')}`,
  submit: `Tambah & kirim undangan WhatsApp`,
  submitPlace: ({ kpm }) => `Masukkan ke ${kpm}`,
  submitNewKpm: `Buat ${kept('KPM')} & jadikan owner`,
  saving: 'Menyimpan…',
  pickTitle: `Pilih ${kept('KPM')}`,
  pickSearch: `Cari nama ${kept('KPM')} atau kode`,
  newKpm: `${kept('KPM')} baru`,
  newKpmLine: `Belum ada ${kept('KPM')} untuk orang ini`,
  noKpms: `Tidak ada ${kept('KPM')} yang cocok.`,
  change: 'Ganti',
  kpmName: `Nama ${kept('KPM')}`,
  kpmNamePlaceholder: 'Contoh: Bintaro Branch',
  company: 'Perusahaan',
  chooseCompany: 'Pilih perusahaan',
  ownerRow: `${kept('KPM')} ${kept('Owner')}`,
  firstOwner: `Owner pertama ${kept('KPM')} ini`,
  yes: 'Ya',
  problems: {
    fullName: 'Isi nama lengkap.',
    kpm: `Pilih ${kept('KPM')}.`,
    role: 'Pilih peran.',
    leader: `Pilih ${kept('leader')}.`,
    kpmName: `Isi nama ${kept('KPM')}.`,
    company: 'Pilih perusahaan.',
  },
  loadingOptions: 'Memuat peran…',
  added: ({ name, kpm }) => `${name} ditambahkan ke ${kpm}`,
  placed: ({ name, kpm }) => `${name} dimasukkan ke ${kpm}`,
  createdWithOwner: ({ name, kpm }) => `${kpm} dibuat · ${name} jadi owner`,
  view: 'Lihat',
  uploadFile: 'Unggah file',
  blocked: `Tersimpan. Browser memblokir jendela WhatsApp — izinkan pop-up, lalu kirim ulang.`,
  whatsApp: {
    invitation: ({ name, kpm, link }) =>
      `Halo ${name}, Anda diundang bergabung ke ${kpm} di AgencyBoost. Buka tautan ini untuk membuat akun dan bergabung: ${link}`,
    placed: ({ name, kpm, link }) =>
      `Halo ${name}, Anda sudah dimasukkan ke ${kpm} di AgencyBoost. Masuk di ${link} untuk mulai.`,
  },
  ownerPicker: {
    label: `${kept('KPM')} ${kept('Owner')}`,
    existing: 'Pilih anggota yang sudah terdaftar',
    invite: 'Undang orang baru',
    search: 'Cari nama atau email',
    none: `Tidak ada orang terdaftar tanpa ${kept('KPM')} yang cocok.`,
    choose: 'Pilih owner-nya.',
  },
  page: {
    title: 'Undangan',
    checking: 'Memeriksa undangan ini…',
    kpm: ({ kpm, company }) => `${kept('KPM')} ${kpm} · ${company}`,
    forName: ({ name }) => `Untuk ${name}`,
    role: ({ role }) => `Peran: ${role}`,
    owner: `Anda juga akan menjadi owner ${kept('KPM')} ini.`,
    expires: ({ date }) => `Tautan ini berlaku sampai ${date}.`,
    signedOut: 'Masuk untuk menerima undangan ini.',
    signIn: 'Masuk',
    noAccount: 'Belum punya akun?',
    register: 'Daftar',
    afterRegister: 'Setelah mendaftar, buka tautan ini lagi untuk menerimanya.',
    signedInAs: ({ name }) => `Masuk sebagai ${name}.`,
    accept: 'Terima & bergabung',
    accepting: 'Bergabung…',
  },
};

export const addUserMessages = defineMessages({ en, id });
export type AddUserWords = typeof en;
