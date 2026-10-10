import { cleanup, screen, waitFor, within } from '@testing-library/react';
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
import PlatformAnalyticsPage from './(admin)/admin/analytics/page';
import MembersPage from './(tenant)/people/members/page';
import MemberPage from './(tenant)/people/members/[membershipId]/page';
import AdminsPage from './(tenant)/people/admins/page';
import RegisterKpmPage from './(agent)/user-management/kpm/page';
import KpmOverviewPage from './(tenant)/kpm/overview/page';
import {
  EMPTY as OVERVIEW_EMPTY, NOBODY as OVERVIEW_NOBODY, NOT_LOGGED as OVERVIEW_NOT_LOGGED, overviewView as overviewFixture,
} from './(tenant)/kpm/overview/overview-fixtures';
import DataUploadPage from './(tenant)/kpm/data-upload/page';
import UnitDashboardPage from './(agent)/unit/dashboard/page';
import UnitBelowPage from './(agent)/unit/dashboard/[membershipId]/page';
import CoachingRosterPage from './(agent)/coaching/page';
import MyCoachingPage from './(agent)/coaching/me/page';
import CoachingPersonLayout from './(agent)/coaching/[membershipId]/layout';
import CoacheeSummaryTab from './(agent)/coaching/[membershipId]/summary/page';
import CoacheeGoalSettingTab from './(agent)/coaching/[membershipId]/goal-setting/page';
import CoacheeTrainingTab from './(agent)/coaching/[membershipId]/training/page';
import CoachingSessionTabPage from './(agent)/coaching/[membershipId]/session/page';
import CoacheeLeaderNotesTab from './(agent)/coaching/[membershipId]/leader-notes/page';
import CoachingArchivePage from './(agent)/coaching/[membershipId]/archive/[sessionId]/page';
import { PHONE_QUERY } from '@/lib/use-phone';
import ActivityDashboardPage from './(agent)/activity/dashboard/page';
import PersonalSummaryPage from './(agent)/summary/page';
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
import CalendarPage from './(agent)/calendar/page';
import ActivationPage from './(agent)/activation/page';
import NewHiresPage from './(agent)/new-hires/page';
import NewHireDetailPage from './(agent)/new-hires/[membershipId]/page';
import CoacheeActivationTab from './(agent)/coaching/[membershipId]/activation/page';
import MyCoachingActivationPage from './(agent)/coaching/me/activation/page';
import { activationView, completeView, leaderView, RINA_ME, ROSTER, SARI, SARI_ME } from '@test/activation-fixtures';
import ProductCatalogLayout from './(agent)/product-catalog/layout';
import ProductCatalogPage from './(agent)/product-catalog/page';
import ProductDrawerPage from './(agent)/product-catalog/[productCode]/page';
import AttackPlanPage from './(agent)/attack-plan/page';
import {
  PGB, plan as salesPlan, product as salesProduct, RINA_ME as SALES_ME, SHELF,
} from '@test/sales-tools-fixtures';
import {
  AGUS, busy, DOWNLINE, entry, monthRead, peoplePage, RINA, SHELL_STUBS, weekRead,
} from '@test/calendar-fixtures';
import {
  AGUS_ME as UNIT_READER, dashboard as unitDashboard, EMPTY as UNIT_EMPTY, RATIOS as UNIT_RATIOS, SARI_UNIT,
} from '@test/unit-dashboard-fixtures';
import RecruitmentLayout from './(agent)/recruitment/layout';
import RecruitmentAttackPlanPage from './(agent)/recruitment/attack-plan/page';
import {
  BRIEF as RECRUITMENT_BRIEF, plan as recruitmentPlan, RINA_ME as RECRUITMENT_ME, view as recruitmentView,
} from '@test/recruitment-plan-fixtures';
import RecruitmentPitchPage from './(tenant)/kpm/settings/recruitment-pitch/page';
import PitchMaterialsPage from './(agent)/recruitment/pitch-materials/page';
import KpmAnalyticsLayout from './(tenant)/kpm/analytics/layout';
import KpmAnalyticsPage from './(tenant)/kpm/analytics/page';
import KpmAnalyticsCompliancePage from './(tenant)/kpm/analytics/compliance/page';
import {
  analyticsView, NO_AB as ANALYTICS_NO_AB, OWNER_ME as ANALYTICS_OWNER, SHELL_STUBS as ANALYTICS_SHELL,
} from '@test/kpm-analytics-fixtures';
import LeaderMeetingsPage from './leader-meetings/page';
import LeaderMeetingPage from './leader-meetings/[meetingId]/page';
import SharedLeaderMeetingPage from './leader-meetings/shared/[token]/page';
import {
  FIELD_ME as FORUM_FIELD, LINK_CAN as FORUM_LINK_CAN, listView as forumList, meetingView as forumMeeting,
  notFound as FORUM_NOT_FOUND, OWNER_ME as FORUM_OWNER, SHELL_STUBS as FORUM_SHELL,
} from './leader-meetings/forum-fixtures';

/**
 * Where the screen is, for the one shell that reads it: the coaching person shell's archive (P11-T10),
 * and the address the archive's page reads its ids from (`useParams()`, F5 of P11's final walk).
 */
