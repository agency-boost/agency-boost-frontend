'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // Where you land depends on what you are. The Owner's Overview does not exist
      // until Phase 14, so an Owner lands on their profile for now.
      router.push('/');
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.error
          : { code: 'NETWORK', message: 'Could not reach the server.', requestId: 'unknown' },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-3xl font-bold text-navy">AgencyBoost</h1>
      <p className="mb-6 mt-1 text-md text-muted">Sign in to continue.</p>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={error?.code === 'AUTH_INVALID_CREDENTIALS'}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={error?.code === 'AUTH_INVALID_CREDENTIALS'}
            />
          </Field>

          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <Link href="/forgot-password" className="text-center text-sm text-muted underline">
            Forgot your password?
          </Link>
        </form>
      </Card>
    </main>
  );
}
