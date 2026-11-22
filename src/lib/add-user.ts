'use client';

import { messagesIn } from '@/i18n/catalogue';
import { addUserMessages } from '@/i18n/messages/add-user';
import { api } from './api-client';
import { INVITEE_LANGUAGE } from './invites';
import { whatsAppHref } from './phone-number';

/**
 * ***Tambah user* and *Masukkan*** (P19.28-T1, T2; ADR-0286; the 21 November brief, F-1): the shared sheet's calls.
 *
 * - `GET /user-invitations/options` — the chosen KPM's ladder (*Peran*), its ABs and AABs (*Leader*), and what the reader
 *   may switch; with `companyId` alone, a new KPM's company ladder.
 * - `POST /user-invitations` — *Tambah user*: an invitation and its one-time link, which the reader's own WhatsApp sends
 *   (`wa.me`, OD-359). `POST /user-invitations/:id/resend` and `DELETE /user-invitations/:id`: *Kirim ulang*, *Batalkan*.
 * - `POST /admin/accounts/:userId/placement` — *Masukkan*: an account with no KPM placed now; the person is told in the
 *   app, and the screen opens WhatsApp with the notice (OD-442).
 * - `GET /user-invites/:token` and `POST /user-invites/:token/accept` — the link the person opens.
 *
 * Nothing is sent by the app on WhatsApp: the window is opened **inside the click** (a browser opens one only while a
 * press is handled, and the link is not known yet), then pointed at WhatsApp once the answer is in.
 */

export type RoleClass = 'ab' | 'aab' | 'agent';

/** A rung of the KPM's company ladder: *Peran*'s chip. */
export interface RungChoice {
  code: string;
  label: string;
  class: RoleClass;
}

/** An active AB or AAB of the KPM, for *Leader*. */
export interface LeaderChoice {
  membershipId: string;
  fullName: string;
  role: RungChoice;
  isOwner: boolean;
  photoUrl: string | null;
}

export interface AddUserOptions {
  kpm: { id: string; code: string; branch: string; company: { id: string; name: string } } | null;
  company: { id: string; name: string } | null;
  /** Junior rung first: *Agent · AAB · AB*. */
  roles: RungChoice[];
  /** The senior rung: no leader, and a new KPM's first owner's. */
  seniorCode: string | null;
  leaders: LeaderChoice[];
  mayMakeOwner: boolean;
  mayMakeKpm: boolean;
}

export const readAddUserOptions = (where: { kpmId?: string; companyId?: string }) => {
  const query = new URLSearchParams();
  if (where.kpmId) query.set('kpmId', where.kpmId);
  if (where.companyId) query.set('companyId', where.companyId);
  const qs = query.toString();
  return api<AddUserOptions>(`/user-invitations/options${qs ? `?${qs}` : ''}`);
};

/** Where the person goes: a KPM, or one made now (*＋ KPM baru*). */
export interface Placement {
  kpmId?: string;
  newKpm?: { branchName: string; companyId: string };
  role?: string;
  leaderMembershipId?: string;
  makeOwner?: boolean;
}

export interface UserInvitationView {
  id: string;
  kpmId: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: { code: string; class: RoleClass };
  leaderMembershipId: string | null;
  makeOwner: boolean;
  state: 'pending' | 'expired' | 'accepted' | 'cancelled';
  invitedAt: string;
  expiresAt: string;
}

export interface PlacedKpm {
  id: string;
  code: string;
  branch: string;
  created: boolean;
}

export interface UserInvited {
  outcome: 'invited';
  invitation: UserInvitationView;
  link: string;
  kpm: PlacedKpm;
}

export interface UserPlaced {
  outcome: 'placed';
  membershipId: string;
  kpm: PlacedKpm;
  person: { userId: string; fullName: string; phone: string | null; email: string };
  appLink: string;
}

/** The browser refused the window WhatsApp opens in — pop-ups blocked for the app. The save stands. */
export class WhatsAppBlocked extends Error {
  constructor() {
    super('The browser blocked the window WhatsApp opens in.');
    this.name = 'WhatsAppBlocked';
  }
}

/** **The invitation's words**, to the person: their name, the KPM and the link — in the invitee's language. */
export function invitationMessage(fullName: string, kpm: string, link: string): string {
  return messagesIn(addUserMessages, INVITEE_LANGUAGE).whatsApp.invitation({ name: fullName.trim(), kpm, link });
}

/** **The notice's words** (OD-442), to somebody placed: their name, the KPM, and where to open the app. */
export function placedMessage(fullName: string, kpm: string, link: string): string {
  return messagesIn(addUserMessages, INVITEE_LANGUAGE).whatsApp.placed({ name: fullName.trim(), kpm, link });
}

/** A window opened inside the click, or `null` when the browser refused one — the save goes ahead either way. */
function openWindow(): Window | null {
  const opened = typeof window.open === 'function' ? window.open('about:blank', '_blank') : null;
  if (opened) opened.opener = null;
  return opened;
}

/** Point the window opened in the click at WhatsApp, or close it when there is nothing WhatsApp can open. */
function send(opened: Window | null, phone: string | null, text: string): boolean {
  const href = whatsAppHref(phone, text);
  if (!opened) return false;
  if (!href) {
    opened.close();
    return false;
  }
  opened.location.href = href;
  return true;
}

