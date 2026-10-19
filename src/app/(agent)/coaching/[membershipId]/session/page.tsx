'use client';

import { use } from 'react';
import { useCoachee } from '@/components/coaching-person';
import { SessionWorkspace } from '@/components/coaching-session';

type Query = { session?: string | string[] };

/**
 * A person's *Coaching Session* tab (`Overall.html:4167-4319`, P11-T8), where the roster's *Coaching
 * →* lands (`:10661`): the 1-on-1 itself — last week's items, the goal, the ratios, the last 7 days,
 * the leads, the tips and the next actions, kept as a draft until the leader finalizes it.
 *
 * The person shell above has already read who this is, and answered an address outside the reader's
 * reach with its not-found state; the workspace takes the person from it (`useCoachee`). Keyed by the
 * person and the session asked for, so moving to somebody else's page starts from their session,
 * never the last one's.
 *
 * `?session=` opens one session rather than the one the server would open on (P11-T10): the
 * correction the archive's *Edit again* started, beside a draft that would otherwise win.
 */
export default function CoachingSessionTabPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const coachee = useCoachee();
  const query = searchParams ? use(searchParams) : {};
  const opening = typeof query.session === 'string' && query.session ? query.session : undefined;
  return <SessionWorkspace key={`${coachee.membershipId}:${opening ?? ''}`} coachee={coachee} opening={opening} />;
}
