import { shortOfRung } from '@/components/ui/role-badge';
import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { forumMessages } from '@/i18n/messages/forum';
import { api } from './api-client';
import { formatMonthName } from './format';

/**
 * **The Strategic Leader Forum's client** (Phase 18.1, `functional/leader-forum.md`): the office's biweekly
 * *Strategic Check-in*, written together by the Owner, the Admins and the office's Core Leaders.
 *
 * Every shape here is the server's answer as built (`leader-meetings` module). Nothing is computed on the
 * screen that the server already decides: the scorecard's figures, *pending data*, who may edit, what the
 * reader may do (`can`), and the bounds of every field (`limits`, invariant §7).
 */

/*
 * ── The shapes ──────────────────────────────────────────────────────────────────────────────────
 */

/** *Upcoming* through the end of the meeting's date in the office's calendar, *Completed* from 00:00 after. */
export type MeetingState = 'upcoming' | 'completed';

export interface ForumPerson {
  membershipId: string;
  name: string;
  rung: { code: string; label: string };
  /** The reader themselves: *"(You)"* after the name. */
  isReader: boolean;
  /**
   * Tagged *Core Leader* — now while the meeting is upcoming, at the freeze once it is over. What
   * *"{n} core leaders tagged"* counts, the Owner aside, so the card's avatars are the same people.
   */
  tagged: boolean;
}

/** *Can edit this MOM*: each person once, the Owner first, then the Admins, then the other Core Leaders. */
export interface MeetingEditors {
  owner: ForumPerson | null;
  admins: ForumPerson[];
  coreLeaders: ForumPerson[];
  /** *"{n} core leaders tagged"*: every editor tagged Core Leader but the Owner. */
  coreLeaderCount: number;
  /** True once the meeting is *Completed* and the list is the one written onto it at the freeze. */
  frozen: boolean;
}

/** The bounds of every typed field, served so the screen keeps no copy of them. */
export interface ForumLimits {
  titleMax: number;
  textMax: number;
  picMax: number;
  targetMax: number;
}

export interface MeetingCard {
  id: string;
  number: number;
  title: string;
  /** `YYYY-MM-DD`, an office date. */
  date: string;
  state: MeetingState;
  editors: MeetingEditors;
  /** The tracker's rows not *Implemented*. 0 reads *All clear*. */
  openItems: number;
}

export interface MeetingListView {
  /** Newest first, by date. */
  meetings: MeetingCard[];
  can: { create: boolean };
  limits: ForumLimits;
}

/**
 * The six computed columns, in the client's reference slide's order (ADR-0175 §1): the *Full Year & YTD View* — *Full
 * Year {Y−1}*, ***YTD {Y−1}***, *YTD {Y}* — then the *Monthly View*'s three months; *Monthly Target* is typed.
 */
export type ColumnKey = 'fy' | 'ytdLastYear' | 'ytd' | 'thisMonthLastYear' | 'lastMonth' | 'thisMonth';
export const COLUMN_KEYS: readonly ColumnKey[] = ['fy', 'ytdLastYear', 'ytd', 'thisMonthLastYear', 'lastMonth', 'thisMonth'];
/** *Full Year & YTD View*. */
export const YEAR_COLUMN_KEYS: readonly ColumnKey[] = ['fy', 'ytdLastYear', 'ytd'];
/** *Monthly View*'s computed three; *Monthly Target* closes the group. */
export const MONTH_COLUMN_KEYS: readonly ColumnKey[] = ['thisMonthLastYear', 'lastMonth', 'thisMonth'];

/** The nine rows, in the slide's order. `producing_agents` is *Annual Active Agents*: the key is the stored one. */
export type RowKey =
  | 'ape' | 'manpower' | 'flc' | 'producing_agents' | 'new_agent_3m'
  | 'avg_monthly_aa' | 'case_submission' | 'cases_per_producing_agent' | 'average_case_size';

/** The five rows whose *Monthly Target* is typed, as a rate per unit; the others take none. */
export type TargetRowKey = 'ape' | 'manpower' | 'flc' | 'avg_monthly_aa' | 'case_submission';

