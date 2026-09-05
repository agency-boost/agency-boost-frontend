'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { useSession } from '@/lib/session';

/**
 * The chrome around every Super Admin screen.
 *
 * The nav lists routes that do not exist yet as "Upcoming" rather than hiding them —
 * the same choice the prototype makes for advanced analytics. Hiding them would let a
 * reviewer conclude the surface is finished when it is not.
 */
const NAV: readonly { label: string; href: string; upcoming?: boolean }[] = [
  { label: 'Overview', href: '/admin' },
  { label: 'Tenants', href: '/admin/tenants' },
  { label: 'Companies', href: '/admin/companies' },
  { label: 'Audit log', href: '/admin/audit' },
];

const UPCOMING: readonly { label: string; href: string }[] = [
  { label: 'Products', href: '/admin/products' },
  { label: 'Templates', href: '/admin/templates' },
  { label: 'Qualification rules', href: '/admin/qualification-rules' },
];

export function AdminShell({
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
    <RequireSession permission="kpm:list_all">
      <AdminChrome title={title} subtitle={subtitle} actions={actions}>
        {children}
      </AdminChrome>
    </RequireSession>
  );
}

function AdminChrome({
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
  const pathname = usePathname();

  // `/admin` is a prefix of every other admin route, so it only matches exactly.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const sections: readonly NavSection[] = [
    { label: 'Platform', items: NAV.map((i) => ({ ...i, active: isActive(i.href) })) },
    { label: 'Later phases', items: UPCOMING.map((i) => ({ ...i, upcoming: true })) },
  ];

  return (
    <AppShell
      sections={sections}
      user={{
        name: me?.user.preferredName ?? me?.user.fullName ?? 'Super Admin',
        role: 'Super Admin',
        initials: me?.user.initials ?? 'SA',
      }}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
