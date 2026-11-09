import type { NavIconName } from '@/components/ui/nav-icon';
import type { MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { shellMessages } from '@/i18n/messages/shell';
import type { Me } from './session';
import { isOfficeView, type ViewKind } from './views';

/**
 * **The field shell's navigation, in one place** (UI V1, UI-004; D-13, D-20; ADR-0180). The floating tab bar, the
 * *Lainnya* sheet and the desktop sidebar are three drawings of this one model, so the sheet and the sidebar cannot
 * come to differ in their groups, their order, their labels or who sees what — the owner's *both menus match*.
 *
 * **The menu follows the role, never the data** (D-37, UI-159, UI-166; ADR-0189 §1, OD-247's default). A leader by role
 * — an AB or an AAB by class (ADR-0156 §3), whatever the company names the rung, or the office's Owner or an Admin in
 * their field view — always sees *Tim saya*'s five, in this order: *Unit Dashboard, Coaching, New Hires, User
 * Management, Group Tree*, the bar's *Unit* tab and *Search agent*, with or without a team. An Agent keeps *User
 * Management* and sees no leader item; so does somebody in no office yet, who sees every Agent item (UI-166 item 1).
 * Until ADR-0189 this read the graph (OD-23, `directCount > 0`) and an open activation (ADR-0106): a new AB with
 * nobody yet lost most of their menu. The *KPM* group still follows the Core Leader tag (ADR-0159 §3) — a tag that
 * grants, not data — and the reader's own *90-day activation* still shows while it is open. The nav decides what is
 * offered, never what is allowed: every route keeps its own guard (ADR-0189 §6).
 *
 * **An Agent's fourth tab is *Personal Summary*** (O-10): a reader who leads nobody by role has no Unit Dashboard.
 *
 * **Every role's menu since P19.2-T1** (UI-146, UI-147; ADR-0197, ADR-0198): **the office view** of an Owner or an
 * Admin adds, after *Program*, the office's *KPM* (in the place of a Core Leader's) · *Pengaturan* · *People*, with the
 * leader bar; **the Super Admin** has a model of their own, `adminNav` — the bar *Overview · KPMs · Perusahaan · Analytics*
 * and the laptop sidebar's groups as the sheet's (UI-127). A view is a menu, never a permission (ADR-0198 §1).
 *
 * Pure: the session, the path and the view in, the model out — `field-nav.spec.ts` walks it role by role.
 */

/** Every place the field shell can take a reader. */
export type FieldDestinationId =
  | 'home' | 'activity' | 'calendar' | 'unit' | 'searchAgent'
  | 'leads' | 'goals' | 'summary' | 'training' | 'activation' | 'surveys'
  | 'sales' | 'recruitment'
  | 'coaching' | 'newHires' | 'groupTree' | 'userManagement'
  | 'campaign' | 'event'
  | 'forum' | 'kpmAnalytics' | 'advancedAnalytics'
  // The office view's (P19.2-T1 AC-6): *KPM* · *Pengaturan* · *People*.
  | 'kpmOverview' | 'dataUpload'
  | 'activityTypes' | 'leadStatuses' | 'activationChecklist' | 'trainingSettings' | 'capabilityMapping'
  | 'eventsSettings' | 'campaignsSettings' | 'products' | 'recruitmentPitch' | 'branchInfo' | 'branding'
  | 'allMembers' | 'importPeople' | 'orgTree' | 'manageAdmins'
  // The Super Admin's (P19.2-T1 AC-9).
  | 'adminOverview' | 'manageCompanies' | 'orgRoleLadder' | 'allKpms' | 'allMembers' | 'kpmRequests' | 'leaderLimit' | 'billing'
  | 'tenantAdmins' | 'audit' | 'crossPlatformAnalytics';

export interface FieldDestination {
  readonly id: FieldDestinationId;
  readonly href: string;
  readonly icon: NavIconName;
  /**
   * The full name: the desktop sidebar's (D-20, *Desktop has room, so labels are the full names*). A kept term for every
   * field and office item; the Super Admin's come from the catalogue (UI-130), so a string.
   */
  readonly label: string;
  /** The *Lainnya* sheet's tile and the tab bar's label, where the full name is too long for a 4-column tile. */
  readonly short: string;
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
  /** A live count — the leaders waiting past their office's limit (ADR-0157 §3) — drawn as the nav's red pill. */
  readonly badge?: number;
}

/**
 * The *Lainnya* sheet's and the sidebar's groups, in the owner's order (D-20): the field's five, the office view's two
 * after them (UI-147), and the Super Admin's four (UI-127).
 */
export type FieldGroupId =
  | 'saya' | 'aktivitas' | 'timSaya' | 'program' | 'kpm'
  | 'pengaturan' | 'people'
  | 'companies' | 'kpms' | 'platformAdmin' | 'reporting';

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
  /**
   * The desktop sidebar's first section, with no heading: Home · Activity · Calendar, and *Search agent* for a leader.
   * *Unit Dashboard* is *Tim saya*'s first since UI-159 (*same order in the desktop sidebar*), so it is listed once.
   */
  readonly top: readonly FieldDestination[];
  /** Saya · Aktivitas · Tim saya · Program · KPM, each with the reader's items; a group with none is left out. */
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

/** Whether `pathname` is `href` or a page beneath it. */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The field menu — *Akun saya*'s for everybody with a membership or none — and, **in the office view** (`view` is
 * `kpm_owner` or `kpm_admin`, ADR-0198 §2), the same menu with the office's groups after *Program*. The view only
 * chooses the menu: an office view the reader does not hold (not the Owner or an Admin, or not active) draws the field
 * menu, as `viewKindsOf` would never offer it.
 */
