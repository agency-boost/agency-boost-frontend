'use client';

import { useEffect, useState } from 'react';
import { INBOX_CHANGED, readInbox } from './notifications';
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
      void readInbox()
        .then((inbox) => {
          if (live) setUnread(inbox.unread);
        })
        .catch(() => {
          if (live) setUnread(0);
        });
    };
    read();
    window.addEventListener(INBOX_CHANGED, read);
    return () => {
      live = false;
      window.removeEventListener(INBOX_CHANGED, read);
    };
  }, [me]);

  return unread;
}
