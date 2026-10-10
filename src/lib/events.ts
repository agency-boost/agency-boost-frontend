import { api, toDisplayError, type ApiError } from './api-client';
import { formatClock, formatShortDay } from './format';

/**
 * **KPM Events, as a member reads them** (`docs/02-specs/functional/events.md`, P18.5-T5 and T6): the
 * shapes the field reads answer, the calls that ask for them, and the words `/events` and its modal draw
 * them with (`Overall.html:3423-3448`, logic `:8425-8771`, the modal `:4707-4709`).
 *
 * **Everything that decides is the server's.** Which events the reader sees (the audience as at the
 * event's start, ADR-0039), whether one is upcoming, running or past (derived from its dates in the
 * office's zone), whether the reader may still RSVP, claim or answer: the screen draws the answer it is
 * given and asks nothing it could work out wrongly. **The reader never learns whether anybody confirmed
 * them** (OD-31): a claim is the member's word, and the roll call is the office's.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/*
 * ── The shapes ──────────────────────────────────────────────────────────────────────────────────
 */

/** Derived on every read from the event's dates. A running event sits with the upcoming ones (F-42). */
export type EventPhase = 'upcoming' | 'running' | 'past';

export type EventIssuer = 'company' | 'kpm' | 'group';
export type EventScope = 'all_agents' | 'select_agents' | 'leaders' | 'select_leaders';

/** The type an event is filed under: the poster is its emoji on its colour (`:8527-8528`). */
export interface GuestEventType {
  code: string;
  label: string;
  emoji: string | null;
  color: string | null;
}

/** The audience line's two parts. Never the invitee list (minimisation, AC-3). */
export interface GuestEventAudience {
  issuer: EventIssuer;
  scope: EventScope;
}

/** The reader's own answer to one event, kept whole. */
export interface GuestFeedback {
  score: number;
  why: string;
  improve: string;
  submittedAt: string;
}

/** The reader's own record of one event: their RSVP, their claim and their feedback. Never a confirmation. */
export interface GuestEventMe {
  rsvp: 'going' | 'cancelled' | null;
  claimed: boolean;
  feedback: GuestFeedback | null;
}

/** One event as the list and the modal read it. */
export interface GuestEvent {
  id: string;
  code: string;
  title: string;
  blurb: string;
  description: string;
  type: GuestEventType;
  audience: GuestEventAudience;
  startsAt: string;
  endsAt: string;
  /** The office's calendar day it starts on, `YYYY-MM-DD`. */
  startsOn: string;
  /** The office's wall-clock time it starts at, `HH:mm`. */
  startTime: string;
  location: string;
  locationUrl: string | null;
  phase: EventPhase;
  /** From `endsAt`: RSVP closes, the claim and the feedback open. */
  ended: boolean;
  me: GuestEventMe;
}

/** `NPS.*`, served: the scale's ends and the buckets' edges. Never re-declared here (invariant §7). */
export interface NpsConstants {
  scaleMin: number;
  scaleMax: number;
  promoterMin: number;
  detractorMax: number;
}

/** The form's bounds, served: `EVENT_FEEDBACK_TEXT_MAX` and the scale. */
export interface GuestEventLimits {
  feedbackTextMax: number;
  nps: NpsConstants;
}

/** What the reader may do, said in advance: all false in a read-only support session (roles §3.13). */
export interface GuestEventCan {
  rsvp: boolean;
  cancelRsvp: boolean;
  claim: boolean;
  feedback: boolean;
}

export interface GuestEventList {
  events: GuestEvent[];
  /** The company's name for the issuer *"Prudential Event"*; `''` when the server does not know it. */
  companyName: string;
  timezone: string;
  limits: GuestEventLimits;
  can: GuestEventCan;
}

/** What the form sends. `why` and `improve` are optional and trimmed by the server. */
export interface FeedbackInput {
  score: number;
  why?: string;
  improve?: string;
}

/** What the list holds besides its events, which the modal reads too. */
export type EventsMeta = Pick<GuestEventList, 'companyName' | 'limits' | 'can'>;

/*
 * ── The calls ───────────────────────────────────────────────────────────────────────────────────
 */

/*
 * Each path is written out in its call, where `scripts/check-api-consumers.py` reads it: a helper that
 * builds the path would hide every route here from the gate.
 */

export const readEvents = () => api<GuestEventList>('/events');

export const readEvent = (id: string) => api<GuestEvent>(`/events/${encodeURIComponent(id)}`);

export const rsvpEvent = (id: string) =>
  api<GuestEvent>(`/events/${encodeURIComponent(id)}/rsvp`, { method: 'POST', body: {} });

export const cancelRsvp = (id: string) =>
  api<GuestEvent>(`/events/${encodeURIComponent(id)}/rsvp/cancel`, { method: 'POST', body: {} });

/** *I actually attended this event*: the reader's claim. It never makes them *attended* (OD-31). */
export const claimAttendance = (id: string) =>
  api<GuestEvent>(`/events/${encodeURIComponent(id)}/attendance/claim`, { method: 'POST', body: {} });

