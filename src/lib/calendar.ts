import { api } from './api-client';

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

/** The legend's and the toggle's words, verbatim (`:310-314`, `:370-374`). */
export const TYPE_LABEL: Record<EntryType, string> = {
  meeting: 'Internal meeting',
  coaching: '1:1 coaching',
  client: 'Client meeting',
  task: 'Task',
  travel: 'Travel',
};

/** The detail's badge, verbatim and **not** the legend's words: the type capitalised (`:824`). */
export const TYPE_BADGE: Record<EntryType, string> = {
  meeting: 'Meeting',
  coaching: 'Coaching',
  client: 'Client',
  task: 'Task',
  travel: 'Travel',
};

export type CalendarView = 'week' | 'month';

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
 * coach (Week only), which the server audits — one entry per read (D-audit). Outside `COACH` it is 404.
 */
export const readCalendar = (q: { view: CalendarView; date?: string; forId?: string }) =>
  api<CalendarRead>('/calendar/entries' + query({ view: q.view, date: q.date, for: q.forId }));

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
 */

/**
 * **The prototype's own strings, verbatim** (ADR-0096): *KPM* included, characters kept (`—`, `…`,
 * `✓`). They follow OD-39's product-wide answer if it is *office*, and nothing else changes them.
 */
export const PROTOTYPE_COPY = {
  newEvent: '+ New event',
  newTitle: 'New event',
  newSub: 'Add a meeting, task, or coaching session to your calendar.',
  editTitle: 'Edit event',
  editSub: 'Update the details below.',
  blockTitle: (name: string) => `Block time — ${name}`,
  blockSub: 'This goes straight onto their calendar — no approval needed, they\'ll just see it appear.',
  saveEvent: 'Save event',
  titlePlaceholder: 'e.g. Weekly unit standup',
  inviteLabel: 'Invite (optional) — anyone in your KPM',
  invitePlaceholder: 'Search your KPM by name…',
  notesLabel: 'Notes / location',
  notesPlaceholder: 'Zoom link, office, or agenda notes',
  untitled: '(untitled event)',
  noOneElse: 'No one else invited',
  noMatches: 'No matches.',
  viewing: 'Viewing:',
  myCalendar: 'My Calendar',
  compare: '+ Compare with downline',
  searchDownline: 'Search your downline…',
  added: ' · added ✓',
  compareCap: (max: number) => `You're comparing ${max} people already — remove one below to add another.`,
  dragToBlock: 'Drag to block',
  more: (n: number) => `+${n} more…`,
  you: 'You',
  calendar: 'Calendar',
  today: 'Today',
  week: 'Week',
  month: 'Month',
  dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  inviting: 'Inviting',
  toThisSlot: 'to this slot',
  type: 'Type',
  title: 'Title',
  date: 'Date',
  start: 'Start',
  end: 'End',
  departure: 'Departure date',
  return: 'Return date',
  when: 'When',
  where: 'Location / notes',
  invitees: 'Invitees',
  close: 'Close',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
} as const;

/** The picker's group headings, verbatim, *KPM* included (`:469-480`). */
export const PEOPLE_GROUP_LABEL: Record<PeopleGroup, string> = {
  direct_unit: 'Your direct unit',
  group: 'Your group (AAB teams)',
  other: 'Other units in your KPM',
  leadership: 'KPM leadership',
};

/** The compare popover's group headings, verbatim (`:460-466`). */
export const DOWNLINE_GROUP_LABEL: Record<DownlineGroup, string> = {
  direct_unit: 'Direct unit',
  group: 'AAB & their teams (group)',
};

/**
 * **The strings the calendar writes itself** (`functional/calendar.md`, *The calendar's own
 * strings*). ADR-0096: none of ADR-0084's six words — *office*, *KPM*, *reports to*, *tagged to*,
 * *untagged*, *unassigned* — and no phase, internal id or permission code. `calendar.spec.ts` holds
 * every one of them to that.
 */
