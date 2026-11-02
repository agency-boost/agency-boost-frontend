import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The calendar, in words** (P18.98-T4, events, campaigns and the calendar; `functional/calendar.md`, *The calendar's
 * own strings*): the entry types, the toolbar — *Today*, ‹ ›, *Week · Month* and a phone's *Agenda* and *Filters* — the
 * compare bar and its popover, the week's and the month's panes and a phone's agenda, an entry's name, the detail and
 * entry dialogs with *Block time*, the invite field, *Hide my personal activities*, and every refusal the calendar words
 * itself (`lib/calendar.ts`, `lib/calendar-form.ts`).
 *
 * **English is the source**: the prototype's words where it draws them (`AgencyBoost_Calendar_Section.html`; ADR-0096),
 * ours where it does not. The Indonesian is the approved glossary's — *Hari ini* (§B.7), *Ubah · Hapus · Tutup · Batal*
 * (§B.1), *Judul · Jenis · Tanggal* (§B.4), *Tampilan* and *Unit langsung* (§B.10) — with what it lacked proposed in the
 * glossary for approval's §B.10 (*Sibuk*, *Penyelenggara*, *Blok waktu*, *Rapat internal* …); a calendar is a *kalender*,
 * an entry an *entri* and time placed on somebody's calendar *diblok* (the API's). **Kept** (§A): *Calendar*, *Week ·
 * Month* (§A.3) and *Agenda* beside them, *event* (§A.6; *Event created ✓ → Event dibuat ✓*), *1:1*, *coaching*,
 * *KPM*, *AAB*, *unit*, *downline*, *Leader*. **Typed content stays as typed**: an entry's title and notes, a person's
 * name and rung. **A figure is never a message's**: a day, a time, a range and a limit are written by the caller in the
 * figures' language and passed in; the weekday and month names are the formatters' (P18.98-T3).
 *
 * @moved lib/calendar.ts
 * @moved lib/calendar-form.ts
 * @moved lib/calendar-layout.ts
 * @moved components/calendar/
 * @moved app/(agent)/calendar/
 */

/** What the reader owes an entry, said after its name: an answer, or nothing (it was placed on them). */
type Owes = 'waiting' | 'placed' | null;

const OWES_EN = { waiting: ', waiting for your answer', placed: ', placed on your calendar' };

