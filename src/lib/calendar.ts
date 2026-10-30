import { shortOfRung } from '@/components/ui/role-badge';
import { api } from './api-client';
import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { calendarMessages } from '@/i18n/messages/calendar';
import { formatNumber } from './format';

/**
 * The calendar (Phase 12, `docs/02-specs/functional/calendar.md`): the shapes the API answers, the
 * calls that ask for them, and the words the screen draws them with.
 *
 * **Every day here is the office's, served by the read.** `GET /calendar/entries` answers the
 * period's dates, the dates ‹ and › ask for, the office's `today` and its minute of the day, so this
 * file and the screens built on it never read the browser's clock for a date and never work one out
 * from it (invariant §9; F-01, F-89, F-93). Times typed are the office's wall-clock, `HH:mm`, and the
 * server turns them into instants through `kpms.timezone`.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** The prototype's five, by their stable code; the legend's order is display (invariant §4). */
export type EntryType = 'meeting' | 'coaching' | 'client' | 'task' | 'travel';

/** The legend's and the type toggle's order (`Calendar_Section.html:310-314`, `:370-374`). */
export const ENTRY_TYPES: readonly EntryType[] = ['meeting', 'coaching', 'client', 'task', 'travel'];

/**
 * **The types' one set of names** (`:310-314`, `:370-374`): the legend's and the type toggle's words,
 * verbatim — and, since P18.95-T8 AC-2, the detail's badge, every entry's accessible name and the
 * agenda's line too. The prototype's badge capitalised the code instead (*Meeting*, *Coaching*,
 * *Client*, `:824`), so the legend said *Internal meeting* and the popup *Meeting* for one entry (the
 * client's UI review, UI-020; ADR-0167). The legend's are the ones the reader chooses from, so they won.
 * **In the catalogue** (`i18n/messages/calendar.tsx`, `types`; P18.98-T4): a screen reads the reader's language; this
 * is its English.
 */
export const TYPE_LABEL: Record<EntryType, string> = calendarMessages.en.types;

/**
 * What a read asks the server for: a week, a month, **the Agenda** — seven days from the day asked for, today when it
 * opens — or ***3 Hari***, three days from it (UI V1, 2026-10-30, UI-104 points 5 and 10). The server answers each
 * period's days and the dates ‹ and › ask for; nothing here counts them.
 */
export type CalendarView = 'week' | 'month' | 'agenda' | 'three_days';

/**
 * **What the screen draws** (UI-104 point 5): the switcher's four, *Agenda · 3 Hari · Week · Month*, at every width.
 * Each is its own read since UI V1 — the Agenda no longer draws the week's.
 */
export type CalendarDisplay = CalendarView;

/** The switcher's order (UI-104 point 5). */
export const DISPLAYS: readonly CalendarDisplay[] = ['agenda', 'three_days', 'week', 'month'];

/** The read a display asks for: its own. */
export const viewOf = (display: CalendarDisplay): CalendarView => display;

/** An invitee's answer. A block's member gives none: they are placed (ADR-0098). */
export type Answer = 'pending' | 'accepted' | 'declined';

/** How the server says this reader stands to the entry; the detail's actions follow it (D-write, ADR-0097). */
export type ReaderIs = 'organiser' | 'invitee' | 'placed' | 'ancestor';

/** A rung of the company's ladder: its stable code and the ladder's own label. */
export interface CalendarRung {
  code: string;
  label: string;
}

/** Whose calendar a read answers: the reader, or the member compared. */
export interface CalendarSubject {
  membershipId: string;
  name: string;
  rung: CalendarRung;
  /** A compared person's WhatsApp number (UI-104 point 9); `null` on the reader's own read, and when none. */
  phone: string | null;
}

/** One day of the period, in the office's calendar. Out of the period: an adjacent month's day. */
export interface CalendarDay {
  date: string;
  inPeriod: boolean;
}

/** The office's now: an instant, and its minute of the office's day, 0 to 1439. */
export interface CalendarNow {
  at: string;
  minute: number;
}

