import { shortOfRung } from '@/components/ui/role-badge';
import { api } from './api-client';
import { formatMonth, formatPercent, formatRupiahCompact, formatRupiahCompactPair } from './format';

/**
 * The KPM Overview (P18-T1, `KPM_Owner.html:936-1222`): the whole office in one scroll — Team composition,
 * Engagement, Coaching coverage, Recruitment pipeline and Production this year — over one read of the
 * server's (`GET /kpm/overview`), the not-logged list read only when it is opened, and the recruitment
 * target's write.
 *
 * **Every figure is the server's** (D-figures): the headcount, the rates, the coverage, the leaderboard,
 * the pipeline and the production are each computed by the function the module owning them already uses.
 * This file names the shapes, asks for them, and turns them into the prototype's words. Its only
 * arithmetic is over two figures the server sent — the trend's change against last month, the pill's
 * *ahead* or *short*, where the projection marker sits — which the prototype does in the same place
 * (`:977`, `:4875-4889`, `:1086`).
 *
 * **No figure is 0 for want of data.** A `null` money figure is *Not uploaded yet*, a rate over nobody
 * is *—*, and a total names in its tooltip what it leaves out.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** A member named on the Overview: a leader on the leaderboard, an agency or an AAB unit's head. */
export interface OverviewPerson {
  membershipId: string;
  name: string;
}

/** One rung of the company's ladder, in its order, with its label, and how many hold it. */
export interface OverviewRungCount {
  code: string;
  label: string;
  count: number;
}

/** A count over a denominator. `pct` is `null` over nobody: *—*, never 0%. */
export interface OverviewRate {
  count: number;
  of: number;
  pct: number | null;
}

/** Production against a target. `achievedMinor` `null` is *Not uploaded yet*; `targetMinor` `null` is no goal. */
export interface OverviewMoney {
  achievedMinor: number | null;
  targetMinor: number | null;
  pct: number | null;
}

/** The sub-line's three parts: *"{company} · KPM {code} — {branch}"* (`:933`). */
export interface OverviewOffice {
  companyName: string;
  code: string;
  branch: string;
}

/** OD-24's headcount, and one count per rung of the company's ladder, summing to it. */
export interface OverviewComposition {
  total: number;
  newThisMonth: number;
  rungs: OverviewRungCount[];
}

/**
 * OD-142's card, *Agents who logged activity this month*: who logged at least one activity this month,
 * and how many had by the same day last month (`null` when there is nothing to compare against).
 */
export interface LoggedThisMonth {
  count: number;
  of: number;
  pct: number | null;
  lastMonthToDate: number | null;
}

/** *Activity logging — this week*: `ACTIVITY_COMPLIANCE_RATE` over the last 7 days. */
export interface LoggedThisWeek {
  logged: number;
  notLogged: number;
  pct: number | null;
}

export interface OverviewEngagement {
  loggedThisMonth: LoggedThisMonth;
  loggedThisWeek: LoggedThisWeek;
}

/** One AB with a downline on *AB coaching frequency*: `LEADER_COACHING_FREQUENCY`, the last 7 days. */
export interface LeaderboardRow {
  membershipId: string;
  name: string;
  teamSize: number;
  coached: number;
  pct: number | null;
}

/** `COACHING_COVERAGE` over the office, both windows, and the leaderboard lowest first. */
export interface OverviewCoaching {
  coverage7d: OverviewRate;
  coverage30d: OverviewRate;
  leaderboard: LeaderboardRow[];
}

/**
 * The pipeline's four tiles (D-recruit). `target` is the office's for this month, carried from the latest
 * earlier month that has one; `null` on an office that never set one, and then no pill is drawn.
 */
export interface OverviewRecruitment {
  expectedToClose: number;
  pipelineNow: number;
  closedLastMonth: number;
  target: number | null;
  targetMonth: string;
}

/**
 * Year-to-date APE against the sum of the members' goals (OD-143), with what the total leaves out: the
 * months of the year with no file, and how many members have no goal.
 */
export interface OverviewYtd {
  achievedMinor: number | null;
  targetMinor: number | null;
  pct: number | null;
  missingMonths: string[];
  membersWithoutGoal: number;
}

/** An AAB's unit inside an AB agency. */
export interface OverviewAabUnit {
  membershipId: string;
  name: string;
  achievedMinor: number | null;
  targetMinor: number | null;
  pct: number | null;
}

