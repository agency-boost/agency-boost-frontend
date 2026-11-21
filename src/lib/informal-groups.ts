import { api } from './api-client';

/**
 * **Informal groups on ABs, and the monthly targets per AB group** (P19.17-T4;
 * [ADR-0270](../../../docs/04-adr/0270-informal-groups-belong-to-abs-and-targets-are-set-per-ab-group-per-month.md);
 * `functional/org-hierarchy.md`, *Informal groups*). The client for the KPM Overview, All members and Advanced
 * analytics' *Informal group*, and the two dialogs they share (`components/groups/`).
 *
 * - **Only an AB carries a group**, one or none (*Tanpa group*); their AABs and agents follow them — moving an AB moves
 *   the whole team, and nothing is written on the team.
 * - **A group has any number of Group Leaders**, ABs in it.
 * - **Targets are set per AB group per month**; an informal group's and the KPM's are the sums. The APE target is the
 *   members' Goal Setting ÷ 12 and is never set here.
 *
 * Every write is the server's to refuse: the Super Admin in the KPM, the Owner, an Admin and a core leader write, and
 * `canWrite` says so for the screen.
 */

/** *n leader · n orang · n AB group*. */
export interface InformalGroupCounts {
  leaders: number;
  people: number;
  abGroups: number;
}

/** One AB in a group, or in *Tanpa group*, and their AB group's size. */
export interface InformalGroupAb {
  membershipId: string;
  name: string;
  agentCode: string | null;
  isGroupLeader: boolean;
  isCoreLeader: boolean;
  /** *n orang di grupnya*, the AB included. */
  people: number;
  leaders: number;
}

export interface InformalGroup {
  groupId: string;
  name: string;
  /** The Group Leaders, A to Z — any number, ABs only. */
  leaders: { membershipId: string; name: string }[];
  abs: InformalGroupAb[];
  counts: InformalGroupCounts;
}

/** **`GET /members/groups`**, and what every group write answers. */
export interface InformalGroupsView {
  groups: InformalGroup[];
  ungrouped: { abs: InformalGroupAb[]; counts: InformalGroupCounts };
  unplaced: number;
  canWrite: boolean;
}

export const readInformalGroups = () => api<InformalGroupsView>('/members/groups');

/**
 * ***Group baru*** — a name only; from an AB's picker, `abMembershipId` moves that AB and their team into it at once
 * (*"… dan timnya masuk ke group ini"*).
 */
export const createInformalGroup = (name: string, abMembershipId?: string | null) =>
  api<{ groupId: string; view: InformalGroupsView }>('/members/groups', {
    method: 'POST',
    body: abMembershipId ? { name, abMembershipId } : { name },
  });

/** ***Ubah nama***. */
export const renameInformalGroup = (groupId: string, name: string) =>
  api<InformalGroupsView>(`/members/groups/${encodeURIComponent(groupId)}`, { method: 'PUT', body: { name } });

