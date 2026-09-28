import { api } from './api-client';

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

/** A section the reader is shown that holds none of the three codes above, with its rows. */
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
}

/** Your own Summary. There is no `membershipId`: a leader's view of a downline's is Phase 13's. */
export const readSummary = () => api<Summary>('/summary');
