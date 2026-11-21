'use client';

import { Suspense, use } from 'react';
import { ForumScreen } from '@/components/leader-forum/forum-screen';
import { RoleShell } from '@/components/role-shell';
import { FORUM_TITLE } from '@/lib/leader-meetings';

/**
 * **A forum opened by a shared link** (`/leader-meetings/shared/[token]`, P18.1-T3, P19.22-T8 AC-2; ADR-0131): the
 * link *Bagikan* sent in WhatsApp, read-only for any signed-in member of the forum's office, in their own shell — its
 * agenda and its action items. A reader not signed in signs in and comes back. Every failure of the link is one
 * not-found state.
 */
export default function SharedLeaderMeetingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <RoleShell title={FORUM_TITLE} permission="leader_meeting:read_shared_link">
      <Suspense fallback={null}>
        <ForumScreen source={{ via: 'link', token }} />
      </Suspense>
    </RoleShell>
  );
}
