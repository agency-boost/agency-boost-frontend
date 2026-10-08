import { api } from './api-client';
import type { LastOneOnOne, RosterStatus } from './coaching';
import { formatMonth, formatOfficeDay } from './format';
import { formatRupiah, groupDigits, parseDigits, producedFrom, toMajor, toMinor } from './goals';
import type { MonthState } from './production';

/**
 * The Unit Dashboard (Phase 15, `docs/02-specs/functional/unit-dashboard.md`): a leader's roster —
 * everybody in their unit with their goal, leads, activity, last 1:1 and status, the unit's totals and
 * four tiles over them (`Overall.html:3888-3949`, `:6906-7622`).
 *
 * **Every figure is the server's** (D-figures): each row's goal is the Summary's, its status and *Last
 * 1:1* coaching's, its production the month table's, and every total the sum of the rows it covers,
 * computed by the server's rollup rule. This file names the shapes, asks for them, and turns them into
 * the prototype's words. It counts no days and sums no figures — **a difference of two figures the
 * server sent is the only arithmetic here**, for the *over* and *short* of a total, which the prototype
 * writes the same way (`:7447-7449`).
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** *Last 7 days · This month · This year* (`Overall.html:3895-3897`), as the address carries them. */
export type UnitPeriod = '7d' | 'month' | 'year';

