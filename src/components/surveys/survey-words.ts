'use client';

import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { surveyMessages } from '@/i18n/messages/surveys';
import { formatShortDay } from '@/lib/format';
import { pairIn, periodLabel, type LabelPair, type SurveyKind } from '@/lib/surveys';

/**
 * **A survey's words, in the reader's language** (P19.5-T4): its name and period — *Survei NPS KPM Q4 2026*,
 * *Survei kualitatif Jun 2026* — a day as the mockups write it (*9 Nov*), and a label pair. The figures' language for
 * the dates, the reader's for the words (ADR-0179 §6).
 */
export function useSurveyWords() {
  const t = useMessages(surveyMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const period = (key: string) => periodLabel(key, t.semester, figures);
  return {
    t,
    language,
    period,
    name: (kind: SurveyKind, key: string) => `${t.name[kind]} ${period(key)}`,
    day: (day: string, year = false) => formatShortDay(day, { year }, figures),
    pair: (p: LabelPair | null | undefined) => pairIn(p, language),
  };
}
