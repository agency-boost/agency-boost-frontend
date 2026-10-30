'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { previewInvite, redeemInvite, type InvitePreview } from '@/lib/join';
import { acceptInvite, inviteTokenOf, readInviteBanner, type InviteBanner } from '@/lib/invites';
import { formatCalendarDay } from '@/lib/format';
import { signInPathFrom } from '@/lib/return-path';
import { useSession } from '@/lib/session';
import { landingFor } from '@/lib/landing';
import { RoleShell } from '@/components/role-shell';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { joinMessages } from '@/i18n/messages/join';

/**
 * Opening a leader's invite link, or typing their code.
 *
 * The prototype validates nothing — any non-empty string resolves to the same hardcoded
 * office and leader (`Overall.html:8846-8859`). Here the code is checked before anything
 * is written, and the joiner is shown **whose unit and which office** before they accept:
 * this path skips approval, so the one moment to understand it is this one.
 */
export default function JoinPage() {
  return (
    // `useSearchParams` needs a boundary, and the link somebody opens carries the code
    // in the query string.
    <Suspense fallback={<Waiting />}>
      <Join />
    </Suspense>
  );
}

function Waiting() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <Skeleton>
        <SkeletonText lines={3} />
      </Skeleton>
    </main>
  );
}

function Join() {
  const params = useSearchParams();
  // A leader's invite to one person (P18.96-T3 AC-4): its own page, not the leader-code check below.
  const inviteToken = inviteTokenOf(params);
  if (inviteToken) return <InviteJoin token={inviteToken} />;
  return <CodeJoin />;
}

/**
 * **A leader's invite, for an account that exists** (P18.96-T3 AC-4, ADR-0170 §4, case d): the banner, read before
 * anybody signs in, and — signed in as the account the code belongs to — *Accept and join*, which places them under
 * the leader at once and sends them to their landing: their activation, for a new hire. Signed out, it says to sign
 * in and comes back here after. The server refuses an account the code is not theirs (404) and one already in an
 * office (409), in its own words.
 */
function InviteJoin({ token }: { token: string }) {
  const router = useRouter();
  const { me, loading, reload } = useSession();
  const [banner, setBanner] = useState<InviteBanner | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useMessages(joinMessages).invite;
  const figures = useFigureLanguage();

  useEffect(() => {
    let live = true;
    readInviteBanner(token)
      .then((b) => { if (live) setBanner(b); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token);
      await reload();
      router.replace('/');
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  const here = `?invite=${encodeURIComponent(token)}`;
  return (
    <RoleShell title={t.title} subtitle={t.subtitle} allowSignedOut>
      <Card>
        {error && <ErrorBanner {...error} />}
        {!banner && !error && <Skeleton label={t.checking}><SkeletonText lines={3} /></Skeleton>}
        {banner && (
          <div>
            <div className="rounded-md border-l-4 border-l-amber bg-base p-3">
              <p className="font-display text-lg font-bold text-navy">{t.banner({ leader: banner.leaderName, kpm: banner.kpm.code })}</p>
              <p className="mt-1 text-md text-muted">{banner.kpm.branchName} · {banner.companyName}</p>
              <p className="mt-1 text-md text-navy">{t.details({ code: banner.agentCode, date: formatCalendarDay(banner.joinDate, figures) })}</p>
            </div>
            {!loading && !me ? (
              <div className="mt-4">
                <p className="text-md text-navy">{t.signedOut}</p>
                <ButtonLink href={signInPathFrom({ pathname: '/join', search: here })} className="mt-3">
                  {t.signIn}
                </ButtonLink>
                {!banner.existingAccount && (
                  <p className="mt-2 text-sm text-muted">
                    {t.noAccount}{' '}
                    <Link href={`/register${here}`} className="underline">{t.createOne}</Link>.
                  </p>
                )}
              </div>
            ) : (
              <Button className="mt-4" disabled={busy || loading} onClick={() => void accept()}>
                {busy ? t.accepting : t.accept}
              </Button>
            )}
          </div>
        )}
      </Card>
    </RoleShell>
  );
}

function CodeJoin() {
  const params = useSearchParams();
  const router = useRouter();
  const { me, loading, reload } = useSession();

  const [code, setCode] = useState(params.get('code') ?? '');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const t = useMessages(joinMessages).code;

  const fromLink = params.get('code');

  // A link arrives with the code already in it, so the check runs without being asked.
  useEffect(() => {
    if (!fromLink) return;
    setChecking(true);
    void previewInvite(fromLink)
      .then(setPreview)
      .catch((err) => setError(toDisplayError(err)))
      .finally(() => setChecking(false));
  }, [fromLink]);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await previewInvite(code));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setChecking(false);
    }
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await redeemInvite(preview!.code);
      await reload();
      router.replace('/');
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  const alreadyIn = Boolean(me?.membership);

  return (
    <RoleShell
      title={t.title}
      subtitle={t.subtitle}
      // Opened from an emailed link by somebody who may have no account yet: it says *Sign in first* itself.
      allowSignedOut
    >

      <Card>
        {error && <ErrorBanner {...error} />}

        {!loading && !me && (
          <div className="mb-4 rounded-md border border-hairline bg-base p-3">
            <p className="text-md text-navy">{t.signInFirst}</p>
            <ButtonLink href="/login" className="mt-3">
              {t.signIn}
            </ButtonLink>
            <p className="mt-2 text-sm text-muted">
              {t.noAccount({ link: (words) => <Link href="/register" className="underline">{words}</Link> })}
            </p>
          </div>
        )}

        {alreadyIn && (
          <div className="rounded-md border border-hairline bg-base p-3">
            <p className="text-md text-navy">{t.alreadyIn}</p>
            <p className="mt-1 text-sm text-muted">{t.alreadyInLine}</p>
            {/* The way out. Somebody who opened a colleague's invite by mistake was told
                this and then given nothing — no link, and until 2026-09-06 no sidebar
                either, so the browser's back button was the only exit. */}
            <ButtonLink href={landingFor(me)} variant="secondary" className="mt-3">
              {t.backToWork}
            </ButtonLink>
          </div>
        )}

        {/* UI-086 (Phase 18.99 T9): somebody already in an office is told so and given the way back — no field, no
            button they cannot use; the server refuses them a code whatever they type (`POST /join/redeem`). */}
        {!alreadyIn && !preview && (
          <form onSubmit={check} className="flex flex-col gap-4" noValidate>
            <Field
              label={t.label}
              htmlFor="code"
              hint={t.hint}
            >
              <TextInput
                id="code"
                autoComplete="off"
                autoCapitalize="characters"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                invalid={Boolean(error)}
              />
            </Field>
            <Button type="submit" disabled={checking || code.trim().length < 4}>
              {checking ? t.checking : t.check}
            </Button>
          </form>
        )}

        {!alreadyIn && preview && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t.inviteFor}
            </p>
            <p className="mt-1 font-display text-xl font-bold text-navy">{preview.kpmLabel}</p>
            <p className="mt-1 text-md text-navy">{t.reportTo({ leader: <strong>{preview.leaderName}</strong> })}</p>
            <p className="mt-3 text-md text-muted">{t.straightAway}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={busy || alreadyIn || !me} onClick={() => void accept()}>
                {busy ? t.joining : t.accept}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
              >
                {t.different}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </RoleShell>
  );
}
