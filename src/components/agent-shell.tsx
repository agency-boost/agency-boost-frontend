'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { useLadder } from '@/components/ui/role-badge';
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
 * Unbuilt items keep an `Upcoming` pill rather than disappearing, because the client asked on
 * 2026-10-01 for what is not built to be marked "like the others" (ADR-0070). The pill is not
 * this file's prototype: `Overall.html` draws no unbuilt item. It is the Owner app's
 * (`KPM_Owner.html:882`), and the console's *Soon* (`Superadmin.html:177-204`).
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

  /*
   * Eight sections in the prototype's order, Admin last, **with a line between every two** (client
   * feedback, 2026-09-30; parity I-144). The prototype draws two lines here, before KPM and before
   * Admin (`Overall.html:2660`, `:2672`), where the Owner's and the Super Admin's draw one before
   * every group. Once every group became a toggle of its own (P10.1-T3), a heading with no line
   * above it read as part of the group before it, so the client asked for the other two shells'
   * rule here too. Every section but the last carries `divider`.
   */
  const sections: readonly NavSection[] = [
    {
      label: 'Personal tools',
      divider: true,
      items: [
        // Notifications is **not** here. It is the bell beside the identity chip at the foot
        // of the sidebar — a glance rather than a place to work (client feedback,
        // 2026-09-24).
        { label: 'Activity management', href: '/activity/log', active: on('/activity'), icon: 'activity' },
        { label: 'Leads management', href: '/leads', active: on('/leads'), icon: 'funnel' },
        { label: 'Goal settings', href: '/goals', active: on('/goals'), icon: 'target' },
        { label: 'Personal summary', href: '/summary', active: on('/summary'), icon: 'user' },
      ],
    },
    {
      label: 'Unit tools',
      divider: true,
      items: [
        // *Upcoming*, as *Coaching session* is (P10.1-T2, the client's 2026-10-01 request). The page
        // is a sign, and the prototypes draw a destination not built yet as a disabled item with the
        // pill (`KPM_Owner.html:882`), not as a link to a sign. Never `active`: like the other two
        // shells, an upcoming item is not where the reader is, even on a typed URL.
        { label: 'Unit dashboard', href: '/unit/dashboard', icon: 'gauge', upcoming: true },
        { label: 'Coaching session', href: '/coaching', icon: 'chat', upcoming: true },
      ],
    },
    {
      // The prototype hides this whole section when neither item applies
      // (`Overall.html:6638-6642`). Both are Phase 11, so both are upcoming for now.
      label: 'New agent',
      divider: true,
      items: [
        { label: 'Your 90-day activation', href: '/activation', icon: 'clipboard', upcoming: true },
        { label: 'New hires', href: '/new-hires', icon: 'userPlus', upcoming: true },
      ],
    },
    {
      label: 'Training',
      divider: true,
      items: [{ label: 'Training modules', href: '/training', icon: 'graduation', upcoming: true }],
    },
    {
      label: 'Sales tools',
      items: [
        { label: 'Sales Attack Plan', href: '/attack-plan', icon: 'compass', upcoming: true },
        { label: 'Product Catalog', href: '/product-catalog', icon: 'box', upcoming: true },
      ],
      divider: true,
    },
    {
      label: 'KPM',
      divider: true,
      items: [{ label: 'Event list', href: '/events', icon: 'calendar', upcoming: true }],
    },
    {
      label: 'Campaign',
      items: [{ label: 'Campaign list', href: '/campaigns', icon: 'trophy', upcoming: true }],
      divider: true,
    },
    {
      label: 'Admin',
      items: [
        { label: 'Group tree', href: '/group-tree', icon: 'tree', active: on('/group-tree') },
        {
          label: 'User management',
          icon: 'userPlus',
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
  /*
   * The rung's short form, from the company's ladder (P4-T9).
   *
   * `ROLE_SHORT` was a three-key map here; a company publishing a fourth rung would have
   * shown a member of it nothing at all in the one place the sidebar says who they are.
   */
  const ladder = useLadder();
  const rung = ladder.find((l) => l.code === membership?.orgLevelCode?.toUpperCase());
  const shortRung = rung
    ? (rung.code.length <= 4 ? rung.code : rung.label)
    : (membership?.hierarchyRole ?? '').toUpperCase();


  return (
    <AppShell
      sections={sections}
      user={{
        name: me?.user.preferredName ?? me?.user.fullName ?? 'Signed in',
        role: membership ? shortRung : 'No office yet',
        initials: me?.user.initials ?? '??',
        email: me?.user.email,
      }}
      account={{ href: '/profile', onSignOut: () => void signOut(), signingOut: busy }}
      notifications={{ href: '/notifications', unread }}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
