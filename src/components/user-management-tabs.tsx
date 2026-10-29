'use client';

import { useSession } from '@/lib/session';
import { RouteTabs, type RouteTab } from '@/components/ui/route-tabs';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';

/**
 * The User Management chain: four screens that are one journey.
 *
 * Lifted out of `AgentShell` when route groups landed. A group layout serves every route
 * beneath it, and only four of the agent application's screens carry this strip — so it
 * belongs to those four, not to the shell they happen to share.
 *
 * Title Case, because these are the prototype's strings. **The geometry is `RouteTabs`**; what stays
 * here is the part that is about these four screens rather than about tab strips: which permission
 * each rung needs, and that Find Your Leader is locked until an office exists.
 *
 * The title and the four tabs are kept English in both languages (§A.2, §A.3); the locked tab's reason is the
 * catalogue's (`user-management.ts`; P18.98-T4).
 */
interface SubTab {
  readonly href: string;
  readonly tab: keyof typeof userManagementMessages.en.tabs;
  /** Hidden unless the reader holds this. Absent means everybody sees it. */
  readonly needs?: string;
}

/**
 * **The heading over all four tabs: the nav item's words** (P18.95-T9 AC-2; ADR-0167 §10, OD-205; the client's UI
 * review, UI-027: menu *User management* over a page titled *Register KPM*). The prototype's own title for the module
 * (`Overall.html:10414`, *User Management*). Each tab still names its page.
 */
export const USER_MANAGEMENT_TITLE = kept('User Management');

const SUBTABS: readonly SubTab[] = [
  { href: '/user-management/kpm', tab: 'kpm' },
  { href: '/user-management/leader', tab: 'leader' },
  // Hidden from an Agent, who holds neither permission this screen's two halves need.
  // `roles-and-permissions.md:372` calls it "the single largest leak in the prototype" —
  // an Agent issuing codes that tag joiners to themselves, and pulling untagged members
  // into a unit they do not have — and the API has always refused both. Only the tab
  // strip and the screen did not. Gated on the pool rather than the invite because the
  // invite permission goes away with P3.6-T1, and this one decides the same thing.
  { href: '/user-management/add', tab: 'add', needs: 'member:search_untagged_pool' },
  // Hidden from anybody who cannot read an inbox — an Agent. The prototype hides it by
  // role (`User_Management_Section.html:996`); we hide it by the permission that decides
  // the same thing, so it survives P3.5-T8 replacing the role with a ladder reference.
  { href: '/user-management/pending', tab: 'pending', needs: 'leader_request:read_inbox' },
];

export function UserManagementTabs({
  leaderLocked,
  pendingCount,
}: {
  /** Find Your Leader is locked until an office is registered. */
  leaderLocked?: boolean;
  pendingCount?: number;
}) {
  const t = useMessages(userManagementMessages);
  const { me } = useSession();
  const permissions = me?.permissions ?? [];

  const tabs: RouteTab[] = SUBTABS.filter(
    (tab) => !tab.needs || permissions.includes(tab.needs),
  ).map((tab) => ({
    href: tab.href,
    label: t.tabs[tab.tab],
    locked: tab.href.endsWith('/leader') && leaderLocked,
    hint: tab.href.endsWith('/leader') ? t.registerFirst : undefined,
    badge:
      tab.href.endsWith('/pending') && pendingCount !== undefined && pendingCount > 0 ? (
        <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-card">
          {pendingCount}
        </span>
      ) : undefined,
  }));

  return <RouteTabs label={t.title} tabs={tabs} />;
}