/** The organiser of an entry. A member who has left keeps the name they had on a past entry. */
export interface CalendarPerson {
  membershipId: string;
  name: string;
}

/**
 * One person on an entry. `answer` is served to the organiser alone, and never for a placed member;
 * `readerCoaches` is `true` on a *1:1 coaching* entry for each invitee the reader coaches (ADR-0099).
 */
export interface CalendarInvitee {
  membershipId: string;
  name: string;
  placed: boolean;
  answer?: Answer;
  readerCoaches: boolean;
}

/**
 * An entry, as this reader is answered it. A timed entry carries `date`, `start` and `end` (`end`
 * `00:00` being midnight at the end of the date); Travel carries `startsOn` and `endsOn`, inclusive.
 * The other kind's fields come as `null`.
 */
export interface CalendarEntry {
  entryId: string;
  version: number;
  type: EntryType;
  title: string;
  notes: string;
  allDay: boolean;
  date: string | null;
  start: string | null;
  end: string | null;
  startsOn: string | null;
  endsOn: string | null;
  startsAt: string;
  endsAt: string;
  organiser: CalendarPerson;
  invitees: CalendarInvitee[];
  readerIs: ReaderIs;
  myAnswer: Answer | null;
}

/**
 * **A busy block**: an entry the compared member only attends, which the reader could not read in
 * their own right (roles §2 rule 4). Its time and nothing else — no id, no type, no title, no people.
 */
export interface CalendarBusy {
  busy: true;
  allDay: boolean;
  date: string | null;
  start: string | null;
  end: string | null;
  startsOn: string | null;
  endsOn: string | null;
  startsAt: string;
  endsAt: string;
}

export type CalendarItem = CalendarEntry | CalendarBusy;

/** Where a task comes from (UI-104 point 1): a lead's next action, or a coaching action item. */
export type TaskSource = 'lead' | 'coaching';

/** A lead task's lead: its id, and the version a tick pins. */
export interface CalendarTaskLead {
  leadId: string;
  version: number;
}

/** A coaching task's item: its session, its id, and who coached the person — *Dari: {NAME}*. */
export interface CalendarTaskCoaching {
  sessionId: string;
  itemId: string;
  coachMembershipId: string;
}

/**
 * **One *Tugas*** (UI V1, UI-104 point 2): a date and no time — never on the grid, never *All day*. Read from its source
 * on every read, so it follows a moved next action or a ticked item.
 */
export interface CalendarTask {
  taskId: string;
  source: TaskSource;
  date: string;
  ownerMembershipId: string;
  /** The lead's name, or the coach's. */
  name: string;
  note: string;
  /** The lead's number, or the coach's: the row's WhatsApp. */
  phone: string | null;
  lead: CalendarTaskLead | null;
  coaching: CalendarTaskCoaching | null;
}

/** A compared member's task while they hide their details (ADR-0110): counted, never read. */
export interface CalendarHiddenTask {
  busy: true;
  date: string;
}

export type CalendarTaskItem = CalendarTask | CalendarHiddenTask;

/** An office event type, as the office typed it. */
export interface CalendarEventType {
  code: string;
  label: string;
}

/**
 * **An event the person said they are going to** (UI-104 point 1): on the grid at its time, read-only, opening
 * `/events/{eventId}`; it leaves the calendar when they leave the event.
 */
export interface CalendarJoinedEvent {
  eventId: string;
  title: string;
  type: CalendarEventType;
  location: string;
  allDay: boolean;
  date: string | null;
  start: string | null;
  end: string | null;
  startsOn: string | null;
  endsOn: string | null;
  startsAt: string;
  endsAt: string;
}

export type CalendarJoinedItem = CalendarJoinedEvent | CalendarBusy;

export const isHiddenTask = (task: CalendarTaskItem): task is CalendarHiddenTask => 'busy' in task && task.busy === true;

