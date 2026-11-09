import { shortOfRung } from '@/components/ui/role-badge';
import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
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
 *
 * **Its words are the catalogue's** (P18.10-T4; `i18n/messages/kpm-overview.ts`): each function that writes words takes
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
 * ***Aktif bulan ini*** (P19.3-T1 AC-1, P19.3-T2; ADR-0200 §2, the data sources' D1): the members whose upload for the
 * month shows APE or a policy, over today's headcount. `count` and `pct` are `null` while the month is not uploaded —
 * *"–"* and *Belum diunggah*, never *0 / 28* — and `asOf` names the day its rows were written (*"per 3 Nov"*, D8).
 * Logging changes nothing in it.
 */
export interface ActiveThisMonth {
  count: number | null;
  of: number;
  pct: number | null;
  month: string;
  asOf: string | null;
}

/**
 * ***Pengguna aktif* over the rolling 7 days** (ADR-0200 §3): who has logged and who has not — the first tile's
 * *"7 hari: n belum ›"*, which opens *Belum mencatat · 7 hari*. *Since P19.3-T2* the only logging figure served: the
 * month's, and its trend against last month, are gone (OWN R3 holds by there being none).
 */
export interface LoggedThisWeek {
  logged: number;
  notLogged: number;
  pct: number | null;
}

export interface OverviewEngagement {
  activeThisMonth: ActiveThisMonth;
  loggedThisWeek: LoggedThisWeek;
}

/**
 * One AB on *AB coaching frequency*: `LEADER_COACHING_FREQUENCY`, the last 7 days. **Every AB is listed** (P18.9-T3
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
  /**
   * *Recruitment last month* (P19.3-T1 AC-3; ADR-0200 §5, D2): the office's upload's `RECRUITMENT` for last month —
   * `null` while it is not uploaded, which a screen draws *"–"*. Never a count of leads closed.
   */
  closedLastMonth: number | null;
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
  /**
   * *Since P19.3-T2 (UI-150, Overview R3)*: the months the year waits on **that are still open for upload**, from the
   * KPM's first month, this month included while it is not uploaded — each a *"<Bulan> belum diunggah ›"* opening
   * `/kpm/data-upload?month=` on itself.
   */
  missingMonths: string[];
  /** The first month *"this year"* counts: January, or the KPM's first month when it began this year. */
  from: string;
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
  /** The month the projection runs from (P19.3-T1 AC-12): the latest ended month held; `null` with the projection. */
  projectionThrough: string | null;
  agencies: OverviewAgency[];
}

/**
 * **The seven steps of *Siapkan KPM*, in the card's order** (P19.3-T2 AC-4; UI-149): the four settings pages — each the
 * path segment of its page and of `PUT /kpm/settings/:page/reviewed` — then *Impor anggota*, *Unggah produksi*, *Atur
 * target rekrutmen*. The server's `SETUP_STEPS`; `kpm-overview.spec.ts` holds the two together.
 */
