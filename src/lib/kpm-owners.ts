import { api } from './api-client';
import type { HierarchyRole } from './org';

/**
 * **A KPM's owners** (P19.27; ADR-0285; F-2 of the 21 November brief): one or more people, every one with the same full
 * KPM Owner rights, never none. The KPM page's *KPM Owner · n* reads them with the KPM (`GET /admin/tenants/:id/people`,
 * `owners`), People › *KPM admins* with its tiles (`GET /people/stewards`, `owners`); both add and remove them here.
 */

/** One owner as *KPM Owner · n* lists them: photo, the orange label, the NAME, *Owner sejak*, and *Diundang* while invited. */
export interface KpmOwnerView {
  userId: string;
  /** Their membership in the KPM — what the routes and *Lihat profil* name — or `null` with none. */
  membershipId: string | null;
  fullName: string;
  agentCode: string | null;
  role: HierarchyRole | null;
  photoUrl: string | null;
  /** When they became an owner, ISO: *Owner sejak <Mon YYYY>*. */
  since: string;
  /** `invited` is *Diundang*: invited and never signed in — *Kirim ulang undangan* is offered then. */
  state: 'active' | 'invited' | 'not_invited';
}

/** The owners in order of `since`, and whether the reader may add and remove them (an owner, or the Super Admin). */
export interface KpmOwnerList {
  owners: KpmOwnerView[];
  canManage: boolean;
}

/** *Jadikan owner* — `POST /members/:membershipId/owner`: a member of this KPM made one of its owners. */
export const addOwner = (membershipId: string) =>
  api<KpmOwnerList>(`/members/${encodeURIComponent(membershipId)}/owner`, { method: 'POST' });

/**
 * *Hapus sebagai owner* — `DELETE /members/:membershipId/owner`. The API refuses the last owner (`409 KPM_LAST_OWNER`)
 * and an owner removing themselves (`403 PERM_OWNER_ONLY`); the person stays a member.
 */
export const removeOwner = (membershipId: string) =>
  api<KpmOwnerList>(`/members/${encodeURIComponent(membershipId)}/owner`, { method: 'DELETE' });
