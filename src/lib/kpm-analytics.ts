import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { api } from './api-client';
import {
  formatMonth, formatMonthName, formatNumber, formatPercent, formatRupiahCompact,
} from './format';
import type { Me } from './session';
import { firstMentions, termDefinition, termQuestion, type TermKey } from './terms';

/**
 * KPM analytics (Phase 18, P18-T2; `docs/02-specs/functional/kpm-analytics.md`): the console's *Unit
 * comparison* — one row per AB agency, its *(Direct)* and AAB rows, the total, each leader's MOC and the
 * club badge — and *Monthly production*, over one read per period (`GET /kpm/analytics`).
 *
 * **Every figure is the server's** (D-units, D-period, D-moc, D-clubs): each row's APE, coverage, active
 * agents and leads, each MOC verdict with its criteria, each club tier, and the total — which the server
 * makes the sum of its rows. This file names the shapes, asks for them, and turns them into the
 * prototype's words. It evaluates no rule and sums no rows: the only arithmetic here is the one the
 * prototype writes into a cell from figures it already shows — *Total leads* as sales plus recruitment
 * (`KPM_Owner.html:3327`). *Producing this month*'s percentage of the row's manpower (`:3342`) is **served**
 * since P18.97-T3 AC-10 (`activePct`, the server's `rateOver`; ADR-0176 §12), where this file divided it. The
 * status pill's split (`:3150`, `:3220`) is the server's too, served as `thresholds.statusSplitPct` (invariant §7).
 *
 * Each interface is spelled out with named nested types and no `extends`, so `contract.spec.ts` can read
 * its fields against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 *
 * **Its words are the catalogue's** (P18.98-T4; `i18n/messages/kpm-analytics.ts`): each function that writes words
 * takes the reader's `language` — English, the source, when passed none, which its spec reads — and one that writes a
 * figure takes the figures' language after it (`figures`, `useFigureLanguage()`; Indonesian when passed none, as every
 * figure was before the phase). Its caller passes `useLanguage()` and `useFigureLanguage()`.
 */

/** *This month* · *Previous month* (`:1240-1245`), as the address carries them (`?period=`). */
export type AnalyticsPeriod = 'this_month' | 'previous_month';

/** The two, in the select's order; each one's words are the catalogue's (`periods`). */
export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = ['this_month', 'previous_month'];

/** *This month* is selected first (`:1242`); an address naming no period, or one it does not know, reads it. */
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 'this_month';

