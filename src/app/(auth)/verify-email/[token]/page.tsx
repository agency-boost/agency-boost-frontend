'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, toDisplayError } from '@/lib/api-client';
import { Card, ErrorBanner } from '@/components/ui/field';

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

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
      <h1 className="font-display text-3xl font-bold text-navy">Verify your email</h1>
      <Card className="mt-6">
        {state === 'working' && <p className="text-md text-muted">Checking your link…</p>}
        {state === 'done' && (
          <div>
            <p className="text-md text-navy">Your email is verified. You can sign in now.</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              Go to sign in
            </Link>
          </div>
        )}
        {state === 'failed' && error && (
          <div>
            <ErrorBanner {...error} />
            <p className="mt-3 text-sm text-muted">
              Verification links are single-use and expire after 24 hours. Sign in to request
              a new one.
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
