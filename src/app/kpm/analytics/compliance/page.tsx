'use client';

import { Suspense } from 'react';
import { ComplianceScreen } from '@/components/analytics/compliance-screen';
import { complianceSelectionFrom } from '@/lib/kpm-compliance';
import { useQuery } from '@/lib/use-query';

/**
 * KPM analytics' *Compliance, Events, and Campaigns* (`KPM_Owner.html:1262-1286`, `:3449-4118`; P18.6-T1,
 * P18.6-T2; `kpm-analytics.md`, *Compliance*): six chips, the chosen category's tabs or picker, and every AB's
 * agency with a status per person, over one read of the server's. The title, the sub-line and the tabs are the
 * layout's, which also refuses a reader without `kpm_analytics:read` (*Not available to you*).
 *
 * The selection is the address's, `?category=&item=`: *Training* and its first module when it names none, and
 * an item only where the category has items to choose from (the read would refuse one anywhere else).
 */
export default function KpmAnalyticsCompliancePage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <Compliance />
    </Suspense>
  );
}

function Compliance() {
  return <ComplianceScreen selection={complianceSelectionFrom(useQuery())} />;
}
