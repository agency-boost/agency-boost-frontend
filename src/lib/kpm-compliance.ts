import type { PillTone } from '@/components/ui/status-pill';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { api } from './api-client';
import { officeDay } from './campaigns';
import { formatShortDay } from './format';

/**
 * The Owner's *Compliance, Events, and Campaigns* (Phase 18.6, P18.6-T1 and T2; `KPM_Owner.html:1262-1286`,
 * `:2912-3087`, `:3449-4118`; `docs/02-specs/functional/kpm-analytics.md`, *Compliance*): six chips, the
 * selected category's tabs or picker, and a tree of every AB's agency with a status per person — over one read,
 * `GET /kpm/analytics/compliance?category=&item=`, the selection in the address.
 *
 * **Every status is the server's** (D-chips, OD-159, OD-160, D-status): each cell arrives as a code, each chip
 * and each card as counts. This file names the shapes, asks for them, and turns codes into the prototype's
 * words. It decides nothing about who is done. The only work done here is the prototype's own, on what is on
 * screen: search (`:4017-4018`) and the worst-first and best-first orders (`:3651-3655`, `:3709-3714`,
 * `:3843-3845`). **Search recomputes no count**: the prototype's cards and sections total every member they
 * hold whatever the search shows (`directAllMembers`, `abNames`, `:4059`, `:4096`), so the served counts stand.
 *
 * Each interface is spelled out with named nested types and no `extends`, so `contract.spec.ts` can read its
 * fields against `backend/openapi.json`: it reads an interface's body up to the first closing brace, so no
 * comment inside one may hold a brace.
 *
 * **Its words are the catalogue's** (P18.98-T4; `i18n/messages/kpm-compliance.ts`): a function that writes words takes
 * the reader's `language`, English when passed none, and one that writes a date takes the figures' language after it
 * (`figures`; Indonesian when passed none). Its caller passes `useLanguage()` and `useFigureLanguage()`.
 */

/*
 * ── The labels (the campaigns' Achieved cell reads them too) ────────────────────────────────────
 */

/** A pill's words and paint. The words are always drawn: colour is never the only cue. */
export interface PillWords {
  label: string;
  tone: PillTone;
}

/**
 * `.status-pill` (`:564-568`): *done* green, *progress* the amber tint — with navy words, F-126's paint, since
 * the prototype's amber-dark on its tint clears no contrast floor (I-116) — *not done* red, *—* neutral.
 */
const DONE: PillTone = 'success';
const PROGRESS: PillTone = 'watch';
const NOT_DONE: PillTone = 'alert';

/** The prototype's neutral pill (`:568`, `:3722`, `:3900`): nothing applies, or nothing is decided yet. */
export const NO_STATUS: PillWords = { label: '—', tone: 'neutral' };

/**
 * Each status code the read serves (the contract's cell codes) → the prototype's words (`CATEGORIES`,
 * `:3013-3020`; the events row `:3716-3722`; the campaigns row `:3895-3900`) and the pill's tone
 * (`STATUS_CLASS`, `:2915`), **in a language** — the catalogue's `labels`, the paints the same in both.
 *
 * - *Goal Setting* has no *Draft saved* (ADR-0049: a goal is annual and has no draft) and *Activity Mgmt* no
 *   *Partial* (its own tooltip says there is none).
 * - A past event's *—* is a member awaiting the confirmer (`unconfirmed`); a campaign's *—* is a result not
 *   decided (`in_progress`) or one nothing could decide (`unknown`) — the registry's labels.
 */
