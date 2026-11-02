import { shortOfRung } from '@/components/ui/role-badge';
import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { api } from './api-client';
import { formatMonth, formatPercent, formatRupiahCompact, formatRupiahCompactPair, percentOf } from './format';

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
 *
 * **Its words are the catalogue's** (P18.98-T4; `i18n/messages/kpm-overview.ts`): each function that writes words takes
 * the reader's `language` — English, the source, when passed none, which its spec reads — and one that writes a figure
 * takes the figures' language after it (`figures`; Indonesian when passed none). Its caller passes `useLanguage()` and
 * `useFigureLanguage()`.
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

/**
 * One AB on *AB coaching frequency*: `LEADER_COACHING_FREQUENCY`, the last 7 days. **Every AB is listed** (P18.97-T3
 * AC-5, UI-017): one who leads nobody comes last, `leads: false`, its team 0 and its rate `null` — *No team*.
 */
export interface LeaderboardRow {
  membershipId: string;
  name: string;
  teamSize: number;
  coached: number;
  pct: number | null;
  leads: boolean;
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

/** The module's words in English, the catalogue's source. */
const EN = messagesIn(kpmOverviewMessages, SOURCE_LANGUAGE);

/** The module's words in a language. */
const wordsIn = (language: Language) => messagesIn(kpmOverviewMessages, language);

/**
 * **The strings `KPM_Owner.html` draws, in English** (D-copy), with OD-142's title for the first card — the catalogue's
 * source (`i18n/messages/kpm-overview.ts`, P18.98-T4), in the shapes this module has always handed its callers and its
 * spec. **A screen reads the reader's language instead**: `useMessages(kpmOverviewMessages)`.
 *
 * `title` is the prototype's *KPM Overview* (`:2027`), **the nav item's word since P18.95-T9 AC-2** (ADR-0167 §10,
 * OD-205; UI-027, *menu labels = page titles*). `engagementSub` is the prototype's *Last 7 days* (`:965`), over a first
 * card that counts the month: **the two periods its cards read** since P18.97-T3 AC-6 (ADR-0176 §3, UI-020; parity
 * I-505). `legendZero` is the bar's start, a figure in no language.
 */
export const PROTOTYPE_COPY = {
  title: EN.title,
  composition: EN.composition,
  engagement: EN.engagement,
  engagementSub: EN.engagementSub,
  coaching: EN.coaching,
  recruitment: EN.recruitment,
  production: EN.production,
  totalMembers: EN.totalMembers,
  loggedMonthTitle: EN.loggedMonthTitle,
  loggedMonthDesc: EN.loggedMonthDesc,
  weekTitle: EN.weekTitle,
  weekDesc: EN.weekDesc,
  reveal: EN.reveal,
  neverLogged: EN.neverLogged,
  coached7d: EN.coached7d,
  coached30d: EN.coached30d,
  leaderboard: EN.leaderboard,
  viewFullRanking: EN.viewFullRanking,
  expectedToClose: EN.expectedToClose,
  target: EN.target,
  lastMonth: EN.lastMonth,
  pipelineNow: EN.pipelineNow,
  unitsTitle: EN.unitsTitle,
  unitsSub: EN.unitsSub,
  noAab: EN.noAab,
  legendZero: '0',
} as const;

/**
 * **The module's own strings, in English** — the states the prototype lacks, from the catalogue's source as
 * `PROTOTYPE_COPY` is. None of OD-39's six words, no phase, no code.
 */
export const OWN_COPY = {
  loading: EN.loading,
  loadingList: EN.loadingList,
  tryAgain: EN.tryAgain,
  notUploaded: EN.notUploaded,
  noGoal: EN.noGoal,
  noTarget: EN.noTarget,
  everybodyLogged: EN.everybodyLogged,
  noLeaders: EN.noLeaders,
  /** Where an AB who leads nobody's rate would be (P18.97-T3 AC-5; ADR-0176 §2, the glossary's *No team*). */
  noTeam: EN.noTeam,
  noUnits: EN.noUnits,
  showFewer: EN.showFewer,
  targetInvalid: EN.targetInvalid,
  targetNotSaved: EN.targetNotSaved,
  /** The *Target*'s control and its toast (P18.97-T3 AC-7; ADR-0176 §4, OD-200, UI-020; parity I-506). */
  edit: EN.edit,
  editTarget: EN.editTarget,
  targetSaved: EN.targetSaved,
  /** The figure's own name when it is shown as a dash: a screen reader hears *no rate*, not *dash*. */
  noRate: EN.noRate,
} as const;

/*
 * ── Words built from figures ────────────────────────────────────────────────────────────────────
 */

/**
 * The sub-line: *"Prudential · KPM 0417 — BSD City Branch"* (`:933`) — the company's name, the office's code and its
 * branch as the office has them, with the client's *KPM*, kept: the same in both languages.
 */
export const officeLine = (office: OverviewOffice) => `${office.companyName} · ${kept('KPM')} ${office.code} — ${office.branch}`;

/** *"+6 new this month"* (`:946`). */
export const newThisMonth = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).newThisMonth({ n });

