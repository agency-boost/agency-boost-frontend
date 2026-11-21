import { landingFor } from './landing';
import type { Me } from './session';
import { insideKpm } from './super-admin-kpm';

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
 * 3. ~~**Owner-only** — what the office view's menu hides from an Admin (`lib/field-nav.ts`).~~ *Gone with ADR-0268 §2:*
 *    the KPM admins page is the Admin's too, read-only, and refused a core leader by its gate (`kpm_admin:list`).
 * 4. **Core Leader** — KPM analytics, which a field member reads only as a Core Leader (`CORE_LEADER_ROUTES`).
 *
 * *Since ADR-0268 (P19.17 F2):* **the office's pages are its stewards'** — the Owner, an Admin, a core leader, and a
 * Super Admin while inside the KPM (`super-admin-kpm.ts`), who is its Owner there.
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
    // P19.23-T1 AC-4 (ADR-0277 §1): `/admin/analytics` only redirects to the Dashboard, whose *Adopsi per KPM* replaces it.
    '/admin', '/admin/analytics', '/admin/audit', '/admin/billing', '/admin/companies',
    // ADR-0185: a company's page, its settings, a template's checklist and a section; the old address redirects.
    '/admin/companies/[companyId]', '/admin/companies/[companyId]/settings', '/admin/companies/[companyId]/template',
    // P19.4-T3 (ADR-0207): *KPM & data* and *All members*. *Lihat sebagai KPM*'s analytics went with KPM Analytics (P19.19).
    '/admin/companies/[companyId]/kpms', '/admin/members',
    // P19.15-T1, T4 AC-1 (ADR-0258 §8): a company's *Proposal* tab.
    '/admin/companies/[companyId]/proposal',
    // P19.23-T4 (ADR-0278): *Produk & proposal*, a product, its details, *Terbitkan ke KPM*, a template's campaigns.
    '/admin/companies/[companyId]/products', '/admin/companies/[companyId]/products/[productId]',
    '/admin/companies/[companyId]/products/details', '/admin/companies/[companyId]/publish',
    '/admin/companies/[companyId]/settings/campaigns',
    '/admin/companies/[companyId]/templates/[templateId]', '/admin/companies/[companyId]/templates/[templateId]/[section]',
    '/admin/impersonate/[userId]', '/admin/impersonation/[sessionId]',
    // P19.23-T3 (ADR-0277): *Persetujuan*; the two queues' old addresses redirect to it.
    '/admin/approvals',
    '/admin/kpm-requests', '/admin/leader-limit-requests', '/admin/org-levels', '/admin/tenant-admins', '/admin/tenants', '/admin/tenants/new',
    '/admin/tenants/[kpmId]', '/admin/tenants/[kpmId]/owner', '/admin/tenants/[kpmId]/roster',
    // P19.23-T6 (ADR-0279): *Platform* and its four sections; `/admin/audit` above only redirects to the first.
    '/admin/platform', '/admin/platform/announcements', '/admin/platform/audit', '/admin/platform/settings',
    '/admin/platform/team',
  ],
  tenant: [
    // P19.15-T4 (ADR-0260 §5): *Data produk*, the insurers' proposal data — a holder's in full, an Owner's or Admin's read-only.
    '/kpm/data-produk',
    '/kpm/data-upload', '/kpm/overview',
    // P19.21-T2 (ADR-0274 §6): the Pengaturan hub, the one item the eleven settings pages sit behind.
    '/kpm/settings',
    '/kpm/settings/activation-checklist', '/kpm/settings/activity-types', '/kpm/settings/branch-info',
    // P19.6-T1 (ADR-0218 §1): *Tampilan KPM*.
    '/kpm/settings/branding',
    '/kpm/settings/campaigns', '/kpm/settings/capability-mapping', '/kpm/settings/events',
    '/kpm/settings/lead-statuses', '/kpm/settings/products', '/kpm/settings/ratio-benchmarks',
    '/kpm/settings/recruitment-pitch', '/kpm/settings/training', '/kpm/settings/training/[moduleId]',
    '/people/admins', '/people/import', '/people/members', '/people/members/[membershipId]', '/people/org-tree',
    // P19.13-T3's *Core leaders & groups* was removed 2026-11-20 (P19.17-T4, ADR-0270): groups are set on All members.
  ],
  agent: [
    '/activation', '/activity', '/activity/dashboard', '/activity/log', '/activity/ratio', '/attack-plan',
    '/calendar', '/campaigns', '/campaigns/[campaignCode]',
    '/coaching', '/coaching/me', '/coaching/me/activation', '/coaching/me/training',
    '/coaching/[membershipId]', '/coaching/[membershipId]/activation', '/coaching/[membershipId]/activity',
    '/coaching/[membershipId]/archive/[sessionId]', '/coaching/[membershipId]/goal-setting',
    '/coaching/[membershipId]/leader-notes', '/coaching/[membershipId]/leads', '/coaching/[membershipId]/session',
    '/coaching/[membershipId]/summary', '/coaching/[membershipId]/survey', '/coaching/[membershipId]/training',
    // `/group-tree/[membershipId]` since P19.3-T3: a leader's Group Tree, read-only, from KPM Analytics' leader sheet.
    '/events', '/events/[eventId]', '/goals', '/group-tree', '/group-tree/[membershipId]', '/home', '/leads', '/new-hires',
    '/new-hires/[membershipId]',
    '/product-catalog', '/product-catalog/[productCode]',
    // P19.7-T2 (ADR-0221 §3, §8): *Riwayat*, step 1 with nothing stored, and a stored proposal's three steps.
    '/proposal', '/proposal/[proposalId]', '/proposal/new',
    '/recruitment', '/recruitment/attack-plan',
    // P19.5-T4 (ADR-0216 §5, §6): the *Survei* tile's page and the form, every field role's.
    '/recruitment/pitch-materials', '/summary', '/surveys', '/surveys/[runId]', '/training', '/training/[categoryCode]',
    '/training/[categoryCode]/[moduleCode]', '/unit/dashboard', '/unit/dashboard/[membershipId]',
    '/user-management/add', '/user-management/kpm', '/user-management/leader', '/user-management/pending',
  ],
  auth: [
    // `/link-account/[token]` was removed 2026-11-20 with the linked login (P19.17-T3, ADR-0269).
    '/forgot-password', '/login', '/register', '/reset-password/[token]',
    '/verify-email-change/[token]', '/verify-email/[token]',
  ],
  shared: [
    // `/kpm/advanced-analytics/*` since P19.5-T4: the KPM's survey tabs, the Owner's, an Admin's and a Core Leader's; the
    // page's index and its other sections since P19.5-T3 (ADR-0215 §1). `/kpm/analytics` and its compliance tab were here
    // from P18.5-T5 to P19.19, which removed them for everyone (ADR-0272 §1).
    '/', '/choose-a-password', '/join', '/kpm/advanced-analytics', '/kpm/advanced-analytics/[section]',
    '/kpm/advanced-analytics/nps', '/kpm/advanced-analytics/qual', '/leader-meetings',
    '/leader-meetings/[meetingId]', '/leader-meetings/shared/[token]', '/notifications', '/profile',
    // P19.23-T2 AC-3 (OD-420): a KPM Owner's claim link, opened signed out or signed in, sign-in coming back to it.
    '/owner-invite/[token]',
    // P19.24-T2 (ADR-0280 §5): the KPM report's *Kirim ke owner* link — signed out it asks to sign in, coming back to it.
    '/laporan-kpm/[token]',
    // P19.23-T2 AC-7 (ADR-0277): *Lihat sebagai*'s new window, chrome-less — the Super Admin's for a moment, then the person's.
    '/view-as',
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
  { route: '/admin/billing', on: 'page', permission: 'billing:read_prices' },
  // ADR-0185: the KPM template's four pages. The old address only redirects, under the console's own gate.
  { route: '/admin/companies/[companyId]', on: 'page', permission: 'company_template:read' },
  { route: '/admin/companies/[companyId]/settings', on: 'page', permission: 'company_template:read' },
  // P19.4-T3 (ADR-0207 §1): the Super Admin's reads across KPMs.
  { route: '/admin/companies/[companyId]/kpms', on: 'page', permission: 'platform_kpm_figures:read' },
  // P19.15-T1, T4 AC-1 (ADR-0258 §8): the company's proposal data; the API asks which company the reader may read.
  { route: '/admin/companies/[companyId]/proposal', on: 'page', permission: 'product_data:read' },
  // P19.23-T4 (ADR-0278): the company's pages through `CompanyFrame`, each with its own gate.
  { route: '/admin/companies/[companyId]/products', on: 'page', permission: 'product_catalog:crud' },
  { route: '/admin/companies/[companyId]/products/[productId]', on: 'page', permission: 'product_catalog:crud' },
  { route: '/admin/companies/[companyId]/products/details', on: 'page', permission: 'product_catalog:crud' },
  { route: '/admin/companies/[companyId]/publish', on: 'page', permission: 'company_template:read' },
  { route: '/admin/companies/[companyId]/settings/campaigns', on: 'page', permission: 'company_template:read' },
  { route: '/admin/members', on: 'page', permission: 'platform_members:read' },
  { route: '/admin/companies/[companyId]/templates/[templateId]', on: 'page', permission: 'company_template:read' },
  { route: '/admin/companies/[companyId]/templates/[templateId]/[section]', on: 'page', permission: 'company_template:read' },
  // P19.23-T3 (ADR-0277): *Persetujuan*, both queues; each decision keeps its own grant at the API. The two old addresses
  // only redirect here, under the console's own gate (ADR-0157's leader queue is one of the two).
  { route: '/admin/approvals', on: 'page', permission: 'kpm_request:read' },
  { route: '/admin/org-levels', on: 'page', permission: 'org_level:crud' },
  // P19.23-T6 (ADR-0279): *Platform*'s sections, each by its own grant, inside the console's.
  { route: '/admin/platform/announcements', on: 'page', permission: 'announcement:read' },
  { route: '/admin/platform/audit', on: 'page', permission: 'audit_log:read' },
  { route: '/admin/platform/settings', on: 'page', permission: 'platform_settings:read' },
  { route: '/admin/platform/team', on: 'page', permission: 'super_admin:read' },
  // P19.4-T2 (ADR-0206 §3, §6): `/admin/impersonation/[sessionId]` and `/admin/tenants/[kpmId]/roster` only redirect, under
  // the console's own gate — the approval's and the import's grants are gone from the Super Admin with them.
  // The office console.
  // P19.15-T4 (ADR-0260 §3, §5): every Owner and Admin reads their company's; agents and leaders hold nothing here.
  { route: '/kpm/data-produk', on: 'page', permission: 'product_data:read' },
  { route: '/kpm/data-upload', on: 'page', permission: 'data_upload:read' },
  { route: '/kpm/overview', on: 'page', permission: 'kpm_overview:read' },
  { route: '/kpm/settings', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/activation-checklist', on: 'page', permission: 'activation_settings:read' },
  { route: '/kpm/settings/activity-types', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/branch-info', on: 'page', permission: 'kpm:read_profile' },
  { route: '/kpm/settings/branding', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/campaigns', on: 'page', permission: 'campaign_settings:read' },
  { route: '/kpm/settings/capability-mapping', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/events', on: 'page', permission: 'event_settings:read' },
  { route: '/kpm/settings/lead-statuses', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/products', on: 'page', permission: 'product_settings:read' },
  { route: '/kpm/settings/ratio-benchmarks', on: 'page', permission: 'tenant_config:read' },
  { route: '/kpm/settings/recruitment-pitch', on: 'page', permission: 'kpm:read_profile' },
  { route: '/kpm/settings/training', on: 'page', permission: 'training_settings:read' },
  { route: '/kpm/settings/training/[moduleId]', on: 'page', permission: 'training_settings:read' },
  // ADR-0268 §2: the Owner adds and removes admins; an Admin reads the page, read-only. A core leader holds no grant here.
  { route: '/people/admins', on: 'page', permission: 'kpm_admin:list' },
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
  // UI V1, UI-029 (Phase 18.11 T8): the coachee's leads, read-only, through `GET /leads?owner=`.
  { route: '/coaching/[membershipId]/leads', on: 'page', permission: 'lead:read' },
  { route: '/coaching/[membershipId]/summary', on: 'page', permission: 'personal_summary:read' },
  { route: '/events', on: 'layout', permission: 'event:read_list' },
  { route: '/goals', on: 'page', permission: 'goal:read' },
  { route: '/group-tree', on: 'page', permission: 'org_tree:read' },
  { route: '/group-tree/[membershipId]', on: 'page', permission: 'org_tree:read' },
  { route: '/leads', on: 'page', permission: 'lead:read' },
  { route: '/new-hires', on: 'page', permission: 'new_hires:read_roster' },
  { route: '/new-hires/[membershipId]', on: 'page', permission: 'activation:read' },
  { route: '/product-catalog', on: 'layout', permission: 'product_catalog:read' },
  { route: '/proposal', on: 'page', permission: 'proposal:read' },
  { route: '/proposal/[proposalId]', on: 'page', permission: 'proposal:read' },
  { route: '/proposal/new', on: 'page', permission: 'proposal:read' },
  { route: '/recruitment', on: 'layout', permission: 'recruitment:read' },
  { route: '/recruitment/pitch-materials', on: 'page', permission: 'recruitment:read' },
  { route: '/training', on: 'layout', permission: 'training_progress:read' },
  { route: '/unit/dashboard', on: 'page', permission: 'unit_dashboard:read' },
  { route: '/unit/dashboard/[membershipId]', on: 'page', permission: 'unit_dashboard:read' },
  { route: '/user-management/add', on: 'page', permission: 'member:search_untagged_pool' },
  { route: '/user-management/pending', on: 'page', permission: 'leader_request:read_inbox' },
  // Outside every group.
  { route: '/kpm/advanced-analytics', on: 'layout', permission: 'advanced_analytics:read' },
  { route: '/leader-meetings', on: 'page', permission: 'leader_meeting:read' },
  { route: '/leader-meetings/[meetingId]', on: 'page', permission: 'leader_meeting:read' },
  { route: '/leader-meetings/shared/[token]', on: 'page', permission: 'leader_meeting:read_shared_link' },
  { route: '/notifications', on: 'page', permission: 'notification:read_inbox' },
  { route: '/profile', on: 'page', permission: 'profile:read_self' },
];

/**
 * The gate a group's layout applies to every page in it, which it does not spell: the layout renders the one shell
 * with its `family` and no `permission`, so the family's gate is the default (`Shell`, P19.2-T1) — the platform's
 * `kpm:list_all` and the office's `member:read_profile`. The field family has none.
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
 * **The pages a field member opens only as a Core Leader** (ADR-0159 §2, P18.5-T5): Advanced analytics. The AB and AAB
 * hold its grant, so that a Core Leader's request passes the guard, and the API answers a leader who is not one 404 — a
 * fact of the membership the session carries (`membership.isCoreLeader`), not a permission. The layout draws *Not
 * available to you* for them, and the login page does not send them here. KPM analytics was here until P19.19 removed it.
 */
export const CORE_LEADER_ROUTES: readonly string[] = [
  '/kpm/advanced-analytics', '/kpm/advanced-analytics/[section]', '/kpm/advanced-analytics/nps', '/kpm/advanced-analytics/qual',
];

/**
 * **Whether the reader reads the office's analytics**: the Owner, an Admin, or a Core Leader — tagged, on a leader
 * rung, as `GET /auth/me` resolves it — and, since ADR-0268 §3, a Super Admin inside the KPM. Nobody outside an office
 * does, a Super Admin who has entered none included.
 */
export function readsOfficeAnalytics(me: Me): boolean {
  return stewardsOffice(me);
}

/**
 * **Whether the reader is one of the KPM's stewards** (ADR-0268 §1–§3): its Owner, an Admin, a core leader — the
 * effective flag `GET /auth/me` resolves — or a Super Admin inside the KPM, as its Owner. A support session follows the
 * member it shows, and a Super Admin who has entered no KPM is none.
 */
export function stewardsOffice(me: Me): boolean {
  if (insideKpm(me)) return true;
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
 * - `tenant`: the office's stewards (ADR-0268): the Owner, an Admin, a core leader, and a Super Admin **while inside a
 *   KPM** (`super-admin-kpm.ts`) — never one who has entered none.
 * - `agent`: anybody but a Super Admin — a field member, an Owner or an Admin in either of their views
 *   (ADR-0198 §7: a view is not a family), and a member who is pending or in no office, whose own pages are there.
 *
 * Until P19.2-T1 it was the choice `RoleShell` made between three shells, asked the other way round. Inside a support session `me` is the member's, so this follows the member. Whether a
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
      return superAdmin ? insideKpm(me) : stewardsOffice(me);
    case 'agent':
      return !superAdmin;
  }
}

/** Whether this reader can be on this page of its family: `familyAllows`, and the landing rule below. */
function familyAdmits(family: RouteFamily, pathname: string, me: Me): boolean {
  if (!familyAllows(family, me)) return false;
  // A Super Admin inside a KPM is nobody's member there, and its Owner (ADR-0268 §3): the office's pages are theirs.
  if (family === 'tenant' && insideKpm(me)) return true;
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
  if (CORE_LEADER_ROUTES.includes(route) && !readsOfficeAnalytics(me)) return false;
  return gatesFor(route).every((permission) => me.permissions.includes(permission));
}
