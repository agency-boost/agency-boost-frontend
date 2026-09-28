import { api } from '@/lib/api-client';

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
  /** The subject's own rates over the last 30 days, printed under the fields they measure. */
  measured: GoalMeasured;
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
 * as §3.6 allows. Outside the reader's grant it is a 404, never a 403.
 */
export const readGoal = (period: string, membershipId?: string) =>
  api<Goal>(`/goals/${period}` + forWhom(membershipId));

/**
 * The whole plan, in one write: five cards are one agreement, not five edits.
 *
 * Saving somebody else's makes it **their** goal immediately — there is no acceptance step
 * (ADR-0046) — the record names who saved it, and they are notified.
 */
export const saveGoal = (period: string, inputs: GoalInputs, membershipId?: string) =>
  api<Goal>(`/goals/${period}` + forWhom(membershipId), { method: 'PUT', body: inputs });

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
 * One plan that was agreed, current or replaced (P8-T6).
 *
 * **Whole states, newest first.** What changed between two of them is worked out here rather than
 * stored: a diff is only readable against a base the reader still has, and the point of keeping
 * these is that a leader who coached against January's plan can read January's plan (ADR-0042).
 */
export interface GoalHistoryEntry extends Omit<GoalInputs, 'monthsLeft'> {
  version: number;
  at: string | null;
  byMembershipId: string | null;
  /** `null` when the membership resolves to nobody — somebody who has left the office. */
  byName: string | null;
  monthsLeftOverride: number | null;
  snapshot: GoalSnapshot;
}

export const readGoalHistory = (period: string, membershipId?: string) =>
  api<GoalHistoryEntry[]>(`/goals/${period}/history` + forWhom(membershipId));

/** What a reader is told changed, in the words the cards use. */
export const FIELD_LABEL: Record<string, string> = {
  mode: 'How the target is set',
  annualApeTargetMinor: 'Annual APE target',
  savingsTargetMinor: 'Annual savings target',
  commissionRatePct: 'Commission rate',
  monthsLeftOverride: 'Months left',
  apeAchievedMinor: 'APE produced so far',
  caseSizeMinor: 'Average case size',
  leadsToApptPct: 'Leads that become an appointment',
  closingRatePct: 'Appointments that become a closing',
};

const MONEY_FIELDS = new Set([
  'annualApeTargetMinor', 'savingsTargetMinor', 'apeAchievedMinor', 'caseSizeMinor',
]);

/** One field's value, in the unit a reader thinks in. */
export const showValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined) return 'your office’s calendar';
  if (MONEY_FIELDS.has(field)) return formatRupiah(Number(value));
  if (field === 'mode') return value === 'direct' ? 'directly' : 'from a savings target';
  if (field.endsWith('Pct')) return `${value}%`;
  return String(value);
};

/**
 * What one plan changed, against the one before it.
 *
 * **Derived, not stored.** Nothing had to decide in advance which fields were worth recording, and
 * a field added later is compared without a migration.
 */
export const changesBetween = (
  now: GoalHistoryEntry, before: GoalHistoryEntry | undefined,
): { field: string; from: string; to: string }[] => {
  if (!before) return [];
  return Object.keys(FIELD_LABEL)
    .filter((field) => (now as unknown as Record<string, unknown>)[field]
      !== (before as unknown as Record<string, unknown>)[field])
    .map((field) => ({
      field,
      from: showValue(field, (before as unknown as Record<string, unknown>)[field]),
      to: showValue(field, (now as unknown as Record<string, unknown>)[field]),
    }));
};
