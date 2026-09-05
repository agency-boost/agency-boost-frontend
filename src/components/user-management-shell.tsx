'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ROLE_SHORT } from '@/components/ui/role-badge';
import { useSession } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around the agent-side screens, and the sub-tab bar the prototype's User
 * Management tab uses (`Overall.html:3470-3475`).
 *
 * The sub-tabs are a **chain**, not four peers: Find your leader is locked until an
 * office is registered, exactly as the prototype locks it — *"Leader tab — locked
 * entirely until a KPM exists"* (`Overall.html:8824`). A locked tab stays visible and
 * says why, rather than disappearing.
 */
const SUBTABS = [
  { href: '/user-management/kpm', label: 'Register KPM' },
  { href: '/user-management/leader', label: 'Find your leader' },
  { href: '/user-management/add', label: 'Add new agents' },
  { href: '/user-management/pending', label: 'Pending requests', upcoming: true },
];

export function UserManagementShell({
  title,
  subtitle,
  leaderLocked,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Set on the leader screen when no office is registered yet. */
  leaderLocked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <RequireSession>
      <Chrome title={title} subtitle={subtitle} leaderLocked={leaderLocked}>
        {children}
      </Chrome>
    </RequireSession>
  );
}

function Chrome({
  title,
  subtitle,
  leaderLocked,
  children,
}: {
  title: string;
  subtitle?: string;
  leaderLocked?: boolean;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  const sections: readonly NavSection[] = [
    {
      label: 'Your office',
      items: [
        { label: 'User management', href: '/user-management/kpm', active: pathname.startsWith('/user-management') },
        { label: 'Group tree', href: '/group-tree', upcoming: true },
      ],
    },
    {
      label: 'Your work',
      items: [
        { label: 'Log activity', href: '/activity/log', upcoming: true },
        { label: 'Leads', href: '/leads', upcoming: true },
        { label: 'Goals', href: '/goals', upcoming: true },
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
    >
      <div className="mb-5 flex flex-wrap gap-1 border-b border-hairline">
        {SUBTABS.map((tab) => {
          const locked = tab.upcoming || (tab.href.endsWith('/leader') && leaderLocked);
          const active = pathname === tab.href;
          if (locked) {
            return (
              <span
                key={tab.href}
                aria-disabled
                title={tab.upcoming ? 'Arrives with its phase' : 'Register an office first'}
                className="cursor-default border-b-2 border-transparent px-3 py-2 text-md text-muted/50"
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
                  ? 'border-b-2 border-amber px-3 py-2 text-md font-semibold text-navy'
                  : 'border-b-2 border-transparent px-3 py-2 text-md text-muted hover:text-navy'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </AppShell>
  );
}
