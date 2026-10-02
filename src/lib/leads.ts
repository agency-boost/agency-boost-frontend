import { api } from '@/lib/api-client';

export type LeadType = 'sales' | 'recruitment';
export type LeadOutcome = 'won' | 'lost';
export type LawfulBasis = 'consent' | 'contract' | 'legitimate_interest';

/** Derived on read, never stored — a stored flag is one that is wrong at midnight. */
export type LeadFlag = 'overdue' | 'no-next-action' | 'no-remarks';

export interface Lead {
  id: string;
  ownerMembershipId: string;
  type: LeadType | null;
  name: string;
  contact: { phone: string | null; email: string | null };
  lawfulBasis: LawfulBasis | null;
  consentAt: string | null;
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
  lastEditedBy: { membershipId: string; name: string | null } | null;
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

/** What each attention flag is called on screen. One place, so two screens cannot disagree. */
export const FLAG_LABEL: Record<LeadFlag, string> = {
  overdue: 'Overdue',
  'no-next-action': 'No next action',
  'no-remarks': 'No remarks',
};

/**
 * What a flag reads as on a row — *Overdue 14 days* rather than *Overdue*, as the prototype has
 * it (`leads-management.md` §4).
 *
 * **The count comes from the server, not from the browser's clock.** `overdueDays` is whole
 * calendar days in the **office's** timezone; a screen subtracting two dates itself would be
 * wrong for anybody whose device is in another zone, which is the defect the whole day-boundary
 * rule exists to stop (invariant §9).
 */
export const flagLabel = (flag: LeadFlag, overdueDays: number | null): string => {
  if (flag !== 'overdue' || overdueDays === null) return FLAG_LABEL[flag];
  return `Overdue ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`;
};

export const LAWFUL_BASIS_LABEL: Record<LawfulBasis, string> = {
  consent: 'They agreed',
  contract: 'An application is already under way',
  legitimate_interest: 'A referral I have not yet spoken to',
};

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

export const readLead = (id: string) => api<Lead>(`/leads/${id}`);

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
