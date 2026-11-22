import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Anggota* — every member of every KPM** (P19.23-T3 AC-1; the Super Admin spec of 20 November 2026, §6; ADR-0277;
 * OD-421): the list, its filters and tabs, and the member's detail with *WhatsApp*, *Buka di KPM* and the *Akun tes*
 * switch.
 *
 * **The Indonesian is the mockup's, verbatim** (`superadmin-tablet-stopmotion-2026-11-19`, `saMem` and `memDet`): *Cari
 * nama, telepon, email*, *Semua perusahaan · Semua KPM · Semua status*, *Semua · AB · AAB · Agent*, *Telepon · Email ·
 * Bergabung · Terakhir pakai · Status · Upline*, *Buka di KPM*, *"Ubah peran, leader, atau keluarkan: dari All members di
 * dalam KPM-nya"*, *"n anggota di m KPM · akun tes tidak dihitung"*. **Kept** (§A): *KPM*, *AB*, *AAB*, *Agent*,
 * *Owner*, *Admin*, *WhatsApp*, *All members*, *leader*. Names, companies and KPM names stay as typed.
 *
 * @moved app/(admin)/admin/members/
 * @moved components/admin/anggota.tsx
 * @moved components/admin/member-detail-sheet.tsx
 */
const en = {
  title: 'Members',
  search: 'Search name, phone, email',
  searchButton: 'Search',
  filters: 'Filters',
  company: 'Company',
  kpm: kept('KPM'),
  status: 'Status',
  allCompanies: 'All companies',
  allKpms: `Every ${kept('KPM')}`,
  allStatuses: 'All statuses',
  statuses: { active: 'Active', pending: 'Waiting', removed: 'Left', test: 'Test accounts' },
  roleTabs: 'Role',
  tabs: { all: 'All', ab: kept('AB'), aab: kept('AAB'), agent: kept('Agent') },
  columns: { member: 'Member', kpm: kept('KPM'), company: 'Company' },
  caption: 'Members of every KPM',
  owner: kept('Owner'),
  admin: kept('Admin'),
  testTag: 'Test account',
  openDetail: ({ name }: { name: string }) => `Details of ${name}`,
  note: ({ n, m }: { n: number; m: number }) =>
    `${n} ${n === 1 ? 'member' : 'members'} in ${m} ${kept('KPM')} · test accounts are not counted`,
  noteTest: ({ n }: { n: number }) => `${n} test ${n === 1 ? 'account' : 'accounts'} · never listed or counted anywhere else`,
  tapHint: 'Tap = member details (can be changed)',
  /** *Akun terdaftar* (ADR-0245 §1, the client's request of 11 November): an account with no KPM is in no membership. */
  accounts: 'Registered accounts, with or without a KPM',
  backToMembers: 'Back to members',
  /**
   * *KPM Owners & Admins* (`/admin/tenant-admins`), out of the menu since P19.23-T1 (OD-419) but kept — it carries *Kelola
   * data produk* (ADR-0260, the client's request) — one link from *Anggota*.
   */
  stewards: `${kept('Owner')} & admin · Manage product data`,
  loading: 'Loading members…',
  empty: 'No member in any KPM yet.',
  noMatch: 'No member matches.',
  retry: 'Try again',
  /*
   * P19.28-T3 (UI-208, UI-209 (21 Nov); ADR-0286): the chips' switch, *Menunggu*'s and *Keluar*'s pills and actions, the
   * phone's *Filter* sheet. The stop motion's words, verbatim: *Tampilkan akun tes*, *Diundang · hari ini*, *Belum ada
   * KPM*, *Kirim ulang · Batalkan*, *Masukkan*, *Keluar <Mon YYYY>*, *Tidak ada yang menunggu*.
   */
  showTests: 'Show test accounts',
  nobodyWaiting: 'Nobody is waiting',
  nobodyLeft: 'Nobody has left',
  done: 'Done',
  leftOn: ({ month }: { month: string }) => `Left ${month}`,
  invitedOn: ({ when }: { when: string }) => `Invited · ${when}`,
  today: 'today',
  noKpm: `No ${kept('KPM')} yet`,
  resend: 'Send again',
  cancel: 'Cancel',
  place: 'Add',
  placeFor: ({ name }: { name: string }) => `Add ${name} to a ${kept('KPM')}`,
  invitationMenu: ({ name }: { name: string }) => `Invitation of ${name}`,
  waitingCaption: 'Waiting',
  resent: ({ name }: { name: string }) => `${name}'s invitation is on ${'WhatsApp'} again.`,
  cancelled: ({ name }: { name: string }) => `${name}'s invitation cancelled.`,

  detail: {
    title: 'Member details',
    phone: 'Phone',
    email: 'Email',
    joined: 'Joined',
    lastUsed: 'Last used',
    status: 'Status',
    upline: 'Upline',
    noPhone: 'No number yet',
    whatsApp: 'WhatsApp',
    openInKpm: 'Open in KPM',
    changeNote: `Change role, ${kept('leader')} or remove: from ${kept('All members')} inside their ${kept('KPM')}`,
    testSwitch: 'Test account',
    testHint: 'A test account is never listed or counted in any KPM.',
    testOn: ({ name }: { name: string }) => `${name} is now a test account.`,
    testOff: ({ name }: { name: string }) => `${name} is counted again.`,
    loading: 'Loading details…',
    close: 'Close',
    /** P19.28-T4 AC-1 (UI-210 (21 Nov)): *Akun tes* behind ⋯, with a confirmation. */
    more: ({ name }: { name: string }) => `More for ${name}`,
    testSet: 'Mark as test account',
    testUnset: 'Count again (not a test account)',
    confirmSetTitle: ({ name }: { name: string }) => `Make ${name} a test account?`,
    confirmUnsetTitle: ({ name }: { name: string }) => `Count ${name} again?`,
    confirmSet: 'Yes, test account',
    confirmUnset: 'Yes, count again',
    cancel: 'Cancel',
  },
  /** *Terakhir pakai*'s pill. */
  lastUsed: { today: 'Today', daysAgo: ({ days }: { days: number }) => `${days} ${days === 1 ? 'day' : 'days'} ago`, never: 'Never' },
  memberStatus: { active: 'Active', pending: 'Waiting', removed: 'Left' },
};

