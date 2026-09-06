'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ROLE_SHORT } from '@/components/ui/role-badge';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around every agent and leader screen (`Overall.html:2610-2691`).
 *
 * The eight sections, their order and their labels are the prototype's, verbatim. They
 * were previously two invented ones — `Your office` and `Your work` — which appear in no
 * prototype file, and which put Admin first when the prototype puts it last.
 *
 * Unbuilt items keep an `Upcoming` pill rather than disappearing, so the roadmap stays
 * visible; that is the prototype's own choice, and `components-and-patterns.md` already
 * documented both the sections and the treatment before the code caught up.
 */

export function AgentShell({
  title,
  subtitle,
  permission,
  actions,
  children,
}: {
  /**
   * Omitted when a **group layout** renders this shell: a layout serves every route
   * beneath it and cannot know their titles, so those pages render `PageHeader`
   * themselves.
   */
  title?: string;
  subtitle?: string;
  /** Set on the leader screen when no office is registered yet. */
  leaderLocked?: boolean;
  permission?: string;
  /**
   * Render User Management's sub-tab strip. Off by default: it belongs to that module,
   * and it used to appear on the group tree, the unit dashboard and the activity log —
   * three screens offering tabs to a module they are not part of.
   */
  subtabs?: boolean;
  /** The prototype's alert-red count on Pending Requests, hidden at zero. */
  pendingCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission={permission}>
      <Chrome
        title={title}
        subtitle={subtitle}
        actions={actions}
      >
        {children}
      </Chrome>
    </RequireSession>
  );
}

function Chrome({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  leaderLocked?: boolean;
  subtabs?: boolean;
  pendingCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const unread = useUnreadCount();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Eight sections, two dividers, in the prototype's order. Admin is last.
  const sections: readonly NavSection[] = [
    {
      label: 'Personal tools',
      items: [
        // No prototype has a notifications nav item — none of the fourteen files has a
        // notifications surface at all. Registered as a Fill. It sits in Personal tools
        // because that is what it is, and it carries the unread count on the badge the
        // shell already supports.
        { label: 'Notifications', href: '/notifications', badge: unread || undefined },
        { label: 'Activity management', href: '/activity/log', active: on('/activity') },
        { label: 'Leads management', href: '/leads', upcoming: true },
        { label: 'Goal settings', href: '/goals', upcoming: true },
        { label: 'Personal summary', href: '/summary', upcoming: true },
      ],
    },
    {
      label: 'Unit tools',
      items: [
        { label: 'Unit dashboard', href: '/unit/dashboard', active: on('/unit') },
        { label: 'Coaching session', href: '/coaching', upcoming: true },
      ],
    },
    {
      // The prototype hides this whole section when neither item applies
      // (`Overall.html:6638-6642`). Both are Phase 11, so both are upcoming for now.
      label: 'New agent',
      items: [
        { label: 'Your 90-day activation', href: '/activation', upcoming: true },
        { label: 'New hires', href: '/new-hires', upcoming: true },
      ],
    },
    { label: 'Training', items: [{ label: 'Training modules', href: '/training', upcoming: true }] },
    {
      label: 'Sales tools',
      items: [
        { label: 'Sales Attack Plan', href: '/attack-plan', upcoming: true },
        { label: 'Product Catalog', href: '/product-catalog', upcoming: true },
      ],
      divider: true,
    },
    { label: 'KPM', items: [{ label: 'Event list', href: '/events', upcoming: true }] },
    {
      label: 'Campaign',
      items: [{ label: 'Campaign list', href: '/campaigns', upcoming: true }],
      divider: true,
    },
    {
      label: 'Admin',
      items: [
        { label: 'Group tree', href: '/group-tree', active: on('/group-tree') },
        {
          label: 'User management',
          href: '/user-management/kpm',
          active: on('/user-management'),
          // No badge. P3.5-T5 AC-3 settled this: no prototype puts a count inside a nav
          // anchor — `tab-badge` appears only on the sub-tab — and the count reached the
          // shell as a prop from one page, which a group layout cannot receive. The
          // specified badge lives on the Pending Requests sub-tab and still does.
        },
      ],
    },
  ];

  const membership = me?.membership;

  return (
    <AppShell
      sections={sections}
      user={{
        name: me?.user.preferredName ?? me?.user.fullName ?? 'Signed in',
        role: membership ? ROLE_SHORT[membership.hierarchyRole] : 'No office yet',
        initials: me?.user.initials ?? '??',
        email: me?.user.email,
      }}
      account={{ href: '/profile', onSignOut: () => void signOut(), signingOut: busy }}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
