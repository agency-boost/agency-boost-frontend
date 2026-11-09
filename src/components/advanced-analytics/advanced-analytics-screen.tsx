'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { SurveyResultsScreen } from '@/components/surveys/survey-results';
import { RouteTabs } from '@/components/ui/route-tabs';
import { useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { surveyMessages } from '@/i18n/messages/surveys';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readShell, type SectionSlug, type Shell } from '@/lib/advanced-analytics-page';
import { DemographicsSection } from './demographics-section';
import { EventsSection } from './events-section';
import { MapaSection } from './mapa-section';
import { QuantSection } from './quant-section';
import { SectionError, SectionLoading, TemplateVersionNotice } from './shared';
import { SubgroupSection } from './subgroup-section';

/** The shell read, once per page, shared by the tabs and the section below them. */
export function useAdvancedAnalyticsShell(platformKpmId?: string): { shell: Shell | null; error: ApiError | null } {
  const [shell, setShell] = useState<Shell | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    let live = true;
    readShell(platformKpmId)
      .then((answer) => { if (live) setShell(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [platformKpmId]);
  return { shell, error };
}

const ShellContext = createContext<Shell | null>(null);
export const ShellProvider = ShellContext.Provider;
/** The page's shell, from the layout that read it; `null` while it is read. */
export const useShellOfPage = () => useContext(ShellContext);

/** A section's name on its tab: the template's own words, the survey tabs' from the surveys' catalogue. */
export function useSectionLabel(): (slug: SectionSlug) => string {
  const t = useMessages(advancedAnalyticsPageMessages).sections;
  const s = useMessages(surveyMessages).kpm.tabs;
  return (slug) => (slug === 'nps' ? s.nps : slug === 'qual' ? s.qual : t[slug]);
}

/**
 * **The tabs: the template's sections that are on, in its order, then *Event*** (P19.5-T3 AC-1, AC-11; ADR-0215 §1),
 * and the template-version notice under them. A section turned off has no tab; turned on again, it is back with its
 * earlier results. On a phone the row scrolls sideways (`RouteTabs`).
 */
export function SectionTabs({ shell, hrefOf, activeHref }: {
  shell: Shell;
  hrefOf: (slug: SectionSlug) => string;
  activeHref?: string;
}) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const label = useSectionLabel();
  return (
    <>
      <RouteTabs
        label={t.tabs}
        activeHref={activeHref}
        tabs={shell.sections.map((s) => ({ href: hrefOf(s.slug), label: label(s.slug) }))}
        className="mb-3"
      />
      <TemplateVersionNotice>
        {t.templateNotice({ name: shell.templateName ?? t.platformTemplate, version: shell.version })}
      </TemplateVersionNotice>
    </>
  );
}

/** **One section's screen**, the KPM's own or — with `platformKpmId` — a KPM's for the Super Admin, read-only. */
export function SectionBody({ slug, shell, platformKpmId }: { slug: SectionSlug; shell: Shell; platformKpmId?: string }) {
  const canUpload = shell.canUpload && platformKpmId === undefined;
  switch (slug) {
    case 'demographics': return <DemographicsSection platformKpmId={platformKpmId} canUpload={canUpload} />;
    case 'mapa': return <MapaSection platformKpmId={platformKpmId} canUpload={canUpload} />;
    case 'quant': return <QuantSection platformKpmId={platformKpmId} />;
    case 'subgroup': return <SubgroupSection platformKpmId={platformKpmId} canUpload={canUpload} />;
    case 'events': return <EventsSection platformKpmId={platformKpmId} />;
    case 'nps': return <SurveyResultsScreen kind="nps" platformKpmId={platformKpmId} />;
    case 'qual': return <SurveyResultsScreen kind="qual" platformKpmId={platformKpmId} />;
  }
}

/** The shell's read failed, or waits: what the page draws in its place. */
export function ShellState({ error, children }: { error: ApiError | null; children: ReactNode }) {
  if (error) return <SectionError error={error} />;
  return <>{children ?? <SectionLoading />}</>;
}