export function fieldNav(
  me: Me | null | undefined, pathname: string, view: ViewKind = 'self',
  /** The items whose names are the reader's words, not kept terms: *Survei* (EN *Surveys*), *Tampilan KPM*. */
  words: { surveys: string; branding?: string } = { surveys: 'Survei' },
): FieldNav {
  const on = (href: string) => isUnder(pathname, href);
  const membership = me?.membership;
  const permissions = me?.permissions ?? [];
  const runsTheOffice = membership?.status === 'active' && (membership.isKpmOwner || membership.isKpmAdmin);
  const office = isOfficeView(view) && runsTheOffice;

  /** A leader by role, never by count (ADR-0189 §1): the rung's class, or running the office. */
  const leader = leadsByRole(membership);
  const coreLeader = membership?.isCoreLeader === true;
  const activationOpen = me?.activation?.open === true;

  const dest = (
    id: FieldDestinationId, href: string, icon: NavIconName, label: string, short: string = label, extra: Partial<FieldDestination> = {},
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
    /*
     * ***Survei*** (P19.5-T4; C-R2; OD-267, D-37): **every field role's, at all times**, invited to a run or not — the menu
     * follows the role, never the data (ADR-0189). Its dot, while a run waits, is the sheet's (`useSurveyPending`).
     */
    dest('surveys', '/surveys', 'clipboard', words.surveys),
  ];

  const aktivitas: FieldDestination[] = [
    // One entry since P18.5-T12: the plan, and the catalog's tabs over it; current on either address — and on every
    // `/proposal*` address since P19.7-T2 (ADR-0221 §8): *Riwayat*, the third tab, and the proposal's steps.
    {
      ...dest('sales', '/attack-plan', 'compass', kept('Sales')),
      active: on('/attack-plan') || on('/product-catalog') || on('/proposal'),
    },
    { ...dest('recruitment', '/recruitment/attack-plan', 'users', kept('Recruitment')), active: on('/recruitment') },
  ];

  /*
   * *User Mgmt → /user-management/add* (UI-085) for a reader who may add people to their unit
   * (`member:search_untagged_pool`, which an Agent is denied); an Agent's opens on *Register KPM*, as it always has, where
   * they find their office and their leader. Current on all four tabs. Where it opens is the permission's; whether it
   * is offered is the role's.
   */
  const userManagement: FieldDestination = {
    ...dest(
      'userManagement',
      permissions.includes('member:search_untagged_pool') ? '/user-management/add' : '/user-management/kpm',
      'usersGroup', kept('User Management'), kept('User Mgmt'),
    ),
    active: on('/user-management'),
  };

  /* *Tim saya* (UI-159 item 1, ADR-0189 §1): a leader's five in the client's order; an Agent's *User Management* alone. */
  const timSaya: FieldDestination[] = leader
    ? [
      // The sheet's tile and the sidebar's line name it in full; the bar's tab stays *Unit*.
      { ...unit, short: kept('Unit Dashboard') },
      dest('coaching', '/coaching', 'chat', kept('Coaching')),
      dest('newHires', '/new-hires', 'userPlus', kept('New Hires')),
      userManagement,
      dest('groupTree', '/group-tree', 'tree', kept('Group Tree')),
    ]
    // An Agent with an open activation in reach keeps the New Hires ADR-0106 gave them: data adds, never removes.
    : me?.newHires === true
      ? [dest('newHires', '/new-hires', 'userPlus', kept('New Hires')), userManagement]
      : [userManagement];

  const program: FieldDestination[] = [
    dest('campaign', '/campaigns', 'trophy', kept('Campaign')),
    dest('event', '/events', 'calendar', kept('Event')),
  ];

  /*
   * ***Advanced analytics*** — no longer *Segera hadir* (P19.5-T3 AC-1; OWN UI-024): it opens `/kpm/advanced-analytics`,
   * which goes to the template's first section that is on, for the Owner, the Admins and a Core Leader
   * (`advanced_analytics:read`, roles §3.9 ¶). The role decides, never the data (ADR-0189).
   */
  const advancedAnalytics = { ...dest('advancedAnalytics', '/kpm/advanced-analytics', 'chartUp', kept('Advanced analytics')), active: on('/kpm/advanced-analytics') };

  const kpm: FieldDestination[] = coreLeader
    ? [
      dest('forum', '/leader-meetings', 'megaphone', kept('Strategic Leader Forum'), kept('Leader Forum')),
      dest('kpmAnalytics', '/kpm/analytics', 'chart', kept('KPM Analytics')),
      advancedAnalytics,
    ]
    : [];

  /*
   * **The office view's groups** (P19.2-T1 AC-6; UI-147, ADR-0198 §2), after *Program*: **KPM** — in the place of a Core
   * Leader's, whose forum and analytics it holds — · **Pengaturan** · **People**, the console's items in its order, kept
   * English (§A.1). *Manage KPM admins* is the Owner's alone (§1.6), so an Admin sees *People* without it. Each item
   * shows only where the role can open it (D-20); every page keeps its own guard, and the server its refusals.
   */
  const officeKpm: FieldDestination[] = [
    dest('kpmOverview', '/kpm/overview', 'gauge', kept('Overview')),
    dest('kpmAnalytics', '/kpm/analytics', 'chart', kept('KPM Analytics')),
    advancedAnalytics,
    dest('forum', '/leader-meetings', 'megaphone', kept('Strategic Leader Forum'), kept('Leader Forum')),
    dest('dataUpload', '/kpm/data-upload', 'upload', kept('Data upload')),
  ];
  const pengaturan: FieldDestination[] = [
    dest('activityTypes', '/kpm/settings/activity-types', 'activity', kept('Activity types')),
    dest('leadStatuses', '/kpm/settings/lead-statuses', 'funnel', kept('Lead statuses')),
    dest('activationChecklist', '/kpm/settings/activation-checklist', 'clipboard', kept('Activation checklist')),
    dest('trainingSettings', '/kpm/settings/training', 'graduation', kept('Training')),
    dest('capabilityMapping', '/kpm/settings/capability-mapping', 'ladder', kept('Capability Mapping')),
    dest('eventsSettings', '/kpm/settings/events', 'calendar', kept('Events')),
    dest('campaignsSettings', '/kpm/settings/campaigns', 'trophy', kept('Campaigns')),
    dest('products', '/kpm/settings/products', 'box', kept('Products')),
    dest('recruitmentPitch', '/kpm/settings/recruitment-pitch', 'chat', kept('Recruitment pitch')),
    dest('branchInfo', '/kpm/settings/branch-info', 'sliders', kept('Branch info')),
    // P19.6-T1 AC-2 (ADR-0218 §1): *Pengaturan → Tampilan KPM*, after *Branch info* — the Owner's and the Admins'.
    dest('branding', '/kpm/settings/branding', 'spark', words.branding ?? 'Tampilan KPM'),
  ];
  const people: FieldDestination[] = [
    dest('allMembers', '/people/members', 'users', kept('All members')),
    dest('importPeople', '/people/import', 'userPlus', kept('Import people')),
    dest('orgTree', '/people/org-tree', 'tree', kept('Org tree')),
    ...(membership?.isKpmOwner ? [dest('manageAdmins', '/people/admins', 'shield', kept('Manage KPM admins'))] : []),
  ];

  const groups: FieldGroup[] = (
    [
      { id: 'saya', items: saya },
      { id: 'aktivitas', items: aktivitas },
      { id: 'timSaya', items: timSaya },
      { id: 'program', items: program },
      ...(office
        ? [
          { id: 'kpm', items: officeKpm },
          { id: 'pengaturan', items: pengaturan },
          { id: 'people', items: people },
        ] satisfies FieldGroup[]
        : [{ id: 'kpm', items: kpm }] satisfies FieldGroup[]),
    ] satisfies FieldGroup[]
  ).filter((group) => group.items.length > 0);

  const fourth = leader ? unit : { ...summary, short: kept('Summary') };
  const tabs = [activity, calendar, home, fourth] as const;
  const onBar = tabs.some((tab) => tab.active);
  const inSheet = !onBar && groups.some((group) => group.items.some((item) => item.active));

  return {
    tabs,
    top: [home, activity, calendar, ...(leader ? [searchAgent] : [])],
    groups,
    inSheet,
  };
}

