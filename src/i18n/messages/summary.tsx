import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { Voice } from './goal-words';

/**
 * **Personal Summary's own words** (P18.98-T4, field selling; `functional/summary.md`): `/summary` — its title, line,
 * *⬇ Download* and the period switch with its month and year selects (`components/summary-period.tsx`) — and the cards
 * a coachee's *Personal Summary* tab draws too (`components/personal-summary.tsx`): *Goal vs. actual (APE)*, the gap and
 * its pace sentence, the sales activity targets with their section chips, *Activity pulse*, the leads that need the
 * reader, and the two insight cards' six rules. The marker beside the APE produced is `lib/goals.ts`' (`goal-words.ts`);
 * a lead's flags are Leads management's (`leads.tsx`, `flagLabel`).
 *
 * **English is the source** of the keys, the prototype's words as built (`Overall.html:3080-3262`, the coaching copy
 * `:3998-4162`); the Indonesian is the approved glossary's (OD-237; §B.0's voice: *Anda*, imperative verbs, sentence
 * case, no exclamation mark), with the words it lacked added to the glossary for approval's §B.10. **Kept English in
 * both** (§A): the title; §A.4's Personal Summary KPI labels — *Goal vs. actual (APE)*, *Activity pulse*, *Activity
 * Ratios*, *Policies still needed*, *Closes this month* — and *Gap* (the Unit Dashboard's), the cascade's three stages
 * (§A.6), the screens a sentence sends the reader to (*Goal Settings*, *Log Activity*, *Leads Management*), a lead's
 * types *Sales* and *Recruit*, and the jargon — *goal*, *target*, *lead* and *leads* (§B.0 rule 8), *closing*,
 * *pipeline*, *benchmark*, *ratio*, *follow up*, *unit*, *campaigns*, *recruitment*. *Policy* is *polis*, *office*
 * *KPM* (§B.9). **A person is *dia* or *-nya*** whatever their pronoun, the reader *Anda* (`Voice`: English writes the
 * person in their forms, Indonesian reads `self`). **Content stays as typed** (ADR-0179 §5): a summary tile's and an
 * activity's label, a ratio's name, a lead's name, status, note and type, the server's refusals. **A figure is never
 * a message's**: a sum, a percentage, a ratio, a month and a day are written by the caller in the figures' language
 * and passed in; a count the server sent is its digits.
 *
 * @moved components/personal-summary.tsx
 * @moved components/summary-period.tsx
 * @moved lib/summary.ts
 * @moved app/(agent)/summary/
 */

/** Words drawn bold. */
type Strong = (words: string) => ReactNode;
/** A screen named in a sentence, as a link to it: the caller's `<Link>`, around the words the sentence gives it. */
type LinkTo = (words: string) => ReactNode;

/** A sentence's first word: *you* → *You*. */
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
/** *1 policy*, *3 policies*: English's plural, as the prototype's own *1 policy* (`:4045`) is singular. */
const policies = (n: number) => `${n} ${n === 1 ? 'policy' : 'policies'}`;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

