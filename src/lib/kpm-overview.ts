import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { api } from './api-client';
import type { StandingOverride } from './standing-override';

/**
 * **The KPM Overview, second version** (Phase 19.19; ADR-0272; `functional/kpm-overview.md`; the brief of 19 November,
 * *KPM Overview, new content* and *KPM Analytics: remove the page*): **usage first, then compliance, then results**, over
 * the KPM or one informal group, in six sections — **1** *Pemakaian AgencyBoost*, **2** *Pemakaian per orang*, **3**
 * *Coaching*, **4** *Compliance*, **5** *Performa vs target*, **6** *Produksi 6 bulan* — over three reads:
 *
 * - `GET /kpm/overview?group=` — sections 1, 2, 3 and 6, the filter's choices, and a new KPM's setup card;
 * - `GET /kpm/overview/performance?month=&group=` — section 5, the targets with what was achieved beside them;
 * - `GET /kpm/overview/compliance?group=&category=&item=` — section 4's cards, and the card a reader opens.
 *
 * **Every figure is the server's**: this file names the shapes, asks for them, and builds the one thing the page derives
 * from them — the trees of sections 2 and 3 and the compliance list, filtered by a tile (`visibleRows`).
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** An informal group as the Overview names it; `groupId: null` is *Tanpa group*. */
export interface OverviewGroupRef {
  groupId: string | null;
  name: string | null;
}

/** *Semua group ⌄*'s choice: a group, and its people today. */
export interface OverviewGroupChoice {
  groupId: string | null;
  name: string | null;
  people: number;
}

/** *Pakai* over a set of people: *"26 dari 30"*, and its share (`null` over nobody). */
export interface UsageCount {
  used: number;
  of: number;
  pct: number | null;
}

/** Section 1's three counts over one set of people. */
export interface UsageCounts {
  total: UsageCount;
  leaders: UsageCount;
  agents: UsageCount;
}

/** One row of section 1's list: an informal group and its counts. */
export interface GroupUsage {
  groupId: string | null;
  name: string | null;
  total: UsageCount;
  leaders: UsageCount;
  agents: UsageCount;
}

/** Section 1: the scope's counts, and one row per informal group in it. */
export interface OverviewUsage {
  total: UsageCount;
  leaders: UsageCount;
  agents: UsageCount;
  byGroup: GroupUsage[];
}

/** A person's last day logged: `never`, `lapsed` (> 14 days) or `recent` (≤ 14), and the days since. */
export interface PersonUsage {
  status: StatusBucket;
  days: number | null;
  usedInWindow: boolean;
}

/** A person's last 1-on-1: the same three buckets, and the days since. */
export interface PersonCoaching {
  status: StatusBucket;
  days: number | null;
}

/** The three buckets sections 2 and 3 filter by, in the tiles' order. */
export type StatusBucket = 'never' | 'lapsed' | 'recent';
export const STATUS_BUCKETS: readonly StatusBucket[] = ['never', 'lapsed', 'recent'];

/** One person on the lists, where they stand in the tree and their two statuses. */
export interface OverviewPerson {
  membershipId: string;
  name: string;
  role: 'ab' | 'aab' | 'agent';
  photoUrl: string | null;
  phone: string | null;
  groupId: string | null;
  abMembershipId: string | null;
  depth: 0 | 1 | 2;
  leaderIds: string[];
  usage: PersonUsage;
  coaching: PersonCoaching;
}

/** One month of *Produksi 6 bulan*: `apeMinor` `null` where the office holds no file for it. */
export interface ChartMonth {
  month: string;
  apeMinor: number | null;
}

/** Section 6. */
export interface OverviewProduction {
  currency: string;
  months: ChartMonth[];
}

/** The steps of *Siapkan KPM*: the four settings pages, *Impor anggota*, *Unggah produksi* and the monthly targets. */
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

/** ***Siapkan KPM***: served while any step is open, `null` once all seven are done. */
export interface OverviewSetup {
  done: number;
  steps: SetupStepState[];
  branchFilled: boolean;
  members: number;
  openMonth: OverviewOpenMonth | null;
  /** Step 7's meta (ADR-0272 §7): how many AB groups have a monthly target this month; `null` with none. */
  target: number | null;
}

/** What waits for the Owner on the settings pages: *Pengaturan KPM ›*'s line. */
export interface SettingsWaiting {
  productsAwaiting: number;
  checklistDraftVersion: number | null;
}