/** `GET /calendar/entries`: one person's week or month, with the office's clock. */
export interface CalendarRead {
  view: CalendarView;
  from: string;
  to: string;
  /** `YYYY-MM`, or `null` in Week. */
  month: string | null;
  days: CalendarDay[];
  /** The `date` ‹ asks for. */
  previous: string;
  /** The `date` › asks for. */
  next: string;
  /** The office's today. */
  today: string;
  now: CalendarNow;
  subject: CalendarSubject;
  /** By `startsAt` then `entryId`. Busy blocks only in a `for` read. */
  entries: CalendarItem[];
  /** *Tugas* in the period, coaching first, then by name (UI-104); a hidden person's as days alone. */
  tasks: CalendarTaskItem[];
  /** The events joined, overlapping the period; busy blocks for a hidden person. */
  events: CalendarJoinedItem[];
}

/** `DELETE /calendar/entries/:entryId`. */
export interface CalendarEntryDeleted {
  entryId: string;
  deletedAt: string;
}

/** The picker's groups, relative to the reader (`:469-480`, ADR-0094). */
export type PeopleGroup = 'direct_unit' | 'group' | 'other' | 'leadership';

/** One active field member of the reader's office, as the people picker lists them (D-picker). */
export interface CalendarPeopleItem {
  membershipId: string;
  name: string;
  rung: CalendarRung;
  /** Their leader's full name; `null` for somebody with no leader. */
  leaderName: string | null;
  /** The server's word that their current leader is the reader: the tag is then the rung alone. */
  direct: boolean;
  group: PeopleGroup;
}

/** The picker's page: searched on the server and capped (D-picker). */
export interface CalendarPeoplePageInfo {
  cursor: string | null;
  nextCursor: string | null;
  limit: number;
  hasMore: boolean;
}

/** `GET /calendar/people`. */
export interface CalendarPeoplePage {
  items: CalendarPeopleItem[];
  page: CalendarPeoplePageInfo;
}

/** The compare popover's groups (`:460-466`, D-reach). */
export type DownlineGroup = 'direct_unit' | 'group';

/** One person the reader may compare: everyone `COACH` reaches, an AAB's agents after their AAB. */
export interface CalendarDownlinePerson {
  membershipId: string;
  name: string;
  rung: CalendarRung;
  leaderName: string | null;
  /** Their current leader is the reader: depth 1. What the tag reads, as the picker's does. */
  direct: boolean;
  /** Levels below the reader; 1 is a direct report. */
  depth: number;
  group: DownlineGroup;
}

/** `GET /calendar/downline`. Not paginated: one leader's reach. */
export interface CalendarDownline {
  people: CalendarDownlinePerson[];
}

/**
 * `GET` and `PUT /calendar/settings`: the reader's own (ADR-0110). *Hide my personal activities*: on, a
 * leader comparing the reader's week is answered each entry the reader organised as a busy block, unless
 * that leader is on it. Off until the reader turns it on.
 */
export interface CalendarSettings {
  hideDetails: boolean;
}

/** What a save sends, for either kind of timing. */
export interface EntryInput {
  type: EntryType;
  title: string;
  notes: string;
  /** Travel only: *Sepanjang hari* (UI-104 point 8); `false` sends `startsOn`, `start`, `endsOn` and `end`. */
  allDay?: boolean;
  date?: string;
  start?: string;
  end?: string;
  startsOn?: string;
  endsOn?: string;
  inviteeIds: string[];
}

/*
 * ── The calls ────────────────────────────────────────────────────────────────────────────────────
 *
 * A query string is appended with `+`, never interpolated at the end of the path: the API-consumer
 * gate reads the path **literal** out of each call (`lib/leads.ts`, `qs`).
 */

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

/**
 * One person's week or month. Without `forId`, the reader's own calendar; with it, a member they
 * coach — a week or, since P18.95-T8 AC-2, a month — which the server audits, one entry per read
 * (D-audit). Outside `COACH` it is 404.
 */
export const readCalendar = (q: { view: CalendarView; date?: string; forId?: string }) =>
  api<CalendarRead>('/calendar/entries' + query({ view: q.view, date: q.date, for: q.forId }));

/** **A 1:1 with somebody, on the calendar**: in `lib/hrefs.ts`, so New Hires links here without this module. */
export { oneOnOneHref } from './hrefs';

