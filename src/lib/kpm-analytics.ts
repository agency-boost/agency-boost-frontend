import { api } from './api-client';
import { formatMonth } from './format';
import { formatRupiah } from './goals';

/**
 * KPM analytics (Phase 18, P18-T2; `docs/02-specs/functional/kpm-analytics.md`): the console's *Unit
 * comparison* — one row per AB agency, its *(Direct)* and AAB rows, the total, each leader's MOC and the
 * club badge — and *Monthly production*, over one read per period (`GET /kpm/analytics`).
 *
 * **Every figure is the server's** (D-units, D-period, D-moc, D-clubs): each row's APE, coverage, active
 * agents and leads, each MOC verdict with its criteria, each club tier, and the total — which the server
 * makes the sum of its rows. This file names the shapes, asks for them, and turns them into the
 * prototype's words. It evaluates no rule and sums no rows: the only arithmetic here is the two the
 * prototype writes into a cell from figures it already shows — *Total leads* as sales plus recruitment
 * (`KPM_Owner.html:3327`), and *Active*'s percentage of the row's manpower (`:3342`). The status pill's
 * split (`:3150`, `:3220`) is the server's too, served as `thresholds.statusSplitPct` (invariant §7).
 *
 * Each interface is spelled out with named nested types and no `extends`, so `contract.spec.ts` can read
 * its fields against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** *This month* · *Previous month* (`:1240-1245`), as the address carries them (`?period=`). */
export type AnalyticsPeriod = 'this_month' | 'previous_month';

export const ANALYTICS_PERIODS: readonly { id: AnalyticsPeriod; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'previous_month', label: 'Previous month' },
];

/** *This month* is selected first (`:1242`); an address naming no period, or one it does not know, reads it. */
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 'this_month';

export function analyticsPeriodFrom(value: string | string[] | null | undefined): AnalyticsPeriod {
  const one = Array.isArray(value) ? value[0] : value;
  return ANALYTICS_PERIODS.some((p) => p.id === one) ? (one as AnalyticsPeriod) : DEFAULT_ANALYTICS_PERIOD;
}

/** A row's head: the AB, or the AAB who leads the unit. `isReader` is the reader's own row, *(you)*. */
export interface AnalyticsHead {
  membershipId: string;
  name: string;
  isReader: boolean;
  /** Has an active direct report: only a head who leads somebody has a Unit Dashboard to open. */
  leads: boolean;
}

export interface AnalyticsRung {
  code: string;
  label: string;
}

/** One name in the manpower toggle (`:3241-3252`). */
export interface AnalyticsMember {
  membershipId: string;
  name: string;
  rung: AnalyticsRung;
}

/** APE achieved against the members' own targets (OD-143). `null` achieved is *Not uploaded yet*, never 0. */
export interface AnalyticsMoney {
  achievedMinor: number | null;
  targetMinor: number | null;
  pct: number | null;
}

/** A count over a headcount; `pct` is `null` over nobody (*—*). */
export interface AnalyticsRate {
  count: number;
  of: number;
  pct: number | null;
}

/** *Total leads* (D-period): open at the period's month end, and the leads promised for that month. */
export interface AnalyticsLeads {
  sales: number;
  salesPotential: number;
  recruit: number;
  recruitPotential: number;
}

export interface AnalyticsManpower {
  aab: number;
  agents: number;
  total: number;
}

/** One criterion of the carrier's MOC rule, as read for its leader (OD-22). `met: null` is an input not uploaded. */
export interface MocCriterion {
  code: string;
  label: string;
  current: number | null;
  required: number;
  met: boolean | null;
  period: string;
}

export type MocStatus = 'met' | 'not_met' | 'unknown';

/**
 * `MOC_STATUS` for one leader (D-moc). `unknown` — an input not uploaded — draws *—* with `missing`, never
 * ✕. `path` is the dialog's closing sentence, which path met it or what is still needed.
 */
export interface Moc {
  status: MocStatus;
  path: string;
  criteria: MocCriterion[];
  missing: string | null;
}

/** The agency's highest production-club tier (D-clubs), named as the company names it. */
export interface AnalyticsClub {
  code: string;
  label: string;
}

/** A row's figures: an agency's *(Direct)* row (`:3355-3363`). */
export interface UnitFigures {
  head: AnalyticsHead;
  apeMonth: AnalyticsMoney;
  apeAnnual: AnalyticsMoney;
  coached7d: AnalyticsRate;
  /** `MAA_COUNT_IN_UNIT` for the period's month; `null` is *Not uploaded yet*. */
  activeAgents: number | null;
  leads: AnalyticsLeads;
  manpower: AnalyticsManpower;
}

