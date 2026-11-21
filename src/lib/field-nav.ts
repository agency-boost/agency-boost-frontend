import type { NavIconName } from '@/components/ui/nav-icon';
import type { MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { shellMessages } from '@/i18n/messages/shell';
import type { Me } from './session';

/**
 * **The shell's navigation, in one place** (UI V1, UI-004; D-13, D-20; ADR-0180). The floating tab bar, the *Lainnya*
 * sheet, the laptop sidebar and its rail are drawings of this one model, so they cannot come to differ in their groups,
 * their order, their labels or who sees what.
 *
 * **One login, one menu, decided by the role alone** (P19.17-T3 AC-1, AC-4;
 * [ADR-0269](../../../docs/04-adr/0269-one-login-one-menu-one-title-row.md); the brief of 19 November, part B *Menu = the
 * agent/AB menu + extras* and part E): everybody's menu is the field menu their rung gives (ADR-0189 §1 — never the data),
 * and **the office's Owner, its Admins and its core leaders have the extras added after *Program***: **KPM** ·
 * **People** · **Pengaturan**, last. There is no view to be in and no menu to switch to (ADR-0198, ADR-0199 superseded):
 * the Owner is an AB with extras. The order, everywhere:
 *
 * > Home · Activity · Calendar · Unit Dashboard · SAYA · AKTIVITAS · TIM SAYA · PROGRAM · KPM · PEOPLE · Pengaturan
 *
 * - **KPM** — Overview · Advanced analytics · Strategic Leader Forum · Data upload (*KPM Analytics* is gone).
 * - **People** — All members · Import people · Org tree · KPM admins; *KPM admins* the Owner's and the Admins' only, never
 *   a core leader's (`PERMISSIONS.md`). *Core leaders & groups* is gone.
 * - **Pengaturan** — one item, the hub (`/kpm/settings`), pinned at the laptop sidebar's foot and the *Lainnya* sheet's
 *   last group; the eleven settings pages are the hub's.
 * - **One tree for the Owner and the Admins**: no *Group Tree* in their *Tim saya* (Org tree is theirs); a core leader
 *   keeps it, for their own team.
 *
 * The nav decides what is offered, never what is allowed: every route keeps its own guard, and the server its refusals
 * (ADR-0189 §6). **The Super Admin** keeps a model of their own, `adminNav`, until the console's redesign (Phase 19.23).
 *
 * Pure: the session and the path in, the model out — `field-nav.spec.ts` walks it role by role.
 */

/** Every place the shell can take a reader. */
export type FieldDestinationId =
  | 'home' | 'activity' | 'calendar' | 'unit' | 'searchAgent'
  | 'leads' | 'goals' | 'summary' | 'training' | 'activation' | 'surveys'
  | 'sales' | 'recruitment'
  | 'coaching' | 'newHires' | 'groupTree' | 'userManagement'
  | 'campaign' | 'event'
  // The extras of the Owner, the Admins and the core leaders (P19.17-T3 AC-4).
  | 'kpmOverview' | 'advancedAnalytics' | 'forum' | 'dataUpload'
  | 'allMembers' | 'importPeople' | 'orgTree' | 'kpmAdmins'
  | 'settings'
  // The Super Admin's console (P19.23-T1 AC-1; ADR-0277 §1): the rail's seven.
  | 'consoleDashboard' | 'consoleKpms' | 'consoleMembers' | 'consoleCompanies' | 'consoleApprovals' | 'consoleBilling'
  | 'consolePlatform';

export interface FieldDestination {
  readonly id: FieldDestinationId;
  readonly href: string;
  readonly icon: NavIconName;
  /**
   * The full name: the laptop sidebar's (D-20, *Desktop has room, so labels are the full names*). A kept term for every
   * field and office item; the Super Admin's, *Survei* and *Pengaturan* come from the catalogue, so a string.
   */
  readonly label: string;
  /** The *Lainnya* sheet's tile and the tab bar's label, where the full name is too long for a 4-column tile. */
  readonly short: string;
  /** The reader is on this destination, or on a page beneath it. */
  readonly active: boolean;
  /** No screen yet: greyed, *Segera hadir*, not a link. */
  readonly soon?: boolean;
  /** *Your 90-day activation* at 100%: the amber check (`Overall.html:2643`). */
  readonly done?: boolean;
  /**
   * Not a page: a control that opens something over the page — *Search agent*, the agent search picker (UI-012, D-14).
   * `href` is where a reader without the picker would go instead.
   */
  readonly opens?: 'agentSearch';
  /** A live count — the leaders waiting past their office's limit (ADR-0157 §3) — drawn as the nav's red pill. */
  readonly badge?: number;
}

/**
 * The *Lainnya* sheet's and the sidebar's groups, in the owner's order (part E): the field's four, the extras' three
 * after them, and the Super Admin's four (UI-127).
 */
export type FieldGroupId =
  | 'saya' | 'aktivitas' | 'timSaya' | 'program' | 'kpm' | 'people' | 'pengaturan'
  | 'console';

/**
 * **Whose extras a group is** (P19.17-T3 AC-5, AC-7; part E: *a small orange "Owner" tag on KPM, PEOPLE and the
 * Pengaturan item for owner / admin / core leader*): `owner` for the Owner and the Admins, `coreLeader` for a core leader
 * who is neither. The laptop writes *Owner* for both; the *Lainnya* sheet *KPM Owner* or *Core leader*
 * (`lainnya-owner-mobile`).
 */
export type FieldGroupTag = 'owner' | 'coreLeader';

export interface FieldGroup {
  readonly id: FieldGroupId;
  readonly items: readonly FieldDestination[];
  /** The extras' tag (`FieldGroupTag`); absent on the field's groups and the Super Admin's. */
  readonly tag?: FieldGroupTag;
  /**
   * **The group's one icon on the 1024px rail** (P19.17-T3 AC-6; part E: *one icon per group — user-circle, activity,
   * users-group, trophy, building-skyscraper, address-book; tap = flyout*). Absent: the rail lists the group's items one
   * by one, as the Super Admin's has (its redesign is Phase 19.23's).
   */
  readonly railIcon?: NavIconName;
  /**
   * **Pinned at the laptop sidebar's foot** (P19.17-T3 AC-5; part E: *Pengaturan is pinned (freeze pane): always
   * visible at the bottom of the sidebar above the account row*): *Pengaturan*, which is always the last group. The
   * *Lainnya* sheet draws it as the last group, one tile.
   */
  readonly pinned?: boolean;
}

export interface FieldNav {
  /**
   * The bar's four destinations, in order — Activity · Calendar · Home · Unit — with *Lainnya* drawn fifth by the bar
   * itself (it opens the sheet; it is no page). Home is the centre, a tab like the others (owner, 2026-10-30).
   */
  readonly tabs: readonly [FieldDestination, FieldDestination, FieldDestination, FieldDestination];
  /**
   * The sidebar's first section, with no heading: **Home · Activity · Calendar · Unit Dashboard**, the last for a leader
   * (P19.13-T2 AC-4; UI-196). The sidebar lists a destination of `top` once, so *Unit Dashboard* is not drawn again under
   * *Tim saya* there; the *Lainnya* sheet, which draws `groups`, keeps it as *Tim saya*'s first tile (UI-159).
   */
  readonly top: readonly FieldDestination[];
  /**
   * ***Search agent*** (UI-012, D-14), for a leader by role, or `null`: a field under the sidebar's logo (UI-196, D-33).
   * Not a page: it opens the agent picker.
   */
  readonly search: FieldDestination | null;
  /** Saya · Aktivitas · Tim saya · Program, then KPM · People · Pengaturan for the extras; a group with none is left out. */
  readonly groups: readonly FieldGroup[];
  /** The reader is on a page the sheet holds and the bar does not: *Lainnya* is then the bar's current tab. */
  readonly inSheet: boolean;
}

/**
 * **A leader by role** (ADR-0189 §1; OD-247's default): on a leader rung — an AB or an AAB by class, the rung's leader
 * tier (ADR-0156 §3) — or the office's Owner or an Admin, or anybody who already leads somebody. A count may add the
 * items, never remove them: a new AB with nobody yet is a leader, and an Agent with a direct report stays one.
 * Somebody in no office, or whose membership is pending or removed — not in the office yet — is not.
 */
export function leadsByRole(membership: Me['membership'] | null | undefined): boolean {
  if (!membership || membership.status !== 'active') return false;
  return membership.hierarchyRole === 'ab' || membership.hierarchyRole === 'aab'
    || membership.isKpmOwner || membership.isKpmAdmin
    // Data may add the tools, never take them away (ADR-0189 §1): somebody on an Agent rung who already leads people
    // keeps the leader items they had under ADR-0087.
    || (membership.directCount ?? 0) > 0;
}

/**
 * **Who runs the office** (P19.17-T3; `PERMISSIONS.md`): its Owner or an Admin, active. They have every extra, *KPM
 * admins* included, and no *Group Tree*.
 */
export function runsTheOffice(membership: Me['membership'] | null | undefined): boolean {
  return membership?.status === 'active' && (membership.isKpmOwner || membership.isKpmAdmin);
}

/**
 * **Whose extras the reader has, if any** (P19.17-T3 AC-4): `owner` for the Owner and the Admins, `coreLeader` for an
 * active core leader who is neither (ADR-0268 §1: the Owner's rights in KPM and Pengaturan, People to see), `null` for
 * everybody else — an AB, an AAB, an Agent, somebody in no office.
 */
export function extrasOf(membership: Me['membership'] | null | undefined): FieldGroupTag | null {
  if (runsTheOffice(membership)) return 'owner';
  if (membership?.status === 'active' && membership.isCoreLeader === true) return 'coreLeader';
  return null;
}

/** Whether `pathname` is `href` or a page beneath it. */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The Pengaturan hub (P19.17-T3 AC-4; part B: *the 11 sidebar items become one menu item "Pengaturan"*; Phase 19.21). */
export const SETTINGS_HUB = '/kpm/settings';

/**
 * The menu for everybody but the Super Admin: the field menu their rung gives, and the extras for the Owner, the Admins
 * and the core leaders (P19.17-T3 AC-4).
 */
export function fieldNav(
  me: Me | null | undefined, pathname: string,
  /**
   * The items whose names are the reader's words, not kept terms: *Survei* (EN *Surveys*), *Pengaturan* (EN *Settings*)
   * and its *Lainnya* tile, *Pengaturan KPM* (EN *KPM settings*).
   */
  words: { surveys: string; settings?: string; settingsTile?: string } = { surveys: 'Survei' },
): FieldNav {
  const on = (href: string) => isUnder(pathname, href);
  const membership = me?.membership;
  const permissions = me?.permissions ?? [];
  const extras = extrasOf(membership);

  /** A leader by role, never by count (ADR-0189 §1): the rung's class, or running the office. */
  const leader = leadsByRole(membership);
  const activationOpen = me?.activation?.open === true;

  const dest = (
    id: FieldDestinationId, href: string, icon: NavIconName, label: string, short: string = label, extra: Partial<FieldDestination> = {},
  ): FieldDestination => ({ id, href, icon, label, short, active: on(href), ...extra });

  // Part E's icons (brief line 140): the phone *Lainnya* tiles' and the sidebar's, one per item.
  const home = dest('home', '/home', 'ti-home', kept('Home'));
  // Current on every Activity page — Log, Dashboard, Ratio — as the old *Activity management* was.
  const activity = { ...dest('activity', '/activity/log', 'ti-list-check', kept('Activity')), active: on('/activity') };
  const calendar = dest('calendar', '/calendar', 'ti-calendar', kept('Calendar'));
  const unit = dest('unit', '/unit/dashboard', 'ti-chart-bar', kept('Unit Dashboard'), kept('Unit'));
  const searchAgent = dest('searchAgent', '/group-tree', 'ti-search', kept('Search agent'), kept('Search agent'), {
    active: false, opens: 'agentSearch',
  });
  const summary = dest('summary', '/summary', 'ti-report', kept('Personal Summary'), kept('Personal Summary'));

  const saya: FieldDestination[] = [
    /*
     * **The reader's own activation, first** (the lead's intake, 2026-10-30): while it is open, with the amber check at
     * 100%. No mockup tile names it, and dropping it would leave the page reachable from nowhere (ADR-0180).
     */
    ...(activationOpen
      ? [dest('activation', '/activation', 'ti-clipboard-check', kept('Your 90-day activation'), kept('90-day activation'), {
        done: me?.activation?.complete === true,
      })]
      : []),
    dest('leads', '/leads', 'ti-address-book', kept('Leads')),
    dest('goals', '/goals', 'ti-target', kept('Goal Setting')),
    summary,
    dest('training', '/training', 'ti-school', kept('Training')),
    // *Survei* (P19.5-T4; C-R2; OD-267, D-37): every field role's, at all times — the menu follows the role (ADR-0189).
    dest('surveys', '/surveys', 'ti-clipboard-list', words.surveys),
  ];

  const aktivitas: FieldDestination[] = [
    // One entry since P18.5-T12: the plan, the catalog's tabs and every `/proposal*` address (ADR-0221 §8).
    {
      ...dest('sales', '/attack-plan', 'ti-compass', kept('Sales')),
      active: on('/attack-plan') || on('/product-catalog') || on('/proposal'),
    },
    { ...dest('recruitment', '/recruitment/attack-plan', 'ti-user-search', kept('Recruitment')), active: on('/recruitment') },
  ];

  /*
   * *User Mgmt → /user-management/add* (UI-085) for a reader who may add people to their unit
   * (`member:search_untagged_pool`, which an Agent is denied); an Agent's opens on *Register KPM*. Current on all four
   * tabs. Where it opens is the permission's; whether it is offered is the role's.
   */
  const userManagement: FieldDestination = {
    ...dest(
      'userManagement',
      permissions.includes('member:search_untagged_pool') ? '/user-management/add' : '/user-management/kpm',
      'ti-users-group', kept('User Management'), kept('User Mgmt'),
    ),
    active: on('/user-management'),
  };

  /*
   * *Tim saya* (UI-159 item 1, ADR-0189 §1): a leader's in the client's order; an Agent's *User Management* alone.
   * **No *Group Tree* for the Owner and the Admins** (P19.17-T3 AC-4; the brief's *one tree for the owner*): Org tree,
   * under People, is theirs. A core leader keeps it — their own team.
   */
  const timSaya: FieldDestination[] = leader
    ? [
      // The sheet's tile and the sidebar's line name it in full; the bar's tab stays *Unit*.
      { ...unit, short: kept('Unit Dashboard') },
      dest('coaching', '/coaching', 'ti-messages', kept('Coaching')),
      dest('newHires', '/new-hires', 'ti-user-plus', kept('New Hires')),
      userManagement,
      ...(extras === 'owner' ? [] : [dest('groupTree', '/group-tree', 'ti-sitemap', kept('Group Tree'))]),
    ]
    // An Agent with an open activation in reach keeps the New Hires ADR-0106 gave them: data adds, never removes.
    : me?.newHires === true
      ? [dest('newHires', '/new-hires', 'ti-user-plus', kept('New Hires')), userManagement]
      : [userManagement];

  const program: FieldDestination[] = [
    dest('campaign', '/campaigns', 'ti-trophy', kept('Campaign')),
    dest('event', '/events', 'ti-calendar-event', kept('Event')),
  ];

  /*
   * **The extras** (P19.17-T3 AC-4; `PERMISSIONS.md` *Menu*): the Owner's, the Admins' and the core leaders' — the same
   * four KPM items, People without *KPM admins* for a core leader, and *Pengaturan*. Each page keeps its own guard.
   */
  const kpm: FieldDestination[] = [
    dest('kpmOverview', '/kpm/overview', 'ti-layout-dashboard', kept('Overview')),
    dest('advancedAnalytics', '/kpm/advanced-analytics', 'ti-chart-dots', kept('Advanced analytics')),
    // The *Lainnya* tile names it in full, on two lines (`lainnya-owner-mobile`), as the sidebar does.
    dest('forum', '/leader-meetings', 'ti-presentation', kept('Strategic Leader Forum')),
    dest('dataUpload', '/kpm/data-upload', 'ti-upload', kept('Data upload')),
  ];
  const people: FieldDestination[] = [
    dest('allMembers', '/people/members', 'ti-users', kept('All members')),
    dest('importPeople', '/people/import', 'ti-file-import', kept('Import people')),
    dest('orgTree', '/people/org-tree', 'ti-hierarchy-2', kept('Org tree')),
    // The Owner adds and removes admins; an Admin reads the page (ADR-0268 §2). Never a core leader's (`PERMISSIONS.md`).
    ...(extras === 'owner' ? [dest('kpmAdmins', '/people/admins', 'ti-user-shield', kept('KPM admins'))] : []),
  ];
  /*
   * ***Pengaturan***, one item (part B: *the 11 sidebar items become one menu item*): the hub, current on every
   * settings page beneath it and on *Data produk*, which the hub and *Products* open (ADR-0260 §5).
   */
  const settings: FieldDestination = {
    ...dest('settings', SETTINGS_HUB, 'ti-settings', words.settings ?? 'Pengaturan', words.settingsTile ?? 'Pengaturan KPM'),
    active: on(SETTINGS_HUB) || on('/kpm/data-produk'),
  };

  const groups: FieldGroup[] = (
    [
      { id: 'saya', items: saya, railIcon: 'ti-user-circle' },
      { id: 'aktivitas', items: aktivitas, railIcon: 'ti-activity' },
      { id: 'timSaya', items: timSaya, railIcon: 'ti-users-group' },
      { id: 'program', items: program, railIcon: 'ti-trophy' },
      ...(extras
        ? [
          { id: 'kpm', items: kpm, tag: extras, railIcon: 'ti-building-skyscraper' },
          { id: 'people', items: people, tag: extras, railIcon: 'ti-address-book' },
          // Last, and pinned at the laptop sidebar's foot (part E: *Order: … KPM · PEOPLE · Pengaturan last*).
          { id: 'pengaturan', items: [settings], tag: extras, pinned: true },
        ] satisfies FieldGroup[]
        : []),
    ] satisfies FieldGroup[]
  ).filter((group) => group.items.length > 0);

  const fourth = leader ? unit : { ...summary, short: kept('Summary') };
  const tabs = [activity, calendar, home, fourth] as const;
  const onBar = tabs.some((tab) => tab.active);
  const inSheet = !onBar && groups.some((group) => group.items.some((item) => item.active));

  return {
    tabs,
    // P19.13-T2 AC-4 (UI-196, D-20): *Unit Dashboard* fourth for a leader; *Search agent* is the field above (`search`).
    top: [home, activity, calendar, ...(leader ? [{ ...unit, short: kept('Unit Dashboard') }] : [])],
    search: leader ? searchAgent : null,
    groups,
    inSheet,
  };
}

/** The Super Admin's words (`shellMessages.admin`): the reader's language. */
export type AdminWords = MessagesOf<typeof shellMessages.en>['admin'];

/**
 * **The Super Admin's console menu** (P19.23-T1 AC-1; [ADR-0277](../../../docs/04-adr/0277-the-super-admin-console-works-inside-every-kpm-and-reads-adoption-across-them.md)
 * §1; the Super Admin spec §2; `superadmin-tablet` f04, `superadmin-mobile` f01):
 *
 * - **The rail** (tablet and laptop): *Dashboard · KPM · Anggota · Perusahaan · Persetujuan · Langganan* (`top`), then
 *   ***Platform* pinned at the foot** with a line above it (the `console` group, `pinned`: the sidebar pins its last
 *   item); *Keluar* is the account card's, under it.
 * - **The phone's bar**: *Dashboard · KPM · Anggota · Langganan* and *Lainnya*, whose sheet holds *Perusahaan &
 *   template · Persetujuan · Platform* (the `console` group) and *Keluar*.
 * - *Persetujuan* carries the approvals waiting (`approvalsPending`) as the nav's red count.
 *
 * *KPM* is current on every KPM page (`/admin/tenants/…`), *Anggota* on *KPM Owners & Admins* too (`/admin/tenant-admins`,
 * kept for *Kelola data produk*, OD-419), *Perusahaan* on the role ladder, *Persetujuan* on the two old queues' addresses,
 * *Platform* on its sections and the old audit address. Pure, as `fieldNav`.
 */
export function adminNav(pathname: string, words: AdminWords, { approvalsPending = 0 }: { approvalsPending?: number } = {}): FieldNav {
  const on = (href: string) => isUnder(pathname, href);
  const dest = (id: FieldDestinationId, href: string, icon: NavIconName, label: string, extra: Partial<FieldDestination> = {}): FieldDestination => (
    { id, href, icon, label, short: label, active: on(href), ...extra }
  );
  // `/admin` is a prefix of every other console route, so the Dashboard is current on it alone.
  const dashboard = dest('consoleDashboard', '/admin', 'ti-layout-dashboard', words.dashboard, { active: pathname === '/admin' });
  const kpms = dest('consoleKpms', '/admin/tenants', 'ti-building', words.kpm);
  const members = dest('consoleMembers', '/admin/members', 'ti-users', words.members, {
    active: on('/admin/members') || on('/admin/tenant-admins'),
  });
  const companies = dest('consoleCompanies', '/admin/companies', 'ti-briefcase', words.companies, {
    short: words.companiesTile, active: on('/admin/companies') || on('/admin/org-levels'),
  });
  const approvals = dest('consoleApprovals', '/admin/approvals', 'ti-checklist', words.approvals, {
    badge: approvalsPending,
    active: on('/admin/approvals') || on('/admin/kpm-requests') || on('/admin/leader-limit-requests'),
  });
  const billing = dest('consoleBilling', '/admin/billing', 'ti-credit-card', words.billing);
  const platform = dest('consolePlatform', '/admin/platform', 'ti-settings', words.platform, {
    active: on('/admin/platform') || on('/admin/audit'),
  });

  const tabs = [dashboard, kpms, members, billing] as const;
  const groups: FieldGroup[] = [{ id: 'console', items: [companies, approvals, platform], pinned: true }];
  const onBar = tabs.some((tab) => tab.active);
  return {
    tabs,
    top: [dashboard, kpms, members, companies, approvals, billing],
    // No agent picker on the platform (UI-196: *for a role without the picker there is no field*).
    search: null,
    groups,
    inSheet: !onBar && groups.some((group) => group.items.some((item) => item.active)),
  };
}

/**
 * **The Owner's menu, for a Super Admin inside a KPM** (P19.23-T2 AC-5; ADR-0277 §3; the spec §5 *"every owner page
 * opens exactly as the KPM Owner sees it — same menu"*): the Owner's extras as `fieldNav` draws them for an Owner —
 * ***KPM*** (Overview · Advanced analytics · Strategic Leader Forum · Data upload), ***People*** (All members · Import
 * people · Org tree · KPM admins) and ***Pengaturan***, pinned — with their tags, icons and order. **Not the field
 * groups**: *Saya*, *Aktivitas*, *Tim saya* and *Program* are a member's own pages, and the Super Admin is nobody's
 * member there (ADR-0268 §3; OD-419). The phone's bar: *Overview · All members · Data upload · Pengaturan* and
 * *Lainnya*, whose sheet holds the three groups. The floating Super Admin bar is the way back to the console.
 */
export function insideKpmNav(
  pathname: string, words: { surveys: string; settings?: string; settingsTile?: string },
): FieldNav {
  const owner = {
    user: { platformRole: 'none' },
    membership: {
      membershipId: '', kpmId: '', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 0,
    },
    permissions: [],
    activation: null,
    newHires: false,
  } as unknown as Me;
  const nav = fieldNav(owner, pathname, words);
  const groups = nav.groups.filter((group) => group.tag === 'owner');
  const all = groups.flatMap((group) => group.items);
  const find = (id: FieldDestinationId) => all.find((d) => d.id === id)!;
  const settings = find('settings');
  const tabs = [find('kpmOverview'), find('allMembers'), find('dataUpload'), { ...settings, short: settings.label }] as const;
  const onBar = tabs.some((tab) => tab.active);
  return {
    tabs,
    top: [],
    search: null,
    groups,
    inSheet: !onBar && groups.some((group) => group.items.some((item) => item.active)),
  };
}
