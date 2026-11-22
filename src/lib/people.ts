'use client';

import { api } from './api-client';
import type { RosterPreview, RosterImportResult } from './admin';
import type { HierarchyRole, Member, MemberPage } from './org';
import type { KpmOwnerView } from './kpm-owners';

/*
 * **People** (P19.20; ADR-0273): what All members, the member sheet, KPM admins and Import people read and write beyond
 * `lib/org.ts` — the roster's new columns, *Riwayat*, the three tiles, *Pilih leader*, the sheet's edits and *Riwayat
 * unggah*. Each type mirrors the backend's (`directory.service.ts`, `people.service.ts`, `member-personal.service.ts`).
 */

/** A pill's colour, the server's bucket (ADR-0267 §4, §5): red `never`, yellow `lapsed` (> 14 days), green `recent`. */
export type RecencyStatus = 'never' | 'lapsed' | 'recent';

/** Where a row stands among the informal groups (ADR-0270 §1): only on an active row, for a steward. */
export interface GroupPlace {
  group: { groupId: string; name: string } | null;
  /** The AB whose AB group they are in — themselves for an AB. */
  ab: { membershipId: string; name: string } | null;
  isGroupLeader: boolean;
}

/** A row of All members, or the member the sheet reads. */
export interface RosterMember extends Member {
  photoUrl?: string | null;
  groupPlace?: GroupPlace;
  lastActivityStatus?: RecencyStatus;
  lastCoachedStatus?: RecencyStatus;
  /** This reader may open them (ADR-0268 §1); absent reads as openable. */
  openable?: boolean;
  /** This reader may change their details in the sheet (ADR-0273 §3). */
  canEditDetails?: boolean;
  /** When the membership was made: *daftar 4 hari lalu* on *Sudah daftar, belum masuk unit*. */
  registeredAt?: string | null;
}

export interface RosterPage extends Omit<MemberPage, 'members'> {
  members: RosterMember[];
}

/** *Anggota*'s filter: a role, or *★ Core leader*. */
export type RosterFilter = 'all' | HierarchyRole | 'core';

/** `GET /members`, with *★ Core leader* (`coreLeader=true`). */
export function readRoster(input: { q?: string; filter?: RosterFilter; cursor?: string; limit?: number; status?: 'pending' } = {}) {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set('q', input.q.trim());
  if (input.filter === 'core') params.set('coreLeader', 'true');
  else if (input.filter && input.filter !== 'all') params.set('role', input.filter);
  if (input.status) params.set('status', input.status);
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.limit) params.set('limit', String(input.limit));
  const query = params.toString();
  return api<RosterPage>(`/members${query ? `?${query}` : ''}`);
}

/** One member, as the sheet reads them: their row's fields, and their details to a steward. */
export const readSheetMember = (membershipId: string) =>
  api<RosterMember>(`/members/${encodeURIComponent(membershipId)}`);

/** The fields the sheet changes (ADR-0273 §3): any value, never cleared. */
export type SheetField =
  | 'joinDate' | 'companyJoinMonth' | 'workStatus' | 'agentCode' | 'dateOfBirth' | 'gender' | 'phone' | 'email';

export interface MemberDetailsSaved {
  membershipId: string;
  filled: SheetField[];
  member: RosterMember;
}

/** `PATCH /members/:id/personal` — one field of the sheet, saved with its ✓. */
export const saveMemberDetail = (membershipId: string, body: Partial<Record<SheetField, string>>) =>
  api<MemberDetailsSaved>(`/members/${encodeURIComponent(membershipId)}/personal`, { method: 'PATCH', body });

/** *Riwayat*'s filter, and what one line is. */
export type HistoryFilter = 'all' | 'role' | 'removed' | 'moved';
export type HistoryKind = 'role' | 'removed' | 'moved' | 'rejoined';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  membershipId: string;
  fullName: string;
  agentCode: string;
  role: HierarchyRole;
  photoUrl: string | null;
  fromRole: HierarchyRole | null;
  toRole: HierarchyRole | null;
  fromLeaderName: string | null;
  toLeaderName: string | null;
  reason: string | null;
  actorName: string | null;
  at: string;
  openable: boolean;
}

/** `GET /people/history` — *Riwayat*, newest first. */
export const readPeopleHistory = (kind: HistoryFilter = 'all') =>
  api<HistoryEntry[]>(`/people/history${kind === 'all' ? '' : `?kind=${kind}`}`);

/** *KPM admins*' three tiles. */
export interface KpmStewards {
  /** The first owner (ADR-0285 §3); every owner is in `owners`. */
  owner: { membershipId: string; fullName: string; agentCode: string; role: HierarchyRole; photoUrl: string | null } | null;
  /** ***KPM Owner · n*** (P19.27-T4): every owner in order of `since`. */
  owners: KpmOwnerView[];
  /** The reader may add and remove owners: an owner, or the Super Admin inside the KPM — never an Admin. */
  canManageOwners: boolean;
  admins: number;
  coreLeaders: number;
}

export const readStewards = () => api<KpmStewards>('/people/stewards');

/** *Pilih leader*: somebody who registered, under the leader chosen, now. */
export const placeMember = (membershipId: string, leaderMembershipId: string) =>
  api<RosterMember>(`/people/${encodeURIComponent(membershipId)}/placement`, { method: 'PUT', body: { leaderMembershipId } });

/** One saved file of *Riwayat unggah*. */
export interface RosterImportView {
  importId: string;
  fileName: string | null;
  importedAt: string;
  byName: string | null;
  created: number;
  updated: number;
  invited: number;
  skipped: number;
}

export const readRosterImports = () => api<RosterImportView[]>('/people/imports');

/** A preview row as *Import people* draws it: the file's cells, and the columns left empty for their shape. */
export type PeopleRow = RosterPreview['rows'][number] & { cells: string[]; flagged: string[] };
export type PeoplePreview = Omit<RosterPreview, 'rows'> & { rows: PeopleRow[] };
export type PeopleSaved = Omit<RosterImportResult, 'rows'> & { rows: PeopleRow[] };

/** The corrected rows, checked again (`roster/preview`), as text. */
export const previewPeopleRows = (kpmId: string, rows: string) =>
  api<PeoplePreview>(`/admin/tenants/${encodeURIComponent(kpmId)}/roster/preview`, { method: 'POST', body: { rows } });

/** The corrected rows, saved (`roster`), with the file they came from for *Riwayat unggah*. */
export const savePeopleRows = (kpmId: string, rows: string, fileName: string | null) =>
  api<PeopleSaved>(`/admin/tenants/${encodeURIComponent(kpmId)}/roster`, {
    method: 'POST',
    body: { rows, invite: true, ...(fileName ? { fileName } : {}) },
  });

/** A CSV cell, quoted when it must be: a comma, a quote or a line break inside. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The file's header and its rows, as the text the import reads — what a corrected preview is sent back as. */
export function rowsToCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

/** A person's first name, for *ikut AB Agus*. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** Whole years from a birth date to today (office dates, `YYYY-MM-DD`). */
export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