/** An AAB's unit inside an agency, with that AAB's own MOC (`:3355-3363`). */
export interface AabUnitRow {
  head: AnalyticsHead;
  apeMonth: AnalyticsMoney;
  apeAnnual: AnalyticsMoney;
  coached7d: AnalyticsRate;
  activeAgents: number | null;
  leads: AnalyticsLeads;
  manpower: AnalyticsManpower;
  moc: Moc | null;
}

/** One AB's agency (D-units): its row, its badge and MOC, its *(Direct)* and AAB rows, and its people. */
export interface AgencyRow {
  head: AnalyticsHead;
  apeMonth: AnalyticsMoney;
  apeAnnual: AnalyticsMoney;
  coached7d: AnalyticsRate;
  activeAgents: number | null;
  leads: AnalyticsLeads;
  manpower: AnalyticsManpower;
  club: AnalyticsClub | null;
  moc: Moc | null;
  direct: UnitFigures;
  aabUnits: AabUnitRow[];
  members: AnalyticsMember[];
}

/** *Total — all {n} ABs* (`:3386-3396`): the sum of the rows, and how many ABs meet MOC. */
export interface AnalyticsTotal {
  /**
   * The year to date of members who left this year, which the rows leave out (ADR-0136): the total is the
   * sum of today's rows, and says so beside it. `null` or 0 when nobody left.
   */
  leaversExcludedMinor: number | null;
  apeMonth: AnalyticsMoney;
  apeAnnual: AnalyticsMoney;
  coached7d: AnalyticsRate;
  activeAgents: number | null;
  leads: AnalyticsLeads;
  manpower: AnalyticsManpower;
  abCount: number;
  mocMet: number;
  mocOf: number;
}

/** One bar of *Monthly production* (`:3429-3445`); `null` is a month with no file, drawn as a gap. */
export interface MonthlyProduction {
  month: string;
  apeMinor: number | null;
}

/** The split a row's status pill is coloured by (`KPM_REPORTING.STATUS_SPLIT_PCT`), so no screen re-declares it. */
export interface AnalyticsThresholds {
  statusSplitPct: number;
}

export interface KpmAnalyticsView {
  period: AnalyticsPeriod;
  /** The period's month, `YYYY-MM`, in the office's calendar. */
  month: string;
  thresholds: AnalyticsThresholds;
  /**
   * The MOC header's rules, composed by the server from **the company's own MOC rules** in the prototype's
   * sentence (`KPM_Owner.html:1248`): never the prototype's numbers re-declared here (invariant §7).
   */
  mocRulesText: string;
  agencies: AgencyRow[];
  total: AnalyticsTotal;
  /** The six months before this one, oldest first. */
  monthly: MonthlyProduction[];
}

/**
 * The comparison for a period. Owner and Admin (`kpm_analytics:read`); a period or a parameter the read
 * does not know is a 400, so the screen sends only one of the two it offers. Appended with `+`, never
 * interpolated: the API-consumer gate reads path **literals** out of each call.
 */
export const readKpmAnalytics = (period: AnalyticsPeriod = DEFAULT_ANALYTICS_PERIOD) =>
  api<KpmAnalyticsView>('/kpm/analytics' + `?period=${period}`);

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The ABs counted: *"ABs"*, and *"AB"* for one. */
const abs = (n: number) => `${n} AB${n === 1 ? '' : 's'}`;

/** The strings `KPM_Owner.html` draws, verbatim (D-copy), its literal counts computed (contradiction 11). */
export const PROTOTYPE_COPY = {
  title: 'KPM Analytics',
  subtitle: 'Unit comparisons, club qualification, and trends',
  tabOverview: 'Overview',
  tabCompliance: 'Compliance, Events, and Campaigns',
  unitComparison: 'Unit comparison',
  unitComparisonSub: (n: number) => `All ${abs(n)}, this year — peer benchmark, always shown at group level`,
  period: 'Period',
  headAb: 'AB',
  headManpower: 'Manpower',
  /**
   * `:3337` keeps *This Month* under *Previous month* while the column reads last month's file; the header
   * says which month it is (a Fix, data honesty — parity F-174), as *Active this month* already does.
   */
  headApeMonth: (period: AnalyticsPeriod) => (period === 'this_month' ? 'APE — This Month' : 'APE — Last Month'),
  headApeAnnual: 'APE — Annual',
  headCoached: 'Coached (7d)',
  headActive: (period: AnalyticsPeriod) => (period === 'this_month' ? 'Active this month' : 'Active last month'),
  headLeads: 'Total leads',
  headMoc: 'MOC',
  /** The MOC header's tooltip (`:3247`), its two lines kept. */
  you: '(you)',
  direct: (name: string) => `${name} (Direct)`,
  tagAb: 'AB',
  tagAab: 'AAB',
  seeAbove: (name: string) => `See ${name} above`,
  total: (n: number) => `Total — all ${abs(n)}`,
  absMeetingMoc: 'ABs meeting MOC',
  mocMet: 'MOC requirements met',
  mocNotMet: 'MOC requirements not yet met',
  mocDialog: (name: string) => `${name} — Maintenance of Contract`,
  requirementsMet: 'Requirements met',
  notYetMet: 'Not yet met',
  met: 'Met',
  gap: 'Gap',
  monthlyProduction: 'Monthly production',
  monthlySub: 'Last 6 months, combined APE — whole group',
} as const;

