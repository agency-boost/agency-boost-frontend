import { api } from './api-client';
import type { Lead } from './leads';
import type { RatioDisplayUnit } from './ratio-format';

/**
 * The Personal Summary (P10). **Every number is the server's** — the arithmetic lives in
 * `summary-figures.ts`, where the exit criterion is tested; this file only names the shapes.
 */

export interface FigureSource {
  provenance: 'imported' | 'corrected' | 'self_reported';
  month: string | null;
  /**
   * Who corrected the figure by hand, and when — an Owner or an Admin at the month table, or a leader on
   * the Unit Dashboard (ADR-0121). `null` for the file's own figure, the agent's own, or a corrector who
   * can no longer be named. Optional so a source read before Phase 15 still reads.
   */
  correctedBy?: { membershipId: string; name: string } | null;
  correctedAt?: string | null;
  /**
   * **Who typed a `self_reported` figure, when it was not the member** — a coach (S2): `self_reported` is *typed in the
   * app, not uploaded*, by the member or by whoever coaches them. Absent when the member typed it.
   */
  typedBy?: { membershipId: string; name: string | null };
}

/**
 * **Whose figure a period's APE produced is** (P19.1-T4, UI-157; ADR-0195): the office's file, the member's own estimate
 * (*perkiraan Anda* — the year only), or nothing yet; and with nothing, the helpers counting 0 achieved (UI-157 item 2),
 * which the card marks *(belum ada data produksi)*. The server's; the API always sends them, optional so a fixture about
 * something else need not.
 */
export interface ProductionHeld {
  /** `estimate` on `monthly` is the month's own figure the member typed over the upload (P19.11-T4, `realised`). */
  production?: 'official' | 'estimate' | 'none';
  withoutProduction?: { gapMinor: number; policiesNeeded: number | null } | null;
}

/**
 * ***Bulanan*'s realised APE** (P19.11-T4; UX-12, UXQ2's default): which figure `actualMinor` is — the member's own,
 * typed over the upload in the headline (`manual`, *Diubah manual*), the office's upload (`uploaded`), or neither yet
 * (`none`, *Belum diunggah*) — and whether an upload exists beneath it, which *Kembalikan ke data unggahan* goes back to.
 */
export interface MonthRealised {
  source: 'manual' | 'uploaded' | 'none';
  uploaded: boolean;
  manual: { minor: number; typedAt: string } | null;
}

export interface PeriodFigures {
  targetMinor: number | null;
  /** `null` when nothing is held yet — this month before its file. Not zero. */
  actualMinor: number | null;
  attainmentPct: number | null;
  gapMinor: number | null;
  overMinor: number | null;
  policiesNeeded: number | null;
  targetMet: boolean;
}

/**
 * The pace sentence's figures (ADR-0109): *"tracking to close **N** … against a target of **M**. With **W**
 * weeks left, you'd need to close roughly **K** policies/week"*.
 */
export interface Pace {
  /** *M*: this month's closing target — the closings chip's. */
  closingTarget: number;
  /** *N*: the closings logged over the last 30 days, today included — last month's too, early in a month. */
  closingsLast30Days: number;
  dayOfMonth: number;
  daysInMonth: number;
  /** *W*: never zero. */
  weeksLeft: number;
  /** This month's APE gap in policies; the whole target's until the month's file lands. */
  policiesNeeded: number;
  /** *K*. */
  neededPerWeek: number;
  /** This month's APE target, or the year's, is reached: the green sentence instead of the danger box. */
  targetMet: boolean;
}

/** One of *Your sales activity targets* (P10-T5): a cascade code logged against the period's target. */
export interface ActivityTarget {
  key: 'leads' | 'appointments' | 'closings';
  /** The first code the office binds to this stage. */
  code: string;
  /** Every code the office binds to this stage (ADR-0163); `logged` is their sum. */
  codes?: string[];
  logged: number;
  /** `null` without an APE target to derive it from; 0 when the month needs nothing more — met. */
  target: number | null;
  /** `null` on a zero or missing target — never `NaN%`. */
  attainmentPct: number | null;
  targetMet: boolean;
}

/**
 * One of the office's summary tiles the reader is shown, whose sections hold none of the three codes
 * above, with its rows (ADR-0064). `code` and `label` are the tile's group code and label, or the
 * section's own when it has a tile of its own. The server groups; the screen draws what it is sent.
 */
export interface SectionChip {
  code: string;
  label: string;
  total: number;
  rows: { code: string; label: string; count: number }[];
}

