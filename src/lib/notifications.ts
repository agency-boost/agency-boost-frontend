import { api } from './api-client';

export interface InboxItem {
  notificationId: string;
  templateId: string;
  /** Composed on the server: what a notification says is product copy (ADR-0010). */
  title: string;
  detail: string | null;
  /**
   * Where the item opens in the app, composed on the server beside its title: a finalized coaching
   * session opens on that session (`/coaching/me?session=…`, P11-T10 AC-8), and a calendar notice on
   * its entry's week, its detail open (`/calendar?entry=…&date=…`, ADR-0095). `null` for every other
   * item, which opens in a modal instead (P12.1-T3 AC-4).
   */
  href: string | null;
  kpmId: string | null;
  createdAt: string;
  readAt: string | null;
}

/**
 * One page of the inbox (P12.1-T4 AC-1). `unread` and `total` count the **whole** inbox, not the page,
 * so the badge, the popover and the pager can never disagree with each other.
 */
export interface InboxPage {
  items: InboxItem[];
  unread: number;
  total: number;
  page: number;
  pageSize: number;
}

/** What marking one read or unread answers: that row's state, and the whole inbox's count (T4 AC-2). */
export interface ReadState {
  notificationId: string;
  readAt: string | null;
  unread: number;
}

/** What *Mark all read* answers (T4 AC-3). */
export interface ReadAllState {
  unread: number;
}

/**
 * `/notifications` shows twenty a page, the API's own default (T4 AC-4) — the backend's
 * `INBOX_PAGE.DEFAULT_SIZE`, pinned to the OpenAPI document's default by `contract.spec.ts`.
 */
export const INBOX_PAGE_SIZE = 20;

/** The bell's popover reads one small page: the latest eight (T2 AC-2, T4 AC-5). */
export const POPOVER_PAGE_SIZE = 8;

export const readInbox = ({ page = 1, pageSize = INBOX_PAGE_SIZE }: { page?: number; pageSize?: number } = {}) =>
  api<InboxPage>(`/notifications?page=${page}&pageSize=${pageSize}`);

export const markNotificationRead = (notificationId: string) =>
  api<ReadState>(`/notifications/${notificationId}/read`, { method: 'POST' });

export const markNotificationUnread = (notificationId: string) =>
  api<ReadState>(`/notifications/${notificationId}/unread`, { method: 'POST' });

export const markAllNotificationsRead = () =>
  api<ReadAllState>('/notifications/read-all', { method: 'POST' });

/**
 * **The inbox changed on this screen**: an answer read the notice that announced it, or the reader marked
 * something read. The shell's badge reads the count again when it hears this, so it never keeps counting
 * a notice that has been dealt with. A window event, so no screen has to know where the badge lives.
 */
export const INBOX_CHANGED = 'agencyboost:inbox-changed';

/**
 * What a change says about itself, both optional.
 *
 * - `unread`: the whole inbox's count, **from the answer** of the write that changed it (P12.1-T2 AC-6).
 *   The badge takes it as it is rather than asking again; a change without one (the calendar's answer
 *   reading its notice) makes the badge read the count itself.
 * - `origin`: which list made the change, so that list does not read itself again on hearing its own
 *   announcement, while the other one (the popover over the page, or the page under the popover) does.
 * - `delta`: how far the count moves, **said before the server has answered** (P18.95-T1 AC-7; the client's
 *   UI review of 2026-10-26, UI-008: the bell's count stayed as it was after notices were marked read). The
 *   badge moves by it at once; `-1` for one read, `+1` for one unread, and the opposite to put it back.
 * - `local`: the change is the screen's own, not yet the server's — the badge moving ahead of an answer, or
 *   back after a refusal. **No list reads again on it**: the server has nothing new to say, and a read that
 *   overtook the write would show the row as it was. The answer follows, and is announced without it.
 */
export interface InboxChange {
  unread?: number;
  origin?: string;
  delta?: number;
  local?: boolean;
}

export function announceInboxChanged(change: InboxChange = {}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<InboxChange>(INBOX_CHANGED, { detail: change }));
  }
}

/** The change an `INBOX_CHANGED` event carries; empty for an event dispatched without one. */
export function inboxChangeOf(event: Event): InboxChange {
  return (event as CustomEvent<InboxChange | null>).detail ?? {};
}

/** A run of one notice, newest first: a single item, or its repeats (`groupRepeats`). */
export interface NoticeRun {
  /** The newest item's id: stable while the run is on the page. */
  key: string;
  items: InboxItem[];
}

/**
 * **Repeats of one notice, in a row, as one line** (P18.95-T7 AC-4; the client's UI review of 2026-10-26, UI-030 —
 * *Wilson updated your goal · 7×*). Items next to each other on the page that say the same thing about the same
 * thing — one template, the same words and the same address — are one run; any other item between them starts a new
 * one. The server composes the words from who acted and on what (ADR-0010), so identical words are the same actor
 * and the same subject, and two notices that read alike are not told apart by anything the reader could see.
 *
 * Within a page, as the inbox is paged: a run that crosses into the next page is counted on each.
 */
export function groupRepeats(items: readonly InboxItem[]): NoticeRun[] {
  const runs: NoticeRun[] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    if (last && sameNotice(last.items[0], item)) last.items.push(item);
    else runs.push({ key: item.notificationId, items: [item] });
  }
  return runs;
}

const sameNotice = (a: InboxItem, b: InboxItem) =>
  a.templateId === b.templateId && a.title === b.title && a.detail === b.detail && a.href === b.href;
