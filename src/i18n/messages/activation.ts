import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The 90-day activation's own words** (`lib/activation.ts`; P18.98-T4, new hires and activation;
 * `functional/activation.md`, *The module's own strings*): the hire's `/activation` — its title and line, the progress
 * card, a row, the *Auto* and *Ticked by hand* badges, who ticked what, a data-backed item's two forms, the leader's
 * note and the page's states — the parts the leader's `/new-hires/[membershipId]` draws the same way, the coaching
 * record's (`record`, which `components/activation-record.tsx` reads in the reader's language since P18.98-T4's coaching
 * and unit), and the office's checklist settings' badge and
 * *From {data}* (`autoBadge`, `byHandBadge`, `fromDataWords`). The roster's and the detail's own words are
 * `new-hires.ts`'.
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:3270-3352`, `:6430-6694`), ours
 * where it does not. The Indonesian is the approved glossary's — *Simpan · Batal · Konfirmasi · Coba lagi* (§B.1),
 * *Menyimpan…* (§B.2), *Selesai · Berjalan · Belum dimulai · Opsional* (§B.3), *Tanggal bergabung · Catatan* (§B.4),
 * *Terlambat*, *aspek*, *checklist*, *Diselesaikan dari*, *centang* (§B.10) — with what it lacked proposed in the
 * glossary for approval's §B.10 (*Otomatis*, *Dicentang manual*, *agen senior* …). **Kept** (§A): the page's title,
 * *90-Day Activation* and *90-day activation*, *activation*, *coaching*, *1:1*, *case* and *closing*, *Leads Management*,
 * *new hire*, *leader*, *New Active Agent*. A person is *dia* (§B.0 rule 8).
 *
 * **Typed content stays as typed**: an aspect's name, an item's label, a note, a name. **The server's words are passed
 * in as they come**: a link's label (*Sales data*, *Goal Settings*) and what it completes on (`completesWhen`), which
 * are the API's (P18.98-T5). **A figure is never a message's**: a date or a percentage is written by the caller in the
 * figures' language and passed in.
 *
 * @moved lib/activation.ts
 * @moved components/activation-parts.tsx
 * @moved components/activation-data-item.tsx
 * @moved components/my-activation.tsx
 * @moved app/(agent)/activation/
 * @moved components/activation-record.tsx
 */
const en = {
  /** The hire's page: its title, the nav item's words (P18.95-T9 AC-2), and its line. */
  title: kept('Your 90-Day Activation'),
  subtitle: 'Your first 90 days, checklist by checklist.',

  /** The progress card's head (`:3280-3349`). */
  progressHeading: 'Your activation progress',
  /** One name for the one date (P18.96-T2 AC-5, ADR-0169 §7). */
  joinDate: 'Join date',
  /** *Mark checklist complete* (P18.96-T6 AC-5, ADR-0173 §4), and why it waits: `n` the checklist's own total. */
  graduate: 'Mark checklist complete',
  graduateLocked: ({ n }: { n: number }) => `Unlocks when all ${n} items are done`,
  /** Its confirmation (OD-28, D-copy) and its toast (`:6683-6688`). */
  graduateQuestion: 'Mark your checklist complete? The 90-Day Activation menu will be removed.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  graduated: 'Marked as tenured agent — 90-Day Activation removed from menu.',
  footer: "Visible only to new agents, for their first 6 months. Tenured agents won't see this section.",

  /** The tiles, the bar and the aspect table, the hire's and the leader's alike (`:3293-3317`). */
  day: 'Day',
  completed: 'Completed',
  /** `pct` written in the figures' language. */
  pctComplete: ({ pct }: { pct: string }) => `${pct} complete`,
  aspect: 'Aspect',
  items: 'Items',
  status: 'Status',
  /** An aspect's pill (`:6547-6551`). */
  aspectStatus: { done: 'Done', in_progress: 'In progress', not_started: 'Not started' },
  /** After an overdue day, for a screen reader: the red and the bold say it to everybody else. */
  overdue: ', overdue',

  /** A row (`:6570-6607`): the chevron, the hire's note and date, and a link's way in. */
  showNoteAndDate: 'Show note and date',
  notePlaceholder: 'Note (optional)',
  itemNoteName: ({ label }: { label: string }) => `Note (optional) — ${label}`,
  itemDateName: ({ label }: { label: string }) => `Date — ${label}`,
  /** `label` the server's: a feature's title or a module's. */
  goTo: ({ label }: { label: string }) => `Go to ${label} →`,

  /** *Auto* (T4 AC-4): its tooltip and the end of its name the registry's sentence, as the server sends it. */
  auto: 'Auto',
  autoTip: ({ completesWhen }: { completesWhen: string }) => `Completes when ${completesWhen}.`,
  autoName: ({ completesWhen }: { completesWhen: string }) => `Auto — completes when ${completesWhen}`,
  /** *Ticked by hand* (P13-T3 AC-1, parity I-80): whether the link completes the item, never when. */
  byHand: 'Ticked by hand',
  byHandTip: 'This link does not complete the item on its own, so the hire or one of their leaders ticks it.',
  byHandName: 'Ticked by hand — this link does not complete the item on its own, so the hire or one of their leaders ticks it',
  /** What a data-backed item completes from, in the office's settings' select (P18.96-T7 G2). */
  fromData: ({ label }: { label: string }) => `From ${label}`,

  /** Who ticked a done item and when (OD-121, T4 AC-5): `who` a name or `you`, `when` a day already written. */
  you: 'you',
  tickedBy: ({ who, when }: { who: string; when: string }) => `Ticked by ${who} · ${when}`,
  completedFromBy: ({ label, who, when }: { label: string; who: string; when: string }) =>
    `Completed from ${label} by ${who} · ${when}`,
  completedFrom: ({ label, when }: { label: string; when: string }) => `Completed from ${label} · ${when}`,
  completedAutomatically: ({ when }: { when: string }) => `Completed automatically · ${when}`,
  /** A data-backed item ticked by hand, not yet confirmed by its data (P18.96-T4 AC-4). */
  waitingForData: ({ who }: { who: string }) => `Ticked by ${who}, waiting for data`,
  /** The join date's correction (OD-118, ADR-0169 §2). */
  correctedBy: ({ who, when }: { who: string; when: string }) => `Join date corrected by ${who} · ${when}`,
  /** A row whose write failed: put back, and why — the server's sentence, as it comes. */
  notSaved: ({ why }: { why: string }) => `Not saved. ${why}`,
  saving: 'Saving…',
  tryAgain: 'Try again',

  /** A data-backed item's two forms (P18.96-T4 AC-3; the client's own *Which case?*, *Log 1:1*). */
  whichCase: 'Which case?',
  newClosing: 'Log a new closing',
  closingName: 'Sold to',
  closingDate: 'Paid and issued on',
  noClosings: 'No closing in Leads Management yet. Log the case below.',
  loadingClosings: 'Loading the closings…',
  logOneOnOne: 'Log 1:1',
  oneOnOneDate: 'Held on',
  oneOnOneNote: 'Note',
  oneOnOnePlaceholder: 'What you covered',
  save: 'Save',
  recordIncomplete: 'Fill in every field first.',

  /** The leader's coaching note, which the hire reads (OD-117): its heading, and who wrote it when. */
  noteHeading: 'Coaching note',
  noteFrom: ({ who, when }: { who: string; when: string }) => `From ${who} · ${when}`,

  /** The page's states (L-01; T4 AC-7): its wait, and a reader it is not offered to. `on` a day already written. */
  loading: 'Loading your activation…',
  noneTitle: 'You have no 90-day activation.',
  noneLine: 'It is for people in their first months as an agent.',
  graduatedTitle: 'Your 90-day checklist is complete.',
  graduatedLine: ({ on }: { on: string }) => `You marked it complete on ${on}.`,
  expiredTitle: 'Your 90-day activation has ended.',
  expiredLine: ({ on }: { on: string }) => `It ran for six months, until ${on}.`,
  checklistElsewhere: 'Your checklist stays on your own coaching page.',
  ownCoaching: 'Your own coaching',

  /**
   * **The coaching *Activation* tab** (`components/activation-record.tsx`, `:6464-6489`; P13-T9): the card, an item's
   * state, its wait and a person with none, in the reader's language (P18.98-T4, coaching and unit).
   */
  record: {
    title: kept('90-Day Activation'),
    done: '✓ Done',
    doneNewActiveAgent: '✓ Done · New Active Agent',
    notDone: 'Not done',
    loading: 'Loading this activation…',
    coacheeNone: ({ name }: { name: string }) => `${name} has no 90-day activation.`,
    meNone: 'You have no 90-day activation.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Your 90-Day Activation'),
  subtitle: '90 hari pertama Anda, checklist demi checklist.',

  progressHeading: `Progres ${kept('activation')} Anda`,
  joinDate: 'Tanggal bergabung',
  graduate: 'Tandai checklist selesai',
  graduateLocked: ({ n }) => `Aktif setelah semua ${n} item selesai`,
  graduateQuestion: `Tandai checklist Anda selesai? Menu ${kept('90-Day Activation')} akan dihapus.`,
  confirm: 'Konfirmasi',
  cancel: 'Batal',
  graduated: `Ditandai sebagai agen senior — ${kept('90-Day Activation')} dihapus dari menu.`,
  footer: 'Hanya terlihat oleh agen baru, selama 6 bulan pertama mereka. Agen senior tidak akan melihat bagian ini.',

  day: 'Hari',
  completed: 'Selesai',
  pctComplete: ({ pct }) => `${pct} selesai`,
  aspect: 'Aspek',
  items: 'Item',
  status: 'Status',
  aspectStatus: { done: 'Selesai', in_progress: 'Berjalan', not_started: 'Belum dimulai' },
  overdue: ', terlambat',

  showNoteAndDate: 'Tampilkan catatan dan tanggal',
  notePlaceholder: 'Catatan (opsional)',
  itemNoteName: ({ label }) => `Catatan (opsional) — ${label}`,
  itemDateName: ({ label }) => `Tanggal — ${label}`,
  goTo: ({ label }) => `Buka ${label} →`,

  auto: 'Otomatis',
  autoTip: ({ completesWhen }) => `Selesai saat ${completesWhen}.`,
  autoName: ({ completesWhen }) => `Otomatis — selesai saat ${completesWhen}`,
  byHand: 'Dicentang manual',
  byHandTip: `Tautan ini tidak menyelesaikan item dengan sendirinya, jadi item ini dicentang oleh ${kept('new hire')} itu `
    + `atau salah satu ${kept('leader')}-nya.`,
  byHandName: `Dicentang manual — tautan ini tidak menyelesaikan item dengan sendirinya, jadi item ini dicentang oleh `
    + `${kept('new hire')} itu atau salah satu ${kept('leader')}-nya`,
  fromData: ({ label }) => `Dari ${label}`,

  you: 'Anda',
  tickedBy: ({ who, when }) => `Dicentang oleh ${who} · ${when}`,
  completedFromBy: ({ label, who, when }) => `Diselesaikan dari ${label} oleh ${who} · ${when}`,
  completedFrom: ({ label, when }) => `Diselesaikan dari ${label} · ${when}`,
  completedAutomatically: ({ when }) => `Selesai otomatis · ${when}`,
  waitingForData: ({ who }) => `Dicentang oleh ${who}, menunggu data`,
  correctedBy: ({ who, when }) => `Tanggal bergabung dikoreksi oleh ${who} · ${when}`,
  notSaved: ({ why }) => `Tidak tersimpan. ${why}`,
  saving: 'Menyimpan…',
  tryAgain: 'Coba lagi',

  whichCase: `${kept('Case')} yang mana?`,
  newClosing: `Catat ${kept('closing')} baru`,
  closingName: 'Dijual kepada',
  closingDate: 'Dibayar dan diterbitkan pada',
  noClosings: `Belum ada ${kept('closing')} di ${kept('Leads Management')}. Catat ${kept('case')} itu di bawah.`,
  loadingClosings: `Memuat ${kept('closings')}…`,
  logOneOnOne: `Catat ${kept('1:1')}`,
  oneOnOneDate: 'Diadakan pada',
  oneOnOneNote: 'Catatan',
  oneOnOnePlaceholder: 'Yang Anda bahas',
  save: 'Simpan',
  recordIncomplete: 'Isi semua kolom terlebih dahulu.',

  noteHeading: `Catatan ${kept('coaching')}`,
  noteFrom: ({ who, when }) => `Dari ${who} · ${when}`,

  loading: `Memuat ${kept('activation')} Anda…`,
  noneTitle: `Anda tidak punya ${kept('90-day activation')}.`,
  noneLine: 'Ini untuk orang di bulan-bulan pertamanya sebagai agen.',
  graduatedTitle: 'Checklist 90 hari Anda sudah selesai.',
  graduatedLine: ({ on }) => `Anda menandainya selesai pada ${on}.`,
  expiredTitle: `${kept('90-day activation')} Anda sudah berakhir.`,
  expiredLine: ({ on }) => `Berlangsung selama enam bulan, hingga ${on}.`,
  checklistElsewhere: `Checklist Anda tetap ada di halaman ${kept('coaching')} Anda sendiri.`,
  ownCoaching: `${kept('Coaching')} Anda sendiri`,

  record: {
    title: kept('90-Day Activation'),
    done: '✓ Selesai',
    doneNewActiveAgent: `✓ Selesai · ${kept('New Active Agent')}`,
    notDone: 'Belum selesai',
    loading: `Memuat ${kept('activation')} ini…`,
    coacheeNone: ({ name }) => `${name} tidak punya ${kept('90-day activation')}.`,
    meNone: `Anda tidak punya ${kept('90-day activation')}.`,
  },
};

export const activationMessages = defineMessages({ en, id });
