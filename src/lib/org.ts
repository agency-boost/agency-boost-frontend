'use client';

import { api } from './api-client';
import { rungShort } from '@/components/ui/role-badge';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { orgMessages } from '@/i18n/messages/org';
import type { OrgLevel } from './tenant-config-cache';
import type { PersonalDetails } from './personal';

/** The office roster. Mirrors `DirectoryMember` in the backend's directory service. */
export type HierarchyRole = 'ab' | 'aab' | 'agent';
export type MemberStatus = 'active' | 'pending' | 'removed';

export interface Member {
  membershipId: string;
  agentCode: string;
  role: HierarchyRole;
  /** The rung they stand on, by its ladder code; `role` is the class it gives (ADR-0156). */
  orgLevelCode?: string;
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
  /**
   * A Core Leader now (ADR-0159 §1): tagged, on a leader rung — the effective flag, which the row's chip says. Optional
   * so a fixture that is about something else need not say it; absent is *not one*.
   */
  isCoreLeader?: boolean;
  /**
   * This viewer may tag or untag them *Core Leader* from the row (P18.5-T5 AC-3): they hold the permission, and the
   * member leads by rung and has not left. An offer — `PUT /members/:id/core-leader` refuses regardless.
   */
  canTagCoreLeader?: boolean;
  /** The system's stamp: when the membership was made active. Not the join date. */
  joinedAt: string | null;
  /**
   * The person's **join date** here, an office date their leader gave (ADR-0169; P18.8-T2): what *Join date*
   * prints. `null` while pending. Optional, for a read older than it.
   */
  joinDate?: string | null;
  /** Set only on a removed row. */
  removedAt: string | null;
  /**
   * **Whether they were invited, and have signed in** (P19.12-T5 AC-4; ADR-0248 §4), the server's: `signed_in`, or —
   * never signed in — `invited` (*Diundang*) or `not_invited` (*Belum diundang*). An active member who never signed in
   * reads one of those two in place of *Aktif* (`memberStateOf`). Optional for a read older than it; absent is *Aktif*.
   */
  invitation?: InvitationState;
  /**
   * **The office date the person came back, if they did** (P18.9-T4 AC-3, ADR-0176 §5), the server's: on a live
   * membership that follows a removed one, its own join date — *Rejoined* beside the status; on the removed one, the
   * later membership's — *Rejoined {date}* under *Removed*. Optional, for a read older than it; absent is *never left*.
   */
  rejoinedOn?: string | null;
  /**
   * What **this viewer** may do to this person, decided by the server (P3.1-T13).
   *
   * Three flags because the permission matrix has three rows: Agent⇄AAB is a direct
   * leader's call, anything involving AB is the office's, and removal has refusals of its
   * own — yourself, the office root, somebody already gone.
   *
   * They decide what is *offered*. The API refuses regardless, and a screen carrying its
   * own copy of these rules is a screen that can drift from them.
   */
  canChangeRole: boolean;
  canPromoteToAb: boolean;
  canRemove: boolean;
  /**
   * The rungs this reader may put them on, by ladder code, junior first, their own among them (P19.12-T4, ADR-0247
   * §1) — `canChangeRole` and `canPromoteToAb` are read off it. Optional for a fixture older than it.
   */
  roleChoices?: string[];
  /**
   * This reader may change who they report to — *Ganti* on *Melapor ke* (P19.12-T4, ADR-0247 §2). Optional; absent
   * is no. `PUT /members/:id/leader` refuses regardless.
   */
  canChangeLeader?: boolean;
  /**
   * The directory's *Last activity* (P18-T1, D-directory): the member's last logged day, in the office's
   * calendar, and how many days ago that was; `null` when they have never logged. Each directory row
   * carries them and is an audited read; optional because one member's own read does not.
   */
  lastActivityOn?: string | null;
  lastActivityDays?: number | null;
  /**
   * What the person records (ADR-0158 §6, P18.5-T4): on one member's read only, and only to the office's
   * Owner, an Admin or the person themselves — absent on the roster and on a leader's read. A `null`
   * inside is *Not recorded*.
   */
  personal?: PersonalDetails & {
    /**
     * **The office's company, by name** (ADR-0205 §4, OWN UI-025): what *Bergabung di <company>* names beside the company
     * join month. Optional for a read older than it; `null` for an office with no company.
     */
    companyName?: string | null;
    /**
     * **Their WhatsApp number** (P19.12-T5 AC-2; ADR-0248 §2), as stored, `+62…`; `null` is *Belum dicatat*. Optional for
     * a read older than it.
     */
    phone?: string | null;
  };
  /** The directory's *Last coached*: `DAYS_SINCE_LAST_COACHING`, `null` without a session. */
  lastCoachedDays?: number | null;
}

