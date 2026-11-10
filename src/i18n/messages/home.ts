import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Home** — `/home` (UI V1, 2026-10-30, Phase 18.11 T11; UI-100, UI-101; `functional/home.md`): the greeting, the
 * tiles, *Aksi hari ini*, *Laporan tim*, the 7-day chart and the WhatsApp reminder.
 *
 * *Changed 2026-11-07 (P19.8-T2; ADR-0228; MOB UI-163 to UI-170):* *Tim saya* is gone with its words; the button row
 * (*Buat proposal* is the proposal catalogue's, *Tambah user* here), *Leads*, *New hires*, the month chip of *Active
 * Agent*, *Laporan aktivitas tim* and *Tambah agent pertama →* are the 7 November revision's, word for word.
 *
 * **The Indonesian is the report's** where it gives the words (O-12: *Home's labels as given*) — *Pagi, AGUS*,
 * *Aktivitas saya*, *Jadwal hari ini*, *Aksi hari ini*, *Laporan tim*, *Coaching 7 hari*, *Kemarin*, *Tugas*, *meeting*,
 * *Kmrn*, *Hari ini*, *Semua*, *Dari:*, *Aktivitas 7 hari terakhir*, *Belum ada aktivitas 7 hari terakhir*, *+ Log* and
 * the reminder, word for word (Appendix A, UI-100, UI-101). The rest — *Siang*, *Sore*, *Malam*, the names a screen
 * reader hears — is proposed in the glossary's §B.10 (*Phase 18.11 T11*). *Active Agent {Bulan}* and *dari 12* are the
 * Unit Dashboard's own words (`unit-dashboard.ts`), read from there so the two tiles never differ. **Kept** (§A):
 * *Coaching*, *Unit*, *Group*, *Home*.
 *
 * **The quote of the day is not here**: it is shown in the language it was said in (the owner, 2026-10-30), served by
 * the API as content.
 *
 * @moved components/home/
 * @moved app/(agent)/home/
 */
