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
