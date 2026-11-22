'use client';

import { api } from './api-client';

/**
 * ***Kelola data produk* and *Data produk*** (P19.15-T4; ADR-0260): the Super Admin's grants and *Perubahan oleh
 * pengelola* (`/admin/product-data-grants…`), and the companies the tenant page `/kpm/data-produk` opens
 * (`/product-data/companies`). Every route refuses on its own: what the screens show is never the control.
 */

/** One insurer, by id and name. */
export interface GrantCompany {
  companyId: string;
  name: string;
}

/** One person's *Kelola data produk* (ADR-0260 §4). */
export interface ProductDataGrantRow {
  userId: string;
  fullName: string;
  email: string;
  kpmId: string | null;
  kpmLabel: string | null;
  /** Whether it grants anything today: they are an active KPM Owner or KPM Admin (ADR-0260 §2). */
  holds: boolean;
  /** The insurers ticked, A to Z. */
  companies: GrantCompany[];
  grantedAt: string;
  grantedByName: string | null;
  updatedAt: string;
}

/** One line of *Perubahan oleh pengelola* (ADR-0260 §6): an audit row, named. */
export interface ProductDataChange {
  auditId: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  targetCollection: string;
  targetKind: string;
  targetId: string | null;
  actorUserId: string;
  actorName: string | null;
  /** The scope the row is in, the manager's KPM — what the audit log's *Cakupan* opens on. */
  kpmId: string | null;
  officeLabel: string | null;
  companyId: string | null;
  companyName: string | null;
  productId: string | null;
  productName: string | null;
}

export interface ProductDataChangesPage {
  items: ProductDataChange[];
  page: { cursor: string | null; nextCursor: string | null; limit: number; hasMore: boolean };
}

/** One company *Data produk* opens: in full (`canManage`) or read-only; `own` is the reader's KPM's company. */
export interface ReadableCompany {
  companyId: string;
  name: string;
  canManage: boolean;
  own: boolean;
}

export const readProductDataGrants = () => api<ProductDataGrantRow[]>('/admin/product-data-grants');

/** *Kelola data produk* on, for these insurers: given, or its insurers changed. */
export const setProductDataGrant = (userId: string, companyIds: string[]) =>
  api<ProductDataGrantRow>(`/admin/product-data-grants/${userId}`, { method: 'PUT', body: { companyIds } });

/** *Kelola data produk* off, at once. */
export const revokeProductDataGrant = (userId: string) =>
  api<{ userId: string; revokedAt: string }>(`/admin/product-data-grants/${userId}`, { method: 'DELETE' });

/** *Perubahan oleh pengelola*: a page, newest first; `cursor` the page before's `nextCursor`. */
export const readProductDataChanges = (cursor?: string) =>
  api<ProductDataChangesPage>(
    `/admin/product-data-grants/changes${cursor ? `?${new URLSearchParams({ cursor }).toString()}` : ''}`,
  );

/** The companies *Data produk* opens for the reader, theirs first. */
export const readReadableCompanies = () => api<{ items: ReadableCompany[] }>('/product-data/companies');
