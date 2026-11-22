'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTabRow } from '@/components/ui/use-tab-row';
import { useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readShell, type SectionSlug, type Shell } from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { SectionError, SectionLoading } from './shared';

/*
 * **Each section's screen loads when its tab is opened** (the 200 kB first-load budget; `performance-and-scale.md`): one
 * tab is on the page at a time, and the four data tabs and the two survey screens are each heavier than the bar.
 */
const loading = () => <SectionLoading />;
const DemographicsSection = dynamic(() => import('./demographics-section').then((m) => m.DemographicsSection), { ssr: false, loading });
const MapaSection = dynamic(() => import('./mapa-section').then((m) => m.MapaSection), { ssr: false, loading });
const QuantSection = dynamic(() => import('./quant-section').then((m) => m.QuantSection), { ssr: false, loading });
const SubgroupSection = dynamic(() => import('./subgroup-section').then((m) => m.SubgroupSection), { ssr: false, loading });
const EventsSection = dynamic(() => import('./events-section').then((m) => m.EventsSection), { ssr: false, loading });
const SurveyResultsScreen = dynamic(() => import('@/components/surveys/survey-results').then((m) => m.SurveyResultsScreen), { ssr: false, loading });

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

/** A section's short name on its tab (P19.22-T1 AC-1): *Demografi · MAPA driver · NPS · Kuantitatif · Kualitatif · …*. */
export function useSectionLabel(): (slug: SectionSlug) => string {
  const t = useMessages(advancedAnalyticsPageMessages).tabLabels;
  return (slug) => t[slug];
}

/**
 * **The tab bar** (P19.22-T1; ADR-0275 §1; the brief of 19 November, *Advanced analytics, redone*): the seven tabs in the
 * fixed order, **short labels sized to their text** (padding 0 18px, 14px), **spread evenly** across a white bar, the
 * current one a navy pill. Links in a `nav`, the current one `aria-current` — they change the address. **On a phone the
 * bar scrolls sideways** inside itself, fading on the side that has more, the current tab brought into view; the page
 * never scrolls sideways. A tab the template has off is not drawn.
 *
 * *Changed 2026-11-20 (P19.22-T1):* the template-version notice under the tabs is gone — the brief's *no grey
 * explanation lines* (parity I-1160).
 */
export function SectionTabs({ shell, hrefOf, activeHref }: {
  shell: Shell;
  hrefOf: (slug: SectionSlug) => string;
  activeHref?: string;
}) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const label = useSectionLabel();
  const pathname = usePathname();
  const current = activeHref ?? pathname;
  const row = useTabRow<HTMLElement>(current);
  return (
    <nav
      ref={row.ref}
      aria-label={t.tabs}
      data-fade={row.fade}
      data-analytics-tabs=""
      className="mb-3 flex flex-nowrap gap-1 overflow-x-auto rounded-pill bg-card p-1 md:justify-between"
    >
      {shell.sections.map((s) => {
        const href = hrefOf(s.slug);
        const on = href === current;
        return (
          <Link
            key={s.slug}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-pill px-[18px] text-md font-semibold',
              'focus-visible:[outline-offset:-2px]',
              on ? 'bg-secondary text-secondary-contrast' : 'text-ink lg:hover:bg-hover-row',
            )}
          >
            {label(s.slug)}
          </Link>
        );
      })}
    </nav>
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