/** Whether somebody was invited, and has signed in (ADR-0212 §2, ADR-0248 §4) — `DirectoryMember.invitation`. */
export type InvitationState = 'signed_in' | 'invited' | 'not_invited';

/** What a member's pill says: their status, or — active and never signed in — whether they were invited. */
export type MemberState = MemberStatus | 'invited' | 'not_invited';

/**
 * **The pill's state** (P19.12-T5 AC-4; ADR-0248 §4; the client's TI-1, *"Diundang sampai login pertama"*): an active
 * member who has never signed in is *Diundang* or *Belum diundang*, never *Aktif*; everybody else their status. The
 * server decides both halves; this only chooses which one the pill says.
 */
export function memberStateOf(member: Pick<Member, 'status' | 'invitation'>): MemberState {
  if (member.status === 'active' && member.invitation && member.invitation !== 'signed_in') return member.invitation;
  return member.status;
}

/** A state's pill tone: *Aktif* green, *Dikeluarkan* red, and the three waiting states grey. */
export const MEMBER_STATE_TONE: Record<MemberState, 'success' | 'alert' | 'neutral'> = {
  active: 'success',
  pending: 'neutral',
  removed: 'alert',
  invited: 'neutral',
  not_invited: 'neutral',
};

/** The five a member page's *Lengkapi data* may fill, by their API names (`PATCH /members/:id/personal`). */
export type PersonalField = 'dateOfBirth' | 'gender' | 'companyJoinMonth' | 'workStatus' | 'phone';

/** What `PATCH /members/:membershipId/personal` answers: what was filled, and *Data pribadi* as it now stands. */
export interface MemberPersonalCompleted {
  membershipId: string;
  filled: PersonalField[];
  personal: NonNullable<Member['personal']>;
}

/**
 * ***Lengkapi data*** (P19.12-T5 AC-3; ADR-0248 §3) — the Owner or an Admin fills a member's **blank** personal fields,
 * `member:complete_personal`. Send only the blank ones: one already on file is `409 MEMBER_DETAIL_ON_FILE`, nothing
 * written; another office's member, or somebody removed, `404`. `phone` as typed, `+62…` or the national digits.
 */
export const completePersonal = (
  membershipId: string,
  fields: Partial<Record<PersonalField, string>>,
) =>
  api<MemberPersonalCompleted>(`/members/${encodeURIComponent(membershipId)}/personal`, { method: 'PATCH', body: fields });

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

/**
 * **A member's four tiles** (ADR-0205 §1; OWN UI-020, OWN R4) — `GET /members/:membershipId/performance`, mirroring
 * `MemberPerformanceView` in the backend. Each figure is the one another screen shows for the same person: the coaching
 * session's Activity card, the Unit Dashboard's goal cell for the year — **the office's figure only, never an estimate**
 * — and its *Leads penjualan* and *Closing* for the month. Money in IDR sen.
 */
export interface MemberPerformance {
  membershipId: string;
  today: string;
  /** *Aktivitas 7 hari*: every count logged over the 7 days to `to`, the office's today. */
  activity: { from: string; to: string; count: number };
  /**
   * *Produksi tahun ini*: `actualMinor` `null` is *Belum diunggah*; `goalSet` false is *no goal*, and then the target
   * and the percentage are `null`.
   */
  production: { year: string; actualMinor: number | null; targetMinor: number | null; attainmentPct: number | null; goalSet: boolean };
  /** *1:1 terakhir*; `null` is *Belum pernah*. */
  lastOneOnOne: { date: string } | null;
  /** *Leads* (open sales leads) and *n closing* (reached *Paid and issued* this month). */
  leads: { month: string; open: number; closing: number };
}