export const UNIT_PERIODS: readonly { id: UnitPeriod; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

/** *This month* is selected first (`:3896`), and an address with no period, or one it does not know, reads it. */
export const DEFAULT_PERIOD: UnitPeriod = 'month';

export function periodFrom(value: string | string[] | null | undefined): UnitPeriod {
  const one = Array.isArray(value) ? value[0] : value;
  return UNIT_PERIODS.some((p) => p.id === one) ? (one as UnitPeriod) : DEFAULT_PERIOD;
}

export interface UnitPerson {
  membershipId: string;
  name: string;
}

/** Which writer a production figure came from: the file, a correction by hand, or the agent's own. */
export type UnitProvenance = 'imported' | 'corrected' | 'self_reported';

/** One cell of the month table, this office month: the dialog's prefill. `null` is *Not uploaded yet*, never 0. */
export interface ProductionCell {
  valueMinor: number | null;
  provenance: UnitProvenance | null;
  /** Only for `corrected`. */
  correctedBy: UnitPerson | null;
  correctedAt: string | null;
}

/** Where a goal figure's APE came from, and for a correction, who made it and when. */
export interface GoalSource {
  provenance: UnitProvenance;
  month: string | null;
  correctedBy: UnitPerson | null;
  correctedAt: string | null;
}

/** The Summary's figures for the period: the month's under *Last 7 days* (D-period). */
export interface GoalCell {
  /** A goal is saved for the year (ADR-0080): without one the cell reads *No goal set*. */
  set: boolean;
  period: 'month' | 'year';
  targetMinor: number | null;
  /** `null` before the month's file: *Not uploaded yet*. */
  actualMinor: number | null;
  attainmentPct: number | null;
  gapMinor: number | null;
  overMinor: number | null;
  policiesNeeded: number | null;
  caseSizeMinor: number;
  targetMet: boolean;
  source: GoalSource | null;
}

/** A count logged against its target; `target` is `null` when there is no APE target to derive it from. */
export interface CountAgainst {
  logged: number;
  target: number | null;
}

export interface UnitRung {
  code: string;
  label: string;
}

export interface UnitProduction {
  monthly: ProductionCell;
  ytd: ProductionCell;
}

/** The *Leads* column's four counts (D-leads): point in time, with this month's commitments. */
export interface LeadsCounts {
  salesOpen: number;
  salesClosing: number;
  recruitOpen: number;
  recruitNominated: number;
}

export interface UnitActivity {
  leads: CountAgainst;
  appointments: CountAgainst;
  closings: CountAgainst;
  touches: CountAgainst;
}

/** OD-140: the next open action item of the person's latest finalized session. */
export interface FollowUp {
  text: string;
  dueDate: string | null;
  /** Whole office days past its date; `null` when it is not past. */
  overdueDays: number | null;
}

export interface UnitRow {
  membershipId: string;
  name: string;
  /** The reader's own row: *You ({first name})* ★, *Last 1:1* —, its drills to their own screens. */
  isReader: boolean;
  rung: UnitRung;
  /** Edges from the unit's head, who is 0. */
  depth: number;
  /** Leads somebody: a unit's head, whose own row is tagged *Personal* (`:7384`). */
  leads: boolean;
  /**
   * The reader coaches them (or it is the reader): their coaching tabs will open. `false` only when an
   * Owner or an Admin reads a unit outside their own downline, where those tabs would answer *not someone
   * you coach* — so the row's figures are not links there.
   */
  coached: boolean;
  goal: GoalCell;
  production: UnitProduction;
  leadsCounts: LeadsCounts;
  activity: UnitActivity;
  /** Coaching's own reading; `null` for *No 1:1 yet*, and on the reader's own row. */
  lastOneOnOne: LastOneOnOne | null;
  status: RosterStatus;
  /** `PACING_TO_MAA`: the ✓. `null` without a target. */
  pacingToMaa: boolean | null;
  followUp: FollowUp | null;
}

/** A total's goal: sums of the figures held; `missing` counts the rows holding no actual. */
export interface UnitTotalGoal {
  targetMinor: number | null;
  actualMinor: number | null;
  attainmentPct: number | null;
  missing: number;
}

export interface PotentialActive {
  count: number;
  of: number;
}

export interface UnitTotal {
  goal: UnitTotalGoal;
  leadsCounts: LeadsCounts;
  touches: CountAgainst;
  potentialActive: PotentialActive;
}

/** A unit below the head: its head, their direct reports who lead nobody, then the units nested in it. */
export interface UnitGroup {
  head: UnitRow;
  members: UnitRow[];
  units: UnitGroup[];
  /** The head and everybody below them. */
  total: UnitTotal;
}

export interface TeamTile {
  total: number;
  direct: number;
  units: number;
  underUnits: number;
}

export interface GroupProductionTile {
  targetMinor: number | null;
  actualMinor: number | null;
  attainmentPct: number | null;
  missing: number;
  period: 'month' | 'year';
}

export interface RecruitsTile {
  yourUnit: number;
  aabs: number;
}

export interface UnitTiles {
  team: TeamTile;
  directGroupProduction: GroupProductionTile;
  potentialActive: PotentialActive;
  potentialRecruits: RecruitsTile;
}

export interface UnitHead {
  membershipId: string;
  name: string;
  isReader: boolean;
}

export interface UnitWindow {
  from: string;
  to: string;
}

export interface YourUnit {
  rows: UnitRow[];
  total: UnitTotal;
}

/** The office month the dialog writes, the revision it is pinned to, and whether it may be drawn. */
export interface UnitProductionState {
  month: string;
  revision: number;
  locked: boolean;
  canUpdate: boolean;
}

/** `GET /unit/dashboard`: one read for the whole screen (D-api). */
export interface UnitDashboardView {
  today: string;
  month: string;
  year: string;
  period: UnitPeriod;
  window: UnitWindow;
  overdueAfterDays: number;
  head: UnitHead;
  /** The head leads nobody: no rows, and the screen's empty state. */
  empty: boolean;
  tiles: UnitTiles;
  yourUnit: YourUnit;
  units: UnitGroup[];
  production: UnitProductionState;
}

/**
 * `?period=…&for=…`, or what of it is given. Appended with `+`, never interpolated: the API-consumer gate
 * reads path **literals** out of each call.
 */
const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][],
  ).toString();
  return search ? `?${search}` : '';
};

/**
 * The reader's unit, or — with `for` — the unit of somebody below them who leads. The server answers
 * 404 for anybody else (the reader, somebody who leads nobody, somebody outside the reach or gone), and
 * an empty unit, never a refusal, to a reader who leads nobody. Each read of somebody else's figures is
 * audited (D-audit).
 */
export const readUnitDashboard = (params: { period?: UnitPeriod; for?: string } = {}) =>
  api<UnitDashboardView>('/unit/dashboard' + query({ period: params.period, for: params.for }));

/** One row of *Update production*: only the cells that changed. */
export interface ProductionUpdateRow {
  membershipId: string;
  apeMonthlyMinor?: number;
  apeYtdMinor?: number;
}

