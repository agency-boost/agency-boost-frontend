'use client';

import { CoacheeTraining } from '@/components/training/person-training';

/**
 * A coachee's *Training* tab (`Overall.html:3991`, `:4331-4335`, renderer `:7663-7765`; P18.5-T4): their
 * training, category by category, read-only, from `GET /training/progress?for=` — the read the learner's
 * own list makes, so the coach and the learner read one record (AC-4). The person shell above has already
 * answered an address outside the reader's reach.
 */
export default function CoacheeTrainingTab() {
  return <CoacheeTraining />;
}