/** An AB agency (D-units), with the AAB units inside it. */
export interface OverviewAgency {
  membershipId: string;
  name: string;
  achievedMinor: number | null;
  targetMinor: number | null;
  pct: number | null;
  aabUnits: OverviewAabUnit[];
}

/** The year so far, the run-rate projection (`null` until a month is held), and the agencies lowest first. */
export interface OverviewProduction {
  ytd: OverviewYtd;
  projectionMinor: number | null;
  agencies: OverviewAgency[];
}

/** `GET /kpm/overview`: one read for the whole screen. */
/** The bounds the API serves with the read (invariant §7): the 70% split, `KPM_REPORTING.STATUS_SPLIT_PCT`. */
export interface OverviewThresholds {
  statusSplitPct: number;
}

export interface KpmOverviewView {
  office: OverviewOffice;
  thresholds: OverviewThresholds;
  today: string;
  month: string;
  year: string;
  composition: OverviewComposition;
  engagement: OverviewEngagement;
  coaching: OverviewCoaching;
  recruitment: OverviewRecruitment;
  production: OverviewProduction;
}

/** A rung as the not-logged list names it. */
export interface NotLoggedRung {
  code: string;
  label: string;
}

/** Somebody who has not logged in the last 7 days. `daysSince` `null` is *Never logged*. */
export interface NotLoggedMember {
  membershipId: string;
  name: string;
  rung: NotLoggedRung;
  lastLoggedOn: string | null;
  daysSince: number | null;
}

/** `GET /kpm/overview/not-logged`: everybody silent for 7 days, longest silent first, and how many. */
export interface NotLoggedList {
  total: number;
  members: NotLoggedMember[];
}

/** The office's recruitment target for a month, as written and as answered. */
export interface RecruitTarget {
  month: string;
  target: number;
}

/** The Overview, read whole. The server answers 403 to a field member and refuses any query parameter. */
export const readKpmOverview = () => api<KpmOverviewView>('/kpm/overview');

/**
 * The not-logged list, read **only when *View who hasn't logged →* is opened**: each member it names is
 * an audited read of their activity (D-audit), so the card alone writes nothing.
 */
export const readNotLogged = () => api<NotLoggedList>('/kpm/overview/not-logged');

/**
 * The target for the office's current month (D-recruit), audited by the server with before and after.
 * Another month, or anything but a whole number from 0, is refused 400.
 */
export const saveRecruitTarget = (body: RecruitTarget) =>
  api<RecruitTarget>('/kpm/overview/recruit-target', { method: 'PUT', body });

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The strings `KPM_Owner.html` draws, verbatim (D-copy), with OD-142's title for the first card. */
export const PROTOTYPE_COPY = {
  /**
   * The prototype's *KPM Overview* (`:2027`), **the nav item's word since P18.95-T9 AC-2** (ADR-0167 §10, OD-205;
   * UI-027, *menu labels = page titles*): the nav reads *Overview* (`:873`).
   */
  title: 'Overview',
  composition: 'Team composition',
  engagement: 'Engagement',
  engagementSub: 'Last 7 days',
  coaching: 'Coaching coverage',
  recruitment: 'Recruitment pipeline',
  production: 'Production — this year',
  totalMembers: 'Total members',
  /** OD-142 (ADR-0127 onward): the title says what the figure counts; the sub-line is the prototype's. */
  loggedMonthTitle: 'Agents who logged activity this month',
  loggedMonthDesc: 'Logged at least one activity this month',
  weekTitle: 'Activity logging — this week',
  weekDesc: "Who has and hasn't logged in the last 7 days",
  reveal: "View who hasn't logged →",
  neverLogged: 'Never logged',
  coached7d: 'Coached in last 7 days',
  coached30d: 'Coached in last 30 days',
  leaderboard: 'AB coaching frequency',
  viewFullRanking: 'view full ranking →',
  expectedToClose: 'Expected to close',
  target: 'Target',
  lastMonth: 'Last month',
  pipelineNow: 'Pipeline now',
  unitsTitle: 'Units furthest behind target',
  unitsSub: 'Tap a row to see the AABs inside that unit',
  noAab: 'No AAB in this unit yet',
  legendZero: '0',
} as const;

/**
 * The module's own strings — the states the prototype lacks. None of OD-39's six words, no phase, no code.
 */
