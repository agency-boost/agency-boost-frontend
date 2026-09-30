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

/** Your own days over a range. There is no `membershipId`: the Dashboard is first-person (P10-T1). */
export const readActivityDashboard = (
  params: { range?: DashboardRange; from?: string; to?: string } = {},
) => api<ActivityDashboard>('/activity/dashboard' + query(params));

/** The office's ratios over your last 30 days. Your own only: there is no `membershipId` (P10-T2). */
export const readActivityRatios = () => api<ActivityRatios>('/activity/ratios');

/*
 * **No wrapper for `GET /activity/summary` or `GET /activity/compliance`** (P10.1-T5 AC-9). Their one
 * caller was Log Activity's *Logged / Missed* card, which the client asked to have removed. Both
 * routes stay, exempted in `scripts/check-api-consumers.py` until the coaching task named there
 * gives each its caller; a wrapper nothing calls would only hide that from the gate.
 */