const en = {
  /**
   * The page (`Overall.html:3080-3086`): its title, kept (§A.2). The prototype's line went at every size in UI V1
   * (Appendix A: *Remove* on a phone, a tablet and a desktop).
   */
  title: kept('Personal Summary'),
  /** *Unduh* (ADR-0068; UI-051, UI-057): the button's name, beside a line download icon — the 44px icon button's too. */
  download: 'Download',
  /** The period switch (P18.8-T11): its name, its two views, the selects' names, and the wait. */
  period: 'Period',
  views: { month: 'Monthly', year: 'Yearly' },
  month: 'Month',
  year: 'Year',
  loading: 'Putting your summary together…',

  /**
   * **How the page names its period** (P18.8-T11, ADR-0161 §4): the current one in the prototype's words — *This
   * month* on a card's tag, *this month* in a sentence — and a closed one by its name, written by the caller.
   */
  when: {
    tag: { month: 'This month', year: 'This year' },
    inline: { month: 'this month', year: 'this year' },
    inNamed: ({ named }: { named: string }) => `in ${named}`,
  },

  /**
   * **The date header** above the goal card (UI-054): on its right, the days left after today in the current month or
   * year — *sisa 1 hari bulan ini* on 30 October — and on its last day that it is the last; nothing for a closed period.
   * The date on its left is the caller's, in the figures' language.
   */
  dateHeader: {
    daysLeft: {
      month: ({ n }: { n: number }) => `${n} ${n === 1 ? 'day' : 'days'} left this month`,
      year: ({ n }: { n: number }) => `${n} ${n === 1 ? 'day' : 'days'} left this year`,
    },
    lastDay: { month: 'last day of the month', year: 'last day of the year' },
  },

  /** No goal saved for the year. */
  noGoal: {
    notYet: ({ who, year }: { who: Voice; year: string }) =>
      `${cap(who.subject)} ${who.have}n’t set a goal for ${year} yet, so there is nothing to measure against.`,
    /** A year that has ended can no longer be given a goal (P18.8-T11). */
    didNot: ({ who, year }: { who: Voice; year: string }) =>
      `${cap(who.subject)} didn’t set a goal for ${year}, so there is nothing to measure against.`,
    set: ({ who }: { who: Voice }) => `Set ${who.possessive} goal`,
  },
  /** A goal saved with no APE target to measure against; `tip` the ⓘ that follows *APE* (P18.95-T9 AC-3). */
  noTarget: {
    notYet: ({ who, year, tip }: { who: Voice; year: string; tip: ReactNode }) => (
      <>{cap(who.possessive)} goal for {year} has no APE {tip} target to measure against yet.</>
    ),
    had: ({ who, year, tip }: { who: Voice; year: string; tip: ReactNode }) => (
      <>{cap(who.possessive)} goal for {year} had no APE {tip} target to measure against.</>
    ),
    open: 'Open Goal Settings',
  },

  /** *Goal vs. actual (APE)* (`:3094-3115`): `sum` written by the caller. */
  goal: {
    title: 'Goal vs. actual (APE)',
    notUploaded: 'Not uploaded yet',
    ofTarget: ({ sum }: { sum: string }) => `of ${sum} target`,
    /** The bar's end, and its name: the current period's, or a closed one's by its name. */
    target: { month: 'This month’s target', year: 'This year’s target' },
    namedTarget: ({ named }: { named: string }) => `${named}’s target`,
    /** ADR-0047: the year was made before this month began, so the month has nothing left to fill. */
    madeAlready: ({ who }: { who: Voice }) =>
      `${cap(who.possessive)} year’s target was made before this month began — this month needs nothing more.`,
    madeBefore: ({ who, named }: { who: Voice; named: string }) =>
      `${cap(who.possessive)} year’s target was made before ${named} began — that month needed nothing more.`,
  },

  /** *The gap* (`:3117-3136`): `when` the period in a sentence, `sum` written by the caller. */
  gap: {
    title: 'The gap',
    remaining: ({ when }: { when: string }) => `Remaining ${when}`,
    reachedOver: ({ sum }: { sum: string }) => `Reached — ${sum} over`,
    reached: 'Reached',
    policiesNeeded: 'Policies needed',
    none: 'None',
    policies: ({ n }: { n: number }) => policies(n),
    /** *± 4 polis* (UI-006, UI-054): the goal card's foot — about, since a policy's APE is the case size's estimate. */
    about: ({ n }: { n: number }) => `± ${policies(n)}`,
  },
  /**
   * **The pace sentence**, the prototype's verbatim (ADR-0109; `:3132-3135`, `:6340-6347`), and its coaching form
   * (`:4050-4051`): the server's four numbers as they are — the last 30 days' closings, the closings target, the weeks
   * left and the closings a week.
   */
  pace: {
    met: ({ who }: { who: Voice }) =>
      `${cap(who.hasShort)} already reached this month’s target — nice work. Keep the pace to stay ahead.`,
    behind: ({ who, strong, closings, target, weeks, perWeek }: {
      who: Voice; strong: Strong; closings: number; target: number; weeks: number; perWeek: number;
    }) => (
      <>
        At {who.possessive} current pace, {who.isShort} tracking to close {strong(policies(closings))} this month against
        a target of {strong(String(target))}. With {weeks} {weeks === 1 ? 'week' : 'weeks'} left, {who.subject}’d need
        to close roughly {strong(`${perWeek} ${perWeek === 1 ? 'policy' : 'policies'}/week`)} to catch up.
      </>
    ),
  },

  /** *Your sales activity targets* (`:3139-3182`), and the section chips under them (ADR-0064). */
  targets: {
    title: ({ who }: { who: Voice }) => `${cap(who.possessive)} sales activity targets`,
    /** Where the targets come from; `link` opens *Goal Settings*, or a coachee's *Goal Setting* tab. */
    from: ({ who, link }: { who: Voice; link: LinkTo }) => (
      <>
        From {link('Goal Settings')} — appointments and closings are {who.possessive} {who.self ? 'Sales' : 'sales'} pipeline
        targets.
      </>
    ),
    /** `from` as plain words, for the heading's ⓘ on a tablet (UI V1, Appendix A: *ⓘ* there, a line on a desktop). */
    fromTip: ({ who }: { who: Voice }) =>
      `From Goal Settings — appointments and closings are ${who.possessive} ${who.self ? 'Sales' : 'sales'} pipeline targets.`,
    /**
     * **Where the policies come from** (UI-052: *the UI says which*), behind the heading's ⓘ at every size: *Submission
     * polis* is what the member logged, APE the production upload — two sources, each named. No word naming the office,
     * so a coachee's page can say it too (ADR-0084).
     */
    source: ({ who }: { who: Voice }) =>
      `Submission polis counts the policies ${who.subject} log${who.s} in Log Activity; APE comes from the production upload.`,
    /** *5 activities this month* (grey text row 22): `count` written by the caller, `n` for the plural. */
    total: ({ strong, count, n, when }: { strong: Strong; count: string; n: number; when: string }) => (
      <>{strong(count)} {n === 1 ? 'activity' : 'activities'} {when}</>
    ),
    noTarget: 'No target yet',
    nothingMore: ({ when }: { when: string }) => `Nothing more needed ${when}`,
    /** A chip's bar, named for its stage, and what it says: *20 of 57*. */
    against: ({ label }: { label: string }) => `${label} against target`,
    progress: ({ logged, target }: { logged: number; target: number }) => `${logged} of ${target}`,
    /** A summary tile's chip (`:3164-3183`): the tile's label, the office's. */
    section: ({ label }: { label: string }) => `${label} activities`,
  },

  /** *Activity pulse* (`:3184-3208`), and its sign where no read serves it. */
  pulse: {
    title: 'Activity ratios',
    tag: 'Last 30 days',
    sign: ({ who }: { who: Voice }) =>
      `${cap(who.possessive)} selling and recruitment ratios over the last 30 days, each against its benchmark.`,
    working: ({ who }: { who: Voice }) => `Working out ${who.possessive} ratios…`,
    noneOwn: 'Your office has no ratios for your role yet.',
    noneTheirs: ({ who }: { who: Voice }) => `There are no ratios for ${who.possessive} role yet.`,
  },

  /** *Campaigns you're chasing* (`:3225-3232`), *Campaigns she's chasing* about a coachee (`:4121-4130`). */
  campaigns: ({ who }: { who: Voice }) => `Campaigns ${who.isShort.replace('’', "'")} chasing`,

  /** *Leads that need you* (`:3210-3217`, `:6151-6218`), *Leads that need her* (`:4115-4116`). */
  leads: {
    title: ({ who }: { who: Voice }) => `Leads that need ${who.object}`,
    tagOwn: 'Your open leads, nearest date first',
    tagTheirs: 'All active leads, nearest date first',
    /** P18.8-T15 AC-4: a leader whose own card is empty, with their unit's open leads in Leads Management. */
    unitHasSome: ({ link }: { link: LinkTo }) => <>No open leads of your own — your unit’s are in {link('Leads Management')}.</>,
    noneYet: ({ link }: { link: LinkTo }) => <>No active leads yet — add some in {link('Leads Management')}.</>,
    /** The prototype's own empty line on a coachee's card (`Overall.html:10498`). */
    noneTheirs: 'No active leads.',
    /** A lead's type, the Leads screen's words: *Recruit*, not *Recruitment* (ADR-0161 §2). */
    types: { sales: kept('Sales'), recruitment: kept('Recruit') },
    /** The reader's lead with no type yet; a coachee's is said without one. */
    unassigned: 'Unassigned',
    noStatus: 'No status yet',
    unnamed: '(unnamed)',
    closesThisMonth: kept('Closes this month'),
    noDate: 'No date set',
  },

  /**
   * **The insight cards** (`:3233-3262`, P10-T7): named rules over the member's own numbers, under the prototype's
   * *AI-powered* badge (ADR-0069). Every number is one the server read; a day and a ratio are written by the caller. A
   * screen a sentence names is a link on the reader's own page only (`link`, `null` about a coachee).
   */
  insights: {
    next: 'What to do next',
    improveOwn: 'How you can improve your performance',
    improveTheirs: ({ who }: { who: Voice }) => `How ${who.subject} can improve`,
    badge: 'AI-powered',
    quietOwn: 'Nothing in your numbers asks for anything right now — keep logging, and this is where it will show.',
    quietTheirs: ({ who }: { who: Voice }) => `Nothing in ${who.possessive} numbers asks for anything right now.`,
    /** `NOTHING_LOGGED`, never logged: the reader's sends them to *Log Activity*. */
    neverOwn: ({ link }: { link: LinkTo }) => (
      <>
        You haven’t logged any activity yet — a few minutes in {link('Log Activity')} each day is what every number on this
        page is made of.
      </>
    ),
    neverTheirs: ({ who }: { who: Voice }) =>
      `${cap(who.subject)} ${who.have}n’t logged any activity yet — a few minutes each day is what every number on this page is made of.`,
    /** `NOTHING_LOGGED`, quiet for `windowDays`; `date` the last entry's day. */
    quietSinceOwn: ({ windowDays, date, link }: { windowDays: number; date: string; link: LinkTo }) => (
      <>
        Nothing logged in the last {days(windowDays)} — your last entry was {date}. Every number on this page is made of
        what you log in {link('Log Activity')}.
      </>
    ),
    quietSinceTheirs: ({ who, windowDays, date }: { who: Voice; windowDays: number; date: string }) =>
      `Nothing logged in the last ${days(windowDays)} — ${who.possessive} last entry was ${date}. Every number on this page is made of what ${who.subject} log${who.s}.`,
    /** `BEHIND_PACE`: the month's last week is *the week left*, not *the 1 week left*. */
    behindPace: ({ who, strong, closings, target, perWeek, weeksLeft }: {
      who: Voice; strong: Strong; closings: number; target: number; perWeek: number; weeksLeft: number;
    }) => (
      <>
        {cap(who.isShort)} behind pace — at this rate {who.subject}’ll close {strong(String(closings))} of{' '}
        {strong(String(target))} this month.{' '}
        {weeksLeft === 1
          ? <>About {strong(policies(perWeek))} in the week left would catch up.</>
          : <>About {strong(`${policies(perWeek)} a week`)} for the {weeksLeft} weeks left would catch up.</>}
      </>
    ),
    /** `LEAD_OVERDUE`: `others` the member's other overdue leads. */
    leadOverdue: ({ who, strong, name, overdueDays, others, link }: {
      who: Voice; strong: Strong; name: string; overdueDays: number; others: number; link: LinkTo | null;
    }) => (
      <>
        {strong(name)}’s next action is {days(overdueDays)} overdue — reschedule it or set a new date this week
        {link ? <> in {link('Leads Management')}.</> : '.'}
        {others > 0 && <> {others} more of {who.possessive} leads {others === 1 ? 'is' : 'are'} overdue too.</>}
      </>
    ),
    /** `LEAD_NEGLECTED`: `others` the member's other leads with neither. */
    leadNeglected: ({ strong, name, others }: { strong: Strong; name: string; others: number }) => (
      <>
        {strong(name)} has no next action and no remarks — follow up and log what happened so this lead doesn’t stall.
        {others > 0 && <> {others} {others === 1 ? 'more lead has' : 'more leads have'} neither.</>}
      </>
    ),
    /** `RATIO_BELOW`: `label` the ratio's, `value` and `benchmark` written by the caller. */
    ratioBelow: ({ who, strong, label, value, benchmark, link }: {
      who: Voice; strong: Strong; label: string; value: string; benchmark: string; link: LinkTo | null;
    }) => (
      <>
        {strong(label)} is {value} over the last 30 days, below its benchmark of {benchmark} — that step is where{' '}
        {who.possessive} activity is not yet converting.
        {link && <> {link('Activity Ratios')} shows what it counts.</>}
      </>
    ),
    /** `RATIO_STRENGTH`. */
    ratioStrength: ({ strong, label, value, benchmark }: { strong: Strong; label: string; value: string; benchmark: string }) => (
      <>{strong(label)} is a genuine strength — {value} over the last 30 days, well above its benchmark of {benchmark}.</>
    ),
  },
};