export const OWN_COPY = {
  loading: 'Loading the overview…',
  loadingList: 'Loading who has not logged…',
  tryAgain: 'Try again',
  notUploaded: 'Not uploaded yet',
  noGoal: 'No goal set',
  noTarget: 'No target set',
  everybodyLogged: 'Everybody has logged in the last 7 days.',
  noLeaders: 'No AB leads a team yet.',
  noUnits: 'No AB leads a unit yet.',
  showFewer: 'show fewer',
  targetInvalid: 'Enter a whole number from 0.',
  targetNotSaved: 'The target was not saved.',
  /** The figure's own name when it is shown as a dash: a screen reader hears *no rate*, not *dash*. */
  noRate: 'No rate: nobody to count',
} as const;

/*
 * ── Words built from figures ────────────────────────────────────────────────────────────────────
 */

/** The sub-line: *"Prudential · KPM 0417 — BSD City Branch"* (`:933`). */
export const officeLine = (office: OverviewOffice) => `${office.companyName} · KPM ${office.code} — ${office.branch}`;

/** *"+6 new this month"* (`:946`). */
export const newThisMonth = (n: number) => `+${n} new this month`;

/** A percentage the server computed, to one decimal (ADR-0167 §1), or *—* over nobody. */
export const pctText = (pct: number | null) => (pct === null ? '—' : formatPercent(pct));

/**
 * How a percentage is painted: the prototype's 70% split (`:3150`, `:3220`), which every status class on
 * the Overview agrees with (76% and 79% green; 60%, 63% and 67% red). `null` — a rate over nobody — is
 * neither: it is muted, never red.
 */

export type Tone = 'success' | 'alert' | 'neutral';

export function toneOf(pct: number | null, split: number): Tone {
  if (pct === null) return 'neutral';
  return pct >= split ? 'success' : 'alert';
}

/** The trend under OD-142's card, against last month **to the same day** (D-figures). */
export interface TrendWords {
  direction: 'up' | 'down' | 'same';
  lead: string;
  change: string | null;
}

/**
 * *"Up from 138 last month (+3,0%)"* (`:977`) or *"Down from …"*; the change is relative to last month's
 * figure, rounded — 142 against 138 is +3% — and written to one decimal (ADR-0167 §1). With nothing logged by this day last month there is no
 * percentage to give, so the line stops at the figure. `null` — nothing to compare against — draws no line.
 */
export function trendWords(now: number, lastMonthToDate: number | null): TrendWords | null {
  if (lastMonthToDate === null) return null;
  if (now === lastMonthToDate) return { direction: 'same', lead: `Same as last month (${now})`, change: null };
  const direction = now > lastMonthToDate ? 'up' : 'down';
  const lead = `${direction === 'up' ? 'Up' : 'Down'} from ${lastMonthToDate} last month`;
  if (lastMonthToDate === 0) return { direction, lead, change: null };
  const pct = Math.round((Math.abs(now - lastMonthToDate) / lastMonthToDate) * 100);
  return { direction, lead, change: `${direction === 'up' ? '+' : '−'}${formatPercent(pct)}` };
}

/**
 * A rung as the not-logged list writes it after a name — *"Rina Agustina — AAB"*, *"Dedy Pranata — Agent"*
 * (`:991`, `:995`): the code where it reads as an acronym, the ladder's label where it would be shouted.
 * The role badge's own rule for its short form (`role-badge.tsx`), so the two cannot disagree on v1's rungs.
 */
export const rungShort = (rung: NotLoggedRung) => shortOfRung(rung);

/** *"Last logged 9 days ago"* or *"Never logged"* (`:991-999`). */
export function lastLoggedWords(daysSince: number | null): string {
  if (daysSince === null) return PROTOTYPE_COPY.neverLogged;
  return `Last logged ${daysSince} day${daysSince === 1 ? '' : 's'} ago`;
}

/** *"+ 66 more — full list on the People screen"* (`:1001`). */
export const moreWords = (n: number) => `+ ${n} more — full list on the People screen`;

/** *"· 31 in team"* (`:1027`). */
export const inTeam = (n: number) => `· ${n} in team`;

/** *"6/31 · 19,0%"* (`:1029`). */
export const coachedWords = (row: Pick<LeaderboardRow, 'coached' | 'teamSize' | 'pct'>) =>
  `${row.coached}/${row.teamSize} · ${pctText(row.pct)}`;

/** *"Showing 4 of 8 ABs · "* (`:1045`, `:1218`), counted (D-copy). */
export const showingWords = (shown: number, of: number) => `Showing ${shown} of ${of} ABs · `;

