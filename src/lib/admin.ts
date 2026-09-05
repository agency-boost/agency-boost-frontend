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

export interface Kpm {
  _id: string;
  companyId: string;
  code: string;
  branchName: string;
  address: string | null;
  contactPhone: string | null;
  ownerUserId: string | null;
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
  timezone?: string;
}

export const createTenant = (body: CreateKpmInput) =>
  api<Kpm>('/admin/tenants', { method: 'POST', body });

export const assignOwner = (id: string, userId: string) =>
  api<Kpm>(`/admin/tenants/${id}/owner`, { method: 'PATCH', body: { userId } });

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
