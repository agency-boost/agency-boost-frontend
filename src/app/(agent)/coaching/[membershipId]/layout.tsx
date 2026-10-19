'use client';

import { use, type ReactNode } from 'react';
import { PersonShell } from '@/components/coaching-person';
import { Page } from '@/components/page';

/**
 * Every coachee address — `/coaching/{membershipId}` and its tabs — inside one person shell (P11-T7).
 *
 * **A layout, not a component each tab renders**, so the shell is mounted once: moving between tabs
 * keeps the header, the person already read, and *Leader view* / *Agent view* where the reader left
 * it (AC-3). The tab pages beneath are only their panels.
 *
 * The page's title is the prototype's for every coaching view, with its empty sub-line
 * (`Overall.html:10407`). Gated as the roster is: `coaching_session:read`, and the API refuses a person
 * outside the reader's reach whatever this decides.
 */
export default function CoachingPersonLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = use(params);
  return (
    <Page title="Coaching Session" permission="coaching_session:read">
      <PersonShell membershipId={membershipId}>{children}</PersonShell>
    </Page>
  );
}
