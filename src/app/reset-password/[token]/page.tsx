'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { api, toDisplayError } from '@/lib/api-client';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';

const MIN_LENGTH = 10;

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      router.push('/login');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-3xl font-bold text-navy">Choose a new password</h1>
      <p className="mb-6 mt-1 text-md text-muted">
        This signs you out everywhere else — a reset is what you do when you think someone
        else has your password.
      </p>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          <Field
            label="New password"
            htmlFor="password"
            hint={`At least ${MIN_LENGTH} characters. Length beats symbols.`}
            error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : undefined}
          >
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={tooShort}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirm"
            error={mismatch ? 'The two passwords do not match.' : undefined}
          >
            <TextInput
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={mismatch}
            />
          </Field>

          <Button type="submit" disabled={busy || mismatch || tooShort || !password}>
            {busy ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
