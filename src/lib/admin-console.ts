import { api } from './api-client';

/**
 * **The Super Admin console's own reads** (P19.23-T1, T2; ADR-0277; `functional/super-admin-console.md` §10): the
 * Dashboard — which the KPM list reads too — and a KPM page's people. Every number is the server's; the colour scale
 * comes with the answer (`scale`, `CONSOLE.SCALE`), never re-declared here (invariant §7).
 */

/** What can be said of a KPM, in the order its card names the first (`KPM_ISSUES`). */
export type KpmIssue = 'suspended' | 'archived' | 'subscription_ended' | 'owner_not_invited' | 'no_members' | 'data_missing';

/** The four that are *Perlu tindakan*. */
export const ACTION_ISSUES: ReadonlySet<KpmIssue> = new Set(['subscription_ended', 'owner_not_invited', 'no_members', 'data_missing']);

export type OwnerState = 'none' | 'not_invited' | 'invited' | 'active';

/** One audience of one KPM: its members, and how many reached each step of the funnel. */
export interface UsageCounts {
  members: number;
  everUsed: number;
  used14: number;
  powerUsers: number;
}

export interface ConsoleKpm {
  kpmId: string;
  name: string;
  code: string;
  companyId: string;
  companyName: string;
  status: 'active' | 'suspended' | 'archived';
  /** Active and its subscription not ended: in *KPM aktif* and the adoption tree. */
  active: boolean;
  ownerName: string | null;
  ownerState: OwnerState;
  createdAt: string;
  usage: { leader: UsageCounts; agent: UsageCounts };
  issues: KpmIssue[];
  missingMonth: string | null;
}

export interface FunnelStep {
  count: number;
  pct: number;
  previousCount: number;
  previousPct: number;
}

export interface ConsoleScale {
  greenFromPct: number;
  yellowFromPct: number;
}

/** **`GET /admin/dashboard`**. */
export interface ConsoleDashboard {
  asOf: string;
  comparedWith: string;
  scale: ConsoleScale;
  overall: { kpms: number; kpmsNewThisMonth: number; companies: number; activeKpms: number; leaders: number; agents: number };
  funnel: { members: number; everUsed: FunnelStep; used14: FunnelStep; powerUsers: FunnelStep };
  approvalsPending: number;
  companies: { companyId: string; name: string }[];
  kpms: ConsoleKpm[];
}

export const readConsoleDashboard = () => api<ConsoleDashboard>('/admin/dashboard');

export type PersonClass = 'ab' | 'aab' | 'agent';

export interface ConsolePerson {
  membershipId: string;
  userId: string;
  fullName: string;
  class: PersonClass;
}

/** **`GET /admin/tenants/:id/people`**. */
export interface ConsoleKpmPeople {
  kpm: { kpmId: string; name: string; code: string; companyId: string; companyName: string; status: ConsoleKpm['status'] };
  owner: { state: OwnerState; person: ConsolePerson | null; pendingName: string | null };
  admins: ConsolePerson[];
  coreLeaders: ConsolePerson[];
  members: {
    total: number;
    leaders: number;
    agents: number;
    first: (ConsolePerson & { groupName: string | null; lastUsedDays: number | null; lastUsedStatus: 'recent' | 'lapsed' | 'never' })[];
  };
  viewAs: { owner: ConsolePerson[]; admin: ConsolePerson[]; ab: ConsolePerson[]; agent: ConsolePerson[] };
}

export const readKpmPeople = (kpmId: string) => api<ConsoleKpmPeople>(`/admin/tenants/${encodeURIComponent(kpmId)}/people`);

/** *Semua · Leader · Agent* (P19.23-T1 AC-4). */
export type Audience = 'all' | 'leader' | 'agent';

/** One KPM's (or company's) counts for the audience chosen. */
export function countsFor(usage: ConsoleKpm['usage'], audience: Audience): UsageCounts {
  if (audience === 'leader') return usage.leader;
  if (audience === 'agent') return usage.agent;
  return {
    members: usage.leader.members + usage.agent.members,
    everUsed: usage.leader.everUsed + usage.agent.everUsed,
    used14: usage.leader.used14 + usage.agent.used14,
    powerUsers: usage.leader.powerUsers + usage.agent.powerUsers,
  };
}

/** A company's KPMs' counts added up, class by class. */
export function sumUsage(kpms: readonly ConsoleKpm[]): ConsoleKpm['usage'] {
  const add = (a: UsageCounts, b: UsageCounts): UsageCounts => ({
    members: a.members + b.members, everUsed: a.everUsed + b.everUsed, used14: a.used14 + b.used14, powerUsers: a.powerUsers + b.powerUsers,
  });
  const zero: UsageCounts = { members: 0, everUsed: 0, used14: 0, powerUsers: 0 };
  return kpms.reduce((sum, k) => ({ leader: add(sum.leader, k.usage.leader), agent: add(sum.agent, k.usage.agent) }), { leader: zero, agent: zero });
}

/** A whole percentage, rounded half up; `0` of nobody. */
export const wholePct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** **The colour scale** (spec §3): green from `greenFromPct`, yellow from `yellowFromPct`, red below. */
export type ScaleTone = 'green' | 'amber' | 'red';
export function toneOf(pct: number, scale: ConsoleScale): ScaleTone {
  if (pct >= scale.greenFromPct) return 'green';
  if (pct >= scale.yellowFromPct) return 'amber';
  return 'red';
}

/** The pill's classes for a tone: the tokens, never a raw colour. */
export const TONE_PILL: Record<ScaleTone, string> = {
  green: 'bg-pill-green text-pill-green-ink',
  amber: 'bg-pill-amber text-pill-amber-ink',
  red: 'bg-pill-red text-pill-red-ink',
};

/** The KPMs that need action: at least one of the four. */
export const needsAction = (kpm: Pick<ConsoleKpm, 'issues'>) => kpm.issues.some((i) => ACTION_ISSUES.has(i));

/** A KPM's initials for its card: the first letters of its first two words (*BSD City Branch* → *BC*). */
export function kpmInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

/**
 * **Where a KPM's issue is acted on** (P19.23-T1 AC-3: *one button straight to the right page in that KPM*): an owner
 * page inside the KPM, or the console's own. `null`: the Owner's invitation, which is a button rather than a page.
 */
export function issueTarget(issue: KpmIssue): { inside: boolean; href: string } | null {
  switch (issue) {
    case 'no_members': return { inside: true, href: '/people/import' };
    case 'data_missing': return { inside: true, href: '/kpm/data-upload' };
    case 'subscription_ended': return { inside: false, href: '/admin/billing' };
    case 'owner_not_invited': return null;
    default: return null;
  }
}