/**
 * **The Agenda on a day** (UI-104; Home's *Jadwal hari ini* and *Aksi hari ini*, UI-100): the address that opens the
 * calendar's Agenda — on the office's today without `date`, as Home opens it.
 */
export const agendaHref = (date?: string) => `/calendar?view=agenda${date ? `&date=${encodeURIComponent(date)}` : ''}`;

/**
 * ***Selesai*** **on a lead's next action, or** ***Urungkan*** (UI-104 point 4): the owner's own, pinned to the version
 * the task carried. The lead as it is now comes back — its next action cleared, or put back.
 */
export const setLeadActionDone = (leadId: string, done: boolean, version: number) =>
  api<{ id: string; version: number; nextActionDate: string | null; nextActionNote: string | null }>(
    `/leads/${encodeURIComponent(leadId)}/next-action/done`, { method: 'PUT', body: { done, version } },
  );

/** ***Selesai*** **on a coaching action item, or** ***Urungkan***: the coachee's own; nothing agreed moves. */
export const setCoachingItemDone = (sessionId: string, itemId: string, done: boolean) =>
  api<{ sessionId: string; itemId: string; done: boolean }>(
    `/coaching/sessions/${encodeURIComponent(sessionId)}/action-items/${encodeURIComponent(itemId)}/done`,
    { method: 'PUT', body: { done } },
  );

/** One entry the reader organises or is on, whatever their answer. 404 for anything else. */
export const readEntry = (entryId: string) =>
  api<CalendarEntry>(`/calendar/entries/${encodeURIComponent(entryId)}`);

/** A new entry, the reader its organiser; each invitee is told (ADR-0095). */
export const createEntry = (input: EntryInput) =>
  api<CalendarEntry>('/calendar/entries', { method: 'POST', body: input });

/** The organiser's edit, pinned to the version it read: a stale one is 409 `VERSION_CONFLICT`. */
export const updateEntry = (entryId: string, input: EntryInput & { version: number }) =>
  api<CalendarEntry>(`/calendar/entries/${encodeURIComponent(entryId)}`, { method: 'PATCH', body: input });

/** The organiser's delete, soft, pinned as an edit is. */
export const deleteEntry = (entryId: string, version: number) =>
  api<CalendarEntryDeleted>(`/calendar/entries/${encodeURIComponent(entryId)}` + query({ version }), { method: 'DELETE' });

/** An invitee's own answer, and nothing else; changeable later (ADR-0097). */
export const answerEntry = (entryId: string, answer: Exclude<Answer, 'pending'>) =>
  api<CalendarEntry>(`/calendar/entries/${encodeURIComponent(entryId)}/answer`, { method: 'POST', body: { answer } });

/** The people picker: active field members of the reader's office, searched on the server (D-picker). */
export const searchPeople = (q: { q?: string; cursor?: string | null; limit?: number }) =>
  api<CalendarPeoplePage>('/calendar/people' + query({ q: q.q, cursor: q.cursor ?? undefined, limit: q.limit }));

/** Everyone the reader may compare. Anybody who coaches nobody gets an empty list. */
export const readDownline = () => api<CalendarDownline>('/calendar/downline');

/** *Block time* on a member the reader coaches: the reader's entry, the member placed on it (ADR-0098). */
export const placeBlock = (input: EntryInput & { membershipId: string }) =>
  api<CalendarEntry>('/calendar/blocks', { method: 'POST', body: input });

/** The reader's own calendar settings. Nobody reads anybody else's. */
export const readCalendarSettings = () => api<CalendarSettings>('/calendar/settings');

/** *Hide my personal activities*, sent whole; the answer is the setting as it is now stored. */
export const saveCalendarSettings = (settings: CalendarSettings) =>
  api<CalendarSettings>('/calendar/settings', { method: 'PUT', body: settings });

/*
 * ── Limits ───────────────────────────────────────────────────────────────────────────────────────
 *
 * The domain's, as the API validates them (`functional/calendar.md`, *Its fields*); pinned against
 * the OpenAPI document by `contract.spec.ts`. The screen checks them first only so that it can say
 * which field, under the field; the server refuses them whatever this does.
 */