export type ScorecardCell =
  /** `value` exact: minor units for `idr_minor`, a whole or fractional count, a whole percentage, a ratio. */
  | { kind: 'figure'; value: number; leavesOut: string[] /* YYYY-MM months of the period not held */ }
  /** *pending data*: no source holds the figure for its period. */
  | { kind: 'pending' }
  /** *—*: a ratio over nothing whose months are held (*Avg. Case Size* over no policies, *Cases/producing agents* over nobody). */
  | { kind: 'none' }
  /** *Not tracked*: a row the table leaves empty in this column. */
  | { kind: 'blocked' }
  /** *—*: a column or a row a scorecard kept before it existed does not hold (ADR-0175 §8). */
  | { kind: 'unrecorded' };

/** The months a column names, `YYYY-MM` to `YYYY-MM`, from the meeting's month: its header's second line. */
export interface ColumnPeriod {
  from: string;
  to: string;
}

/**
 * A *Monthly Target*, typed as a rate per unit (ADR-0175 §4): the rate in the row's unit — IDR minor units for *APE*,
 * a count for the others — and the server's **value**, `rate × # of units`; or, with no rate, a target typed as text
 * before rates, shown as typed. Never typed: version 0.
 */
export interface MonthlyTarget {
  rate: number | null;
  value: number | null;
  typed: string | null;
  version: number;
}

/**
 * What a phone's card reads beside *YTD {Y}* and *YTD {Y−1}*: the change the server computed, whole and signed, in its
 * `unit` — `percent`, a percentage of last year's figure, or `points`, the difference in percentage points on a row
 * whose own figure is a percentage (*3M new agent %*; P18.97-T8 F1, parity F-256).
 */
export type YtdChange = { kind: 'figure'; value: number; unit: 'percent' | 'points' } | { kind: 'none' };

export interface ScorecardRow {
  key: RowKey;
  unit: 'idr_minor' | 'count' | 'percentage' | 'ratio';
  cells: Record<ColumnKey, ScorecardCell>;
  ytdChange: YtdChange;
  /** `null` on a row the table does not track month by month. */
  monthlyTarget: MonthlyTarget | null;
}

/** *AS OF*: a day; none while the office has no file (nothing drawn); unrecorded on a scorecard kept before it (*—*). */
export type ScorecardAsOf = { kind: 'date'; date: string } | { kind: 'none' } | { kind: 'unrecorded' };

/** A period a figure of which leaves months out: its *(\*)* note. */
export interface PartialPeriod {
  column: ColumnKey;
  leavesOut: string[];
}

export interface Scorecard {
  periods: Record<ColumnKey, ColumnPeriod>;
  /** `units` is *# of AB* + *# of AAB* — or, on a scorecard kept before that, the number it was kept with. */
  chips: { manpower: number; agents: number; units: number; ab: number; aab: number };
  /** Nine, in the slide's order. */
  rows: ScorecardRow[];
  asOf: ScorecardAsOf;
  /** In column order; empty when every figure covers its whole period. */
  partialPeriods: PartialPeriod[];
  /** `null` while live; the instant it was frozen onto the meeting otherwise. */
  frozenAt: string | null;
}

export type AgendaSection = 'preparation' | 'during' | 'post';
export const AGENDA_SECTIONS: readonly AgendaSection[] = ['preparation', 'during', 'post'];

export interface AgendaItem {
  id: string;
  text: string;
  /** Free text, a name typed by hand; `''` for none (drawn *—*). */
  pic: string;
  /** Meaningful on *During* only. */
  done: boolean;
  version: number;
}

export type ActionStatus = 'not_planned' | 'planned' | 'implemented';

export interface ActionItem {
  id: string;
  initiative: string;
  metric: string;
  action: string;
  pic: string;
  status: ActionStatus;
  /** The *Remarks / Target* column. */
  remarks: string;
  version: number;
}

export interface MeetingView extends MeetingCard {
  /** The head's version: the title and the date. */
  version: number;
  /** The office's branch, *"BSD City Branch"*: the share dialog's hint names it. */
  branch: string;
  scorecard: Scorecard;
  agenda: Record<AgendaSection, AgendaItem[]>;
  /** In their order. */
  actionItems: ActionItem[];
  /** False: nobody has written in it, so *Delete meeting* is offered. */
  writtenIn: boolean;
  via: 'address' | 'link';
  /** Who may edit **now** — the access note's names, live even on a *Completed* meeting. */
  accessNote: { ownerName: string | null; adminNames: string[] };
  can: { edit: boolean; share: boolean; reschedule: boolean; delete: boolean; manageTags: boolean; print: boolean };
  limits: ForumLimits;
}

export type AgendaItemSaved = AgendaItem | { removed: true };

