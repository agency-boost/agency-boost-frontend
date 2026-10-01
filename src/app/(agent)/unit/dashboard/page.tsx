'use client';

import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';

/**
 * A leader's roster (`Overall.html:3888-3949`, `unit-dashboard.md`), not built yet: it needs the
 * coaching record for its *Last 1:1* column and the unit rollups, so until then it is a sign. Which
 * phase builds it is the route registry's to say, not this page's (ADR-0062 §3).
 *
 * Its nav item is *Upcoming* like *Coaching session* beside it (`agent-shell.tsx`), so nobody is sent
 * here; a typed URL lands on the sign. What it offers instead is what a leader can already do for
 * their unit: see who is in it, follow up the unit's leads, answer requests to join it.
 */
export default function UnitDashboardPage() {
  return (
    // The prototype's title, verbatim, and its empty sub-line (`Overall.html:10410`).
    <Page title="Unit Dashboard">
      <ComingInPhase
        what="Everyone in your unit in one table — their goal, their activity against target, their ratios and when you last coached them."
        elsewhere={[
          {
            href: '/group-tree',
            label: 'Group tree',
            detail: 'Everyone who reports to you, and everyone below them, laid out by layer.',
          },
          {
            href: '/leads',
            label: 'Leads management',
            detail: 'Your own leads and your unit’s, with the next action on each.',
          },
          {
            href: '/user-management/pending',
            label: 'Pending Requests',
            detail: 'Agents asking to be tagged to you, to approve or decline.',
          },
          {
            href: '/profile',
            label: 'Your account',
            detail: 'Your name, pronoun and password.',
          },
        ]}
      />
    </Page>
  );
}
