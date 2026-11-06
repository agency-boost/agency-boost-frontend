'use client';

import { useState } from 'react';
import type { CompanyTemplate } from '@/lib/admin';
import type { AdvancedAnalyticsConfig } from '@/lib/advanced-analytics';
import { cn } from '@/lib/cn';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';
import { ContentLanguage, type AnalyticsTabProps } from './analytics-shared';
import { AnalyticsSectionsTab } from './analytics-sections-tab';
import { AnalyticsUploadTab } from './analytics-upload-tab';
import { AnalyticsSurveyTab } from './analytics-survey-tab';
import { AnalyticsThresholdsTab } from './analytics-thresholds-tab';

export type AnalyticsHalf = 'sections' | 'upload' | 'surveys' | 'thresholds';

/**
 * **The template's *Advanced analytics* section, one tab at a time** (P19.5-T1 AC-1; ADR-0214 §1): *Bagian* · *Data
 * upload* · *Survei* · *Ambang & benchmark*, the pills the section page draws, each a half of the one payload saved as it
 * is made. The **ID | EN switch** (spec §1, the mockup's `setLang`) chooses which language the template's own words are
 * shown in — a column's name, a question, the CSV preview — starting from the reader's; the screen's own words follow
 * the app's language as everywhere else.
 */
export function AnalyticsEditor({
  half,
  view,
  payload,
  onChange,
  disabled,
  companyId,
  templateId,
}: {
  half: AnalyticsHalf;
  view: CompanyTemplate;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
  companyId: string;
  templateId: string;
}) {
  const t = useMessages(adminTemplateAnalyticsMessages);
  const reader = useLanguage();
  const [language, setLanguage] = useState<'id' | 'en'>(reader === 'en' ? 'en' : 'id');
  const config = payload as unknown as AdvancedAnalyticsConfig;
  if (!Array.isArray(config.uploadFields) || !Array.isArray(config.sections)) return null;
  const props: AnalyticsTabProps = {
    config,
    view: view.analytics ?? null,
    published: (view.published?.payload as unknown as AdvancedAnalyticsConfig | undefined) ?? null,
    onChange: (next) => onChange(next as unknown as Record<string, unknown>),
    disabled,
    companyId,
    templateId,
  };
  return (
    <ContentLanguage.Provider value={language}>
      <div className="mb-3 flex justify-end">
        <div role="group" aria-label={t.language} className="flex overflow-hidden rounded-md border border-hairline bg-card">
          {(['id', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              aria-pressed={language === lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'min-h-11 px-3.5 text-sm font-semibold md:min-h-9',
                language === lang ? 'bg-secondary text-secondary-contrast' : 'text-navy hover:bg-hover-row',
              )}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {half === 'sections' && <AnalyticsSectionsTab {...props} />}
      {half === 'upload' && <AnalyticsUploadTab {...props} />}
      {half === 'surveys' && <AnalyticsSurveyTab {...props} />}
      {half === 'thresholds' && <AnalyticsThresholdsTab {...props} />}
    </ContentLanguage.Provider>
  );
}
