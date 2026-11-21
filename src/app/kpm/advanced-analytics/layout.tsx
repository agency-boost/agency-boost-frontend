'use client';

import type { ReactNode } from 'react';
import {
  SectionTabs, ShellProvider, ShellState, useAdvancedAnalyticsShell,
} from '@/components/advanced-analytics/advanced-analytics-screen';
import { NotAvailableToYou } from '@/components/require-session';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { readsOfficeAnalytics } from '@/lib/route-access';
import { useSession } from '@/lib/session';

/**
 * ***Advanced analytics*** (`/kpm/advanced-analytics/*`; P19.5-T3, P19.22-T1): the title, **the seven tabs in the fixed
 * order** *Demografi · MAPA driver · NPS · Kuantitatif · Kualitatif · Informal group · Event* (ADR-0275 §1; `GET
 * /kpm/advanced-analytics`), and the section below. *Changed 2026-11-20:* no template-version notice (parity I-1160).
 *
 * **In the reader's own shell**, as KPM analytics is (ADR-0159 §3): the Owner and the Admins, and a **Core Leader** in
 * the field shell. Gated by `advanced_analytics:read` (roles §3.9); an AB or an AAB who is not a Core Leader is drawn
 * *Not available to you* here without asking the API, which answers them 404 in any case (§3.9 ¶). The title is kept
 * English in both languages (§A.1); the tab names are the reader's.
 */
export default function AdvancedAnalyticsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const { me } = useSession();
  const allowed = me !== null && me !== undefined && readsOfficeAnalytics(me);
  return (
    <RoleShell title={t.title} permission="advanced_analytics:read">
      {me && !readsOfficeAnalytics(me) ? <NotAvailableToYou headingLevel={2} /> : allowed ? <Sections>{children}</Sections> : null}
    </RoleShell>
  );
}

/** The shell read once, its tab bar, and the section below — which reads the shell from the context. */
function Sections({ children }: { children: ReactNode }) {
  const { shell, error } = useAdvancedAnalyticsShell();
  return (
    <ShellState error={error}>
      {shell && (
        <ShellProvider value={shell}>
          <SectionTabs shell={shell} hrefOf={(slug) => `/kpm/advanced-analytics/${slug}`} />
          {children}
        </ShellProvider>
      )}
    </ShellState>
  );
}
