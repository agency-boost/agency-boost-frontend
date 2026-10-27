import { shortOfRung } from '@/components/ui/role-badge';
import { api } from './api-client';
import { CONFIRMED } from './confirmations';
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

export type ColumnKey = 'fy' | 'ytd' | 'thisMonthLastYear' | 'lastMonth' | 'thisMonth';
export const COLUMN_KEYS: readonly ColumnKey[] = ['fy', 'ytd', 'thisMonthLastYear', 'lastMonth', 'thisMonth'];

export type RowKey =
  | 'ape' | 'manpower' | 'flc' | 'producing_agents' | 'new_aa' | 'new_agent_3m'
  | 'avg_monthly_aa' | 'case_submission' | 'average_case_size';

/** The six rows whose *Monthly Target* is typed; the other three are blocked there. */
export type TargetRowKey = 'ape' | 'manpower' | 'flc' | 'new_aa' | 'avg_monthly_aa' | 'case_submission';

export type ScorecardCell =
  /** `value` exact: minor units for `idr_minor`, a whole or fractional count, a whole percentage. */
  | { kind: 'figure'; value: number; leavesOut: string[] /* YYYY-MM months of the period not held */ }
  /** *pending data*: no source holds the figure for its period. */
  | { kind: 'pending' }
  /** *—*: a ratio over nothing whose months are held (*Average Case Size* over no policies). */
  | { kind: 'none' }
  /** Drawn blocked, as the prototype draws it. */
  | { kind: 'blocked' };

export interface ScorecardRow {
  key: RowKey;
  unit: 'idr_minor' | 'count' | 'percentage';
  cells: Record<ColumnKey, ScorecardCell>;
  /** `null` where the prototype blocks the cell. A cell never typed is `{ value: '', version: 0 }`. */
  monthlyTarget: { value: string; version: number } | null;
}

export interface Scorecard {
  /** `YYYY` for `fy` and `ytd`; `YYYY-MM` for the three months. */
  periods: Record<ColumnKey, string>;
  chips: { manpower: number; agents: number; units: number; ab: number; aab: number };
  /** Nine, in the prototype's order. */
  rows: ScorecardRow[];
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

export const saveMonthlyTarget = (meetingId: string, row: TargetRowKey, body: { value: string; version: number }) =>
  api<{ value: string; version: number }>(`/leader-meetings/${encodeURIComponent(meetingId)}/monthly-targets/${row}`, { method: 'PUT', body });

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
 * The prototype's verbatim (`:2004`, `:2030`, `:2603-2620`, `:2710-2745`, `:2749-2764`), and the module's
 * own as `functional/leader-forum.md` *The module's own strings* has them. None of the module's own uses the
 * words that spec keeps out of the reader's sight (D-copy), and none names a phase; `leader-meetings.spec.ts`
 * scans them.
 */
export const FORUM_COPY = {
  title: 'Strategic Leader Forum',
  sub: 'Biweekly check-ins with your core leaders — agenda, notes, and action items',
  listLine:
    'Biweekly strategic check-ins with your core leaders — agenda, discussion notes, and action items, updated together.',
  filters: { all: 'All', upcoming: 'Upcoming', past: 'Past' },
  newMeeting: '+ New meeting',
  open: 'Open',
  allClear: 'All clear',
  noMatch: 'No meetings match this filter.',
  noMeetings: 'No meetings yet.',
  loadingList: 'Loading meetings…',
  loadingMeeting: 'Loading the meeting…',
  back: '← Back to all meetings',
  cadence: 'Recommended: every 2 weeks · 60–90 mins',
  share: 'Share',
  savePdf: 'Save as PDF',
  save: 'Save',
  canEdit: 'Can edit this MOM',
  manageTags: 'Manage tags →',
  you: '(You)',
  tabs: { overview: 'Overview & Stats', agenda: 'Agenda', actions: 'Action Items' },
  saved: 'Saved',
  allSaved: 'All changes saved',
  conflict: 'Someone else changed this while you were editing. It now shows what they saved.',
  failed: "Couldn't save that change. It's still here — try again.",
  preparingPdf: 'Preparing PDF — use your browser’s print dialog to save',
  dialog: {
    newTitle: 'New meeting',
    detailsTitle: 'Meeting details',
    title: 'Title',
    date: 'Date',
    create: 'Create meeting',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete meeting',
    confirmDelete: 'Delete',
    keep: 'Keep it',
    needTitle: 'Give the meeting a title.',
    needDate: 'Pick a date.',
    completed: 'This meeting has already taken place, so its date stays.',
    hasMinutes: "Something has been written in this meeting, so it can't be deleted.",
  },
  shareDialog: {
    title: 'Share this MOM',
    copy: 'Copy link',
    /** The copy controls' one wording since 2026-10-26 (P18.95-T1 AC-6, ADR-0167 §5); `:2764` said *Link copied to clipboard*. */
    copied: CONFIRMED.linkCopied,
    stop: 'Stop sharing',
    stopped: 'Sharing stopped',
    failed: "Couldn't make a link. Try again.",
    close: 'Close',
  },
  notFound: {
    title: "This meeting can't be found.",
    body: "It may have been deleted, or it isn't one you can open.",
  },
  linkNotFound: {
    title: "This link doesn't open anything.",
    body: 'It may have expired or been stopped. Ask whoever shared it for a new one.',
  },
  /** The not-found state's way on, for a reader with no list to go back to: where they land when they sign in. */
  home: 'Go to your home page',
} as const;

/** *Strategic Check-in — #15*: a new meeting's title, one past the highest number on the list (ADR-0130 §2). */
export const defaultMeetingTitle = (meetings: Pick<MeetingCard, 'number'>[]) =>
  `Strategic Check-in — #${meetings.reduce((top, m) => Math.max(top, m.number), 0) + 1}`;

export const stateLabel = (state: MeetingState) => (state === 'completed' ? 'Completed' : 'Upcoming');

/** *"3 core leaders tagged"*, singular for one (F-186). */
export const coreLeadersTagged = (n: number) => `${n} core leader${n === 1 ? '' : 's'} tagged`;

/** The words after the count in *"4 open items"*, *"1 open item"* (`:2606`); 0 is *All clear*, drawn apart. */
export const openItemsNoun = (n: number) => (n === 1 ? 'open item' : 'open items');

/** The date's button in the head (ADR-0130 §4). */
export const changeDateLabel = (title: string) => `Change the date of ${title}`;

export const deleteQuestion = (title: string) =>
  `Delete “${title}”? Nothing has been written in it yet, and it can't be brought back.`;

/** The share dialog's hint (I-256), in the answered words of OD-146. */
export const shareHint = (branch: string, until: string) =>
  `Anyone signed in to AgencyBoost at ${branch} can open this meeting's minutes with this link, read-only, until ${until}.`;

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

/** The card's date block: the month's three letters over the day (`:2597`) — *Okt* over *13*, `id-ID` (ADR-0167 §1). */
export function dateBlock(date: string): { month: string; day: string } {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return { month: '', day: '' };
  return {
    month: formatMonthName(date),
    day: String(d),
  };
}