export interface ProductionUpdate {
  month: string;
  revision: number;
  rows: ProductionUpdateRow[];
}

export interface ProductionUpdated {
  /** Rows with at least one changed cell: what the toast counts. */
  updated: number;
  state: MonthState;
}

/**
 * *Save all* (OD-137, ADR-0121): each changed cell a correction of the month table, under the reader's
 * name, pinned to the revision the dialog read. 409 on a locked month or a stale revision, 422 on a
 * figure out of bounds, 404 for a row outside the reach — and nothing written for any of them.
 */
export const updateUnitProduction = (body: ProductionUpdate) =>
  api<ProductionUpdated>('/unit/dashboard/production', { method: 'PATCH', body });

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The strings `Overall.html` draws, verbatim (D-copy). */
export const PROTOTYPE_COPY = {
  title: 'Unit Dashboard',
  roster: 'Your team’s roster',
  updateProduction: 'Update production',
  yourTeam: 'Your team',
  directGroupProduction: 'Direct Group production',
  potentialActiveTile: 'Potential Monthly Active Agents (Group)',
  potentialRecruitsTile: 'Potential Recruits (Group)',
  yourUnitRecruits: 'Your unit',
  yourAabs: 'Your AABs',
  aabUnits: 'AAB units',
  yourUnitGroup: 'Your Unit',
  yourUnitTotal: 'Your Unit — Total',
  /** A unit head's own row, apart from the unit's total (`:7384`). */
  personal: 'Personal',
  noOneOnOne: 'No 1:1 yet',
  maa: 'Potential Monthly Active Agent — pacing to submit at least 1 policy this month.',
  statusInfo: 'How is status decided?',
  /** The *Status* header's tooltip (`:3929-3935`), its list kept as lines. */
  statusRules: [
    'Evaluated for the current calendar month, regardless of the period toggle above.',
    '1. Not projected to submit ≥1 policy this month? → Needs attention, full stop.',
    '2. Will qualify. Projected pace ≥90% of target? → On track.',
    '3. Will qualify, but pace under 90%? → Watch closely.',
  ].join('\n'),
  gap: 'Gap',
  activityBreakdown: 'Activity breakdown',
  ratios: 'Ratios',
  salesOnly: 'Sales-only',
  followUp: 'Flagged follow-up (system-detected)',
  dialogHint: 'Enter the latest figures from the company report — month and year are updated independently.',
  dialogName: 'Name',
  dialogMonth: 'Month achieved (Rp)',
  dialogYear: 'Year achieved (Rp)',
  yourDirectAgents: 'Your direct agents',
  close: 'Close',
  cancel: 'Cancel',
  saveAll: 'Save all',
} as const;

/** The activity breakdown's three, verbatim (`:7334-7336`) — the Summary's chips' words. */
export const ACTIVITY_LABEL = {
  leads: 'Leads contacted',
  appointments: 'Appointments',
  closings: 'Closings',
} as const;

/** The pill's tooltip per status (`:7094-7098`), and ADR-0080's state, which the prototype never draws. */
export const STATUS_TOOLTIP: Record<RosterStatus, string> = {
  on_track: 'Pacing to qualify as a Monthly Active Agent, at or above 90% of expected goal pace.',
  watch_closely: 'Still pacing to qualify as a Monthly Active Agent, but under 90% of expected goal pace — worth a check-in.',
  needs_attention: 'Not projected to submit a policy this month — will not qualify as a Monthly Active Agent.',
  no_goal_set: 'No goal saved for this year, so there is no pace to measure this month against.',
};

/**
 * The module's own strings — the states the prototype lacks, the marks it does not draw. None of OD-39's
 * six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*), no phase, no code.
 */
