import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { leadsMessages } from '@/i18n/messages/leads';
import { api } from '@/lib/api-client';
import { whatsAppNumber } from '@/lib/phone-number';
import type { LeadFlag } from './lead-flags';

export type LeadType = 'sales' | 'recruitment';
export type LeadOutcome = 'won' | 'lost';

/** A lead's attention flags and their words live in `lead-flags.ts`, which Personal Summary reads without this client. */
export { FLAG_LABEL, flagLabel, type LeadFlag } from './lead-flags';

/** Whatever contact detail the agent has. Both optional, both clearable, sent as a pair. */
export interface LeadContact {
  phone: string | null;
  email: string | null;
}

/**
 * **The avatar's badge** (P19.1-T2 AC-8; UI-153 item 5; Q-3): `potensi` — the yellow ✓ — while the lead is switched on
 * this month and open; `won` — the green ✓ — when that switched-on lead was marked *Berhasil* this month; `null` when the
 * switch is off, or the lead closed some other way. It clears on the 1st with the switch, which the server derives.
 */
export function potensiBadgeOf(lead: { thisMonth: boolean; closedThisMonth?: boolean; outcome: LeadOutcome | null }): 'potensi' | 'won' | null {
  if (!lead.thisMonth) return null;
  if (lead.closedThisMonth) return 'won';
  return lead.outcome === null ? 'potensi' : null;
}

/**
 * **The office's final stage of a ladder** — the stage it flagged `isTerminal` (ADR-0043) — or `null` for a ladder with
 * none (P19.1-T2 AC-9; UI-160; ADR-0194). *Tandai berhasil* is enabled there and *Tandai tidak berhasil* refused; its
 * label is the office's own words for the held line, *Aktif setelah status {label}*.
 */
export const finalStageOf = <S extends { isTerminal?: boolean }>(ladder: readonly S[]): S | null =>
  ladder.find((stage) => stage.isTerminal) ?? null;

/** Who last changed a lead, when it was not its owner (ADR-0044). */
export interface LeadEditor {
  membershipId: string;
  name: string | null;
}

/** Whose lead it is, by name (P19.9-T1 AC-4; ADR-0232): `null` for a membership that can no longer be named. */
export interface LeadOwner {
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
   * **Marked *Berhasil* inside the office's current month** (P19.1-T2, UI-153 item 5): derived by the server, never
   * stored. With `thisMonth` it is the avatar's badge (`potensiBadgeOf`). Always sent since P19.1; optional here so a
   * reading of an older answer draws no badge rather than a wrong one.
   */
  closedThisMonth?: boolean;
  /**
   * Who last changed it, when that was not the agent whose lead it is (ADR-0044) — `null`
   * otherwise. A leader's edit carries their name; the agent's own does not need one.
   */
  lastEditedBy: LeadEditor | null;
  /**
   * **Whose lead it is, by name** (P19.9-T1 AC-4; ADR-0232): the card's *Milik Rina Wijaya* on a lead that is not the
   * reader's. Always sent since P19.9; optional here, as `age` is, so an older answer reads as no owner named.
   */
  owner?: LeadOwner;
  remarks: string | null;
  nextActionDate: string | null;
  nextActionNote: string | null;
  outcome: LeadOutcome | null;
  source: string | null;
  dateRegistered: string | null;
  /**
   * **The client's age at the next birthday, today** (P19.7-T1 AC-1; ADR-0224 §2): the server's reading — the age written
   * plus the whole years since `ageRecordedOn` — never computed here. `null` when none was given. Optional, as
   * `closedThisMonth` is, so an older answer reads as no age.
   */
  age?: number | null;
  /** The office's day the age was last written; the server's alone. */
  ageRecordedOn?: string | null;
  /** *Laki-laki* or *Perempuan*, or `null` (ADR-0224 §1). */
  gender?: LeadGender | null;
  /**
   * **The lead's proposals, for its owner only** (P19.7-T2 AC-12; ADR-0221 §6): how many live ones, and the products of
   * the one updated last — the card's *"PRUWell Medical +1"*. `null` on a lead with none **and on every lead the reader
   * does not own**: a leader never learns what was proposed on a downline's lead (decision 4). Optional, as `age` is, so
   * an older answer reads as none.
   */
  proposals?: LeadProposals | null;
  version: number;
  flags: LeadFlag[];
  /** How late, in the office's own days. `null` unless `flags` carries `overdue`. */
  overdueDays: number | null;
}

/** `Lead.proposals`: the lead's live proposals, drafts included, and the latest one's products (ADR-0221 §6). */
export interface LeadProposals {
  count: number;
  latest: LeadLatestProposal;
}

/**
 * The proposal updated last that has a product: its item names as the proposal shows them, in order. Empty when every
 * live proposal of the lead is still an empty draft — the card then draws the document icon alone.
 */
export interface LeadLatestProposal {
  products: string[];
}

/**
 * **One move along a lead's ladder** (UI V1, UI-105): the lead sheet's *Riwayat*. When, and from which stage to which,
 * by code — the office names the stage. Only `GET /leads/:id` carries them (`LeadDetail`); the list never does.
 */
export interface LeadMove {
  /** `stage` since P19.7-T2; absent on an older answer, which carried moves alone. */
  kind?: 'stage';
  at: string;
  fromStatusCode: string | null;
  toStatusCode: string;
}

