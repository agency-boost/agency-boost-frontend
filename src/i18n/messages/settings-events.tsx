import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Settings › Events, in words** (P18.98-T4, events, campaigns and the calendar; `functional/events.md`,
 * `functional/tenant-config.md`): the screen's line, its two tabs, an event's row and its phase, the add-and-edit panel,
 * the event types' list and form, and the toolbar. The frame every settings screen draws, and its shared controls —
 * *Save*, *Cancel*, *Edit*, *Archive*, *Restore*, *Show archived*, *Code*, *Name* — are `settings.ts`'; *View feedback*
 * and what it opens are `events-office.ts`'.
 *
 * **English is the source**, as built (the prototype's *Events* settings is a table of `alert()`s, `KPM_Owner.html:1647-1662`).
 * The Indonesian is the approved glossary's — *Judul · Jenis · Deskripsi* (§B.4), *Akan datang · Sudah lewat* (§B.3),
 * *KPM ini* and *KPM* for *office* (§B.9) — with what it lacked proposed in the glossary for approval's §B.10. **Kept**
 * (§A): the title and its two tabs, *event* (§A.6), *leader*. **Typed content stays as typed**: an event's title, blurb
 * and place, a type's label and emoji. **A figure is never a message's**: an event's day is written by the caller in the
 * figures' language.
 *
 * @moved app/(tenant)/kpm/settings/events/
 */

/** Words drawn bold inside a sentence. */
type Strong = (words: string) => ReactNode;

const en = {
  title: kept('Events'),
  subtitle: 'What your office is running, and who is invited.',
  tabs: { events: kept('Events'), types: kept('Event types') },
  /** Who puts an event on, and who is invited (the issuer and the scope, which the prototype crams into one string). */
  issuers: { kpm: 'This office', company: 'Your company', group: 'A group' },
  scopes: {
    all_agents: 'Everybody in the office',
    leaders: 'Leaders — anybody with somebody under them',
    select_agents: 'Chosen people',
    select_leaders: 'Chosen leaders',
  },
  /** An event's phase, worked out on every read. */
  phases: { upcoming: 'Upcoming', running: 'Happening now', past: 'Past' },
  noActiveTypes: ({ strong }: { strong: Strong }) => (
    <>
      You have no active event types, so there is nothing to file an event under. Add one on
      the {strong(kept('Event types'))} tab first.
    </>
  ),
  empty: 'No events yet. Anything your office runs goes here — training, launches, recognition nights.',
  /** A row's line: *"… · 3 invited"*. */
  invited: ({ n }: { n: number }) => `${n} invited`,
  /** The panel. */
  fieldTitle: 'Title',
  codeHintEditing: 'Permanent — it never changes.',
  codeHintNew: 'Filled in from the title. Permanent.',
  type: 'Type',
  blurb: 'One line about it',
  starts: 'Starts',
  startsHint: 'Your office’s time.',
  ends: 'Ends',
  endsHint: 'Required — without it nothing can say whether the event is running now.',
  where: 'Where',
  putOnBy: 'Put on by',
  whoIsInvited: 'Who is invited',
  pickSomebody: 'Pick at least one person below to save.',
  leaderMeans: 'A leader is somebody with people under them — not a job title.',
  saveEvent: 'Save the event',
  addEvent: 'Add the event',
  /** The event types. */
  emoji: 'Emoji',
  emojiHint: 'The poster is an emoji.',
  codeHintType: 'Permanent.',
  noTypes: 'No event types yet.',
  /** A type's badge: how many events are filed under it. */
  events: ({ n }: { n: number }) => `${n} ${n === 1 ? 'event' : 'events'}`,
  archiveTypeTip: ({ n }: { n: number }) =>
    `Keeps the ${n} event(s) already filed under it readable, and stops new ones being added.`,
  /** The toolbar's add buttons. */
  addType: 'Add an event type',
  addAnEvent: 'Add an event',
};

const id: MessagesOf<typeof en> = {
  title: kept('Events'),
  subtitle: `Apa yang diadakan ${kept('KPM')} Anda, dan siapa yang diundang.`,
  tabs: { events: kept('Events'), types: kept('Event types') },
  issuers: { kpm: `${kept('KPM')} ini`, company: 'Perusahaan Anda', group: 'Sebuah grup' },
  scopes: {
    all_agents: `Semua orang di ${kept('KPM')}`,
    leaders: `${kept('Leader')} — siapa pun yang punya orang di bawahnya`,
    select_agents: 'Orang terpilih',
    select_leaders: `${kept('Leader')} terpilih`,
  },
  phases: { upcoming: 'Akan datang', running: 'Sedang berlangsung', past: 'Sudah lewat' },
  noActiveTypes: ({ strong }) => (
    <>
      Anda belum punya jenis {kept('event')} yang aktif, jadi belum ada tempat untuk mencatat {kept('event')}.
      Tambahkan satu di tab {strong(kept('Event types'))} terlebih dahulu.
    </>
  ),
  empty: `Belum ada ${kept('event')}. Semua yang diadakan ${kept('KPM')} Anda ada di sini — pelatihan, peluncuran, malam penghargaan.`,
  invited: ({ n }) => `${n} diundang`,
  fieldTitle: 'Judul',
  codeHintEditing: 'Permanen — tidak pernah berubah.',
  codeHintNew: 'Diisi dari judul. Permanen.',
  type: 'Jenis',
  blurb: `Satu kalimat tentang ${kept('event')} ini`,
  starts: 'Mulai',
  startsHint: `Waktu ${kept('KPM')} Anda.`,
  ends: 'Selesai',
  endsHint: `Wajib — tanpanya tidak ada yang bisa memastikan apakah ${kept('event')} sedang berlangsung.`,
  where: 'Tempat',
  putOnBy: 'Diadakan oleh',
  whoIsInvited: 'Siapa yang diundang',
  pickSomebody: 'Pilih minimal satu orang di bawah untuk menyimpan.',
  leaderMeans: `${kept('Leader')} adalah orang yang punya anggota di bawahnya — bukan jabatan.`,
  saveEvent: `Simpan ${kept('event')}`,
  addEvent: `Tambahkan ${kept('event')}`,
  emoji: 'Emoji',
  emojiHint: 'Posternya berupa emoji.',
  codeHintType: 'Permanen.',
  noTypes: `Belum ada jenis ${kept('event')}.`,
  // A kept noun keeps its English plural (§B.0 rule 8): *1 event*, *3 events*.
  events: ({ n }) => `${n} ${n === 1 ? kept('event') : kept('events')}`,
  archiveTypeTip: ({ n }) =>
    `${kept('Event')} yang sudah tercatat dengan jenis ini (${n}) tetap dapat dibaca, dan ${kept('event')} baru tidak dapat ditambahkan.`,
  addType: `Tambah jenis ${kept('event')}`,
  addAnEvent: `Tambah ${kept('event')}`,
};

export const settingsEventsMessages = defineMessages({ en, id });
