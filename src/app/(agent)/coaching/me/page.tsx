'use client';

import { Suspense } from 'react';
import { MyCoaching } from '@/components/coaching-record';
import { Page } from '@/components/page';
import { useQuery } from '@/lib/use-query';

/**
 * The reader's own coaching (`/coaching/me`, `Overall.html:4384-4600`; ADR-0078, P11-T10): the
 * finalized sessions about them, read-only, opened on the latest or on the one the address names — the
 * finalize notice's `?session=` (AC-8). Every coachee reads it, an Agent included; a leader reaches it
 * from the roster's *My Coaching Notes* (`:3958`).
 *
 * Titled as the prototype titles every coaching view, *Coaching Session*, with its empty sub-line
 * (`:10407`). Gated as the roster is, by `coaching_session:read`; the API answers only what is the
 * reader's own whatever this decides.
 */
export default function MyCoachingPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <MyCoachingNotes />
    </Suspense>
  );
}

function MyCoachingNotes() {
  const query = useQuery();
  const selected = typeof query.session === 'string' && query.session ? query.session : undefined;
  return (
    <Page title="Coaching Session" permission="coaching_session:read">
      <MyCoaching selected={selected} />
    </Page>
  );
}