export const readMemberPerformance = (membershipId: string) =>
  api<MemberPerformance>(`/members/${encodeURIComponent(membershipId)}/performance`);

/**
 * **Where *Lihat dashboard ›* goes** (ADR-0205 §3; OWN R4): the page Group Tree opens for that person — somebody who
 * leads (a direct report, OD-23) their Unit Dashboard, anybody else their Personal Summary in the coaching shell.
 */
export function memberDashboardHref(member: Pick<Member, 'membershipId' | 'isLeader'>): string {
  const id = encodeURIComponent(member.membershipId);
  return member.isLeader ? `/unit/dashboard/${id}` : `/coaching/${id}/summary`;
}

export const listReports = (membershipId: string) =>
  api<Member[]>(`/members/${membershipId}/reports`);

/** A member's status as its pill says it, English — the source; a screen reads the reader's (`orgMessages.status`). */
export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = orgMessages.en.status;

/** The people who report to you, and what you may do to each. */
export interface TeamMember {
  membershipId: string;
  fullName: string;
  initials: string;
  agentCode: string;
  role: HierarchyRole;
  /** The rung they stand on, by its ladder code (ADR-0156). */
  orgLevelCode?: string;
  directCount: number;
  /** Everybody below them, who moves with them to another leader. Optional for a fixture older than it. */
  subtreeCount?: number;
  /** Sent by the server, so the screen keeps no second copy of the rule. */
  canChangeRole: boolean;
  /**
   * **The rungs this reader may put them on, by ladder code, junior first, their own rung always among them**
   * (P19.12-T4; ADR-0247 §1): a direct leader any rung no higher than their own — an AB leader *Agent · AAB · AB* — and
   * the Owner or an Admin every rung. *Tim Anda*'s role sheet offers exactly these. Optional for a fixture older than it.
   */
  roleChoices?: string[];
  /** This reader may move them to another leader (*Pindahkan ke leader lain*, ADR-0247 §2). Optional, absent is no. */
  canChangeLeader?: boolean;
  /**
   * **A move to a leader outside the reader's tree, waiting on the Owner or an Admin** (ADR-0247 §3): the row reads
   * *Menunggu persetujuan pemindahan ke {to}* with *Batalkan*. `null` when none waits.
   */
  pendingTransfer?: PendingMove | null;
}

