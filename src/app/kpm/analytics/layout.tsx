'use client';

import type { ReactNode } from 'react';
import { NotAvailableToYou } from '@/components/require-session';
import { RoleShell } from '@/components/role-shell';
import { RouteTabs } from '@/components/ui/route-tabs';
import { useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { readsOfficeAnalytics } from '@/lib/route-access';
import { useSession } from '@/lib/session';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';

/**
 * **KPM Analytics** (`/kpm/analytics/*`; `KPM_Owner.html:1225-1229`, title `:2028`; P18-T2 AC-1): the title,
 * the sub-line and the two tabs, shared by *Overview* and *Compliance, Events, and Campaigns*.
 *
 * **The tabs are links, one route each**: the prototype's `.subtabs` switch a panel with no address
 * (`:1228-1229`), so here each is a link and the one the reader is on says so (`aria-current`) —
 * `RouteTabs`, the strip `/recruitment/*` uses.
 *
 * **In the reader's own shell** (ADR-0159 §3, P18.8-T5 AC-5): the Owner and the Admins read it in the console, and a
 * **Core Leader** — an AB or an AAB tagged *Core Leader* — in the field shell, from its *Core leader* group. So the
 * route sits outside every route group and wears `RoleShell`, as `/leader-meetings` does; it moved out of `(tenant)`,
 * whose shell admits the office's admins alone. Gated by `kpm_analytics:read` (roles §3.9), which the AB and AAB hold
 * for this; one who is not a Core Leader is drawn *Not available to you* here without asking the API, which answers
 * them 404 in any case (§3.9 ¶). The API answers the reader's own office whatever this decides.
 *
 * The office's configuration is read once here for the pages beneath, as the two group layouts read it. The title and
 * the tabs are names, kept English in both languages (§A.2, §A.3); the sub-line is the reader's (P18.98-T4).
 */
export default function KpmAnalyticsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(kpmAnalyticsMessages);
  return (
    <TenantConfigProvider>
      <RoleShell title={t.title} subtitle={t.subtitle} permission="kpm_analytics:read">
        <OfficeAnalyticsReader>
          <RouteTabs
            label={t.title}
            tabs={[
              { href: '/kpm/analytics', label: t.tabOverview },
              { href: '/kpm/analytics/compliance', label: t.tabCompliance },
            ]}
          />
          {children}
        </OfficeAnalyticsReader>
      </RoleShell>
    </TenantConfigProvider>
  );
}

/** The Owner, an Admin or a Core Leader reads on; anybody else meets the denied state and no read is made. */
function OfficeAnalyticsReader({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (me && !readsOfficeAnalytics(me)) return <NotAvailableToYou headingLevel={2} />;
  return <>{children}</>;
}
