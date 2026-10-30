'use client';

import { ForumList } from '@/components/leader-forum/forum-list';
import { SubtitleOnPhone } from '@/components/app-shell';
import { RoleShell } from '@/components/role-shell';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { FORUM_TITLE } from '@/lib/leader-meetings';
import { useSession } from '@/lib/session';

/**
 * ***Strategic Leader Forum*** (`/leader-meetings`, P18.1-T2): the office's biweekly check-ins.
 *
 * **In the reader's own shell** (D-coeditors): the Owner and the Admins in the console, where the nav item is;
 * a Core Leader in the field view, which gains no item — they arrive by the address or a shared link. So the
 * route sits outside the route groups and renders `RoleShell`, as `/notifications` does.
 */
export default function LeaderMeetingsPage() {
  const t = useMessages(forumMessages);
  const { me } = useSession();
  // UI V1 (UI-110): no grey sub-line on a phone in the field shell; the office console keeps its own (ADR-0180 §2).
  const inConsole = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin || me?.user.platformRole === 'super_admin');
  return (
    <SubtitleOnPhone.Provider value={inConsole}>
      <RoleShell title={FORUM_TITLE} subtitle={t.sub} permission="leader_meeting:read">
        <ForumList />
      </RoleShell>
    </SubtitleOnPhone.Provider>
  );
}
