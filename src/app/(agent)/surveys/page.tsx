'use client';

import { Page } from '@/components/page';
import { SurveyListScreen } from '@/components/surveys/survey-list';
import { useMessages } from '@/i18n/language-provider';
import { surveyMessages } from '@/i18n/messages/surveys';

/**
 * **`/surveys`** (P19.5-T4; C-R2; ADR-0216 §6): the *Survei* tile's page, every field role's (D-37). No gate of its own:
 * every tenant role holds `survey:respond`, and the API answers the reader's own invitations and nothing else.
 */
export default function SurveysPage() {
  const t = useMessages(surveyMessages);
  return (
    <Page title={t.title}>
      <SurveyListScreen />
    </Page>
  );
}
