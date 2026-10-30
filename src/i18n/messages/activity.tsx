import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Activity Management's own words** (P18.98-T4, field selling; `functional/activity.md`,
 * `functional/activity-dashboard.md`, `functional/ratios.md`): *Log Activity* (`/activity/log`), the *Dashboard*
 * (`/activity/dashboard`, and its body `components/activity-dashboard.tsx`, which a coachee's *Activity* tab draws
 * too), the *Ratio* tab (`/activity/ratio`), and `/activity`'s hand-off.
 *
 * **English is the source** of the keys, the prototype's words as built (`Overall.html:2695-2782`, `:4811-5357`);
 * the Indonesian is the approved glossary's (OD-237; §B.0's voice), with the words it lacked added to the glossary for
 * approval's §B.10. **Kept English** (§A): the title and the nav item (*Activity Management*, *Activity management*),
 * the three tabs (*Log Activity · Dashboard · Ratio*), *KPM Owner*, *ratio* and *benchmark*; *office* is *KPM* in ID
 * mode (§B.9); a person is *dia* / *-nya*, the reader *Anda*. **Content is shown as typed** (ADR-0179 §5): a section's,
 * an activity type's and a ratio's names and descriptions, a ratio's purpose, and the server's refusal of a range.
 * **A message never writes a figure**: a day, a count and a percentage are written by the caller in the figures'
 * language and handed in; a count of days is the server's, the same digits in both languages. **A logged activity is
 * an *activity* — *aktivitas* — wherever a count of them is said** (UI V1, UI-106, the owner: *"aktivitas", not
 * "sentuhan"*); it was *touch* / *sentuhan* (`glossary.md` *Touch*) until 2026-10-30.
 *
 * @moved components/activity-tabs.tsx
 * @moved components/activity-dashboard.tsx
 * @moved components/summary-strip.tsx
 * @moved lib/activity.ts
 * @moved app/(agent)/activity/
 */
