'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { PlanTabs } from '@/components/plan/plan-tabs';
import { useMessages } from '@/i18n/language-provider';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import { ATTACK_PLAN_HREF, PITCH_MATERIALS_HREF } from '@/lib/recruitment';

/**
 * **Recruitment** (`/recruitment/*`; `AgencyBoost_Recruitment_Section.html:276-286`; P17-T3 AC-2): the
 * title, the sub-line and the two tabs, shared by *Attack Plan* and *Pitch Materials*.
 *
 * **The tabs are links, one route each** (D-urls): the prototype's are buttons switching a panel with no
 * current state (`:282-285`, contradiction 10), so here each is a link and the one the reader is on says so
 * (`aria-current`) — `RouteTabs`, the strip `/activity/*` uses.
 *
 * Gated by `recruitment:read`, every field member's — and the Owner's and the Admin's, through their field
 * view (ADR-0114). The API answers the reader's own company and office whatever this decides.
 */
export default function RecruitmentLayout({ children }: { children: ReactNode }) {
  const t = useMessages(recruitmentPlanMessages);
  return (
    // The sub-line is not drawn on a phone: the client's *Remove* (P18.95-T7 AC-1, grey text row 8).
    <Page title={t.title} subtitle={t.subtitle} subtitleOnPhone={false} permission="recruitment:read">
      {/* One segmented control on a phone (UI V1, UI-107), the underlined strip from 768px. */}
      <PlanTabs
        label={t.tabs}
        tabs={[
          { href: ATTACK_PLAN_HREF, label: t.tabAttackPlan },
          { href: PITCH_MATERIALS_HREF, label: t.tabPitchMaterials },
        ]}
      />
      {children}
    </Page>
  );
}
