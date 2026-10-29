import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Strategic Leader Forum's own words** — the list, a meeting's head, its tab strip, the two dialogs, the states
 * and how a write is said (P18.98-T4, people and forum; `functional/leader-forum.md`, *The module's own strings*).
 *
 * **English is the source** of the keys: the prototype's strings as built and the module's own (D-copy), **none of the
 * six words in either language** — no *office*, no *KPM*. The Indonesian is the approved glossary's (OD-237; §B.0's
 * voice: *Anda*, imperative verbs, sentence case, no exclamation mark), with the words it lacked added to the glossary
 * for approval's §B.10 — *rapat* for a meeting, *notulen* for the minutes.
 *
 * **Kept in both languages** (§A): the forum's name and the tab names, *AgencyBoost*, *Core Leader* — counted, in its
 * English plural (§B.0 rule 8) — and a new meeting's name, *Strategic Check-in — #{n}*. **Content stays as typed** (ADR-0179 §5): a meeting's title once made, its agenda,
 * its tracker, a PIC and the branch's name. **A figure is never a message's**: the caller writes a date in the figures'
 * language (`useFigureLanguage()`) and passes it in. *Link copied ✓* is the copy controls' one word
 * (`lib/confirmations.ts`), not here.
 *
 * @moved lib/leader-meetings.ts
 * @moved components/leader-forum/forum-list.tsx
 * @moved components/leader-forum/forum-states.tsx
 * @moved components/leader-forum/meeting-card.tsx
 * @moved components/leader-forum/meeting-dialog.tsx
 * @moved components/leader-forum/meeting-head.tsx
 * @moved components/leader-forum/meeting-screen.tsx
 * @moved components/leader-forum/meeting-tabs.tsx
 * @moved components/leader-forum/meeting-writer.tsx
 * @moved components/leader-forum/share-dialog.tsx
 * @moved app/leader-meetings/page.tsx
 * @moved app/leader-meetings/[meetingId]/page.tsx
 * @moved app/leader-meetings/shared/[token]/page.tsx
 */
