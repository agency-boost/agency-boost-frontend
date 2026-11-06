'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useShellOfPage } from '@/components/advanced-analytics/advanced-analytics-screen';
import { SectionLoading } from '@/components/advanced-analytics/shared';

/**
 * **`/kpm/advanced-analytics` opens the first section that is on** (P19.5-T3 AC-1; ADR-0215 §1): the template's first,
 * or *Event*, which no template switches off. The menu's *Advanced analytics* leads here.
 */
export default function AdvancedAnalyticsIndexPage() {
  const shell = useShellOfPage();
  const router = useRouter();
  const first = shell?.sections[0]?.slug;
  useEffect(() => {
    if (first) router.replace(`/kpm/advanced-analytics/${first}`);
  }, [first, router]);
  return <SectionLoading />;
}
