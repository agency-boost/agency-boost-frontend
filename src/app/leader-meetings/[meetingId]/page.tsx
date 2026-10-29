'use client';

import { use } from 'react';
import { MeetingScreen } from '@/components/leader-forum/meeting-screen';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { FORUM_TITLE } from '@/lib/leader-meetings';

/**
 * **A meeting** (`/leader-meetings/[meetingId]`, P18.1-T2): its own address, which the prototype's swap in place
 * does not have. Opening a meeting changes neither the page's title nor its line (flow doc §2.1).
 */
export default function LeaderMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  const t = useMessages(forumMessages);
  return (
    <RoleShell title={FORUM_TITLE} subtitle={t.sub} permission="leader_meeting:read">
      <MeetingScreen source={{ via: 'address', meetingId }} />
    </RoleShell>
  );
}
