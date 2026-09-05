'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, tryRefresh } from '@/lib/api-client';
import { Me, SessionContext } from '@/lib/session';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
    } catch {
      setMe(null);
    }
  }, []);

  // On mount the access token is gone (it lives in memory only), but the httpOnly
  // refresh cookie survives a reload — so a signed-in user comes back signed in
  // without the token ever being readable from script.
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
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, signIn, signOut, reload }),
    [me, loading, signIn, signOut, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
