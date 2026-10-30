'use client';

import { api } from './api-client';

/** Joining an office: register to one, then ask a leader to take you. */
export interface KpmDirectoryEntry {
  kpmId: string;
  code: string;
  branchName: string;
  /** Needed by somebody asking for an office that does not exist yet. */
  companyId: string;
  companyName: string;
  city: string | null;
}

export interface LeaderChoice {
  membershipId: string;
  fullName: string;
  role: 'ab' | 'aab';
  unitSize: number;
  isCurrentLeader: boolean;
  requestSent: boolean;
}

export interface JoinState {
  kpmId: string | null;
  kpmLabel: string | null;
  registeredAt: string | null;
  leaderMembershipId: string | null;
  leaderName: string | null;
  status: 'none' | 'pending' | 'active' | 'removed';
  pendingRequestTo: string | null;
}

export const readJoinState = () => api<JoinState>('/join/me');

export const searchKpms = (q?: string) =>
  api<KpmDirectoryEntry[]>(`/join/kpms${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const registerKpm = (kpmId: string) =>
  api<JoinState>('/join/kpm', { method: 'POST', body: { kpmId } });

export const searchLeaders = (q?: string) =>
  api<LeaderChoice[]>(`/join/leaders${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const requestLeader = (leaderMembershipId: string) =>
  api<JoinState>('/join/leader-request', { method: 'POST', body: { leaderMembershipId } });

export const cancelLeaderRequest = () =>
  api<JoinState>('/join/leader-request', { method: 'DELETE' });

/**
 * Your own code, in the three forms the prototype shows it: the code, the link, and a QR
 * of the link.
 *
 * One per person, generated with your membership and never reissued (P3.6-T1). The
 * `Invite` type that stood here carried `inviteId`, `label`, `autoApprove`, `maxUses`,
 * `useCount`, `expiresAt`, `revokedAt` and a derived `state` — every one of them a way to
 * bound a credential somebody could mint again. Nobody can.
 */
export interface MyLeaderCode {
  code: string;
  url: string;
}

export interface InvitePreview {
  code: string;
  kpmLabel: string;
  leaderName: string;
}

export const myLeaderCode = () => api<MyLeaderCode>('/join/my-code');

export const previewInvite = (code: string) =>
  api<InvitePreview>(`/join/invite?code=${encodeURIComponent(code)}`);

export const redeemInvite = (code: string) =>
  api<{ kpmId: string; leaderName: string }>('/join/redeem', { method: 'POST', body: { code } });

/** The leader's side: deciding who gets in, and pulling in somebody already here. */
export interface PendingRequest {
  requestId: string;
  membershipId: string;
  fullName: string;
  initials: string;
  email: string;
  agentCode: string;
  role: 'ab' | 'aab' | 'agent';
  requestedAt: string;
  /** Set when somebody above routed this to you instead of deciding it themselves. */
  routedFromName: string | null;
  /** The leader this request names — always you in your own inbox, not in the office queue. */
  leaderMembershipId: string;
  leaderName: string;
}

export interface RoutingChoice {
  membershipId: string;
  fullName: string;
  unitSize: number;
  /** Whose sub-unit this is. The office queue holds rows for many leaders. */
  forLeaderMembershipId: string;
}

export interface UntaggedMember {
  membershipId: string;
  fullName: string;
  initials: string;
  email: string;
  agentCode: string;
  role: 'ab' | 'aab' | 'agent';
}

export const readInbox = () => api<PendingRequest[]>('/join/requests');

/**
 * **How many requests are waiting on the reader** (UI V1, UI-085): the orange count on the *Pending Requests* tab, read
 * on all four User Management screens — the requests `readInbox` lists, counted on the server without their names.
 */
export const readWaitingCount = () => api<{ count: number }>('/join/requests/count');

export const readRoutingChoices = () => api<RoutingChoice[]>('/join/requests/routing');

/**
 * Approve a request: into the leader's unit or `routeToMembershipId`'s, with the day they joined — `joinDate`, an
 * office date (ADR-0169; P18.96-T3 AC-5). Omitted, the server gives them the office's today.
 */
export const approveRequest = (requestId: string, routeToMembershipId?: string, joinDate?: string) =>
  api<PendingRequest[]>(`/join/requests/${requestId}/approve`, {
    method: 'POST',
    body: {
      ...(routeToMembershipId ? { routeToMembershipId } : {}),
      ...(joinDate ? { joinDate } : {}),
    },
  });

export const declineRequest = (requestId: string, reason?: string) =>
  api<PendingRequest[]>(`/join/requests/${requestId}/decline`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });

export const searchUntagged = (q?: string) =>
  api<UntaggedMember[]>(`/join/untagged${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const tagUntagged = (membershipId: string) =>
  api<UntaggedMember[]>(`/join/untagged/${membershipId}`, { method: 'POST' });

export interface MyKpmRequest {
  requestId: string;
  branchName: string;
  companyName: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  reason: string | null;
  createdKpmId: string | null;
}

export const readMyKpmRequest = async (): Promise<MyKpmRequest | null> =>
  // Wrapped on the wire: a bare `null` arrives as an empty body, which is
  // indistinguishable from a response that failed to serialise.
  (await api<{ request: MyKpmRequest | null }>('/join/kpm-request')).request;

export const askForKpm = (body: { companyId: string; branchName: string; note?: string }) =>
  api<MyKpmRequest>('/join/kpm-request', { method: 'POST', body });
