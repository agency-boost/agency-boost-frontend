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
import RegisterKpmPage from './user-management/kpm/page';
import KpmOverviewPage from './kpm/overview/page';
import UnitDashboardPage from './unit/dashboard/page';
import LogActivityPage from './activity/log/page';
import FindLeaderPage from './user-management/leader/page';
import AddAgentsPage from './user-management/add/page';

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

  it('audit log', async () => {
    stubFetch({ '/admin/audit': { body: [AUDIT] }, '/admin/tenants': { body: [KPM] } });
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    await expectClean('admin/audit');
  });
});
