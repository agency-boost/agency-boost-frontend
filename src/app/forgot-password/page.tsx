'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Button, Card, Field, TextInput } from '@/components/ui/field';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    // The confirmation is identical whether or not the address exists — anything else
    // would let a visitor enumerate accounts. The API answers 202 either way; the
    // failure is swallowed rather than rethrown so that no error path can leak the
    // difference, and so a rejected promise never escapes this handler.
    await api('/auth/forgot-password', { method: 'POST', body: { email } }).catch(
      () => undefined,
    );
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-3xl font-bold text-navy">Reset your password</h1>

      <Card className="mt-6">
        {sent ? (
          <div>
            <p className="text-md text-navy">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
            <p className="mt-2 text-sm text-muted">
              The link expires in 30 minutes. Check your spam folder before requesting another.
            </p>
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Email" htmlFor="email" hint="We will send a reset link to this address.">
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
            <Link href="/login" className="text-center text-sm text-muted underline">
              Back to sign in
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
