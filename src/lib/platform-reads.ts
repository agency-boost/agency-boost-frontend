'use client';

import { api } from './api-client';
import type { KpmAnalyticsView, AnalyticsPeriod } from './kpm-analytics';
import { analyticsQuery } from './kpm-analytics';
import type { ComplianceSelection, ComplianceView } from './kpm-compliance';
import { complianceQuery } from './kpm-compliance';

/**
 * **The Super Admin's reads across KPMs** (ADR-0207; P19.4-T3): *All members*, the KPM comparison, *Lihat sebagai KPM*,
 * *Data bulanan* and the company's *KPM & data*. Every one is a `GET`, the Super Admin's alone, and audited by the server
 * per read — nothing here writes. The fields are ADR-0207 §2's, and nothing else: never an email or a phone.
 */

export interface CompanyRef { id: string; name: string }

export type MemberRoleFilter = 'ab' | 'aab' | 'agent';
export type MemberStatus = 'active' | 'pending' | 'removed';
export type MemberInvitation = 'invited' | 'not_invited' | 'signed_in';

/** One row of *All members*. */
export interface PlatformMemberRow {
  membershipId: string;
  fullName: string;
  agentCode: string;
  company: CompanyRef;
  kpm: { id: string; code: string; branch: string };
  role: { code: string; label: string; isOwner: boolean; isAdmin: boolean };
  leader: { fullName: string } | null;
  status: MemberStatus;
  invitation: MemberInvitation;
  joinedOn: string | null;
  /** The last day an activity was logged, or `null`: *"Belum pernah"*. */
  lastActiveOn: string | null;
}

export interface PlatformMembersPage {
  rows: PlatformMemberRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MembersFilters {
  companyId?: string;
  kpmId?: string;
  role?: MemberRoleFilter;
  status?: MemberStatus;
  q?: string;
  page?: number;
}

/** The query of `GET /admin/members`, the empty fields left out — with no `?`, which each call writes itself. */
export function membersQuery(filters: MembersFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || (key === 'page' && value === 1)) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/** A query helper's `?…` without its `?`: every call below writes the `?` literally (`check-api-consumers.py`). */
const bare = (query: string) => query.replace(/^\?/, '');

export const readMembers = (filters: MembersFilters = {}) => api<PlatformMembersPage>(`/admin/members?${membersQuery(filters)}`);

/** A rate as the Overview serves it. */
export interface Rate { count: number; of: number; pct: number | null }

/** One row of the KPM comparison: the Overview's own figures. */
export interface KpmComparisonRow {
  kpmId: string;
  code: string;
  branch: string;
  company: CompanyRef;
  members: number;
  activeThisMonth: { count: number | null; of: number; pct: number | null; month: string };
  activeUsers: { logged: number; notLogged: number; pct: number | null };
  coached: { d7: Rate; d30: Rate };
  production: { achievedMinor: number | null; targetMinor: number | null; pct: number | null };
  recruitment: { pipeline: number; target: number | null };
}

export interface KpmComparisonPage {
  rows: KpmComparisonRow[];
  page: number;
  pageSize: number;
  total: number;
  sort: string;
}

/** The comparison's columns the server sorts by. */
export const COMPARISON_SORTS = [
  'kpm', 'company', 'members', 'activeThisMonth', 'activeUsers', 'coached7d', 'coached30d', 'production', 'recruitment',
] as const;
export type ComparisonSort = (typeof COMPARISON_SORTS)[number];

export const readKpmComparison = (query: { companyId?: string; sort?: string; page?: number } = {}) =>
  api<KpmComparisonPage>(`/admin/analytics/kpms?${membersQuery(query as MembersFilters)}`);

/**
 * ***Lihat sebagai KPM*'s tab, kept in the address** (`?tab=overview|compliance`, the route registry): a choice of period,
 * group or item rewrites the query, and on the Super Admin's page it must not lose the tab. Anywhere else, unchanged.
 */
export function keepTab(query: string, platformKpmId: string | undefined, tab: 'overview' | 'compliance'): string {
  if (platformKpmId === undefined) return query;
  return query ? `${query}&tab=${tab}` : `?tab=${tab}`;
}

/** *Lihat sebagai KPM*'s *Overview*: exactly what the KPM's Owner reads, read-only. */
export const readKpmAnalyticsAsPlatform = (kpmId: string, period: AnalyticsPeriod, group: string | null) =>
  api<KpmAnalyticsView>(`/admin/tenants/${encodeURIComponent(kpmId)}/analytics?${bare(analyticsQuery(period, group))}`);

/** *Lihat sebagai KPM*'s *Compliance*. */
export const readComplianceAsPlatform = (kpmId: string, selection: ComplianceSelection, group: string | null) =>
  api<ComplianceView>(`/admin/tenants/${encodeURIComponent(kpmId)}/analytics/compliance?${bare(complianceQuery(selection, group))}`);

/** A month of *Data bulanan*: *Lengkap · Belum · —*. */
export interface KpmDataMonth { month: string; status: 'complete' | 'missing' | 'none' }

export interface KpmDataUpload {
  month: string;
  by: string | null;
  at: string | null;
  agents: number;
  note: { status: 'committed' | 'reverting' | 'reverted'; asOf: string | null };
}

export interface KpmDataView {
  kpmId: string;
  months: KpmDataMonth[];
  uploads: KpmDataUpload[];
}

export const readKpmData = (kpmId: string) => api<KpmDataView>(`/admin/tenants/${encodeURIComponent(kpmId)}/data`);

/** One KPM of *KPM & data*. */
export interface CompanyKpmRow {
  kpmId: string;
  code: string;
  branch: string;
  manpower: number;
  maa: number | null;
  apeYtdMinor: number | null;
  recruitmentYtd: number | null;
  data: 'complete' | 'missing';
  peers: { status: 'enough' | 'not_enough' | 'not_counted'; count: number; needed: number };
}

export interface CompanyKpmsView {
  company: CompanyRef;
  month: string;
  tiles: { kpms: number; activeOwners: number; members: number; notSignedIn: number; complete: number; needed: number };
  rows: CompanyKpmRow[];
}

export const readCompanyKpms = (companyId: string, month?: string) =>
  api<CompanyKpmsView>(`/admin/companies/${encodeURIComponent(companyId)}/kpms?${month ? `month=${month}` : ''}`);
