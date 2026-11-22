import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Strategic Leader Forum's words** (P19.22-T8; ADR-0276; `functional/leader-forum.md`, *The module's own strings*):
 * the list, a forum's header card, its four tabs, the agenda, the action items, the dialogs, the states and the WhatsApp
 * message *Bagikan* sends.
 *
 * **Indonesian is the 19 November mockups' words, verbatim** (`revisions/2026-11-19/files/UI/mockups/slf-*`): *Forum
 * berikutnya*, *Siapkan agenda*, *Semua forum*, *Akan datang · Selesai*, *Belum · Proses · Selesai*, *Tenggat*, *dari
 * forum #n*, *Hapus action item?*. **English is ours**, from the same. Kept in both: *Agenda*, *Action items*, *MAPA
 * driver*, *Informal group*, *PIC*, *core leader* — the client's own words on the Indonesian screens. **Content stays as
 * typed** (ADR-0179 §5): an agenda line, an action item. **A figure is never a message's**: a date and a time are written
 * by the caller in the figures' language and passed in.
 *
 * @moved lib/leader-meetings.ts
 * @moved components/leader-forum/forum-list.tsx
 * @moved components/leader-forum/forum-states.tsx
 * @moved components/leader-forum/forum-screen.tsx
 * @moved components/leader-forum/forum-dialog.tsx
 * @moved components/leader-forum/forum-people.tsx
 * @moved components/leader-forum/choice-menu.tsx
 * @moved components/leader-forum/agenda.tsx
 * @moved components/leader-forum/action-items.tsx
 * @moved components/leader-forum/print-layout.tsx
 * @moved app/leader-meetings/page.tsx
 * @moved app/leader-meetings/[meetingId]/page.tsx
 * @moved app/leader-meetings/shared/[token]/page.tsx
 */
const en = {
  /** The list's note (AC-1). */
  note: 'Core leaders meet every 2 weeks · 60–90 minutes',
  newForum: 'New forum',
  next: 'Next forum',
  forumN: ({ n }: { n: number }) => `Forum #${n}`,
  chipN: ({ n }: { n: number }) => `#${n}`,
  /** *Hari ini* · *Besok* · *n hari lagi*. */
  daysToGo: ({ n }: { n: number }) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days to go`),
  coreLeaders: ({ n }: { n: number }) => `${n} core leader${n === 1 ? '' : 's'}`,
  everyoneEdits: 'everyone can edit',
  prepare: 'Prepare the agenda',
  all: 'All forums',
  agendaCount: ({ n }: { n: number }) => `Agenda ${n} item${n === 1 ? '' : 's'}`,
  /** *Action items* before the bold *x/y*, *selesai* after it. */
  actionsLabel: kept('Action items'),
  doneWord: 'done',
  state: { upcoming: 'Upcoming', completed: 'Done' },
  open: ({ n }: { n: number }) => `Open forum #${n}`,
  noForums: 'No forum yet.',
  loadingList: 'Loading the forums…',
  loadingForum: 'Loading the forum…',
  back: 'All forums',
  share: 'Share',
  pdf: 'PDF',
  changeWhen: 'Change date and time',
  tabsLabel: 'Forum sections',
  tabs: { mapa: kept('MAPA driver'), groups: kept('Informal group'), agenda: kept('Agenda'), actions: kept('Action items') },
  /** The note over a tab that is Advanced analytics' own (AC-2). */
  sameAs: ({ tab }: { tab: string }) => `Same as Advanced analytics › ${tab}`,
  agenda: {
    add: 'Add agenda',
    placeholder: 'New agenda line',
    tick: ({ text }: { text: string }) => `Done: ${text}`,
    edit: ({ text }: { text: string }) => `Edit: ${text}`,
    picOf: ({ text }: { text: string }) => `PIC for ${text}`,
    everyone: 'Everyone',
    noPic: 'No PIC',
    choosePic: 'PIC',
    empty: 'No agenda yet.',
  },
  actions: {
    headers: { item: kept('Action item'), pic: 'PIC', due: 'Due', status: 'Status' },
    from: ({ n }: { n: number }) => `from forum #${n}`,
    status: { todo: 'Not yet', doing: 'In progress', done: 'Done' },
    statusOf: ({ text }: { text: string }) => `Status of ${text}`,
    dueOf: ({ text }: { text: string }) => `Due date of ${text}`,
    picOf: ({ text }: { text: string }) => `PIC for ${text}`,
    edit: ({ text }: { text: string }) => `Edit: ${text}`,
    remove: ({ text }: { text: string }) => `Delete: ${text}`,
    noDue: 'No due date',
    add: 'Add action item',
    placeholder: 'New action item',
    carryHint: 'Unfinished action items move to the next forum automatically',
    tapHint: 'Tap a status to change it · tap a text to edit it',
    empty: 'No action items yet.',
    confirmTitle: 'Delete action item?',
    confirmBody: 'Also gone from the next forum. It cannot be undone.',
    cancel: 'Cancel',
    delete: 'Delete',
  },
  dialog: {
    newTitle: 'New forum',
    whenTitle: 'Forum date and time',
    date: 'Date',
    time: 'Time',
    create: 'Create forum',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete forum',
    confirmDelete: 'Delete',
    keep: 'Keep it',
    deleteQuestion: ({ n }: { n: number }) => `Delete forum #${n}? Nothing has been written in it yet, and it can't be brought back.`,
    needDate: 'Pick a date.',
    needTime: 'Pick a time.',
  },
  saved: 'Saved',
  conflict: 'Someone else changed this while you were editing. It now shows what they saved.',
  failed: "Couldn't save that change. Try again.",
  preparingPdf: 'Preparing the PDF — use your browser’s print dialog to save it',
  tryAgain: 'Try again',
  home: 'Go to your home page',
  notFound: {
    title: "This forum can't be found.",
    body: "It may have been deleted, or it isn't one you can open.",
  },
  linkNotFound: {
    title: "This link doesn't open anything.",
    body: 'It may have expired. Ask whoever shared it for a new one.',
  },
  whatsapp: {
    head: ({ n, when }: { n: number; when: string }) => `Strategic Leader Forum · Forum #${n} · ${when}`,
    open: 'Open (read-only):',
    sharing: 'Opening WhatsApp…',
  },
};

