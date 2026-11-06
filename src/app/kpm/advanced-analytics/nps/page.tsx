'use client';

import { SurveyResultsScreen } from '@/components/surveys/survey-results';

/** ***NPS*** — the KPM's NPS runs and their results (P19.5-T4 AC-1 to AC-3; ADR-0216 §2, §4). */
export default function AdvancedAnalyticsNpsPage() {
  return <SurveyResultsScreen kind="nps" />;
}
