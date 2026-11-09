import { api } from './api-client';
import type { LeaderLimitRequestRow } from './leader-limit-requests';

/*
 * **The queue's read and its change event, apart from the requests' client** (the bundle, 2026-11-06;
 * `performance-and-scale.md`): the shell counts the Super Admin's pending requests on every page
 * (`useLeaderLimitPending`), and the rest of `leader-limit-requests.ts` — its asks, its decisions and their words — is
 * the console's. `leader-limit-requests.ts` re-exports both.
 */

// ---- AgencyBoost's side (`/admin/leader-limit-requests`).

export const readLeaderLimitQueue = () => api<LeaderLimitRequestRow[]>('/admin/leader-limit-requests');

/** Said after the console decides, so the nav's pending count reads afresh (`useLeaderLimitPending`). */
export const LEADER_LIMIT_QUEUE_CHANGED = 'agencyboost:leader-limit-queue-changed';
