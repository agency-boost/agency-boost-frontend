'use client';

import { ForumList } from '@/components/leader-forum/forum-list';
import { RoleShell } from '@/components/role-shell';
import { FORUM_TITLE } from '@/lib/leader-meetings';

/**
 * ***Strategic Leader Forum*** (`/leader-meetings`, P19.22-T8 AC-1): the office's forums of its core leaders. **In the
 * reader's own shell** — the Owner, the Admins, a core leader and the Super Admin inside the KPM, in the KPM menu
 * (ADR-0268) — so the route sits outside the route groups and renders `RoleShell`, as `/notifications` does. The note
 * under the title is the list's own line (`ForumList`).
 */
export default function LeaderMeetingsPage() {
  return (
    <RoleShell title={FORUM_TITLE} permission="leader_meeting:read">
      <ForumList />
    </RoleShell>
  );
}
