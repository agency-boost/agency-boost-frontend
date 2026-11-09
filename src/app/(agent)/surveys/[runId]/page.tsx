'use client';

import { use } from 'react';
import { Page } from '@/components/page';
import { SurveyFormScreen } from '@/components/surveys/survey-form';

/**
 * **`/surveys/[runId]`** (P19.5-T4; ADR-0216 §5): the form, one question a screen. No title row of its own — the
 * mockup's head is the form's (✕, *Tersimpan otomatis*, the run's name). The API answers an invitee and refuses
 * everybody else `404 SURVEY_NOT_INVITED`, which the screen shows as it shows any refusal.
 */
export default function SurveyFormPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  return (
    <Page>
      <SurveyFormScreen runId={runId} />
    </Page>
  );
}
