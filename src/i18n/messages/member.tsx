import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **One member** — `/people/members/[membershipId]`, the prototype's person modal as a page (P18.98-T4, people and
 * forum; `functional/org-hierarchy.md`, *Changing what somebody is*, *Removing somebody*): their details, their unit,
 * their tags, a role change, a removal, and who reports to them.
 *
 * **English is the source.** The Indonesian is the approved glossary's (§B.1 to §B.5; *office* is *KPM*, §B.9), with
 * *Keluarkan* for removing somebody from the office — §B.3's *Dikeluarkan*, never *Hapus*, since nothing is deleted
 * (§B.10). A person is *dia* whatever their pronoun (§B.0 rule 8). **Kept** (§A): the page's title *Member*, the roles,
 * *Core Leader*, *Strategic Leader Forum*, *KPM analytics*, *unit*, *leader*, *downline*. **Typed content stays as
 * typed**: a name, an email, an agent code, a group's name, a reason; *REMOVE*, the word the server checks, in both.
 * The four a person records are written by `lib/personal.ts`, the profile's.
 *
 * @moved app/(tenant)/people/members/[membershipId]/page.tsx
 */

/** A run of words drawn bold, or as a link. */
type Wrap = (words: ReactNode) => ReactNode;

const en = {
  /** Said beside the refusal of a member the reader cannot see: the same as one who does not exist. */
  hidden: 'Someone outside what you can see reads the same as someone who does not exist — a distinct message would confirm they are here.',
  back: 'Back to the roster',
  loading: 'Loading the member…',
  /** *Personal*: the person's details. */
  personal: 'Personal',
  fullName: 'Full name',
  email: 'Email',
  agentCode: 'Agent code',
  role: 'Role',
  reportsTo: 'Reports to',
  topOfTree: 'Nobody — top of the tree',
  joinDate: 'Join date',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  companyJoinMonth: 'Company join month',
  workStatus: 'Work status',
  /** *Unit*: whom they lead. */
  unit: kept('Unit'),
  directReports: 'Direct reports',
  wholeUnit: 'Whole unit',
  depth: 'Depth',
  belowRoot: ({ n }: { n: number }) => `${n} below the root`,
  /** One who leads nobody: `rung` their badge's name. */
  leadsNobody: ({ rung }: { rung: string }) =>
    `${rung}, and leads nobody. Leadership follows the tree rather than the role — an ${rung} with no direct reports has no unit, and the surfaces that need one stay closed until they do.`,
  /** *Tags*: groups and *Core Leader* (ADR-0159). */
  tags: 'Tags',
  tagsLine: ({ strong }: { strong: Wrap }) => (
    <>
      Groups are labels this office defines for its own organising. A group is {strong('not')} hierarchy: it changes
      nothing about who reports to whom, and grants nobody access to anything.
    </>
  ),
  editTags: 'Edit tags',
  retiredGroup: 'A group since retired',
  noTags: 'No tags.',
  /** `where` the link to *All members › Groups*, its words kept. */
  noGroups: ({ where }: { where: ReactNode }) => <>No groups yet — create one on {where} first.</>,
  groups: 'Groups',
  coreLeaderLine: ({ notALeader }: { notALeader: boolean }) =>
    `A Core Leader opens the Strategic Leader Forum's meetings and reads the office's KPM analytics, besides the Owner and the Admins. It is not a role, and it grants no hierarchy and no unit. ${notALeader
      ? 'Only a leader can be one: move them to a leader rung first. A tag kept from before has no effect until they lead again.'
      : 'Only a leader can be one.'}`,
  saveTags: 'Save tags',
  saving: 'Saving…',
  cancel: 'Cancel',
  /** *Change their role* (P3.5-T13). */
  changeRole: 'Change their role',
  newRole: 'New role',
  /** `ab` the AB rung's badge name. */
  onlyOfficeMakesAb: ({ ab }: { ab: string }) => `Only the office can make somebody an ${ab}, or stop them being one.`,
  noChange: ({ rung }: { rung: string }) => `${rung} — no change`,
  why: 'Why?',
  whyRole: 'Optional, and worth writing: this is what the role change log shows months later.',
  changeRoleButton: 'Change role',
  /** *Remove from the office* (P3-T7): nothing is deleted. */
  remove: 'Remove from the office',
  removeLine: 'Nothing is deleted. Their record and everything they logged stays with the office, on the Removed list.',
  removeName: ({ name }: { name: string }) => `Remove ${name}`,
  reportCount: ({ n }: { n: number }) => (n === 1 ? '1 person reports to them' : `${n} people report to them`),
  sayWhere: 'Say where they go.',
  moveUp: ({ to }: { to: string | null }) => `Move them up to ${to ?? 'their leader’s leader'}`,
  leaveUnassigned: 'Leave them unassigned, for another leader to pick up',
  whyRemove: 'Kept on their record, and sent to them.',
  /** `word` the one the server checks, *REMOVE*, the same in both languages. */
  typeToConfirm: ({ word }: { word: string }) => `Type ${word} to confirm`,
  confirmHint: 'The server checks this too. A confirmation only the screen enforces is not a confirmation.',
  removeThem: 'Remove them',
  removing: 'Removing…',
  /** *Who reports to them*. */
  reports: 'Who reports to them',
  noReports: 'Nobody reports to them.',
  name: 'Name',
  direct: ({ n }: { n: number }) => `${n} direct`,
  noTeam: 'No team',
};

