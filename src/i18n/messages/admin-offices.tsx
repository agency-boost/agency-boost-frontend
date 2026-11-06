import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's offices** (P18.10-T6; `functional/tenant-provisioning.md`, *The module's own strings*): *All KPMs*
 * (`/admin/tenants`) with *Edit subscription* (`components/subscription-dialog.tsx`), *New office*
 * (`/admin/tenants/new`), an office's page with its *Profile*, *Owner*, *People* and *Lifecycle* cards
 * (`/admin/tenants/[kpmId]`), *Assign owner* · *Transfer owner* (`…/owner`), and *KPM Owners & Admins*
 * (`/admin/tenant-admins`). *Import a roster* (`…/roster`) is retired (P19.4-T2; ADR-0206 §6): the address redirects
 * to the office's page, and its words went with it — the Owner imports, on `/people/import`.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's:
 * §A.2's sentence titles (*KPM baru*, *Tetapkan Owner · Pindahkan Owner*), §B.1 to §B.5, *office* is
 * *KPM* (§B.9), *Ubah langganan* for *Edit subscription* (§B.10, agreed with the leader limit's advice), *template*
 * (ADR-0185), *bagian* for a section and *susunan jenjang* for the ladder (§B.10). **Kept** (§A): the pages' titles that are
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
    /**
     * A KPM's row below 1024px (P19.2-T2 AC-1; UI-126): *Prudential · 12 members · Sep 2026*, the month left out while
     * nothing is uploaded — *No data yet* is said there instead.
     */
    rowMeta: ({ company, n, members, data }: { company: string; n: number; members: string; data: string | null }) =>
      `${company} · ${members} ${n === 1 ? 'member' : 'members'} · ${data ?? 'No data yet'}`,
    /** The row's Owner, named before the chip that says how far they are. */
    ownerIs: ({ name }: { name: string }) => `Owner: ${name}`,
    /** Past the limit, the row's count before *3 over*: *Leaders 13 / 10*. */
    leadersAre: ({ count }: { count: string }) => `Leaders ${count}`,
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
    // P19.4-T3 (ADR-0211 §1): *Paket*. Choosing one proposes the end date; both dates stay editable.
    plan: 'Plan',
    planNone: 'No plan',
    planSixMonths: '6 months',
    planAnnual: 'Annual',
    planHint: 'Choosing a plan proposes the end date: the start plus the plan, less a day.',
  },

  /** *New office* (`/admin/tenants/new`; ADR-0115 §4, ADR-0164 §5, ADR-0168 §2, ADR-0185 §5). */
  create: {
    title: 'New office',
    subtitle: 'Its settings are copied from what it starts from; the office owns them afterwards.',
    /** Under *Start from*, one sentence for what is chosen (ADR-0185 §5). */
    hint: {
      template: 'Its published sections are copied; one it has not published starts empty.',
      library: 'Copied across companies: every role they show must be on this company’s ladder.',
      empty: 'Only the three activity types the goal plan counts. It cannot be filled from a template later.',
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
    /** A field left empty, said on it when *Create office* is pressed (P19.2-T2 AC-3; UI-133: the main button enabled). */
    required: 'Required.',
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
    /** UI-168 point 4: *Ganti Owner*, the client's words (P19-T3 AC-5). */
    transferOwner: 'Change owner',
    assignOwner: 'Assign owner',
    /** *Pindahkan ke perusahaan lain* (ADR-0191 §5, P19-T3 AC-6). */
    changeCompany: 'Move to another company',
    newCompany: 'New company',
    moveHint: 'Only for an office with no member but its Owner. Its settings are copied again from the new company’s default template.',
    move: 'Move',
    moving: 'Moving…',
    /** `company` the new one's name, as stored. */
    moved: ({ company }: { company: string }) => `Moved to ${company}. Its settings now come from ${company}’s default template.`,
    /** *Hapus KPM* (P19-T3 AC-7): a soft delete of an empty office; one with people or data is archived. */
    deleteOffice: 'Delete KPM',
    deleteAsk: ({ office, members, records }: { office: string; members: number; records: number }) =>
      `Delete ${office}? It has ${members} ${members === 1 ? 'member' : 'members'} and ${records} `
      + `${records === 1 ? 'record' : 'records'}. It leaves every list, and its code is free for the company again.`,
    cannotDelete: ({ office, members, records }: { office: string; members: number; records: number }) =>
      `${office} has ${members} ${members === 1 ? 'member' : 'members'} and ${records} `
      + `${records === 1 ? 'record' : 'records'}, so it cannot be deleted. Archive it instead?`,
    archive: 'Archive',
    people: kept('People'),
    /** P19.4-T2 AC-3, AC-8 (UI-151, Overview case 10): who adds the people now — no link, the import is not the Super Admin's. */
    peopleLine: 'The KPM’s Owner or one of its Admins adds its members, one by one or from a file, on their own People page.',
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
    transferTitle: 'Change owner',
    /** `name` drawn bold, `email` the bracketed address or nothing. */
    current: ({ name, email }: { name: ReactNode; email: ReactNode }) => (
      <>
        The current owner is {name}{email}. A transfer is audited with both the outgoing and incoming person, and takes
        the office&apos;s administration rights away from the outgoing one.
      </>
    ),
    /** *Ganti Owner*'s picker (ADR-0191 §5, P19-T3 AC-5): an existing account, by name or email. */
    search: 'Find the account',
    searchHint: 'Type part of a name or an email address. Typing the whole address works too.',
    searching: 'Searching…',
    noMatch: 'No account matches that.',
    unknown: 'No account uses that address.',
    /*
     * The `mailto:` *Kirim undangan* (UI-168 point 2) is retired with its four strings (P19.4-T3; ADR-0212 §3): an address
     * nobody holds is made the Owner and invited by the API now — `admin-kpm-owner.tsx`, `newPerson`.
     */
    /** What an account already holds, beside its name. */
    ownerOf: ({ office }: { office: string }) => `Owner · ${office}`,
    memberOf: ({ office }: { office: string }) => `Member · ${office}`,
    pendingIn: ({ office }: { office: string }) => `Waiting · ${office}`,
    noOffice: 'In no office',
    /** Why an account cannot own this office, said on its row. */
    unverified: 'Email address not verified: cannot own an office yet',
    otherCompany: ({ company }: { company: string }) => `Signed up with ${company}, not this office’s company`,
    noCompany: 'No company or agent code on the account',
    deactivated: 'Account deactivated',
    choose: ({ name }: { name: string }) => `Choose ${name}`,
    chosen: ({ name }: { name: string }) => `${name} chosen`,
    transfer: 'Change',
    assign: 'Assign',
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
    rowMeta: ({ company, members, data }) => `${company} · ${members} anggota · ${data ?? 'Belum ada data'}`,
    ownerIs: ({ name }) => `${kept('Owner')}: ${name}`,
    leadersAre: ({ count }) => `Jumlah ${kept('leader')} ${count}`,
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
    plan: 'Paket',
    planNone: 'Tanpa paket',
    planSixMonths: '6 bulan',
    planAnnual: 'Tahunan',
    planHint: 'Memilih paket mengisi tanggal berakhir: tanggal mulai ditambah lama paket, dikurangi sehari.',
  },

  create: {
    title: `${kept('KPM')} baru`,
    subtitle: `Pengaturannya disalin dari titik awal yang dipilih; setelah itu, pengaturan menjadi milik ${kept('KPM')} ini.`,
    hint: {
      template: 'Bagian yang sudah terbit disalin; bagian yang belum terbit dimulai kosong.',
      library: 'Disalin antarperusahaan: setiap peran yang ditampilkannya harus ada di susunan jenjang perusahaan ini.',
      empty: `Hanya tiga jenis aktivitas yang dihitung rencana ${kept('goal')}. Tidak dapat diisi dari template nanti.`,
    },
    noCompany: `Belum ada perusahaan untuk dikaitkan dengan ${kept('KPM')}.`,
    createCompany: 'Buat perusahaan terlebih dahulu',
    company: 'Perusahaan',
    startFrom: 'Mulai dari',
    templatesFailed: ({ message }) => `Template perusahaan ini tidak dapat dimuat, jadi belum ada titik awal. ${message}`,
    notLoaded: 'Tidak termuat',
    loading: 'Memuat…',
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
    // As the company and the rung sheets say it (`admin-template-companies`, `admin-template-org-levels`).
    required: 'Wajib diisi.',
  },

  detail: {
    title: kept('Office'),
    loading: `Memuat ${kept('KPM')}…`,
    subtitle: `Penyiapan dan siklus hidup. Konsol ini tidak pernah membaca data bisnis ${kept('KPM')}.`,
    saveAsTemplate: 'Simpan sebagai template',
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
    transferOwner: `Ganti ${kept('Owner')}`,
    assignOwner: `Tetapkan ${kept('Owner')}`,
    changeCompany: 'Pindahkan ke perusahaan lain',
    newCompany: 'Perusahaan baru',
    moveHint: `Hanya untuk ${kept('KPM')} tanpa anggota selain ${kept('Owner')}-nya. Pengaturannya disalin ulang dari template default perusahaan baru.`,
    move: 'Pindahkan',
    moving: 'Memindahkan…',
    moved: ({ company }) => `Dipindahkan ke ${company}. Pengaturannya kini berasal dari template default ${company}.`,
    deleteOffice: `Hapus ${kept('KPM')}`,
    deleteAsk: ({ office, members, records }) =>
      `Hapus ${office}? ${kept('KPM')} ini memiliki ${members} anggota dan ${records} data. ${kept('KPM')} ini hilang dari `
      + 'setiap daftar, dan kodenya dapat dipakai lagi oleh perusahaannya.',
    cannotDelete: ({ office, members, records }) =>
      `${office} memiliki ${members} anggota dan ${records} data, jadi tidak dapat dihapus. Arsipkan saja?`,
    archive: 'Arsipkan',
    people: kept('People'),
    peopleLine: `${kept('Owner')} ${kept('KPM')} atau salah satu ${kept('Admin')}-nya yang menambahkan anggota, satu per satu atau dari file, di halaman ${kept('People')} mereka sendiri.`,
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
    transferTitle: `Ganti ${kept('Owner')}`,
    current: ({ name, email }) => (
      <>
        {kept('Owner')} saat ini adalah {name}{email}. Pemindahan dicatat di audit bersama orang yang keluar dan yang
        masuk, dan mencabut hak pengelolaan {kept('KPM')} dari {kept('Owner')} yang lama.
      </>
    ),
    search: 'Cari akun',
    searchHint: 'Ketik sebagian nama atau alamat email. Mengetik alamat lengkap juga bisa.',
    searching: 'Mencari…',
    noMatch: 'Tidak ada akun yang cocok.',
    unknown: 'Tidak ada akun yang memakai alamat itu.',
    ownerOf: ({ office }) => `${kept('Owner')} · ${office}`,
    memberOf: ({ office }) => `Anggota · ${office}`,
    pendingIn: ({ office }) => `Menunggu · ${office}`,
    noOffice: `Belum di ${kept('KPM')} mana pun`,
    unverified: `Alamat email belum terverifikasi: belum dapat menjadi ${kept('Owner')} ${kept('KPM')}`,
    otherCompany: ({ company }) => `Mendaftar di ${company}, bukan perusahaan ${kept('KPM')} ini`,
    noCompany: 'Akun belum memiliki perusahaan atau kode agen',
    deactivated: 'Akun dinonaktifkan',
    choose: ({ name }) => `Pilih ${name}`,
    chosen: ({ name }) => `${name} dipilih`,
    transfer: 'Ganti',
    assign: 'Tetapkan',
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
