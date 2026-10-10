'use client';

import { ForumList } from '@/components/leader-forum/forum-list';
import { RoleShell } from '@/components/role-shell';
import { FORUM_COPY } from '@/lib/leader-meetings';

/**
 * ***Strategic Leader Forum*** (`/leader-meetings`, P18.1-T2): the office's biweekly check-ins.
 *
 * **In the reader's own shell** (D-coeditors): the Owner and the Admins in the console, where the nav item is;
 * a Core Leader in the field view, which gains no item — they arrive by the address or a shared link. So the
 * route sits outside the route groups and renders `RoleShell`, as `/notifications` does.
 */
export default function LeaderMeetingsPage() {
  return (
    <RoleShell title={FORUM_COPY.title} subtitle={FORUM_COPY.sub} permission="leader_meeting:read">
      <ForumList />
    </RoleShell>
  );
}
