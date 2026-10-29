import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, LANGUAGES, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { adminAnalyticsMessages } from '@/i18n/messages/admin-analytics';
import { api } from './api-client';
import { formatMonth, formatNumber, formatPercent, percentOf } from './format';
import { tenantStatusTone, tenantStatusWord, type TenantRow } from './admin';

/**
 * *Cross-platform analytics* at `/admin/analytics` (P18-T8; OD-148's answer 1, D-admin): its one read,
 * its shapes, and every string the screen writes.
 *
 * **Adoption, and nothing else.** ADR-0011's line keeps an office's leads, activity, coaching and
 * production out of the console, and OD-148 kept it: the read carries how many people an office has,
 * on which rungs, who joined and left this month, and how many signed in lately — counts, never a
 * person. No membership id, no name; the shapes below are the whole of what the screen can draw.
 *
 * The shapes are split into an `Adoption` and the fields each row adds, so the contract check
 * (`contract.spec.ts`) can read each half off the source as it reads every other pair.
 */

/** One rung of a ladder, counted: the company's ladder, in its order and in its words. */
export interface AdoptionRung {
  code: string;
  label: string;
  count: number;
}

/** The figures every row of the table carries: an office's, a company's total and the platform's. */
export interface Adoption {
  members: number;
  byRung: AdoptionRung[];
  joinedThisMonth: number;
  leftThisMonth: number;
  signedIn7d: number;
  signedIn30d: number;
}

export interface AdoptionCompanyRef {
  id: string;
  name: string;
}

/** What an office's row adds to its figures: which office, its company, and its state as *All KPMs* reads it. */
export interface PlatformOfficeFields {
  kpmId: string;
  code: string;
  branch: string;
  company: AdoptionCompanyRef;
  state: string;
}

/** What a company's total adds: the company, and how many offices it sums. */
export interface PlatformCompanyFields {
  id: string;
  name: string;
  offices: number;
}

/** What the platform's total adds. */
export interface PlatformTotalFields {
  offices: number;
  companies: number;
}

export type PlatformOffice = Adoption & PlatformOfficeFields;
export type PlatformCompany = Adoption & PlatformCompanyFields;
export type PlatformTotal = Adoption & PlatformTotalFields;

/** `GET /admin/analytics` (`platform_analytics:read`, the Super Admin's alone). */
export interface PlatformAnalyticsView {
  /** `YYYY-MM`: the calendar month *joined* and *left* count, in the platform's zone (ADR-0016). */
  month: string;
  offices: PlatformOffice[];
  companies: PlatformCompany[];
  platform: PlatformTotal;
}

export const readPlatformAnalytics = () => api<PlatformAnalyticsView>('/admin/analytics');

/**
 * A count as the console writes one: `1.340` — `id-ID`'s grouping since ADR-0167 §1, where the Platform
 * Overview's tiles wrote `1,340` (`Superadmin.html:313`). One grouping for every number on every screen; `1,340` in
 * English figures (P18.98-T3), the figures' `language` passed last.
 */
export const formatCount = (n: number, language: Language = DEFAULT_LANGUAGE) => formatNumber(n, {}, language);

/**
 * The share of `of` that `part` is, a whole percent rounded half up in integers (`percentOf`, the server's `rateOver`
 * rule — P18.97-T3, parity F-254: 23 of 40 is 58%, where `Math.round` read 57); `null` over nobody, which the screen
 * leaves unsaid rather than printing a percentage of zero people.
 */
export function shareOf(part: number, of: number): number | null {
  return percentOf(part, of);
}

/** *Signed in within …*: the count, and what share of the row's members it is (*"12 (80%)"*), whole (ADR-0174 §1). */
export function signedInWords(signedIn: number, members: number, figures: Language = DEFAULT_LANGUAGE): string {
  const pct = shareOf(signedIn, members);
  return pct === null
    ? formatCount(signedIn, figures)
    : `${formatCount(signedIn, figures)} (${formatPercent(pct, {}, figures)})`;
}

/**
 * *By rung*: each rung's label and count, senior first as the server sends them, on one line (*"AB 3 ·
 * AAB 6 · Agent 40"*). One cell rather than a column per rung, because the companies on the platform need not share
 * a ladder: a column per rung would be blank for every company without it, and its heading would be one
 * company's word for a rung another names differently.
 */
export function rungWords(byRung: readonly AdoptionRung[], figures: Language = DEFAULT_LANGUAGE): string {
  // A no-break space inside each pair, so a narrow cell wraps between rungs and never between a
  // rung's label and its count.
  return byRung.length === 0 ? '—' : byRung.map((r) => `${r.label}\u00a0${formatCount(r.count, figures)}`).join(' · ');
}

/**
 * The parts of an office row that decide *All KPMs*' Status column (`tenantStatusWord`), keyed by the
 * state the read may send, so the word and the pill's tone come from the one place that list does.
 */