/** A percentage the server computed, whole (ADR-0174 §1) — *96%*, never *96,0%* — or *—* over nobody; in `figures`. */
export const pctText = (pct: number | null, figures?: Language) => (pct === null ? '—' : formatPercent(pct, {}, figures));

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
 * *"Up from 138 last month (+3%)"* (`:977`) or *"Down from …"*; the change is relative to last month's
 * figure, rounded half up in integers — 142 against 138 is +3%, 23 more on 40 is +58% (`percentOf`; P18.97-T3, parity
 * F-254) — and written whole (ADR-0174 §1). With nothing logged by this day last month there is no percentage to give,
 * so the line stops at the figure. `null` — nothing to compare against — draws no line. Its words in `language`, its
 * change in `figures`.
 */
export function trendWords(
  now: number,
  lastMonthToDate: number | null,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): TrendWords | null {
  if (lastMonthToDate === null) return null;
  const t = wordsIn(language);
  if (now === lastMonthToDate) return { direction: 'same', lead: t.trendSame({ now }), change: null };
  const direction = now > lastMonthToDate ? 'up' : 'down';
  const lead = direction === 'up' ? t.trendUp({ last: lastMonthToDate }) : t.trendDown({ last: lastMonthToDate });
  const pct = percentOf(Math.abs(now - lastMonthToDate), lastMonthToDate);
  if (pct === null) return { direction, lead, change: null };
  return { direction, lead, change: `${direction === 'up' ? '+' : '−'}${formatPercent(pct, {}, figures)}` };
}

/**
 * A rung as the not-logged list writes it after a name — *"Rina Agustina — AAB"*, *"Dedy Pranata — Agent"*
 * (`:991`, `:995`): the code where it reads as an acronym, the ladder's label where it would be shouted.
 * The role badge's own rule for its short form (`role-badge.tsx`), so the two cannot disagree on v1's rungs.
 */
export const rungShort = (rung: NotLoggedRung) => shortOfRung(rung);

/** *"Last logged 9 days ago"* or *"Never logged"* (`:991-999`). */
export function lastLoggedWords(daysSince: number | null, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  return daysSince === null ? t.neverLogged : t.lastLogged({ days: daysSince });
}

/** *"+ 66 more — full list on the People screen"* (`:1001`). */
export const moreWords = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).more({ n });

/** *"· 31 in team"* (`:1027`). */
export const inTeam = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).inTeam({ n });

/**
 * *"6/31 · 19%"* (`:1029`); ***No team*** for an AB who leads nobody (P18.97-T3 AC-5), where the figure would be — never
 * *"0/0 · —"*, which reads as a team nobody coached. Its words in `language`, its percentage in `figures`.
 */
export const coachedWords = (
  row: Pick<LeaderboardRow, 'coached' | 'teamSize' | 'pct' | 'leads'>,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
) => (row.leads ? `${row.coached}/${row.teamSize} · ${pctText(row.pct, figures)}` : wordsIn(language).noTeam);

/** *"Showing 4 of 8 ABs · "* (`:1045`, `:1218`), counted (D-copy). */
export const showingWords = (shown: number, of: number, language: Language = SOURCE_LANGUAGE) =>
  wordsIn(language).showing({ shown, of });

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
export function recruitPill(expected: number, target: number | null, language: Language = SOURCE_LANGUAGE): PillWords | null {
  if (target === null) return null;
  const t = wordsIn(language);
  const diff = expected - target;
  if (diff === 0) return { tone: 'success', text: t.recruitOnTrack({ expected, target }) };
  if (diff > 0) return { tone: 'success', text: t.recruitAhead({ diff, expected, target }) };
  return { tone: 'alert', text: t.recruitShort({ diff: Math.abs(diff), expected, target }) };
}

