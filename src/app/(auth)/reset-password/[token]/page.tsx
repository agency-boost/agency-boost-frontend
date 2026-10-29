'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { api, toDisplayError } from '@/lib/api-client';
import { Button, Card, ErrorBanner, Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

const MIN_LENGTH = 10;

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const all = useMessages(authMessages);
  const t = all.reset;
  const rules = all.password;

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
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      <p className="mb-6 mt-1 text-md text-muted">{t.line}</p>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          <Field
            label={t.newPassword}
            htmlFor="password"
            hint={rules.hint({ n: MIN_LENGTH })}
            error={tooShort ? rules.tooShort({ n: MIN_LENGTH }) : undefined}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={tooShort}
            />
          </Field>

          <Field
            label={t.confirmPassword}
            htmlFor="confirm"
            error={mismatch ? rules.mismatch : undefined}
          >
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={mismatch}
            />
          </Field>

          <Button type="submit" disabled={busy || mismatch || tooShort || !password}>
            {busy ? rules.saving : t.set}
          </Button>
        </form>
      </Card>
      {/* A reset link expires, and an expired one is exactly when somebody is stuck.
          This screen offered no link at all until 2026-09-06 — the error said what went
          wrong and the only way on was the browser's back button. */}
      <p className="mt-4 text-center text-sm text-muted">
        {t.expired({ link: (words) => <Link href="/forgot-password" className="underline">{words}</Link> })}
      </p>
    </main>
  );
}