export const submitFeedback = (id: string, body: FeedbackInput) =>
  api<GuestEvent>(`/events/${encodeURIComponent(id)}/feedback`, { method: 'POST', body });

/*
 * ── What the screen derives from the answer, and nothing more ───────────────────────────────────
 */

/** The list's three filters (`#event-segmented`, `:3426-3430`). */
export type EventFilter = 'all' | 'upcoming' | 'past';
export const EVENT_FILTERS: readonly EventFilter[] = ['all', 'upcoming', 'past'];

/** Not yet wrapped up: upcoming, or running now (F-42). The server's `ended`, never the browser's clock. */
export const isOpen = (event: Pick<GuestEvent, 'ended'>) => !event.ended;

/** RSVP'd *going*. */
export const isGoing = (event: Pick<GuestEvent, 'me'>) => event.me.rsvp === 'going';

/**
 * Joined, as the prototype's `joined` means it after the event (`:8732-8741`): RSVP'd, or said they came.
 * Before the event only the RSVP counts — a claim cannot exist yet.
 */
export const joined = (event: Pick<GuestEvent, 'me' | 'ended'>) =>
  isGoing(event) || (event.ended && event.me.claimed);

const byStart = (a: GuestEvent, b: GuestEvent) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title);

/**
 * The three sections (`:8549-8551`): *Going* and *Upcoming* soonest first, *Past* latest first
 * (`:8543-8544`). By the instant, where the prototype sorts by the day alone and two events on one day
 * fall in whatever order they were written.
 */
export function sections(events: readonly GuestEvent[]) {
  const open = events.filter(isOpen);
  return {
    going: open.filter(isGoing).sort(byStart),
    upcoming: open.filter((e) => !isGoing(e)).sort(byStart),
    past: events.filter((e) => !isOpen(e)).sort((a, b) => byStart(b, a)),
  };
}

/** The poster's corner tag (`:8502-8510`) — the modal's too (`:8601-8610`). */
export type EventTag = 'going' | 'notJoined' | 'past';
export function tagOf(event: GuestEvent): EventTag {
  if (event.ended) return joined(event) ? 'past' : 'notJoined';
  return isGoing(event) ? 'going' : 'notJoined';
}

/** The card's foot pill (`:8514-8524`): five states. */
export type EventPill = 'going' | 'notJoined' | 'didntJoin' | 'feedbackSent' | 'feedbackPending';
export function pillOf(event: GuestEvent): EventPill {
  if (isOpen(event)) return isGoing(event) ? 'going' : 'notJoined';
  if (!joined(event)) return 'didntJoin';
  return event.me.feedback ? 'feedbackSent' : 'feedbackPending';
}

/** What the past event's block holds (`:8624-8632`): the form, the didn't-join block, or the thanks. */
export type PastBlock = 'form' | 'didntJoin' | 'thanks';
export function pastBlockOf(event: GuestEvent): PastBlock {
  if (!joined(event)) return 'didntJoin';
  return event.me.feedback ? 'thanks' : 'form';
}

/** *"Sep 20, 2026 · 6:00 PM"* (`:8534`), in the office's calendar and clock as the server resolved them. */
export const whenLine = (event: Pick<GuestEvent, 'startsOn' | 'startTime'>) =>
  `${formatShortDay(event.startsOn, { year: true })} · ${formatClock(event.startTime)}`;

/** The modal's date alone, bolded before its time (`:8643`). */
export const dayOf = (event: Pick<GuestEvent, 'startsOn'>) => formatShortDay(event.startsOn, { year: true });

/** The modal's time alone (`:8643`). */
export const timeOf = (event: Pick<GuestEvent, 'startTime'>) => formatClock(event.startTime);

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **The prototype's words, verbatim** (`Overall.html`). Three carry *KPM* — the title, its sub-line and
 * the audience line's issuer — and go to the client with OD-39, as every such string has since ADR-0084.
 * The prototype's ASCII apostrophes are kept as written.
 */
export const PROTOTYPE_COPY = {
  /** `:10413`. */
  title: 'KPM Events',
  sub: 'Browse upcoming and past events from your KPM — join, and share feedback once they wrap up.',
  /** `:3426-3430`. */
  filters: { all: 'All', upcoming: 'Upcoming', past: 'Past' } as Record<EventFilter, string>,
  /** `:3432-3445`. */
  sections: { going: 'Going', upcoming: 'Upcoming', past: 'Past' },
  /** `:8562-8570`. */
  emptyGoing: "You haven't joined any upcoming events yet.",
  emptyUpcoming: 'No upcoming events right now.',
  emptyPast: 'No past events yet.',
  /** `:8502-8510`. */
  tags: { going: 'Going', notJoined: 'Not Joined', past: 'Past' } as Record<EventTag, string>,
  /** `:8514-8524`. */
  pills: {
    going: 'Going', notJoined: 'Not joined', didntJoin: "Didn't join", feedbackSent: 'Feedback sent', feedbackPending: 'Feedback pending',
  } as Record<EventPill, string>,
  /** `:8538`. */
  viewEvent: 'View event',
  /** `:8637`. */
  close: '✕',
  /** `:8617-8618`. */
  youreGoing: "You're going",
  cancelRsvp: 'Cancel RSVP',
  joinEvent: 'Join event',
  /** `:8656-8673`. */
  formQuestion: 'How likely are you to recommend this event to your colleagues?',
  formHint: 'This is the last step for this event — your feedback helps shape future ones.',
  scaleLow: 'Not at all likely',
  scaleHigh: 'Extremely likely',
  why: 'Why?',
  optional: '(optional)',
  whyPlaceholder: 'What stood out, good or bad?',
  improve: 'How can we improve?',
  improvePlaceholder: 'Any suggestions for next time?',
  submitFeedback: 'Submit feedback',
  /** `:8677-8688`. */
  didntJoinTitle: "You didn't join this event",
  didntJoinSub: "Feedback is only collected from agents who attended, so there's nothing to fill out here.",
  claim: 'I actually attended this event',
  /** `:8690-8700`. */
  thanksTitle: 'Thanks for your feedback',
  /** `:8718-8764`. */
  feedbackSubmitted: 'Feedback submitted — thank you!',
  claimed: 'Marked as attended — you can now leave feedback',
} as const;