export const REVIEWED_PAGES = ['branch-info', 'activity-types', 'activation-checklist', 'products'] as const;
export type ReviewedPage = (typeof REVIEWED_PAGES)[number];
export const SETUP_STEPS = [...REVIEWED_PAGES, 'import', 'upload', 'recruit-target'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** One step and whether it is done. */
export interface SetupStepState {
  key: SetupStep;
  done: boolean;
}

/** A month the office may still upload, and the last day it may. */
export interface OverviewOpenMonth {
  month: string;
  closesOn: string;
}

/**
 * ***Siapkan KPM*** (P19.3-T2 AC-4, AC-5; UI-149): served while any step is open, `null` once all seven are done — stored
 * by the server, so the card never comes back.
 */
export interface OverviewSetup {
  done: number;
  steps: SetupStepState[];
  /** The office's address and contact phone are both filled: step 1's meta. */
  branchFilled: boolean;
  /** Today's headcount: step 5's meta, *"Baru 1 anggota: Anda"*. */
  members: number;
  /** Step 6: the month to upload and its closing day, *"Terbuka sampai 7 Des 2026"*; `null` with none open. */
  openMonth: OverviewOpenMonth | null;
  /** The target standing for this month: step 7's meta. */
  target: number | null;
}

/** What waits for the Owner on the settings pages (P19.3-T2 AC-3; UI-148, Appendix D): *Pengaturan KPM ›*'s line. */
export interface SettingsWaiting {
  productsAwaiting: number;
  checklistDraftVersion: number | null;
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
  setup: OverviewSetup | null;
  settings: SettingsWaiting;
}

/** A rung as the not-logged list names it. */
export interface NotLoggedRung {
  code: string;
  label: string;
}

/**
 * Somebody who has not logged in the last 7 days. `daysSince` `null` is *Never logged*. *Since P19.3-T2 (AC-2)* with
 * their leader (*"Agent · ke Sari"*) and their WhatsApp number for the D-22 reminder (UI-101).
 */
export interface NotLoggedMember {
  membershipId: string;
  name: string;
  rung: NotLoggedRung;
  lastLoggedOn: string | null;
  daysSince: number | null;
  leader: OverviewPerson | null;
  phone: string | null;
}

/** `GET /kpm/overview/not-logged`: everybody silent for 7 days, the first five longest silent, and how many. */
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

/** What `PUT /kpm/settings/:page/reviewed` answers: the page's step, ticked, and how it first ticked. */
export interface SettingsReviewed {
  page: ReviewedPage;
  reviewed: true;
  at: string;
  via: 'reviewed' | 'saved' | 'derived' | 'migration';
}

/**
 * ***Sudah sesuai*** (P19.3-T2 AC-5; UI-149): marks a settings page reviewed, which ticks its step of *Siapkan KPM* and
 * changes nothing of the page. The Owner's and an Admin's (`tenant_config:mark_reviewed`); refused in a support session.
 */
export const markSettingsReviewed = (page: ReviewedPage) =>
  api<SettingsReviewed>(`/kpm/settings/${page}/reviewed`, { method: 'PUT' });

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The module's words in English, the catalogue's source. */
const EN = messagesIn(kpmOverviewMessages, SOURCE_LANGUAGE);

/** The module's words in a language. */
const wordsIn = (language: Language) => messagesIn(kpmOverviewMessages, language);

/**
 * **The strings `KPM_Owner.html` draws, in English** (D-copy), with OD-142's title for the first card — the catalogue's
 * source (`i18n/messages/kpm-overview.ts`, P18.10-T4), in the shapes this module has always handed its callers and its
 * spec. **A screen reads the reader's language instead**: `useMessages(kpmOverviewMessages)`.
 *
 * `title` is the prototype's *KPM Overview* (`:2027`), **the nav item's word since P18.7-T9 AC-2** (ADR-0167 §10,
 * OD-205; UI-027, *menu labels = page titles*). `engagementSub` is the prototype's *Last 7 days* (`:965`), over a first
 * card that counts the month: **the two periods its cards read** since P18.9-T3 AC-6 (ADR-0176 §3, UI-020; parity
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
  activeMonth: EN.activeMonth,
  notLoggedTitle: EN.notLoggedTitle,
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
  /** Where an AB who leads nobody's rate would be (P18.9-T3 AC-5; ADR-0176 §2, the glossary's *No team*). */
  noTeam: EN.noTeam,
  noUnits: EN.noUnits,
  showFewer: EN.showFewer,
  targetInvalid: EN.targetInvalid,
  targetNotSaved: EN.targetNotSaved,
  /** The *Target*'s control and its toast (P18.9-T3 AC-7; ADR-0176 §4, OD-200, UI-020; parity I-506). */
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

/**
 * A rung as the not-logged list writes it after a name — *"Rina Agustina — AAB"*, *"Dedy Pranata — Agent"*
 * (`:991`, `:995`): the code where it reads as an acronym, the ladder's label where it would be shouted.
 * The role badge's own rule for its short form (`role-badge.tsx`), so the two cannot disagree on v1's rungs.
 */
export const rungShort = (rung: NotLoggedRung) => shortOfRung(rung);

/**
 * **A silent member's meta line** (P19.3-T2 AC-2; UI-148, `kpm-overview-mobile` 3): *"Agent · ke Sari · 14 hari lalu"*,
 * *"AB · Anda · 16 hari lalu"* on the reader's own row, *"Agent · ke Agus · Belum pernah"*. The rung's short form, the
 * leader's first name, the days since the last log — or never.
 */
export function silentMeta(
  member: Pick<NotLoggedMember, 'rung' | 'leader' | 'daysSince'>,
  self: boolean,
  language: Language = SOURCE_LANGUAGE,
): string {
  const t = wordsIn(language);
  const parts: string[] = [rungShort(member.rung)];
  if (self) parts.push(t.you);
  else if (member.leader) parts.push(t.toLeader({ name: member.leader.name.trim().split(/\s+/)[0] ?? member.leader.name }));
  parts.push(member.daysSince === null ? t.neverLogged : t.daysAgo({ days: member.daysSince }));
  return parts.join(' · ');
}

/** *"· 31 in team"* (`:1027`). */
export const inTeam = (n: number, language: Language = SOURCE_LANGUAGE) => wordsIn(language).inTeam({ n });

/**
 * *"6/31 · 19%"* (`:1029`); ***No team*** for an AB who leads nobody (P18.9-T3 AC-5), where the figure would be — never
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

/**
 * How many rows a truncated list shows before *view full ranking →* (`:1024-1044`, `:1096-1218`). *Changed 2026-11-05
 * (P19.2-T3 AC-5; UI-143: "3 rows each + 'Semua ›'"):* three, where the prototype showed four; *Semua n ›* opens the rest.
 */
export const RANKING_SHOWN = 3;

/**
 * How many silent members the desktop's *Belum mencatat · 7 hari* card names before *Semua n ›* (`kpm-overview-desktop`
 * 2: three rows, the lists' own count); the sheet below 1024px names every one the server sent — five
 * (`KPM_REPORTING.NOT_LOGGED_SHOWN`, `kpm-overview-mobile` 3).
 */
export const SILENT_SHOWN = 3;

/**
 * **Data upload on a month** (P19.3-T2 AC-7; UI-150, the route registry's `?month=YYYY-MM`): where a *"<Bulan> belum
 * diunggah ›"* and the setup card's step 6 go.
 */
export const uploadHref = (month: string) => `/kpm/data-upload?month=${encodeURIComponent(month)}`;

/**
 * **The settings pages, in the menu's order** (P19.3-T2 AC-3; UI-148, Overview R1b; `kpm-overview-mobile` 4): the
 * Pengaturan group of the sidebar and *Lainnya* (`field-nav.ts`), which `kpm-overview.spec.ts` holds this list to.
 * *Activity types* carries *Ratio benchmarks* under it, a page of its own — so the count says eleven.
 */
export const SETTINGS_PAGES = [
  { key: 'activity-types', href: '/kpm/settings/activity-types', name: kept('Activity types') },
  { key: 'lead-statuses', href: '/kpm/settings/lead-statuses', name: kept('Lead statuses') },
  { key: 'activation-checklist', href: '/kpm/settings/activation-checklist', name: kept('Activation checklist') },
  { key: 'training', href: '/kpm/settings/training', name: kept('Training') },
  { key: 'capability-mapping', href: '/kpm/settings/capability-mapping', name: kept('Capability Mapping') },
  { key: 'events', href: '/kpm/settings/events', name: kept('Events') },
  { key: 'campaigns', href: '/kpm/settings/campaigns', name: kept('Campaigns') },
  { key: 'products', href: '/kpm/settings/products', name: kept('Products') },
  { key: 'recruitment-pitch', href: '/kpm/settings/recruitment-pitch', name: kept('Recruitment pitch') },
  { key: 'branch-info', href: '/kpm/settings/branch-info', name: kept('Branch info') },
] as const;

/** *Ratio benchmarks*, under *Activity types*: two taps from the Overview, as every settings page is (AC-3). */
export const RATIO_BENCHMARKS_HREF = '/kpm/settings/ratio-benchmarks';

/** *"11 pengaturan"*: the ten rows and *Ratio benchmarks*. */
export const SETTINGS_PAGE_COUNT = SETTINGS_PAGES.length + 1;

/**
 * **"Pengaturan KPM ›"'s line** (P19.3-T2 AC-3; UI-148): *"11 pengaturan · 2 produk menunggu Anda · checklist draf versi
 * 2"* — the count, then what waits for the Owner, each part only when there is something.
 */
export function settingsLine(settings: SettingsWaiting, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  const parts = [t.settingsCount({ n: SETTINGS_PAGE_COUNT })];
  if (settings.productsAwaiting > 0) parts.push(t.productsAwaiting({ n: settings.productsAwaiting }));
  if (settings.checklistDraftVersion !== null) parts.push(t.checklistDraft({ version: settings.checklistDraftVersion }));
  return parts.join(' · ');
}

/** Each settings page's step on the card, by the server's key (`REVIEWED_PAGES`): its page. */
export const STEP_HREF: Record<ReviewedPage, string> = {
  'branch-info': '/kpm/settings/branch-info',
  'activity-types': '/kpm/settings/activity-types',
  'activation-checklist': '/kpm/settings/activation-checklist',
  products: '/kpm/settings/products',
};

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
 * The *Target* tile's value, read as a value (P18.9-T3 AC-7; ADR-0176 §4, UI-020): the number, or ***No target set***
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
 * reader's `language` (P18.10-T4): its caller passes `useLanguage()`; English when passed none.
 */
export function daysAgoWords(days: number | null, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  if (days === null) return t.never;
  if (days === 0) return t.today;
  return t.daysAgo({ days });
}
