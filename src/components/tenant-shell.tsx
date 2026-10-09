'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavSection } from '@/components/app-shell';
import { type NavIconName } from '@/components/ui/nav-icon';
import { RequireSession } from '@/components/require-session';
import { useLadder } from '@/components/ui/role-badge';
import { viewSwitchFor } from '@/lib/landing';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around every tenant-admin screen — the KPM Owner's and KPM Admin's side of
 * the product.
 *
 * The nav mirrors the prototype's grouping (`KPM_Owner.html:2039`), and keeps routes
 * that do not exist yet visible as *Upcoming* rather than hiding them, so the roadmap is
 * legible instead of being a surprise.
 */
const SECTIONS: readonly {
  label: string | null;
  divider?: boolean;
  items: {
    label: string; href: string; upcoming?: boolean; ownerOnly?: boolean; icon: NavIconName;
  }[];
}[] = [
  // The prototype's order, verbatim (`KPM_Owner.html:872-913`): Overview alone and
  // unlabelled at the top, then Reporting, Leader Meetings, Settings, and People last.
  // It used to be an invented `Office` group with People above Settings.
  // No prototype has a notifications nav item — none of the fourteen files has a
  // notifications surface at all.
  //
  // Notifications is **not** in this list. It is the bell beside the identity chip at the foot
  // of the sidebar — a glance rather than a place to work, and a count in a list of
  // destinations read as a section of the product (client feedback, 2026-09-24).
  {
    label: null,
    items: [
      { label: 'Overview', href: '/kpm/overview', icon: 'gauge' },
    ],
    divider: true,
  },
  {
    label: 'Reporting',
    items: [
      { label: 'KPM analytics', href: '/kpm/analytics', icon: 'chart', upcoming: true },
      { label: 'Data upload', href: '/kpm/data-upload', icon: 'upload' },
      { label: 'Advanced analytics', href: '/kpm/advanced-analytics', icon: 'chartUp', upcoming: true },
    ],
    divider: true,
  },
  {
    label: 'Leader Meetings',
    items: [{ label: 'Strategic Leader Forum', href: '/leader-meetings', icon: 'megaphone', upcoming: true }],
    divider: true,
  },
  {
    label: 'Settings',
    // Ten items, in the prototype's order. Ratio benchmarks is deliberately absent:
    // the prototype has it as a sub-tab of Activity types (`KPM_Owner.html:1330`), not
    // as a sidebar destination.
    items: [
      { label: 'Activity types', href: '/kpm/settings/activity-types', icon: 'activity' },
      { label: 'Lead statuses', href: '/kpm/settings/lead-statuses', icon: 'funnel' },
      { label: 'Activation checklist', href: '/kpm/settings/activation-checklist', icon: 'clipboard' },
      { label: 'Training', href: '/kpm/settings/training', icon: 'graduation' },
      /*
       * After Training, with the other two screens about one person's development: the first
       * ninety days, what they learn, how far they have come. Events, Campaigns and Products
       * are a different subject — what the office runs and sells.
       *
       * The prototype's own order (`KPM_Owner.html:896-903`) is untouched; this only chooses
       * where the one screen it has no counterpart for goes.
       */
      { label: 'Capability Mapping', href: '/kpm/settings/capability-mapping', icon: 'ladder' },
      { label: 'Events', href: '/kpm/settings/events', icon: 'calendar' },
      { label: 'Campaigns', href: '/kpm/settings/campaigns', icon: 'trophy' },
      { label: 'Products', href: '/kpm/settings/products', icon: 'box' },
      /*
       * The recruitment section file's *Viewing as KPM* view (P17-T5, D-settings): after Products, the
       * other set of documents the office keeps for its agents to show. The prototype has no settings
       * item for it — its toggle is a demo device the permissions replace (route registry, H-22).
       */
      { label: 'Recruitment pitch', href: '/kpm/settings/recruitment-pitch', icon: 'chat' },
      // The Admin's as well as the Owner's since ADR-0027, like every page under Settings.
      { label: 'Branch info', href: '/kpm/settings/branch-info', icon: 'sliders' },
    ],
    divider: true,
  },
  {
    label: 'People',
    items: [
      { label: 'All members', href: '/people/members', icon: 'users' },
      // Owner and Admin both hold `kpm:import_roster` (P3.6-T4); a leader does not,
      // and there is no tenant shell for one anyway.
      { label: 'Import people', href: '/people/import', icon: 'userPlus' },
      { label: 'Org tree', href: '/people/org-tree', icon: 'tree' },
      { label: 'Manage KPM admins', href: '/people/admins', icon: 'shield', ownerOnly: true },
    ],
  },
];

export function TenantShell({
  title,
  subtitle,
  actions,
  permission = 'member:read_profile',
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
  /** What this screen needs. Most tenant-admin screens read the roster; the tree does not. */
  permission?: string;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission={permission}>
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
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const unread = useUnreadCount();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();

  // An Owner-reserved screen is hidden from an Admin entirely, rather than shown and then
  // refused (`roles-and-permissions.md` §1.6) — since ADR-0027 that is Manage KPM admins
  // alone. The API still decides: hiding a nav item is a courtesy, not a control.
  const isOwner = Boolean(me?.membership?.isKpmOwner);
  const sections: readonly NavSection[] = SECTIONS.map((section) => ({
    label: section.label,
    items: section.items
      .filter((item) => !item.ownerOnly || isOwner)
      .map((item) => ({
        ...item,
        active: !item.upcoming && pathname.startsWith(item.href),
      })),
    divider: section.divider,
  })).filter((section) => section.items.length > 0);

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

  const capacity = membership?.isKpmOwner
    ? 'KPM Owner'
    : membership?.isKpmAdmin
      ? 'KPM Admin'
      : membership
        ? shortRung
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
      brandTag="KPM OWNER"
      account={{
        href: '/profile',
        onSignOut: () => void signOut(),
        signingOut: busy,
        // *Open agent view* (ADR-0114): an Owner or an Admin to their field landing, the screen a member
        // of their rung would have signed in to. No nav item: `KPM_Owner.html`'s nav has none of the
        // field's, and the chip's panel is a control that already exists (ADR-0062 §2).
        viewSwitch: viewSwitchFor(me, 'office') ?? undefined,
      }}
      notifications={{ href: '/notifications', unread }}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