/** The office the page is about: *"Prudential · KPM 0417 — BSD City Branch"*. */
export interface OverviewOffice {
  companyName: string;
  code: string;
  branch: string;
}

/** Section 1's 30 days. */
export interface UsageWindow {
  from: string;
  to: string;
}

/** **`GET /kpm/overview`**. */
export interface KpmOverviewView {
  office: OverviewOffice;
  today: string;
  month: string;
  usageWindow: UsageWindow;
  groups: OverviewGroupChoice[];
  group: OverviewGroupRef | null;
  usage: OverviewUsage;
  people: OverviewPerson[];
  production: OverviewProduction;
  setup: OverviewSetup | null;
  settings: SettingsWaiting;
}

/** What a row achieved in the month, beside its targets. */
export interface PerformanceActual {
  apeMinor: number | null;
  apePct: number | null;
  activeAgents: number | null;
  rekrut: number;
}

/** One AB group on *Performa vs target*. */
export interface PerformanceRow {
  abMembershipId: string;
  name: string;
  agentCode: string | null;
  photoUrl: string | null;
  isGroupLeader: boolean;
  people: number;
  activeAgentTarget: number | null;
  rekrutTarget: number | null;
  source: 'set' | 'carried' | 'none';
  fromMonth: string | null;
  rekrutYtdTarget: number;
  apeTargetMinor: number;
  goalsSet: number;
  actual: PerformanceActual;
}

/** A total line: an informal group's, or the KPM's. */
export interface PerformanceTotals {
  activeAgentTarget: number;
  rekrutTarget: number;
  rekrutYtdTarget: number;
  apeTargetMinor: number;
  unset: number;
  abGroups: number;
  people: number;
  actual: PerformanceActual;
}

/** An informal group as *Performa vs target* lists it: `null` is *Tanpa group*. */
export interface PerformanceGroupRef {
  groupId: string;
  name: string;
}

/** One informal group, its total and its AB groups. */
export interface PerformanceGroup {
  group: PerformanceGroupRef | null;
  leaders: { membershipId: string; name: string }[];
  totals: PerformanceTotals;
  abGroups: PerformanceRow[];
}

/** **`GET /kpm/overview/performance`**. */
export interface OverviewPerformanceView {
  month: string;
  currentMonth: string;
  earliestMonth: string;
  latestMonth: string;
  max: number;
  currency: string;
  held: boolean;
  group: OverviewGroupRef | null;
  total: PerformanceTotals;
  groups: PerformanceGroup[];
  canWrite: boolean;
}

/** The seven compliance cards, in the brief's order. */
export type ComplianceCategory = 'training' | 'goals' | 'activity' | 'leads' | 'activation' | 'events' | 'campaigns';
export const COMPLIANCE_CATEGORIES: readonly ComplianceCategory[] = [
  'training', 'goals', 'activity', 'leads', 'activation', 'events', 'campaigns',
];

/** The cards whose list has a picker: a module, an event, a campaign. */
export const MULTI_ITEM: ReadonlySet<ComplianceCategory> = new Set(['training', 'events', 'campaigns']);

/** One card: done over those it applies to. */
export interface ComplianceCard {
  category: ComplianceCategory;
  count: number;
  of: number;
  pct: number | null;
}

/** One person's cell on the card opened. `done: null`: the item does not apply to them. */
export interface ComplianceCell {
  membershipId: string;
  status: string | null;
  done: boolean | null;
  on: string | null;
  second?: string | null;
  endedOn?: string | null;
  override?: StandingOverride | null;
  overridable?: boolean;
}

/** A module as Training's picker lists it. */
export interface ComplianceModule {
  code: string;
  title: string;
}

/** A skill holding modules. */
export interface ComplianceSkill {
  code: string;
  label: string;
  modules: ComplianceModule[];
}

/** A training category, as the Training page groups it. */
export interface ComplianceTrainingCategory {
  code: string;
  label: string;
  skills: ComplianceSkill[];
}

/** An event as Events' picker lists it. */
export interface ComplianceEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsOn: string;
  phase: 'upcoming' | 'running' | 'past';
}

/** A campaign as Campaigns' picker lists it. */
export interface ComplianceCampaign {
  code: string;
  title: string;
  kind: 'structural' | 'seasonal';
  subtype: string | null;
  phase: 'upcoming' | 'running' | 'ended';
  startsAt: string;
  endsAt: string | null;
  final: boolean;
}

