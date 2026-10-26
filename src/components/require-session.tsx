'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { landingFor } from '@/lib/landing';
import { useSession } from '@/lib/session';
import { signInPathFrom } from '@/lib/return-path';
import { familyAllows, type ShellFamily } from '@/lib/route-access';
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
  family,
  headingLevel,
  children,
}: {
  permission?: string;
  /**
   * **The application whose chrome this wraps** — passed by the three shells, never by a page (the product
   * owner's report, 2026-10-11). A reader who is not of it (`familyAllows`) is sent to their own landing, and
   * nothing but a skeleton renders meanwhile: an Agent who typed an office address was shown the Owner's
   * sidebar, because the tenant shell's own gate, `member:read_profile`, is every member's.
   */
  family?: ShellFamily;
  /**
   * The refusal's heading. By default an `<h1>`, or an `<h2>` under a page that already has its title
   * (`TitledPageContext`): a coachee's tab refused inside the person shell, whose page is titled
   * *Coaching Session*, is one heading below it, not a second title (P11-T7's review).
   */
  headingLevel?: 1 | 2;
  children: React.ReactNode;
}) {
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();
  const titled = useContext(TitledPageContext);
  const Heading = (headingLevel ?? (titled ? 2 : 1)) === 1 ? 'h1' : 'h2';
  const elsewhere = Boolean(me && family && !familyAllows(family, me));

  useEffect(() => {
    // Back to this page once signed in (`?next=`, `lib/return-path.ts`): a link opened signed out lands on it.
    // Not after the reader signed out themselves (2026-10-11): then this is the same plain `/login` the
    // sign-out goes to, so which of the two navigations lands last no longer decides where they end up. A session
    // that ended under the reader adds `reason=expired`, and the sign-in page says so (ADR-0168 §1).
    if (!loading && !me) router.replace(signInPathFrom(window.location, { signedOut, expired }));
    // Every route but three answers 403 while this is set, so rendering the screen would
    // put a shell around a page of failed requests (P3.6-T4). One redirect here covers
    // every screen, rather than each one inferring it from a 403 of its own.
    else if (!loading && me?.mustChangePassword) router.replace('/choose-a-password');
    // Before any permission is asked: a refusal inside another family's chrome is still that chrome. The
    // landing is always of the reader's own family, so this cannot send anybody round in a circle; and when
    // a support session starts or ends on a page of the other family, this is what takes them on.
    else if (!loading && me && elsewhere) router.replace(landingFor(me));
  }, [loading, me, signedOut, expired, elsewhere, router]);

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (!me || me.mustChangePassword) return null;

  // On the way to their own landing: the words the home page's hand-off uses, and no chrome at all.
  if (elsewhere) return <PageSkeleton label="Taking you to your work…" />;

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
    return <NotAvailableToYou permission={permission} headingLevel={Heading === 'h1' ? 1 : 2} />;
  }

  return <>{children}</>;
}

/**
 * **The refusal, on its own** — what `RequireSession` draws for a missing permission, and what a page draws for a
 * reader the server would refuse on a fact that is no permission: KPM analytics for a leader who is not a Core
 * Leader (ADR-0159 §2), who holds the grant and is answered 404. One set of words, so the two cannot differ.
 */
export function NotAvailableToYou({ permission, headingLevel = 1 }: { permission?: string; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
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