function labelsIn(language: Language) {
  const l = messagesIn(kpmComplianceMessages, language).labels;
  return {
    training: {
      done: { label: l.completed, tone: DONE },
      in_progress: { label: l.inProgress, tone: PROGRESS },
      not_started: { label: l.notStarted, tone: NOT_DONE },
    },
    goals: {
      set: { label: l.set, tone: DONE },
      not_set: { label: l.notSet, tone: NOT_DONE },
    },
    activity: {
      logged: { label: l.logged, tone: DONE },
      missed: { label: l.missed, tone: NOT_DONE },
    },
    activation: {
      completed: { label: l.completed, tone: DONE },
      in_progress: { label: l.inProgress, tone: PROGRESS },
      overdue: { label: l.overdue, tone: NOT_DONE },
    },
    events: {
      /** *Joined*: an upcoming or running event's two, then a past event's four. */
      joined: {
        registered: { label: l.registered, tone: DONE },
        not_registered: { label: l.notRegistered, tone: NOT_DONE },
        attended: { label: l.attended, tone: DONE },
        no_show: { label: l.noShow, tone: NOT_DONE },
        unconfirmed: NO_STATUS,
      },
      /** *Feedback*: asked of an attendee of a past event only; anybody else *—*. */
      feedback: {
        shared: { label: l.shared, tone: DONE },
        not_shared: { label: l.notShared, tone: NOT_DONE },
      },
    },
    campaigns: {
      chasing: {
        chasing: { label: l.chasing, tone: DONE },
        not_chasing: { label: l.notChasing, tone: NOT_DONE },
      },
      /** *Achieved*: an ended seasonal campaign's only (`:3889`); the registry's labels. */
      achieved: {
        qualified: { label: l.achieved, tone: DONE },
        not_met: { label: l.notAchieved, tone: NOT_DONE },
        not_joined: { label: l.notAchieved, tone: NOT_DONE },
        in_progress: NO_STATUS,
        unknown: NO_STATUS,
      },
    },
  } as const satisfies Record<string, Record<string, PillWords | Record<string, PillWords>>>;
}

export type ComplianceLabels = ReturnType<typeof labelsIn>;

/** Built once a language, so a pill's words keep their identity between renders. */
const LABELS: Readonly<Record<Language, ComplianceLabels>> = { en: labelsIn('en'), id: labelsIn('id') };

/** The pills' words in the reader's language (`useLanguage()`); English when passed none. */
export const complianceLabels = (language: Language = SOURCE_LANGUAGE): ComplianceLabels => LABELS[language];

/** The pills' words in English, the catalogue's source — what this module's callers and spec have always read. */
export const COMPLIANCE_LABELS = complianceLabels(SOURCE_LANGUAGE);

/** A code's pill from one of the maps above; *—* for `null`, or a code the map does not hold. */
export function pillOf(map: Readonly<Record<string, PillWords>>, code: string | null | undefined): PillWords {
  return (code != null && Object.prototype.hasOwnProperty.call(map, code) ? map[code] : undefined) ?? NO_STATUS;
}

/** The prototype's `.status-pill` (`:564`): 12px semibold, the type scale's `sm` step, in its own case. */
export const COMPLIANCE_PILL_CLASS = 'whitespace-nowrap px-2.5 py-1 text-sm font-semibold normal-case tracking-normal';

/*
 * ── The read ────────────────────────────────────────────────────────────────────────────────────
 */

/** The six, in the prototype's order (`CATEGORIES`, `:3013-3020`). */
export type ComplianceCategory = 'training' | 'goals' | 'activity' | 'activation' | 'events' | 'campaigns';

export const COMPLIANCE_CATEGORIES: readonly ComplianceCategory[] = ['training', 'goals', 'activity', 'activation', 'events', 'campaigns'];

/** The three with one item each: the read refuses an `item` on them, so the screen never sends one. */
export const SINGLE_ITEM: ReadonlySet<ComplianceCategory> = new Set(['goals', 'activity', 'activation']);

/** *Training* is selected first (`:3423`). */
export const DEFAULT_CATEGORY: ComplianceCategory = 'training';

/** A head or a row's person. `leads`: they head somebody, so their name opens their Unit Dashboard (D-drill). */
export interface CompliancePerson {
  membershipId: string;
  name: string;
  leads: boolean;
}

/** Who set an override. */
export interface ComplianceOverrideBy {
  membershipId: string;
  name: string;
}

/** A final standing's override (D-override): the result now, why, who, and when (an instant). */
export interface ComplianceOverride {
  status: 'qualified' | 'not_met';
  reason: string;
  by: ComplianceOverrideBy;
  at: string;
}

