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
