import { api } from '@/lib/api-client';
import { capitalized, PRONOUN_FORMS, type Pronoun } from '@/lib/coaching';
import { formatMonth } from '@/lib/format';

/**
 * An agent's agreed plan for a period (P8).
 *
 * **Money is IDR sen everywhere, and the field names say so.** `Rp 500,000,000` is
 * `500_000_000_00`. The suffix is not decoration: the prototype's own formatter takes major units,
 * and one mixed-unit field is a hundredfold error that nobody notices until a target is wrong by
 * two orders of magnitude.
 */

export type GoalMode = 'direct' | 'from_savings';

/** What was agreed, frozen at save time. **Never what a screen renders** — see `projected`. */
export interface GoalSnapshot {
  monthlyApeTargetMinor: number;
  policiesPerMonth: number;
  appointmentsPerMonth: number;
  leadsPerMonth: number;
}

/** What the inputs mean **today**, recomputed by the server on every read. */
export interface GoalProjection {
  annualApeTargetMinor: number;
  apeAchievedMinor: number;
  remainingApeMinor: number;
  monthlyApeTargetMinor: number;
  policiesPerMonth: number;
  policiesPerWeek: number;
  appointmentsPerMonth: number;
  appointmentsPerWeek: number;
  leadsPerMonth: number;
  leadsPerWeek: number;
  /** The annual target is reached, so every figure above is zero (ADR-0047). */
  targetMet: boolean;
}

/** The six inputs the five cards collect. */
export interface GoalInputs {
  mode: GoalMode;
  annualApeTargetMinor: number;
  savingsTargetMinor: number;
  commissionRatePct: number;
  /**
   * `null` means **use the office's calendar**, and it is what to send unless the agent typed over
   * the figure.
   *
   * Sending the number back would store it, and a stored divisor goes stale: a plan saved in
   * January with 11.9 months left would still claim 11.9 in October, and a monthly target a fifth
   * of the truth (client PRD §17).
   */
  monthsLeft: number | null;
  apeAchievedMinor: number;
  caseSizeMinor: number;
  leadsToApptPct: number;
  closingRatePct: number;
}

/**
 * The APE a plan is measured against, and whose figure it is (P9-T6): the carrier's year-to-date
 * figure once the office holds one — imported or corrected by hand — and the agent's own until then.
 */
export interface GoalAchieved {
  minor: number;
  provenance: 'imported' | 'corrected' | 'self_reported';
  /** The month whose year-to-date figure it is; `null` for the agent's own. */
  month: string | null;
}

/**
 * The two conversion assumptions as the subject actually logged them over the last 30 days
 * (ADR-0055, P10-T9). Proportions; `null` is not enough data. Read only — nothing is filled in.
 */
export interface GoalMeasured {
  from: string;
  to: string;
  days: number;
  leadToAppointmentRate: number | null;
  closingRate: number | null;
}

export interface Goal extends Omit<GoalInputs, 'monthsLeft'> {
  period: string;
  /** What `projected` is computed from. `apeAchievedMinor` stays the agent's own typed figure. */
  achieved: GoalAchieved;
  /** The figure **in force** — derived from the office's calendar unless it was overridden. */
  monthsLeft: number;
  /** Whether the figure above is the agent's own choice or the office's calendar. */
  monthsLeftIsOverride: boolean;
  snapshot: GoalSnapshot;
  /** `null` when the stored inputs cannot produce a plan — the screen says which of them. */
  projected: GoalProjection | null;
  cascadeMapping: { leadsCode: string; appointmentsCode: string; closingsCode: string };
  /**
   * The subject's own rates over the last 30 days. Kept in the payload and no longer on the screen
   * (ADR-0063 §7). **`null` when the subject is not the reader** (D-rates, P11-T7 AC-10): a
   * downline's measured rates left that unaudited read, and the coachee's own read keeps them. No
   * screen draws them, so nothing on one waits for them.
   */
  measured: GoalMeasured | null;
  savedAt: string | null;
  /** Differing from the reader's own membership is a leader's goal-setting (ADR-0046). */
  savedByMembershipId: string | null;
}

/**
 * `?for=<membershipId>`, or nothing.
 *
 * Appended with `+`, never interpolated: the API-consumer gate reads path **literals** out of each
 * call, and an interpolation at the end of one reads as part of the path.
 */
const forWhom = (membershipId?: string) =>
  (membershipId ? `?for=${encodeURIComponent(membershipId)}` : '');

/**
 * The goal, or the office's defaults when there is none. Nothing is written by reading.
 *
 * `membershipId` reads **somebody else's** — a downline, a unit member, or anybody in the office,
 * as §3.6 allows; on screen, the coaching Goal Setting tab's coachee (P11-T7). Outside the reader's
 * grant it is a 404, never a 403, and its `measured` is `null` (D-rates).
 */
export const readGoal = (period: string, membershipId?: string) =>
  api<Goal>(`/goals/${period}` + forWhom(membershipId));

/**
 * `?for=<membershipId>&session=<sessionId>`: a leader's save from inside a coaching session.
 * Appended with `+`, as `forWhom` is.
 */
const inSession = (membershipId: string, sessionId: string) =>
  `?for=${encodeURIComponent(membershipId)}&session=${encodeURIComponent(sessionId)}`;

