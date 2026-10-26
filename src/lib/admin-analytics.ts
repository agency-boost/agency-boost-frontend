import { api } from './api-client';
import { formatMonth, formatNumber, formatPercent } from './format';
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
 * Overview's tiles wrote `1,340` (`Superadmin.html:313`). One grouping for every number on every screen.
 */
export const formatCount = (n: number) => formatNumber(n);

/**
 * The share of `of` that `part` is, rounded to a whole percent; `null` over nobody, which the screen
 * leaves unsaid rather than printing a percentage of zero people.
 */
export function shareOf(part: number, of: number): number | null {
  return of > 0 ? Math.round((part / of) * 100) : null;
}

/** *Signed in within …*: the count, and what share of the row's members it is (*"12 (80,0%)"*). */
export function signedInWords(signedIn: number, members: number): string {
  const pct = shareOf(signedIn, members);
  return pct === null ? formatCount(signedIn) : `${formatCount(signedIn)} (${formatPercent(pct)})`;
}

/**
 * *By rung*: each rung's label and count, senior first as the server sends them, on one line (*"AB 3 ·
 * AAB 6 · Agent 40"*). One cell rather than a column per rung, because the companies on the platform need not share
 * a ladder: a column per rung would be blank for every company without it, and its heading would be one
 * company's word for a rung another names differently.
 */
export function rungWords(byRung: readonly AdoptionRung[]): string {
  // A no-break space inside each pair, so a narrow cell wraps between rungs and never between a
  // rung's label and its count.
  return byRung.length === 0 ? '—' : byRung.map((r) => `${r.label}\u00a0${formatCount(r.count)}`).join(' · ');
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
 * state's code or the word itself, since either names the same thing; anything else is printed as it
 * came, in the neutral tone, rather than read as a state it is not.
 */
export function officeState(state: string): { word: string; tone: ReturnType<typeof tenantStatusTone> } {
  const parts = STATE_PARTS[state] ?? Object.values(STATE_PARTS).find((p) => tenantStatusWord(p) === state);
  return parts ? { word: tenantStatusWord(parts), tone: tenantStatusTone(parts) } : { word: state, tone: 'neutral' };
}

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * Every string the screen writes. The title is the nav item's, verbatim (`Superadmin.html:204`); the
 * rest are ours, and use none of OD-39's six words (D-copy): the table's rows are *branches*, which is
 * what *All KPMs*' *Branch* column calls them.
 */
export const PLATFORM_ANALYTICS_COPY = {
  title: 'Cross-platform analytics',
  subtitle: 'Adoption across every company on AgencyBoost',
  caption: 'Adoption by branch and company',
  empty: 'No branches on the platform yet.',
  tryAgain: 'Try again',
  companyTotal: (name: string, branches: number) => `${name} — Total (${plural(branches, 'branch', 'branches')})`,
  platformTotal: (companies: number, branches: number) =>
    `Platform — Total (${plural(companies, 'company', 'companies')}, ${plural(branches, 'branch', 'branches')})`,
} as const;

/** The table's headings, in order: *All KPMs*' first four, verbatim, then the figures. */
export const PLATFORM_ANALYTICS_HEADINGS = [
  'Code', 'Branch', 'Company', 'Status', 'Members', 'By rung',
  'Joined this month', 'Left this month', 'Signed in within 7 days', 'Signed in within 30 days',
] as const;

/**
 * The headings once the read says which month *this month* is: *"Joined in October 2026"* (data honesty —
 * a reader on the first of a month should not have to guess which month the two columns count).
 */
export function platformHeadings(month: string | null): readonly string[] {
  if (!month) return PLATFORM_ANALYTICS_HEADINGS;
  const name = formatMonth(month);
  return PLATFORM_ANALYTICS_HEADINGS.map((h) =>
    (h === 'Joined this month' ? `Joined in ${name}` : h === 'Left this month' ? `Left in ${name}` : h));
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
