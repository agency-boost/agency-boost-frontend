import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { api } from './api-client';
import type { ActivityRatio } from './activity';
import type { LastOneOnOne, RosterStatus } from './coaching';
import { formatMonth, formatOfficeDay, formatPercent, formatRupiahCompact, formatRupiahCompactPair, OFFICE_TIME_ZONE } from './format';
import { groupDigits, parseDigits, toMajor, toMinor } from './goals';
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
 *
 * **Its words are the catalogue's** (`i18n/messages/unit-dashboard.ts`, P18.10-T4): each function that writes one takes
 * the reader's `language` — English, the source, when passed none, which its spec reads — and one that writes a figure
 * takes the figures' language after it (`figures`; Indonesian when passed none). A screen passes `useLanguage()` and
 * `useFigureLanguage()`.
 */

/** The module's words in a language. */
const wordsIn = (language: Language) => messagesIn(unitDashboardMessages, language);
/** The catalogue's English: what the specs read, and what the old shapes below hold. */
const EN = wordsIn(SOURCE_LANGUAGE);

/** *Last 7 days · This month · This year* (`Overall.html:3895-3897`), as the address carries them. */
export type UnitPeriod = '7d' | 'month' | 'year';

/** The three, in their order, each named in a language. */
export const unitPeriods = (language: Language = SOURCE_LANGUAGE): readonly { id: UnitPeriod; label: string }[] => {
  const t = wordsIn(language).periods;
  return [{ id: '7d', label: t['7d'] }, { id: 'month', label: t.month }, { id: 'year', label: t.year }];
};

export const UNIT_PERIODS: readonly { id: UnitPeriod; label: string }[] = unitPeriods();

/** *This month* is selected first (`:3896`), and an address with no period, or one it does not know, reads it. */
export const DEFAULT_PERIOD: UnitPeriod = 'month';

export function periodFrom(value: string | string[] | null | undefined): UnitPeriod {
  const one = Array.isArray(value) ? value[0] : value;
  return UNIT_PERIODS.some((p) => p.id === one) ? (one as UnitPeriod) : DEFAULT_PERIOD;
}

/**
 * **The three views** (the client's message of 11 November 2026, item 7; ADR-0249): *Grup langsung*, *Grup informal*,
 * *Semua downline* — the API's `scope` enum, in the picker's order, which the screen puts in its address. The views
 * offered and the default are the server's (`scopes`); the screen never decides them.
 */
export type UnitView = 'direct' | 'informal' | 'downline';
export const UNIT_VIEWS: readonly UnitView[] = ['direct', 'informal', 'downline'];

/** `?scope=` as the address carries it: one of the three, or `null` — the reader's stored choice, then the default. */
export function viewFrom(value: string | string[] | null | undefined): UnitView | null {
  const one = Array.isArray(value) ? value[0] : value;
  return UNIT_VIEWS.includes(one as UnitView) ? (one as UnitView) : null;
}

/** Each view named in a language, in the picker's order. */
export const unitViews = (language: Language = SOURCE_LANGUAGE): readonly { id: UnitView; label: string }[] => {
  const t = wordsIn(language).views;
  return UNIT_VIEWS.map((id) => ({ id, label: t[id] }));
};

/**
 * **The last view chosen, remembered on this browser** (the client: *"Pilihan terakhir diinget"*): per membership, on the
 * reader's own dashboard only — never in a view of another leader's unit. A preference, not a secret; storage refused (a
 * private window) remembers nothing, and the server's default stands.
 */
export const viewKey = (membershipId: string) => `ab.unit.scope.${membershipId}`;

export function storedView(membershipId: string | null | undefined): UnitView | null {
  if (!membershipId) return null;
  try {
    return viewFrom(window.localStorage.getItem(viewKey(membershipId)));
  } catch {
    return null;
  }
}

export function keepView(membershipId: string | null | undefined, scope: UnitView) {
  if (!membershipId) return;
  try {
    window.localStorage.setItem(viewKey(membershipId), scope);
  } catch {
    // No storage: the choice lasts as long as the address.
  }
}

/** The views a head is offered and the reader's default (`scopes`); the picker hides with one or none. */
export interface UnitViews {
  offered: UnitView[];
  default: UnitView;
}

/** *Grup informal*'s line (ADR-0249 §4): the ABs below the head in no group of theirs, and what the sheet needs. */
export interface UnitInformal {
  groups: { groupId: string; name: string }[];
  absNotInGroup: number;
  /** Named only to a reader who may tag (`member:tag_group`); `null` otherwise. */
  abs: { membershipId: string; name: string }[] | null;
  canTag: boolean;
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
  /** Who typed a `self_reported` figure, when it was not the member — a coach (S2). Absent otherwise. */
  typedBy?: { membershipId: string; name: string | null };
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
  /** Their profile photo as a signed link (UI V1, UI-111); `null` or absent for none: the avatar draws initials. */
  photoUrl?: string | null;
  /**
   * ***WhatsApp*** (P19.9-T4 AC-1; ADR-0235, OD-291): the number on their account, for the row's WhatsApp button at every
   * period and size; `null` without one — *Isi nomor WhatsApp* for a reader who may save one — and always on the reader's
   * own row and in the office's read-only view.
   */
  phone: string | null;
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
  /** *Closing* (UI V1, UI-028; O-4): their sales leads that reached *Paid and issued* in the period's window. */
  closings: number;
  /**
   * ***Proposal*** (P19.7-T2 AC-13; ADR-0221 §7): `PROPOSALS_MADE` — the proposals they first saved as a PDF in the
   * period's window. A count and nothing else: no client, product or premium reaches a leader (decision 4).
   */
  proposalsMade: number;
  activity: UnitActivity;
  /** Coaching's own reading; `null` for *No 1:1 yet*, and on the reader's own row. */
  lastOneOnOne: LastOneOnOne | null;
  status: RosterStatus;
  /** `PACING_TO_MAA`: the ✓. `null` without a target. */
  pacingToMaa: boolean | null;
  /**
   * ***New hire*** (ADR-0172 §2–3, P18.8-T5 AC-3): a new hire with no first sale by today — the server's
   * `COUNTS_FOR_PRODUCTION`, never worked out here. The row carries the tag; every total above it leaves the person out
   * of its production and its *On pace to be active*. `false` from the first sale's day.
   */
  newHireBeforeFirstSale: boolean;
  followUp: FollowUp | null;
  /**
   * *Chasing MDRT* (ADR-0122, P18.2-T7 AC-7): chasing `MDRT_QUALIFICATION`, not ended. `null` where the
   * reader's `campaign_qualification:read` does not reach the person: a plain —.
   */
  chasingMdrt: boolean | null;
  /** *Campaigns they're chasing* (D-19): chases of campaigns not ended, by title; `null` as above. */
  campaigns: ChasedRef[] | null;
}