/** How many rows a truncated list shows before *view full ranking →* (`:1024-1044`, `:1096-1218`). */
export const RANKING_SHOWN = 4;

/** How many silent members the reveal names before pointing to the People screen (`:986-1000`). */
export const SILENT_SHOWN = 3;

/** The recruitment pill's paint and words, or `null` without a target: no pill is judged against nothing. */
export interface PillWords {
  tone: 'success' | 'alert';
  text: string;
}

/** `updateRecruitStatus()`'s three sentences, verbatim (`:4875-4889`). */
export function recruitPill(expected: number, target: number | null): PillWords | null {
  if (target === null) return null;
  const diff = expected - target;
  if (diff === 0) return { tone: 'success', text: `On track to hit target (${expected} of ${target})` };
  if (diff > 0) return { tone: 'success', text: `${diff} ahead of target (${expected} of ${target})` };
  return { tone: 'alert', text: `${Math.abs(diff)} short of target (${expected} of ${target})` };
}

/** A typed target as the API takes it — a whole number from 0 — or `null` for anything else. */
export function parseTarget(typed: string): number | null {
  const trimmed = typed.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** *"of Rp 12,5 M target"* (`:1081`), the year's figure's sub-line — compact, as a card's figures are (ADR-0167 §1). */
export const ofTarget = (targetMinor: number) => `of ${formatRupiahCompact(targetMinor)} target`;

/** *"Projected: Rp 11,9 M"* (`:1087`). */
export const projectedWords = (minor: number) => `Projected: ${formatRupiahCompact(minor)}`;

/** *"Target: Rp 12,5 M"* (`:1090`). */
export const targetLegend = (minor: number) => `Target: ${formatRupiahCompact(minor)}`;

/**
 * Where the projection marker sits along the bar, as a percentage of the target, clamped to the bar — a
 * projection past the target sits at its end, its label saying how far past. `null` without both.
 */
export function markerAt(projectionMinor: number | null, targetMinor: number | null): number | null {
  if (projectionMinor === null || targetMinor === null || targetMinor <= 0) return null;
  return Math.max(0, Math.min(100, (projectionMinor / targetMinor) * 100));
}

/**
 * A unit's line (`:1107`, `:1121`): *"Rp 620 jt / 1,5 M unit target"* on an agency, *"Rp 210 jt / 500 jt"* on
 * an AAB unit — compact, one `Rp` for the pair (UI-030, ADR-0167 §1). No figure becomes 0: a missing one says so.
 */
export function unitNums(money: Pick<OverviewMoney, 'achievedMinor' | 'targetMinor'>, agency: boolean): string {
  const unit = agency ? ' unit target' : '';
  if (money.achievedMinor === null) {
    return money.targetMinor === null
      ? `${OWN_COPY.notUploaded} · ${OWN_COPY.noGoal}`
      : `${OWN_COPY.notUploaded} / ${formatRupiahCompact(money.targetMinor)}${unit}`;
  }
  if (money.targetMinor === null) return `${formatRupiahCompact(money.achievedMinor)} · ${OWN_COPY.noGoal}`;
  return `${formatRupiahCompactPair(money.achievedMinor, money.targetMinor, '/')}${unit}`;
}

/** `a`, `a and b`, `a, b and c`. */
function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The year's total's tooltip (D-figures, Phase 15's rule): which months of the year it leaves out for want
 * of a file, and how many members' goals are not in its target. `null` when it leaves nothing out.
 */
export function leftOutWords(ytd: Pick<OverviewYtd, 'missingMonths' | 'membersWithoutGoal'>): string | null {
  const parts: string[] = [];
  if (ytd.missingMonths.length > 0) {
    parts.push(`${OWN_COPY.notUploaded} for ${listed(ytd.missingMonths.map(formatMonth))}, so not counted in this total.`);
  }
  if (ytd.membersWithoutGoal > 0) {
    const n = ytd.membersWithoutGoal;
    parts.push(`${n} ${n === 1 ? 'member has' : 'members have'} no goal set, so the target leaves them out.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/*
 * ── The directory's two columns (D-directory) ───────────────────────────────────────────────────
 */

/**
 * *Last activity* and *Last coached* (`:1834`, `:4490-4519`): *Today*, *"{n} days ago"* (*"1 day ago"* at
 * one, as `ORG_STATS` writes it), or *Never*. The days are the server's, counted in the office's calendar.
 */
export function daysAgoWords(days: number | null): string {
  if (days === null) return 'Never';
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
