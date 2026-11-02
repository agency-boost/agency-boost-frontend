import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { leadsMessages } from '@/i18n/messages/leads';
import { api } from '@/lib/api-client';
import { whatsAppNumber } from '@/lib/phone-number';

export type LeadType = 'sales' | 'recruitment';
export type LeadOutcome = 'won' | 'lost';

/** Derived on read, never stored — a stored flag is one that is wrong at midnight. */
export type LeadFlag = 'overdue' | 'no-next-action' | 'no-remarks';

/** Whatever contact detail the agent has. Both optional, both clearable, sent as a pair. */
export interface LeadContact {
  phone: string | null;
  email: string | null;
}

/** Who last changed a lead, when it was not its owner (ADR-0044). */
export interface LeadEditor {
  membershipId: string;
  name: string | null;
}

/**
 * One lead, as `GET /leads` answers it.
 *
 * **No inline object types**, so `contract.spec.ts` reads every field of it against the API document:
 * its reader stops at the first closing brace, and an inline `contact: { … }` hid every field after
 * it from the check.
 */
export interface Lead {
  id: string;
  ownerMembershipId: string;
  type: LeadType | null;
  name: string;
  /** No lawful basis beside it since 2026-10-07: the field and its server rule went (ADR-0108 §1). */
  contact: LeadContact;
  /** The code, never the label: renaming a stage must not orphan the leads sitting on it. */
  statusCode: string | null;
  /** Derived from `committedMonths`, never stored — so nothing has to clear it (P7-T5). */
  thisMonth: boolean;
  /** Every month this lead was promised for, oldest first, as `YYYY-MM` in the office's zone. */
  committedMonths: string[];
  /**
   * Who last changed it, when that was not the agent whose lead it is (ADR-0044) — `null`
   * otherwise. A leader's edit carries their name; the agent's own does not need one.
   */
  lastEditedBy: LeadEditor | null;
  remarks: string | null;
  nextActionDate: string | null;
  nextActionNote: string | null;
  outcome: LeadOutcome | null;
  source: string | null;
  dateRegistered: string | null;
  version: number;
  flags: LeadFlag[];
  /** How late, in the office's own days. `null` unless `flags` carries `overdue`. */
  overdueDays: number | null;
}

/**
 * **One move along a lead's ladder** (UI V1, UI-105): the lead sheet's *Riwayat*. When, and from which stage to which,
 * by code — the office names the stage. Only `GET /leads/:id` carries them (`LeadDetail`); the list never does.
 */
export interface LeadMove {
  at: string;
  fromStatusCode: string | null;
  toStatusCode: string;
}

/** One lead read by its id: the list's shape, and its moves, oldest first (UI-105). */
export interface LeadDetail extends Lead {
  history: LeadMove[];
}