const id: MessagesOf<typeof en> = {
  title: 'Anggota',
  search: 'Cari nama, telepon, email',
  searchButton: 'Cari',
  filters: 'Filter',
  company: 'Perusahaan',
  kpm: kept('KPM'),
  status: 'Status',
  allCompanies: 'Semua perusahaan',
  allKpms: `Semua ${kept('KPM')}`,
  allStatuses: 'Semua status',
  statuses: { active: 'Aktif', pending: 'Menunggu', removed: 'Keluar', test: 'Akun tes' },
  roleTabs: 'Peran',
  tabs: { all: 'Semua', ab: kept('AB'), aab: kept('AAB'), agent: kept('Agent') },
  columns: { member: 'Anggota', kpm: kept('KPM'), company: 'Perusahaan' },
  caption: `Anggota semua ${kept('KPM')}`,
  owner: kept('Owner'),
  admin: kept('Admin'),
  testTag: 'Akun tes',
  openDetail: ({ name }) => `Detail ${name}`,
  note: ({ n, m }) => `${n} anggota di ${m} ${kept('KPM')} · akun tes tidak dihitung`,
  noteTest: ({ n }) => `${n} akun tes · tidak pernah ditampilkan atau dihitung di tempat lain`,
  tapHint: 'Ketuk = detail anggota (bisa diubah)',
  accounts: `Akun terdaftar, dengan atau tanpa ${kept('KPM')}`,
  backToMembers: 'Kembali ke anggota',
  stewards: `${kept('Owner')} & admin · Kelola data produk`,
  loading: 'Memuat anggota…',
  empty: `Belum ada anggota di ${kept('KPM')} mana pun.`,
  noMatch: 'Tidak ada anggota yang cocok.',
  retry: 'Coba lagi',
  showTests: 'Tampilkan akun tes',
  nobodyWaiting: 'Tidak ada yang menunggu',
  nobodyLeft: 'Tidak ada yang keluar',
  done: 'Selesai',
  leftOn: ({ month }) => `Keluar ${month}`,
  invitedOn: ({ when }) => `Diundang · ${when}`,
  today: 'hari ini',
  noKpm: `Belum ada ${kept('KPM')}`,
  resend: 'Kirim ulang',
  cancel: 'Batalkan',
  place: 'Masukkan',
  placeFor: ({ name }) => `Masukkan ${name} ke ${kept('KPM')}`,
  invitationMenu: ({ name }) => `Undangan ${name}`,
  waitingCaption: 'Menunggu',
  resent: ({ name }) => `Undangan ${name} dibuka lagi di ${'WhatsApp'}.`,
  cancelled: ({ name }) => `Undangan ${name} dibatalkan.`,

  detail: {
    title: 'Detail anggota',
    phone: 'Telepon',
    email: 'Email',
    joined: 'Bergabung',
    lastUsed: 'Terakhir pakai',
    status: 'Status',
    upline: 'Upline',
    noPhone: 'Belum ada nomor',
    whatsApp: 'WhatsApp',
    openInKpm: `Buka di ${kept('KPM')}`,
    changeNote: `Ubah peran, ${kept('leader')}, atau keluarkan: dari ${kept('All members')} di dalam ${kept('KPM')}-nya`,
    testSwitch: 'Akun tes',
    testHint: `Akun tes tidak pernah ditampilkan atau dihitung di ${kept('KPM')} mana pun.`,
    testOn: ({ name }) => `${name} sekarang akun tes.`,
    testOff: ({ name }) => `${name} dihitung lagi.`,
    loading: 'Memuat detail…',
    close: 'Tutup',
    more: ({ name }) => `Lainnya untuk ${name}`,
    testSet: 'Jadikan akun tes',
    testUnset: 'Hitung lagi (bukan akun tes)',
    confirmSetTitle: ({ name }) => `Jadikan ${name} akun tes?`,
    confirmUnsetTitle: ({ name }) => `Hitung ${name} lagi?`,
    confirmSet: 'Ya, akun tes',
    confirmUnset: 'Ya, hitung lagi',
    cancel: 'Batal',
  },
  lastUsed: { today: 'Hari ini', daysAgo: ({ days }) => `${days} hari lalu`, never: 'Belum pernah' },
  memberStatus: { active: 'Aktif', pending: 'Menunggu', removed: 'Keluar' },
};

export const adminMembersMessages = defineMessages({ en, id });
