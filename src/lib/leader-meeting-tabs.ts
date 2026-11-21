'use client';

import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { forumStatsMessages } from '@/i18n/messages/forum-stats';
import {
  type CompactUnit, formatCalendarDay, formatDecimalInput, formatMoneyUnit, formatMonth, formatMonthName, formatNumber, formatPercent,
  MINOR_UNITS_PER_MAJOR, parseDecimal, RUPIAH_PER_UNIT,
} from './format';


/**
 * **The MAPA scorecard's words and figures** (`functional/leader-forum.md` before P19.22, *Overview & Stats*): how a
 * figure of the forum's old scorecard is written — what Advanced analytics' *MAPA driver* reads (`rowName`, `cellText`)
 * since the forum's own *Overview & Stats* tab went (P19.22-T8; ADR-0276). The scorecard's shapes live here with them.
 *
 * The figures are the server's, exact (OD-144, ADR-0129); this file only rounds them for display, as the spec
 * says each row is drawn. Nothing here decides a figure, who may edit or a bound (`limits`) — the places a target's
 * rate is typed to are the backend's, held here as a copy its spec pins (`LEADER_MEETING_TARGET_RATE_DECIMALS`).
 */

/*
 * ── The scorecard's shapes ──────────────────────────────────────────────────────────────────────
 */

/**
 * The six computed columns, in the client's reference slide's order (ADR-0175 §1): the *Full Year & YTD View* — *Full
 * Year {Y−1}*, ***YTD {Y−1}***, *YTD {Y}* — then the *Monthly View*'s three months; *Monthly Target* is typed.
 */
export type ColumnKey = 'fy' | 'ytdLastYear' | 'ytd' | 'thisMonthLastYear' | 'lastMonth' | 'thisMonth';
export const COLUMN_KEYS: readonly ColumnKey[] = ['fy', 'ytdLastYear', 'ytd', 'thisMonthLastYear', 'lastMonth', 'thisMonth'];
/** *Full Year & YTD View*. */
export const YEAR_COLUMN_KEYS: readonly ColumnKey[] = ['fy', 'ytdLastYear', 'ytd'];
/** *Monthly View*'s computed three; *Monthly Target* closes the group. */
export const MONTH_COLUMN_KEYS: readonly ColumnKey[] = ['thisMonthLastYear', 'lastMonth', 'thisMonth'];

/** The nine rows, in the slide's order. `producing_agents` is *Annual Active Agents*: the key is the stored one. */
export type RowKey =
  | 'ape' | 'manpower' | 'flc' | 'producing_agents' | 'new_agent_3m'
  | 'avg_monthly_aa' | 'case_submission' | 'cases_per_producing_agent' | 'average_case_size';

/** The five rows whose *Monthly Target* is typed, as a rate per unit; the others take none. */
export type TargetRowKey = 'ape' | 'manpower' | 'flc' | 'avg_monthly_aa' | 'case_submission';

export type ScorecardCell =
  /** `value` exact: minor units for `idr_minor`, a whole or fractional count, a whole percentage, a ratio. */
  | { kind: 'figure'; value: number; leavesOut: string[] /* YYYY-MM months of the period not held */ }
  /** *pending data*: no source holds the figure for its period. */
  | { kind: 'pending' }
  /** *—*: a ratio over nothing whose months are held (*Avg. Case Size* over no policies, *Cases/producing agents* over nobody). */
  | { kind: 'none' }
  /** *Not tracked*: a row the table leaves empty in this column. */
  | { kind: 'blocked' }
  /** *—*: a column or a row a scorecard kept before it existed does not hold (ADR-0175 §8). */
  | { kind: 'unrecorded' }
  /**
   * *—*, *Not uploaded yet* to a screen reader: a *Full Year* or *YTD* column of last year with no month of its period
   * uploaded (P19.3-T1; ADR-0203 §8, *"Show '—' until uploaded"*). Every other cell keeps *pending data*.
   */
  | { kind: 'not_uploaded' };

/**
 * **Which definitions a scorecard's rows follow** (P19.3-T1; ADR-0202 §4) — what its footnotes say: `data_sources`, the
 * owner's data sources of 3 November (live, or kept since), or `reference_slide`, a scorecard kept before them. Served.
 */