export const OWN_COPY = {
  loading: 'Loading your team’s roster…',
  tryAgain: 'Try again',
  details: 'Details',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  /**
   * A month whose target was **made before it began** (ADR-0047): the year's target reached, so the
   * month's is 0 and needs nothing — never *0% · … of Rp 0*. The Summary's sentence, without its pronoun.
   */
  targetMade: 'Year’s target made',
  targetMadeNote: 'The year’s target was made before this month began — this month needs nothing more.',
  thisMonth: 'this month',
  proRated: 'pro-rated',
  ratiosEmpty: 'There are no ratios for this role yet.',
  loadingRatios: 'Working out the ratios…',
  emptyTitle: 'Nobody is in your unit yet.',
  emptyLine: 'This page lists the people you lead, once somebody joins you. Your own figures are on these screens:',
  notFoundTitle: 'This isn’t a unit you can open.',
  notFoundLine: 'They may lead nobody yet, or sit outside your team, or the address may be mistyped.',
  backToYours: 'Your Unit Dashboard',
  saving: 'Saving…',
} as const;

/*
 * ── Rows ────────────────────────────────────────────────────────────────────────────────────────
 */

/** The first word of a name: *Agus* of *Agus Santoso*. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The reader's own row (`:6917`, *You (Jordan)*). */
export const readerName = (name: string) => `You (${firstName(name)})`;

/** What a row is called on screen: the reader's own as *You ({first name})*, anybody else by name. */
export const rowName = (row: Pick<UnitRow, 'name' | 'isReader'>) => (row.isReader ? readerName(row.name) : row.name);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** *agents* where the prototype counts people (`:7246`, `:7554`), singular at one. */
export const agentsCount = (n: number) => plural(n, 'agent', 'agents');

/** *Potential Recruits*'s rows (`:7266-7270`). */
export const candidates = (n: number) => plural(n, 'candidate', 'candidates');

/** The toast after *Save all* (`:7554`), counting only the rows that changed (a Fix of every row counted). */
export const productionToast = (updated: number) => `Production updated for ${agentsCount(updated)}.`;

/** What a goal cell, a total or the production tile says, and how it is painted. */
export interface GoalWords {
  /** `over` green, `short` red, `none` and `missing` muted. */
  tone: 'over' | 'short' | 'none' | 'missing';
  line: string;
  sub: string | null;
}

/**
 * The goal line and its sub-line (`:7364-7367`, `:7383-7386`): *"{pct}% · +{over} over"* or *"{pct}% ·
 * {short} short"* over *"{achieved} of {target}"*. **No figure is shown as 0** (D-figures): no target is
 * *No goal set* (ADR-0080), and no actual *Not uploaded yet*.
 */
export function goalWords(figures: {
  targetMinor: number | null;
  actualMinor: number | null;
  attainmentPct: number | null;
  overMinor?: number | null;
  gapMinor?: number | null;
  targetMet?: boolean;
  set?: boolean;
}): GoalWords {
  const { targetMinor: target, actualMinor: actual } = figures;
  if (figures.set === false || target === null) {
    return { tone: 'none', line: OWN_COPY.noGoal, sub: actual === null ? null : formatRupiah(actual) };
  }
  // A target of 0 is only ever a month made already (ADR-0047; `periodFigures` answers `null` for no
  // target), on a row or on a total whose rows were all made: nothing to measure a percentage against.
  if (target === 0) {
    return { tone: 'over', line: OWN_COPY.targetMade, sub: actual === null ? OWN_COPY.notUploaded : formatRupiah(actual) };
  }
  if (actual === null) {
    // The Summary's own phrase beside its figure, *of {target} target*, under the missing one.
    return { tone: 'missing', line: OWN_COPY.notUploaded, sub: `of ${formatRupiah(target)} target` };
  }
  const pct = figures.attainmentPct ?? 0;
  const met = figures.targetMet ?? actual >= target;
  const over = figures.overMinor ?? Math.max(0, actual - target);
  const short = figures.gapMinor ?? Math.max(0, target - actual);
  return met
    ? { tone: 'over', line: `${pct}% · +${formatRupiah(over)} over`, sub: `${formatRupiah(actual)} of ${formatRupiah(target)}` }
    : { tone: 'short', line: `${pct}% · ${formatRupiah(short)} short`, sub: `${formatRupiah(actual)} of ${formatRupiah(target)}` };
}

/** *"Sales: {n} · {m} closing"* (`:7399`). */
export const salesLine = (c: LeadsCounts) => ({ count: c.salesOpen, rest: `· ${c.salesClosing} closing` });

