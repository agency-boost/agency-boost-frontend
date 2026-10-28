import { api } from './api-client';
import {
  dayInZone, formatNumber, formatPercent, formatRupiahCompact, OFFICE_TIME_ZONE, zoneOffsetMs,
} from './format';
import { formatBenchmark, formatRatioForStatus, unitFor, type RatioDisplayUnit } from './ratio-format';

/**
 * **Campaigns** (`docs/02-specs/functional/campaigns.md`, P18.5-T7 to T9): the shapes the field reads answer,
 * the calls that ask for them, and the words `Overall.html` draws them with — the list at `/campaigns`
 * (`:3664-3702`, logic `:7920-8243`), its dialog at `/campaigns/[campaignCode]` (`:8177-8228`), the
 * Summary's *Campaigns you're chasing* (`:3225-3232`, `:6221-6253`) and the coachee's chips (`:4121-4130`).
 *
 * **Every judgement is the server's**: a campaign's phase in the office's calendar, its window, whether the
 * reader may chase it and why not, and a requirement's progress (OD-157). Nothing here counts a day, sums a
 * figure or decides an eligibility — it prints what it is answered, in the prototype's words.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

export type CampaignKind = 'seasonal' | 'structural';
export type CampaignSubtype = 'promotion' | 'ongoing';
/** Derived by the server from the campaign's days in the office's timezone (F-48). */
export type CampaignPhase = 'upcoming' | 'running' | 'ended';
/** D-windows: the campaign's own dates, the calendar year, or the last twelve months held. */
export type CampaignWindow = 'campaign_dates' | 'calendar_year' | 'rolling_12m';
export type Comparator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

/**
 * The poster's colour: a token name from the server's closed palette, never a hex value (row 44) — the
 * prototype's seven poster colours (`:7925-8021`), *gold* MDRT's.
 */
export type PosterColor = 'amber' | 'amber-dark' | 'navy' | 'navy-soft' | 'muted' | 'success' | 'gold';

export const POSTER_COLORS: readonly PosterColor[] = ['amber', 'amber-dark', 'navy', 'navy-soft', 'muted', 'success', 'gold'];

export interface CampaignPoster {
  emoji: string;
  color: PosterColor;
}

/** One requirement: a metric, a comparator and a number. `idr_minor` is integer sen (invariant §9). */
export interface CampaignRequirement {
  metricKey: string;
  metricName: string;
  comparator: Comparator;
  value: number;
  unit: string;
  /** `false` for a stored requirement nothing measures for a campaign (D-evaluable): *Not measured yet*. */
  measured: boolean;
}

/** Why the reader's chase control is not live: the campaign has ended (D-lists), or it is not for their rung. */
export type ChaseBlock = 'ended' | 'not_eligible';

/** One card of the list (`campaignCardHtml`, `:8040-8074`), as `GET /campaigns` answers it. */
export interface CampaignCard {
  code: string;
  title: string;
  kind: CampaignKind;
  /** `null` for a seasonal campaign. */
  subtype: CampaignSubtype | null;
  window: CampaignWindow;
  /** A structural campaign with no end that has started is `running`; its tag reads *Ongoing*. */
  phase: CampaignPhase;
  startsAt: string;
  endsAt: string | null;
  /** The window in words, composed by the server in the office's calendar: *1 Jul – 30 Sep 2026*. */
  duration: string;
  poster: CampaignPoster;
  blurb: string;
  /** The prize line. */
  reward: string;
  requirements: CampaignRequirement[];
  chasing: boolean;
  eligible: boolean;
  /** Whether the chase control is live, and why not; `null` when it is. */
  chaseBlocked: ChaseBlock | null;
}

/** What the reader may do here: `false` in a read-only support session, and for a role that chases nothing. */
export interface CampaignCan {
  chase: boolean;
}

/** `GET /campaigns`: already in D-lists' order. */
export interface CampaignList {
  campaigns: CampaignCard[];
  can: CampaignCan;
}

