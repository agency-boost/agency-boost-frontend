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
  sort?: 'dateRegistered' | 'name' | 'nextActionDate';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
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

/**
 * `2026-09` as *Sep 2026*.
 *
 * Built from the month's own numbers rather than parsed as a date: `new Date('2026-09')` is
 * midnight **UTC**, which renders as August for anybody west of Greenwich — the same
 * off-by-one-day class of bug the whole day-boundary rule exists to stop.
 */
export const monthLabel = (month: string): string => {
  const [year, index] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(index) - 1] ?? month} ${year}`;
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

export const readLead = (id: string) => api<Lead>(`/leads/${id}`);

export const createLead = (body: Partial<Lead> & { name: string }) =>
  api<Lead>('/leads', { method: 'POST', body });

/** One field at a time, so a refusal names the field that caused it. */
export const updateLead = (id: string, body: Record<string, unknown>) =>
  api<Lead>(`/leads/${id}`, { method: 'PATCH', body });

/** Moving. Any active stage of the lead's own ladder, at any time (ADR-0045). */
export const setLeadStatus = (id: string, statusCode: string) =>
  api<Lead>(`/leads/${id}/status`, { method: 'PATCH', body: { statusCode } });

/** Closing, or reopening. Its own act, and its own permission. */
export const setLeadOutcome = (id: string, outcome: LeadOutcome | null) =>
  api<Lead>(`/leads/${id}/outcome`, { method: 'PATCH', body: { outcome } });

export const deleteLead = (id: string) =>
  api<{ id: string; deletedAt: string }>(`/leads/${id}`, { method: 'DELETE' });
