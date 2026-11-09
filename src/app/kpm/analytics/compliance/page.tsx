'use client';

import { Suspense } from 'react';
import { ComplianceScreen } from '@/components/analytics/compliance-screen';
import { analyticsGroupFrom } from '@/lib/kpm-analytics';
import { complianceSelectionFrom } from '@/lib/kpm-compliance';
import { useQuery } from '@/lib/use-query';

/**
 * KPM analytics' *Compliance* (the content *Compliance, Events, and Campaigns*) (`KPM_Owner.html:1262-1286`, `:3449-4118`; P18.3-T1,
 * P18.3-T2; `kpm-analytics.md`, *Compliance*): six chips, the chosen category's tabs or picker, and every AB's
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
  const query = useQuery();
  // The custom group, `?group=` (P19.3-T3 AC-15, OD-258): the tree and the six counts over that group's people.
  return <ComplianceScreen selection={complianceSelectionFrom(query)} group={analyticsGroupFrom(query.group)} />;
}