const id: MessagesOf<typeof en> = {
  note: 'Pertemuan core leader tiap 2 minggu · 60–90 menit',
  newForum: 'Forum baru',
  next: 'Forum berikutnya',
  forumN: ({ n }) => `Forum #${n}`,
  chipN: ({ n }) => `#${n}`,
  daysToGo: ({ n }) => (n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : `${n} hari lagi`),
  coreLeaders: ({ n }) => `${n} core leader`,
  everyoneEdits: 'semua bisa mengedit',
  prepare: 'Siapkan agenda',
  all: 'Semua forum',
  agendaCount: ({ n }) => `Agenda ${n} item`,
  actionsLabel: kept('Action items'),
  doneWord: 'selesai',
  state: { upcoming: 'Akan datang', completed: 'Selesai' },
  open: ({ n }) => `Buka forum #${n}`,
  noForums: 'Belum ada forum.',
  loadingList: 'Memuat daftar forum…',
  loadingForum: 'Memuat forum…',
  back: 'Semua forum',
  share: 'Bagikan',
  pdf: 'PDF',
  changeWhen: 'Ubah tanggal dan jam',
  tabsLabel: 'Bagian forum',
  tabs: { mapa: kept('MAPA driver'), groups: kept('Informal group'), agenda: kept('Agenda'), actions: kept('Action items') },
  sameAs: ({ tab }) => `Sama dengan Advanced analytics › ${tab}`,
  agenda: {
    add: 'Tambah agenda',
    placeholder: 'Agenda baru',
    tick: ({ text }) => `Selesai: ${text}`,
    edit: ({ text }) => `Ubah: ${text}`,
    picOf: ({ text }) => `PIC untuk ${text}`,
    everyone: 'Semua',
    noPic: 'Tanpa PIC',
    choosePic: 'PIC',
    empty: 'Belum ada agenda.',
  },
  actions: {
    headers: { item: kept('Action item'), pic: 'PIC', due: 'Tenggat', status: 'Status' },
    from: ({ n }) => `dari forum #${n}`,
    status: { todo: 'Belum', doing: 'Proses', done: 'Selesai' },
    statusOf: ({ text }) => `Status ${text}`,
    dueOf: ({ text }) => `Tenggat ${text}`,
    picOf: ({ text }) => `PIC untuk ${text}`,
    edit: ({ text }) => `Ubah: ${text}`,
    remove: ({ text }) => `Hapus: ${text}`,
    noDue: 'Tanpa tenggat',
    add: 'Tambah action item',
    placeholder: 'Action item baru',
    carryHint: 'Action item yang belum selesai otomatis pindah ke forum berikutnya',
    tapHint: 'Ketuk status untuk mengubah · ketuk teks untuk mengedit',
    empty: 'Belum ada action item.',
    confirmTitle: 'Hapus action item?',
    confirmBody: 'Juga hilang dari forum berikutnya. Tidak bisa dibatalkan.',
    cancel: 'Batal',
    delete: 'Hapus',
  },
  dialog: {
    newTitle: 'Forum baru',
    whenTitle: 'Tanggal dan jam forum',
    date: 'Tanggal',
    time: 'Jam',
    create: 'Buat forum',
    save: 'Simpan',
    cancel: 'Batal',
    delete: 'Hapus forum',
    confirmDelete: 'Hapus',
    keep: 'Jangan hapus',
    deleteQuestion: ({ n }) => `Hapus forum #${n}? Belum ada yang ditulis di forum ini, dan forum ini tidak dapat dikembalikan.`,
    needDate: 'Pilih tanggal.',
    needTime: 'Pilih jam.',
  },
  saved: 'Tersimpan',
  conflict: 'Orang lain mengubah ini saat Anda sedang mengubahnya. Yang tampil sekarang adalah yang mereka simpan.',
  failed: 'Gagal menyimpan perubahan itu. Coba lagi.',
  preparingPdf: 'Menyiapkan PDF — gunakan dialog cetak browser Anda untuk menyimpannya',
  tryAgain: 'Coba lagi',
  home: 'Buka beranda Anda',
  notFound: {
    title: 'Forum ini tidak ditemukan.',
    body: 'Forum ini mungkin sudah dihapus, atau bukan forum yang dapat Anda buka.',
  },
  linkNotFound: {
    title: 'Tautan ini tidak membuka apa pun.',
    body: 'Tautan ini mungkin sudah kedaluwarsa. Minta tautan baru kepada yang membagikannya.',
  },
  whatsapp: {
    head: ({ n, when }) => `Strategic Leader Forum · Forum #${n} · ${when}`,
    open: 'Buka (hanya baca):',
    sharing: 'Membuka WhatsApp…',
  },
};

export const forumMessages = defineMessages({ en, id });