const en = {
  /** The page's one subtitle (P18.97-T2 AC-1). */
  sub: 'Biweekly check-ins with your core leaders — agenda, notes, and action items',
  /** The filter, over the one read (`:2614-2616`): a filter naming a status follows the status words (§A.3). */
  filters: { all: 'All', upcoming: 'Upcoming', past: 'Past' },
  newMeeting: '+ New meeting',
  open: 'Open',
  allClear: 'All clear',
  noMatch: 'No meetings match this filter.',
  noMeetings: 'No meetings yet.',
  loadingList: 'Loading meetings…',
  loadingMeeting: 'Loading the meeting…',
  back: '← Back to all meetings',
  cadence: 'Recommended: every 2 weeks · 60–90 mins',
  share: 'Share',
  savePdf: 'Save as PDF',
  save: 'Save',
  /** *Can edit this MOM* (`:2723`) in the client's words (P18.97-T2 AC-3): *MOM* is in no string of the module. */
  canEdit: 'Can edit these minutes',
  manageTags: 'Manage tags →',
  /** After the reader's own name on a chip. */
  you: '(You)',
  /** The three tabs (`:2728-2732`), names (§A.3). */
  tabs: { overview: kept('Overview & Stats'), agenda: kept('Agenda'), actions: kept('Action Items') },
  /** What a write says (*Saving*, L-110). */
  saved: 'Saved',
  allSaved: 'All changes saved',
  conflict: 'Someone else changed this while you were editing. It now shows what they saved.',
  failed: "Couldn't save that change. It's still here — try again.",
  preparingPdf: 'Preparing PDF — use your browser’s print dialog to save',
  /** A read that failed, under the shared banner. */
  tryAgain: 'Try again',
  /** The not-found state's way on, for a reader with no list to go back to. */
  home: 'Go to your home page',
  /** The meeting dialog (OD-145, ADR-0130). */
  dialog: {
    newTitle: 'New meeting',
    detailsTitle: 'Meeting details',
    title: 'Title',
    date: 'Date',
    create: 'Create meeting',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete meeting',
    confirmDelete: 'Delete',
    keep: 'Keep it',
    needTitle: 'Give the meeting a title.',
    needDate: 'Pick a date.',
    completed: 'This meeting has already taken place, so its date stays.',
    hasMinutes: "Something has been written in this meeting, so it can't be deleted.",
  },
  /** *Share these minutes* (`:2735-2745`; P18.97-T2 AC-3; OD-146). */
  shareDialog: {
    title: 'Share these minutes',
    copy: 'Copy link',
    stop: 'Stop sharing',
    stopped: 'Sharing stopped',
    failed: "Couldn't make a link. Try again.",
    close: 'Close',
  },
  notFound: {
    title: "This meeting can't be found.",
    body: "It may have been deleted, or it isn't one you can open.",
  },
  linkNotFound: {
    title: "This link doesn't open anything.",
    body: 'It may have expired or been stopped. Ask whoever shared it for a new one.',
  },
  /** A meeting's state on its card and in its head (`:2600`). */
  state: { upcoming: 'Upcoming', completed: 'Completed' },
  /** *"3 core leaders tagged"*, singular for one (F-186). */
  coreLeadersTagged: ({ n }: { n: number }) => `${n} core leader${n === 1 ? '' : 's'} tagged`,
  /** The words after the bold count in *"4 open items"* (`:2606`); 0 is *All clear*, drawn apart. */
  openItems: ({ n }: { n: number }): string => (n === 1 ? 'open item' : 'open items'),
  /** The date's button in the head (ADR-0130 §4). */
  changeDate: ({ title }: { title: string }) => `Change the date of ${title}`,
  deleteQuestion: ({ title }: { title: string }) =>
    `Delete “${title}”? Nothing has been written in it yet, and it can't be brought back.`,
  /** The share dialog's hint (I-256), in the answered words of OD-146; `until` the day the link stops, written. */
  shareHint: ({ branch, until }: { branch: string; until: string }) =>
    `Anyone signed in to AgencyBoost at ${branch} can open this meeting's minutes with this link, read-only, until ${until}.`,
  /** A new meeting's title, one past the highest number on the list (ADR-0130 §2): the meeting's name, kept. */
  defaultTitle: ({ n }: { n: number }) => `${kept('Strategic Check-in')} — #${n}`,
  /** Names joined as a sentence joins them: *a*, *a and b*, *a, b and c*. */
  list: ({ items }: { items: readonly string[] }) =>
    (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`),
};

const id: MessagesOf<typeof en> = {
  sub: `Rapat dua mingguan bersama para ${kept('Core Leader')} Anda — agenda, catatan, dan tindakan`,
  filters: { all: 'Semua', upcoming: 'Akan datang', past: 'Sudah lewat' },
  newMeeting: '+ Rapat baru',
  open: 'Buka',
  allClear: 'Semua selesai',
  noMatch: 'Tidak ada rapat yang cocok dengan filter ini.',
  noMeetings: 'Belum ada rapat.',
  loadingList: 'Memuat daftar rapat…',
  loadingMeeting: 'Memuat rapat…',
  back: '← Kembali ke semua rapat',
  cadence: 'Disarankan: setiap 2 minggu · 60–90 menit',
  share: 'Bagikan',
  savePdf: 'Simpan sebagai PDF',
  save: 'Simpan',
  canEdit: 'Dapat mengubah notulen ini',
  manageTags: 'Kelola tag →',
  you: '(Anda)',
  tabs: { overview: kept('Overview & Stats'), agenda: kept('Agenda'), actions: kept('Action Items') },
  saved: 'Tersimpan',
  allSaved: 'Semua perubahan tersimpan',
  conflict: 'Orang lain mengubah ini saat Anda sedang mengubahnya. Yang tampil sekarang adalah yang mereka simpan.',
  failed: 'Gagal menyimpan perubahan itu. Perubahannya masih di sini — coba lagi.',
  preparingPdf: 'Menyiapkan PDF — gunakan dialog cetak browser Anda untuk menyimpannya',
  tryAgain: 'Coba lagi',
  home: 'Buka beranda Anda',
  dialog: {
    newTitle: 'Rapat baru',
    detailsTitle: 'Detail rapat',
    title: 'Judul',
    date: 'Tanggal',
    create: 'Buat rapat',
    saveChanges: 'Simpan perubahan',
    cancel: 'Batal',
    delete: 'Hapus rapat',
    confirmDelete: 'Hapus',
    keep: 'Jangan hapus',
    needTitle: 'Beri judul untuk rapat ini.',
    needDate: 'Pilih tanggal.',
    completed: 'Rapat ini sudah berlangsung, jadi tanggalnya tetap.',
    hasMinutes: 'Rapat ini sudah berisi catatan, jadi tidak dapat dihapus.',
  },
  shareDialog: {
    title: 'Bagikan notulen ini',
    copy: 'Salin tautan',
    stop: 'Hentikan berbagi',
    stopped: 'Berbagi dihentikan',
    failed: 'Gagal membuat tautan. Coba lagi.',
    close: 'Tutup',
  },
  notFound: {
    title: 'Rapat ini tidak ditemukan.',
    body: 'Rapat ini mungkin sudah dihapus, atau bukan rapat yang dapat Anda buka.',
  },
  linkNotFound: {
    title: 'Tautan ini tidak membuka apa pun.',
    body: 'Tautan ini mungkin sudah kedaluwarsa atau dihentikan. Minta tautan baru kepada orang yang membagikannya.',
  },
  state: { upcoming: 'Akan datang', completed: 'Selesai' },
  coreLeadersTagged: ({ n }) => `${n} ${n === 1 ? kept('Core Leader') : kept('Core Leaders')} di-tag`,
  openItems: () => 'item belum selesai',
  changeDate: ({ title }) => `Ganti tanggal ${title}`,
  deleteQuestion: ({ title }) =>
    `Hapus “${title}”? Belum ada yang ditulis di dalamnya, dan rapat ini tidak dapat dikembalikan.`,
  shareHint: ({ branch, until }) =>
    `Siapa pun yang masuk ke ${kept('AgencyBoost')} di ${branch} dapat membuka notulen rapat ini dengan tautan ini, hanya untuk dibaca, sampai ${until}.`,
  defaultTitle: ({ n }) => `${kept('Strategic Check-in')} — #${n}`,
  list: ({ items }) => {
    if (items.length <= 1) return items.join('');
    if (items.length === 2) return `${items[0]} dan ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`;
  },
};

export const forumMessages = defineMessages({ en, id });