const en = {
  /** The page's title (`:276`): the nav item (§A.1). */
  title: kept('Calendar'),
  /** The five types (`:310-314`, `:370-374`): the legend's, the toggle's, the badge's and every entry's name. */
  types: {
    meeting: 'Internal meeting',
    coaching: '1:1 coaching',
    client: 'Client meeting',
    task: 'Task',
    travel: 'Travel',
  },

  /** The toolbar (`:278-305`). */
  today: 'Today',
  week: kept('Week'),
  month: kept('Month'),
  agenda: kept('Agenda'),
  filters: 'Filters',
  view: 'View',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  newEvent: '+ New event',

  /** The compare bar and its popover (`:296-307`, `:905-965`). */
  viewing: 'Viewing:',
  myCalendar: 'My Calendar',
  compare: '+ Compare with downline',
  searchDownline: 'Search your downline…',
  added: ' · added ✓',
  compareCap: ({ max }: { max: number }) => `You're comparing ${max} people already — remove one below to add another.`,
  downlineGroups: { direct_unit: 'Direct unit', group: 'AAB & their teams (group)' },
  lost: ({ name }: { name: string }) => `You can no longer view ${name}'s calendar.`,
  /** A person's tag: the rung by its badge's name, then whom they report to unless it is the reader. */
  under: ({ rung, leader }: { rung: string; leader: string }) => `${rung} · under ${leader}`,

  /** The panes (`:317-349`), a phone's agenda, and the reader's own head, *AB · You*. */
  you: 'You',
  dragToBlock: 'Drag to block',
  /** After the pill's visible words, read and never drawn: *"Drag to block: Block time — {name}"* (WCAG 2.5.3). */
  blockPillSuffix: ({ name }: { name: string }) => `: Block time — ${name}`,
  region: ({ range }: { range: string }) => `Calendar, ${range}`,
  comparedRegion: ({ name, range }: { name: string; range: string }) => `Calendar, ${name}, ${range}`,
  busy: 'Busy',
  /** A busy block's tooltip: *"Busy, 09.00–09.30"*. */
  busyAt: ({ time }: { time: string }) => `Busy, ${time}`,
  noEvents: 'No events',
  /** After a phone's month cell's date, where its lines are dots; `count` written by the caller. */
  eventCount: ({ n, count }: { n: number; count: string }) => (n === 1 ? '1 event' : `${count} events`),
  /** *"+{n} more…"* (F4): the count, drawn at every width; the rest drawn from 640px. */
  moreCount: ({ n }: { n: number }) => `+${n}`,
  moreRest: ' more…',
  /**
   * **An entry's name** — *{type}: {title}, {time}* and what the reader owes it — the words drawn on it, so a voice user
   * can say what they see (WCAG 2.5.3). `time` the grid's, `''` for a trip.
   */
  entryName: ({ type, title, time, owes }: { type: string; title: string; time: string; owes: Owes }) =>
    `${type}: ${title}${time ? `, ${time}` : ''}${owes ? OWES_EN[owes] : ''}`,
  /** A month's line: its time first, as drawn — *{type}: 09.00 {title}*. */
  lineName: ({ type, time, title, owes }: { type: string; time: string; title: string; owes: Owes }) =>
    `${type}: ${time ? `${time} ` : ''}${title}${owes ? OWES_EN[owes] : ''}`,
  /** What the reader owes, after an entry's name: a pending invitation, and time placed on them. */
  owes: OWES_EN,
  untitled: '(untitled event)',

  /** The detail dialog (`:422-449`, `:817-853`). */
  when: 'When',
  where: 'Location / notes',
  invitees: 'Invitees',
  noOneElse: 'No one else invited',
  organiser: 'Organiser',
  accepted: 'Accepted',
  declined: 'Declined',
  noAnswer: 'No answer yet',
  /** After the name, so a placed member's chip reads *{name}, time placed by the organiser*. */
  placedChip: ', time placed by the organiser',
  accept: 'Accept',
  decline: 'Decline',
  answeredAccepted: 'Invitation accepted.',
  answeredDeclined: 'Invitation declined. It is no longer on your calendar.',
  close: 'Close',
  edit: 'Edit',
  delete: 'Delete',
  cancel: 'Cancel',
  /** The prototype's question less its second sentence, which a soft delete makes false (H-06, I-101). */
  deleteQuestion: ({ title }: { title: string }) => `Delete "${title}"?`,
  /** A meeting link in *Location / notes* (P18.95-T8 AC-2), and what a screen reader hears after it. */
  joinZoom: 'Join Zoom',
  joinMeeting: 'Join meeting',
  newTab: ', opens in a new tab',

  /** The entry dialog (`:354-420`). */
  newTitle: 'New event',
  newSub: 'Add a meeting, task, or coaching session to your calendar.',
  editTitle: 'Edit event',
  editSub: 'Update the details below.',
  blockTitle: ({ name }: { name: string }) => `Block time — ${name}`,
  blockSub: 'This goes straight onto their calendar — no approval needed, they\'ll just see it appear.',
  /** *Block time*'s note: the member's name bold. */
  inviting: ({ name }: { name: ReactNode }) => <>Inviting {name} to this slot</>,
  /** A 1:1's title, *Block time*'s and `/new-hires`' *Schedule 1:1* (L-65): the writer's words, typed into the field. */
  oneOnOneWith: ({ name }: { name: string }) => `1:1 with ${name}`,
  type: 'Type',
  fieldTitle: 'Title',
  titlePlaceholder: 'e.g. Weekly unit standup',
  date: 'Date',
  start: 'Start',
  end: 'End',
  departure: 'Departure date',
  return: 'Return date',
  notesLabel: 'Notes / location',
  notesPlaceholder: 'Zoom link, office, or agenda notes',
  saveEvent: 'Save event',

  /** The invite field (`:381-386`, `:855-903`) and its groups (`:469-480`). */
  inviteLabel: 'Invite (optional) — anyone in your KPM',
  invitePlaceholder: 'Search your KPM by name…',
  peopleGroups: {
    direct_unit: 'Your direct unit',
    group: 'Your group (AAB teams)',
    other: 'Other units in your KPM',
    leadership: 'KPM leadership',
  },
  remove: ({ name }: { name: string }) => `Remove ${name}`,
  searching: 'Searching…',
  noMatches: 'No matches.',
  listFailed: 'The list couldn\'t be loaded.',

  /** The form's rules, each under its own field; the limits written by the caller from their constants (m3). */
  chooseDate: 'Choose a date.',
  endAfterStart: 'Choose an end time after the start.',
  returnAfterDeparture: 'Choose a return date on or after the departure date.',
  tripTooLong: ({ max }: { max: string }) => `A trip can be at most ${max} days.`,
  titleTooLong: ({ max }: { max: string }) => `Keep the title to ${max} characters.`,
  notesTooLong: ({ max }: { max: string }) => `Keep the notes to ${max} characters.`,
  tooManyInvitees: ({ max }: { max: string }) => `You can invite at most ${max} people.`,
  conflict: 'This entry was changed somewhere else, so it has been read again.',
  notInvitable: 'Someone you invited can\'t be invited any more. Remove them and save again.',
  gone: 'This entry isn\'t on your calendar any more.',
  loadFailed: 'The calendar couldn\'t be loaded.',
  tryAgain: 'Try again',
  loading: 'Loading the calendar…',

  /** *Hide my personal activities* (ADR-0110): the client's words, what it does, and a refused save. */
  hideDetails: 'Hide my personal activities',
  hideDetailsTip: 'Leaders who view your calendar see only "Busy" and the time. People you invite still see the details.',
  hideDetailsFailed: 'Your setting couldn\'t be saved, so it has been put back.',

  /**
   * **UI V1, 2026-10-30 (UI-104)**: the fourth view, *Tugas* — the checklist, the count row, the popup, a tick and its
   * *Urungkan* — the sources a task or an event comes from, a trip's day and the Trip row, the travel switch, the 1:1's
   * coaching buttons and the type chips' *Event*. The report's words where it gives them (*Tugas*, *Dari*, *Selesai ·
   * Urungkan*, *Sepanjang hari*, *Hari x/y*, *Trip*, *Start coaching session*, *Coach <name>*, *Pick who to coach*).
   */
  three_days: '3 Days',
  previousDays: 'Previous 3 days',
  nextDays: 'Next 3 days',
  tasks: 'Tasks',
  tasksCount: ({ count }: { count: string }) => `Tasks · ${count}`,
  /** The popup's title: *Tasks · Mon, 28 Sep (4)*; the day and the count written by the caller. */
  tasksTitle: ({ day, count }: { day: string; count: string }) => `Tasks · ${day} (${count})`,
  /** A count pill's name: what it opens. */
  tasksOn: ({ day, count }: { day: string; count: string }) => `Tasks on ${day}: ${count}`,
  /** A compared person's tasks in the Agenda: *INDAH PERMATASARI · Tasks 2*. */
  personTasks: ({ name, count }: { name: string; count: string }) => `${name} · Tasks ${count}`,
  /** A coaching task's top line: who coached the person. */
  from: ({ name }: { name: string }) => `From: ${name}`,
  /** A task's checkbox, named by what it ticks. */
  markDone: ({ name }: { name: string }) => `Done: ${name}`,
  done: 'Done',
  undo: 'Undo',
  taskFailed: 'That task couldn\'t be updated. Try again.',
  openLead: ({ name }: { name: string }) => `Open ${name}`,
  openSession: ({ name }: { name: string }) => `Open the 1:1 with ${name}`,
  sources: { lead: kept('Lead'), coaching: kept('Coaching'), event: kept('Event') },
  /** A joined event's name: the type is the office's, as typed. */
  joinedName: ({ title, type, time }: { title: string; type: string; time: string }) =>
    `${kept('Event')}: ${title} (${type})${time ? `, ${time}` : ''}`,
  tripDay: ({ n, of }: { n: number; of: number }) => `Day ${n}/${of}`,
  allDay: 'All day',
  startDate: 'Start date',
  endDate: 'End date',
  tripEndAfterStart: 'Choose an end after the start.',
  startCoaching: 'Start coaching session',
  coachPerson: ({ name }: { name: string }) => `Coach ${name}`,
  pickWhoToCoach: 'Pick who to coach',
  eventChip: kept('Event'),
};

