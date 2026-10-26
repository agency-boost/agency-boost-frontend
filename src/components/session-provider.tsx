'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endImpersonation } from '@/lib/admin';
import {
  api, isImpersonating, onOfficeUnavailable, onSessionLost, refreshSession, setAccessToken, setImpersonating,
  type ApiError,
} from '@/lib/api-client';
import { Me, SessionContext } from '@/lib/session';
import { OfficeUnavailable } from './office-unavailable';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * The reader signed out themselves (`SessionValue.signedOut`): set by `signOut` alone, so an expired
   * session, a failed refresh or a link opened signed out still carries the page back through `next`.
   */
  const [signedOut, setSignedOut] = useState(false);
  /**
   * The reader's session ended (`SessionValue.expired`, ADR-0168 §1): set by the API client's report that a
   * refresh was refused while somebody was signed in, or by the first read finding a refresh cookie that no
   * longer works (`AUTH_SESSION_ENDED`) — the app closed and opened again after the session ended.
   */
  const [expired, setExpired] = useState(false);
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

  /*
   * **A session that ends under the reader says so** (ADR-0168 §1). A request answered `401` whose refresh the
   * server refused ends the session this tab had: it is cleared, and marked `expired` in the same update, so the
   * page's guard sends the reader to `/login?next=<the page>&reason=expired`. With nobody signed in there was no
   * session to end — a request made before the session was read, a wrong password at sign-in — and nothing
   * changes.
   */
  useEffect(() => onSessionLost(() => {
    if (!signedIn.current) return;
    setAccessToken(null);
    remember(null);
    setSignedOut(false);
    setExpired(true);
  }), [remember]);

  /** Reads the session, and says who it found: `signIn` hands that to the login page. */
  const load = useCallback(async (): Promise<Me | null> => {
    try {
      const found = await api<Me>('/auth/me');
      remember(found);
      // Somebody is signed in again, so whatever ends this session next was not them pressing Sign out, and the
      // session that ended before it is behind them.
      setSignedOut(false);
      setExpired(false);
      return found;
    } catch {
      // A refusal that means the office cannot be used has already replaced the app (above); any
      // other leaves no session, and the screens send the reader to sign in.
      remember(null);
      return null;
    }
  }, [remember]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  // On mount the access token is gone (it lives in memory only), but the httpOnly
  // refresh cookie survives a reload — so a signed-in user comes back signed in
  // without the token ever being reachable from script.
  //
  // **A cookie that no longer works is a session that ended** (ADR-0168 §1): the reader comes back to a tab or an
  // app closed after the session expired or was revoked, and is sent to sign in with `reason=expired`. No cookie at
  // all is somebody arriving signed out — never signed in here, or signed out, which clears it — and is not marked.
  useEffect(() => {
    void (async () => {
      const outcome = await refreshSession();
      if (outcome === 'refreshed') await reload();
      else if (outcome === 'ended') setExpired(true);
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
      return load();
    },
    [load],
  );

  // Signing out never fails. The server call revokes the refresh-token family, but if
  // it cannot be reached the local session must still end — leaving someone signed in
  // because the network dropped is the wrong failure mode, and rethrowing would only
  // hand every caller an error there is no useful response to.
  //
  // `signedOut` is set in the same update that clears `me`, so the page whose guard notices first already
  // knows not to carry itself to the next person who signs in (2026-10-11). Every deliberate sign-out comes
  // through here: the shells', the account screen's and its *Sign out everywhere* (`useSignOut`), and
  // `OfficeUnavailable`'s.
  const signOut = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    remember(null);
    setSignedOut(true);
    setExpired(false);
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
    const outcome = await refreshSession();
    if (outcome === 'refreshed') await reload();
    else {
      remember(null);
      // Their own session is gone too: refused by the server, it ended under them (ADR-0168 §1).
      if (outcome !== 'unreachable') setExpired(true);
    }
    setUnavailable(null);
  }, [reload, remember]);

  const value = useMemo(
    () => ({ me, loading, signedOut, expired, signIn, signOut, reload }),
    [me, loading, signedOut, expired, signIn, signOut, reload],
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
