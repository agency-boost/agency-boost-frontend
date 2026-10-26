'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { type NavIconName } from '@/components/ui/nav-icon';
import { RequireSession } from '@/components/require-session';
import { ToastHost } from '@/components/ui/toast';
import { displayName } from '@/lib/display-name';
import { useSession } from '@/lib/session';
import { useLeaderLimitPending } from '@/lib/use-leader-limit-pending';
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
  /** A live count beside the item — the leaders waiting past their office's limit (ADR-0157). */
  count?: 'leaderLimitPending';
};

/**
 * The Superadmin nav (`Superadmin.html:169-205`), verbatim.
 *
 * Five groups, `Overview` alone and unlabelled at the top. Until 2026-09-06 there was no
 * Super Admin prototype and this was two invented groups — `Platform` and `Later phases`.
 * A destination not built yet carries the prototype's own `Soon` pill rather than being
 * hidden, which is what it does too; since P18-T8 every one of them is built.
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
      /*
       * ADR-0157 §3, the client's request of 2026-10-26: a leader an office would add past its limit waits here for
       * AgencyBoost. Beside the other queue of this group, with its pending count, as that one is drawn.
       */
      { label: 'Leaders past the limit', href: '/admin/leader-limit-requests', icon: 'userPlus', count: 'leaderLimitPending' },
      /*
       * The quote tool (P13.2-T2). `Billing_Subscription.html` draws it as the only item of its own
       * sidebar (`:214`, *"Billing & Subscription"*); **last in this group, in the console's sentence
       * case** (ADR-0111 §8): a quote is for an office that does not exist yet, and an existing group
       * is a smaller footprint than a new one.
       */
      { label: 'Billing & subscription', href: '/admin/billing', icon: 'receipt' },
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
    /*
     * Live since P18-T8, OD-148's answer 1: adoption across offices, inside ADR-0011's line. It was
     * the console's last *Soon*, as drawn (`:204`); the console has none now, and `upcomingLabel`
     * stays for the next destination that is scheduled before it is built.
     */
    items: [{ label: 'Cross-platform analytics', href: '/admin/analytics', icon: 'chart' }],
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
    <RequireSession permission={permission} family="admin">
      {/* The shell's one toast region, as the agent shell's (P18.95-T1 AC-6): every screen beneath it speaks through it. */}
      <ToastHost>
        <AdminChrome title={title} subtitle={subtitle} actions={actions}>
          {children}
        </AdminChrome>
      </ToastHost>
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
  const leaderLimitPending = useLeaderLimitPending();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  // `/admin` is a prefix of every other admin route, so it only matches exactly.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const sections: readonly NavSection[] = SECTIONS.map((section) => ({
    label: section.label,
    divider: section.divider,
    items: section.items.map(({ count, ...i }) => ({
      ...i,
      active: !i.upcoming && isActive(i.href),
      ...(count === 'leaderLimitPending' ? { badge: leaderLimitPending } : {}),
    })),
  }));

  return (
    <AppShell
      sections={sections}
      user={{
        name: (me && displayName(me.user)) || 'Super Admin',
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
