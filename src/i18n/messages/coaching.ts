import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { Pronoun, PronounForms, RosterStatus } from '@/lib/coaching';

/**
 * **Coaching's own words: the roster, the person shell and `lib/coaching.ts`** (P18.98-T4, coaching and unit;
 * `functional/coaching.md`, *The module's own strings*) — `/coaching`'s roster as a table and as a phone's cards, the
 * person shell's header, view switch, tab bar and not-found state, `/coaching/me`'s head, the tab pages' own words, and
 * the sentences `lib/coaching.ts` writes: a status, *Last 1:1*, whose unit, a history row, a refused finalize, the
 * capability tag, a section that does not apply, and the print's lines.
 *
 * **English is the source** of the keys: the prototype's words as built (`Overall.html:3955-3995`, `:10596-10664`,
 * `:11111-11187`) and the module's own (L-01), **none of ADR-0084's six words** in either language — no *office*, no
 * *KPM*, no *reports to*. The Indonesian is the approved glossary's (OD-237; §B.0's voice: *Anda*, imperative verbs,
 * sentence case, no exclamation mark), with the words it lacked added to the glossary for approval's §B.10 — *Tampilan
 * leader*, *Catatan coaching saya*, *tindakan* for an action item (the forum's), *Difinalkan*.
 *
 * **Kept in both languages** (§A): the title *Coaching Session* and the person's seven tabs (§A.2, §A.3), *Coaching*
 * (the nav's name and the roster's button), *AAB units* (§A.4), *1:1*, *1-on-1*, *leader*, *downline*, *lead*, *unit*
 * (§A.6) and the roles. **A person is *dia*** whatever their pronoun (§B.0 rule 8): English chooses *her*, *him* or
 * *them* from `ENGLISH_PRONOUNS`, Indonesian needs none. **Content stays as typed** (ADR-0179 §5): names, a rung's and a
 * stage's label, a lead's next-action note and the server's sentences. **A figure is never a message's**: a date or a
 * sum is written by the caller, in the figures' language (`useFigureLanguage()`), and handed in.
 *
 * @moved lib/coaching.ts
 * @moved components/coaching-roster.tsx
 * @moved components/coaching-person.tsx
 * @moved app/(agent)/coaching/
 */

/**
 * **English's pronoun forms** (`Overall.html:4052`, `:4058`, `:4115`: *Her sales activity targets*, *Leads that need
 * her*, *she's tracking*), the one table English sentences about a coachee read — `lib/coaching.ts` serves it as
 * `PRONOUN_FORMS` to every screen that still builds such a sentence. Indonesian needs none: *dia*.
 */
export const ENGLISH_PRONOUNS: Readonly<Record<Pronoun, PronounForms>> = {
  she: { subject: 'she', object: 'her', possessive: 'her', have: 'has', s: 's', isShort: 'she’s', hasShort: 'she’s' },
  he: { subject: 'he', object: 'him', possessive: 'his', have: 'has', s: 's', isShort: 'he’s', hasShort: 'he’s' },
  they: { subject: 'they', object: 'them', possessive: 'their', have: 'have', s: '', isShort: 'they’re', hasShort: 'they’ve' },
};

const f = (pronoun: Pronoun) => ENGLISH_PRONOUNS[pronoun];