export interface LeadPage {
  rows: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadQuery {
  search?: string;
  type?: LeadType | 'unassigned';
  statusCode?: string;
  outcome?: LeadOutcome | 'open';
  attention?: LeadFlag;
  /**
   * One key, sorted on the server over the whole filtered set before it is paged (P10.1-T4 AC-3).
   *
   * `type` orders blank, Sales, Recruitment; `status` orders by the stage's rank in **its own**
   * ladder, blank first, ties broken by type and then registration — so a sales rank 2 and a
   * recruitment rank 2 sit together by a stated rule rather than by accident. `nextActionDate`
   * stays for the coaching card; `/leads` no longer offers it.
   *
   * **None is the owner's own order** (P18.8-T7, ADR-0161 §1): where `reorderLeads` put each lead, a new
   * one on top. `dir` means nothing without a key.
   */
  sort?: 'dateRegistered' | 'name' | 'nextActionDate' | 'type' | 'status';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  /**
   * Whose leads: a coachee's, on the coaching session's *Leads* card (P11-T4 AC-3, ADR-0076). Absent,
   * the list is the reader's scope as `/leads` reads it. The server answers 404 outside the reader's
   * reach and audits the read.
   */
  owner?: string;
}

/** The flags' words in English, the catalogue's source (`messages/leads.ts`). */
const EN = leadsMessages.en;

/**
 * What each attention flag is called on screen, **in English**: one place, so two screens cannot disagree. A screen
 * reads it in the reader's language through `flagLabel(flag, overdueDays, language)` (P18.98-T4).
 */
export const FLAG_LABEL: Record<LeadFlag, string> = {
  overdue: EN.flags.overdue,
  'no-next-action': EN.flags.noNextAction,
  'no-remarks': EN.flags.noRemarks,
};

/**
 * What a flag reads as on a row — *Overdue 14 days* rather than *Overdue*, as the prototype has
 * it (`leads-management.md` §4).
 *
 * **The count comes from the server, not from the browser's clock.** `overdueDays` is whole
 * calendar days in the **office's** timezone; a screen subtracting two dates itself would be
 * wrong for anybody whose device is in another zone, which is the defect the whole day-boundary
 * rule exists to stop (invariant §9).
 *
 * In the reader's words' `language` (P18.98-T4), English when none is passed: *Terlambat 14 hari*.
 */
export const flagLabel = (flag: LeadFlag, overdueDays: number | null, language: Language = SOURCE_LANGUAGE): string => {
  const t = messagesIn(leadsMessages, language).flags;
  if (flag === 'overdue') return overdueDays === null ? t.overdue : t.overdueDays({ days: overdueDays });
  return flag === 'no-next-action' ? t.noNextAction : t.noRemarks;
};

/**
 * How many open leads the table draws before *Show more* (P13.1-T4 AC-8, ADR-0108 §7).
 *
 * **The client's number, 2026-10-07**: *150 leads → 30, then the other 120.* A display rule and
 * nothing else: every lead still loads (`listEveryLead`), so the count in the toolbar is the whole
 * list, and *Show more* draws the rest at once rather than paging through them.
 */
export const LEAD_ROWS_FIRST_SHOWN = 30;

/**
 * **WhatsApp's and the dialler's reading of a number** — `WHATSAPP_DIGITS`, `whatsAppNumber`, `whatsAppLink`, `callLink`
 * (P13.1-T4 AC-2, P18.95-T4 AC-3) — live in `lib/phone-number.ts` with the rest of the phone's rules, so a screen that
 * draws a WhatsApp button for a member loads no lead (P18.99-T16, the bundle). Re-exported here for the leads' screens.
 */
export { callLink, WHATSAPP_DIGITS, whatsAppLink, whatsAppNumber } from './phone-number';

/**
 * Why the 📞 and WhatsApp are held on a lead, in the reader's words — and where to put it right, which on a
 * phone is the ⋮'s *Lead details*. (P18.95-T4 AC-3.) In English, the catalogue's source (`messages/leads.ts`).
 */
export const PHONE_HELD = EN.phoneHeld;

/**
 * Why a lead's phone can be neither called nor opened in WhatsApp, or `null` when it can (P18.95-T4 AC-3).
 *
 * **One reason for both actions**, because one rule (`whatsAppNumber`) decides both: nothing saved, or
 * something saved that is not 10 to 15 digits once read — `123`, a name typed in the wrong box. In the reader's
 * words' `language` (P18.98-T4), English when none is passed.
 */
export function phoneHeld(phone: string | null | undefined, language: Language = SOURCE_LANGUAGE): string | null {
  if (whatsAppNumber(phone)) return null;
  const t = messagesIn(leadsMessages, language).phoneHeld;
  return (phone ?? '').trim() === '' ? t.missing : t.unusable;
}

/**
 * `?a=b`, or nothing — and appended with `+`, never interpolated.
 *
 * The API-consumer gate reads path **literals** out of each call, and an interpolation at the
 * end of one reads as part of the path: `` `/leads${qs(q)}` `` normalises to `/leads{}`, which
 * is a route the server does not serve. Concatenation leaves `/leads` whole.
 */
const qs = (query: LeadQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const listLeads = (query: LeadQuery = {}) => api<LeadPage>('/leads' + qs(query));

/**
 * The most rows `GET /leads` answers in one page — the service's own cap, the page-size clamp in
 * `LeadService.list`.
 *
 * **Asked for, not assumed.** A larger request is clamped to this on the server, so the number
 * here only decides how many requests an agent's whole list costs; the loop below ends on what the
 * server says it holds, never on this.
 */
export const LEAD_PAGE_CAP = 200;

/**
 * The shortest name the server keeps (`LEAD_BOUNDS.name.min` in the backend's `lead-input.ts`).
 *
 * The inline row reads it to decide **when to post**. A shorter name is never sent, so the server
 * never gets to refuse it — the row says so itself, beneath the name, in the same refusal row a
 * server answer would use, and takes it away once the name is long enough.
 */
export const LEAD_NAME_MIN = 2;

/**
 * Every row one query holds, page after page, handed over as each page lands (P10.1-T4 AC-4).
 *
 * **One request after another, never side by side.** The prototype lists every lead and has no
 * pager (ADR-0063 §3); the server caps a page at 200. So the list asks for page 1, reads the
 * server's `total` off it, and keeps asking until it holds that many — three requests for 450
 * leads, and a screen that shows the first 200 while the rest arrive.
 *
 * **`isCurrent` is the stale-sort guard.** A header sort starts again from page 1, and a page of
 * the previous order still in flight must not be appended to the new one: it would put rows sorted
 * one way under a heading that says another. The caller hands in a check against its own
 * generation; once it turns false nothing more is delivered and nothing more is asked.
 *
 * **What it holds is counted by lead, not by row.** Two leads that tie on the sort key can come
 * back in either order from one request to the next, so a lead can arrive on two pages. Counted
 * twice, it would read as the last lead and end the loop one page early; the caller drops the
 * repeat either way.
 *
 * It stops on a short page, so a lead deleted elsewhere between two pages cannot keep it asking for
 * rows that are no longer there — and on a page that brings nothing new, so a server repeating
 * itself cannot keep it asking forever.
 */
export async function listEveryLead(
  query: LeadQuery,
  onPage: (rows: Lead[], total: number, first: boolean) => void,
  isCurrent: () => boolean,
): Promise<void> {
  const held = new Set<string>();
  for (let page = 1; ; page += 1) {
    const result = await listLeads({ ...query, page, pageSize: LEAD_PAGE_CAP });
    if (!isCurrent()) return;
    onPage(result.rows, result.total, page === 1);
    const before = held.size;
    for (const row of result.rows) held.add(row.id);
    const added = held.size - before;
    if (held.size >= result.total || result.rows.length < result.pageSize || added === 0) return;
  }
}

/** One lead, **with its moves** (`LeadDetail`, UI-105) — a `Lead` to every caller that reads no further. */
export const readLead = (id: string) => api<LeadDetail>(`/leads/${id}`);

/**
 * A new lead. Without `owner` it is the reader's own (`/leads`). **With one it is the coachee's**
 * (ADR-0076): `POST /leads?owner=`, the *+ Add lead* of a coaching session, owned by the coachee,
 * attributed to the leader, and refused with 404 outside the leader's reach.
 */
export const createLead = (body: Partial<Lead> & { name: string }, owner?: string) =>
  api<Lead>('/leads' + (owner ? `?owner=${encodeURIComponent(owner)}` : ''), { method: 'POST', body });

/**
 * One field at a time, so a refusal names the field that caused it — and the `version` it was
 * read at, so a write the record has moved past is refused rather than applied.
 *
 * Two people in one 1-on-1 on two devices is the realistic case: the leader opens the lead, the
 * agent edits a remark, and last-write-wins would silently discard what they typed in front of
 * them.
 */
export const updateLead = (id: string, body: Record<string, unknown>, version?: number) =>
  api<Lead>(`/leads/${id}`, { method: 'PATCH', body: { ...body, version } });

/** Moving. Any active stage of the lead's own ladder, at any time (ADR-0045). */
export const setLeadStatus = (id: string, statusCode: string, version?: number) =>
  api<Lead>(`/leads/${id}/status`, { method: 'PATCH', body: { statusCode, version } });

/** Closing, or reopening. Its own act, and its own permission. */
export const setLeadOutcome = (id: string, outcome: LeadOutcome | null, version?: number) =>
  api<Lead>(`/leads/${id}/outcome`, { method: 'PATCH', body: { outcome, version } });

export const deleteLead = (id: string) =>
  api<{ id: string; deletedAt: string }>(`/leads/${id}`, { method: 'DELETE' });

/**
 * **The reader's open leads, every one, in the order they dragged them into** (P18.8-T7, ADR-0161 §1) —
 * top first. `GET /leads` without a sort then answers in it.
 *
 * The whole list, never *move this one*: the server refuses a list that leaves one of the reader's open
 * leads out, names a lead twice, or names one that is not theirs and open, with `400 VALIDATION_FAILED`
 * and nothing written. A leader sends their own leads only, though their list shows their agents' too.
 */
export const reorderLeads = (ids: readonly string[]) =>
  api<{ ids: string[] }>('/leads/order', { method: 'PATCH', body: { ids } });

/*
 * ── `/leads` below 1024px: the compact list (UI V1, UI-105; D-10, D-18, D-19) ─────────────────────────────────────
 */

/** Which leads the type chips hold: every open lead, or one ladder's. */
export type LeadTypeChip = 'all' | LeadType;

/** How many open leads each chip holds: *Semua 67 · Sales 58 · Recruit 9*. A lead with no type yet is in *Semua* alone. */
export function countByType(leads: readonly Lead[]): Record<LeadTypeChip, number> {
  const counts: Record<LeadTypeChip, number> = { all: leads.length, sales: 0, recruitment: 0 };
  for (const lead of leads) if (lead.type) counts[lead.type] += 1;
  return counts;
}

/**
 * **The pipeline strip's counts** (D-18): how many of one ladder's open leads sit on each of its stages, in the ladder's
 * order — from the leads the screen holds, every one of them (`listEveryLead`), so the strip is the system's count and
 * not a page's. A lead on a stage the office has since retired is counted under no cell, as it is on no stage the strip
 * can name; it is still in the list.
 */
export function countByStage(
  leads: readonly Lead[], type: LeadType, ladder: readonly { code: string }[],
): Map<string, number> {
  const counts = new Map(ladder.map((stage) => [stage.code, 0]));
  for (const lead of leads) {
    if (lead.type !== type || !lead.statusCode || !counts.has(lead.statusCode)) continue;
    counts.set(lead.statusCode, (counts.get(lead.statusCode) ?? 0) + 1);
  }
  return counts;
}

/**
 * **Where a lead's next action stands** (UI-105; UI-062's *Isi tindakan*): `overdue` when the server says so (`flags`,
 * in the office's days), `today` on the office's today, `missing` with no date, else `upcoming`. `today` is the office's
 * day (`dayInZone(OFFICE_TIME_ZONE)`), the caller's to hand in — for a word on screen, never a computation over data.
 */
export type NextActionState = 'overdue' | 'today' | 'missing' | 'upcoming';

export function nextActionState(lead: Pick<Lead, 'flags' | 'nextActionDate'>, today: string): NextActionState {
  if (!lead.nextActionDate) return 'missing';
  if (lead.flags.includes('overdue')) return 'overdue';
  return lead.nextActionDate === today ? 'today' : 'upcoming';
}

/** A name matches a search when it holds every word typed, in any order and any case: *rosa dam* finds *Ibu Rosa Damayanti*. */
export function nameMatches(name: string, typed: string): boolean {
  const words = typed.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const held = name.toLocaleLowerCase('id');
  return words.every((word) => held.includes(word));
}
