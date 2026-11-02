import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **All Members** — `/people/members`, the office's roster (P18.98-T4, people and forum; `functional/org-hierarchy.md`,
 * *The directory*, *Deciding*, *The role change log*, groups): its line, the filter, the roster as a table and as a
 * phone's cards, *Pending* with its approvals, *Removed*, *Role change log* and *Groups*.
 *
 * **English is the source**: the prototype's words where it draws them (`KPM_Owner.html:1822-1849`, `:4490-4522`) and
 * ours where it does not. The Indonesian is the approved glossary's (§B.1 to §B.5; *office* is *KPM*, §B.9), with what it
 * lacked in the glossary for approval's §B.10 — *Nonaktifkan* for retiring a group, *Pemilik* for a group's owner.
 * **Kept** (§A): the page's title and its five tabs (`kept('…')` where the page draws them), the roles, *Core Leader*,
 * *unit* and *leader*. *Pending* and *Removed* are tabs there and a status or a column here (`KEPT_ELSEWHERE`).
 * **Typed content stays as typed**: names, emails, agent codes, a group's name, a reason. **A figure is never a
 * message's**: a date is written by the caller in the figures' language and passed in.
 *
 * @moved app/(tenant)/people/members/page.tsx
 */

/** A run of words drawn bold. */
type Strong = (words: string) => ReactNode;

const en = {
  subtitle: 'Directory, pending requests, removed, and role history',
  /** The filter over the roster. */
  search: 'Search',
  searchExample: 'Name, email or agent code',
  role: 'Role',
  everyRole: 'Every role',
  /** *Role change log* (P3-T6 AC-4). */
  log: {
    caption: 'Role changes, newest first',
    columns: { when: 'When', who: 'Who', change: 'Change', why: 'Why', changedBy: 'Changed by' },
    empty: 'Nobody has changed role in this office yet.',
    /** The arrow between the two badges, for a screen reader. */
    became: 'became',
  },
  /** *Pending* (P3-T5): who registered and is in no unit yet, and the requests among them. */
  pending: {
    line: ({ strong }: { strong: Strong }) => (
      <>
        Approve or decline requests from agents asking to join your KPM. Approving adds them
        under {strong('the leader they asked for')}, not under you.
      </>
    ),
    caption: 'Registered, not yet in a unit',
    columns: { who: 'Who', waitingOn: 'Waiting on', actions: 'Actions' },
    empty: 'Everybody who has registered is in a unit.',
    aDecision: 'A decision',
    /** `date` the day it was asked, written. */
    asked: ({ date }: { date: ReactNode }) => <>Asked {date}</>,
    nobody: 'Nobody',
    noLeaderAsked: ({ strong }: { strong: Strong }) => (
      <>They have asked no leader — a leader can pick them up from {strong('Add new agents')}</>
    ),
    approve: 'Approve',
    decline: 'Decline',
  },
  /** *Groups* (P3-T9): the office's own labels. */
  groups: {
    line: ({ strong }: { strong: Strong }) => (
      <>
        Labels this office defines for its own organising — a mentoring circle, a task force.
        A group is {strong('not')} hierarchy and grants nobody access to anything.
      </>
    ),
    create: 'Create group',
    edit: 'Edit group',
    name: 'Group name',
    nameExample: 'New Agent Mentoring Circle',
    owner: 'Owner',
    ownerHint: 'Who runs it. Stored as their membership, so renaming them changes nothing.',
    chooseSomebody: 'Choose somebody',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    retireQuestion: ({ name }: { name: string }) => `Retire ${name}?`,
    /** `n` the people tagged into it. */
    retireLine: ({ n }: { n: number }) =>
      `It stops being offered and stops being counted. Nothing is deleted: ${n === 1 ? 'the person' : `all ${n} people`} tagged into it keep the tag, so who was in it stays readable.`,
    retire: 'Retire group',
    retiring: 'Retiring…',
    caption: 'Informal groups',
    columns: { group: 'Group', owner: 'Owner', tagged: 'Tagged', actions: 'Actions' },
    empty: 'No groups yet — create one to start organising people.',
    ownerLeft: 'No longer in this office — hand it to somebody else',
    people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
    editRow: 'Edit',
    retireRow: 'Retire',
  },
  /** The roster, *Directory* and *Removed*, as a table and as a phone's cards. */
  roster: {
    caption: 'Office roster',
    removedCaption: 'Removed members',
    loading: 'Loading the office roster…',
    loadingRemoved: 'Loading removed members…',
    columns: {
      name: 'Name',
      agentCode: 'Agent code',
      role: 'Role',
      reportsTo: 'Reports to',
      lastActivity: 'Last activity',
      lastCoached: 'Last coached',
      unit: kept('Unit'),
      removed: 'Removed',
      status: 'Status',
    },
    noMatch: 'Nobody matches that.',
    noneRemoved: 'Nobody has been removed from this office.',
    noMembers: 'This office has no members yet.',
    clearFilters: 'Clear the filters',
    /** A leader's row's Core Leader control (ADR-0159 §1): its name, and its tooltip. */
    untag: ({ name }: { name: string }) => `Remove the Core Leader tag from ${name}`,
    tag: ({ name }: { name: string }) => `Tag ${name} Core Leader`,
    untagTitle: 'Remove the Core Leader tag',
    tagTitle: 'Tag as Core Leader',
    /** *Unit*: whom a leader leads; *No team* for one who leads nobody (ADR-0176 §2). */
    unitCounts: ({ direct, unit }: { direct: number; unit: number }) => `${direct} direct · ${unit} in unit`,
    noTeam: 'No team',
    rejoined: 'Rejoined',
    /** `date` the day they came back, written. */
    rejoinedOn: ({ date }: { date: ReactNode }) => <>Rejoined {date}</>,
    previous: 'Previous',
    next: 'Next',
    shown: ({ n, more }: { n: number; more: boolean }) => `${n} shown${more ? ' · more to come' : ''}`,
  },
};

