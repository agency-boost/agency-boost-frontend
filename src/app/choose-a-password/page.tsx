'use client';

import { useState } from 'react';
import { Button, Card, ErrorBanner, Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

const MIN_LENGTH = 10;

/**
 * Where somebody lands when the password they signed in with is not theirs.
 *
 * An account created by the roster import (P3.6-T4) starts on a password an operator
 * generated, read, and put in an email. Until it is replaced, `AuthGuard` refuses every
 * route but three — so this screen is not a suggestion or a nag, it is the only thing
 * that account can do.
 *
 * **Cross-family, and deliberately chrome-less.** It is reached by an Agent, an AB and a
 * KPM Owner alike, and offering a sidebar would be offering navigation that every link
 * on it returns `403` for. The one way out is forward.
 */
export default function ChooseAPasswordPage() {
  const { me } = useSession();
  const { signOut } = useSignOut();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const all = useMessages(authMessages);
  const t = all.choose;
  const rules = all.password;

  const tooShort = form.newPassword.length > 0 && form.newPassword.length < MIN_LENGTH;
  const padded = /^\s|\s$/.test(form.newPassword);
  const mismatch = form.confirmPassword.length > 0 && form.confirmPassword !== form.newPassword;
  // The server refuses this too. Saying so here means the round trip is not spent
  // learning something the screen already knew.
  const unchanged =
    form.newPassword.length > 0 && form.newPassword === form.currentPassword;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      // Changing a password signs every session out, this one included — which is the
      // point, because the token was minted under a credential somebody else has seen.
      // So this tab's session is ended the way every *Sign out* ends it (`useSignOut`), to
      // plain `/login` (2026-10-11): it used to stay in memory, and `?changed=1` was never read.
      await signOut();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      <p className="mb-6 mt-1 text-md text-muted">{t.line}</p>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          {me?.user.email && (
            <p className="text-sm text-muted">{t.signedInAs({ email: <strong>{me.user.email}</strong> })}</p>
          )}

          <Field
            label={t.current}
            htmlFor="currentPassword"
            hint={t.currentHint}
          >
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={set('currentPassword')}
            />
          </Field>

          <Field
            label={t.newPassword}
            htmlFor="newPassword"
            hint={rules.hint({ n: MIN_LENGTH })}
            error={
              tooShort
                ? rules.tooShort({ n: MIN_LENGTH })
                : padded
                  ? rules.padded
                  : unchanged
                    ? t.unchanged
                    : undefined
            }
          >
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              required
              value={form.newPassword}
              onChange={set('newPassword')}
              invalid={tooShort || padded || unchanged}
            />
          </Field>

          <Field
            label={t.confirm}
            htmlFor="confirmPassword"
            error={mismatch ? rules.mismatch : undefined}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              invalid={mismatch}
            />
          </Field>

          <Button
            type="submit"
            disabled={
              busy || tooShort || padded || mismatch || unchanged
              || !form.currentPassword || !form.newPassword || !form.confirmPassword
            }
          >
            {busy ? rules.saving : t.save}
          </Button>

          <p className="text-sm text-muted">{t.afterLine}</p>
        </form>
      </Card>
    </main>
  );
}
