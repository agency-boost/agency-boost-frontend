import { api } from './api-client';
import type { LeadFlag } from './leads';
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

/** One of *Leads that need you* (P10-T6): the reader's own open lead, flagged as the Leads screen flags it. */
export interface OpenLead {
  id: string;
  name: string;
  type: 'sales' | 'recruitment' | null;
  statusCode: string | null;
  statusLabel: string | null;
  /** Promised for this month. It hides none of the flags (I-103). */
  thisMonth: boolean;
  flags: LeadFlag[];
  overdueDays: number | null;
  nextActionDate: string | null;
  nextActionNote: string | null;
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
 * **Which period a Summary is for, and which there are** (P18.8-T11, ADR-0161 §4) — the server's, so no date is
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
  monthly: PeriodFigures & { source: FigureSource | null };
  yearly: PeriodFigures & { source: FigureSource };
  pace: Pace | null;
  activity: { monthly: SummaryActivity; yearly: SummaryActivity };
  /**
   * The nearest of the reader's own open leads, and how many there are; and `unitOpen`, the open leads Leads
   * Management lists them besides their own — counted on their own summary while their own card is empty
   * (P18.8-T15 AC-4). The API always sends it; optional so a fixture about something else need not.
   */
  leads: { rows: OpenLead[]; total: number; unitOpen?: number };
  /** The rules that fired, in their fixed priority, at most four. */
  insights: Insight[];
}

/**
 * **The period a page asks for** (P18.8-T11): a month, `YYYY-MM`, or a year, `YYYY`, or neither — the office's
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
 * **The months a reader may choose**, newest first: the office's current month back to its first (P18.8-T11).
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
 * entry per read (roles §3.5). **With a period** (P18.8-T11), an earlier month or year, read whole.
 */
export const readSummary = (membershipId?: string, period: SummaryPeriodQuery = {}) =>
  api<Summary>('/summary' + summaryQuery(membershipId, period));
