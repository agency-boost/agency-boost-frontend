'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { RouteTabs } from '@/components/ui/route-tabs';
import { PROTOTYPE_COPY } from '@/lib/kpm-analytics';

/**
 * **KPM Analytics** (`/kpm/analytics/*`; `KPM_Owner.html:1225-1229`, title `:2028`; P18-T2 AC-1): the title,
 * the sub-line and the two tabs, shared by *Overview* and *Compliance, Events, and Campaigns*.
 *
 * **The tabs are links, one route each**: the prototype's `.subtabs` switch a panel with no address
 * (`:1228-1229`), so here each is a link and the one the reader is on says so (`aria-current`) —
 * `RouteTabs`, the strip `/recruitment/*` uses.
 *
 * Gated by `kpm_analytics:read`, the Owner's and the Admin's (roles §3.9). The API answers the reader's
 * own office whatever this decides.
 */
export default function KpmAnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <Page title={PROTOTYPE_COPY.title} subtitle={PROTOTYPE_COPY.subtitle} permission="kpm_analytics:read">
      <RouteTabs
        label={PROTOTYPE_COPY.title}
        tabs={[
          { href: '/kpm/analytics', label: PROTOTYPE_COPY.tabOverview },
          { href: '/kpm/analytics/compliance', label: PROTOTYPE_COPY.tabCompliance },
        ]}
      />
      {children}
    </Page>
  );
}
