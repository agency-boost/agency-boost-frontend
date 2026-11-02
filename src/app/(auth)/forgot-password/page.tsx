'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Button, Card, Field, TextInput } from '@/components/ui/field';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useMessages(authMessages).forgot;

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
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>

      <Card className="mt-6">
        {sent ? (
          <div>
            <p className="text-md text-navy">{t.sent({ email: <strong>{email}</strong> })}</p>
            <p className="mt-2 text-sm text-muted">{t.sentLine}</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-muted underline">
              {t.backToSignIn}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label={t.email} htmlFor="email" hint={t.emailHint}>
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
              {busy ? t.sending : t.send}
            </Button>
            <Link href="/login" className="text-center text-sm text-muted underline">
              {t.backToSignIn}
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
