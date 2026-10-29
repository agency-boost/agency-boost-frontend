import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A goal's words as `lib/goals.ts` writes them** (P18.98-T4, field selling; `functional/goals.md`,
 * `functional/summary.md`): the marker beside the APE produced — whose figure it is, and for which month
 * (`producedFrom`, ADR-0063 §5), on Goal Settings, the Summary, a coachee's two tabs and the Unit Dashboard alike — and
 * the months left in words (`monthsLeftInWords`, P18.95-T5 AC-5). **Its own area, apart from the calculator's**
 * (`goals.tsx`), because a dozen screens import `lib/goals.ts` for its money helpers: they carry these few words, not
 * the calculator's.
 *
 * **English is the source** of the keys; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with the
 * words it lacked in the glossary for approval's §B.10 — *Per {month}* for *As of*, *sejak awal tahun* for *year to
 * date*, *unggahan* for an upload. *Office* is *KPM* (§B.9); **about a coachee no word names the office at all**, in
 * either language (ADR-0084's six words). *Goal Settings* is kept (§A.2). **A person is *dia* or *-nya*** whatever their
 * pronoun (§B.0 rule 8), the reader *Anda*: English writes them in their forms (`Voice`), Indonesian reads `self` alone.
 * **A figure is never a message's**: the month and the months left are written by the caller in the figures' language
 * and passed in. A corrector's name is as stored.
 *
 * @moved lib/goals.ts
 */

/**
 * **Who a sentence is about** (P11-T7; T4 AC-3): the reader, or a coachee. **English writes the person in their own
 * forms** — the reader's `YOU`, a coachee's `PRONOUN_FORMS` (`lib/coaching.ts`), passed to `voiceOf` — and **Indonesian
 * reads `self` alone**: the reader is *Anda*, anybody else *dia* or *-nya*, whatever their pronoun (§B.0 rules 1 and 8).
 * Read by this area, Goal Settings' (`goals.tsx`) and the Summary's (`summary.tsx`).
 */
export interface Voice {
  /** The reader's own page. */
  readonly self: boolean;
  /** you · she · he · they */
  readonly subject: string;
  /** you · her · him · them */
  readonly object: string;
  /** your · her · his · their */
  readonly possessive: string;
  /** *have* · *has* · *has* · *have*: *you haven’t*, *she hasn’t*. */
  readonly have: string;
  /** What a present-tense verb ends in: *you log*, *she logs*. */
  readonly s: string;
  /** *you’re* · *she’s* · *he’s* · *they’re* */
  readonly isShort: string;
  /** *you’ve* · *she’s* · *he’s* · *they’ve* */
  readonly hasShort: string;
}

/** **The reader**, in English's forms: *you*, *your*, *you’re*. */
export const YOU: Voice = {
  self: true, subject: 'you', object: 'you', possessive: 'your', have: 'have', s: '', isShort: 'you’re', hasShort: 'you’ve',
};

/** **Whose sentence**: a coachee in their pronoun's English forms (`PRONOUN_FORMS[pronoun]`), or the reader with none. */
export const voiceOf = (forms?: Omit<Voice, 'self'>): Voice => (forms ? { ...forms, self: false } : YOU);

/** A sentence's first word: *your* → *Your*. */
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const en = {
  /** Where the APE produced came from, and for which month (`producedFrom`). */
  produced: {
    /** The member's own figure, which has no month: *Your own figure*, *Her own figure*. */
    own: ({ who }: { who: Voice }) => `${cap(who.possessive)} own figure, entered in Goal Settings`,
    /** The reader's: the office's upload. */
    upload: 'From your office’s upload',
    /** The reader's: a correction, by whom when the payload says, *by hand* when it does not (ADR-0121, F-156). */
    corrected: ({ by }: { by: string | null }) => `Corrected by ${by ?? 'hand'}`,
    /** A coachee's: the upload, and a correction of it, without *office* (ADR-0084). */
    theirUpload: 'From the production upload',
    theirCorrection: 'Corrected after the production upload',
    /** The reader's year to date from the upload, in the client's words (P18.95-T7 AC-1): *As of Oct 2026*. */
    asOf: ({ month }: { month: string }) => `As of ${month}`,
    /** The words, then the month: the year to date as of it, or the month's own figure. */
    yearToDate: ({ words, month }: { words: string; month: string }) => `${words}, year to date as of ${month}`,
    ofMonth: ({ words, month }: { words: string; month: string }) => `${words}, ${month}`,
    /** A coachee's correction names who made it, last. */
    by: ({ words, name }: { words: string; name: string }) => `${words}, by ${name}`,
  },
  /**
   * The months left in words (`monthsLeftInWords`): `whole` the nearest whole month, a half rounding up, `n` it
   * written — *about 2 months*, and *less than a month* below half of one.
   */
  monthsLeft: ({ whole, n }: { whole: number; n: string }) =>
    (whole < 1 ? 'less than a month' : whole === 1 ? `about ${n} month` : `about ${n} months`),
};

const id: MessagesOf<typeof en> = {
  produced: {
    own: ({ who }) => `${who.self ? 'Angka Anda sendiri' : 'Angkanya sendiri'}, diisi di ${kept('Goal Settings')}`,
    upload: `Dari unggahan ${kept('KPM')} Anda`,
    corrected: ({ by }) => (by === null ? 'Dikoreksi manual' : `Dikoreksi oleh ${by}`),
    theirUpload: 'Dari unggahan produksi',
    theirCorrection: 'Dikoreksi setelah unggahan produksi',
    asOf: ({ month }) => `Per ${month}`,
    yearToDate: ({ words, month }) => `${words}, sejak awal tahun per ${month}`,
    ofMonth: ({ words, month }) => `${words}, ${month}`,
    by: ({ words, name }) => `${words}, oleh ${name}`,
  },
  // One form for one and many (§B.0 rule 8): *sekitar 1 bulan*, *sekitar 2 bulan*.
  monthsLeft: ({ whole, n }) => (whole < 1 ? 'kurang dari sebulan' : `sekitar ${n} bulan`),
};

export const goalWordMessages = defineMessages({ en, id });
