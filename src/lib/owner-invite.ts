import { messagesIn } from '@/i18n/catalogue';
import { ownerInviteMessages } from '@/i18n/messages/owner-invite';
import { api } from './api-client';
import { INVITEE_LANGUAGE } from './invites';
import { whatsAppHref } from './phone-number';

/**
 * **The KPM Owner, invited by WhatsApp** (P19.23-T2 AC-3; ADR-0277; OD-420; the Super Admin spec §5 *"owner invited by
 * WhatsApp"*). AgencyBoost sends nothing by WhatsApp: *Kirim undangan* asks the API for a one-time link and opens the
 * Super Admin's own WhatsApp with the Owner's number and a message carrying it (`wa.me`, OD-359's default).
 *
 * - `claim` — the Owner named with a WhatsApp number and no email: the link (`/owner-invite/<token>`) lets them sign in
 *   or sign up and claim the KPM.
 * - `password` — an Owner whose account never signed in: the link their invitation email carries, to choose a password.
 */

/** `POST /admin/tenants/:id/owner/whatsapp-invitation`'s answer. The link is in it and nowhere else. */
export interface OwnerWhatsAppInvitation {
  kind: 'claim' | 'password';
  link: string;
  ownerName: string;
  ownerPhone: string | null;
  kpmName: string;
  kpmCode: string;
  companyName: string;
  expiresAt: string;
}

/** `GET /owner-invites/:token`: the claim link's banner — which KPM, of which company, for whom. Public. */
export interface OwnerInviteBanner {
  kpmName: string;
  kpmCode: string;
  companyName: string;
  ownerName: string;
  expiresAt: string;
}

/** Public: the banner a claim link opens. `404`, in plain words, for one that opens nothing. */
export const readOwnerInvite = (token: string) =>
  api<OwnerInviteBanner>(`/owner-invites/${encodeURIComponent(token)}`);

/** The signed-in account accepts the claim link and becomes the KPM's Owner. */
export const acceptOwnerInvite = (token: string) =>
  api<{ kpmId: string; kpmName: string }>(`/owner-invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });

/**
 * **The words WhatsApp opens with**, to the Owner: their name, the KPM and its company, and the link — in the
 * invitee's language (`INVITEE_LANGUAGE`), whatever language the Super Admin's screen is in.
 */
export function ownerInviteMessage(invitation: OwnerWhatsAppInvitation): string {
  const say = messagesIn(ownerInviteMessages, INVITEE_LANGUAGE).message;
  const words = {
    name: invitation.ownerName, kpm: invitation.kpmName, company: invitation.companyName, link: invitation.link,
  };
  return invitation.kind === 'claim' ? say.claim(words) : say.password(words);
}

/** The browser refused the window the invitation opens in — pop-ups blocked for the app. */
export class OwnerInviteBlocked extends Error {
  constructor() {
    super('The browser blocked the window the WhatsApp invitation opens in.');
    this.name = 'OwnerInviteBlocked';
  }
}

/** The Owner's number on file is not one WhatsApp can open (`whatsAppNumber`), or there is none. */
export class OwnerInviteNoNumber extends Error {
  constructor(readonly ownerName: string) {
    super('The Owner\'s WhatsApp number cannot be opened.');
    this.name = 'OwnerInviteNoNumber';
  }
}

/**
 * ***Kirim undangan***: opens a window **inside the click** — a browser only lets a page open one while the press is
 * being handled, and the link is not known yet — then asks for the link and points the window at WhatsApp with the
 * message. On any failure the window is closed again and the error rethrown: `OwnerInviteBlocked` when the browser
 * refused the window, `OwnerInviteNoNumber` when the number cannot be opened, the API's refusal otherwise. Answers the
 * invitation, so the caller can name the Owner.
 */
export const openOwnerWhatsAppInvite = async (kpmId: string, userId?: string): Promise<OwnerWhatsAppInvitation> => {
  const opened = window.open('about:blank', '_blank');
  if (!opened) throw new OwnerInviteBlocked();
  // The new window never reaches back into this one.
  opened.opener = null;
  try {
    // A fresh link for the KPM's Owner (the Super Admin's, `kpm:assign_owner`); a new one replaces the last. Called here,
    // inside the exported wrapper the button uses (an `export const`, which `check-api-consumers` reads as the caller).
    // ADR-0285: `userId` names which of the KPM's owners (*Kirim ulang undangan* on their ⋯); absent, the first.
    const invitation = await api<OwnerWhatsAppInvitation>(
      `/admin/tenants/${encodeURIComponent(kpmId)}/owner/whatsapp-invitation`,
      { method: 'POST', ...(userId ? { body: { userId } } : {}) },
    );
    const href = whatsAppHref(invitation.ownerPhone, ownerInviteMessage(invitation));
    if (!href) throw new OwnerInviteNoNumber(invitation.ownerName);
    opened.location.href = href;
    return invitation;
  } catch (err) {
    opened.close();
    throw err;
  }
};
