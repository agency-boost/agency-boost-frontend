import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession, routeParams, stubFetch } from '../../test/harness';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import ForgotPasswordPage from './forgot-password/page';
import ResetPasswordPage from './reset-password/[token]/page';
import VerifyEmailPage from './verify-email/[token]/page';
import ProfilePage from './profile/page';
import AdminOverviewPage from './admin/page';
import TenantsPage from './admin/tenants/page';
import NewTenantPage from './admin/tenants/new/page';
import CompaniesPage from './admin/companies/page';
import AuditPage from './admin/audit/page';
import MembersPage from './people/members/page';
import MemberPage from './people/members/[membershipId]/page';
import RegisterKpmPage from './user-management/kpm/page';
import KpmOverviewPage from './kpm/overview/page';
import UnitDashboardPage from './unit/dashboard/page';
import LogActivityPage from './activity/log/page';
import FindLeaderPage from './user-management/leader/page';
import AddAgentsPage from './user-management/add/page';
import PendingPage from './user-management/pending/page';
import GroupTreePage from './group-tree/page';
import OrgTreePage from './people/org-tree/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

/**
 * Every Phase 2 screen through axe, in the state a user actually meets it — populated,
 * not empty. An empty table has no header/cell relationships to get wrong, so testing
 * only the loading state would pass while the real screen failed.
 */
const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create', 'company:crud', 'audit_log:read'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: 'Jl. Raya Serpong', contactPhone: null, ownerUserId: null,
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
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0,
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

