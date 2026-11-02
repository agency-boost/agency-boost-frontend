import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { eventsOfficeMessages } from '@/i18n/messages/events-office';
import { api } from './api-client';
import type { EventPhase, NpsConstants } from './events';
import { OFFICE_TIME_ZONE, zoneOffsetMs } from './format';

/**
 * **The office's side of its events** (P18.5-T5 AC-7, AC-10; P18.5-T6 AC-5): the roll call and the *Feedback
 * Summary* that *View feedback* opens on a past row of Settings › Events (`KPM_Owner.html:1655`; D-rollcall),
 * and the people *Chosen people* and *Chosen leaders* are picked from (D-picker).
 *
 * **The server decides everything here too**: who was in the audience as at the event's start, who may be
 * confirmed and by whom (`can.confirm`, and `self` on the caller's own row — nobody confirms their own,
 * OD-31), the NPS and who it counts (confirmed attendees only), the buckets' edges. The screen draws them.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/*
 * ── The roll call ───────────────────────────────────────────────────────────────────────────────
 */

/** `EVENT_ATTENDANCE_STATUS`, D-status's five values. */
export type EventAttendanceStatus = 'attended' | 'registered' | 'unconfirmed' | 'no_show' | 'not_registered';

export interface RollCallRow {
  membershipId: string;
  name: string;
  orgLevelCode: string;
  /** The company ladder's label for the rung. */
  rung: string;
  /** *RSVP'd* / *Said they came* / —; the RSVP wins when both. */
  said: 'rsvp' | 'claimed' | null;
  /** The confirmation: `true` attended, `false` marked absent, `null` not confirmed. */
  attended: boolean | null;
  status: EventAttendanceStatus;
  /** The caller's own row: drawn with no control, and its reason (OD-31). */
  self: boolean;
}

export interface RollCallCan {
  /** Holds the confirmation, is not a read-only support session, and the event has ended. */
  confirm: boolean;
}

export interface RollCall {
  eventId: string;
  title: string;
  phase: EventPhase;
  ended: boolean;
  startsOn: string;
  people: RollCallRow[];
  can: RollCallCan;
}

export interface RollCallEntry {
  membershipId: string;
  attended: boolean | null;
}

/*
 * ── The Feedback Summary ────────────────────────────────────────────────────────────────────────
 */

export type NpsBucket = 'promoter' | 'passive' | 'detractor';

/** One answer, with its author's name (OD-151, ADR-0141). `why` and `improve` are `''` when not given. */
export interface FeedbackRow {
  membershipId: string;
  name: string;
  score: number;
  bucket: NpsBucket;
  why: string;
  improve: string;
  attendance: 'confirmed' | 'unconfirmed' | 'absent';
  /** In the NPS: a confirmed attendee's answer. */
  counted: boolean;
}

export interface FeedbackSummary {
  eventId: string;
  title: string;
  /** `EVENT_NPS`: `round(100·(P − D)/n)` over confirmed attendees; `null` with none — drawn *—*. */
  nps: number | null;
  /** *n*, the NPS's denominator. */
  counted: number;
  responses: number;
  awaitingConfirmation: number;
  rows: FeedbackRow[];
  constants: NpsConstants;
}

/*
 * ── The picker ──────────────────────────────────────────────────────────────────────────────────
 */

/** An active member who can be invited. `leads`: somebody under them now (the graph, ADR-0087). */
export interface EventInvitee {
  membershipId: string;
  name: string;
  orgLevelCode: string;
  rung: string;
  leads: boolean;
}

export interface EventInviteeList {
  people: EventInvitee[];
}

/*
 * ── The calls ───────────────────────────────────────────────────────────────────────────────────
 */

// Each path written out in its call, where `scripts/check-api-consumers.py` reads it.

export const readRollCall = (eventId: string) =>
  api<RollCall>(`/kpm/settings/events/${encodeURIComponent(eventId)}/attendance`);

/** Only the rows that changed: `true` confirms, `false` marks absent, `null` clears. */
export const saveRollCall = (eventId: string, entries: RollCallEntry[]) =>
  api<RollCall>(`/kpm/settings/events/${encodeURIComponent(eventId)}/attendance`, { method: 'PUT', body: { entries } });

export const readFeedbackSummary = (eventId: string) =>
  api<FeedbackSummary>(`/kpm/settings/events/${encodeURIComponent(eventId)}/feedback`);

export const readInvitees = () => api<EventInviteeList>('/kpm/settings/events/invitees');

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 */

/** The office's events' words in a language (`i18n/messages/events-office.ts`; P18.98-T4), English when none is passed. */
export const officeWordsIn = (language: Language = SOURCE_LANGUAGE) => messagesIn(eventsOfficeMessages, language);

const EN = officeWordsIn(SOURCE_LANGUAGE);

/**
 * The Owner's prototype, verbatim (`KPM_Owner.html`), in English, the catalogue's source: a screen reads the reader's
 * language, `useMessages(eventsOfficeMessages)`, and each function below takes it last.
 */
