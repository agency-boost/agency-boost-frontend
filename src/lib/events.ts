import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { eventsMessages } from '@/i18n/messages/events';
import { api, toDisplayError, type ApiError } from './api-client';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { withDetail } from './confirmations';
import { formatClock, formatDayClock, formatShortDay } from './format';

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
 * Whether a *Join* is drawn for this event — the modal's *Join event* and the card's *Join* alike (P18.95-T10
 * AC-1): the server says the reader may RSVP (`can.rsvp`, all false in a read-only support session), the event
 * has not wrapped up, and they are not going already. The server refuses anything else all the same.
 */
export const canJoin = (event: Pick<GuestEvent, 'me' | 'ended'>, can: Pick<GuestEventCan, 'rsvp'>) =>
  can.rsvp && isOpen(event) && !isGoing(event);

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

/**
 * *"20 Sep 2026, 18.00"* (`:8534`, where the prototype wrote *Sep 20, 2026 · 6:00 PM*), in the office's calendar and
 * clock as the server resolved them — one date and time, written as every screen writes one (ADR-0167 §1). In
 * `figures`, the reader's figures (`useFigureLanguage()`; P18.98-T4): Indonesian when none is passed, as before.
 */
export const whenLine = (event: Pick<GuestEvent, 'startsOn' | 'startTime'>, figures?: Language) =>
  formatDayClock(event.startsOn, event.startTime, figures);

/** The modal's date alone, bolded before its time (`:8643`). */
export const dayOf = (event: Pick<GuestEvent, 'startsOn'>, figures?: Language) =>
  formatShortDay(event.startsOn, { year: true }, figures);

/** The modal's time alone (`:8643`). */
export const timeOf = (event: Pick<GuestEvent, 'startTime'>, figures?: Language) => formatClock(event.startTime, figures);

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 *
 * **In the catalogue** (`i18n/messages/events.ts`; P18.98-T4): a screen reads the reader's language,
 * `useMessages(eventsMessages)`; a function here takes the words' language last, English when none is passed, and
 * its caller passes `useLanguage()`. The objects below are the catalogue's English in the shapes this module has
 * always handed its spec.
 */

/** The events' words in a language. */
export const eventWordsIn = (language: Language = SOURCE_LANGUAGE) => messagesIn(eventsMessages, language);

const EN = eventWordsIn(SOURCE_LANGUAGE);

/**
 * **The prototype's words, verbatim** (`Overall.html`), in English, the catalogue's source. Three carry *KPM* — the
 * title, its sub-line and the audience line's issuer — and go to the client with OD-39, as every such string has
 * since ADR-0084. The title is `:10413`'s *KPM Events*, **the nav item's words since P18.95-T9 AC-2** (ADR-0167 §10,
 * OD-205): the nav reads *Event list* (`:2664`).
 */
export const PROTOTYPE_COPY = {
  title: EN.title,
  sub: EN.sub,
  filters: EN.filters as Record<EventFilter, string>,
  sections: EN.sections,
  emptyGoing: EN.emptyGoing,
  emptyUpcoming: EN.emptyUpcoming,
  emptyPast: EN.emptyPast,
  tags: EN.tags as Record<EventTag, string>,
  pills: EN.pills as Record<EventPill, string>,
  viewEvent: EN.viewEvent,
  /** `:8637`: a mark, in no language. */
  close: '✕',
  youreGoing: EN.youreGoing,
  cancelRsvp: EN.cancelRsvp,
  joinEvent: EN.joinEvent,
  formQuestion: EN.formQuestion,
  formHint: EN.formHint,
  why: EN.why,
  optional: EN.optional,
  whyPlaceholder: EN.whyPlaceholder,
  improve: EN.improve,
  improvePlaceholder: EN.improvePlaceholder,
  submitFeedback: EN.submitFeedback,
  didntJoinTitle: EN.didntJoinTitle,
  didntJoinSub: EN.didntJoinSub,
  claim: EN.claim,
  thanksTitle: EN.thanksTitle,
  feedbackSubmitted: EN.feedbackSubmitted,
  claimed: EN.claimed,
} as const;

/**
 * *"Joined ✓ — you're going to {title}"*: the client's *Joined ✓* (P18.95-T1 AC-6, ADR-0167 §5; UI-008), then the
 * prototype's *"You're going to {title}"* (`:8718`), so the toast still says which event — both in `language`, *Joined ✓*
 * the shared confirmation's (`i18n/messages/confirmations.ts`).
 */
