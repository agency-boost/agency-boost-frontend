import type { NavIconName } from '@/components/ui/nav-icon';
import { kept, type Kept } from '@/i18n/kept';
import type { Me } from './session';

/**
 * **The field shell's navigation, in one place** (UI V1, UI-004; D-13, D-20; ADR-0180). The floating tab bar, the
 * *Lainnya* sheet and the desktop sidebar are three drawings of this one model, so the sheet and the sidebar cannot
 * come to differ in their groups, their order, their labels or who sees what — the owner's *both menus match*.
 *
 * **Who sees what is today's rule, unchanged** (D-20: *each role sees only the groups and tiles it is allowed to open
 * today*): leading is the graph, not the rung (OD-23) — *Unit Dashboard*, *Search agent*, *Coaching* and *Group Tree*
 * to somebody with a direct report; *New Hires* to a reader with an open activation in reach, or a leader who may add
 * agents (P18.96-T3 AC-1); the *KPM* group to a Core Leader (ADR-0159 §3). A group with nothing in it for the reader is
 * left out. The nav decides what is offered, never what is allowed: every route keeps its own guard.
 *
 * **An Agent's fourth tab is *Personal Summary*** (O-10): somebody who leads nobody has no Unit Dashboard to open.
 *
 * Pure: the session and the path in, the model out — `field-nav.spec.ts` walks it role by role.
 */

/** Every place the field shell can take a reader. */
export type FieldDestinationId =
  | 'home' | 'activity' | 'calendar' | 'unit' | 'searchAgent'
  | 'leads' | 'goals' | 'summary' | 'training' | 'activation'
  | 'sales' | 'recruitment'
  | 'coaching' | 'newHires' | 'groupTree' | 'userManagement'
  | 'campaign' | 'event'
  | 'forum' | 'kpmAnalytics' | 'advancedAnalytics';

export interface FieldDestination {
  readonly id: FieldDestinationId;
  readonly href: string;
  readonly icon: NavIconName;
  /** The full name: the desktop sidebar's (D-20, *Desktop has room, so labels are the full names*). */
  readonly label: Kept;
  /** The *Lainnya* sheet's tile and the tab bar's label, where the full name is too long for a 4-column tile. */
  readonly short: Kept;
  /** The reader is on this destination, or on a page beneath it. */
  readonly active: boolean;
  /** No screen yet: greyed, *Segera hadir*, not a link (*Advanced analytics*). */
  readonly soon?: boolean;
  /** *Your 90-day activation* at 100%: the amber check (`Overall.html:2643`). */
  readonly done?: boolean;
  /**
   * Not a page: a control that opens something over the page — *Search agent*, the agent search picker (UI-012, D-14).
   * `href` is where a reader without the picker would go instead.
   */
  readonly opens?: 'agentSearch';
}

/** The *Lainnya* sheet's and the sidebar's groups, in the owner's order (D-20). */
export type FieldGroupId = 'saya' | 'aktivitas' | 'timSaya' | 'program' | 'kpm';

export interface FieldGroup {
  readonly id: FieldGroupId;
  readonly items: readonly FieldDestination[];
}

export interface FieldNav {
  /**
   * The bar's four destinations, in order — Activity · Calendar · Home · Unit — with *Lainnya* drawn fifth by the bar
   * itself (it opens the sheet; it is no page). Home is the centre, a tab like the others (owner, 2026-10-30).
   */
  readonly tabs: readonly [FieldDestination, FieldDestination, FieldDestination, FieldDestination];
  /** The desktop sidebar's first section, with no heading: Home · Activity · Calendar · Unit Dashboard · Search agent. */
  readonly top: readonly FieldDestination[];
  /** Saya · Aktivitas · Tim saya · Program · KPM, each with the reader's items; a group with none is left out. */
  readonly groups: readonly FieldGroup[];
  /** The reader is on a page the sheet holds and the bar does not: *Lainnya* is then the bar's current tab. */
  readonly inSheet: boolean;
}

