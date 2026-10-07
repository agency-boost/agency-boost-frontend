'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endImpersonation } from '@/lib/admin';
import {
  api, isImpersonating, onOfficeUnavailable, setAccessToken, setImpersonating, tryRefresh, type ApiError,
} from '@/lib/api-client';
import { Me, SessionContext } from '@/lib/session';
import { OfficeUnavailable } from './office-unavailable';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * The office the reader belongs to cannot be used — its subscription ended, or it is suspended or
   * archived (ADR-0112 §4, P13.2-T3 AC-9). Set by whichever request met the refusal, `/auth/me` or a
   * later one; while it is set, the app is the page saying so and nothing else.
   */
  const [unavailable, setUnavailable] = useState<{ error: ApiError; supportSession: boolean } | null>(null);
  /** Who is signed in, for the listener below, which is registered once and outlives renders. */
  const signedIn = useRef<Me | null>(null);

  /*
   * **Never the Super Admin's console** (P13.2 exit review). The page is a member's: *your* office cannot
   * be used. A Super Admin is nobody's member, so outside a support session one of these codes on their
   * request is that screen's own error, which the screen shows — it used to replace the whole console.
   * Inside a support session the page is shown, with *End support session* in place of *Sign out*.
   */
  useEffect(() => onOfficeUnavailable((error) => {
    const supportSession = isImpersonating();
    if (!supportSession && signedIn.current?.user.platformRole === 'super_admin') return;
    setUnavailable({ error, supportSession });
  }), []);

  const remember = useCallback((next: Me | null) => {
    signedIn.current = next;
    setMe(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      remember(await api<Me>('/auth/me'));
    } catch {
      // A refusal that means the office cannot be used has already replaced the app (above); any
      // other leaves no session, and the screens send the reader to sign in.
      remember(null);
    }
  }, [remember]);

  // On mount the access token is gone (it lives in memory only), but the httpOnly
  // refresh cookie survives a reload — so a signed-in user comes back signed in
  // without the token ever being reachable from script.
  useEffect(() => {
    void (async () => {
      if (await tryRefresh()) await reload();
      setLoading(false);
    })();
  }, [reload]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setAccessToken(accessToken);
      await reload();
    },
    [reload],
  );

  // Signing out never fails. The server call revokes the refresh-token family, but if
  // it cannot be reached the local session must still end — leaving someone signed in
  // because the network dropped is the wrong failure mode, and rethrowing would only
  // hand every caller an error there is no useful response to.
  const signOut = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    remember(null);
    setUnavailable(null);
  }, [remember]);

  /*
   * **Ending a support session from the page** (P13.2 exit review): the session's own end call — the
   * server lets it through although the office is suspended, so the session is revoked and its end
   * recorded — then the impersonation state reset and the Super Admin's own session restored from their
   * refresh cookie, as the banner's *Stop acting as them* does. Signing out here revoked the Super
   * Admin's sign-in instead, and left the session live.
   */
  const endSupportSession = useCallback(async () => {
    await endImpersonation().catch(() => undefined);
    setImpersonating(false);
    setAccessToken(null);
    // The Super Admin first, then the app: given back before they are, it would send them to sign in.
    if (await tryRefresh()) await reload();
    else remember(null);
    setUnavailable(null);
  }, [reload, remember]);

  const value = useMemo(
    () => ({ me, loading, signIn, signOut, reload }),
    [me, loading, signIn, signOut, reload],
  );

  return (
    <SessionContext.Provider value={value}>
      {/* Not a route: whatever address was opened, the reader sees what happened to their office. */}
      {unavailable ? (
        <OfficeUnavailable
          error={unavailable.error}
          onSignOut={signOut}
          onEndSupportSession={unavailable.supportSession ? endSupportSession : undefined}
        />
      ) : children}
    </SessionContext.Provider>
  );
}