/** The Super Admin's words (`shellMessages.admin`, UI-130): the reader's language, so the bar's *Perusahaan* reads. */
export type AdminWords = MessagesOf<typeof shellMessages.en>['admin'];

/**
 * **The Super Admin's menu** (P19.2-T1 AC-9, AC-10; UI-127, UI-128; ADR-0197 §3, §4; the *Conflicts* row 149):
 *
 * - **The bar**: ***Overview*** (`/admin`) · ***KPMs*** (`/admin/tenants`) · ***Perusahaan*** (`/admin/companies`) ·
 *   ***Analytics*** (`/admin/analytics`), and *Lainnya* fifth — the same bar component, on a phone and a tablet.
 * - **The sheet and the laptop sidebar**: the laptop sidebar's groups, unchanged — **Companies** (Manage companies, Org
 *   role ladder) · **KPMs** (All KPMs, All members, Pending KPM requests, Leaders past the limit, Billing & subscription) · **Platform
 *   admin** (KPM Owners & Admins, Audit / role change log) · **Reporting** (Cross-platform analytics) — with *Overview*
 *   alone and unheaded at the sidebar's top, as before. *Leaders past the limit* carries its pending count.
 *
 * Every Super Admin page is reachable in two taps or fewer: a bar tab, or *Lainnya* then a tile. Pure, as `fieldNav`.
 */
