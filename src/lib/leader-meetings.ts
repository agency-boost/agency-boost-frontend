import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { forumMessages } from '@/i18n/messages/forum';
import { api } from './api-client';
import { formatClock, formatShortDay, formatWeekday } from './format';
import { signInPathFrom, type SessionEnd } from './return-path';

/**
 * **The Strategic Leader Forum's client** (P19.22-T8; ADR-0276; `functional/leader-forum.md`): the office's forums of
 * its core leaders every two weeks — a date and a time, one agenda checklist and the action items, the unfinished ones
 * carried to the next forum — written together by the Super Admin inside the KPM, the Owner, the Admins and the core
 * leaders.
 *
 * Every shape here is the server's answer as built (`leader-meetings` module). Nothing is computed on the screen that
 * the server already decides: the state, the days to go, *Forum berikutnya*, who may edit, what the reader may do
 * (`can`), and the bound of every field (`limits`, invariant §7).
 */

/*
 * ── The shapes ──────────────────────────────────────────────────────────────────────────────────
 */

/** *Akan datang* through the end of the forum's date in the office's calendar, *Selesai* from 00:00 after. */
export type MeetingState = 'upcoming' | 'completed';

export interface ForumPerson {
  membershipId: string;
  name: string;
  /** How a PIC is drawn: *Agus*. */
  firstName: string;
  /** Their profile photo as a signed link; `null` for none: the avatar draws initials. */
  photoUrl: string | null;
  rung: { code: string; label: string };
  isReader: boolean;
  /** Tagged *Core leader* now. */
  tagged: boolean;
  /** One of the forum's editors now, so offered as a PIC. */
  pickable: boolean;
}

/** The bound of every typed field, served so the screen keeps no copy of it. */
export interface ForumLimits {
  textMax: number;
}

export interface MeetingCard {
  id: string;
  number: number;
  date: string;
  /** `HH:MM`; `null` on a forum made before P19.22, drawn with its date alone. */
  time: string | null;
  state: MeetingState;
  /** Office days to its date: 0 *Hari ini*, 1 *Besok*, negative once past. */
  daysUntil: number;
  agendaCount: number;
  actionProgress: { done: number; total: number };
}

export interface MeetingListView {
  today: string;
  meetings: MeetingCard[];
  nextId: string | null;
  coreLeaders: ForumPerson[];
  can: { create: boolean };
  limits: ForumLimits;
}

export interface AgendaItem {
  id: string;
  text: string;
  picMembershipId: string | null;
  picAll: boolean;
  done: boolean;
  version: number;
}

/** *Belum* · *Proses* · *Selesai*. */
export type ActionStatus = 'todo' | 'doing' | 'done';
export const ACTION_STATUSES: readonly ActionStatus[] = ['todo', 'doing', 'done'];

export interface ActionItem {
  id: string;
  lineageId: string;
  text: string;
  picMembershipId: string | null;
  dueOn: string | null;
  status: ActionStatus;
  /** *dari forum #n*: carried; `null` when raised in this forum. */
  fromNumber: number | null;
  version: number;
}

export interface MeetingCan {
  edit: boolean;
  share: boolean;
  reschedule: boolean;
  delete: boolean;
  print: boolean;
}

export interface MeetingView extends MeetingCard {
  version: number;
  coreLeaders: ForumPerson[];
  people: ForumPerson[];
  agenda: AgendaItem[];
  actionItems: ActionItem[];
  writtenIn: boolean;
  via: 'address' | 'link';
  can: MeetingCan;
  limits: ForumLimits;
}

export type AgendaItemSaved = AgendaItem | { removed: true };

export interface ShareLink {
  token: string;
  expiresAt: string;
}

/** An agenda line's PIC as the API takes it: a member's id, `'all'` (*Semua*), or `null` for none. */
export type AgendaPic = string | 'all' | null;

/*
 * ── The calls ───────────────────────────────────────────────────────────────────────────────────
 */

export const readMeetings = () => api<MeetingListView>('/leader-meetings');

export const createMeeting = (body: { date: string; time: string }) =>
  api<MeetingCard>('/leader-meetings', { method: 'POST', body });

export const readMeeting = (meetingId: string) => api<MeetingView>(`/leader-meetings/${encodeURIComponent(meetingId)}`);

export const rescheduleMeeting = (meetingId: string, body: { date?: string; time?: string; version: number }) =>
  api<MeetingCard>(`/leader-meetings/${encodeURIComponent(meetingId)}`, { method: 'PATCH', body });

export const deleteMeeting = (meetingId: string, version: number) =>
  api<void>(`/leader-meetings/${encodeURIComponent(meetingId)}?version=${version}`, { method: 'DELETE' });

export const addAgendaItem = (meetingId: string, body: { text: string; pic?: AgendaPic }) =>
  api<AgendaItem>(`/leader-meetings/${encodeURIComponent(meetingId)}/agenda-items`, { method: 'POST', body });

