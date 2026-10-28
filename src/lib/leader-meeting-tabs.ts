'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiRequestError } from './api-client';
import { formatCalendarDay, formatMonth, formatMonthName, formatNumber, formatPercent, parseDecimal, RUPIAH_PER_UNIT } from './format';
import { MINOR_UNITS_PER_MAJOR } from './goals';
import { formatRatioValue } from './ratio-format';
import type {
  ActionItem, ActionStatus, AgendaItem, AgendaSection, ColumnKey, ColumnPeriod, MeetingView, MeetingWriter, MonthlyTarget,
  RowKey, Scorecard, ScorecardCell, ScorecardRow, TargetRowKey, YtdChange,
} from './leader-meetings';

/**
 * **A meeting's three tabs and its print** (`functional/leader-forum.md`, *Overview & Stats*, *Agenda*, *Action
 * Items*, *Saving*, *Printing*): their words, how a figure is written, and how a field's write is sent.
 *
 * The figures are the server's, exact (OD-144, ADR-0129); this file only rounds them for display, as the spec
 * says each row is drawn. Nothing here decides a figure, who may edit or a bound (`limits`) — the places a target's
 * rate is typed to are the backend's, held here as a copy its spec pins (`LEADER_MEETING_TARGET_RATE_DECIMALS`).
 */

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 */

/**
 * The prototype's, verbatim (`KPM_Owner.html:2458-2475`, `:2653-2695`, `:2780-2843`, `:2865-2901`) — and, since
 * P18.97-T1, **the client's reference slide's** for *Overview & Stats* (ADR-0175; UI-001 to UI-012): the columns' names,
 * the two groups, the rows' names in its order, *TBD*. The slide's labels win over the prototype's (ADR-0062 §1).
 */
export const TABS_COPY = {
  chips: [
    { key: 'manpower', label: 'Manpower' },
    { key: 'agents', label: '# of agents' },
    { key: 'units', label: '# of units' },
    { key: 'ab', label: '# of AB' },
    { key: 'aab', label: '# of AAB' },
  ] as const satisfies readonly { key: keyof Scorecard['chips']; label: string }[],
  metrics: 'Metrics',
  monthlyTarget: 'Monthly Target',
  /** The slide's two spanning labels (UI-003). */
  groups: { year: 'Full Year & YTD View', month: 'Monthly View' },
  columns: {
    fy: 'Full Year', ytd: 'YTD', thisMonthLastYear: 'This Month, Last Year', lastMonth: 'Last Month', thisMonth: 'This Month',
  },
  /**
   * The slide's rows, in its order (UI-004): *APE (Rp M)* and *Avg. Case Size (Rp jt)* in ADR-0174's units, *Annual
   * Active Agents* for *Producing agents*, *Cases/producing agents* new. The row stays *APE*, not the slide's *Net APE*,
   * until OD-231 is answered.
   */
  rows: {
    ape: 'APE (Rp M)',
    manpower: 'Manpower',
    flc: 'FLC (avg. monthly)',
    producing_agents: 'Annual Active Agents',
    new_agent_3m: '3M new agent %',
    avg_monthly_aa: 'Avg. monthly AA',
    case_submission: 'Case submission',
    cases_per_producing_agent: 'Cases/producing agents',
    average_case_size: 'Avg. Case Size (Rp jt)',
  } satisfies Record<RowKey, string>,
  pending: 'pending data',
  none: '—',
  /** *APE*'s *Monthly Target* with no rate, as the slide draws it; every other row is blank (UI-008). */
  tbd: 'TBD',
  sections: { preparation: 'Preparation', during: 'During', post: 'Post' } satisfies Record<AgendaSection, string>,
  pic: 'PIC:',
  addItem: '+ Add item',
  tracker: 'Action items tracker',
  dragHint: 'Drag ⠿ to reorder',
  headers: {
    initiative: 'Key initiative',
    metric: 'Success metric',
    action: 'Action item',
    pic: 'PIC',
    status: 'Status',
    remarks: 'Remarks / Target',
  },
  addAction: '+ Add action item',
  statuses: {
    not_planned: 'Not yet planned',
    planned: 'Planned',
    implemented: 'Implemented',
  } satisfies Record<ActionStatus, string>,
  statusUpdated: 'Status updated',
  rowRemoved: 'Row removed',
  reordered: 'Reordered',
} as const;