export function adminNav(pathname: string, words: AdminWords, { leaderLimitPending = 0 }: { leaderLimitPending?: number } = {}): FieldNav {
  const on = (href: string) => isUnder(pathname, href);
  const dest = (id: FieldDestinationId, href: string, icon: NavIconName, label: string, extra: Partial<FieldDestination> = {}): FieldDestination => (
    { id, href, icon, label, short: label, active: on(href), ...extra }
  );
  // `/admin` is a prefix of every other admin route, so Overview is current on it alone.
  const overview = dest('adminOverview', '/admin', 'gauge', words.overview, { active: pathname === '/admin' });
  const manageCompanies = dest('manageCompanies', '/admin/companies', 'building', words.manageCompanies);
  const allKpms = dest('allKpms', '/admin/tenants', 'office', words.allKpms);
  const analytics = dest('crossPlatformAnalytics', '/admin/analytics', 'chart', words.crossPlatformAnalytics);

  const groups: FieldGroup[] = [
    { id: 'companies', items: [manageCompanies, dest('orgRoleLadder', '/admin/org-levels', 'ladder', words.orgRoleLadder)] },
    {
      id: 'kpms',
      items: [
        allKpms,
        // P19.4-T3 AC-1 (SA UI-010): *All members*, after *All KPMs*.
        dest('allMembers', '/admin/members', 'users', words.allMembers),
        dest('kpmRequests', '/admin/kpm-requests', 'inbox', words.pendingKpmRequests),
        dest('leaderLimit', '/admin/leader-limit-requests', 'userPlus', words.leadersPastTheLimit, { badge: leaderLimitPending }),
        dest('billing', '/admin/billing', 'receipt', words.billing),
      ],
    },
    {
      id: 'platformAdmin',
      items: [
        dest('tenantAdmins', '/admin/tenant-admins', 'shield', words.tenantAdmins),
        dest('audit', '/admin/audit', 'history', words.audit),
      ],
    },
    { id: 'reporting', items: [analytics] },
  ];

  const tabs = [
    overview,
    { ...allKpms, short: words.barKpms },
    { ...manageCompanies, short: words.barCompanies },
    { ...analytics, short: words.barAnalytics },
  ] as const;
  const onBar = tabs.some((tab) => tab.active);
  return {
    tabs,
    top: [overview],
    groups,
    inSheet: !onBar && groups.some((group) => group.items.some((item) => item.active)),
  };
}
