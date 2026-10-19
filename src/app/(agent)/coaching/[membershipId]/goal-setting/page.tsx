'use client';

import { useCoachee } from '@/components/coaching-person';
import { GoalCalculator } from '@/components/goal-calculator';
import { Page } from '@/components/page';

/**
 * A coachee's *Goal Setting* tab (`Overall.html:4325-4328`, the tool `:5854-6104`; P11-T7 AC-5): the
 * `/goals` calculator with the coachee as its subject.
 *
 * Every read and the save go through `GET` / `PUT /goals/:period?for=`. The save is the coachee's
 * goal at once — there is no acceptance step (ADR-0046) — the record carries the leader's name, and
 * the coachee is told; their own `/goals` then says *Set by your leader*. The read carries no measured
 * rates for somebody else (D-rates), and nothing here draws them.
 *
 * **The period is the office's year**, not the browser's (`functional/coaching.md`, *Goal Setting*):
 * the year the coachee's Summary measures, so the footer's *"all three stay in sync"* holds across New
 * Year's Eve in another zone too. It is the person read's `today`, the office's calendar day, which the
 * shell above already holds: no read of its own. It read the whole roster for that one date until the
 * person read carried it (P11-T7's review).
 */
export default function CoacheeGoalSettingTab() {
  const coachee = useCoachee();
  return (
    <Page permission="goal:read">
      <GoalCalculator
        period={coachee.today.slice(0, 4)}
        subject={{ membershipId: coachee.membershipId, pronoun: coachee.pronoun }}
      />
    </Page>
  );
}
