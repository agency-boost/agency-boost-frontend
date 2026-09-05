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
