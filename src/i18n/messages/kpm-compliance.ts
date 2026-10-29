import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **KPM Analytics' *Compliance, Events, and Campaigns*, in words** (P18.98-T4, the office reporting;
 * `functional/kpm-analytics.md`, *Compliance*): the heading and its counted sub-line, the six chips, Training's tabs, the
 * event and campaign pickers, Activity's note, search and sort, the tree's sections, cards and rows, each status pill
 * (`lib/kpm-compliance.ts`), and the override of a final campaign standing (`components/analytics/standing-override.tsx`,
 * `lib/standing-override.ts`).
 *
 * **English is the source** of the keys, the prototype's words as built (`KPM_Owner.html:1262-1286`, `:3449-4118`); the
 * Indonesian is the approved glossary's (OD-237; §B.3's status words), with the words it lacked added to the glossary for
 * approval's §B.10. **Kept in both languages** (§A): the heading, the six chips (the tree's tabs, §A.3), *Skills*,
 * *Modules*, the roles and the jargon. **Content stays as typed**: a training category's, a skill's and a module's name,
 * an event's and a campaign's title, a member's name and an override's reason. **A figure is never a message's**: a
 * date is written by its caller in the figures' language and passed in.
 *
 * @moved app/kpm/analytics/compliance/page.tsx
 * @moved components/analytics/compliance-screen.tsx
 * @moved components/analytics/compliance-parts.tsx
 * @moved components/analytics/compliance-pickers.tsx
 * @moved components/analytics/compliance-summary.tsx
 * @moved components/analytics/compliance-tree.tsx
 * @moved components/analytics/standing-override.tsx
 * @moved lib/kpm-compliance.ts
 * @moved lib/standing-override.ts
 */

/** What the column's words and verbs follow: the status column, or one of the two-column trees. */
type Kind = 'status' | 'events' | 'campaigns';