/** A campaign a person is chasing, as the detail's chip names it. */
export interface ChasedRef {
  code: string;
  title: string;
}

/**
 * A total's goal, **paired** (ADR-0165 §1, P18.5-T15 AC-6): the targets and the production of the rows whose
 * production is held — every target when nobody's is, beside *Not uploaded yet*. `missing` counts the rows left
 * out, which the tooltip names; the shortfall and the excess are the server's, from the same pairs.
 */
export interface UnitTotalGoal {
  targetMinor: number | null;
  actualMinor: number | null;
  attainmentPct: number | null;
  missing: number;
  gapMinor: number | null;
  overMinor: number | null;
}

export interface PotentialActive {
  count: number;
  /** Manpower (UI-013): everybody the group holds, its head and every new hire included. */
  of: number;
}

/**
 * *Active Agent*'s tile (UI-013): out of manpower, with its *Unit* (head + direct agents), *AAB* (the rest of the head's
 * *Grup langsung*) and *AB* (everybody outside it; none in *Grup langsung* — ADR-0249 §3) split.
 */
export interface ActiveAgentTile extends PotentialActive {
  unit: PotentialActive;
  aab: PotentialActive;
  ab: PotentialActive;
}

export interface UnitTotal {
  goal: UnitTotalGoal;
  leadsCounts: LeadsCounts;
  /** The rows' *Closing* summed (UI-028). */
  closings: number;
  /** The rows' *Proposal* summed (P19.7-T2 AC-13), the server's. */
  proposalsMade: number;
  touches: CountAgainst;
  potentialActive: PotentialActive;
  /** The new hires before a first sale whom `goal` leaves out (ADR-0172 §2), named in its ⓘ — in `potentialActive.of`. */
  newHires: number;
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
  /** *n AAB*: the head's *Grup langsung* outside *Your Unit* (ADR-0249 §3). */
  aab: number;
  /** *n AB*, drawn while above 0: the rows outside the head's *Grup langsung*. `direct + aab + ab = total`. */
  ab: number;
  /** Of `total`, the new hires before a first sale: in the team, out of production, in *Active Agent*'s `of` (UI-013). */
  newHires: number;
}

/** *Direct Group production*: every row's goal, paired as a unit's total is (ADR-0165 §1). */
export interface GroupProductionTile extends UnitTotalGoal {
  period: 'month' | 'year';
}

export interface RecruitsTile {
  yourUnit: number;
  aabs: number;
  /** The rows outside the head's *Grup langsung*; 0 there. */
  abs: number;
}

