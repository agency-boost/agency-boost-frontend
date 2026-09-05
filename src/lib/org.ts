'use client';

import { api } from './api-client';
import { ROLE_LABEL } from '@/components/ui/role-badge';

/** The office roster. Mirrors `DirectoryMember` in the backend's directory service. */
export type HierarchyRole = 'ab' | 'aab' | 'agent';
export type MemberStatus = 'active' | 'pending' | 'removed';

export interface Member {
  membershipId: string;
  agentCode: string;
  role: HierarchyRole;
  status: MemberStatus;
  fullName: string;
  preferredName: string | null;
  email: string;
  initials: string;
  leaderId: string | null;
  leaderName: string | null;
  depth: number;
  directCount: number;
  subtreeCount: number;
  /** From the graph, not the role (OD-23) — an AAB with no reports leads nobody. */
  isLeader: boolean;
  isKpmOwner: boolean;
  isKpmAdmin: boolean;
  joinedAt: string | null;
  /** Set only on a removed row. */
  removedAt: string | null;
}

export interface MemberPage {
  members: Member[];
  nextCursor: string | null;
}

export interface DirectoryFilters {
  q?: string;
  role?: HierarchyRole;
  status?: MemberStatus;
  cursor?: string;
  limit?: number;
}

export function listMembers(filters: DirectoryFilters = {}): Promise<MemberPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return api<MemberPage>(`/members${query ? `?${query}` : ''}`);
}

export const readMember = (membershipId: string) => api<Member>(`/members/${membershipId}`);

export const listReports = (membershipId: string) =>
  api<Member[]>(`/members/${membershipId}/reports`);

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  removed: 'Removed',
};

/** The people who report to you, and what you may do to each. */
export interface TeamMember {
  membershipId: string;
  fullName: string;
  initials: string;
  agentCode: string;
  role: HierarchyRole;
  directCount: number;
  /** Sent by the server, so the screen keeps no second copy of the rule. */
  canChangeRole: boolean;
}

export interface RoleChangeEntry {
  membershipId: string;
  fullName: string;
  agentCode: string;
  fromRole: HierarchyRole | null;
  toRole: HierarchyRole | null;
  reason: string | null;
  actorName: string | null;
  changedAt: string;
}

export const readMyTeam = () => api<TeamMember[]>('/members/my-team');

export const changeRole = (membershipId: string, toRole: HierarchyRole, reason?: string) =>
  api<TeamMember[]>(`/members/${membershipId}/role`, {
    method: 'PATCH',
    body: { toRole, ...(reason ? { reason } : {}) },
  });

export const readRoleChangeLog = () => api<RoleChangeEntry[]>('/members/role-changes');

/** Where the reports of somebody being removed go. There is no default — see P3-T7 AC-3. */
export type SubtreeDisposition =
  | { action: 'reassign'; toMembershipId: string }
  | { action: 'orphan' };

/**
 * The word the server checks. Exported so the screen's gate and the request body cannot
 * disagree about what it is.
 */
export const REMOVAL_CONFIRMATION = 'REMOVE';

export const isRemovalConfirmed = (typed: string) =>
  typed.trim().toUpperCase() === REMOVAL_CONFIRMATION;

export const removeMember = (
  membershipId: string,
  input: { confirmation: string; reason?: string; subtree?: SubtreeDisposition },
) =>
  api<TeamMember[]>(`/members/${membershipId}`, {
    method: 'DELETE',
    body: {
      confirmation: input.confirmation,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.subtree ? { subtree: input.subtree } : {}),
    },
  });

/**
 * What a role change means for the person, in their leader's words.
 *
 * Taken from the prototype verbatim (`Overall.html:9043-9045`) — including the part
 * that matters most, that nobody moves.
 */
export function roleChangeExplanation(
  name: string,
  from: HierarchyRole,
  to: HierarchyRole,
): string {
  if (from === 'agent' && to === 'aab') {
    return `${name} will change from Agent to Associate Agency Builder. They keep reporting to you, and can now recruit and manage their own agents.`;
  }
  if (from === 'aab' && to === 'agent') {
    return `${name} will change from Associate Agency Builder back to Agent. They keep reporting to you, but will no longer manage their own agents.`;
  }
  return `${name} will change from ${ROLE_LABEL[from]} to ${ROLE_LABEL[to]}. Nobody moves — they keep reporting to whoever they report to now.`;
}
