'use client';

import { api } from './api-client';
import { membersQuery, type CompanyRef, type MemberInvitation, type MemberStatus } from './platform-reads';

/**
 * ***Anggota* — every member of every KPM** (P19.23-T3 AC-1; the Super Admin spec of 20 November 2026, §6; ADR-0277;
 * OD-421): the list (`GET /admin/members`), one member's detail with their WhatsApp number and email (`GET
 * /admin/members/:membershipId`) and the *Akun tes* switch (`PATCH /admin/users/:userId/test-account`). Every read is the
 * Super Admin's alone and audited by the server; the switch is the one write. The list's rows never carry a phone or an
 * email — the detail does.
 */

/** A rung's class (ADR-0156): `ab` and `aab` draw the orange label before the name, `agent` none. */
export type MemberClass = 'ab' | 'aab' | 'agent';

/** *Terakhir pakai*'s bucket, the server's (ADR-0267 §4): green while `recent`, red otherwise. */
export type LastActiveStatus = 'recent' | 'lapsed' | 'never';

/** One row of *Anggota*. */
export interface AnggotaRow {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  agentCode: string;
  company: CompanyRef;
  /** `branch` is the KPM's name; the code is never shown alone. */
  kpm: { id: string; code: string; branch: string };
  role: { code: string; label: string; class: MemberClass; isOwner: boolean; isAdmin: boolean };
  leader: { fullName: string } | null;
  status: MemberStatus;
  invitation: MemberInvitation;
  joinedOn: string | null;
  lastActiveOn: string | null;
  lastActive: { days: number | null; status: LastActiveStatus };
  /** Listed only under *Akun tes* (OD-421). */
  testAccount: boolean;
}

export interface AnggotaPage {
  rows: AnggotaRow[];
  page: number;
  pageSize: number;
  total: number;
  /** *"n anggota di m KPM"*. */
  kpmCount: number;
}

export interface AnggotaFilters {
  companyId?: string;
  kpmId?: string;
  /** The tabs *AB · AAB · Agent*: a class. */
  role?: MemberClass;
  status?: MemberStatus;
  /** *Semua status* › *Akun tes*: the test accounts alone. */
  testAccount?: 'only';
  q?: string;
  page?: number;
}

export const readAnggota = (filters: AnggotaFilters = {}) =>
  api<AnggotaPage>(`/admin/members?${membersQuery(filters as Parameters<typeof membersQuery>[0])}`);

/** *Anggota*'s detail: the row, and the person's WhatsApp number (`+62…` or `null`) and email. */
export interface MemberDetail extends AnggotaRow {
  phone: string | null;
  email: string;
}

export const readMemberDetail = (membershipId: string) =>
  api<MemberDetail>(`/admin/members/${encodeURIComponent(membershipId)}`);

/** What the *Akun tes* switch answers. */
export interface TestAccountSet {
  userId: string;
  testAccount: boolean;
  memberships: number;
}

/** ***Akun tes*** (ADR-0267 §1): the account and every membership's copy, together, audited. */
export const setTestAccount = (userId: string, testAccount: boolean) =>
  api<TestAccountSet>(`/admin/users/${encodeURIComponent(userId)}/test-account`, {
    method: 'PATCH', body: { testAccount },
  });

/** *Semua status*' choices: the membership's own three, then *Akun tes*. */
export type StatusChoice = MemberStatus | 'test';

/** The status choice as the list's filters write it: *Akun tes* is its own filter, never a status. */
export function statusFilters(choice: StatusChoice | ''): Pick<AnggotaFilters, 'status' | 'testAccount'> {
  if (choice === 'test') return { status: undefined, testAccount: 'only' };
  return { status: choice || undefined, testAccount: undefined };
}

/** The other way: which choice the filters are on. */
export function statusChoiceOf(filters: Pick<AnggotaFilters, 'status' | 'testAccount'>): StatusChoice | '' {
  return filters.testAccount === 'only' ? 'test' : (filters.status ?? '');
}