/** A move waiting on the office, as whoever asked for it sees it (`POST /members/:id/transfer-request`). */
export interface PendingMove {
  transferId: string;
  /** The leader they would move under, by name. */
  toName: string;
  requestedAt: string;
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

/**
 * `toRole` is a rung of the company's ladder, by its code — `aab`, or a rung the company added, `SM` (OD-50). The
 * class the member is given follows the rung's leader tier, on the server.
 */
export const changeRole = (membershipId: string, toRole: string, reason?: string) =>
  api<TeamMember[]>(`/members/${membershipId}/role`, {
    method: 'PATCH',
    body: { toRole, ...(reason ? { reason } : {}) },
  });

export const readRoleChangeLog = () => api<RoleChangeEntry[]>('/members/role-changes');

/**
 * **A leader somebody may be moved under** (`GET /members/:id/leader-choices`; P19.12-T4, ADR-0247 §2), mirroring
 * `LeaderMoveChoice` in the backend. Never the person, anybody below them, their leader now, or anybody who cannot
 * lead a unit. `direct`: the move is made at once — the Owner's and an Admin's every choice, a leader's own tree — and
 * otherwise it is asked of the Owner or an Admin (`requestTransfer`).
 */
export interface LeaderMoveChoice {
  membershipId: string;
  fullName: string;
  agentCode: string;
  orgLevelCode: string;
  role: HierarchyRole;
  /** How many active people are below them now. */
  unitSize: number;
  direct: boolean;
}

/** The leaders this reader may move somebody under, by part of a name or an agent code (`q`). */
export const readLeaderChoices = (membershipId: string, q?: string) =>
  api<LeaderMoveChoice[]>(
    `/members/${encodeURIComponent(membershipId)}/leader-choices${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
  );

/**
 * **Move somebody, with everybody under them, to another leader — now** (`PUT /members/:id/leader`; ADR-0247 §2):
 * the Owner and an Admin anywhere in the office, a leader one of their direct reports to somebody in their own tree.
 * Answers the member as they now stand.
 */
export const changeLeader = (membershipId: string, leaderMembershipId: string, reason?: string) =>
  api<Member>(`/members/${encodeURIComponent(membershipId)}/leader`, {
    method: 'PUT',
    body: { leaderMembershipId, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
  });

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
  /**
   * **Today's activity count** (UI V1, UI-059; O-5): the office's day, the total Activity Management saved — the Group
   * Tree's *n aktivitas* / *Belum lapor* pill. Optional for a fixture written before it; absent reads as nothing logged.
   */
  todayActivityCount?: number;
  /** Their profile photo, when they have one (UI-059). */
  photoUrl?: string | null;
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

/**
 * The tree: the reader's own, or with `forId` **a leader's, read-only, as that leader sees it** (P19.3-T3;
 * `/group-tree/[membershipId]`) — 404 outside the reader's reach or in another office, 403 for an Agent.
 */
export const readOrgTree = (forId?: string) =>
  api<OrgTree>('/members/tree' + (forId ? `?for=${encodeURIComponent(forId)}` : ''));

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
  /** The tag as stored; it has effect only while `canBeCoreLeader`. */
  isCoreLeader: boolean;
  /**
   * Their rung is a leader rung, so the tag may be set (ADR-0159 §1). False for an Agent — the API refuses the tag
   * `CORE_LEADER_NOT_A_LEADER` — and for a member tagged and since moved off a leader rung. Optional for a fixture.
   */
  canBeCoreLeader?: boolean;
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

/**
 * **Tag or untag one member *Core Leader* from the directory row** (ADR-0159 §1, P18.5-T5 AC-3): the flag alone,
 * their groups untouched. A non-leader is refused `400 CORE_LEADER_NOT_A_LEADER`.
 */
export const setCoreLeader = (membershipId: string, isCoreLeader: boolean) =>
  api<MemberTags>(`/members/${membershipId}/core-leader`, {
    method: 'PUT',
    body: { isCoreLeader },
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
 * What a role change means for the person.
 *
 * Taken from the prototype verbatim (`Overall.html:9043-9045`) — including the part that
 * matters most, that nobody moves.
 *
 * **`viewer` is required, not defaulted**, because two of the prototype's three sentences
 * say *"they keep reporting to **you**"*. That is true on a leader's own team, which is
 * the only screen the prototype has. On the person page an Owner acts on people who
 * report to somebody else, and the same sentence would be a plain falsehood — so the
 * office reads the general wording, which is true for everyone. A default would be how
 * the wrong voice arrives on a new screen without anybody choosing it.
 */
export function roleChangeExplanation(
  name: string,
  from: string,
  to: string,
  viewer: 'their-leader' | 'the-office',
  /**
   * The company's ladder, for a rung it added (OD-50). Each rung by its badge's name, *AAB* (P18.7-T9 AC-1;
   * *Associate Agency Builder* until then). The seeded one by default.
   */
  ladder?: OrgLevel[],
  /** The reader's language (P18.10-T4; `useLanguage()`): English, the source, when given none. */
  language: Language = SOURCE_LANGUAGE,
): string {
  const [f, t] = [from.toLowerCase(), to.toLowerCase()];
  const words = messagesIn(orgMessages, language).roleChange;
  const values = { name, from: rungShort(from, ladder), to: rungShort(to, ladder) };
  if (viewer === 'their-leader' && f === 'agent' && t === 'aab') return words.promoted(values);
  if (viewer === 'their-leader' && f === 'aab' && t === 'agent') return words.demoted(values);
  return words.general(values);
}