export const OWNER_PROTOTYPE_COPY = {
  /** `:1655`. */
  viewFeedback: EN.viewFeedback,
  /** `:3767-3768`. */
  why: EN.why,
  improve: EN.improve,
} as const;

/** *"{title} — Feedback Summary"* (`:3773`), the title as the office typed it. */
export const summaryTitle = (title: string, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).summaryTitle({ title });

/** *"= % Promoters (9–10) − % Detractors (0–6)"* (`:3774`), its numbers the served constants'. */
export const npsFormula = (c: NpsConstants, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).npsFormula({
  promoterMin: String(c.promoterMin), scaleMax: String(c.scaleMax), scaleMin: String(c.scaleMin), detractorMax: String(c.detractorMax),
});

/** *"· {n} responses"* (`:3774`), and *"· 1 response"* for one (`functional/events.md`, *The module's own strings*). */
export const responsesLine = (n: number, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).responses({ n });

/** *"{s}/10"* (`:3765`): figures, in no language. */
export const scoreOutOf = (score: number, c: NpsConstants) => `${score}/${c.scaleMax}`;

/** The NPS figure, *—* when nobody confirmed answered (contradiction 22): 0 is a reading, not an absence. */
export const npsFigure = (nps: number | null) => (nps === null ? '—' : String(nps));

/**
 * **Our own words**, in English. The roll call and the picker are ours to draw (D-rollcall, D-picker; Fills in the
 * console's idiom); the summary's three additions are data honesty (contradictions 22, 23). None of OD-39's
 * six words, no phase, no internal id (`components/events/copy.spec.ts`).
 */
export const ADMIN_COPY = {
  rollCall: EN.rollCall,
  // *View feedback*'s two tabs (P18.8-T13, ADR-0161 §6): *Roll call* above, and this; the strip's name.
  feedbackSummaryTab: EN.feedbackSummaryTab,
  feedbackParts: EN.feedbackParts,
  name: EN.name,
  role: EN.role,
  response: EN.response,
  attendance: EN.attendance,
  said: EN.said,
  attended: EN.attended,
  absent: EN.absent,
  notConfirmed: '—',
  ownRow: EN.ownRow,
  saveAttendance: EN.saveAttendance,
  saved: EN.saved,
  nobodyInvited: EN.nobodyInvited,
  loadingRollCall: EN.loadingRollCall,
  loadingSummary: EN.loadingSummary,
  noFeedback: EN.noFeedback,
  unconfirmedTip: EN.unconfirmedTip,
  absentTip: EN.absentTip,
  tryAgain: EN.tryAgain,
  close: EN.close,
  // The picker (D-picker).
  searchPeople: EN.searchPeople,
  noMatches: EN.noMatches,
  nobodyLeads: EN.nobodyLeads,
  loadingPeople: EN.loadingPeople,
  /** A chosen leader the graph no longer shows leading anybody: kept, never dropped. */
  leadsNobodyNow: EN.leadsNobodyNow,
  // The settings panel (P18.5-T5 AC-9), the spec's own words for `EVENT_HAS_RESPONSES`.
  hasResponses: EN.hasResponses,
} as const;

/** The chosen people the picker cannot list because they have left: one row for all of them, kept. */
export const leftRow = (n: number, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).left({ n });

/** *"· {k} awaiting attendance confirmation"*, when there are any (contradiction 23; form 5). */
export const awaitingLine = (k: number, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).awaiting({ n: k });

/** The confirmation of one row, in words, for a reader who cannot change it. */
export const attendedWords = (attended: boolean | null, language: Language = SOURCE_LANGUAGE) => {
  const t = officeWordsIn(language);
  return attended === true ? t.attended : attended === false ? t.absent : ADMIN_COPY.notConfirmed;
};

/** *"{n} chosen"*, the picker's count. */
export const chosenCount = (n: number, language: Language = SOURCE_LANGUAGE) => officeWordsIn(language).chosen({ n });

/** *"Attended — {name}"*: each row's two controls, named for the person they are about. */
export const markLabel = (mark: 'attended' | 'absent', name: string, language: Language = SOURCE_LANGUAGE) => {
  const t = officeWordsIn(language);
  return t.mark({ mark: mark === 'attended' ? t.attended : t.absent, name });
};

/*
 * ── The panel's times, in the office's zone (invariant §9, ADR-0016) ─────────────────────────────
 *
 * The settings panel's *Starts* and *Ends* are `datetime-local` fields, which carry a wall clock and no
 * zone. They are the office's wall clock — *"Your office’s time."* — whatever zone the browser is in, so a
 * stored instant is shown in `Asia/Jakarta` and a typed time is read in it. The browser's own zone is
 * never consulted: `new Date('2026-10-01T09:00')` is 09:00 wherever the laptop happens to be.
 */

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;


/** A wall clock typed in the office's zone — `2026-10-01T09:00` — as the instant it names. `''` for nothing. */
export function officeInstant(local: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const m = WALL.exec(local);
  if (!m) return '';
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Twice, so a time beside a change of offset lands on the offset in force at that time.
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(first), timeZone)).toISOString();
}

/** A stored instant as the office's wall clock, the field's own form: `2026-10-01T09:00`. */
export function officeWallClock(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const part = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}