export interface ShareLink {
  /** The raw token: in this answer and nowhere else. */
  token: string;
  /** An instant; the link stops opening then. */
  expiresAt: string;
}

/*
 * ── The calls ───────────────────────────────────────────────────────────────────────────────────
 */

export const readMeetings = () => api<MeetingListView>('/leader-meetings');

export const createMeeting = (body: { title: string; date: string }) =>
  api<MeetingCard>('/leader-meetings', { method: 'POST', body });

/** The first read after the meeting's date may be the one that freezes its scorecard (ADR-0129). */
export const readMeeting = (meetingId: string) => api<MeetingView>(`/leader-meetings/${encodeURIComponent(meetingId)}`);

export const rescheduleMeeting = (meetingId: string, body: { title?: string; date?: string; version: number }) =>
  api<MeetingCard>(`/leader-meetings/${encodeURIComponent(meetingId)}`, { method: 'PATCH', body });

export const deleteMeeting = (meetingId: string, version: number) =>
  api<void>(`/leader-meetings/${encodeURIComponent(meetingId)}?version=${version}`, { method: 'DELETE' });

export const addAgendaItem = (meetingId: string, section: AgendaSection) =>
  api<AgendaItem>(`/leader-meetings/${encodeURIComponent(meetingId)}/agenda-items`, { method: 'POST', body: { section } });

/** An emptied `text` removes the item: the answer is `{ removed: true }`. */
export const saveAgendaItem = (
  meetingId: string,
  itemId: string,
  body: { text?: string; pic?: string; done?: boolean; version: number },
) => api<AgendaItemSaved>(`/leader-meetings/${encodeURIComponent(meetingId)}/agenda-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body });

export const addActionItem = (meetingId: string) =>
  api<ActionItem>(`/leader-meetings/${encodeURIComponent(meetingId)}/action-items`, { method: 'POST' });

export const saveActionItem = (
  meetingId: string,
  itemId: string,
  body: Partial<Pick<ActionItem, 'initiative' | 'metric' | 'action' | 'pic' | 'remarks' | 'status'>> & { version: number },
) => api<ActionItem>(`/leader-meetings/${encodeURIComponent(meetingId)}/action-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body });

export const removeActionItem = (meetingId: string, itemId: string, version: number) =>
  api<void>(`/leader-meetings/${encodeURIComponent(meetingId)}/action-items/${encodeURIComponent(itemId)}?version=${version}`, { method: 'DELETE' });

/** The order written whole; refused 409 when a row was added or removed since it was read. */
export const reorderActionItems = (meetingId: string, itemIds: string[]) =>
  api<ActionItem[]>(`/leader-meetings/${encodeURIComponent(meetingId)}/action-items/order`, { method: 'PUT', body: { itemIds } });

/** A rate per unit, in the row's unit (IDR minor units for `ape`), or `null` to clear it; answered as the table draws it. */
export const saveMonthlyTarget = (meetingId: string, row: TargetRowKey, body: { rate: number | null; version: number }) =>
  api<MonthlyTarget>(`/leader-meetings/${encodeURIComponent(meetingId)}/monthly-targets/${row}`, { method: 'PUT', body });

/** Each opening of *Share* makes a fresh link: only its hash is kept, so a link cannot be shown twice. */
export const createShareLink = (meetingId: string) =>
  api<ShareLink>(`/leader-meetings/${encodeURIComponent(meetingId)}/share-links`, { method: 'POST' });

/** *Stop sharing*: every live link to the meeting. */
export const revokeShareLinks = (meetingId: string) =>
  api<{ revoked: number }>(`/leader-meetings/${encodeURIComponent(meetingId)}/share-links`, { method: 'DELETE' });

export const readSharedMeeting = (token: string) =>
  api<MeetingView>(`/leader-meetings/shared/${encodeURIComponent(token)}`);

/*
 * ── Writing from a tab ──────────────────────────────────────────────────────────────────────────
 */

/**
 * What the meeting page hands each tab (`components/leader-forum/meeting-writer.tsx` provides it): one field's
 * write at a time, tracked so *Save* can wait for it, announced in the page's live region.
 */