export interface UnitTiles {
  team: TeamTile;
  directGroupProduction: GroupProductionTile;
  potentialActive: ActiveAgentTile;
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

/** *Chasing MDRT*'s header tooltip, composed by the server from the MDRT campaign (OD-152, ADR-0142). */
export interface MdrtHeader {
  running: boolean;
  tooltip: string;
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
  /**
   * **Drawn as that leader sees it, with no write** (P19.3-T3 AC-3; UI-152's Appendix D row): the Owner or an Admin
   * reading another leader's unit. The screen draws no *Update production* and no *+ Add agent*, and the server refuses
   * a save that names this unit.
   */
  readOnly: boolean;
  tiles: UnitTiles;
  yourUnit: YourUnit;
  units: UnitGroup[];
  /** *Belum punya leader*: the Owner's or an Admin's own *Semua downline* only; `null` otherwise (ADR-0249 §2). */
  unled: YourUnit | null;
  /** The view answered, the views offered and *Grup informal*'s line (ADR-0249). */
  scope: UnitView;
  scopes: UnitViews;
  informal: UnitInformal | null;
  production: UnitProductionState;
  mdrt: MdrtHeader;
  /** *Last updated* (UI-028): the office's day of its newest standing production import; `null` while it has none. */
  lastUpload: string | null;
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
export const readUnitDashboard = (params: { period?: UnitPeriod; for?: string; scope?: UnitView | null } = {}) =>
  api<UnitDashboardView>('/unit/dashboard' + query({ period: params.period, for: params.for, scope: params.scope ?? undefined }));

/** *+ Tambah ke grup*'s answer: the group, how many were tagged now, and its members today. */
export interface GroupMembersAdded {
  groupId: string;
  name: string;
  added: number;
  memberCount: number;
}

/**
 * ***+ Tambah ke grup*** (ADR-0249 §4): tag the ABs ticked into one group at once. The server checks every id, and the
 * group, before it writes anything; `member:tag_group`, the Owner's and an Admin's.
 */
export const addGroupMembers = (groupId: string, membershipIds: readonly string[]) =>
  api<GroupMembersAdded>(`/members/groups/${groupId}/members`, { method: 'POST', body: { membershipIds } });

/**
 * One row of *Update production*: this month's APE, when it changed. *Since P19.5-T2* (R4; ADR-0214 §10) the year to
 * date is the sum of the months and is never sent — the server refuses one (`400 VALIDATION_FAILED`).
 */
export interface ProductionUpdateRow {
  membershipId: string;
  apeMonthlyMinor?: number;
}

export interface ProductionUpdate {
  month: string;
  revision: number;
  /** The unit the dashboard was read for (its `for`), sent whenever it has one (P19.3-T3 AC-3). */
  for?: string;
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
 *
 * The catalogue's English, in the shapes the screens and the specs read them by before P18.10-T4. A screen reads the
 * reader's language instead: `useMessages(unitDashboardMessages)`.
 */

/** The strings `Overall.html` draws, verbatim (D-copy). */
export const PROTOTYPE_COPY = EN.prototype;

/**
 * The activity breakdown's three, in the cascade's words (ADR-0160 §4; P18.6-T2's cleanup, 2026-10-26) — the
 * Summary's chips'. The prototype reads *Leads contacted*, *Appointments* and *Closings* (`:7334-7336`). Kept in both
 * languages (§A.6).
 */
export const ACTIVITY_LABEL = EN.activity;

/** The pill's tooltip per status (`:7094-7098`), and ADR-0080's state, which the prototype never draws. */
export const STATUS_TOOLTIP: Record<RosterStatus, string> = EN.statusTooltip;

/**
 * The module's own strings — the states the prototype lacks, the marks it does not draw. None of OD-39's
 * six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*), no phase, no code.
 */
export const OWN_COPY = {
  ...EN.own,
  /** *produced Rp 29 Jt*: `sum` written by the caller (P18.7-T3 AC-2). */
  produced: (sum: string) => EN.own.produced({ sum }),
};

/**
 * **A total's count of members on pace, in plain words** (P18.7-T9 AC-4; UI-028): *On pace to be active: 6/12*,
 * where it read *6/12 potential active*. `POTENTIAL_MAA_COUNT_IN_UNIT`, a projection — not *Active this month*,
 * which is the analytics' `MAA_COUNT_IN_UNIT` (invariant §8).
 */
export const onPaceWords = (p: PotentialActive, language: Language = SOURCE_LANGUAGE): string =>
  wordsIn(language).onPace({ count: p.count, of: p.of });

/*
 * ── Rows ────────────────────────────────────────────────────────────────────────────────────────
 */

/** The first word of a name: *Agus* of *Agus Santoso*. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The reader's own row (`:6917`, *You (Jordan)*). */
export const readerName = (name: string, language: Language = SOURCE_LANGUAGE) =>
  wordsIn(language).you({ first: firstName(name) });

/** What a row is called on screen: the reader's own as *You ({first name})*, anybody else by name. */
export const rowName = (row: Pick<UnitRow, 'name' | 'isReader'>, language: Language = SOURCE_LANGUAGE) =>
  (row.isReader ? readerName(row.name, language) : row.name);

/** *agents* where the prototype counts people (`:7246`, `:7554`), singular at one. */
export const agentsCount = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).agents({ n });

/** *Potential Recruits*'s rows (`:7266-7270`). */
export const candidates = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).candidates({ n });

/** The toast after *Save all* (`:7554`), counting only the rows that changed (a Fix of every row counted). */
export const productionToast = (updated: number, language: Language = SOURCE_LANGUAGE) =>
  wordsIn(language).productionToast({ n: updated });

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
 *
 * **Compact, by the client's own example** (UI-030, ADR-0167 §1): *"Rp 357,5 Jt of 712,7 Jt"*, one `Rp` for the
 * pair, where *"Rp 357.500.000 of Rp 712.666.667"* wrapped in the cell — as every table's money is since ADR-0174
 * §4; the percentage whole (§1), *50% · Rp 355,2 Jt short*.
 */
export function goalWords(
  cell: {
    targetMinor: number | null;
    actualMinor: number | null;
    attainmentPct: number | null;
    overMinor?: number | null;
    gapMinor?: number | null;
    targetMet?: boolean;
    set?: boolean;
  },
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): GoalWords {
  const t = wordsIn(language);
  const { targetMinor: target, actualMinor: actual } = cell;
  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);
  // The production alone, with no target beside it, is labelled (P18.7-T3 AC-2): *produced Rp 29 Jt*.
  const produced = (sum: number) => t.own.produced({ sum: money(sum) });
  if (cell.set === false || target === null) {
    return { tone: 'none', line: t.own.noGoal, sub: actual === null ? null : produced(actual) };
  }
  // A target of 0 is only ever a month made already (ADR-0047; `periodFigures` answers `null` for no
  // target), on a row or on a total whose rows were all made: nothing to measure a percentage against.
  if (target === 0) {
    return { tone: 'over', line: t.own.targetMade, sub: actual === null ? t.own.notUploaded : produced(actual) };
  }
  if (actual === null) {
    // The Summary's own phrase beside its figure, *of {target} target*, under the missing one.
    return { tone: 'missing', line: t.own.notUploaded, sub: t.goal.ofTarget({ sum: money(target) }) };
  }
  const pct = formatPercent(cell.attainmentPct ?? 0, {}, figures);
  const met = cell.targetMet ?? actual >= target;
  const over = cell.overMinor ?? Math.max(0, actual - target);
  const short = cell.gapMinor ?? Math.max(0, target - actual);
  const sub = formatRupiahCompactPair(actual, target, t.goal.of, figures);
  return met
    ? { tone: 'over', line: t.goal.over({ pct, sum: money(over) }), sub }
    : { tone: 'short', line: t.goal.short({ pct, sum: money(short) }), sub };
}

