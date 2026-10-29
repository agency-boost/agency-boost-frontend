'use client';

import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, type Language } from '@/i18n/language';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { api } from './api-client';
import { whatsAppNumber } from './leads';

/**
 * **+ Add agent, its invites and its transfers** (P18.96-T3; ADR-0170; `functional/org-hierarchy.md`, *Adding an
 * agent*): the one form a leader adds somebody through — on `/new-hires` and the Unit Dashboard — the invites it makes
 * for somebody not in the app yet, the transfer it asks for when they report to another leader, and the link the
 * invitee opens. The server decides which, by the agent code; this says what it answered.
 */

/** The unit an invite or a transfer names: its leader. */
export interface PersonRef {
  membershipId: string;
  name: string;
}

/** One invite, as *Waiting to join* draws it. Never its link: only the token's hash is kept. */
export interface InviteView {
  inviteId: string;
  fullName: string;
  agentCode: string;
  phone: string;
  /** An office date, `YYYY-MM-DD`. */
  joinDate: string;
  /** *Invited, waiting to join*, or *Invite expired* past its 14 days. */
  status: 'pending' | 'expired';
  expiresAt: string;
  invitedAt: string;
  leader: PersonRef;
  /** An account holds the code: the link opens the signed-in page. */
  existingAccount: boolean;
}

export interface InviteList {
  /** The office's today: the form's default join date, and its latest. */
  today: string;
  invites: InviteView[];
}

/** An invite with its link — only in the answer that made the token: *+ Add agent* and *Resend*. */
export interface SharedInvite {
  invite: InviteView;
  link: string;
}

/**
 * A transfer request as the office's deciders see it (`GET /transfer-requests`): who would move, from whom, to whom,
 * asked by whom — and the name whoever asked typed, to set beside the account's where they differ.
 */
export interface TransferView {
  transferId: string;
  member: PersonRef & { agentCode: string };
  from: PersonRef | null;
  to: PersonRef;
  requestedBy: PersonRef;
  requestedAt: string;
  /** `null` on a request made before it was kept. */
  requestedName: string | null;
}

/**
 * **A transfer request as whoever asked sees it** — *+ Add agent*'s answer and *Transfer requested* on `/new-hires`:
 * the name they typed, the code, the unit they asked for. Never the account's own name nor the leader it reports to,
 * which the server does not send (the P18.96 exit review, M3).
 */
export interface RequestedTransferView {
  transferId: string;
  /** The name they typed; `null` on a request made before it was kept — the row shows the code. */
  requestedName: string | null;
  agentCode: string;
  /** The unit they asked for: its leader. */
  to: PersonRef;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  requestedAt: string;
}

/** Who a request asked for, as the asker named them: the name they typed, or the code on an older request. */
export const askedFor = (transfer: RequestedTransferView) => transfer.requestedName || transfer.agentCode;

/** What *+ Add agent* did. */
export type AddAgentResult =
  | ({ outcome: 'invited' } & SharedInvite)
  | { outcome: 'linked'; member: { membershipId: string; fullName: string } }
  | { outcome: 'transfer_requested'; transfer: RequestedTransferView };

export interface AddAgentInput {
  agentCode: string;
  fullName: string;
  phone: string;
  joinDate: string;
  /** The Owner's or an Admin's choice of unit; a leader's own needs none. */
  leaderMembershipId?: string;
}

/** What an invite link opens before anybody is signed in. */
export interface InviteBanner {
  leaderName: string;
  kpm: { code: string; branchName: string };
  companyId: string;
  companyName: string;
  agentCode: string;
  joinDate: string;
  fullName: string;
  existingAccount: boolean;
  expiresAt: string;
}

export const addAgent = (input: AddAgentInput) =>
  api<AddAgentResult>('/new-hires/agents', { method: 'POST', body: input });

export const readInvites = () => api<InviteList>('/new-hires/invites');

export const resendInvite = (inviteId: string) =>
  api<SharedInvite>(`/new-hires/invites/${encodeURIComponent(inviteId)}/resend`, { method: 'POST' });

export const cancelInvite = (inviteId: string) =>
  api<InviteList>(`/new-hires/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });

/** The transfers the reader asked for that the office has not decided: *Transfer requested*. */
export const readMyTransfers = () => api<RequestedTransferView[]>('/new-hires/transfers');

/** Public: the banner an invite link opens. 404, in plain words, for one that opens nothing. */
export const readInviteBanner = (token: string) =>
  api<InviteBanner>(`/invites/${encodeURIComponent(token)}`);

/** A signed-in account the invite's code belongs to accepts it. */
export const acceptInvite = (token: string) =>
  api<{ kpmId: string; leaderName: string }>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });

/** The office's queue, the Owner's and the Admins' (`member:transfer_approve`). */
export const readTransferQueue = () => api<TransferView[]>('/transfer-requests');

export const approveTransfer = (transferId: string) =>
  api<TransferView[]>(`/transfer-requests/${encodeURIComponent(transferId)}/approve`, { method: 'POST' });

export const declineTransfer = (transferId: string, reason?: string) =>
  api<TransferView[]>(`/transfer-requests/${encodeURIComponent(transferId)}/decline`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });

/**
 * **The language the invite is written to the invitee in** (P18.98-T4): theirs, and they have chosen none — so the
 * language a reader with no choice reads, Bahasa Indonesia (`DEFAULT_LANGUAGE`, ADR-0179 §1), whichever language the
 * leader's own screen is in. As the client wrote the message (P18.96-T3 AC-2).
 */
export const INVITEE_LANGUAGE: Language = DEFAULT_LANGUAGE;

/**
 * **The words sent with the link on WhatsApp** (AC-2): to the invitee, as the office writes to its people — short,
 * their name and the link — in the invitee's language (`INVITEE_LANGUAGE`), the catalogue's (`add-agent.ts`).
 */
export function inviteMessage(fullName: string, link: string, language: Language = INVITEE_LANGUAGE): string {
  return messagesIn(addAgentMessages, language).whatsAppMessage({ name: fullName.trim(), link });
}

/**
 * **Share on WhatsApp**: the chat with the invitee's number, the message filled in — `wa.me/{number}?text=…` — or
 * `null` when the number is not one WhatsApp can open (`whatsAppNumber`, the leads' rule), so no button fails.
 */
export function inviteWhatsAppLink(
  phone: string, fullName: string, link: string, language: Language = INVITEE_LANGUAGE,
): string | null {
  const number = whatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(inviteMessage(fullName, link, language))}` : null;
}

/** The token from an invite link, `?invite=…` — the register page's and the join page's. */
export const inviteTokenOf = (params: URLSearchParams | { get(name: string): string | null }) =>
  params.get('invite')?.trim() || null;

/** The longest *Name* the form takes — `AddAgentDto.fullName`'s `maxLength`, pinned against the API in `contract.spec.ts`. */
export const INVITE_NAME_MAX = 120;

/** *Agent code*: digits only, as on the contract. The length is the server's to say. */
export const AGENT_CODE_DIGITS = /^\d+$/;
