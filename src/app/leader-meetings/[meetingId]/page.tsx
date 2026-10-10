'use client';

import { use } from 'react';
import { MeetingScreen } from '@/components/leader-forum/meeting-screen';
import { RoleShell } from '@/components/role-shell';
import { FORUM_COPY } from '@/lib/leader-meetings';

/**
 * **A meeting** (`/leader-meetings/[meetingId]`, P18.1-T2): its own address, which the prototype's swap in place
 * does not have. Opening a meeting changes neither the page's title nor its line (flow doc §2.1).
 */
export default function LeaderMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  return (
    <RoleShell title={FORUM_COPY.title} subtitle={FORUM_COPY.sub} permission="leader_meeting:read">
      <MeetingScreen source={{ via: 'address', meetingId }} />
    </RoleShell>
  );
}