export type ScorecardDefinitions = 'data_sources' | 'reference_slide';

/** The months a column names, `YYYY-MM` to `YYYY-MM`, from the meeting's month: its header's second line. */
export interface ColumnPeriod {
  from: string;
  to: string;
}

/**
 * A *Monthly Target*, typed as a rate per unit (ADR-0175 §4): the rate in the row's unit — IDR minor units for *APE*,
 * a count for the others — and the server's **value**, `rate × # of units`; or, with no rate, a target typed as text
 * before rates, shown as typed. Never typed: version 0.
 */
export interface MonthlyTarget {
  rate: number | null;
  value: number | null;
  typed: string | null;
  version: number;
}

/**
 * What a phone's card reads beside *YTD {Y}* and *YTD {Y−1}*: the change the server computed, whole and signed, in its
 * `unit` — `percent`, a percentage of last year's figure, or `points`, the difference in percentage points on a row
 * whose own figure is a percentage (*3M new agent %*; P18.9-T8 F1, parity F-256).
 */
export type YtdChange = { kind: 'figure'; value: number; unit: 'percent' | 'points' } | { kind: 'none' };

export interface ScorecardRow {
  key: RowKey;
  unit: 'idr_minor' | 'count' | 'percentage' | 'ratio';
  cells: Record<ColumnKey, ScorecardCell>;
  ytdChange: YtdChange;
  /** `null` on a row the table does not track month by month. */
  monthlyTarget: MonthlyTarget | null;
}

/** *AS OF*: a day; none while the office has no file (nothing drawn); unrecorded on a scorecard kept before it (*—*). */
export type ScorecardAsOf = { kind: 'date'; date: string } | { kind: 'none' } | { kind: 'unrecorded' };

/** A period a figure of which leaves months out: its *(\*)* note. */
export interface PartialPeriod {
  column: ColumnKey;
  leavesOut: string[];
}

export interface Scorecard {
  periods: Record<ColumnKey, ColumnPeriod>;
  /**
   * `units` is the AB and AAB who lead somebody (P19.3-T1, ADR-0203 §1) — or, on a scorecard kept before that, the number
   * it was kept with. The server's; the *Monthly Target*'s multiplier.
   */
  chips: { manpower: number; agents: number; units: number; ab: number; aab: number };
  /** Nine, in the slide's order. */
  rows: ScorecardRow[];
  asOf: ScorecardAsOf;
  /** In column order; empty when every figure covers its whole period. */
  partialPeriods: PartialPeriod[];
  /** `null` while live; the instant it was frozen onto the meeting otherwise. */
  frozenAt: string | null;
  /** The definitions its rows follow, so the footnotes drawn are true of them (P19.3-T1). */
  definitions: ScorecardDefinitions;
}

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **The tabs' words are the catalogue's** (P18.10-T4): *Overview & Stats*' in `i18n/messages/forum-stats.ts`, the
 * agenda's and the tracker's went with the forum's 19 November redo (ADR-0276); English the source and Indonesian the approved glossary's. A screen
 * reads the reader's with `useMessages`; a function here that writes words takes the reader's language (`useLanguage()`)
 * as `words`, English when given none, and one that writes a figure too takes the figures' (`useFigureLanguage()`) as
 * `language`, before it.
 *
 * `TABS_COPY` and `TABS_OWN_COPY` are **the source's words, English, in the shapes the prototype's copy had** — the
 * slide's labels, its rows in its order, the prototype's headers and statuses verbatim — as `leader-meeting-tabs.spec.ts`
 * reads and scans them. Nothing on a screen reads them.
 */
const STATS = forumStatsMessages.en;

/** The strip's chips in the slide's order (UI-011). */
const CHIP_KEYS = ['manpower', 'agents', 'units', 'ab', 'aab'] as const satisfies readonly (keyof Scorecard['chips'])[];