/**
 * ***"Proposal dibuat · {produk}"*** in the lead's *Riwayat* (P19.7-T2 AC-11; ADR-0221 §6): derived from the reader's
 * own proposals of the lead that were ever finished, never written to the lead. `at` is the first *Simpan PDF*;
 * `proposalId` is `null` once that proposal was deleted — the note stays, its link goes. Only the lead's owner is
 * answered these.
 */
export interface LeadProposalNote {
  kind: 'proposal';
  at: string;
  proposalId: string | null;
  products: string[];
}

/** One line of a lead's *Riwayat*: a move along its ladder, or a proposal made. */
export type LeadHistoryEntry = LeadMove | LeadProposalNote;

/** One lead read by its id: the list's shape, and its *Riwayat*, oldest first (UI-105; P19.7-T2). */
export interface LeadDetail extends Lead {
  history: LeadHistoryEntry[];
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
   * **None is the owner's own order** (P18.5-T7, ADR-0161 §1): where `reorderLeads` put each lead, a new
   * one on top. `dir` means nothing without a key.
   */
  sort?: 'dateRegistered' | 'name' | 'nextActionDate' | 'type' | 'status';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  /**
   * ***Sudah ada proposal* / *Belum ada proposal*** (P19.7-T2 AC-12; ADR-0221 §6): either one narrows the list to the
   * reader's own leads first, then to those with a live proposal or without one. Works with every other filter.
   */
  hasProposal?: boolean;
  /**
   * Whose leads: a coachee's, on the coaching session's *Leads* card (P11-T4 AC-3, ADR-0076). Absent,
   * the list is the reader's scope as `/leads` reads it. The server answers 404 outside the reader's
   * reach and audits the read.
   */
  owner?: string;
  /**
   * ***Leads milik: Saya · Tim*** (P19.9-T1 AC-2, AC-3; ADR-0232, OD-286): `own` the reader's leads alone — what `/leads`
   * opens on — and `team` everybody else their grant reaches. It narrows on the server and never widens. Absent, the
   * server reads `own` too (ADR-0232 §3), except beside `owner`, whose one member's list it leaves as it is.
   */
  scope?: LeadScope;
}

/** Whose leads `/leads` holds (P19.9-T1): the reader's own, or their team's — their downline's, without their own. */
export type LeadScope = 'own' | 'team';

/**
 * **Whether *Leads milik: Tim* is offered** (P19.9-T1 AC-3; ADR-0232): to a reader whose `lead:read` reaches beyond their
 * own — an AB's downline, an AAB's unit, and since P19.9-T6 (ADR-0234) an Agent who leads somebody, whose `own-downline`
 * reaches them. The server decides what `scope=team` holds whoever asks; this only decides whether the choice is drawn,
 * so an Agent who leads nobody is not offered a list that is always empty.
 */
export function readsTeamLeads(membership: { status: string; hierarchyRole: string; directCount?: number } | null | undefined): boolean {
  if (!membership || membership.status !== 'active') return false;
  return membership.hierarchyRole === 'ab' || membership.hierarchyRole === 'aab' || (membership.directCount ?? 0) > 0;
}

/** The flags' words in English, the catalogue's source (`messages/leads.ts`). */
const EN = leadsMessages.en;

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
 * (P13.1-T4 AC-2, P18.7-T4 AC-3) — live in `lib/phone-number.ts` with the rest of the phone's rules, so a screen that
 * draws a WhatsApp button for a member loads no lead (P18.11-T16, the bundle). Re-exported here for the leads' screens.
 */
export { callLink, WHATSAPP_DIGITS, whatsAppLink, whatsAppNumber } from './phone-number';

/**
 * Why the 📞 and WhatsApp are held on a lead, in the reader's words — and where to put it right, which on a
 * phone is the ⋮'s *Lead details*. (P18.7-T4 AC-3.) In English, the catalogue's source (`messages/leads.ts`).
 */
export const PHONE_HELD = EN.phoneHeld;

/**
 * Why a lead's phone can be neither called nor opened in WhatsApp, or `null` when it can (P18.7-T4 AC-3).
 *
 * **One reason for both actions**, because one rule (`whatsAppNumber`) decides both: nothing saved, or
 * something saved that is not 10 to 15 digits once read — `123`, a name typed in the wrong box. In the reader's
 * words' `language` (P18.10-T4), English when none is passed.
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

/** `male` or `female` (ADR-0224 §1; ADR-0158's values): *Laki-laki* and *Perempuan* on screen. */
export type LeadGender = 'male' | 'female';

/**
 * **The bounds of a lead's age at the next birthday** (`LEAD_AGE`, §B.34; ADR-0224 §3): the API's, held to its document
 * by `contract.spec.ts` (`CreateLeadDto.age`'s `minimum` and `maximum`). Outside them the API answers `422
 * LEAD_AGE_OUT_OF_RANGE`; the stepper stops at them.
 */
export const LEAD_AGE_MIN = 1;
export const LEAD_AGE_MAX = 100;

/** A typed age as the API takes it: a whole number, or `null` for an empty box. */
export function ageOfText(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed);
}

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
 * **The reader's open leads, every one, in the order they dragged them into** (P18.5-T7, ADR-0161 §1) —
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