/** *"Recruit: {n} · {m} nominated"*, or `null` for the prototype's *—* (`:7371-7373`). */
export const recruitLine = (c: LeadsCounts) =>
  (c.recruitOpen > 0 || c.recruitNominated > 0 ? { count: c.recruitOpen, rest: `· ${c.recruitNominated} nominated` } : null);

/** A total's recruit line, *"{n} potential recruit"* or *"recruits"* (`:7443-7445`), or `null` for *—*. */
export const totalRecruitLine = (c: LeadsCounts) =>
  (c.recruitNominated > 0
    ? { count: c.recruitNominated, rest: `potential recruit${c.recruitNominated === 1 ? '' : 's'}` }
    : null);

/**
 * *"{logged} / {target} touches"* (`:7404-7405`), its target labelled *pro-rated* under *Last 7 days*
 * (metrics §B.3); with no target the logged count alone, and no bar — an empty track reads as zero.
 */
export function touchesWords(touches: CountAgainst, period: UnitPeriod): { logged: number; rest: string; pct: number | null } {
  if (touches.target === null) return { logged: touches.logged, rest: 'touches', pct: null };
  const pct = touches.target > 0 ? Math.min(100, Math.round((touches.logged / touches.target) * 100)) : 100;
  return {
    logged: touches.logged,
    rest: `/ ${touches.target}${period === '7d' ? ` ${OWN_COPY.proRated}` : ''} touches`,
    pct,
  };
}

/** The activity breakdown's *"{logged}/{target}"* (`:7334-7336`), *pro-rated* under *Last 7 days*. */
export const countWords = (count: CountAgainst, period: UnitPeriod) =>
  (count.target === null
    ? `${count.logged}`
    : `${count.logged}/${count.target}${period === '7d' ? ` ${OWN_COPY.proRated}` : ''}`);

/** *Gap*'s value and note (`:7326-7328`), or the cell's own *No goal set* / *Not uploaded yet*. */
export function gapWords(goal: GoalCell): { value: string; note: string | null } {
  if (!goal.set || goal.targetMinor === null) return { value: OWN_COPY.noGoal, note: null };
  if (goal.targetMinor === 0) return { value: OWN_COPY.targetMade, note: OWN_COPY.targetMadeNote };
  if (goal.gapMinor === null) return { value: OWN_COPY.notUploaded, note: null };
  const policies = goal.policiesNeeded;
  return {
    value: `${formatRupiah(goal.gapMinor)} remaining`,
    note: policies === null
      ? null
      : `≈ ${policies} polic${policies === 1 ? 'y' : 'ies'} needed at their avg case size of ${formatRupiah(goal.caseSizeMinor)}.`,
  };
}

/**
 * The provenance marker's words (T3 AC-1): the Summary's (`producedFrom`) in the coaching voice, which
 * names the upload without *office*, then **who corrected it and when**. The reader's own figure in
 * Goal Settings is theirs; anybody else's is *Their own figure*. The file's own figure has none.
 */
export function provenanceWords(source: GoalSource | null, span: 'month' | 'year', own: boolean): string | null {
  if (!source || source.provenance === 'imported') return null;
  if (source.provenance === 'self_reported') return producedFrom(source, span, own ? undefined : 'they');
  // The name and the day are added below, together; the shared words are asked for without them.
  const words = producedFrom({ provenance: source.provenance, month: source.month }, span, 'they');
  if (!source.correctedBy) return words;
  const when = source.correctedAt ? formatOfficeDay(source.correctedAt) : '';
  return `${words}, by ${source.correctedBy.name}${when ? ` on ${when}` : ''}`;
}

/**
 * A total's mark when some of its rows hold no figure (D-figures): *"a total sums the figures held …
 * and names in its tooltip how many hold none"* — by name where the rows below say who.
 */
export function missingWords(missing: number, names: readonly string[]): string | null {
  if (missing <= 0) return null;
  const who = names.length === missing ? names.join(', ') : plural(missing, 'person', 'people');
  return `${OWN_COPY.notUploaded} for ${who}, so not counted in this total.`;
}

/** The month the lock names, in the tooltip of the disabled *Update production*. */
export const lockedWords = (month: string) =>
  `Production for ${formatMonth(month)} is locked. The Owner or Admin can reopen it.`;

