import { api } from './api-client';

/**
 * **Advanced analytics › *Event*, as the API answers it** (P19.25-T1, T2; ADR-0281; `functional/advanced-analytics.md`,
 * *Event*): *Kehadiran* and *Feedback*. **Every figure is the server's** — the averages, the shares, the colours, who is
 * stale and who is under half — so nothing on the screen re-counts or re-rounds a number (invariant §7); the screen
 * picks which of the served figures to draw and sorts the rows it lists.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`.
 */

export type KehadiranTone = 'green' | 'yellow' | 'red';

/** The period read: the year to date, or one month. */
export interface EventPeriod {
  kind: 'ytd' | 'month';
  month: string | null;
  from: string;
  to: string;
}

export interface EventTypeRef {
  code: string;
  label: string;
}

/** A person as every list on the tab draws them. */
export interface EventPersonRef {
  membershipId: string;
  name: string;
  photoUrl: string | null;
  /** `ab`, `aab` or `agent`. */
  role: string;
}

/** A share hadir: averages per event (a count over one event), the share from the sums, its colour. */
export interface KehadiranFigure {
  hadir: number | null;
  expected: number | null;
  pct: number | null;
  tone: KehadiranTone | null;
  events: number;
}

export interface PastEventRow {
  eventId: string;
  title: string;
  type: EventTypeRef;
  startsOn: string;
  /** Its roll call has been taken; until then *Belum dicatat* and in no average. */
  recorded: boolean;
  figure: KehadiranFigure | null;
}

export interface DeclinedAnswer {
  membershipId: string;
  reason: string | null;
}

export interface UpcomingEventRow {
  eventId: string;
  title: string;
  type: EventTypeRef;
  startsOn: string;
  startsAt: string;
  /** Office days to its start: 0 today or running, 1 *Besok*, n *n hari lagi*. */
  daysUntil: number;
  running: boolean;
  going: string[];
  declined: DeclinedAnswer[];
  pending: string[];
}

export interface KehadiranPerson {
  membershipId: string;
  name: string;
  photoUrl: string | null;
  role: string;
  phone: string | null;
  /** Still a member: listed in *Per orang*. */
  current: boolean;
  /** One mark per `past` event, in its order: `1` hadir, `0` tidak hadir, `.` not expected, `?` not recorded. */
  marks: string;
  attended: number;
  expected: number;
  pct: number | null;
  tone: KehadiranTone | null;
  recentAttended: number;
  recentExpected: number;
  lastEventId: string | null;
  stale: boolean;
  underHalf: boolean;
}

export interface KehadiranAbGroup {
  ab: EventPersonRef;
  people: number;
  period: KehadiranFigure;
  recent: KehadiranFigure;
  byEvent: (KehadiranFigure | null)[];
}

export interface KehadiranGroupRef {
  groupId: string;
  name: string;
}

export interface KehadiranGroupCard {
  /** The group's id, or `none` for *Tanpa group*. */
  key: string;
  group: KehadiranGroupRef | null;
  leaders: EventPersonRef[];
  people: number;
  abGroups: KehadiranAbGroup[];
  period: KehadiranFigure;
  recent: KehadiranFigure;
  byEvent: (KehadiranFigure | null)[];
}

export interface Kehadiran {
  period: EventPeriod;
  currentMonth: string;
  members: number;
  recordedEvents: number;
  recentEvents: number;
  summary: KehadiranFigure;
  past: PastEventRow[];
  upcoming: UpcomingEventRow[];
  groups: KehadiranGroupCard[];
  people: KehadiranPerson[];
  canRecord: boolean;
}

export interface FeedbackShares {
  promoter: number;
  passive: number;
  detractor: number;
}

export interface FeedbackQuote {
  role: 'leader' | 'agent';
  text: string;
}

export interface FeedbackSummaryFigure {
  nps: number | null;
  average: number | null;
  answers: number;
  shares: FeedbackShares | null;
  tone: KehadiranTone | null;
  few: boolean;
  hadir: number;
  share: number | null;
}

export interface FeedbackEventRow {
  eventId: string;
  title: string;
  type: EventTypeRef;
  startsOn: string;
  recorded: boolean;
  nps: number | null;
  average: number | null;
  answers: number;
  shares: FeedbackShares | null;
  tone: KehadiranTone | null;
  few: boolean;
  why: FeedbackQuote[];
  improve: FeedbackQuote[];
}

