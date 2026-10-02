'use client';

import { LeaderNotesTab } from '@/components/coaching-leader-notes';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';

/**
 * A coachee's *🔒 Leader Notes* tab (`Overall.html:4344-4382`, P11-T9): where they stand on the
 * capability ladder, the skills their coaches track, and the reader's own notes about them, which they
 * never see.
 *
 * The person shell above has already read who this is, and answered an address outside the reader's
 * reach with its not-found state; the tab takes the person from it (`useCoachee`). Gated on
 * `coaching_profile:read` inside the shell's own gate — a coach's grant; the notes inside it ask for
 * their own. Keyed by the person, so moving to somebody else's page reads theirs, never keeps the last
 * one's. *Agent view* unmounts it, and what it read goes with it.
 */
export default function CoacheeLeaderNotesTab() {
  const coachee = useCoachee();
  return (
    <Page permission="coaching_profile:read">
      <LeaderNotesTab key={coachee.membershipId} coachee={coachee} />
    </Page>
  );
}