export const TITLE_MAX = 120;
export const NOTES_MAX = 1000;
export const INVITEES_MAX = 50;
export const TRIP_DAYS_MAX = 31;
/** You and up to two people beside you (`MAX_COMPARE`, `:583`; D-reach). */
export const COMPARE_MAX = 2;
/** What the picker asks for at once; the server caps it there too. */
export const PEOPLE_PAGE = 50;

/*
 * ── Words ────────────────────────────────────────────────────────────────────────────────────────
 *
 * **In the catalogue** (`i18n/messages/calendar.tsx`; P18.98-T4): a screen reads the reader's language,
 * `useMessages(calendarMessages)`; a function here takes the words' language (English when none is passed) and then
 * the figures' (Indonesian when none is passed, as before), and its caller passes `useLanguage()` and
 * `useFigureLanguage()`. The objects below are the catalogue's English in the shapes this module has always handed its
 * spec, their figures Indonesian as they were.
 */

/** The calendar's words in a language. */
export const calendarWordsIn = (language: Language = SOURCE_LANGUAGE) => messagesIn(calendarMessages, language);

const EN = calendarWordsIn(SOURCE_LANGUAGE);

/**
 * **The limits' sentences** (`functional/calendar.md`, *Its fields*): each built from its limit (m3), so a limit changed
 * in one place changes the sentence with it — its words in `language`, its figure in `figures` (grouped *1.000* from a
 * thousand up, ADR-0167 §1).
 */
export function limitWords(language: Language = SOURCE_LANGUAGE, figures: Language = DEFAULT_LANGUAGE) {
  const t = calendarWordsIn(language);
  return {
    tripTooLong: t.tripTooLong({ max: formatNumber(TRIP_DAYS_MAX, {}, figures) }),
    titleTooLong: t.titleTooLong({ max: formatNumber(TITLE_MAX, {}, figures) }),
    notesTooLong: t.notesTooLong({ max: formatNumber(NOTES_MAX, {}, figures) }),
    tooManyInvitees: t.tooManyInvitees({ max: formatNumber(INVITEES_MAX, {}, figures) }),
  };
}

const LIMITS = limitWords();

/**
 * **The prototype's own strings, verbatim** (ADR-0096), in English: *KPM* included, characters kept (`—`, `…`,
 * `✓`). They follow OD-39's product-wide answer if it is *office*, and nothing else changes them.
 */
export const PROTOTYPE_COPY = {
  newEvent: EN.newEvent,
  newTitle: EN.newTitle,
  newSub: EN.newSub,
  editTitle: EN.editTitle,
  editSub: EN.editSub,
  blockTitle: (name: string) => EN.blockTitle({ name }),
  blockSub: EN.blockSub,
  saveEvent: EN.saveEvent,
  titlePlaceholder: EN.titlePlaceholder,
  inviteLabel: EN.inviteLabel,
  invitePlaceholder: EN.invitePlaceholder,
  notesLabel: EN.notesLabel,
  notesPlaceholder: EN.notesPlaceholder,
  untitled: EN.untitled,
  noOneElse: EN.noOneElse,
  noMatches: EN.noMatches,
  viewing: EN.viewing,
  myCalendar: EN.myCalendar,
  compare: EN.compare,
  searchDownline: EN.searchDownline,
  added: EN.added,
  compareCap: (max: number) => EN.compareCap({ max }),
  dragToBlock: EN.dragToBlock,
  more: (n: number) => `${EN.moreCount({ n })}${EN.moreRest}`,
  you: EN.you,
  calendar: EN.title,
  today: EN.today,
  week: EN.week,
  month: EN.month,
  // The month's column heads are the formatter's (`weekdayHeadings`, `lib/format.ts`; P18.98-T3 AC-5): the prototype's
  // *Mon … Sun*, Monday first in both languages — *Sen … Min* in Indonesian.
  type: EN.type,
  title: EN.fieldTitle,
  date: EN.date,
  start: EN.start,
  end: EN.end,
  departure: EN.departure,
  return: EN.return,
  when: EN.when,
  where: EN.where,
  invitees: EN.invitees,
  close: EN.close,
  cancel: EN.cancel,
  edit: EN.edit,
  delete: EN.delete,
} as const;

