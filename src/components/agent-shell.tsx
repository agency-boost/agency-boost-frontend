'use client';

import Link from 'next/link';
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
interface SubTab {
  readonly href: string;
  readonly label: string;
  /** Hidden unless the reader holds this. Absent means everybody sees it. */
  readonly needs?: string;
}

/**
 * User Management's sub-tabs (`Overall.html:3471-3474`).
 *
 * Title Case, because these are the prototype's strings. They are a **chain**, not four
 * peers: Find Your Leader is locked until an office is registered, exactly as the
 * prototype locks it (`Overall.html:8824`). A locked tab stays visible and says why.
 */
const SUBTABS: readonly SubTab[] = [
  { href: '/user-management/kpm', label: 'Register KPM' },
  { href: '/user-management/leader', label: 'Find Your Leader' },
  { href: '/user-management/add', label: 'Add New Agents' },
  // Hidden from anybody who cannot read an inbox — an Agent. The prototype hides it by
  // role (`User_Management_Section.html:996`, `role === 'AB' || role === 'AAB'`); we hide
  // it by the permission that decides the same thing, so it survives P3.5-T8 replacing
  // the role with a ladder reference. Hiding is a convenience either way: the API refuses
  // an Agent the inbox regardless, and there is a test for that.
  { href: '/user-management/pending', label: 'Pending Requests', needs: 'leader_request:read_inbox' },
];

export function AgentShell({
  title,
  subtitle,
  leaderLocked,
  permission,
  subtabs,
  pendingCount,
  actions,
  children,
}: {
  title: string;
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
        leaderLocked={leaderLocked}
        subtabs={subtabs}
        pendingCount={pendingCount}
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
  leaderLocked,
  subtabs,
  pendingCount,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  leaderLocked?: boolean;
  subtabs?: boolean;
  pendingCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const permissions = me?.permissions ?? [];
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
          badge: pendingCount,
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
      {subtabs && (
        // The prototype's metrics: 24px between tabs, the underline sitting on the
        // hairline, and inactive tabs at the same weight as active — they differ by
        // colour and the amber rule, not by weight (`Overall.html:81-89`).
        <div className="mb-6 flex flex-wrap gap-6 border-b border-hairline">
          {SUBTABS.filter((tab) => !tab.needs || permissions.includes(tab.needs)).map((tab) => {
            const locked = tab.href.endsWith('/leader') && leaderLocked;
            const active = pathname === tab.href;
            if (locked) {
              return (
                <span
                  key={tab.href}
                  aria-disabled
                  title="Register an office first"
                  className="-mb-px cursor-default border-b-2 border-transparent px-0.5 pb-3 text-md font-semibold text-muted/50"
                >
                  {tab.label}
                </span>
              );
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? '-mb-px border-b-2 border-amber px-0.5 pb-3 text-md font-semibold text-navy'
                    : '-mb-px border-b-2 border-transparent px-0.5 pb-3 text-md font-semibold text-muted'
                }
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tab.href.endsWith('/pending') && pendingCount !== undefined && pendingCount > 0 && (
                    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-card">
                      {pendingCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {children}
    </AppShell>
  );
}
