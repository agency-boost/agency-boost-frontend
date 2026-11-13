import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **One member** — `/people/members/[membershipId]`, the prototype's person modal as a page (P18.10-T4, people and
 * forum; `functional/org-hierarchy.md`, *Changing what somebody is*, *Removing somebody*): their details, their unit,
 * their tags, a role change, a removal, and who reports to them. **Since P19.12-T5** (ADR-0248 §1; the client's message
 * of 11 November 2026, item 9): one card *Posisi di tim* (*Peran · Ubah*, *Melapor ke · Ganti*, *Grup informal · Ubah*),
 * *Data pribadi* folded with *Lengkapi data*, and *Keluarkan dari KPM* last — the long explanations gone.
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

const en = {
  /** Said beside the refusal of a member the reader cannot see: the same as one who does not exist. */
  hidden: 'Someone outside what you can see reads the same as someone who does not exist — a distinct message would confirm they are here.',
  back: 'Back to the roster',
  loading: 'Loading the member…',
  /**
   * ***Data pribadi***, folded (P19.12-T5 AC-1, AC-2; ADR-0248 §1–§3): `missing` how many of the five a person records
   * are not, the summary's count; *Lengkapi data* opens a form of the blank ones only.
   */
  personalData: 'Personal data',
  missing: ({ n }: { n: number }) => `${n} not recorded`,
  whatsapp: 'WhatsApp number',
  complete: 'Complete details',
  completeTitle: ({ name }: { name: string }) => `Complete ${name}’s details`,
  completeLine: 'Only what is not recorded yet. What is recorded is theirs to change.',
  completeSave: 'Save',
  completed: 'Saved',
  fullName: 'Full name',
  email: 'Email',
  agentCode: 'Agent code',
  role: 'Role',
  reportsTo: 'Reports to',
  topOfTree: 'Nobody — top of the tree',
  /**
   * The two join dates, each said whose (OWN UI-025, ADR-0205 §4): `memberships.joinDate`, the office's, and
   * `users.companyJoinMonth`, the insurer's — `company` the office's company by name, *Prudential*.
   */
  joinDate: 'Joined AgencyBoost',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  companyJoinMonth: ({ company }: { company: string | null }) => (company ? `Joined ${company}` : 'Joined the company'),
  workStatus: 'Work status',
  /**
   * **The four tiles under the name** (OWN UI-020, OWN R4; ADR-0205 §1) and *See dashboard ›*. The source's words are
   * Indonesian (*Aktivitas 7 hari*, *Produksi tahun ini*, *1:1 terakhir*, *Leads*); these are the English.
   */
  tiles: {
    heading: 'How they are doing',
    loading: 'Loading how they are doing…',
    unavailable: 'How they are doing cannot be shown right now. The sections below are unaffected.',
    activity: 'Activity, last 7 days',
    production: 'Production this year',
    /** `pct` written in the reader's figures. */
    ofGoal: ({ pct }: { pct: string }) => `${pct}% of goal`,
    noGoal: 'No goal set',
    notUploaded: 'Not uploaded yet',
    lastOneOnOne: 'Last 1:1',
    never: 'Never',
    leads: 'Leads',
    closing: ({ n }: { n: string }) => `${n} closing`,
    seeDashboard: 'See dashboard',
  },
  /**
   * ***Posisi di tim*** (P19.12-T5 AC-1; ADR-0248 §1): the role, the leader and the informal groups, one line each with
   * its control — *Ubah* or *Ganti*, each named in full for a screen reader — and the unit in one line.
   */
  position: 'Position in the team',
  edit: 'Edit',
  change: 'Change',
  editRole: 'Edit role',
  changeLeader: 'Change leader',
  editGroups: 'Edit informal groups',
  /** *Unit*: whom they lead, in one line — `direct` their direct reports, `whole` everybody below them. */
  unit: kept('Unit'),
  unitLine: ({ direct, whole }: { direct: string; whole: string }) => `${direct} direct · ${whole} in the whole unit`,
  /** *Grup informal*: groups and *Core Leader* (ADR-0159). */
  informalGroups: 'Informal groups',
  editTags: 'Edit tags',
  retiredGroup: 'A group since retired',
  noTags: 'None',
  /** `where` the link to *All members › Groups*, its words kept. */
  noGroups: ({ where }: { where: ReactNode }) => <>No groups yet — create one on {where} first.</>,
  groups: 'Groups',
  /** Why the *Core Leader* box cannot be ticked, said only then (ADR-0159 §1). */
  coreLeaderOnlyLeaders: 'Only a leader can be a Core Leader.',
  saveTags: 'Save tags',
  saving: 'Saving…',
  cancel: 'Cancel',
  /** *Change their role* (P3.1-T13). */
  changeRole: 'Change their role',
  newRole: 'New role',
  noChange: ({ rung }: { rung: string }) => `${rung} — no change`,
  why: 'Why?',
  changeRoleButton: 'Change role',
  /** *Remove from the office* (P3-T7): nothing is deleted — the dialog's one line says so, the removal's consequence. */
  remove: 'Remove from the office',
  removeLine: 'Nothing is deleted. Their record and everything they logged stays with the office, on the Removed list.',
  removeName: ({ name }: { name: string }) => `Remove ${name}`,
  reportCount: ({ n }: { n: number }) => (n === 1 ? '1 person reports to them' : `${n} people report to them`),
  sayWhere: 'Say where they go.',
  moveUp: ({ to }: { to: string | null }) => `Move them up to ${to ?? 'their leader’s leader'}`,
  leaveUnassigned: 'Leave them unassigned, for another leader to pick up',
  /** `word` the one the server checks, *REMOVE*, the same in both languages. */
  typeToConfirm: ({ word }: { word: string }) => `Type ${word} to confirm`,
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
  personalData: 'Data pribadi',
  missing: ({ n }) => `${n} belum dicatat`,
  whatsapp: 'No. WhatsApp',
  complete: 'Lengkapi data',
  completeTitle: ({ name }) => `Lengkapi data ${name}`,
  completeLine: 'Hanya data yang belum dicatat. Data yang sudah tercatat hanya dapat diubah oleh dia sendiri.',
  completeSave: 'Simpan',
  completed: 'Tersimpan',
  fullName: 'Nama lengkap',
  email: 'Email',
  agentCode: 'Kode agen',
  role: 'Peran',
  reportsTo: 'Melapor ke',
  topOfTree: 'Tidak ada — puncak pohon',
  joinDate: 'Bergabung di AgencyBoost',
  dateOfBirth: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  companyJoinMonth: ({ company }) => (company ? `Bergabung di ${company}` : 'Bergabung di perusahaan'),
  workStatus: 'Status kerja',
  tiles: {
    heading: 'Kinerjanya',
    loading: 'Memuat kinerjanya…',
    unavailable: 'Kinerjanya tidak dapat ditampilkan saat ini. Bagian di bawah tidak terpengaruh.',
    activity: 'Aktivitas 7 hari',
    production: 'Produksi tahun ini',
    ofGoal: ({ pct }) => `${pct}% dari ${kept('goal')}`,
    noGoal: `${kept('Goal')} belum diatur`,
    notUploaded: 'Belum diunggah',
    lastOneOnOne: `${kept('1:1')} terakhir`,
    never: 'Belum pernah',
    leads: kept('Leads'),
    closing: ({ n }) => `${n} ${kept('closing')}`,
    seeDashboard: `Lihat ${kept('dashboard')}`,
  },
  position: 'Posisi di tim',
  edit: 'Ubah',
  change: 'Ganti',
  editRole: 'Ubah peran',
  changeLeader: `Ganti ${kept('leader')}`,
  editGroups: 'Ubah grup informal',
  unit: kept('Unit'),
  unitLine: ({ direct, whole }) => `${direct} langsung · ${whole} seluruh ${kept('unit')}`,
  informalGroups: 'Grup informal',
  editTags: 'Ubah tag',
  retiredGroup: 'Grup yang sudah dinonaktifkan',
  noTags: 'Tidak ada',
  noGroups: ({ where }) => <>Belum ada grup — buat dulu di {where}.</>,
  groups: 'Grup',
  coreLeaderOnlyLeaders: `Hanya seorang ${kept('leader')} yang dapat menjadi ${kept('Core Leader')}.`,
  saveTags: 'Simpan tag',
  saving: 'Menyimpan…',
  cancel: 'Batal',
  changeRole: 'Ubah perannya',
  newRole: 'Peran baru',
  noChange: ({ rung }) => `${rung} — tanpa perubahan`,
  why: 'Alasan',
  changeRoleButton: 'Ubah peran',
  remove: `Keluarkan dari ${kept('KPM')}`,
  removeLine: `Tidak ada yang dihapus. Datanya dan semua yang pernah dia catat tetap ada di ${kept('KPM')}, di daftar ${kept('Removed')}.`,
  removeName: ({ name }) => `Keluarkan ${name}`,
  reportCount: ({ n }) => `${n} orang melapor kepadanya`,
  sayWhere: 'Tentukan ke mana mereka pindah.',
  moveUp: ({ to }) => `Naikkan mereka ke ${to ?? `${kept('leader')} di atasnya`}`,
  leaveUnassigned: `Biarkan mereka belum ditempatkan, untuk diambil ${kept('leader')} lain`,
  typeToConfirm: ({ word }) => `Ketik ${word} untuk mengonfirmasi`,
  removeThem: 'Keluarkan dia',
  removing: 'Mengeluarkan…',
  reports: 'Yang melapor kepadanya',
  noReports: 'Tidak ada yang melapor kepadanya.',
  name: 'Nama',
  direct: ({ n }) => `${n} langsung`,
  noTeam: 'Tanpa tim',
};

export const memberMessages = defineMessages({ en, id });
