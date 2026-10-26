'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { landingFor } from '@/lib/landing';
import { signInPathFrom } from '@/lib/return-path';
import { useSession } from '@/lib/session';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * The landing. It has no content of its own — it sends each person to the surface that
 * is actually theirs, which is the only thing a shared root URL can honestly do in a
 * product with three role families.
 *
 * The rule itself lives in `lib/landing.ts`, where it can be read and tested without
 * running the app.
 */
export default function Home() {
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Nobody signed in: to sign in, by the helper every guard uses, so a session that ended says so — opening the
    // app at its root after the session ended is the commonest way to meet it (ADR-0168 §1). `/` carries no page.
    router.replace(me ? landingFor(me) : signInPathFrom(window.location, { signedOut, expired }));
  }, [loading, me, signedOut, expired, router]);

  // Always a hand-off. Rendering content here as well would mean two screens claiming to
  // be home, and which one you saw would depend on how fast the redirect ran.
  return <PageSkeleton label="Taking you to your work…" />;
}
