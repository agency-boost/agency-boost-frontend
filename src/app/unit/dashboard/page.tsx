'use client';

import { ComingInPhase } from '@/components/coming-in-phase';
import { AgentShell } from '@/components/agent-shell';

/** A leader's landing. Built in Phase 13, once activity and coaching data exist. */
export default function UnitDashboardPage() {
  return (
    <AgentShell title="Your unit" subtitle="Who needs you this week.">
      <ComingInPhase
        phase={13}
        what="Your unit's activity, ratios and coaching coverage, so you can see who to spend time with."
        elsewhere={[
          {
            href: '/user-management/kpm',
            label: 'User management',
            detail: 'Your office, and the people in your unit.',
          },
          {
            href: '/profile',
            label: 'Your account',
            detail: 'Your name, pronoun and password.',
          },
        ]}
      />
    </AgentShell>
  );
}
