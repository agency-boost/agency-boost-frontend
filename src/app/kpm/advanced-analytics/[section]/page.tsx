'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { SectionBody, useShellOfPage } from '@/components/advanced-analytics/advanced-analytics-screen';
import { SectionLoading } from '@/components/advanced-analytics/shared';
import { isSectionSlug } from '@/lib/advanced-analytics-page';

/**
 * **`/kpm/advanced-analytics/[section]`** — *Demografi KPM*, *MAPA driver*, *Analitik kuantitatif*, *Perbaikan
 * sub-group* and *Event* (P19.5-T3; ADR-0215 §1). *NPS* and *Kualitatif* have their own routes (P19.5-T4). **A section
 * the template has off goes to the first that is on** (AC-11); its read would answer 404, and its data is kept.
 */
export default function AdvancedAnalyticsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const shell = useShellOfPage();
  const router = useRouter();
  const on = shell !== null && isSectionSlug(section) && shell.sections.some((s) => s.slug === section);
  const first = shell?.sections[0]?.slug;
  useEffect(() => {
    if (shell && !on && first) router.replace(`/kpm/advanced-analytics/${first}`);
  }, [shell, on, first, router]);
  if (!shell || !on || !isSectionSlug(section)) return <SectionLoading />;
  return <SectionBody slug={section} shell={shell} />;
}
