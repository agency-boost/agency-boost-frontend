'use client';

import { CoachingSurveyTab } from '@/components/surveys/coaching-survey';

/**
 * A coachee's ***Survei*** tab (P19.5-T4; ADR-0216 §7; `coaching-survey-results-2026-11-02.html`): their latest
 * qualitative survey's answers, when the run allows it. The person shell above has already answered an address outside
 * the reader's reach; the API checks the reader's line and the run's flags again, and never sends Q12.
 */
export default function CoacheeSurveyTab() {
  return <CoachingSurveyTab />;
}