const en = {
  /** The heading above all three tabs: the nav item's words (P18.95-T9 AC-2), and the hand-off's wait. */
  title: kept('Activity Management'),
  takingYou: ({ tab }: { tab: string }) => `Taking you to ${tab}…`,

  /** *Log Activity* (`Overall.html:2695-2745`). */
  log: {
    subtitle: "Enter today's activities in 1 minute.",
    loading: 'Loading your day…',
    /** The save status under the date (`refreshSaveStatus`, `:4937-4958`): the saved day's own total. */
    saved: ({ n }: { n: number }) => `Saved · ${n} ${n === 1 ? 'activity' : 'activities'}`,
    notSaved: 'Not yet saved',
    date: 'Date',
    totalToday: 'Total activities today',
    /** A phone's one line (P18.95-T5 AC-1): *Today: 3 activities*, the count written by the caller in bold. */
    today: 'Today',
    dayLine: ({ day, count, n }: { day: string; count: ReactNode; n: number }) =>
      <>{day}: {count} {n === 1 ? 'activity' : 'activities'}</>,
    /** UI-106's save bar on a phone: what the unsaved counts add to the saved day. */
    newCount: ({ n }: { n: number }) => `${n} new ${n === 1 ? 'activity' : 'activities'}`,
    /** UI-106's date pill: the two arrows and the day between them, which opens the device's picker. */
    previousDay: 'Previous day',
    nextDay: 'Next day',
    chooseDay: 'Choose the day',
    notSetUp: 'Your office has not set up its activity types yet. Ask your KPM Owner — the list on this screen is '
      + 'theirs to define.',
    /** A section's count of items, its badge. */
    items: ({ n }: { n: number }) => (n === 1 ? '1 item' : `${n} items`),
    closedNothing: 'This day is closed, and nothing was logged for it.',
    /** A frozen day's reason (ADR-0042), and its hint: how often it has been corrected. */
    why: 'Why is this being corrected?',
    closedCorrected: ({ n }: { n: number }) =>
      `This day is closed, and has been corrected ${n === 1 ? 'once' : `${n} times`}.`,
    closed: 'This day is closed.',
    cancel: 'Cancel',
    saving: 'Saving…',
    saveCorrection: 'Save the correction',
    saveActivity: 'Save activity',
    /** Changing the date with unsaved counts asks first, in the product's own dialog. */
    unsaved: 'You have unsaved counts for this day. Discard them and open another day?',
    discard: 'Discard counts',
  },

  /** The *Dashboard* (`Overall.html:2737-2773`, `activity-management.md` §2.3). */
  dashboard: {
    subtitle: 'Your own activity, day by day.',
    /** The prototype's three ranges (`:2739-2743`). */
    ranges: {
      ROLLING_7D: 'Last 7 days',
      ROLLING_30D: 'Last 30 days',
      CUSTOM: 'Custom',
    },
    range: 'Range',
    /** UI-106's chips on a phone: *7 hari · 30 hari · Kustom*. */
    phoneRanges: {
      ROLLING_7D: '7 days',
      ROLLING_30D: '30 days',
      CUSTOM: 'Custom',
    },
    /** UI-106's line under the chips: the days only, *24 – 30 Okt 2026*, each written by the caller. */
    span: ({ from, to }: { from: string; to: string }) => `${from} – ${to}`,
    /** UI-106's group totals, as a screen reader hears the strip. */
    groupTotals: 'Totals by group',
    /** Why a custom range cannot be asked for: only what needs no server number. */
    chooseBoth: 'Choose both dates.',
    startsAfterEnd: 'The range starts after it ends.',
    endsAfterToday: ({ day }: { day: string }) => `The range ends after today, ${day}.`,
    from: 'From',
    to: 'To',
    /** Between the two dates. */
    toWord: 'to',
    /** The prototype's *Pick a valid range*, with its reason. */
    pickValid: ({ reason }: { reason: string }) => `Pick a valid range — ${reason}`,
    loading: 'Loading…',
    /** The table's name: the reader's, or a coachee's by name. */
    yours: 'Your activity',
    theirs: ({ name }: { name: string }) => `${name}’s activity`,
    loadingList: ({ caption }: { caption: string }) => `Loading ${caption.toLowerCase()}…`,
    /** The table's two first columns, and the skeleton's days. */
    activity: 'Activity',
    total: 'Total',
    day: ({ n }: { n: number }) => `Day ${n}`,
    /** How many days, and which: the count bold, the days written by the caller. */
    rangeDays: ({ days, n, from, to }: { days: ReactNode; n: number; from: string; to: string }) =>
      <>{days} {n === 1 ? 'day' : 'days'} · {from} – {to}</>,
    /** A longer range's columns (`Overall.html:5000-5050`). */
    week: ({ n }: { n: number }) => `Week ${n}`,
    remaining: ({ n }: { n: number }) => `Remaining ${n} ${n === 1 ? 'day' : 'days'}`,
    /** Why a row is not one of the sections shown today, in the words of whoever's days they are. */
    archived: 'Archived',
    notYours: 'No longer in your sections',
    notTheirs: ({ possessive }: { possessive: string }) => `No longer in ${possessive} sections`,
    /** The strip's total (ADR-0064), with its ⓘ. */
    totalTouches: 'Total activities',
    nothingLogged: 'Nothing logged in this range yet.',
    logActivity: kept('Log Activity'),
    /** The 30-day mode's first row (`renderDashboard`, `:5101-5116`). */
    totalAll: 'Total — all categories',
    /** Said between a phone's line's name and its total. */
    totalSaid: ', total ',
  },

  /** The *Ratio* tab (`Overall.html:2776-2782`, `:5197-5357`). */
  ratio: {
    subtitle: 'How your activity is converting.',
    working: 'Working out your ratios…',
    /** The prototype's note, without its second sentence; the window bold. */
    calculatedOn: ({ days, from, to, strong }: {
      days: number; from: string; to: string; strong: (words: string) => ReactNode;
    }) => <>Calculated on the {strong(`last ${days} days`)} of activity · {from} – {to}.</>,
    none: "Your office has no ratios for your role yet. Ratios are your KPM Owner's to set up.",
    notEnough: ({ days }: { days: number }) => `Not enough activity in the last ${days} days to work out your ratios yet.`,
    benchmark: kept('Benchmark'),
    /** A balance's two ends, named by what each side counts. */
    more: ({ side }: { side: string }) => `More ${side}`,
    notEnoughData: 'Not enough data yet.',
    band: ({ low, high }: { low: string; high: string }) => `On track while each side is between ${low} and ${high}.`,
    /** *What is this ratio?* — the prototype's tooltip as a disclosure. */
    whatIs: 'What is this ratio?',
    /** A balance's formula between its sides, drawn. */
    versus: 'vs',
    /** The formula in words, for a screen reader: *Submission polis divided by …*. */
    sum: ({ labels }: { labels: readonly string[] }) => labels.join(' plus '),
    against: ({ a, b }: { a: string; b: string }) => `${a}, against ${b}`,
    dividedBy: ({ a, b }: { a: string; b: string }) => `${a}, divided by ${b}`,
    ownFormula: 'Your office has set its own formula for this ratio.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Activity Management'),
  takingYou: ({ tab }) => `Membuka ${tab}…`,

  log: {
    subtitle: 'Catat aktivitas hari ini dalam 1 menit.',
    loading: 'Memuat catatan hari Anda…',
    saved: ({ n }) => `Tersimpan · ${n} aktivitas`,
    notSaved: 'Belum disimpan',
    date: 'Tanggal',
    totalToday: 'Total aktivitas hari ini',
    today: 'Hari ini',
    dayLine: ({ day, count }) => <>{day}: {count} aktivitas</>,
    newCount: ({ n }) => `${n} aktivitas baru`,
    previousDay: 'Hari sebelumnya',
    nextDay: 'Hari berikutnya',
    chooseDay: 'Pilih hari',
    notSetUp: `${kept('KPM')} Anda belum mengatur jenis aktivitasnya. Tanyakan kepada ${kept('KPM Owner')} Anda — `
      + 'daftar di layar ini mereka yang menentukan.',
    items: ({ n }) => `${n} item`,
    closedNothing: 'Hari tersebut sudah ditutup, dan tidak ada aktivitas yang tercatat.',
    why: 'Mengapa catatan ini dikoreksi?',
    closedCorrected: ({ n }) => `Hari tersebut sudah ditutup, dan sudah dikoreksi ${n} kali.`,
    closed: 'Hari tersebut sudah ditutup.',
    cancel: 'Batal',
    saving: 'Menyimpan…',
    saveCorrection: 'Simpan koreksi',
    saveActivity: 'Simpan aktivitas',
    unsaved: 'Ada jumlah yang belum disimpan untuk hari tersebut. Buang dan buka hari lain?',
    discard: 'Buang jumlah',
  },

  dashboard: {
    subtitle: 'Aktivitas Anda sendiri, hari demi hari.',
    ranges: {
      ROLLING_7D: '7 hari terakhir',
      ROLLING_30D: '30 hari terakhir',
      CUSTOM: 'Kustom',
    },
    range: 'Rentang',
    phoneRanges: {
      ROLLING_7D: '7 hari',
      ROLLING_30D: '30 hari',
      CUSTOM: 'Kustom',
    },
    span: ({ from, to }) => `${from} – ${to}`,
    groupTotals: 'Total per kelompok',
    chooseBoth: 'Pilih kedua tanggal.',
    startsAfterEnd: 'Rentang dimulai setelah tanggal akhirnya.',
    endsAfterToday: ({ day }) => `Rentang berakhir setelah hari ini, ${day}.`,
    from: 'Dari',
    to: 'Sampai',
    toWord: 'sampai',
    pickValid: ({ reason }) => `Pilih rentang yang valid — ${reason}`,
    loading: 'Memuat…',
    yours: 'Aktivitas Anda',
    theirs: ({ name }) => `Aktivitas ${name}`,
    loadingList: ({ caption }) => `Memuat ${caption.charAt(0).toLowerCase()}${caption.slice(1)}…`,
    activity: 'Aktivitas',
    total: 'Total',
    day: ({ n }) => `Hari ${n}`,
    rangeDays: ({ days, from, to }) => <>{days} hari · {from} – {to}</>,
    week: ({ n }) => `Minggu ${n}`,
    remaining: ({ n }) => `Sisa ${n} hari`,
    archived: 'Diarsipkan',
    notYours: 'Tidak lagi ada di bagian Anda',
    // A person is *dia* / *-nya* whatever their pronoun (§B.0 rule 8).
    notTheirs: () => 'Tidak lagi ada di bagiannya',
    totalTouches: 'Total aktivitas',
    nothingLogged: 'Belum ada yang tercatat dalam rentang ini.',
    logActivity: kept('Log Activity'),
    totalAll: 'Total — semua kategori',
    totalSaid: ', jumlah ',
  },

  ratio: {
    subtitle: 'Seberapa baik aktivitas Anda menghasilkan konversi.',
    working: `Menghitung ${kept('ratios')} Anda…`,
    calculatedOn: ({ days, from, to, strong }) =>
      <>Dihitung dari aktivitas {strong(`${days} hari terakhir`)} · {from} – {to}.</>,
    none: `${kept('KPM')} Anda belum memiliki ${kept('ratio')} untuk peran Anda. ${kept('Ratio')} diatur oleh `
      + `${kept('KPM Owner')} Anda.`,
    notEnough: ({ days }) => `Aktivitas dalam ${days} hari terakhir belum cukup untuk menghitung ${kept('ratio')} Anda.`,
    benchmark: kept('Benchmark'),
    more: ({ side }) => `Lebih banyak ${side}`,
    notEnoughData: 'Data belum cukup.',
    band: ({ low, high }) => `Sesuai target selama setiap sisi berada di antara ${low} dan ${high}.`,
    whatIs: `Apa itu ${kept('ratio')} ini?`,
    versus: 'vs',
    sum: ({ labels }) => labels.join(' ditambah '),
    against: ({ a, b }) => `${a}, dibanding ${b}`,
    dividedBy: ({ a, b }) => `${a}, dibagi ${b}`,
    ownFormula: `${kept('KPM')} Anda telah menetapkan rumusnya sendiri untuk ${kept('ratio')} ini.`,
  },
};

export const activityMessages = defineMessages({ en, id });