describe('Phase 2 screens have no axe violations', () => {
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
    stubFetch({ '/admin/tenants': { body: [KPM] }, '/admin/companies': { body: [COMPANY] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });
    await screen.findByText(/without an owner/);
    await expectClean('admin');
  });

  it('admin overview with the sidebar account menu open', async () => {
    // Closed, the menu contributes nothing to check. The open state is the one that
    // can get aria-expanded, focus order or labelling wrong.
    stubFetch({ '/admin/tenants': { body: [KPM] }, '/admin/companies': { body: [COMPANY] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    await expectClean('admin (account menu open)');
  });

  it('tenants, populated', async () => {
    stubFetch({ '/admin/tenants': { body: [KPM] }, '/admin/companies': { body: [COMPANY] } });
    renderWithSession(<TenantsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/tenants');
  });

  it('new tenant', async () => {
    stubFetch({ '/admin/companies': { body: [COMPANY] } });
    renderWithSession(<NewTenantPage />, { me: SUPER_ADMIN });
    await screen.findByLabelText('Office code');
    await expectClean('admin/tenants/new');
  });

  it('companies, list and form together', async () => {
    stubFetch({ '/admin/companies': { body: [COMPANY] } });
    renderWithSession(<CompaniesPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/companies');
  });

  it('the office roster, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
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
              directCount: 0, subtreeCount: 0, isLeader: false, isKpmOwner: false,
              isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
            },
          ],
          nextCursor: '25',
        },
      },
    });
    renderWithSession(<MembersPage />, { me: owner });
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
    renderWithSession(<RegisterKpmPage />, { me: makeMe({ membership: null }) });
    await screen.findByText('Prudential — KPM 0417');
    await expectClean('user-management/kpm');
  });

  it('find your leader, with a request already sent', async () => {
    const joiner = makeMe({
      membership: {
        membershipId: 'mem-me', kpmId: 'kpm-1', hierarchyRole: 'agent',
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
    renderWithSession(<FindLeaderPage />, { me: joiner });
    await screen.findByText('Request sent');
    await expectClean('user-management/leader');
  });

  it('the office overview, real half and placeholder half together', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile'],
    });
    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, settings: { activationWindowDays: 90 } } } });
    renderWithSession(<KpmOverviewPage />, { me: owner });
    await screen.findByText('Arrives in phase 14');
    await expectClean('kpm/overview');
  });

  it('the placeholder landings a leader and an agent reach', async () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-aab', kpmId: 'kpm-1', hierarchyRole: 'aab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
    });
    renderWithSession(<UnitDashboardPage />, { me: leader });
    await screen.findByText('Arrives in phase 13');
    await expectClean('unit/dashboard');

    cleanup();
    renderWithSession(<LogActivityPage />, { me: makeMe() });
    await screen.findByText('Arrives in phase 6');
    await expectClean('activity/log');
  });

  it('the invite screen, with an invite to share and a list of them', async () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:invite', 'member:revoke_invite'],
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
      '/join/invites': {
        body: [
          {
            inviteId: 'inv-1', code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417',
            label: 'September', autoApprove: true, maxUses: 5, useCount: 1,
            expiresAt: '2026-10-01T00:00:00.000Z', revokedAt: null, state: 'active',
          },
        ],
      },
    });
    renderWithSession(<AddAgentsPage />, { me: leader });
    await screen.findByRole('table');
    await expectClean('user-management/add');
  });

  it('the invite screen with a role change waiting to be confirmed', async () => {
    // The confirmation is an inline panel, not a modal — it appears between the row and
    // the rest of the list, which is where a focus or labelling mistake would land.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      permissions: ['member:invite'],
    });
    stubFetch({
      '/join/invites': { body: [] },
      '/join/untagged': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true,
        }],
      },
    });
    renderWithSession(<AddAgentsPage />, { me: leader });
    await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
    await screen.findByLabelText('Why?');
    await expectClean('user-management/add (role change)');
  });

  it('the invite screen with a removal waiting to be confirmed', async () => {
    // The disposition fieldset is the part with structure to get wrong — a legend, two
    // radios sharing a name, and a reason field, all inside a panel that appeared.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      permissions: ['member:invite'],
    });
    stubFetch({
      '/join/invites': { body: [] },
      '/join/untagged': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'KPM0417-003', role: 'aab', directCount: 2, canChangeRole: true,
        }],
      },
    });
    renderWithSession(<AddAgentsPage />, { me: leader });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Rina Wijaya' }));
    await screen.findByLabelText('Type REMOVE to confirm');
    await expectClean('user-management/add (removal)');
  });

  it('the removed list, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
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
            directCount: 0, subtreeCount: 0, isLeader: false, isKpmOwner: false,
            isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
            removedAt: '2026-07-19T04:00:00.000Z',
          }],
          nextCursor: null,
        },
      },
    });
    renderWithSession(<MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await screen.findByRole('table');
    await expectClean('people/members (removed)');
  });

  it('the role change log, populated', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
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
    renderWithSession(<MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));
    await screen.findByRole('table');
    await expectClean('people/members (role change log)');
  });

  it('the approval inbox, with a request and somewhere to route it', async () => {
    const ab = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
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
    renderWithSession(<PendingPage />, { me: ab });
    await screen.findByLabelText('Add to');
    await expectClean('user-management/pending');
  });

  it('the group tree, populated and with a unit closed', async () => {
    // The closed state is the one with an aria-expanded toggle and a hidden subtree to
    // get wrong; the open one is just more cards.
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 1,
      },
      permissions: ['org_tree:read'],
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
    renderWithSession(<GroupTreePage />, { me: leader });
    await screen.findByText('Layer 1');
    await expectClean('group-tree');
  });

  it('the org tree, populated, with a second root', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 1,
      },
      permissions: ['org_tree:read'],
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
    renderWithSession(<OrgTreePage />, { me: owner });
    await screen.findByText('Layer 1');
    await expectClean('people/org-tree');
  });

  it('the Groups tab with a create form open', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
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
    renderWithSession(<MembersPage />, { me: owner });
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
        membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
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
          directCount: 0, subtreeCount: 0, isLeader: false, isKpmOwner: false,
          isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', removedAt: null,
        },
      },
    });
    renderWithSession(<MemberPage params={routeParams({ membershipId: 'mem-1' })} />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
    await screen.findByLabelText('Core Leader');
    await expectClean('people/members/[id] (tags)');
  });

  it('audit log', async () => {
    stubFetch({ '/admin/audit': { body: [AUDIT] }, '/admin/tenants': { body: [KPM] } });
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/audit');
  });
});
