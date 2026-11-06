'use client';

import { Suspense } from 'react';
import { KpmAnalytics } from '@/components/analytics/kpm-analytics';
import { analyticsGroupFrom, analyticsPeriodFrom } from '@/lib/kpm-analytics';
import { useQuery } from '@/lib/use-query';

/**
 * KPM analytics' *Overview* (`kpm-analytics.md`; P18-T2, P19.3-T3): the KPM's totals, every leader — each AB and AAB,
 * opening their sheet — and *Monthly production*, over one read of the server's. The title and the tabs are the
 * layout's.
 *
 * The period is the address's, `?period=this_month|previous_month`, *This month* when it names none or one
 * the read does not know (the read would refuse it); and the custom group, `?group=` (P19.3-T3 AC-15, OD-258).
 */
export default function KpmAnalyticsPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <Overview />
    </Suspense>
  );
}

function Overview() {
  const query = useQuery();
  return <KpmAnalytics period={analyticsPeriodFrom(query.period)} group={analyticsGroupFrom(query.group)} />;
}
