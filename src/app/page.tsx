'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { landingFor } from '@/lib/landing';
import { useSession } from '@/lib/session';

/**
 * The landing. It has no content of its own — it sends each person to the surface that
 * is actually theirs, which is the only thing a shared root URL can honestly do in a
 * product with three role families.
 *
 * The rule itself lives in `lib/landing.ts`, where it can be read and tested without
 * running the app.
 */
export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(landingFor(me));
  }, [loading, me, router]);

  // Always a hand-off. Rendering content here as well would mean two screens claiming to
  // be home, and which one you saw would depend on how fast the redirect ran.
  return (
    <p role="status" className="px-5 py-10 text-md text-muted">
      Loading…
    </p>
  );
}
