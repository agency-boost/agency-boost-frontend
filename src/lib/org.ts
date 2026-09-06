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
  /** How many are in each tab, so the labels can carry counts as the prototype does. */
  counts: { directory: number; pending: number; removed: number };
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

/** One person in the tree. `layer` is one-based within this projection, not office depth. */
export interface OrgTreeNode {
  membershipId: string;
  fullName: string;
  preferredName: string | null;
  initials: string;
  agentCode: string;
  role: HierarchyRole;
  depth: number;
  layer: number;
  leaderId: string | null;
  directCount: number;
  /** The direct reports split by role, so the node can write the prototype's sentence. */
  directCounts: { ab: number; aab: number; agent: number; total: number };
  subtreeCount: number;
  isLeader: boolean;
  isSelf: boolean;
}

/**
 * Your own leader. A different type from a node on purpose: it has no layer and no
 * leaderId, so it cannot be drawn as one (AC-1).
 */
export interface OrgTreeLeader {
  membershipId: string;
  fullName: string;
  initials: string;
  role: HierarchyRole;
}

export interface OrgTree {
  nodes: OrgTreeNode[];
  leader: OrgTreeLeader | null;
  rootIds: string[];
  selfId: string | null;
  counts: { ab: number; aab: number; agent: number; total: number };
}

export const readOrgTree = () => api<OrgTree>('/members/tree');

/** An informal group. A label the office defines — never hierarchy, never access. */
export interface GroupSummary {
  groupId: string;
  name: string;
  ownerMembershipId: string;
  ownerName: string;
  /** They have been removed from the office, so the group has nobody running it. */
  ownerHasLeft: boolean;
  memberCount: number;
}

export interface MemberTags {
  membershipId: string;
  fullName: string;
  groupIds: string[];
  isCoreLeader: boolean;
}

/** Somebody the Owner has handed the office's administration to. */
export interface DelegatedAdmin {
  membershipId: string;
  fullName: string;
  initials: string;
  agentCode: string;
  /** Independent of admin rights — an AB with a unit of forty can hold them. */
  role: HierarchyRole;
  grantedAt: string | null;
  grantedByName: string | null;
  canRevoke: boolean;
}

export const listAdmins = () => api<DelegatedAdmin[]>('/members/admins');

export const grantAdmin = (membershipId: string) =>
  api<DelegatedAdmin[]>(`/members/${membershipId}/admin`, { method: 'POST' });

export const revokeAdmin = (membershipId: string) =>
  api<DelegatedAdmin[]>(`/members/${membershipId}/admin`, { method: 'DELETE' });

export const listGroups = () => api<GroupSummary[]>('/members/groups');

export const createGroup = (name: string, ownerMembershipId: string) =>
  api<GroupSummary[]>('/members/groups', { method: 'POST', body: { name, ownerMembershipId } });

export const updateGroup = (groupId: string, name: string, ownerMembershipId: string) =>
  api<GroupSummary[]>(`/members/groups/${groupId}`, {
    method: 'PUT',
    body: { name, ownerMembershipId },
  });

export const archiveGroup = (groupId: string) =>
  api<GroupSummary[]>(`/members/groups/${groupId}`, { method: 'DELETE' });

export const readTags = (membershipId: string) =>
  api<MemberTags>(`/members/${membershipId}/tags`);

export const setTags = (membershipId: string, groupIds: string[], isCoreLeader: boolean) =>
  api<MemberTags>(`/members/${membershipId}/tags`, {
    method: 'PUT',
    body: { groupIds, isCoreLeader },
  });

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