const id: MessagesOf<typeof en> = {
  hidden: 'Orang di luar yang dapat Anda lihat tampak sama seperti orang yang tidak ada — pesan yang berbeda akan memastikan bahwa dia ada di sini.',
  back: 'Kembali ke roster',
  loading: 'Memuat anggota…',
  personal: 'Pribadi',
  fullName: 'Nama lengkap',
  email: 'Email',
  agentCode: 'Kode agen',
  role: 'Peran',
  reportsTo: 'Melapor ke',
  topOfTree: 'Tidak ada — puncak pohon',
  joinDate: 'Tanggal bergabung',
  dateOfBirth: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  companyJoinMonth: 'Bulan bergabung di perusahaan',
  workStatus: 'Status kerja',
  unit: kept('Unit'),
  directReports: 'Bawahan langsung',
  wholeUnit: `Seluruh ${kept('unit')}`,
  depth: 'Kedalaman',
  belowRoot: ({ n }) => `${n} di bawah puncak`,
  leadsNobody: ({ rung }) =>
    `${rung}, dan tidak memimpin siapa pun. Kepemimpinan mengikuti pohon, bukan peran — ${rung} tanpa bawahan langsung tidak punya ${kept('unit')}, dan bagian yang memerlukannya tetap tertutup sampai dia punya.`,
  tags: 'Tag',
  tagsLine: ({ strong }) => (
    <>
      Grup adalah label yang ditetapkan {kept('KPM')} ini untuk pengaturannya sendiri. Grup {strong('bukan')} hierarki:
      grup tidak mengubah siapa melapor kepada siapa, dan tidak memberi siapa pun akses ke apa pun.
    </>
  ),
  editTags: 'Ubah tag',
  retiredGroup: 'Grup yang sudah dinonaktifkan',
  noTags: 'Tidak ada tag.',
  noGroups: ({ where }) => <>Belum ada grup — buat dulu di {where}.</>,
  groups: 'Grup',
  coreLeaderLine: ({ notALeader }) =>
    `${kept('Core Leader')} membuka rapat ${kept('Strategic Leader Forum')} dan membaca ${kept('KPM analytics')}, selain ${kept('Owner')} dan para ${kept('Admin')}. Ini bukan peran, dan tidak memberi hierarki maupun ${kept('unit')}. ${notALeader
      ? `Hanya seorang ${kept('leader')} yang dapat menjadi ${kept('Core Leader')}: pindahkan dia ke jenjang ${kept('leader')} dulu. Tag yang tersimpan dari sebelumnya tidak berlaku sampai dia memimpin lagi.`
      : `Hanya seorang ${kept('leader')} yang dapat menjadi ${kept('Core Leader')}.`}`,
  saveTags: 'Simpan tag',
  saving: 'Menyimpan…',
  cancel: 'Batal',
  changeRole: 'Ubah perannya',
  newRole: 'Peran baru',
  onlyOfficeMakesAb: ({ ab }) => `Hanya ${kept('KPM')} yang dapat menjadikan seseorang ${ab}, atau mencabutnya.`,
  noChange: ({ rung }) => `${rung} — tanpa perubahan`,
  why: 'Alasan',
  whyRole: `Opsional, tetapi sebaiknya ditulis: inilah yang ditampilkan ${kept('Role change log')} berbulan-bulan kemudian.`,
  changeRoleButton: 'Ubah peran',
  remove: `Keluarkan dari ${kept('KPM')}`,
  removeLine: `Tidak ada yang dihapus. Datanya dan semua yang pernah dia catat tetap ada di ${kept('KPM')}, di daftar ${kept('Removed')}.`,
  removeName: ({ name }) => `Keluarkan ${name}`,
  reportCount: ({ n }) => `${n} orang melapor kepadanya`,
  sayWhere: 'Tentukan ke mana mereka pindah.',
  moveUp: ({ to }) => `Naikkan mereka ke ${to ?? `${kept('leader')} di atasnya`}`,
  leaveUnassigned: `Biarkan mereka belum ditempatkan, untuk diambil ${kept('leader')} lain`,
  whyRemove: 'Disimpan di datanya, dan dikirim kepadanya.',
  typeToConfirm: ({ word }) => `Ketik ${word} untuk mengonfirmasi`,
  confirmHint: 'Server juga memeriksanya. Konfirmasi yang hanya diperiksa di layar bukanlah konfirmasi.',
  removeThem: 'Keluarkan dia',
  removing: 'Mengeluarkan…',
  reports: 'Yang melapor kepadanya',
  noReports: 'Tidak ada yang melapor kepadanya.',
  name: 'Nama',
  direct: ({ n }) => `${n} langsung`,
  noTeam: 'Tanpa tim',
};

export const memberMessages = defineMessages({ en, id });
