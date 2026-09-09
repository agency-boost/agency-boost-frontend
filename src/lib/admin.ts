'use client';

import { api } from './api-client';

/**
 * The Super Admin console's API surface.
 *
 * Mongo documents serialize with `_id`, not `id`. Renaming it here would be a lie the
 * next developer has to unpick when they compare a payload in Swagger against this
 * file, so the wire shape is kept as it is.
 */

export type TenantStatus = 'active' | 'suspended' | 'archived';

export interface Company {
  _id: string;
  name: string;
  slug: string;
  defaultCurrency: string;
  defaultTimezone: string;
  status: 'active' | 'suspended';
}

/**
 * A KPM as the console reads it.
 *
 * `ownerName`, `ownerEmail` and `companyName` are resolved by the API (P3.5-T14 AC-7).
 * The screens used to render `ownerUserId` — a 24-character hex string in a column
 * headed **Owner** — because no screen can turn a user id into a name and nothing was
 * asking the server to.
 *
 * `counters` is deliberately absent: the office's internal agent-code sequence used to
 * ride along on the wire and is nobody's business but the server's.
 */
export interface Kpm {
  _id: string;
  companyId: string;
  companyName: string;
  code: string;
  branchName: string;
  address: string | null;
  contactPhone: string | null;
  ownerUserId: string | null;
  /** Null when nobody owns the office. `'Unknown'` when the owner's account has gone. */
  ownerName: string | null;
  ownerEmail: string | null;
  timezone: string;
  locale: string;
  currency: string;
  status: TenantStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  settings: Record<string, number>;
}

export interface AuditEntry {
  _id: string;
  kpmId: string | null;
  actorUserId: string;
  effectiveUserId: string | null;
  action: string;
  targetCollection: string;
  targetId: string | null;
  onBehalfOf: boolean;
  createdAt: string;
}

export interface AttentionItem {
  tag: string;
  severity: 'structural' | 'approval' | 'template';
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
}

export interface CompanyCard {
  companyId: string;
  name: string;
  initials: string;
  kpmCount: number;
  memberCount: number;
  /** The company's active rungs, junior first. Empty when nobody has defined a ladder. */
  ladder: string[];
}

/** A rung on a company's role ladder (P3.5-T7, ADR-0012). */
export interface OrgLevel {
  orgLevelId: string;
  companyId: string;
  /** Stable and semantic. Never renamed, never reused — not even after archiving. */
  code: string;
  label: string;
  displayOrder: number;
  status: 'active' | 'archived';
  archivedAt: string | null;
}

export const listOrgLevels = () => api<OrgLevel[]>('/admin/org-levels');

export const createOrgLevel = (body: {
  companyId: string;
  code: string;
  label: string;
  displayOrder: number;
}) => api<OrgLevel[]>('/admin/org-levels', { method: 'POST', body });

/** No `code`: it is the identity every membership holds and is never updatable. */
export const updateOrgLevel = (
  orgLevelId: string,
  body: { label?: string; displayOrder?: number; status?: 'active' | 'archived' },
) => api<OrgLevel[]>(`/admin/org-levels/${orgLevelId}`, { method: 'PATCH', body });

export interface PlatformOverview {
  tiles: { companies: number; kpms: number; totalMembers: number; agencyBuilders: number };
  attention: AttentionItem[];
  companies: CompanyCard[];
}

export const readPlatformOverview = () => api<PlatformOverview>('/admin/overview');

export interface KpmRequestRow {
  requestId: string;
  branchName: string;
  companyId: string;
  companyName: string;
  requestedByName: string;
  requestedByEmail: string;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  decidedAt: string | null;
  reason: string | null;
  createdKpmId: string | null;
}

export interface PlatformAdminRow {
  membershipId: string;
  fullName: string;
  email: string;
  initials: string;
  kpmId: string;
  kpmLabel: string;
  isOwner: boolean;
  isAdmin: boolean;
  grantedAt: string | null;
}

export const readTenantAdmins = () => api<PlatformAdminRow[]>('/admin/tenant-admins');

export const readKpmRequests = () => api<KpmRequestRow[]>('/admin/kpm-requests');

export const approveKpmRequest = (requestId: string, code: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/approve`, {
    method: 'POST',
    body: { code },
  });

export const declineKpmRequest = (requestId: string, reason?: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/decline`, {
    method: 'POST',
    body: { reason },
  });

export const listCompanies = () => api<Company[]>('/admin/companies');

export const createCompany = (body: { name: string; slug: string }) =>
  api<Company>('/admin/companies', { method: 'POST', body });

export const listTenants = () => api<Kpm[]>('/admin/tenants');

export const readTenant = (id: string) => api<Kpm>(`/admin/tenants/${id}`);

export interface CreateKpmInput {
  companyId: string;
  code: string;
  branchName: string;
  address?: string;
  contactPhone?: string;
}

export const createTenant = (body: CreateKpmInput) =>
  api<Kpm>('/admin/tenants', { method: 'POST', body });

/** By email, which is what a Super Admin knows. The id is accepted too, for Swagger. */
export const assignOwner = (id: string, who: { email?: string; userId?: string }) =>
  api<Kpm>(`/admin/tenants/${id}/owner`, { method: 'PATCH', body: who });

export const setTenantStatus = (id: string, status: TenantStatus, reason?: string) =>
  api<Kpm>(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status, reason } });

/** Omitting `kpmId` reads the platform-level log — provisioning, companies, impersonation. */
export const readAudit = (kpmId?: string) =>
  api<AuditEntry[]>(kpmId ? `/admin/audit?kpmId=${encodeURIComponent(kpmId)}` : '/admin/audit');

export const startImpersonation = (userId: string, reason: string, durationMinutes?: number) =>
  api<{ accessToken: string; expiresAt: string }>(`/admin/impersonate/${userId}`, {
    method: 'POST',
    body: { reason, ...(durationMinutes ? { durationMinutes } : {}) },
  });

export const endImpersonation = () =>
  api<{ status: string }>('/admin/impersonate/end', { method: 'POST' });

/** Tenant status is a lifecycle, not a health signal — so it gets its own labels. */
export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  archived: 'Archived',
};

/** Filling a new office from a spreadsheet (P3.6-T4). */
export interface RosterIssue {
  /** The line a spreadsheet shows, header counted — so it can be read straight across. */
  line: number;
  column: string;
  message: string;
}

export interface RosterPreviewRow {
  line: number;
  fullName: string;
  email: string;
  agentCode: string;
  role: string;
}

export interface RosterPreview {
  issues: RosterIssue[];
  /** Zero the moment anything is wrong: the commit is all or nothing. */
  willCreate: number;
  rows: RosterPreviewRow[];
}

export interface ImportedPerson {
  fullName: string;
  email: string;
  agentCode: string;
  /**
   * **The only place this exists.** Not stored in plaintext and not recoverable — if it
   * is lost before it reaches the person, they use Forgot your password instead.
   */
  temporaryPassword: string;
}

export const rosterTemplate = () =>
  api<{ header: string; columns: string[] }>('/admin/tenants/roster-template');

export const previewRoster = (kpmId: string, csv: string) =>
  api<RosterPreview>(`/admin/tenants/${kpmId}/roster/preview`, { method: 'POST', body: { csv } });

export const importRoster = (kpmId: string, csv: string) =>
  api<{ created: ImportedPerson[] }>(`/admin/tenants/${kpmId}/roster`, {
    method: 'POST',
    body: { csv },
  });
