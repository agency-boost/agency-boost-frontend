import type { PillTone } from '@/components/ui/status-pill';
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
 * (`STATUS_CLASS`, `:2915`).
 *
 * - *Goal Setting* has no *Draft saved* (ADR-0049: a goal is annual and has no draft) and *Activity Mgmt* no
 *   *Partial* (its own tooltip says there is none).
 * - A past event's *—* is a member awaiting the confirmer (`unconfirmed`); a campaign's *—* is a result not
 *   decided (`in_progress`) or one nothing could decide (`unknown`) — the registry's labels.
 */
export const COMPLIANCE_LABELS = {
  training: {
    done: { label: 'Completed', tone: DONE },
    in_progress: { label: 'In progress', tone: PROGRESS },
    not_started: { label: 'Not started', tone: NOT_DONE },
  },
  goals: {
    set: { label: 'Set', tone: DONE },
    not_set: { label: 'Not set', tone: NOT_DONE },
  },
  activity: {
    logged: { label: 'Logged', tone: DONE },
    missed: { label: 'Missed', tone: NOT_DONE },
  },
  activation: {
    completed: { label: 'Completed', tone: DONE },
    in_progress: { label: 'In progress', tone: PROGRESS },
    overdue: { label: 'Overdue', tone: NOT_DONE },
  },
  events: {
    /** *Joined*: an upcoming or running event's two, then a past event's four. */
    joined: {
      registered: { label: 'Registered', tone: DONE },
      not_registered: { label: 'Not registered', tone: NOT_DONE },
      attended: { label: 'Attended', tone: DONE },
      no_show: { label: 'No-show', tone: NOT_DONE },
      unconfirmed: NO_STATUS,
    },
    /** *Feedback*: asked of an attendee of a past event only; anybody else *—*. */
    feedback: {
      shared: { label: 'Shared', tone: DONE },
      not_shared: { label: 'Not shared', tone: NOT_DONE },
    },
  },
  campaigns: {
    chasing: {
      chasing: { label: 'Chasing', tone: DONE },
      not_chasing: { label: 'Not chasing', tone: NOT_DONE },
    },
    /** *Achieved*: an ended seasonal campaign's only (`:3889`); the registry's labels. */
    achieved: {
      qualified: { label: 'Achieved', tone: DONE },
      not_met: { label: 'Not achieved', tone: NOT_DONE },
      not_joined: { label: 'Not achieved', tone: NOT_DONE },
      in_progress: NO_STATUS,
      unknown: NO_STATUS,
    },
  },
} as const satisfies Record<string, Record<string, PillWords | Record<string, PillWords>>>;

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The strings `KPM_Owner.html` draws, verbatim (ADR-0062), its literal counts computed (contradiction 1). */
export const PROTOTYPE_COPY = {
  title: 'Compliance, Events, and Campaigns',
  /** `:3457`, *"in this KPM"* on the client's list with OD-39; both counts the read's. */
  sub: (people: number, units: number) =>
    `Every AB's unit in this KPM — ${plural(people, 'person', 'people')} across ${plural(units, 'unit', 'units')}`,
  chips: {
    training: 'Training',
    goals: 'Goal Setting',
    activity: 'Activity Mgmt',
    activation: 'Activation',
    events: 'Events',
    campaigns: 'Campaigns',
  } satisfies Record<ComplianceCategory, string>,
  /** The Activity chip's `title` and the note strip under the tabs (`:3016`, `:3549-3555`). */
  activityTooltip: 'Whether activity was logged at least once in the past 7 days — there\'s no partial state, only Logged or Missed.',
  comingSoon: (name: string) => `Modules for ${name} are coming soon.`,
  searchPlaceholder: 'Search agent or leader name…',
  noMatch: 'No one matches this search.',
  /** The sort toggle's two labels per category (`:3672-3684`), the arrow kept apart so it is not read aloud. */
  sort: {
    status: { worst: ['↓', 'Needs attention first'], best: ['↑', 'On track first'] },
    events: { worst: ['↓', 'Not joined first'], best: ['↑', 'Joined first'] },
    campaigns: { worst: ['↓', 'Not chasing first'], best: ['↑', 'Chasing first'] },
  },
  personal: 'Personal',
  tagAb: 'AB',
  unitOf: "'s Unit",
  /** A card's and a section's verb (`:3698`, `:3735`, `:3911`): *done*, *joined*, *chasing*. */
  verb: { status: 'done', events: 'joined', campaigns: 'chasing' },
  overall: 'overall',
  columns: { events: ['Joined', 'Feedback'], campaigns: ['Chasing', 'Achieved'] },
  eventGroups: { upcoming: 'Upcoming', past: 'Past' },
  campaignGroups: { structural: 'Structural', ongoing: 'Seasonal — Ongoing', past: 'Seasonal — Past' },
  tags: { upcoming: 'Upcoming', past: 'Past', structural: 'Structural', ongoing: 'Ongoing' },
  alwaysOn: 'Always on',
  since: (date: string) => `Since ${date}`,
  ended: (date: string) => `Ended ${date}`,
} as const;

