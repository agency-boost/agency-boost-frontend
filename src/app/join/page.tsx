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

/** The invite page's words (ADR-0170 §3): ours, no prototype draws an invite to one person. */
const INVITE_JOIN_COPY = {
  title: 'Join your leader’s team',
  subtitle: 'An invite from your leader, to you by your agent code.',
  banner: (leader: string, kpm: string) => `You're joining ${leader}'s team · KPM ${kpm}`,
  details: (code: string, day: string) => `Agent code ${code} · Join date ${formatCalendarDay(day)}`,
  accept: 'Accept and join',
  accepting: 'Joining…',
  signIn: 'Sign in to accept',
  signedOut: 'Sign in with the account your agent code belongs to, then accept.',
  noAccount: 'No account yet?',
  createOne: 'Create one with this invite',
  checking: 'Checking your invite…',
} as const;

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
    <RoleShell title={INVITE_JOIN_COPY.title} subtitle={INVITE_JOIN_COPY.subtitle} allowSignedOut>
      <Card>
        {error && <ErrorBanner {...error} />}
        {!banner && !error && <Skeleton label={INVITE_JOIN_COPY.checking}><SkeletonText lines={3} /></Skeleton>}
        {banner && (
          <div>
            <div className="rounded-md border-l-4 border-l-amber bg-base p-3">
              <p className="font-display text-lg font-bold text-navy">{INVITE_JOIN_COPY.banner(banner.leaderName, banner.kpm.code)}</p>
              <p className="mt-1 text-md text-muted">{banner.kpm.branchName} · {banner.companyName}</p>
              <p className="mt-1 text-md text-navy">{INVITE_JOIN_COPY.details(banner.agentCode, banner.joinDate)}</p>
            </div>
            {!loading && !me ? (
              <div className="mt-4">
                <p className="text-md text-navy">{INVITE_JOIN_COPY.signedOut}</p>
                <ButtonLink href={signInPathFrom({ pathname: '/join', search: here })} className="mt-3">
                  {INVITE_JOIN_COPY.signIn}
                </ButtonLink>
                {!banner.existingAccount && (
                  <p className="mt-2 text-sm text-muted">
                    {INVITE_JOIN_COPY.noAccount}{' '}
                    <Link href={`/register${here}`} className="underline">{INVITE_JOIN_COPY.createOne}</Link>.
                  </p>
                )}
              </div>
            ) : (
              <Button className="mt-4" disabled={busy || loading} onClick={() => void accept()}>
                {busy ? INVITE_JOIN_COPY.accepting : INVITE_JOIN_COPY.accept}
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
      title="Join an office"
      subtitle="With a leader's code, link or QR. All three are the same invite."
      // Opened from an emailed link by somebody who may have no account yet: it says *Sign in first* itself.
      allowSignedOut
    >

      <Card>
        {error && <ErrorBanner {...error} />}

        {!loading && !me && (
          <div className="mb-4 rounded-md border border-hairline bg-base p-3">
            <p className="text-md text-navy">Sign in first, then open this link again.</p>
            <ButtonLink href="/login" className="mt-3">
              Sign in
            </ButtonLink>
            <p className="mt-2 text-sm text-muted">
              No account yet?{' '}
              <Link href="/register" className="underline">
                Create one
              </Link>
              .
            </p>
          </div>
        )}

        {alreadyIn && (
          <div className="mb-4 rounded-md border border-hairline bg-base p-3">
            <p className="text-md text-navy">
              You are already in an office, so this invite is not for you.
            </p>
            <p className="mt-1 text-sm text-muted">
              Moving between offices is not something you do to yourself — ask whoever
              administers yours.
            </p>
            {/* The way out. Somebody who opened a colleague's invite by mistake was told
                this and then given nothing — no link, and until 2026-09-06 no sidebar
                either, so the browser's back button was the only exit. */}
            <ButtonLink href={landingFor(me)} variant="secondary" className="mt-3">
              Back to your work
            </ButtonLink>
          </div>
        )}

        {!preview && (
          <form onSubmit={check} className="flex flex-col gap-4" noValidate>
            <Field
              label="Invite code"
              htmlFor="code"
              hint="Six characters. Upper or lower case, it does not matter."
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
              {checking ? 'Checking…' : 'Check this invite'}
            </Button>
          </form>
        )}

        {preview && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              This invite is for
            </p>
            <p className="mt-1 font-display text-xl font-bold text-navy">{preview.kpmLabel}</p>
            <p className="mt-1 text-md text-navy">
              You would report to <strong>{preview.leaderName}</strong>.
            </p>
            <p className="mt-3 text-md text-muted">
              Accepting joins you straight away — nobody has to approve it. You can be moved to a
              different leader later, but not by yourself.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={busy || alreadyIn || !me} onClick={() => void accept()}>
                {busy ? 'Joining…' : 'Accept and join'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
              >
                Use a different code
              </Button>
            </div>
          </div>
        )}
      </Card>
    </RoleShell>
  );
}