/** *"You're going to {title}"* (`:8718`). */
export const goingToast = (title: string) => `You're going to ${title}`;
/** *"RSVP cancelled for {title}"* (`:8728`). */
export const cancelledToast = (title: string) => `RSVP cancelled for ${title}`;

/*
 * The scale's words carry the scale's numbers, and the numbers are served (`limits.nps`): *"0 — Not at all
 * likely"*, *"10 — Extremely likely"* (`:8661-8664`), *"Pick a score from 0–10 first"* (`:8755`), *"You scored
 * this event {n}/10"* (`:8696`). Composed here so no `10` is written down twice (invariant §7).
 */
export const scaleLowLine = (nps: NpsConstants) => `${nps.scaleMin} — ${PROTOTYPE_COPY.scaleLow}`;
export const scaleHighLine = (nps: NpsConstants) => `${nps.scaleMax} — ${PROTOTYPE_COPY.scaleHigh}`;
export const pickScoreToast = (nps: NpsConstants) => `Pick a score from ${nps.scaleMin}–${nps.scaleMax} first`;
/** The scale's scores in order, `0` to `10`. */
export const scaleOf = (nps: NpsConstants) =>
  Array.from({ length: nps.scaleMax - nps.scaleMin + 1 }, (_, i) => nps.scaleMin + i);

/** *"You scored this event {n}/10 — "{why}""*, the why only when there is one (`:8696`). */
export const scoredLine = (feedback: Pick<GuestFeedback, 'score' | 'why'>, nps: NpsConstants) =>
  `You scored this event ${feedback.score}/${nps.scaleMax}${feedback.why ? ` — "${feedback.why}"` : ''}`;

/**
 * The audience line (`:8532`): *"{issuer} | {scope}"* in the prototype's words (`events-and-campaigns.md`
 * §3) — *"Prudential Event | All agents"*, *"KPM | Leaders only"* — composed from the two structured fields
 * (F-44 amended), so it can never say something the audience is not.
 */
const ISSUER_WORDS: Record<Exclude<EventIssuer, 'company'>, string> = { kpm: 'KPM', group: 'Group event' };
const SCOPE_WORDS: Record<EventScope, string> = {
  all_agents: 'All agents',
  select_agents: 'Select agents',
  leaders: 'Leaders only',
  select_leaders: 'Select leaders',
};
export function audienceLine(audience: GuestEventAudience, companyName: string): string {
  const issuer = audience.issuer === 'company' ? `${companyName} Event`.trim() : ISSUER_WORDS[audience.issuer];
  return `${issuer} | ${SCOPE_WORDS[audience.scope]}`;
}

/**
 * **Our own words** — the states the prototype has none of (L-01), the dialog's name for its ✕, and the
 * not-found state. None of OD-39's six words, no phase, no internal id (`components/events/copy.spec.ts`).
 */
export const OWN_COPY = {
  filterLabel: 'Show events',
  closeModal: 'Close',
  loadingList: 'Loading events…',
  loadingEvent: 'Loading the event…',
  tryAgain: 'Try again',
  notFound: 'This event isn’t one you can open.',
  notFoundHint: 'It may have been archived, or it isn’t one you were invited to.',
  backToEvents: 'Back to events',
  opensInNewTab: 'opens in a new tab',
} as const;

/**
 * **A refusal the screen can meet, in the spec's words** (`functional/events.md`, *The module's own strings*):
 * the event ended while the modal was open, or has not ended yet by the server's clock. Any other refusal is
 * the server's own line. The code and the request id stay in the banner either way.
 */
const REFUSAL_WORDS: Readonly<Record<string, string>> = {
  EVENT_RSVP_CLOSED: 'This event has already ended.',
  EVENT_NOT_ENDED: 'This event hasn’t ended yet.',
};
export function refusalOf(err: unknown): ApiError {
  const shown = toDisplayError(err);
  const words = REFUSAL_WORDS[shown.code];
  return words ? { ...shown, message: words } : shown;
}
