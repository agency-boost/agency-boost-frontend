'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { type DemoAccount } from '@/lib/demo-accounts';
import { DemoAccountsPanel } from '@/components/demo-accounts-panel';
import { SignInWelcome, SIGN_IN_PAGE } from '@/components/sign-in-welcome';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { destinationAfterSignIn, sessionEndedIn } from '@/lib/return-path';
import { PasswordInput } from '@/components/ui/password-input';
import { PublicTitle } from '@/components/public-title';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';
import { LinkBranding } from '@/components/branding/link-branding';

/**
 * **Sign in** (`/login`; UI V1, UI-102, D-11 and D-12; Phase 18.11 T11): **a welcome screen, not a form card** — soft
 * warm-grey and peach shapes behind, Boost pointing on his peach circle in the middle with the three icon cards floating
 * around him, the app's name and one short line under it, then the form, and **one big pill *Sign in*** (52px) near the
 * thumb. **Today's method and today's words**: email and password, *Forgot your password?*, *Create an account* and
 * the development accounts — only the look changes (`SignInWelcome`). The verification resend moved to the shells'
 * banner when sign-in stopped refusing an unverified address (P19-T1, ADR-0190).
 */
export default function LoginPage() {
  const { signIn } = useSession();
  const t = useMessages(authMessages).signIn;
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
        const signedIn = await signIn(withEmail, withPassword);
        // Back to the page that sent the reader here (`?next=`), when the person who just signed in can
        // open it; otherwise their own landing — a Super Admin to the console, a tenant admin to their
        // office, everyone else to their field landing. Whoever signed out before them on this device
        // left their page in `next`, and it was honoured for anybody (the product owner's report,
        // 2026-10-11). After an expired session (`reason=expired`) `next` is not read at all: every
        // sign-in again starts on the landing (staging review, 2026-10-31).
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
   * *Removed 2026-11-04 (P19-T1 AC-4; UI-163, ADR-0190 §4):* the *Send the verification email again* button this page
   * offered when sign-in refused an unverified address (`AUTH_EMAIL_NOT_VERIFIED`, P4-T13). Sign-in no longer refuses
   * one; every shell offers *Kirim ulang* on its banner until the address is verified (`VerifyEmailBanner`).
   */

  return (
    <main className={SIGN_IN_PAGE}>
      {/* P19.6-T1 AC-13 (ADR-0218 §9): `?kpm=<id>`'s logo above the welcome, its colours on the page. */}
      <Suspense fallback={null}><LinkBranding /></Suspense>
      <SignInWelcome />
      <PublicTitle>
        <h1 className="w-full text-center font-display text-3xl font-bold text-navy">{t.title}</h1>
      </PublicTitle>
      {/* `useSearchParams` needs a boundary; until the address is read, the sentence everybody else reads. */}
      <Suspense fallback={<Lede ended={false} />}>
        <LedeFromAddress />
      </Suspense>

      <div className="relative">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

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

          {/* UI-102: one big pill, 52px, near the thumb. */}
          <Button type="submit" disabled={busy} data-sign-in="" className="mt-1 h-[3.25rem] w-full rounded-pill text-base">
            {busy ? t.signingIn : t.signIn}
          </Button>

          <Link href="/forgot-password" className="text-center text-sm text-muted underline">
            {t.forgot}
          </Link>

          <Link href="/register" className="text-center text-sm text-muted underline">
            {t.createAccount}
          </Link>
        </form>
      </div>

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
    <p className="mb-6 mt-1 text-center text-md text-muted">
      {ended ? t.sessionEnded : t.toContinue}
    </p>
  );
}
