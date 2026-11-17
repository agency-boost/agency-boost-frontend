import { api } from './api-client';

/**
 * ***Core leaders & groups*** (P19.13-T3; UI-199; ADR-0253): the page's read and its two writes. The groups themselves
 * are `lib/org.ts`' (`createGroup`, `updateGroup`, `archiveGroup`), the one-tap ★ Core is `setCoreLeader`, and a leader's
 * targets are `saveSubgroupTarget` (`lib/advanced-analytics-page.ts`) — each route's one caller in the app.
 */

/** A leader's AA and recruitment targets for the year: their own, or the template's until set. */
export interface CoreLeaderTargets {
  aa: number;
  rec: number;
  isDefault: boolean;
}

/** One leader (AB or AAB) of the office, and their three tags. */
export interface CoreLeader {
  membershipId: string;
  name: string;
  agentCode: string | null;
  role: 'ab' | 'aab';
  /** Their one group, or `null` — *Tanpa group*. */
  groupId: string | null;
  isGroupLeader: boolean;
  isCoreLeader: boolean;
  /** `null` while the template's *Perbaikan sub-group* is off. */
  targets: CoreLeaderTargets | null;
}

export interface CoreLeaderGroup {
  groupId: string;
  name: string;
  /** The ★ group leader, or `null` — *Belum ada group leader*. */
  headMembershipId: string | null;
  headName: string | null;
  leaders: number;
}

export interface CoreLeadersView {
  /** *Target 2026*. */
  year: string;
  /** A to Z. */
  leaders: CoreLeader[];
  /** A to Z. */
  groups: CoreLeaderGroup[];
  counts: { leaders: number; core: number; withGroup: number; withoutGroup: number };
  /** Off in a view-as session: every write hidden. */
  canWrite: boolean;
  canEditTargets: boolean;
}

/** **`GET /members/core-leaders`** — every leader, every group, the tiles' counts. */
export const readCoreLeaders = () => api<CoreLeadersView>('/members/core-leaders');

/** **`PUT /members/core-leaders/:membershipId`** — one leader's *Simpan*: their group, ★ and Core leader tag. */
export const saveCoreLeader = (
  membershipId: string, body: { groupId: string | null; isGroupLeader: boolean; isCoreLeader: boolean },
) => api<CoreLeadersView>(`/members/core-leaders/${encodeURIComponent(membershipId)}`, { method: 'PUT', body });

/**
 * **`PUT /members/core-leaders/bulk`** — *Atur group*, *Masukkan ke GROUP*, *★ Jadikan core* and a desktop row's group
 * pill: one request for every leader given. `groupId: null` is *Tanpa group*; leave a field out to keep it.
 */
export const bulkCoreLeaders = (
  body: { membershipIds: string[]; groupId?: string | null; isCoreLeader?: boolean },
) => api<CoreLeadersView>('/members/core-leaders/bulk', { method: 'PUT', body });

/** A filter of the page: everybody, the Core leaders, the leaders with a group or none, or one group. */
export type CoreLeadersFilter = 'all' | 'core' | 'has' | 'none' | { groupId: string };

/** `?group=` — `none`, `core`, or a group's id (Perbaikan sub-group's *Ubah target*) — as the page's filter. */
export function filterFromQuery(group: string | null | undefined): CoreLeadersFilter {
  if (!group) return 'all';
  if (group === 'none' || group === 'core') return group;
  return { groupId: group };
}

/** The leaders a filter and a search keep: by name or agent code, any case. */
export function leadersFor(view: CoreLeadersView, filter: CoreLeadersFilter, query: string): CoreLeader[] {
  const q = query.trim().toLowerCase();
  return view.leaders.filter((l) => (
    filter === 'all' ? true
      : filter === 'core' ? l.isCoreLeader
        : filter === 'has' ? l.groupId !== null
          : filter === 'none' ? l.groupId === null
            : l.groupId === filter.groupId
  ) && (q === '' || l.name.toLowerCase().includes(q) || (l.agentCode ?? '').toLowerCase().includes(q)));
}

/** The same filter, compared. */
export function sameFilter(a: CoreLeadersFilter, b: CoreLeadersFilter): boolean {
  return typeof a === 'string' || typeof b === 'string' ? a === b : a.groupId === b.groupId;
}

/** How many rows a list shows before *Lihat semua n ›* (the report: *Lists show 12 rows*). */
export const CORE_LEADERS_PAGE_ROWS = 12;
