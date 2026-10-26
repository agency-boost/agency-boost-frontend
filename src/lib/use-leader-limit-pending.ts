'use client';

import { useEffect, useState } from 'react';
import { LEADER_LIMIT_QUEUE_CHANGED, readLeaderLimitQueue } from './leader-limit-requests';
import { useSession } from './session';

/**
 * **How many leaders wait past their office's limit**, for the console nav's count (ADR-0157 §3).
 *
 * Read when the shell mounts, for a reader who decides them, and again when the queue says it changed
 * (`LEADER_LIMIT_QUEUE_CHANGED`) — as `useUnreadCount` reads the inbox, with no timer. `0` on a failed read: a
 * count is a convenience, and an error about it would push the screen's own out of view.
 */
export function useLeaderLimitPending(): number {
  const { me } = useSession();
  const [pending, setPending] = useState(0);
  const decides = me?.permissions.includes('leader_limit_request:decide') ?? false;

  useEffect(() => {
    if (!decides) return;
    let live = true;
    const read = () => {
      void readLeaderLimitQueue()
        .then((rows) => { if (live) setPending(rows.filter((r) => r.status === 'pending').length); })
        .catch(() => { if (live) setPending(0); });
    };
    read();
    window.addEventListener(LEADER_LIMIT_QUEUE_CHANGED, read);
    return () => {
      live = false;
      window.removeEventListener(LEADER_LIMIT_QUEUE_CHANGED, read);
    };
  }, [decides]);

  return pending;
}
