'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { type NavIconName } from '@/components/ui/nav-icon';
import { RequireSession } from '@/components/require-session';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around every Super Admin screen.
 *
 * The nav lists routes that do not exist yet as "Upcoming" rather than hiding them —
 * the same choice the prototype makes for advanced analytics. Hiding them would let a
 * reviewer conclude the surface is finished when it is not.
 */
type AdminNavItem = {
  label: string; href: string; upcoming?: boolean; icon: NavIconName;
};

/**
 * The Superadmin nav (`Superadmin.html:169-205`), verbatim.
 *
 * Five groups, `Overview` alone and unlabelled at the top. Until 2026-09-06 there was no
 * Super Admin prototype and this was two invented groups — `Platform` and `Later phases`.
 * Six of these ten destinations are surfaces we have not built; they carry the prototype's
 * own `Soon` pill rather than being hidden, which is what it does too.
 */
const SECTIONS: readonly { label: string | null; divider?: boolean; items: AdminNavItem[] }[] = [
  // Notifications is **not** in this list. It is the bell beside the identity chip at the foot
  // of the sidebar — a glance rather than a place to work, and a count in a list of
  // destinations read as a section of the product (client feedback, 2026-09-24).
  {
    label: null,
    items: [
      { label: 'Overview', href: '/admin', icon: 'gauge' },
    ],
    divider: true,
  },
  {
    label: 'Companies',
    items: [
      { label: 'Manage companies', href: '/admin/companies', icon: 'building' },
      { label: 'Org role ladder', href: '/admin/org-levels', icon: 'ladder' },
      /*
       * **No `Product catalog` item.** ADR-0033 moved the catalog to the Company template's
       * Products tab — a product belongs to one insurer, and a flat platform screen has no
       * company to point at — and took `/admin/products` out of the route registry with it.
       * The nav item outlived both, pointing at a route that no longer exists.
       */
    ],
    divider: true,
  },
  {
    label: 'KPMs',
    items: [
      { label: 'All KPMs', href: '/admin/tenants', icon: 'office' },
      /*
       * **No `Create / assign KPM` item.** `/admin/tenants` carries **New office** in its
       * header and again in its empty state, so the nav was a third way to the same form —
       * and the only one that took a reader away from the list they would land back on.
       */
      // Not `upcoming`. P3.5-T2 built this screen and its endpoints and left the flag
      // on, and `upcoming` renders an anchor with **no href** — so a shipped surface was
      // reachable from nowhere, while `12-kpm-requests.md` told the reader to click it.
      { label: 'Pending KPM requests', href: '/admin/kpm-requests', icon: 'inbox' },
    ],
    divider: true,
  },
  {
    label: 'Platform admin',
    items: [
      { label: 'KPM Owners & Admins', href: '/admin/tenant-admins', icon: 'shield' },
      { label: 'Audit / role change log', href: '/admin/audit', icon: 'history' },
    ],
    divider: true,
  },
  {
    label: 'Reporting',
    items: [{ label: 'Cross-platform analytics', href: '/admin/analytics', icon: 'chart', upcoming: true }],
  },
];

export function AdminShell({
  title,
  subtitle,
  actions,
  permission = 'kpm:list_all',
  children,
}: {
  /**
   * Omitted when a **group layout** renders this shell: a layout serves every route
   * beneath it and cannot know their titles, so those pages render `PageHeader`
   * themselves.
   */
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /**
   * The gate. Defaults to the console's own, and is overridable so a **cross-family**
   * route rendered in this chrome is gated on what that route actually needs — a Super
   * Admin reading their notifications is not exercising `kpm:list_all`, and saying they
   * are would make the refusal, when it came, name the wrong thing.
   */
  permission?: string;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission={permission}>
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
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const unread = useUnreadCount();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  // `/admin` is a prefix of every other admin route, so it only matches exactly.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const sections: readonly NavSection[] = SECTIONS.map((section) => ({
    label: section.label,
    divider: section.divider,
    items: section.items.map((i) => ({
      ...i,
      active: !i.upcoming && isActive(i.href),
    })),
  }));

  return (
    <AppShell
      sections={sections}
      user={{
        name: me?.user.preferredName ?? me?.user.fullName ?? 'Super Admin',
        role: 'Superadmin',
        initials: me?.user.initials ?? 'SA',
        email: me?.user.email,
      }}
      brandTag="SUPERADMIN"
      upcomingLabel="Soon"
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