const en = {
  /** The page's title in the tab and the nav: the greeting stands in the title row. */
  title: kept('Home'),
  /** *Pagi, AGUS* — the part of the day by the office's clock, and the first name in capitals. */
  greeting: {
    morning: ({ name }: { name: string }) => `Morning, ${name}`,
    midday: ({ name }: { name: string }) => `Afternoon, ${name}`,
    afternoon: ({ name }: { name: string }) => `Afternoon, ${name}`,
    evening: ({ name }: { name: string }) => `Evening, ${name}`,
  },
  loading: 'Loading your Home…',
  /** The quote card, for a screen reader: *Quote of the day, by Robert Collier*. */
  quoteLabel: ({ person }: { person: string }) => `Quote of the day, by ${person}`,
  tiles: {
    myActivity: 'My activity',
    /** *2 hari ini*: beside the number. */
    today: 'today',
    /** The chip: *Kemarin 5*, the figure bold. */
    yesterday: 'Yesterday',
    /** *+ Log*, in the number's place when today is 0. */
    log: 'Log',
    logLabel: 'Log today’s activity',
    schedule: 'Today’s schedule',
    /** *2 meeting*: beside the number. */
    meetings: ({ n }: { n: number }) => (n === 1 ? 'meeting' : 'meetings'),
    /** The chip: *Tugas 3*. */
    tasks: 'Tasks',
    coached: `${kept('Coaching')} 7 days`,
    /** *Leads* (P19.8-T2 AC-4; P19.9-T1 AC-5): every open lead the reader owns, as `/leads` opens on. A product word, kept. */
    leads: kept('Leads'),
    /** *New hires* (P19.8-T2 AC-4): the Group's new hires before a first sale. */
    newHires: kept('New hires'),
    /** *Active Agent* on a phone, its month a chip beside it (MOB UI-167). */
    activeAgent: kept('Active Agent'),
  },
  /** The button row above the tiles (P19.8-T2 AC-3; MOB UI-164, OD-277). *Buat proposal* is the proposal catalogue's. */
  buttons: {
    addUser: 'Add user',
  },
  actions: {
    heading: 'Today’s actions',
    all: 'All',
    allLabel: 'All of today in Calendar',
    /** The card's line when today holds nothing (P19.11-T1 AC-4; UXQ6), *Semua* still above it. */
    empty: 'Nothing scheduled for today.',
    /** The task rows' list, for a screen reader: the Calendar's *Tugas* (P19.11-T1 AC-3). */
    tasks: 'Today’s tasks',
    /** The event rows' list, for a screen reader. */
    events: 'Today’s events',
  },
  team: {
    /** *Laporan aktivitas tim* at every size (MOB UI-165, the owner's copy change). */
    heading: 'Team activity report',
    /** The *Unit | Group* pill, for a screen reader. */
    scopeLabel: `${kept('Unit')} or ${kept('Group')}`,
    unit: kept('Unit'),
    group: kept('Group'),
    /** The two day columns: short, over 52px cells. */
    yesterday: 'Yest.',
    yesterdayLong: 'Yesterday',
    today: 'Today',
    all: 'All',
    /** *Semua ›*: the rest of the scope, opened in place (P19.9-T2 AC-1; ADR-0235, OD-278 option 3). */
    allLabel: ({ n }: { n: number }) => `All ${n} people`,
    /** The same button once open: back to five. */
    fewer: 'Show fewer',
    /** A day with no report: the grey ✕'s name (MOB UI-165). */
    notReported: 'Not reported',
    /** A scope with nobody in it: the card's one line (MOB UI-166, ADR-0228 §6), to New Hires. */
    firstAgent: 'Add your first agent →',
    /**
     * **The WhatsApp reminder** (UI-101), typed into WhatsApp for the person: `both` when they reported neither day
     * (*hari ini* → *kemarin & hari ini*). `link` opens today's Log Activity; `leader` is the reader's first name.
     */
    reminder: ({ name, both, link, leader }: { name: string; both: boolean; link: string; leader: string }) =>
      `Hi ${name} 👋 ${both ? 'Yesterday’s & today’s' : 'Today’s'} activity isn’t filled in yet. Report it, it takes 1 minute: ${link} – ${leader}`,
  },
  chart: {
    heading: 'Activity, last 7 days',
    /** The header's total: *18 aktivitas*. */
    total: ({ n }: { n: number }) => (n === 1 ? '1 activity' : `${n} activities`),
    /** The last bar's day. */
    today: 'Today',
    /** The chart, for a screen reader: each day and its count. */
    label: 'Your activity per day, last 7 days',
    day: ({ day, n }: { day: string; n: number }) => `${day}: ${n}`,
    empty: 'No activity in the last 7 days',
  },
  /**
   * **The reminder's link preview** (UI-101): `og:title` on `/activity/log`, what WhatsApp shows under the link, in the
   * language the pages are prerendered in (`app/(agent)/activity/log/layout.tsx`).
   */
  linkPreview: `Report today’s activity · ${kept('AgencyBoost')}`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Home'),
  greeting: {
    morning: ({ name }) => `Pagi, ${name}`,
    midday: ({ name }) => `Siang, ${name}`,
    afternoon: ({ name }) => `Sore, ${name}`,
    evening: ({ name }) => `Malam, ${name}`,
  },
  loading: `Memuat ${kept('Home')} Anda…`,
  quoteLabel: ({ person }) => `Kutipan hari ini, dari ${person}`,
  tiles: {
    myActivity: 'Aktivitas saya',
    today: 'hari ini',
    yesterday: 'Kemarin',
    log: 'Log',
    logLabel: 'Catat aktivitas hari ini',
    schedule: 'Jadwal hari ini',
    meetings: () => 'meeting',
    tasks: 'Tugas',
    coached: `${kept('Coaching')} 7 hari`,
    leads: kept('Leads'),
    newHires: kept('New hires'),
    activeAgent: kept('Active Agent'),
  },
  buttons: {
    addUser: 'Tambah user',
  },
  actions: {
    heading: 'Aksi hari ini',
    all: 'Semua',
    allLabel: 'Semua untuk hari ini di Kalender',
    empty: 'Tidak ada tugas atau jadwal hari ini.',
    tasks: 'Tugas hari ini',
    events: 'Event hari ini',
  },
  team: {
    heading: 'Laporan aktivitas tim',
    scopeLabel: `${kept('Unit')} atau ${kept('Group')}`,
    unit: kept('Unit'),
    group: kept('Group'),
    yesterday: 'Kmrn',
    yesterdayLong: 'Kemarin',
    today: 'Hari ini',
    all: 'Semua',
    allLabel: ({ n }) => `Semua ${n} orang`,
    fewer: 'Lebih sedikit',
    notReported: 'Belum lapor',
    firstAgent: 'Tambah agent pertama →',
    reminder: ({ name, both, link, leader }) =>
      `Halo ${name} 👋 Aktivitas ${both ? 'kemarin & hari ini' : 'hari ini'} belum diisi. Yuk lapor, 1 menit: ${link} – ${leader}`,
  },
  chart: {
    heading: 'Aktivitas 7 hari terakhir',
    total: ({ n }) => `${n} aktivitas`,
    today: 'Hari ini',
    label: 'Aktivitas Anda per hari, 7 hari terakhir',
    day: ({ day, n }) => `${day}: ${n}`,
    empty: 'Belum ada aktivitas 7 hari terakhir',
  },
  linkPreview: `Lapor aktivitas hari ini · ${kept('AgencyBoost')}`,
};

export const homeMessages = defineMessages({ en, id });
