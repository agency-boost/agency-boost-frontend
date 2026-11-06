import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Leads Management's own words** (P18.10-T4, field selling; `functional/leads.md`): `/leads`, the leads table the
 * coaching session's *Leads* card mounts too (`components/leads-table.tsx`) — its columns, its cards and the phone's
 * edit sheet, its search and filters, its ⋮ menu, its questions and toasts, the closed cards — the lead's details
 * dialog (`components/lead-details-dialog.tsx`), and why `lib/leads.ts` holds the 📞 and WhatsApp. The attention flags'
 * words are their own area's (`lead-flags.ts`), which Personal Summary's *Leads that need you* reads without this one.
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
 * @moved components/client-age-gender.tsx
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
   * The card layout's sort, each order said in words (P18.7-T4 AC-4): what the order does, not which way a key runs.
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
  /** WhatsApp and 📞 beside the ⋮, named for the lead (P18.5-T7 AC-5, P18.7-T4 AC-3). */
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
    /**
     * Why *Mark successful* is held (UI-160 item 3; ADR-0194 §3): the office's own name for its final stage — *Polis paid
     * and issued* at one office, *Dibayar dan diterbitkan* at another — is content, shown as the office typed it.
     */
    wonHeld: ({ stage }: { stage: string }) => `Active after status ${stage}`,
    markLost: 'Mark not successful',
    /** Why *Mark not successful* is held at the final stage (UI-160 item 2; ADR-0194 §2), by the lead's type. */
    lostHeld: { sales: 'Policy already paid and issued', recruitment: 'The candidate has joined' },
    delete: 'Delete',
    deleteHeld: 'Only the person who owns this lead can delete it.',
  },

  /**
   * **The *Potensi* switch and the avatar's badge** (P19.1-T2; UI-153 items 1, 2 and 5; Q-3; ADR-0193 §1): the same saved
   * field as the old *Close / Recruit this month*, labelled by the lead's type. The badges are named, since the yellow and
   * the green differ too little to be told apart by colour (1.4.1); each name is its tooltip too.
   */
  potensi: {
    sales: 'Potential closing this month',
    recruitment: 'Potential recruit this month',
    badge: 'Potential this month',
    badgeWon: 'Potential this month, closed',
  },
  /** *Last changed by {name}* (ADR-0044), in the details: a name the payload no longer has, said without *office* in a session. */
  editedBy: ({ name }: { name: string }) => `Last changed by ${name}`,
  someoneElse: 'someone else',
  someoneInYourOffice: 'someone in your office',

  /** A phone's card and its edit sheet (P18.7-T4 AC-1). */
  editNew: 'Edit the new lead',
  editWho: ({ who }: { who: string }) => `Edit ${who}`,
  newLead: 'New lead',
  noType: 'No type yet',
  close: 'Close',

  /** The empty list: the coaching card has one line whatever narrowed it (`Overall.html:10815`). */
  noneMatch: 'No leads match.',
  noneYet: 'No leads yet — add your first one above.',

  /** `/leads`' search and filters (P18.7-T4 AC-2), the coaching card's own words (`Overall.html:4258-4266`). */
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

  /*
   * *The attention flags' words are `messages/lead-flags.ts`'s since 2026-11-06* (the bundle): Personal Summary draws
   * them, and loading this area for three words put all of Leads Management's in its first load.
   */
  /** Why the 📞 and WhatsApp are held on a lead, and where to put it right (P18.7-T4 AC-3). */
  phoneHeld: {
    missing: 'No phone number yet — add one in Lead details.',
    unusable: 'This number can’t be dialled — check it in Lead details.',
  },

  /**
   * **`/leads` below 1024px: the compact list** (UI V1, UI-105; D-10, D-18). The report's words in Indonesian; the
   * English is the glossary for approval's §B.10 (*Phase 18.11 T12*).
   */
  list: {
    /** The title row's title on a phone and a tablet (UI-004: *"Leads" + avatar*). */
    title: kept('Leads'),
    search: 'Search lead names',
    filter: 'Filter and sort',
    filterOn: 'Filter and sort, a filter is on',
    chips: 'Lead type',
    all: 'All',
    /** A chip's name with its count, as a screen reader hears it: *Sales, 58 leads*. */
    chipSaid: ({ label, n }: { label: string; n: number }) => `${label}, ${n} ${n === 1 ? kept('lead') : kept('leads')}`,
    /** The strip's name, and each cell's: *Follow-up, 18 leads*. */
    pipeline: ({ type }: { type: string }) => `${type} pipeline`,
    stageSaid: ({ stage, n }: { stage: string; n: number }) => `${stage}, ${n} ${n === 1 ? kept('lead') : kept('leads')}`,
    /** Under the strip: what the list holds, and its order. */
    meta: ({ n, what }: { n: number; what: string }) => `${n} ${n === 1 ? kept('lead') : kept('leads')} · ${what}`,
    allLeads: 'all',
    nextActionToday: 'Today',
    /** UI-062's words for a lead with no next action, in red. */
    fillAction: 'Add an action',
    fillDate: 'Add a date',
    overdue: 'overdue',
    add: 'Add lead',
    open: ({ who }: { who: string }) => `Open ${who}`,
    noneOfType: 'No leads here yet.',
    /** From 1024px, the pane beside the list with no lead open in it (UI-116; P19.1-T2, the *Fill* of an empty pane). */
    choose: 'Choose a lead to open it here.',
    filters: {
      title: 'Filter and sort',
      type: 'Type',
      status: 'Status',
      sort: 'Order',
      allStatuses: 'All',
      clear: 'Clear',
      done: 'Show leads',
      /** P19.7-T2 AC-12 (the proposal spec, *Proposals on the Leads page*): the filter's third group. */
      proposal: 'Proposal',
      withProposal: 'Has a proposal',
      withoutProposal: 'No proposal yet',
    },
    /**
     * **The card's proposal pill and its *Buat proposal*** (P19.7-T2 AC-1, AC-12): the pill's count where it has no
     * product's name (an empty draft), and the icon link's name. The pill's own name is `filters.proposal`.
     */
    proposalCount: ({ n }: { n: number }) => (n === 1 ? '1 proposal' : `${n} proposals`),
    makeProposal: 'Make a proposal',
    makeProposalFor: ({ who }: { who: string }) => `Make a proposal for ${who}`,
  },

  /**
   * **The pipeline strip's short words, by the stage's code** (UI-105, D-18: *Belum · Follow-up · SPAJ · Belum bayar ·
   * Closing*). Only the seeded ladders' codes: a stage an office added is shown in its own words. A code, never a
   * position (invariant §4).
   */
  stageShort: {
    NOT_YET_APPROACHED: 'Not yet',
    FOLLOW_UP: kept('Follow-up'),
    POLICY_SUBMITTED: kept('SPAJ'),
    APPROVED_NOT_PAID: 'Unpaid',
    PAID_AND_ISSUED: kept('Closing'),
    NOT_APPROACHED: 'Not yet',
    MEETING_SCHEDULED: 'Meeting',
    RECRUITMENT_PRESENTATION: 'Presentation',
    AGENT_CODE_CREATED: 'Agent code',
    AAJI_LICENSED: kept('AAJI'),
    JOINT_FIELD_WORK_PLANNED: kept('JFW'),
    NEW_ACTIVE_AGENT: 'Active',
  } as Record<string, string>,

  /** **The lead sheet** (UI V1, UI-105; D-19, D-07): `components/lead-sheet.tsx`. */
  sheet: {
    newTitle: 'New lead',
    /** Under the name: *Follow-up · Sales*. */
    meta: ({ stage, type }: { stage: string; type: string }) => `${stage} · ${type}`,
    noStage: 'No stage yet',
    name: 'Name',
    type: 'Type',
    status: 'Status',
    chooseTypeFirst: 'Choose Sales or Recruit to see its stages.',
    nextAction: 'Next action',
    nextActionDate: 'Next action date',
    pickDate: 'Pick a date',
    notePlaceholder: 'Write the action…',
    remarks: 'Remarks',
    details: 'Details',
    phone: 'WhatsApp number',
    email: 'Email',
    source: 'Where they came from',
    outcome: 'Outcome',
    history: 'History',
    historyLoading: 'Loading the history…',
    added: 'Lead added',
    moved: ({ stage }: { stage: string }) => `Status → ${stage}`,
    save: 'Save',
    delete: 'Delete',
    deleteAsk: ({ who }: { who: string }) => `Delete ${who}? It leaves your leads.`,
    deleted: 'Lead deleted',
    /**
     * *Hapus tugas* (the staging review of 2026-10-31): the calendar's sheet, in *Delete*'s place — the lead's next action
     * cleared, which is the task, and the lead kept.
     */
    clearTask: 'Delete task',
    clearTaskAsk: ({ who }: { who: string }) => `Delete the task for ${who}? The lead stays; only its next action is cleared.`,
    taskCleared: 'Task deleted',
    saved: 'Saved',
    discard: 'You have changes that are not saved yet. Close without saving?',
    discardConfirm: 'Close without saving',
    /** The client's age and gender (P19.7-T1 AC-1; ADR-0224): the stepper and the two buttons. */
    age: 'Age at next birthday',
    ageLess: 'One year less',
    ageMore: 'One year more',
    ageOutOfRange: ({ min, max }: { min: number; max: number }) => `Age must be ${min}–${max}.`,
    gender: 'Gender',
    genders: { male: 'Male', female: 'Female' },
    /**
     * **The sheet's *Proposal* section, above *Riwayat*** (P19.7-T2 AC-12; the proposal spec, *Proposals on the Leads
     * page*), on the reader's own lead: each proposal's row, its status pill, *+ Buat proposal*, and *Riwayat*'s note
     * (AC-11). `products` is the names already joined; a figure is the caller's.
     */
    proposals: 'Proposal',
    proposalsLoading: 'Loading the proposals…',
    newProposal: 'Make a proposal',
    proposalStatus: { draft: 'Draft', done: 'Done' },
    proposalMade: ({ products }: { products: string }) => `Proposal made · ${products}`,
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
    // UI-160 item 3, verbatim: *Aktif setelah status Polis paid and issued*, the stage as the office named it.
    wonHeld: ({ stage }) => `Aktif setelah status ${stage}`,
    markLost: 'Tandai tidak berhasil',
    // UI-160 item 2, verbatim for Sales; the Recruit line worded by ADR-0194 §2 (glossary for approval, §B.10).
    lostHeld: { sales: 'Polis sudah dibayar dan terbit', recruitment: 'Kandidat sudah bergabung' },
    delete: 'Hapus',
    deleteHeld: `Hanya pemilik ${kept('lead')} ini yang dapat menghapusnya.`,
  },

  potensi: {
    // UI-153 item 1, verbatim.
    sales: `Potensi ${kept('closing')} bulan ini`,
    recruitment: 'Potensi rekrut bulan ini',
    badge: 'Potensi bulan ini',
    badgeWon: 'Potensi bulan ini, berhasil',
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

  phoneHeld: {
    missing: `Belum ada nomor telepon — tambahkan di Detail ${kept('lead')}.`,
    unusable: `Nomor ini tidak dapat dihubungi — periksa di Detail ${kept('lead')}.`,
  },

  list: {
    title: kept('Leads'),
    search: `Cari nama ${kept('lead')}`,
    filter: 'Filter dan urutan',
    filterOn: 'Filter dan urutan, ada filter aktif',
    chips: `Jenis ${kept('lead')}`,
    all: 'Semua',
    chipSaid: ({ label, n }) => `${label}, ${n} ${n === 1 ? kept('lead') : kept('leads')}`,
    pipeline: ({ type }) => `${kept('Pipeline')} ${type}`,
    stageSaid: ({ stage, n }) => `${stage}, ${n} ${n === 1 ? kept('lead') : kept('leads')}`,
    meta: ({ n, what }) => `${n} ${n === 1 ? kept('lead') : kept('leads')} · ${what}`,
    allLeads: 'semua',
    nextActionToday: 'Hari ini',
    fillAction: 'Isi tindakan',
    fillDate: 'Isi tanggal',
    overdue: 'terlambat',
    add: `Tambah ${kept('lead')}`,
    open: ({ who }) => `Buka ${who}`,
    noneOfType: `Belum ada ${kept('leads')} di sini.`,
    choose: `Pilih ${kept('lead')} untuk membukanya di sini.`,
    filters: {
      title: 'Filter dan urutan',
      type: 'Jenis',
      status: 'Status',
      sort: 'Urutan',
      allStatuses: 'Semua',
      clear: 'Hapus filter',
      done: `Tampilkan ${kept('leads')}`,
      // The proposal spec's own words (*Proposals on the Leads page*).
      proposal: 'Proposal',
      withProposal: 'Sudah ada proposal',
      withoutProposal: 'Belum ada proposal',
    },
    proposalCount: ({ n }) => `${n} proposal`,
    makeProposal: 'Buat proposal',
    makeProposalFor: ({ who }) => `Buat proposal untuk ${who}`,
  },

  stageShort: {
    NOT_YET_APPROACHED: 'Belum',
    FOLLOW_UP: kept('Follow-up'),
    POLICY_SUBMITTED: kept('SPAJ'),
    APPROVED_NOT_PAID: 'Belum bayar',
    PAID_AND_ISSUED: kept('Closing'),
    NOT_APPROACHED: 'Belum',
    MEETING_SCHEDULED: 'Pertemuan',
    RECRUITMENT_PRESENTATION: 'Presentasi',
    AGENT_CODE_CREATED: 'Kode agen',
    AAJI_LICENSED: kept('AAJI'),
    JOINT_FIELD_WORK_PLANNED: kept('JFW'),
    NEW_ACTIVE_AGENT: 'Aktif',
  },

  sheet: {
    newTitle: `${kept('Lead')} baru`,
    meta: ({ stage, type }) => `${stage} · ${type}`,
    noStage: 'Belum ada tahap',
    name: 'Nama',
    type: 'Jenis',
    status: 'Status',
    chooseTypeFirst: `Pilih ${kept('Sales')} atau ${kept('Recruit')} untuk melihat tahapnya.`,
    nextAction: 'Tindakan berikutnya',
    nextActionDate: 'Tanggal tindakan berikutnya',
    pickDate: 'Pilih tanggal',
    notePlaceholder: 'Tulis tindakan…',
    remarks: 'Keterangan',
    details: 'Detail',
    phone: 'Nomor WhatsApp',
    email: 'Email',
    source: `Sumber ${kept('lead')}`,
    outcome: 'Hasil',
    history: 'Riwayat',
    historyLoading: 'Memuat riwayat…',
    added: `${kept('Lead')} ditambahkan`,
    moved: ({ stage }) => `Status → ${stage}`,
    save: 'Simpan',
    delete: 'Hapus',
    deleteAsk: ({ who }) => `Hapus ${who}? ${kept('Lead')} ini keluar dari daftar Anda.`,
    deleted: `${kept('Lead')} dihapus`,
    clearTask: 'Hapus tugas',
    clearTaskAsk: ({ who }) => `Hapus tugas untuk ${who}? ${kept('Lead')}-nya tetap ada; hanya tindakan berikutnya yang dikosongkan.`,
    taskCleared: 'Tugas dihapus',
    saved: 'Tersimpan',
    discard: 'Ada perubahan yang belum disimpan. Tutup tanpa menyimpan?',
    discardConfirm: 'Tutup tanpa menyimpan',
    // The proposal spec's own words (step 1): *Umur ulang tahun berikutnya*, *Laki-laki / Perempuan*, *"Umur harus 1–100."*
    age: 'Umur ulang tahun berikutnya',
    ageLess: 'Kurangi satu tahun',
    ageMore: 'Tambah satu tahun',
    ageOutOfRange: ({ min, max }) => `Umur harus ${min}–${max}.`,
    gender: 'Jenis kelamin',
    genders: { male: 'Laki-laki', female: 'Perempuan' },
    // The proposal spec's own words: *Proposal*, *+ Buat proposal*, *Draf / Selesai*, *"Proposal dibuat · {produk}"*.
    proposals: 'Proposal',
    proposalsLoading: 'Memuat proposal…',
    newProposal: 'Buat proposal',
    proposalStatus: { draft: 'Draf', done: 'Selesai' },
    proposalMade: ({ products }) => `Proposal dibuat · ${products}`,
  },
};

export const leadsMessages = defineMessages({ en, id });
