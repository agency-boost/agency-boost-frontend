import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **New Hires** (P18.98-T4, new hires and activation; `functional/activation.md`, *3M activation and `/new-hires`*;
 * `functional/org-hierarchy.md`, *Adding an agent*): the leader's `/new-hires` — the **3M activation %** with its
 * filter and its units, the three sections as tables and as a phone's cards, a row's result, *Schedule 1:1* and *Mark
 * left* — one hire's `/new-hires/[membershipId]` — the way back, the join date's correction, the coaching note, how an
 * activation that is over ended — and the page's joining half: *Review requests (n)* and *Waiting to join*. The parts the
 * hire's page draws the same way are `activation.ts`'; *+ Add agent* and its share step are `add-agent.ts`'.
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:3354-3416`, `:6734-6894`), the
 * client's report's (*3M activation %*, *In progress (day 1–90)*, *Activated*, *Not activated*, *Left*, *Schedule 1:1*,
 * *Mark left*) and ours. The Indonesian is the approved glossary's — *Batal · Coba lagi · Tutup · Kirim ulang · Batalkan
 * undangan* (§B.1), *Pemindahan diajukan* (§B.2), *Berjalan · Teraktivasi · Tidak teraktivasi · Keluar {date}* (§B.3),
 * *Nama · Aksi · Tanggal bergabung* (§B.4), *Bulan bergabung*, *Terlambat* (§B.10); *office* is *KPM* (§B.9) — with what it
 * lacked proposed in the glossary for approval's §B.10. **Kept** (§A): the title, *3M activation %*, *First sale* (a
 * metric's name), *Direct Unit* and the roles, *90-Day Activation*, *activation*, *new hire(s)*, *coaching*, *1:1*,
 * *leader*, *unit*. A person is *dia* (§B.0 rule 8).
 *
 * **Typed content stays as typed**: a name, an agent code, a note. **A figure is never a message's**: a date, a month
 * or a percentage is written by the caller in the figures' language and passed in.
 *
 * @moved components/new-hires.tsx
 * @moved components/new-hires-joining.tsx
 * @moved components/waiting-to-join.tsx
 * @moved app/(agent)/new-hires/
 */
const en = {
  /** The roster's title, the nav item's words (P18.95-T9 AC-2), and its line (`:3354-3361`). */
  title: kept('New Hires'),
  subtitle: "Track your new agents' 90-day activation progress.",
  loading: 'Loading your new hires…',
  /** Nobody who joined as a new hire in the year it lists (P18.96-T6). */
  empty: 'No one you lead joined as a new hire in the last 12 months.',

  /**
   * The 3M activation % (P18.96-T6 AC-2, AC-3): its counts, a share over nobody decided, its filter. **UI V1 (UI-023)**:
   * *Aktivasi 3M*, the percentage alone — the counts and the month filter are no longer drawn.
   */
  activation3M: '3M activation rate',
  counts: ({ activated, notActivated, inProgress }: { activated: number; notActivated: number; inProgress: number }) =>
    `${activated} activated · ${notActivated} not activated · ${inProgress} in progress`,
  noFigureName: 'No result yet',
  joinMonth: 'Join month',
  allMonths: 'All',
  byUnit: 'By unit',
  /** A unit's name (D-group): the reader's own, or the nearest leader's below them by their rung. */
  directUnit: kept('Direct Unit'),
  aabUnit: ({ name }: { name: string }) => `${kept('AAB')}: ${name}`,
  abUnit: ({ name }: { name: string }) => `${kept('AB')}: ${name}`,

  /** The three sections, and a row's result (the client's report, R4). */
  sections: { inProgress: 'In progress (day 1–90)', activated: 'Activated', notActivated: 'Not activated' },
  sectionEmpty: 'No one here.',
  result3M: { in_progress: 'In progress', activated: 'Activated', not_activated: 'Not activated' },
  /** After *Activated*, for a first sale after day 90 (UI-023, D-24): outside the 3M share. */
  late3M: 'after 3M',
  columns: {
    name: 'Name',
    joinDate: 'Join date',
    day: 'Day',
    checklist: 'Checklist',
    firstSale: kept('First sale'),
    result: 'Result',
    actions: 'Actions',
  },
  /** A new hire with no checklist: an AB or an AAB placed as one (ADR-0103). */
  noChecklist: 'No checklist',
  /** A phone's card (P18.95-T3 AC-4; UI-012): the day in words, and the two dates, each written or *—*. */
  dayOf: ({ day, of }: { day: string; of: number }) => `Day ${day} of ${of}`,
  cardDates: ({ join, firstSale }: { join: string; firstSale: string }) => `Join date ${join} · First sale ${firstSale}`,

  /** *Schedule 1:1* (P18.96-T6 AC-4; UI-027's detail button): its name begins with its visible words (WCAG 2.5.3). */
  scheduleOneOnOne: 'Schedule 1:1',
  scheduleOneOnOneName: ({ name }: { name: string }) => `Schedule 1:1 with ${name}`,
  cancel: 'Cancel',
  tryAgain: 'Try again',

  /** One hire's activation, as a leader reads it (`:3363-3416`). `on` and `from` are days already written. */
  detail: {
    back: 'Back to New Hires',
    subtitle: 'You can update their 90-Day Activation status, plus your coaching note.',
    heading: 'Activation progress',
    loading: 'Loading this activation…',
    statusUpdated: 'Activation status updated.',
    startDateRange: ({ from }: { from: string }) => `Choose a date from ${from} to today.`,
    startSaved: 'Join date updated.',
    /** How an activation that is over ended, in the subtitle's place (parity L-89); `by` a name or *you*. */
    closedGraduated: ({ by, on }: { by: string; on: string }) => `Marked complete by ${by} on ${on}.`,
    closedExpired: ({ on }: { on: string }) => `Ended on ${on}, six months after it started.`,
    notFoundTitle: 'This person isn’t one of your new hires.',
    notFoundLine: 'They may have moved to another leader, or the address may be mistyped.',
  },

  /** The leader's coaching note (`.notes-card`, `:3407-3414`; OD-117): the prototype's hint, example and button. */
  note: {
    hint: 'Visible to this agent on their own 90-Day Activation page.',
    example: "e.g. Great pace on prospecting — let's focus on booking your first joint field work this week.",
    save: 'Save note',
    saving: 'Saving…',
    saved: ({ name }: { name: string }) => `Coaching note saved — visible to ${name}.`,
    savedBy: ({ who, when }: { who: string; when: string }) => `Last saved by ${who} · ${when}`,
    empty: 'Write a note before saving.',
  },

  /**
   * **UI V1 — the list** (UI-024, D-24): two tiles, the filter, a tree of leaders, a row per person. `n` a count, `day`
   * a day number; the words around them only.
   */
  list: {
    waiting: 'Waiting to join',
    waitingOpen: ({ n }: { n: number }) => `Waiting to join: ${n}. Show them`,
    filterName: 'Show',
    filter: {
      all: ({ n }: { n: number }) => `All ${n}`,
      activated: ({ n }: { n: number }) => `Activated ${n}`,
      not_yet: ({ n }: { n: number }) => `Not yet ${n}`,
    },
    /** A leader's row: the reader's own group, or the unit below by its rung, and how many it holds. */
    ownGroup: ({ n }: { n: number }) => `You · ${kept('Direct Unit')} · ${n}`,
    aabGroup: ({ n }: { n: number }) => `${kept('AAB')} · ${n}`,
    abGroup: ({ n }: { n: number }) => `${kept('AB')} · ${n}`,
    groupShare: ({ name }: { name: string }) => `${name}’s 3M activation`,
    /** A person's one meta line (UI-024, Appendix A). */
    firstSaleOnDay: ({ day }: { day: number }) => `First sale on day ${day}`,
    dayN: ({ day }: { day: number }) => `Day ${day}`,
    /** The status circle's words, for a screen reader and the table's *Status*. */
    status: { activated: 'Activated', activated_late: 'Activated after 3M', not_yet: 'Not yet' },
    columns: { name: 'Name', status: 'Status', checklist: 'Checklist' },
    noWaiting: 'Nobody is waiting to join.',
  },

  /** **UI V1 — one hire** (UI-027, D-25, D-26): the header, the strip, the tiles, the buttons, First Sale's date. */
  hire: {
    back: 'Back to New Hires',
    more: ({ name }: { name: string }) => `More for ${name}`,
    correctJoinDate: 'Correct join date',
    /** The header's line: their leader by rung and name, or *you* — then the join date, written. */
    joinedUnder: ({ role, leader, on }: { role: string; leader: string; on: string }) => `${role} ${leader} · Joined ${on}`,
    joinedUnderYou: ({ on }: { on: string }) => `You · Joined ${on}`,
    joined: ({ on }: { on: string }) => `Joined ${on}`,
    /** The strip: `on` the first sale's short day. */
    strip: ({ day }: { day: number }) => `Activated · first sale on day ${day}`,
    stripLate: ({ day }: { day: number }) => `Activated · first sale on day ${day} · after 3M`,
    stripChange: 'Change the first sale date',
    day: 'Day',
    threeMDone: '3M done',
    checklist: kept('Activation checklist'),
    whatsApp: 'WhatsApp',
    whatsAppName: ({ name }: { name: string }) => `WhatsApp ${name}`,
    /** First Sale's *Close first case independently*: its date pill, or the way to give one. */
    addDate: 'Add date',
    changeDate: ({ on }: { on: string }) => `${on}, change the date`,
    sheetTitle: 'When was the first sale?',
    sheetLine: ({ from, to }: { from: string; to: string }) => `The day they closed their first case on their own · between ${from} and ${to}`,
    today: 'today',
    dateLabel: 'First sale date',
    save: 'Save',
    saved: 'Saved',
    /** *Dicatat oleh* (D-26): who recorded a first sale by hand, and when. */
    recordedBy: ({ who, when }: { who: string; when: string }) => `Recorded by ${who} · ${when}`,
    /** A section's count, for a screen reader: `done` of `total`. */
    sectionCount: ({ done, total }: { done: number; total: number }) => `${done} of ${total} done`,
  },

  /** **+ Add agent's modal** (UI-024): what sending the invite says. Its share block's toasts are the confirmations'. */
  invite: {
    sent: ({ name }: { name: string }) => `Invite sent to ${name}`,
  },

  /** The header's *Review requests (n)* and the inbox it opens (ADR-0170 §5), and what *+ Add agent* did. */
  joining: {
    review: ({ n }: { n: number }) => `Review requests (${n})`,
    inboxTitle: 'Review requests',
    inboxLine: 'Approve to add them to your unit, with the day they joined.',
    close: 'Close',
    linked: ({ name }: { name: string }) => `${name} is in your unit now.`,
    transfer: ({ name }: { name: string }) => `${name} moves when the office approves it.`,
  },

  /** *Waiting to join* (ADR-0170 §2, §4): the client's *Invited, waiting to join*, *Resend*, *Cancel invite*. */
  waiting: {
    heading: 'Waiting to join',
    invited: 'Invited, waiting to join',
    expired: 'Invite expired',
    transfer: 'Transfer requested',
    resend: 'Resend',
    resending: 'Resending…',
    cancelInvite: 'Cancel invite',
    keep: 'Keep it',
    cancelAsk: ({ name }: { name: string }) => `Cancel the invite for ${name}? Its link stops working.`,
    /** `day` written in the figures' language. */
    joinDate: ({ day }: { day: string }) => `Join date ${day}`,
    intoUnit: ({ leader }: { leader: string }) => `Into ${leader}’s unit`,
    officeDecides: 'The office decides',
    done: 'Done',
    shareTitle: ({ name }: { name: string }) => `Invite ${name}`,
    /** The ⋯ on a row (UI-024): its name. */
    actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('New Hires'),
  subtitle: `Pantau progres ${kept('90-day activation')} agen baru Anda.`,
  loading: `Memuat ${kept('new hires')} Anda…`,
  empty: `Tidak ada orang yang Anda pimpin yang bergabung sebagai ${kept('new hire')} dalam 12 bulan terakhir.`,

  activation3M: 'Aktivasi 3M',
  counts: ({ activated, notActivated, inProgress }) =>
    `${activated} teraktivasi · ${notActivated} tidak teraktivasi · ${inProgress} berjalan`,
  noFigureName: 'Belum ada hasil',
  joinMonth: 'Bulan bergabung',
  allMonths: 'Semua',
  byUnit: `Per ${kept('unit')}`,
  directUnit: kept('Direct Unit'),
  aabUnit: ({ name }) => `${kept('AAB')}: ${name}`,
  abUnit: ({ name }) => `${kept('AB')}: ${name}`,

  sections: { inProgress: 'Berjalan (hari 1–90)', activated: 'Teraktivasi', notActivated: 'Tidak teraktivasi' },
  sectionEmpty: 'Tidak ada siapa pun di sini.',
  result3M: { in_progress: 'Berjalan', activated: 'Teraktivasi', not_activated: 'Tidak teraktivasi' },
  late3M: 'lewat 3M',
  columns: {
    name: 'Nama',
    joinDate: 'Tanggal bergabung',
    day: 'Hari',
    checklist: 'Checklist',
    firstSale: kept('First sale'),
    result: 'Hasil',
    actions: 'Aksi',
  },
  noChecklist: 'Tanpa checklist',
  dayOf: ({ day, of }) => `Hari ke-${day} dari ${of}`,
  cardDates: ({ join, firstSale }) => `Tanggal bergabung ${join} · ${kept('First sale')} ${firstSale}`,

  scheduleOneOnOne: `Jadwalkan ${kept('1:1')}`,
  scheduleOneOnOneName: ({ name }) => `Jadwalkan ${kept('1:1')} dengan ${name}`,
  cancel: 'Batal',
  tryAgain: 'Coba lagi',

  detail: {
    back: `Kembali ke ${kept('New Hires')}`,
    subtitle: `Anda dapat memperbarui status ${kept('90-Day Activation')} agen ini, serta catatan ${kept('coaching')} Anda.`,
    heading: `Progres ${kept('activation')}`,
    loading: `Memuat ${kept('activation')} ini…`,
    statusUpdated: `Status ${kept('activation')} diperbarui.`,
    startDateRange: ({ from }) => `Pilih tanggal dari ${from} sampai hari ini.`,
    startSaved: 'Tanggal bergabung diperbarui.',
    closedGraduated: ({ by, on }) => `Ditandai selesai oleh ${by} pada ${on}.`,
    closedExpired: ({ on }) => `Berakhir pada ${on}, enam bulan setelah dimulai.`,
    notFoundTitle: `Orang ini bukan ${kept('new hire')} Anda.`,
    notFoundLine: `Dia mungkin sudah pindah ke ${kept('leader')} lain, atau alamatnya salah ketik.`,
  },

  note: {
    hint: `Terlihat oleh agen ini di halaman ${kept('90-Day Activation')} miliknya.`,
    example: 'Contoh: Langkah mencari prospek sudah bagus — minggu ini mari fokus menjadwalkan kerja lapangan bersama '
      + 'pertama Anda.',
    save: 'Simpan catatan',
    saving: 'Menyimpan…',
    saved: ({ name }) => `Catatan ${kept('coaching')} tersimpan — terlihat oleh ${name}.`,
    savedBy: ({ who, when }) => `Terakhir disimpan oleh ${who} · ${when}`,
    empty: 'Tulis catatan sebelum menyimpan.',
  },

  list: {
    waiting: 'Menunggu bergabung',
    waitingOpen: ({ n }) => `Menunggu bergabung: ${n}. Tampilkan`,
    filterName: 'Tampilkan',
    filter: {
      all: ({ n }) => `Semua ${n}`,
      activated: ({ n }) => `Teraktivasi ${n}`,
      not_yet: ({ n }) => `Belum ${n}`,
    },
    ownGroup: ({ n }) => `Anda · ${kept('Direct Unit')} · ${n}`,
    aabGroup: ({ n }) => `${kept('AAB')} · ${n}`,
    abGroup: ({ n }) => `${kept('AB')} · ${n}`,
    groupShare: ({ name }) => `Aktivasi 3M ${name}`,
    firstSaleOnDay: ({ day }) => `Pecah telor di hari ke-${day}`,
    dayN: ({ day }) => `Hari ke-${day}`,
    status: { activated: 'Teraktivasi', activated_late: 'Teraktivasi, lewat 3M', not_yet: 'Belum' },
    columns: { name: 'Nama', status: 'Status', checklist: 'Checklist' },
    noWaiting: 'Tidak ada yang menunggu bergabung.',
  },

  hire: {
    back: `Kembali ke ${kept('New Hires')}`,
    more: ({ name }) => `Pilihan lain untuk ${name}`,
    correctJoinDate: 'Koreksi tanggal bergabung',
    joinedUnder: ({ role, leader, on }) => `${role} ${leader} · Bergabung ${on}`,
    joinedUnderYou: ({ on }) => `Anda · Bergabung ${on}`,
    joined: ({ on }) => `Bergabung ${on}`,
    strip: ({ day }) => `Teraktivasi · pecah telor hari ke-${day}`,
    stripLate: ({ day }) => `Teraktivasi · pecah telor hari ke-${day} · lewat 3M`,
    stripChange: 'Ubah tanggal pecah telor',
    day: 'Hari',
    threeMDone: '3M selesai',
    checklist: kept('Activation checklist'),
    whatsApp: 'WhatsApp',
    whatsAppName: ({ name }) => `WhatsApp ${name}`,
    addDate: 'Isi tanggal',
    changeDate: ({ on }) => `${on}, ubah tanggal`,
    sheetTitle: 'Kapan pecah telor?',
    sheetLine: ({ from, to }) => `Tanggal first case ditutup sendiri · antara ${from} dan ${to}`,
    today: 'hari ini',
    dateLabel: 'Tanggal pecah telor',
    save: 'Simpan',
    saved: 'Tersimpan',
    recordedBy: ({ who, when }) => `Dicatat oleh ${who} · ${when}`,
    sectionCount: ({ done, total }) => `${done} dari ${total} selesai`,
  },

  invite: {
    sent: ({ name }) => `Undangan terkirim ke ${name}`,
  },

  joining: {
    review: ({ n }) => `Tinjau permintaan (${n})`,
    inboxTitle: 'Tinjau permintaan',
    inboxLine: `Setujui untuk menambahkan mereka ke ${kept('unit')} Anda, beserta tanggal mereka bergabung.`,
    close: 'Tutup',
    linked: ({ name }) => `${name} sekarang ada di ${kept('unit')} Anda.`,
    transfer: ({ name }) => `${name} pindah setelah ${kept('KPM')} menyetujuinya.`,
  },

  waiting: {
    heading: 'Menunggu bergabung',
    invited: 'Diundang, menunggu bergabung',
    expired: 'Undangan kedaluwarsa',
    transfer: 'Pemindahan diajukan',
    resend: 'Kirim ulang',
    resending: 'Mengirim ulang…',
    cancelInvite: 'Batalkan undangan',
    keep: 'Jangan batalkan',
    cancelAsk: ({ name }) => `Batalkan undangan untuk ${name}? Tautannya tidak akan berfungsi lagi.`,
    joinDate: ({ day }) => `Tanggal bergabung ${day}`,
    intoUnit: ({ leader }) => `Ke ${kept('unit')} ${leader}`,
    officeDecides: `${kept('KPM')} yang memutuskan`,
    done: 'Selesai',
    shareTitle: ({ name }) => `Undang ${name}`,
    actionsFor: ({ name }) => `Tindakan untuk ${name}`,
  },
};

export const newHiresMessages = defineMessages({ en, id });