/**
 * ***Tambah & kirim undangan WhatsApp*** (P19.28-T2 AC-6): saves, then opens WhatsApp with the person's number and the
 * link. Answers the invitation and whether WhatsApp opened (`false` when the browser blocked the window; the invitation
 * stands, and *Kirim ulang* gives a link again).
 */
export const addUser = async (
  body: Placement & { fullName: string; phone: string; email?: string },
): Promise<UserInvited & { whatsAppOpened: boolean }> => {
  // A window only where WhatsApp will open in it: a number it reads. None, and no blank tab flashes open and shut.
  const opened = whatsAppHref(body.phone) ? openWindow() : null;
  try {
    const answer = await api<UserInvited>('/user-invitations', { method: 'POST', body });
    const sent = send(opened, answer.invitation.phone, invitationMessage(answer.invitation.fullName, answer.kpm.branch, answer.link));
    return { ...answer, whatsAppOpened: sent };
  } catch (err) {
    opened?.close();
    throw err;
  }
};

/**
 * ***Masukkan ke KPM*** (P19.28-T2 AC-5): places, then opens WhatsApp with the notice where the account has a number.
 *
 * **The window is opened in the press only when the row says there is a number** (`hasPhone` on *Menunggu*'s row), as
 * *Tambah user* does for a number typed: iPhone Safari blocks a window opened once an answer is in, so WhatsApp opens in
 * it afterwards — and it is closed when the save fails or answers no number. Without `hasPhone` no blank tab flashes open
 * and shut (the integration round's walk, 2026-11-22): WhatsApp is tried once the answer is in, which Chrome and Firefox
 * allow, and a browser that refuses it answers `whatsAppOpened: false`. The notice in the app reaches the person either
 * way (OD-442).
 */
export const placeUser = async (
  userId: string, body: Placement, options: { hasPhone?: boolean } = {},
): Promise<UserPlaced & { whatsAppOpened: boolean }> => {
  const early = options.hasPhone ? openWindow() : null;
  let answer: UserPlaced;
  try {
    answer = await api<UserPlaced>(`/admin/accounts/${encodeURIComponent(userId)}/placement`, { method: 'POST', body });
  } catch (err) {
    early?.close();
    throw err;
  }
  const text = placedMessage(answer.person.fullName, answer.kpm.branch, answer.appLink);
  if (options.hasPhone) return { ...answer, whatsAppOpened: send(early, answer.person.phone, text) };
  const href = whatsAppHref(answer.person.phone, text);
  const opened = href && typeof window.open === 'function' ? window.open(href, '_blank') : null;
  if (opened) opened.opener = null;
  return { ...answer, whatsAppOpened: opened !== null };
};

/** ***Kirim ulang***: a new link, WhatsApp opened with it (the window opened in the click). */
export const resendInvitation = async (
  invitationId: string, kpmName: string,
): Promise<{ invitation: UserInvitationView; link: string; whatsAppOpened: boolean }> => {
  const opened = openWindow();
  try {
    const answer = await api<{ invitation: UserInvitationView; link: string }>(
      `/user-invitations/${encodeURIComponent(invitationId)}/resend`, { method: 'POST' },
    );
    const sent = send(opened, answer.invitation.phone, invitationMessage(answer.invitation.fullName, kpmName, answer.link));
    return { ...answer, whatsAppOpened: sent };
  } catch (err) {
    opened?.close();
    throw err;
  }
};

/** ***Batalkan***: its link opens nothing from now on; the row stays, cancelled. */
export const cancelInvitation = (invitationId: string) =>
  api<{ invitation: UserInvitationView }>(`/user-invitations/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });

/** `GET /user-invites/:token`: the link's banner. Public; `404` in plain words for a link that opens nothing. */
export interface UserInviteBanner {
  kpmName: string;
  kpmCode: string;
  companyName: string;
  fullName: string;
  roleLabel: string;
  makeOwner: boolean;
  expiresAt: string;
}

export const readUserInvite = (token: string) => api<UserInviteBanner>(`/user-invites/${encodeURIComponent(token)}`);

/** The signed-in account accepts: an *Aktif* member of the KPM from now on. */
export const acceptUserInvite = (token: string) =>
  api<{ kpmId: string; kpmName: string; membershipId: string }>(
    `/user-invites/${encodeURIComponent(token)}/accept`, { method: 'POST' },
  );

/**
 * ***Isi nomor WhatsApp*** from Anggota's detail (P19.28-T4 AC-2; UI-210 (21 Nov)): the member's KPM's own route
 * (`PUT /members/:membershipId/phone`), the Super Admin answered as its Owner (ADR-0268 §3) for this call alone — the
 * console does not enter the KPM. Only a missing number is filled (`409 MEMBER_PHONE_ON_FILE` otherwise).
 */
export const saveMemberPhoneInKpm = (kpmId: string, membershipId: string, phone: string) =>
  api<{ membershipId: string; phone: string }>(`/members/${encodeURIComponent(membershipId)}/phone`, {
    method: 'PUT', body: { phone }, inKpm: kpmId,
  });