/** ***Hapus group*** — archived; its ABs, and their teams, to *Tanpa group*. */
export const deleteInformalGroup = (groupId: string) =>
  api<InformalGroupsView>(`/members/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });

/** **An AB's group** — the group chip and the *Group* dialog; `null` is *Tanpa group*. The whole team follows. */
export const setAbGroup = (abMembershipId: string, groupId: string | null) =>
  api<InformalGroupsView>(`/members/${encodeURIComponent(abMembershipId)}/group`, { method: 'PUT', body: { groupId } });

/** ***Jadikan group leader · <group>*** — adds, never replaces. An AB of the group. */
export const appointGroupLeader = (groupId: string, abMembershipId: string) =>
  api<InformalGroupsView>(
    `/members/groups/${encodeURIComponent(groupId)}/leaders/${encodeURIComponent(abMembershipId)}`, { method: 'PUT' },
  );

/** ***Hapus sebagai group leader*** — they stay in the group. */
export const removeGroupLeader = (groupId: string, abMembershipId: string) =>
  api<InformalGroupsView>(
    `/members/groups/${encodeURIComponent(groupId)}/leaders/${encodeURIComponent(abMembershipId)}`, { method: 'DELETE' },
  );

/** *+ Tambah ke grup*'s answer: ABs moved, and the group's people now. */
export interface GroupMembersAdded {
  groupId: string;
  name: string;
  added: number;
  memberCount: number;
}

/** ***+ Tambah ke grup*** (Unit Dashboard, *Grup informal*): several ABs into one group at once, each with their team. */
export const addAbsToGroup = (groupId: string, membershipIds: readonly string[]) =>
  api<GroupMembersAdded>(`/members/groups/${encodeURIComponent(groupId)}/members`, { method: 'POST', body: { membershipIds } });

// ------------------------------------------------------------------------------------------- targets

/** Saved for this month, carried from an earlier one (*berlaku sampai diubah*), or none (*Belum ada target*). */
export type AbGroupTargetSource = 'set' | 'carried' | 'none';

/** One AB group's row on *Performa vs target*. */
export interface AbGroupTargetRow {
  abMembershipId: string;
  name: string;
  agentCode: string | null;
  isGroupLeader: boolean;
  people: number;
  /** *Target Active Agent per bulan*; `null` with none. */
  activeAgentTarget: number | null;
  /** *Target Rekrut per bulan*; `null` with none. */
  rekrutTarget: number | null;
  source: AbGroupTargetSource;
  fromMonth: string | null;
  /** January to this month, each month's Rekrut target. */
  rekrutYtdTarget: number;
  /** The members' Goal Setting ÷ 12, in sen. Never set here. */
  apeTargetMinor: number;
  goalsSet: number;
}

export interface AbGroupTargetTotals {
  activeAgentTarget: number;
  rekrutTarget: number;
  rekrutYtdTarget: number;
  apeTargetMinor: number;
  /** AB groups with no target. */
  unset: number;
  abGroups: number;
  people: number;
}

export interface AbGroupTargetGroup {
  /** `null`: *Tanpa group*. */
  group: { groupId: string; name: string } | null;
  leaders: { membershipId: string; name: string }[];
  totals: AbGroupTargetTotals;
  abGroups: AbGroupTargetRow[];
}

/** **`GET /kpm/ab-group-targets?month=`**, and what a save answers. */
export interface AbGroupTargetsView {
  month: string;
  /** The office's month: a month switcher's › stops here. */
  currentMonth: string;
  /** The months a target may be saved for. */
  earliestMonth: string;
  latestMonth: string;
  /** The steppers' upper bound. */
  max: number;
  currency: string;
  /** *Total KPM*. */
  total: AbGroupTargetTotals & { unplacedPeople: number };
  /** The informal groups A to Z, then *Tanpa group*. */
  groups: AbGroupTargetGroup[];
  canWrite: boolean;
}

export const readAbGroupTargets = (month?: string) =>
  api<AbGroupTargetsView>(`/kpm/ab-group-targets${month ? `?month=${encodeURIComponent(month)}` : ''}`);

/** **The target dialog's *Simpan***: one AB group, one month. Answers that month, so the row and every total update. */
export const saveAbGroupTarget = (
  abMembershipId: string, body: { month: string; activeAgentTarget: number; rekrutTarget: number },
) => api<AbGroupTargetsView>(`/kpm/ab-group-targets/${encodeURIComponent(abMembershipId)}`, { method: 'PUT', body });

/** One AB group's row of a month's view, wherever its informal group puts it. */
export function abGroupRowOf(view: AbGroupTargetsView, abMembershipId: string): { row: AbGroupTargetRow; group: AbGroupTargetGroup } | null {
  for (const group of view.groups) {
    const row = group.abGroups.find((r) => r.abMembershipId === abMembershipId);
    if (row) return { row, group };
  }
  return null;
}

/** The informal group an AB carries in a groups view, or `null` — *Tanpa group*. */
export function groupOfAb(view: InformalGroupsView, abMembershipId: string): InformalGroup | null {
  return view.groups.find((g) => g.abs.some((a) => a.membershipId === abMembershipId)) ?? null;
}

/** The months from `from` to `to`, `YYYY-MM`, newest first: the target dialog's month picker. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = to.split('-').map(Number);
  const [fy, fm] = from.split('-').map(Number);
  while (y > fy || (y === fy && m >= fm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}