/** Whether `pathname` is `href` or a page beneath it. */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function fieldNav(me: Me | null | undefined, pathname: string): FieldNav {
  const on = (href: string) => isUnder(pathname, href);
  const membership = me?.membership;
  const permissions = me?.permissions ?? [];

  /** Leading is the graph, not the rung (OD-23): an active direct report. */
  const leadsSomeone = (membership?.directCount ?? 0) > 0;
  const seesNewHires = Boolean(
    me?.newHires || (permissions.includes('member:invite') && permissions.includes('new_hires:read_roster')),
  );
  const coreLeader = membership?.isCoreLeader === true;
  const activationOpen = me?.activation?.open === true;

  const dest = (
    id: FieldDestinationId, href: string, icon: NavIconName, label: Kept, short: Kept = label, extra: Partial<FieldDestination> = {},
  ): FieldDestination => ({ id, href, icon, label, short, active: on(href), ...extra });

  const home = dest('home', '/home', 'home', kept('Home'));
  // Current on every Activity page — Log, Dashboard, Ratio — as the old *Activity management* was.
  const activity = { ...dest('activity', '/activity/log', 'checklist', kept('Activity')), active: on('/activity') };
  const calendar = dest('calendar', '/calendar', 'schedule', kept('Calendar'));
  const unit = dest('unit', '/unit/dashboard', 'barChart', kept('Unit Dashboard'), kept('Unit'));
  const searchAgent = dest('searchAgent', '/group-tree', 'search', kept('Search agent'), kept('Search agent'), {
    active: false, opens: 'agentSearch',
  });
  const summary = dest('summary', '/summary', 'report', kept('Personal Summary'), kept('Personal Summary'));

  const saya: FieldDestination[] = [
    /*
     * **The reader's own activation, first** (the lead's intake, 2026-10-30): today's *New agent* item (P13-T7 AC-5), on
     * the same condition — while it is open — with the amber check at 100%. No V1 tile names it (the review was an AB's),
     * and dropping it would leave the page reachable from nowhere (ADR-0180).
     */
    ...(activationOpen
      ? [dest('activation', '/activation', 'clipboard', kept('Your 90-day activation'), kept('90-day activation'), {
        done: me?.activation?.complete === true,
      })]
      : []),
    dest('leads', '/leads', 'funnel', kept('Leads')),
    dest('goals', '/goals', 'target', kept('Goal Setting')),
    summary,
    dest('training', '/training', 'graduation', kept('Training')),
  ];

  const aktivitas: FieldDestination[] = [
    // One entry since P18.8-T12: the plan, and the catalog's tabs over it; current on either address.
    { ...dest('sales', '/attack-plan', 'compass', kept('Sales')), active: on('/attack-plan') || on('/product-catalog') },
    { ...dest('recruitment', '/recruitment/attack-plan', 'users', kept('Recruitment')), active: on('/recruitment') },
  ];

  const timSaya: FieldDestination[] = [
    ...(leadsSomeone ? [dest('coaching', '/coaching', 'chat', kept('Coaching'))] : []),
    ...(seesNewHires ? [dest('newHires', '/new-hires', 'userPlus', kept('New Hires'))] : []),
    ...(leadsSomeone ? [dest('groupTree', '/group-tree', 'tree', kept('Group Tree'))] : []),
    /*
     * *User Mgmt → /user-management/add* (UI-085) for a reader who may add people to their unit
     * (`member:search_untagged_pool`, which an Agent is denied); an Agent's opens on *Register KPM*, as it always has, where
     * they find their office and their leader. Current on all four tabs.
     */
    {
      ...dest(
        'userManagement',
        permissions.includes('member:search_untagged_pool') ? '/user-management/add' : '/user-management/kpm',
        'usersGroup', kept('User Management'), kept('User Mgmt'),
      ),
      active: on('/user-management'),
    },
  ];

  const program: FieldDestination[] = [
    dest('campaign', '/campaigns', 'trophy', kept('Campaign')),
    dest('event', '/events', 'calendar', kept('Event')),
  ];

  const kpm: FieldDestination[] = coreLeader
    ? [
      dest('forum', '/leader-meetings', 'megaphone', kept('Strategic Leader Forum'), kept('Leader Forum')),
      dest('kpmAnalytics', '/kpm/analytics', 'chart', kept('KPM Analytics')),
      { ...dest('advancedAnalytics', '/kpm/advanced-analytics', 'chartUp', kept('Advanced analytics')), active: false, soon: true },
    ]
    : [];

  const groups: FieldGroup[] = (
    [
      { id: 'saya', items: saya },
      { id: 'aktivitas', items: aktivitas },
      { id: 'timSaya', items: timSaya },
      { id: 'program', items: program },
      { id: 'kpm', items: kpm },
    ] satisfies FieldGroup[]
  ).filter((group) => group.items.length > 0);

  const fourth = leadsSomeone ? unit : { ...summary, short: kept('Summary') };
  const tabs = [activity, calendar, home, fourth] as const;
  const onBar = tabs.some((tab) => tab.active);
  const inSheet = !onBar && groups.some((group) => group.items.some((item) => item.active));

  return {
    tabs,
    top: [home, activity, calendar, ...(leadsSomeone ? [unit, searchAgent] : [])],
    groups,
    inSheet,
  };
}
