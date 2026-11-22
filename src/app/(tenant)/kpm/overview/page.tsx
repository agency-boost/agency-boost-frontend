'use client';

import { Page } from '@/components/page';
import { KpmOverview } from '@/components/overview/kpm-overview';

/**
 * **The KPM Overview, second version** (P19.19; ADR-0272): where the Owner, the Admins and core leaders land — usage
 * first, then compliance, then results, in six sections over three reads (`components/overview/kpm-overview.tsx`).
 *
 * Gated by `kpm_overview:read`, the KPM's stewards' (roles §3.9, ADR-0268 §1): the Owner, an Admin, a core leader and the
 * Super Admin inside the KPM. The title and the office's sub-line are drawn by the body, which holds the read the
 * sub-line comes from.
 */
export default function KpmOverviewPage() {
  return (
    <Page permission="kpm_overview:read">
      <KpmOverview />
    </Page>
  );
}