export const TABS_COPY = {
  chips: CHIP_KEYS.map((key) => ({ key, label: STATS.chips[key] })),
  metrics: STATS.metrics,
  monthlyTarget: STATS.monthlyTarget,
  groups: STATS.groups,
  columns: STATS.columns,
  rows: STATS.rows satisfies Record<RowKey, string>,
  pending: STATS.pending,
  none: '—',
  tbd: STATS.tbd,
} as const;

/** *—*: a figure there is none of, in both languages. */
export const NONE = '—';

/** `a`, `a and b`, `a, b and c` — `a, b, dan c` in Indonesian. */
export function listed(items: readonly string[], words: Language = SOURCE_LANGUAGE): string {
  return messagesIn(forumStatsMessages, words).list({ items });
}

/** The chips in the slide's order, each with its label in a language (UI-011). */
export const chipsIn = (words: Language = SOURCE_LANGUAGE) =>
  CHIP_KEYS.map((key) => ({ key, label: messagesIn(forumStatsMessages, words).chips[key] }));

/**
 * The module's own (*The module's own strings*, D-copy), English, as the old copy's positional functions read: none
 * uses the six words, a phase, an id or a permission code. `leader-meeting-tabs.spec.ts` scans them.
 */
export const TABS_OWN_COPY = {
  notTracked: STATS.notTracked,
  unrecorded: STATS.unrecorded,
  notUploaded: STATS.notUploaded,
  none: STATS.none satisfies Partial<Record<RowKey, string>>,
  partialMark: STATS.partialMark,
  title: (branch: string, month: string) => `${branch}: ${month}`,
  asOf: STATS.asOf,
  asOfUnrecorded: STATS.asOfUnrecorded,
  change: STATS.change,
  targetName: (row: string) => STATS.targetName({ row }),
  notARate: (example: string) => STATS.notARate({ example }),
} as const;

/*
 * ── The scorecard ───────────────────────────────────────────────────────────────────────────────
 */

/** `'26` for 2026: the slide's year in a period. */
const shortYear = (month: string) => month.slice(2, 4);

/**
 * **A column's two-line header** (P18.9-T1 AC-2, UI-002): its name — *Full Year 2025*, *YTD 2026*, *This Month* — and
 * its period from the meeting's month, in the app's month abbreviations (ADR-0174 §6): *(Jan-Des '25)*, *(Jan-Okt '26)*,
 * *(Jan '26)* for a January's *YTD*, *(Okt-25)* for a single month, as the slide writes them.
 */
export function columnHeader(
  column: ColumnKey, periods: Scorecard['periods'], language: Language = DEFAULT_LANGUAGE,
): { name: string; period: string } {
  const { from, to } = periods[column];
  const year = from.slice(0, 4);
  const month = (m: string) => formatMonthName(m, language);
  const span = (p: ColumnPeriod) => (p.from === p.to
    ? `(${month(p.from)} '${shortYear(p.from)})`
    : `(${month(p.from)}-${month(p.to)} '${shortYear(p.to)})`);
  // Kept names (§A.4), the same in both languages: only the period's months are the reader's.
  if (column === 'fy') return { name: `${STATS.columns.fy} ${year}`, period: span(periods[column]) };
  if (column === 'ytd' || column === 'ytdLastYear') return { name: `${STATS.columns.ytd} ${year}`, period: span(periods[column]) };
  return { name: STATS.columns[column], period: `(${month(to)}-${shortYear(to)})` };
}

/**
 * **The money rows' unit** (ADR-0174 §5): *APE* in a *miliar*, *Avg. Case Size* in a *juta* — the compact units' own
 * codes (`RUPIAH_PER_UNIT`, `lib/format.ts`), so a figure's size and its header's unit are read from one place.
 */
const ROW_MONEY_UNIT: Partial<Record<RowKey, CompactUnit>> = { ape: 'M', average_case_size: 'jt' };

/**
 * **A row's name as the table heads it** (P18.10-T3 AC-1; the glossary's §E): a money row's unit in the reader's
 * language — *APE (Rp M)* and *Avg. Case Size (Rp Jt)* in Indonesian, *APE (IDR B)* and *Avg. Case Size (IDR M)* in
 * English, as the client's slide writes it. The name is a kept-English term (§A.4); the unit is a format
 * (`formatMoneyUnit`). Every other row reads its name.
 */
