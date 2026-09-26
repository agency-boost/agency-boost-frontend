'use client';

import { useSession } from '@/lib/session';
import { RouteTabs, type RouteTab } from '@/components/ui/route-tabs';

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
 */
interface SubTab {
  readonly href: string;
  readonly label: string;
  /** Hidden unless the reader holds this. Absent means everybody sees it. */
  readonly needs?: string;
}

const SUBTABS: readonly SubTab[] = [
  { href: '/user-management/kpm', label: 'Register KPM' },
  { href: '/user-management/leader', label: 'Find Your Leader' },
  // Hidden from an Agent, who holds neither permission this screen's two halves need.
  // `roles-and-permissions.md:372` calls it "the single largest leak in the prototype" —
  // an Agent issuing codes that tag joiners to themselves, and pulling untagged members
  // into a unit they do not have — and the API has always refused both. Only the tab
  // strip and the screen did not. Gated on the pool rather than the invite because the
  // invite permission goes away with P3.6-T1, and this one decides the same thing.
  { href: '/user-management/add', label: 'Add New Agents', needs: 'member:search_untagged_pool' },
  // Hidden from anybody who cannot read an inbox — an Agent. The prototype hides it by
  // role (`User_Management_Section.html:996`); we hide it by the permission that decides
  // the same thing, so it survives P3.5-T8 replacing the role with a ladder reference.
  { href: '/user-management/pending', label: 'Pending Requests', needs: 'leader_request:read_inbox' },
];

export function UserManagementTabs({
  leaderLocked,
  pendingCount,
}: {
  /** Find Your Leader is locked until an office is registered. */
  leaderLocked?: boolean;
  pendingCount?: number;
}) {
  const { me } = useSession();
  const permissions = me?.permissions ?? [];

  const tabs: RouteTab[] = SUBTABS.filter(
    (tab) => !tab.needs || permissions.includes(tab.needs),
  ).map((tab) => ({
    href: tab.href,
    label: tab.label,
    locked: tab.href.endsWith('/leader') && leaderLocked,
    hint: tab.href.endsWith('/leader') ? 'Register an office first' : undefined,
    badge:
      tab.href.endsWith('/pending') && pendingCount !== undefined && pendingCount > 0 ? (
        <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-card">
          {pendingCount}
        </span>
      ) : undefined,
  }));

  return <RouteTabs label="User Management" tabs={tabs} />;
}
