import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's offices** (P18.98-T6; `functional/tenant-provisioning.md`, *The module's own strings*): *All KPMs*
 * (`/admin/tenants`) with *Edit subscription* (`components/subscription-dialog.tsx`), *New office*
 * (`/admin/tenants/new`), an office's page with its *Profile*, *Owner*, *People* and *Lifecycle* cards
 * (`/admin/tenants/[kpmId]`), *Assign owner* · *Transfer owner* (`…/owner`), *Import a roster*'s heading (`…/roster`;
 * the import itself is `roster-import.tsx`'s), and *KPM Owners & Admins* (`/admin/tenant-admins`).
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's:
 * §A.2's sentence titles (*KPM baru*, *Tetapkan Owner · Pindahkan Owner*, *Impor roster*), §B.1 to §B.5, *office* is
 * *KPM* (§B.9), *Ubah langganan* for *Edit subscription* (§B.10, agreed with the leader limit's advice), *templat*
 * (§B.1), *bagian* for a section and *susunan jenjang* for the ladder (§B.10). **Kept** (§A): the pages' titles that are
 * names (*All KPMs*, *Office*, *KPM Owners & Admins*), *KPM*, the roles, *Capability Mapping*, *AgencyBoost*, *leader*
 * and *Leaders*. *Office*, *Owner* and *Pending* are kept in one place and translated in another (`KEPT_ELSEWHERE`).
 * **Typed content stays as typed**: an office's code and branch, a company's and a template's name, people's names
 * and emails, a suspension's reason, the server's sentences. **A figure is never a message's**: a date or a sum is
 * written by its caller in the figures' language and passed in.
 *
 * @moved app/(admin)/admin/tenants/
 * @moved app/(admin)/admin/tenant-admins/
 * @moved components/subscription-dialog.tsx
 */

/** A run of words drawn bold, or as a link. */
type Wrap = (words: string) => ReactNode;

const en = {
  /** `KPM 0417 · BSD City Branch`: an office as the console names it. */
  office: ({ code, branch }: { code: string; branch: string }) => `KPM ${code} · ${branch}`,
  cancel: 'Cancel',
  saving: 'Saving…',

  /** *All KPMs* (`/admin/tenants`). */
  list: {
    title: kept('All KPMs'),
    subtitle: 'Every KPM on the platform. One exists only because somebody here created it.',
    newOffice: 'New office',
    columns: {
      code: 'Code', branch: 'Branch', company: 'Company', owner: kept('Owner'), status: 'Status', endDate: 'End date',
      leaders: 'Leaders', subscription: 'Subscription',
    },
    caption: 'Offices on the platform',
    empty: 'No KPMs yet.',
    createFirst: 'Create the first one',
    assignOwner: 'Assign an owner',
    /** Past the limit, by how much (ADR-0157 §4). */
    over: ({ n }: { n: number }) => `${n} over`,
    editSubscription: 'Edit subscription',
    editSubscriptionFor: ({ code, branch }: { code: string; branch: string }) =>
      `Edit subscription for KPM ${code} · ${branch}`,
    savedFor: ({ code }: { code: string }) => `Subscription saved for KPM ${code}.`,
  },

  /** *Edit subscription* (ADR-0112 §2, ADR-0113 §3, ADR-0157 §6). */
  subscription: {
    title: 'Edit subscription',
    save: 'Save',
    bothOrNeither: 'Enter a start date and an end date, or neither.',
    endAfterStart: 'The end date is on or after the start date.',
    wholeLeaders: 'Enter a whole number of leaders, or leave it empty for no limit.',
    startDate: 'Start date',
    endDate: 'End date',
    endHint: 'The last day the office can be used.',
    price: 'Price per leader per month',
    priceHint: 'Recorded with the office. Nothing is charged from it.',
    max: 'Maximum leaders',
    maxHint: 'ABs and AABs together, the Owner included. Empty for no limit.',
    perMonth: 'Per month',
    perMonthFor: ({ n }: { n: number }) => `Per month for ${n} ${n === 1 ? 'leader' : 'leaders'}`,
    duration: 'Duration',
    months: ({ n }: { n: number }) => `${n} ${n === 1 ? 'month' : 'months'}`,
    overDuration: 'Over the duration',
    /** `n` the count, drawn bold by the dialog. */
    leadersUsed: ({ n }: { n: ReactNode }) => <>Leaders used now: {n}</>,
    keepActive: 'Keep active after the end date',
    overLimit: ({ used, max }: { used: number; max: number }) =>
      `This office has ${used} leaders now, more than ${max}. Nobody is demoted, and each new AB or AAB past ${max} waits for AgencyBoost's approval.`,
    /** `day` written in the figures' language. */
    endPassedKept: ({ day }: { day: string }) =>
      `This end date, ${day}, has passed. The office stays open because it is kept active.`,
    endPassed: ({ day }: { day: string }) =>
      `This end date, ${day}, has passed. Once you save, nobody in this office can use AgencyBoost until the date is moved or it is kept active.`,
  },

  /** *New office* (`/admin/tenants/new`; ADR-0115 §4, ADR-0164 §5, ADR-0168 §2). */
  create: {
    title: 'New office',
    subtitle: 'Its settings are copied from what it starts from; the office owns them afterwards.',
    hint: {
      template: 'Its settings are copied from this template’s published sections; a section it has not published starts empty, except Capability Mapping, which starts with AgencyBoost’s standard capability ladder.',
      library: 'Its settings are copied from the Template library’s published sections, and every role they show must be on this company’s ladder. Changing the Template later changes nothing in this office.',
      empty: 'Nothing but the three activity types the goal plan counts and AgencyBoost’s standard capability ladder. The Owner builds the rest.',
    },
    noCompany: 'There is no company to attach an office to.',
    createCompany: 'Create a company first',
    company: 'Company',
    startFrom: 'Start from',
    /** `message` the server's sentence, as it came. */
    templatesFailed: ({ message }: { message: string }) =>
      `This company’s templates could not be read, so there is nothing to start from yet. ${message}`,
    notLoaded: 'Not loaded',
    loading: 'Loading…',
    /** A company's default template, by its name as typed. */
    defaultTemplate: ({ name }: { name: string }) => `${name} · Default`,
    empty: 'Empty',
    tryAgain: 'Try again',
    code: 'Office code',
    codeHint: 'Unique within the company. Effectively permanent.',
    codeError: '2–16 characters: letters, digits and hyphens.',
    branchName: 'Branch name',
    address: 'Address',
    optional: 'Optional.',
    contactPhone: 'Contact phone',
    timeZone: 'Time zone',
    timeZoneReason: 'Every day boundary in this office — what counts as today, which week a figure falls in, when a month closes — is worked out in this zone, not in yours and not in the server\'s. v1 runs every office on Jakarta time.',
    creating: 'Creating…',
    submit: 'Create office',
  },

  /** An office's page (`/admin/tenants/[kpmId]`). */
  detail: {
    title: kept('Office'),
    loading: 'Loading the office…',
    subtitle: 'Provisioning and lifecycle. This console never reads the office\'s business data.',
    saveAsTemplate: 'Save as template',
    profile: 'Profile',
    kpmId: 'KPM id',
    company: 'Company',
    code: 'Code',
    branch: 'Branch',
    address: 'Address',
    phone: 'Phone',
    timeZone: 'Time zone',
    currency: 'Currency',
    owner: kept('Owner'),
    noOwner: 'No owner. Nobody can administer this office until one is assigned.',
    openAsOwner: 'Open as Owner',
    transferOwner: 'Transfer owner',
    assignOwner: 'Assign owner',
    people: kept('People'),
    peopleLine: 'Fill a new office from a spreadsheet rather than one person at a time. Each account is created with a password to pass on, and is asked to choose its own on first sign-in.',
    importRoster: 'Import a roster',
    lifecycle: 'Lifecycle',
    lifecycleLine: 'A suspended office refuses its members with a distinct error, so they are told their office is suspended rather than that they lack permission.',
    /** `reason` as the Super Admin typed it. */
    suspended: ({ reason }: { reason: string }) => `Suspended: ${reason}`,
    subscription: 'Subscription: ',
    status: 'Status',
    reason: 'Reason',
    reasonHint: 'Recorded in the audit log. Required to suspend.',
    apply: 'Apply',
  },

  /** *Assign owner* · *Transfer owner* (`/admin/tenants/[kpmId]/owner`). */
  owner: {
    assignTitle: 'Assign owner',
    transferTitle: 'Transfer owner',
    /** `name` drawn bold, `email` the bracketed address or nothing. */
    current: ({ name, email }: { name: ReactNode; email: ReactNode }) => (
      <>
        The current owner is {name}{email}. A transfer is audited with both the outgoing and incoming person, and takes
        the office&apos;s administration rights away from the outgoing one.
      </>
    ),
    email: 'Email',
    emailHint: 'The account must already exist. If it does not, send them to Create an account first.',
    unknown: 'No account uses that address.',
    noAccount: ({ link }: { link: Wrap }) => (
      <>No account yet? {link('Create one')} — the office cannot be owned by someone who has not registered.</>
    ),
    transfer: 'Transfer',
    assign: 'Assign',
  },

  /** *Import a roster*'s heading (`/admin/tenants/[kpmId]/roster`). */
  roster: {
    title: 'Import a roster',
    subtitle: 'Create everybody in this office from a spreadsheet.',
  },

  /** *KPM Owners & Admins* (`/admin/tenant-admins`). */
  admins: {
    title: kept('KPM Owners & Admins'),
    subtitle: 'Everybody who can administer an office, across every office',
    columns: { who: 'Who', office: 'Office', access: 'Access', granted: 'Granted' },
    caption: 'Office administrators',
    empty: 'No office has an administrator yet.',
    line: 'Granting and revoking happen inside the office, by its Owner. This is a view, not a control.',
    owner: kept('Owner'),
    admin: kept('Admin'),
    /** An Owner's rights came with the office, not from a grant: no date. */
    withOffice: 'With the office',
  },
};

const id: MessagesOf<typeof en> = {
  office: ({ code, branch }) => `${kept('KPM')} ${code} · ${branch}`,
  cancel: 'Batal',
  saving: 'Menyimpan…',

  list: {
    title: kept('All KPMs'),
    subtitle: `Setiap ${kept('KPM')} di platform. Sebuah ${kept('KPM')} hanya ada karena seseorang di sini membuatnya.`,
    newOffice: `${kept('KPM')} baru`,
    columns: {
      code: 'Kode', branch: 'Cabang', company: 'Perusahaan', owner: kept('Owner'), status: 'Status',
      endDate: 'Tanggal berakhir', leaders: `Jumlah ${kept('leader')}`, subscription: 'Langganan',
    },
    caption: `${kept('KPM')} di platform`,
    empty: `Belum ada ${kept('KPM')}.`,
    createFirst: 'Buat yang pertama',
    assignOwner: `Tetapkan ${kept('Owner')}`,
    over: ({ n }) => `lebih ${n}`,
    editSubscription: 'Ubah langganan',
    editSubscriptionFor: ({ code, branch }) => `Ubah langganan untuk ${kept('KPM')} ${code} · ${branch}`,
    savedFor: ({ code }) => `Langganan tersimpan untuk ${kept('KPM')} ${code}.`,
  },

  subscription: {
    title: 'Ubah langganan',
    save: 'Simpan',
    bothOrNeither: 'Isi tanggal mulai dan tanggal berakhir, atau kosongkan keduanya.',
    endAfterStart: 'Tanggal berakhir harus sama dengan atau setelah tanggal mulai.',
    wholeLeaders: `Masukkan jumlah ${kept('leader')} berupa bilangan bulat, atau kosongkan untuk tanpa batas.`,
    startDate: 'Tanggal mulai',
    endDate: 'Tanggal berakhir',
    endHint: `Hari terakhir ${kept('KPM')} dapat digunakan.`,
    price: `Harga per ${kept('leader')} per bulan`,
    priceHint: `Dicatat bersama ${kept('KPM')}. Tidak ada tagihan yang dibuat darinya.`,
    max: `Jumlah maksimal ${kept('leader')}`,
    maxHint: `${kept('AB')} dan ${kept('AAB')} digabung, termasuk ${kept('Owner')}. Kosongkan untuk tanpa batas.`,
    perMonth: 'Per bulan',
    perMonthFor: ({ n }) => `Per bulan untuk ${n} ${n === 1 ? kept('leader') : kept('leaders')}`,
    duration: 'Durasi',
    months: ({ n }) => `${n} bulan`,
    overDuration: 'Selama durasinya',
    leadersUsed: ({ n }) => <>Jumlah {kept('leader')} saat ini: {n}</>,
    keepActive: 'Tetap aktif setelah tanggal berakhir',
    overLimit: ({ used, max }) =>
      `${kept('KPM')} ini kini memiliki ${used} ${kept('leaders')}, lebih dari ${max}. Tidak ada yang diturunkan, dan setiap ${kept('AB')} atau ${kept('AAB')} baru setelah ${max} menunggu persetujuan ${kept('AgencyBoost')}.`,
    endPassedKept: ({ day }) =>
      `Tanggal berakhir ini, ${day}, sudah lewat. ${kept('KPM')} tetap terbuka karena diatur tetap aktif.`,
    endPassed: ({ day }) =>
      `Tanggal berakhir ini, ${day}, sudah lewat. Setelah Anda menyimpan, tidak ada seorang pun di ${kept('KPM')} ini yang dapat menggunakan ${kept('AgencyBoost')} sampai tanggalnya diubah atau ${kept('KPM')} ini diatur tetap aktif.`,
  },

  create: {
    title: `${kept('KPM')} baru`,
    subtitle: `Pengaturannya disalin dari titik awal yang dipilih; setelah itu, pengaturan menjadi milik ${kept('KPM')} ini.`,
    hint: {
      template: `Pengaturannya disalin dari bagian templat ini yang sudah diterbitkan; bagian yang belum diterbitkan dimulai kosong, kecuali ${kept('Capability Mapping')}, yang dimulai dengan susunan jenjang kapabilitas standar ${kept('AgencyBoost')}.`,
      library: `Pengaturannya disalin dari bagian ${kept('Template library')} yang sudah diterbitkan, dan setiap peran yang ditampilkannya harus ada di susunan jenjang perusahaan ini. Mengubah Template nanti tidak mengubah apa pun di ${kept('KPM')} ini.`,
      empty: `Hanya tiga jenis aktivitas yang dihitung rencana ${kept('goal')} dan susunan jenjang kapabilitas standar ${kept('AgencyBoost')}. ${kept('Owner')} menyusun sisanya.`,
    },
    noCompany: `Belum ada perusahaan untuk dikaitkan dengan ${kept('KPM')}.`,
    createCompany: 'Buat perusahaan terlebih dahulu',
    company: 'Perusahaan',
    startFrom: 'Mulai dari',
    templatesFailed: ({ message }) => `Templat perusahaan ini tidak dapat dimuat, jadi belum ada titik awal. ${message}`,
    notLoaded: 'Tidak termuat',
    loading: 'Memuat…',
    defaultTemplate: ({ name }) => `${name} · Default`,
    empty: 'Kosong',
    tryAgain: 'Coba lagi',
    code: `Kode ${kept('KPM')}`,
    codeHint: 'Unik di dalam perusahaan, dan pada dasarnya tidak berubah lagi.',
    codeError: '2–16 karakter: huruf, angka, dan tanda hubung.',
    branchName: 'Nama cabang',
    address: 'Alamat',
    optional: 'Opsional.',
    contactPhone: 'Telepon kontak',
    timeZone: 'Zona waktu',
    timeZoneReason: `Setiap batas hari di ${kept('KPM')} ini — apa yang dihitung sebagai hari ini, minggu mana suatu angka masuk, kapan sebuah bulan ditutup — dihitung di zona ini, bukan di zona Anda dan bukan di zona server. v1 menjalankan setiap ${kept('KPM')} dengan waktu Jakarta.`,
    creating: 'Membuat…',
    submit: `Buat ${kept('KPM')}`,
  },

  detail: {
    title: kept('Office'),
    loading: `Memuat ${kept('KPM')}…`,
    subtitle: `Penyiapan dan siklus hidup. Konsol ini tidak pernah membaca data bisnis ${kept('KPM')}.`,
    saveAsTemplate: 'Simpan sebagai templat',
    profile: 'Profil',
    kpmId: `ID ${kept('KPM')}`,
    company: 'Perusahaan',
    code: 'Kode',
    branch: 'Cabang',
    address: 'Alamat',
    phone: 'Telepon',
    timeZone: 'Zona waktu',
    currency: 'Mata uang',
    owner: kept('Owner'),
    noOwner: `Belum ada ${kept('Owner')}. Tidak ada yang dapat mengelola ${kept('KPM')} ini sampai ${kept('Owner')} ditetapkan.`,
    openAsOwner: `Buka sebagai ${kept('Owner')}`,
    transferOwner: `Pindahkan ${kept('Owner')}`,
    assignOwner: `Tetapkan ${kept('Owner')}`,
    people: kept('People'),
    peopleLine: `Isi ${kept('KPM')} baru dari spreadsheet, bukan satu per satu. Setiap akun dibuat dengan kata sandi untuk diteruskan, dan diminta membuat kata sandinya sendiri saat pertama kali masuk.`,
    importRoster: 'Impor roster',
    lifecycle: 'Siklus hidup',
    lifecycleLine: `${kept('KPM')} yang ditangguhkan menolak anggotanya dengan pesan tersendiri, sehingga mereka tahu ${kept('KPM')}-nya ditangguhkan, bukan bahwa mereka tidak punya izin.`,
    suspended: ({ reason }) => `Ditangguhkan: ${reason}`,
    subscription: 'Langganan: ',
    status: 'Status',
    reason: 'Alasan',
    reasonHint: 'Dicatat di log audit. Wajib diisi untuk menangguhkan.',
    apply: 'Terapkan',
  },

  owner: {
    assignTitle: `Tetapkan ${kept('Owner')}`,
    transferTitle: `Pindahkan ${kept('Owner')}`,
    current: ({ name, email }) => (
      <>
        {kept('Owner')} saat ini adalah {name}{email}. Pemindahan dicatat di audit bersama orang yang keluar dan yang
        masuk, dan mencabut hak pengelolaan {kept('KPM')} dari {kept('Owner')} yang lama.
      </>
    ),
    email: 'Email',
    emailHint: 'Akunnya harus sudah ada. Jika belum, minta dia membuat akun terlebih dahulu.',
    unknown: 'Tidak ada akun yang memakai alamat itu.',
    noAccount: ({ link }) => (
      <>Belum punya akun? {link('Buat akun')} — {kept('KPM')} tidak dapat dimiliki oleh orang yang belum mendaftar.</>
    ),
    transfer: 'Pindahkan',
    assign: 'Tetapkan',
  },

  roster: {
    title: 'Impor roster',
    subtitle: `Buat semua orang di ${kept('KPM')} ini dari spreadsheet.`,
  },

  admins: {
    title: kept('KPM Owners & Admins'),
    subtitle: `Semua orang yang dapat mengelola ${kept('KPM')}, di seluruh ${kept('KPM')}`,
    columns: { who: 'Siapa', office: kept('KPM'), access: 'Akses', granted: 'Diberikan' },
    caption: `Pengelola ${kept('KPM')}`,
    empty: `Belum ada ${kept('KPM')} yang memiliki pengelola.`,
    line: `Pemberian dan pencabutan akses dilakukan di dalam ${kept('KPM')}, oleh ${kept('Owner')}-nya. Ini hanya tampilan, bukan kontrol.`,
    owner: kept('Owner'),
    admin: kept('Admin'),
    withOffice: `Melekat pada ${kept('KPM')}`,
  },
};

export const adminOfficesMessages = defineMessages({ en, id });
