import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's reads across KPMs** (P19.4-T3; ADR-0207; SA UI-010, SA UI-013, SA UI-018; the setup spec's A2):
 * *All members*, the KPM comparison under *Cross-platform analytics*, *Lihat sebagai KPM*, the KPM page's tabs
 * (*Ringkasan · Anggota · Data bulanan · Lihat sebagai KPM · Billing*) and the company's *KPM & data*.
 *
 * **The Indonesian is the flow report's and the setup spec's, verbatim where they give it** (*"Belum ada anggota. Anggota
 * muncul di sini setelah KPM mengimpor orang."*, *"Belum ada KPM di platform."*, *Belum pernah*, *Hanya lihat*, *"Kunjungan
 * ini tercatat di Audit log"*, *Keluar*, *Lengkap · Belum · —*, *Riwayat unggahan*, *"Belum cukup KPM pembanding"*).
 *
 * @moved app/(admin)/admin/members/
 * @moved app/(admin)/admin/tenants/[kpmId]/analytics/
 * @moved app/(admin)/admin/companies/[companyId]/kpms/
 * @moved components/admin/platform-members.tsx
 * @moved components/admin/kpm-comparison.tsx
 * @moved components/admin/kpm-data-tab.tsx
 */

const en = {
  members: {
    title: kept('All members'),
    caption: 'Every member on the platform',
    search: 'Search by name, phone or email',
    searchHint: 'At least two characters. A phone number or an email finds the person; neither is shown.',
    company: 'Company',
    kpm: kept('KPM'),
    role: 'Role',
    status: 'Status',
    any: 'All',
    columns: {
      name: 'Name', company: 'Company', kpm: kept('KPM'), role: 'Role', leader: 'Upline', status: 'Status',
      lastActive: 'Last active',
    },
    roles: { ab: kept('AB'), aab: 'AAB', agent: kept('Agent') },
    statuses: { active: 'Active', pending: 'Pending', removed: 'Removed' },
    invitation: { invited: 'Invited', not_invited: 'Not invited', signed_in: 'Signed in' },
    owner: kept('Owner'),
    admin: kept('Admin'),
    never: 'Never',
    /** SA UI-010's empty state, Appendix A. */
    empty: 'No members yet. Members appear here once a KPM imports people.',
    noMatch: 'No member matches these filters.',
    loading: 'Loading the members',
    retry: 'Try again',
    total: ({ n }: { n: number }) => `${n} ${n === 1 ? 'member' : 'members'}`,
    previous: 'Previous',
    next: 'Next',
    page: ({ page, pages }: { page: number; pages: number }) => `Page ${page} of ${pages}`,
    openKpm: ({ code }: { code: string }) => `Open KPM ${code}`,
    joined: 'Joined',
    agentCode: 'Agent code',
  },
  comparison: {
    title: 'KPM comparison',
    caption: 'Each KPM’s own figures, as its Overview shows them',
    allCompanies: 'All companies',
    company: 'Company',
    columns: {
      kpm: kept('KPM'), company: 'Company', members: kept('Total members'), activeThisMonth: 'Active (this month)',
      activeUsers: 'Active users (7 days)', coached: 'Coached 7 days · 30 days', production: 'Production this year',
      recruitment: 'Pipeline (recruitment)',
    },
    sortBy: ({ column }: { column: string }) => `Sort by ${column}`,
    /** The sort pill below 1024px (P19.2-T2 AC-4; UI-134), where the headings cannot be pressed: its name and its sheet's. */
    sort: 'Sort order',
    notUploaded: 'Not uploaded',
    ofTarget: ({ target }: { target: string }) => `of ${target}`,
    noTarget: 'No target',
    /** SA UI-018, Appendix A: *KPM*, never *cabang*. */
    empty: 'No KPMs on the platform yet.',
    loading: 'Loading the comparison',
    retry: 'Try again',
    open: ({ code }: { code: string }) => `Open KPM ${code}’s analytics, read-only`,
  },
  lookAs: {
    title: 'View as KPM',
    /** A2's navy banner. */
    readOnly: 'View only',
    banner: ({ code }: { code: string }) =>
      `You are viewing KPM ${code} as its owner sees it. Nothing can be changed from here. This visit is recorded in the Audit log.`,
    exit: 'Exit',
    tabs: 'The KPM’s analytics tabs',
    /** P19.5-T3 AC-12 (ADR-0215 §9): the third tab, the menu item's own name, kept. */
    tabAdvanced: kept('Advanced analytics'),
  },
  kpm: {
    tabs: 'KPM page',
    tab: { ringkasan: 'At a glance', anggota: 'Members', data: 'Monthly data', lihat: 'View as KPM', billing: 'Billing' },
    back: 'All KPMs',
    admins: kept('Admin'),
    adminsNone: 'None yet',
    adminsHint: 'The Owner adds and removes Admins.',
    adminState: { active: 'Active', invited: 'Invited', not_invited: 'Not invited' },
    membersCard: 'Members',
    membersByRole: 'Members by role',
    /** A2's warning, with no link to an import (UI-151; ADR-0206 §6). */
    noMembers: 'No members yet.',
    noMembersLine: 'The KPM’s Owner or an Admin imports its members, on their People page.',
    grid: 'Monthly data · last 12 months',
    month: { complete: 'Complete', missing: 'Missing', none: 'Before the KPM' },
    gridHint: 'Each month the KPM uploaded. The KPM’s Owner and Admins upload it.',
    uploads: 'Upload history',
    uploadColumns: { month: 'Month', by: 'By', at: 'When', agents: 'Agent rows', note: 'Note' },
    noUploads: 'No data yet.',
    note: {
      committed: 'Imported',
      reverting: 'Being reverted',
      reverted: 'Reverted',
      asOf: ({ date }: { date: string }) => `as of ${date}`,
    },
    loading: 'Loading',
    membersReadOnly: 'Read only. The KPM’s Owner and Admins add, change and import members.',
    lookAsLine: 'The KPM’s analytics as its owner sees them, read-only. Each visit is recorded in the Audit log.',
    lookAsOpen: 'Open the KPM’s analytics',
  },
  kpmData: {
    tab: 'KPMs and data',
    rowKpm: ({ code }: { code: string }) => `KPM ${code}`,
    tiles: {
      kpms: kept('KPM'),
      activeOwners: ({ n }: { n: number }) => `${n} active ${n === 1 ? 'owner' : 'owners'}`,
      members: 'Members',
      notSignedIn: ({ n }: { n: number }) => `${n} not yet in the app`,
      complete: ({ month }: { month: string }) => `${month} data complete`,
      of: ({ n, of }: { n: number; of: number }) => `${n} of ${of}`,
      needsThree: ({ n }: { n: number }) => `Comparing KPMs needs at least ${n}`,
      enough: 'Enough to compare',
    },
    heading: ({ month }: { month: string }) => `All KPMs · ${month}`,
    rowHint: 'Open a row to see its KPM.',
    columns: {
      kpm: kept('KPM'), manpower: kept('Manpower'), maa: 'Active agents (MAA)', ape: 'APE YTD', recruitment: 'Recruitment YTD',
      data: ({ month }: { month: string }) => `Data ${month}`, peers: 'Peers',
    },
    data: { complete: 'Complete', missing: 'Missing' },
    peers: {
      notEnough: ({ n, of }: { n: number; of: number }) => `Not enough peer KPMs (${n} of ${of})`,
      enough: ({ n }: { n: number }) => `${n} peer KPMs`,
      notCounted: 'Not counted',
    },
    empty: 'This company has no KPM yet.',
    loading: 'Loading the KPMs',
    retry: 'Try again',
    month: 'Month',
  },
  list: {
    columns: { kpm: kept('KPM'), owner: kept('Owner'), members: 'Members', lastData: 'Latest data', action: 'Needs action' },
    ownerState: { none: 'No owner', not_invited: 'Not invited', invited: 'Invited', active: 'Signed in' },
    actions: {
      ownerNotInvited: 'The owner has not accepted the invitation',
      noOwner: 'No owner yet',
      noMembers: 'No members yet',
      dataMissing: ({ month }: { month: string }) => `${month} data not uploaded`,
    },
    noData: 'No data yet',
    nothing: 'Nothing',
  },
};

const id: MessagesOf<typeof en> = {
  members: {
    title: kept('All members'),
    caption: 'Semua anggota di platform',
    search: 'Cari nama, nomor telepon, atau email',
    searchHint: 'Minimal dua karakter. Nomor telepon atau email menemukan orangnya; keduanya tidak ditampilkan.',
    company: 'Perusahaan',
    kpm: kept('KPM'),
    role: 'Peran',
    status: 'Status',
    any: 'Semua',
    columns: {
      name: 'Nama', company: 'Perusahaan', kpm: kept('KPM'), role: 'Peran', leader: 'Atasan', status: 'Status',
      lastActive: 'Terakhir aktif',
    },
    roles: { ab: kept('AB'), aab: 'AAB', agent: kept('Agent') },
    statuses: { active: 'Aktif', pending: 'Menunggu', removed: 'Keluar' },
    invitation: { invited: 'Diundang', not_invited: 'Belum diundang', signed_in: 'Sudah masuk' },
    owner: kept('Owner'),
    admin: kept('Admin'),
    never: 'Belum pernah',
    empty: `Belum ada anggota. Anggota muncul di sini setelah ${kept('KPM')} mengimpor orang.`,
    noMatch: 'Tidak ada anggota yang cocok dengan filter ini.',
    loading: 'Memuat anggota',
    retry: 'Coba lagi',
    total: ({ n }) => `${n} anggota`,
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    page: ({ page, pages }) => `Halaman ${page} dari ${pages}`,
    openKpm: ({ code }) => `Buka ${kept('KPM')} ${code}`,
    joined: 'Bergabung',
    agentCode: 'Kode agen',
  },
  comparison: {
    title: `Perbandingan ${kept('KPM')}`,
    caption: `Angka setiap ${kept('KPM')} sendiri, seperti di ${kept('Overview')}-nya`,
    allCompanies: 'Semua perusahaan',
    company: 'Perusahaan',
    columns: {
      kpm: kept('KPM'), company: 'Perusahaan', members: kept('Total members'), activeThisMonth: 'Aktif bulan ini',
      activeUsers: 'Pengguna aktif (7 hari)', coached: 'Dibina 7 hari · 30 hari', production: 'Produksi tahun ini',
      recruitment: 'Pipeline rekrutmen',
    },
    sortBy: ({ column }) => `Urutkan menurut ${column}`,
    sort: 'Urutan',
    notUploaded: 'Belum diunggah',
    ofTarget: ({ target }) => `dari ${target}`,
    noTarget: 'Belum ada target',
    empty: `Belum ada ${kept('KPM')} di platform.`,
    loading: 'Memuat perbandingan',
    retry: 'Coba lagi',
    open: ({ code }) => `Buka analitik ${kept('KPM')} ${code}, hanya lihat`,
  },
  lookAs: {
    title: `Lihat sebagai ${kept('KPM')}`,
    readOnly: 'Hanya lihat',
    banner: ({ code }) =>
      `Anda melihat ${kept('KPM')} ${code} seperti pemiliknya. Tidak ada yang bisa diubah dari sini. Kunjungan ini tercatat di Audit log.`,
    exit: 'Keluar',
    tabs: `Analitik ${kept('KPM')}`,
    tabAdvanced: kept('Advanced analytics'),
  },
  kpm: {
    tabs: `Halaman ${kept('KPM')}`,
    tab: { ringkasan: 'Ringkasan', anggota: 'Anggota', data: 'Data bulanan', lihat: `Lihat sebagai ${kept('KPM')}`, billing: 'Tagihan' },
    back: kept('All KPMs'),
    admins: kept('Admin'),
    adminsNone: 'Belum ada',
    adminsHint: `${kept('Owner')} yang menambah dan menghapus ${kept('Admin')}.`,
    adminState: { active: 'Aktif', invited: 'Diundang', not_invited: 'Belum diundang' },
    membersCard: 'Anggota',
    membersByRole: 'Anggota per peran',
    noMembers: 'Belum ada anggota.',
    noMembersLine: `${kept('Owner')} atau ${kept('Admin')} ${kept('KPM')} yang mengimpor anggotanya, di halaman People mereka.`,
    grid: 'Data bulanan · 12 bulan terakhir',
    month: { complete: 'Lengkap', missing: 'Belum', none: 'Sebelum KPM' },
    gridHint: `Setiap bulan yang diunggah ${kept('KPM')}. ${kept('Owner')} dan ${kept('Admin')} ${kept('KPM')} yang mengunggahnya.`,
    uploads: 'Riwayat unggahan',
    uploadColumns: { month: 'Bulan', by: 'Oleh', at: 'Waktu', agents: 'Agen', note: 'Catatan' },
    noUploads: 'Belum ada data.',
    note: {
      committed: 'Diimpor',
      reverting: 'Sedang dibatalkan',
      reverted: 'Dibatalkan',
      asOf: ({ date }) => `per ${date}`,
    },
    loading: 'Memuat',
    membersReadOnly: `Hanya lihat. ${kept('Owner')} dan ${kept('Admin')} ${kept('KPM')} yang menambah, mengubah, dan mengimpor anggota.`,
    lookAsLine: `Analitik ${kept('KPM')} seperti dilihat pemiliknya, hanya lihat. Setiap kunjungan tercatat di Audit log.`,
    lookAsOpen: `Buka analitik ${kept('KPM')}`,
  },
  kpmData: {
    tab: `${kept('KPM')} & data`,
    rowKpm: ({ code }) => `${kept('KPM')} ${code}`,
    tiles: {
      kpms: kept('KPM'),
      activeOwners: ({ n }) => `${n} pemilik aktif`,
      members: 'Anggota',
      notSignedIn: ({ n }) => `${n} belum masuk aplikasi`,
      complete: ({ month }) => `Data ${month} lengkap`,
      of: ({ n, of }) => `${n} dari ${of}`,
      needsThree: ({ n }) => `Perbandingan antar-${kept('KPM')} butuh minimal ${n}`,
      enough: 'Cukup untuk perbandingan',
    },
    heading: ({ month }) => `Semua ${kept('KPM')} · ${month}`,
    rowHint: `Ketuk baris untuk membuka ${kept('KPM')}.`,
    columns: {
      kpm: kept('KPM'), manpower: kept('Manpower'), maa: 'Agen aktif (MAA)', ape: `APE ${kept('YTD')}`,
      recruitment: `Rekrutmen ${kept('YTD')}`, data: ({ month }) => `Data ${month}`, peers: 'Pembanding',
    },
    data: { complete: 'Lengkap', missing: 'Belum' },
    peers: {
      notEnough: ({ n, of }) => `Belum cukup ${kept('KPM')} pembanding (${n} dari ${of})`,
      enough: ({ n }) => `${n} ${kept('KPM')} pembanding`,
      notCounted: 'Tidak dihitung',
    },
    empty: `Perusahaan ini belum punya ${kept('KPM')}.`,
    loading: `Memuat ${kept('KPM')}`,
    retry: 'Coba lagi',
    month: 'Bulan',
  },
  list: {
    columns: { kpm: kept('KPM'), owner: kept('Owner'), members: 'Anggota', lastData: 'Data terakhir', action: 'Perlu tindakan' },
    ownerState: { none: 'Belum ada pemilik', not_invited: 'Belum diundang', invited: 'Diundang', active: 'Aktif' },
    actions: {
      ownerNotInvited: 'Pemilik belum menerima undangan',
      noOwner: 'Belum ada pemilik',
      noMembers: 'Belum ada anggota',
      dataMissing: ({ month }) => `Data ${month} belum diunggah`,
    },
    noData: 'Belum ada data',
    nothing: 'Tidak ada',
  },
};

export const adminPlatformReadsMessages = defineMessages({ en, id });
