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
import TrainingSettingsPage from './(tenant)/kpm/settings/training/page';
import TrainingModulePage from './(tenant)/kpm/settings/training/[moduleId]/page';
import KpmProductsPage from './(tenant)/kpm/settings/products/page';
import EventsSettingsPage from './(tenant)/kpm/settings/events/page';
import CampaignsSettingsPage from './(tenant)/kpm/settings/campaigns/page';
import CapabilityMappingPage from './(tenant)/kpm/settings/capability-mapping/page';
import ActivationChecklistPage from './(tenant)/kpm/settings/activation-checklist/page';
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
import DataUploadPage from './(tenant)/kpm/data-upload/page';
import UnitDashboardPage from './(agent)/unit/dashboard/page';
import ActivityDashboardPage from './(agent)/activity/dashboard/page';
import ActivityRatioPage from './(agent)/activity/ratio/page';
import LogActivityPage from './(agent)/activity/log/page';
import LeadsPage from './(agent)/leads/page';
import GoalSettingsPage from './(agent)/goals/page';
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

  it('the month table: every member a row, a dash where nothing has been reported (P9-T1)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile', 'data_upload:read', 'data_upload:download_template'],
    });
    const empty = { value: null, provenance: null };
    const metrics = Object.fromEntries(
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount']
        .map((m) => [m, { monthly: empty, ytd: empty }]),
    );
    stubFetch({
      '/kpm/data-upload/': {
        body: {
          month: '2026-09', withData: 1,
          state: { month: '2026-09', revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
          rows: [
            { membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya',
              metrics: { ...metrics, ape: { monthly: { value: 15000000000, provenance: 'imported' }, ytd: empty } } },
            { membershipId: 'mem-budi', agentCode: 'PRU-002', name: 'Budi Santoso', metrics },
          ],
        },
      },
      // The download link is a control axe should see, so the template arrives too (P9-T2).
      '/kpm/data-upload/template': {
        body: {
          month: '2026-09', version: 1, filename: 'KPM0417-agent-data-Sep-2026.csv',
          header: ['Agent Code', 'Agent Name'], file: 'Agent Code,Agent Name\nPRU-001,"Rina Wijaya"', rowCount: 1,
        },
      },
    });
    renderInLayout(TenantLayout, <DataUploadPage />, { me: owner });
    await screen.findByText('Budi Santoso');
    await screen.findByRole('link', { name: '⬇ Download template' });
    await expectClean('kpm/data-upload');
  });

  it('the month with a figure being corrected, and a refusal on it (P9-T5)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile', 'data_upload:read', 'data_upload:correct_cell'],
    });
    const empty = { value: null, provenance: null };
    const metrics: Record<string, unknown> = Object.fromEntries(
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'].map((m) => [m, { monthly: empty, ytd: empty }]),
    );
    metrics.ape = {
      monthly: { value: 150000000, provenance: 'imported', correction: null },
      ytd: { value: 900000000, provenance: 'corrected', correction: { by: 'Maya Halim', at: '2026-09-26T03:00:00.000Z', reason: 'Carrier restated it' } },
    };
    stubFetch({
      '/kpm/data-upload/': {
        body: {
          month: '2026-09', withData: 1,
          state: { month: '2026-09', revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
          rows: [{ membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', metrics }],
        },
      },
      '/kpm/data-upload/cell': {
        status: 422,
        body: { error: { code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'APE this month is negative.', requestId: 'r' } },
      },
    });
    renderInLayout(TenantLayout, <DataUploadPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Correct APE this month for Rina Wijaya, now Rp 1.500.000' }));
    await userEvent.type(screen.getByLabelText('Why is it being corrected?'), 'Carrier restated it');
    await userEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    await screen.findByText('APE this month is negative.');
    await expectClean('kpm/data-upload with a correction refused');
  });

  it('the month with its lock and its imports, one reverted and one standing (P9-T4)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: [
        'member:read_profile', 'data_upload:read', 'data_upload:read_history', 'data_upload:revert_batch',
        'data_upload:lock_month', 'data_upload:reopen_month',
      ],
    });
    const empty = { value: null, provenance: null };
    const metrics = Object.fromEntries(
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'].map((m) => [m, { monthly: empty, ytd: empty }]),
    );
    const batch = {
      id: 'b-2', month: '2026-09', filename: 'KPM0417-agent-data-Sep-2026-corrected.csv', status: 'committed',
      templateVersion: 1, rowCount: 6, writtenRowCount: 6, cellCount: 72, issueCount: 0,
      committedAt: '2026-09-26T07:00:00.000Z', committedBy: 'Wilson Tanoto', revertedAt: null, revertedBy: null,
      restoredCellCount: 0, keptCellCount: 0, canRevert: true,
    };
    stubFetch({
      '/kpm/data-upload/': {
        body: {
          month: '2026-09', withData: 0,
          state: { month: '2026-09', revision: 3, locked: false, reason: 'reopened', editableUntil: '2026-10-07', changedAt: '2026-09-21T03:00:00.000Z', changedBy: 'Maya Halim' },
          rows: [{ membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', metrics }],
        },
      },
      '/kpm/data-upload/history': {
        body: {
          month: '2026-09',
          batches: [batch, { ...batch, id: 'b-1', status: 'reverted', canRevert: false, revertedAt: '2026-09-25T07:00:00.000Z', revertedBy: 'Maya Halim', restoredCellCount: 96 }],
        },
      },
    });
    renderInLayout(TenantLayout, <DataUploadPage />, { me: owner });
    await screen.findByRole('button', { name: 'Revert' });
    await screen.findByRole('button', { name: 'Lock month' });
    await expectClean('kpm/data-upload with its lock and history');
  });

  it('the preview of a filled file: summary, what is not taken, and the diff (P9-T3)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile', 'data_upload:read', 'data_upload:upload_and_preview'],
    });
    const empty = { value: null, provenance: null };
    const metrics = Object.fromEntries(
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'].map((m) => [m, { monthly: empty, ytd: empty }]),
    );
    const cells = (['monthly', 'ytd'] as const).flatMap((cadence) =>
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'].map((metric) => ({
        metric, cadence, status: 'not_provided',
        before: null as number | null, after: null as number | null, raw: null as string | null,
      })));
    cells[0] = { ...cells[0], status: 'new', after: 150000000, raw: '1.5' };
    cells[1] = { ...cells[1], status: 'refused', raw: '140' };
    // A correction the file would change, with its choice (ADR-0053).
    cells[4] = {
      ...cells[4], status: 'changed', before: 70000000, after: 60000000, raw: '0.6',
      correction: { by: 'Maya Halim', at: '2026-09-26T03:00:00.000Z', reason: 'Carrier restated it', replacedValue: 60000000 },
    } as never;
    stubFetch({
      '/kpm/data-upload/': {
        body: { month: '2026-09', withData: 0, state: { month: '2026-09', revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null }, rows: [{ membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', metrics }] },
      },
      '/kpm/data-upload/preview': {
        body: {
          month: '2026-09', filename: 'filled.csv', templateVersion: 1, encoding: 'utf-8', delimiter: ',',
          summary: { rows: 2, ready: 1, refused: 1, newCells: 1, changedCells: 0, unchangedCells: 0, notProvidedCells: 10, refusedCells: 1, notInFile: 0 },
          rows: [
            {
              line: 2, agentCode: 'PRU-001', membershipId: 'mem-rina', resolvedAgentCode: 'PRU-001', name: 'Rina Wijaya',
              fileName: 'Rina Wijaya', nameDiffers: false, codeRecovered: false, status: 'ready', cells,
              issues: [{ code: 'UPLOAD_VALUE_OUT_OF_RANGE', metric: 'persistency', cadence: 'monthly', message: 'Rolling Persistency (%) — This Month: “140” is above 100.' }],
            },
            {
              line: 3, agentCode: 'PRU-999', membershipId: null, resolvedAgentCode: null, name: null, fileName: 'X',
              nameDiffers: false, codeRecovered: false, status: 'refused', cells: [],
              issues: [{ code: 'UPLOAD_UNKNOWN_AGENT_CODE', metric: null, cadence: null, message: 'No active member of this office has this code.' }],
            },
          ],
        },
      },
    });
    renderInLayout(TenantLayout, <DataUploadPage />, { me: owner });
    const input = await screen.findByLabelText('+ Upload filled template');
    await userEvent.upload(input, new File(['x'], 'filled.csv', { type: 'text/csv' }));
    await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    await screen.findByRole('checkbox', { name: 'FYP this month for Rina Wijaya: Replace with the file’s figure' });
    await expectClean('kpm/data-upload with a preview');
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

  it('the placeholder landing a leader reaches', async () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-aab', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
    });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: leader });
    await screen.findByText('Arrives in phase 13');
    await expectClean('unit/dashboard');
  });

  it('Activity Dashboard, a signpost carrying the section’s tab strip', async () => {
    // A placeholder with chrome: the strip is how a reader learns the other two views exist, and it
    // is the one thing on the page — so a `nav` with an `aria-current` link is all axe has to read.
    renderInLayout(AgentLayout, <ActivityDashboardPage />, {});
    await screen.findByText('Arrives in phase 10');
    await expectClean('activity/dashboard');
  });

  it('Activity Ratios, the same', async () => {
    renderInLayout(AgentLayout, <ActivityRatioPage />, {});
    await screen.findByText('Arrives in phase 10');
    await expectClean('activity/ratio');
  });

  it('Log activity, populated with the office’s own taxonomy (P6-T2)', async () => {
    // It was a `ComingInPhase` sign until P6-T2. Every count is a labelled number input, and
    // the sections are the office's categories — so the axe run is over real form controls
    // rather than over a paragraph.
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [{
            id: 'c1', code: 'LEADS', label: 'Leads', description: null,
            appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
            types: [{
              id: 't1', code: 'LEADS_CONTACTED', label: 'Menghubungi prospek yang sudah ada',
              categoryCode: 'LEADS', description: null, displayOrder: 1, version: 1,
              status: 'active',
            }],
          }],
          ratios: [], leadPipelines: [], version: 1,
        },
      },
      '/kpm/org-levels': { body: [] },
      '/activity/log': {
        body: {
          membershipId: 'mem-1',
          localDate: '2026-03-11',
          entries: [],
          totalCount: 0,
          version: 1,
          frozenAt: null,
          editable: true,
          correctionCount: 0,
        },
      },
      '/activity/compliance': {
        body: {
          membershipId: 'mem-1', compliant7d: false, compliantMonth: false,
          lastLoggedOn: null, windowDays: 7,
        },
      },
      '/activity/summary': {
        body: { from: '2026-03-05', to: '2026-03-11', totals: [], daysLogged: 0, totalCount: 0 },
      },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: makeMe() });

    await screen.findByLabelText('Date');
    await expectClean('activity/log');
  });

  it('the leads table, with its sortable headings and a row of inline editors', async () => {
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [],
          ratios: [],
          leadPipelines: [{
            pipeline: 'sales',
            statuses: [{
              id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1,
              isTerminal: false, isLateStage: false, version: 1, status: 'active',
            }],
          }],
          version: 1,
        },
      },
      '/kpm/org-levels': { body: [] },
      '/leads/summary': {
        body: {
          open: 1, committedThisMonth: 1, recruitmentPipelineNow: 0, recruitmentExpectedToClose: 0,
          attention: { overdue: 1, 'no-next-action': 0, 'no-remarks': 0 },
        },
      },
      '/leads': {
        body: {
          rows: [{
            id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Pak Budi',
            contact: { phone: null, email: null }, lawfulBasis: null, consentAt: null,
            statusCode: 'FOLLOW_UP', thisMonth: true, remarks: 'Hobi golf',
            nextActionDate: '2026-10-02', nextActionNote: null, outcome: null, source: null,
            dateRegistered: '2026-09-04T03:00:00.000Z', version: 2, flags: ['overdue'],
            overdueDays: 9, committedMonths: ['2026-09'],
            lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' },
          }],
          total: 1, page: 1, pageSize: 50,
        },
      },
      // The two closed cards below the table fetch a page each, keyed on the query so they do not
      // borrow the table's rows. Populated, because the reopen pill is a control axe should see.
      'outcome=won': {
        body: {
          rows: [{
            id: 'w1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Wulan Sari',
            contact: { phone: null, email: null }, lawfulBasis: null, consentAt: null,
            statusCode: 'PAID_AND_ISSUED', thisMonth: false, remarks: null,
            nextActionDate: null, nextActionNote: null, outcome: 'won', source: null,
            dateRegistered: '2026-08-01T03:00:00.000Z', version: 3, flags: [],
            overdueDays: null, committedMonths: [], lastEditedBy: null,
          }],
          total: 12, page: 1, pageSize: 5,
        },
      },
      'outcome=lost': { body: { rows: [], total: 0, page: 1, pageSize: 5 } },
    });
    renderInLayout(AgentLayout, <LeadsPage />, {
      me: makeMe({ permissions: ['lead:read', 'lead:update', 'lead:mark_outcome'] }),
    });

    // The detail panel is part of the row, so it is walked open rather than left closed.
    await userEvent.click(await screen.findByRole('button', { name: 'Details' }));
    await screen.findByRole('heading', { name: 'Closed leads' });
    await expectClean('leads');
  });

  it('goal settings: five numbered cards, two entry modes and a live cascade', async () => {
    const period = String(new Date().getFullYear());
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'PRU-001', role: 'agent', directCount: 0, canChangeRole: false,
        }],
      },
      // Two versions, so the history panel is walked open rather than absent.
      [`/goals/${String(new Date().getFullYear())}/history`]: {
        body: [2, 1].map((version) => ({
          version, at: '2026-01-13T04:00:00.000Z', byMembershipId: 'mem-1', byName: 'Ibu Sari',
          mode: 'direct', annualApeTargetMinor: version === 2 ? 500_000_000_00 : 300_000_000_00,
          savingsTargetMinor: 50_000_000_00, commissionRatePct: 10, monthsLeftOverride: null,
          apeAchievedMinor: 0, caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
          snapshot: {
            monthlyApeTargetMinor: 60_000_000_00,
            policiesPerMonth: 4, appointmentsPerMonth: 14, leadsPerMonth: 47,
          },
        })),
      },
      '/goals': {
        body: {
          period,
          mode: 'direct',
          annualApeTargetMinor: 500_000_000_00,
          savingsTargetMinor: 50_000_000_00,
          commissionRatePct: 10,
          monthsLeft: 5,
          monthsLeftIsOverride: false,
          apeAchievedMinor: 0,
          achieved: { minor: 0, provenance: 'self_reported', month: null },
          caseSizeMinor: 18_000_000_00,
          leadsToApptPct: 30,
          closingRatePct: 30,
          snapshot: {
            monthlyApeTargetMinor: 100_000_000_00,
            policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67,
          },
          projected: {
            annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 0,
            remainingApeMinor: 500_000_000_00, monthlyApeTargetMinor: 100_000_000_00,
            policiesPerMonth: 6, policiesPerWeek: 2,
            appointmentsPerMonth: 20, appointmentsPerWeek: 5,
            leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false,
          },
          cascadeMapping: {
            leadsCode: 'LEADS_CONTACTED',
            appointmentsCode: 'SELL_PRESENTATION',
            closingsCode: 'SELL_SUBMISSION',
          },
          savedAt: '2026-09-13T04:00:00.000Z',
          savedByMembershipId: 'mem-leader',
        },
      },
    });
    renderInLayout(AgentLayout, <GoalSettingsPage />, {
      me: makeMe({ permissions: ['goal:read', 'goal:update'] }),
    });

    await screen.findByRole('button', { name: 'Save goal' });
    await expectClean('goals');
  });

  it('goal settings: five numbered cards, two entry modes and a live cascade, measured against the carrier’s figure (P9-T6)', async () => {
    const period = String(new Date().getFullYear());
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/members/my-team': {
        body: [{
          membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW',
          agentCode: 'PRU-001', role: 'agent', directCount: 0, canChangeRole: false,
        }],
      },
      // Two versions, so the history panel is walked open rather than absent.
      [`/goals/${String(new Date().getFullYear())}/history`]: {
        body: [2, 1].map((version) => ({
          version, at: '2026-01-13T04:00:00.000Z', byMembershipId: 'mem-1', byName: 'Ibu Sari',
          mode: 'direct', annualApeTargetMinor: version === 2 ? 500_000_000_00 : 300_000_000_00,
          savingsTargetMinor: 50_000_000_00, commissionRatePct: 10, monthsLeftOverride: null,
          apeAchievedMinor: 0, caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
          snapshot: {
            monthlyApeTargetMinor: 60_000_000_00,
            policiesPerMonth: 4, appointmentsPerMonth: 14, leadsPerMonth: 47,
          },
        })),
      },
      '/goals': {
        body: {
          period,
          mode: 'direct',
          annualApeTargetMinor: 500_000_000_00,
          savingsTargetMinor: 50_000_000_00,
          commissionRatePct: 10,
          monthsLeft: 5,
          monthsLeftIsOverride: false,
          apeAchievedMinor: 0,
          achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' },
          caseSizeMinor: 18_000_000_00,
          leadsToApptPct: 30,
          closingRatePct: 30,
          snapshot: {
            monthlyApeTargetMinor: 100_000_000_00,
            policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67,
          },
          projected: {
            annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 0,
            remainingApeMinor: 500_000_000_00, monthlyApeTargetMinor: 100_000_000_00,
            policiesPerMonth: 6, policiesPerWeek: 2,
            appointmentsPerMonth: 20, appointmentsPerWeek: 5,
            leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false,
          },
          cascadeMapping: {
            leadsCode: 'LEADS_CONTACTED',
            appointmentsCode: 'SELL_PRESENTATION',
            closingsCode: 'SELL_SUBMISSION',
          },
          savedAt: '2026-09-13T04:00:00.000Z',
          savedByMembershipId: 'mem-leader',
        },
      },
    });
    renderInLayout(AgentLayout, <GoalSettingsPage />, {
      me: makeMe({ permissions: ['goal:read', 'goal:update'] }),
    });

    await screen.findByRole('button', { name: 'Save goal' });
    await expectClean('goals');
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
      // checked once above every settings route, not in each page. Branch info reads under
      // `kpm:read_profile` instead, because it is the office's identity rather than its
      // configuration — and writes under `tenant_config:write` like the rest (ADR-0027), so
      // its form is checked here with Save on screen.
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
      ],
    });

    /** The one grant ADR-0027 keeps separate, so the approval queue has its controls (P5-T10). */
    const settingsApprover = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
        'sales_script:approve',
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
      benchmark: 0.15, comparison: 'gte', displayUnit: 'percent', displayOrder: 1, version: 1,
      status: 'active', origin: 'platform', appliesToOrgLevelCodes: [],
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

    const TRAINING = [{
      id: 'tc1', code: 'SALES', label: 'Sales', description: 'Structured modules.', displayOrder: 1,
      version: 1, status: 'active',
      skills: [{
        id: 'ts1', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting', displayOrder: 1,
        version: 1, status: 'active',
        modules: [
          {
            id: 'tm1', code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List',
            publishState: 'published', displayOrder: 1, version: 1, status: 'active',
          },
          {
            id: 'tm2', code: 'COLD_CALLS', skillCode: 'PROSPECTING', title: 'Cold calls',
            publishState: 'draft', displayOrder: 2, version: 1, status: 'active',
          },
        ],
      }],
    }];

    /*
     * P5-T1. Modules is the subtab with the most on it — two filters, a badge and three controls a
     * row — and the add panel opened over it, where a suggested code sits beside its label.
     */
    it('training, on Modules with the add panel open', async () => {
      window.history.replaceState(null, '', '/kpm/settings/training#modules');
      stubFetch({ ...configStubs, '/kpm/settings/training': { body: TRAINING } });
      renderInLayout(TenantLayout, <TrainingSettingsPage />, { me: settingsOwner });
      await screen.findByText('Building Your Prospect List');
      await userEvent.click(screen.getByRole('button', { name: '+ Add module' }));
      await expectClean('kpm/settings/training');
      window.history.replaceState(null, '', '/');
    });

    it('the office’s Capability Mapping (P5-T8)', async () => {
      const e = (code: string, label: string, order = 1) =>
        ({ code, label, displayOrder: order, status: 'active' });
      stubFetch({
        ...configStubs,
        '/kpm/settings/capability-mapping': {
          body: {
            stages: [{
              ...e('COMPETENT_PRODUCER', 'Competent Producer'),
              requiredMilestoneCodes: ['SELLS_INDEPENDENTLY'], stageOrder: 1,
            }],
            milestones: [e('SELLS_INDEPENDENTLY', 'Sells policies independently')],
            grids: [{
              ...e('PERSONAL_SELLING', 'Personal selling'),
              requiresDownline: false,
              items: [e('APPROACH', 'Approach & appointment setting')],
            }],
            version: 1,
          },
        },
      });
      renderInLayout(TenantLayout, <CapabilityMappingPage />, { me: settingsOwner });

      // Two halves now, the same two the Company template has. Both are walked.
      await screen.findByRole('heading', { name: 'The ladder' });
      await expectClean('kpm/settings/capability-mapping#ladder');

      await userEvent.click(screen.getByRole('link', { name: 'Skills' }));
      await screen.findByText('Approach & appointment setting');
      await expectClean('kpm/settings/capability-mapping#skills');
    });

    it('the office’s Campaigns, on the carrier-rules tab (P5-T7)', async () => {
      const money = (value: number) => ({
        metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte',
        value, unit: 'idr_minor',
      });
      stubFetch({
        ...configStubs,
        '/kpm/settings/campaigns/rules': {
          body: [
            {
              id: 't1', kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club',
              appliesToOrgLevelCodes: [],
              criteriaGroups: [{ mode: 'all', criteria: [money(120_000_000_000)] }],
              groupMode: 'all', reward: 'Promotion bonus', rank: 1, waitingOnMetrics: [],
            },
            {
              id: 'm1', kind: 'moc', code: 'MOC_AB', name: 'Maintenance of Contract — AB',
              appliesToOrgLevelCodes: ['AB'],
              criteriaGroups: [{
                mode: 'all',
                criteria: [{
                  metricKey: 'NET_APE', metricName: 'NET_APE', comparator: 'gte',
                  value: 60_000_000_000, unit: 'idr_minor',
                }],
              }],
              groupMode: 'any', reward: '', rank: 1, waitingOnMetrics: ['NET_APE'],
            },
          ],
        },
        '/kpm/settings/campaigns': {
          body: [{
            id: 'c1', code: 'YEAR_END_DRIVE', title: 'Year-End Star Club Drive',
            description: 'Push to Star Club.', startsAt: '2026-10-01T00:00:00.000Z',
            endsAt: '2026-12-31T16:59:59.000Z', phase: 'running',
            requirements: [money(50_000_000_000)], reward: 'Extra unit budget',
            status: 'active', version: 1,
          }],
        },
      });
      renderInLayout(TenantLayout, <CampaignsSettingsPage />, { me: settingsOwner });
      await screen.findByRole('checkbox', { name: 'Show archived' });
      await userEvent.click(screen.getByRole('link', { name: 'Production club tiers' }));
      await screen.findByText('Star Club');
      await expectClean('kpm/settings/campaigns');
    });

    it('the office’s Events, with the add panel open (P5-T6)', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/events/types': {
          body: [{
            id: 't1', code: 'TRAINING', label: 'Training', description: null, emoji: '📚',
            color: '#2D9CDB', displayOrder: 1, status: 'active', events: 2,
          }],
        },
        '/kpm/settings/events': {
          body: [{
            id: 'e1', code: 'KICKOFF', typeCode: 'TRAINING', title: 'Kickoff 2026',
            blurb: 'The year ahead', description: '',
            startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T06:00:00.000Z',
            startsOn: '2026-10-01', location: 'Jakarta', locationUrl: null,
            audience: { issuer: 'kpm', scope: 'all_agents', inviteeMembershipIds: [] },
            phase: 'upcoming', status: 'active', version: 1,
          }],
        },
      });
      renderInLayout(TenantLayout, <EventsSettingsPage />, { me: settingsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
      await expectClean('kpm/settings/events');
    });

    it('the office’s Products, with one product open (P5-T5)', async () => {
      const f = <T,>(value: T, overridden = false) => ({ value, overridden });
      stubFetch({
        ...configStubs,
        '/kpm/settings/branch-info': {
          body: { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' },
        },
        '/kpm/settings/products': {
          body: [{
            productId: 'p1', code: 'PRUMAPAN', companyName: 'PRUMapan', channel: 'conventional',
            category: 'life', lifecycle: 'active', sellable: true,
            active: f(true), displayName: f('PRUMapan'),
            script: {
              goodFit: f('Young families'), opening: f('Halo?'), benefits: f(['Proteksi']),
              fullScript: f('Halo.'), objectionTheySay: f('Mahal.'),
              objectionYouSay: f('Bisa disesuaikan.'), nextAction: f('Ilustrasi?'),
            },
            reviewState: 'pending', rejectionReason: null,
            documents: [
              { slot: 'brochure', label: 'Brochure', storageKey: 'k1', filename: 'ours.pdf', source: 'kpm' },
              { slot: 'illustration', label: 'Illustration / Simulation', storageKey: null, filename: null, source: 'none' },
              { slot: 'productDoc', label: 'Product Document', storageKey: null, filename: null, source: 'none' },
            ],
          }],
        },
      });
      renderInLayout(TenantLayout, <KpmProductsPage />, { me: settingsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
      await expectClean('kpm/settings/products');
    });

    it('the Script approvals queue, with one waiting and a send-back open (P5-T10)', async () => {
      const f = <T,>(value: T, overridden = false) => ({ value, overridden });
      stubFetch({
        ...configStubs,
        '/kpm/settings/branch-info': {
          body: { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' },
        },
        '/kpm/settings/products/p1/script/effective': {
          body: { source: 'company', script: {} },
        },
        '/kpm/settings/products': {
          body: [{
            productId: 'p1', code: 'PRUMAPAN', companyName: 'PRUMapan', channel: 'conventional',
            category: 'life', lifecycle: 'active', sellable: true,
            active: f(true), displayName: f('PRUMapan'),
            script: {
              goodFit: f('Young families'), opening: f('Halo dari kami!', true),
              benefits: f(['Proteksi']), fullScript: f('Halo.'), objectionTheySay: f('Mahal.'),
              objectionYouSay: f('Bisa disesuaikan.'), nextAction: f('Ilustrasi?'),
            },
            reviewState: 'pending', rejectionReason: null,
            documents: [
              { slot: 'brochure', label: 'Brochure', storageKey: null, filename: null, source: 'none' },
              { slot: 'illustration', label: 'Illustration / Simulation', storageKey: null, filename: null, source: 'none' },
              { slot: 'productDoc', label: 'Product Document', storageKey: null, filename: null, source: 'none' },
            ],
          }],
        },
      });
      renderInLayout(TenantLayout, <KpmProductsPage />, { me: settingsApprover });
      await userEvent.click(await screen.findByRole('link', { name: 'Script approvals' }));
      // Opened: the reason box is the one control that appears only on the way to a decision.
      await userEvent.click(await screen.findByRole('button', { name: 'Send back' }));
      await expectClean('kpm/settings/products#approvals');
    });

    it('a training module, with its switch and its Files, Videos and Links (P5-T2)', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/training': { body: TRAINING },
        '/kpm/settings/training/modules/PROSPECT_LIST/content': {
          body: {
            moduleCode: 'PROSPECT_LIST',
            title: 'Building Your Prospect List',
            content: {
              files: [{
                id: 'f1', label: 'Prospecting deck', storageKey: 'dev/kpm-a/training/0001',
                mimeType: 'application/pdf', bytes: 2097152,
              }],
              videos: [],
              links: [{ id: 'l1', label: 'Webinar', url: 'https://example.com/a' }],
            },
            companyContent: { files: [], videos: [], links: [] },
            overridden: true,
          },
        },
      });
      renderInLayout(
        TenantLayout,
        <TrainingModulePage params={routeParams({ moduleId: 'tm1' })} />,
        { me: settingsOwner },
      );
      await screen.findByRole('switch', { name: 'Published' });
      await screen.findByRole('heading', { name: 'Files' });
      await expectClean('kpm/settings/training/[moduleId]');
    });

    /* P5-T3. One aspect open with its link select, its Add item panel, and the draft bar. */
    it('the activation checklist, with an item’s add panel open', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/training': { body: TRAINING },
        '/kpm/settings/activation-checklist': {
          body: {
            windowDays: 90,
            draft: null,
            published: {
              id: 'v1',
              version: 1,
              status: 'published',
              publishedAt: '2026-09-01T00:00:00.000Z',
              aspects: [{
                code: 'INTRODUCTION',
                label: '1. Introduction',
                displayOrder: 1,
                items: [
                  {
                    code: 'INSURANCE_BASICS', label: 'Learn insurance basics', displayOrder: 1,
                    autoLink: null, link: null,
                  },
                  {
                    code: 'GOAL_SETTING', label: 'Goal setting: APE & activity targets', displayOrder: 2,
                    autoLink: 'feature:goals',
                    link: {
                      kind: 'feature:goals', label: 'Goal Settings', route: '/goals',
                      completesWhen: 'the hire has saved any goal', live: false, livePhase: 11,
                    },
                  },
                ],
              }],
            },
          },
        },
      });
      renderInLayout(TenantLayout, <ActivationChecklistPage />, { me: settingsOwner });
      await screen.findByText('Learn insurance basics');
      await userEvent.click(screen.getByRole('button', { name: '+ Add item' }));
      await expectClean('kpm/settings/activation-checklist');
    });

    it('the company template’s Training tab', async () => {
      stubFetch({
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1,
            status: 'draft', payload: { categories: [TAXONOMY[0]], types: [TYPE] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/template/training_taxonomy': {
          body: {
            id: 'tpl-3', companyId: 'c1', kind: 'training_taxonomy', version: 1, status: 'draft',
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
            payload: {
              categories: [{ code: 'SALES', label: 'Sales', description: null }],
              skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
              modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' }],
            },
          },
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      await screen.findByText('Submission polis');
      await userEvent.click(screen.getByRole('link', { name: 'Training' }));
      await screen.findByText('1 skill · 1 module published');
      await expectClean('admin/companies/[companyId]/template#training');
    });

    it('the Company template’s Events, Campaigns and Capability tabs (P5-T9)', async () => {
      stubFetch({
        ...configStubs,
        '/admin/companies/c1/template/event_types': {
          body: {
            id: 'tpl-4', companyId: 'c1', kind: 'event_types', version: 1, status: 'draft',
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
            payload: {
              types: [{
                code: 'TRAINING', label: 'Training', description: null,
                emoji: '📚', color: '#2D9CDB', displayOrder: 1,
              }],
            },
          },
        },
        '/admin/companies/c1/template/campaign_kinds': {
          body: {
            id: 'tpl-5', companyId: 'c1', kind: 'campaign_kinds', version: 1, status: 'draft',
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
            payload: {
              rules: [{
                kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', rank: 1,
                reward: 'Promotion bonus', groupMode: 'all',
                criteriaGroups: [{
                  mode: 'all',
                  criteria: [{ metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 120000000000 }],
                }],
              }],
            },
          },
        },
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1,
            status: 'draft', payload: { categories: [TAXONOMY[0]], types: [TYPE] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/template/capability_ladder': {
          body: {
            id: 'tpl-6', companyId: 'c1', kind: 'capability_ladder', version: 1, status: 'draft',
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
            payload: {
              stages: [{
                code: 'COMPETENT', label: 'Competent', requiredMilestoneCodes: ['SELLS'],
                stageOrder: 1,
              }],
              milestones: [{ code: 'SELLS', label: 'Sells independently' }],
              grids: [{
                code: 'PERSONAL', label: 'Personal selling', requiresDownline: false,
                items: [{ code: 'APPROACH', label: 'Approach' }],
              }],
            },
          },
        },
        '/metrics': {
          body: [{
            key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true,
          }],
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      await screen.findByText('Submission polis');

      await userEvent.click(screen.getByRole('link', { name: 'Events' }));
      await screen.findByText(/every new office of this company starts with/);
      await expectClean('admin/companies/[companyId]/template#events');

      await userEvent.click(screen.getByRole('link', { name: 'Campaigns' }));
      await screen.findByText('Star Club');
      await expectClean('admin/companies/[companyId]/template#campaigns');

      // Renamed and split by the 2026-09-24 feedback: the platform's own words for the
      // card (`Overall.html:4349`), with the grids on their own half.
      await userEvent.click(screen.getByRole('link', { name: 'Capability Mapping' }));
      await screen.findByRole('heading', { name: 'Milestones' });
      await expectClean('admin/companies/[companyId]/template#capability-ladder');

      await userEvent.click(screen.getByRole('link', { name: 'Skills' }));
      await screen.findByText('Approach');
      await expectClean('admin/companies/[companyId]/template#capability-skills');
    });

    it('the company template’s Products tab, with a product open', async () => {
      stubFetch({
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1,
            status: 'draft', payload: { categories: [TAXONOMY[0]], types: [TYPE] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/products': {
          body: [{
            id: 'p1', companyId: 'c1', code: 'PRUMAPAN', name: 'PRUMapan',
            tagline: 'Proteksi jiwa dengan manfaat pensiun', channel: 'conventional',
            category: 'life', primaryNeeds: ['retirement'], eligibleAgeBands: [1, 2, 3],
            eligibleBudgetBands: [1, 2, 3], benefits: ['Dana Mapan tiap tahun dari usia 55'],
            differentiator: 'Pilihan pensiun paling terjangkau.',
            bestFor: 'Sandwich-generation professionals',
            defaultAttackPlan: {
              goodFit: 'Sandwich-generation professionals', opening: 'Halo.',
              benefits: ['Dana Mapan'], fullScript: 'Halo. Boleh saya siapkan ilustrasinya?',
              objectionTheySay: 'Pensiun masih lama.',
              objectionYouSay: 'Pilihan pensiun paling terjangkau.',
              nextAction: 'Boleh saya siapkan ilustrasinya?',
            },
            commissionSchedule: [], lifecycle: 'active', replacedByProductId: null,
            activeByDefault: true, sortOrder: 1, version: 1,
          }],
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      await screen.findByText('Submission polis');
      await userEvent.click(screen.getByRole('link', { name: 'Products' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await expectClean('admin/companies/[companyId]/template#products');
    });

    it('the company template, with an editor open', async () => {
      stubFetch({
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1,
            status: 'draft', payload: { categories: [TAXONOMY[0]], types: [TYPE] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      await screen.findByText('Submission polis');
      await expectClean('admin/companies/[companyId]/template');
    });
  });
});