/** The pickers' lists. */
export interface ComplianceCatalog {
  training: ComplianceTrainingCategory[];
  events: ComplianceEvent[];
  campaigns: ComplianceCampaign[];
}

/** The card opened: its item, *"x dari y"*, and every person's cell. */
export interface ComplianceSelected {
  category: ComplianceCategory;
  item: string | null;
  done: number;
  of: number;
  cells: ComplianceCell[];
}

/** Where a card turns yellow and green. */
export interface ComplianceThresholds {
  lowBelowPct: number;
  highFromPct: number;
}

/** **`GET /kpm/overview/compliance`**. */
export interface ComplianceView {
  today: string;
  thresholds: ComplianceThresholds;
  group: OverviewGroupRef | null;
  cards: ComplianceCard[];
  catalog: ComplianceCatalog;
  selected: ComplianceSelected | null;
  can: { override: boolean };
}

/** `?group=`: a group's id, `none` for *Tanpa group*, nothing for the whole KPM. */
export const NO_GROUP = 'none';
export const groupParam = (group: OverviewGroupRef | null) => (group === null ? null : group.groupId ?? NO_GROUP);
/** The query's pairs, without the `?`: empty when nothing is asked. */
const query = (params: Record<string, string | null | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')).toString();

/*
 * The paths are written out in each call: `scripts/check-api-consumers.py` finds a route by the literal inside `api(…)`.
 */

/** Sections 1, 2, 3 and 6. */
export function readKpmOverview(group: string | null = null) {
  const qs = query({ group });
  return api<KpmOverviewView>(`/kpm/overview${qs ? `?${qs}` : ''}`);
}

/** Section 5, for a month. */
export function readOverviewPerformance(month: string | null = null, group: string | null = null) {
  const qs = query({ month, group });
  return api<OverviewPerformanceView>(`/kpm/overview/performance${qs ? `?${qs}` : ''}`);
}

/** Section 4's cards, and with `category` the card a reader opens. */
export function readOverviewCompliance(
  { group = null, category = null, item = null }: { group?: string | null; category?: ComplianceCategory | null; item?: string | null } = {},
) {
  const qs = query({ group, category, item });
  return api<ComplianceView>(`/kpm/overview/compliance${qs ? `?${qs}` : ''}`);
}

/** What `PUT /kpm/settings/:page/reviewed` answers. */
export interface SettingsReviewed {
  page: ReviewedPage;
  reviewed: true;
  at: string;
  via: 'reviewed' | 'saved' | 'derived' | 'migration';
}

/** ***Sudah sesuai***: marks a settings page reviewed, which ticks its step of *Siapkan KPM*. */
export const markSettingsReviewed = (page: ReviewedPage) =>
  api<SettingsReviewed>(`/kpm/settings/${page}/reviewed`, { method: 'PUT' });

/*
 * ── The trees of sections 2, 3 and the compliance list ───────────────────────────────────────────
 */

/** A row the tree draws: the person, and how many in their team match the tile chosen (*"n di timnya"*). */
export interface TreeRow {
  person: OverviewPerson;
  /** The person matches the tile themselves. */
  matches: boolean;
  /** For a leader: those in their team who match; 0 for an agent. */
  inTeam: number;
}

/** A group's header and its rows. */
export interface TreeGroup {
  groupId: string | null;
  name: string | null;
  rows: TreeRow[];
}

/**
 * **The tree for a tile** (P19.19-T1 AC-3; the brief's §2): the people who match, and **every leader whose team has a
 * match — always shown, never greyed — with *"n di timnya"***. Grouped by informal group in the server's order; a group
 * with nobody to show is left out.
 */
export function visibleRows(
  people: readonly OverviewPerson[], groups: readonly OverviewGroupRef[], match: (p: OverviewPerson) => boolean,
): TreeGroup[] {
  const matched = new Set(people.filter(match).map((p) => p.membershipId));
  const inTeam = new Map<string, number>();
  for (const p of people) {
    if (!matched.has(p.membershipId)) continue;
    for (const leader of p.leaderIds) inTeam.set(leader, (inTeam.get(leader) ?? 0) + 1);
  }
  return groups
    .map((g) => ({
      groupId: g.groupId,
      name: g.name,
      rows: people
        .filter((p) => p.groupId === g.groupId)
        .filter((p) => matched.has(p.membershipId) || (inTeam.get(p.membershipId) ?? 0) > 0)
        .map((person) => ({ person, matches: matched.has(person.membershipId), inTeam: inTeam.get(person.membershipId) ?? 0 })),
    }))
    .filter((g) => g.rows.length > 0);
}

/** How many rows a long list shows before *Lihat semua (n) ›* (the mockup's tablet frames: seven, so both columns end level). */
export const PREVIEW_ROWS = 7;

/** The first `limit` rows of a tree, across its groups, a group cut where the limit falls. */
export function firstRows(tree: readonly TreeGroup[], limit: number): TreeGroup[] {
  const out: TreeGroup[] = [];
  let left = limit;
  for (const group of tree) {
    if (left <= 0) break;
    out.push({ ...group, rows: group.rows.slice(0, left) });
    left -= group.rows.length;
  }
  return out;
}

/** Every row of a tree. */
export const rowCount = (tree: readonly TreeGroup[]) => tree.reduce((n, g) => n + g.rows.length, 0);

/** A compliance card's colour (P19.19-T3 AC-2): red below 34%, yellow below 67%, green from 67% — the server's splits. */
export type ComplianceTone = 'red' | 'amber' | 'green' | 'grey';
export function complianceTone(pct: number | null, thresholds: ComplianceThresholds): ComplianceTone {
  if (pct === null) return 'grey';
  if (pct < thresholds.lowBelowPct) return 'red';
  return pct < thresholds.highFromPct ? 'amber' : 'green';
}

/** A usage or coaching bucket's colour: red never, yellow over 14 days, green within them. */
export const BUCKET_TONE: Record<StatusBucket, 'red' | 'amber' | 'green'> = { never: 'red', lapsed: 'amber', recent: 'green' };

/** A bar's width for a share: at least a sliver for anything above zero, never past full. */
export const barWidth = (part: number | null, of: number | null) =>
  (part === null || of === null || of <= 0 ? 0 : Math.max(part > 0 ? 2 : 0, Math.min(100, Math.round((part / of) * 100))));

/** The months *‹ ›* steps between, both `YYYY-MM`. */
export function shiftMonth(month: string, by: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/*
 * ── Words built from figures ────────────────────────────────────────────────────────────────────
 */

/** The module's words in a language. */
const wordsIn = (language: Language) => messagesIn(kpmOverviewMessages, language);

/** *"Prudential · KPM 0417 — BSD City Branch"*: the same in both languages. */
export const officeLine = (office: OverviewOffice) => `${office.companyName} · ${kept('KPM')} ${office.code} — ${office.branch}`;

/** **Data upload on a month**: where the setup card's step 6 goes. */
export const uploadHref = (month: string) => `/kpm/data-upload?month=${encodeURIComponent(month)}`;

/** **The Pengaturan hub** (ADR-0269 §4): where *Pengaturan KPM ›* goes since P19.19. */
export const SETTINGS_HUB_HREF = '/kpm/settings';

/** The settings pages, in the menu's order until the hub: *Pengaturan KPM ›*'s count. */
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

/** *"11 pengaturan"*: the ten pages and *Ratio benchmarks*. */
export const SETTINGS_PAGE_COUNT = SETTINGS_PAGES.length + 1;

/** *"11 pengaturan · 2 produk menunggu Anda · checklist draf versi 2"*. */
export function settingsLine(settings: SettingsWaiting, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  const parts = [t.settingsCount({ n: SETTINGS_PAGE_COUNT })];
  if (settings.productsAwaiting > 0) parts.push(t.productsAwaiting({ n: settings.productsAwaiting }));
  if (settings.checklistDraftVersion !== null) parts.push(t.checklistDraft({ version: settings.checklistDraftVersion }));
  return parts.join(' · ');
}

/** Each settings page's step on the card: its page. */
export const STEP_HREF: Record<ReviewedPage, string> = {
  'branch-info': '/kpm/settings/branch-info',
  'activity-types': '/kpm/settings/activity-types',
  'activation-checklist': '/kpm/settings/activation-checklist',
  products: '/kpm/settings/products',
};

/**
 * *Last activity* and *Last coached* (the directory's columns): *Today*, *"{n} days ago"*, or *Never*. The days are the
 * server's, counted in the office's calendar. English when passed no language.
 */
export function daysAgoWords(days: number | null, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language);
  if (days === null) return t.never;
  if (days === 0) return t.today;
  return t.daysAgo({ days });
}
