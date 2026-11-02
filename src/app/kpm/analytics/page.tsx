'use client';

import { Suspense } from 'react';
import { KpmAnalytics } from '@/components/analytics/kpm-analytics';
import { analyticsPeriodFrom } from '@/lib/kpm-analytics';
import { useQuery } from '@/lib/use-query';

/**
 * KPM analytics' *Overview* (`KPM_Owner.html:1233-1260`, `kpm-analytics.md`; P18-T2): *Unit comparison* —
 * one row per AB agency with its *(Direct)* and AAB rows, MOC and the club badges — and *Monthly
 * production*, over one read of the server's. The title, the sub-line and the tabs are the layout's.
 *
 * The period is the address's, `?period=this_month|previous_month`, *This month* when it names none or one
 * the read does not know (the read would refuse it).
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
  return <KpmAnalytics period={analyticsPeriodFrom(useQuery().period)} />;
}
