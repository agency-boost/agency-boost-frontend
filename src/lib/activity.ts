import { api } from './api-client';
import type { RatioDisplayUnit } from './ratio-format';

/**
 * What an agent did, day by day (P6).
 *
 * The write path carries **no membership id**, and that is not an omission: no role may log on
 * another person's behalf (`roles-and-permissions.md` §3.5). The server's route has no such
 * parameter either, so there is nothing here that could grow one by accident.
 */

export interface ActivityCount {
  activityTypeId: string;
  activityTypeCode: string;
  label: string;
  count: number;
}

export interface ActivityDay {
  membershipId: string;
  /** `YYYY-MM-DD` in the office's timezone — never the browser's. */
  localDate: string;
  entries: ActivityCount[];
  totalCount: number;
  version: number;
  frozenAt: string | null;
  /** Whether this reader may write this day. The Save button reads exactly this. */
  editable: boolean;
  correctionCount: number;
}

/** Why a row is on the Dashboard: `shown` today, or history kept so the totals add up (P10-T1). */
export type DashboardStanding = 'shown' | 'archived' | 'not_shown';

export type DashboardRange = 'ROLLING_7D' | 'ROLLING_30D' | 'CUSTOM';

/** One column, most recent first. `week` is a 7-day block counted back from the range's end. */
export interface DashboardBucket {
  from: string;
  to: string;
  days: number;
  kind: 'day' | 'week' | 'remainder';
}

export interface DashboardType {
  code: string;
  label: string;
  description: string | null;
  displayOrder: number;
  standing: DashboardStanding;
  total: number;
  counts: number[];
}

export interface DashboardSection {
  code: string;
  label: string;
  standing: DashboardStanding;
  total: number;
  counts: number[];
  types: DashboardType[];
}

/** The Activity Dashboard (P10-T1): your own days over a range. Every number is the server's. */
export interface ActivityDashboard {
  range: DashboardRange;
  from: string;
  to: string;
  days: number;
  /** Today in the office's timezone — the latest a custom range may end. */
  today: string;
  buckets: DashboardBucket[];
  sections: DashboardSection[];
  total: number;
  counts: number[];
  daysLogged: number;
  correctedDays: number;
}

/** One activity code in a ratio's formula, as the office names and numbers it. */
export interface RatioTerm {
  code: string;
  label: string;
  /** The number the log screen shows beside it; 0 when the code is unknown. */
  displayOrder: number;
}

/** One of the office's ratios over the member's last 30 days (P10-T2). Every number is the server's. */
export interface ActivityRatio {
  code: string;
  label: string;
  comparison: 'gte' | 'band';
  displayUnit: RatioDisplayUnit;
  benchmark: number;
  tag: { code: string | null; label: string } | null;
  sides: { numerator: string | null; denominator: string | null } | null;
  numerator: RatioTerm[];
  denominator: RatioTerm[];
  purpose: string | null;
  divergesFromStandard: boolean;
  /** A rate's proportion, or the balance's lean in points toward the numerator. `null` is not enough data. */
  value: number | null;
  share: number | null;
  numeratorCount: number;
  denominatorCount: number;
  status: 'success' | 'alert' | 'neutral';
}

export interface ActivityRatios {
  membershipId: string;
  from: string;
  to: string;
  days: number;
  /** Only the ratios that apply to this member's rung (ADR-0020). */
  ratios: ActivityRatio[];
}

/**
 * `?a=b`, or nothing.
 *
 * Kept out of the template literal on purpose: the API-consumer gate reads path **literals** out
 * of each call, and an interpolation at the end of one reads as part of the path. Concatenation
 * leaves the literal whole, so the gate sees the route the server actually serves.
 */
const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][],
  ).toString();
  return search ? `?${search}` : '';
};

export const readActivityDay = (params: { date?: string; membershipId?: string } = {}) =>
  api<ActivityDay>('/activity/log' + query(params));

/** Saves the caller's own day. The whole day is sent: a code left out counts as zero. */
export const saveActivityDay = (body: { date?: string; counts: Record<string, number> }) =>
  api<ActivityDay>('/activity/log', { method: 'PUT', body });