/**
 * A requirement's progress for the reader (OD-157, ADR-0147): *"{current} of {target}"*, ✓ when met, *Not
 * uploaded yet* where a month it reads is not held (never ✕), *Nothing logged yet* for an activity reading
 * with nothing in its window, *Not measured yet* where nothing measures it.
 */
export type ProgressState = 'met' | 'in_progress' | 'not_met' | 'not_uploaded' | 'nothing_logged' | 'not_measured';

export interface ProgressRow {
  metricKey: string;
  /** In the requirement's unit — sen for money; `null` when nothing can be read. */
  current: number | null;
  target: number;
  unit: string;
  state: ProgressState;
}

export interface CampaignProgress {
  /** The months or days read, in words: *Jul – Sep 2026*. */
  windowLabel: string;
  final: boolean;
  rows: ProgressRow[];
}

/** One campaign in its dialog: the card's fields, its description, and the reader's progress (`null` while upcoming). */
export interface CampaignDetail extends CampaignCard {
  description: string;
  can: CampaignCan;
  progress: CampaignProgress | null;
}

/** One row of a *chasing* list — the Summary's rows and the coachee's chips (D-lists: never ended). */
export interface ChasedCampaign {
  code: string;
  title: string;
  kind: CampaignKind;
  subtype: CampaignSubtype | null;
  /** Never `ended`: an ended campaign leaves every chasing list (D-lists). */
  phase: 'upcoming' | 'running';
  duration: string;
  /**
   * The months it runs, composed by the server in the office's calendar: *Runs Jan – Des*, *Runs Agu – Okt 2026*,
   * *Runs over the last 12 months* — the Summary row's line (P18.95-T7 AC-1, grey text row 23).
   */
  runs: string;
  poster: CampaignPoster;
}

export interface ChasingList {
  membershipId: string;
  campaigns: ChasedCampaign[];
}

/** The office's active campaigns, each with the reader's chase (`campaign:read_list`). */
export const readCampaigns = () => api<CampaignList>('/campaigns');

/** One campaign; 404 for another office's, an archived one, or a code that does not exist. */
export const readCampaign = (code: string) => api<CampaignDetail>(`/campaigns/${encodeURIComponent(code)}`);

/**
 * Chase, or stop: idempotent, no body. 409 `CAMPAIGN_NOT_OPEN` once it has ended, 403 `CAMPAIGN_NOT_ELIGIBLE`
 * for a rung it is not for, and refused in a read-only support session. Answers the campaign as the list has it.
 * Each path a whole literal: the API-consumer gate reads the paths an `api()` call names.
 */
export const chaseCampaign = (code: string) =>
  api<CampaignCard>(`/campaigns/${encodeURIComponent(code)}/chase`, { method: 'PUT' });
export const unchaseCampaign = (code: string) =>
  api<CampaignCard>(`/campaigns/${encodeURIComponent(code)}/chase`, { method: 'DELETE' });

/**
 * The campaigns somebody is chasing that have not ended: the reader's own, or — with `forMembershipId` — a
 * coachee's, under `campaign_qualification:read` (404 beyond the reader's reach). Appended, never
 * interpolated: the API-consumer gate reads path literals.
 */
export const readChasing = (forMembershipId?: string) =>
  api<ChasingList>('/campaigns/chasing' + (forMembershipId ? `?for=${encodeURIComponent(forMembershipId)}` : ''));

/*
 * ── The prototype's words ───────────────────────────────────────────────────────────────────────
 */