/**
 * The module's own strings — the states the prototype lacks and the names a screen reader needs. None of
 * OD-39's six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*), no phase, no
 * code (ADR-0084's rule, as Phases 14 to 17 applied it).
 */
export const OWN_COPY = {
  /** The total's mark when people who left this year produced APE the rows no longer carry (ADR-0136). */
  leaversLeftOut: (amount: string) =>
    `Leaves out ${amount} produced this year by members who have since left; the Overview’s year counts it.`,
  loading: 'Loading the unit comparison…',
  tryAgain: 'Try again',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  noAbTitle: 'There are no ABs to compare yet.',
  noAbLine: 'Each AB’s agency gets a row here, with its people and its figures.',
  /** The ⓘ beside *MOC*, as the Unit Dashboard names the one beside *Status*. */
  mocRulesName: 'How is MOC decided?',
  expand: (name: string) => `Units in ${name}’s agency`,
  /** After the manpower figure, which is the toggle's visible name: *"31 people in Hendra Wibowo’s agency"*. */
  members: (name: string, n: number) => ` ${n === 1 ? 'person' : 'people'} in ${name}’s agency`,
  /** After a leader's name, which is the link's visible name (WCAG 2.5.3): the drill opens a new tab. */
  newTab: ' (opens their Unit Dashboard in a new tab)',
  newTabOwn: ' (opens your Unit Dashboard in a new tab)',
  mocFor: (verdict: string, name: string) => `${verdict} for ${name}`,
  mocUnknown: (name: string, missing: string) => `MOC for ${name} — ${missing}`,
  close: 'Close',
} as const;

/*
 * ── Cells ───────────────────────────────────────────────────────────────────────────────────────
 */

export type PillTone = 'success' | 'alert';

export interface MoneyWords {
  /** The achieved figure, or *Not uploaded yet*. */
  actual: string;
  uploaded: boolean;
  /** *"of {target} target"*, or *No goal set* where nobody in the row has one. */
  of: string;
  pill: { text: string; tone: PillTone } | null;
}

/**
 * An APE cell (`apeCellHtml`, `:3229-3231`): the figure, *"of {target} target"* and the pill — *success* at or
 * above the server's split, *alert* below it (`:3150`, `:3220`).
 */
export function moneyWords(money: AnalyticsMoney, splitPct: number): MoneyWords {
  return {
    actual: money.achievedMinor === null ? OWN_COPY.notUploaded : formatRupiah(money.achievedMinor),
    uploaded: money.achievedMinor !== null,
    of: money.targetMinor === null ? OWN_COPY.noGoal : `of ${formatRupiah(money.targetMinor)} target`,
    pill: money.pct === null
      ? null
      : { text: `${money.pct}%`, tone: money.pct >= splitPct ? 'success' : 'alert' },
  };
}

/** *Coached (7d)*: *"{n} / {m}"* and its percentage, *—* over nobody. */
export const rateWords = (rate: AnalyticsRate) => ({
  main: `${rate.count} / ${rate.of}`,
  pct: rate.pct === null ? '—' : `${rate.pct}%`,
});

/**
 * *Active this month* (`:3342`): *"{n} / {manpower}"* and its share of the row's manpower, as the prototype
 * writes it; *Not uploaded yet* for a month with no file, and *—* over nobody.
 */
export function activeWords(active: number | null, manpower: number): { main: string; pct: string | null } {
  if (active === null) return { main: OWN_COPY.notUploaded, pct: null };
  return { main: `${active} / ${manpower}`, pct: manpower > 0 ? `${Math.round((active / manpower) * 100)}%` : '—' };
}

/** *Total leads* (`:3343`): the open sales and recruitment leads, and the line under them. */
export const leadsWords = (leads: AnalyticsLeads) => ({
  total: leads.sales + leads.recruit,
  sub: `${leads.sales} sales (${leads.salesPotential} potential) · ${leads.recruit} recruit (${leads.recruitPotential} potential)`,
});

