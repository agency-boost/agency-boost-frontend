import { api } from './api-client';

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

export interface ActivitySummary {
  from: string;
  to: string;
  totals: { activityTypeCode: string; label: string; count: number }[];
  daysLogged: number;
  totalCount: number;
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

export interface ActivityCompliance {
  membershipId: string;
  compliant7d: boolean;
  compliantMonth: boolean;
  lastLoggedOn: string | null;
  windowDays: number;
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

export const readActivitySummary = (
  params: { period?: string; from?: string; to?: string; membershipId?: string } = {},
) => api<ActivitySummary>('/activity/summary' + query(params));

/** Your own days over a range. There is no `membershipId`: the Dashboard is first-person (P10-T1). */
export const readActivityDashboard = (
  params: { range?: DashboardRange; from?: string; to?: string } = {},
) => api<ActivityDashboard>('/activity/dashboard' + query(params));

export const readActivityCompliance = (params: { membershipId?: string } = {}) =>
  api<ActivityCompliance>('/activity/compliance' + query(params));
