'use client';

import { MyCoachingHeader } from '@/components/coaching-record';
import { Page } from '@/components/page';
import { MyTrainingRecord } from '@/components/training/person-training';

/**
 * The reader's own *Training* tab on their coaching (`/coaching/me/training`, `Overall.html:4569-4572`;
 * P18.5-T4 AC-3): their training in the coaching renderer's form, read-only, from the read their own
 * `/training` makes, so the two cannot disagree (AC-4). No audit entry: it is their own. Titled and gated
 * as `/coaching/me` is.
 */
export default function MyCoachingTrainingPage() {
  return (
    <Page title="Coaching Session" permission="coaching_session:read">
      <MyCoachingHeader current="training" />
      <MyTrainingRecord />
    </Page>
  );
}