const STATE_PARTS: Record<string, Pick<TenantRow, 'status' | 'subscriptionState'>> = {
  active: { status: 'active', subscriptionState: 'active' },
  suspended: { status: 'suspended', subscriptionState: 'none' },
  archived: { status: 'archived', subscriptionState: 'none' },
  ended: { status: 'active', subscriptionState: 'ended' },
  ended_kept_active: { status: 'active', subscriptionState: 'ended_kept_active' },
};

/**
 * An office's state, **as *All KPMs* shows it** (T8 AC-2): the word and the pill's tone. Accepts the
 * state's code or the word itself, in either language, since either names the same thing; anything else is
 * printed as it came, in the neutral tone, rather than read as a state it is not. The word in the reader's
 * `language` (P18.98-T6), English, the source, when given none.
 */
export function officeState(
  state: string,
  language: Language = SOURCE_LANGUAGE,
): { word: string; tone: ReturnType<typeof tenantStatusTone> } {
  const parts = STATE_PARTS[state]
    ?? Object.values(STATE_PARTS).find((p) => LANGUAGES.some((l) => tenantStatusWord(p, l) === state));
  return parts ? { word: tenantStatusWord(parts, language), tone: tenantStatusTone(parts) } : { word: state, tone: 'neutral' };
}

/**
 * Every string the screen writes, in English — the catalogue's source (`i18n/messages/admin-analytics.ts`, P18.98-T6).
 * The title is the nav item's, verbatim (`Superadmin.html:204`); the rest are ours, and use none of OD-39's six words
 * (D-copy): the table's rows are *branches*, which is what *All KPMs*' *Branch* column calls them.
 */
export const PLATFORM_ANALYTICS_COPY = adminAnalyticsMessages.en;

/** The table's headings, in order: *All KPMs*' first four, verbatim, then the figures — in the reader's `language`. */
export function analyticsHeadings(language: Language = SOURCE_LANGUAGE): readonly string[] {
  const h = messagesIn(adminAnalyticsMessages, language).headings;
  return [h.code, h.branch, h.company, h.status, h.members, h.byRung, h.joined, h.left, h.signedIn7d, h.signedIn30d];
}

/** The table's headings in English, the catalogue's source. */
export const PLATFORM_ANALYTICS_HEADINGS: readonly string[] = analyticsHeadings();

/**
 * The headings once the read says which month *this month* is: *"Joined in October 2026"* (data honesty —
 * a reader on the first of a month should not have to guess which month the two columns count). The month in the
 * figures' language, the words in the words' (P18.98-T6).
 */
export function platformHeadings(
  month: string | null,
  figures: Language = DEFAULT_LANGUAGE,
  language: Language = SOURCE_LANGUAGE,
): readonly string[] {
  const headings = analyticsHeadings(language);
  if (!month) return headings;
  const t = messagesIn(adminAnalyticsMessages, language);
  const name = formatMonth(month, figures);
  return headings.map((h, i) => (i === 6 ? t.joinedIn({ month: name }) : i === 7 ? t.leftIn({ month: name }) : h));
}

/** A company's total row's label: *Prudential — Total (2 branches)*, the count in the figures' language. */
export function companyTotalWords(
  name: string,
  branches: number,
  figures: Language = DEFAULT_LANGUAGE,
  language: Language = SOURCE_LANGUAGE,
): string {
  return messagesIn(adminAnalyticsMessages, language).companyTotal({ name, n: branches, branches: formatCount(branches, figures) });
}

/** The platform's total row's label: *Platform — Total (2 companies, 3 branches)*. */
export function platformTotalWords(
  companies: number,
  branches: number,
  figures: Language = DEFAULT_LANGUAGE,
  language: Language = SOURCE_LANGUAGE,
): string {
  return messagesIn(adminAnalyticsMessages, language).platformTotal({
    c: companies, companies: formatCount(companies, figures), b: branches, branches: formatCount(branches, figures),
  });
}

/**
 * The table's rows in reading order: each company's offices, then its total; the platform's total
 * last. An office whose company the read did not total (it should not happen) still gets its row, after
 * the companies, so nothing the read sent is dropped.
 */
export type AnalyticsRow =
  | { kind: 'office'; office: PlatformOffice }
  | { kind: 'company'; company: PlatformCompany }
  | { kind: 'platform'; platform: PlatformTotal };

export function tableRows(view: PlatformAnalyticsView): AnalyticsRow[] {
  const rows: AnalyticsRow[] = [];
  const totalled = new Set(view.companies.map((c) => c.id));
  for (const company of view.companies) {
    for (const office of view.offices) {
      if (office.company.id === company.id) rows.push({ kind: 'office', office });
    }
    rows.push({ kind: 'company', company });
  }
  for (const office of view.offices) {
    if (!totalled.has(office.company.id)) rows.push({ kind: 'office', office });
  }
  rows.push({ kind: 'platform', platform: view.platform });
  return rows;
}
