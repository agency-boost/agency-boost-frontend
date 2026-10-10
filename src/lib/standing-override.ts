import { api } from './api-client';

/**
 * **The override of a final campaign standing** (P18.6-T2 AC-5, AC-8; ADR-0144 §4; D-override): the Owner or an
 * Admin sets a chaser's frozen result to *Achieved* or *Not achieved* with a reason, or clears it with one. Its
 * only control is the compliance tree's *Achieved* cell (`components/analytics/standing-override.tsx`).
 *
 * **Every judgement is the server's**: whether the standing is final, whether the member has one, and whether
 * the status asked for is the one it already reads. The screen offers only what can succeed and prints the
 * server's refusal when it does not.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** The two results an override may set: the registry's *Achieved* and *Not achieved*. */
export type OverrideStatus = 'qualified' | 'not_met';

/** Who set it: a member of the office, by name. */
export interface OverrideActor {
  membershipId: string;
  name: string;
}

/** An override as the tree's cell and both writes answer it. `at` is the instant it was set. */
export interface StandingOverride {
  status: OverrideStatus;
  reason: string;
  by: OverrideActor;
  at: string;
}

/** What a final standing can read: an override's two, or the evaluation's `unknown` when nothing decided it. */
export type FinalStatus = OverrideStatus | 'unknown';

/** Both writes' answer: the standing's effective status, and the override now on it (`null` once cleared). */
export interface StandingOverrideResult {
  campaignCode: string;
  membershipId: string;
  status: FinalStatus;
  override: StandingOverride | null;
}

/**
 * The longest reason the server keeps (the override DTOs' `@MaxLength`). A validation limit, not a domain
 * constant; held to the API document by `contract.spec.ts`, so the two cannot drift.
 */
export const OVERRIDE_REASON_MAX = 500;

/*
 * The path is written out in each call, not built by a helper: `scripts/check-api-consumers.py` finds a route by
 * the literal inside the `api(…)` call, and a path built elsewhere would leave both routes reported unwired.
 */

/** Sets the result; the frozen evaluation is kept beside it, so clearing restores it. */
export const setOverride = (code: string, membershipId: string, body: { status: OverrideStatus; reason: string }) =>
  api<StandingOverrideResult>(
    `/kpm/settings/campaigns/${encodeURIComponent(code)}/standings/${encodeURIComponent(membershipId)}/override`,
    { method: 'PUT', body },
  );

/** Clears it, with a reason: the result goes back to what the evaluation found. */
export const clearOverride = (code: string, membershipId: string, body: { reason: string }) =>
  api<StandingOverrideResult>(
    `/kpm/settings/campaigns/${encodeURIComponent(code)}/standings/${encodeURIComponent(membershipId)}/override`,
    { method: 'DELETE', body },
  );

/**
 * Our words: the prototype draws no override (contradiction 11). Plain, and none of OD-39's six words.
 * `campaign` is the campaign's title, `name` the member's.
 */
export const OVERRIDE_COPY = {
  /** The cell's button, after the pill's own word (WCAG 2.5.3), and the dialog's title. */
  overrideFor: (name: string, campaign: string) => `Override ${name}’s result for ${campaign}`,
  /** The icon's name and tooltip: who, on which day of the office's calendar, and why. */
  overriddenBy: (name: string, day: string, reason: string) => `Overridden by ${name} on ${day}: ${reason}`,
  resultNow: 'Result now',
  newResult: 'New result',
  reason: 'Reason',
  save: 'Save',
  clear: 'Clear override',
  close: 'Close',
  saved: 'Result overridden',
  cleared: 'Override cleared',
} as const;
