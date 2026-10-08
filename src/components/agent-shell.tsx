'use client';

import { usePathname } from 'next/navigation';
import { AppShell, type NavItem, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ToastHost } from '@/components/ui/toast';
import { useLadder } from '@/components/ui/role-badge';
import { viewSwitchFor } from '@/lib/landing';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The chrome around every agent and leader screen (`Overall.html:2610-2691`).
 *
 * The eight sections, their order and their labels are the prototype's, verbatim. They
 * were previously two invented ones — `Your office` and `Your work` — which appear in no
 * prototype file, and which put Admin first when the prototype puts it last. A member who
 * leads nobody sees seven: *Unit tools* and *Group tree* follow the graph (`leadsSomeone`,
 * below), which is the one place this nav departs from the prototype's static markup.
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
      {/* The shell's toast, for a write that leaves its page (P13-T7 AC-3). */}
      <ToastHost>
        <Chrome
          title={title}
          subtitle={subtitle}
          actions={actions}
        >
          {children}
        </Chrome>
      </ToastHost>
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

  const membership = me?.membership;

  /*
   * Leading is the graph, not the rung (OD-23): a leader is someone with an active direct report,
   * so an AAB who leads nobody is not one, and neither is an AB with no reports. *Unit tools*
   * follows that predicate, as `roles-and-permissions.md` §4.2 item 3 and §4.5 say. *Group tree*
   * follows it too (§4.2 item 2, amended 2026-10-01, P10.1-T2 AC-9): the tree an Agent would see
   * is a leader node and themselves, and that is as true of a childless AAB. The prototype's nav
   * is static for every rung (`Overall.html:2624-2678`), which is the leak §4.2 names. The routes
   * keep their own guards; this decides what the sidebar offers, not what the API allows.
   */
  const leadsSomeone = (membership?.directCount ?? 0) > 0;

  const unitTools: NavSection = {
    label: 'Unit tools',
    divider: true,
    items: [
      // *Upcoming* (P10.1-T2, the client's 2026-10-01 request): the page is a sign, and the
      // prototypes draw a destination not built yet as a disabled item with the pill
      // (`KPM_Owner.html:882`), not as a link to a sign. Never `active`: like the other two shells,
      // an upcoming item is not where the reader is, even on a typed URL.
      { label: 'Unit dashboard', href: '/unit/dashboard', icon: 'gauge', upcoming: true },
      // Live since the roster was built (P11-T6 AC-7), and where a leader lands (`landing.ts`). Every
      // route under it is coaching — the reader's own notes and each person they coach — so the item
      // stays current on all of them, as the prototype's returns to the roster from any of them
      // (`Overall.html:10596`).
      { label: 'Coaching session', href: '/coaching', icon: 'chat', active: on('/coaching') },
    ],
  };

  const groupTree: NavItem = { label: 'Group tree', href: '/group-tree', icon: 'tree', active: on('/group-tree') };

  /*
   * *New agent* (`Overall.html:2638-2647`) shows exactly what the reader has (P13-T7 AC-5), from the
   * facts the session carries, so no page reads them again: *Your 90-day activation* while their own is
   * open (OD-28, OD-120), with the prototype's amber check at 100% (`:6624`); *New hires* when they reach
   * at least one open activation, an Agent with a direct report included (OD-122, `:6894-6895`); and
   * the whole section hidden when neither applies (`:6638-6642`). Each route refuses a reader this
   * would not offer it to — the nav decides what is offered, never what is allowed.
   */
  const newAgent: NavSection = {
    label: 'New agent',
    divider: true,
    items: [
      ...(me?.activation?.open
        ? [{
          label: 'Your 90-day activation', href: '/activation', icon: 'clipboard', active: on('/activation'),
          done: me.activation.complete,
        } satisfies NavItem]
        : []),
      ...(me?.newHires
        ? [{ label: 'New hires', href: '/new-hires', icon: 'userPlus', active: on('/new-hires') } satisfies NavItem]
        : []),
    ],
  };

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
        // The fifth, after *Personal summary*, in `Overall.html`'s sentence case: the section file draws it
        // in a *Daily tools* group of its own (`Calendar_Section.html:254-260`), which is shell residue
        // (`prototype-sources.md`, *The rule*). Every field role has a calendar (roles §4.2), so it
        // follows no graph. Its glyph is not *Event list*'s (P12-T2 AC-1).
        { label: 'Calendar', href: '/calendar', active: on('/calendar'), icon: 'schedule' },
      ],
    },
    ...(leadsSomeone ? [unitTools] : []),
    ...(newAgent.items.length > 0 ? [newAgent] : []),
    {
      label: 'Training',
      divider: true,
      items: [{ label: 'Training modules', href: '/training', icon: 'graduation', upcoming: true }],
    },
    {
      label: 'Sales tools',
      items: [
        // Live for every field role (Phase 14; roles §4.2): the prototype gates neither (`Overall.html:2656-2657`).
        // The catalog stays current over its drawer's address, `/product-catalog/{code}`.
        { label: 'Sales Attack Plan', href: '/attack-plan', icon: 'compass', active: on('/attack-plan') },
        { label: 'Product Catalog', href: '/product-catalog', icon: 'box', active: on('/product-catalog') },
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
        ...(leadsSomeone ? [groupTree] : []),
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
      account={{
        href: '/profile',
        onSignOut: () => void signOut(),
        signingOut: busy,
        // *Open Owner view* or *Open Admin view* (ADR-0114): back to the office console, for an Owner or an
        // Admin who opened their field view. A field member has one view, and is offered nothing.
        viewSwitch: viewSwitchFor(me, 'field') ?? undefined,
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
