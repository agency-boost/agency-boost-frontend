'use client';

import { use } from 'react';
import { ComingInPhase } from '@/components/coming-in-phase';

/**
 * A coachee's *Training* tab (`Overall.html:4330-4335`), not built yet: it reads the training modules
 * this person has finished, which nothing records yet. The bar draws the tab disabled (P11-T7 AC-7);
 * this is what a typed or remembered address lands on, inside the person shell, rather than on the
 * not-found page. Which task builds it is the route registry's to say, not this page's (ADR-0062 §3).
 *
 * A sign renders no data and calls no endpoint (`backend-then-frontend.md`). The person shell above
 * has already answered an address outside the reader's reach, so the one thing it reads from the
 * address is where this person's Summary tab is — what works for the reader here.
 */
export default function CoacheeTrainingTab({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  return (
    <ComingInPhase
      what="Which training this person has finished, and what is still to do, category by category."
      elsewhere={[
        {
          href: `/coaching/${encodeURIComponent(membershipId)}/summary`,
          label: 'Personal Summary',
          detail: 'Their goal, activity and leads on one page.',
        },
      ]}
    />
  );
}
