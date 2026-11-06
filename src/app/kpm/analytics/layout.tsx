'use client';

import { Suspense, type ReactNode } from 'react';
import { RouteSegments } from '@/components/analytics/route-segments';
import { SubtitleOnPhone } from '@/components/app-shell';
import { NotAvailableToYou } from '@/components/require-session';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { analyticsGroupFrom } from '@/lib/kpm-analytics';
import { readsOfficeAnalytics } from '@/lib/route-access';
import { useSession } from '@/lib/session';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import { useQuery } from '@/lib/use-query';

/**
 * **KPM Analytics** (`/kpm/analytics/*`; `KPM_Owner.html:1225-1229`, title `:2028`; P18-T2 AC-1): the title and the
 * two tabs, shared by *Overview* and *Compliance* (the sub-line went with P19.3-T3, below).
 *
 * **The tabs are links, one route each**: the prototype's `.subtabs` switch a panel with no address
 * (`:1228-1229`), so here each is a link and the one the reader is on says so (`aria-current`) —
 * `RouteTabs`, the strip `/recruitment/*` uses.
 *
 * **In the reader's own shell** (ADR-0159 §3, P18.5-T5 AC-5): the Owner and the Admins read it in the console, and a
 * **Core Leader** — an AB or an AAB tagged *Core Leader* — in the field shell, from its *Core leader* group. So the
 * route sits outside every route group and wears `RoleShell`, as `/leader-meetings` does; it moved out of `(tenant)`,
 * whose shell admits the office's admins alone. Gated by `kpm_analytics:read` (roles §3.9), which the AB and AAB hold
 * for this; one who is not a Core Leader is drawn *Not available to you* here without asking the API, which answers
 * them 404 in any case (§3.9 ¶). The API answers the reader's own office whatever this decides.
 *
 * The office's configuration is read once here for the pages beneath, as the two group layouts read it. The title and
 * the tabs are names, kept English in both languages (§A.2, §A.3); the sub-line is the reader's (P18.10-T4).
 */
export default function KpmAnalyticsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(kpmAnalyticsMessages);
  /*
   * **No sub-line, at any size** (P19.3-T3; UI-092's grey-text table, then UI-112 and the `kpm-leaders` mockups of
   * 3 November, which draw the title row alone): *"Perbandingan unit, kualifikasi klub, dan tren"* is gone for every
   * reader, where UI V1 kept it for the Owner and the Admins in the console.
   */
  return (
    <TenantConfigProvider>
      <SubtitleOnPhone.Provider value={false}>
        <RoleShell title={t.title} permission="kpm_analytics:read">
          <OfficeAnalyticsReader>
            <Suspense fallback={<AnalyticsTabs group={null} />}>
              <TabsWithGroup />
            </Suspense>
            {children}
          </OfficeAnalyticsReader>
        </RoleShell>
      </SubtitleOnPhone.Provider>
    </TenantConfigProvider>
  );
}

/** The tabs, carrying the address's custom group across (`?group=`): both tabs are over the same people (AC-15). */
function TabsWithGroup() {
  return <AnalyticsTabs group={analyticsGroupFrom(useQuery().group)} />;
}

/**
 * *Overview | Compliance* — **one segmented control at every size** (UI-109; the `kpm-leaders` mockups draw it on the
 * desktop's title row too): the second tab named *Compliance* (D-35), its content keeping Events and Campaigns.
 */
function AnalyticsTabs({ group }: { group: string | null }) {
  const t = useMessages(kpmAnalyticsMessages);
  const carry = group ? `?group=${encodeURIComponent(group)}` : '';
  const tabs = [
    { href: `/kpm/analytics${carry}`, label: t.tabOverview },
    { href: `/kpm/analytics/compliance${carry}`, label: t.tabCompliance },
  ];
  return <RouteSegments label={t.title} segments={tabs} className="lg:max-w-[320px]" />;
}

/** The Owner, an Admin or a Core Leader reads on; anybody else meets the denied state and no read is made. */
function OfficeAnalyticsReader({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (me && !readsOfficeAnalytics(me)) return <NotAvailableToYou headingLevel={2} />;
  return <>{children}</>;
}