/** The reader's or a coachee's, after a noun: *rencana Anda*, *rencananya*; *goal Anda*, *goal-nya* after a kept term. */
const own = (who: Voice, noun: string, keptNoun = false) => (who.self ? `${noun} Anda` : `${noun}${keptNoun ? '-' : ''}nya`);
/** The reader, or a coachee, as a sentence's subject: *Anda*, *dia*. */
const subject = (who: Voice, first = false) => (who.self ? 'Anda' : first ? 'Dia' : 'dia');

const id: MessagesOf<typeof en> = {
  title: kept('Personal Summary'),
  download: 'Unduh',
  period: 'Periode',
  views: { month: 'Bulanan', year: 'Tahunan' },
  month: 'Bulan',
  year: 'Tahun',
  loading: 'Menyusun ringkasan Anda…',

  when: {
    tag: { month: 'Bulan ini', year: 'Tahun ini' },
    inline: { month: 'bulan ini', year: 'tahun ini' },
    inNamed: ({ named }) => `pada ${named}`,
  },

  // UI-054's own words (*sisa 1 hari bulan ini*); *hari terakhir* is new, proposed in §B.10 (P18.99).
  dateHeader: {
    daysLeft: {
      month: ({ n }) => `sisa ${n} hari bulan ini`,
      year: ({ n }) => `sisa ${n} hari tahun ini`,
    },
    lastDay: { month: 'hari terakhir bulan ini', year: 'hari terakhir tahun ini' },
  },

  noGoal: {
    notYet: ({ who, year }) => `${subject(who, true)} belum mengatur ${kept('goal')} untuk ${year}, jadi belum ada yang bisa diukur.`,
    didNot: ({ who, year }) => `${subject(who, true)} tidak mengatur ${kept('goal')} untuk ${year}, jadi tidak ada yang bisa diukur.`,
    set: ({ who }) => `Atur ${own(who, kept('goal'), true)}`,
  },
  noTarget: {
    notYet: ({ who, year, tip }) => (
      <>{own(who, kept('Goal'), true)} untuk {year} belum memiliki {kept('target')} {kept('APE')} {tip} sebagai ukuran.</>
    ),
    had: ({ who, year, tip }) => (
      <>{own(who, kept('Goal'), true)} untuk {year} tidak memiliki {kept('target')} {kept('APE')} {tip} sebagai ukuran.</>
    ),
    open: `Buka ${kept('Goal Settings')}`,
  },

  goal: {
    title: `${kept('Target')} vs. realisasi (${kept('APE')})`,
    notUploaded: 'Belum diunggah',
    ofTarget: ({ sum }) => `dari ${kept('target')} ${sum}`,
    target: { month: `${kept('Target')} bulan ini`, year: `${kept('Target')} tahun ini` },
    namedTarget: ({ named }) => `${kept('Target')} ${named}`,
    madeAlready: ({ who }) =>
      `${kept('Target')} ${own(who, 'tahunan')} sudah tercapai sebelum bulan ini dimulai — bulan ini tidak memerlukan apa-apa lagi.`,
    madeBefore: ({ who, named }) =>
      `${kept('Target')} ${own(who, 'tahunan')} sudah tercapai sebelum ${named} dimulai — bulan itu tidak memerlukan apa-apa lagi.`,
  },

  // *Gap* is translated since UI V1 (UI-006): *Selisih*, the alternative §B.10 named; proposed in §B.10, P18.99.
  gap: {
    title: 'Selisih',
    remaining: ({ when }) => `Sisa ${when}`,
    reachedOver: ({ sum }) => `Tercapai — lebih ${sum}`,
    reached: 'Tercapai',
    policiesNeeded: 'Polis yang dibutuhkan',
    none: 'Tidak ada',
    // One form for one and many (§B.0 rule 8): *1 polis*, *3 polis*.
    policies: ({ n }) => `${n} polis`,
    // UI-006's value, verbatim: *± 4 polis*.
    about: ({ n }) => `± ${n} polis`,
  },
  pace: {
    met: ({ who }) =>
      `${subject(who, true)} sudah mencapai ${kept('target')} bulan ini — kerja bagus. Pertahankan laju ini agar tetap unggul.`,
    behind: ({ who, strong, closings, target, weeks, perWeek }) => (
      <>
        Dengan {own(who, 'laju')} saat ini, {subject(who)} diperkirakan {kept('closing')} {strong(`${closings} polis`)} bulan
        ini dari {kept('target')} {strong(String(target))}. Dengan sisa {weeks} minggu, {subject(who)} perlu{' '}
        {kept('closing')} sekitar {strong(`${perWeek} polis/minggu`)} untuk mengejar ketertinggalan.
      </>
    ),
  },

  targets: {
    title: ({ who }) => `${kept('Target')} aktivitas ${own(who, 'penjualan')}`,
    from: ({ who, link }) => (
      <>
        Dari {link(kept('Goal Settings'))} — janji temu dan {kept('closings')} adalah {kept('target')} {kept('pipeline')}{' '}
        {own(who, 'penjualan')}.
      </>
    ),
    fromTip: ({ who }) =>
      `Dari ${kept('Goal Settings')} — janji temu dan ${kept('closings')} adalah ${kept('target')} ${kept('pipeline')} `
      + `${own(who, 'penjualan')}.`,
    // Proposed in §B.10 (P18.99, UI-052).
    source: ({ who }) =>
      `${kept('Submission polis')} adalah polis yang ${subject(who)} catat di ${kept('Log Activity')}; ${kept('APE')} berasal `
      + 'dari unggahan produksi.',
    total: ({ strong, count, when }) => <>{strong(count)} aktivitas {when}</>,
    noTarget: `Belum ada ${kept('target')}`,
    nothingMore: ({ when }) => `Tidak perlu apa-apa lagi ${when}`,
    against: ({ label }) => `${label} terhadap ${kept('target')}`,
    progress: ({ logged, target }) => `${logged} dari ${target}`,
    section: ({ label }) => `Aktivitas ${label}`,
  },

  pulse: {
    title: 'Rasio aktivitas',
    tag: '30 hari terakhir',
    sign: ({ who }) =>
      `${kept('Ratio')} penjualan dan ${own(who, kept('recruitment'), true)} dalam 30 hari terakhir, masing-masing `
      + `terhadap ${kept('benchmark')}-nya.`,
    working: ({ who }) => `Menghitung ${own(who, kept('ratio'), true)}…`,
    noneOwn: `${kept('KPM')} Anda belum memiliki ${kept('ratio')} untuk peran Anda.`,
    noneTheirs: ({ who }) => `Belum ada ${kept('ratio')} untuk ${own(who, 'peran')}.`,
  },

  // UI-006 (owner): *Campaign yang Anda kejar* — the kept word, singular.
  campaigns: ({ who }) => `${kept('Campaign')} yang ${subject(who)} kejar`,

  leads: {
    title: ({ who }) => `${kept('Leads')} yang perlu ${own(who, 'perhatian')}`,
    tagOwn: `${kept('Leads')} terbuka Anda, tanggal terdekat lebih dulu`,
    tagTheirs: `Semua ${kept('leads')} aktif, tanggal terdekat lebih dulu`,
    unitHasSome: ({ link }) => (
      <>
        Tidak ada {kept('leads')} terbuka milik Anda sendiri — {kept('leads')} {kept('unit')} Anda ada di{' '}
        {link(kept('Leads Management'))}.
      </>
    ),
    noneYet: ({ link }) => <>Belum ada {kept('leads')} aktif — tambahkan di {link(kept('Leads Management'))}.</>,
    noneTheirs: `Tidak ada ${kept('leads')} aktif.`,
    types: { sales: kept('Sales'), recruitment: kept('Recruit') },
    unassigned: 'Tanpa jenis',
    noStatus: 'Belum ada status',
    unnamed: '(tanpa nama)',
    closesThisMonth: kept('Closes this month'),
    noDate: 'Tanggal belum diatur',
  },

  insights: {
    next: 'Langkah berikutnya',
    improveOwn: 'Cara meningkatkan performa Anda',
    improveTheirs: ({ who }) => `Cara meningkatkan ${own(who, 'performa')}`,
    badge: 'Berbasis AI',
    quietOwn: 'Belum ada yang perlu ditindaklanjuti dari angka Anda saat ini — terus mencatat, dan hasilnya akan muncul di '
      + 'sini.',
    quietTheirs: ({ who }) => `Belum ada yang perlu ditindaklanjuti dari ${own(who, 'angka')} saat ini.`,
    neverOwn: ({ link }) => (
      <>
        Anda belum mencatat aktivitas apa pun — beberapa menit di {link(kept('Log Activity'))} setiap hari adalah sumber
        setiap angka di halaman ini.
      </>
    ),
    neverTheirs: ({ who }) =>
      `${subject(who, true)} belum mencatat aktivitas apa pun — beberapa menit setiap hari adalah sumber setiap angka di halaman ini.`,
    quietSinceOwn: ({ windowDays, date, link }) => (
      <>
        Tidak ada yang dicatat dalam {windowDays} hari terakhir — catatan terakhir Anda pada {date}. Setiap angka di halaman
        ini bersumber dari apa yang Anda catat di {link(kept('Log Activity'))}.
      </>
    ),
    quietSinceTheirs: ({ who, windowDays, date }) =>
      `Tidak ada yang dicatat dalam ${windowDays} hari terakhir — ${own(who, 'catatan terakhir')} pada ${date}. Setiap angka di `
      + `halaman ini bersumber dari apa yang ${subject(who)} catat.`,
    behindPace: ({ who, strong, closings, target, perWeek, weeksLeft }) => (
      <>
        {subject(who, true)} tertinggal dari laju yang dibutuhkan — dengan laju ini {subject(who)} akan {kept('closing')}{' '}
        {strong(String(closings))} dari {strong(String(target))} bulan ini.{' '}
        {weeksLeft === 1
          ? <>Sekitar {strong(`${perWeek} polis`)} di minggu yang tersisa cukup untuk mengejar ketertinggalan.</>
          : <>Sekitar {strong(`${perWeek} polis seminggu`)} selama {weeksLeft} minggu yang tersisa cukup untuk mengejar ketertinggalan.</>}
      </>
    ),
    leadOverdue: ({ who, strong, name, overdueDays, others, link }) => (
      <>
        Tindakan berikutnya untuk {strong(name)} sudah terlambat {overdueDays} hari — jadwalkan ulang atau atur tanggal baru
        minggu ini{link ? <> di {link(kept('Leads Management'))}.</> : '.'}
        {others > 0 && <> {others} {own(who, others === 1 ? kept('lead') : kept('leads'), true)} yang lain juga terlambat.</>}
      </>
    ),
    leadNeglected: ({ strong, name, others }) => (
      <>
        {strong(name)} belum punya tindakan berikutnya maupun keterangan — lakukan {kept('follow up')} dan catat hasilnya
        agar {kept('lead')} ini tidak mandek.
        {others > 0 && <> {others} {others === 1 ? kept('lead') : kept('leads')} lain juga belum punya keduanya.</>}
      </>
    ),
    ratioBelow: ({ who, strong, label, value, benchmark, link }) => (
      <>
        {strong(label)} sebesar {value} dalam 30 hari terakhir, di bawah {kept('benchmark')}-nya sebesar {benchmark} — di
        tahap itulah {own(who, 'aktivitas')} belum menghasilkan konversi.
        {link && <> {link(kept('Activity Ratios'))} menunjukkan apa yang dihitungnya.</>}
      </>
    ),
    ratioStrength: ({ strong, label, value, benchmark }) => (
      <>
        {strong(label)} adalah kekuatan nyata — {value} dalam 30 hari terakhir, jauh di atas {kept('benchmark')}-nya
        sebesar {benchmark}.
      </>
    ),
  },
};

export const summaryMessages = defineMessages({ en, id });