export function rowName(key: RowKey, language: Language = DEFAULT_LANGUAGE): string {
  const unit = ROW_MONEY_UNIT[key];
  return unit ? `${STATS.rows[key]} (${formatMoneyUnit(unit, language)})` : STATS.rows[key];
}

/** How a row is drawn (UI-004): bold, a shaded band, indented under *Manpower*, or as is. */
export const ROW_STYLE: Record<RowKey, { bold?: true; band?: true; indent?: true }> = {
  ape: { bold: true },
  manpower: { bold: true, band: true },
  flc: { indent: true },
  producing_agents: { bold: true, indent: true },
  new_agent_3m: {},
  avg_monthly_aa: {},
  case_submission: {},
  cases_per_producing_agent: { bold: true },
  average_case_size: { bold: true, band: true },
};

/** The section bands (UI-004): *Activation* above *3M new agent %*, *Productivity* above *Case submission* — kept. */
export const SECTION_BEFORE: Partial<Record<RowKey, string>> = STATS.sections;

/** The rows whose *YTD {Y−1}* and *YTD {Y}* pair a red outline frames (UI-006, AC-8). */
export const OUTLINED_ROWS: readonly RowKey[] = ['ape', 'producing_agents', 'case_submission'];

/**
 * **A numbered footnote, in our metric's words** (P18.9-T1 AC-12; ADR-0175 §5): the rows it is marked on, and what it
 * says — true of the figure beside it, where the slide's words describe metrics nobody computes. **There is no *Net APE*
 * footnote, ever** (P19.3-T1; ADR-0201 §1, OD-231 answered by D5: *"APE is APE"*): the slide's footnote 1 is not drawn,
 * and no footnote says *new business only*.
 */
export interface Footnote {
  rows: readonly RowKey[];
  text: string;
}

/**
 * Which rows each footnote is marked on, **by the definitions the scorecard was computed with** (P19.3-T1; ADR-0202 §4),
 * in the catalogue's order: the data sources' six (`forumStatsMessages.footnotes`) — *FLC*, the three of before, and
 * *Cases/producing agents* per active agent per month — or a scorecard kept before them, its four
 * (`footnotesReferenceSlide`), so a footnote never describes a figure it is not.
 */
const FOOTNOTE_ROWS: Record<keyof typeof STATS.footnotes, readonly RowKey[]> = {
  flc: ['flc'],
  producing_agents: ['producing_agents'],
  new_agent_3m: ['new_agent_3m'],
  avg_monthly_aa: ['avg_monthly_aa'],
  case_submission: ['case_submission', 'average_case_size'],
  cases_per_producing_agent: ['cases_per_producing_agent'],
};
const FOOTNOTE_ROWS_REFERENCE_SLIDE: Record<keyof typeof STATS.footnotesReferenceSlide, readonly RowKey[]> = {
  producing_agents: ['producing_agents'],
  new_agent_3m: ['new_agent_3m'],
  avg_monthly_aa: ['avg_monthly_aa'],
  case_submission: ['case_submission', 'average_case_size'],
};

/**
 * **The footnotes the table draws, in a language, for the definitions its rows follow** (P18.10-T4; P19.3-T1): "the
 * monthly production file" says what *the office's file* does, in none of the six words. `data_sources` unless told.
 */
export function footnotesIn(
  words: Language = SOURCE_LANGUAGE, definitions: ScorecardDefinitions = 'data_sources',
): readonly Footnote[] {
  const own = messagesIn(forumStatsMessages, words);
  if (definitions === 'reference_slide') {
    return (Object.keys(FOOTNOTE_ROWS_REFERENCE_SLIDE) as (keyof typeof FOOTNOTE_ROWS_REFERENCE_SLIDE)[])
      .map((key) => ({ rows: FOOTNOTE_ROWS_REFERENCE_SLIDE[key], text: own.footnotesReferenceSlide[key] }));
  }
  return (Object.keys(FOOTNOTE_ROWS) as (keyof typeof FOOTNOTE_ROWS)[]).map((key) => ({ rows: FOOTNOTE_ROWS[key], text: own.footnotes[key] }));
}