/** *Overdue {n}d* (`:7292`). */
export const overdueTag = (days: number) => `Overdue ${days}d`;

/*
 * ── The tree ────────────────────────────────────────────────────────────────────────────────────
 */

/** A unit's rows in the server's order: its head, their members, then each unit nested in it. */
export function rowsOf(group: UnitGroup): UnitRow[] {
  return [group.head, ...group.members, ...group.units.flatMap(rowsOf)];
}

/** Everybody on the roster, as the coaching roster orders them (D-groups). */
export function everyRow(view: Pick<UnitDashboardView, 'yourUnit' | 'units'>): UnitRow[] {
  return [...view.yourUnit.rows, ...view.units.flatMap(rowsOf)];
}

/** The names of the rows a total covers that hold no actual, for its mark. */
export const namesMissing = (rows: readonly UnitRow[]) =>
  rows.filter((r) => r.goal.actualMinor === null).map((r) => rowName(r));

/** One group of the dialog (`:7524-7530`): a label, and its rows with how far each is indented. */
export interface DialogGroup {
  label: string;
  rows: { row: UnitRow; indent: number }[];
}

/**
 * *Your direct agents* — the head's own unit, head included — then *"{name}'s unit"* for each unit below,
 * its head first and everybody beneath them indented by how far below the head they stand (`:7524-7530`).
 * On a unit below the reader the first group is *"{name}'s direct agents"* (data honesty).
 */
export function dialogGroups(view: Pick<UnitDashboardView, 'yourUnit' | 'units' | 'head'>): DialogGroup[] {
  const first = view.head.isReader ? PROTOTYPE_COPY.yourDirectAgents : `${view.head.name}’s direct agents`;
  return [
    { label: first, rows: view.yourUnit.rows.map((row) => ({ row, indent: 0 })) },
    ...view.units.map((unit) => ({
      label: `${unit.head.name}’s unit`,
      rows: rowsOf(unit).map((row) => ({ row, indent: Math.max(0, row.depth - unit.head.depth) })),
    })),
  ];
}

/*
 * ── The dialog's figures ────────────────────────────────────────────────────────────────────────
 */

export type ProductionCadence = 'monthly' | 'ytd';

/** A held figure as the dialog prefills it: whole rupiah, grouped; blank when nothing is held. */
export const prefill = (cell: ProductionCell) => (cell.valueMinor === null ? '' : groupDigits(toMajor(cell.valueMinor)));

/** What was typed, regrouped as it is typed; blank stays blank. */
export const regroup = (typed: string) => (/\d/.test(typed) ? groupDigits(parseDigits(typed)) : '');

/** The inputs, keyed by membership and cadence. */
export type ProductionInputs = Record<string, Record<ProductionCadence, string>>;

export function inputsOf(rows: readonly UnitRow[]): ProductionInputs {
  return Object.fromEntries(rows.map((row) => [
    row.membershipId,
    { monthly: prefill(row.production.monthly), ytd: prefill(row.production.ytd) },
  ]));
}

/**
 * The rows *Save all* sends: **only the cells that changed**. A box left as it was prefilled, or emptied,
 * is unchanged — a leader cannot clear a figure (ADR-0051) — and so is one typed back to the figure held.
 * Whole rupiah in, minor units out.
 */
export function productionChanges(rows: readonly UnitRow[], inputs: ProductionInputs): ProductionUpdateRow[] {
  const changes: ProductionUpdateRow[] = [];
  for (const row of rows) {
    const typed = inputs[row.membershipId];
    if (!typed) continue;
    const change: ProductionUpdateRow = { membershipId: row.membershipId };
    const monthly = changed(row.production.monthly, typed.monthly);
    const ytd = changed(row.production.ytd, typed.ytd);
    if (monthly !== null) change.apeMonthlyMinor = monthly;
    if (ytd !== null) change.apeYtdMinor = ytd;
    if (monthly !== null || ytd !== null) changes.push(change);
  }
  return changes;
}

function changed(cell: ProductionCell, typed: string): number | null {
  if (!/\d/.test(typed) || typed === prefill(cell)) return null;
  const minor = toMinor(parseDigits(typed));
  return minor === cell.valueMinor ? null : minor;
}