/**
 * One member's cell for the selected item, as codes. `status` null draws the neutral dash and is out of every
 * count; `done` null means the item does not apply to them; `on` is the office day the date column shows.
 * `second` is the second column's code: an event's feedback, a campaign's result.
 */
export interface ComplianceCell {
  status: string | null;
  done: boolean | null;
  on: string | null;
  second?: string | null;
  endedOn?: string | null;
  override?: ComplianceOverride | null;
  overridable?: boolean;
}

/** A row: the unit's head first, `personal`, then each member of the unit. */
export interface ComplianceRow {
  membershipId: string;
  name: string;
  personal: boolean;
  leads: boolean;
  cell: ComplianceCell;
}

export type ComplianceRung = 'AB' | 'AAB';

/** A unit card: the AB's own first, then each AAB who leads somebody (D-units). */
export interface ComplianceUnit {
  head: CompliancePerson;
  rung: ComplianceRung;
  done: number;
  of: number;
  rows: ComplianceRow[];
}

/** An AB's agency, A to Z by the head's name. */
export interface ComplianceSection {
  head: CompliancePerson;
  done: number;
  of: number;
  units: ComplianceUnit[];
}

/** A chip's count over those it applies to (D-chips); `of` 0 draws the dash. */
export interface ComplianceChip {
  category: ComplianceCategory;
  count: number;
  of: number;
}

export interface ComplianceModule {
  code: string;
  title: string;
}

export interface ComplianceSkill {
  code: string;
  label: string;
  modules: ComplianceModule[];
}

/** One of the office's training categories, an empty one included (*"Modules for … are coming soon."*). */
export interface ComplianceTrainingCategory {
  code: string;
  label: string;
  skills: ComplianceSkill[];
}

/** The goals counted: the office's current year. */
export interface ComplianceGoals {
  year: string;
}

export type ComplianceEventPhase = 'upcoming' | 'running' | 'past';

/** An event of the year (D-window). `startsOn` is its office day. */
export interface ComplianceEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsOn: string;
  phase: ComplianceEventPhase;
}

export type ComplianceCampaignKind = 'structural' | 'seasonal';
export type ComplianceCampaignPhase = 'upcoming' | 'running' | 'ended';

/** A campaign of the year (D-window): structural running, seasonal overlapping it; archived never. */
export interface ComplianceCampaign {
  code: string;
  title: string;
  kind: ComplianceCampaignKind;
  subtype: string | null;
  phase: ComplianceCampaignPhase;
  startsAt: string;
  endsAt: string | null;
  final: boolean;
}

/** What the tabs and the pickers offer. */
export interface ComplianceCatalog {
  training: ComplianceTrainingCategory[];
  goals: ComplianceGoals;
  events: ComplianceEvent[];
  campaigns: ComplianceCampaign[];
}

/** The selection the tree answers: the item asked, or the prototype's default; `null` with nothing to offer. */
export interface ComplianceSelection {
  category: ComplianceCategory;
  item: string | null;
}

/** Whether the reader may override a final standing: never in a read-only support session. */
export interface ComplianceCan {
  override: boolean;
}

export interface ComplianceView {
  today: string;
  people: number;
  units: number;
  summary: ComplianceChip[];
  catalog: ComplianceCatalog;
  selected: ComplianceSelection;
  tree: ComplianceSection[];
  can: ComplianceCan;
}

/** The address's `?category=&item=`, as the read takes it. */
export function complianceQuery(selection: ComplianceSelection): string {
  const item = selection.item && !SINGLE_ITEM.has(selection.category) ? `&item=${encodeURIComponent(selection.item)}` : '';
  return `?category=${selection.category}${item}`;
}

/**
 * The tree for a selection. Owner and Admin (`kpm_analytics:read`). A category the read does not know, an
 * item on a single-item one and any other parameter are 400, so the screen sends only what it offers; an item
 * the office does not list is 404. Appended with `+`, never interpolated: the API-consumer gate reads path
 * **literals** out of each call.
 */
export const readCompliance = (selection: ComplianceSelection) =>
  api<ComplianceView>('/kpm/analytics/compliance' + complianceQuery(selection));