/**
 * The whole plan, in one write: five cards are one agreement, not five edits.
 *
 * Saving somebody else's makes it **their** goal immediately — there is no acceptance step
 * (ADR-0046) — the record names who saved it, and they are notified.
 *
 * **`sessionId`** is the coaching session's Goal card (ADR-0075, P11-T8 AC-4): the leader's own open
 * session with that coachee. Every save made through one session reaches the coachee as **one**
 * notice, in-app at the first save and kept current by the later ones, emailed once when the session
 * is finalized. The server answers 404 when it is not the leader's open session with that coachee,
 * and `COACHING_SESSION_FINALIZED` once it is finalized. Without it, each save is its own notice.
 */
export const saveGoal = (period: string, inputs: GoalInputs, membershipId?: string, sessionId?: string) =>
  api<Goal>(
    `/goals/${period}` + (membershipId && sessionId ? inSession(membershipId, sessionId) : forWhom(membershipId)),
    { method: 'PUT', body: inputs },
  );

/**
 * The six inputs the server takes, as a goal it answered holds them. Everything else on a goal is
 * derived or stamped. One place, so the calculator and the coaching Goal card send the same plan.
 */
export function goalInputsOf(goal: Goal): GoalInputs {
  return {
    mode: goal.mode,
    annualApeTargetMinor: goal.annualApeTargetMinor,
    savingsTargetMinor: goal.savingsTargetMinor,
    commissionRatePct: goal.commissionRatePct,
    // The **override**, not the figure in force: `null` says *use the office's calendar*.
    monthsLeft: goal.monthsLeftIsOverride ? goal.monthsLeft : null,
    apeAchievedMinor: goal.apeAchievedMinor,
    caseSizeMinor: goal.caseSizeMinor,
    leadsToApptPct: goal.leadsToApptPct,
    closingRatePct: goal.closingRatePct,
  };
}

/** IDR sen per rupiah. One place, so a screen cannot hold a second opinion about the unit. */
export const MINOR_UNITS_PER_MAJOR = 100;

export const toMajor = (minor: number) => Math.round(minor / MINOR_UNITS_PER_MAJOR);
export const toMinor = (major: number) => Math.round(major * MINOR_UNITS_PER_MAJOR);

/**
 * `500000000` as `Rp 500.000.000`.
 *
 * **Indonesian grouping**, which the prototype's `toLocaleString('en-US')` gets wrong for its own
 * audience — and its compact formatter renders `1.2e9` as `Rp1.2M+`, which is neither a number nor
 * a unit anybody uses.
 */
export const formatRupiah = (minor: number) =>
  `Rp ${toMajor(minor).toLocaleString('id-ID')}`;

/**
 * The same grouping, for what somebody is **typing**: `500000000` shows as `500.000.000`.
 *
 * The prototype's money fields are `type="text" inputmode="numeric"` carrying a grouped value
 * (`Overall.html:2874`), and its `parseNum` strips the dots back out. Ours were `type="number"`,
 * which cannot show a separator at all — so an agent entering a nine-digit target had to count
 * zeroes, and a mistyped one was indistinguishable from a right one.
 *
 * No `Rp` here: the prefix is the field's own affix, and repeating it inside the value would put it
 * twice in the box.
 */
export const groupDigits = (major: number) => major.toLocaleString('id-ID');

/**
 * What was typed, back to a number: everything that is not a digit goes.
 *
 * **Digits only, deliberately.** A grouping separator in `id-ID` is `.`, which is also a decimal
 * point in most of the world — so parsing `1.500` as a decimal would read one and a half rupiah
 * where fifteen hundred was meant. Rupiah has no subunit anybody types, so there is nothing to lose.
 */
export const parseDigits = (typed: string) => Number(typed.replace(/\D/g, '')) || 0;

/**
 * **Where the APE produced came from, and for which month** (ADR-0063 §5, P10.1-T6): the words of the
 * marker beside the figure, on the Summary and on Goal Settings alike — its accessible name and its
 * tooltip. The payload's `provenance`: the office's upload, a correction by the office, or the
 * agent's own figure, which has no month. `span` says whether the figure is one month's or the year
 * to date as of that month.
 *
 * **About a coachee** (`subject`, P11-T7) the words are in their pronoun, and name the upload without
 * *office*: a string coaching writes uses none of ADR-0084's six words. The reader's own keep theirs.
 *
 * The revisions of a plan are still stored, every version and who saved it (ADR-0042); no screen
 * lists them since P10.1-T6 retired the history card and its route.
 */
export function producedFrom(
  source: { provenance: GoalAchieved['provenance']; month: string | null },
  span: 'month' | 'year',
  /** The coachee's pronoun, on a coaching tab; absent on the reader's own screen. */
  subject?: Pronoun,
): string {
  if (source.provenance === 'self_reported') {
    const whose = subject ? capitalized(PRONOUN_FORMS[subject].possessive) : 'Your';
    return `${whose} own figure, entered in Goal Settings`;
  }
  const words = subject
    ? (source.provenance === 'corrected' ? 'Corrected after the production upload' : 'From the production upload')
    : (source.provenance === 'corrected' ? 'Corrected by your office' : 'From your office’s upload');
  if (!source.month) return words;
  return span === 'year'
    ? `${words}, year to date as of ${formatMonth(source.month)}`
    : `${words}, ${formatMonth(source.month)}`;
}
