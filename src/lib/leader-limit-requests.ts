import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { leaderLimitMessages } from '@/i18n/messages/leader-limit';
import { api, type ApiError } from './api-client';

/**
 * **A leader past the office's limit waits for AgencyBoost's approval** (ADR-0157): the office asks, the Super
 * Admin decides, and an approval carries the change out past the limit. Mirrors `LeaderLimitRequestRow` in the
 * backend's `leader-limit-request.service.ts`.
 */
export type LeaderLimitAction = 'promote' | 'activate';
export type LeaderLimitRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface LeaderLimitRequestRow {
  requestId: string;
  kpmId: string;
  kpmCode: string;
  kpmBranchName: string;
  subjectMembershipId: string;
  subjectName: string;
  subjectAgentCode: string;
  action: LeaderLimitAction;
  /** The rung they stood on when it was asked, by its ladder code. */
  fromOrgLevelCode: string;
  /** `promote`: the rung asked for. */
  toOrgLevelCode: string | null;
  /** `promote`: the office's reason, which the role change log keeps. */
  reason: string | null;
  requestedByMembershipId: string;
  requestedByName: string;
  status: LeaderLimitRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  /** AgencyBoost's reason, or that it no longer applied. */
  declineReason: string | null;
  /** The office's limit and *Leaders used* now. */
  maxLeaders: number | null;
  leadersUsed: number;
}

// ---- The office's side (`/members`).

/** Ask AgencyBoost to approve one leader past the limit: the role change refused, or letting a pending leader in. */
export const askLeaderLimitApproval = (
  membershipId: string,
  body: { action: LeaderLimitAction; orgLevelCode?: string; reason?: string },
) => api<LeaderLimitRequestRow>(`/members/${membershipId}/leader-limit-request`, { method: 'POST', body });

/** The office's requests: every one for the Owner and an Admin, those they asked for an AB or AAB. */
export const readLeaderLimitRequests = () => api<LeaderLimitRequestRow[]>('/members/leader-limit-requests');

export const cancelLeaderLimitRequest = (requestId: string) =>
  api<LeaderLimitRequestRow[]>(`/members/leader-limit-requests/${requestId}`, { method: 'DELETE' });

/** The open request about one member, if any. Anything but a list — a read not made, or not understood — is none. */
export const pendingFor = (rows: readonly LeaderLimitRequestRow[] | null, membershipId: string) =>
  (Array.isArray(rows) ? rows : []).find((r) => r.subjectMembershipId === membershipId && r.status === 'pending') ?? null;

/**
 * **May this refusal be asked about?** The API says so on `LEADER_LIMIT_REACHED` — `details.canRequest` — for a
 * reader who may ask, on a write that can wait (a role change, letting in a pending leader). The roster import and
 * an Owner's assignment never can.
 */
export function canRequestApproval(error: Pick<ApiError, 'code' | 'details'> | null | undefined): boolean {
  return error?.code === 'LEADER_LIMIT_REACHED'
    && (error.details as { canRequest?: boolean } | undefined)?.canRequest === true;
}

// ---- AgencyBoost's side (`/admin/leader-limit-requests`).

export const readLeaderLimitQueue = () => api<LeaderLimitRequestRow[]>('/admin/leader-limit-requests');

export const approveLeaderLimitRequest = (requestId: string) =>
  api<LeaderLimitRequestRow[]>(`/admin/leader-limit-requests/${requestId}/approve`, { method: 'POST' });

export const declineLeaderLimitRequest = (requestId: string, reason: string) =>
  api<LeaderLimitRequestRow[]>(`/admin/leader-limit-requests/${requestId}/decline`, {
    method: 'POST', body: { reason },
  });

/** Said after the console decides, so the nav's pending count reads afresh (`useLeaderLimitPending`). */
export const LEADER_LIMIT_QUEUE_CHANGED = 'agencyboost:leader-limit-queue-changed';

/**
 * What the request asks for, in a sentence: *Agent → Associate Agency Builder*, or *let in as AAB* — in the reader's
 * `language` (P18.98-T4; `useLanguage()`), English, the source, when given none.
 */
export function requestedChange(
  row: Pick<LeaderLimitRequestRow, 'action' | 'fromOrgLevelCode' | 'toOrgLevelCode'>,
  label: (code: string) => string,
  language: Language = SOURCE_LANGUAGE,
): string {
  return row.action === 'promote'
    ? `${label(row.fromOrgLevelCode)} → ${label(row.toOrgLevelCode ?? '')}`
    : messagesIn(leaderLimitMessages, language).letInAs({ rung: label(row.fromOrgLevelCode) });
}