/** The data sources' six, English: the source. */
export const FOOTNOTES: readonly Footnote[] = footnotesIn(SOURCE_LANGUAGE);

/**
 * **The footnotes numbered without a gap, in the order the rows reach them** (AC-12): each row's mark, and the list.
 * A note on no row drawn is not drawn.
 */
export function numberedFootnotes(
  rows: readonly RowKey[], notes: readonly Footnote[] = FOOTNOTES,
): { marks: Partial<Record<RowKey, number>>; list: { n: number; text: string }[] } {
  const marks: Partial<Record<RowKey, number>> = {};
  const list: { n: number; text: string }[] = [];
  const numbered = new Map<Footnote, number>();
  for (const row of rows) {
    const note = notes.find((f) => f.rows.includes(row));
    if (!note) continue;
    if (!numbered.has(note)) {
      numbered.set(note, list.length + 1);
      list.push({ n: list.length + 1, text: note.text });
    }
    marks[row] = numbered.get(note);
  }
  return { marks, list };
}

/** `Agu–Des 2025`, `Des 2025–Jan 2026`, `Agu 2025`: a run of months, as the client's *(\*)* note writes it. */
function monthRun(from: string, to: string, language: Language): string {
  if (from === to) return formatMonth(from, language);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${formatMonthName(from, language)}–${formatMonth(to, language)}`;
  return `${formatMonth(from, language)}–${formatMonth(to, language)}`;
}

/** Every month from one to another, `YYYY-MM`. */
function monthsOf({ from, to }: ColumnPeriod): string[] {
  const out: string[] = [];
  for (let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))]; `${y}-${String(m).padStart(2, '0')}` <= to;) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return out;
}

/**
 * **One *(\*)* note per partial period, in the client's words** (AC-12; ADR-0175 §5): *"(\*) Full Year 2025 covers
 * Agu–Des 2025 only; earlier months not uploaded"* — its months held being the period's months its figures leave none
 * of out. Later months not uploaded read so; a gap in between is named. The months in the figures' `language`, the
 * words in the reader's (`words`, P18.10-T4).
 */
export function partialNotes(
  scorecard: Pick<Scorecard, 'periods' | 'partialPeriods'>,
  language: Language = DEFAULT_LANGUAGE,
  words: Language = SOURCE_LANGUAGE,
): string[] {
  const partial = messagesIn(forumStatsMessages, words).partial;
  return scorecard.partialPeriods.map(({ column, leavesOut }) => {
    const { name } = columnHeader(column, scorecard.periods, language);
    const covered = monthsOf(scorecard.periods[column]).filter((m) => !leavesOut.includes(m));
    if (covered.length === 0) return partial.noFigures({ column: name });
    const [first, last] = [covered[0], covered[covered.length - 1]];
    const months = monthRun(first, last, language);
    if (leavesOut.every((m) => m < first)) return partial.earlier({ column: name, months });
    if (leavesOut.every((m) => m > last)) return partial.later({ column: name, months });
    return partial.gap({ column: name, months, without: listed(leavesOut.map((m) => formatMonth(m, language)), words) });
  });
}

/**
 * **One decimal** (ADR-0174 §5, UI-012): *5,8*, *17,6*, *0,1* — *5.8*, *17.6*, *0.1* in English (P18.10-T3) — the *two
 * below 1* rule gone, and **a figure that is not zero and rounds to *0,0* reads *< 0,1*** (*< 0.1*), so a small sum is
 * never shown as none. The threshold is the figure's own tenth, written by the same formatter.
 */
export function oneDecimal(value: number, language: Language = DEFAULT_LANGUAGE): string {
  if (value > 0 && value < 0.05) return `< ${formatNumber(0.1, { decimals: 1 }, language)}`;
  return formatNumber(value, { decimals: 1 }, language);
}

/**
 * Sen to the row's unit: *miliar* for *APE*, *juta* for *Avg. Case Size*, as their headers say (`rowName`) — the compact
 * units' own sizes (`RUPIAH_PER_UNIT`, `lib/format.ts`), never a second copy (invariant §7).
 */
const inRowUnit = (row: Pick<ScorecardRow, 'key'>, minor: number) =>
  minor / MINOR_UNITS_PER_MAJOR / RUPIAH_PER_UNIT[ROW_MONEY_UNIT[row.key] ?? 'M'];

/**
 * A figure as the table writes it — **for display only**; the served value is exact (P18.9-T1 AC-15). Money from
 * minor units, through the one conversion (`MINOR_UNITS_PER_MAJOR`), in its header's unit to one decimal; a
 * percentage whole (ADR-0174 §1); *Cases/producing agents* to a tenth; counts and the averages whole, half up, a
 * thousand with a dot.
 */
export function formatFigure(
  row: Pick<ScorecardRow, 'key' | 'unit'>, value: number, language: Language = DEFAULT_LANGUAGE,
): string {
  if (row.unit === 'idr_minor') return oneDecimal(inRowUnit(row, value), language);
  if (row.unit === 'percentage') return formatPercent(value, {}, language);
  if (row.unit === 'ratio') return oneDecimal(value, language);
  return formatNumber(Math.round(value), {}, language);
}

/** A cell's words: the figure, *pending data*, *—* over nothing or for what a kept scorecard lacks, nothing when not tracked. */
export function cellText(
  row: Pick<ScorecardRow, 'key' | 'unit'>,
  cell: ScorecardCell,
  language: Language = DEFAULT_LANGUAGE,
  words: Language = SOURCE_LANGUAGE,
): string {
  if (cell.kind === 'figure') return formatFigure(row, cell.value, language);
  if (cell.kind === 'pending') return messagesIn(forumStatsMessages, words).pending;
  if (cell.kind === 'none' || cell.kind === 'unrecorded' || cell.kind === 'not_uploaded') return NONE;
  return '';
}

/** A figure over part of its period: marked *\** (AC-12), its note under the table. */
export const isPartial = (cell: ScorecardCell) => cell.kind === 'figure' && cell.leavesOut.length > 0;

/** *—*'s words for a screen reader: why there is no figure. */
export function noneWords(row: Pick<ScorecardRow, 'key'>, cell: ScorecardCell, words: Language = SOURCE_LANGUAGE): string {
  const own = messagesIn(forumStatsMessages, words);
  if (cell.kind === 'unrecorded') return own.unrecorded;
  // P19.3-T1 (ADR-0203 §8): last year's column with no month of it uploaded.
  if (cell.kind === 'not_uploaded') return own.notUploaded;
  return (own.none as Partial<Record<RowKey, string>>)[row.key] ?? own.unrecorded;
}

/**
 * A phone's card's change (AC-17), as the server computed it: *+18%*, *-9%*, *0%* — a percentage of last year's — or,
 * on a row whose own figure is a percentage, **the difference in percentage points** (P18.9-T8 F1, parity F-256):
 * *+15 points*, *-40 points*, *+1 point* — *+15 poin* in Indonesian (§B.7) — whole, as the app writes points
 * (`formatRatioValue`). *—* where there is none. The figure in `language`, the word in `words` (P18.10-T4).
 */
export function changeText(change: YtdChange, language: Language = DEFAULT_LANGUAGE, words: Language = SOURCE_LANGUAGE): string {
  if (change.kind === 'none') return NONE;
  if (change.unit === 'points') {
    const points = Math.round(Math.abs(change.value));
    const sign = change.value > 0 ? '+' : change.value < 0 ? '-' : '';
    return messagesIn(forumStatsMessages, words).points({ sign, figure: formatNumber(points, {}, language), points });
  }
  return `${change.value > 0 ? '+' : ''}${formatPercent(change.value, {}, language)}`;
}

/** The title above the table (AC-13): *"BSD City Branch: Okt 2026"*, the meeting's month — the branch's name, as typed. */
export const statsTitle = (branch: string, meetingDate: string, language: Language = DEFAULT_LANGUAGE) =>
  `${branch}: ${formatMonth(meetingDate.slice(0, 7), language)}`;

/** *"AS OF 26 Okt 2026"*; *"AS OF —"* on a scorecard kept before it; nothing with no file yet (AC-13, AC-19). */
export function asOfText(asOf: Scorecard['asOf'], language: Language = DEFAULT_LANGUAGE): string | null {
  if (asOf.kind === 'none') return null;
  return `${STATS.asOf} ${asOf.kind === 'date' ? formatCalendarDay(asOf.date, language) : NONE}`;
}

/*
 * ── A *Monthly Target*, as a rate per unit (P18.9-T1 AC-10, ADR-0175 §4) ──────────────────────────
 */

/**
 * **The places a count's rate is typed to, and its value shown to** — the backend's
 * `LEADER_MEETING_TARGET_RATE_DECIMALS` (`domain/constants/leader-forum.ts`, `metrics-and-definitions.md` §B.21), which
 * refuses a rate with more (`400 VALIDATION_FAILED`) and rounds a value to as many. Not served: `leader-meeting-tabs.spec.ts`
 * reads the backend's value, so the two cannot drift (invariant §7).
 */
export const LEADER_MEETING_TARGET_RATE_DECIMALS = 2;
const TARGET_RATE_SCALE = 10 ** LEADER_MEETING_TARGET_RATE_DECIMALS;

/**
 * A rate as typed into its field: *APE*'s in *miliar*, the reader's decimal mark — a comma, a point in English — and no
 * thousands mark, so `parseDecimal` reads it back in either language (P18.10-T3 AC-3).
 */
export function rateText(row: Pick<ScorecardRow, 'key'>, rate: number, language: Language = DEFAULT_LANGUAGE): string {
  const inUnit = row.key === 'ape' ? inRowUnit(row, rate) : rate;
  return formatDecimalInput(Number(inUnit.toFixed(6)), language);
}

/** *"9 (1 @ unit)"* (UI-008): the server's value in the row's unit, then the rate typed; *TBD* on *APE* with none, else blank. */
export function targetText(
  row: Pick<ScorecardRow, 'key' | 'unit'>, target: MonthlyTarget, language: Language = DEFAULT_LANGUAGE,
): string {
  if (target.rate !== null && target.value !== null) {
    const places = { maxDecimals: LEADER_MEETING_TARGET_RATE_DECIMALS };
    const value = row.key === 'ape' ? oneDecimal(inRowUnit(row, target.value), language) : formatNumber(target.value, places, language);
    const rate = row.key === 'ape'
      ? formatNumber(inRowUnit(row, target.rate), { maxDecimals: 3 }, language)
      : formatNumber(target.rate, places, language);
    return `${value} (${rate} @ ${kept('unit')})`;
  }
  if (target.typed) return target.typed;
  return row.key === 'ape' ? STATS.tbd : '';
}

/** What a field's text is, before it is edited: the rate typed, else the text a target was typed as, else nothing. */
export const targetDraftText = (row: Pick<ScorecardRow, 'key'>, target: MonthlyTarget, language: Language = DEFAULT_LANGUAGE) =>
  (target.rate !== null ? rateText(row, target.rate, language) : target.typed ?? '');

/**
 * **What an editor typed, as the rate the server takes** — a comma or a point (`parseDecimal`), from 0 — *APE*'s
 * *miliar* to whole rupiah in sen (invariant §9), a count's to two places; nothing typed clears it (`null`). Anything
 * else is no rate: the field says so and nothing is sent.
 */
export function rateFromTyped(row: TargetRowKey, typed: string): { rate: number | null } | { invalid: true } {
  const text = typed.trim();
  if (text === '') return { rate: null };
  const n = parseDecimal(text);
  if (!Number.isFinite(n) || n < 0) return { invalid: true };
  if (row === 'ape') return { rate: Math.round(n * RUPIAH_PER_UNIT.M) * MINOR_UNITS_PER_MAJOR };
  return { rate: Math.round(n * TARGET_RATE_SCALE) / TARGET_RATE_SCALE };
}

/** The half a rate's hint offers as its example, written as the field takes it: *0,5*, *0.5* in English. */
export const rateExample = (language: Language = DEFAULT_LANGUAGE) => formatDecimalInput(0.5, language);
