'use client';

import { use } from 'react';
import { MeetingScreen } from '@/components/leader-forum/meeting-screen';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { FORUM_TITLE } from '@/lib/leader-meetings';

/**
 * **A meeting opened by a shared link** (`/leader-meetings/shared/[token]`, P18.1-T3; ADR-0131): read-only, for
 * any signed-in member of the meeting's office, in their own shell. A reader not signed in signs in and comes
 * back. Every failure of the link is one not-found state.
 */
export default function SharedLeaderMeetingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useMessages(forumMessages);
  return (
    <RoleShell title={FORUM_TITLE} subtitle={t.sub} permission="leader_meeting:read_shared_link">
      <MeetingScreen source={{ via: 'link', token }} />
    </RoleShell>
  );
}
