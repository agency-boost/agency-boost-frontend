'use client';

import { useContext, useState } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { SessionContext } from '@/lib/session';
import { resendVerification } from '@/lib/sessions';

/**
 * ***"Email Anda belum diverifikasi · Kirim ulang tautan"*** (P19-T1 AC-4; UI-163; ADR-0190 §4. *Changed 11 November
 * 2026*, P19.12-T2 AC-4, ADR-0245 §5: it read *"Verifikasi email Anda · Kirim ulang"* on an amber fill, in bold — a step
 * still to take — and the client asked for it subtle, now that registering signs you in and verifying is optional).
 *
 * A person signs in before their address is verified, so every shell carries this one line at the top of its page
 * until it is: that it is not verified yet, and *Kirim ulang tautan*, which sends a new link to the account's own address
 * (`POST /auth/resend-verification`, three an hour). Pressing it says *Terkirim* in its place. Gone the moment the
 * session says the address is verified (`emailVerified`) — the verification page reloads the session when it is pressed
 * on a signed-in device.
 *
 * **Never in a support session**: the address is the member's, and mail sent from somebody else's screen is not theirs
 * to send. Absent `emailVerified` reads as verified, so a session from an API that does not say is never nagged.
 *
 * **One muted line** in the page's own column: no fill, small muted text at its normal weight, the link underlined in
 * the same muted ink — still 44px tall below 1024px, where it is a thumb's target (`prototype-parity.md`, P19-T1, and
 * P19.12-T2's row).
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
    <div data-verify-email="" className="mb-4 text-sm text-muted print:hidden">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{t.line}</span>
        <span aria-hidden="true">·</span>
        {state === 'sent' ? (
          <span role="status" className="py-2">{t.sent}</span>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            className="inline-flex min-h-11 items-center text-muted underline underline-offset-2 disabled:opacity-60 lg:min-h-8"
          >
            {state === 'sending' ? t.sending : t.resend}
          </button>
        )}
      </p>
      {error && <div className="pb-2"><ErrorBanner {...error} /></div>}
    </div>
  );
}