const nav = vi.hoisted(() => ({ pathname: '/admin', params: {} as Record<string, string> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => nav.params,
  // The Product Catalog reads its filters from the address (Phase 14, D-urls).
  useSearchParams: () => new URLSearchParams(),
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

/** The published configuration's two sections holding the goal cascade's types, numbered as the seed numbers them. */
const cascadeType = (code: string, categoryCode: string, displayOrder: number) => ({
  id: `t-${code}`, code, categoryCode, label: code, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1, status: 'active',
});
const GOAL_CASCADE_CONFIG = [
  {
    id: 'c-lg', code: 'LEADS_GENERATION', label: 'Leads Generation', description: null, appliesToOrgLevelCodes: [], displayOrder: 1,
    version: 1, status: 'active', types: [cascadeType('LEADS_CONTACTED', 'LEADS_GENERATION', 3)],
  },
  {
    id: 'c-sell', code: 'SELLING', label: 'Selling', description: null, appliesToOrgLevelCodes: [], displayOrder: 2,
    version: 1, status: 'active',
    types: [cascadeType('SELL_PRESENTATION', 'SELLING', 4), cascadeType('SELL_SUBMISSION', 'SELLING', 6)],
  },
];

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
    nav.pathname = '/admin';
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
            // All three Active (MAA) marks, so axe reads each one's name (ADR-0054).
            { membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', monthlyActiveAgent: true,
              metrics: { ...metrics, ape: { monthly: { value: 15000000000, provenance: 'imported' }, ytd: empty } } },
            { membershipId: 'mem-budi', agentCode: 'PRU-002', name: 'Budi Santoso', metrics, monthlyActiveAgent: null },
            { membershipId: 'mem-sari', agentCode: 'PRU-003', name: 'Sari Dewi', monthlyActiveAgent: false,
              metrics: { ...metrics, ape: { monthly: { value: 0, provenance: 'imported' }, ytd: empty },
                policyCount: { monthly: { value: 0, provenance: 'imported' }, ytd: empty } } },
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
    await screen.findByRole('link', { name: 'Download template' });
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

  describe('the KPM Overview (P18-T1 AC-10)', () => {
    // The sign went (P18-T1): the page reads the Overview, and the reveal reads its list when opened.
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile', 'kpm_overview:read', 'kpm_overview:set_recruit_target'],
    });
    const overviewRegion = () => within(screen.getByRole('main')).findByRole('region', { name: 'Team composition' });

    it('filled, with the Target input', async () => {
      stubFetch({ '/kpm/overview': { body: overviewFixture() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await expectClean('kpm/overview');
    });

    it('expanded: the not-logged list, the full ranking and a unit’s AABs open', async () => {
      stubFetch({ '/kpm/overview/not-logged': { body: OVERVIEW_NOT_LOGGED }, '/kpm/overview': { body: overviewFixture() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await userEvent.click(screen.getByRole('button', { name: "View who hasn't logged →" }));
      await screen.findByText('Sinta Halim — Agent');
      for (const more of screen.getAllByRole('button', { name: 'view full ranking →' })) await userEvent.click(more);
      await userEvent.click(screen.getByRole('button', { name: /^Hendra Wibowo/ }));
      await userEvent.click(screen.getByRole('button', { name: /^Lina Chandra/ }));
      await expectClean('kpm/overview (expanded)');
    });

    it('empty: 0701, with no file, no session, no lead and no target', async () => {
      stubFetch({ '/kpm/overview': { body: OVERVIEW_EMPTY } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await userEvent.click(screen.getByRole('button', { name: /^Hadi Gunawan/ }));
      await expectClean('kpm/overview (empty)');
    });

    it('an office with nobody in it, every rate a dash', async () => {
      stubFetch({ '/kpm/overview': { body: OVERVIEW_NOBODY } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await expectClean('kpm/overview (nobody)');
    });

    it('loading, the five sections in outline', async () => {
      vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).includes('/kpm/overview')
        ? new Promise(() => undefined)
        : Promise.resolve({ ok: false, status: 404, json: async () => null }))));
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await within(screen.getByRole('main')).findByText('Loading the overview…');
      await expectClean('kpm/overview (loading)');
    });

    it('the directory’s Last activity and Last coached, populated (AC-8)', async () => {
      const row = (membershipId: string, fullName: string, lastActivityDays: number | null, lastCoachedDays: number | null) => ({
        membershipId, agentCode: `KPM0417-${membershipId}`, role: 'agent', status: 'active', fullName, preferredName: null,
        email: `${membershipId}@kpm0417.test`, initials: 'XX', leaderId: null, leaderName: 'Wilson Tanoto', depth: 1,
        directCount: 0, subtreeCount: 0, isLeader: false, isKpmOwner: false, isKpmAdmin: false,
        joinedAt: '2026-03-01T00:00:00.000Z', removedAt: null, canChangeRole: false, canPromoteToAb: false, canRemove: false,
        lastActivityOn: lastActivityDays === null ? null : '2026-10-07', lastActivityDays, lastCoachedDays,
      });
      stubFetch({
        '/members': {
          body: {
            members: [row('001', 'Rina Wijaya', 0, 2), row('002', 'Sinta Halim', null, null)],
            nextCursor: null,
            counts: { directory: 2, pending: 0, removed: 0 },
          },
        },
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: owner });
      await within(await screen.findByRole('table')).findByRole('columnheader', { name: 'Last coached' });
      await expectClean('people/members (last activity, last coached)');
    });
  });

  describe('the Unit Dashboard (P15-T2 AC-9)', () => {
    const shell = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
    };
    const page = () => <UnitDashboardPage searchParams={routeParams({})} />;

    it('filled: the tiles, every group and total, a unit nested two deep, every status and mark', async () => {
      // Row groups headed by `rowgroup` headers, each person their row's header, the ⌄ column named for a
      // screen reader, and every tooltip on a button: the ✓, the pills, the marks and the Status rules.
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: unitDashboard() } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await expectClean('unit/dashboard');
    });

    it('expanded: two rows’ details open, with their ratios', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: unitDashboard() }, '/activity/ratios': { body: UNIT_RATIOS } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
      await userEvent.click(screen.getByRole('button', { name: 'View details for Indah Lestari' }));
      await screen.findAllByText('Selling success rate');
      await expectClean('unit/dashboard expanded');
    });

    it('with Update production open', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: unitDashboard() } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await userEvent.click(screen.getByRole('button', { name: 'Update production' }));
      await screen.findByRole('dialog', { name: 'Update production' });
      await expectClean('unit/dashboard with Update production');
    });

    it('locked: Update production held, its reason a description', async () => {
      stubFetch({
        ...shell,
        'GET /unit/dashboard': { body: unitDashboard({ production: { month: '2026-10', revision: 7, locked: true, canUpdate: true } }) },
      });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await expectClean('unit/dashboard locked');
    });

    it('empty: somebody who leads nobody', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: UNIT_EMPTY } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByText('Nobody is in your unit yet.');
      await expectClean('unit/dashboard (empty)');
    });

    it('a unit below the reader, and one they cannot open (P15-T4 AC-2)', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: SARI_UNIT } });
      renderInLayout(
        AgentLayout,
        <UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} searchParams={routeParams({})} />,
        { me: UNIT_READER },
      );
      await screen.findByRole('heading', { level: 1, name: 'Sari Wulandari’s Unit Dashboard' });
      await expectClean('unit/dashboard/[membershipId]');

      cleanup();
      vi.unstubAllGlobals();
      stubFetch({
        ...shell,
        'GET /unit/dashboard': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-1' } } },
      });
      renderInLayout(
        AgentLayout,
        <UnitBelowPage params={routeParams({ membershipId: 'mem-x' })} searchParams={routeParams({})} />,
        { me: UNIT_READER },
      );
      await screen.findByText('This isn’t a unit you can open.');
      await expectClean('unit/dashboard/[membershipId] (not found)');
    });
  });

  describe('coaching (P11-T6)', () => {
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['coaching_session:read'],
    });
    const row = (membershipId: string, name: string, over: Record<string, unknown> = {}) => ({
      membershipId, name, rung: { code: 'AGENT', label: 'Agent' }, depth: 1,
      lastOneOnOne: { days: 9, date: '2026-09-23', overdue: true, coach: { membershipId: 'mem-ab', name: 'Jordan Pratama' } },
      status: 'watch_closely', ...over,
    });
    const roster = {
      today: '2026-10-02',
      overdueAfterDays: 7,
      directAgents: [row('mem-rina', 'Rina Wijaya'), row('mem-melati', 'Melati Putri', { lastOneOnOne: null, status: 'no_goal_set' })],
      units: [{
        head: row('mem-dimas', 'Dimas Aditya', { rung: { code: 'AAB', label: 'Associate Agency Builder' }, status: 'on_track' }),
        members: [
          row('mem-wulan', 'Wulan Sari', { depth: 2, rung: { code: 'AAB', label: 'Associate Agency Builder' }, status: 'needs_attention' }),
          row('mem-tono', 'Tono Saputra', { depth: 3, lastOneOnOne: { days: 0, date: '2026-10-02', overdue: false, coach: null } }),
        ],
      }],
    };
    const shell = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    const sessionRatio = (over: Record<string, unknown> = {}) => ({
      code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
      tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
      value: 0.18, share: null, numeratorCount: 9, denominatorCount: 50, status: 'success', ...over,
    });
    const sessionRatios = {
      membershipId: 'mem-rina', from: '2026-09-03', to: '2026-10-02', days: 30,
      ratios: [
        sessionRatio(),
        sessionRatio({ code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', value: null, status: 'neutral' }),
        sessionRatio({
          code: 'BALANCE', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
          value: 40, share: 70, sides: { numerator: 'Selling', denominator: 'Recruitment' }, status: 'alert',
        }),
      ],
    };

    it('the roster, populated: the groups, a unit, a unit nested in it, and every status', async () => {
      // Row groups headed by a full-width `rowgroup` header, a unit head naming the rest of its
      // `<tbody>`, row headers for the people, and a screen-reader-only name on the actions column.
      stubFetch({ ...shell, '/coaching/coachees': { body: roster } });
      renderInLayout(AgentLayout, <CoachingRosterPage />, { me: leader });
      await screen.findByRole('table', { name: 'Everyone you coach' });
      await expectClean('coaching');
    });

    it('the roster with nobody to coach', async () => {
      stubFetch({ ...shell, '/coaching/coachees': { body: { ...roster, directAgents: [], units: [] } } });
      renderInLayout(AgentLayout, <CoachingRosterPage />, { me: leader });
      await screen.findByText('No one to coach yet.');
      await expectClean('coaching (empty)');
    });

    /*
     * A finalized session as the record draws it (P11-T10): the archive and `/coaching/me` both. Its
     * figures are the snapshot's, its earlier version carries a reason.
     */
    const recordCoach = { membershipId: 'mem-ab', name: 'Jordan Pratama' };
    const recordM = 1_000_000 * 100;
    const recordSession = (over: Record<string, unknown> = {}) => ({
      sessionId: 's-0924', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: recordCoach,
      status: 'finalized', version: 4, date: '2026-09-24', startedAt: '2026-09-24T02:00:00.000Z',
      finalizedAt: '2026-09-25T03:00:00.000Z', finalizedBy: recordCoach, reopenableUntil: '2026-10-01',
      lastWeek: { sessionId: 's-0917', date: '2026-09-17' },
      lastWeekItems: [
        { itemId: 'lw-1', text: 'Confirm submission paperwork', dueDate: '2026-09-17', lead: null, done: true },
        { itemId: 'lw-2', text: 'Follow up with Alvin Sanjaya', dueDate: '2026-09-17', lead: { leadId: 'l-2', name: 'Alvin Sanjaya' }, done: false },
      ],
      leadActions: [{ leadId: 'l-1', leadName: 'Desi Pratama', dueDate: '2026-09-26', text: 'Collect the signed SPAJ.' }],
      actionItems: [{ itemId: 'a-1', text: 'Shadow Sari on one presentation', dueDate: '2026-10-01' }],
      tips: [{ tipId: 't-1', text: 'Confirm the next meeting before you leave.' }],
      snapshot: {
        takenAt: '2026-09-24T03:00:00.000Z',
        goal: {
          period: '2026', month: '2026-09', currency: 'IDR',
          monthly: { targetMinor: 80 * recordM, actualMinor: 65.6 * recordM, attainmentPct: 82, gapMinor: 14.4 * recordM, targetMet: false },
          yearly: { targetMinor: 960 * recordM, actualMinor: 620 * recordM, attainmentPct: 65, gapMinor: 340 * recordM, targetMet: false },
          source: { provenance: 'imported', month: '2026-08' }, savedAt: null, savedByMembershipId: null, goalVersion: 1,
        },
        ratios: {
          from: '2026-08-26', to: '2026-09-24', days: 30,
          rows: [
            { code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, value: 0.18, share: null, status: 'success' },
            { code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, value: null, share: null, status: 'neutral' },
            { code: 'BALANCE', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30, value: 40, share: 70, status: 'alert' },
          ],
        },
        activity: {
          from: '2026-09-18', to: '2026-09-24',
          targets: [
            { key: 'leads', code: 'LEADS_CONTACTED', logged: 14, target: 16 },
            { key: 'appointments', code: 'SELL_PRESENTATION', logged: 4, target: 5 },
            { key: 'closings', code: 'SELL_SUBMISSION', logged: 1, target: 1 },
          ],
          sections: [{ code: 'DEVELOPMENT', label: 'Development', total: 2, rows: [{ code: 'DEV_TRAINING', label: 'Training attended', count: 2 }] }],
        },
      },
      earlier: [{
        finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: recordCoach, reopenedAt: '2026-09-25T02:00:00.000Z', reopenedBy: recordCoach,
        reason: 'Two action items had the wrong dates.',
        lastWeekItems: [{ itemId: 'lw-1', text: 'Confirm submission paperwork', dueDate: '2026-09-17', lead: null, done: true }],
        leadActions: [], actionItems: [{ itemId: 'a-0', text: 'The first plan', dueDate: '2026-09-30' }], tips: [],
      }],
      ...over,
    });

    it('the reader’s own coaching, populated, with the past sessions and the sessions they led open (P11-T10)', async () => {
      const me = makeMe({ ...leader, permissions: ['coaching_session:read', 'coaching_session:export_pdf'] });
      stubFetch({
        ...shell,
        '/coaching/me/sessions': {
          body: {
            sessions: [
              { sessionId: 's-0924', date: '2026-09-24', coach: recordCoach, actionItemCount: 2, completedCount: 1 },
              { sessionId: 's-0917', date: '2026-09-17', coach: recordCoach, actionItemCount: 3, completedCount: 3 },
            ],
            ledFormerly: [{ sessionId: 's-led', date: '2026-08-20', coachee: { membershipId: 'mem-bayu', name: 'Bayu Pratama' }, actionItemCount: 2, completedCount: 1 }],
          },
        },
        '/coaching/sessions/s-0924': { body: recordSession({ coachee: { membershipId: 'mem-ab', name: 'Jordan Pratama' }, coach: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, reopenableUntil: null }) },
      });
      renderInLayout(AgentLayout, <MyCoachingPage searchParams={routeParams({})} />, { me });
      await screen.findByRole('region', { name: 'Coaching tips from Wilson' });
      await userEvent.click(screen.getByRole('button', { name: 'View past sessions' }));
      await userEvent.click(screen.getByRole('button', { name: 'View what it agreed' }));
      await expectClean('coaching/me');
    });

    it('the reader’s own coaching, with no session yet (P11-T10)', async () => {
      stubFetch({ ...shell, '/coaching/me/sessions': { body: { sessions: [], ledFormerly: [] } } });
      renderInLayout(AgentLayout, <MyCoachingPage searchParams={routeParams({})} />, { me: leader });
      await screen.findByText('No coaching sessions yet.');
      await expectClean('coaching/me (empty)');
    });

    const rina = {
      membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
      leader: { membershipId: 'mem-ab', name: 'Jordan Pratama' }, direct: true, downline: { members: 0, leaders: 0 },
      today: '2026-09-14',
    };
    const coachLeader = makeMe({
      ...leader,
      user: { ...leader.user, fullName: 'Jordan Pratama', initials: 'JP' },
      permissions: ['coaching_session:read', 'personal_summary:read', 'goal:read', 'goal:update'],
    });
    const inShell = (tab: React.ReactNode, membershipId = 'mem-rina') => renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId })}>{tab}</CoachingPersonLayout>,
      { me: coachLeader },
    );

    it('a person’s Personal Summary tab, populated: the shell, the toggle, the tabs and her cards (P11-T7)', async () => {
      const M = 1_000_000 * 100;
      const figures = { targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0, policiesNeeded: 3, targetMet: false };
      const activity = {
        from: '2026-09-01', to: '2026-09-14', total: 42, sections: [],
        targets: [
          { key: 'leads', code: 'LEADS_CONTACTED', logged: 20, target: 57, attainmentPct: 35, targetMet: false },
          { key: 'appointments', code: 'SELL_PRESENTATION', logged: 6, target: 17, attainmentPct: 35, targetMet: false },
          { key: 'closings', code: 'SELL_SUBMISSION', logged: 2, target: 5, attainmentPct: 40, targetMet: false },
        ],
      };
      stubFetch({
        ...shell,
        '/coaching/coachees/': { body: rina },
        '/summary': {
          body: {
            year: '2026', month: '2026-09', today: '2026-09-14', goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
            monthly: { ...figures, source: { provenance: 'imported', month: '2026-09' } },
            yearly: { ...figures, source: { provenance: 'imported', month: '2026-09' } },
            pace: { closingTarget: 5, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 3, neededPerWeek: 1, targetMet: false },
            activity: { monthly: activity, yearly: activity },
            leads: {
              rows: [{ id: 'l-1', name: 'Desi Pratama', type: 'sales', statusCode: 'FOLLOW_UP', statusLabel: 'Follow-up', thisMonth: true, flags: ['overdue'], overdueDays: 6, nextActionDate: '2026-09-08', nextActionNote: 'Confirm paperwork' }],
              total: 1,
            },
            insights: [{ rule: 'LEAD_OVERDUE', kind: 'action', facts: { leadId: 'l-1', name: 'Desi Pratama', overdueDays: 6, others: 0 } }],
          },
        },
        '/activity/ratios': { body: sessionRatios },
      });
      inShell(<CoacheeSummaryTab />);
      await screen.findByRole('region', { name: 'Leads that need her' });
      await expectClean('coaching/[membershipId]/summary');
    });

    it('a person’s Goal Setting tab, populated (P11-T7)', async () => {
      stubFetch({
        '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
        '/kpm/org-levels': { body: [] },
        '/coaching/coachees/': { body: rina },
        '/coaching/coachees': { body: roster },
        '/goals/': {
          body: {
            period: '2026', mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
            commissionRatePct: 10, monthsLeft: 3, monthsLeftIsOverride: false, apeAchievedMinor: 0,
            achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' },
            caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
            snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67 },
            projected: {
              annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 120_000_000_00, remainingApeMinor: 380_000_000_00,
              monthlyApeTargetMinor: 126_000_000_00, policiesPerMonth: 7, policiesPerWeek: 2, appointmentsPerMonth: 24,
              appointmentsPerWeek: 6, leadsPerMonth: 80, leadsPerWeek: 19, targetMet: false,
            },
            cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
            measured: null, savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-ab',
          },
        },
      });
      inShell(<CoacheeGoalSettingTab />);
      await screen.findByRole('button', { name: 'Save goal' });
      await expectClean('coaching/[membershipId]/goal-setting');
    });

    it('a person’s disabled tab reached by its address: a sign inside the shell (P11-T7 AC-7)', async () => {
      stubFetch({ ...shell, '/coaching/coachees/': { body: rina } });
      inShell(<CoacheeTrainingTab params={routeParams({ membershipId: 'mem-rina' })} />);
      await screen.findByRole('region', { name: /^Upcoming Which training this person has finished/ });
      await expectClean('coaching/[membershipId]/training');
    });

    const archiveLeader = makeMe({
      ...coachLeader,
      permissions: ['coaching_session:read', 'coaching_session:reopen', 'coaching_session:export_pdf'],
    });

    it('a past session’s archive, populated: the frozen session, its earlier version open, and Edit again’s dialog (P11-T10)', async () => {
      nav.pathname = '/coaching/mem-rina/archive/s-0924';
      nav.params = { membershipId: 'mem-rina', sessionId: 's-0924' };
      stubFetch({
        ...shell,
        '/coaching/coachees/mem-rina': { body: { ...rina, today: '2026-09-28' } },
        '/coaching/sessions/s-0924': { body: recordSession() },
      });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>
          <CoachingArchivePage />
        </CoachingPersonLayout>,
        { me: archiveLeader },
      );
      await screen.findByRole('region', { name: 'Earlier versions' });
      await userEvent.click(screen.getByRole('button', { name: 'View what it agreed' }));
      await expectClean('coaching/[membershipId]/archive/[sessionId]');
      await userEvent.click(screen.getByRole('button', { name: 'Edit again' }));
      await screen.findByRole('dialog', { name: 'Edit this session again?' });
      await expectClean('coaching/[membershipId]/archive/[sessionId] (Edit again)');
    });

    it('a past session’s archive read by a former coach: on its own, under the way back (P11-T10 AC-9)', async () => {
      nav.pathname = '/coaching/mem-rina/archive/s-0924';
      nav.params = { membershipId: 'mem-rina', sessionId: 's-0924' };
      stubFetch({
        ...shell,
        '/coaching/coachees/mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } },
        '/coaching/sessions/s-0924': { body: recordSession({ reopenableUntil: null, earlier: [] }) },
      });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>
          <CoachingArchivePage />
        </CoachingPersonLayout>,
        { me: archiveLeader },
      );
      await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' });
      await screen.findByRole('region', { name: 'Coaching tips' });
      await expectClean('coaching/[membershipId]/archive/[sessionId] (a former coach)');
    });

    describe('the session tab (P11-T8)', () => {
      const M = 1_000_000 * 100;
      const sessionLeader = makeMe({
        ...coachLeader,
        permissions: [
          'coaching_session:read', 'coaching_session:create', 'coaching_session:edit', 'coaching_session:finalize',
          'coaching_session:reopen', 'personal_summary:read', 'goal:read', 'goal:update', 'activity_ratios:read',
          'lead:read', 'lead:create', 'lead:update', 'lead:mark_outcome',
        ],
      });
      const coach = { membershipId: 'mem-ab', name: 'Jordan Pratama' };
      const pastSessions = [{ sessionId: 's-0924', date: '2026-09-24', coach, actionItemCount: 3, completedCount: 1 }];
      const draft = {
        sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach, status: 'draft', version: 1,
        date: null, startedAt: '2026-10-02T02:00:00.000Z', finalizedAt: null, finalizedBy: null, reopenableUntil: null,
        lastWeek: { sessionId: 's-0924', date: '2026-09-24' },
        lastWeekItems: [
          { itemId: 'lw-1', text: 'Confirm submission paperwork with Bp. Andi', dueDate: '2026-09-24', lead: null, done: true },
          { itemId: 'lw-2', text: 'Follow up with Alvin Sanjaya', dueDate: '2026-09-24', lead: { leadId: 'l-2', name: 'Alvin Sanjaya' }, done: false },
        ],
        leadActions: [{ leadId: 'l-1', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: null }],
        actionItems: [{ itemId: 'a-1', text: 'Practice a tighter close', dueDate: '2026-10-06' }],
        tips: [{ tipId: 't-1', text: 'Slow down on the opening line.' }],
      };
      const figures = (target: number, actual: number, pct: number, gap: number) => ({
        targetMinor: target, actualMinor: actual, attainmentPct: pct, gapMinor: gap, overMinor: 0, policiesNeeded: 1, targetMet: false,
      });
      const none = { from: '2026-10-01', to: '2026-10-02', targets: [], total: 0, sections: [] };
      const sessionLead = {
        id: 'l-1', ownerMembershipId: 'mem-rina', type: 'sales', name: 'Desi Pratama', contact: { phone: null, email: null },
        statusCode: null, thisMonth: false, remarks: null, nextActionDate: '2026-10-05',
        nextActionNote: null, outcome: null, source: null, dateRegistered: '2026-09-04T03:00:00.000Z', version: 1, flags: [],
        overdueDays: null, committedMonths: [], lastEditedBy: null,
      };
      const routes = (session: unknown, current: unknown = { sessionId: 's-1', status: 'draft' }) => ({
        ...shell,
        'GET /coaching/coachees/mem-rina': { body: rina },
        'GET /coaching/coachees/mem-rina/sessions': { body: { today: '2026-10-02', current, sessions: pastSessions } },
        'GET /coaching/sessions/s-1': { body: session },
        '/summary?for=mem-rina': {
          body: {
            year: '2026', month: '2026-10', today: '2026-10-02', goal: { set: true, savedAt: null }, caseSizeMinor: 18 * M,
            monthly: { ...figures(80 * M, 65.6 * M, 82, 14.4 * M), source: { provenance: 'imported', month: '2026-09' } },
            yearly: { ...figures(960 * M, 620 * M, 65, 340 * M), source: { provenance: 'imported', month: '2026-09' } },
            pace: null, activity: { monthly: none, yearly: none }, leads: { rows: [], total: 0 }, insights: [],
          },
        },
        '/activity/ratios?for=mem-rina': { body: sessionRatios },
        '/activity/summary?': {
          body: {
            from: '2026-09-26', to: '2026-10-02', totals: [], daysLogged: 5, totalCount: 20,
            targets: [
              { key: 'leads', code: 'LEADS_CONTACTED', logged: 14, target: 16 },
              { key: 'appointments', code: 'SELL_PRESENTATION', logged: 4, target: 5 },
              { key: 'closings', code: 'SELL_SUBMISSION', logged: 1, target: 1 },
            ],
            sections: [{ code: 'DEVELOPMENT', label: 'Development', total: 2, rows: [{ code: 'DEV_TRAINING', label: 'Training attended', count: 2 }] }],
          },
        },
        'outcome=open': { body: { rows: [sessionLead], total: 1, page: 1, pageSize: 200 } },
        'outcome=won': { body: { rows: [], total: 0, page: 1, pageSize: 200 } },
        'outcome=lost': { body: { rows: [], total: 0, page: 1, pageSize: 200 } },
      });
      const inSession = () => renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingSessionTabPage /></CoachingPersonLayout>,
        { me: sessionLeader },
      );

      it('before it starts: the header, the past sessions open, and ▶ Start coaching session', async () => {
        stubFetch(routes(draft, null));
        inSession();
        await userEvent.click(await screen.findByRole('button', { name: 'View past sessions' }));
        await screen.findByRole('button', { name: 'Start coaching session' });
        await expectClean('coaching/[membershipId]/session (before it starts)');
      });

      it('a draft, populated, with the Activity drill open', async () => {
        stubFetch(routes(draft));
        inSession();
        await screen.findByDisplayValue('Desi Pratama');
        await screen.findByText('Rp 340.000.000 remaining this year.');
        await screen.findByText('18.0%');
        const drill = await screen.findByRole('button', { name: '→ view full dashboard' });
        await waitFor(() => expect(drill).toBeEnabled());
        await expectClean('coaching/[membershipId]/session (a draft)');
        await userEvent.click(drill);
        await screen.findByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
        await expectClean('coaching/[membershipId]/session (the Activity drill)');
      });

      it('finalized, locked, with Edit again’s reason dialog open', async () => {
        stubFetch(routes(
          { ...draft, status: 'finalized', version: 3, date: '2026-10-02', finalizedAt: '2026-10-02T03:00:00.000Z', finalizedBy: coach, reopenableUntil: '2026-10-09' },
          { sessionId: 's-1', status: 'finalized' },
        ));
        inSession();
        await screen.findByDisplayValue('Desi Pratama');
        await screen.findByText('✓ Finalized Friday, October 2, 2026');
        await expectClean('coaching/[membershipId]/session (finalized)');
        await userEvent.click(screen.getByRole('button', { name: 'Edit again' }));
        await screen.findByRole('dialog', { name: 'Edit this session again?' });
        await expectClean('coaching/[membershipId]/session (Edit again)');
      });

      it('past the reopen window: Edit again drawn locked', async () => {
        stubFetch({
          ...routes(
            { ...draft, status: 'finalized', version: 3, date: '2026-09-24', reopenableUntil: '2026-10-01' },
            { sessionId: 's-1', status: 'finalized' },
          ),
        });
        inSession();
        const edit = await screen.findByRole('button', { name: 'Edit again' });
        expect(edit).toHaveAttribute('aria-disabled', 'true');
        await expectClean('coaching/[membershipId]/session (past the window)');
      });
    });

    it('a person’s Leader Notes tab, populated: the ladder, the tracker with an archived tick and its sections off, and both kinds of note (P11-T9)', async () => {
      const notesLeader = makeMe({
        ...coachLeader,
        permissions: ['coaching_session:read', 'coaching_profile:read', 'coaching_profile:update', 'leader_notes:read', 'leader_notes:write'],
      });
      const entry = (code: string, label: string, displayOrder: number, status = 'active') => ({ code, label, displayOrder, status });
      const stage = (code: string, label: string, n: number, required: string[]) => ({ ...entry(code, label, n), stageOrder: n, requiredMilestoneCodes: required });
      stubFetch({
        ...shell,
        'GET /coaching/coachees/mem-rina': { body: rina },
        'GET /coaching/coachees/mem-rina/profile': {
          body: {
            catalog: {
              stages: [
                stage('COMPETENT_PRODUCER', 'Competent Producer', 1, ['M1']),
                stage('INDEPENDENT_PRODUCER', 'Independent Producer', 2, ['M1', 'M2']),
                stage('PRODUCTIVE_TEAM_BUILDER', 'Productive Team Builder', 3, ['M1', 'M2', 'M3']),
              ],
              milestones: [entry('M1', 'Sells policies independently', 1), entry('M2', 'Sells outside direct network', 2), entry('M3', 'Recruits quality agents', 3)],
              grids: [
                {
                  ...entry('PERSONAL_SELLING', 'Personal selling', 1), requiresDownline: false,
                  items: [entry('LEADS_GEN', 'Leads generation consistency', 1), entry('COLD', 'Cold calling', 2, 'archived')],
                },
                {
                  ...entry('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', 2), requiresDownline: true,
                  items: [entry('AGENT_VISIBILITY', "Visibility into each agent's progress & goals", 1)],
                },
                {
                  ...entry('DEVELOPING_DOWNLINE_LEADER', 'Developing downline leader', 3), requiresDownline: true,
                  items: [entry('LEADER_TIME', 'Allocating time for team building', 1)],
                },
              ],
            },
            milestoneCodes: ['M1', 'M2'], skillCodes: ['LEADS_GEN', 'COLD'], stageCode: 'INDEPENDENT_PRODUCER', version: 3,
            updatedAt: '2026-09-30T03:00:00.000Z', updatedBy: { membershipId: 'mem-ab', name: 'Jordan Pratama' },
          },
        },
        'GET /coaching/coachees/mem-rina/leader-notes': {
          body: {
            mine: { noteId: 'n-1', text: 'Strong closer.', version: 2, updatedAt: '2026-09-30T03:00:00.000Z' },
            others: [{ noteId: 'n-2', author: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, text: 'Keep an eye on her load.', updatedAt: '2026-09-29T03:00:00.000Z' }],
          },
        },
      });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeLeaderNotesTab /></CoachingPersonLayout>,
        { me: notesLeader },
      );
      await screen.findByRole('region', { name: 'Personal notes from Wilson Tanoto' });
      await screen.findByRole('checkbox', { name: 'Cold calling Archived' });
      await expectClean('coaching/[membershipId]/leader-notes');
    });

    it('a person outside the reader’s reach: the not-found state inside the shell (P11-T7 AC-8)', async () => {
      stubFetch({ ...shell, '/coaching/coachees/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
      inShell(<CoacheeTrainingTab params={routeParams({ membershipId: 'mem-nobody' })} />, 'mem-nobody');
      await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' });
      await expectClean('coaching/[membershipId] (not found)');
    });

    it('the way round on a phone, open (ADR-0085, P11-T6 AC-11)', async () => {
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })));
      stubFetch({ ...shell, '/coaching/coachees': { body: roster } });
      renderInLayout(AgentLayout, <CoachingRosterPage />, { me: leader });
      await screen.findByRole('table', { name: 'Everyone you coach' });
      await userEvent.click(screen.getByRole('button', { name: /Rina/ }));
      expect(within(document.getElementById('sidebar-user-actions')!).getByRole('navigation', { name: 'Main' }))
        .toBeInTheDocument();
      await expectClean('coaching (the phone’s nav open)');
    });
  });

  it('Activity Dashboard, populated: the range tabs, the strip and the table (P10-T1)', async () => {
    // It was a signpost until P10-T1. The range is a `tablist` whose panel is the whole report, the
    // headings carry a second line, and a row the office has since archived wears its badge. The
    // strip is the office's grouping (P10.1-T5), so the configuration names a tile for it to draw.
    const counts = [3, 0, 1, 0, 2, 0, 0];
    const day = (d: string) => ({ from: d, to: d, days: 1, kind: 'day' });
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [{
            id: 'c1', code: 'SELLING', label: 'Selling', description: null,
            appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
            summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling', types: [],
          }],
          ratios: [], leadPipelines: [], version: 1,
        },
      },
      '/kpm/org-levels': { body: [] },
      '/activity/dashboard': {
        body: {
          range: 'ROLLING_7D', from: '2026-09-22', to: '2026-09-28', days: 7, today: '2026-09-28',
          buckets: ['28', '27', '26', '25', '24', '23', '22'].map((d) => day(`2026-09-${d}`)),
          sections: [{
            code: 'SELLING', label: 'Selling', standing: 'shown', total: 6, counts,
            types: [
              { code: 'SELL_SUBMISSION', label: 'Submission polis', description: null, displayOrder: 6, standing: 'shown', total: 4, counts: [2, 0, 1, 0, 1, 0, 0] },
              { code: 'SELL_OLD', label: 'An archived item', description: 'Retired in August', displayOrder: 9, standing: 'archived', total: 2, counts: [1, 0, 0, 0, 1, 0, 0] },
            ],
          }],
          total: 6, counts, daysLogged: 5, correctedDays: 1,
        },
      },
    });
    renderInLayout(AgentLayout, <ActivityDashboardPage />, {});
    await screen.findByText('Submission polis');
    await screen.findByText('Total touches');
    await expectClean('activity/dashboard');
  });

  it('Personal Summary, populated: the period tabs, progress bars, the pace, the chips, the pulse, the leads and the insights (P10-T4 to T7)', async () => {
    const M = 1_000_000 * 100;
    const figures = {
      targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0, policiesNeeded: 3, targetMet: false,
    };
    const target = (key: string, logged: number, goal: number | null) => ({
      key, code: key, logged, target: goal, attainmentPct: goal ? Math.round((logged / goal) * 100) : null, targetMet: false,
    });
    const activity = {
      from: '2026-09-01', to: '2026-09-14', total: 42,
      // One chip with a bar, one with no target, one met at 0 — every shape the card draws.
      targets: [target('leads', 20, 57), target('appointments', 6, null), { ...target('closings', 2, 0), targetMet: true }],
      // The seed's two summary tiles (ADR-0064): a section of its own, and a group of two.
      sections: [
        { code: 'RECRUITMENT', label: 'Recruitment', total: 3, rows: [{ code: 'RECRUIT_PRESENTATION', label: 'Proses pendaftaran kode agen', count: 3 }] },
        {
          code: 'DEVELOPMENT', label: 'Development', total: 5,
          rows: [
            { code: 'DEV_TRAINING_ATTEND', label: 'Menghadiri meeting atau training dari KPM atau Prudential', count: 2 },
            { code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', count: 3 },
          ],
        },
      ],
    };
    const rate = (code: string, value: number | null, status: string) => ({
      code, label: code, comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, tag: null, sides: null,
      numerator: [], denominator: [], purpose: null, divergesFromStandard: false, value, share: null,
      numeratorCount: 1, denominatorCount: 10, status,
    });
    stubFetch({
      '/activity/ratios': {
        body: { membershipId: 'm-1', from: '2026-08-16', to: '2026-09-14', days: 30, ratios: [rate('SSR', 0.1, 'alert'), rate('LPA', null, 'neutral')] },
      },
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/summary': {
        body: {
          year: '2026', month: '2026-09', today: '2026-09-14', goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' },
          caseSizeMinor: 18 * M,
          monthly: { ...figures, source: { provenance: 'imported', month: '2026-09' } },
          yearly: { ...figures, targetMinor: 500 * M, source: { provenance: 'self_reported', month: null } },
          pace: { closingTarget: 6, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 5, neededPerWeek: 2, targetMet: false },
          activity: { monthly: activity, yearly: activity },
          leads: {
            total: 12,
            rows: [
              {
                id: 'l-1', name: 'Pak Hendro', type: 'sales', statusCode: 'FOLLOW_UP', statusLabel: 'Follow-up', thisMonth: true,
                flags: ['overdue', 'no-remarks'], overdueDays: 6, nextActionDate: '2026-09-08', nextActionNote: 'Chase the illustration.',
              },
              {
                id: 'l-2', name: 'Pak Bambang', type: null, statusCode: null, statusLabel: null, thisMonth: false,
                flags: ['no-next-action'], overdueDays: null, nextActionDate: null, nextActionNote: null,
              },
            ],
          },
          // Both insight cards: a numbered action list and a bulleted improvement list.
          insights: [
            { rule: 'LEAD_OVERDUE', kind: 'action', facts: { leadId: 'l-1', name: 'Pak Hendro', overdueDays: 6, others: 0 } },
            { rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: '2026-09-01' } },
            {
              rule: 'RATIO_STRENGTH', kind: 'improve',
              facts: { code: 'LPA', label: 'Leads per activity', value: 0.6, benchmark: 0.3, displayUnit: 'decimal' },
            },
          ],
        },
      },
    });
    renderInLayout(AgentLayout, <PersonalSummaryPage />, {});
    await screen.findByRole('region', { name: 'The gap' });
    await screen.findByText('SSR');
    // The *Upcoming* section in card 6's slot is in the pass too (P10.1-T2): its pill inside an h2.
    await screen.findByRole('region', { name: "Campaigns you're chasing Upcoming" });
    await expectClean('summary');
  });

  it('Activity Ratios, populated: a rate, one with not enough data, and the balance, explained (P10-T2)', async () => {
    // It was a signpost until P10-T2. Each card is an `article` named by its heading, the formula's
    // numbers are hidden behind a sentence a screen reader reads, and the explanation is a disclosure.
    const term = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder });
    const base = {
      comparison: 'gte', displayUnit: 'percent', benchmark: 0.15, tag: { code: 'SELLING', label: 'Selling' },
      sides: null, numerator: [term('SELL_SUBMISSION', 'Submission polis', 6)],
      denominator: [term('SELL_PRESENTATION', 'Presentasi penjualan', 4)],
      purpose: 'Mengukur tingkat konversi aktivitas selling menjadi submission', divergesFromStandard: false,
      share: null, numeratorCount: 1, denominatorCount: 11,
    };
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/activity/ratios': {
        body: {
          membershipId: 'm-1', from: '2026-08-30', to: '2026-09-28', days: 30,
          ratios: [
            { ...base, code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band',
              displayUnit: 'points', benchmark: 30, tag: { code: null, label: 'Balance' },
              sides: { numerator: 'Selling', denominator: 'Recruitment' }, value: 24, share: 62, status: 'success' },
            { ...base, code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', value: 0.09, status: 'alert' },
            { ...base, code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal',
              benchmark: 0.3, value: null, status: 'neutral' },
          ],
        },
      },
    });
    renderInLayout(AgentLayout, <ActivityRatioPage />, {});
    const card = await screen.findByRole('article', { name: 'Selling success rate' });
    await userEvent.click(within(card).getByText('What is this ratio?'));
    await expectClean('activity/ratio');
  });

  it('Log activity, populated with the office’s own taxonomy (P6-T2)', async () => {
    // It was a `ComingInPhase` sign until P6-T2. Every count is a labelled number input, and
    // the sections are the office's categories — so the axe run is over real form controls
    // rather than over a paragraph. Since P10.1-T5 the day is a closed, corrected one, so the
    // run also covers the strip, the reason field and the hint it is described by.
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [{
            id: 'c1', code: 'LEADS', label: 'Leads', description: null,
            appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
            summaryGroupCode: 'LEADS', summaryGroupLabel: 'Leads Generation',
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
          frozenAt: '2026-03-12T00:00:00Z',
          editable: false,
          correctionCount: 2,
        },
      },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: makeMe() });

    await screen.findByLabelText('Why is this being corrected?');
    expect(screen.getByText('Leads Generation')).toBeInTheDocument();
    await expectClean('activity/log');
  });

  it('the leads table, with its sortable headings, a row of inline editors and the contact dialog', async () => {
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
      '/leads': {
        body: {
          rows: [{
            id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Pak Budi',
            contact: { phone: null, email: null },
            statusCode: 'FOLLOW_UP', thisMonth: true, remarks: 'Hobi golf',
            nextActionDate: '2026-10-02', nextActionNote: null, outcome: null, source: null,
            dateRegistered: '2026-09-04T03:00:00.000Z', version: 2, flags: ['overdue'],
            overdueDays: 9, committedMonths: ['2026-09'],
            lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' },
          }, {
            // A downline's lead, as a leader's screen lists it: 🗑 held in place, and saying why.
            id: 'l2', ownerMembershipId: 'mem-7', type: 'sales', name: 'Bu Rina',
            contact: { phone: null, email: null },
            statusCode: 'FOLLOW_UP', thisMonth: false, remarks: null,
            nextActionDate: null, nextActionNote: null, outcome: null, source: null,
            dateRegistered: '2026-09-03T03:00:00.000Z', version: 1, flags: [],
            overdueDays: null, committedMonths: [], lastEditedBy: null,
          }],
          total: 2, page: 1, pageSize: 200,
        },
      },
      // The two closed cards below the table fetch a page each, keyed on the query so they do not
      // borrow the table's rows. Populated, because the reopen pill is a control axe should see.
      'outcome=won': {
        body: {
          rows: [{
            id: 'w1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Wulan Sari',
            contact: { phone: null, email: null },
            statusCode: 'PAID_AND_ISSUED', thisMonth: false, remarks: null,
            nextActionDate: null, nextActionNote: null, outcome: 'won', source: null,
            dateRegistered: '2026-08-01T03:00:00.000Z', version: 3, flags: [],
            overdueDays: null, committedMonths: [], lastEditedBy: null,
          }],
          total: 1, page: 1, pageSize: 200,
        },
      },
      'outcome=lost': { body: { rows: [], total: 0, page: 1, pageSize: 200 } },
    });
    renderInLayout(AgentLayout, <LeadsPage />, {
      me: makeMe({ permissions: ['lead:read', 'lead:update', 'lead:mark_outcome'] }),
    });

    // The ⋮ menu and the details dialog are part of the row (P13.1-T4), so each is walked open rather
    // than left closed — over a row whose last change was a leader's, so the attribution is in it too.
    await screen.findByText('Ibu Wulan Sari');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Pak Budi' }));
    await screen.findByRole('menu', { name: 'Actions for Pak Budi' });
    await expectClean('leads (the ⋮ menu open)');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lead details' }));
    const details = await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' });
    await within(details).findByText('Last changed by Ibu Sari');
    await expectClean('leads');
  });

  it('goal settings: five numbered cards, two entry modes and a live cascade', async () => {
    const period = String(new Date().getFullYear());
    stubFetch({
      // The cascade's three types, so each column carries its *Activity #n* chip (P10.1-T6).
      '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
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
          measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
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
      '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
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
          measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
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

  describe('Cross-platform analytics (P18-T8 AC-4)', () => {
    const ANALYST = { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'platform_analytics:read'] };
    const rungs = (agent: number, aab: number, ab: number) => [
      { code: 'AGENT', label: 'Agent', count: agent },
      { code: 'AAB', label: 'AAB', count: aab },
      { code: 'AB', label: 'AB', count: ab },
    ];
    const figures = (members: number, agent: number, aab: number, ab: number) => ({
      members, byRung: rungs(agent, aab, ab), joinedThisMonth: 2, leftThisMonth: 1, signedIn7d: 3, signedIn30d: members,
    });
    const VIEW = {
      offices: [
        { kpmId: 'kpm-1', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, state: 'active', ...figures(40, 34, 4, 2) },
        { kpmId: 'kpm-2', code: '0555', branch: 'Kelapa Gading Branch', company: { id: 'co-1', name: 'Prudential' }, state: 'suspended', ...figures(10, 8, 1, 1) },
      ],
      companies: [{ id: 'co-1', name: 'Prudential', offices: 2, ...figures(50, 42, 5, 3) }],
      platform: { offices: 2, companies: 1, ...figures(50, 42, 5, 3) },
    };

    it('the table, with its office rows, the company’s total and the platform’s', async () => {
      nav.pathname = '/admin/analytics';
      stubFetch({ '/admin/analytics': { body: VIEW } });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: ANALYST });
      await screen.findByRole('table', { name: 'Adoption by branch and company' });
      await expectClean('admin/analytics');
    });

    it('empty and error', async () => {
      nav.pathname = '/admin/analytics';
      stubFetch({ '/admin/analytics': { body: { ...VIEW, offices: [], companies: [] } } });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: ANALYST });
      await screen.findByText('No branches on the platform yet.');
      await expectClean('admin/analytics (empty)');
      cleanup();
      stubFetch({
        '/admin/analytics': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'req-1' } } },
      });
      renderInLayout(AdminLayout, <PlatformAnalyticsPage />, { me: ANALYST });
      await screen.findByRole('button', { name: 'Try again' });
      await expectClean('admin/analytics (error)');
    });
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

  /*
   * The inbox (P12.1): the page, the bell's popover and the modal a row with nowhere to go opens. Each
   * row is two controls side by side — the row and its toggle — never one inside the other, which is
   * what `nested-interactive` would catch.
   */
  describe('notifications (P12.1)', () => {
    const NOTICES = {
      items: [{
        notificationId: 'n-1', templateId: 'join_request.approved',
        title: 'You are in', detail: 'Your request was approved.', href: null,
        kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null,
      }, {
        // An item with somewhere to go: the whole row is the link (P12.1-T3 AC-1).
        notificationId: 'n-2', templateId: 'coaching_session.finalized',
        title: 'Your coaching session was finalized', detail: 'Wilson Tanoto finalized your session.',
        href: '/coaching/me?session=s-0924', kpmId: 'kpm-1', createdAt: '2026-09-24T03:00:00.000Z', readAt: '2026-09-25T00:00:00.000Z',
      }],
      unread: 1,
      // More than one page, so the pager is drawn too.
      total: 45, page: 1, pageSize: 20,
    };
    const READ = { body: { notificationId: 'n-1', readAt: '2026-10-03T00:00:00.000Z', unread: 0 } };
    /** No row holds a control inside another: the toggle is the row's sibling. */
    const noNesting = () => {
      for (const control of document.querySelectorAll('li a[href], li button')) {
        expect(control.querySelector('a[href], button')).toBeNull();
      }
    };

    it('the notifications inbox, with one unread, one with an address, and the pager', async () => {
      // Cross-family, so it wears whichever chrome its reader signed in with — this checks
      // it inside the platform console, which is the combination that was broken.
      stubFetch({ '/notifications': { body: NOTICES } });
      renderWithSession(<NotificationsPage />, { me: SUPER_ADMIN });
      await screen.findByRole('button', { name: 'Unread: You are in' });
      await screen.findByRole('link', { name: 'Your coaching session was finalized' });
      expect(screen.getByRole('navigation', { name: 'Notification pages' })).toBeInTheDocument();
      noNesting();
      await expectClean('notifications');
    });

    it('the modal a row with nowhere to go opens', async () => {
      stubFetch({ 'POST /notifications/n-1/read': READ, '/notifications': { body: NOTICES } });
      renderWithSession(<NotificationsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: 'Unread: You are in' }));
      expect(screen.getByRole('dialog', { name: 'You are in' })).toBeInTheDocument();
      await expectClean('notifications (modal open)');
    });

    it('the bell’s popover, open in the platform console', async () => {
      stubFetch({ '/admin/overview': { body: OVERVIEW }, '/notifications': { body: { ...NOTICES, pageSize: 8 } } });
      renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
      await screen.findByText('2 offices have no Owner');
      await userEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
      const popover = screen.getByRole('dialog', { name: 'Notifications' });
      await within(popover).findByRole('button', { name: 'Unread: You are in' });
      noNesting();
      await expectClean('the bell’s popover');
    });

    it('the bell’s popover, with a row’s modal open over it', async () => {
      stubFetch({
        '/admin/overview': { body: OVERVIEW },
        'POST /notifications/n-1/read': READ,
        '/notifications': { body: { ...NOTICES, pageSize: 8 } },
      });
      renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
      await screen.findByText('2 offices have no Owner');
      await userEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
      await userEvent.click(await within(screen.getByRole('dialog', { name: 'Notifications' }))
        .findByRole('button', { name: 'Unread: You are in' }));
      expect(screen.getByRole('dialog', { name: 'You are in' })).toBeInTheDocument();
      await expectClean('the bell’s popover (modal open)');
    });
  });

  /*
   * The calendar (P12-T2 AC-11; H-18). Every state a reader meets it in: the week filled, empty and
   * compared, the month, and each dialog open — the entry dialog with its people list, the detail as
   * the organiser and as an invitee, the delete question, and *Block time*. The prototype's dialogs had
   * no role, no focus and no Escape, its entries were `div`s and its chips' ✕ were `span`s.
   */
  describe('the calendar (P12)', () => {
    const calendarRoutes = {
      ...SHELL_STUBS,
      // P13.1-T8: the toolbar's *Hide my personal activities* switch reads its state, so axe meets it too.
      '/calendar/settings': { body: { hideDetails: false } },
      '/calendar/entries?view=week': {
        body: weekRead({
          entries: [
            ...weekRead().entries,
            entry({ entryId: 'e-over', type: 'client', title: 'Client review', start: '09:15', end: '10:00' }),
            entry({
              entryId: 'e-invited', title: 'Goal review — Q4 planning', date: '2026-09-30', start: '09:00', end: '10:00',
              readerIs: 'invitee', myAnswer: 'pending', organiser: { membershipId: 'mem-owner', name: 'Hendra Kusnadi' },
              invitees: [{ membershipId: 'mem-agus', name: 'Agus Santoso', placed: false, readerCoaches: false }],
            }),
            entry({
              entryId: 'e-one', type: 'coaching', title: '1:1 Coaching — Indah Permata', date: '2026-10-01', start: '11:00', end: '12:00',
              invitees: [
                { membershipId: 'mem-indah', name: 'Indah Permata', placed: false, answer: 'accepted', readerCoaches: true },
                { membershipId: 'mem-rina', name: 'Rina Wijaya', placed: false, answer: 'pending', readerCoaches: false },
                { membershipId: 'mem-arief', name: 'Arief Nugroho', placed: true, readerCoaches: false },
              ],
            }),
          ],
        }),
      },
      '/calendar/entries?view=month': { body: monthRead() },
      '/calendar/people': { body: peoplePage() },
      '/calendar/downline': { body: DOWNLINE },
      '/calendar/entries?view=week&date=2026-09-28&for=mem-indah': {
        body: weekRead({ entries: [busy(), entry({ entryId: 'i-1', readerIs: 'ancestor', title: 'Prospecting', type: 'task' })] }),
      },
    };
    const open = async (me = AGUS) => {
      stubFetch(calendarRoutes);
      nav.pathname = '/calendar';
      renderInLayout(AgentLayout, <CalendarPage />, { me });
      return screen.findByRole('region', { name: 'Calendar, Sep 28 – Oct 4, 2026' });
    };

    it('the week, filled: overlapping entries, a trip, a pending invitation and the now-line', async () => {
      await open();
      await expectClean('calendar (week)');
    });

    it('the week, empty, for an Agent — the bare grid', async () => {
      stubFetch({ ...SHELL_STUBS, '/calendar/entries?view=week': { body: weekRead({ entries: [] }) } });
      nav.pathname = '/calendar';
      renderInLayout(AgentLayout, <CalendarPage />, { me: RINA });
      await screen.findByRole('region', { name: 'Calendar, Sep 28 – Oct 4, 2026' });
      await expectClean('calendar (empty week)');
    });

    it('the month', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await screen.findByText('September 2026');
      await expectClean('calendar (month)');
    });

    it('the entry dialog with the people list open and a chip chosen', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      const dialog = screen.getByRole('dialog', { name: 'New event' });
      await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
      await userEvent.click(await within(dialog).findByRole('option', { name: /^Indah Permata/ }));
      await within(dialog).findByText('KPM leadership');
      await expectClean('calendar (entry dialog, people list)');
    });

    it('m1 the people list as a combobox, a person reached with ↓, and its states', async () => {
      stubFetch({
        ...calendarRoutes,
        '/calendar/people?limit': { body: peoplePage() },
        '/calendar/people?q=zz': { body: peoplePage([]) },
      });
      nav.pathname = '/calendar';
      renderInLayout(AgentLayout, <CalendarPage />, { me: AGUS });
      await screen.findByRole('region', { name: 'Calendar, Sep 28 – Oct 4, 2026' });
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      const dialog = screen.getByRole('dialog', { name: 'New event' });
      const field = within(dialog).getByRole('combobox', { name: 'Invite (optional) — anyone in your KPM' });
      await expectClean('calendar (people combobox, collapsed)');
      await userEvent.click(field);
      await within(dialog).findByRole('listbox');
      await userEvent.keyboard('{ArrowDown}{ArrowDown}');
      expect(field).toHaveAttribute('aria-activedescendant', within(dialog).getByRole('option', { name: /^Sari Dewi/ }).id);
      await expectClean('calendar (people combobox, a person reached)');
      await userEvent.type(field, 'zz');
      await within(dialog).findByText('No matches.');
      await expectClean('calendar (people combobox, no matches)');
    });

    it('the entry dialog with every rule broken, and Travel chosen', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.click(screen.getByRole('button', { name: 'Travel' }));
      await userEvent.clear(screen.getByLabelText('Departure date'));
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      await screen.findByText('Choose a date.');
      await expectClean('calendar (entry dialog, invalid)');
    });

    it('the detail as the organiser: answers on the chips, a coachee’s link, a placed member', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^Coaching: 1:1 Coaching — Indah Permata/ }));
      await screen.findByRole('link', { name: 'Indah Permata' });
      await expectClean('calendar (detail, organiser)');
    });

    it('the detail as an invitee, Accept and Decline in place, the organiser’s chip first', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^Meeting: Goal review — Q4 planning/ }));
      await screen.findByRole('button', { name: 'Accept' });
      await expectClean('calendar (detail, invitee)');
    });

    it('the delete question over the detail', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^Meeting: Weekly unit standup/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await screen.findByRole('dialog', { name: 'Delete "Weekly unit standup"?' });
      await expectClean('calendar (delete question)');
    });

    it('compare: the popover open and a member’s week beside the reader’s, with a busy block', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await screen.findByRole('region', { name: 'Calendar, Indah Permata, Sep 28 – Oct 4, 2026' });
      await expectClean('calendar (compare)');
    });

    it('Block time, from the pill', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      await userEvent.click(await screen.findByRole('button', { name: /^Drag to block ?: Block time — Indah Permata$/ }));
      await screen.findByRole('dialog', { name: 'Block time — Indah Permata' });
      await expectClean('calendar (block time)');
    });
  });

  /*
   * The 90-day activation (P13): the hire's page with the leader's note and a row opened, the page a
   * reader without one meets, the roster, one hire's detail, and the coaching tab — the person shell's
   * and the reader's own.
   */
  describe('the 90-day activation (P13)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };

    it('the hire’s page, filled: a row’s note and date open, an Auto chip’s words shown, and the leader’s note (P13-T4)', async () => {
      nav.pathname = '/activation';
      stubFetch({ ...SHELL, '/activation/me': { body: activationView() } });
      renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
      await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
      await userEvent.click(within(document.querySelector('[data-code="INSURANCE_BASICS"]') as HTMLElement)
        .getByRole('button', { name: 'Show note and date' }));
      await userEvent.click(screen.getAllByRole('button', { name: /^Auto — / })[0]);
      await expectClean('activation');
    });

    it('the hire’s page at 100%, with the graduation confirm open (P13-T7)', async () => {
      nav.pathname = '/activation';
      stubFetch({ ...SHELL, '/activation/me': { body: completeView() } });
      renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
      await userEvent.click(await screen.findByRole('button', { name: 'Mark activation complete →' }));
      await screen.findByRole('dialog');
      await expectClean('activation (confirm)');
    });

    it('the hire’s page for a reader with no activation (P13-T4 AC-7)', async () => {
      nav.pathname = '/activation';
      stubFetch({ ...SHELL, '/activation/me': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
      renderInLayout(AgentLayout, <ActivationPage />, { me: { ...RINA_ME, activation: null } });
      await screen.findByRole('heading', { level: 2, name: 'You have no 90-day activation.' });
      await expectClean('activation (none)');
    });

    it('the roster, populated: three groups, an overdue day and a closed first case (P13-T5)', async () => {
      nav.pathname = '/new-hires';
      stubFetch({ ...SHELL, '/new-hires': { body: ROSTER } });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
      await screen.findByRole('region', { name: 'AAB: Arief Hidayat' });
      await expectClean('new-hires');
    });

    it('the roster with nobody on it (P13-T5)', async () => {
      nav.pathname = '/new-hires';
      stubFetch({ ...SHELL, '/new-hires': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
      await screen.findByText('No one you lead is in their 90-day activation right now.');
      await expectClean('new-hires (empty)');
    });

    it('one hire’s detail, overdue, with the start date’s correction and the coaching note (P13-T5, P13-T6)', async () => {
      nav.pathname = '/new-hires/mem-rina';
      stubFetch({
        ...SHELL,
        '/new-hires/mem-rina': { body: leaderView({ day: 95, overdue: true, startCorrected: { by: SARI, at: '2026-09-01T02:00:00.000Z' } }) },
      });
      renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
      await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
      await expectClean('new-hires/[membershipId]');
    });

    const coachee = {
      membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
      leader: { membershipId: 'mem-sari', name: 'Sari Puspita' }, direct: true, downline: { members: 0, leaders: 0 },
    };

    it('a person’s Activation tab, populated (P13-T9)', async () => {
      nav.pathname = '/coaching/mem-rina/activation';
      stubFetch({ ...SHELL, '/coaching/coachees/': { body: coachee }, '/new-hires/mem-rina': { body: leaderView() } });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>,
        { me: SARI_ME },
      );
      await screen.findByRole('region', { name: '90-Day Activation' });
      await expectClean('coaching/[membershipId]/activation');
    });

    it('a person’s Activation tab for somebody with none (P13-T9 AC-3)', async () => {
      nav.pathname = '/coaching/mem-rina/activation';
      stubFetch({
        ...SHELL,
        '/coaching/coachees/': { body: coachee },
        '/new-hires/mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } },
      });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>,
        { me: SARI_ME },
      );
      await screen.findByText('Rina Wijaya has no 90-day activation.');
      await expectClean('coaching/[membershipId]/activation (none)');
    });

    it('the reader’s own Activation tab on their coaching (P13-T9 AC-4)', async () => {
      nav.pathname = '/coaching/me/activation';
      stubFetch({ ...SHELL, '/activation/me': { body: activationView() } });
      renderInLayout(AgentLayout, <MyCoachingActivationPage />, { me: RINA_ME });
      await screen.findByRole('region', { name: '90-Day Activation' });
      await expectClean('coaching/me/activation');
    });
  });

  /*
   * The five Phase 4 settings screens (P4-T21).
   *
   * None of them was here, against `frontend/CLAUDE.md`'s "every screen through axe, in
   * its populated state" — and the two accessibility defects P4-T20 found by reading are
   * exactly what this suite exists to find without reading: a hint rendered beside a
   * field rather than linked to it, and a raw code used as a field's label.
   */
  /*
   * Sales tools (Phase 14): the catalog filled and empty, its drawer open on each tab, and the Sales Attack
   * Plan's two steps — a plan with its alternatives, a Check fit, and the catalog's run-off deep link.
   */
  describe('sales tools (Phase 14)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    const query = (q: Record<string, string>) => Object.assign(Promise.resolve(q), { status: 'fulfilled', value: q });

    it('the Product Catalog, filled (P14-T7)', async () => {
      nav.pathname = '/product-catalog';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
      renderInLayout(AgentLayout, <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'Life' });
      await expectClean('product-catalog');
    });

    it('the Product Catalog, its shelf empty (P14-T7 AC-10)', async () => {
      nav.pathname = '/product-catalog';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: [] } } });
      renderInLayout(AgentLayout, <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, { me: SALES_ME });
      await screen.findByText('There are no products on your shelf yet.');
      await expectClean('product-catalog (empty)');
    });

    it.each(['Details', 'Attack Plan', 'Documents'])('the drawer open on %s (P14-T7 AC-11)', async (tab) => {
      nav.pathname = '/product-catalog/PRUMAPAN';
      stubFetch({
        ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRUMAPAN': { body: salesProduct() },
      });
      renderInLayout(
        AgentLayout,
        <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>,
        { me: SALES_ME },
      );
      const box = await screen.findByRole('dialog', { name: 'PRUMapan (nama kami)' });
      await userEvent.click(within(box).getByRole('tab', { name: tab }));
      await expectClean(`product-catalog/[productCode] (${tab})`);
    });

    it('the drawer of a run-off product (P14-T7 AC-5)', async () => {
      nav.pathname = '/product-catalog/PRULINK_GENERASI_BARU_PGB';
      stubFetch({
        ...SHELL, 'GET /product-catalog': { body: { products: SHELF } },
        'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB },
      });
      renderInLayout(
        AgentLayout,
        <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRULINK_GENERASI_BARU_PGB' })} /></ProductCatalogLayout>,
        { me: SALES_ME },
      );
      await screen.findByRole('dialog', { name: 'PRULink Generasi Baru (PGB)' });
      await expectClean('product-catalog/[productCode] (run-off)');
    });

    it('the Sales Attack Plan’s brief, part chosen (P14-T8)', async () => {
      nav.pathname = '/attack-plan';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
      renderInLayout(AgentLayout, <AttackPlanPage searchParams={query({})} />, { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(screen.getByRole('group', { name: 'Primary need' })).getByRole('button', { name: 'Health' }));
      await expectClean('attack-plan (brief)');
    });

    it('the Sales Attack Plan’s plan, with four chips and the more line (P14-T8)', async () => {
      nav.pathname = '/attack-plan';
      const alternatives = ['A', 'B', 'C', 'D'].map((c) => ({ code: c, name: `Product ${c}` }));
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /attack-plan': { body: salesPlan({ alternatives, moreCount: 3 }) } });
      renderInLayout(AgentLayout, <AttackPlanPage searchParams={query({ need: 'health', age: '2', budget: '2' })} />, { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'PRUMapan (nama kami)' });
      await expectClean('attack-plan (plan)');
    });

    it('the Sales Attack Plan’s Check fit, with its note (P14-T8)', async () => {
      nav.pathname = '/attack-plan';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /attack-plan': { body: salesPlan({ verdict: 'check_fit', outside: ['age', 'budget'] }) } });
      renderInLayout(AgentLayout, <AttackPlanPage searchParams={query({ need: 'retirement', age: '5', budget: '6' })} />, { me: SALES_ME });
      await screen.findByText(/Outside the typical age band and budget band/);
      await expectClean('attack-plan (check fit)');
    });

    it('the catalog’s deep link to a run-off product (P14-T8 AC-6)', async () => {
      nav.pathname = '/attack-plan';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      renderInLayout(AgentLayout, <AttackPlanPage searchParams={query({ product: 'PRULINK_GENERASI_BARU_PGB' })} />, { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'PRULink Generasi Baru (PGB)' });
      await expectClean('attack-plan (from catalog, run-off)');
    });
  });

  describe('Recruitment › Attack Plan (P17-T3 AC-8)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    const query = (q: Record<string, string>) => Object.assign(Promise.resolve(q), { status: 'fulfilled', value: q });
    const attackPlan = (q: Record<string, string>) => (
      <RecruitmentLayout><RecruitmentAttackPlanPage searchParams={query(q)} /></RecruitmentLayout>
    );

    it('the brief, part chosen', async () => {
      nav.pathname = '/recruitment/attack-plan';
      stubFetch({ ...SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView() } });
      renderInLayout(AgentLayout, attackPlan({}), { me: RECRUITMENT_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(screen.getByRole('group', { name: 'Candidate type' })).getByRole('button', { name: 'Retiree' }));
      await userEvent.click(
        within(screen.getByRole('group', { name: 'What\'s driving them' })).getByRole('button', { name: 'Full career change' }),
      );
      await expectClean('recruitment/attack-plan (brief)');
    });

    it('the plan, with two opening lines under their tags and two push-backs', async () => {
      nav.pathname = '/recruitment/attack-plan';
      stubFetch({ ...SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView(recruitmentPlan()) } });
      renderInLayout(AgentLayout, attackPlan(RECRUITMENT_BRIEF), { me: RECRUITMENT_ME });
      await screen.findByRole('heading', { level: 2, name: 'Fresh graduate' });
      await expectClean('recruitment/attack-plan (plan)');
    });

    it('a company with no playbook (AC-7)', async () => {
      nav.pathname = '/recruitment/attack-plan';
      stubFetch({ ...SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView(null, false) } });
      renderInLayout(AgentLayout, attackPlan({}), { me: RECRUITMENT_ME });
      await screen.findByText('No recruitment plan can be built yet.');
      await expectClean('recruitment/attack-plan (no playbook)');
    });
  });

  describe('the recruitment pitch (P17-T5 AC-7, P17-T6 AC-6)', () => {
    const PITCH_SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    const ITEMS = [
      ['career-path', 'Career Path Ladder (Agent → AAB → AB)'],
      ['income', 'Income Potential / compensation illustration'],
      ['support', 'Support provided (training, coaching, tools)'],
      ['commitment', 'Commitment needed — contract maintenance and required activity'],
    ];
    const pdfFile = (name: string) => ({ name, bytes: 2.4 * 1024 * 1024, uploadedOn: '2026-09-12' });
    const pitchSlot = (slot: string, title: string, state: string, ticked: string[] | null, fileName: string | null) => ({
      slot, title, line: `${title}'s line`, state, file: fileName ? pdfFile(fileName) : null, version: fileName ? 1 : 0,
      checklist: ticked === null ? [] : ITEMS.map(([code, label]) => ({ code, label, ticked: ticked.includes(code) })),
    });
    const PITCH = {
      empty: {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'missing', [], null),
          pitchSlot('proof', 'Proof & Credibility', 'missing', null, null),
          pitchSlot('faq', 'FAQ', 'missing', null, null),
          pitchSlot('howtojoin', 'How to Join', 'missing', null, null),
        ],
        summary: { done: 0, total: 4, missing: 4, unconfirmed: 0 },
      },
      'partly confirmed': {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'partial', ['career-path', 'support'], 'Opportunity_Overview_v3.pdf'),
          pitchSlot('proof', 'Proof & Credibility', 'uploaded', null, 'Proof_and_Credibility_2026.pdf'),
          pitchSlot('faq', 'FAQ', 'missing', null, null),
          pitchSlot('howtojoin', 'How to Join', 'missing', null, null),
        ],
        summary: { done: 1, total: 4, missing: 2, unconfirmed: 1 },
      },
      complete: {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'complete', ITEMS.map(([c]) => c), 'Opportunity_Overview_v3.pdf'),
          pitchSlot('proof', 'Proof & Credibility', 'uploaded', null, 'Proof_and_Credibility_2026.pdf'),
          pitchSlot('faq', 'FAQ', 'uploaded', null, 'FAQ.pdf'),
          pitchSlot('howtojoin', 'How to Join', 'uploaded', null, 'How_to_Join.pdf'),
        ],
        summary: { done: 4, total: 4, missing: 0, unconfirmed: 0 },
      },
    } as const;
    const officeMember = {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
      isKpmOwner: true, isKpmAdmin: false, status: 'active' as const, directCount: 0,
    };
    const PITCH_OWNER = makeMe({
      membership: officeMember,
      permissions: ['member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile', 'recruitment:read'],
    });
    const PITCH_SUPPORT = makeMe({
      membership: officeMember,
      permissions: ['member:read_profile', 'tenant_config:read', 'kpm:read_profile', 'recruitment:read'],
      isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root',
    });

    it.each(Object.keys(PITCH) as (keyof typeof PITCH)[])('Settings › Recruitment pitch, %s (P17-T5)', async (state) => {
      nav.pathname = '/kpm/settings/recruitment-pitch';
      stubFetch({ ...PITCH_SHELL, 'GET /recruitment/pitch-materials': { body: PITCH[state] } });
      renderInLayout(TenantLayout, <RecruitmentPitchPage />, { me: PITCH_OWNER });
      await screen.findByRole('article', { name: 'How to Join' });
      await expectClean(`kpm/settings/recruitment-pitch (${state})`);
    });

    it('Settings › Recruitment pitch in a read-only support session, the boxes disabled', async () => {
      nav.pathname = '/kpm/settings/recruitment-pitch';
      stubFetch({ ...PITCH_SHELL, 'GET /recruitment/pitch-materials': { body: PITCH['partly confirmed'] } });
      renderInLayout(TenantLayout, <RecruitmentPitchPage />, { me: PITCH_SUPPORT });
      await screen.findByRole('article', { name: 'How to Join' });
      expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
      await expectClean('kpm/settings/recruitment-pitch (read-only support session)');
    });

    it('Settings › Recruitment pitch with a refusal and a stale tick said in their cards', async () => {
      nav.pathname = '/kpm/settings/recruitment-pitch';
      stubFetch({
        ...PITCH_SHELL,
        'GET /recruitment/pitch-materials': { body: PITCH['partly confirmed'] },
        'PUT /confirmations/income': {
          status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Changed.', requestId: 'r-1' } },
        },
      });
      renderInLayout(TenantLayout, <RecruitmentPitchPage />, { me: PITCH_OWNER });
      const opportunity = await screen.findByRole('article', { name: 'Opportunity Overview' });
      await userEvent.click(within(opportunity).getByRole('checkbox', { name: ITEMS[1][1] }));
      await within(opportunity).findByText(/This PDF was replaced while the page was open/);
      // Named like a PDF, so the picker's own filter lets it through to the card's check.
      await userEvent.upload(
        screen.getByRole('article', { name: 'FAQ' }).querySelector('input[type=file]') as HTMLInputElement,
        new File(['x'], 'scan.pdf', { type: 'image/png' }),
      );
      await screen.findByText(/is not a PDF/);
      await expectClean('kpm/settings/recruitment-pitch (refusals)');
    });

    it.each(Object.keys(PITCH) as (keyof typeof PITCH)[])('Recruitment › Pitch Materials, %s (P17-T6)', async (state) => {
      nav.pathname = '/recruitment/pitch-materials';
      stubFetch({ ...PITCH_SHELL, 'GET /recruitment/pitch-materials': { body: PITCH[state] } });
      renderInLayout(AgentLayout, <RecruitmentLayout><PitchMaterialsPage /></RecruitmentLayout>, { me: RECRUITMENT_ME });
      await screen.findByRole('article', { name: 'How to Join' });
      await expectClean(`recruitment/pitch-materials (${state})`);
    });

    it('Recruitment › Pitch Materials, its read failed', async () => {
      nav.pathname = '/recruitment/pitch-materials';
      stubFetch({
        ...PITCH_SHELL,
        'GET /recruitment/pitch-materials': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Broke.', requestId: 'r-2' } } },
      });
      renderInLayout(AgentLayout, <RecruitmentLayout><PitchMaterialsPage /></RecruitmentLayout>, { me: RECRUITMENT_ME });
      await screen.findByRole('button', { name: 'Try again' });
      await expectClean('recruitment/pitch-materials (error)');
    });
  });

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
      // `product_settings:read` is the Products screen's own (the Phase 14 exit review).
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
        'product_settings:read',
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
        'product_settings:read', 'sales_script:approve',
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
      summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling',
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

    it('activity types, a section’s edit open with its summary tile (P10.1-T5)', async () => {
      stubFetch({ ...configStubs, '/kpm/settings/activity-types': { body: TAXONOMY } });
      renderInLayout(
        TenantLayout,
        <ActivityTypesPage />,
        { me: settingsOwner },
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Rename' }));
      expect(screen.getByLabelText('Summary tile')).toHaveValue('Selling');
      await expectClean('kpm/settings/activity-types, section edit');
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
            // OD-136: the description field, open in the panel walked below.
            description: f('Endowment-style life with guaranteed retirement payouts.'),
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
            // OD-136: a pending description is a line the queue shows with the script's.
            description: f('Pensiun tenang dari usia 55.', true),
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
                      completesWhen: 'the hire has saved any goal since joining', live: true,
                    },
                  },
                  // A link that does not work: its badge reads *Ticked by hand* (P13-T3 AC-1).
                  {
                    code: 'MANDATORY_TRAINING', label: 'Mandatory training: selling skill & product knowledge',
                    displayOrder: 3, autoLink: 'training:PROSPECT_LIST',
                    link: {
                      kind: 'training:PROSPECT_LIST', label: 'Building Your Prospect List', route: '/training',
                      completesWhen: 'the hire has completed that training module', live: false,
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

    /** P13.2-T6: the company's one template, its default — what the picker opens on. */
    const COMPANY_TEMPLATES = [{
      id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active',
      archivedAt: null, origin: { kind: 'migration' }, officeCount: 1,
      publishedVersions: {
        activity_taxonomy: 1, lead_pipeline: 1, ratio_set: 1, activation_checklist: 1,
        training_taxonomy: 1, capability_ladder: 1, event_types: 1,
      },
      createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    }];

    it('the company template’s Training tab', async () => {
      stubFetch({
        // P13.2-T6: the picker reads the company’s templates before any tab.
        '/admin/companies/c1/templates': { body: COMPANY_TEMPLATES },
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
        // P13.2-T6: the picker reads the company’s templates before any tab.
        '/admin/companies/c1/templates': { body: COMPANY_TEMPLATES },
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
        // P13.2-T6: the picker reads the company’s templates before any tab.
        '/admin/companies/c1/templates': { body: COMPANY_TEMPLATES },
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
        // P13.2-T6: the picker reads the company’s templates before any tab.
        '/admin/companies/c1/templates': { body: COMPANY_TEMPLATES },
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

  /** P17-T8: the Company template's *Recruitment* tab — the company's playbook, a card open. */
  describe('the Company template’s Recruitment tab (P17-T8)', () => {
    const PLAYBOOK_TEMPLATES = [{
      id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active',
      archivedAt: null, origin: { kind: 'migration' }, officeCount: 1, publishedVersions: { activity_taxonomy: 1 },
      createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    }];
    const words = { theySay: 'I’m not sure I have much time to give this right now.', youSay: 'Activity is tracked, not hours.' };
    const body = {
      profiles: {
        retiree: {
          label: 'Retiree', tagline: 'Re-entering the workforce after time away.',
          goodFitFor: 'Someone who needs flexibility more than a fixed schedule.',
          benefits: ['Flexible schedule.', 'No resume-gap penalty.'],
          openings: { flexibility: 'What’s the actual time you have available in a normal week right now?' },
        },
      },
      objections: { time: words },
      profileObjections: { retiree: { time: words } },
      nextAction: 'Send them the Opportunity Overview from Pitch Materials.',
    };

    it('the playbook, with a candidate type and the objections open', async () => {
      stubFetch({
        '/admin/companies/c1/templates': { body: PLAYBOOK_TEMPLATES },
        '/admin/companies/c1/template': {
          body: {
            id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1, status: 'draft',
            payload: { categories: [], types: [] },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/recruitment-playbook': {
          body: {
            playbook: { companyId: 'c1', version: 2, body, updatedAt: '2026-10-09T07:05:00.000Z', updatedBy: { name: 'Root' } },
            defaults: body,
            vocabulary: {
              types: [{ code: 'retiree', label: 'Retiree' }],
              motivations: [{ code: 'flexibility', label: 'Flexibility / time freedom' }],
              hesitations: [{ code: 'time', label: 'Worried about time commitment' }],
            },
            limits: { textMax: 600, benefitsMax: 6 },
          },
        },
      });
      renderInLayout(
        AdminLayout,
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'company_template:read'] }) },
      );
      const sections = within(await screen.findByRole('navigation', { name: 'Template sections' }));
      await userEvent.click(sections.getByRole('link', { name: 'Recruitment' }));
      await screen.findByText('This playbook is live.');
      for (const name of ['Retiree', 'Objections']) {
        await userEvent.click(within(screen.getByRole('group', { name })).getByRole('button', { name: 'Edit' }));
      }
      await expectClean('admin/companies/[companyId]/template#recruitment');
    });
  });

  describe('KPM analytics (P18-T2 AC-10)', () => {
    const analyticsPage = (period?: string) => (
      <KpmAnalyticsLayout>
        <KpmAnalyticsPage searchParams={routeParams(period ? { period } : {})} />
      </KpmAnalyticsLayout>
    );

    it('filled: the comparison with an agency open, its people listed, every MOC state and badge, the chart', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView() } });
      renderInLayout(TenantLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByRole('table', { name: 'Unit comparison' });
      await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
      await userEvent.click(screen.getByRole('button', { name: '31 people in Hendra Wibowo’s agency' }));
      await expectClean('kpm/analytics');
    });

    it('the MOC dialog, met and with an input not uploaded', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView('previous_month') } });
      renderInLayout(TenantLayout, analyticsPage('previous_month'), { me: ANALYTICS_OWNER });
      await screen.findByRole('table', { name: 'Unit comparison' });
      await userEvent.click(screen.getByRole('button', { name: 'MOC requirements met for Hendra Wibowo' }));
      await screen.findByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' });
      await expectClean('kpm/analytics (MOC dialog)');

      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await userEvent.click(screen.getByRole('button', { name: /^MOC for Wilson Tanoto — / }));
      await screen.findByRole('dialog', { name: 'Wilson Tanoto — Maintenance of Contract' });
      await expectClean('kpm/analytics (MOC dialog, unknown)');
    });

    it('no AB yet, and the error with its retry', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: ANALYTICS_NO_AB } });
      renderInLayout(TenantLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByText('There are no ABs to compare yet.');
      await expectClean('kpm/analytics (no AB)');

      cleanup();
      vi.unstubAllGlobals();
      stubFetch({
        ...ANALYTICS_SHELL,
        'GET /kpm/analytics': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } },
      });
      renderInLayout(TenantLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByRole('button', { name: 'Try again' });
      await expectClean('kpm/analytics (error)');
    });

    it('the Compliance, Events, and Campaigns sign', async () => {
      nav.pathname = '/kpm/analytics/compliance';
      stubFetch(ANALYTICS_SHELL);
      renderInLayout(TenantLayout, <KpmAnalyticsLayout><KpmAnalyticsCompliancePage /></KpmAnalyticsLayout>, { me: ANALYTICS_OWNER });
      await within(screen.getByRole('main')).findByText('Upcoming');
      await expectClean('kpm/analytics/compliance');
    });
  });

  describe('the Strategic Leader Forum (P18.1-T2 AC-8, P18.1-T3)', () => {
    const meetingPage = <LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />;
    const meetingTitle = () => screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });

    it('the list, populated and filtered to nothing, and empty', async () => {
      nav.pathname = '/leader-meetings';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings': { body: forumList() } });
      renderWithSession(<LeaderMeetingsPage />, { me: FORUM_OWNER });
      await screen.findByText('Strategic Check-in — #14');
      await expectClean('leader-meetings');

      cleanup();
      vi.unstubAllGlobals();
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings': { body: forumList({ meetings: [] }) } });
      renderWithSession(<LeaderMeetingsPage />, { me: FORUM_OWNER });
      await screen.findByText('No meetings yet.');
      await expectClean('leader-meetings (empty)');
    });

    it('New meeting, with a refusal under its field', async () => {
      nav.pathname = '/leader-meetings';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings': { body: forumList() } });
      renderWithSession(<LeaderMeetingsPage />, { me: FORUM_OWNER });
      await userEvent.click(await screen.findByRole('button', { name: '+ New meeting' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create meeting' }));
      await screen.findByText('Pick a date.');
      await expectClean('leader-meetings (New meeting)');
    });

    it('a meeting on each of its three tabs', async () => {
      nav.pathname = '/leader-meetings/m-14';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/m-14': { body: forumMeeting() } });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await meetingTitle();
      await expectClean('leader-meetings/[meetingId] (Overview & Stats)');
      await userEvent.click(screen.getByRole('tab', { name: 'Agenda' }));
      await expectClean('leader-meetings/[meetingId] (Agenda)');
      await userEvent.click(screen.getByRole('tab', { name: 'Action Items' }));
      await expectClean('leader-meetings/[meetingId] (Action Items)');
    });

    it('Meeting details, asking before a delete', async () => {
      nav.pathname = '/leader-meetings/m-14';
      const fresh = forumMeeting({ writtenIn: false, can: { ...forumMeeting().can, delete: true } });
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/m-14': { body: fresh } });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      await screen.findByRole('dialog', { name: 'Meeting details' });
      await expectClean('leader-meetings/[meetingId] (Meeting details)');
      await userEvent.click(screen.getByRole('button', { name: 'Delete meeting' }));
      await expectClean('leader-meetings/[meetingId] (Delete meeting?)');
    });

    it('Share this MOM, with its link', async () => {
      nav.pathname = '/leader-meetings/m-14';
      stubFetch({
        ...FORUM_SHELL,
        'GET /leader-meetings/m-14': { body: forumMeeting() },
        'POST /leader-meetings/m-14/share-links': { status: 201, body: { token: 'tok_abc', expiresAt: '2026-10-24T03:00:00.000Z' } },
      });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      await screen.findByRole('button', { name: 'Copy link' });
      await expectClean('leader-meetings/[meetingId] (Share this MOM)');
    });

    it('the shared view, read-only, and the not-found states', async () => {
      nav.pathname = '/leader-meetings/shared/tok_abc';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/shared/tok_abc': { body: forumMeeting({ via: 'link', can: FORUM_LINK_CAN }) } });
      renderWithSession(<SharedLeaderMeetingPage params={routeParams({ token: 'tok_abc' })} />, { me: FORUM_FIELD });
      await meetingTitle();
      await expectClean('leader-meetings/shared/[token]');

      cleanup();
      vi.unstubAllGlobals();
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/shared/': FORUM_NOT_FOUND });
      renderWithSession(<SharedLeaderMeetingPage params={routeParams({ token: 'gone' })} />, { me: FORUM_FIELD });
      await screen.findByText("This link doesn't open anything.");
      await expectClean('leader-meetings/shared/[token] (not found)');

      cleanup();
      vi.unstubAllGlobals();
      nav.pathname = '/leader-meetings/m-14';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/m-14': FORUM_NOT_FOUND });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await screen.findByText("This meeting can't be found.");
      await expectClean('leader-meetings/[meetingId] (not found)');
    });
  });
});