/**
 * **A phone card's goal bar** (P18.7-T3 AC-1; the client's UI review, UI-010: *"one card per agent (name, status
 * chip, goal bar, …)"*): how far along the target the figures are, 0–100, or `null` where there is nothing to draw
 * — no target, none to measure against (a month made already), or no figure. An empty track would read as zero,
 * which *Not uploaded yet* is not (D-figures). The percentage is the server's; the table draws no bar.
 */
export function goalBar(figures: { targetMinor: number | null; actualMinor: number | null; attainmentPct: number | null; set?: boolean }): number | null {
  if (figures.set === false || figures.targetMinor === null || figures.targetMinor === 0 || figures.actualMinor === null) return null;
  return Math.min(100, Math.max(0, Math.round(figures.attainmentPct ?? 0)));
}

/** *"Sales: {n} · {m} closing"* (`:7399`). */
export const salesLine = (c: LeadsCounts, language: Language = SOURCE_LANGUAGE) =>
  ({ count: c.salesOpen, rest: wordsIn(language).leads.closing({ n: c.salesClosing }) });

/** *"Recruit: {n} · {m} nominated"*, or `null` for the prototype's *—* (`:7371-7373`). */
export const recruitLine = (c: LeadsCounts, language: Language = SOURCE_LANGUAGE) =>
  (c.recruitOpen > 0 || c.recruitNominated > 0
    ? { count: c.recruitOpen, rest: wordsIn(language).leads.nominated({ n: c.recruitNominated }) }
    : null);

/** A total's recruit line, *"{n} potential recruit"* or *"recruits"* (`:7443-7445`), or `null` for *—*. */
export const totalRecruitLine = (c: LeadsCounts, language: Language = SOURCE_LANGUAGE) =>
  (c.recruitNominated > 0
    ? { count: c.recruitNominated, rest: wordsIn(language).leads.potentialRecruits({ n: c.recruitNominated }) }
    : null);

/**
 * *"{logged} / {target} goal activities"* (`:7404-7405`, whose word was *touches* until ADR-0165 §2), its target
 * labelled *pro-rated* under *Last 7 days* (metrics §B.3); with no target the logged count alone, and no bar — an
 * empty track reads as zero. Singular at one, by the figure the word follows.
 */
export function touchesWords(
  touches: CountAgainst, period: UnitPeriod, language: Language = SOURCE_LANGUAGE,
): { logged: number; rest: string; pct: number | null } {
  const t = wordsIn(language);
  if (touches.target === null) return { logged: touches.logged, rest: t.own.goalActivities({ n: touches.logged }), pct: null };
  const pct = touches.target > 0 ? Math.min(100, Math.round((touches.logged / touches.target) * 100)) : 100;
  return { logged: touches.logged, rest: t.touchesOf({ target: touches.target, proRated: period === '7d' }), pct };
}

/** The activity breakdown's *"{logged}/{target}"* (`:7334-7336`), *pro-rated* under *Last 7 days*. */
export const countWords = (count: CountAgainst, period: UnitPeriod, language: Language = SOURCE_LANGUAGE) =>
  (count.target === null
    ? `${count.logged}`
    : wordsIn(language).countOf({ logged: count.logged, target: count.target, proRated: period === '7d' }));

/** *Gap*'s value and note (`:7326-7328`), or the cell's own *No goal set* / *Not uploaded yet*. */
export function gapWords(
  goal: GoalCell, language: Language = SOURCE_LANGUAGE, figures?: Language,
): { value: string; note: string | null } {
  const t = wordsIn(language);
  if (!goal.set || goal.targetMinor === null) return { value: t.own.noGoal, note: null };
  if (goal.targetMinor === 0) return { value: t.own.targetMade, note: t.own.targetMadeNote };
  if (goal.gapMinor === null) return { value: t.own.notUploaded, note: null };
  const policies = goal.policiesNeeded;
  return {
    value: t.gap.remaining({ sum: formatRupiahCompact(goal.gapMinor, {}, figures) }),
    note: policies === null
      ? null
      : t.gap.policies({ n: policies, sum: formatRupiahCompact(goal.caseSizeMinor, {}, figures) }),
  };
}

/**
 * The provenance marker's words (T3 AC-1): the Summary's in the coaching voice, which names the upload without
 * *office*, then **who corrected it and when**. The reader's own figure in Goal Settings is theirs; anybody else's is
 * *Their own figure*. The file's own figure has none. Whole sentences of the catalogue's, in `language`; the month and
 * the day in `figures`.
 */
export function provenanceWords(
  source: GoalSource | null, span: 'month' | 'year', own: boolean, language: Language = SOURCE_LANGUAGE, figures?: Language,
): string | null {
  if (!source || source.provenance === 'imported') return null;
  const t = wordsIn(language).provenance;
  // A figure a coach typed is never called the member's own (S2): it names who typed it.
  if (source.provenance === 'self_reported') return source.typedBy ? t.typedBy({ name: source.typedBy.name }) : own ? t.yours : t.theirs;
  return t.corrected({
    month: source.month ? formatMonth(source.month, figures) : null,
    span,
    by: source.correctedBy?.name ?? null,
    day: source.correctedBy && source.correctedAt ? formatOfficeDay(source.correctedAt, OFFICE_TIME_ZONE, figures) || null : null,
  });
}

/**
 * A total's mark when some of its rows hold no figure (D-figures): *"a total sums the figures held …
 * and names in its tooltip how many hold none"* — by name where the rows below say who.
 */