/**
 * The *Target* tile's value, read as a value (P18.97-T3 AC-7; ADR-0176 §4, UI-020): the number, or ***No target set***
 * where the office never set one — the tile's own *Target* label above it, so it reads *Target: 15*.
 */
export const targetValueWords = (target: number | null, language: Language = SOURCE_LANGUAGE) =>
  (target === null ? wordsIn(language).noTarget : String(target));

/** A typed target as the API takes it — a whole number from 0 — or `null` for anything else. */
export function parseTarget(typed: string): number | null {
  const trimmed = typed.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** *"of Rp 12,5 M target"* (`:1081`), the year's figure's sub-line — compact, as a card's figures are (ADR-0167 §1). */
export const ofTarget = (targetMinor: number, language: Language = SOURCE_LANGUAGE, figures?: Language) =>
  wordsIn(language).ofTarget({ target: formatRupiahCompact(targetMinor, {}, figures) });

/** *"Projected: Rp 11,9 M"* (`:1087`). */
export const projectedWords = (minor: number, language: Language = SOURCE_LANGUAGE, figures?: Language) =>
  wordsIn(language).projected({ sum: formatRupiahCompact(minor, {}, figures) });

/** *"Target: Rp 12,5 M"* (`:1090`). */
export const targetLegend = (minor: number, language: Language = SOURCE_LANGUAGE, figures?: Language) =>
  wordsIn(language).targetLegend({ sum: formatRupiahCompact(minor, {}, figures) });

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
export function unitNums(
  money: Pick<OverviewMoney, 'achievedMinor' | 'targetMinor'>,
  agency: boolean,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): string {
  const t = wordsIn(language);
  const ofUnit = (line: string) => (agency ? t.unitTarget({ figures: line }) : line);
  if (money.achievedMinor === null) {
    return money.targetMinor === null
      ? `${t.notUploaded} · ${t.noGoal}`
      : ofUnit(t.notUploadedOf({ target: formatRupiahCompact(money.targetMinor, {}, figures) }));
  }
  if (money.targetMinor === null) return t.missingGoal({ figure: formatRupiahCompact(money.achievedMinor, {}, figures) });
  return ofUnit(formatRupiahCompactPair(money.achievedMinor, money.targetMinor, '/', figures));
}

/** `a`, `a and b`, `a, b and c` — *dan* in Indonesian. */
function listed(items: readonly string[], language: Language): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${wordsIn(language).and} ${items[items.length - 1]}`;
}

/**
 * The year's total's tooltip (D-figures, Phase 15's rule): which months of the year it leaves out for want
 * of a file, and how many members' goals are not in its target. `null` when it leaves nothing out. Its months in
 * `figures`.
 */
export function leftOutWords(
  ytd: Pick<OverviewYtd, 'missingMonths' | 'membersWithoutGoal'>,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): string | null {
  const t = wordsIn(language);
  const parts: string[] = [];
  if (ytd.missingMonths.length > 0) {
    parts.push(t.leftOutMonths({ months: listed(ytd.missingMonths.map((month) => formatMonth(month, figures)), language) }));
  }
  if (ytd.membersWithoutGoal > 0) parts.push(t.leftOutMembers({ n: ytd.membersWithoutGoal }));
  return parts.length > 0 ? parts.join(' ') : null;
}

/*
 * ── The directory's two columns (D-directory) ───────────────────────────────────────────────────
 */

/**
 * *Last activity* and *Last coached* (`:1834`, `:4490-4519`): *Today*, *"{n} days ago"* (*"1 day ago"* at
 * one, as `ORG_STATS` writes it), or *Never*. The days are the server's, counted in the office's calendar. In the
 * reader's `language` (P18.98-T4): its caller passes `useLanguage()`; English when passed none.
 */
export function daysAgoWords(days: number | null, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  if (days === null) return t.never;
  if (days === 0) return t.today;
  return t.daysAgo({ days });
}