/** One value of a query parameter, as `searchParams` may hold several. */
const one = (value: string | string[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * The selection the address names: *Training* when it names no category or one the read does not know; the
 * item only where the category has items to choose from.
 */
export function complianceSelectionFrom(query: { category?: string | string[]; item?: string | string[] }): ComplianceSelection {
  const asked = one(query.category);
  const category = COMPLIANCE_CATEGORIES.find((c) => c === asked) ?? DEFAULT_CATEGORY;
  const item = one(query.item)?.trim() || null;
  return { category, item: SINGLE_ITEM.has(category) ? null : item };
}

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The module's words in English, the catalogue's source. */
const EN = messagesIn(kpmComplianceMessages, SOURCE_LANGUAGE);

/** The sort toggle's label: its arrow, kept apart so it is not read aloud, and its words. */
const arrowed = (sort: { worst: string; best: string }) => ({ worst: ['↓', sort.worst], best: ['↑', sort.best] }) as const;

/**
 * **The strings `KPM_Owner.html` draws, in English** (ADR-0062), its literal counts computed (contradiction 1) — the
 * catalogue's source (`i18n/messages/kpm-compliance.ts`, P18.98-T4), in the shapes this module has always handed its
 * callers and its spec. **A screen reads the reader's language instead**: `useMessages(kpmComplianceMessages)`.
 *
 * `sub` is `:3457`, *"in this KPM"* on the client's list with OD-39, both counts the read's; `chips` the six
 * (`:3013-3020`); `activityTooltip` the Activity chip's `title` and the note strip under the tabs (`:3016`,
 * `:3549-3555`); `sort` the toggle's two labels per category (`:3672-3684`), the arrow kept apart; `verb` a card's and
 * a section's (`:3698`, `:3735`, `:3911`).
 */
export const PROTOTYPE_COPY = {
  title: EN.title,
  sub: (people: number, units: number) => EN.sub({ people, units }),
  chips: EN.chips satisfies Record<ComplianceCategory, string>,
  activityTooltip: EN.activityTooltip,
  comingSoon: (name: string) => EN.comingSoon({ name }),
  searchPlaceholder: EN.searchPlaceholder,
  noMatch: EN.noMatch,
  sort: {
    status: arrowed(EN.sort.status),
    events: arrowed(EN.sort.events),
    campaigns: arrowed(EN.sort.campaigns),
  },
  personal: EN.personal,
  tagAb: EN.tagAb,
  unitOf: EN.unitOf({ name: '' }),
  verb: { status: EN.verb({ kind: 'status' }), events: EN.verb({ kind: 'events' }), campaigns: EN.verb({ kind: 'campaigns' }) },
  verbOverall: {
    status: EN.verbOverall({ kind: 'status' }),
    events: EN.verbOverall({ kind: 'events' }),
    campaigns: EN.verbOverall({ kind: 'campaigns' }),
  },
  columns: {
    events: [EN.columns.events.first, EN.columns.events.second],
    campaigns: [EN.columns.campaigns.first, EN.columns.campaigns.second],
  },
  eventGroups: EN.eventGroups,
  campaignGroups: EN.campaignGroups,
  tags: EN.tags,
  alwaysOn: EN.alwaysOn,
  since: (date: string) => EN.since({ date }),
  ended: (date: string) => EN.ended({ date }),
} as const;

/**
 * **The module's own strings, in English** — the states the prototype lacks and the names a screen reader needs (Fills,
 * L-01), from the catalogue's source as `PROTOTYPE_COPY` is. None of OD-39's six words (*office*, *KPM*, *reports to*,
 * *tagged to*, *untagged*, *unassigned*), no phase, no code.
 */
export const OWN_COPY = {
  loading: EN.loading,
  tryAgain: EN.tryAgain,
  backTo: (category: string) => EN.backTo({ category }),
  noRate: EN.noRate,
  chipsName: EN.chipsName,
  trainingCategoriesName: EN.trainingCategoriesName,
  skillsName: EN.skillsName,
  modulesName: EN.modulesName,
  eventName: EN.eventName,
  campaignName: EN.campaignName,
  searchName: EN.searchName,
  noAbTitle: EN.noAbTitle,
  noAbLine: EN.noAbLine,
  noTraining: EN.noTraining,
  noEvents: EN.noEvents,
  noCampaigns: EN.noCampaigns,
  running: EN.running,
  starts: (date: string) => EN.starts({ date }),
  expiredName: (date: string) => EN.expiredName({ date }),
  awaitingConfirmation: EN.awaitingConfirmation,
} as const;

/*
 * ── Days ────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * An office day as the date column writes it (`:3027-3038`): *Sep 1*, with the year when it is not this one — a
 * figure, in `figures` (Indonesian when passed none).
 */
export function dayWords(day: string, today: string, figures?: Language): string {
  return formatShortDay(day, { year: day.slice(0, 4) !== today.slice(0, 4) }, figures);
}

/** A campaign's date label (`CAMPAIGN_ITEMS`, `:3002-3011`): its words in `language`, its day in `figures`. */
export function campaignDateLabel(
  campaign: ComplianceCampaign,
  today: string,
  language: Language = SOURCE_LANGUAGE,
  figures?: Language,
): string {
  const t = messagesIn(kpmComplianceMessages, language);
  if (campaign.kind === 'structural') return t.alwaysOn;
  if (campaign.phase === 'ended' && campaign.endsAt) return t.ended({ date: dayWords(officeDay(campaign.endsAt), today, figures) });
  const starts = dayWords(officeDay(campaign.startsAt), today, figures);
  return campaign.phase === 'upcoming' ? t.starts({ date: starts }) : t.since({ date: starts });
}

/** A campaign's tag (`:3600-3601`), and an upcoming seasonal one's own (contradiction 8). */
export function campaignTag(campaign: ComplianceCampaign, language: Language = SOURCE_LANGUAGE): { label: string; tone: TagTone } {
  const { tags } = messagesIn(kpmComplianceMessages, language);
  if (campaign.kind === 'structural') return { label: tags.structural, tone: 'structural' };
  if (campaign.phase === 'ended') return { label: tags.past, tone: 'past' };
  if (campaign.phase === 'upcoming') return { label: tags.upcoming, tone: 'upcoming' };
  return { label: tags.ongoing, tone: 'ongoing' };
}

/** An event's tag: its phase word (`:3586`), a running one's included. */
export function eventTag(event: ComplianceEvent, language: Language = SOURCE_LANGUAGE): { label: string; tone: TagTone } {
  const t = messagesIn(kpmComplianceMessages, language);
  if (event.phase === 'past') return { label: t.tags.past, tone: 'past' };
  if (event.phase === 'running') return { label: t.running, tone: 'ongoing' };
  return { label: t.tags.upcoming, tone: 'upcoming' };
}

export type TagTone = 'upcoming' | 'past' | 'structural' | 'ongoing';

/*
 * ── The pickers' groups ─────────────────────────────────────────────────────────────────────────
 */

/**
 * The event picker's two groups (`:3574-3577`): *Upcoming*, soonest first — a running event among them — and
 * *Past*, the latest first.
 */
export function eventGroups(events: readonly ComplianceEvent[]): { upcoming: ComplianceEvent[]; past: ComplianceEvent[] } {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    upcoming: sorted.filter((e) => e.phase !== 'past'),
    past: sorted.filter((e) => e.phase === 'past').reverse(),
  };
}

/**
 * The campaign picker's three groups (`:3594-3596`): *Structural*, *Seasonal — Ongoing* (an upcoming one among
 * them) and *Seasonal — Past*, each in the read's order.
 */
export function campaignGroups(campaigns: readonly ComplianceCampaign[]) {
  return {
    structural: campaigns.filter((c) => c.kind === 'structural'),
    ongoing: campaigns.filter((c) => c.kind === 'seasonal' && c.phase !== 'ended'),
    past: campaigns.filter((c) => c.kind === 'seasonal' && c.phase === 'ended'),
  };
}

/** The campaign a code names, in any case, as the read accepts one (`:code` is upper-cased there). */
export function campaignOf(campaigns: readonly ComplianceCampaign[], code: string | null): ComplianceCampaign | null {
  const wanted = code?.toUpperCase();
  return campaigns.find((c) => c.code.toUpperCase() === wanted) ?? null;
}

/** A training category holds a module when one of its skills does; only those skills get a tab. */
export const skillsWithModules = (category: ComplianceTrainingCategory) => category.skills.filter((s) => s.modules.length > 0);

/** The first module of the first skill of a category that holds one — the prototype's default (`:3484-3487`). */
export const firstModuleOf = (category: ComplianceTrainingCategory): string | null =>
  skillsWithModules(category)[0]?.modules[0]?.code ?? null;

/** Where a module sits in the catalog: its category and its skill. */
export function trainingPathOf(catalog: readonly ComplianceTrainingCategory[], module: string | null) {
  for (const category of catalog) {
    for (const skill of category.skills) {
      if (skill.modules.some((m) => m.code === module)) return { category, skill };
    }
  }
  return null;
}

/*
 * ── Search and sort, as the prototype does them ─────────────────────────────────────────────────
 */

export type SortDirection = 'worst' | 'best';

/** What the column's words and verbs follow: the status column, or one of the two-column trees. */
export type TreeKind = 'status' | 'events' | 'campaigns';

export const treeKindOf = (category: ComplianceCategory): TreeKind =>
  (category === 'events' || category === 'campaigns' ? category : 'status');

/**
 * Each code's place worst-first (`STATUS_ORDER`, `:2914`; `eventOrderValue`, `:3709-3714`; the campaigns' chase
 * order, `:3843-3845`). `null` is a *—* row, which goes last whichever way the list is read (contradiction 15).
 */
const STATUS_RANK: Record<string, number> = {
  not_started: 0, in_progress: 1, done: 2,
  not_set: 0, set: 2,
  missed: 0, logged: 2,
  overdue: 0, completed: 2,
};

export function rankOf(kind: TreeKind, cell: ComplianceCell): number | null {
  if (kind === 'campaigns') {
    if (cell.status === 'not_chasing') return 0;
    return cell.status === 'chasing' ? 1 : null;
  }
  if (kind === 'events') {
    if (cell.status === 'not_registered' || cell.status === 'no_show') return 0;
    if (cell.status === 'attended') return cell.second === 'not_shared' ? 1 : 2;
    return cell.status === 'registered' ? 2 : null;
  }
  return cell.status !== null && cell.status in STATUS_RANK ? STATUS_RANK[cell.status] : null;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * A card's rows in order (`:4065-4066`): the head's own row first, then the rest worst-first or best-first, the
 * *—* rows last both ways, a tie by name.
 */
export function sortRows(rows: readonly ComplianceRow[], kind: TreeKind, direction: SortDirection): ComplianceRow[] {
  const personal = rows.filter((r) => r.personal);
  const rest = rows.filter((r) => !r.personal).sort((a, b) => {
    const [x, y] = [rankOf(kind, a.cell), rankOf(kind, b.cell)];
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    return (direction === 'worst' ? x - y : y - x) || byName(a, b);
  });
  return [...personal, ...rest];
}

/**
 * The tree a search leaves (`:4017-4071`): the search trimmed and compared case-insensitively as a substring;
 * a card kept when anybody in it matches, showing those who match with its head's own row kept first for
 * context; a section kept when any of its cards is. **Counts are not recomputed**: a card and a section total
 * every member they hold, as the prototype's do.
 */
export function searchTree(tree: readonly ComplianceSection[], search: string): ComplianceSection[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...tree];
  const hit = (name: string) => name.toLowerCase().includes(needle);
  return tree
    .map((section) => ({
      ...section,
      units: section.units
        .filter((unit) => unit.rows.some((r) => hit(r.name)))
        .map((unit) => {
          const shown = unit.rows.filter((r) => hit(r.name));
          const head = unit.rows.find((r) => r.personal);
          return { ...unit, rows: head && !shown.includes(head) ? [head, ...shown] : shown };
        }),
    }))
    .filter((section) => section.units.length > 0);
}