export function missingWords(missing: number, names: readonly string[], language: Language = SOURCE_LANGUAGE): string | null {
  if (missing <= 0) return null;
  return wordsIn(language).marks.missing({ who: names.length === missing ? names.join(', ') : null, n: missing });
}

/**
 * **A total's mark when it leaves out new hires before their first sale** (P18.8-T5 AC-4; ADR-0172 §2; UI-003, *"Unit
 * totals and the 'ⓘ' explanations match the new rule"*): *"No first sale yet for Yanti Kusuma, a new hire, so not
 * counted in this total."* — by name where the rows below say who, as `missingWords` does. On the goal's mark beside
 * `missingWords`' own sentence, and alone beside *On pace to be active*. `null` when nobody is left out.
 */
export function newHireWords(newHires: number, names: readonly string[], language: Language = SOURCE_LANGUAGE): string | null {
  if (newHires <= 0) return null;
  return wordsIn(language).marks.newHires({ who: names.length === newHires ? names.join(', ') : null, n: newHires });
}

/** A total's marks, together: who holds no figure, then who has no first sale yet; `null` when neither applies. */
export function totalNote(...notes: readonly (string | null)[]): string | null {
  const said = notes.filter((n): n is string => n !== null);
  return said.length === 0 ? null : said.join(' ');
}

/** The month the lock names, in the tooltip of the disabled *Update production*: its month in `figures`. */
export const lockedWords = (month: string, language: Language = SOURCE_LANGUAGE, figures?: Language) =>
  wordsIn(language).locked({ month: formatMonth(month, figures) });

/** *Overdue {n}d* (`:7292`). */
export const overdueTag = (days: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).overdue({ n: days });

/*
 * ── The tree ────────────────────────────────────────────────────────────────────────────────────
 */

/** A unit's rows in the server's order: its head, their members, then each unit nested in it. */
export function rowsOf(group: UnitGroup): UnitRow[] {
  return [group.head, ...group.members, ...group.units.flatMap(rowsOf)];
}

/** Everybody on the roster, as the coaching roster orders them (D-groups) — *Belum punya leader* last (ADR-0249 §2). */
export function everyRow(view: Pick<UnitDashboardView, 'yourUnit' | 'units'> & { unled?: YourUnit | null }): UnitRow[] {
  return [...view.yourUnit.rows, ...view.units.flatMap(rowsOf), ...(view.unled?.rows ?? [])];
}

/**
 * The names of the rows a total covers that hold no actual, for its mark — **not a new hire before a first sale**, whom
 * the total leaves out for that reason and names in `newHireWords` instead (ADR-0172 §2).
 */
export const namesMissing = (rows: readonly UnitRow[], language: Language = SOURCE_LANGUAGE) =>
  rows.filter((r) => r.goal.actualMinor === null && !r.newHireBeforeFirstSale).map((r) => rowName(r, language));

/** The names of the new hires before a first sale a total covers, whom it leaves out (P18.8-T5 AC-4). */
export const namesNewHires = (rows: readonly UnitRow[], language: Language = SOURCE_LANGUAGE) =>
  rows.filter((r) => r.newHireBeforeFirstSale).map((r) => rowName(r, language));

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
export function dialogGroups(
  view: Pick<UnitDashboardView, 'yourUnit' | 'units' | 'head'> & { unled?: YourUnit | null }, language: Language = SOURCE_LANGUAGE,
): DialogGroup[] {
  const t = wordsIn(language);
  const first = view.head.isReader ? t.prototype.yourDirectAgents : t.directAgentsOf({ name: view.head.name });
  return [
    { label: first, rows: view.yourUnit.rows.map((row) => ({ row, indent: 0 })) },
    ...view.units.map((unit) => ({
      label: t.unitLower({ name: unit.head.name }),
      rows: rowsOf(unit).map((row) => ({ row, indent: Math.max(0, row.depth - unit.head.depth) })),
    })),
    // ADR-0249 §2: the office-wide view's people with no leader, last.
    ...(view.unled && view.unled.rows.length > 0
      ? [{ label: t.views.unled, rows: view.unled.rows.map((row) => ({ row, indent: 0 })) }]
      : []),
  ];
}

/*
 * ── The dialog's figures ────────────────────────────────────────────────────────────────────────
 */

export type ProductionCadence = 'monthly' | 'ytd';

/**
 * A held figure as the dialog prefills it: whole rupiah, grouped in the reader's marks (P18.10-T3 AC-3) — `1.500.000`,
 * `1,500,000`; blank when nothing is held.
 */
export const prefill = (cell: ProductionCell, language: Language = DEFAULT_LANGUAGE) =>
  (cell.valueMinor === null ? '' : groupDigits(toMajor(cell.valueMinor), language));

/** What was typed, regrouped as it is typed, in the reader's marks; blank stays blank. Digits are read in either. */
export const regroup = (typed: string, language: Language = DEFAULT_LANGUAGE) =>
  (/\d/.test(typed) ? groupDigits(parseDigits(typed), language) : '');

/** The inputs, keyed by membership and cadence. */
export type ProductionInputs = Record<string, Record<ProductionCadence, string>>;

export function inputsOf(rows: readonly UnitRow[], language: Language = DEFAULT_LANGUAGE): ProductionInputs {
  return Object.fromEntries(rows.map((row) => [
    row.membershipId,
    { monthly: prefill(row.production.monthly, language), ytd: prefill(row.production.ytd, language) },
  ]));
}

