'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { resendVerification } from '@/lib/sessions';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

/**
 * **Verify your email** (`/verify-email/[token]`; P19-T1 AC-1, AC-2; UI-163, ADR-0190 §1–§2).
 *
 * **Nothing is sent when the page loads.** It sent the token on arrival, and the token is single-use, so a mail scanner
 * that opened the link first — or the person's own second open — spent it, and the first real open read *"Tautan itu
 * sudah tidak berlaku"*. The page is now the title and one button, *Verifikasi email saya*; the press sends the token,
 * and the server answers success for an address already verified too. A link that names nobody or expired shows the
 * server's refusal and the way to a new one: *Kirim ulang* here for somebody signed in on this device, and the way to
 * sign in for anybody else — the shells' banner offers *Kirim ulang* once they are.
 */
export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { me, reload } = useSession();
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'failed'>('ready');
  const [error, setError] = useState<ApiError | null>(null);
  const [resent, setResent] = useState<'no' | 'sending' | 'sent'>('no');
  const t = useMessages(authMessages).verify;

  async function verify() {
    setState('working');
    setError(null);
    try {
      await api('/auth/verify-email', { method: 'POST', body: { token } });
      setState('done');
      // Signed in here already: the shells' banner reads the session, so it goes the moment this is verified.
      if (me) await reload();
    } catch (err) {
      setError(toDisplayError(err));
      setState('failed');
    }
  }

  async function resend() {
    if (!me) return;
    setResent('sending');
    try {
      await resendVerification(me.user.email);
      setResent('sent');
    } catch (err) {
      setError(toDisplayError(err));
      setResent('no');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      <Card className="mt-6">
        {(state === 'ready' || state === 'working') && (
          <Button className="w-full" disabled={state === 'working'} onClick={() => void verify()}>
            {state === 'working' ? t.verifying : t.verifyMine}
          </Button>
        )}
        {state === 'done' && (
          <div>
            <p role="status" className="text-md text-navy">{t.verified}</p>
            <Link href={me ? '/' : '/login'} className="mt-4 inline-block text-sm text-muted underline">
              {me ? t.continue : t.goToSignIn}
            </Link>
          </div>
        )}
        {state === 'failed' && error && (
          <div>
            <ErrorBanner {...error} />
            <p className="mt-3 text-sm text-muted">{t.failedLine}</p>
            {me ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="secondary" disabled={resent !== 'no'} onClick={() => void resend()}>
                  {t.resend}
                </Button>
                {resent === 'sent' && <p role="status" className="text-sm text-muted">{t.resent}</p>}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {t.askSignedOut}{' '}
                <Link href="/login" className="underline">{t.goToSignIn}</Link>
              </p>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