/** The picker's group headings, verbatim, *KPM* included (`:469-480`). */
export const PEOPLE_GROUP_LABEL: Record<PeopleGroup, string> = EN.peopleGroups;

/** The compare popover's group headings, verbatim (`:460-466`). */
export const DOWNLINE_GROUP_LABEL: Record<DownlineGroup, string> = EN.downlineGroups;

/**
 * **The strings the calendar writes itself** (`functional/calendar.md`, *The calendar's own
 * strings*), in English. ADR-0096: none of ADR-0084's six words — *office*, *KPM*, *reports to*, *tagged to*,
 * *untagged*, *unassigned* — and no phase, internal id or permission code. `calendar.spec.ts` holds
 * every one of them to that.
 */
export const OWN_COPY = {
  /** A 1:1 opened from `/new-hires` (P18.96-T6 AC-4): the title *Block time* gives one too, with the full name (L-65). */
  oneOnOneWith: (name: string) => EN.oneOnOneWith({ name }),
  accept: EN.accept,
  decline: EN.decline,
  /** The toast after an answer: the dialog closes, so the change is said rather than marked. */
  answeredAccepted: EN.answeredAccepted,
  answeredDeclined: EN.answeredDeclined,
  accepted: EN.accepted,
  declined: EN.declined,
  noAnswer: EN.noAnswer,
  organiser: EN.organiser,
  /** After the name, so a placed member's chip reads *{name}, time placed by the organiser*. */
  placedChip: EN.placedChip,
  previousWeek: EN.previousWeek,
  nextWeek: EN.nextWeek,
  previousMonth: EN.previousMonth,
  nextMonth: EN.nextMonth,
  remove: (name: string) => EN.remove({ name }),
  /**
   * After the pill's visible *Drag to block*, read and never drawn, so its name is *"Drag to block:
   * Block time — {name}"*: the words on it first, then what it opens (WCAG 2.5.3, M2).
   */
  blockPillSuffix: (name: string) => EN.blockPillSuffix({ name }),
  /** *+{n} more…* where a narrow cell has room for its count alone (F4); the rest is read, not drawn. */
  moreShort: (n: number) => EN.moreCount({ n }),
  waiting: EN.owes.waiting,
  placed: EN.owes.placed,
  region: (range: string) => EN.region({ range }),
  comparedRegion: (name: string, range: string) => EN.comparedRegion({ name, range }),
  busy: EN.busy,
  view: EN.view,
  /** The prototype's question less its second sentence, which a soft delete makes false (H-06, I-101). */
  deleteQuestion: (title: string) => EN.deleteQuestion({ title }),
  chooseDate: EN.chooseDate,
  endAfterStart: EN.endAfterStart,
  returnAfterDeparture: EN.returnAfterDeparture,
  // Built from the limits (m3), so a limit changed in one place changes the sentence with it.
  ...LIMITS,
  loadFailed: EN.loadFailed,
  tryAgain: EN.tryAgain,
  conflict: EN.conflict,
  notInvitable: EN.notInvitable,
  gone: EN.gone,
  lost: (name: string) => EN.lost({ name }),
  searching: EN.searching,
  listFailed: EN.listFailed,
  loading: EN.loading,
  /** The toolbar's switch, in the client's words (ADR-0110). It names the control, never its state. */
  hideDetails: EN.hideDetails,
  /** What the switch does: its ⓘ's words, and the switch's description. */
  hideDetailsTip: EN.hideDetailsTip,
  /** A save of the switch refused: it is back where it was, and this says so. */
  hideDetailsFailed: EN.hideDetailsFailed,
  /** The phone's third view, beside the prototype's *Week* and *Month*: the week as a list by day. */
  agenda: EN.agenda,
  /** The phone's one button for what the toolbar's row has no room for: compare, the legend, the switch. */
  filters: EN.filters,
  /** A day of the agenda, or the day a month's tap shows, with nothing on it. */
  noEvents: EN.noEvents,
  /** After a month cell's date on a phone, where its lines are dots: how many it holds. */
  eventCount: (n: number) => EN.eventCount({ n, count: formatNumber(n) }),
  /** A meeting link in *Location / notes*: on a Zoom host, and on any other. */
  joinZoom: EN.joinZoom,
  joinMeeting: EN.joinMeeting,
  /** After the link's words, read and not drawn: it opens in a new tab (WCAG G201). */
  newTab: EN.newTab,
} as const;