/**
 * The rows *Save all* sends: **only the months that changed**. A box left as it was prefilled, or emptied,
 * is unchanged — a leader cannot clear a figure (ADR-0051) — and so is one typed back to the figure held.
 * Whole rupiah in, minor units out. **The year is never sent** (P19.5-T2; R4): it is the sum of the months, shown and
 * not typed.
 */
export function productionChanges(rows: readonly UnitRow[], inputs: ProductionInputs): ProductionUpdateRow[] {
  const changes: ProductionUpdateRow[] = [];
  for (const row of rows) {
    const typed = inputs[row.membershipId];
    if (!typed) continue;
    const monthly = changed(row.production.monthly, typed.monthly);
    if (monthly !== null) changes.push({ membershipId: row.membershipId, apeMonthlyMinor: monthly });
  }
  return changes;
}

function changed(cell: ProductionCell, typed: string): number | null {
  if (!/\d/.test(typed) || typed === prefill(cell)) return null;
  const minor = toMinor(parseDigits(typed));
  return minor === cell.valueMinor ? null : minor;
}

/*
 * ── UI V1 (Phase 18.11 T4, 2026-10-30) ───────────────────────────────────────────────────────────
 *
 * The owner's redesign of the page (`revisions/2026-10-30-ui-v1`, UI-001 to UI-012, UI-028): *Overview | Activities*,
 * the stat tiles, the roster's filter chips, its accordion on a phone and its compact tables, the row that opens the
 * person's Personal Summary, and the Activities tab's table and ratio card. Every figure is still the server's.
 */

/**
 * *Overview | Activities | Potensi* (UI-001; UI-155, P19.1-T6), kept in the address as `?tab=activities` and
 * `?tab=potensi` — a query, not a route.
 */
export type UnitTab = 'overview' | 'activities' | 'potensi';

export function tabFrom(value: string | string[] | null | undefined): UnitTab {
  const one = Array.isArray(value) ? value[0] : value;
  return one === 'activities' || one === 'potensi' ? one : 'overview';
}

/** *Minggu | Bulan* (UI-001): a week Monday to Sunday, or a calendar month. */
export type ActivitySpan = 'week' | 'month';

/** One period of the Activities tab, and where ‹ and › go from it. */
export interface ActivityPeriod {
  span: ActivitySpan;
  from: string;
  to: string;
  /** The period holds the office's today: › is disabled. */
  current: boolean;
  previous: string;
  next: string | null;
}

/** A count against one activity code; codes above zero only. */
export interface CodeCount {
  code: string;
  count: number;
}

/** One person's column. */
export interface ActivitiesPerson {
  membershipId: string;
  name: string;
  isReader: boolean;
  /** In the *Unit*: the head and their direct agents who lead nobody. Everybody is in the *Group*. */
  inUnit: boolean;
  /** Their profile photo, signed, when they have one (UI-111); initials otherwise. */
  photoUrl?: string | null;
  counts: CodeCount[];
  total: number;
}

/** A scope's *Total* column, summed by the server. */
export interface ScopeTotals {
  counts: CodeCount[];
  total: number;
}

export interface ActivitiesType {
  code: string;
  label: string;
  /**
   * ***Nama singkat*** (P19.8-T4 AC-5, MOB UI-180; ADR-0229 §5): the office's one line for the phone's table, `label` in
   * full on a tap; `null` for none, and the row shows `label` on up to two lines. Content, never translated.
   */
  shortLabel: string | null;
  status: 'active' | 'archived';
}

/** A section, as the office named and ordered it: content, never translated. */
export interface ActivitiesSection {
  code: string;
  label: string;
  status: 'active' | 'archived';
  types: ActivitiesType[];
}

export interface ActivitiesTotals {
  unit: ScopeTotals;
  group: ScopeTotals;
}

/** One member's five ratios (P19.8-T4 AC-7, MOB UI-184): their own Ratio page's, asked by `ratioFor`. */
export interface PersonRatios {
  membershipId: string;
  ratios: ActivityRatio[];
}

/** *Ratio · 30 hari terakhir* (UI-001): the Ratio page's ratios over the *Unit* and the *Group*, always the last 30 days. */
export interface ActivitiesRatios {
  from: string;
  to: string;
  days: number;
  unit: ActivityRatio[];
  group: ActivityRatio[];
  /** One person's, when the read named them (`ratioFor`); `null` otherwise. */
  person: PersonRatios | null;
}

/** `GET /unit/dashboard/activities` (UI-001). */
export interface UnitActivitiesView {
  today: string;
  period: ActivityPeriod;
  head: UnitHead;
  empty: boolean;
  sections: ActivitiesSection[];
  people: ActivitiesPerson[];
  totals: ActivitiesTotals;
  ratios: ActivitiesRatios;
}

/**
 * The Activities tab's read: the period holding `date` (the office's today when none), for the reader's unit or `for`
 * a leader's below them — 404 outside the reach, as the dashboard's own read. Each read of somebody else's counts is
 * audited. **`ratioFor`** (P19.8-T4 AC-7): a member of the Group whose own five ratios the card shows, in
 * `ratios.person`; anybody else is 404.
 */
export const readUnitActivities = (params: { span?: ActivitySpan; date?: string; for?: string; ratioFor?: string } = {}) =>
  api<UnitActivitiesView>('/unit/dashboard/activities' + query({
    span: params.span, date: params.date, for: params.for, ratioFor: params.ratioFor,
  }));

/** *Unit | Group* (UI-001; D-16). */
export type UnitScope = 'unit' | 'group';

/** A scope's people, in the roster's order. */
export const scopePeople = (view: Pick<UnitActivitiesView, 'people'>, scope: UnitScope) =>
  (scope === 'unit' ? view.people.filter((p) => p.inUnit) : view.people);

