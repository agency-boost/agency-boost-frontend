import { landingFor } from './landing';
import type { Me } from './session';

/**
 * **Whether a person can open a page of this app** — asked by the login page before it honours `?next=`
 * (the product owner's report, 2026-10-11).
 *
 * The Owner opened an Owner page, signed out, and an Agent signed in on the same device: the login page
 * sent the Agent to the Owner's page, in the Owner's console, because `next` was honoured for whoever
 * signed in. Now `next` is honoured only when `canOpen` says the person who signed in can open it, and
 * anybody else goes to their own landing (`landingFor`).
 *
 * It answers from what decides it in the app itself, and nothing more:
 *
 * 1. **The family** — the route group the page sits in. `(admin)` is the Super Admin's; `(tenant)` is the
 *    office console, an Owner's or an Admin's; `(agent)` is the field view, any active member's (an Owner or
 *    an Admin too, ADR-0114). A Super Admin opens neither of the last two, and a member whose membership is
 *    missing, pending or removed opens only the one page `landingFor` gives them. `(auth)` is for somebody
 *    not signed in, so there is nothing there to return to. The routes outside every group are decided by
 *    their gates alone. The role half of this, `familyAllows`, is also what each shell asks of its reader.
 * 2. **The gates** — every `permission` a page or a layout above it declares, and the one its group's
 *    shell applies when the layout names none; each must be in `me.permissions`.
 * 3. **Owner-only** — what the console's nav hides from an Admin (`ownerOnly` in `tenant-shell.tsx`).
 * 4. **Core Leader** — KPM analytics, which a field member reads only as a Core Leader (`CORE_LEADER_ROUTES`).
 *
 * The tables are kept honest by `route-access.spec.ts`, which reads `src/app` and fails when a page, a
 * gate or an owner-only item here and the files disagree. Like every check in this repository, this one
 * decides where somebody is *sent*, never what they may do: each page still guards itself, and the API
 * refuses whatever the page would not have shown.
 */

/** The route group a page sits in, or `shared` for the routes outside every group. */
export type RouteFamily = 'admin' | 'tenant' | 'agent' | 'auth' | 'shared';

/**
 * Every page in `src/app`, by its address as the app directory spells it: route groups dropped, `[name]`
 * for a segment the address fills in.
 */
const PAGES: Readonly<Record<RouteFamily, readonly string[]>> = {
  admin: [
    '/admin', '/admin/analytics', '/admin/audit', '/admin/billing', '/admin/companies',
    '/admin/companies/[companyId]/template', '/admin/impersonate/[userId]', '/admin/impersonation/[sessionId]',
    '/admin/kpm-requests', '/admin/leader-limit-requests', '/admin/org-levels', '/admin/tenant-admins', '/admin/tenants', '/admin/tenants/new',
    '/admin/tenants/[kpmId]', '/admin/tenants/[kpmId]/owner', '/admin/tenants/[kpmId]/roster',
  ],
  tenant: [
    '/kpm/data-upload', '/kpm/overview',
    '/kpm/settings/activation-checklist', '/kpm/settings/activity-types', '/kpm/settings/branch-info',
    '/kpm/settings/campaigns', '/kpm/settings/capability-mapping', '/kpm/settings/events',
    '/kpm/settings/lead-statuses', '/kpm/settings/products', '/kpm/settings/ratio-benchmarks',
    '/kpm/settings/recruitment-pitch', '/kpm/settings/training', '/kpm/settings/training/[moduleId]',
    '/people/admins', '/people/import', '/people/members', '/people/members/[membershipId]', '/people/org-tree',
  ],
  agent: [
    '/activation', '/activity', '/activity/dashboard', '/activity/log', '/activity/ratio', '/attack-plan',
    '/calendar', '/campaigns', '/campaigns/[campaignCode]',
    '/coaching', '/coaching/me', '/coaching/me/activation', '/coaching/me/training',
    '/coaching/[membershipId]', '/coaching/[membershipId]/activation', '/coaching/[membershipId]/activity',
    '/coaching/[membershipId]/archive/[sessionId]', '/coaching/[membershipId]/goal-setting',
    '/coaching/[membershipId]/leader-notes', '/coaching/[membershipId]/leads', '/coaching/[membershipId]/session',
    '/coaching/[membershipId]/summary', '/coaching/[membershipId]/training',
    '/events', '/events/[eventId]', '/goals', '/group-tree', '/home', '/leads', '/new-hires', '/new-hires/[membershipId]',
    '/product-catalog', '/product-catalog/[productCode]', '/recruitment', '/recruitment/attack-plan',
    '/recruitment/pitch-materials', '/summary', '/training', '/training/[categoryCode]',
    '/training/[categoryCode]/[moduleCode]', '/unit/dashboard', '/unit/dashboard/[membershipId]',
    '/user-management/add', '/user-management/kpm', '/user-management/leader', '/user-management/pending',
  ],
  auth: [
    '/forgot-password', '/login', '/register', '/reset-password/[token]', '/verify-email-change/[token]',
    '/verify-email/[token]',
  ],
  shared: [
    // `/kpm/analytics` since P18.8-T5 (ADR-0159 §3): the Owner's, an Admin's and a Core Leader's, each in their own shell.
    '/', '/choose-a-password', '/join', '/kpm/analytics', '/kpm/analytics/compliance', '/leader-meetings',
    '/leader-meetings/[meetingId]', '/leader-meetings/shared/[token]', '/notifications', '/profile',
  ],
};