/** The strings `Overall.html` draws, verbatim. Those saying *KPM* go to the client with OD-39. */
export const PROTOTYPE_COPY = {
  /**
   * The prototype's *Campaigns*, **the nav item's words since P18.95-T9 AC-2** (ADR-0167 §10, OD-205; UI-027, *menu
   * labels = page titles*): the nav reads *Campaign list* (`:2669`).
   */
  title: 'Campaign List',
  // *Tap*, not *click* (P18.95-T9 AC-5; UI-027): the prototype's *click into any card*.
  subtitle: "Company and KPM campaigns — mark the ones you're chasing, tap any card for full requirements.",
  seasonal: 'Seasonal',
  structural: 'Structural',
  all: 'All',
  running: 'Running',
  upcoming: 'Upcoming',
  ended: 'Ended',
  ongoing: 'Ongoing',
  promotionCriteria: 'Promotion Criteria',
  productionClubs: 'Production Clubs',
  noRunning: 'No running campaigns right now.',
  noUpcoming: 'No upcoming campaigns.',
  noEnded: 'No ended campaigns to show.',
  noPromotion: 'No promotion criteria published yet.',
  noOngoing: 'No ongoing incentives right now.',
  /** Every campaign is the office's (OD-156, ADR-0146): the source tag reads *KPM* (`tagLabel`, `:8029`). */
  sourceTag: 'KPM',
  promotionPath: 'Promotion path',
  ongoingIncentive: 'Ongoing incentive',
  requirementsTitle: 'Requirements',
  prize: 'Prize',
  chase: 'Chase',
  chasing: 'Chasing',
  viewDetails: 'View details',
  /** The Summary card (`:3228-3229`, `:6229`, `:6245`). */
  chasingTitle: "Campaigns you're chasing",
  fromList: 'From the Campaign list',
  noneChased: "You're not chasing any campaigns yet — check the Campaign list to opt in.",
  view: 'View →',
  /** The Unit Dashboard detail's tile (`:7280`, `:7283`), whose empty words the coachee's card reuses (L-01). */
  theyreChasing: 'Campaigns they’re chasing',
  notChasingAny: 'Not currently chasing any campaigns.',
  /** The roster's row tooltips (`:7396`). */
  mdrtChasing: (name: string) => `${name} is chasing MDRT this year.`,
  mdrtNot: 'Not currently chasing MDRT.',
  chasingMdrt: 'Chasing MDRT',
} as const;

/** The two toasts (`toggleChase`, `:8144`). */
export const chasedToast = (title: string) => `Now chasing "${title}"`;
export const unchasedToast = (title: string) => `Removed "${title}" from your chase list`;

/**
 * The module's own words — the states the prototype lacks, the reasons it never gives. None of OD-39's six
 * words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*), no phase, no code.
 */
export const OWN_COPY = {
  types: 'Campaign types',
  statusFilter: 'Show campaigns',
  loading: 'Loading the campaigns…',
  loadingOne: 'Loading the campaign…',
  loadingChasing: 'Loading the campaigns being chased…',
  tryAgain: 'Try again',
  close: 'Close',
  notFound: 'This campaign isn’t on your list.',
  notFoundHint: 'It may have been withdrawn, or the address may be mistyped.',
  /** Why a chase control is not live: the server's reason, in words (D-lists; AC-5). */
  blocked: {
    ended: 'This campaign has ended.',
    not_eligible: 'This campaign is not open to your role.',
  } satisfies Record<ChaseBlock, string>,
  notUploaded: 'Not uploaded yet',
  /** An activity requirement with nothing logged in its window: no file is awaited, so not *Not uploaded yet*. */
  nothingLogged: 'Nothing logged yet',
  notMeasured: 'Not measured yet',
  met: 'Met',
  /**
   * The card's requirements, ***Needs:*** — the client's word (P18.95-T10 AC-3; UI-024, ADR-0167), where the
   * prototype wrote *Requirements:* (`:8032`). The dialog's heading stays *Requirements*.
   */
  needs: 'Needs:',
} as const;

/** *At least* is the plain figure; every other comparison is said (*exactly* since P18.95-T10 AC-3). */
const COMPARATOR: Record<Comparator, string> = { gte: '', gt: 'more than ', lte: 'at most ', lt: 'under ', eq: 'exactly ' };

