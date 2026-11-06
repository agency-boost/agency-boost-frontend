'use client';

import type { ReactNode } from 'react';
import {
  SectionTabs, ShellProvider, ShellState, useAdvancedAnalyticsShell,
} from '@/components/advanced-analytics/advanced-analytics-screen';
import { NotAvailableToYou } from '@/components/require-session';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { surveyMessages } from '@/i18n/messages/surveys';
import { readsOfficeAnalytics } from '@/lib/route-access';
import { useSession } from '@/lib/session';

/**
 * ***Advanced analytics*** (`/kpm/advanced-analytics/*`; P19.5-T3, with T4's survey tabs): the title, **the template's
 * sections that are on, in its order, then *Event*** (ADR-0215 §1; `GET /kpm/advanced-analytics`), the template-version
 * notice, and the section below.
 *
 * **In the reader's own shell**, as KPM analytics is (ADR-0159 §3): the Owner and the Admins, and a **Core Leader** in
 * the field shell. Gated by `advanced_analytics:read` (roles §3.9); an AB or an AAB who is not a Core Leader is drawn
 * *Not available to you* here without asking the API, which answers them 404 in any case (§3.9 ¶). The title is kept
 * English in both languages (§A.1); the tab names are the reader's.
 */
export default function AdvancedAnalyticsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(surveyMessages);
  const { me } = useSession();
  const allowed = me !== null && me !== undefined && readsOfficeAnalytics(me);
  return (
    <RoleShell title={t.kpm.title} permission="advanced_analytics:read">
      {me && !readsOfficeAnalytics(me) ? <NotAvailableToYou headingLevel={2} /> : allowed ? <Sections>{children}</Sections> : null}
    </RoleShell>
  );
}

/** The shell read once, its tabs, and the section below — which reads the shell from the context. */
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
