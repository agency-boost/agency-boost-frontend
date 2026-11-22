'use client';

import { api } from './api-client';

/**
 * **The Super Admin's reads across KPMs** (ADR-0207; P19.4-T3): *All members*' query and its *Akun terdaftar*
 * (P19.12-T2), and the company's *KPM & data*. Every one is a `GET`, the Super Admin's alone, and audited by the server
 * per read — nothing here writes. *Anggota*'s list and detail are `admin-members.ts`'s (P19.23-T3).
 *
 * *Retired 2026-11-20 (P19.23; ADR-0277):* the KPM comparison (`/admin/analytics/kpms`, replaced by the Dashboard's
 * *Adopsi per KPM*), *Data bulanan* (`/admin/tenants/:id/data`, the Owner's *Data upload* inside the KPM) and *All
 * members*' old rows (`readMembers`, replaced by *Anggota*).
 */

export interface CompanyRef { id: string; name: string }

export type MemberStatus = 'active' | 'pending' | 'removed';
export type MemberInvitation = 'invited' | 'not_invited' | 'signed_in';

export interface MembersFilters {
  companyId?: string;
  kpmId?: string;
  role?: 'ab' | 'aab' | 'agent';
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

/** *Akun terdaftar*'s KPM filter (ADR-0245 §1): *Tanpa KPM* — no active or pending membership — or *Punya KPM*. */
export type AccountKpmFilter = 'none' | 'some';

/**
 * **One row of *Akun terdaftar*** (`GET /admin/users`, P19.12-T2; ADR-0245 §1, §2): a registered account, with or without
 * a KPM. The one platform read that returns an email, the account's own; never a phone, a birth date or a gender.
 */
export interface PlatformAccountRow {
  userId: string;
  fullName: string;
  email: string;
  company: CompanyRef | null;
  /** `YYYY-MM-DD`, in Asia/Jakarta. */
  registeredOn: string;
  emailVerified: boolean;
  /** `null`: *"Belum pernah"*. */
  lastSignInOn: string | null;
  /** Active or pending memberships in any KPM; `0` is *Belum punya KPM*. */
  kpmCount: number;
}

export interface PlatformAccountsPage {
  rows: PlatformAccountRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AccountsFilters {
  q?: string;
  kpm?: AccountKpmFilter;
  page?: number;
}

export const readAccounts = (filters: AccountsFilters = {}) =>
  api<PlatformAccountsPage>(`/admin/users?${membersQuery(filters as MembersFilters)}`);

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
