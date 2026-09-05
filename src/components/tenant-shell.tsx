'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ROLE_SHORT } from '@/components/ui/role-badge';
import { useSession } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around every tenant-admin screen — the KPM Owner's and KPM Admin's side of
 * the product.
 *
 * The nav mirrors the prototype's grouping (`KPM_Owner.html:2039`), and keeps routes
 * that do not exist yet visible as *Upcoming* rather than hiding them, so the roadmap is
 * legible instead of being a surprise.
 */
const SECTIONS: readonly { label: string; items: { label: string; href: string; upcoming?: boolean }[] }[] = [
  {
    label: 'Office',
    items: [
      { label: 'Overview', href: '/kpm/overview', upcoming: true },
      { label: 'Analytics', href: '/kpm/analytics', upcoming: true },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'All members', href: '/people/members' },
      { label: 'Org tree', href: '/people/org-tree', upcoming: true },
      { label: 'KPM admins', href: '/people/admins', upcoming: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Activity types', href: '/kpm/settings/activity-types', upcoming: true },
      { label: 'Ratio benchmarks', href: '/kpm/settings/ratio-benchmarks', upcoming: true },
      { label: 'Lead statuses', href: '/kpm/settings/lead-statuses', upcoming: true },
      { label: 'Branch info', href: '/kpm/settings/branch-info', upcoming: true },
    ],
  },
];

export function TenantShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission="member:read_profile">
      <TenantChrome title={title} subtitle={subtitle} actions={actions}>
        {children}
      </TenantChrome>
    </RequireSession>
  );
}

function TenantChrome({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  const sections: readonly NavSection[] = SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.map((item) => ({
      ...item,
      active: !item.upcoming && pathname.startsWith(item.href),
    })),
  }));

  const membership = me?.membership;
  const capacity = membership?.isKpmOwner
    ? 'KPM Owner'
    : membership?.isKpmAdmin
      ? 'KPM Admin'
      : membership
        ? ROLE_SHORT[membership.hierarchyRole]
        : '';

  return (
    <AppShell
      sections={sections}
      user={{
        name: me?.user.preferredName ?? me?.user.fullName ?? 'Signed in',
        role: capacity,
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
