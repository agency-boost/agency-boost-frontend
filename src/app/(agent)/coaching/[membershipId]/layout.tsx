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
 * **The page's title is the person's name** (P18.95-T7 AC-2; the client's UI review, UI-021), drawn by the shell once
 * it has read who this is: *Coaching Session* was the title, a tab and the way back at once, and said nothing of whom
 * the page is about. Where there is nobody to name — the address names nobody the reader coaches, the read failed, a
 * former coach on a past session — the shell titles the page *Coaching Session*, the prototype's for every coaching
 * view (`Overall.html:10407`). Gated as the roster is: `coaching_session:read`, and the API refuses a person outside
 * the reader's reach whatever this decides.
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
    <Page permission="coaching_session:read">
      <PersonShell membershipId={membershipId}>{children}</PersonShell>
    </Page>
  );
}
