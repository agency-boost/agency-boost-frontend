'use client';

import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';

/** Every field role's landing. Built in Phase 6 — the daily minute. */
export default function LogActivityPage() {
  return (
    <Page title="Log activity" subtitle="Today's work, in about a minute.">
      <ComingInPhase
        phase={6}
        what="Recording what you did today — approaches, presentations, submissions — against your office's own activity types."
        elsewhere={[
          {
            href: '/user-management/kpm',
            label: 'User management',
            detail: 'Your office and your leader.',
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