/** `a`, `a and b`, `a, b and c`. */
export function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The module's own (*The module's own strings*, D-copy): none uses the six words, a phase, an id or a
 * permission code. `leader-meeting-tabs.spec.ts` scans them.
 */
export const TABS_OWN_COPY = {
  /** A cell the table does not track, for screen readers (I-255, I-484). */
  notTracked: 'Not tracked',
  /** *—* on a scorecard kept before the column or the row existed (I-495). */
  unrecorded: 'Not recorded for this meeting.',
  /** *—*, a ratio over nothing — each row's own reason. */
  none: {
    average_case_size: 'No policies in this period.',
    cases_per_producing_agent: 'No annual active agents in this period.',
  } satisfies Partial<Record<RowKey, string>>,
  /** A figure over part of its period: its mark, for a screen reader (I-488). */
  partialMark: 'covers part of its period; see the notes below',
  /** The title above the table (UI-010): the branch's name and the meeting's month. */
  title: (branch: string, month: string) => `${branch}: ${month}`,
  /** *AS OF* (UI-010), the slide's capitals; *—* on a scorecard kept before it existed. */
  asOf: 'AS OF',
  asOfUnrecorded: 'AS OF: not recorded for this meeting',
  /** A phone's card (UI-014, I-493). */
  change: 'Change',
  statusName: (status: string, next: string) => `${status}. Change to ${next}`,
  handleName: (n: number, initiative: string) => `Move row ${n}, ${initiative}. Use the arrow keys.`,
  removeName: (n: number) => `Remove row ${n}`,
  cellName: (column: string, n: number) => `${column}, row ${n}`,
  agendaText: (section: string, n: number) => `${section} item ${n}`,
  agendaPic: (section: string, n: number) => `PIC for ${section} item ${n}`,
  /** An agenda item's empty PIC, to an editor (P18.97-T2 AC-5, UI-015): a prompt in the field, which saves nothing. */
  addPic: 'Add a PIC',
  /** A *Monthly Target* input's name: the column, its rate, then the row, as a tracker cell's is (I-487). */
  targetName: (row: string) => `Monthly Target per unit, ${row}`,
  /** A rate the field cannot read (P18.97-T1 AC-10): the field says so, and nothing is sent. */
  notARate: 'Type a number from 0, like 1 or 0,5.',
  /** A ticked *During* item read-only: the strike-through said to a screen reader. */
  done: 'Done',
  /**
   * The access note (F-188): who may edit **now**, the Owner first, then each Admin, then the tag. *"shown
   * above"* dropped, because a past meeting's chips are its frozen record.
   */
  accessNote: (names: readonly string[]) => `🔒 Only ${listed([...names, 'tagged core leaders'])} can edit this tracker.`,
} as const;

export const accessNoteText = (note: MeetingView['accessNote']) =>
  TABS_OWN_COPY.accessNote([...(note.ownerName ? [note.ownerName] : []), ...note.adminNames]);

/*
 * ── The scorecard ───────────────────────────────────────────────────────────────────────────────
 */

/** `'26` for 2026: the slide's year in a period. */
const shortYear = (month: string) => month.slice(2, 4);

/**
 * **A column's two-line header** (P18.97-T1 AC-2, UI-002): its name — *Full Year 2025*, *YTD 2026*, *This Month* — and
 * its period from the meeting's month, in the app's month abbreviations (ADR-0174 §6): *(Jan-Des '25)*, *(Jan-Okt '26)*,
 * *(Jan '26)* for a January's *YTD*, *(Okt-25)* for a single month, as the slide writes them.
 */
