import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Leads Management's own words** (P18.98-T4, field selling; `functional/leads.md`): `/leads`, the leads table the
 * coaching session's *Leads* card mounts too (`components/leads-table.tsx`) — its columns, its cards and the phone's
 * edit sheet, its search and filters, its ⋮ menu, its questions and toasts, the closed cards — the lead's details
 * dialog (`components/lead-details-dialog.tsx`), and `lib/leads.ts`' attention flags and why the 📞 and WhatsApp are
 * held, which Personal Summary's *Leads that need you* reads too.
 *
 * **English is the source** of the keys, the prototype's words as built (`Overall.html:2787-2846`, `:5432-5707`, the
 * coaching card's `:10809-10901`); the Indonesian is the approved glossary's (OD-237; §B.0's voice), with the words it
 * lacked added to the glossary for approval's §B.10. **Kept English** (§A): the title, *lead* / *leads* in their English
 * plural (§B.0 rule 8), *follow up*, *closing*, *pipeline*, *recruitment*, and the two types' names — *Sales* (§A.3) and
 * *Recruit* (ADR-0161 §2's short form of *Recruitment*, for approval). *Office* is *KPM* in ID mode (§B.9), a person is
 * *dia*, the reader *Anda*. **Content is shown as typed** (ADR-0179 §5): a lead's name, its remarks and notes, where it
 * came from, and the office's stages. **A message never writes a figure**: a day is written by the caller in the
 * figures' language and handed in; a count of leads or days is the server's, the same digits in both languages.
 *
 * @moved lib/leads.ts
 * @moved components/leads-table.tsx
 * @moved components/lead-details-dialog.tsx
 * @moved app/(agent)/leads/page.tsx
 */
const en = {
  /** The page (`Overall.html:2787-2790`). */
  title: kept('Leads Management'),
  subtitle: 'Track and follow up on your sales and recruitment leads.',

  /** The table's accessible name, and the card list's, where the caller gives none. */
  yourLeads: 'Your leads',
  /** The table's wait, named for the list: *Loading your leads…*. */
  loadingList: ({ caption }: { caption: string }) => `Loading ${caption.toLowerCase()}…`,
  /** The columns (`Overall.html:2805-2813`); *Row* is said, not drawn. */
  columns: {
    row: 'Row',
    name: 'Lead name',
    type: 'Type',
    status: 'Status',
    thisMonth: 'This month',
    remarks: 'Remarks',
    nextAction: 'Next action',
    actions: 'Actions',
  },
  /** A control named for its row: *Lead name, row 3*. */
  inRow: ({ label, n }: { label: string; n: number }) => `${label}, row ${n}`,
  /**
   * The card layout's sort, each order said in words (P18.95-T4 AC-4): what the order does, not which way a key runs.
   */
  sort: {
    label: 'Sort leads',
    saved: 'Saved order',
    nameAsc: 'Name A–Z',
    nameDesc: 'Name Z–A',
    typeAsc: 'Sales first',
    typeDesc: 'Recruit first',
    statusAsc: 'Earliest stage first',
    statusDesc: 'Furthest stage first',
  },
  /** *Recruit*, not *Recruitment*, wherever a lead's type is named (ADR-0161 §2). */
  types: {
    sales: kept('Sales'),
    recruitment: kept('Recruit'),
  },
  /** The coaching card's words for the two outcomes (`Overall.html:10867-10881`). */
  outcomes: {
    won: 'Won',
    lost: 'Lost',
  },

  /** A name too short to post, said beneath it: the server's rule in the reader's words. */
  shortName: ({ min }: { min: number }) => `A lead’s name must be at least ${min} characters.`,
  /** The coaching card's words for a name not given at all (`Overall.html:10894`). */
  noName: 'Enter a name first.',
  namePlaceholder: 'First Last',
  selectType: 'Select type',
  selectStatus: 'Select status',
  selectTypeFirst: 'Select type first',
  /** A stage the office has since retired: its code, which is what the lead holds. */
  retired: ({ code }: { code: string }) => `${code} (retired)`,
  /** The promise beside the box, which says which of the two it is (`.month-check-wrap`). */
  closeThisMonth: 'Close this month',
  recruitThisMonth: 'Recruit this month',
  nextActionDate: 'Next action date',
  nextActionNote: 'Next action note',
  /** A lead with no name yet, and the inline row before it is one. */
  thisLead: 'this lead',
  theNewLead: 'the new lead',
  /** WhatsApp and 📞 beside the ⋮, named for the lead (P18.8-T7 AC-5, P18.95-T4 AC-3). */
  whatsapp: 'WhatsApp',
  chatOpens: ({ who }: { who: string }) => `Chat with ${who} on WhatsApp (opens in a new tab)`,
  chat: ({ who }: { who: string }) => `Chat with ${who} on WhatsApp`,
  call: 'Call',
  callWho: ({ who }: { who: string }) => `Call ${who}`,
  actionsFor: ({ who }: { who: string }) => `Actions for ${who}`,

  /** The ⋮ menu (P13.1-T4 AC-3). */
  menu: {
    details: 'Lead details',
    markWon: 'Mark successful',
    wonHeld: 'Available once status reaches the final stage',
    markLost: 'Mark not successful',
    delete: 'Delete',
    deleteHeld: 'Only the person who owns this lead can delete it.',
  },
  /** *Last changed by {name}* (ADR-0044), in the details: a name the payload no longer has, said without *office* in a session. */
  editedBy: ({ name }: { name: string }) => `Last changed by ${name}`,
  someoneElse: 'someone else',
  someoneInYourOffice: 'someone in your office',

  /** A phone's card and its edit sheet (P18.95-T4 AC-1). */
  editNew: 'Edit the new lead',
  editWho: ({ who }: { who: string }) => `Edit ${who}`,
  newLead: 'New lead',
  noType: 'No type yet',
  close: 'Close',

  /** The empty list: the coaching card has one line whatever narrowed it (`Overall.html:10815`). */
  noneMatch: 'No leads match.',
  noneYet: 'No leads yet — add your first one above.',

  /** `/leads`' search and filters (P18.95-T4 AC-2), the coaching card's own words (`Overall.html:4258-4266`). */
  searchAndFilter: 'Search and filter leads',
  search: 'Search leads',
  searchPlaceholder: 'Search leads…',
  byType: 'Filter by type',
  allTypes: 'All types',
  byStatus: 'Filter by status',
  allStatuses: 'All statuses',
  add: '+ Add lead',
  /** The toolbar's count (`Overall.html:2791`); narrowed, what matched. */
  count: ({ n, narrowed }: { n: number; narrowed: boolean }) =>
    `${n} active lead${n === 1 ? '' : 's'}${narrowed ? (n === 1 ? ' matches' : ' match') : ''}`,
  showMore: 'Show more',

  /** The prototype's own questions (`Overall.html:5666-5675`), each naming what its button does (F-72). */
  confirm: {
    /** In a session, the coaching card's own (`Overall.html:10867-10870`). */
    asOutcome: ({ outcome, who }: { outcome: string; who: string }) =>
      `Mark as ${outcome}? ${who} will move to Closed leads as "${outcome}". You can still find them there afterward.`,
    thisLeadCapital: 'This lead',
    won: ({ who }: { who: string }) => `Mark ${who} as a successful lead?`,
    lost: ({ who }: { who: string }) => `Mark ${who} as not successful? This moves them to the closed list.`,
    markAs: ({ outcome }: { outcome: string }) => `Mark as ${outcome}`,
    /** *Delete {name}?* — without *permanently*, which would be false (I-101). */
    delete: ({ who }: { who: string }) => `Delete ${who}?`,
    deleteLead: 'Delete lead',
    type: 'Changing the type clears this lead’s stage and its commitment for this month. The two ladders share no '
      + 'stage. Continue?',
    changeType: 'Change the type',
  },
  /** The prototype's toasts after a write lands (`Overall.html:10835-10901`). */
  notices: {
    movedTo: ({ name, type }: { name: string; type: string }) => `${name} moved to ${type}.`,
    statusTo: ({ name, stage }: { name: string; stage: string }) => `${name}'s status updated to "${stage}".`,
    added: ({ name }: { name: string }) => `${name} added.`,
    markedAs: ({ name, outcome }: { name: string; outcome: string }) => `${name} marked as ${outcome}.`,
  },

  /** The two closed cards (`Overall.html:2824-2842`). */
  closed: {
    title: 'Closed leads',
    won: '✓ Successful',
    lost: '✕ Not successful',
    noneWon: 'No successful leads yet.',
    noneLost: 'No lost leads yet.',
    loadingWon: 'Loading successful leads…',
    loadingLost: 'Loading lost leads…',
    unnamed: '(unnamed)',
    reopen: '↺ Move to active',
    partial: ({ shown, total }: { shown: number; total: number }) =>
      `Showing ${shown} of ${total} — the rest did not load.`,
  },

  /** The lead's details (P13.1-T4 AC-2, ADR-0108 §2). */
  details: {
    title: ({ who }: { who: string }) => `Lead details for ${who}`,
    phone: 'Phone',
    email: 'Email',
    source: 'Where they came from',
    sourcePlaceholder: 'e.g. Referral from Desi',
    /** *Registered 4 Sep 2026*: the day written by the caller, in its `<time>`. */
    registered: ({ day }: { day: ReactNode }) => <>Registered {day}</>,
  },

  /** What each attention flag is called on screen (`lib/leads.ts`' `FLAG_LABEL`): one place, so two screens agree. */
  flags: {
    overdue: 'Overdue',
    noNextAction: 'No next action',
    noRemarks: 'No remarks',
    /** *Overdue 14 days* (`leads-management.md` §4): the server's count, in the office's days. */
    overdueDays: ({ days }: { days: number }) => `Overdue ${days} ${days === 1 ? 'day' : 'days'}`,
  },
  /** Why the 📞 and WhatsApp are held on a lead, and where to put it right (P18.95-T4 AC-3). */
  phoneHeld: {
    missing: 'No phone number yet — add one in Lead details.',
    unusable: 'This number can’t be dialled — check it in Lead details.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Leads Management'),
  subtitle: `Pantau dan ${kept('follow up')} ${kept('leads')} sales dan ${kept('recruitment')} Anda.`,

  yourLeads: `${kept('Leads')} Anda`,
  loadingList: ({ caption }) => `Memuat ${caption.charAt(0).toLowerCase()}${caption.slice(1)}…`,
  columns: {
    row: 'Baris',
    name: `Nama ${kept('lead')}`,
    type: 'Jenis',
    status: 'Status',
    thisMonth: 'Bulan ini',
    remarks: 'Keterangan',
    nextAction: 'Tindakan berikutnya',
    actions: 'Aksi',
  },
  inRow: ({ label, n }) => `${label}, baris ${n}`,
  sort: {
    label: `Urutkan ${kept('leads')}`,
    saved: 'Urutan tersimpan',
    nameAsc: 'Nama A–Z',
    nameDesc: 'Nama Z–A',
    typeAsc: `${kept('Sales')} lebih dulu`,
    typeDesc: `${kept('Recruit')} lebih dulu`,
    statusAsc: 'Tahap paling awal lebih dulu',
    statusDesc: 'Tahap paling jauh lebih dulu',
  },
  types: {
    sales: kept('Sales'),
    recruitment: kept('Recruit'),
  },
  outcomes: {
    won: 'Berhasil',
    lost: 'Tidak berhasil',
  },

  shortName: ({ min }) => `Nama ${kept('lead')} minimal ${min} karakter.`,
  noName: 'Masukkan nama terlebih dahulu.',
  namePlaceholder: 'Nama lengkap',
  selectType: 'Pilih jenis',
  selectStatus: 'Pilih status',
  selectTypeFirst: 'Pilih jenis terlebih dahulu',
  retired: ({ code }) => `${code} (diarsipkan)`,
  closeThisMonth: `${kept('Closing')} bulan ini`,
  recruitThisMonth: 'Rekrut bulan ini',
  nextActionDate: 'Tanggal tindakan berikutnya',
  nextActionNote: 'Catatan tindakan berikutnya',
  thisLead: `${kept('lead')} ini`,
  theNewLead: `${kept('lead')} baru`,
  whatsapp: 'WhatsApp',
  chatOpens: ({ who }) => `Kirim pesan WhatsApp ke ${who} (terbuka di tab baru)`,
  chat: ({ who }) => `Kirim pesan WhatsApp ke ${who}`,
  call: 'Telepon',
  callWho: ({ who }) => `Telepon ${who}`,
  actionsFor: ({ who }) => `Aksi untuk ${who}`,

  menu: {
    details: `Detail ${kept('lead')}`,
    markWon: 'Tandai berhasil',
    wonHeld: 'Tersedia setelah status mencapai tahap akhir',
    markLost: 'Tandai tidak berhasil',
    delete: 'Hapus',
    deleteHeld: `Hanya pemilik ${kept('lead')} ini yang dapat menghapusnya.`,
  },
  editedBy: ({ name }) => `Terakhir diubah oleh ${name}`,
  someoneElse: 'orang lain',
  someoneInYourOffice: `seseorang di ${kept('KPM')} Anda`,

  editNew: `Ubah ${kept('lead')} baru`,
  editWho: ({ who }) => `Ubah ${who}`,
  newLead: `${kept('Lead')} baru`,
  noType: 'Belum ada jenis',
  close: 'Tutup',

  noneMatch: `Tidak ada ${kept('leads')} yang cocok.`,
  noneYet: `Belum ada ${kept('leads')} — tambahkan yang pertama di atas.`,

  searchAndFilter: `Cari dan filter ${kept('leads')}`,
  search: `Cari ${kept('leads')}`,
  searchPlaceholder: `Cari ${kept('leads')}…`,
  byType: 'Filter menurut jenis',
  allTypes: 'Semua jenis',
  byStatus: 'Filter menurut status',
  allStatuses: 'Semua status',
  add: `+ Tambah ${kept('lead')}`,
  // A kept noun keeps its English plural (§B.0 rule 8): *1 lead aktif*, *3 leads aktif*.
  count: ({ n, narrowed }) =>
    `${n} ${n === 1 ? kept('lead') : kept('leads')} aktif${narrowed ? ' yang cocok' : ''}`,
  showMore: 'Tampilkan lebih banyak',

  confirm: {
    asOutcome: ({ outcome, who }) =>
      `Tandai sebagai ${outcome}? ${who} akan dipindahkan ke ${kept('Leads')} yang ditutup sebagai "${outcome}". Anda `
      + 'masih dapat menemukannya di sana setelahnya.',
    thisLeadCapital: `${kept('Lead')} ini`,
    won: ({ who }) => `Tandai ${who} sebagai ${kept('lead')} yang berhasil?`,
    lost: ({ who }) => `Tandai ${who} sebagai tidak berhasil? Ini memindahkannya ke daftar yang ditutup.`,
    markAs: ({ outcome }) => `Tandai sebagai ${outcome}`,
    delete: ({ who }) => `Hapus ${who}?`,
    deleteLead: `Hapus ${kept('lead')}`,
    type: `Mengubah jenis akan menghapus tahap ${kept('lead')} ini dan komitmennya untuk bulan ini. Kedua `
      + `${kept('pipeline')} tidak memiliki tahap yang sama. Lanjutkan?`,
    changeType: 'Ubah jenis',
  },
  notices: {
    movedTo: ({ name, type }) => `${name} dipindahkan ke ${type}.`,
    statusTo: ({ name, stage }) => `Status ${name} diperbarui menjadi "${stage}".`,
    added: ({ name }) => `${name} ditambahkan.`,
    markedAs: ({ name, outcome }) => `${name} ditandai sebagai ${outcome}.`,
  },

  closed: {
    title: `${kept('Leads')} yang ditutup`,
    won: '✓ Berhasil',
    lost: '✕ Tidak berhasil',
    noneWon: `Belum ada ${kept('leads')} yang berhasil.`,
    noneLost: `Belum ada ${kept('leads')} yang tidak berhasil.`,
    loadingWon: `Memuat ${kept('leads')} yang berhasil…`,
    loadingLost: `Memuat ${kept('leads')} yang tidak berhasil…`,
    unnamed: '(tanpa nama)',
    reopen: '↺ Pindahkan ke aktif',
    partial: ({ shown, total }) => `Menampilkan ${shown} dari ${total} — sisanya tidak termuat.`,
  },

  details: {
    title: ({ who }) => `Detail ${kept('lead')} untuk ${who}`,
    phone: 'Telepon',
    email: 'Email',
    source: `Sumber ${kept('lead')}`,
    sourcePlaceholder: 'mis. Referensi dari Desi',
    registered: ({ day }) => <>Terdaftar {day}</>,
  },

  flags: {
    overdue: 'Terlambat',
    noNextAction: 'Tanpa tindakan berikutnya',
    noRemarks: 'Tanpa keterangan',
    overdueDays: ({ days }) => `Terlambat ${days} hari`,
  },
  phoneHeld: {
    missing: `Belum ada nomor telepon — tambahkan di Detail ${kept('lead')}.`,
    unusable: `Nomor ini tidak dapat dihubungi — periksa di Detail ${kept('lead')}.`,
  },
};

export const leadsMessages = defineMessages({ en, id });