/**
 * A figure in its unit: rupiah from sen (X-68's rule, invariant §9), a percentage, a ratio as the ratio card
 * writes it, or a count.
 *
 * **Compact and lossless** (ADR-0167 §1, ADR-0174 §3, §4): *Rp 500 jt*; but a requirement is a rule, and *Rp 2,5
 * M* for 2.450.000.000 would state a different one — so a figure that compact writing would round is written in
 * full. A percentage with the places a threshold was set to and no *,0* — *30%*, *75,55%* — and a figure read
 * against it with every place it has, so *74,96% / 75%* can never read *75% / 75%*. **A ratio in `ratioUnit`**, the
 * unit the office writes that ratio in (P18.97-T4 AC-8, ADR-0176 §8; UI-030: *"Recruitment success rate at least
 * 0,30"* on the campaigns settings): a success rate *30%*, leads per activity *1,50*; a caller that does not know it
 * gets the number, as before.
 */
export function figureWords(value: number, unit: string, ratioUnit: 'percent' | 'decimal' = 'decimal'): string {
  if (unit === 'idr_minor') return formatRupiahCompact(value, { lossless: true });
  if (unit === 'percentage') return formatPercent(value, { lossless: true });
  // A rate in the office's own unit for that ratio when the caller knows it — *30%* — else as a number, *0,30*.
  if (unit === 'ratio') return formatBenchmark(value, ratioUnit);
  if (unit === 'percentage_points') return formatBenchmark(value, 'points');
  return formatNumber(value, { maxDecimals: 2 });
}

/**
 * **How the office writes each of its ratios, by its code** — a ratio's code is its metric's key — so a requirement on
 * one reads as the ratio card and the settings do: *30%* for a success rate the office writes as a percentage, *1,50*
 * for one it writes as a number (P18.97-T4 AC-8 on the settings; P18.97-T7 on the agents' cards and dialog, ADR-0174 §2,
 * *one way of writing a percentage*). From the office's published configuration (`useTenantConfig`), whose read every
 * shell holds; with none yet, nothing — and a ratio reads as a number, as before.
 */
export type RatioUnits = ReadonlyMap<string, 'percent' | 'decimal'>;

export function ratioUnitsOf(
  ratios: readonly { code: string; displayUnit?: RatioDisplayUnit | null; comparison: 'gte' | 'band' }[] | null | undefined,
): RatioUnits {
  return new Map((ratios ?? []).map((ratio) => [ratio.code, unitFor(ratio) === 'percent' ? 'percent' : 'decimal'] as const));
}

/**
 * **What each campaign requirement counts, said after its figure** (P18.95-T10 AC-3; the client's UI-024): *Rp 16
 * jt APE*, *3 new hires* — one and many, as the figure is one or not. Keyed by the metric's code, never its name
 * (invariant §4). The campaign-evaluable set (`CAMPAIGN_METRICS`, D-evaluable) less the ratios, whose name is the
 * rate itself: those, the balance's points and a stored requirement outside the set keep `{name} {target}`.
 */
const NOUNS: Readonly<Record<string, readonly [one: string, many: string]>> = {
  APE_ACHIEVED: ['APE', 'APE'],
  NEW_HIRES: ['new hire', 'new hires'],
  NEW_ACTIVE_AGENTS: ['new active agent', 'new active agents'],
  MAA_COUNT_IN_UNIT: ['active agent in unit', 'active agents in unit'],
  CASCADE_ACTIVITY_TOUCHES: ['goal activity', 'goal activities'],
  ROLLING_PERSISTENCY: ['rolling persistency', 'rolling persistency'],
};

/**
 * One requirement in the card's words: ***Rp 16 jt APE***, ***3 new hires***, *more than 2 new active agents* — the
 * target compact only where that loses nothing (`figureWords`), then what it counts. Without a noun, the
 * prototype's `{label} {target}` (`reqRowHtml`, `:8031-8034`): *Selling success rate 15%* — **a ratio in the office's
 * unit for it** (`ratioUnits`, P18.97-T7), where it read *0,15* while the settings read *15%*.
 */
export function requirementWords(
  r: Pick<CampaignRequirement, 'metricKey' | 'metricName' | 'comparator' | 'value' | 'unit'>,
  ratioUnits?: RatioUnits,
): string {
  const target = `${COMPARATOR[r.comparator] ?? ''}${figureWords(r.value, r.unit, ratioUnits?.get(r.metricKey))}`;
  const noun = NOUNS[r.metricKey];
  if (!noun) return `${r.metricName} ${target}`;
  return `${target} ${r.value === 1 ? noun[0] : noun[1]}`;
}

