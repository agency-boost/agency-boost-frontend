'use client';

import { useEffect, useState } from 'react';
import { INBOX_CHANGED, inboxChangeOf, readInbox } from './notifications';
import { useSession } from './session';

/**
 * How many notifications are unread, for the sidebar badge.
 *
 * Read when a shell mounts, and again whenever a screen says the inbox changed
 * (`INBOX_CHANGED`: an invitation answered, a notice marked read). It does not poll: a badge
 * that is a few minutes stale is a smaller problem than every screen in the product holding
 * an open timer, and anything that actually needs to be seen now arrives on the screen that
 * caused it.
 *
 * **A change that carries its count is taken as it is** (P12.1-T2 AC-6). Marking a row read, the
 * toggle and *Mark all read* each answer the whole inbox's count, and the list that made the change
 * passes it on; asking the server again for a number it has just given would be a second request for
 * every click. A change without one — the calendar's answer reading its notice — is read afresh.
 *
 * The read asks for a page of one: the count comes with any page, and the items are not wanted here.
 *
 * Returns `0` rather than throwing when the read fails. A badge is a convenience — an
 * error banner about a count nobody asked for would push the screen's real error out of
 * view.
 */
export function useUnreadCount(): number {
  const { me } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) return;
    let live = true;
    const read = () => {
      void readInbox({ page: 1, pageSize: 1 })
        .then((inbox) => {
          if (live) setUnread(inbox.unread);
        })
        .catch(() => {
          if (live) setUnread(0);
        });
    };
    const changed = (event: Event) => {
      const { unread: count } = inboxChangeOf(event);
      if (typeof count === 'number') setUnread(count);
      else read();
    };
    read();
    window.addEventListener(INBOX_CHANGED, changed);
    return () => {
      live = false;
      window.removeEventListener(INBOX_CHANGED, changed);
    };
  }, [me]);

  return unread;
}
