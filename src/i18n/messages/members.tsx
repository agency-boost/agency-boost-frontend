import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **All members** — `/people/members`, the KPM's people (P19.20-T1; ADR-0273 §2; `functional/org-hierarchy.md`, *All
 * members*): the three tabs *Anggota (n) · Menunggu · Riwayat*, *Undang anggota*, the search and the filter, the roster as
 * a table and as a phone's rows, *Menunggu*'s two sections and *Riwayat*'s list.
 *
 * **The Indonesian is the source**: the approved People mockups of 19 November word for word (*Anggota*, *Menunggu*,
 * *Riwayat*, *Undang anggota*, *Cari nama atau kode agen*, *Semua · AB · AAB · Agent · ★ Core leader*, *Group*, *Melapor
 * ke*, *Aktivitas terakhir*, *Coaching terakhir*, *"4 langsung · 29 di unit"*, *Tanpa tim*, *Lihat semua (30)*,
 * *Permintaan pindah unit*, *terlama dulu · seluruh tim ikut pindah*, *Diajukan …*, *Sudah daftar, belum masuk unit*,
 * *Belum memilih leader · daftar …*, *Pilih leader*, *Tolak*, *Setujui*, *Perubahan peran*, *Dikeluarkan*, *Pindah unit*,
 * *Bergabung kembali*, *oleh …*). The English is ours. **Kept** (§A): the page's title, *KPM*, *AB*, *AAB*, *Agent*, *Core
 * leader*, *Group*, *Unit*, *Owner*, *Admin*. Typed content stays as typed; a figure is the caller's, written and passed in.
 *
 * @moved app/(tenant)/people/members/page.tsx
 */
const en = {
  tabs: { members: 'Members', waiting: 'Waiting', history: 'History' },
  invite: 'Invite a member',
  search: 'Search name or agent code',
  filters: 'Filter',
  all: 'All',
  coreLeaders: kept('Core leader'),
  caption: 'The KPM’s members',
  columns: {
    member: 'Member',
    group: kept('Group'),
    reportsTo: 'Reports to',
    lastActivity: 'Last activity',
    lastCoached: 'Last coaching',
    actions: 'Actions',
  },
  unitCounts: ({ direct, unit }: { direct: number; unit: number }) => `${direct} direct · ${unit} in unit`,
  noTeam: 'No team',
  seeAll: ({ n }: { n: number }) => `See all (${n})`,
  seeMore: 'See more',
  noMembers: 'This KPM has no members yet.',
  noMatch: 'Nobody matches.',
  clearFilters: 'Clear the filter',
  loading: 'Loading the members…',
  legend: '★ = core leader · red = never · yellow = more than 14 days · test accounts are not shown',
  // P19.29-T5 AC-1 (UI-215 (21 Nov)): a phone's row, one line — *Aktivitas: … · Coaching: …*.
  recency: { activity: 'Activity', coaching: kept('Coaching') },
  open: ({ name }: { name: string }) => `Open ${name}`,
  changeGroupOf: ({ name }: { name: string }) => `Change the group of ${name}`,
  /* Menunggu. */
  waiting: {
    movesTitle: 'Requests to move',
    movesNote: 'oldest first · the whole team moves',
    askedBy: ({ name }: { name: string }) => `Requested by ${name}`,
    move: ({ from, to }: { from: string | null; to: string }) => (from ? `moves from ${from} to ${to}` : `joins ${to}`),
    registeredTitle: 'Registered, not yet in a unit',
    notChosen: ({ ago }: { ago: string }) => `Has not chosen a leader · registered ${ago}`,
    askedLeader: ({ name, ago }: { name: string; ago: string }) => `Asked to join ${name}’s unit · registered ${ago}`,
    pickLeader: 'Choose a leader',
    pickTitle: ({ name }: { name: string }) => `Choose a leader for ${name}`,
    pickNote: 'They join the unit now, today their join date.',
    approve: 'Approve',
    decline: 'Decline',
    nothing: 'Nobody is waiting.',
    loading: 'Loading who is waiting…',
  },
  /* Riwayat. */
  history: {
    filters: { all: 'All', role: 'Role changes', removed: 'Removed', moved: 'Moved unit' },
    removed: 'Removed',
    moved: 'Moved unit',
    rejoined: 'Rejoined',
    by: ({ name }: { name: string }) => `by ${name}`,
    movedLine: ({ from, to }: { from: string; to: string }) => `moved from ${from} to ${to}`,
    empty: 'No history yet.',
    loading: 'Loading the history…',
    caption: 'History, newest first',
  },
};

const id: MessagesOf<typeof en> = {
  tabs: { members: 'Anggota', waiting: 'Menunggu', history: 'Riwayat' },
  invite: 'Undang anggota',
  search: 'Cari nama atau kode agen',
  filters: 'Saring',
  all: 'Semua',
  coreLeaders: kept('Core leader'),
  caption: `Anggota ${kept('KPM')}`,
  columns: {
    member: 'Anggota',
    group: kept('Group'),
    reportsTo: 'Melapor ke',
    lastActivity: 'Aktivitas terakhir',
    lastCoached: 'Coaching terakhir',
    actions: 'Tindakan',
  },
  unitCounts: ({ direct, unit }) => `${direct} langsung · ${unit} di ${kept('unit')}`,
  noTeam: 'Tanpa tim',
  seeAll: ({ n }) => `Lihat semua (${n})`,
  seeMore: 'Lihat lagi',
  noMembers: `${kept('KPM')} ini belum punya anggota.`,
  noMatch: 'Tidak ada yang cocok.',
  clearFilters: 'Hapus filter',
  loading: 'Memuat anggota…',
  legend: '★ = core leader · merah = belum pernah · kuning = lebih dari 14 hari · akun tes tidak ditampilkan',
  recency: { activity: 'Aktivitas', coaching: kept('Coaching') },
  open: ({ name }) => `Buka ${name}`,
  changeGroupOf: ({ name }) => `Ubah group ${name}`,
  waiting: {
    movesTitle: 'Permintaan pindah unit',
    movesNote: 'terlama dulu · seluruh tim ikut pindah',
    askedBy: ({ name }) => `Diajukan ${name}`,
    move: ({ from, to }) => (from ? `pindah dari ${from} ke ${to}` : `masuk ke ${to}`),
    registeredTitle: 'Sudah daftar, belum masuk unit',
    notChosen: ({ ago }) => `Belum memilih leader · daftar ${ago}`,
    askedLeader: ({ name, ago }) => `Meminta masuk unit ${name} · daftar ${ago}`,
    pickLeader: 'Pilih leader',
    pickTitle: ({ name }) => `Pilih leader untuk ${name}`,
    pickNote: 'Dia masuk ke unit itu sekarang; hari ini tanggal bergabungnya.',
    approve: 'Setujui',
    decline: 'Tolak',
    nothing: 'Tidak ada yang menunggu.',
    loading: 'Memuat yang menunggu…',
  },
  history: {
    filters: { all: 'Semua', role: 'Perubahan peran', removed: 'Dikeluarkan', moved: 'Pindah unit' },
    removed: 'Dikeluarkan',
    moved: 'Pindah unit',
    rejoined: 'Bergabung kembali',
    by: ({ name }) => `oleh ${name}`,
    movedLine: ({ from, to }) => `pindah dari ${from} ke ${to}`,
    empty: 'Belum ada riwayat.',
    loading: 'Memuat riwayat…',
    caption: 'Riwayat, terbaru dulu',
  },
};

export const membersMessages = defineMessages({ en, id });