export interface SummaryActivity {
  from: string;
  to: string;
  targets: ActivityTarget[];
  total: number;
  sections: SectionChip[];
}

/** What a ratio rule read (P10-T7). */
export interface RatioFacts {
  code: string;
  label: string;
  value: number;
  benchmark: number;
  displayUnit: RatioDisplayUnit;
}

/**
 * One insight card (P10-T7, ADR-0060): the rule that fired and the facts it read. **The server decides
 * which rules fire; this screen writes the words**, as it writes the pace line.
 */
export type Insight =
  | { rule: 'NOTHING_LOGGED'; kind: 'action'; facts: { windowDays: number; lastLoggedOn: string | null } }
  | { rule: 'BEHIND_PACE'; kind: 'action'; facts: { closingsLast30Days: number; closingTarget: number; neededPerWeek: number; weeksLeft: number } }
  | { rule: 'LEAD_OVERDUE'; kind: 'action'; facts: { leadId: string; name: string; overdueDays: number; others: number } }
  | { rule: 'LEAD_NEGLECTED'; kind: 'action'; facts: { leadId: string; name: string; others: number } }
  | { rule: 'RATIO_BELOW'; kind: 'improve'; facts: RatioFacts }
  | { rule: 'RATIO_STRENGTH'; kind: 'improve'; facts: RatioFacts };

/**
 * **Which period a Summary is for, and which there are** (P18.5-T11, ADR-0161 §4) — the server's, so no date is
 * worked out here: the office's first month and its current one, and whether the month and the year read are
 * the current ones. A closed period is read whole, with no pace; the screen shows *The gap* for the current one.
 */
export interface SummaryPeriod {
  /** `YYYY-MM`, in the office's zone: the earliest month there is, and its year the earliest year. */
  firstMonth: string;
  /** `YYYY-MM`: the office's current month, the latest there is. */
  thisMonth: string;
  currentMonth: boolean;
  currentYear: boolean;
}

export interface Summary {
  /** The year *Yearly* is about: this one, or one asked for. */
  year: string;
  /** The month *Monthly* is about, `YYYY-MM`: this one, one asked for, or a closed year's December. */
  month: string;
  today: string;
  period: SummaryPeriod;
  goal: { set: boolean; savedAt: string | null };
  caseSizeMinor: number;
  /**
   * `realised` (P19.11-T4): the API always sends it; optional so a fixture about something else need not, and without it
   * the month reads as its `production` says.
   */
  monthly: PeriodFigures & { source: FigureSource | null } & ProductionHeld & { realised?: MonthRealised };
  yearly: PeriodFigures & { source: FigureSource } & ProductionHeld;
  /**
   * **The office's figure replaced an estimate** (P19.1-T4 AC-11; ADR-0195 §3): the day it was written, for *Diganti data
   * produksi resmi (diunggah 5 Des)*; `null` when nothing was replaced. Optional so a fixture about something else need
   * not.
   */
  estimateReplaced?: { uploadedOn: string } | null;
  pace: Pace | null;
  /**
   * **Where the page's counts of policies come from** (UI-052): every one — the *Submission polis* chips and the pace
   * sentence's *closing N* — is the activity log's, over `codes`; APE and *Polis yang dibutuhkan* are the upload's. The
   * API always sends it; optional so a fixture about something else need not.
   */
  policies?: { source: 'activity_log'; codes: string[] };
  /**
   * **The day the page's APE is valid for** (UI-054, the date header): the office's day its latest production file for
   * `month` — and for `year`, of any of its months up to `month` — was uploaded; `null` while there is none. The API
   * always sends it; optional so a fixture about something else need not.
   */
  uploadedOn?: { month: string | null; year: string | null };
  activity: { monthly: SummaryActivity; yearly: SummaryActivity };
  /**
   * ***Leads yang perlu perhatian Anda*** (P10-T6; P19.11-T5, UX-13): **every** open lead of the member's own, in
   * `GET /leads`' row shape — what the shared lead card draws and its sheet opens — what needs attention first (the
   * server's order: a dated next action first, the most overdue on top, then the undated, waiting longest first); how
   * many there are; `shown`, how many the section draws before *Lihat semua (N)* (`SUMMARY.LEADS_SHOWN`, the server's,
   * never re-declared here); and `unitOpen`, the open leads Leads Management lists them besides their own — counted on
   * their own summary while their own card is empty (P18.5-T15 AC-4). The API always sends `shown` and `unitOpen`;
   * optional so a fixture about something else need not, and without `shown` every row is drawn.
   */
  leads: { rows: Lead[]; total: number; shown?: number; unitOpen?: number };
  /** The rules that fired, in their fixed priority, at most four. */
  insights: Insight[];
}

