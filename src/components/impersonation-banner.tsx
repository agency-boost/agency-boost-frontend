'use client';

import { useState } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { supportBannerMessages } from '@/i18n/messages/support-banner';
import { endImpersonation } from '@/lib/admin';
import { setAccessToken, setImpersonating, tryRefresh } from '@/lib/api-client';
import { displayName } from '@/lib/display-name';
import { useSession } from '@/lib/session';
import { isViewAsWindow } from '@/lib/view-as';

/**
 * Always visible while a support session is running, above everything else.
 *
 * A Super Admin who forgets they are acting as someone else will make changes that read
 * as that person's own. The banner is not decoration — it is the only continuous signal
 * that the identity on screen is borrowed.
 *
 * *Changed 2026-11-20 (P19.23-T2 AC-7; ADR-0277; the owner mockups' `?va=` bar):* **the view-as bar** — navy, sticky at
 * the top, *"Melihat sebagai <b>NAME</b>"* with the name in capitals and the primary's colour, the tag *"Hanya melihat ·
 * tercatat di audit log"*, and *Selesai*. It was a red strip of three sentences. In a *Lihat sebagai* window
 * (`/view-as`) *Selesai* ends the session and closes the window; anywhere else — or where the browser keeps the window
 * open — it gives the Super Admin back their own session, as before.
 */
export function ImpersonationBanner() {
  const { me, reload } = useSession();
  // The Super Admin's own language: a support session never follows the person's (`LanguageProvider`'s `follow`).
  const t = useMessages(supportBannerMessages);
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
      // A window opened for this session has nothing else to do: the console is still open in the tab it came from.
      if (isViewAsWindow()) window.close();
      // The refresh cookie is still the real Super Admin's, so this restores them — in a window the browser kept open.
      await tryRefresh();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      data-view-as-bar=""
      className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-secondary px-4 py-2 text-md font-semibold text-secondary-contrast print:hidden"
    >
      <span className="min-w-0">
        {t.viewingAs}{' '}
        {/* `DESIGN-RULES.md`, *Names*: a person's name in capitals; the primary on the navy, as the mockup draws it. */}
        <b className="font-bold uppercase text-primary-on-secondary">{displayName(me.user)}</b>
      </span>
      <span className="rounded-pill bg-secondary-contrast/[0.14] px-2.5 py-0.5 text-xs font-semibold sm:ml-auto">
        {t.tag}
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={busy}
        className="ml-auto min-h-10 rounded-pill border border-secondary-contrast/40 px-4 text-md font-semibold hover:bg-secondary-contrast/10 disabled:opacity-50 sm:ml-0"
      >
        {busy ? t.ending : t.stop}
      </button>
    </div>
  );
}
