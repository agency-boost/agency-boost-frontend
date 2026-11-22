'use client';

import { Suspense, use } from 'react';
import { ForumScreen } from '@/components/leader-forum/forum-screen';
import { RoleShell } from '@/components/role-shell';
import { FORUM_TITLE } from '@/lib/leader-meetings';

/**
 * **One forum** (`/leader-meetings/[meetingId]`, P19.22-T8 AC-2 to AC-4): its header card and its four tabs, opened on
 * `?tab=` (`useQuery`, under a `Suspense`) or on *Agenda*.
 */
export default function LeaderMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  return (
    <RoleShell title={FORUM_TITLE} permission="leader_meeting:read">
      <Suspense fallback={null}>
        <ForumScreen source={{ via: 'address', meetingId }} />
      </Suspense>
    </RoleShell>
  );
}