/** Corrects a day whose window has closed. The reason is required and is kept beside the numbers. */
export const correctActivityDay = (
  body: { date: string; counts: Record<string, number>; reason: string },
) => api<ActivityDay>('/activity/log/correction', { method: 'POST', body });

/**
 * Your own days over a range (P10-T1) — or, with `for`, a coachee's, on coaching's *Activity* tab
 * (P13.1-T9): answered only for somebody you coach, on their rung, and audited (roles §3.5). The subject
 * is `for`, as the ratios' is; the API refuses `membershipId` here by name.
 */
export const readActivityDashboard = (
  params: { range?: DashboardRange; from?: string; to?: string; for?: string } = {},
) => api<ActivityDashboard>('/activity/dashboard' + query(params));

/**
 * `?for=<membershipId>`, or nothing. Appended with `+`, never interpolated, for the reason `query`
 * gives.
 */
const forSubject = (membershipId?: string) =>
  (membershipId ? `?for=${encodeURIComponent(membershipId)}` : '');

/**
 * The office's ratios over the last 30 days. Without a subject they are the reader's own (P10-T2).
 *
 * **With one** — a coachee, on the coaching session's *Ratios* card and the Summary tab's *Activity
 * pulse* (P11-T4, P11-T8) — they are that member's, **on that member's rung** (ADR-0020): a ratio that
 * does not apply to them is not in the answer. The server answers 404 outside the reader's reach and
 * writes one audit entry per read of somebody else (roles §3.5).
 */
export const readActivityRatios = (membershipId?: string) =>
  api<ActivityRatios>('/activity/ratios' + forSubject(membershipId));

/** One activity code's count over the period. */
export interface ActivityTotal {
  activityTypeCode: string;
  label: string;
  count: number;
}

/**
 * One of the three cascade codes over the last 7 days, against `SUB_PERIOD_ACTIVITY_TARGET`: this
 * month's target scaled to the window, which every screen labels *pro-rated* (metrics §B.3).
 */
export interface SubPeriodTarget {
  key: 'leads' | 'appointments' | 'closings';
  /** The first code the office binds to this stage. */
  code: string;
  /**
   * Every code the office binds to this stage (ADR-0163); `logged` is their sum. Absent from a coaching snapshot
   * frozen before the binding existed, which keeps the one `code` it showed.
   */
  codes?: string[];
  logged: number;
  /** `null` without an APE target to derive it from; 0 when the month needs nothing more. */
  target: number | null;
}

/** One activity type's count inside a section chip. */
export interface ActivitySectionRow {
  code: string;
  label: string;
  count: number;
}

/** One of the office's summary tiles over the period, with its rows: the Summary's grouping (ADR-0064). */
export interface ActivitySection {
  code: string;
  label: string;
  total: number;
  rows: ActivitySectionRow[];
}

/** `GET /activity/summary`: what somebody logged over a period, with the coaching drill's breakdown. */
export interface ActivitySummary {
  from: string;
  to: string;
  totals: ActivityTotal[];
  daysLogged: number;
  totalCount: number;
  /** For `ROLLING_7D`. `null` (or absent) for the other periods. */
  targets?: SubPeriodTarget[] | null;
  sections?: ActivitySection[];
}

export type ActivitySummaryPeriod = 'ROLLING_7D' | 'ROLLING_30D' | 'CALENDAR_MONTH';

/**
 * What a member logged over a period — on the coaching session, the coachee's last 7 days against
 * their pro-rated targets, with the breakdown its drill draws (P11-T4 AC-4, P11-T8 AC-6). The server
 * resolves `membershipId` by the reader's reach, answers 404 outside it and audits the read.
 */
export const readActivitySummary = (params: { membershipId?: string; period?: ActivitySummaryPeriod } = {}) =>
  api<ActivitySummary>('/activity/summary' + query(params));

/*
 * `GET /activity/compliance` had Log Activity's *Logged / Missed* card for its caller and is retired
 * (P11-T6 AC-10): the roster draws no compliance, and nothing else asked for it. This module never had
 * a wrapper for it.
 */
