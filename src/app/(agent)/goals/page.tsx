'use client';

import { GoalCalculator } from '@/components/goal-calculator';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { goalsMessages } from '@/i18n/messages/goals';

/**
 * Goal Settings (P8-T3) — `Overall.html:2860-3030`: the reader's own plan.
 *
 * **The calculator is `GoalCalculator`** (P11-T7 AC-5): the same five cards and commitment are a
 * coachee's *Goal Setting* tab, with that person as their subject. This page renders it with none, so
 * it reads and saves the reader's own plan, in their own voice.
 *
 * **Whose plan, no longer a picker** (P11-T7 AC-6, D-picker). Until coaching existed, a leader set a
 * downline's plan here by picking them from *Whose plan* (L-30), a stand-in the prototype does not
 * have. Each coachee's *Goal Setting* tab now does that with the leader's name on the save, so this
 * screen returns to the reader's own plan, as the prototype's is.
 *
 * **Its words are the catalogue's** (P18.98-T4; `i18n/messages/goals.tsx`): the title, kept English (§A.2), and the
 * prototype's line (`Overall.html:10405`, verbatim in English), in the reader's language.
 */
export default function GoalSettingsPage() {
  const t = useMessages(goalsMessages);
  /*
   * v1 is annual (ADR-0049), so there is no selector — and `period` is a **field** on the record
   * rather than a constant, which is where a second shape would arrive without a migration.
   */
  const period = String(new Date().getFullYear());

  return (
    <Page title={t.title} subtitle={t.subtitle} permission="goal:read">
      <GoalCalculator period={period} />
    </Page>
  );
}
