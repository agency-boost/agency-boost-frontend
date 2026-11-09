'use client';

import Link from 'next/link';
import { use, useId, useState } from 'react';
import { PublicTitle } from '@/components/public-title';
import { Button, Card, ErrorBanner, Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { useMessages } from '@/i18n/language-provider';
import { accountLinkMessages } from '@/i18n/messages/account-links';
import { confirmLink } from '@/lib/account-links';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';

/** A wrong password is said and the form stays; anything else about the link ends it. */
const TRY_AGAIN = new Set(['AUTH_INVALID_CREDENTIALS', 'VALIDATION_FAILED', 'AUTH_RATE_LIMITED', 'NETWORK']);

/**
 * ***Tautkan akun Anda*** — `/link-account/[token]` (P19.2-T1 AC-8; UI-169 item 5;
 * [ADR-0199](../../../../../../docs/04-adr/0199-a-second-login-is-linked-through-its-own-mailbox-and-password.md) §2): the
 * page the *Tambah akun* email opens, at the other login's address. `/verify-email/[token]`'s idiom — the same card,
 * and **nothing sent when the page loads** (ADR-0190 §1): a mail scanner that opens the link spends nothing. It asks the
 * password of the login the email was sent to, once; pressing *Tautkan akun* sends it with the token
 * (`POST /auth/links/confirm`).
 *
 * - **Linked**: the two logins each show the other's views in the avatar menu. Signed in here as the login that asked,
 *   the session is read again so the switcher has the new entry at once — the API signed the other login in here too.
 * - **A wrong password** is the server's sentence and the form stays, as a sign-in's does.
 * - **A link that does not work** — unknown, spent, replaced or expired, or either login changed since — is the
 *   server's sentence and the way to a new one.
 */
export default function LinkAccountPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { me, reload } = useSession();
  const t = useMessages(accountLinkMessages).page;
  const formId = useId();
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'failed'>('ready');
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'working' || !password) return;
    setState('working');
    setError(null);
    try {
      await confirmLink(token, password);
      setPassword('');
      setState('done');
      if (me) await reload();
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      setState(TRY_AGAIN.has(shown.code) ? 'ready' : 'failed');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      <Card className="mt-6">
        {(state === 'ready' || state === 'working') && (
          <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
            <p className="text-md text-muted">{t.line}</p>
            {error && <ErrorBanner {...error} />}
            <Field label={t.password} htmlFor={`${formId}-password`}>
              <PasswordInput
                id={`${formId}-password`}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={state === 'working' || !password}>
              {state === 'working' ? t.working : t.submit}
            </Button>
          </form>
        )}
        {state === 'done' && (
          <div>
            <p role="status" className="text-md text-navy">{t.linked}</p>
            <Link href={me ? '/' : '/login'} className="mt-4 inline-block text-sm text-muted underline">
              {me ? t.open : t.goToSignIn}
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