/*
 * ── Small readings of the shapes ─────────────────────────────────────────────────────────────────
 */

export const isBusy = (item: CalendarItem | CalendarJoinedItem): item is CalendarBusy => 'busy' in item && item.busy === true;

/** The title to draw, as typed: the prototype draws an empty one as `(untitled event)` (`:782`), in `language`. */
export const titleOf = (entry: { title: string }, language: Language = SOURCE_LANGUAGE) =>
  entry.title.trim() || calendarWordsIn(language).untitled;

/** The office date an entry is on, or starts on: where the week holding it opens. */
export const entryDate = (entry: CalendarItem): string => (entry.allDay ? entry.startsOn : entry.date) ?? '';

/** **A trip all day** (UI-104 point 8): a line at the top of each day, a bar in the Trip row — never on the grid. */
export const isAllDay = (item: { allDay: boolean }) => item.allDay;

/** Two letters for an avatar: the first of the first and of the last name, as the prototype's are. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * A person's tag in the picker and the compare popover: the rung by its badge's name (*AB*, *AAB*, *Agent*;
 * P18.95-T9 AC-1, ADR-0167 §10 — the ladder's label, whole, until then), then *" · under {full name}"* for
 * anybody who is not the reader's direct report. No first name and no *"KPM Manager"*, which is no rung
 * (contradiction 17).
 *
 * **Who is a direct report is the server's `direct`**, read off the row, never worked out here by
 * matching the leader's name to the reader's: a name is a mutable attribute and two people can share
 * one (invariant §2), so a namesake's agent would have lost their *"· under"*.
 */
export function personTag(
  person: { rung: CalendarRung; leaderName: string | null; direct: boolean }, language: Language = SOURCE_LANGUAGE,
): string {
  const rung = shortOfRung(person.rung);
  return !person.direct && person.leaderName ? calendarWordsIn(language).under({ rung, leader: person.leaderName }) : rung;
}

/**
 * Everybody whose calendar a write touched: each invitee of the entry as it was and as it is, the
 * member a block was placed on among them. A compared pane of anybody else is not read again (D-audit).
 */
export function peopleOn(...entries: ReadonlyArray<Pick<CalendarEntry, 'invitees'> | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const entry of entries) for (const invitee of entry?.invitees ?? []) ids.add(invitee.membershipId);
  return [...ids];
}

/** What the reader owes an entry: a pending invitation waits on them; a placed block was put on their calendar. */
export function owesOf(entry: CalendarEntry): 'waiting' | 'placed' | null {
  if (entry.readerIs === 'invitee' && entry.myAnswer === 'pending') return 'waiting';
  if (entry.readerIs === 'placed') return 'placed';
  return null;
}

/** What the reader owes, said after an entry's name, in English: the catalogue's own sentence is `entryName`. */
export function entryNameSuffix(entry: CalendarEntry): string {
  const owes = owesOf(entry);
  return owes ? OWN_COPY[owes] : '';
}

/**
 * **An entry's accessible name** — *{type}: {title}, {time}* and what the reader owes it (WCAG 2.5.3; P12-T2 AC-11) —
 * in `language`; `time` as the grid draws it, in the figures' language, `''` for a trip.
 */
export const entryName = (entry: CalendarEntry, time: string, language: Language = SOURCE_LANGUAGE) => {
  const t = calendarWordsIn(language);
  return t.entryName({ type: t.types[entry.type], title: titleOf(entry, language), time, owes: owesOf(entry) });
};

