'use client';

import { SurveyResultsScreen } from '@/components/surveys/survey-results';

/** ***Kualitatif*** — the KPM's qualitative runs and their results (P19.5-T4 AC-1, AC-4; ADR-0216 §2, §4). */
export default function AdvancedAnalyticsQualPage() {
  return <SurveyResultsScreen kind="qual" />;
}