const id: MessagesOf<typeof en> = {
  subtitle: 'Direktori, permintaan yang menunggu, anggota yang dikeluarkan, dan riwayat peran',
  search: 'Cari',
  searchExample: 'Nama, email, atau kode agen',
  role: 'Peran',
  everyRole: 'Semua peran',
  log: {
    caption: 'Perubahan peran, terbaru dulu',
    columns: { when: 'Kapan', who: 'Siapa', change: 'Perubahan', why: 'Alasan', changedBy: 'Diubah oleh' },
    empty: `Belum ada yang berganti peran di ${kept('KPM')} ini.`,
    became: 'menjadi',
  },
  pending: {
    line: ({ strong }) => (
      <>
        Setujui atau tolak permintaan dari agen yang ingin bergabung ke {kept('KPM')} Anda. Menyetujui akan
        menempatkan mereka di bawah {strong(`${kept('leader')} yang mereka minta`)}, bukan di bawah Anda.
      </>
    ),
    caption: `Sudah mendaftar, belum masuk ${kept('unit')}`,
    columns: { who: 'Siapa', waitingOn: 'Menunggu', actions: 'Aksi' },
    empty: `Semua yang sudah mendaftar sudah masuk ${kept('unit')}.`,
    aDecision: 'Keputusan',
    asked: ({ date }) => <>Diajukan {date}</>,
    nobody: 'Tidak ada',
    noLeaderAsked: ({ strong }) => (
      <>
        Dia belum meminta {kept('leader')} mana pun — {kept('leader')} dapat mengambilnya dari {strong(kept('Add New Agents'))}
      </>
    ),
    approve: 'Setujui',
    decline: 'Tolak',
  },
  groups: {
    line: ({ strong }) => (
      <>
        Label yang ditetapkan {kept('KPM')} ini untuk pengaturannya sendiri — lingkar mentoring, tim khusus.
        Grup {strong('bukan')} hierarki dan tidak memberi siapa pun akses ke apa pun.
      </>
    ),
    create: 'Buat grup',
    edit: 'Ubah grup',
    name: 'Nama grup',
    nameExample: 'Lingkar Mentoring Agen Baru',
    owner: 'Pemilik',
    ownerHint: 'Orang yang menjalankannya. Disimpan sebagai keanggotaannya, jadi mengganti namanya tidak mengubah apa pun.',
    chooseSomebody: 'Pilih seseorang',
    save: 'Simpan',
    saving: 'Menyimpan…',
    cancel: 'Batal',
    retireQuestion: ({ name }) => `Nonaktifkan ${name}?`,
    retireLine: ({ n }) =>
      `Grup ini tidak lagi ditawarkan dan tidak lagi dihitung. Tidak ada yang dihapus: ${n === 1 ? 'orang' : `semua ${n} orang`} yang di-tag ke dalamnya tetap memiliki tag-nya, jadi siapa yang pernah ada di dalamnya tetap dapat dibaca.`,
    retire: 'Nonaktifkan grup',
    retiring: 'Menonaktifkan…',
    caption: 'Grup informal',
    columns: { group: 'Grup', owner: 'Pemilik', tagged: 'Di-tag', actions: 'Aksi' },
    empty: 'Belum ada grup — buat satu untuk mulai mengatur orang.',
    ownerLeft: `Sudah tidak di ${kept('KPM')} ini — serahkan kepada orang lain`,
    people: ({ n }) => `${n} orang`,
    editRow: 'Ubah',
    retireRow: 'Nonaktifkan',
  },
  roster: {
    caption: `Roster ${kept('KPM')}`,
    removedCaption: 'Anggota yang dikeluarkan',
    loading: `Memuat roster ${kept('KPM')}…`,
    loadingRemoved: 'Memuat anggota yang dikeluarkan…',
    columns: {
      name: 'Nama',
      agentCode: 'Kode agen',
      role: 'Peran',
      reportsTo: 'Melapor ke',
      lastActivity: 'Aktivitas terakhir',
      lastCoached: 'Coaching terakhir',
      unit: kept('Unit'),
      removed: 'Dikeluarkan',
      status: 'Status',
    },
    noMatch: 'Tidak ada yang cocok.',
    noneRemoved: `Belum ada yang dikeluarkan dari ${kept('KPM')} ini.`,
    noMembers: `${kept('KPM')} ini belum punya anggota.`,
    clearFilters: 'Hapus filter',
    untag: ({ name }) => `Hapus tag ${kept('Core Leader')} dari ${name}`,
    tag: ({ name }) => `Tag ${name} sebagai ${kept('Core Leader')}`,
    untagTitle: `Hapus tag ${kept('Core Leader')}`,
    tagTitle: `Tag sebagai ${kept('Core Leader')}`,
    unitCounts: ({ direct, unit }) => `${direct} langsung · ${unit} di ${kept('unit')}`,
    noTeam: 'Tanpa tim',
    rejoined: 'Bergabung kembali',
    rejoinedOn: ({ date }) => <>Bergabung kembali {date}</>,
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    shown: ({ n, more }) => `${n} ditampilkan${more ? ' · masih ada lagi' : ''}`,
  },
};

export const membersMessages = defineMessages({ en, id });
