'use client';

import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { toDisplayError, type ApiError } from './api-client';
import {
  announceInboxChanged,
  INBOX_CHANGED,
  inboxChangeOf,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  readInbox,
  type InboxItem,
  type InboxPage,
} from './notifications';
import { SessionContext } from './session';

export interface InboxList {
  /** The page last read; `null` until the first read answers. */
  inbox: InboxPage | null;
  error: ApiError | null;
  /** A read is in flight. The rows already shown stay shown while it is. */
  loading: boolean;
  load: (page: number) => Promise<void>;
  /** Marks one read (`true`) or unread. Answers whether the server took it. */
  setRead: (item: InboxItem, read: boolean) => Promise<boolean>;
  readAll: () => Promise<void>;
}

/**
 * Whether the reader may mark a notification read or unread: the toggle, *Mark all read*, and the mark
 * that opening a row sends, in the popover and on the page alike.
 *
 * **A read-only support session marks nothing** (roles-and-permissions §3.13 and §7.2; the Phase 12.1
 * exit review, N2). `notification:mark_read` is a write despite its name: the server leaves it out of a
 * read-only session's permissions and answers 403 to every mark, which would otherwise be a row read at
 * once, refused, put back and explained in red. So nothing is drawn and nothing is sent. Held to the
 * permission and to the session's kind, as the calendar's writes are; the server refuses the call
 * whatever this draws.
 *
 * Outside a `SessionProvider` nobody holds the permission, and nothing is marked: `AppShell`'s spec
 * mounts the bell bare, as the settings specs mount `tenant-config-cache.tsx`.
 */
export function useCanMark(): boolean {
  const me = useContext(SessionContext)?.me;
  if (!me) return false;
  const readOnly = me.isImpersonating && me.impersonationReadOnly;
  return me.permissions.includes('notification:mark_read') && !readOnly;
}

/** One row's read state, and the count it moves, written into a page. */
function withRead(page: InboxPage, notificationId: string, readAt: string | null, unread: number): InboxPage {
  return {
    ...page,
    unread: Math.max(0, unread),
    items: page.items.map((item) => (item.notificationId === notificationId ? { ...item, readAt } : item)),
  };
}

/**
 * One list of the inbox — the bell's popover, or `/notifications` — and the three writes on it.
 *
 * **One hook for both**, so the popover and the page cannot differ in what a click does (P12.1-T3).
 *
 * **A write shows at once and is settled by the answer.** The row changes as it is clicked, so the
 * reader never waits on a round trip to see what they did; the answer then sets the row's `readAt` and
 * the whole inbox's count, and the count goes to the badge with the announcement (T2 AC-6). A write
 * that fails puts the row back (T3 AC-2: *leaves the row unread*) and says why.
 *
 * **`listen`**: read the page again when the inbox changes somewhere else — the popover over
 * `/notifications`, the calendar's answer reading its notice. A list never re-reads on its own
 * announcement, which carries its `origin`.
 *
 * **Reads answer in order.** A slow page 2 arriving after page 3 was asked for is dropped, so the
 * pager never shows a page it is no longer on.
 */
export function useInbox(pageSize: number, { listen = false }: { listen?: boolean } = {}): InboxList {
  const origin = useId();
  const [inbox, setInbox] = useState<InboxPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const page = useRef(1);
  const ticket = useRef(0);

  const load = useCallback(async (target: number) => {
    page.current = target;
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const next = await readInbox({ page: target, pageSize });
      if (mine !== ticket.current) return;
      setInbox(next);
      setError(null);
    } catch (err) {
      if (mine !== ticket.current) return;
      setError(toDisplayError(err));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }, [pageSize]);

  const setRead = useCallback(async (item: InboxItem, read: boolean) => {
    // Already so: nothing to send, and nothing for the count to move by.
    if ((item.readAt !== null) === read) return true;
    const id = item.notificationId;
    const step = read ? -1 : 1;
    setError(null);
    setInbox((now) => now && withRead(now, id, read ? new Date().toISOString() : null, now.unread + step));
    try {
      const answer = read ? await markNotificationRead(id) : await markNotificationUnread(id);
      setInbox((now) => now && withRead(now, id, answer.readAt, answer.unread));
      announceInboxChanged({ unread: answer.unread, origin });
      return true;
    } catch (err) {
      setInbox((now) => now && withRead(now, id, item.readAt, now.unread - step));
      setError(toDisplayError(err));
      return false;
    }
  }, [origin]);

  const readAll = useCallback(async () => {
    const at = new Date().toISOString();
    setError(null);
    setInbox((now) => now && {
      ...now,
      unread: 0,
      items: now.items.map((item) => (item.readAt === null ? { ...item, readAt: at } : item)),
    });
    let failure: ApiError | null = null;
    try {
      const answer = await markAllNotificationsRead();
      announceInboxChanged({ unread: answer.unread, origin });
    } catch (err) {
      failure = toDisplayError(err);
    }
    // The server's own times, and — after a failure — the rows as they really are (T4 AC-4). The
    // failure is said after the read, which would otherwise clear it.
    await load(page.current);
    if (failure) setError(failure);
  }, [load, origin]);

  useEffect(() => {
    if (!listen) return;
    const changed = (event: Event) => {
      if (inboxChangeOf(event).origin === origin) return;
      void load(page.current);
    };
    window.addEventListener(INBOX_CHANGED, changed);
    return () => window.removeEventListener(INBOX_CHANGED, changed);
  }, [listen, load, origin]);

  return { inbox, error, loading, load, setRead, readAll };
}