/** A `YYYY-MM-DD` that is a real calendar date, or `undefined`: an unreadable `date` is ignored (`:226`). */
export function readableDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? value : undefined;
}

/**
 * A calendar date `n` days on. **Date arithmetic, not a clock**: it counts on the date's own three
 * numbers in UTC, so no zone can move it, and it never asks what today is. For Travel's default
 * return date, *"that day and the next"* (P12-T2 AC-4).
 */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + n));
  return at.toISOString().slice(0, 10);
}

/** Days from `a` to `b` inclusive, for a trip's length; counted on the dates' numbers, as `addDays` is. */
export function daysInclusive(a: string, b: string): number {
  const at = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(b) - at(a)) / 86_400_000) + 1;
}

/** `HH:mm` for a number of minutes after midnight; 1440 is the end-of-day midnight, `00:00`. */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/*
 * ── Meeting links in *Location / notes* (P18.95-T8 AC-2; the client's UI review, UI-020) ─────────
 */

/** A run of the notes as written, or a link found in them and the words it is drawn with. */
export type NotesPart = { text: string } | { href: string; label: string };

/**
 * **Hosts a meeting address is typed on without its `https://`** — the seed's own *zoom.us/j/91827364*
 * among them. Anything else is a link only when it is written with `http://` or `https://`, or starts
 * with `www.`: a bare *word.word/word* in free text is too often not an address.
 */
const BARE_MEETING_HOSTS = /^(?:[a-z0-9-]+\.)*(?:zoom\.us|webex\.com)$|^(?:meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)$/;

/**
 * An address with its scheme, or a bare one on a host above or starting `www.`, up to the next space —
 * after the start or a character that cannot be part of an address (group 1), so *name@zoom.us/x* is
 * not read as one. A capture rather than a lookbehind, which Safari before 16.4 cannot parse.
 */
const ADDRESS = /(^|[^\w@./-])(https?:\/\/[^\s<>"]+|(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"]*)/gi;

/** What closes a sentence or a bracket after an address belongs to the sentence, not to the address. */
const TRAILING = /[.,;:!?'")\]}]+$/;

/** A Zoom meeting's host: `zoom.us` and its own subdomains (`us02web.zoom.us`), and nothing that merely ends in it. */
export const isZoomHost = (hostname: string) => hostname === 'zoom.us' || hostname.endsWith('.zoom.us');

/**
 * The address a run of the notes names, **only as `http:` or `https:`**, or `null`: a bare address is
 * read as `https://`, and one with any other scheme — `javascript:`, `data:`, `mailto:` — is not an
 * address here, because the pattern above never matches one.
 */
export function meetingUrl(raw: string): URL | null {
  const withScheme = /^https?:\/\//i.test(raw);
  let url: URL;
  try {
    url = new URL(withScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname.includes('.')) return null;
  if (!withScheme && !url.hostname.startsWith('www.') && !BARE_MEETING_HOSTS.test(url.hostname)) return null;
  return url;
}

/**
 * ***Location / notes*, with each meeting link made a link** (P18.95-T8 AC-2): *Join Zoom* on a Zoom
 * host, *Join meeting* on any other, everything else the organiser wrote kept as they wrote it. The
 * address itself stays the link's `title` and its `href`, so it is never hidden from whoever wants to
 * see where it goes.
 */
export function notesParts(notes: string, language: Language = SOURCE_LANGUAGE): NotesPart[] {
  const t = calendarWordsIn(language);
  const parts: NotesPart[] = [];
  let at = 0;
  for (const match of notes.matchAll(ADDRESS)) {
    const raw = match[2].replace(TRAILING, '');
    const url = meetingUrl(raw);
    if (!url) continue;
    const start = (match.index ?? 0) + match[1].length;
    if (start > at) parts.push({ text: notes.slice(at, start) });
    parts.push({ href: url.href, label: isZoomHost(url.hostname) ? t.joinZoom : t.joinMeeting });
    at = start + raw.length;
  }
  if (at < notes.length) parts.push({ text: notes.slice(at) });
  return parts;
}