export function columnHeader(column: ColumnKey, periods: Scorecard['periods']): { name: string; period: string } {
  const { from, to } = periods[column];
  const year = from.slice(0, 4);
  const span = (p: ColumnPeriod) => (p.from === p.to
    ? `(${formatMonthName(p.from)} '${shortYear(p.from)})`
    : `(${formatMonthName(p.from)}-${formatMonthName(p.to)} '${shortYear(p.to)})`);
  if (column === 'fy') return { name: `${TABS_COPY.columns.fy} ${year}`, period: span(periods[column]) };
  if (column === 'ytd' || column === 'ytdLastYear') return { name: `${TABS_COPY.columns.ytd} ${year}`, period: span(periods[column]) };
  return { name: TABS_COPY.columns[column], period: `(${formatMonthName(to)}-${shortYear(to)})` };
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

/** The section bands (UI-004): *Activation* above *3M new agent %*, *Productivity* above *Case submission*. */
export const SECTION_BEFORE: Partial<Record<RowKey, string>> = {
  new_agent_3m: 'Activation',
  case_submission: 'Productivity',
};

/** The rows whose *YTD {Y−1}* and *YTD {Y}* pair a red outline frames (UI-006, AC-8). */
export const OUTLINED_ROWS: readonly RowKey[] = ['ape', 'producing_agents', 'case_submission'];

/**
 * **A numbered footnote, in our metric's words** (P18.97-T1 AC-12; ADR-0175 §5): the rows it is marked on, and what it
 * says — true of the figure beside it, where the slide's words describe metrics nobody computes. The slide's footnote 1,
 * *Net APE*, and its *new business only* wait with OD-231 (`NET_APE_FOOTNOTE`).
 */
export interface Footnote {
  rows: readonly RowKey[];
  text: string;
}

/**
 * The slide's footnote 1 — *"Net APE includes Saver, SPI, Top Up, and PRUWorks"* — **not drawn until the client answers
 * OD-231**: the file's APE is not known to be net. `null` here, so the numbering below starts at *Annual Active
 * Agents*; the day OD-231 is answered it is a `Footnote` on `ape`, and every number after it moves up one.
 */
export const NET_APE_FOOTNOTE: Footnote | null = null;

/** The four the table draws. "The monthly production file" says what *the office's file* does, in none of the six words. */
export const FOOTNOTES: readonly Footnote[] = [
  ...(NET_APE_FOOTNOTE ? [NET_APE_FOOTNOTE] : []),
  {
    rows: ['producing_agents'],
    text: 'Annual Active Agents — members with APE or a policy in the monthly production file in at least one month of the period.',
  },
  {
    rows: ['new_agent_3m'],
    text: '3M new agent % — of the new hires who joined in the period and whose 90 days are over, the share with a first paid and issued case by day 90 of their join date.',
  },
  { rows: ['avg_monthly_aa'], text: 'AA — Active Agent, a member whose month shows APE or a policy in the monthly production file.' },
  {
    rows: ['case_submission', 'average_case_size'],
    text: 'Case submission and Avg. Case Size — the policies in the monthly production file, and its APE over them.',
  },
];

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
function monthRun(from: string, to: string): string {
  if (from === to) return formatMonth(from);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${formatMonthName(from)}–${formatMonth(to)}`;
  return `${formatMonth(from)}–${formatMonth(to)}`;
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
 * of out. Later months not uploaded read so; a gap in between is named.
 */
export function partialNotes(scorecard: Pick<Scorecard, 'periods' | 'partialPeriods'>): string[] {
  return scorecard.partialPeriods.map(({ column, leavesOut }) => {
    const { name } = columnHeader(column, scorecard.periods);
    const covered = monthsOf(scorecard.periods[column]).filter((m) => !leavesOut.includes(m));
    if (covered.length === 0) return `(*) ${name}: no figures uploaded for it yet`;
    const [first, last] = [covered[0], covered[covered.length - 1]];
    if (leavesOut.every((m) => m < first)) return `(*) ${name} covers ${monthRun(first, last)} only; earlier months not uploaded`;
    if (leavesOut.every((m) => m > last)) return `(*) ${name} covers ${monthRun(first, last)} only; later months not uploaded`;
    return `(*) ${name} covers ${monthRun(first, last)} without ${listed(leavesOut.map(formatMonth))}, not uploaded`;
  });
}

/**
 * IDR in a *miliar* for *APE (Rp M)*, in a *juta* for *Avg. Case Size (Rp jt)*, as the labels say (ADR-0174 §5) — the
 * compact units' own sizes (`RUPIAH_PER_UNIT`, `lib/format.ts`), never a second copy (invariant §7).
 */
const MONEY_SCALE: Partial<Record<RowKey, number>> = { ape: RUPIAH_PER_UNIT.M, average_case_size: RUPIAH_PER_UNIT.jt };

/**
 * **One decimal, a comma** (ADR-0174 §5, UI-012): *5,8*, *17,6*, *0,1* — the *two below 1* rule gone — and **a figure
 * that is not zero and rounds to *0,0* reads *< 0,1***, so a small sum is never shown as none.
 */
export function oneDecimal(value: number): string {
  if (value > 0 && value < 0.05) return '< 0,1';
  return formatNumber(value, { decimals: 1 });
}

/** Sen to the row's unit: *miliar* for *APE*, *juta* for *Avg. Case Size*. */
const inRowUnit = (row: Pick<ScorecardRow, 'key'>, minor: number) => minor / MINOR_UNITS_PER_MAJOR / (MONEY_SCALE[row.key] ?? RUPIAH_PER_UNIT.M);

/**
 * A figure as the table writes it — **for display only**; the served value is exact (P18.97-T1 AC-15). Money from
 * minor units, through the one conversion (`MINOR_UNITS_PER_MAJOR`), in its header's unit to one decimal; a
 * percentage whole (ADR-0174 §1); *Cases/producing agents* to a tenth; counts and the averages whole, half up, a
 * thousand with a dot.
 */
export function formatFigure(row: Pick<ScorecardRow, 'key' | 'unit'>, value: number): string {
  if (row.unit === 'idr_minor') return oneDecimal(inRowUnit(row, value));
  if (row.unit === 'percentage') return formatPercent(value);
  if (row.unit === 'ratio') return oneDecimal(value);
  return formatNumber(Math.round(value));
}

/** A cell's words: the figure, *pending data*, *—* over nothing or for what a kept scorecard lacks, nothing when not tracked. */
export function cellText(row: Pick<ScorecardRow, 'key' | 'unit'>, cell: ScorecardCell): string {
  if (cell.kind === 'figure') return formatFigure(row, cell.value);
  if (cell.kind === 'pending') return TABS_COPY.pending;
  if (cell.kind === 'none' || cell.kind === 'unrecorded') return TABS_COPY.none;
  return '';
}

/** A figure over part of its period: marked *\** (AC-12), its note under the table. */
export const isPartial = (cell: ScorecardCell) => cell.kind === 'figure' && cell.leavesOut.length > 0;

/** *—*'s words for a screen reader: why there is no figure. */
export function noneWords(row: Pick<ScorecardRow, 'key'>, cell: ScorecardCell): string {
  if (cell.kind === 'unrecorded') return TABS_OWN_COPY.unrecorded;
  return (TABS_OWN_COPY.none as Partial<Record<RowKey, string>>)[row.key] ?? TABS_OWN_COPY.unrecorded;
}

/**
 * A phone's card's change (AC-17), as the server computed it: *+18%*, *-9%*, *0%* — a percentage of last year's — or,
 * on a row whose own figure is a percentage, **the difference in percentage points** (P18.97-T8 F1, parity F-256):
 * *+15 points*, *-40 points*, *+1 point*, in the app's one way of writing points (`formatRatioValue`). *—* where there
 * is none.
 */
export function changeText(change: YtdChange): string {
  if (change.kind === 'none') return TABS_COPY.none;
  if (change.unit === 'points') {
    return `${change.value > 0 ? '+' : change.value < 0 ? '-' : ''}${formatRatioValue(Math.abs(change.value), 'points')}`;
  }
  return `${change.value > 0 ? '+' : ''}${formatPercent(change.value)}`;
}

/** The title above the table (AC-13): *"BSD City Branch: Okt 2026"*, the meeting's month. */
export const statsTitle = (branch: string, meetingDate: string) => TABS_OWN_COPY.title(branch, formatMonth(meetingDate.slice(0, 7)));

/** *"AS OF 26 Okt 2026"*; *"AS OF —"* on a scorecard kept before it; nothing with no file yet (AC-13, AC-19). */
export function asOfText(asOf: Scorecard['asOf']): string | null {
  if (asOf.kind === 'none') return null;
  return `${TABS_OWN_COPY.asOf} ${asOf.kind === 'date' ? formatCalendarDay(asOf.date) : TABS_COPY.none}`;
}

/*
 * ── A *Monthly Target*, as a rate per unit (P18.97-T1 AC-10, ADR-0175 §4) ──────────────────────────
 */

/**
 * **The places a count's rate is typed to, and its value shown to** — the backend's
 * `LEADER_MEETING_TARGET_RATE_DECIMALS` (`domain/constants/leader-forum.ts`, `metrics-and-definitions.md` §B.21), which
 * refuses a rate with more (`400 VALIDATION_FAILED`) and rounds a value to as many. Not served: `leader-meeting-tabs.spec.ts`
 * reads the backend's value, so the two cannot drift (invariant §7).
 */
export const LEADER_MEETING_TARGET_RATE_DECIMALS = 2;
const TARGET_RATE_SCALE = 10 ** LEADER_MEETING_TARGET_RATE_DECIMALS;

/** A rate as typed into its field: *APE*'s in *miliar*, a decimal comma, no thousands dot — so `parseDecimal` reads it back. */
export function rateText(row: Pick<ScorecardRow, 'key'>, rate: number): string {
  const inUnit = row.key === 'ape' ? inRowUnit(row, rate) : rate;
  return String(Number(inUnit.toFixed(6))).replace('.', ',');
}

/** *"9 (1 @ unit)"* (UI-008): the server's value in the row's unit, then the rate typed; *TBD* on *APE* with none, else blank. */
export function targetText(row: Pick<ScorecardRow, 'key' | 'unit'>, target: MonthlyTarget): string {
  if (target.rate !== null && target.value !== null) {
    const places = { maxDecimals: LEADER_MEETING_TARGET_RATE_DECIMALS };
    const value = row.key === 'ape' ? oneDecimal(inRowUnit(row, target.value)) : formatNumber(target.value, places);
    const rate = row.key === 'ape' ? formatNumber(inRowUnit(row, target.rate), { maxDecimals: 3 }) : formatNumber(target.rate, places);
    return `${value} (${rate} @ unit)`;
  }
  if (target.typed) return target.typed;
  return row.key === 'ape' ? TABS_COPY.tbd : '';
}

/** What a field's text is, before it is edited: the rate typed, else the text a target was typed as, else nothing. */
export const targetDraftText = (row: Pick<ScorecardRow, 'key'>, target: MonthlyTarget) =>
  (target.rate !== null ? rateText(row, target.rate) : target.typed ?? '');

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

/*
 * ── The tracker ─────────────────────────────────────────────────────────────────────────────────
 */

/** One step round, as drawn (`:2573`, `:2865`): *Implemented* goes back to *Not yet planned*. */
const STATUS_ORDER: readonly ActionStatus[] = ['not_planned', 'planned', 'implemented'];
export const nextStatus = (status: ActionStatus): ActionStatus =>
  STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];

/**
 * The pills (`:564-568`): red, amber, green, each on its own tint. *Planned* is navy on the amber tint, not the
 * prototype's amber-dark, which clears no contrast floor as text (`tokens.md`; the `watch` pill, I-116).
 */
export const STATUS_TONE: Record<ActionStatus, string> = {
  not_planned: 'bg-alert/10 text-alert',
  planned: 'bg-amber/15 text-navy',
  implemented: 'bg-success/10 text-success',
};

/** The tracker's typed columns, in order, with the bound each takes. */
export const TRACKER_COLUMNS = ['initiative', 'metric', 'action', 'pic', 'remarks'] as const;
export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];

/** As the prototype drops a row (`:2894-2898`): out of `from`, into `to`'s place. */
export function moveTo<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/*
 * ── What a landed write says ────────────────────────────────────────────────────────────────────
 *
 * Each returns the meeting with the server's answer in it. A write in the agenda, the tracker or a target is
 * the meeting's minutes, so it is no longer one nobody has written in (`writtenAt`): *Delete meeting* is
 * withdrawn (`can.delete`, which the server would now refuse `409 LEADER_MEETING_HAS_MINUTES`). The open items
 * are the rows not *Implemented* (`:2586`).
 */

const written = (meeting: MeetingView): MeetingView => ({ ...meeting, writtenIn: true, can: { ...meeting.can, delete: false } });

export function withAgendaItem(meeting: MeetingView, section: AgendaSection, itemId: string, saved: AgendaItem | null): MeetingView {
  const items = meeting.agenda[section];
  const next = saved === null
    ? items.filter((it) => it.id !== itemId)
    : items.some((it) => it.id === itemId)
      ? items.map((it) => (it.id === itemId ? saved : it))
      : [...items, saved];
  return { ...written(meeting), agenda: { ...meeting.agenda, [section]: next } };
}

export function withActionItems(meeting: MeetingView, actionItems: ActionItem[]): MeetingView {
  return {
    ...written(meeting),
    actionItems,
    openItems: actionItems.filter((a) => a.status !== 'implemented').length,
  };
}

export const withActionItem = (meeting: MeetingView, saved: ActionItem) =>
  withActionItems(
    meeting,
    meeting.actionItems.some((a) => a.id === saved.id)
      ? meeting.actionItems.map((a) => (a.id === saved.id ? saved : a))
      : [...meeting.actionItems, saved],
  );

export function withTarget(meeting: MeetingView, row: TargetRowKey, target: MonthlyTarget): MeetingView {
  return {
    ...written(meeting),
    scorecard: {
      ...meeting.scorecard,
      rows: meeting.scorecard.rows.map((r) => (r.key === row ? { ...r, monthlyTarget: target } : r)),
    },
  };
}

/*
 * ── Sending a write ─────────────────────────────────────────────────────────────────────────────
 */

/** How a write ended: landed with the server's answer, refused because the item changed since, or failed. */
export type Outcome<T> = { kind: 'landed'; answer: T } | { kind: 'conflict' } | { kind: 'failed' };

/**
 * One write through the page's writer (which announces it, and reads the meeting again on a conflict), told
 * apart by how it ended: a field shows the saved value once its write lands, what the other person saved after a
 * conflict, and **what was typed** after any other failure (*"It's still here — try again"*).
 */
export async function runWrite<T>(
  writer: Pick<MeetingWriter, 'run'>,
  write: () => Promise<T>,
  options?: { done?: string },
): Promise<Outcome<T>> {
  let conflict = false;
  const answer = await writer.run(async () => {
    try {
      return await write();
    } catch (err) {
      conflict = err instanceof ApiRequestError && err.status === 409 && err.error.code === 'VERSION_CONFLICT';
      throw err;
    }
  }, options);
  if (answer !== undefined) return { kind: 'landed', answer };
  return conflict ? { kind: 'conflict' } : { kind: 'failed' };
}

/**
 * **Writes to one item go one after another**, each chained to the version the reader's own last write left.
 *
 * The server answers `409 VERSION_CONFLICT` when *that item* changed since the version a write sends. A write
 * sends **the version its field was read at** — captured when the field was focused, or the control pressed —
 * or, when one of the reader's own writes to the item has landed since, the version that write answered. Never
 * the version the page holds when the write goes: the page may have been read again under a field being typed
 * in, and sending the newer version would overwrite somebody else's change the reader never saw.
 *
 * Two cells of one row changed in quick succession — a PIC, then its remarks — would otherwise both send the
 * version read, and the second would conflict with the reader's own first. So the second waits for the first.
 */
export class ItemWrites {
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly left = new Map<string, number>();

  run<T>(
    key: string,
    /** The item's version when the field was focused, or the control pressed. */
    read: number,
    write: (version: number) => Promise<T>,
    /** The version the answer leaves the item at, when it says. */
    answered: (answer: T) => number | undefined = () => undefined,
  ): Promise<T> {
    const go = async () => {
      const answer = await write(Math.max(read, this.left.get(key) ?? 0));
      const version = answered(answer);
      if (version !== undefined) this.left.set(key, Math.max(version, this.left.get(key) ?? 0));
      return answer;
    };
    const tail = this.tails.get(key);
    const result = tail ? tail.then(go) : go();
    this.tails.set(key, result.catch(() => undefined));
    return result;
  }
}

/**
 * **A typed field's text between the saved value and the server** (*Saving*, L-110). Its text is its own,
 * whatever else is written to the same item.
 *
 * - While focused it shows what is being typed. Focusing captures the item's version: the field's writes
 *   send it (`ItemWrites`).
 * - On leaving, `leave()` says what to write, or `null` — when the trimmed text is what is saved, or what the
 *   field's own write still out is about to save: a blur that changes nothing writes nothing and says nothing.
 * - **The field keeps what was typed until its own write settles** — not until the item's version moves, which
 *   another field's write to the same row also does. `settle()` then shows the saved value once it landed,
 *   what the other person saved after a conflict, and keeps what was typed after any other failure, so leaving
 *   the field again sends it again.
 */
export function useDraft(value: string, version: number) {
  const [edit, setEdit] = useState<{ text: string; focused: boolean; read: number } | null>(null);
  /** The value the field's latest write out will save, and how many of its writes are out. */
  const out = useRef<{ value: string; count: number } | null>(null);

  const focus = useCallback(() => {
    setEdit((e) => (e ? { ...e, focused: true } : { text: value, focused: true, read: version }));
  }, [value, version]);

  const change = useCallback((text: string) => {
    setEdit((e) => ({ text, focused: true, read: e?.read ?? version }));
  }, [version]);

  /** What to write and the version it was read at, or `null`; either way the field is no longer focused. */
  const leave = useCallback((): { text: string; read: number } | null => {
    const text = (edit?.text ?? value).trim();
    const read = edit?.read ?? version;
    if (text === (out.current ? out.current.value : value)) {
      // Nothing new: back to the saved value, unless a write is still out to show what was typed until it lands.
      setEdit(out.current && edit ? { ...edit, focused: false } : null);
      return null;
    }
    out.current = { value: text, count: (out.current?.count ?? 0) + 1 };
    setEdit({ text: edit?.text ?? value, focused: false, read });
    return { text, read };
  }, [edit, value, version]);

  /** One of the field's writes has settled. */
  const settle = useCallback((kind: Outcome<unknown>['kind']) => {
    if (kind === 'conflict') {
      // Read again: what is saved now is somebody else's, and every write still out was sent against an older one.
      out.current = null;
    } else if (out.current && --out.current.count <= 0) {
      out.current = null;
    }
    if (kind === 'failed' || out.current) return;
    setEdit((e) => (e && !e.focused ? null : e));
  }, []);

  return { value: edit ? edit.text : value, focus, change, leave, settle };
}

/**
 * **A control's state while its write is out** — a box ticked, a status moved on, the rows' order — shown at
 * once, as the prototype redraws at once, and dropped when the last of its writes settles: the page then
 * holds what the server answered, or, after a conflict, what it read again.
 */
export function usePending<T>() {
  const [pending, setPending] = useState<Record<string, { value: T; count: number }>>({});
  const count = useRef(new Map<string, number>());

  const begin = useCallback((key: string, value: T) => {
    count.current.set(key, (count.current.get(key) ?? 0) + 1);
    setPending((p) => ({ ...p, [key]: { value, count: count.current.get(key)! } }));
  }, []);

  const end = useCallback((key: string) => {
    const left = (count.current.get(key) ?? 1) - 1;
    if (left > 0) {
      count.current.set(key, left);
      return;
    }
    count.current.delete(key);
    setPending((p) => {
      const { [key]: _gone, ...rest } = p;
      return rest;
    });
  }, []);

  const of = useCallback((key: string): T | undefined => pending[key]?.value, [pending]);

  return { of, begin, end };
}