const en = {
  /** The status pills (`CATEGORIES`, `:3013-3020`; the events row `:3716-3722`; the campaigns row `:3895-3900`). */
  labels: {
    completed: 'Completed',
    inProgress: 'In progress',
    notStarted: 'Not started',
    set: 'Set',
    notSet: 'Not set',
    logged: 'Logged',
    missed: 'Missed',
    overdue: 'Overdue',
    registered: 'Registered',
    notRegistered: 'Not registered',
    attended: 'Attended',
    noShow: 'No-show',
    shared: 'Shared',
    notShared: 'Not shared',
    chasing: 'Chasing',
    notChasing: 'Not chasing',
    achieved: 'Achieved',
    notAchieved: 'Not achieved',
  },

  /** The heading (`:1265-1268`), a tab's name (§A.3), and its sub-line — *"in this KPM"*, the client's (OD-39). */
  title: kept('Compliance, Events, and Campaigns'),
  sub: ({ people, units }: { people: number; units: number }) =>
    `Every AB's unit in this KPM — ${people} ${people === 1 ? 'person' : 'people'} across ${units} ${units === 1 ? 'unit' : 'units'}`,
  /** The six chips (`:3013-3020`): the tree's tabs, kept (§A.3). */
  chips: {
    training: kept('Training'),
    goals: kept('Goal Setting'),
    activity: kept('Activity Mgmt'),
    activation: kept('Activation'),
    events: kept('Events'),
    campaigns: kept('Campaigns'),
  },
  /** The Activity chip's `title` and the note strip under the tabs (`:3016`, `:3549-3555`). */
  activityTooltip: 'Whether activity was logged at least once in the past 7 days — there\'s no partial state, only Logged or Missed.',
  /** A training category with no module, pressed (`:4026-4034`). */
  comingSoon: ({ name }: { name: string }) => `Modules for ${name} are coming soon.`,
  searchPlaceholder: 'Search agent or leader name…',
  noMatch: 'No one matches this search.',
  /** The sort toggle's label: the order it will show (`:3672-3684`); its arrow is the screen's, not read aloud. */
  sort: {
    status: { worst: 'Needs attention first', best: 'On track first' },
    events: { worst: 'Not joined first', best: 'Joined first' },
    campaigns: { worst: 'Not chasing first', best: 'Chasing first' },
  },
  personal: 'Personal',
  tagAb: kept('AB'),
  /** A card's title (`:3698`): the head's unit. */
  unitOf: ({ name }: { name: string }) => `${name}'s Unit`,
  /** A card's figure, *"3 / 5 done"*, and a section's, *"12 / 28 done overall"* (`:3698`, `:3735`, `:3911`). */
  verb: ({ kind }: { kind: Kind }) => ({ status: 'done', events: 'joined', campaigns: 'chasing' })[kind],
  verbOverall: ({ kind }: { kind: Kind }) =>
    ({ status: 'done overall', events: 'joined overall', campaigns: 'chasing overall' })[kind],
  /** The two-column trees' headings (`:3725-3730`, `:3906-3909`). */
  columns: {
    events: { first: 'Joined', second: 'Feedback' },
    campaigns: { first: 'Chasing', second: 'Achieved' },
  },
  /** The pickers' groups (`:3574-3577`, `:3594-3596`) and the picked one's tag (`:3586`, `:3600-3601`). */
  eventGroups: { upcoming: 'Upcoming', past: 'Past' },
  campaignGroups: { structural: 'Structural', ongoing: 'Seasonal — Ongoing', past: 'Seasonal — Past' },
  tags: { upcoming: 'Upcoming', past: 'Past', structural: 'Structural', ongoing: 'Ongoing' },
  alwaysOn: 'Always on',
  /** A campaign's date label (`CAMPAIGN_ITEMS`, `:3002-3011`): the day is its caller's, in the figures' language. */
  since: ({ date }: { date: string }) => `Since ${date}`,
  ended: ({ date }: { date: string }) => `Ended ${date}`,

  /** The module's own: the states the prototype lacks and the names a screen reader needs (Fills, L-01). */
  loading: 'Loading each unit’s statuses…',
  tryAgain: 'Try again',
  /** After a `404` on the item in the address: its category's default, which a retry would never reach. */
  backTo: ({ category }: { category: string }) => `Back to ${category}`,
  /** The chip's dash over nobody (D-chips), named. */
  noRate: 'No rate: nobody to count',
  chipsName: 'Categories',
  trainingCategoriesName: 'Training categories',
  skillsName: kept('Skills'),
  modulesName: kept('Modules'),
  eventName: kept('Event'),
  campaignName: kept('Campaign'),
  searchName: 'Search agent or leader name',
  noAbTitle: 'There are no ABs yet.',
  noAbLine: 'Each AB’s agency gets a section here, with a row for each of its people.',
  noTraining: 'No training has been published yet.',
  noEvents: 'There are no events this year.',
  noCampaigns: 'There are no campaigns this year.',
  /** A running event's tag: the phase word (contradiction 8). */
  running: 'Running',
  /** An upcoming seasonal campaign's date: *"Since"* a day still ahead would not be true (contradiction 8). */
  starts: ({ date }: { date: string }) => `Starts ${date}`,
  /** An expired activation's *Overdue* (OD-159, ADR-0149): its end, the accessible name and the tooltip both. */
  expiredName: ({ date }: { date: string }) => `Overdue: ended on ${date} without being marked complete`,
  /** A past event's *—* for a member nobody has confirmed yet (D-status), for a screen reader. */
  awaitingConfirmation: 'awaiting confirmation',

  /** **The override of a final standing** (P18.6-T2 AC-8; ADR-0144 §4): our words, the prototype draws none. */
  override: {
    /** The cell's button, after the pill's own word (WCAG 2.5.3), and the dialog's title. */
    overrideFor: ({ name, campaign }: { name: string; campaign: string }) => `Override ${name}’s result for ${campaign}`,
    /** The icon's name and tooltip: who, on which day of the office's calendar, and why — the reason as typed. */
    overriddenBy: ({ name, day, reason }: { name: string; day: string; reason: string }) =>
      `Overridden by ${name} on ${day}: ${reason}`,
    resultNow: 'Result now',
    newResult: 'New result',
    reason: 'Reason',
    save: 'Save',
    clear: 'Clear override',
    close: 'Close',
    saved: 'Result overridden',
    cleared: 'Override cleared',
  },
};

