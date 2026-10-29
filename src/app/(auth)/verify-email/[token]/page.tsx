'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, toDisplayError } from '@/lib/api-client';
import { Card, ErrorBanner } from '@/components/ui/field';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const t = useMessages(authMessages).verify;

  useEffect(() => {
    void (async () => {
      try {
        await api('/auth/verify-email', { method: 'POST', body: { token } });
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
        {/* The only wait on the site that announced nothing: no `role="status"`, so a
            screen reader reached a card and was told there was no content in it. */}
        {state === 'working' && (
          <p role="status" className="text-md text-muted">
            {t.checking}
          </p>
        )}
        {state === 'done' && (
          <div>
            <p className="text-md text-navy">{t.verified}</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              {t.goToSignIn}
            </Link>
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
