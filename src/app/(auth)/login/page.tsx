'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { type DemoAccount } from '@/lib/demo-accounts';
import { DemoAccountsPanel } from '@/components/demo-accounts-panel';
import { AUTH_PAGE } from '@/components/auth-page';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { resendVerification } from '@/lib/sessions';
import { destinationAfterSignIn, sessionEndedIn } from '@/lib/return-path';
import { PasswordInput } from '@/components/ui/password-input';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

export default function LoginPage() {
  const { signIn } = useSession();
  const t = useMessages(authMessages).signIn;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(
    async (withEmail: string, withPassword: string) => {
      setBusy(true);
      setError(null);
      try {
        const signedIn = await signIn(withEmail, withPassword);
        // Back to the page that sent the reader here (`?next=`), when the person who just signed in can
        // open it; otherwise their own landing — a Super Admin to the console, a tenant admin to their
        // office, everyone else to their field landing. Whoever signed out before them on this device
        // left their page in `next`, and it was honoured for anybody (the product owner's report,
        // 2026-10-11).
        router.push(destinationAfterSignIn(window.location.search, signedIn));
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
  /*
   * The one refusal a person can act on from here (P4-T13).
   *
   * Login refuses an unverified account, and until `resend-verification` existed the only
   * advice was "check your inbox" — for an email that, before `P4-T14`, had never been
   * sent. Both halves are real now, so the screen offers the action instead of the advice.
   */
  const notVerified = error?.code === 'AUTH_EMAIL_NOT_VERIFIED';

  return (
    <main className={AUTH_PAGE}>
      <PublicTitle>
        <h1 className="font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      {/* `useSearchParams` needs a boundary; until the address is read, the sentence everybody else reads. */}
      <Suspense fallback={<Lede ended={false} />}>
        <LedeFromAddress />
      </Suspense>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}
          {notVerified && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={resent || busy}
                onClick={async () => {
                  try {
                    await resendVerification(email);
                    setResent(true);
                  } catch (err) {
                    setError(toDisplayError(err));
                  }
                }}
              >
                {t.resend}
              </Button>
              {resent && (
                <p role="status" className="text-md text-muted">
                  {t.resent}
                </p>
              )}
            </div>
          )}

          <Field label={t.email} htmlFor="email">
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

          <Field label={t.password} htmlFor="password">
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={credentialsRejected}
            />
          </Field>

          <Button type="submit" disabled={busy}>
            {busy ? t.signingIn : t.signIn}
          </Button>

          <Link href="/forgot-password" className="text-center text-sm text-muted underline">
            {t.forgot}
          </Link>

          <Link href="/register" className="text-center text-sm text-muted underline">
            {t.createAccount}
          </Link>
        </form>
      </Card>

      <DemoAccountsPanel onChoose={chooseDemo} disabled={busy} />
    </main>
  );
}

/**
 * **The line under the title** (ADR-0168 §1): *Your session ended. Sign in again.* when a page found the reader's
 * session gone and said so in the address (`reason=expired`, `signInPathFrom`), *Sign in to continue.* for anybody
 * else — a link opened signed out, a deliberate sign-out, or any other `reason`.
 */
function LedeFromAddress() {
  return <Lede ended={sessionEndedIn(useSearchParams())} />;
}

function Lede({ ended }: { ended: boolean }) {
  const t = useMessages(authMessages).signIn;
  return (
    <p className="mb-6 mt-1 text-md text-muted">
      {ended ? t.sessionEnded : t.toContinue}
    </p>
  );
}