export interface MeetingWriter {
  /**
   * Run one write. Announces *Saved* (or `done`) when it lands; on `409 VERSION_CONFLICT` reads the meeting
   * again and announces the conflict line; on any other failure announces the failure line. Resolves to the
   * server's answer, or `undefined` when the write did not land.
   */
  run<T>(write: () => Promise<T>, options?: { done?: string }): Promise<T | undefined>;
  /** Replace the meeting the page holds with what a landed write says. */
  update(change: (meeting: MeetingView) => MeetingView): void;
  /** A line in the live region (*Reordered*, *Row removed*). */
  announce(text: string): void;
  /** `!meeting.can.edit`: every field read-only text, no control drawn. */
  readOnly: boolean;
}

/*
 * ── The words ───────────────────────────────────────────────────────────────────────────────────
 *
 * The forum's words are the catalogue's (P18.98-T4): `i18n/messages/forum.ts`, English the source, Indonesian the
 * approved glossary's. A screen reads them with `useMessages(forumMessages)`; each function here that writes words takes
 * the reader's language last (`useLanguage()`), English — the source, what its spec reads — when given none. None of the
 * module's own uses the words that spec keeps out of the reader's sight (D-copy), in either language, and none names a
 * phase; `leader-meetings.spec.ts` scans them.
 */

/** The forum's name, kept English in both languages (§A.1, §A.5): the page's title, the nav item's. */
export const FORUM_TITLE = kept('Strategic Leader Forum');

/** **The source's words, English**, as the specs read them: a screen reads the reader's (`useMessages(forumMessages)`). */
export const FORUM_COPY = { title: FORUM_TITLE, ...forumMessages.en };

/** *Strategic Check-in — #15*: a new meeting's title, one past the highest number on the list (ADR-0130 §2). */
export const defaultMeetingTitle = (meetings: Pick<MeetingCard, 'number'>[], language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).defaultTitle({ n: meetings.reduce((top, m) => Math.max(top, m.number), 0) + 1 });

export const stateLabel = (state: MeetingState, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).state[state];

/** *"3 core leaders tagged"*, singular for one (F-186). */
export const coreLeadersTagged = (n: number, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).coreLeadersTagged({ n });

/** The words after the count in *"4 open items"*, *"1 open item"* (`:2606`); 0 is *All clear*, drawn apart. */
export const openItemsNoun = (n: number, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).openItems({ n });

/** The date's button in the head (ADR-0130 §4). */
export const changeDateLabel = (title: string, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).changeDate({ title });

export const deleteQuestion = (title: string, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).deleteQuestion({ title });

/** The share dialog's hint (I-256), in the answered words of OD-146; `until` the day, written in the figures' language. */
export const shareHint = (branch: string, until: string, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, language).shareHint({ branch, until });

/** A shared link's address: the page that opens it read-only. */
export const sharedAddress = (origin: string, token: string) =>
  `${origin}/leader-meetings/shared/${encodeURIComponent(token)}`;

/** Every editor of a meeting, in the list's order: the Owner first, then the Admins, then the Core Leaders. */
export const editorsInOrder = (editors: MeetingEditors): ForumPerson[] => [
  ...(editors.owner ? [editors.owner] : []),
  ...editors.admins,
  ...editors.coreLeaders,
];

/**
 * The card's avatars: every editor tagged *Core Leader* but the Owner — the tagged Admins, then the Core Leaders —
 * the same people *"{n} core leaders tagged"* counts (`:2591-2603`, F-186).
 */
export const taggedLeaders = (editors: MeetingEditors): ForumPerson[] => [
  ...editors.admins.filter((p) => p.tagged),
  ...editors.coreLeaders,
];

/** *WT* for *Wilson Tanoto*: the first letter of the first two words. */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

export type MeetingFilter = 'all' | 'upcoming' | 'past';

/** The filter, on the screen over the one read: *Past* is a meeting *Completed*. Newest first, by date. */
export const filterMeetings = (meetings: MeetingCard[], filter: MeetingFilter): MeetingCard[] =>
  meetings
    .filter((m) => filter === 'all' || (filter === 'upcoming') === (m.state === 'upcoming'))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.number - a.number));

/** A rung as the forum draws it: the code when it reads as one (*AB*, *AAB*), the label otherwise (*Agent*). */
export const rungShort = (rung: ForumPerson['rung']) => shortOfRung(rung);

/**
 * The card's date block: the month's three letters over the day (`:2597`) — *Okt* over *13*, `id-ID` (ADR-0167 §1);
 * *Oct* in English (P18.98-T3).
 */
export function dateBlock(date: string, language: Language = DEFAULT_LANGUAGE): { month: string; day: string } {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return { month: '', day: '' };
  return {
    month: formatMonthName(date, language),
    day: String(d),
  };
}