/** *"{n} AAB · {m} Agents"* under an agency's manpower (`:3240`); an AAB's own row says its agents alone (`:3357`). */
export const manpowerSub = (manpower: AnalyticsManpower) => `${manpower.aab} AAB · ${manpower.agents} Agents`;
export const agentsSub = (manpower: AnalyticsManpower) => `${manpower.agents} Agents`;

/** An AB row's name (`:3108`): the reader's own carries *(you)*. */
export const headName = (head: AnalyticsHead) => (head.isReader ? `${head.name} ${PROTOTYPE_COPY.you}` : head.name);

/*
 * ── Drills (D-drill) ────────────────────────────────────────────────────────────────────────────
 */

/**
 * A leader's Unit Dashboard, from the comparison (`:4865`, in a new tab). The reader's own is
 * `/unit/dashboard`: the page of one's own id answers *not a unit you can open* (P15-T4 AC-2).
 */
export const unitDashboardHref = (head: Pick<AnalyticsHead, 'membershipId' | 'isReader'>) =>
  (head.isReader ? '/unit/dashboard' : `/unit/dashboard/${head.membershipId}`);

/**
 * Where a card of the console's Org tree goes (D-drill): somebody with a direct report to their Unit
 * Dashboard, in the same tab; anybody else to the person page, as built (parity I-34).
 */
export function orgTreeHref(node: { membershipId: string; directCount: number; isSelf: boolean }): string {
  if (node.directCount > 0) return unitDashboardHref({ membershipId: node.membershipId, isReader: node.isSelf });
  return `/people/members/${node.membershipId}`;
}

/*
 * ── MOC ─────────────────────────────────────────────────────────────────────────────────────────
 */

/** The cell's button, named for its leader (`:3283`): *"MOC requirements met"* or *"… not yet met"*. */
export function mocButtonName(moc: Moc, name: string): string {
  if (moc.status === 'unknown') return OWN_COPY.mocUnknown(name, moc.missing ?? OWN_COPY.notUploaded);
  return OWN_COPY.mocFor(moc.status === 'met' ? PROTOTYPE_COPY.mocMet : PROTOTYPE_COPY.mocNotMet, name);
}

/**
 * A criterion's figure or threshold, in the criterion's own unit: rupiah for Net APE, a percentage for
 * persistency, a count for the rest (`:3301-3313`). *—* for an input not uploaded.
 */
export function criterionValue(code: string, value: number | null): string {
  if (value === null) return '—';
  if (/APE/.test(code)) return formatRupiah(value);
  if (/PERSISTENCY/.test(code)) return `${value}%`;
  return String(value);
}

/** *Met*, *Gap*, or *Not uploaded yet* — never *Gap* for a figure nobody has (D-moc). */
export const criterionVerdict = (met: boolean | null) =>
  (met === null ? OWN_COPY.notUploaded : met ? PROTOTYPE_COPY.met : PROTOTYPE_COPY.gap);

const MONTH = /^(\d{4})-(\d{2})$/;

/**
 * The period a criterion was read over, as a sentence names it: a month (*September 2026*), a run of them
 * (*August – September 2026*, *December 2025 – January 2026*), or the server's words as they came.
 */
export function periodWords(period: string): string {
  if (MONTH.test(period)) return formatMonth(period);
  const run = /^(\d{4}-\d{2})\s*(?:\.\.|\/|–|—)\s*(\d{4}-\d{2})$/.exec(period);
  if (!run) return period;
  const [from, to] = [run[1], run[2]];
  if (from === to) return formatMonth(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const first = sameYear ? formatMonth(from).replace(/\s\d{4}$/, '') : formatMonth(from);
  return `${first} – ${formatMonth(to)}`;
}

/*
 * ── Monthly production ──────────────────────────────────────────────────────────────────────────
 */

/** A bar's label under it: *Mar* (`:3433`). */
export function shortMonth(month: string): string {
  const m = MONTH.exec(month);
  if (!m) return month;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export interface ChartBar {
  month: string;
  /** Percent of the tallest month held; `null` is a month with no file — a gap, never a zero bar. */
  height: number | null;
  value: string;
}

/** The six bars' heights against the tallest month held, and each value in words. */
export function chartBars(monthly: readonly MonthlyProduction[]): ChartBar[] {
  const held = monthly.map((m) => m.apeMinor).filter((v): v is number => v !== null);
  const top = Math.max(0, ...held);
  return monthly.map(({ month, apeMinor }) => ({
    month,
    height: apeMinor === null ? null : top > 0 ? Math.round((apeMinor / top) * 100) : 0,
    value: apeMinor === null ? OWN_COPY.notUploaded : formatRupiah(apeMinor),
  }));
}
