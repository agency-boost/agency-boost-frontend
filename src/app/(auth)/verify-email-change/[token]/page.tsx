'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { api, toDisplayError } from '@/lib/api-client';
import { Card, ErrorBanner } from '@/components/ui/field';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

/**
 * ***Konfirmasi email baru Anda*** — `/verify-email-change/[token]` (UI V1, 2026-10-30; UI-111; ADR-0181): the link an
 * email change sends to the new address. Opened from a mail client, signed in or not, it spends the token once
 * (`POST /auth/verify-email-change`) and says the address the account signs in with now, or why the link did not work.
 * `/verify-email/[token]`'s idiom: the same card, the same wait, the same refusal.
 */
export default function VerifyEmailChangePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const all = useMessages(authMessages);
  const t = all.verifyChange;
  // The token is single-use: a second call (a development double effect) would only ever report it spent.
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === token) return;
    sent.current = token;
    void (async () => {
      try {
        const answer = await api<{ status: string; email: string }>('/auth/verify-email-change', {
          method: 'POST', body: { token },
        });
        setEmail(answer.email);
        setState('done');
      } catch (err) {
        setError(toDisplayError(err));
        setState('failed');
      }
    })();
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      <Card className="mt-6">
        {state === 'working' && (
          <p role="status" className="text-md text-muted">
            {all.verify.checking}
          </p>
        )}
        {state === 'done' && email && (
          <div>
            <p role="status" className="text-md text-navy">{t.changed({ email })}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/profile" className="text-sm text-muted underline">{t.goToProfile}</Link>
              <Link href="/login" className="text-sm text-muted underline">{all.verify.goToSignIn}</Link>
            </div>
          </div>
        )}
        {state === 'failed' && error && (
          <div>
            <ErrorBanner {...error} />
            <p className="mt-3 text-sm text-muted">{t.failedLine}</p>
          </div>
        )}
      </Card>
    </main>
  );
}
