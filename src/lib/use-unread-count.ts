'use client';

import { useEffect, useState } from 'react';
import { readInbox } from './notifications';
import { useSession } from './session';

/**
 * How many notifications are unread, for the sidebar badge.
 *
 * Read once when a shell mounts. It does not poll: a badge that is a few minutes stale is
 * a smaller problem than every screen in the product holding an open timer, and anything
 * that actually needs to be seen now arrives on the screen that caused it.
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
    void readInbox()
      .then((inbox) => {
        if (live) setUnread(inbox.unread);
      })
      .catch(() => {
        if (live) setUnread(0);
      });
    return () => {
      live = false;
    };
  }, [me]);

  return unread;
}
