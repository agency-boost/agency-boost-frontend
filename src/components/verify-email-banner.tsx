'use client';

import { useContext, useState } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { SessionContext } from '@/lib/session';
import { resendVerification } from '@/lib/sessions';

/**
 * ***"Verifikasi email Anda · Kirim ulang"*** (P19-T1 AC-4; UI-163, the owner's words; ADR-0190 §4).
 *
 * A person signs in before their address is verified, so every shell carries this one line at the top of its page
 * until it is: what to do, and *Kirim ulang*, which sends a new link to the account's own address (`POST
 * /auth/resend-verification`, three an hour). Pressing it says *Terkirim* in its place. Gone the moment the session
 * says the address is verified (`emailVerified`) — the verification page reloads the session when it is pressed on a
 * signed-in device.
 *
 * **Never in a support session**: the address is the member's, and mail sent from somebody else's screen is not theirs
 * to send. Absent `emailVerified` reads as verified, so a session from an API that does not say is never nagged.
 *
 * One line in the page's own column, in the attention pill's tint (`bg-pill-amber`, as a status pill draws it) — the
 * smallest footprint for a request the owner made explicitly (`prototype-parity.md`, P19-T1).
 */
export function VerifyEmailBanner() {
  // Read without `useSession`'s insistence: the shell is drawn in isolation by its own tests, with no session at all.
  const me = useContext(SessionContext)?.me ?? null;
  const t = useMessages(authMessages).banner;
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<ApiError | null>(null);

  if (!me || me.isImpersonating || me.user.emailVerified !== false) return null;
  const email = me.user.email;

  async function send() {
    setState('sending');
    setError(null);
    try {
      await resendVerification(email);
      setState('sent');
    } catch (err) {
      setError(toDisplayError(err));
      setState('idle');
    }
  }

  return (
    <div data-verify-email="" className="mb-4 rounded-md bg-pill-amber px-3 py-1 text-md text-pill-amber-ink print:hidden">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-semibold">{t.line}</span>
        <span aria-hidden="true">·</span>
        {state === 'sent' ? (
          <span role="status" className="py-2">{t.sent}</span>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 disabled:opacity-60 lg:min-h-8"
          >
            {state === 'sending' ? t.sending : t.resend}
          </button>
        )}
      </p>
      {error && <div className="pb-2"><ErrorBanner {...error} /></div>}
    </div>
  );
}