export const saveAgendaItem = (
  meetingId: string, itemId: string, body: { text?: string; pic?: AgendaPic; done?: boolean; version: number },
) => api<AgendaItemSaved>(
  `/leader-meetings/${encodeURIComponent(meetingId)}/agenda-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body },
);

export const addActionItem = (meetingId: string, body: { text: string; pic?: string | null; dueOn?: string | null }) =>
  api<ActionItem>(`/leader-meetings/${encodeURIComponent(meetingId)}/action-items`, { method: 'POST', body });

export const saveActionItem = (
  meetingId: string, itemId: string,
  body: { text?: string; pic?: string | null; dueOn?: string | null; status?: ActionStatus; version: number },
) => api<ActionItem>(
  `/leader-meetings/${encodeURIComponent(meetingId)}/action-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body },
);

export const removeActionItem = (meetingId: string, itemId: string, version: number) =>
  api<void>(
    `/leader-meetings/${encodeURIComponent(meetingId)}/action-items/${encodeURIComponent(itemId)}?version=${version}`, { method: 'DELETE' },
  );

export const createShareLink = (meetingId: string) =>
  api<ShareLink>(`/leader-meetings/${encodeURIComponent(meetingId)}/share-links`, { method: 'POST' });

export const readSharedMeeting = (token: string) =>
  api<MeetingView>(`/leader-meetings/shared/${encodeURIComponent(token)}`);

/*
 * ── The words and the rules the screens share ───────────────────────────────────────────────────
 */

/**
 * **A guard's way back**: where a reader the session has ended for is sent, and back to this address after. Here, not
 * in a screen, so the list's guard does not load the forum screen with it (the bundle).
 */
export const signInAndReturn = (pathname: string, end: SessionEnd) =>
  signInPathFrom({ pathname, search: '' }, end);

/** The forum's name, kept English in both languages (§A.1, §A.5): the page's title, the nav item's. */
export const FORUM_TITLE = kept('Strategic Leader Forum');

/** A shared link's address: the page that opens it read-only. */
export const sharedAddress = (origin: string, token: string) =>
  `${origin}/leader-meetings/shared/${encodeURIComponent(token)}`;

/**
 * **When a forum is**: *Kam, 27 Nov 2026 · 14.00* — the weekday, the day and the time in the figures' language (the app's
 * formatters, ADR-0167); its date alone when it has no time (a forum made before P19.22).
 */
export function forumWhen(card: Pick<MeetingCard, 'date' | 'time'>, language: Language = DEFAULT_LANGUAGE): string {
  const day = `${formatWeekday(card.date, language)}, ${formatShortDay(card.date, { year: true }, language)}`;
  return card.time ? `${day} · ${formatClock(card.time, language)}` : day;
}

/** *Hari ini* · *Besok* · *n hari lagi* (DATA-DEFINITIONS, *Dates and numbers*). */
export const daysToGo = (days: number, words: Language = SOURCE_LANGUAGE) =>
  messagesIn(forumMessages, words).daysToGo({ n: days });

/** The person a PIC names, in the forum's people; `null` for none or somebody the read no longer draws. */
export const personOf = (meeting: Pick<MeetingView, 'people'>, membershipId: string | null): ForumPerson | null =>
  (membershipId ? meeting.people.find((p) => p.membershipId === membershipId) ?? null : null);

/** The people a PIC may be chosen from: the forum's editors now. */
export const pickablePeople = (meeting: Pick<MeetingView, 'people'>): ForumPerson[] => meeting.people.filter((p) => p.pickable);

/** A list with nothing in it, in the message: a mark, the same in both languages. */
const NONE = '—';

/**
 * **The WhatsApp message *Bagikan* sends** (P19.22-T8 AC-2; OD-359): the forum and when; the agenda, a ✓ before each line
 * ticked; the action items with their PIC, *tenggat* and state; then the read-only link. Words in `words`, figures in
 * `language`.
 */
export function shareText(
  meeting: MeetingView, link: string, words: Language = SOURCE_LANGUAGE, language: Language = DEFAULT_LANGUAGE,
): string {
  const t = messagesIn(forumMessages, words);
  const pic = (id: string | null, all = false) => (all ? t.agenda.everyone : personOf(meeting, id)?.firstName ?? null);
  const agenda = meeting.agenda.map((line) => {
    const who = pic(line.picMembershipId, line.picAll);
    return `${line.done ? '✓' : '•'} ${line.text}${who ? ` (${who})` : ''}`;
  });
  const items = meeting.actionItems.map((item) => {
    const parts = [
      pic(item.picMembershipId),
      item.dueOn ? formatShortDay(item.dueOn, {}, language) : null,
      t.actions.status[item.status],
    ].filter((x): x is string => Boolean(x));
    return `• ${item.text} — ${parts.join(' · ')}`;
  });
  return [
    t.whatsapp.head({ n: meeting.number, when: forumWhen(meeting, language) }),
    '',
    `${t.tabs.agenda}:`,
    ...(agenda.length ? agenda : [NONE]),
    '',
    `${t.tabs.actions}:`,
    ...(items.length ? items : [NONE]),
    '',
    `${t.whatsapp.open} ${link}`,
  ].join('\n');
}

/** WhatsApp's chat picker with a message typed in: the reader picks the chat (`wa.me`, OD-359). */
export const whatsAppShareHref = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
