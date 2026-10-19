'use client';

import { Page } from '@/components/page';
import { KpmOverview } from '@/components/overview/kpm-overview';

/**
 * The KPM Overview (`KPM_Owner.html:929-1222`, P18-T1): where a KPM Owner and a KPM Admin land (OD-102),
 * the whole office in one scroll — Team composition, Engagement, Coaching coverage, Recruitment pipeline
 * and Production this year — over one read of the server's.
 *
 * Gated by `kpm_overview:read`, the Owner's and the Admin's (roles §3.9); the Super Admin holds it only
 * inside a support session, where the server answers as the member. The title and the office's sub-line are
 * drawn by the body, which holds the read the sub-line comes from.
 */
export default function KpmOverviewPage() {
  return (
    <Page permission="kpm_overview:read">
      <KpmOverview />
    </Page>
  );
}
