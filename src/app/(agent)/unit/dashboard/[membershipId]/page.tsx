'use client';

import { Suspense, use } from 'react';
import { Page } from '@/components/page';
import { UnitDashboard } from '@/components/unit/unit-dashboard';
import { periodFrom } from '@/lib/unit-dashboard';
import { useQuery } from '@/lib/use-query';

/**
 * A unit below the reader (P15-T4 AC-2), `/unit/dashboard/[membershipId]`: the Group tree's drill into
 * somebody who leads. The same screen over that leader's unit, titled *"{name}'s Unit Dashboard"* so the
 * reader knows whose unit it is (the Owner console's own words, `KPM_Owner.html:2230`), which only the
 * read knows — so the screen draws its own title. Outside the reader's reach, the not-found state.
 */
export default function UnitBelowPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <UnitBelow membershipId={membershipId} />
    </Suspense>
  );
}

function UnitBelow({ membershipId }: { membershipId: string }) {
  const query = useQuery();
  return (
    <Page permission="unit_dashboard:read">
      <UnitDashboard key={membershipId} forId={membershipId} period={periodFrom(query.period)} />
    </Page>
  );
}