export const goingToast = (title: string, language: Language = SOURCE_LANGUAGE) =>
  withDetail(messagesIn(confirmationMessages, language).joined, eventWordsIn(language).goingDetail({ title }));
/** The card's *Join*, named with its event for a screen reader: *"Join Kickoff 2026"* (P18.95-T10 AC-1). */
export const joinName = (title: string, language: Language = SOURCE_LANGUAGE) => eventWordsIn(language).joinName({ title });
/** *"RSVP cancelled for {title}"* (`:8728`). */
export const cancelledToast = (title: string, language: Language = SOURCE_LANGUAGE) =>
  eventWordsIn(language).cancelled({ title });

/*
 * The scale's words carry the scale's numbers, and the numbers are served (`limits.nps`): *"0 — Not at all
 * likely"*, *"10 — Extremely likely"* (`:8661-8664`), *"Pick a score from 0–10 first"* (`:8755`), *"You scored
 * this event {n}/10"* (`:8696`). Composed here so no `10` is written down twice (invariant §7).
 */
export const scaleLowLine = (nps: NpsConstants, language: Language = SOURCE_LANGUAGE) =>
  eventWordsIn(language).scaleLow({ min: String(nps.scaleMin) });
export const scaleHighLine = (nps: NpsConstants, language: Language = SOURCE_LANGUAGE) =>
  eventWordsIn(language).scaleHigh({ max: String(nps.scaleMax) });
export const pickScoreToast = (nps: NpsConstants, language: Language = SOURCE_LANGUAGE) =>
  eventWordsIn(language).pickScore({ min: String(nps.scaleMin), max: String(nps.scaleMax) });
/** The scale's scores in order, `0` to `10`. */
export const scaleOf = (nps: NpsConstants) =>
  Array.from({ length: nps.scaleMax - nps.scaleMin + 1 }, (_, i) => nps.scaleMin + i);

/** *"You scored this event {n}/10 — "{why}""*, the why only when there is one (`:8696`), as the member typed it. */
export const scoredLine = (feedback: Pick<GuestFeedback, 'score' | 'why'>, nps: NpsConstants, language: Language = SOURCE_LANGUAGE) =>
  eventWordsIn(language).scored({ score: String(feedback.score), max: String(nps.scaleMax), why: feedback.why });

/**
 * The audience line (`:8532`): *"{issuer} | {scope}"* in the prototype's words (`events-and-campaigns.md`
 * §3) — *"Prudential Event | All agents"*, *"KPM | Leaders only"* — composed from the two structured fields
 * (F-44 amended), so it can never say something the audience is not. The company's name is as stored, and
 * *{company} Event* the same in both languages (the glossary's §C5); the scope is in `language`.
 */
export function audienceLine(audience: GuestEventAudience, companyName: string, language: Language = SOURCE_LANGUAGE): string {
  const t = eventWordsIn(language);
  const issuer = audience.issuer === 'company' ? t.companyEvent({ company: companyName }).trim() : t.issuers[audience.issuer];
  return t.audience({ issuer, scope: t.scopes[audience.scope] });
}

/**
 * **Our own words** — the states the prototype has none of (L-01), the dialog's name for its ✕, and the
 * not-found state. None of OD-39's six words, no phase, no internal id (`components/events/copy.spec.ts`).
 */
export const OWN_COPY = {
  filterLabel: EN.filterLabel,
  closeModal: EN.closeModal,
  loadingList: EN.loadingList,
  loadingEvent: EN.loadingEvent,
  tryAgain: EN.tryAgain,
  notFound: EN.notFound,
  notFoundHint: EN.notFoundHint,
  backToEvents: EN.backToEvents,
  opensInNewTab: EN.opensInNewTab,
  /**
   * The card's *Join* — the client's word (P18.95-T10 AC-1; UI-024, ADR-0167), where the prototype's card had no
   * control but *View event*. Its accessible name adds the event's title, so a list of them is told apart.
   */
  join: EN.join,
} as const;

/**
 * **A refusal the screen can meet, in the spec's words** (`functional/events.md`, *The module's own strings*):
 * the event ended while the modal was open, or has not ended yet by the server's clock — in `language`. Any other
 * refusal is the server's own line, in the reader's language already (P18.98-T5). The code and the request id stay
 * in the banner either way.
 */
export function refusalOf(err: unknown, language: Language = SOURCE_LANGUAGE): ApiError {
  const shown = toDisplayError(err);
  const words = (eventWordsIn(language).refusals as Readonly<Record<string, string>>)[shown.code];
  return words ? { ...shown, message: words } : shown;
}