const id: MessagesOf<typeof en> = {
  labels: {
    completed: 'Selesai',
    inProgress: 'Berjalan',
    notStarted: 'Belum dimulai',
    set: 'Sudah diatur',
    notSet: 'Belum diatur',
    logged: 'Tercatat',
    missed: 'Terlewat',
    overdue: 'Terlambat',
    registered: 'Terdaftar',
    notRegistered: 'Belum terdaftar',
    attended: 'Hadir',
    noShow: 'Tidak hadir',
    shared: 'Sudah diisi',
    notShared: 'Belum diisi',
    chasing: 'Mengejar',
    notChasing: 'Tidak mengejar',
    achieved: 'Tercapai',
    notAchieved: 'Tidak tercapai',
  },

  title: kept('Compliance, Events, and Campaigns'),
  // A kept noun keeps its English plural (§B.0 rule 8): *1 unit*, *5 units*; *orang* has one form.
  sub: ({ people, units }) =>
    `Setiap ${kept('unit')} ${kept('AB')} di ${kept('KPM')} ini — ${people} orang di ${units} ${units === 1 ? kept('unit') : kept('units')}`,
  chips: {
    training: kept('Training'),
    goals: kept('Goal Setting'),
    activity: kept('Activity Mgmt'),
    activation: kept('Activation'),
    events: kept('Events'),
    campaigns: kept('Campaigns'),
  },
  activityTooltip: 'Apakah aktivitas tercatat setidaknya sekali dalam 7 hari terakhir — tidak ada status sebagian, hanya Tercatat atau Terlewat.',
  // *module* in a sentence is *modul* (§B.10, approved 2026-10-29); the tab's name stays kept.
  comingSoon: ({ name }) => `Modul untuk ${name} segera hadir.`,
  searchPlaceholder: `Cari nama agent atau ${kept('leader')}…`,
  noMatch: 'Tidak ada yang cocok dengan pencarian ini.',
  sort: {
    status: { worst: 'Perlu perhatian lebih dulu', best: 'Sesuai target lebih dulu' },
    events: { worst: 'Belum ikut lebih dulu', best: 'Sudah ikut lebih dulu' },
    campaigns: { worst: 'Tidak mengejar lebih dulu', best: 'Mengejar lebih dulu' },
  },
  personal: 'Pribadi',
  tagAb: kept('AB'),
  unitOf: ({ name }) => `${kept('Unit')} ${name}`,
  verb: ({ kind }) => ({ status: 'selesai', events: 'ikut', campaigns: 'mengejar' })[kind],
  verbOverall: ({ kind }) =>
    ({ status: 'selesai secara keseluruhan', events: 'ikut secara keseluruhan', campaigns: 'mengejar secara keseluruhan' })[kind],
  columns: {
    events: { first: 'Ikut', second: 'Masukan' },
    campaigns: { first: 'Mengejar', second: 'Tercapai' },
  },
  eventGroups: { upcoming: 'Akan datang', past: 'Sudah lewat' },
  campaignGroups: { structural: 'Struktural', ongoing: 'Musiman — Berjalan', past: 'Musiman — Sudah lewat' },
  tags: { upcoming: 'Akan datang', past: 'Sudah lewat', structural: 'Struktural', ongoing: 'Berjalan' },
  alwaysOn: 'Selalu aktif',
  since: ({ date }) => `Sejak ${date}`,
  ended: ({ date }) => `Berakhir ${date}`,

  loading: `Memuat status setiap ${kept('unit')}…`,
  tryAgain: 'Coba lagi',
  backTo: ({ category }) => `Kembali ke ${category}`,
  noRate: 'Tanpa persentase: tidak ada yang dihitung',
  chipsName: 'Kategori',
  trainingCategoriesName: `Kategori ${kept('Training')}`,
  skillsName: kept('Skills'),
  modulesName: kept('Modules'),
  eventName: kept('Event'),
  campaignName: kept('Campaign'),
  searchName: `Cari nama agent atau ${kept('leader')}`,
  noAbTitle: `Belum ada ${kept('AB')}.`,
  noAbLine: `Setiap agensi ${kept('AB')} mendapat satu bagian di sini, dengan satu baris untuk setiap anggotanya.`,
  noTraining: 'Belum ada pelatihan yang diterbitkan.',
  noEvents: `Tidak ada ${kept('event')} tahun ini.`,
  noCampaigns: `Tidak ada ${kept('campaign')} tahun ini.`,
  running: 'Berjalan',
  starts: ({ date }) => `Mulai ${date}`,
  expiredName: ({ date }) => `Terlambat: berakhir pada ${date} tanpa ditandai selesai`,
  awaitingConfirmation: 'menunggu konfirmasi',

  override: {
    overrideFor: ({ name, campaign }) => `Ubah hasil ${name} untuk ${campaign}`,
    overriddenBy: ({ name, day, reason }) => `Diubah oleh ${name} pada ${day}: ${reason}`,
    resultNow: 'Hasil saat ini',
    newResult: 'Hasil baru',
    reason: 'Alasan',
    save: 'Simpan',
    clear: 'Pulihkan hasil',
    close: 'Tutup',
    saved: 'Hasil diubah',
    cleared: 'Hasil dipulihkan',
  },
};

export const kpmComplianceMessages = defineMessages({ en, id });