/** A person's or a total's count for a code: 0 where the server listed none. */
export const countOf = (counts: readonly CodeCount[], code: string) => counts.find((c) => c.code === code)?.count ?? 0;

/**
 * **A category's subtotal for some people** (P19.8-T4 AC-6, MOB UI-183; ADR-0229 §6): the counts of its types summed, as
 * the category row shows it for each person and in its *Total* — open or closed. A sum of the server's counts, by code.
 */
export const sectionCount = (counts: readonly CodeCount[], section: Pick<ActivitiesSection, 'types'>) =>
  section.types.reduce((sum, type) => sum + countOf(counts, type.code), 0);

/** The status the roster's chips filter by (UI-002, UI-005): *Perlu perhatian*, *Perlu dipantau*. */
export type RosterFilter = 'all' | 'needs_attention' | 'watch_closely';

/**
 * **No status without production** (P19.8-T4 AC-2, MOB UI-177; ADR-0229 §2; D-04): a row whose figure is not uploaded —
 * the row that reads *Belum diunggah* — carries no status pill and counts in no status chip. `GOAL_PACE_STATUS` is
 * unchanged as a metric (ADR-0092): the roster withholds it, the Coaching list keeps it (OD-285).
 */
export const statusShown = (row: Pick<UnitRow, 'goal'>) => row.goal.actualMinor !== null;

/** How many rows hold each status the chips name — a row with no production in none but *Semua* (MOB UI-177). */
export function statusTally(rows: readonly UnitRow[]): Record<RosterFilter, number> {
  const shown = rows.filter(statusShown);
  return {
    all: rows.length,
    needs_attention: shown.filter((r) => r.status === 'needs_attention').length,
    watch_closely: shown.filter((r) => r.status === 'watch_closely').length,
  };
}

export const matchesFilter = (row: UnitRow, filter: RosterFilter) =>
  filter === 'all' || (statusShown(row) && row.status === filter);

/**
 * **Where a row goes** (UI-011, the owner, 30 Oct: no inline expansion): the reader's own row to their own *Personal
 * Summary*; anybody the reader coaches to their agent page on the *Personal Summary* tab, with `from` — this page's
 * address — so its *‹* comes back here; `null` for somebody whose coaching pages would not be found (an Owner or an
 * Admin outside their own downline), whose row is read-only.
 */
export function rowHref(row: Pick<UnitRow, 'membershipId' | 'isReader' | 'coached'>, from: string): string | null {
  if (row.isReader) return '/summary';
  if (!row.coached) return null;
  return `/coaching/${encodeURIComponent(row.membershipId)}/summary?from=${encodeURIComponent(from)}`;
}

/**
 * A compact sum split into its figure and its unit, for a tile's big number with the unit small beside it (UI-003):
 * *Rp 333,5* and *Jt*; *IDR 333.5* and *M*. A sum with no unit (under a thousand) is all figure.
 */
export function splitMoney(text: string): { value: string; unit: string | null } {
  const match = /^(.*\d)\s?([A-Za-z]+)$/.exec(text);
  return match ? { value: match[1], unit: match[2] } : { value: text, unit: null };
}

/** A goal's share as a bar's width, 0–100, from the server's percentage, or `null` with nothing to draw (`goalBar`). */
export const goalShare = goalBar;

/** Green from 100%, red under it (UI-005: *% colour follows the 100% rule only*), judged on the unrounded value. */
export const goalMet = (attainmentPct: number) => attainmentPct >= 100;


/*
 * ── The *Potensi* tab (P19.1-T6, 2026-11-04) ─────────────────────────────────────────────────────────────────────────
 *
 * UI-155 and UI-159 item 4 (the 6 Nov handover; the Potensi stop-motion, frames 11–31; ADR-0193): two tiles that are the
 * switch, *AA* and *Rekrut*, and one list design for both — per unit, the leader first. **Every figure is the server's**
 * (`GET /unit/dashboard/potensi`, the three named metrics); this file orders the rows and picks the view's figures.
 */

/** A rung as the company's ladder names it: the role tag before a leader's name, *Agent Rina* on a button. */
export interface PotensiRung {
  code: string;
  label: string;
}

/** A person's *AA* view: *n potensi*, the ✓ (`AA_THIS_MONTH`), and how many sales leads they switched on. */
export interface PotensiAaCell {
  potensi: number;
  aa: boolean;
  switched: number;
}

/** A person's *Rekrut* view: *n potensi*, *n rekrut ✓* (`REKRUT_THIS_MONTH`), and how many kandidat they switched on. */
export interface PotensiRekrutCell {
  potensi: number;
  rekrut: number;
  switched: number;
}

/** One person on the tab. */
export interface PotensiPerson {
  membershipId: string;
  name: string;
  photoUrl: string | null;
  rung: PotensiRung;
  /** The card's leader: first, with the navy role tag before the name. */
  isLeader: boolean;
  isReader: boolean;
  /** Their sheet answers the reader (`lead:read`'s reach): the row opens it. */
  opens: boolean;
  aa: PotensiAaCell;
  rekrut: PotensiRekrutCell;
}

export interface PotensiAaTotals {
  potensi: number;
  aa: number;
  switchedPeople: number;
  switchedPeopleAa: number;
}

export interface PotensiRekrutTotals {
  potensi: number;
  rekrut: number;
  switchedPeople: number;
  switchedPeopleRekrut: number;
}

/** A card's sums: its header, and an earlier month's row. */
export interface PotensiTotals {
  aa: PotensiAaTotals;
  rekrut: PotensiRekrutTotals;
}

export interface PotensiLeader {
  membershipId: string;
  name: string;
  rung: PotensiRung;
}