/**
 * The card's line after *Needs:*, every requirement in its words **joined by *" + "*** (P18.95-T10 AC-3), where the
 * prototype joined them by *" | "* (`:8032`): *Rp 16 jt APE + 3 new hires*.
 */
export const requirementsLine = (requirements: readonly CampaignRequirement[], ratioUnits?: RatioUnits) =>
  requirements.map((r) => requirementWords(r, ratioUnits)).join(' + ');

/**
 * Whether the chase is drawn at all: the server lets the reader chase here (`can.chase`), and **the campaign has
 * not ended** (P18.95-T10 AC-2; UI-024) — the server's `chaseBlocked: 'ended'`, where it was drawn disabled with an
 * ⓘ. The server refuses a chase or a drop of an ended one all the same (`409 CAMPAIGN_NOT_OPEN`).
 */
export const showsChase = (c: Pick<CampaignCard, 'chaseBlocked'>, can: CampaignCan) =>
  can.chase && c.chaseBlocked !== 'ended';

/** The status tag (`:8047-8051`): the phase for a seasonal campaign, *Ongoing* for a structural one. */
export const statusWords = (c: Pick<CampaignCard, 'kind' | 'phase'>) =>
  (c.kind === 'structural' ? PROTOTYPE_COPY.ongoing : PROTOTYPE_COPY[c.phase]);

/** The Summary row's `kindLabel` (`:6233-6235`). */
export const kindLabel = (c: Pick<CampaignCard, 'kind' | 'subtype' | 'phase'>) =>
  (c.kind === 'seasonal'
    ? PROTOTYPE_COPY[c.phase]
    : c.subtype === 'promotion' ? PROTOTYPE_COPY.promotionPath : PROTOTYPE_COPY.ongoingIncentive);

/**
 * **The Summary row's sub-line: the months it runs** (P18.95-T7 AC-1, grey text row 23; ADR-0167 §7), at every size —
 * *Runs Jan – Des*, where the prototype's *"{kindLabel} · {duration}"* (`:6243`) read *"Ongoing incentive · Standing
 * — evaluated per calendar year (1 Jan – 31 Des)"*. The server composes it (`runs`); the dialog the row opens keeps
 * the campaign's kind and its dates.
 */
export const rowSubline = (c: ChasedCampaign) => c.runs;

/**
 * A requirement row's progress in the dialog (OD-157): *"{current} of {target}"* while there is a figure to
 * read, and why not where there is none — `null` where the row shows its target alone (upcoming).
 *
 * **A ratio in the office's unit for it** (`ratioUnit`, P18.97-T7; ADR-0174 §2): its target as typed — *30%* — and the
 * reader's figure as a ratio beside its benchmark is written, a percentage to its tenth, a number to two places, with
 * a place more where the rounding would reach a target it falls short of (`formatRatioForStatus`) — *28,6% of 30%*,
 * *29,96% of 30%*, never *30,0% of 30%* unmet.
 */
export function progressWords(
  row: ProgressRow | undefined,
  ratioUnit?: 'percent' | 'decimal',
): { text: string; met: boolean; figure: boolean } | null {
  if (!row) return null;
  if (row.state === 'not_uploaded') return { text: OWN_COPY.notUploaded, met: false, figure: false };
  if (row.state === 'nothing_logged') return { text: OWN_COPY.nothingLogged, met: false, figure: false };
  if (row.state === 'not_measured') return { text: OWN_COPY.notMeasured, met: false, figure: false };
  if (row.current === null) return { text: OWN_COPY.notUploaded, met: false, figure: false };
  const met = row.state === 'met';
  // Short of a target it must reach: the place more is written; met, or over a ceiling it must stay under, it is not.
  const short = !met && row.current < row.target;
  const current = row.unit === 'ratio' && ratioUnit
    ? formatRatioForStatus(row.current, ratioUnit, row.target, short ? 'alert' : 'neutral')
    : figureWords(row.current, row.unit);
  return {
    text: `${current} of ${figureWords(row.target, row.unit, ratioUnit)}`,
    met,
    figure: true,
  };
}

