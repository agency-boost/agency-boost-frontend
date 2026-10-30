import { api } from '@/lib/api-client';
import type { Lead } from '@/lib/leads';
import type { Me } from '@/lib/session';

/**
 * **A WhatsApp number as *Isi nomor WhatsApp* takes it** (UI V1, UI-081, UI-101; D-22): the digits after a fixed
 * `+62`. Leading `+62`, `0062`, `62` or `0`, spaces, dashes, dots and brackets go; 9 to 13 digits stay; anything else
 * is the inline error under the field, and nothing is sent.
 *
 * **The server's rule, mirrored** — `PHONE_NATIONAL_DIGITS` and `normalisePhone` in the backend's
 * `domain/constants/phone.ts` (`metrics-and-definitions.md` §B.28), which refuses anything this lets past. Mirrored so
 * the sheet can say *Isi 9 sampai 13 digit* before a round trip, as `LEAD_NAME_MIN` mirrors its server's bound.
 */
export const PHONE_NATIONAL_DIGITS = { min: 9, max: 13 } as const;

/** The fixed prefix the field shows before what is typed. */
export const PHONE_COUNTRY_PREFIX = '+62';

/** The national digits of what was typed — `81211002200` for `0812-1100-2200` — or `null` when it is not a number. */
export function nationalDigits(typed: string | null | undefined): string | null {
  if (typeof typed !== 'string') return null;
  const national = typed
    .replace(/[\s\-.()]/g, '')
    .replace(/^\+62/, '')
    .replace(/^0062/, '')
    .replace(/^62/, '')
    .replace(/^0/, '');
  if (!/^\d+$/.test(national)) return null;
  return national.length >= PHONE_NATIONAL_DIGITS.min && national.length <= PHONE_NATIONAL_DIGITS.max ? national : null;
}

/** What is saved: `+6281211002200`, or `null` when what was typed is not a number. */
export function normalisedPhone(typed: string | null | undefined): string | null {
  const national = nationalDigits(typed);
  return national === null ? null : `${PHONE_COUNTRY_PREFIX}${national}`;
}

/** The national digits of a saved number, for the field after `+62` — `81211002200` for `+6281211002200`. */
export function phoneFieldValue(saved: string | null | undefined): string {
  return nationalDigits(saved) ?? '';
}

/** The digits a WhatsApp number may have, country code included: E.164's ceiling, and Indonesia's floor. */
export const WHATSAPP_DIGITS = { min: 10, max: 15 } as const;

/**
 * A phone number as `wa.me` takes it — digits only, Indonesia's `62` in front — or `null` when it does
 * not read as one (P13.1-T4 AC-2, ADR-0108 §2).
 *
 * The client's rule: no `+`, and a leading `0` becomes `62` (`0812…` → `62812…`). **Every other
 * character goes**, so the dashes and spaces the seed and the agents type (`0812-1100-2200`,
 * `+62 812 1100 2200`, `+62 0812…`, `0062 812…`) all read alike. A number typed without its trunk zero (`812…`) is an Indonesian
 * mobile too, and gets the same `62`. `62` is kept as it is. Anything that is then not 10 to 15 digits
 * is not a number WhatsApp can open, and the dialog offers no button rather than a link that fails.
 */
export function whatsAppNumber(phone: string | null | undefined): string | null {
  /*
   * Two ways of writing the country code are read first (the exit review's finding 4): the international
   * prefix `00` (`0062 812…`) is a `+`, and a trunk zero kept after the country code (`+62 0812…`, which
   * people often type) is dropped — either would otherwise pass the length check as a number nobody has.
   */
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '').replace(/^620/, '62');
  if (!digits) return null;
  const national = digits.startsWith('62')
    ? digits
    : digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : digits.startsWith('8') ? `62${digits}` : digits;
  return national.length >= WHATSAPP_DIGITS.min && national.length <= WHATSAPP_DIGITS.max ? national : null;
}

/** The chat link for a phone number, or `null` when there is no number WhatsApp could open. */
export function whatsAppLink(phone: string | null | undefined): string | null {
  const number = whatsAppNumber(phone);
  return number ? `https://wa.me/${number}` : null;
}

/**
 * **A call, `tel:`, to the number WhatsApp is given** (P18.95-T4 AC-3, ADR-0167 §4; UI-016): the same digits,
 * read by the same rule, with the `+` a dialler needs for a country code — `0812-1100-2200` is
 * `tel:+6281211002200`. One rule for both, so a lead the 📞 can ring is a lead WhatsApp can open, and the
 * other way round. `null` where it cannot.
 */
export function callLink(phone: string | null | undefined): string | null {
  const number = whatsAppNumber(phone);
  return number ? `tel:+${number}` : null;
}

/** WhatsApp's chat link, with a message typed in where there is one (UI-101's reminder; here since P18.99-T16). */
export function whatsAppHref(phone: string | null | undefined, text?: string): string | null {
  const link = whatsAppLink(phone);
  if (!link) return null;
  return text ? `${link}?text=${encodeURIComponent(text)}` : link;
}

/**
 * **Your own number** — `PATCH /auth/me` with `phone`; `null` clears it (*Profil saya*, UI-111). Answers the account as
 * `GET /auth/me` does.
 */
export const saveMyPhone = (phone: string | null) =>
  api<Me>('/auth/me', { method: 'PATCH', body: { phone } });

/** What `PUT /members/:membershipId/phone` answers: the number as stored, `+62…`. */
export interface MemberPhone {
  membershipId: string;
  phone: string;
}

/**
 * **A leader saves the number of somebody they coach** (D-22: *a leader may set it for their agents*; UI-101's
 * WhatsApp reminder) — `PUT /members/:membershipId/phone`, `member:update_phone` (AB and AAB, their downline). Another
 * office's member, or one outside the leader's reach, is a 404.
 */
export const saveMemberPhone = (membershipId: string, phone: string) =>
  api<MemberPhone>(`/members/${encodeURIComponent(membershipId)}/phone`, { method: 'PUT', body: { phone } });

/**
 * **A lead's number** (UI-081) — `PATCH /leads/:id`, the lead's own update: `contact` travels as a pair, so the email
 * goes with it unchanged, and `version` pins the write (a leader's write needs it, ADR-0044).
 *
 * `updateLead` is fetched as the number is saved, not imported: this module is a member's WhatsApp button's too, and a
 * static import would load the leads' module and their catalogue onto every screen that draws one (P18.99-T16).
 */
export const saveLeadPhone = async (lead: Pick<Lead, 'id' | 'contact' | 'version'>, phone: string) => {
  const { updateLead } = await import('@/lib/leads');
  return updateLead(lead.id, { contact: { phone, email: lead.contact?.email ?? null } }, lead.version);
};