/** One card: a unit below the head (`unit`), or the head and their direct agents (`direct`), last. */
export interface PotensiUnit {
  /** `unled`: *Belum punya leader*, last — the office-wide *Semua downline* only (ADR-0249 §2); it has no leader. */
  kind: 'unit' | 'direct' | 'unled';
  leader: PotensiLeader | null;
  people: PotensiPerson[];
  totals: PotensiTotals;
}

export interface PotensiHead {
  membershipId: string;
  name: string;
  isReader: boolean;
}

/** Each tile's ***potensi x*** (P19.8-T4 AC-9, MOB UI-186): people with a lead of that type switched on for the month. */
export interface PotensiTilesPotensi {
  aa: number;
  rekrut: number;
}

export interface PotensiTiles {
  aa: number;
  rekrut: number;
  potensi: PotensiTilesPotensi;
}

/** `GET /unit/dashboard/potensi`. */
export interface UnitPotensiView {
  month: string;
  /** The office's current month: an earlier `month` is drawn as one row per unit (AC-9). */
  currentMonth: string;
  today: string;
  head: PotensiHead;
  tiles: PotensiTiles;
  units: PotensiUnit[];
  /** The Overview's view, read the same way (ADR-0249). */
  scope: UnitView;
  scopes: UnitViews;
  informal: UnitInformal | null;
}

/** A switched-on sales lead on the AA sheet: the client's name (Q-2), its next step and its stage. */
export interface PotensiSalesLead {
  id: string;
  name: string;
  statusCode: string | null;
  nextActionDate: string | null;
  nextActionNote: string | null;
}

/** A kandidat on the Rekrut sheet: *Potensi*, or *Rekrut ✓ {date}* with the membership they became where linked. */
export interface PotensiKandidat {
  leadId: string;
  name: string;
  statusCode: string | null;
  state: 'potensi' | 'rekrut';
  rekrutOn: string | null;
  newHireMembershipId: string | null;
}

export interface PotensiSheetPerson {
  membershipId: string;
  name: string;
  rung: PotensiRung;
  phone: string | null;
  isReader: boolean;
}

export interface PotensiSheetUnit {
  name: string;
  rung: PotensiRung;
}

/** `GET /unit/dashboard/potensi/:membershipId`: the read-only sheet a row opens. */
export interface UnitPotensiPersonView {
  month: string;
  currentMonth: string;
  person: PotensiSheetPerson;
  unit: PotensiSheetUnit | null;
  sales: PotensiSalesLead[];
  kandidat: PotensiKandidat[];
}

/** The tab's read: a month (the office's current one when none) for the reader's unit or `for` a leader's below them. */
export const readUnitPotensi = (params: { month?: string; for?: string; scope?: UnitView | null } = {}) =>
  api<UnitPotensiView>('/unit/dashboard/potensi' + query({ month: params.month, for: params.for, scope: params.scope ?? undefined }));

/** A person's sheet for a month. A read of their leads, recorded by the server. */
export const readPotensiPerson = (membershipId: string, params: { month?: string } = {}) =>
  api<UnitPotensiPersonView>(`/unit/dashboard/potensi/${encodeURIComponent(membershipId)}` + query({ month: params.month }));

/** The tile chosen, which is the list's view: *AA* on open. */
export type PotensiView = 'aa' | 'rekrut';

/** A person's *n potensi* in a view. */
export const potensiOf = (person: Pick<PotensiPerson, 'aa' | 'rekrut'>, view: PotensiView) =>
  (view === 'aa' ? person.aa.potensi : person.rekrut.potensi);

/** A person's ✓ in a view: 1 for *AA ✓*, *n* for *n rekrut ✓*, 0 for none. */
export const doneOf = (person: Pick<PotensiPerson, 'aa' | 'rekrut'>, view: PotensiView) =>
  (view === 'aa' ? (person.aa.aa ? 1 : 0) : person.rekrut.rekrut);

/**
 * **A person's mark** (P19.8-T4 AC-9, MOB UI-186; ADR-0229 §8): their potensi as **an orange number**, **a green ✓** —
 * *Active Agent* this month on the first tile, a rekrut this month on the second — both when both hold, or **a grey ✕**
 * with neither. It replaced the *n potensi* pill and the *AA ✓* / *n rekrut ✓* pills.
 */
export function marksOf(person: Pick<PotensiPerson, 'aa' | 'rekrut'>, view: PotensiView): { potensi: number; done: boolean; none: boolean } {
  const potensi = potensiOf(person, view);
  const done = doneOf(person, view) > 0;
  return { potensi, done, none: potensi === 0 && !done };
}

/** A card's header numbers in a view: *n potensi · n AA*, or *n potensi · n rekrut*. */
export const cardCounts = (unit: Pick<PotensiUnit, 'totals'>, view: PotensiView) => (view === 'aa'
  ? { potensi: unit.totals.aa.potensi, done: unit.totals.aa.aa }
  : { potensi: unit.totals.rekrut.potensi, done: unit.totals.rekrut.rekrut });

/** An earlier month's row (AC-9): *x* of the *y* people with a potensi got the ✓, and the card's ✓ in all. */
export const pastCounts = (unit: Pick<PotensiUnit, 'totals'>, view: PotensiView) => (view === 'aa'
  ? { x: unit.totals.aa.switchedPeopleAa, y: unit.totals.aa.switchedPeople, done: unit.totals.aa.aa }
  : { x: unit.totals.rekrut.switchedPeopleRekrut, y: unit.totals.rekrut.switchedPeople, done: unit.totals.rekrut.rekrut });

/** The month picker's months: the office's current one first, then the eleven before it. */
export function potensiMonths(currentMonth: string, count = 12): string[] {
  const [y, m] = currentMonth.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