export const OWN_COPY = {
  accept: 'Accept',
  decline: 'Decline',
  /** The toast after an answer: the dialog closes, so the change is said rather than marked. */
  answeredAccepted: 'Invitation accepted.',
  answeredDeclined: 'Invitation declined. It is no longer on your calendar.',
  accepted: 'Accepted',
  declined: 'Declined',
  noAnswer: 'No answer yet',
  organiser: 'Organiser',
  /** After the name, so a placed member's chip reads *{name}, time placed by the organiser*. */
  placedChip: ', time placed by the organiser',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  remove: (name: string) => `Remove ${name}`,
  /**
   * After the pill's visible *Drag to block*, read and never drawn, so its name is *"Drag to block:
   * Block time — {name}"*: the words on it first, then what it opens (WCAG 2.5.3, M2).
   */
  blockPillSuffix: (name: string) => `: ${PROTOTYPE_COPY.blockTitle(name)}`,
  /** *+{n} more…* where a narrow cell has room for its count alone (F4); the rest is read, not drawn. */
  moreShort: (n: number) => `+${n}`,
  waiting: ', waiting for your answer',
  placed: ', placed on your calendar',
  region: (range: string) => `Calendar, ${range}`,
  comparedRegion: (name: string, range: string) => `Calendar, ${name}, ${range}`,
  busy: 'Busy',
  view: 'View',
  /** The prototype's question less its second sentence, which a soft delete makes false (H-06, I-101). */
  deleteQuestion: (title: string) => `Delete "${title}"?`,
  chooseDate: 'Choose a date.',
  endAfterStart: 'Choose an end time after the start.',
  returnAfterDeparture: 'Choose a return date on or after the departure date.',
  // Built from the limits above (m3), so a limit changed in one place changes the sentence with it.
  tripTooLong: `A trip can be at most ${TRIP_DAYS_MAX} days.`,
  titleTooLong: `Keep the title to ${TITLE_MAX.toLocaleString('en-US')} characters.`,
  notesTooLong: `Keep the notes to ${NOTES_MAX.toLocaleString('en-US')} characters.`,
  tooManyInvitees: `You can invite at most ${INVITEES_MAX.toLocaleString('en-US')} people.`,
  loadFailed: 'The calendar couldn\'t be loaded.',
  tryAgain: 'Try again',
  conflict: 'This entry was changed somewhere else, so it has been read again.',
  notInvitable: 'Someone you invited can\'t be invited any more. Remove them and save again.',
  gone: 'This entry isn\'t on your calendar any more.',
  lost: (name: string) => `You can no longer view ${name}'s calendar.`,
  searching: 'Searching…',
  listFailed: 'The list couldn\'t be loaded.',
  loading: 'Loading the calendar…',
  /** The toolbar's switch, in the client's words (ADR-0110). It names the control, never its state. */
  hideDetails: 'Hide my personal activities',
  /** What the switch does: its ⓘ's words, and the switch's description. */
  hideDetailsTip: 'Leaders who view your calendar see only "Busy" and the time. People you invite still see the details.',
  /** A save of the switch refused: it is back where it was, and this says so. */
  hideDetailsFailed: 'Your setting couldn\'t be saved, so it has been put back.',
} as const;

/*
 * ── Small readings of the shapes ─────────────────────────────────────────────────────────────────
 */

export const isBusy = (item: CalendarItem): item is CalendarBusy => 'busy' in item && item.busy === true;

/** The title to draw: the prototype draws an empty one as `(untitled event)` (`:782`). */
export const titleOf = (entry: { title: string }) => entry.title.trim() || PROTOTYPE_COPY.untitled;

/** The office date an entry is on, or starts on: where the week holding it opens. */
export const entryDate = (entry: CalendarItem): string => (entry.allDay ? entry.startsOn : entry.date) ?? '';

/** Two letters for an avatar: the first of the first and of the last name, as the prototype's are. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * A person's tag in the picker and the compare popover: the rung's ladder label, then *" · under
 * {full name}"* for anybody who is not the reader's direct report. No abbreviated rung, no first name
 * and no *"KPM Manager"*, which is no rung (contradiction 17).
 *
 * **Who is a direct report is the server's `direct`**, read off the row, never worked out here by
 * matching the leader's name to the reader's: a name is a mutable attribute and two people can share
 * one (invariant §2), so a namesake's agent would have lost their *"· under"*.
 */
export function personTag(person: { rung: CalendarRung; leaderName: string | null; direct: boolean }): string {
  return !person.direct && person.leaderName ? `${person.rung.label} · under ${person.leaderName}` : person.rung.label;
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

/** A pending invitation waits on this reader; a placed block was put on their calendar. */
export function entryNameSuffix(entry: CalendarEntry): string {
  if (entry.readerIs === 'invitee' && entry.myAnswer === 'pending') return OWN_COPY.waiting;
  if (entry.readerIs === 'placed') return OWN_COPY.placed;
  return '';
}

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