const en = {
  /** The prototype's title for every coaching view (`Overall.html:10407`), and the person's tab (§A.2, §A.3). */
  title: kept('Coaching Session'),
  /** `GOAL_PACE_STATUS`'s pill, verbatim (`Overall.html:10624`), and ADR-0080's *No goal set*. */
  status: {
    on_track: 'On track',
    watch_closely: 'Watch closely',
    needs_attention: 'Needs attention',
    no_goal_set: 'No goal set',
  } satisfies Record<RosterStatus, string>,
  /** *Last 1:1* (`Overall.html:10619-10623`): none, today, or days ago — singular at one — and the server's *overdue*. */
  last: {
    none: 'No 1:1 yet',
    today: 'Today',
    daysAgo: ({ days }: { days: number }) => `${days} day${days === 1 ? '' : 's'} ago`,
    /** P18.8-T15 AC-7: *14 days ago · overdue*, in words and not by colour alone. */
    overdue: ({ text }: { text: string }) => `${text} · overdue`,
  },
  /** The line under a coachee's name (`Overall.html:3977`): `rung` its badge's name. */
  unitLine: {
    direct: ({ rung }: { rung: string }) => `${rung} · Direct unit`,
    leaders: ({ rung, leader }: { rung: string; leader: string }) => `${rung} · ${leader}’s unit`,
  },
  /** A history row (`Overall.html:10688`): *3 action items · 1 completed*. */
  pastSummary: ({ items, completed }: { items: number; completed: number }) =>
    `${items} ${items === 1 ? 'action item' : 'action items'} · ${completed} completed`,
  /** `COACHING_SESSION_INCOMPLETE`'s rule, in the prototype's sentence (`Overall.html:11111-11117`). */
  refusal: {
    NO_ACTION_ITEM: 'Add at least one action item before finalizing.',
    EMPTY_TIP: 'Fill in or remove the empty coaching tip before finalizing.',
    EMPTY_ACTION_ITEM: 'Fill in or remove the empty action item before finalizing.',
    UNDATED_ACTION_ITEM: 'Every action item needs a date before finalizing.',
    /** `name` the lead's, `null` when the server named none. */
    LEAD_THIS_MONTH_UNDATED: ({ name }: { name: string | null }) =>
      `${name ?? 'A lead'} is tagged "this month" but has no next action date set — add one before finalizing.`,
  },
  /** The *Capability mapping* tag (`Overall.html:4349`, `:11221`): the stage is the office's label, as typed. */
  capability: {
    current: ({ stage }: { stage: string }) => `Current: ${stage}`,
    notYet: ({ stage }: { stage: string }) => `Not yet at ${stage}`,
  },
  /** A downline section that does not apply (`Overall.html:4366`, `:4371`), in the coachee's pronoun. */
  notApplicable: {
    leaders: ({ pronoun }: { pronoun: Pronoun }) =>
      `Not applicable — ${f(pronoun).subject} ${f(pronoun).have} no downline leaders yet.`,
    agents: ({ pronoun }: { pronoun: Pronoun }) =>
      `Not applicable — ${f(pronoun).subject} ${f(pronoun).have} no agents under ${f(pronoun).object} yet.`,
  },
  /** A lead's next action with no note of its own (`Overall.html:11054-11059`). */
  followUpWith: ({ name }: { name: string }) => `Follow up with ${name}`,
  /** The print's lines (`Overall.html:11145-11187`): `actual` and `target` written by the caller, `null` for none. */
  print: {
    goalLine: ({ period, actual, target }: { period: 'month' | 'year'; actual: string | null; target: string }) =>
      `${period === 'month' ? 'This month' : 'This year'}: ${actual ?? 'Not uploaded yet'} / ${target}`,
    leadLine: ({ n, day, text, lead }: { n: number; day: string; text: string; lead: string }) =>
      `${n}. ${day} — ${text} (Leads: ${lead})`,
  },

  /** `/coaching`: the roster (`Overall.html:3955-3967`, rows `:10625-10657`). */
  roster: {
    /** The prototype's five headings (`:3963`); the last is named for a screen reader only. */
    columns: { name: 'Name', last: 'Last 1:1', coachedBy: 'Last Coached By', status: 'Status', actions: 'Actions' },
    /** Read before the table, and the cards' heading on a phone. */
    caption: 'Everyone you coach',
    loading: 'Loading everyone you coach…',
    directAgents: 'Your direct agents',
    aabUnits: kept('AAB units'),
    unitOf: ({ name }: { name: string }) => `${name}’s unit`,
    /** *Coaching →* (`:10642`): the arrow is drawn apart, hidden from a screen reader. */
    coaching: kept('Coaching'),
    /** A phone card's *by {coach}*, under *Last 1:1*. */
    by: ({ name }: { name: string }) => `by ${name}`,
    ownCoaching: 'Your own coaching',
    myNotes: 'My Coaching Notes',
    /** Ours (L-01): a reader nobody reports to, on a typed address. */
    empty: 'No one to coach yet.',
  },

  /** The person shell (`Overall.html:3969-3995`) and `/coaching/me`'s head (`:4384-4404`). */
  person: {
    /** *← Back to {to}* (`.back-link`, `:3970`): the roster, or the reader's own coaching. */
    back: ({ to }: { to: string }) => `← Back to ${to}`,
    /** *Leader view* / *Agent view* (`:3980-3985`), a group the screen reader names. */
    view: 'View',
    leaderView: 'Leader view',
    agentView: 'Agent view',
    /** The tabs (`:3988-3995`, and *Activity*, P13.1-T9), names (§A.3). */
    tabs: {
      summary: kept('Personal Summary'),
      goalSetting: kept('Goal Setting'),
      activity: kept('Activity'),
      training: kept('Training'),
      activation: kept('Activation'),
      session: kept('Coaching Session'),
      leaderNotes: kept('Leader Notes'),
    },
    /** The tab bar's name. */
    nav: kept('Coaching'),
    /** A tab not built yet (P11-T7 AC-7): its tooltip, and its name beginning with the words on screen. */
    upcoming: 'Upcoming',
    upcomingName: ({ label }: { label: string }) => `${label}, upcoming`,
    loading: 'Loading this person…',
    /** Outside the reader's reach (P11-T7 AC-8): one answer for every reason. */
    notFound: 'This person isn’t someone you coach.',
    notFoundLine: ({ leads }: { leads: boolean }) =>
      `They may have moved to another leader, or the address may be mistyped.${leads ? ' Everyone you coach is on Coaching Session.' : ''}`,
    /** `/coaching/me`'s line under the reader's name: `rung` its badge's name. */
    ownLine: ({ rung }: { rung: string }) => `${rung} · Your own coaching`,
  },

  /** The tab pages' own words. */
  pages: {
    /** `/coaching/{id}`, on its way to the *Coaching Session* tab. */
    opening: 'Opening the coaching session…',
    /** The *Personal Summary* tab's wait, in the coachee's pronoun, and its period switch. */
    puttingTogether: ({ pronoun }: { pronoun: Pronoun }) => `Putting ${f(pronoun).possessive} summary together…`,
    period: 'Period',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Coaching Session'),
  status: {
    on_track: `Sesuai ${kept('target')}`,
    watch_closely: 'Perlu dipantau',
    needs_attention: 'Perlu perhatian',
    no_goal_set: `${kept('Goal')} belum diatur`,
  },
  last: {
    none: `Belum ada ${kept('1:1')}`,
    today: 'Hari ini',
    // One form for one and many (§B.0 rule 8): *1 hari lalu*, *12 hari lalu*.
    daysAgo: ({ days }) => `${days} hari lalu`,
    overdue: ({ text }) => `${text} · terlambat`,
  },
  unitLine: {
    direct: ({ rung }) => `${rung} · ${kept('Unit')} langsung`,
    leaders: ({ rung, leader }) => `${rung} · ${kept('Unit')} ${leader}`,
  },
  pastSummary: ({ items, completed }) => `${items} tindakan · ${completed} selesai`,
  refusal: {
    NO_ACTION_ITEM: 'Tambahkan setidaknya satu tindakan sebelum memfinalkan.',
    EMPTY_TIP: `Isi atau hapus tips ${kept('coaching')} yang kosong sebelum memfinalkan.`,
    EMPTY_ACTION_ITEM: 'Isi atau hapus tindakan yang kosong sebelum memfinalkan.',
    UNDATED_ACTION_ITEM: 'Setiap tindakan perlu tanggal sebelum memfinalkan.',
    LEAD_THIS_MONTH_UNDATED: ({ name }) =>
      `${name ?? `Sebuah ${kept('lead')}`} ditandai "bulan ini", tetapi belum punya tanggal tindakan berikutnya — tambahkan sebelum memfinalkan.`,
  },
  capability: {
    current: ({ stage }) => `Saat ini: ${stage}`,
    notYet: ({ stage }) => `Belum mencapai ${stage}`,
  },
  // *Dia* whatever the pronoun (§B.0 rule 8).
  notApplicable: {
    leaders: () => `Tidak berlaku — dia belum punya ${kept('leader')} di ${kept('downline')}-nya.`,
    agents: () => 'Tidak berlaku — dia belum punya agen di bawahnya.',
  },
  followUpWith: ({ name }) => `Lakukan ${kept('follow up')} dengan ${name}`,
  print: {
    goalLine: ({ period, actual, target }) =>
      `${period === 'month' ? 'Bulan ini' : 'Tahun ini'}: ${actual ?? 'Belum diunggah'} / ${target}`,
    leadLine: ({ n, day, text, lead }) => `${n}. ${day} — ${text} (${kept('Leads')}: ${lead})`,
  },

  roster: {
    columns: { name: 'Nama', last: `${kept('1:1')} terakhir`, coachedBy: `Terakhir di-${kept('coaching')} oleh`, status: 'Status', actions: 'Aksi' },
    caption: `Semua orang yang Anda ${kept('coaching')}`,
    loading: `Memuat semua orang yang Anda ${kept('coaching')}…`,
    directAgents: 'Agen langsung Anda',
    aabUnits: kept('AAB units'),
    unitOf: ({ name }) => `${kept('Unit')} ${name}`,
    coaching: kept('Coaching'),
    by: ({ name }) => `oleh ${name}`,
    ownCoaching: `${kept('Coaching')} Anda sendiri`,
    myNotes: `Catatan ${kept('coaching')} saya`,
    empty: `Belum ada orang yang Anda ${kept('coaching')}.`,
  },

  person: {
    back: ({ to }) => `← Kembali ke ${to}`,
    view: 'Tampilan',
    leaderView: `Tampilan ${kept('leader')}`,
    agentView: `Tampilan ${kept('Agent')}`,
    tabs: {
      summary: kept('Personal Summary'),
      goalSetting: kept('Goal Setting'),
      activity: kept('Activity'),
      training: kept('Training'),
      activation: kept('Activation'),
      session: kept('Coaching Session'),
      leaderNotes: kept('Leader Notes'),
    },
    nav: kept('Coaching'),
    upcoming: 'Segera hadir',
    upcomingName: ({ label }) => `${label}, segera hadir`,
    loading: 'Memuat data orang ini…',
    notFound: `Orang ini bukan orang yang Anda ${kept('coaching')}.`,
    notFoundLine: ({ leads }) =>
      `Mungkin dia sudah pindah ke ${kept('leader')} lain, atau alamatnya salah ketik.${leads ? ` Semua orang yang Anda ${kept('coaching')} ada di ${kept('Coaching Session')}.` : ''}`,
    ownLine: ({ rung }) => `${rung} · ${kept('Coaching')} Anda sendiri`,
  },

  pages: {
    opening: `Membuka sesi ${kept('coaching')}…`,
    puttingTogether: () => 'Menyusun ringkasannya…',
    period: 'Periode',
  },
};

export const coachingMessages = defineMessages({ en, id });
