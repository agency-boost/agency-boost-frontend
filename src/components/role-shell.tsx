'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { AgentShell } from '@/components/agent-shell';
import { TenantShell } from '@/components/tenant-shell';
import { PageSkeleton } from '@/components/ui/skeleton';
import { signInPathFrom } from '@/lib/return-path';
import { useSession } from '@/lib/session';

/**
 * The chrome for a route that belongs to no one role family.
 *
 * Four routes are reachable by everybody — `/`, `/profile`, `/notifications` and `/join`
 * — and until 2026-09-06 each of them picked a shell by hand or wore none at all. So a
 * Super Admin who clicked **Notifications** landed in the *agent* application: eight nav
 * sections about units and leads, no link back to `/admin`, the `SUPERADMIN` tag gone,
 * and their own identity chip reading **"No office yet"** because a Super Admin has no
 * membership. The access gate was right the whole time; only the chrome was wrong, which
 * is why no permission test caught it.
 *
 * **The order mirrors `landingFor`** (`src/lib/landing.ts`), deliberately and for the same
 * reason: several of these are true at once — a KPM Owner is also an AB with a downline —
 * so it runs from the most specific state to the least. Where somebody lands and what
 * chrome they wear are the same question asked twice, and answering it twice in two
 * orders is how they drift apart.
 *
 * Not `landingFor` itself: that returns a **route**, and a route is not a shell. Two
 * functions, one order, and a test that fails if the order stops matching.
 */
export function RoleShell({
  title,
  subtitle,
  actions,
  permission,
  allowSignedOut = false,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** What this route needs — not what the chrome's own application needs. */
  permission?: string;
  /**
   * **The page renders for nobody signed in** — `/join` alone, opened from an emailed link by somebody who may
   * have no account yet, and which says *Sign in first* itself. Every other route sends a signed-out reader to
   * sign in, as `RequireSession` does.
   */
  allowSignedOut?: boolean;
  children: ReactNode;
}) {
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();
  const toSignIn = !loading && !me && !allowSignedOut;

  /*
   * **Signed out, sent to sign in and back** (P18.8-T15 AC-2, the client's UI review, UI-006). This rendered the
   * page bare for anybody not signed in, so an expired session on `/profile` drew an empty form, no header, a
   * pronoun of *they / them* and the raw `AUTH_TOKEN_INVALID` of the read that failed — while every page behind a
   * group layout went to `/login?next=…`. The same redirect as `RequireSession`, by the same `signInPathFrom`:
   * `next` carries the page, except after the reader signed out themselves, and `reason=expired` says a session
   * ended under them (ADR-0168 §1).
   */
  useEffect(() => {
    if (toSignIn) router.replace(signInPathFrom(window.location, { signedOut, expired }));
  }, [toSignIn, signedOut, expired, router]);

  if (!me) {
    // The one page that opts in decides for itself, loading or not, as it always has.
    if (allowSignedOut) return <>{children}</>;
    // While the session is read, and on the way to sign in: the shape of a page, never a page of failed reads.
    return <PageSkeleton />;
  }

  // Platform first: a Super Admin belongs to no office, so nothing below applies to them.
  if (me.user.platformRole === 'super_admin') {
    return (
      <AdminShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
        {children}
      </AdminShell>
    );
  }

  // Running an office — the tenant application is their home, whatever their hierarchy
  // role happens to be. An Owner is usually an AB too; that is not what they signed in as.
  if (me.membership?.isKpmOwner || me.membership?.isKpmAdmin) {
    return (
      <TenantShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
        {children}
      </TenantShell>
    );
  }

  // Everybody else, including somebody in no office at all — the agent application is
  // where they live and where `landingFor` sends them.
  return (
    <AgentShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
      {children}
    </AgentShell>
  );
}