/**
 * The module's own strings — the states the prototype lacks and the names a screen reader needs (Fills, L-01).
 * None of OD-39's six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*), no phase,
 * no code.
 */
export const OWN_COPY = {
  loading: 'Loading each unit’s statuses…',
  tryAgain: 'Try again',
  /** After a `404` on the item in the address: its category's default, which a retry would never reach. */
  backTo: (category: string) => `Back to ${category}`,
  /** The chip's dash over nobody (D-chips), named. */
  noRate: 'No rate: nobody to count',
  chipsName: 'Categories',
  trainingCategoriesName: 'Training categories',
  skillsName: 'Skills',
  modulesName: 'Modules',
  eventName: 'Event',
  campaignName: 'Campaign',
  searchName: 'Search agent or leader name',
  noAbTitle: 'There are no ABs yet.',
  noAbLine: 'Each AB’s agency gets a section here, with a row for each of its people.',
  noTraining: 'No training has been published yet.',
  noEvents: 'There are no events this year.',
  noCampaigns: 'There are no campaigns this year.',
  /** A running event's tag: the phase word (contradiction 8). */
  running: 'Running',
  /** An upcoming seasonal campaign's date: *"Since"* a day still ahead would not be true (contradiction 8). */
  starts: (date: string) => `Starts ${date}`,
  /** An expired activation's *Overdue* (OD-159, ADR-0149): its end, the accessible name and the tooltip both. */
  expiredName: (date: string) => `Overdue: ended on ${date} without being marked complete`,
  /** A past event's *—* for a member nobody has confirmed yet (D-status), for a screen reader. */
  awaitingConfirmation: 'awaiting confirmation',
} as const;

/*
 * ── Days ────────────────────────────────────────────────────────────────────────────────────────
 */

/** An office day as the date column writes it (`:3027-3038`): *Sep 1*, with the year when it is not this one. */
export function dayWords(day: string, today: string): string {
  return formatShortDay(day, { year: day.slice(0, 4) !== today.slice(0, 4) });
}

/** A campaign's date label (`CAMPAIGN_ITEMS`, `:3002-3011`). */
export function campaignDateLabel(campaign: ComplianceCampaign, today: string): string {
  if (campaign.kind === 'structural') return PROTOTYPE_COPY.alwaysOn;
  if (campaign.phase === 'ended' && campaign.endsAt) return PROTOTYPE_COPY.ended(dayWords(officeDay(campaign.endsAt), today));
  const starts = dayWords(officeDay(campaign.startsAt), today);
  return campaign.phase === 'upcoming' ? OWN_COPY.starts(starts) : PROTOTYPE_COPY.since(starts);
}

/** A campaign's tag (`:3600-3601`), and an upcoming seasonal one's own (contradiction 8). */
export function campaignTag(campaign: ComplianceCampaign): { label: string; tone: TagTone } {
  if (campaign.kind === 'structural') return { label: PROTOTYPE_COPY.tags.structural, tone: 'structural' };
  if (campaign.phase === 'ended') return { label: PROTOTYPE_COPY.tags.past, tone: 'past' };
  if (campaign.phase === 'upcoming') return { label: PROTOTYPE_COPY.tags.upcoming, tone: 'upcoming' };
  return { label: PROTOTYPE_COPY.tags.ongoing, tone: 'ongoing' };
}

/** An event's tag: its phase word (`:3586`), a running one's included. */
export function eventTag(event: ComplianceEvent): { label: string; tone: TagTone } {
  if (event.phase === 'past') return { label: PROTOTYPE_COPY.tags.past, tone: 'past' };
  if (event.phase === 'running') return { label: OWN_COPY.running, tone: 'ongoing' };
  return { label: PROTOTYPE_COPY.tags.upcoming, tone: 'upcoming' };
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
