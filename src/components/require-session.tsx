'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { useSession } from '@/lib/session';
import { signInPathFrom } from '@/lib/return-path';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * Whether what renders here is already under a page title: a `Page` that draws one says so to what is
 * inside it. A refusal inside a titled page is a section of that page, not a page of its own.
 */
export const TitledPageContext = createContext(false);

/**
 * A client-side gate. It decides what to *render*, and nothing more — every API call it
 * wraps is authorized again on the server. A screen protected only here is a blocking
 * defect (docs/00-product/roles-and-permissions.md).
 *
 * `permission` is checked against the permissions the server resolved for this request,
 * so a revoked grant disappears on the next /auth/me rather than at token refresh.
 */
export function RequireSession({
  permission,
  headingLevel,
  children,
}: {
  permission?: string;
  /**
   * The refusal's heading. By default an `<h1>`, or an `<h2>` under a page that already has its title
   * (`TitledPageContext`): a coachee's tab refused inside the person shell, whose page is titled
   * *Coaching Session*, is one heading below it, not a second title (P11-T7's review).
   */
  headingLevel?: 1 | 2;
  children: React.ReactNode;
}) {
  const { me, loading } = useSession();
  const router = useRouter();
  const titled = useContext(TitledPageContext);
  const Heading = (headingLevel ?? (titled ? 2 : 1)) === 1 ? 'h1' : 'h2';

  useEffect(() => {
    // Back to this page once signed in (`?next=`, `lib/return-path.ts`): a link opened signed out lands on it.
    if (!loading && !me) router.replace(signInPathFrom(window.location));
    // Every route but three answers 403 while this is set, so rendering the screen would
    // put a shell around a page of failed requests (P3.6-T4). One redirect here covers
    // every screen, rather than each one inferring it from a 403 of its own.
    else if (!loading && me?.mustChangePassword) router.replace('/choose-a-password');
  }, [loading, me, router]);

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (!me || me.mustChangePassword) return null;

  /*
   * **The refusal names no permission code** (P11-T6, ADR-0062 §3). It said *"This screen needs
   * the `kpm:list_all` permission"*: our vocabulary, which a customer can do nothing with, and the
   * one place a code reached a screen. The code stays on the element as data, where a test and a
   * support engineer can read it and nobody is shown it; `no-permission-code-in-copy.spec.ts` keeps
   * it out of the copy.
   *
   * **Nor any of ADR-0084's six words.** Coaching's screens show this refusal, and rule 2 holds a
   * refusal a coaching screen shows to none of them: it ended *"ask whoever administers your
   * office"*. Said without the word, it settles nothing for the rest of the product (OD-39).
   */
  if (permission && !me.permissions.includes(permission)) {
    return (
      <div role="alert" data-permission={permission} className="px-5 py-10">
        <Heading className="font-display text-xl font-bold text-navy">Not available to you</Heading>
        <p className="mt-1 text-md text-muted">
          Your account does not have access to this screen. If you believe it should, ask
          whoever manages accounts where you work.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
