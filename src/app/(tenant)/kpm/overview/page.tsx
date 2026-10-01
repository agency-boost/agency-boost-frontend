'use client';

import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';

/**
 * Where a KPM Owner and a KPM Admin land, and a sign until the overview is built.
 *
 * The prototype's overview is five sections and nothing else (`KPM_Owner.html:937-1222`): Team
 * composition, Engagement over the last 7 days, Coaching coverage, Recruitment pipeline and
 * Production this year. None of them is built, so **the whole page is the placeholder**, which is
 * what the client asked for on 2026-10-01: a screen that is not ready says it is upcoming, as the
 * nav's unbuilt items do (`KPM_Owner.html:882`), rather than showing pieces of something else.
 *
 * It used to carry two cards the prototype has no counterpart for (X-38): the office's time zone and
 * currency, which Branch info already shows read-only, and the settings provisioning seeded, listed
 * under their internal names beneath copy that named a phase. Together they made a sign look like a
 * built screen.
 *
 * **It imports only what `scripts/lib/screens.py` allows a placeholder.** That is how the docs and
 * tenancy gates know it renders no data and calls no endpoint; one data import and they treat it as a
 * shipped screen again.
 */
export default function KpmOverviewPage() {
  return (
    // The prototype's title, verbatim (`KPM_Owner.html:932`). Its sub-line is the office's name, which a
    // sign may not fetch, so there is none rather than one the prototype lacks.
    <Page title="KPM Overview">
      <ComingInPhase
        // The prototype's five section heads, in the reader's words, and no figure of any kind, so
        // nothing on the sign can be mistaken for one of the office's.
        what="Team composition, engagement, coaching coverage, the recruitment pipeline and this year’s production for the whole office, on one screen."
        // Screens both an Owner and an Admin reach: the tenant shell gives both of them all three,
        // and `data_upload:read` and `kpm:read_profile` are granted to both (roles-and-permissions §3).
        elsewhere={[
          {
            href: '/people/members',
            label: 'All members',
            detail: 'The roster: who is here, their role, and who they report to.',
          },
          {
            href: '/kpm/data-upload',
            label: 'Data upload',
            detail: 'Each month’s figures for every agent, from one file matched by agent code.',
          },
          {
            href: '/kpm/settings/branch-info',
            label: 'Branch info',
            detail: 'Your office’s name, address and contact phone.',
          },
        ]}
      />
    </Page>
  );
}
