'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiRequestError } from './api-client';
import { formatMonth, formatNumber, formatPercent } from './format';
import { MINOR_UNITS_PER_MAJOR } from './goals';
import type {
  ActionItem, ActionStatus, AgendaItem, AgendaSection, ColumnKey, MeetingView, MeetingWriter, RowKey, Scorecard,
  ScorecardCell, ScorecardRow, TargetRowKey,
} from './leader-meetings';

/**
 * **A meeting's three tabs and its print** (`functional/leader-forum.md`, *Overview & Stats*, *Agenda*, *Action
 * Items*, *Saving*, *Printing*): their words, how a figure is written, and how a field's write is sent.
 *
 * The figures are the server's, exact (OD-144, ADR-0129); this file only rounds them for display, as the spec
 * says each row is drawn. Nothing here decides a figure, who may edit or a bound (`limits`).
 */

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 */

/** The prototype's, verbatim (`KPM_Owner.html:2458-2475`, `:2653-2695`, `:2780-2843`, `:2865-2901`). */
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
  columns: { thisMonthLastYear: 'This Month, Last Year', lastMonth: 'Last Month', thisMonth: 'This Month' },
  rows: {
    ape: 'APE (IDR B)',
    manpower: 'Manpower',
    flc: 'FLC (avg. monthly)',
    producing_agents: 'Producing agents',
    new_aa: 'New AA (avg. monthly)',
    new_agent_3m: '3M new agent %*',
    avg_monthly_aa: 'Avg. Monthly AA',
    case_submission: 'Case submission',
    average_case_size: 'Average Case Size (IDR M)',
  } satisfies Record<RowKey, string>,
  pending: 'pending data',
  none: '—',
  note: 'Note: AA = Active Agent; 3M new agent % is the share of new agents producing at least one case in their join month or the following three months.',
  source: 'Source: Manpower, APE, average case size, producing agents, avg. monthly AA, FLC and case submission as tagged to this KPM.',
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
  /** A blocked cell, for screen readers (I-255). */
  notTracked: 'Not tracked',
  /** A figure over part of its period (F-183, Phase 15's rule). */
  leftOut: (months: string) => `Without ${months}: no figures uploaded for them yet.`,
  /** *—*, a ratio over nothing. */
  noPolicies: 'No policies in this period.',
  statusName: (status: string, next: string) => `${status}. Change to ${next}`,
  handleName: (n: number, initiative: string) => `Move row ${n}, ${initiative}. Use the arrow keys.`,
  removeName: (n: number) => `Remove row ${n}`,
  cellName: (column: string, n: number) => `${column}, row ${n}`,
  agendaText: (section: string, n: number) => `${section} item ${n}`,
  agendaPic: (section: string, n: number) => `PIC for ${section} item ${n}`,
  /** A *Monthly Target* input's name: the column, then the row, as a tracker cell's is. */
  targetName: (row: string) => `Monthly Target, ${row}`,
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

/** *FY 2025*, *YTD 2026* from the meeting's own year (F-184); the three months as drawn. */
export function columnHeader(column: ColumnKey, periods: Scorecard['periods']): string {
  if (column === 'fy') return `FY ${periods.fy}`;
  if (column === 'ytd') return `YTD ${periods.ytd}`;
  return TABS_COPY.columns[column];
}

/** How a row's name is drawn (`:2461-2473`): indented, bold, or as is. */
export const ROW_STYLE: Record<RowKey, 'plain' | 'indent' | 'bold'> = {
  ape: 'plain',
  manpower: 'plain',
  flc: 'indent',
  producing_agents: 'indent',
  new_aa: 'plain',
  new_agent_3m: 'indent',
  avg_monthly_aa: 'plain',
  case_submission: 'plain',
  average_case_size: 'bold',
};

/** The section row drawn above a row (`:2466`, `:2469`): *Activation* above *New AA*, *Productivity* above *Avg. Monthly AA*. */
export const SECTION_BEFORE: Partial<Record<RowKey, string>> = {
  new_aa: 'Activation',
  avg_monthly_aa: 'Productivity',
};

/** Rupiah in billions for *APE (IDR B)*, in millions for *Average Case Size (IDR M)*, as the labels say. */
const MONEY_SCALE: Partial<Record<RowKey, number>> = { ape: 1e9, average_case_size: 1e6 };

/**
 * One decimal, two below 1 (`:2488` draws *0.75*). Rounded to two first, so 0.996 is *1,0*, never *1,00*.
 * **A comma for the decimal** since ADR-0167 §1 (`0,75`, `1,2`), as every other figure is written (`0,30`, `15,0%`).
 * The table's money stays in the unit its label names — *APE (IDR B)* — rather than in full rupiah: the
 * heading carries the unit, and the column is the prototype's.
 */
function scaled(value: number): string {
  const two = Math.round(value * 100) / 100;
  return Math.abs(two) < 1 ? formatNumber(two, { decimals: 2 }) : formatNumber(value, { decimals: 1 });
}

/**
 * A figure as the table writes it — **for display only**; the served value is exact. Money from minor units,
 * through the one conversion (`MINOR_UNITS_PER_MAJOR`); counts and the averages whole (`:2470`), a thousand
 * with a dot; a percentage to one decimal (ADR-0167 §1), with its sign.
 */
export function formatFigure(row: Pick<ScorecardRow, 'key' | 'unit'>, value: number): string {
  if (row.unit === 'idr_minor') return scaled(value / MINOR_UNITS_PER_MAJOR / (MONEY_SCALE[row.key] ?? 1e9));
  if (row.unit === 'percentage') return formatPercent(value);
  return formatNumber(Math.round(value));
}

/** A cell's words: the figure, *pending data*, *—*, or nothing for a blocked cell. */
export function cellText(row: Pick<ScorecardRow, 'key' | 'unit'>, cell: ScorecardCell): string {
  if (cell.kind === 'figure') return formatFigure(row, cell.value);
  if (cell.kind === 'pending') return TABS_COPY.pending;
  if (cell.kind === 'none') return TABS_COPY.none;
  return '';
}

/** *"Without August 2026: no figures uploaded for them yet."* for `YYYY-MM` months: the one wording of both. */
export const leftOutWords = (months: readonly string[]) => TABS_OWN_COPY.leftOut(listed(months.map(formatMonth)));

/** A figure's own: `null` when it leaves nothing out. */
export function leftOutLine(cell: ScorecardCell): string | null {
  if (cell.kind !== 'figure' || cell.leavesOut.length === 0) return null;
  return leftOutWords(cell.leavesOut);
}

/**
 * The print's (P18.1-T3, data honesty): every month any figure of the table leaves out, once each, in month order —
 * `null` when no figure is partial. On paper there is no tooltip, so a *†* marks each such figure and this line
 * under the table says what they leave out.
 */
export function printLeftOutLine(scorecard: Pick<Scorecard, 'rows'>): string | null {
  const months = new Set(scorecard.rows.flatMap((r) => Object.values(r.cells).flatMap((c) => (c.kind === 'figure' ? c.leavesOut : []))));
  return months.size === 0 ? null : `† ${leftOutWords([...months].sort())}`;
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

export function withTarget(meeting: MeetingView, row: TargetRowKey, target: { value: string; version: number }): MeetingView {
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
