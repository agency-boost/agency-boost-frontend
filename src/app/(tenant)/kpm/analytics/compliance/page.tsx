'use client';

import { ComingInPhase } from '@/components/coming-in-phase';

/**
 * *Compliance, Events, and Campaigns* (`KPM_Owner.html:1262-1286`; P18-T2 AC-1, contradiction 23): a sign
 * until the training, events and campaigns it reads are built — they come last, after every other feature
 * (the product owner, 2026-10-08).
 *
 * The title, the sub-line and the tabs are the layout's, so the tab strip still says where the reader is
 * and how to get back. **It imports only what `scripts/lib/screens.py` allows a placeholder**: no figure,
 * no call, a sentence in the reader's words about what will be here, and two screens that work today.
 */
export default function KpmAnalyticsCompliancePage() {
  return (
    <ComingInPhase
      // The prototype's tab (`:1262-1286`): each agent's training modules, events and campaigns, by unit,
      // searchable and sorted worst first — in the reader's words, with no figure of any kind.
      what="Who in each unit has finished each training module, attended each event and joined each campaign — searchable by name, the people furthest behind first."
      // Both the Owner's and the Admin's: `kpm_analytics:read` and `member:read_profile` are granted to both.
      elsewhere={[
        {
          href: '/kpm/analytics',
          label: 'Overview',
          detail: 'Every AB’s agency side by side: production against target, coaching, active agents, leads, MOC and the clubs.',
        },
        {
          href: '/people/members',
          label: 'All members',
          detail: 'The roster: who is here, their role and their leader.',
        },
      ]}
    />
  );
}
