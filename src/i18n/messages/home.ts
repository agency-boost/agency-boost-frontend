import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Home** — `/home` (UI V1, 2026-10-30, Phase 18.99 T11; UI-100, UI-101; `functional/home.md`): the greeting, the
 * tiles, *Aksi hari ini*, *Laporan tim*, the 7-day chart and the WhatsApp reminder.
 *
 * **The Indonesian is the report's** where it gives the words (O-12: *Home's labels as given*) — *Pagi, AGUS*,
 * *Aktivitas saya*, *Jadwal hari ini*, *Aksi hari ini*, *Laporan tim*, *Coaching 7 hari*, *Kemarin*, *Tugas*, *meeting*,
 * *Kmrn*, *Hari ini*, *Semua*, *Dari:*, *Aktivitas 7 hari terakhir*, *Belum ada aktivitas 7 hari terakhir*, *+ Log* and
 * the reminder, word for word (Appendix A, UI-100, UI-101). The rest — *Siang*, *Sore*, *Malam*, the names a screen
 * reader hears — is proposed in the glossary's §B.10 (*Phase 18.99 T11*). *Active Agent {Bulan}* and *dari 12* are the
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
  },
  actions: {
    heading: 'Today’s actions',
    all: 'All',
    allLabel: 'All of today in Calendar',
    /** A coaching item's top line: *Dari: WILSON TANOTO*. */
    from: ({ name }: { name: string }) => `From: ${name}`,
    /** An agenda row's line under its title: its type, and its day when it is not today. */
    typeOn: ({ type, day }: { type: string; day: string }) => `${type} · ${day}`,
  },
  team: {
    heading: 'Team report',
    /** The *Unit | Group* pill, for a screen reader. */
    scopeLabel: `${kept('Unit')} or ${kept('Group')}`,
    unit: kept('Unit'),
    group: kept('Group'),
    /** The two day columns: short, over 52px cells. */
    yesterday: 'Yest.',
    yesterdayLong: 'Yesterday',
    today: 'Today',
    all: 'All',
    allLabel: ({ n }: { n: number }) => `Show all ${n}`,
    /** A scope with nobody in it: an AB's *Unit* when every agent of theirs leads a unit. */
    empty: 'Nobody in this scope yet.',
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
  },
  actions: {
    heading: 'Aksi hari ini',
    all: 'Semua',
    allLabel: 'Semua untuk hari ini di Kalender',
    from: ({ name }) => `Dari: ${name}`,
    typeOn: ({ type, day }) => `${type} · ${day}`,
  },
  team: {
    heading: 'Laporan tim',
    scopeLabel: `${kept('Unit')} atau ${kept('Group')}`,
    unit: kept('Unit'),
    group: kept('Group'),
    yesterday: 'Kmrn',
    yesterdayLong: 'Kemarin',
    today: 'Hari ini',
    all: 'Semua',
    allLabel: ({ n }) => `Tampilkan semua ${n}`,
    empty: 'Belum ada orang di sini.',
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