/*
 * ── The list ────────────────────────────────────────────────────────────────────────────────────
 */

export type SeasonalFilter = 'all' | CampaignPhase;

export const SEASONAL_FILTERS: readonly { id: SeasonalFilter; label: string }[] = [
  { id: 'all', label: PROTOTYPE_COPY.all },
  { id: 'running', label: PROTOTYPE_COPY.running },
  { id: 'upcoming', label: PROTOTYPE_COPY.upcoming },
  { id: 'ended', label: PROTOTYPE_COPY.ended },
];

export interface CampaignSection {
  id: 'running' | 'upcoming' | 'ended' | 'promotion' | 'ongoing';
  heading: string;
  empty: string;
  items: CampaignCard[];
}

/**
 * The seasonal view's three sections (`renderSeasonal`, `:8078-8100`), each shown or hidden whole by the
 * filter. In the server's order (D-lists): nothing here sorts.
 */
export function seasonalSections(campaigns: readonly CampaignCard[], filter: SeasonalFilter): CampaignSection[] {
  const of = (phase: CampaignPhase) => campaigns.filter((c) => c.kind === 'seasonal' && c.phase === phase);
  const sections: CampaignSection[] = [
    { id: 'running', heading: PROTOTYPE_COPY.running, empty: PROTOTYPE_COPY.noRunning, items: of('running') },
    { id: 'upcoming', heading: PROTOTYPE_COPY.upcoming, empty: PROTOTYPE_COPY.noUpcoming, items: of('upcoming') },
    { id: 'ended', heading: PROTOTYPE_COPY.ended, empty: PROTOTYPE_COPY.noEnded, items: of('ended') },
  ];
  return sections.filter((s) => filter === 'all' || s.id === filter);
}

/** The structural view's two sections (`renderStructural`, `:8102-8111`), in the server's order. */
export function structuralSections(campaigns: readonly CampaignCard[]): CampaignSection[] {
  const structural = campaigns.filter((c) => c.kind === 'structural');
  return [
    {
      id: 'promotion', heading: PROTOTYPE_COPY.promotionCriteria, empty: PROTOTYPE_COPY.noPromotion,
      items: structural.filter((c) => c.subtype === 'promotion'),
    },
    {
      id: 'ongoing', heading: PROTOTYPE_COPY.productionClubs, empty: PROTOTYPE_COPY.noOngoing,
      items: structural.filter((c) => c.subtype !== 'promotion'),
    },
  ];
}

/**
 * A code no campaign can have because the API holds a route there: `GET /campaigns/chasing` is the chasing
 * list, so `/campaigns/chasing` typed in the address is a campaign not found, never a read.
 */
export const isReservedCode = (code: string) => code.trim().toLowerCase() === 'chasing';

/** Where a campaign's dialog lives: over the list, at its own address (P14's D-urls). */
export const campaignHref = (code: string) => `/campaigns/${encodeURIComponent(code)}`;

/*
 * ── The Owner's form (D-fields) ─────────────────────────────────────────────────────────────────
 */


/**
 * An office day's first moment, or its last, as an instant (ADR-0016): *2026-10-01* starts at 00:00 in
 * Jakarta, 2026-09-30T17:00Z — whatever zone the browser is in. A campaign reading the monthly file runs in
 * whole office months (D-windows), and `new Date('2026-10-01')` is midnight UTC, seven hours in.
 */
export function officeDayEdge(day: string, edge: 'start' | 'end', timeZone: string = OFFICE_TIME_ZONE): string {
  const [y, m, d] = day.split('-').map(Number);
  const wall = edge === 'start' ? Date.UTC(y, m - 1, d) : Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  return new Date(wall - zoneOffsetMs(new Date(wall), timeZone)).toISOString();
}

/** The office day an instant falls on — the form's date field for a stored `startsAt` or `endsAt`. */
export const officeDay = (iso: string, timeZone: string = OFFICE_TIME_ZONE) => dayInZone(timeZone, new Date(iso));