/** Every page's family, by its route: `PAGES` turned round. */
export const ROUTES: Readonly<Record<string, RouteFamily>> = Object.fromEntries(
  (Object.entries(PAGES) as [RouteFamily, readonly string[]][])
    .flatMap(([family, routes]) => routes.map((route) => [route, family])),
);

/**
 * A `permission` a page or a layout declares on its `Page`, `RequireSession`, shell or `SettingsScreen`. A
 * page's gate applies to that route exactly; a layout's to every page in its directory and beneath it.
 */
export interface RouteGate {
  route: string;
  on: 'page' | 'layout';
  permission: string;
}

export const GATES: readonly RouteGate[] = [
  // The platform console.
  { route: '/admin/analytics', on: 'page', permission: 'platform_analytics:read' },
  { route: '/admin/billing', on: 'page', permission: 'billing:read_prices' },
  { route: '/admin/companies/[companyId]/template', on: 'page', permission: 'company_template:read' },
  { route: '/admin/impersonation/[sessionId]', on: 'page', permission: 'impersonation:elevate_to_write' },
  // ADR-0157: deciding a leader past an office's limit is AgencyBoost's alone.
  { route: '/admin/leader-limit-requests', on: 'page', permission: 'leader_limit_request:decide' },
  { route: '/admin/org-levels', on: 'page', permission: 'org_level:crud' },
  { route: '/admin/tenants/[kpmId]/roster', on: 'page', permission: 'kpm:import_roster' },
  // The office console.
  { route: '/kpm/data-upload', on: 'page', permission: 'data_upload:read' },
  { route: '/kpm/overview', on: 'page', permission: 'kpm_overview:read' },
  { route: '/kpm/settings/activation-checklist', on: 'page', permission: 'activation_settings:read' },
  { route: '/kpm/settings/activity-types', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/branch-info', on: 'page', permission: 'kpm:read_profile' },
  { route: '/kpm/settings/campaigns', on: 'page', permission: 'campaign_settings:read' },
  { route: '/kpm/settings/capability-mapping', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/events', on: 'page', permission: 'event_settings:read' },
  { route: '/kpm/settings/lead-statuses', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/products', on: 'page', permission: 'product_settings:read' },
  { route: '/kpm/settings/ratio-benchmarks', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/recruitment-pitch', on: 'page', permission: 'kpm:read_profile' },
  { route: '/kpm/settings/training', on: 'page', permission: 'training_settings:read' },
  { route: '/kpm/settings/training/[moduleId]', on: 'page', permission: 'training_settings:read' },
  { route: '/people/admins', on: 'page', permission: 'kpm_admin:grant' },
  { route: '/people/import', on: 'page', permission: 'kpm:import_roster' },
  { route: '/people/org-tree', on: 'page', permission: 'org_tree:read' },
  // The field view.
  { route: '/activation', on: 'page', permission: 'activation:read' },
  { route: '/attack-plan', on: 'page', permission: 'product_catalog:read' },
  { route: '/calendar', on: 'page', permission: 'calendar_entry:read' },
  { route: '/campaigns', on: 'layout', permission: 'campaign:read_list' },
  { route: '/coaching', on: 'page', permission: 'coaching_session:read' },
  { route: '/coaching/me', on: 'page', permission: 'coaching_session:read' },
  { route: '/coaching/me/activation', on: 'page', permission: 'coaching_session:read' },
  { route: '/coaching/me/training', on: 'page', permission: 'coaching_session:read' },
  { route: '/coaching/[membershipId]', on: 'layout', permission: 'coaching_session:read' },
  { route: '/coaching/[membershipId]/activity', on: 'page', permission: 'activity_log:read_raw' },
  { route: '/coaching/[membershipId]/goal-setting', on: 'page', permission: 'goal:read' },
  { route: '/coaching/[membershipId]/leader-notes', on: 'page', permission: 'coaching_profile:read' },
  // UI V1, UI-029 (Phase 18.99 T8): the coachee's leads, read-only, through `GET /leads?owner=`.
  { route: '/coaching/[membershipId]/leads', on: 'page', permission: 'lead:read' },
  { route: '/coaching/[membershipId]/summary', on: 'page', permission: 'personal_summary:read' },
  { route: '/events', on: 'layout', permission: 'event:read_list' },
  { route: '/goals', on: 'page', permission: 'goal:read' },
  { route: '/group-tree', on: 'page', permission: 'org_tree:read' },
  { route: '/leads', on: 'page', permission: 'lead:read' },
  { route: '/new-hires', on: 'page', permission: 'new_hires:read_roster' },
  { route: '/new-hires/[membershipId]', on: 'page', permission: 'activation:read' },
  { route: '/product-catalog', on: 'layout', permission: 'product_catalog:read' },
  { route: '/recruitment', on: 'layout', permission: 'recruitment:read' },
  { route: '/recruitment/pitch-materials', on: 'page', permission: 'recruitment:read' },
  { route: '/training', on: 'layout', permission: 'training_progress:read' },
  { route: '/unit/dashboard', on: 'page', permission: 'unit_dashboard:read' },
  { route: '/unit/dashboard/[membershipId]', on: 'page', permission: 'unit_dashboard:read' },
  { route: '/user-management/add', on: 'page', permission: 'member:search_untagged_pool' },
  { route: '/user-management/pending', on: 'page', permission: 'leader_request:read_inbox' },
  // Outside every group.
  { route: '/kpm/analytics', on: 'layout', permission: 'kpm_analytics:read' },
  { route: '/leader-meetings', on: 'page', permission: 'leader_meeting:read' },
  { route: '/leader-meetings/[meetingId]', on: 'page', permission: 'leader_meeting:read' },
  { route: '/leader-meetings/shared/[token]', on: 'page', permission: 'leader_meeting:read_shared_link' },
  { route: '/notifications', on: 'page', permission: 'notification:read_inbox' },
  { route: '/profile', on: 'page', permission: 'profile:read_self' },
];

/**
 * The gate a group's shell applies to every page in it, which its layout does not spell: the layout renders
 * the shell without a `permission`, so the shell's default is the gate — `AdminShell`'s `kpm:list_all` and
 * `TenantShell`'s `member:read_profile`. `AgentShell` has none.
 *
 * Written as rows under `permission`, as `GATES` is, so the copy scan reads each code as the gate it is
 * (`no-permission-code-in-copy.spec.ts`).
 */
const SHELL_GATES: readonly { family: RouteFamily; permission: string }[] = [
  { family: 'admin', permission: 'kpm:list_all' },
  { family: 'tenant', permission: 'member:read_profile' },
];

export const FAMILY_GATES: Readonly<Partial<Record<RouteFamily, string>>> = Object.fromEntries(
  SHELL_GATES.map((gate) => [gate.family, gate.permission]),
);

/**
 * The console's pages for the Owner alone (`roles-and-permissions.md` §1.6): hidden from an Admin in the
 * nav, decided by `isKpmOwner` (`ownerOnly` in `tenant-shell.tsx`). Since ADR-0027 that is *Manage KPM
 * admins* alone.
 */
export const OWNER_ONLY: readonly string[] = ['/people/admins'];

/**
 * **The pages a field member opens only as a Core Leader** (ADR-0159 §2, P18.8-T5): KPM analytics. The AB and AAB
 * hold its grant, `kpm_analytics:read`, so that a Core Leader's request passes the guard, and the API answers a leader
 * who is not one 404 — a fact of the membership the session carries (`membership.isCoreLeader`), not a permission. The
 * layout draws *Not available to you* for them, and the login page does not send them here.
 */
export const CORE_LEADER_ROUTES: readonly string[] = ['/kpm/analytics', '/kpm/analytics/compliance'];

/**
 * **Whether the reader reads the office's analytics**: the Owner, an Admin, or a Core Leader — tagged, on a leader
 * rung, as `GET /auth/me` resolves it. Nobody outside an office does, a Super Admin outside a support session included.
 */
export function readsOfficeAnalytics(me: Me): boolean {
  const membership = me.membership;
  return Boolean(membership && (membership.isKpmOwner || membership.isKpmAdmin || membership.isCoreLeader));
}

const isDynamic = (segment: string) => /^\[[^\]]+\]$/.test(segment);
const segmentsOf = (route: string) => (route === '/' ? [] : route.slice(1).split('/'));

/** The path part of an address — no query, no hash, no trailing slash — or `null` for one that is not a path. */
function pathnameOf(path: string): string | null {
  const bare = path.split(/[?#]/, 1)[0];
  if (!bare.startsWith('/')) return null;
  return bare.length > 1 && bare.endsWith('/') ? bare.slice(0, -1) : bare;
}

/**
 * The page an address opens, by its route pattern, or `null` when it opens none. `[name]` matches one
 * segment; where two patterns match, the one with a fixed segment first wins, as Next resolves them —
 * `/coaching/me` is its own page, not `/coaching/[membershipId]` with `me` in it.
 */
export function routeFor(path: string): string | null {
  const pathname = pathnameOf(path);
  if (pathname === null) return null;
  const segments = segmentsOf(pathname);
  const matches = Object.keys(ROUTES).filter((route) => {
    const parts = segmentsOf(route);
    return parts.length === segments.length
      && parts.every((part, i) => (isDynamic(part) ? segments[i] !== '' : part === segments[i]));
  });
  matches.sort((a, b) => {
    const pa = segmentsOf(a);
    const pb = segmentsOf(b);
    const at = pa.findIndex((part, i) => isDynamic(part) !== isDynamic(pb[i]));
    return at < 0 ? 0 : isDynamic(pa[at]) ? 1 : -1;
  });
  return matches[0] ?? null;
}

/** Every permission that guards `route`: its group's shell's, its layouts', and its own. */
export function gatesFor(route: string): string[] {
  const family = FAMILY_GATES[ROUTES[route]];
  const declared = GATES
    .filter((gate) => (gate.on === 'page'
      ? gate.route === route
      : route === gate.route || route.startsWith(`${gate.route}/`)))
    .map((gate) => gate.permission);
  return [...new Set([...(family ? [family] : []), ...declared])];
}

/** The three applications that have a chrome of their own: the families a shell can belong to. */
export type ShellFamily = Extract<RouteFamily, 'admin' | 'tenant' | 'agent'>;

/**
 * **Whether a reader belongs in an application at all** — the role half of the family rule, with no address in
 * it. One rule for two callers: `canOpen`, and the three shells, which send a reader who is not of their family
 * to their own landing rather than draw another family's sidebar around them (2026-10-11, `RequireSession`'s
 * `family`).
 *
 * - `admin`: a Super Admin.
 * - `tenant`: the Owner or an Admin of their office, and never a Super Admin.
 * - `agent`: anybody but a Super Admin — a field member, an Owner or an Admin in their field view
 *   (ADR-0114), and a member who is pending or in no office, whose own pages are there.
 *
 * It is the choice `RoleShell` makes, asked the other way round, so a cross-family page always wears a chrome
 * that admits its reader. Inside a support session `me` is the member's, so this follows the member. Whether a
 * pending member may open more than their landing is `canOpen`'s question, not this one.
 */
export function familyAllows(family: RouteFamily, me: Me): boolean {
  const superAdmin = me.user.platformRole === 'super_admin';
  switch (family) {
    case 'shared':
      return true;
    case 'auth':
      return false;
    case 'admin':
      return superAdmin;
    case 'tenant':
      return !superAdmin && Boolean(me.membership?.isKpmOwner || me.membership?.isKpmAdmin);
    case 'agent':
      return !superAdmin;
  }
}

/** Whether this reader can be on this page of its family: `familyAllows`, and the landing rule below. */
function familyAdmits(family: RouteFamily, pathname: string, me: Me): boolean {
  if (!familyAllows(family, me)) return false;
  // Missing, pending or removed: the one page `landingFor` gives them, and no other in the office's apps.
  if ((family === 'tenant' || family === 'agent') && me.membership?.status !== 'active') {
    return pathname === landingFor(me);
  }
  return true;
}

/**
 * Whether `me` can open `path` — an address inside this app, with or without a query and a hash. An
 * address that is no page of the app is not openable, so sign-in lands somewhere rather than on a 404.
 */
export function canOpen(path: string, me: Me | null): boolean {
  if (!me) return false;
  const route = routeFor(path);
  if (route === null) return false;
  if (!familyAdmits(ROUTES[route], pathnameOf(path)!, me)) return false;
  if (OWNER_ONLY.includes(route) && !me.membership?.isKpmOwner) return false;
  if (CORE_LEADER_ROUTES.includes(route) && !readsOfficeAnalytics(me)) return false;
  return gatesFor(route).every((permission) => me.permissions.includes(permission));
}
