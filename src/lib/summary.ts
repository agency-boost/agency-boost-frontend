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

export interface Pace {
  closingTarget: number;
  closingsLogged: number;
  dayOfMonth: number;
  daysInMonth: number;
  /** `null` before the 7th of the month: too early to project (ADR-0057). */
  projected: number | null;
  weeksLeft: number;
  neededPerWeek: number;
  targetMet: boolean;
}

/** One of *Your sales activity targets* (P10-T5): a cascade code logged against the period's target. */
export interface ActivityTarget {
  key: 'leads' | 'appointments' | 'closings';
  code: string;
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
  | { rule: 'BEHIND_PACE'; kind: 'action'; facts: { projected: number; closingTarget: number; neededPerWeek: number; weeksLeft: number } }
  | { rule: 'LEAD_OVERDUE'; kind: 'action'; facts: { leadId: string; name: string; overdueDays: number; others: number } }
  | { rule: 'LEAD_NEGLECTED'; kind: 'action'; facts: { leadId: string; name: string; others: number } }
  | { rule: 'RATIO_BELOW'; kind: 'improve'; facts: RatioFacts }
  | { rule: 'RATIO_STRENGTH'; kind: 'improve'; facts: RatioFacts };

export interface Summary {
  year: string;
  month: string;
  today: string;
  goal: { set: boolean; savedAt: string | null };
  caseSizeMinor: number;
  monthly: PeriodFigures & { source: FigureSource | null };
  yearly: PeriodFigures & { source: FigureSource };
  pace: Pace | null;
  activity: { monthly: SummaryActivity; yearly: SummaryActivity };
  /** The nearest of the reader's own open leads, and how many there are. */
  leads: { rows: OpenLead[]; total: number };
  /** The rules that fired, in their fixed priority, at most four. */
  insights: Insight[];
}

/**
 * `?for=<membershipId>`, or nothing. Appended with `+`, never interpolated: the API-consumer gate reads
 * path **literals** out of each call, and an interpolation at the end of one reads as part of the path.
 */
const forSubject = (membershipId?: string) =>
  (membershipId ? `?for=${encodeURIComponent(membershipId)}` : '');

/**
 * The Summary. Without a subject it is the reader's own, unaudited. **With one** it is the same
 * Summary computed for that member (P11-T4, P11-T7): their goal, production and its source, log,
 * leads and compliance, on their rung. The server resolves the subject by the reader's grant — a
 * leader reaches the people they coach (ADR-0074) — answers 404 outside it, and writes one audit
 * entry per read (roles §3.5).
 */
export const readSummary = (membershipId?: string) =>
  api<Summary>('/summary' + forSubject(membershipId));