/**
 * **The period a page asks for** (P18.5-T11): a month, `YYYY-MM`, or a year, `YYYY`, or neither — the office's
 * current month. It is the page's address, `?month=` or `?year=`, as `/summary` and a coachee's *Personal Summary*
 * tab carry it.
 */
export interface SummaryPeriodQuery {
  month?: string;
  year?: string;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/**
 * The address's period: a well-formed `month`, else a well-formed `year`, else neither — the current month. A
 * malformed one is not sent, since the read would refuse it; **one in the future or before the office is**, and
 * the server's refusal says which months there are.
 */
export function summaryPeriodFrom(query: { month?: string | string[]; year?: string | string[] }): SummaryPeriodQuery {
  const month = one(query.month);
  if (month !== undefined && MONTH.test(month)) return { month };
  const year = one(query.year);
  if (year !== undefined && YEAR.test(year)) return { year };
  return {};
}

/** `?month=…` or `?year=…`, or nothing: the address and the read's query alike. */
export const periodSearch = (period: SummaryPeriodQuery) =>
  (period.month ? `?month=${period.month}` : period.year ? `?year=${period.year}` : '');

/**
 * **The months a reader may choose**, newest first: the office's current month back to its first (P18.5-T11).
 * Calendar arithmetic on two `YYYY-MM` strings the server sent, so no clock and no zone is read here.
 */
export function monthsOf(period: Pick<SummaryPeriod, 'firstMonth' | 'thisMonth'>): string[] {
  const months: string[] = [];
  let [y, m] = period.thisMonth.split('-').map(Number);
  for (let month = period.thisMonth; month >= period.firstMonth; month = `${y}-${String(m).padStart(2, '0')}`) {
    months.push(month);
    [y, m] = m === 1 ? [y - 1, 12] : [y, m - 1];
  }
  return months;
}

/** **The years a reader may choose**, newest first: the office's current year back to its first. */
export function yearsOf(period: Pick<SummaryPeriod, 'firstMonth' | 'thisMonth'>): string[] {
  const years: string[] = [];
  for (let y = Number(period.thisMonth.slice(0, 4)); y >= Number(period.firstMonth.slice(0, 4)); y -= 1) years.push(String(y));
  return years;
}

/**
 * **The days left after today in the office's month, or its year** (UI-054: *sisa 1 hari bulan ini* on the 30th of
 * October, *hari terakhir* — 0 — on the 31st): calendar arithmetic on the office's day the server sent (`today`,
 * `YYYY-MM-DD`), so no clock and no zone is read here. Built from the date's numbers in UTC, where no day is 23 hours.
 */
export function daysLeftIn(today: string, period: 'month' | 'year'): number {
  const [y, m, d] = today.split('-').map(Number);
  const day = Date.UTC(y, m - 1, d);
  // The month's last day is day 0 of the next; the year's is 31 December.
  const last = period === 'month' ? Date.UTC(y, m, 0) : Date.UTC(y, 11, 31);
  return Math.round((last - day) / 86_400_000);
}

/**
 * `?for=<membershipId>`, or nothing. Appended with `+`, never interpolated: the API-consumer gate reads
 * path **literals** out of each call, and an interpolation at the end of one reads as part of the path.
 */
const forSubject = (membershipId?: string) =>
  (membershipId ? `?for=${encodeURIComponent(membershipId)}` : '');

/** The query: `for` first, then the period, each only when there is one. */
const summaryQuery = (membershipId: string | undefined, period: SummaryPeriodQuery) => {
  const subject = forSubject(membershipId);
  const when = periodSearch(period);
  return subject && when ? `${subject}&${when.slice(1)}` : subject || when;
};

/**
 * The Summary. Without a subject it is the reader's own, unaudited. **With one** it is the same
 * Summary computed for that member (P11-T4, P11-T7): their goal, production and its source, log,
 * leads and compliance, on their rung. The server resolves the subject by the reader's grant — a
 * leader reaches the people they coach (ADR-0074) — answers 404 outside it, and writes one audit
 * entry per read (roles §3.5). **With a period** (P18.5-T11), an earlier month or year, read whole.
 */
export const readSummary = (membershipId?: string, period: SummaryPeriodQuery = {}) =>
  api<Summary>('/summary' + summaryQuery(membershipId, period));
