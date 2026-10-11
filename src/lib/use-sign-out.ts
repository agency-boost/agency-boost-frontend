'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSession } from './session';

/**
 * Signing out, from wherever it is offered.
 *
 * One hook rather than a handler per call site, so the sidebar menu and the account
 * screen cannot drift into ending the session differently. `signOut` itself never
 * rejects — a logout that cannot reach the server must still end the session locally —
 * so there is no error state to expose here, only whether it is in flight.
 *
 * The redirect is explicit rather than left to `RequireSession`'s effect: sign-out is
 * offered on screens that are not behind it, and "the guard will notice" is a fragile
 * thing to depend on for the one action whose whole point is leaving.
 *
 * **Plain `/login`, never with `next`** (the product owner's report, 2026-10-11). Ending the
 * session also wakes the page's own guard, which used to send the reader to
 * `/login?next=<this page>`; whichever navigation landed last won, and the next person to sign
 * in on the device was taken to the page the last one left. `signOut` now marks the session
 * `signedOut` in the same update that clears it, so the guard goes to plain `/login` too and
 * the order no longer matters.
 */
export function useSignOut(): { signOut: () => Promise<void>; busy: boolean } {
  const { signOut: end } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await end();
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }, [end, router]);

  return { signOut, busy };
}
