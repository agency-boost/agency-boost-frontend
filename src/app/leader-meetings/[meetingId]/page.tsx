'use client';

import { use } from 'react';
import { MeetingScreen } from '@/components/leader-forum/meeting-screen';
import { RoleShell } from '@/components/role-shell';

/**
 * **A meeting** (`/leader-meetings/[meetingId]`, P18.1-T2): its own address, which the prototype's swap in place
 * does not have. Opening a meeting changes neither the page's title nor its line (flow doc §2.1) — **except on a phone
 * in the field shell since UI V1** (UI-110), where the meeting's own header is the title row: *‹ Strategic Check-in #14*
 * with its date under it. So the screen draws the page's title (`titled`), and the shell draws none.
 */
export default function LeaderMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  return (
    <RoleShell permission="leader_meeting:read">
      <MeetingScreen source={{ via: 'address', meetingId }} titled />
    </RoleShell>
  );
}
