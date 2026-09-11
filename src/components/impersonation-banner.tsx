'use client';

import { useState } from 'react';
import { endImpersonation } from '@/lib/admin';
import { setAccessToken, setImpersonating, tryRefresh } from '@/lib/api-client';
import { useSession } from '@/lib/session';

/**
 * Always visible while a support session is running, above everything else.
 *
 * A Super Admin who forgets they are acting as someone else will make changes that read
 * as that person's own. The banner is not decoration — it is the only continuous signal
 * that the identity on screen is borrowed.
 */
export function ImpersonationBanner() {
  const { me, reload } = useSession();
  const [busy, setBusy] = useState(false);

  if (!me?.isImpersonating) return null;

  async function stop() {
    setBusy(true);
    try {
      // Records the end before the token is dropped — afterwards the request would be
      // made as the Super Admin and the entry would attribute to the wrong session.
      await endImpersonation().catch(() => undefined);
      setImpersonating(false);
      setAccessToken(null);
      // The refresh cookie is still the real Super Admin's, so this restores them.
      await tryRefresh();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 bg-alert px-4 py-2 text-md font-semibold text-card"
    >
      <span>
        You are acting as {me.user.preferredName ?? me.user.fullName}.{' '}
        {/*
          * The half that matters most to the operator (P4-T10, §3.13). Discovering the
          * session is read-only from a 403 halfway through a fix is the worst moment to
          * find out — and a session that *can* write is the one worth saying so about
          * loudly, because a second person approved it and somebody is accountable.
          */}
        {me.impersonationReadOnly
          ? 'You can look but not change anything — a second Super Admin has to approve that.'
          : 'This session can make changes. It was approved by a second Super Admin.'}{' '}
        Everything you do is recorded against you as well.
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={busy}
        className="rounded-md border border-card/40 px-3 py-1 text-md font-semibold hover:bg-card/10 disabled:opacity-50"
      >
        {busy ? 'Ending…' : 'Stop acting as them'}
      </button>
    </div>
  );
}
