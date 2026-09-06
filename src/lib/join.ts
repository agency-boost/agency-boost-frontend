'use client';

import { api } from './api-client';

/** Joining an office: register to one, then ask a leader to take you. */
export interface KpmDirectoryEntry {
  kpmId: string;
  code: string;
  branchName: string;
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

/** One invite, three presentations: the code, the link, and a QR of the link. */
export interface Invite {
  inviteId: string;
  code: string;
  url: string;
  label: string | null;
  autoApprove: boolean;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Derived server-side, because "why can nobody use this" needs one answer. */
  state: 'active' | 'revoked' | 'expired' | 'exhausted';
}

export interface InvitePreview {
  code: string;
  kpmLabel: string;
  leaderName: string;
}

export const listInvites = () => api<Invite[]>('/join/invites');

export const issueInvite = (body: { label?: string; maxUses?: number; expiresInDays?: number }) =>
  api<Invite>('/join/invites', { method: 'POST', body });

export const revokeInvite = (inviteId: string) =>
  api<Invite>(`/join/invites/${inviteId}`, { method: 'DELETE' });

export const previewInvite = (code: string) =>
  api<InvitePreview>(`/join/invite?code=${encodeURIComponent(code)}`);

export const redeemInvite = (code: string) =>
  api<{ kpmId: string; leaderName: string }>('/join/redeem', { method: 'POST', body: { code } });

export const INVITE_STATE_LABEL: Record<Invite['state'], string> = {
  active: 'Working',
  revoked: 'Withdrawn',
  expired: 'Expired',
  exhausted: 'Fully used',
};

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

export const readRoutingChoices = () => api<RoutingChoice[]>('/join/requests/routing');

export const approveRequest = (requestId: string, routeToMembershipId?: string) =>
  api<PendingRequest[]>(`/join/requests/${requestId}/approve`, {
    method: 'POST',
    body: routeToMembershipId ? { routeToMembershipId } : {},
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
