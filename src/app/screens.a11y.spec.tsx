import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import KpmRequestsPage from './(admin)/admin/kpm-requests/page';
import TenantAdminsPage from './(admin)/admin/tenant-admins/page';
import NotificationsPage from './notifications/page';
import TenantLayout from '@/app/(tenant)/layout';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, renderWithSession, routeParams, stubFetch } from '@test/harness';
import LoginPage from './(auth)/login/page';
import RegisterPage from './(auth)/register/page';
import ForgotPasswordPage from './(auth)/forgot-password/page';
import ResetPasswordPage from './(auth)/reset-password/[token]/page';
import VerifyEmailPage from './(auth)/verify-email/[token]/page';
import ProfilePage from './profile/page';
import ActivityTypesPage from './(tenant)/kpm/settings/activity-types/page';
import RatioBenchmarksPage from './(tenant)/kpm/settings/ratio-benchmarks/page';
import LeadStatusesPage from './(tenant)/kpm/settings/lead-statuses/page';
import BranchInfoPage from './(tenant)/kpm/settings/branch-info/page';
import CompanyTemplatePage from './(admin)/admin/companies/[companyId]/template/page';
import AdminOverviewPage from './(admin)/admin/page';
import TenantsPage from './(admin)/admin/tenants/page';
import NewTenantPage from './(admin)/admin/tenants/new/page';
import CompaniesPage from './(admin)/admin/companies/page';
import AuditPage from './(admin)/admin/audit/page';
import MembersPage from './(tenant)/people/members/page';
import MemberPage from './(tenant)/people/members/[membershipId]/page';
import AdminsPage from './(tenant)/people/admins/page';
import RegisterKpmPage from './(agent)/user-management/kpm/page';
import KpmOverviewPage from './(tenant)/kpm/overview/page';
import UnitDashboardPage from './(agent)/unit/dashboard/page';
import LogActivityPage from './(agent)/activity/log/page';
import FindLeaderPage from './(agent)/user-management/leader/page';
import AddAgentsPage from './(agent)/user-management/add/page';
import PendingPage from './(agent)/user-management/pending/page';
import GroupTreePage from './(agent)/group-tree/page';
import OrgTreePage from './(tenant)/people/org-tree/page';
import OrgLevelsPage from './(admin)/admin/org-levels/page';
import TenantRosterImportPage from './(admin)/admin/tenants/[kpmId]/roster/page';
import ChooseAPasswordPage from './choose-a-password/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

/**
 * Screens through axe, in the state a user actually meets it — populated, not empty. An
 * empty table has no header/cell relationships to get wrong, so testing only the loading
 * state would pass while the real screen failed.
 *
 * **Not yet every screen.** Five are still absent: `/`, `/join`,
 * `/admin/tenants/[kpmId]`, `/admin/tenants/[kpmId]/owner` and
 * `/admin/impersonate/[userId]`. `/people/import` renders the same `RosterImport` as
 * `/admin/tenants/[kpmId]/roster`, which is here, so it is covered in substance.
 */
const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: [
    'kpm:list_all', 'kpm:create', 'company:crud', 'audit_log:read',
    // Everybody signed in has an inbox, whatever application they live in.
    'notification:read_inbox', 'notification:mark_read',
  ],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: 'Jl. Raya Serpong', contactPhone: null, ownerUserId: null,
  ownerName: null, ownerEmail: null, companyName: 'Prudential',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: { activationWindowDays: 90 },
};
const COMPANY = {
  _id: 'co-1', name: 'Prudential', slug: 'prudential',
  defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active',
};
const AUDIT = {
  _id: 'a-1', kpmId: null, actorUserId: 'u-root', effectiveUserId: 'u-owner',
  action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1',
  onBehalfOf: true, createdAt: '2026-09-04T02:00:00.000Z',
};

const treeNode = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0,
  isLeader: false, isSelf: false, ...over,
});

async function expectClean(name: string) {
  const results = await axe(document.body, {
    // jsdom cannot sample rendered pixels, so contrast is checked from the tokens
    // themselves in a11y.spec.tsx rather than pretended at here.
    rules: { 'color-contrast': { enabled: false } },
  });
  const violations = results.violations ?? [];
  if (violations.length) {
    throw new Error(
      `${name}: ${violations.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`,
    );
  }
  expect(violations).toHaveLength(0);
}

