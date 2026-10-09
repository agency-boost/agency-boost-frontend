'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { RouteTabs } from '@/components/ui/route-tabs';
import { ATTACK_PLAN_HREF, OWN_COPY, PITCH_MATERIALS_HREF, PROTOTYPE_COPY } from '@/lib/recruitment';

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
  return (
    <Page title={PROTOTYPE_COPY.title} subtitle={PROTOTYPE_COPY.subtitle} permission="recruitment:read">
      <RouteTabs
        label={OWN_COPY.tabs}
        tabs={[
          { href: ATTACK_PLAN_HREF, label: PROTOTYPE_COPY.tabAttackPlan },
          { href: PITCH_MATERIALS_HREF, label: PROTOTYPE_COPY.tabPitchMaterials },
        ]}
      />
      {children}
    </Page>
  );
}