export function analyticsPeriodFrom(value: string | string[] | null | undefined): AnalyticsPeriod {
  const one = Array.isArray(value) ? value[0] : value;
  return ANALYTICS_PERIODS.some((p) => p === one) ? (one as AnalyticsPeriod) : DEFAULT_ANALYTICS_PERIOD;
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
  /**
   * Its share of the members it counts from, the server's whole percent (P18.97-T3 AC-10; OD-235): this month's of
   * `manpower.total`, a past month's of that month's members. `null` not uploaded, or over nobody.
   */
  activePct: number | null;
  /**
   * **The members `activePct` is over** (OD-235, clarified 2026-10-29), served beside it so the cell writes its count
   * over the same members as its percent — *4 / 5 · 80%*, never *4 / 3 · 80%*. *Manpower* stays today's.
   */
  activeOf: number;
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
  activePct: number | null;
  activeOf: number;
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
  activePct: number | null;
  activeOf: number;
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
  activePct: number | null;
  activeOf: number;
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

/** The module's words in English, the catalogue's source. */
const EN = messagesIn(kpmAnalyticsMessages, SOURCE_LANGUAGE);

/**
 * **The strings `KPM_Owner.html` draws, in English** (D-copy), its literal counts computed (contradiction 11) — the
 * catalogue's source (`i18n/messages/kpm-analytics.ts`, P18.98-T4), in the shapes this module has always handed its
 * callers and its spec. **A screen reads the reader's language instead**: `useMessages(kpmAnalyticsMessages)`.
 *
 * - `headApeMonth`: `:3337` keeps *This Month* under *Previous month* while the column reads last month's file; the
 *   header says which month it is (a Fix, data honesty — parity F-174), as *Producing this month* does.
 * - `headActive`: the prototype's *Active this month* / *Active last month* (`:1248`, `:3367`), **named for what it
 *   counts since P18.97-T3 AC-9** (ADR-0176 §3, UI-021; parity I-508): production, apart from the Overview's *Agents
 *   who logged activity this month*, which counts logging (ADR-0127). The same `MAA_COUNT_IN_UNIT`.
 */
export const PROTOTYPE_COPY = {
  title: EN.title,
  subtitle: EN.subtitle,
  tabOverview: EN.tabOverview,
  tabCompliance: EN.tabCompliance,
  unitComparison: EN.unitComparison,
  unitComparisonSub: (n: number) => EN.unitComparisonSub({ n }),
  period: EN.period,
  headAb: EN.headAb,
  headManpower: EN.headManpower,
  headApeMonth: (period: AnalyticsPeriod) => EN.headApeMonth({ period }),
  headApeAnnual: EN.headApeAnnual,
  headCoached: EN.headCoached,
  headActive: (period: AnalyticsPeriod) => EN.headActive({ period }),
  headLeads: EN.headLeads,
  headMoc: EN.headMoc,
  you: EN.you,
  direct: (name: string) => EN.direct({ name }),
  tagAb: EN.tagAb,
  tagAab: EN.tagAab,
  seeAbove: (name: string) => EN.seeAbove({ name }),
  total: (n: number) => EN.total({ n }),
  absMeetingMoc: EN.absMeetingMoc,
  mocMet: EN.mocMet,
  mocNotMet: EN.mocNotMet,
  mocDialog: (name: string) => EN.mocDialog({ name }),
  requirementsMet: EN.requirementsMet,
  notYetMet: EN.notYetMet,
  met: EN.met,
  gap: EN.gap,
  monthlyProduction: EN.monthlyProduction,
  monthlySub: EN.monthlySub,
} as const;

/**
 * **The module's own strings, in English** — the states the prototype lacks and the names a screen reader needs, from
 * the catalogue's source as `PROTOTYPE_COPY` is. None of OD-39's six words (*office*, *KPM*, *reports to*, *tagged
 * to*, *untagged*, *unassigned*), no phase, no code (ADR-0084's rule, as Phases 14 to 17 applied it).
 *
 * `currentMembersOnly` is the line under the total's *APE — Annual* (P18.97-T3 AC-4; ADR-0176 §1, UI-016; parity
 * I-503): the agencies' sum, today's members — where the Overview's *Production — this year* keeps a leaver's
 * production (OD-74). Its ⓘ, beside the row's name, still names the sum it leaves out (`leaversLeftOut`).
 */
export const OWN_COPY = {
  leaversLeftOut: (amount: string) => EN.leaversLeftOut({ amount }),
  loading: EN.loading,
  tryAgain: EN.tryAgain,
  notUploaded: EN.notUploaded,
  noGoal: EN.noGoal,
  noAbTitle: EN.noAbTitle,
  noAbLine: EN.noAbLine,
  currentMembersOnly: EN.currentMembersOnly,
  expand: (name: string) => EN.expand({ name }),
  members: (name: string, n: number) => EN.members({ name, n }),
  newTab: EN.newTab,
  newTabOwn: EN.newTabOwn,
  mocFor: (verdict: string, name: string) => EN.mocFor({ verdict, name }),
  mocUnknown: (name: string, missing: string) => EN.mocUnknown({ name, missing }),
  close: EN.close,
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
 * above the server's split, *alert* below it (`:3150`, `:3220`). **Compact, in a table too** (ADR-0174 §4, UI-019):
 * *Rp 5,7 M of Rp 6 M target*, where it read *Rp 5.672.500.000*; the pill a whole percent (§1). Its words in
 * `language`, its figures in `figures`.
 */
export function moneyWords(
  money: AnalyticsMoney,
  splitPct: number,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): MoneyWords {
  const t = messagesIn(kpmAnalyticsMessages, language);
  return {
    actual: money.achievedMinor === null ? t.notUploaded : formatRupiahCompact(money.achievedMinor, {}, figures),
    uploaded: money.achievedMinor !== null,
    of: money.targetMinor === null ? t.noGoal : t.ofTarget({ target: formatRupiahCompact(money.targetMinor, {}, figures) }),
    pill: money.pct === null
      ? null
      : { text: formatPercent(money.pct, {}, figures), tone: money.pct >= splitPct ? 'success' : 'alert' },
  };
}

/** *Coached (7d)*: *"{n} / {m}"* and its percentage, *—* over nobody — figures only, in `figures`. */
export const rateWords = (rate: AnalyticsRate, figures?: Language) => ({
  main: `${rate.count} / ${rate.of}`,
  pct: rate.pct === null ? '—' : formatPercent(rate.pct, {}, figures),
});

/**
 * *Producing this month* (`:3342`): *"{n} / {of}"* and its share, as the prototype writes it; *Not uploaded yet* for a
 * month with no file, and *—* over nobody. **The share is the server's** (`activePct`, `rateOver`; P18.97-T3 AC-10,
 * invariant §7): this writes it and divides nothing.
 *
 * **The count is over the share's own base** (OD-235, clarified 2026-10-29): `activeOf`, the members the share is over
 * — this month's manpower, a past month's members on its last day — so *4 / 5 · 80%*, never *4 / 3 · 80%*. A row that
 * carries none (written before the base was served) reads its manpower, as the cell did.
 */
export function activeWords(
  row: Pick<UnitFigures, 'activeAgents' | 'activePct' | 'manpower'> & { activeOf?: number },
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): { main: string; pct: string | null } {
  if (row.activeAgents === null) return { main: messagesIn(kpmAnalyticsMessages, language).notUploaded, pct: null };
  const of = row.activeOf ?? row.manpower.total;
  return { main: `${row.activeAgents} / ${of}`, pct: row.activePct === null ? '—' : formatPercent(row.activePct, {}, figures) };
}

/** *Total leads* (`:3343`): the open sales and recruitment leads, and the line under them. */
export const leadsWords = (leads: AnalyticsLeads, language: Language = SOURCE_LANGUAGE) => ({
  total: leads.sales + leads.recruit,
  sub: messagesIn(kpmAnalyticsMessages, language).leadsSub(leads),
});

/** *"{n} AAB · {m} Agents"* under an agency's manpower (`:3240`); an AAB's own row says its agents alone (`:3357`). */
export const manpowerSub = (manpower: AnalyticsManpower, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(kpmAnalyticsMessages, language).manpowerSub(manpower);
export const agentsSub = (manpower: AnalyticsManpower, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(kpmAnalyticsMessages, language).agentsSub(manpower);

/** An AB row's name (`:3108`): the reader's own carries *(you)*. */
export const headName = (head: AnalyticsHead, language: Language = SOURCE_LANGUAGE) =>
  (head.isReader ? `${head.name} ${messagesIn(kpmAnalyticsMessages, language).you}` : head.name);

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
 * **Whether a name in the analytics opens anything for this reader** (ADR-0159 §2, P18.8-T5): the Owner and the Admins
 * open every leader's Unit Dashboard and every person page; a **Core Leader** — a field member reading the office —
 * opens their own unit alone (`isReader`), since another leader's Unit Dashboard and every person page are refused to
 * them. A name that leads them nowhere is plain text rather than a link to a refusal.
 */
export function drillsAnywhere(me: Pick<Me, 'membership'> | null, isReader: boolean): boolean {
  return Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin) || isReader;
}

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

/**
 * **The ⓘ after the *MOC* heading** (P18.97-T3 AC-8; ADR-0176 §3, UI-021; parity I-507): its name *What is MOC?* and
 * its bubble the glossary's one line (`TERMS.MOC`) **above the company's rules** as the server composes them
 * (`mocRulesText`) — one ⓘ, the prototype's tooltip on the header (`:1248`), now saying what MOC is before how it is
 * decided, rather than a second glyph beside it.
 */
export const mocTermName = termQuestion('MOC');
/** The ⓘ's line above the company's rules, in the words' `language` (P18.98-T4, the shared pieces' tips); English by default. */
export const mocTip = (rulesText: string, language: Language = SOURCE_LANGUAGE) =>
  [termDefinition('MOC', language), rulesText].filter((line) => line !== '').join('\n\n');

/** The three production clubs the glossary explains, each by the term its badge's words name. */
export const CLUB_TERM_KEYS: readonly TermKey[] = ['STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB'];

/**
 * **Which agency's badge first shows each club** (P18.97-T3 AC-8), in the table's order: `membershipId → term`, so the
 * ⓘ goes beside the first *Star Club*, the first *Elite Club* and the first *Chairman's Club* the reader meets, and
 * nowhere else. Read from the badge's own words (`firstMentions`), so a tier a company names otherwise takes none.
 */
export function clubTermFirsts(agencies: readonly Pick<AgencyRow, 'head' | 'club'>[]): Map<string, TermKey> {
  const found = firstMentions(agencies.map((a) => a.club?.label), CLUB_TERM_KEYS);
  return new Map(agencies.flatMap((a, i) => (found[i].length > 0 ? [[a.head.membershipId, found[i][0]] as const] : [])));
}

/**
 * The cell's button, named for its leader (`:3283`): *"MOC requirements met"* or *"… not yet met"*; an unknown one with
 * the server's sentence saying which input is missing.
 */
export function mocButtonName(moc: Moc, name: string, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(kpmAnalyticsMessages, language);
  if (moc.status === 'unknown') return t.mocUnknown({ name, missing: moc.missing ?? t.notUploaded });
  return t.mocFor({ verdict: moc.status === 'met' ? t.mocMet : t.mocNotMet, name });
}

/**
 * A criterion's figure or threshold, in the criterion's own unit: rupiah for Net APE, a percentage for
 * persistency, a count for the rest (`:3301-3313`). *—* for an input not uploaded. A figure, in `figures`.
 *
 * **Compact, and lossless** (ADR-0167 §1, ADR-0174 §3): *Rp 200 jt*; but a figure that compact writing would round
 * is written in full, so *Rp 199.960.000 / Rp 200 jt — Gap* can never read *Rp 200 jt / Rp 200 jt — Gap*. A
 * persistency — the carrier's figure and the rule's threshold — keeps the places it has and no *,0*: *74,96% / 75%*.
 */
export function criterionValue(code: string, value: number | null, figures?: Language): string {
  if (value === null) return '—';
  if (/APE/.test(code)) return formatRupiahCompact(value, { lossless: true }, figures);
  if (/PERSISTENCY/.test(code)) return formatPercent(value, { lossless: true }, figures);
  return formatNumber(value, { maxDecimals: 2 }, figures);
}

/** *Met*, *Gap*, or *Not uploaded yet* — never *Gap* for a figure nobody has (D-moc). */
export function criterionVerdict(met: boolean | null, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(kpmAnalyticsMessages, language);
  return met === null ? t.notUploaded : met ? t.met : t.gap;
}

const MONTH = /^(\d{4})-(\d{2})$/;

/**
 * The period a criterion was read over, as a sentence names it: a month (*Sep 2026*), a run of them
 * (*Agu – Sep 2026*, *Des 2025 – Jan 2026*), or the server's words as they came. Months, in `figures`.
 */
export function periodWords(period: string, figures?: Language): string {
  if (MONTH.test(period)) return formatMonth(period, figures);
  const run = /^(\d{4}-\d{2})\s*(?:\.\.|\/|–|—)\s*(\d{4}-\d{2})$/.exec(period);
  if (!run) return period;
  const [from, to] = [run[1], run[2]];
  if (from === to) return formatMonth(from, figures);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const first = sameYear ? formatMonth(from, figures).replace(/\s\d{4}$/, '') : formatMonth(from, figures);
  return `${first} – ${formatMonth(to, figures)}`;
}

/*
 * ── Monthly production ──────────────────────────────────────────────────────────────────────────
 */

/** A bar's label under it: *Mar*, *Okt* (`:3433`; `id-ID`, ADR-0167 §1); *Oct* in English. */
export function shortMonth(month: string, figures?: Language): string {
  return MONTH.test(month) ? formatMonthName(month, figures) : month;
}

export interface ChartBar {
  month: string;
  /** Percent of the tallest month held; `null` is a month with no file — a gap, never a zero bar. */
  height: number | null;
  value: string;
}

/** The six bars' heights against the tallest month held, and each value: its figure in `figures`, a gap in words. */
export function chartBars(
  monthly: readonly MonthlyProduction[],
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): ChartBar[] {
  const held = monthly.map((m) => m.apeMinor).filter((v): v is number => v !== null);
  const top = Math.max(0, ...held);
  const t = messagesIn(kpmAnalyticsMessages, language);
  return monthly.map(({ month, apeMinor }) => ({
    month,
    height: apeMinor === null ? null : top > 0 ? Math.round((apeMinor / top) * 100) : 0,
    // A bar's label is a chart's, compact (ADR-0167 §1): `Rp 1,2 M` fits over a bar where a full figure ran on.
    value: apeMinor === null ? t.notUploaded : formatRupiahCompact(apeMinor, {}, figures),
  }));
}