const OVERVIEW = {
  tiles: { companies: 1, kpms: 8, totalMembers: 1340, agencyBuilders: 61 },
  attention: [{
    tag: 'KPM owner', severity: 'structural' as const,
    title: '2 offices have no Owner',
    detail: 'Nobody can administer an office until an Owner is assigned, and only the platform can assign one.',
    href: '/admin/tenants', actionLabel: 'Review',
  }],
  companies: [
    { companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 8, memberCount: 1340,
      ladder: ['Agent', 'AAB', 'AB'] },
  ],
};

describe('screens have no axe violations', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('login', async () => {
    renderWithSession(<LoginPage />, { me: null });
    await expectClean('login');
  });

  it('login with the development accounts panel, which only renders there', async () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    try {
      renderWithSession(<LoginPage />, { me: null });
      expect(screen.getByText('Development accounts')).toBeInTheDocument();
      await expectClean('login (dev accounts)');
    } finally {
      process.env.NEXT_PUBLIC_APP_ENV = original;
    }
  });

  it('register', async () => {
    renderWithSession(<RegisterPage />, { me: null });
    await expectClean('register');
  });

  it('forgot password', async () => {
    renderWithSession(<ForgotPasswordPage />, { me: null });
    await expectClean('forgot-password');
  });

  it('reset password, including its two validation messages', async () => {
    renderWithSession(<ResetPasswordPage params={routeParams({ token: 't' })} />, { me: null });
    await expectClean('reset-password');
  });

  it('verify email', async () => {
    stubFetch({ '/auth/verify-email': { body: {} } });
    renderWithSession(<VerifyEmailPage params={routeParams({ token: 't' })} />, { me: null });
    await screen.findByText(/verified/);
    await expectClean('verify-email');
  });

  it('profile', async () => {
    renderWithSession(<ProfilePage />, { me: makeMe({ permissions: ['activity_log:create_own'] }) });
    await expectClean('profile');
  });

  it('admin overview, with the unowned-office warning showing', async () => {
    stubFetch({ '/admin/overview': { body: OVERVIEW } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
    await screen.findByText('2 offices have no Owner');
    await expectClean('admin');
  });

  it('admin overview with the sidebar account menu open', async () => {
    // Closed, the menu contributes nothing to check. The open state is the one that
    // can get aria-expanded, focus order or labelling wrong.
    stubFetch({ '/admin/overview': { body: OVERVIEW } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    await expectClean('admin (account menu open)');
  });

  it('tenants, populated', async () => {
    stubFetch({ '/admin/tenants': { body: [KPM] }, '/admin/companies': { body: [COMPANY] } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/tenants');
  });

  it('new tenant', async () => {
    stubFetch({ '/admin/companies': { body: [COMPANY] } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
    await screen.findByLabelText('Office code');
    await expectClean('admin/tenants/new');
  });

  it('companies, list and form together', async () => {
    stubFetch({ '/admin/companies': { body: [COMPANY] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/companies');
  });

  it('the office roster, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/members': {
        body: {
          members: [
            {
              membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
              fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test',
              initials: 'RW', leaderId: null, leaderName: 'Wilson Tanoto', depth: 1,
              directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isKpmOwner: false,
              isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
            },
          ],
          nextCursor: '25',
        },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await screen.findByRole('table');
    await expectClean('people/members');
  });

  it('register KPM, with the directory listed and the leader tab locked', async () => {
    stubFetch({
      '/join/me': {
        body: {
          kpmId: null, kpmLabel: null, registeredAt: null, leaderMembershipId: null,
          leaderName: null, status: 'none', pendingRequestTo: null,
        },
      },
      '/join/kpms': {
        body: [{
          kpmId: 'kpm-1', code: '0417', branchName: 'BSD City Branch',
          companyName: 'Prudential', city: 'Tangerang',
        }],
      },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: makeMe({ membership: null }) });
    await screen.findByText('Prudential — KPM 0417');
    await expectClean('user-management/kpm');
  });

  it('find your leader, with a request already sent', async () => {
    const joiner = makeMe({
      membership: {
        membershipId: 'mem-me', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
        isKpmOwner: false, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['leader:search_directory', 'leader_request:create'],
    });
    stubFetch({
      '/join/me': {
        body: {
          kpmId: 'kpm-1', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch',
          registeredAt: null, leaderMembershipId: null, leaderName: null,
          status: 'pending', pendingRequestTo: 'mem-ab',
        },
      },
      '/join/leaders': {
        body: [
          { membershipId: 'mem-ab', fullName: 'Wilson Tanoto', role: 'ab', unitSize: 4, isCurrentLeader: false, requestSent: true },
          { membershipId: 'mem-aab', fullName: 'Dewi Lestari', role: 'aab', unitSize: 0, isCurrentLeader: false, requestSent: false },
        ],
      },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: joiner });
    await screen.findByText('Request sent');
    await expectClean('user-management/leader');
  });

  it('the office overview, real half and placeholder half together', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, settings: { activationWindowDays: 90 } } } });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
    await screen.findByText('Arrives in phase 14');
    await expectClean('kpm/overview');
  });

  it('the placeholder landings a leader and an agent reach', async () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-aab', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
    });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: leader });
    await screen.findByText('Arrives in phase 13');
    await expectClean('unit/dashboard');

    cleanup();
    renderInLayout(AgentLayout, <LogActivityPage />, { me: makeMe() });
    await screen.findByText('Arrives in phase 6');
    await expectClean('activity/log');
  });

  it('the invite screen, with a code to share and a team below it', async () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: [
        // The screen itself is gated on the pool (P3.6-T2); without it the sweep would
        // scan the denial panel and pass, having looked at nothing.
        'member:invite', 'member:revoke_invite', 'member:search_untagged_pool',
        // The team card is gated on being able to act on a team, so the axe sweep needs
        // these or it scans a screen with the card missing.
        'member:change_role', 'member:remove_from_team',
      ],
    });
    stubFetch({
      '/members/my-team': {
        body: [{
          membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true,
        }],
      },
      '/join/untagged': {
        body: [{
          membershipId: 'mem-un', fullName: 'Fajar Nugroho', initials: 'FN',
          email: 'fajar@kpm0417.test', agentCode: 'KPM0417-011', role: 'agent',
        }],
      },
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: leader });
    // The code, not a table: the list of issued invites went with the lifecycle
    // (P3.6-T1), and axe must scan the panel in its loaded state rather than its skeleton.
    await screen.findByText('JOR417');
    await screen.findByText('Rina Wijaya');
    await expectClean('user-management/add');
  });

  it('the invite screen with a role change waiting to be confirmed', async () => {
    // The confirmation is an inline panel, not a modal — it appears between the row and
    // the rest of the list, which is where a focus or labelling mistake would land.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      // The team card is gated on being able to act on a team, and the screen itself on
      // the pool (P3.6-T2) — without both the sweep scans something other than the
      // screen and passes anyway.
      permissions: [
        'member:invite', 'member:search_untagged_pool',
        'member:change_role', 'member:remove_from_team',
      ],
    });
    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/join/untagged': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true,
        }],
      },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: leader });
    await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
    await screen.findByLabelText('Why?');
    await expectClean('user-management/add (role change)');
  });

  it('the invite screen with a removal waiting to be confirmed', async () => {
    // The disposition fieldset is the part with structure to get wrong — a legend, two
    // radios sharing a name, and a reason field, all inside a panel that appeared.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      // The team card is gated on being able to act on a team, and the screen itself on
      // the pool (P3.6-T2) — without both the sweep scans something other than the
      // screen and passes anyway.
      permissions: [
        'member:invite', 'member:search_untagged_pool',
        'member:change_role', 'member:remove_from_team',
      ],
    });
    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/join/untagged': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'KPM0417-003', role: 'aab', directCount: 2, canChangeRole: true,
        }],
      },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: leader });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Rina Wijaya' }));
    await screen.findByLabelText('Type REMOVE to confirm');
    await expectClean('user-management/add (removal)');
  });

  it('the removed list, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/members': {
        body: {
          members: [{
            membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'removed',
            fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test',
            initials: 'RW', leaderId: null, leaderName: 'Wilson Tanoto', depth: 1,
            directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isKpmOwner: false,
            isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
            removedAt: '2026-07-19T04:00:00.000Z',
          }],
          nextCursor: null,
        },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await screen.findByRole('table');
    await expectClean('people/members (removed)');
  });

  it('the Pending queue, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/join/requests': {
        body: [{
          requestId: 'req-1', membershipId: 'mem-9', fullName: 'Putri Anggraini', initials: 'PA',
          email: 'putri@kpm0417.test', agentCode: 'KPM0417-009', role: 'agent',
          requestedAt: '2026-09-01T00:00:00.000Z', routedFromName: null,
        }],
      },
      '/members': {
        body: {
          members: [{
            membershipId: 'mem-9', agentCode: 'KPM0417-009', role: 'agent', status: 'pending',
            fullName: 'Putri Anggraini', preferredName: null, email: 'putri@kpm0417.test',
            initials: 'PA', leaderId: null, leaderName: null, depth: 0, directCount: 0,
            subtreeCount: 0, isLeader: false, isKpmOwner: false, isKpmAdmin: false,
            joinedAt: null, removedAt: null,
          }],
          nextCursor: null,
          counts: { directory: 8, pending: 1, removed: 0 },
        },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Pending (1)' }));
    await screen.findByRole('table');
    await expectClean('people/members (pending)');
  });

  it('the role change log, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/members/role-changes': {
        body: [{
          membershipId: 'mem-1', fullName: 'Rina Wijaya', agentCode: 'KPM0417-001',
          fromRole: 'agent', toRole: 'aab', reason: 'Ready to lead a unit',
          actorName: 'Wilson Tanoto', changedAt: '2026-08-14T03:20:00.000Z',
        }],
      },
      '/members': { body: { members: [], nextCursor: null } },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));
    await screen.findByRole('table');
    await expectClean('people/members (role change log)');
  });

  it('the approval inbox, with a request and somewhere to route it', async () => {
    const ab = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['leader_request:read_inbox', 'leader_request:approve'],
    });
    stubFetch({
      '/join/requests/routing': {
        body: [{ membershipId: 'mem-aab', fullName: 'Sari Puspita', unitSize: 2 }],
      },
      '/join/requests': {
        body: [{
          requestId: 'req-1', membershipId: 'mem-joiner', fullName: 'Putri Anggraini',
          initials: 'PA', email: 'putri@kpm0417.test', agentCode: 'KPM0417-009',
          role: 'agent', requestedAt: '2026-09-01T00:00:00.000Z', routedFromName: null,
        }],
      },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: ab });
    await screen.findByLabelText('Add to');
    await expectClean('user-management/pending');
  });

  it('the group tree, populated and with a unit closed', async () => {
    // The closed state is the one with an aria-expanded toggle and a hidden subtree to
    // get wrong; the open one is just more cards.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      permissions: ['member:read_profile', 'org_tree:read'],
    });
    stubFetch({
      '/members/tree': {
        body: {
          nodes: [
            treeNode({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP',
                       role: 'ab', layer: 1, isLeader: true, directCount: 1, isSelf: true }),
            treeNode({ membershipId: 'mem-sari', fullName: 'Sari Puspita', initials: 'SP',
                       role: 'aab', layer: 2, leaderId: 'mem-ab', isLeader: true, directCount: 1 }),
            treeNode({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW',
                       layer: 3, leaderId: 'mem-sari' }),
          ],
          leader: { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab' },
          rootIds: ['mem-ab'],
          selfId: 'mem-ab',
          counts: { ab: 0, aab: 1, agent: 1, total: 2 },
        },
      },
    });
    renderInLayout(AgentLayout, <GroupTreePage />, { me: leader });
    await screen.findByText('Layer 1');
    await expectClean('group-tree');
  });

  it('the org tree, populated, with a second root', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 1,
      },
      permissions: ['member:read_profile', 'org_tree:read'],
    });
    stubFetch({
      '/members/tree': {
        body: {
          nodes: [
            treeNode({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT',
                       role: 'ab', layer: 1, isLeader: true, directCount: 1, isSelf: true }),
            treeNode({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP',
                       role: 'ab', layer: 2, leaderId: 'mem-owner' }),
            treeNode({ membershipId: 'mem-orphan', fullName: 'Sari Puspita', initials: 'SP',
                       role: 'aab', layer: 1 }),
          ],
          leader: null,
          rootIds: ['mem-owner', 'mem-orphan'],
          selfId: 'mem-owner',
          counts: { ab: 1, aab: 1, agent: 0, total: 2 },
        },
      },
    });
    renderInLayout(TenantLayout, <OrgTreePage />, { me: owner });
    await screen.findByText('Layer 1');
    await expectClean('people/org-tree');
  });

  it('the Groups tab with a create form open', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/members/groups': {
        body: [{
          groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-1',
          ownerName: 'Rina Wijaya', ownerHasLeft: false, memberCount: 2,
        }],
      },
      '/members/tree': {
        body: {
          nodes: [treeNode({ membershipId: 'mem-1', fullName: 'Rina Wijaya', initials: 'RW' })],
          leader: null, rootIds: ['mem-1'], selfId: null,
          counts: { ab: 0, aab: 0, agent: 1, total: 1 },
        },
      },
      '/members': { body: { members: [], nextCursor: null } },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Groups' }));
    await screen.findByRole('table');
    // The form is where a label, a legend or a select can be got wrong.
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await screen.findByLabelText('Group name');
    await expectClean('people/members (groups)');
  });

  it('the person page with the tag panel open', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/tags': {
        body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: ['grp-1'], isCoreLeader: true },
      },
      '/members/groups': {
        body: [{
          groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-9',
          ownerName: 'Wilson Tanoto', ownerHasLeft: false, memberCount: 1,
        }],
      },
      '/members/mem-1': {
        body: {
          membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
          fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test',
          initials: 'RW', leaderId: null, leaderName: 'Wilson Tanoto', depth: 1,
          directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isKpmOwner: false,
          isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', removedAt: null,
          canChangeRole: true, canPromoteToAb: true, canRemove: true,
        },
      },
    });
    renderInLayout(TenantLayout, <MemberPage params={routeParams({ membershipId: 'mem-1' })} />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
    await screen.findByLabelText('Core Leader');
    await expectClean('people/members/[id] (tags)');
  });

  it('the person page with its role change and removal open (P3.5-T13)', async () => {
    // Both controls are new states, and the removal one is a `fieldset` of radios that
    // only appears for a leader with reports — the shape most likely to be got wrong.
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile', 'member:change_role', 'member:remove_from_team'],
    });
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/tags': { body: { groupIds: [], isCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/mem-1': {
        body: {
          membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'aab', status: 'active',
          fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test',
          initials: 'RW', leaderId: 'mem-ab', leaderName: 'Wilson Tanoto', depth: 1,
          directCount: 3, subtreeCount: 5, isLeader: true, isKpmOwner: false,
          isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', removedAt: null,
          canChangeRole: true, canPromoteToAb: true, canRemove: true,
        },
      },
    });
    renderInLayout(TenantLayout, <MemberPage params={routeParams({ membershipId: 'mem-1' })} />, { me: owner });

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Rina' }));
    await screen.findByLabelText('Type REMOVE to confirm');
    await userEvent.selectOptions(screen.getByLabelText('New role'), 'ab');
    await expectClean('people/members/[id] (role change and removal)');
  });

  it('manage KPM admins, populated and with a revoke waiting', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 1,
      },
      permissions: ['member:read_profile', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list'],
    });
    stubFetch({
      '/members/admins': {
        body: [{
          membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH',
          agentCode: 'KPM0417-002', role: 'ab', grantedAt: '2026-01-14T00:00:00.000Z',
          grantedByName: 'Wilson Tanoto', canRevoke: true,
        }],
      },
      '/members/tree': {
        body: {
          nodes: [treeNode({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' })],
          leader: null, rootIds: ['mem-agus'], selfId: null,
          counts: { ab: 1, aab: 0, agent: 0, total: 1 },
        },
      },
    });
    renderInLayout(TenantLayout, <AdminsPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await screen.findByRole('button', { name: 'Revoke access' });
    await expectClean('people/admins');
  });

  /**
   * The sweep deliberately tests populated screens, which leaves the state every one of
   * them opens in untested. A skeleton is a grid of `aria-hidden` bars inside a live
   * region, and getting that wrong is silent — nothing looks broken, a screen reader is
   * simply told nothing, or told about forty empty cells.
   */
  it('a screen in its loading state, held there', async () => {
    let release = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/members')) {
          await new Promise<void>((r) => { release = r; });
        }
        return { ok: true, status: 200, json: async () => ({ items: [], unreadCount: 0 }) } as Response;
      }),
    );

    renderInLayout(TenantLayout, <MembersPage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
          isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
        },
        permissions: ['member:read_profile'],
      }),
    });

    await screen.findByRole('status');
    await expectClean('members (loading)');
    release();
  });

  it('org role ladder', async () => {
    stubFetch({
      '/admin/org-levels': {
        body: [
          { orgLevelId: 'lvl-1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
          { orgLevelId: 'lvl-2', companyId: 'co-1', code: 'AAB', label: 'AAB', displayOrder: 2, status: 'archived', archivedAt: '2026-09-01T00:00:00.000Z' },
        ],
      },
      '/admin/companies': { body: [COMPANY] },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, {
      me: makeMe({
        ...SUPER_ADMIN,
        permissions: [...SUPER_ADMIN.permissions, 'org_level:read', 'org_level:crud'],
      }),
    });
    await screen.findByRole('table');
    await expectClean('org-levels');
  });

  it('audit log', async () => {
    stubFetch({ '/admin/audit': { body: [AUDIT] }, '/admin/tenants': { body: [KPM] } });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/audit');
  });

  // Three screens the sweep had never seen. It covered 23 of 31 when route groups landed,
  // and the gap was invisible because nothing counts the file against the route tree.

  it('KPM registration requests, with one waiting to be decided', async () => {
    stubFetch({
      '/admin/kpm-requests': {
        body: [{
          requestId: 'req-1', branchName: 'Surabaya Branch', companyId: 'co-1',
          companyName: 'Prudential', requestedByName: 'Rangga Wibisono',
          requestedByEmail: 'rangga@example.test', note: 'Twelve agents already here.',
          status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z',
          decidedAt: null, reason: null, createdKpmId: null,
        }],
      },
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });
    await screen.findByLabelText('KPM code');
    await expectClean('admin/kpm-requests');
  });

  it('the office administrators roster, populated', async () => {
    stubFetch({
      '/admin/tenant-admins': {
        body: [{
          membershipId: 'mem-1', fullName: 'Wilson Tanoto', email: 'wilson@kpm0417.test',
          initials: 'WT', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch',
          isOwner: true, isAdmin: false, grantedAt: null,
        }],
      },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/tenant-admins');
  });

  it('the roster import, with the paste box and its worked examples', async () => {
    // The placeholder is three lines of tab-separated text in a `font-mono` box — worth
    // running axe over precisely because it is doing more than a placeholder usually does.
    stubFetch({
      '/admin/tenants/roster-template': {
        body: {
          header: 'fullName,email,agentCode,role,leaderAgentCode',
          columns: [],
          template: '# example\nfullName,email,agentCode,role,leaderAgentCode\n',
          examples: [
            ['Agus Prasetyo', 'agus@example.test', 'PRU-88001', 'ab', ''],
            ['Puspita, Sari', 'sari@example.test', 'PRU-88002', 'aab', 'PRU-88001'],
            ['Rina Wijaya', 'rina@example.test', 'PRU-88003', 'agent', 'PRU-88002'],
          ],
        },
      },
    });
    renderInLayout(
      AdminLayout,
      <TenantRosterImportPage params={routeParams({ kpmId: 'kpm-1' })} />,
      { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'kpm:import_roster'] }) },
    );
    await screen.findByLabelText('Rows from your spreadsheet');
    await expectClean('admin/tenants/[kpmId]/roster');
  });

  it('choosing your own password, which wears no chrome at all', async () => {
    // Reached by an Agent, an AB and an Owner alike, and deliberately outside every shell:
    // a sidebar here would offer links the API answers 403 for. So nothing else on the
    // page supplies the landmarks, and this is the one screen where that is on purpose.
    renderWithSession(<ChooseAPasswordPage />, { me: makeMe({ mustChangePassword: true }) });
    await screen.findByLabelText('Your new password');
    await expectClean('choose-a-password');
  });

  it('the notifications inbox, with one unread', async () => {
    // Cross-family, so it wears whichever chrome its reader signed in with — this checks
    // it inside the platform console, which is the combination that was broken.
    stubFetch({
      '/notifications': {
        body: {
          items: [{
            notificationId: 'n-1', templateId: 'join_request.approved',
            title: 'You are in', detail: 'Your request was approved.',
            kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null,
          }],
          unread: 1,
        },
      },
    });
    renderWithSession(<NotificationsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('button', { name: 'Mark read' });
    await expectClean('notifications');
  });

  /*
   * The five Phase 4 settings screens (P4-T21).
   *
   * None of them was here, against `frontend/CLAUDE.md`'s "every screen through axe, in
   * its populated state" — and the two accessibility defects P4-T20 found by reading are
   * exactly what this suite exists to find without reading: a hint rendered beside a
   * field rather than linked to it, and a raw code used as a field's label.
   */
  describe('the settings screens', () => {
    const settingsOwner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      // `member:read_profile` is the shell's own gate — being inside the office at all is
      // checked once above every settings route, not in each page. Branch info gates on
      // `kpm:read_profile` instead, because it is the office's identity rather than its
      // configuration.
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
      ],
    });

    const TYPE = {
      id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
      description: 'telepon, WhatsApp, dll', appliesToOrgLevelCodes: [], displayOrder: 1,
      version: 1, status: 'active',
    };
    const TAXONOMY = [{
      id: 'c1', code: 'SELLING', label: 'Selling', description: null,
      appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
      types: [TYPE],
    }];
    const RATIOS = [{
      id: 'r1', code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate',
      numerator: ['SELL_SUBMISSION'], denominator: ['SELL_SUBMISSION'],
      benchmark: 0.15, comparison: 'gte', displayOrder: 1, version: 1, status: 'active',
      origin: 'platform', appliesToOrgLevelCodes: [],
    }];
    const LADDER = [
      { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
      { orgLevelId: 'l2', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 2, status: 'active', archivedAt: null },
    ];

    /** The provider both screens read the ladder from, with the config it caches. */
    const configStubs = {
      '/kpm/config': { body: { activity: TAXONOMY, ratios: RATIOS, leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: LADDER },
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 2, hasUnpublishedChanges: true, publishedAt: null },
      },
    };

    it('activity types, populated and with the publish bar showing', async () => {
      stubFetch({ ...configStubs, '/kpm/settings/activity-types': { body: TAXONOMY } });
      renderInLayout(
        TenantLayout,
        <ActivityTypesPage />,
        { me: settingsOwner },
      );
      await screen.findByText('Submission polis');
      await expectClean('kpm/settings/activity-types');
    });

    it('ratio benchmarks, populated', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/ratio-benchmarks': { body: RATIOS },
        '/kpm/settings/activity-types': { body: TAXONOMY },
      });
      renderInLayout(
        TenantLayout,
        <RatioBenchmarksPage />,
        { me: settingsOwner },
      );
      await screen.findByRole('heading', { name: 'Selling success rate' });
      await expectClean('kpm/settings/ratio-benchmarks');
    });

    it('lead statuses, both ladders reachable', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/lead-statuses': {
          body: [
            {
              pipeline: 'sales',
              statuses: [{
                id: 's1', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued',
                rank: 1, isTerminal: true, version: 1, status: 'active',
              }],
            },
            { pipeline: 'recruitment', statuses: [] },
          ],
        },
      });
      renderInLayout(TenantLayout, <LeadStatusesPage />, { me: settingsOwner });
      await screen.findByText('Paid and issued');
      await expectClean('kpm/settings/lead-statuses');
    });

    it('branch info, with its read-only fields', async () => {
      stubFetch({ ...configStubs, '/kpm/settings/branch-info': { body: KPM } });
      renderInLayout(TenantLayout, <BranchInfoPage />, { me: settingsOwner });
      await screen.findByDisplayValue('BSD City Branch');
      await expectClean('kpm/settings/branch-info');
    });

    it('the company template, with an editor open', async () => {
      stubFetch({
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1,
            status: 'draft', payload: { categories: [TAXONOMY[0]], types: [TYPE] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0,
          },
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      await screen.findByText('SELL_SUBMISSION');
      await expectClean('admin/companies/[companyId]/template');
    });
  });
});