/** `NPS.*`, served: the scale's ends and the buckets' edges, for the legend. Never re-declared here (invariant §7). */
export interface NpsScale {
  scaleMin: number;
  scaleMax: number;
  promoterMin: number;
  detractorMax: number;
}

export interface EventFeedback {
  period: EventPeriod;
  currentMonth: string;
  events: number;
  summary: FeedbackSummaryFigure;
  rows: FeedbackEventRow[];
  constants: NpsScale;
}

/*
 * Each path written out in its call, where `scripts/check-api-consumers.py` reads it.
 */
const monthQuery = (month: string | undefined) => (month ? `month=${encodeURIComponent(month)}` : '');

export const readKehadiran = (month?: string) =>
  api<Kehadiran>(`/kpm/advanced-analytics/events/attendance?${monthQuery(month)}`);

export const readEventFeedback = (month?: string) =>
  api<EventFeedback>(`/kpm/advanced-analytics/events/feedback?${monthQuery(month)}`);

/*
 * ── What the screen derives from the answer, and nothing more ───────────────────────────────────
 */

/** How many rows a list shows before *Lihat semua (n)*: the brief's *newest 6*. */
export const FIRST_ROWS = 6;
/** How many members *Per orang* shows before *Lihat semua*. */
export const FIRST_PEOPLE = 10;
/** How many avatars an avatar stack draws before *+n*. */
export const STACK_AVATARS = 7;

/**
 * **The strip's events**, oldest to newest (*"15 event terakhir · lama → baru"*): the indexes into `past` of the last
 * `recentEvents` recorded events, reversed. An unrecorded event is never a square.
 */
export function stripIndexes(view: Pick<Kehadiran, 'past' | 'recentEvents'>): number[] {
  return view.past.map((e, i) => (e.recorded ? i : -1)).filter((i) => i >= 0).slice(0, view.recentEvents).reverse();
}

/** The recorded events of the period, newest first — *Bandingkan dengan*'s choices; the first is its default. */
export function recordedIndexes(view: Pick<Kehadiran, 'past'>): number[] {
  return view.past.map((e, i) => (e.recorded ? i : -1)).filter((i) => i >= 0);
}

/** One past event's people: who was hadir and who was not, from their marks, in the server's order. */
export function eventPeople(view: Pick<Kehadiran, 'people'>, index: number): { hadir: KehadiranPerson[]; tidak: KehadiranPerson[] } {
  const hadir: KehadiranPerson[] = [];
  const tidak: KehadiranPerson[] = [];
  for (const p of view.people) {
    const mark = p.marks[index];
    if (mark === '1') hadir.push(p);
    else if (mark === '0') tidak.push(p);
  }
  return { hadir, tidak };
}

export type PeopleSort = 'hadir-asc' | 'hadir-desc' | 'nama' | 'last';

/**
 * ***Per orang*'s order** (P19.25-T1 AC-5): *Hadir* lowest first by default — by the served share, then the count, then
 * the name — or highest first; *Nama* A to Z; *Terakhir hadir* longest ago first (never attended first of all).
 */
export function sortPeople(people: readonly KehadiranPerson[], sort: PeopleSort, pastOrder: ReadonlyMap<string, number>): KehadiranPerson[] {
  const byName = (a: KehadiranPerson, b: KehadiranPerson) => a.name.localeCompare(b.name);
  const share = (p: KehadiranPerson) => p.pct ?? 101;
  const lastAt = (p: KehadiranPerson) => (p.lastEventId === null ? Number.MAX_SAFE_INTEGER : pastOrder.get(p.lastEventId) ?? Number.MAX_SAFE_INTEGER);
  const rows = [...people];
  switch (sort) {
    case 'hadir-asc': return rows.sort((a, b) => share(a) - share(b) || a.attended - b.attended || byName(a, b));
    case 'hadir-desc': return rows.sort((a, b) => share(b) - share(a) || b.attended - a.attended || byName(a, b));
    case 'nama': return rows.sort(byName);
    case 'last': return rows.sort((a, b) => lastAt(b) - lastAt(a) || byName(a, b));
  }
}

/** WhatsApp's share link, with no number: the reader picks the chat — the office's group, say. */
export function whatsAppShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** An NPS as the score is written: `+32`, `−10`, `0`. `magnitude` is `|nps|`, formatted by the caller. */
export function signed(nps: number, magnitude: string): string {
  return nps > 0 ? `+${magnitude}` : nps < 0 ? `−${magnitude}` : magnitude;
}
