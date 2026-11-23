import { api } from './api-client';

/**
 * ***Hapus akun*** (P19.31-T2; ADR-0289): the Super Admin retires an account so its address and agent code can be used
 * again, its history kept. The server decides what ends, what stays and what refuses; the dialog shows it. Platform
 * routes (`/admin/…`), so never sent `X-Kpm-Id`.
 */

export interface RetirementRefusal {
  code: 'ACCOUNT_RETIRE_PLATFORM_TEAM' | 'ACCOUNT_RETIRE_OWNER' | 'ACCOUNT_RETIRE_HAS_REPORTS' | string;
  /** The refusal's sentence in the reader's language: what to do first. */
  message: string;
  details: Record<string, unknown>;
}

/** **`GET /admin/accounts/:userId/retirement`** — what retiring would end and keep, and a refusal if one applies. */
export interface RetirementPreview {
  userId: string;
  fullName: string;
  email: string;
  membership: { membershipId: string; kpmId: string; kpmName: string; kpmCode: string; status: 'active' | 'pending' | string } | null;
  /** In how many KPMs they have been a member: the history that stays. */
  kpmsWithHistory: number;
  refusal: RetirementRefusal | null;
}

export interface RetirementResult {
  userId: string;
  fullName: string;
  retiredAt: string;
  membershipEnded: { membershipId: string; kpmId: string } | null;
  invitationsCancelled: number;
}

export const readRetirement = (userId: string) =>
  api<RetirementPreview>(`/admin/accounts/${encodeURIComponent(userId)}/retirement`);

/** **`POST /admin/accounts/:userId/retirement`** — `{ reason, fullName }`, the name typed in full to confirm. */
export const retireAccount = (userId: string, body: { reason: string; fullName: string }) =>
  api<RetirementResult>(`/admin/accounts/${encodeURIComponent(userId)}/retirement`, { method: 'POST', body });

/** **The name compared as the server compares it**: spaces collapsed, any case. */
export function sameName(typed: string, fullName: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('id-ID');
  return norm(typed) !== '' && norm(typed) === norm(fullName);
}
