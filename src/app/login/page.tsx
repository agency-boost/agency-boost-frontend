'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { type DemoAccount } from '@/lib/demo-accounts';
import { DemoAccountsPanel } from '@/components/demo-accounts-panel';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(
    async (withEmail: string, withPassword: string) => {
      setBusy(true);
      setError(null);
      try {
        await signIn(withEmail, withPassword);
        // `/` forwards by role: a Super Admin to the console, a tenant admin to their
        // office, everyone else to their account.
        router.push('/');
      } catch (err) {
        setError(toDisplayError(err));
      } finally {
        setBusy(false);
      }
    },
    [router, signIn],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void attempt(email, password);
  }

  function chooseDemo(account: DemoAccount) {
    // The fields are filled before signing in, so the values stay on screen and a
    // failure is diagnosable rather than magic.
    setEmail(account.email);
    setPassword(account.password);
    void attempt(account.email, account.password);
  }

  const credentialsRejected = error?.code === 'AUTH_INVALID_CREDENTIALS';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
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
              invalid={credentialsRejected}
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
              invalid={credentialsRejected}
            />
          </Field>

          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <Link href="/forgot-password" className="text-center text-sm text-muted underline">
            Forgot your password?
          </Link>

          <Link href="/register" className="text-center text-sm text-muted underline">
            Create an account
          </Link>
        </form>
      </Card>

      <DemoAccountsPanel onChoose={chooseDemo} disabled={busy} />
    </main>
  );
}