const OWES_ID = { waiting: ', menunggu jawaban Anda', placed: ', diblok di kalender Anda' };

const id: MessagesOf<typeof en> = {
  title: kept('Calendar'),
  types: {
    meeting: 'Rapat internal',
    coaching: `${kept('Coaching')} ${kept('1:1')}`,
    client: 'Pertemuan nasabah',
    task: 'Tugas',
    travel: 'Perjalanan',
  },

  today: 'Hari ini',
  week: kept('Week'),
  month: kept('Month'),
  agenda: kept('Agenda'),
  filters: 'Filter',
  view: 'Tampilan',
  previousWeek: 'Minggu sebelumnya',
  nextWeek: 'Minggu berikutnya',
  previousMonth: 'Bulan sebelumnya',
  nextMonth: 'Bulan berikutnya',
  newEvent: `+ ${kept('Event')} baru`,

  viewing: 'Melihat:',
  myCalendar: 'Kalender saya',
  compare: `+ Bandingkan dengan ${kept('downline')}`,
  searchDownline: `Cari ${kept('downline')} Anda…`,
  added: ' · ditambahkan ✓',
  compareCap: ({ max }) => `Anda sudah membandingkan ${max} orang — hapus satu di bawah untuk menambah yang lain.`,
  downlineGroups: { direct_unit: `${kept('Unit')} langsung`, group: `${kept('AAB')} & timnya (grup)` },
  lost: ({ name }) => `Anda tidak dapat lagi melihat kalender ${name}.`,
  under: ({ rung, leader }) => `${rung} · di bawah ${leader}`,

  you: 'Anda',
  dragToBlock: 'Seret untuk blok',
  blockPillSuffix: ({ name }) => `: Blok waktu — ${name}`,
  region: ({ range }) => `Kalender, ${range}`,
  comparedRegion: ({ name, range }) => `Kalender, ${name}, ${range}`,
  busy: 'Sibuk',
  busyAt: ({ time }) => `Sibuk, ${time}`,
  noEvents: `Tidak ada ${kept('event')}`,
  // A kept noun keeps its English plural (§B.0 rule 8): *1 event*, *3 events*.
  eventCount: ({ n, count }) => (n === 1 ? `1 ${kept('event')}` : `${count} ${kept('events')}`),
  moreCount: ({ n }) => `+${n}`,
  moreRest: ' lainnya…',
  entryName: ({ type, title, time, owes }) => `${type}: ${title}${time ? `, ${time}` : ''}${owes ? OWES_ID[owes] : ''}`,
  lineName: ({ type, time, title, owes }) => `${type}: ${time ? `${time} ` : ''}${title}${owes ? OWES_ID[owes] : ''}`,
  owes: OWES_ID,
  untitled: `(${kept('event')} tanpa judul)`,

  when: 'Kapan',
  where: 'Lokasi / catatan',
  invitees: 'Yang diundang',
  noOneElse: 'Tidak ada orang lain yang diundang',
  organiser: 'Penyelenggara',
  accepted: 'Diterima',
  declined: 'Ditolak',
  noAnswer: 'Belum ada jawaban',
  placedChip: ', waktu diblok oleh penyelenggara',
  accept: 'Terima',
  decline: 'Tolak',
  answeredAccepted: 'Undangan diterima.',
  answeredDeclined: 'Undangan ditolak. Undangan ini tidak lagi ada di kalender Anda.',
  close: 'Tutup',
  edit: 'Ubah',
  delete: 'Hapus',
  cancel: 'Batal',
  deleteQuestion: ({ title }) => `Hapus "${title}"?`,
  joinZoom: 'Gabung Zoom',
  joinMeeting: 'Gabung rapat',
  newTab: ', terbuka di tab baru',

  newTitle: `${kept('Event')} baru`,
  newSub: `Tambahkan rapat, tugas, atau sesi ${kept('coaching')} ke kalender Anda.`,
  editTitle: `Ubah ${kept('event')}`,
  editSub: 'Perbarui detail di bawah.',
  blockTitle: ({ name }) => `Blok waktu — ${name}`,
  blockSub: 'Ini langsung masuk ke kalendernya — tanpa persetujuan, dia akan langsung melihatnya.',
  inviting: ({ name }) => <>Mengundang {name} ke slot ini</>,
  oneOnOneWith: ({ name }) => `${kept('1:1')} dengan ${name}`,
  type: 'Jenis',
  fieldTitle: 'Judul',
  titlePlaceholder: `mis. Standup ${kept('unit')} mingguan`,
  date: 'Tanggal',
  start: 'Mulai',
  end: 'Selesai',
  departure: 'Tanggal berangkat',
  return: 'Tanggal kembali',
  notesLabel: 'Catatan / lokasi',
  notesPlaceholder: 'Tautan Zoom, tempat, atau catatan agenda',
  saveEvent: `Simpan ${kept('event')}`,

  inviteLabel: `Undang (opsional) — siapa pun di ${kept('KPM')} Anda`,
  invitePlaceholder: `Cari nama di ${kept('KPM')} Anda…`,
  peopleGroups: {
    direct_unit: `${kept('Unit')} langsung Anda`,
    group: `Grup Anda (tim ${kept('AAB')})`,
    other: `${kept('Unit')} lain di ${kept('KPM')} Anda`,
    leadership: `Pimpinan ${kept('KPM')}`,
  },
  remove: ({ name }) => `Hapus ${name}`,
  searching: 'Mencari…',
  noMatches: 'Tidak ada yang cocok.',
  listFailed: 'Daftar tidak dapat dimuat.',

  chooseDate: 'Pilih tanggal.',
  endAfterStart: 'Pilih jam selesai setelah jam mulai.',
  returnAfterDeparture: 'Pilih tanggal kembali yang sama dengan atau setelah tanggal berangkat.',
  tripTooLong: ({ max }) => `Perjalanan paling lama ${max} hari.`,
  titleTooLong: ({ max }) => `Judul paling banyak ${max} karakter.`,
  notesTooLong: ({ max }) => `Catatan paling banyak ${max} karakter.`,
  tooManyInvitees: ({ max }) => `Anda dapat mengundang paling banyak ${max} orang.`,
  conflict: 'Entri ini diubah di tempat lain, jadi sudah dimuat ulang.',
  notInvitable: 'Ada orang yang Anda undang yang tidak dapat diundang lagi. Hapus dia, lalu simpan lagi.',
  gone: 'Entri ini tidak lagi ada di kalender Anda.',
  loadFailed: 'Kalender tidak dapat dimuat.',
  tryAgain: 'Coba lagi',
  loading: 'Memuat kalender…',

  hideDetails: 'Sembunyikan aktivitas pribadi saya',
  hideDetailsTip: `${kept('Leader')} yang melihat kalender Anda hanya melihat "Sibuk" dan jamnya. Orang yang Anda undang tetap melihat detailnya.`,
  hideDetailsFailed: 'Pengaturan Anda tidak dapat disimpan, jadi dikembalikan seperti semula.',

  three_days: '3 Hari',
  previousDays: '3 hari sebelumnya',
  nextDays: '3 hari berikutnya',
  tasks: 'Tugas',
  tasksCount: ({ count }) => `Tugas · ${count}`,
  tasksTitle: ({ day, count }) => `Tugas · ${day} (${count})`,
  tasksOn: ({ day, count }) => `Tugas pada ${day}: ${count}`,
  personTasks: ({ name, count }) => `${name} · Tugas ${count}`,
  from: ({ name }) => `Dari: ${name}`,
  markDone: ({ name }) => `Selesai: ${name}`,
  done: 'Selesai',
  undo: 'Urungkan',
  taskFailed: 'Tugas itu tidak dapat diperbarui. Coba lagi.',
  openLead: ({ name }) => `Buka ${name}`,
  openSession: ({ name }) => `Buka ${kept('1:1')} dengan ${name}`,
  sources: { lead: kept('Lead'), coaching: kept('Coaching'), event: kept('Event') },
  joinedName: ({ title, type, time }) => `${kept('Event')}: ${title} (${type})${time ? `, ${time}` : ''}`,
  tripDay: ({ n, of }) => `Hari ${n}/${of}`,
  allDay: 'Sepanjang hari',
  startDate: 'Tanggal mulai',
  endDate: 'Tanggal selesai',
  tripEndAfterStart: 'Pilih akhir setelah awal.',
  startCoaching: `Mulai sesi ${kept('coaching')}`,
  coachPerson: ({ name }) => `${kept('Coaching')} ${name}`,
  pickWhoToCoach: `Pilih siapa yang di-${kept('coaching')}`,
  eventChip: kept('Event'),
};

export const calendarMessages = defineMessages({ en, id });
