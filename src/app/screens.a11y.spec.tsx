import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import KpmRequestsPage from './(admin)/admin/kpm-requests/page';
import LeaderLimitRequestsPage from './(admin)/admin/leader-limit-requests/page';
import TenantAdminsPage from './(admin)/admin/tenant-admins/page';
import NotificationsPage from './notifications/page';
import TenantLayout from '@/app/(tenant)/layout';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, InLanguage, makeMe, renderInLayout, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { englishShown, everyAreasEnglish } from '@test/english-left';
import { watchKeptTerms } from '@/i18n/kept-lang';
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
  EMPTY as OVERVIEW_EMPTY, NOBODY as OVERVIEW_NOBODY, NOT_LOGGED as OVERVIEW_NOT_LOGGED, noTeam as overviewNoTeam,
  overviewView as overviewFixture,
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
import CoacheeActivityTab from './(agent)/coaching/[membershipId]/activity/page';
import CoacheeLeadsTabPage from './(agent)/coaching/[membershipId]/leads/page';
import CoachingPersonIndex from './(agent)/coaching/[membershipId]/page';
import Home from './page';
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
import PeopleImportPage from './(tenant)/people/import/page';
import OrgLevelsPage from './(admin)/admin/org-levels/page';
import TenantRosterImportPage from './(admin)/admin/tenants/[kpmId]/roster/page';
import ChooseAPasswordPage from './choose-a-password/page';
import JoinPage from './join/page';
import CalendarPage from './(agent)/calendar/page';
import ActivationPage from './(agent)/activation/page';
import NewHiresPage from './(agent)/new-hires/page';
import NewHireDetailPage from './(agent)/new-hires/[membershipId]/page';
import CoacheeActivationTab from './(agent)/coaching/[membershipId]/activation/page';
import MyCoachingActivationPage from './(agent)/coaching/me/activation/page';
import { activationView, completeView, leaderView, RINA_ME, ROSTER, SARI, SARI_ME, withWaitingCheckIn } from '@test/activation-fixtures';
import {
  invite, joinRequest, JOINING_PERMISSIONS, requestedTransfer, shared, TODAY as JOINING_TODAY, transfer,
} from '@test/joining-fixtures';
import ProductCatalogLayout from './(agent)/product-catalog/layout';
import CampaignsLayout from './(agent)/campaigns/layout';
import CampaignsPage from './(agent)/campaigns/page';
import CampaignDialogPage from './(agent)/campaigns/[campaignCode]/page';
import {
  detail as campaignDetail, LIST as CAMPAIGN_LIST, RINA_CHASING as CAMPAIGNS_RINA_CHASING, RINA_ME as CAMPAIGNS_RINA,
} from '@test/campaigns-fixtures';
import ProductCatalogPage from './(agent)/product-catalog/page';
import ProductDrawerPage from './(agent)/product-catalog/[productCode]/page';
import AttackPlanPage from './(agent)/attack-plan/page';
import LearnerTrainingLayout from './(agent)/training/layout';
import LearnerCategoryPage from './(agent)/training/[categoryCode]/page';
import LearnerModulePage from './(agent)/training/[categoryCode]/[moduleCode]/page';
import MyCoachingTrainingPage from './(agent)/coaching/me/training/page';
import {
  LEARNER as TRAINING_LEARNER, modulePage as trainingModulePage, PRODUCT as TRAINING_PRODUCT,
  progressView as trainingProgressView, SALES as TRAINING_SALES, skill as trainingSkill, SUPPORT as TRAINING_SUPPORT,
} from '@test/training-fixtures';
import {
  PGB, plan as salesPlan, product as salesProduct, RINA_ME as SALES_ME, SHELF,
} from '@test/sales-tools-fixtures';
import {
  agendaRead, AGUS, busy, coachingTask, DOWNLINE, entry, joinedEvent, leadTask, monthRead, peoplePage, RINA, SHELL_STUBS,
  threeDayRead, weekRead,
} from '@test/calendar-fixtures';
import {
  activities as unitActivities, AGUS_ME as UNIT_READER, dashboard as unitDashboard, EMPTY as UNIT_EMPTY, NEW_HIRE_VIEW as UNIT_NEW_HIRE,
  RATIOS as UNIT_RATIOS,
  SARI_UNIT,
} from '@test/unit-dashboard-fixtures';
import RecruitmentLayout from './(agent)/recruitment/layout';
import RecruitmentAttackPlanPage from './(agent)/recruitment/attack-plan/page';
import {
  BRIEF as RECRUITMENT_BRIEF, plan as recruitmentPlan, RINA_ME as RECRUITMENT_ME, view as recruitmentView,
} from '@test/recruitment-plan-fixtures';
import RecruitmentPitchPage from './(tenant)/kpm/settings/recruitment-pitch/page';
import PitchMaterialsPage from './(agent)/recruitment/pitch-materials/page';
import KpmAnalyticsLayout from './kpm/analytics/layout';
import KpmAnalyticsPage from './kpm/analytics/page';
import KpmAnalyticsCompliancePage from './kpm/analytics/compliance/page';
import {
  analyticsView, CORE_LEADER_ME as ANALYTICS_CORE_LEADER, NO_AB as ANALYTICS_NO_AB, OWNER_ME as ANALYTICS_OWNER,
  SHELL_STUBS as ANALYTICS_SHELL,
} from '@test/kpm-analytics-fixtures';
import {
  complianceView, EMPTY_CATALOG as COMPLIANCE_EMPTY_CATALOG, NO_AB as COMPLIANCE_NO_AB,
} from '@test/kpm-compliance-fixtures';
import LeaderMeetingsPage from './leader-meetings/page';
import LeaderMeetingPage from './leader-meetings/[meetingId]/page';
import SharedLeaderMeetingPage from './leader-meetings/shared/[token]/page';
import {
  FIELD_ME as FORUM_FIELD, LINK_CAN as FORUM_LINK_CAN, listView as forumList, meetingView as forumMeeting,
  notFound as FORUM_NOT_FOUND, OWNER_ME as FORUM_OWNER, SHELL_STUBS as FORUM_SHELL,
} from './leader-meetings/forum-fixtures';
import EventsLayout from './(agent)/events/layout';
import EventsPage from './(agent)/events/page';
import EventModalPage from './(agent)/events/[eventId]/page';
import {
  BOOTCAMP as EVENT_BOOTCAMP, eventList as eventsList, feedbackSummary as eventFeedbackSummary, INVITEES as EVENT_INVITEES,
  KICKOFF as EVENT_KICKOFF, PRULINK as EVENT_PRULINK, RINA_ME as EVENTS_ME, rollCall as eventRollCall,
  SHELL_STUBS as EVENTS_SHELL, TOWN_HALL as EVENT_TOWN_HALL,
} from '@test/events-fixtures';
// UI V1 (Phase 18.99 T2): the shared components, before the pages adopt them.
import { AgentSearch } from '@/components/agent-search';
import { ContactButtons } from '@/components/contact-buttons';
import { GoalHeroCard } from '@/components/goal-hero-card';
import { RatioCard } from '@/components/ratio-card';
import { ActionRow } from '@/components/ui/action-row';
import { ActivityPill } from '@/components/ui/activity-pill';
import { AutoMarker } from '@/components/ui/auto-marker';
import { EmptyState } from '@/components/ui/empty-state';
import { PersonRow, TreeIndent, TreeNode, TreeToggle } from '@/components/ui/person-row';
import { SaveStateLabel } from '@/components/ui/save-state';
import { SliderWithValue } from '@/components/ui/slider-with-value';
import { StatTile } from '@/components/ui/stat-tile';
import { StepperRow } from '@/components/ui/stepper-row';
import { TonePill } from '@/components/ui/tone-pill';

/**
 * Where the screen is, for the one shell that reads it: the coaching person shell's archive (P11-T10),
 * and the address the archive's page reads its ids from (`useParams()`, F5 of P11's final walk).
 */
const nav = vi.hoisted(() => ({ pathname: '/admin', params: {} as Record<string, string>, search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => nav.params,
  // The Product Catalog reads its filters from the address (Phase 14, D-urls).
  // And an invite's link its token (P18.96-T3): `?invite=…` on `/register` and `/join`.
  useSearchParams: () => new URLSearchParams(nav.search),
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

/**
 * What these fixtures type that a message also writes in English: an office's or a company's words, shown as typed in
 * both languages — the library company named *Template*, a request's branch *Surabaya Branch* (the register form's
 * English example) — and the roster file's month column, `YYYY-MM`, a machine format and not a word.
 */
const TYPED_LIKE_A_MESSAGE = new Set(['Template', 'Surabaya Branch', 'YYYY-MM']);

/** Every area's English-only words: what no screen in ID mode may show (P18.98-T7 AC-1). */
const EVERY_ENGLISH = (await everyAreasEnglish()).filter((word) => !TYPED_LIKE_A_MESSAGE.has(word));

/** A case that renders its screen in ID mode says so in its name: `(id)`, `(id, …)`, `(…, id)` or *in Indonesian*. */
const IN_INDONESIAN = /(?:\(|, )id[,)]|Indonesian/;

/** How many kept terms axe met marked `lang="en"`, over every case in ID mode: none would mean axe never saw a mark. */
let keptTermsMarked = 0;
afterAll(() => expect(keptTermsMarked).toBeGreaterThan(0));

/**
 * axe over the screen as rendered. **In ID mode** (P18.98-T7 AC-1, AC-2) the screen is also read for a message
 * missing or an English word the glossary does not keep — every area's, not only the screen's own — and axe runs
 * with the kept terms marked `lang="en"`, as the app's provider marks them (`watchKeptTerms`).
 */
async function expectClean(name: string) {
  const indonesian = IN_INDONESIAN.test(name);
  if (indonesian) expect(englishShown(document.body, EVERY_ENGLISH), `${name}: English left`).toEqual([]);
  const stop = indonesian ? watchKeptTerms(document.body) : undefined;
  if (indonesian) keptTermsMarked += document.body.querySelectorAll('[lang="en"]').length;
  const results = await axe(document.body, {
    // jsdom cannot sample rendered pixels, so contrast is checked from the tokens
    // themselves in a11y.spec.tsx rather than pretended at here.
    rules: { 'color-contrast': { enabled: false } },
  }).finally(() => stop?.());
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
    nav.search = '';
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

  it('register, on a leader’s invite: the banner, and the code and join date read-only (P18.96-T3 AC-4)', async () => {
    nav.search = 'invite=kpm-1.secret';
    try {
      stubFetch({
        '/companies': { body: [{ _id: 'co-2', name: 'Prudential' }] },
        '/invites/': {
          body: {
            leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-2', companyName: 'Prudential',
            agentCode: '80777', joinDate: JOINING_TODAY, fullName: 'Yusuf Hidayat', existingAccount: false, expiresAt: '2026-11-10T03:00:00.000Z',
          },
        },
      });
      renderWithSession(<RegisterPage />, { me: null });
      await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417");
      await expectClean('register (invite)');
    } finally {
      nav.search = '';
    }
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

  it('the office roster on a tablet: the shell on its rail, the tabs one row (P18.97-T6 AC-1, AC-4)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile'],
    });
    window.localStorage.clear();
    atWidth(768);
    stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 28, pending: 2, removed: 2 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await screen.findByRole('button', { name: 'Directory (28)' });
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
    await expectClean('people/members (tablet, the rail)');
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

  it('P18.98-T4 the month table in Indonesian: its lock, legend, marks and history, the headings kept', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: [
        'member:read_profile', 'data_upload:read', 'data_upload:download_template', 'data_upload:upload_and_preview',
        'data_upload:correct_cell', 'data_upload:read_history', 'data_upload:revert_batch', 'data_upload:lock_month',
      ],
    });
    const empty = { value: null, provenance: null };
    const metrics = Object.fromEntries(
      ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'].map((m) => [m, { monthly: empty, ytd: empty }]),
    );
    stubFetch({
      '/kpm/data-upload/': {
        body: {
          month: '2026-09', withData: 1,
          state: { month: '2026-09', revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
          rows: [
            { membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', monthlyActiveAgent: true,
              metrics: { ...metrics, ape: { monthly: { value: 15000000000, provenance: 'imported' }, ytd: empty } } },
            { membershipId: 'mem-budi', agentCode: 'PRU-002', name: 'Budi Santoso', metrics, monthlyActiveAgent: null },
          ],
        },
      },
      '/kpm/data-upload/template': {
        body: {
          month: '2026-09', version: 1, filename: 'KPM0417-agent-data-Sep-2026.csv',
          header: ['Agent Code', 'Agent Name'], file: 'Agent Code,Agent Name\nPRU-001,"Rina Wijaya"', rowCount: 1,
        },
      },
      '/kpm/data-upload/history': {
        body: {
          month: '2026-09',
          batches: [{
            id: 'b-1', month: '2026-09', filename: 'KPM0417-agent-data-Sep-2026.csv', status: 'committed', templateVersion: 1,
            rowCount: 2, writtenRowCount: 2, cellCount: 24, issueCount: 0, committedAt: '2026-09-26T07:00:00.000Z',
            committedBy: 'Wilson Tanoto', revertedAt: null, revertedBy: null, restoredCellCount: 0, keptCellCount: 0,
            keptCorrectionCount: 0, replacedCorrectionCount: 0, canRevert: true,
          }],
        },
      },
    });
    renderWithSession(<InLanguage language="id"><TenantLayout><DataUploadPage /></TenantLayout></InLanguage>, { me: owner });
    await screen.findByRole('table', { name: 'Data untuk Sep 2026' });
    await screen.findByRole('link', { name: 'Unduh templat' });
    await screen.findByRole('heading', { name: 'Impor untuk Sep 2026' });
    await expectClean('kpm/data-upload, in Indonesian');
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
    await userEvent.click(await screen.findByRole('button', { name: 'Correct APE this month for Rina Wijaya, now IDR 1,500,000' }));
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

    it('filled, the Target a value with Edit (P18.97-T3 AC-7)', async () => {
      stubFetch({ '/kpm/overview': { body: overviewFixture() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await expectClean('kpm/overview');
    });

    it('P18.98-T4 filled, in Indonesian, the not-logged list and the full ranking open', async () => {
      stubFetch({ '/kpm/overview/not-logged': { body: OVERVIEW_NOT_LOGGED }, '/kpm/overview': { body: overviewFixture() } });
      renderWithSession(<InLanguage language="id"><TenantLayout><KpmOverviewPage /></TenantLayout></InLanguage>, { me: owner });
      await overviewRegion();
      await userEvent.click(screen.getByRole('button', { name: 'Lihat siapa yang belum mencatat →' }));
      await within(screen.getByRole('region', { name: 'Engagement' })).findAllByRole('listitem');
      await userEvent.click(screen.getAllByRole('button', { name: 'lihat peringkat lengkap →' })[0]);
      await expectClean('kpm/overview, in Indonesian');
    });

    it('P18.97-T3 AC-5, AC-7: an AB who leads nobody on the full board, No team, and the Target’s box open', async () => {
      const view = overviewFixture();
      const leaderboard = [...view.coaching.leaderboard, overviewNoTeam('mem-maya-h', 'Maya Halim')];
      stubFetch({ '/kpm/overview': { body: { ...view, coaching: { ...view.coaching, leaderboard } } } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: owner });
      await overviewRegion();
      await userEvent.click(screen.getAllByRole('button', { name: 'view full ranking →' })[0]);
      await screen.findByText('No team');
      await userEvent.click(screen.getByRole('button', { name: 'Edit target' }));
      await screen.findByRole('spinbutton', { name: 'Target' });
      await expectClean('kpm/overview (No team, the Target open)');
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
    const page = () => <UnitDashboardPage />;

    it('filled: the tiles, every group and total, a unit nested two deep, every status and mark', async () => {
      // Row groups headed by `rowgroup` headers, each person their row's header, the ⌄ column named for a
      // screen reader, and every tooltip on a button: the ✓, the pills, the marks and the Status rules.
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: unitDashboard() } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await expectClean('unit/dashboard');
    });

    it('a new hire before a first sale: the New hire tag, and the ⓘ of the totals and tiles that leave her out (P18.96-T5)', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: UNIT_NEW_HIRE } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('table', { name: 'Your team’s roster' });
      await expectClean('unit/dashboard with a new hire');
    });

    it('UI V1 (Phase 18.99 T4): the Activities tab — its controls, the table, a section opened, the ratio card on Group', async () => {
      stubFetch({ ...shell, 'GET /unit/dashboard/activities': { body: unitActivities() } });
      renderInLayout(AgentLayout, <UnitDashboardPage />, { me: UNIT_READER });
      await userEvent.click(await screen.findByRole('tab', { name: 'Activities' }));
      await screen.findByRole('table', { name: 'Activities · Unit' });
      await userEvent.click(screen.getByRole('button', { name: 'Show Recruitment' }));
      await userEvent.click(within(screen.getByRole('region', { name: 'Ratio · last 30 days' })).getByRole('button', { name: 'Group' }));
      await expectClean('unit/dashboard activities');
    });

    it('UI V1 (Phase 18.99 T4, UI-002): on a phone, the accordion — Your Unit open, a unit opened, the chips filtering', async () => {
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })));
      stubFetch({ ...shell, 'GET /unit/dashboard': { body: unitDashboard() } });
      renderInLayout(AgentLayout, page(), { me: UNIT_READER });
      await screen.findByRole('button', { name: /^Your Unit · 4/ });
      await expectClean('unit/dashboard (phone)');
      await userEvent.click(screen.getByRole('button', { name: /^Sari Wulandari’s Unit/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Needs attention 4' }));
      await expectClean('unit/dashboard (phone, opened and filtered)');
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
        <UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />,
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
        <UnitBelowPage params={routeParams({ membershipId: 'mem-x' })} />,
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

    it('UI-033, UI-034 the roster, populated: the groups, the rows, a unit as a tree with one nested in it, and every status', async () => {
      // One row per person at every size (UI V1): the name the row's link, the groups as headed sections, the tree
      // as nested named lists.
      stubFetch({ ...shell, '/coaching/coachees': { body: roster } });
      renderInLayout(AgentLayout, <CoachingRosterPage />, { me: leader });
      await screen.findByRole('heading', { level: 2, name: 'Everyone you coach' });
      await screen.findAllByRole('link', { name: /.+/ });
      await expectClean('coaching (UI V1)');
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
      renderInLayout(AgentLayout, <MyCoachingPage />, { me });
      await screen.findByRole('region', { name: 'Coaching tips from Wilson' });
      await userEvent.click(screen.getByRole('button', { name: 'View past sessions' }));
      await userEvent.click(screen.getByRole('button', { name: 'View what it agreed' }));
      await expectClean('coaching/me');
    });

    it('the reader’s own coaching, with no session yet (P11-T10)', async () => {
      stubFetch({ ...shell, '/coaching/me/sessions': { body: { sessions: [], ledFormerly: [] } } });
      renderInLayout(AgentLayout, <MyCoachingPage />, { me: leader });
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
    /** A person's tab in ID mode (P18.98-T7 AC-1): the shell, the person's shell and the tab, in Indonesian. */
    const inShellInIndonesian = (tab: React.ReactNode, me = coachLeader) => renderWithSession(
      <InLanguage language="id">
        <AgentLayout><CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>{tab}</CoachingPersonLayout></AgentLayout>
      </InLanguage>,
      { me },
    );

    const summaryTabRoutes = () => {
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
      return {
        ...shell,
        '/coaching/coachees/': { body: rina },
        '/summary': {
          body: {
            year: '2026', month: '2026-09', today: '2026-09-14', goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
            period: { firstMonth: '2026-01', thisMonth: '2026-09', currentMonth: true, currentYear: true },
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
        // P18.5-T9: *Campaigns she's chasing*, as chips.
        'GET /campaigns/chasing': { body: CAMPAIGNS_RINA_CHASING },
      };
    };

    it('a person’s Personal Summary tab, populated: the shell, the toggle, the tabs and her cards (P11-T7)', async () => {
      stubFetch(summaryTabRoutes());
      inShell(<CoacheeSummaryTab />);
      await screen.findByRole('region', { name: 'Leads that need her' });
      await within(await screen.findByRole('region', { name: "Campaigns she's chasing" })).findByText('Q4 APE Sprint');
      await expectClean('coaching/[membershipId]/summary');
    });

    const goalTabRoutes = () => ({
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
              monthlyApeTargetMinor: 126_000_000_00, policiesPerMonth: 7, policiesPerWeek: 1.6, appointmentsPerMonth: 24,
              appointmentsPerWeek: 6, leadsPerMonth: 80, leadsPerWeek: 19, targetMet: false,
            },
            cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
            cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
            measured: null, savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-ab',
          },
        },
    });

    it('a person’s Goal Setting tab, populated (P11-T7)', async () => {
      stubFetch(goalTabRoutes());
      inShell(<CoacheeGoalSettingTab />);
      await screen.findByRole('button', { name: 'Save goal' });
      await expectClean('coaching/[membershipId]/goal-setting');
    });

    it('a person’s Training tab, populated: every category with its counts, the skill cards, an archived row (P18.5-T4)', async () => {
      const retention = trainingSkill('RETENTION', 'Retention', [], {
        offered: false,
        archived: [{ code: 'CLIENT_RETENTION', title: 'Client Retention Best Practices', status: 'done', completedAt: '2026-08-01T03:00:00.000Z', formats: ['file'] }],
      });
      const sales = { ...TRAINING_SALES, skills: [...TRAINING_SALES.skills, retention] };
      stubFetch({ ...shell, '/coaching/coachees/': { body: rina }, 'GET /training/progress': { body: trainingProgressView([sales, TRAINING_PRODUCT]) } });
      inShell(<CoacheeTrainingTab />);
      await screen.findByRole('heading', { level: 2, name: 'Sales (4/10)' });
      await expectClean('coaching/[membershipId]/training');
    });

    /**
     * **P18.98-T7 AC-1: the person's tabs no Indonesian case rendered** — *Personal Summary*, *Goal Setting*, *Activity*
     * and *Training*, each populated as above, read in ID mode by `expectClean`: no message missing, no English the
     * glossary does not keep, axe with the kept terms marked.
     */
    it('P18.98-T7 a person’s Personal Summary tab, in Indonesian', async () => {
      stubFetch(summaryTabRoutes());
      inShellInIndonesian(<CoacheeSummaryTab />);
      await screen.findAllByText('Desi Pratama');
      await screen.findByText('Q4 APE Sprint');
      await expectClean('coaching/[membershipId]/summary (id)');
    });

    it('P18.98-T7 a person’s Goal Setting tab, in Indonesian', async () => {
      stubFetch(goalTabRoutes());
      inShellInIndonesian(<CoacheeGoalSettingTab />);
      await screen.findByRole('button', { name: 'Simpan goal' });
      await expectClean('coaching/[membershipId]/goal-setting (id)');
    });

    it('P18.98-T7 a person’s Activity tab, populated, in Indonesian', async () => {
      const counts = [3, 0, 1, 0, 2, 0, 0];
      stubFetch({
        ...shell,
        '/coaching/coachees/': { body: rina },
        '/activity/dashboard': {
          body: {
            range: 'ROLLING_7D', from: '2026-09-08', to: '2026-09-14', days: 7, today: '2026-09-14',
            buckets: ['14', '13', '12', '11', '10', '09', '08'].map((d) => ({ from: `2026-09-${d}`, to: `2026-09-${d}`, days: 1, kind: 'day' })),
            sections: [{
              code: 'SELLING', label: 'Selling', standing: 'shown', total: 6, counts,
              types: [{ code: 'SELL_SUBMISSION', label: 'Submission polis', description: null, displayOrder: 6, standing: 'shown', total: 6, counts }],
            }],
            total: 6, counts, daysLogged: 3, correctedDays: 0,
          },
        },
      });
      inShellInIndonesian(<CoacheeActivityTab />, makeMe({ ...coachLeader, permissions: [...coachLeader.permissions, 'activity_log:read_raw'] }));
      await screen.findByText('Submission polis');
      await expectClean('coaching/[membershipId]/activity (id)');
    });

    it('P18.98-T7 a person’s Training tab, in Indonesian', async () => {
      stubFetch({ ...shell, '/coaching/coachees/': { body: rina }, 'GET /training/progress': { body: trainingProgressView([TRAINING_SALES, TRAINING_PRODUCT]) } });
      inShellInIndonesian(<CoacheeTrainingTab />);
      await screen.findByText(TRAINING_SALES.skills[0].modules[0].title);
      await expectClean('coaching/[membershipId]/training (id)');
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
            period: { firstMonth: '2026-01', thisMonth: '2026-10', currentMonth: true, currentYear: true },
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
        'GET /leads?owner=mem-rina': {
          body: {
            rows: [sessionLead, { ...sessionLead, id: 'l-shinta', name: 'Ibu Shinta Maharani', nextActionDate: null, nextActionNote: null }],
            total: 2, page: 1, pageSize: 200,
          },
        },
      });
      const inSession = () => renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingSessionTabPage /></CoachingPersonLayout>,
        { me: sessionLeader },
      );

      it('UI-032 before it starts: the session card, the past sessions as rows, and Start coaching session', async () => {
        stubFetch(routes(draft, null));
        inSession();
        await screen.findByRole('button', { name: 'Start coaching session' });
        await expectClean('coaching/[membershipId]/session (before it starts)');
      });

      it('a draft, populated, with the Activity drill open', async () => {
        stubFetch(routes(draft));
        inSession();
        // UI-061, UI-062: the compact rows, a lead with Isi tindakan, the ratio card as rows, the pinned Finalkan.
        await screen.findByRole('button', { name: 'Desi Pratama' });
        await screen.findByRole('button', { name: 'Add an action' });
        await screen.findByText('18%');
        const drill = await screen.findByRole('button', { name: 'Last 7 days' });
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
        await screen.findByRole('button', { name: 'Desi Pratama' });
        await screen.findByText('Finalized 2 Oct');
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
      const width = atWidth(1280);
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
      // UI-035 (UI V1, Phase 18.99 T10): the ladder's sheet, opened from the tile.
      await userEvent.click(await screen.findByRole('button', { name: /^Capability mapping: / }));
      await screen.findByRole('dialog', { name: 'Capability mapping' });
      await expectClean('coaching/[membershipId]/leader-notes (ladder sheet, UI V1)');
      // UI-036: below 1024px the Skill tracker is an accordion, a section that does not apply a grey row.
      await userEvent.keyboard('{Escape}');
      width.resize(375);
      await screen.findByRole('button', { name: /^Developing downline agent/ });
      await expectClean('coaching/[membershipId]/leader-notes (phone, UI V1)');
    });

    it('a person outside the reader’s reach: the not-found state inside the shell (P11-T7 AC-8)', async () => {
      stubFetch({ ...shell, '/coaching/coachees/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
      inShell(<CoacheeTrainingTab />, 'mem-nobody');
      await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' });
      await expectClean('coaching/[membershipId] (not found)');
    });

    it('UI-004 the field shell on a phone: the title row, the tab bar, and the Lainnya sheet open', async () => {
      // *Changed 2026-10-30 (UI V1, UI-004; ADR-0180):* no dark bar, no ☰ and no drawer; the tab bar and its sheet.
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })));
      stubFetch({ ...shell, '/coaching/coachees': { body: roster } });
      renderInLayout(AgentLayout, <CoachingRosterPage />, { me: leader });
      // A phone draws the roster as cards (P18.95-T3 AC-3), headed by the table's caption.
      await screen.findByRole('heading', { name: 'Everyone you coach' });
      expect(document.querySelector('[data-tab-bar]')).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/profile');
      await expectClean('coaching (the field shell on a phone)');
      await userEvent.click(screen.getByRole('button', { name: 'More' }));
      const sheet = await screen.findByRole('dialog', { name: 'More' });
      expect(within(sheet).getByRole('link', { name: 'Coaching' })).toHaveAttribute('href', '/coaching');
      await expectClean('coaching (the Lainnya sheet open)');
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
    // UI V1 (UI-106): *activities*, never *touches*, wherever the app counts what was logged.
    await screen.findByText('Total activities');
    await expectClean('activity/dashboard');

    // On a phone: each item's total, and two of them opened on their days (P18.95-T3 AC-6).
    cleanup();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    renderInLayout(AgentLayout, <ActivityDashboardPage />, {});
    // UI-106: the log's group cards, in a region, after the navy total and the strip.
    await screen.findByRole('region', { name: 'Your activity' });
    await expectClean('activity/dashboard (phone)');
    await userEvent.click(screen.getByRole('button', { name: /^Submission polis/ }));
    await userEvent.click(screen.getByRole('button', { name: /^An archived item/ }));
    await expectClean('activity/dashboard (phone, opened)');
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
        { code: 'RECRUITMENT', label: 'Recruitment', total: 3, rows: [{ code: 'RECRUIT_PRESENTATION', label: 'Melakukan presentasi recruitment', count: 3 }] },
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
      // P18.5-T7 AC-6: *Campaigns you're chasing*, with its rows.
      'GET /campaigns/chasing': { body: CAMPAIGNS_RINA_CHASING },
      '/activity/ratios': {
        body: { membershipId: 'm-1', from: '2026-08-16', to: '2026-09-14', days: 30, ratios: [rate('SSR', 0.1, 'alert'), rate('LPA', null, 'neutral')] },
      },
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/summary': {
        body: {
          year: '2026', month: '2026-09', today: '2026-09-14', goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' },
          period: { firstMonth: '2026-01', thisMonth: '2026-09', currentMonth: true, currentYear: true },
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
    // UI V1 (P18.99-T7): the date header and the goal card with its gap inside it, the one Target aktivitas card, the
    // shared ratio card, the sections' headings outside their cards.
    await screen.findByRole('region', { name: 'Goal vs. actual (APE)' });
    await screen.findByText('SSR');
    // Card 6, *Campaigns you're chasing*, with its rows (P18.5-T7 AC-6).
    await within(await screen.findByRole('region', { name: "Campaigns you're chasing" })).findByText('Q4 APE Sprint');
    await expectClean('summary');
    // UI-051: the month pill's sheet, and UI-050: a tile's activities behind a tap on a phone.
    await userEvent.click(screen.getByRole('button', { name: 'Month: Sep 2026' }));
    await screen.findByRole('dialog', { name: 'Month' });
    await expectClean('summary (the month sheet)');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sep 2026' }));
    await userEvent.click(document.querySelector('[data-breakdown="phone"] button') as HTMLElement);
    await screen.findByRole('dialog', { name: 'Recruitment activities' });
    await expectClean('summary (a tile’s activities)');
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
    // UI V1 (UI-106): the shared ratio card, a row tapped open for what the ratio is.
    await screen.findByRole('region', { name: 'Ratio · last 30 days' });
    const row = document.querySelector('[data-ratio="SELLING_SUCCESS_RATE"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button'));
    expect(row).toHaveTextContent('What is this ratio?');
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
              id: 't1', code: 'LEADS_CONTACTED', label: 'Set Appointment',
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
    // A tile per section since P18.95-T5 AC-2: the section's own name, not its summary tile's.
    expect(screen.getByText('Total activities today').closest('[data-total]')!.parentElement).toHaveTextContent('Leads');
    await expectClean('activity/log');
  });

  it('UI-106 Log activity on a phone: the segmented views, the date pill, the rows and the save bar above the tab bar', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [{
            id: 'c1', code: 'LEADS', label: 'Leads', description: null,
            appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
            types: [{
              id: 't1', code: 'LEADS_CONTACTED', label: 'Set Appointment',
              categoryCode: 'LEADS', description: null, displayOrder: 1, version: 1, status: 'active',
            }],
          }],
          ratios: [], leadPipelines: [], version: 1,
        },
      },
      '/kpm/org-levels': { body: [] },
      '/activity/log': {
        body: {
          membershipId: 'mem-1', localDate: '2026-03-11',
          entries: [{ activityTypeId: 't1', activityTypeCode: 'LEADS_CONTACTED', label: 'Set Appointment', count: 2 }],
          totalCount: 2, version: 1, frozenAt: null, editable: true, correctionCount: 0,
        },
      },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: makeMe() });

    const save = await screen.findByRole('button', { name: 'Save activity' });
    expect(save.parentElement).toHaveAttribute('data-action-bar');
    expect(screen.getByText(/^Today:/)).toHaveTextContent('Today: 2 activities');
    await userEvent.click(screen.getByRole('button', { name: 'Increase Set Appointment' }));
    await expectClean('activity/log (phone)');
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
      // The cascade's three types, so each column carries its activity's chip (P10.1-T6; by name since P18.95-T5).
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
            policiesPerMonth: 6, policiesPerWeek: 1.4,
            appointmentsPerMonth: 20, appointmentsPerWeek: 5,
            leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false,
          },
          cascadeMapping: {
            leadsCode: 'LEADS_CONTACTED',
            appointmentsCode: 'SELL_PRESENTATION',
            closingsCode: 'SELL_SUBMISSION',
          },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
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
            policiesPerMonth: 6, policiesPerWeek: 1.4,
            appointmentsPerMonth: 20, appointmentsPerWeek: 5,
            leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false,
          },
          cascadeMapping: {
            leadsCode: 'LEADS_CONTACTED',
            appointmentsCode: 'SELL_PRESENTATION',
            closingsCode: 'SELL_SUBMISSION',
          },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
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

  it('goal settings on a phone: the result card first, the floating save pill, both options in sight (P18.95-T5, P18.99-T5)', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    const period = String(new Date().getFullYear());
    stubFetch({
      '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/goals': {
        body: {
          period, mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
          commissionRatePct: 10, monthsLeft: 2.2, monthsLeftIsOverride: false, apeAchievedMinor: 0,
          achieved: { minor: 290_000_000_00, provenance: 'imported', month: '2026-09' },
          caseSizeMinor: 18_000_000_00, leadsToApptPct: 50, closingRatePct: 30,
          snapshot: { monthlyApeTargetMinor: 95_454_545_00, policiesPerMonth: 6, appointmentsPerMonth: 18, leadsPerMonth: 36 },
          projected: {
            annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 290_000_000_00,
            remainingApeMinor: 210_000_000_00, monthlyApeTargetMinor: 95_454_545_00,
            policiesPerMonth: 6, policiesPerWeek: 1.4, appointmentsPerMonth: 18, appointmentsPerWeek: 5,
            leadsPerMonth: 36, leadsPerWeek: 9, targetMet: false,
          },
          cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
          measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
          savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-1',
        },
      },
    });
    renderInLayout(AgentLayout, <GoalSettingsPage />, {
      me: makeMe({ permissions: ['goal:read', 'goal:update'] }),
    });

    // UI V1 (P18.99-T5): the result card first, the floating save pill above the tab bar, the report's sentence.
    const save = await screen.findByRole('button', { name: 'Save goal' });
    expect(save.closest('[data-floating-save]')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Monthly activity target' })).toBeInTheDocument();
    expect(screen.getByText(/^This month, APE/).closest('p')).toHaveTextContent('Set appointment');
    await expectClean('goals (phone)');
  });

  it('P18.99-T5 goal settings on a tablet: the phone’s layout, the floating save, the disclaimer behind an ⓘ (UI-015, UI-018)', async () => {
    atWidth(768);
    const period = String(new Date().getFullYear());
    stubFetch({
      '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/goals': {
        body: {
          period, mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
          commissionRatePct: 10, monthsLeft: 2.1, monthsLeftIsOverride: false, apeAchievedMinor: 0,
          achieved: { minor: 290_000_000_00, provenance: 'imported', month: '2026-09' },
          caseSizeMinor: 18_000_000_00, leadsToApptPct: 50, closingRatePct: 30,
          snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 40 },
          projected: {
            annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 290_000_000_00, remainingApeMinor: 210_000_000_00,
            monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, policiesPerWeek: 1.4, appointmentsPerMonth: 20,
            appointmentsPerWeek: 5, leadsPerMonth: 40, leadsPerWeek: 10, targetMet: false,
          },
          cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
          measured: null, savedAt: '2026-10-29T04:00:00.000Z', savedByMembershipId: 'mem-1',
        },
      },
    });
    renderInLayout(AgentLayout, <GoalSettingsPage />, { me: makeMe({ permissions: ['goal:read', 'goal:update'] }) });

    const save = await screen.findByRole('button', { name: 'Save goal' });
    expect(save.closest('[data-floating-save]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Estimates for personal planning — assumptions vary per individual.' })).toBeInTheDocument();
    await expectClean('goals (tablet)');
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
    await screen.findAllByText('JOR417');
    await screen.findAllByText('Rina Wijaya');
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
    // UI-083: the role sheet, a rung picked, the reason asked.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Change Rina Wijaya’s role, now Agent' }))[0]);
    await userEvent.click(screen.getByRole('radio', { name: 'AAB' }));
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
    // UI-083: *Remove* last in the role sheet; it opens its confirmation.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Change Rina Wijaya’s role, now AAB' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
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

  it('the Pending tab’s transfer requests, populated (P18.96-T3 AC-3)', async () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: ['member:read_profile', 'member:transfer_approve'],
    });
    stubFetch({
      '/join/requests': { body: [] },
      '/members/leader-limit-requests': { body: [] },
      '/members': { body: { members: [], nextCursor: null, counts: { directory: 8, pending: 0, removed: 1 } } },
      '/transfer-requests': { body: [transfer()] },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: /^Pending/ }));
    await screen.findByRole('table', { name: 'Transfer requests, oldest first' });
    await expectClean('people/members (transfer requests)');
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
    // P18.96-T7 G1: *Approve* opens the row's *Join date*, the shared field, before it sends.
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByLabelText('Join date');
    await expectClean('people/members (pending, the join date asked)');
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
    // UI V1 (UI-058): the rows, both layouts in the document.
    await screen.findByTestId('group-tree-list');
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
          // P18.8-T4: what the person records, one of them not recorded.
          personal: { dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: null, workStatus: 'full_time' },
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

  it('P18.8-T2: leaders past the limit, one waiting and one decided', async () => {
    const row = {
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
      subjectMembershipId: 'mem-1', subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'promote',
      fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: 'Ready to bring on his own agents',
      requestedByMembershipId: 'mem-owner', requestedByName: 'Hendra Gunawan', status: 'pending',
      requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null, declineReason: null, maxLeaders: 10, leadersUsed: 13,
    };
    stubFetch({
      '/admin/leader-limit-requests': {
        body: [row, { ...row, requestId: 'llr-2', subjectName: 'Irfan Hakim', status: 'approved', decidedAt: '2026-09-16T00:00:00.000Z' }],
      },
    });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, {
      me: makeMe({ ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'leader_limit_request:read', 'leader_limit_request:decide'] }),
    });
    await screen.findByLabelText('Why not?');
    await expectClean('admin/leader-limit-requests');
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
      return screen.findByRole('region', { name: 'Calendar, 28 Sep – 4 Oct 2026' });
    };

    it('the week, filled: overlapping entries, a trip, a pending invitation and the now-line', async () => {
      await open();
      await expectClean('calendar (week)');
    });

    it('the week, empty, for an Agent — the bare grid', async () => {
      stubFetch({ ...SHELL_STUBS, '/calendar/entries?view=week': { body: weekRead({ entries: [] }) } });
      nav.pathname = '/calendar';
      renderInLayout(AgentLayout, <CalendarPage />, { me: RINA });
      await screen.findByRole('region', { name: 'Calendar, 28 Sep – 4 Oct 2026' });
      await expectClean('calendar (empty week)');
    });

    it('the month', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await screen.findByText('Sep 2026');
      await expectClean('calendar (month)');
    });

    it('the entry dialog with the people list open and a chip chosen', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      // The form's module is fetched on its first opening (P18.99-T16).
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
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
      await screen.findByRole('region', { name: 'Calendar, 28 Sep – 4 Oct 2026' });
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      // The dialog's module is fetched on its first opening (P18.99-T16).
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
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
      // The dialog's module is fetched on its first opening (P18.99-T16).
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Travel' }));
      await userEvent.clear(screen.getByLabelText('Departure date'));
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      await screen.findByText('Choose a date.');
      await expectClean('calendar (entry dialog, invalid)');
    });

    it('the detail as the organiser: answers on the chips, a coachee’s link, a placed member', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^1:1 coaching: 1:1 Coaching — Indah Permata/ }));
      await screen.findByRole('link', { name: 'Indah Permata' });
      await expectClean('calendar (detail, organiser)');
    });

    it('the detail as an invitee, Accept and Decline in place, the organiser’s chip first', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Goal review — Q4 planning/ }));
      await screen.findByRole('button', { name: 'Accept' });
      await expectClean('calendar (detail, invitee)');
    });

    it('the delete question over the detail', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await screen.findByRole('dialog', { name: 'Delete "Weekly unit standup"?' });
      await expectClean('calendar (delete question)');
    });

    it('compare: the popover open and a member’s week beside the reader’s, with a busy block', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await screen.findByRole('region', { name: 'Calendar, Indah Permata, 28 Sep – 4 Oct 2026' });
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

    it('the hire’s page with Which case? open, a source line and a tick waiting for data (P18.96-T4)', async () => {
      nav.pathname = '/activation';
      stubFetch({
        ...SHELL,
        '/activation/me/closings': { body: { closings: [{ leadId: 'l-1', name: 'Ibu Ratna', date: '2026-09-20' }] } },
        '/activation/me': { body: activationView({}, withWaitingCheckIn()) },
      });
      renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
      await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
      const milestone = within(document.querySelector('[data-code="INDEPENDENT_AGENT_MILESTONE"]') as HTMLElement);
      await userEvent.click(milestone.getByRole('checkbox'));
      await userEvent.click(await milestone.findByRole('radio', { name: 'Log a new closing' }));
      await screen.findByText('Ticked by Sari Puspita, waiting for data');
      await expectClean('activation (which case)');
    });

    it('a hire’s detail with Log 1:1 open (P18.96-T4)', async () => {
      nav.pathname = '/new-hires/mem-rina';
      stubFetch({ ...SHELL, '/new-hires/mem-rina': { body: leaderView() } });
      renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
      await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
      await userEvent.click(within(document.querySelector('[data-code="WEEKLY_CHECK_IN"]') as HTMLElement).getByRole('checkbox'));
      await screen.findByRole('group', { name: 'Log 1:1' });
      await expectClean('new-hire detail (log 1:1)');
    });

    it('the hire’s page at 100%, with the graduation confirm open (P13-T7)', async () => {
      nav.pathname = '/activation';
      stubFetch({ ...SHELL, '/activation/me': { body: completeView() } });
      renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
      await userEvent.click(await screen.findByRole('button', { name: 'Mark checklist complete' }));
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

    it('UI-024 the roster on a phone: the two tiles, the filter, the leader tree with its people (UI V1)', async () => {
      nav.pathname = '/new-hires';
      atWidth(375);
      stubFetch({ ...SHELL, '/new-hires': { body: ROSTER } });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
      await screen.findByRole('group', { name: 'Show' });
      await expectClean('new-hires (phone, UI V1)');
    });

    it('UI-024 the roster from 768px: the table and the right column (UI V1)', async () => {
      nav.pathname = '/new-hires';
      atWidth(1280);
      stubFetch({
        ...SHELL,
        '/new-hires': { body: ROSTER },
        '/new-hires/invites': { body: { today: JOINING_TODAY, invites: [invite()] } },
        '/new-hires/transfers': { body: [requestedTransfer()] },
      });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: { ...SARI_ME, permissions: [...SARI_ME.permissions, 'member:invite'] } });
      await screen.findByRole('table', { name: 'New Hires' });
      await screen.findByRole('button', { name: 'Actions for Yusuf Hidayat' });
      await expectClean('new-hires (wide, UI V1)');
    });

    it('UI-024 the invitations’ sheet on a phone, its ⋯ open (UI V1)', async () => {
      nav.pathname = '/new-hires';
      atWidth(375);
      stubFetch({
        ...SHELL,
        '/new-hires': { body: ROSTER },
        '/new-hires/invites': { body: { today: JOINING_TODAY, invites: [invite()] } },
        '/new-hires/transfers': { body: [requestedTransfer()] },
      });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: { ...SARI_ME, permissions: [...SARI_ME.permissions, 'member:invite'] } });
      await userEvent.click(await screen.findByRole('button', { name: 'Waiting to join: 2. Show them' }));
      const sheet = await screen.findByRole('dialog', { name: 'Waiting to join' });
      await userEvent.click(within(sheet).getByRole('button', { name: 'Actions for Yusuf Hidayat' }));
      await expectClean('new-hires (waiting sheet)');
    });

    it('UI-027 a hire’s detail on a phone: the strip, tiles, buttons and sections; then Kapan pecah telor? open (UI V1, D-26)', async () => {
      nav.pathname = '/new-hires/mem-rina';
      atWidth(375);
      const items = leaderView().aspects.map((a) => a.items.map((it) => (it.code === 'FIRST_CASE_CLOSED'
        ? { ...it, done: false, doneAt: null, source: null, doneBy: null, record: null } : it)));
      stubFetch({
        ...SHELL,
        '/new-hires/mem-rina': {
          body: {
            ...activationView({}, items),
            newHire: {
              status: 'not_yet', activation3M: 'in_progress', joinDate: '2026-08-06', day: 59, firstSaleDate: null,
              firstSaleDay: null, firstSaleSource: null, leader: { ...SARI, role: 'aab' }, phone: null,
            },
          },
        },
      });
      renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, {
        me: { ...SARI_ME, permissions: [...SARI_ME.permissions, 'calendar_entry:create', 'member:update_phone'] },
      });
      await screen.findByTestId('hire-header-phone');
      await expectClean('new-hire detail (phone, UI V1)');
      await userEvent.click(screen.getByRole('button', { name: /First Sale/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Close first case independently: Add date' }));
      await screen.findByRole('dialog', { name: 'When was the first sale?' });
      await expectClean('new-hire detail (pecah telor sheet)');
    });

    it('the roster’s header and Waiting to join: + Add agent, Review requests, an invite and a transfer (P18.96-T3)', async () => {
      nav.pathname = '/new-hires';
      stubFetch({
        ...SHELL,
        '/new-hires': { body: ROSTER },
        '/new-hires/invites': { body: { today: JOINING_TODAY, invites: [invite(), invite({ inviteId: 'inv-2', fullName: 'Rudi Hartono', status: 'expired' })] } },
        '/new-hires/transfers': { body: [requestedTransfer()] },
        '/join/requests': { body: [joinRequest()] },
        '/join/requests/routing': { body: [] },
      });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: { ...SARI_ME, permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS] } });
      await screen.findByRole('region', { name: 'Waiting to join' });
      await screen.findAllByRole('button', { name: 'Review requests (1)' });
      await expectClean('new-hires (waiting to join)');
    });

    it('+ Add agent, the form and its share step (P18.96-T3 AC-1, AC-2)', async () => {
      nav.pathname = '/new-hires';
      stubFetch({
        ...SHELL,
        '/new-hires': { body: ROSTER },
        '/new-hires/invites': { body: { today: JOINING_TODAY, invites: [] } },
        '/new-hires/transfers': { body: [] },
        '/join/my-code': { body: { code: 'SARI01', url: 'https://app.test/join?code=SARI01' } },
        'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } },
      });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: { ...SARI_ME, permissions: [...SARI_ME.permissions, 'member:invite'] } });
      await userEvent.click((await screen.findAllByRole('button', { name: '+ Add agent' }))[0]);
      await screen.findByRole('dialog', { name: 'Add agent' });
      // UI-024: the leader code's share block at the top of the modal.
      await screen.findByText('SARI01');
      await expectClean('new-hires (add agent)');
      await userEvent.type(screen.getByLabelText('Agent code'), '80777');
      await userEvent.type(screen.getByLabelText('Name'), 'Yusuf Hidayat');
      await userEvent.type(screen.getByLabelText('WhatsApp number'), '812 8077 7001');
      await userEvent.click(screen.getByRole('button', { name: 'Add & send invite' }));
      await screen.findByRole('dialog', { name: 'Invite Yusuf Hidayat' });
      await expectClean('new-hires (invite share)');
    });

    it('the roster with nobody on it (P13-T5)', async () => {
      nav.pathname = '/new-hires';
      stubFetch({ ...SHELL, '/new-hires': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
      renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
      await screen.findByText('No one you lead joined as a new hire in the last 12 months.');
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

    it('a person’s Activation tab, populated: their new-hire detail (P13-T9; UI-029, T6)', async () => {
      nav.pathname = '/coaching/mem-rina/activation';
      stubFetch({ ...SHELL, '/coaching/coachees/': { body: coachee }, '/new-hires/mem-rina': { body: leaderView() } });
      renderInLayout(
        AgentLayout,
        <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>,
        { me: SARI_ME },
      );
      await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
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
  /*
   * Training (P18.5-T1, T4): the learner's list filled and with a category offering nothing, a module's page
   * with its tiles and the status toggle, the same page in a support session, and the reader's own coaching
   * tab. The coach's tab is with coaching, above.
   */
  describe('training (P18.5-T1, P18.5-T4)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      'GET /training/progress': { body: trainingProgressView() },
    };
    const list = (code: string) => (
      <LearnerTrainingLayout><LearnerCategoryPage params={routeParams({ categoryCode: code })} /></LearnerTrainingLayout>
    );
    const page = (
      <LearnerTrainingLayout>
        <LearnerModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} />
      </LearnerTrainingLayout>
    );

    it('a category’s list on a desktop: two columns of skill cards, Module · Format · Status · › (UI-064, UI-066)', async () => {
      nav.pathname = '/training/SALES';
      stubFetch(SHELL);
      renderInLayout(AgentLayout, list('SALES'), { me: TRAINING_LEARNER });
      await screen.findByRole('list', { name: 'Prospecting modules' });
      await expectClean('training/[categoryCode]');
    });

    it('a category’s list on a phone and a tablet: one card of rows, the category row as pills (UI-063, UI-065)', async () => {
      nav.pathname = '/training/SALES';
      atWidth(375);
      stubFetch(SHELL);
      renderInLayout(AgentLayout, list('SALES'), { me: TRAINING_LEARNER });
      await screen.findByRole('list', { name: 'Prospecting modules' });
      await expectClean('training/[categoryCode] (phone)');
    });

    it('a category offering nothing yet: the prototype’s empty card (P18.5-T1 AC-4)', async () => {
      nav.pathname = '/training/PRODUCT';
      stubFetch(SHELL);
      renderInLayout(AgentLayout, list('PRODUCT'), { me: TRAINING_LEARNER });
      // The heading is the nav item's words (P18.95-T9 AC-2); the empty card keeps the category's own title.
      await screen.findByRole('heading', { level: 1, name: 'Training Modules' });
      expect(screen.getByText('Product Training')).toBeInTheDocument();
      await expectClean('training/[categoryCode] (empty)');
    });

    it('a module’s page with its tiles and the status toggle, a status set (P18.5-T1 AC-5, AC-7)', async () => {
      nav.pathname = '/training/SALES/CLOSING_TECHNIQUES';
      stubFetch({
        ...SHELL,
        'GET /training/modules/CLOSING_TECHNIQUES': { body: trainingModulePage({ status: 'in_progress' }) },
      });
      renderInLayout(AgentLayout, page, { me: TRAINING_LEARNER });
      await screen.findByRole('group', { name: 'Status of Closing Techniques That Work' });
      await expectClean('training/[categoryCode]/[moduleCode]');
    });

    it('a module’s page in a read-only support session: no toggle (P18.5-T1 AC-7)', async () => {
      nav.pathname = '/training/SALES/CLOSING_TECHNIQUES';
      stubFetch({
        ...SHELL,
        'GET /training/modules/CLOSING_TECHNIQUES': { body: trainingModulePage({ can: { update: false } }) },
      });
      renderInLayout(AgentLayout, page, { me: TRAINING_SUPPORT });
      await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
      await expectClean('training/[categoryCode]/[moduleCode] (support session)');
    });

    it('a module’s page with a video, its file opened, on a phone (UI-067 to UI-069)', async () => {
      nav.pathname = '/training/SALES/CLOSING_TECHNIQUES';
      atWidth(375);
      stubFetch({
        ...SHELL,
        'GET /training/modules/CLOSING_TECHNIQUES': {
          body: trainingModulePage({
            items: [
              ...trainingModulePage().items,
              { id: 'it-v', kind: 'video', label: 'closing.mp4', mimeType: 'video/mp4', bytes: 9, url: null },
            ],
          }),
        },
      });
      renderInLayout(AgentLayout, page, { me: TRAINING_LEARNER });
      await screen.findByRole('button', { name: /^Play Video/ });
      await expectClean('training/[categoryCode]/[moduleCode] (phone, UI V1)');
    });

    it('a module holding nothing yet (P18.5-T1 AC-5)', async () => {
      nav.pathname = '/training/SALES/CLOSING_TECHNIQUES';
      stubFetch({
        ...SHELL,
        'GET /training/modules/CLOSING_TECHNIQUES': { body: trainingModulePage({ items: [], openedItemIds: [] }) },
      });
      renderInLayout(AgentLayout, page, { me: TRAINING_LEARNER });
      await screen.findByText('Nothing to open in this module yet.');
      await expectClean('training/[categoryCode]/[moduleCode] (empty)');
    });

    it('the reader’s own Training tab on their coaching (P18.5-T4 AC-3)', async () => {
      nav.pathname = '/coaching/me/training';
      stubFetch(SHELL);
      renderInLayout(AgentLayout, <MyCoachingTrainingPage />, { me: TRAINING_LEARNER });
      await screen.findByRole('heading', { level: 2, name: 'Sales (4/10)' });
      await expectClean('coaching/me/training');
    });
  });

  describe('KPM Events (P18.5-T5, P18.5-T6)', () => {
    it('the list, every card state (P18.5-T5 AC-4)', async () => {
      nav.pathname = '/events';
      stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList() } });
      renderInLayout(AgentLayout, <EventsLayout><EventsPage /></EventsLayout>, { me: EVENTS_ME });
      await screen.findByRole('heading', { level: 3, name: 'Kickoff 2026' });
      await expectClean('events');
    });

    it('the list with nothing in it: the three empty rows (P18.5-T5 AC-4)', async () => {
      nav.pathname = '/events';
      stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList([]) } });
      renderInLayout(AgentLayout, <EventsLayout><EventsPage /></EventsLayout>, { me: EVENTS_ME });
      await screen.findByText('No past events yet.');
      await expectClean('events (empty)');
    });

    it.each([
      ['an upcoming event, Join event (P18.5-T5 AC-5)', EVENT_KICKOFF],
      ['a past event, the feedback form (P18.5-T6 AC-2)', EVENT_PRULINK],
      ['a past event not joined, the claim (P18.5-T5 AC-6)', EVENT_TOWN_HALL],
      ['a past event answered, the thanks (P18.5-T6 AC-4)', EVENT_BOOTCAMP],
    ])('the modal over the list: %s', async (_state, event) => {
      nav.pathname = `/events/${event.id}`;
      stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList() }, [`GET /events/${event.id}`]: { body: event } });
      renderInLayout(
        AgentLayout,
        <EventsLayout><EventModalPage params={routeParams({ eventId: event.id })} /></EventsLayout>,
        { me: EVENTS_ME },
      );
      await screen.findByRole('dialog', { name: event.title });
      await expectClean(`events/[eventId] (${event.id})`);
    });
  });

  describe('sales tools (Phase 14)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    /** The Sales Attack Plan at an address: its query is the address's (`useQuery`, `lib/use-query.ts`). */
    const attackPlanAt = (q: Record<string, string>) => {
      nav.search = new URLSearchParams(q).toString();
      return <AttackPlanPage />;
    };

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

    it('the Product Catalog, a search that finds nothing (P18.95-T6 AC-4)', async () => {
      nav.pathname = '/product-catalog';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
      renderInLayout(AgentLayout, <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, { me: SALES_ME });
      await userEvent.type(await screen.findByRole('searchbox', { name: 'Search products by name' }), 'zzz');
      await screen.findByText('No products match “zzz”.');
      await expectClean('product-catalog (search, no match)');
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
      const box = await screen.findByRole('dialog', { name: 'PRUMapan' });
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
      renderInLayout(AgentLayout, attackPlanAt({}), { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(screen.getByRole('group', { name: 'Primary need' })).getByRole('button', { name: 'Health' }));
      await expectClean('attack-plan (brief)');
    });

    it('the Sales Attack Plan’s plan, with four chips and the more line (P14-T8)', async () => {
      nav.pathname = '/attack-plan';
      const alternatives = ['A', 'B', 'C', 'D'].map((c) => ({ code: c, name: `Product ${c}` }));
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /attack-plan': { body: salesPlan({ alternatives, moreCount: 3 }) } });
      renderInLayout(AgentLayout, attackPlanAt({ need: 'health', age: '2', budget: '2' }), { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'PRUMapan' });
      await expectClean('attack-plan (plan)');
    });

    it('the Sales Attack Plan’s Check fit, with its note (P14-T8)', async () => {
      nav.pathname = '/attack-plan';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /attack-plan': { body: salesPlan({ verdict: 'check_fit', outside: ['age', 'budget'] }) } });
      renderInLayout(AgentLayout, attackPlanAt({ need: 'retirement', age: '5', budget: '6' }), { me: SALES_ME });
      await screen.findByText(/Outside the typical age band and budget band/);
      await expectClean('attack-plan (check fit)');
    });

    it('the catalog’s deep link to a run-off product (P14-T8 AC-6)', async () => {
      nav.pathname = '/attack-plan';
      stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      renderInLayout(AgentLayout, attackPlanAt({ product: 'PRULINK_GENERASI_BARU_PGB' }), { me: SALES_ME });
      await screen.findByRole('heading', { level: 2, name: 'PRULink Generasi Baru (PGB)' });
      await expectClean('attack-plan (from catalog, run-off)');
    });
  });

  describe('Recruitment › Attack Plan (P17-T3 AC-8)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    /** The page at an address: its query is the address's (`useQuery`, `lib/use-query.ts`). */
    const attackPlan = (q: Record<string, string>) => {
      nav.search = new URLSearchParams(q).toString();
      return <RecruitmentLayout><RecruitmentAttackPlanPage /></RecruitmentLayout>;
    };

    it('the brief, part chosen', async () => {
      nav.pathname = '/recruitment/attack-plan';
      stubFetch({ ...SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView() } });
      renderInLayout(AgentLayout, attackPlan({}), { me: RECRUITMENT_ME });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      await userEvent.click(within(screen.getByRole('group', { name: 'Candidate type' })).getByRole('button', { name: 'Retiree' }));
      await userEvent.click(
        within(screen.getByRole('group', { name: 'What\'s driving them' })).getByRole('button', { name: 'Career change' }),
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

  /*
   * Campaigns (P18.5-T7, T8): the list on both tabs, empty, a read-only support session's, and the dialog with
   * its progress rows and its not-found state. The Summary's card and the coachee's chips are with their pages.
   */
  describe('campaigns (P18.5-T7)', () => {
    const SHELL = {
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
    };
    const renderList = (list: unknown = CAMPAIGN_LIST, me = CAMPAIGNS_RINA) => {
      nav.pathname = '/campaigns';
      stubFetch({ ...SHELL, 'GET /campaigns': { body: list } });
      renderInLayout(AgentLayout, <CampaignsLayout><CampaignsPage /></CampaignsLayout>, { me });
    };

    it('the list, seasonal, every section and card state (P18.5-T7 AC-2, AC-3)', async () => {
      renderList();
      await screen.findByRole('region', { name: 'Running' });
      await expectClean('campaigns (seasonal)');
    });

    it('the list, structural: promotions with a chase not open to the rung, and MDRT (P18.5-T7 AC-3)', async () => {
      renderList();
      await screen.findByRole('region', { name: 'Running' });
      await userEvent.click(screen.getByRole('tab', { name: 'Structural' }));
      await screen.findByRole('region', { name: 'Promotion Criteria' });
      await expectClean('campaigns (structural)');
    });

    it('the list, empty: the five empty lines (P18.5-T7 AC-2)', async () => {
      renderList({ campaigns: [], can: { chase: true } });
      await screen.findByText('No running campaigns right now.');
      await expectClean('campaigns (empty)');
    });

    it('the list in a read-only support session: no chase (P18.5-T7 AC-1)', async () => {
      renderList({ ...CAMPAIGN_LIST, can: { chase: false } }, { ...CAMPAIGNS_RINA, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' });
      await screen.findByRole('region', { name: 'Running' });
      await expectClean('campaigns (read-only session)');
    });

    it('the dialog, its requirement rows with progress (P18.5-T7 AC-4, P18.5-T8 AC-6)', async () => {
      nav.pathname = '/campaigns/APE_SPRINT';
      stubFetch({ ...SHELL, 'GET /campaigns': { body: CAMPAIGN_LIST }, 'GET /campaigns/APE_SPRINT': { body: campaignDetail() } });
      renderInLayout(
        AgentLayout,
        <CampaignsLayout><CampaignDialogPage params={routeParams({ campaignCode: 'APE_SPRINT' })} /></CampaignsLayout>,
        { me: CAMPAIGNS_RINA },
      );
      await screen.findByRole('dialog', { name: 'Q4 APE Sprint' });
      await screen.findByRole('region', { name: 'Running' });
      await expectClean('campaigns/[campaignCode]');
    });

    it('the dialog of a code not on the list (P18.5-T7 AC-1)', async () => {
      nav.pathname = '/campaigns/GADING_PUSH';
      stubFetch({
        ...SHELL, 'GET /campaigns': { body: CAMPAIGN_LIST },
        'GET /campaigns/GADING_PUSH': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Campaign not found.', requestId: 'r-1' } } },
      });
      renderInLayout(
        AgentLayout,
        <CampaignsLayout><CampaignDialogPage params={routeParams({ campaignCode: 'GADING_PUSH' })} /></CampaignsLayout>,
        { me: CAMPAIGNS_RINA },
      );
      await screen.findByText('This campaign isn’t on your list.');
      await expectClean('campaigns/[campaignCode] (not found)');
    });
  });

  describe('the recruitment pitch (P17-T5 AC-7, P17-T6 AC-6; P18.97-T5 — six cards, the amber badge, the Optional tag)', () => {
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
    /** Company Profile and Agency Profile are optional (ADR-0177): tagged, never Missing, counted in no figure. */
    const pitchSlot = (slot: string, title: string, state: string, ticked: string[] | null, fileName: string | null) => ({
      slot, title, line: `${title}'s line`, required: slot !== 'company' && slot !== 'agency', state,
      file: fileName ? pdfFile(fileName) : null, version: fileName ? 1 : 0,
      checklist: ticked === null ? [] : ITEMS.map(([code, label]) => ({ code, label, ticked: ticked.includes(code) })),
    });
    const PITCH = {
      empty: {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'missing', [], null),
          pitchSlot('proof', 'Proof & Credibility', 'missing', null, null),
          pitchSlot('faq', 'FAQ', 'missing', null, null),
          pitchSlot('howtojoin', 'How to Join', 'missing', null, null),
          pitchSlot('company', 'Company Profile', 'missing', null, null),
          pitchSlot('agency', 'Agency Profile', 'missing', null, null),
        ],
        summary: { done: 0, total: 4, missing: 4, unconfirmed: 0 },
      },
      'partly confirmed': {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'partial', ['career-path', 'support'], 'Opportunity_Overview_v3.pdf'),
          pitchSlot('proof', 'Proof & Credibility', 'uploaded', null, 'Proof_and_Credibility_2026.pdf'),
          pitchSlot('faq', 'FAQ', 'missing', null, null),
          pitchSlot('howtojoin', 'How to Join', 'missing', null, null),
          pitchSlot('company', 'Company Profile', 'uploaded', null, 'Company_Profile_2026.pdf'),
          pitchSlot('agency', 'Agency Profile', 'missing', null, null),
        ],
        summary: { done: 1, total: 4, missing: 2, unconfirmed: 1 },
      },
      complete: {
        slots: [
          pitchSlot('opportunity', 'Opportunity Overview', 'complete', ITEMS.map(([c]) => c), 'Opportunity_Overview_v3.pdf'),
          pitchSlot('proof', 'Proof & Credibility', 'uploaded', null, 'Proof_and_Credibility_2026.pdf'),
          pitchSlot('faq', 'FAQ', 'uploaded', null, 'FAQ.pdf'),
          pitchSlot('howtojoin', 'How to Join', 'uploaded', null, 'How_to_Join.pdf'),
          pitchSlot('company', 'Company Profile', 'uploaded', null, 'Company_Profile.pdf'),
          pitchSlot('agency', 'Agency Profile', 'uploaded', null, 'Agency_Profile.pdf'),
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
      await screen.findByRole('article', { name: 'Agency Profile' });
      await expectClean(`kpm/settings/recruitment-pitch (${state})`);
    });

    it('Settings › Recruitment pitch in a read-only support session, the boxes disabled', async () => {
      nav.pathname = '/kpm/settings/recruitment-pitch';
      stubFetch({ ...PITCH_SHELL, 'GET /recruitment/pitch-materials': { body: PITCH['partly confirmed'] } });
      renderInLayout(TenantLayout, <RecruitmentPitchPage />, { me: PITCH_SUPPORT });
      await screen.findByRole('article', { name: 'Agency Profile' });
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
      await screen.findByRole('article', { name: 'Agency Profile' });
      await expectClean(`recruitment/pitch-materials (${state})`);
    });

    it.each(Object.keys(PITCH) as (keyof typeof PITCH)[])('P18.98-T7 Recruitment › Pitch Materials in Indonesian, %s', async (state) => {
      nav.pathname = '/recruitment/pitch-materials';
      stubFetch({ ...PITCH_SHELL, 'GET /recruitment/pitch-materials': { body: PITCH[state] } });
      renderWithSession(
        <InLanguage language="id"><AgentLayout><RecruitmentLayout><PitchMaterialsPage /></RecruitmentLayout></AgentLayout></InLanguage>,
        { me: RECRUITMENT_ME },
      );
      await screen.findByRole('article', { name: 'Agency Profile' });
      await expectClean(`recruitment/pitch-materials (${state}, id)`);
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
      // `product_settings:read` is the Products screen's own (the Phase 14 exit review); Training's, Events'
      // and Campaigns' reads are theirs since Phase 18.5 (the settings-read leaks it closed).
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
        'product_settings:read', 'training_settings:read', 'event_settings:read', 'campaign_settings:read',
        // Settings › Activation checklist reads under its own grant since P18.5-T3.
        'activation_settings:read',
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
        'product_settings:read', 'training_settings:read', 'event_settings:read', 'campaign_settings:read',
        'activation_settings:read', 'sales_script:approve',
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

    it('activity types on a tablet, a section’s ⋮ open (P18.97-T6 AC-3)', async () => {
      window.localStorage.clear();
      atWidth(1023);
      stubFetch({ ...configStubs, '/kpm/settings/activity-types': { body: TAXONOMY } });
      renderInLayout(
        TenantLayout,
        <ActivityTypesPage />,
        { me: settingsOwner },
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for Selling' }));
      expect(screen.getByRole('menu', { name: 'Actions for Selling' })).toBeInTheDocument();
      await expectClean('kpm/settings/activity-types (tablet, a section’s menu open)');
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
            requirements: [{ ...money(50_000_000_000), measured: true }], reward: 'Extra unit budget',
            status: 'active', version: 1,
            kind: 'seasonal', subtype: null, window: 'campaign_dates', appliesToOrgLevelCodes: [],
            poster: { emoji: '⭐', color: 'amber' }, blurb: 'The last push of the year.',
          }],
        },
      });
      renderInLayout(TenantLayout, <CampaignsSettingsPage />, { me: settingsOwner });
      await screen.findByRole('checkbox', { name: 'Show archived' });
      await userEvent.click(screen.getByRole('link', { name: 'Production club tiers' }));
      await screen.findByText('Star Club');
      await expectClean('kpm/settings/campaigns');
    });

    it('the office’s Campaigns, the form open on a structural campaign with every D-field (P18.5-T7 AC-9)', async () => {
      stubFetch({
        ...configStubs,
        '/kpm/settings/campaigns/rules': { body: [] },
        '/kpm/settings/campaigns': { body: [] },
        '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true, campaign: true }] },
      });
      renderInLayout(TenantLayout, <CampaignsSettingsPage />, { me: settingsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
      await userEvent.selectOptions(screen.getByLabelText('Kind'), 'structural');
      await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));
      await userEvent.selectOptions(screen.getByLabelText('Requirement 1'), 'APE_ACHIEVED');
      await screen.findByLabelText('Section');
      await expectClean('kpm/settings/campaigns (form)');
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
      // The list reads under `event_settings:read` since P18.5-T5 AC-2.
      renderInLayout(TenantLayout, <EventsSettingsPage />, { me: eventsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
      await expectClean('kpm/settings/events');
    });

    /** The Owner as Settings › Events reads them since Phase 18.5: the list's own read, the roll call, the feedback. */
    const eventsOwner = {
      ...settingsOwner,
      permissions: [...settingsOwner.permissions, 'event_settings:read', 'event_attendance:confirm', 'event_feedback:read'],
    };
    const PAST_EVENT = {
      id: 'ev-prulink', code: 'PRULINK', typeCode: 'TRAINING', title: 'PRULink briefing', blurb: '', description: '',
      startsAt: '2026-09-19T02:00:00.000Z', endsAt: '2026-09-19T04:00:00.000Z', startsOn: '2026-09-19',
      location: 'Jakarta', locationUrl: null,
      audience: { issuer: 'company', scope: 'select_agents', inviteeMembershipIds: ['mem-rina'] },
      phase: 'past', status: 'active', version: 1,
    };
    const eventsStubs = {
      ...configStubs,
      '/kpm/settings/events/types': {
        body: [{
          id: 't1', code: 'TRAINING', label: 'Training', description: null, emoji: '📚',
          color: '#2D9CDB', displayOrder: 1, status: 'active', events: 1,
        }],
      },
      '/kpm/settings/events': { body: [PAST_EVENT] },
      'GET /kpm/settings/events/invitees': { body: { people: EVENT_INVITEES } },
      'GET /kpm/settings/events/ev-prulink/attendance': { body: eventRollCall() },
      'GET /kpm/settings/events/ev-prulink/feedback': { body: eventFeedbackSummary() },
    };

    it('the office’s Events, View feedback open: the roll call and the Feedback Summary (P18.5-T5 AC-7, T6 AC-5)', async () => {
      stubFetch(eventsStubs);
      renderInLayout(TenantLayout, <EventsSettingsPage />, { me: eventsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'View feedback' }));
      await screen.findByRole('table');
      await expectClean('kpm/settings/events (View feedback, Roll call)');
      // Tabs since P18.8-T13 (ADR-0161 §6): each part is checked in its own panel.
      await userEvent.click(screen.getByRole('tab', { name: 'Feedback summary' }));
      await screen.findByRole('heading', { name: 'PRULink briefing — Feedback Summary' });
      await expectClean('kpm/settings/events (View feedback, Feedback summary)');
    });

    it('the office’s Events, editing a chosen audience with the picker (P18.5-T5 AC-10)', async () => {
      stubFetch(eventsStubs);
      renderInLayout(TenantLayout, <EventsSettingsPage />, { me: eventsOwner });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByRole('searchbox', { name: 'Search people' });
      await expectClean('kpm/settings/events (picker)');
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
                  // P18.96-T7 G2: a data-backed item, bound by its code — *Auto*, and its select holding *From Sales data*.
                  {
                    code: 'FIRST_CASE_CLOSED', label: 'Close first case independently', displayOrder: 4, autoLink: null,
                    link: {
                      kind: 'sales:first', label: 'Sales data', route: null, live: true, form: 'closing',
                      completesWhen: 'the hire has a first sale since joining: a sales lead paid and issued, or a policy in the production file',
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

  /**
   * **P18.98-T4: the office's settings in ID mode, each in its main state** — axe in Indonesian, as the block above runs
   * them in English (ADR-0179 §9). The shell's words are the catalogue's since T1, so the page reads in Indonesian but
   * for what is kept English (§A) and what the office typed (ADR-0179 §5); `lang` on kept terms is T7's.
   */
  describe('P18.98-T4 the office’s settings in Indonesian', () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
      },
      permissions: [
        'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
        'activation_settings:read', 'training_settings:read', 'recruitment:read', 'activity_binding:read',
      ],
    });
    const TAXONOMY = [{
      id: 'c1', code: 'SELLING', label: 'Penjualan', description: null, appliesToOrgLevelCodes: [], displayOrder: 1,
      version: 1, status: 'active', summaryGroupCode: null, summaryGroupLabel: null,
      types: [{
        id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
      }],
    }];
    const RATIOS = [{
      id: 'r1', code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', numerator: ['SELL_SUBMISSION'],
      denominator: ['SELL_SUBMISSION'], benchmark: 0.155, comparison: 'gte', displayUnit: 'percent', displayOrder: 1,
      version: 1, status: 'active', origin: 'platform', appliesToOrgLevelCodes: [],
    }];
    const shell = {
      '/kpm/config': { body: { activity: TAXONOMY, ratios: RATIOS, leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 2, hasUnpublishedChanges: true, publishedAt: null },
      },
    };
    const inIndonesian = (path: string, page: React.ReactElement) => {
      nav.pathname = path;
      return renderWithSession(<InLanguage language="id"><TenantLayout>{page}</TenantLayout></InLanguage>, { me: owner });
    };

    it('activity types, with the publish bar and a bound type’s chip', async () => {
      stubFetch({
        ...shell,
        '/kpm/settings/activity-types': { body: TAXONOMY },
        '/kpm/settings/activity-binding': {
          body: { leads: [], appointments: [], closings: ['SELL_SUBMISSION'], version: 1, updatedAt: null },
        },
      });
      inIndonesian('/kpm/settings/activity-types', <ActivityTypesPage />);
      await screen.findByText('Dihitung sebagai: Submission polis');
      await screen.findByText('Agent Anda belum melihat perubahan ini.');
      await expectClean('kpm/settings/activity-types (id)');
    });

    it('ratio benchmarks, its figures Indonesian', async () => {
      stubFetch({ ...shell, '/kpm/settings/ratio-benchmarks': { body: RATIOS }, '/kpm/settings/activity-types': { body: TAXONOMY } });
      inIndonesian('/kpm/settings/ratio-benchmarks', <RatioBenchmarksPage />);
      await screen.findByText('15,5%');
      await expectClean('kpm/settings/ratio-benchmarks (id)');
    });

    it('lead statuses, a stage that closes the pipeline and one expected to close', async () => {
      stubFetch({
        ...shell,
        '/kpm/settings/lead-statuses': {
          body: [
            {
              pipeline: 'sales',
              statuses: [
                {
                  id: 's0', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Sudah di-follow up', rank: 1, isTerminal: false,
                  isLateStage: true, version: 1, status: 'active',
                },
                {
                  id: 's1', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Polis terbit', rank: 2, isTerminal: true,
                  isLateStage: false, version: 1, status: 'active',
                },
              ],
            },
            { pipeline: 'recruitment', statuses: [] },
          ],
        },
      });
      inIndonesian('/kpm/settings/lead-statuses', <LeadStatusesPage />);
      await screen.findByText('Menutup pipeline');
      await expectClean('kpm/settings/lead-statuses (id)');
    });

    it('branch info, the months in Indonesian', async () => {
      stubFetch({ ...shell, '/kpm/settings/branch-info': { body: KPM } });
      inIndonesian('/kpm/settings/branch-info', <BranchInfoPage />);
      await screen.findByLabelText('Tahun buku dimulai');
      await expectClean('kpm/settings/branch-info (id)');
    });

    it('capability mapping, both halves', async () => {
      const e = (code: string, label: string) => ({ code, label, displayOrder: 1, status: 'active' });
      stubFetch({
        ...shell,
        '/kpm/settings/capability-mapping': {
          body: {
            stages: [{ ...e('KOMPETEN', 'Produsen kompeten'), requiredMilestoneCodes: ['MANDIRI'], stageOrder: 1 }],
            milestones: [e('MANDIRI', 'Menjual polis secara mandiri')],
            grids: [{ ...e('PENJUALAN', 'Penjualan pribadi'), requiresDownline: true, items: [e('PENDEKATAN', 'Pendekatan')] }],
            version: 1,
          },
        },
      });
      inIndonesian('/kpm/settings/capability-mapping', <CapabilityMappingPage />);
      await screen.findByText('Perlu 1 milestone');
      await expectClean('kpm/settings/capability-mapping#ladder (id)');
      await userEvent.click(screen.getByRole('link', { name: 'Skills' }));
      await screen.findByText('Hanya untuk yang memiliki downline');
      await expectClean('kpm/settings/capability-mapping#skills (id)');
      window.location.hash = '';
    });

    it('activation checklist, an item being added', async () => {
      stubFetch({
        ...shell,
        '/kpm/settings/training': { body: [] },
        '/kpm/settings/activation-checklist': {
          body: {
            windowDays: 90,
            draft: null,
            published: {
              id: 'v1', version: 1, status: 'published', publishedAt: '2026-09-01T00:00:00.000Z',
              aspects: [{
                code: 'PENGENALAN', label: '1. Pengenalan', displayOrder: 1,
                items: [{ code: 'DASAR', label: 'Pelajari dasar-dasar asuransi', displayOrder: 1, autoLink: null, link: null }],
              }],
            },
          },
        },
      });
      inIndonesian('/kpm/settings/activation-checklist', <ActivationChecklistPage />);
      await screen.findByText('Pelajari dasar-dasar asuransi');
      await userEvent.click(screen.getByRole('button', { name: '+ Tambah item' }));
      await expectClean('kpm/settings/activation-checklist (id)');
    });

    it('recruitment pitch, partly confirmed, with a refusal said in its card', async () => {
      const ticked = (code: string, label: string, on: boolean) => ({ code, label, ticked: on });
      const slot = (s: string, title: string, over: Record<string, unknown> = {}) => ({
        slot: s, title, line: `${title}'s line`, required: s !== 'company' && s !== 'agency', state: 'missing', file: null,
        checklist: [], version: 0, ...over,
      });
      stubFetch({
        ...shell,
        'GET /recruitment/pitch-materials': {
          body: {
            slots: [
              slot('opportunity', 'Opportunity Overview', {
                state: 'partial', version: 1, file: { name: 'Peluang.pdf', bytes: 2.4 * 1024 * 1024, uploadedOn: '2026-10-12' },
                checklist: [ticked('income', 'Income Potential', true), ticked('support', 'Support provided', false)],
              }),
              slot('proof', 'Proof & Credibility'), slot('faq', 'FAQ'), slot('howtojoin', 'How to Join'),
              slot('company', 'Company Profile'), slot('agency', 'Agency Profile'),
            ],
            summary: { done: 0, total: 4, missing: 3, unconfirmed: 1 },
          },
        },
      });
      inIndonesian('/kpm/settings/recruitment-pitch', <RecruitmentPitchPage />);
      await screen.findByText('Recruitment Pitch belum lengkap');
      await userEvent.upload(
        screen.getByRole('article', { name: 'FAQ' }).querySelector('input[type=file]') as HTMLInputElement,
        new File(['x'], 'scan.pdf', { type: 'image/png' }),
      );
      await screen.findByText(/bukan PDF/);
      await expectClean('kpm/settings/recruitment-pitch (id)');
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
    // The layout wears the reader's own shell (`RoleShell`, P18.8-T5), so it is the layout a page renders in.
    const analyticsPage = (period?: string) => {
      nav.search = new URLSearchParams(period ? { period } : {}).toString();
      return <KpmAnalyticsPage />;
    };

    it('filled: the comparison with an agency open, its people listed, every MOC state and badge, the chart', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView() } });
      renderInLayout(KpmAnalyticsLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByRole('table', { name: 'Unit comparison' });
      await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
      await userEvent.click(screen.getByRole('button', { name: '31 people in Hendra Wibowo’s agency' }));
      await expectClean('kpm/analytics');
    });

    it('P18.98-T4 filled, in Indonesian: an agency open, its people listed, and the MOC dialog', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView() } });
      renderWithSession(
        <InLanguage language="id"><KpmAnalyticsLayout>{analyticsPage()}</KpmAnalyticsLayout></InLanguage>,
        { me: ANALYTICS_OWNER },
      );
      await screen.findByRole('table', { name: 'Unit comparison' });
      await userEvent.click(screen.getByRole('button', { name: 'Unit di agensi Hendra Wibowo' }));
      await userEvent.click(screen.getByRole('button', { name: '31 orang di agensi Hendra Wibowo' }));
      await expectClean('kpm/analytics, in Indonesian');
      await userEvent.click(screen.getByRole('button', { name: 'Syarat MOC terpenuhi untuk Hendra Wibowo' }));
      await screen.findByRole('dialog', { name: 'Hendra Wibowo — Maintenance of Contract' });
      await expectClean('kpm/analytics (MOC dialog), in Indonesian');
    });

    it('the MOC dialog, met and with an input not uploaded', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView('previous_month') } });
      renderInLayout(KpmAnalyticsLayout, analyticsPage('previous_month'), { me: ANALYTICS_OWNER });
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
      renderInLayout(KpmAnalyticsLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByText('There are no ABs to compare yet.');
      await expectClean('kpm/analytics (no AB)');

      cleanup();
      vi.unstubAllGlobals();
      stubFetch({
        ...ANALYTICS_SHELL,
        'GET /kpm/analytics': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } },
      });
      renderInLayout(KpmAnalyticsLayout, analyticsPage(), { me: ANALYTICS_OWNER });
      await screen.findByRole('button', { name: 'Try again' });
      await expectClean('kpm/analytics (error)');
    });

    it('P18.8-T5 a Core Leader’s: the office’s comparison in the field shell, its Core leader group open', async () => {
      nav.pathname = '/kpm/analytics';
      stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView() } });
      renderInLayout(KpmAnalyticsLayout, analyticsPage(), { me: ANALYTICS_CORE_LEADER });
      await screen.findByRole('table', { name: 'Unit comparison' });
      await expectClean('kpm/analytics (a Core Leader)');
    });

  });

  describe('KPM analytics › Compliance, Events, and Campaigns (P18.6-T1 AC-10, P18.6-T2)', () => {
    const compliancePage = (query: Record<string, string> = {}) => {
      nav.search = new URLSearchParams(query).toString();
      return <KpmAnalyticsCompliancePage />;
    };
    const openCompliance = async (body: unknown, query: Record<string, string> = {}) => {
      nav.pathname = '/kpm/analytics/compliance';
      stubFetch({
        ...ANALYTICS_SHELL,
        'GET /kpm/analytics/compliance': { body },
        'GET /kpm/settings/events/': { body: eventFeedbackSummary() },
      });
      renderInLayout(KpmAnalyticsLayout, compliancePage(query), { me: ANALYTICS_OWNER });
    };

    it('filled: Training’s three rows of tabs and the tree, the chips above', async () => {
      await openCompliance(complianceView('training'));
      await screen.findAllByRole('region');
      await expectClean('kpm/analytics/compliance');
    });

    it('filled: Activation, an expired one’s Overdue with its tooltip shown', async () => {
      await openCompliance(complianceView('activation'), { category: 'activation' });
      await screen.findAllByRole('region');
      await userEvent.click(screen.getByRole('button', { name: /^Overdue: ended on/ }));
      await expectClean('kpm/analytics/compliance?category=activation');
    });

    it('filled: a past event with its Feedback Summary, and an ended campaign’s Achieved cells', async () => {
      await openCompliance(complianceView('events', 'ev-townhall'), { category: 'events', item: 'ev-townhall' });
      await screen.findByRole('heading', { name: /Feedback Summary$/ });
      await expectClean('kpm/analytics/compliance?category=events');

      cleanup();
      vi.unstubAllGlobals();
      await openCompliance(complianceView('campaigns', 'PERSISTENCY_PUSH'), { category: 'campaigns', item: 'PERSISTENCY_PUSH' });
      await screen.findAllByRole('region');
      await expectClean('kpm/analytics/compliance?category=campaigns');
    });

    it('searched, and searched to nothing', async () => {
      await openCompliance(complianceView('training'));
      await screen.findAllByRole('region');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search agent or leader name' }), 'sinta');
      await expectClean('kpm/analytics/compliance (searched)');
      await userEvent.type(screen.getByRole('searchbox'), 'zzz');
      await screen.findByText('No one matches this search.');
      await expectClean('kpm/analytics/compliance (searched to nothing)');
    });

    it('P18.98-T4 in Indonesian: Training’s tree, and a campaign’s with its override controls', async () => {
      nav.pathname = '/kpm/analytics/compliance';
      stubFetch({
        ...ANALYTICS_SHELL,
        'GET /kpm/analytics/compliance': { body: complianceView('training') },
        'GET /kpm/settings/events/': { body: eventFeedbackSummary() },
      });
      const { unmount } = renderWithSession(
        <InLanguage language="id"><KpmAnalyticsLayout>{compliancePage()}</KpmAnalyticsLayout></InLanguage>,
        { me: ANALYTICS_OWNER },
      );
      await screen.findByRole('group', { name: 'Kategori Training' });
      await expectClean('kpm/analytics/compliance, in Indonesian');
      unmount();
      vi.unstubAllGlobals();

      stubFetch({
        ...ANALYTICS_SHELL,
        'GET /kpm/analytics/compliance': { body: complianceView('campaigns', 'PERSISTENCY_PUSH') },
        'GET /kpm/settings/events/': { body: eventFeedbackSummary() },
      });
      renderWithSession(
        <InLanguage language="id">
          <KpmAnalyticsLayout>{compliancePage({ category: 'campaigns', item: 'PERSISTENCY_PUSH' })}</KpmAnalyticsLayout>
        </InLanguage>,
        { me: ANALYTICS_OWNER },
      );
      await screen.findByRole('combobox', { name: 'Campaign' });
      await screen.findAllByRole('button', { name: /Ubah hasil .* untuk / });
      await expectClean('kpm/analytics/compliance?category=campaigns, in Indonesian');
    });

    it('empty: no AB yet, and a category with nothing to show', async () => {
      await openCompliance(COMPLIANCE_NO_AB);
      await screen.findByText('There are no ABs yet.');
      await expectClean('kpm/analytics/compliance (no AB)');

      cleanup();
      vi.unstubAllGlobals();
      await openCompliance(COMPLIANCE_EMPTY_CATALOG('events'), { category: 'events' });
      await screen.findByText('There are no events this year.');
      await expectClean('kpm/analytics/compliance (no events)');
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
      // The dialog's module is fetched on its first opening (P18.99-T16).
      await userEvent.click(await screen.findByRole('button', { name: 'Create meeting' }));
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

    it('Share these minutes, with its link', async () => {
      nav.pathname = '/leader-meetings/m-14';
      stubFetch({
        ...FORUM_SHELL,
        'GET /leader-meetings/m-14': { body: forumMeeting() },
        'POST /leader-meetings/m-14/share-links': { status: 201, body: { token: 'tok_abc', expiresAt: '2026-10-24T03:00:00.000Z' } },
      });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      await screen.findByRole('button', { name: 'Copy link' });
      await expectClean('leader-meetings/[meetingId] (Share these minutes)');
    });

    it('P18.97-T1 AC-17, AC-19, P18.97-T8 F1, F2 the stats on a phone, one card per metric; and a scorecard kept before the reference slide', async () => {
      atWidth(375);
      nav.pathname = '/leader-meetings/m-14';
      stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/m-14': { body: forumMeeting() } });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await meetingTitle();
      await screen.findByRole('heading', { level: 4, name: 'Manpower' });
      // F1: 3M new agent %'s change in percentage points; F2: each editor's target field on a line of its own.
      expect(screen.getByText('0 points')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Monthly Target per unit, FLC (avg. monthly)' }).closest('dl')).not.toHaveClass('grid');
      await expectClean('leader-meetings/[meetingId] (Overview & Stats, phone)');

      cleanup();
      vi.unstubAllGlobals();
      const kept = forumMeeting();
      const unrecorded = { kind: 'unrecorded' } as const;
      stubFetch({
        ...FORUM_SHELL,
        'GET /leader-meetings/m-14': {
          body: {
            ...kept,
            state: 'completed',
            scorecard: {
              ...kept.scorecard,
              asOf: unrecorded,
              rows: kept.scorecard.rows.map((r) => ({ ...r, cells: { ...r.cells, ytdLastYear: unrecorded } })),
            },
          },
        },
      });
      renderWithSession(meetingPage, { me: FORUM_OWNER });
      await meetingTitle();
      // The tab's and the print layout's.
      await screen.findAllByText('AS OF —');
      await expectClean('leader-meetings/[meetingId] (Overview & Stats, kept before the slide)');
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

/**
 * **The Owner's screens on a phone** (P18.97-T7, ADR-0178 §4, §5; the client's KPM Owner review of 2026-10-27, UI-034
 * to UI-036, UI-039, UI-040): each new phone state through axe at 375px — the wide tables as cards, Data upload's edit
 * sheet open, a lead status's ⋮ open, the office's tree as a list, and the checklist's and the shelf's 44px controls
 * with ↑ ↓.
 */
describe('P18.97-T7 the Owner’s screens on a phone have no axe violations', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    nav.pathname = '/admin';
    nav.search = '';
  });

  const owner = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
      isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 3,
    },
    permissions: [
      'member:read_profile', 'org_tree:read', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list',
      'tenant_config:read', 'tenant_config:write', 'product_settings:read', 'sales_script:approve', 'activation_settings:read',
      'training_settings:read', 'data_upload:read', 'data_upload:download_template', 'data_upload:upload_and_preview',
      'data_upload:correct_cell', 'data_upload:lock_month', 'data_upload:read_history',
    ],
  });
  const member = (over: Record<string, unknown>) => ({
    membershipId: 'mem-1', agentCode: 'PRU-80001', role: 'agent', status: 'active', fullName: 'Rina Wijaya', preferredName: null,
    email: 'rina@kpm0417.test', initials: 'RW', leaderId: null, leaderName: 'Maya Halim', depth: 0, directCount: 0, subtreeCount: 0,
    isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', lastActivityDays: 2,
    lastActivityOn: '2026-10-26', lastCoachedDays: null, ...over,
  });

  it('P18.97-T7 AC-1 kpm/analytics: the comparison as cards, an agency opened, its people listed', async () => {
    atWidth(375);
    nav.pathname = '/kpm/analytics';
    stubFetch({ ...ANALYTICS_SHELL, 'GET /kpm/analytics': { body: analyticsView() } });
    renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me: ANALYTICS_OWNER });
    await screen.findByRole('list', { name: 'Unit comparison' });
    await userEvent.click(screen.getByRole('button', { name: 'Units in Hendra Wibowo’s agency' }));
    await userEvent.click(screen.getByRole('button', { name: '31 people in Hendra Wibowo’s agency' }));
    await expectClean('kpm/analytics (phone)');
  });

  it('P18.97-T7 AC-1 people/members: the directory and Removed as cards', async () => {
    atWidth(375);
    const counts = { directory: 3, pending: 0, removed: 1 };
    stubFetch({
      '/members': [
        {
          body: {
            members: [
              member({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', role: 'ab', isKpmOwner: true, isLeader: true,
                directCount: 3, subtreeCount: 27, leaderName: null, isCoreLeader: true, canTagCoreLeader: true }),
              member({ membershipId: 'mem-maya', fullName: 'Maya Halim', role: 'ab', isKpmAdmin: true, canTagCoreLeader: true, lastCoachedDays: 12 }),
              member({ membershipId: 'mem-yanti', fullName: 'Yanti Kusuma', agentCode: 'PRU-80003', rejoinedOn: '2026-09-30' }),
            ],
            nextCursor: null,
            counts,
          },
        },
        {
          body: {
            members: [member({ membershipId: 'mem-yanti-1', fullName: 'Yanti Kusuma', agentCode: 'PRU-80003', status: 'removed',
              removedAt: '2026-09-10T04:00:00.000Z', rejoinedOn: '2026-09-30' })],
            nextCursor: null,
            counts,
          },
        },
      ],
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: owner });
    await screen.findByRole('list', { name: 'Office roster' });
    await expectClean('people/members (phone)');
    await userEvent.click(screen.getByRole('button', { name: /^Removed/ }));
    await screen.findByRole('list', { name: 'Removed members' });
    await expectClean('people/members, Removed (phone)');
  });

  it('P18.97-T7 AC-1 people/admins: the admins as cards, a revoke waiting', async () => {
    atWidth(375);
    stubFetch({
      '/members/admins': {
        body: [
          { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', agentCode: 'KPM0417-001', role: 'ab',
            grantedAt: null, grantedByName: null, canRevoke: false },
          { membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH', agentCode: 'KPM0417-002', role: 'ab',
            grantedAt: '2026-01-14T00:00:00.000Z', grantedByName: 'Wilson Tanoto', canRevoke: true },
        ],
      },
      '/members/tree': {
        body: {
          nodes: [treeNode({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' })],
          leader: null, rootIds: ['mem-agus'], selfId: null, counts: { ab: 1, aab: 0, agent: 0, total: 1 },
        },
      },
    });
    renderInLayout(TenantLayout, <AdminsPage />, { me: owner });
    await screen.findByRole('list', { name: 'KPM Admins' });
    await expectClean('people/admins (phone)');
    await userEvent.click(screen.getByRole('button', { name: /^Revoke Maya Halim/ }));
    await screen.findByRole('button', { name: 'Revoke access' });
    await expectClean('people/admins (phone, revoke waiting)');
  });

  it('P18.97-T7 AC-2 kpm/data-upload: a card per agent, then an agent’s sheet open with a refusal on a figure', async () => {
    atWidth(375);
    const empty = { value: null, provenance: null };
    const metrics = Object.fromEntries(['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount']
      .map((m) => [m, { monthly: empty, ytd: empty }]));
    stubFetch({
      '/kpm/data-upload/': {
        body: {
          month: '2026-09', withData: 1,
          state: { month: '2026-09', revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null },
          rows: [
            { membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', monthlyActiveAgent: true,
              metrics: { ...metrics,
                ape: { monthly: { value: 150_000_000, provenance: 'imported' }, ytd: { value: 900_000_000, provenance: 'imported' } },
                policyCount: { monthly: { value: 2, provenance: 'imported' }, ytd: { value: 11, provenance: 'corrected',
                  correction: { by: 'Maya Halim', at: '2026-09-18T03:00:00Z', reason: 'Carrier restated it' } } } } },
            { membershipId: 'mem-budi', agentCode: 'PRU-002', name: 'Budi Santoso', metrics, monthlyActiveAgent: null },
          ],
        },
      },
      '/kpm/data-upload/template': {
        body: { month: '2026-09', version: 1, filename: 'KPM0417-agent-data-Sep-2026.csv', header: ['Agent Code'], file: 'Agent Code', rowCount: 0 },
      },
      '/kpm/data-upload/history': { body: { month: '2026-09', batches: [] } },
      'PATCH /kpm/data-upload/cell': {
        status: 422,
        body: { error: { code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'APE this month would be more than the year to date already held. Correct the year to date first.', requestId: 'r' } },
      },
    });
    renderInLayout(TenantLayout, <DataUploadPage />, { me: owner });
    await screen.findByRole('list', { name: 'Data for Sep 2026' });
    await screen.findByRole('link', { name: 'Download template' });
    await expectClean('kpm/data-upload (phone)');
    await userEvent.click(screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' }));
    const sheet = screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' });
    await userEvent.clear(within(sheet).getByLabelText('APE this month'));
    await userEvent.type(within(sheet).getByLabelText('APE this month'), '99000000');
    await userEvent.type(within(sheet).getByLabelText('Why is it being corrected?'), 'Carrier restated it');
    await userEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    await within(sheet).findByText(/would be more than the year to date already held/);
    await expectClean('kpm/data-upload (phone, sheet with a refusal)');
  });

  it('P18.97-T7 AC-3 kpm/settings/lead-statuses: a stage’s ⋮ open, the switch on its own line', async () => {
    atWidth(375);
    stubFetch({
      '/kpm/settings/lead-statuses': {
        body: [
          {
            pipeline: 'sales',
            statuses: [
              { id: 's0', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
              { id: 's1', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 2, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
            ],
          },
          { pipeline: 'recruitment', statuses: [] },
        ],
      },
    });
    renderInLayout(TenantLayout, <LeadStatusesPage />, { me: owner });
    await screen.findByText('Paid and issued');
    await expectClean('kpm/settings/lead-statuses (phone)');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Paid and issued' }));
    await screen.findByRole('menu');
    // P18.97-T8 F3: Move up and Move down first, the last stage's Move down held.
    expect(screen.getByRole('menuitem', { name: 'Move down' })).toHaveAttribute('aria-disabled', 'true');
    await expectClean('kpm/settings/lead-statuses (phone, ⋮ open)');
  });

  it('P18.97-T7 AC-4 people/org-tree: the indented list, a unit opened', async () => {
    atWidth(375);
    stubFetch({
      '/members/tree': {
        body: {
          nodes: [
            treeNode({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', layer: 1, isLeader: true, directCount: 1, isSelf: true }),
            treeNode({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 2, leaderId: 'mem-owner', isLeader: true, directCount: 1 }),
            treeNode({ membershipId: 'mem-agent', fullName: 'Dimas Pratama', initials: 'DP', layer: 3, leaderId: 'mem-ab' }),
            treeNode({ membershipId: 'mem-orphan', fullName: 'Sari Puspita', initials: 'SP', role: 'aab', layer: 1 }),
          ],
          leader: null, rootIds: ['mem-owner', 'mem-orphan'], selfId: 'mem-owner',
          counts: { ab: 1, aab: 1, agent: 1, total: 3 },
        },
      },
    });
    renderInLayout(TenantLayout, <OrgTreePage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Show who reports to Agus Prasetyo' }));
    await expectClean('people/org-tree (phone)');
  });

  it('P18.97-T7 AC-6 kpm/settings/activation-checklist: 44px controls and ↑ ↓, an item moved', async () => {
    atWidth(375);
    stubFetch({
      '/kpm/settings/activation-checklist': {
        body: {
          published: {
            id: 'v1', version: 1, status: 'published', publishedAt: '2026-09-01T00:00:00.000Z',
            aspects: [{
              code: 'INTRODUCTION', label: '1. Introduction', displayOrder: 1,
              items: [
                { code: 'INSURANCE_BASICS', label: 'Learn insurance basics', displayOrder: 1, autoLink: null, link: null },
                { code: 'CAREER_MINDSET', label: 'Learn agency career mindset', displayOrder: 2, autoLink: null, link: null },
              ],
            }, {
              code: 'INITIAL_SETUP', label: '2. Initial Setup', displayOrder: 2,
              items: [{ code: 'LICENCE', label: 'Get licensed', displayOrder: 1, autoLink: null, link: null }],
            }],
          },
          draft: null,
          windowDays: 90,
        },
      },
      '/kpm/settings/training': { body: [] },
    });
    renderInLayout(TenantLayout, <ActivationChecklistPage />, { me: owner });
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Move Learn insurance basics down' }));
    await expectClean('kpm/settings/activation-checklist (phone)');
  });

  it('P18.97-T7 AC-6 kpm/settings/products: the shelf’s 44px switch, a product open', async () => {
    atWidth(375);
    const f = <T,>(value: T, overridden = false) => ({ value, overridden });
    stubFetch({
      '/kpm/settings/branch-info': { body: { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' } },
      '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
      '/kpm/settings/products/script-reviews': { body: [] },
      '/kpm/settings/products': {
        body: [{
          productId: 'p1', code: 'PRUMAPAN', companyName: 'PRUMapan', channel: 'conventional', category: 'life',
          lifecycle: 'active', sellable: true, active: f(true), displayName: f('PRUMapan'), description: f('Endowment.'),
          script: {
            goodFit: f('Young families'), opening: f('Halo?'), benefits: f(['Proteksi']), fullScript: f('Halo.'),
            objectionTheySay: f('Mahal.'), objectionYouSay: f('Bisa disesuaikan.'), nextAction: f('Ilustrasi?'),
          },
          reviewState: 'none', rejectionReason: null,
          documents: [{ slot: 'brochure', label: 'Brochure', storageKey: null, filename: null, source: 'none' }],
        }],
      },
    });
    renderInLayout(TenantLayout, <KpmProductsPage />, { me: owner });
    await userEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    await expectClean('kpm/settings/products (phone)');
  });
});

/**
 * **P18.98-T4: the forum and the office's people screens in ID mode, each in its main state** — axe in Indonesian, as
 * the blocks above run them in English (ADR-0179 §9): the forum's list, a meeting on its three tabs and its dialogs, a
 * phone's cards; *All Members* on its tabs, a member's page, *Manage KPM Admins*, *Org Tree* and *Import people*. The
 * words are the catalogue's (`messages/forum*.ts`, `members.tsx`, `member.tsx`, `admins.ts`, `org-tree.ts`,
 * `roster-import.tsx`, `requests.ts`, `leader-limit.tsx`); `lang` on kept terms is T7's.
 */
describe('P18.98-T4 the forum and the people screens in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  const owner = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
      isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
    },
    permissions: [
      'member:read_profile', 'member:transfer_approve', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list',
      'org_tree:read', 'kpm:import_roster',
    ],
  });
  const inIndonesian = (path: string, page: React.ReactElement, me = owner) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id">{page}</InLanguage>, { me });
  };
  const person = (over: Record<string, unknown> = {}) => ({
    membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
    fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test', initials: 'RW',
    leaderId: 'mem-owner', leaderName: 'Wilson Tanoto', depth: 1, directCount: 0, subtreeCount: 0, isLeader: false,
    isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', ...over,
  });
  const roster = (members: unknown[]) => ({ body: { members, nextCursor: null, counts: { directory: 2, pending: 1, removed: 0 } } });

  it('the forum’s list, and New meeting with a refusal under its field', async () => {
    stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings': { body: forumList() } });
    inIndonesian('/leader-meetings', <LeaderMeetingsPage />, FORUM_OWNER);
    await screen.findByRole('button', { name: '+ Rapat baru' });
    await expectClean('leader-meetings (id)');
    await userEvent.click(screen.getByRole('button', { name: '+ Rapat baru' }));
    await userEvent.click(screen.getByRole('button', { name: 'Buat rapat' }));
    await screen.findByText('Pilih tanggal.');
    await expectClean('leader-meetings (id, New meeting)');
  });

  it('a meeting on each of its three tabs, and Share these minutes', async () => {
    stubFetch({
      ...FORUM_SHELL,
      'GET /leader-meetings/m-14': { body: forumMeeting() },
      'POST /leader-meetings/m-14/share-links': { status: 201, body: { token: 'tok_abc', expiresAt: '2026-10-24T03:00:00.000Z' } },
    });
    inIndonesian('/leader-meetings/m-14', <LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />, FORUM_OWNER);
    await screen.findByText('Dapat mengubah notulen ini');
    await expectClean('leader-meetings/[meetingId] (id, Overview & Stats)');
    await userEvent.click(screen.getByRole('tab', { name: 'Agenda' }));
    await expectClean('leader-meetings/[meetingId] (id, Agenda)');
    await userEvent.click(screen.getByRole('tab', { name: 'Action Items' }));
    await expectClean('leader-meetings/[meetingId] (id, Action Items)');
    await userEvent.click(screen.getByRole('button', { name: 'Bagikan' }));
    await screen.findByRole('button', { name: 'Salin tautan' });
    await expectClean('leader-meetings/[meetingId] (id, Share these minutes)');
  });

  it('the stats on a phone, one card per metric', async () => {
    atWidth(375);
    stubFetch({ ...FORUM_SHELL, 'GET /leader-meetings/m-14': { body: forumMeeting() } });
    inIndonesian('/leader-meetings/m-14', <LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />, FORUM_OWNER);
    await screen.findByRole('heading', { level: 4, name: 'Manpower' });
    expect(screen.getAllByText('Perubahan').length).toBeGreaterThan(0);
    await expectClean('leader-meetings/[meetingId] (id, Overview & Stats, phone)');
  });

  it('people/members: the directory, Pending with a transfer, and Groups', async () => {
    stubFetch({
      '/members': [
        roster([person({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', preferredName: null, role: 'ab', isKpmOwner: true, isLeader: true, directCount: 1, subtreeCount: 1, canTagCoreLeader: true, leaderId: null, leaderName: null })]),
        roster([person({ status: 'pending' })]),
      ],
      '/join/requests': { body: [{ requestId: 'req-1', membershipId: 'mem-1', fullName: 'Rina Wijaya', initials: 'RW', email: 'rina@kpm0417.test', agentCode: 'KPM0417-001', role: 'agent', requestedAt: '2026-10-01T00:00:00.000Z', routedFromName: null }] },
      '/members/leader-limit-requests': { body: [] },
      '/transfer-requests': {
        body: [{
          transferId: 'tr-1', member: { membershipId: 'mem-raka', name: 'Raka Aditama', agentCode: '87014' },
          from: { membershipId: 'mem-satria', name: 'Satria Nugraha' }, to: { membershipId: 'mem-agus', name: 'Agus Prasetyo' },
          requestedBy: { membershipId: 'mem-agus', name: 'Agus Prasetyo' }, requestedAt: '2026-10-26T03:00:00.000Z', requestedName: null,
        }],
      },
      '/members/groups': { body: [{ groupId: 'g1', name: 'Top Producers Circle', ownerMembershipId: 'mem-1', ownerName: 'Rina Wijaya', ownerHasLeft: false, memberCount: 3 }] },
      '/members/tree': { body: { nodes: [treeNode({ membershipId: 'mem-1', fullName: 'Rina Wijaya' })], leader: null, rootIds: ['mem-1'], selfId: null, counts: { ab: 0, aab: 0, agent: 1, total: 1 } } },
    });
    inIndonesian('/people/members', <TenantLayout><MembersPage /></TenantLayout>);
    await screen.findByRole('table', { name: 'Roster KPM' });
    await expectClean('people/members (id)');
    await userEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    await screen.findByRole('table', { name: 'Permintaan pemindahan, terlama dulu' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Setujui' })[0]);
    await expectClean('people/members (id, Pending, a join date asked)');
    await userEvent.click(screen.getByRole('button', { name: 'Groups' }));
    await screen.findByRole('table', { name: 'Grup informal' });
    await expectClean('people/members (id, Groups)');
  });

  it('people/members/[membershipId]: the details, a role change explained and a removal asked', async () => {
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false, canBeCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/leader-limit-requests': { body: [] },
      '/members/mem-1': { body: person({ joinDate: '2026-03-02', canChangeRole: true, canPromoteToAb: true, canRemove: true }) },
    });
    inIndonesian('/people/members/mem-1', <TenantLayout><MemberPage params={routeParams({ membershipId: 'mem-1' })} /></TenantLayout>);
    await screen.findByRole('heading', { name: 'Pribadi' });
    await userEvent.selectOptions(screen.getByLabelText('Peran baru'), 'aab');
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan Rina' }));
    await expectClean('people/members/[membershipId] (id)');
  });

  it('people/admins, a revoke asked', async () => {
    stubFetch({
      '/members/admins': { body: [{ membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH', agentCode: 'KPM0417-002', role: 'ab', grantedAt: '2026-01-14T00:00:00.000Z', grantedByName: 'Wilson Tanoto', canRevoke: true }] },
      '/members/tree': { body: { nodes: [treeNode({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' })], leader: null, rootIds: ['mem-agus'], selfId: null, counts: { ab: 1, aab: 0, agent: 0, total: 1 } } },
    });
    inIndonesian('/people/admins', <TenantLayout><AdminsPage /></TenantLayout>);
    await userEvent.click(await screen.findByRole('button', { name: 'Cabut' }));
    await screen.findByRole('button', { name: 'Cabut akses' });
    await expectClean('people/admins (id, a revoke asked)');
  });

  it('people/org-tree on the canvas, and on a phone as the list', async () => {
    const tree = {
      nodes: [
        treeNode({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', layer: 1, isLeader: true, directCount: 1, isSelf: true }),
        treeNode({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 2, leaderId: 'mem-owner' }),
      ],
      leader: null, rootIds: ['mem-owner'], selfId: 'mem-owner', counts: { ab: 1, aab: 0, agent: 0, total: 1 },
    };
    stubFetch({ '/members/tree': { body: tree } });
    const { unmount } = inIndonesian('/people/org-tree', <TenantLayout><OrgTreePage /></TenantLayout>);
    await screen.findByText('Lapisan 1');
    await expectClean('people/org-tree (id)');
    unmount();
    atWidth(375);
    stubFetch({ '/members/tree': { body: tree } });
    inIndonesian('/people/org-tree', <TenantLayout><OrgTreePage /></TenantLayout>);
    await screen.findByRole('button', { name: 'Sembunyikan yang melapor kepada Wilson Tanoto' });
    await expectClean('people/org-tree (id, phone)');
  });

  it('people/import: the file’s columns, the template, a paste checked with a problem', async () => {
    const HEADER = 'fullName,email,agentCode,role,leaderAgentCode,dateOfBirth,companyJoinMonth,workStatus,gender';
    stubFetch({
      '/admin/tenants/roster-template': { body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: [] } },
      '/admin/tenants/kpm-1/roster/preview': { body: { willCreate: 0, rows: [], issues: [{ line: 2, column: 'email', message: '"x" is not an email address.' }] } },
    });
    inIndonesian('/people/import', <TenantLayout><PeopleImportPage /></TenantLayout>);
    await screen.findByRole('link', { name: 'Unduh templat' });
    await userEvent.type(screen.getByLabelText('Baris dari spreadsheet Anda'), 'A,x,881,ab');
    await userEvent.click(screen.getByRole('button', { name: 'Periksa file' }));
    await screen.findByRole('table', { name: 'Yang salah dengan file ini' });
    await expectClean('people/import (id, a problem)');
  });
});

/**
 * **P18.98-T4: the field's selling screens in ID mode, each in its main state** — axe in Indonesian, as the blocks above
 * run them in English (ADR-0179 §9): *Leads Management* with its ⋮ menu and the lead's details open; *Log Activity* on a
 * closed, corrected day and on a phone; the *Dashboard*, and on a phone with an item opened; the *Ratio* tab with its
 * formula open. The words are the catalogue's (`messages/leads.tsx`, `messages/activity.tsx`); `lang` on kept terms is
 * T7's.
 */
describe('P18.98-T4 the field’s selling screens in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.search = '';
  });

  const inIndonesian = (path: string, page: React.ReactElement, me = makeMe()) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });
  };
  const lead = (over: Record<string, unknown> = {}) => ({
    id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Pak Budi', contact: { phone: null, email: null },
    statusCode: 'FOLLOW_UP', thisMonth: true, remarks: 'Hobi golf', nextActionDate: '2026-10-02', nextActionNote: null,
    outcome: null, source: null, dateRegistered: '2026-09-04T03:00:00.000Z', version: 2, flags: [], overdueDays: null,
    committedMonths: [], lastEditedBy: null, ...over,
  });
  const leadsPage = (rows: unknown[]) => ({ body: { rows, total: rows.length, page: 1, pageSize: 200 } });
  const taxonomy = [{
    id: 'c1', code: 'LEADS', label: 'Leads', description: null, appliesToOrgLevelCodes: [], displayOrder: 1, version: 1,
    status: 'active', summaryGroupCode: 'LEADS', summaryGroupLabel: 'Leads Generation',
    types: [{
      id: 't1', code: 'LEADS_CONTACTED', label: 'Set Appointment', categoryCode: 'LEADS', description: null,
      displayOrder: 1, version: 1, status: 'active',
    }],
  }];
  const phone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));

  it('leads: the table, its ⋮ menu open, and the lead’s details', async () => {
    stubFetch({
      '/kpm/config': {
        body: {
          activity: [], ratios: [], version: 1,
          leadPipelines: [{
            pipeline: 'sales',
            statuses: [{
              id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Sudah di-follow up', rank: 1, isTerminal: false,
              isLateStage: false, version: 1, status: 'active',
            }],
          }],
        },
      },
      '/kpm/org-levels': { body: [] },
      '/leads': leadsPage([
        lead({ flags: ['overdue'], overdueDays: 9, lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } }),
        lead({ id: 'l2', ownerMembershipId: 'mem-7', name: 'Bu Rina', thisMonth: false, remarks: null, nextActionDate: null }),
      ]),
      'outcome=won': leadsPage([lead({ id: 'w1', name: 'Ibu Wulan Sari', outcome: 'won', thisMonth: false })]),
      'outcome=lost': leadsPage([]),
    });
    inIndonesian('/leads', <LeadsPage />, makeMe({ permissions: ['lead:read', 'lead:update', 'lead:mark_outcome'] }));

    await screen.findByText('Ibu Wulan Sari');
    expect(screen.getByRole('table', { name: 'Leads Anda' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Pak Budi' }));
    await screen.findByRole('menu', { name: 'Aksi untuk Pak Budi' });
    await expectClean('leads (id, the ⋮ menu open)');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Detail lead' }));
    const details = await screen.findByRole('dialog', { name: 'Detail lead untuk Pak Budi' });
    await within(details).findByText('Terakhir diubah oleh Ibu Sari');
    await expectClean('leads (id)');
  });

  // UI V1 (UI-105): the compact list — chips, the pipeline strip, the cards, the + — and the lead sheet.
  it('UI-105 leads on a phone: the compact list with its strip, and the lead sheet', async () => {
    phone();
    const ladder = [
      { id: 's1', pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Belum didekati', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Dibayar dan diterbitkan', rank: 2, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
    ];
    const budi = lead({ type: 'sales', statusCode: 'NOT_YET_APPROACHED' });
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [{ pipeline: 'sales', statuses: ladder }], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/leads': leadsPage([budi]),
      [`/leads/${budi.id}`]: { body: { ...budi, history: [{ at: '2026-10-27T03:00:00.000Z', fromStatusCode: null, toStatusCode: 'NOT_YET_APPROACHED' }] } },
      'outcome=won': leadsPage([]),
      'outcome=lost': leadsPage([]),
    });
    inIndonesian('/leads', <LeadsPage />, makeMe({ permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'] }));

    const list = await screen.findByRole('list', { name: 'Leads Anda' });
    expect(screen.getByRole('group', { name: 'Pipeline Sales' })).toBeInTheDocument();
    await expectClean('leads (id, phone)');
    await userEvent.click(within(list).getByRole('button', { name: 'Pak Budi' }));
    const sheet = await screen.findByRole('dialog', { name: 'Pak Budi' });
    await within(sheet).findByText(/Status → Belum didekati/);
    await expectClean('leads (id, phone, the lead sheet)');
  });

  it('log activity: a closed, corrected day, its reason asked', async () => {
    stubFetch({
      '/kpm/config': { body: { activity: taxonomy, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/activity/log': {
        body: {
          membershipId: 'mem-1', localDate: '2026-03-11', entries: [], totalCount: 0, version: 1,
          frozenAt: '2026-03-12T00:00:00Z', editable: false, correctionCount: 2,
        },
      },
    });
    inIndonesian('/activity/log', <LogActivityPage />);

    await screen.findByLabelText('Mengapa catatan ini dikoreksi?');
    expect(screen.getByText(/^Total aktivitas hari ini/)).toBeInTheDocument();
    await expectClean('activity/log (id)');
  });

  it('UI-106 log activity on a phone: the views, the date pill, the rows and the save bar', async () => {
    phone();
    stubFetch({
      '/kpm/config': { body: { activity: taxonomy, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/activity/log': {
        body: {
          membershipId: 'mem-1', localDate: '2026-03-11',
          entries: [{ activityTypeId: 't1', activityTypeCode: 'LEADS_CONTACTED', label: 'Set Appointment', count: 2 }],
          totalCount: 2, version: 1, frozenAt: null, editable: true, correctionCount: 0,
        },
      },
    });
    inIndonesian('/activity/log', <LogActivityPage />);

    await screen.findByRole('button', { name: 'Simpan aktivitas' });
    expect(screen.getByText(/^Hari ini:/)).toHaveTextContent('Hari ini: 2 aktivitas');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah Set Appointment' }));
    await expectClean('activity/log (id, phone)');
  });

  it('the activity dashboard, and on a phone with an item opened', async () => {
    const day = (iso: string) => ({ from: iso, to: iso, days: 1, kind: 'day' });
    const counts = [3, 0, 1, 0, 2, 0, 0];
    const routes = {
      '/kpm/config': {
        body: {
          activity: [{
            id: 'c1', code: 'SELLING', label: 'Selling', description: null, appliesToOrgLevelCodes: [], displayOrder: 1,
            version: 1, status: 'active', summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling', types: [],
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
              { code: 'SELL_OLD', label: 'Item lama', description: 'Diarsipkan di bulan Agustus', displayOrder: 9, standing: 'archived', total: 2, counts: [1, 0, 0, 0, 1, 0, 0] },
            ],
          }],
          total: 6, counts, daysLogged: 5, correctedDays: 1,
        },
      },
    };
    stubFetch(routes);
    inIndonesian('/activity/dashboard', <ActivityDashboardPage />);
    await screen.findByText('Submission polis');
    await screen.findByText('Total aktivitas');
    await expectClean('activity/dashboard (id)');

    cleanup();
    phone();
    stubFetch(routes);
    inIndonesian('/activity/dashboard', <ActivityDashboardPage />);
    await screen.findByRole('region', { name: 'Aktivitas Anda' });
    await userEvent.click(screen.getByRole('button', { name: /^Submission polis/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Item lama/ }));
    await expectClean('activity/dashboard (id, phone, opened)');
  });

  it('the ratio tab, a rate and a balance, the formula open', async () => {
    const term = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder });
    const base = {
      comparison: 'gte', displayUnit: 'percent', benchmark: 0.3, tag: { code: 'SELLING', label: 'Selling' }, sides: null,
      numerator: [term('SELL_SUBMISSION', 'Submission polis', 6)], denominator: [term('SELL_PRESENTATION', 'Presentasi', 4)],
      purpose: 'Mengukur konversi', divergesFromStandard: true, numeratorCount: 1, denominatorCount: 11, share: null,
    };
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/activity/ratios': {
        body: {
          membershipId: 'm-1', from: '2026-08-30', to: '2026-09-28', days: 30,
          ratios: [
            { ...base, code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band',
              displayUnit: 'points', benchmark: 30, tag: { code: null, label: 'Balance' },
              sides: { numerator: 'Selling', denominator: 'Recruitment' }, value: 34, share: 67, status: 'alert' },
            { ...base, code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', value: 0.09, status: 'alert' },
          ],
        },
      },
    });
    inIndonesian('/activity/ratio', <ActivityRatioPage />);
    // UI V1 (UI-106): the shared card, a row tapped open.
    await screen.findByRole('region', { name: 'Ratio · 30 hari terakhir' });
    const row = document.querySelector('[data-ratio="SELLING_SUCCESS_RATE"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button'));
    expect(row).toHaveTextContent('Apa itu ratio ini?');
    await expectClean('activity/ratio (id)');
  });

  /* ── The sales tools and Recruitment's Attack Plan (`messages/product-catalog.ts`, `sales-attack-plan.tsx`, `plan.ts`, `recruitment-plan.ts`) */

  const SALES_SHELL = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
  };

  it('the product catalog, filled, and a search that finds nothing', async () => {
    stubFetch({ ...SALES_SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
    inIndonesian('/product-catalog', <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, SALES_ME);
    // UI V1 (UI-107): the categories in Indonesian — *Life* is *Jiwa*.
    await screen.findByRole('heading', { level: 2, name: 'Jiwa' });
    await expectClean('product-catalog (id)');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cari produk berdasarkan nama' }), 'zzz');
    await screen.findByText('Tidak ada produk yang cocok dengan “zzz”.');
    await expectClean('product-catalog (id, search, no match)');
  });

  it.each(['Details', 'Attack Plan', 'Documents'])('the product drawer open on %s, the tab kept English', async (tab) => {
    stubFetch({
      ...SALES_SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRUMAPAN': { body: salesProduct() },
    });
    inIndonesian(
      '/product-catalog/PRUMAPAN',
      <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>,
      SALES_ME,
    );
    const box = await screen.findByRole('dialog', { name: 'PRUMapan' });
    await userEvent.click(within(box).getByRole('tab', { name: tab }));
    await expectClean(`product-catalog/[productCode] (id, ${tab})`);
  });

  it('the sales attack plan: its brief part chosen, then a plan with its more line', async () => {
    stubFetch({ ...SALES_SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
    inIndonesian('/attack-plan', <AttackPlanPage />, SALES_ME);
    await screen.findByRole('heading', { level: 2, name: 'Dengan siapa kita bicara?' });
    await userEvent.click(within(screen.getByRole('group', { name: 'Kebutuhan utama' })).getByRole('button', { name: 'Kesehatan' }));
    await expectClean('attack-plan (id, brief)');

    cleanup();
    const alternatives = ['A', 'B', 'C', 'D'].map((c) => ({ code: c, name: `Product ${c}` }));
    stubFetch({
      ...SALES_SHELL, 'GET /product-catalog': { body: { products: SHELF } },
      'GET /attack-plan': { body: salesPlan({ alternatives, moreCount: 3 }) },
    });
    nav.search = new URLSearchParams({ need: 'health', age: '2', budget: '2' }).toString();
    inIndonesian('/attack-plan', <AttackPlanPage />, SALES_ME);
    await screen.findByRole('heading', { level: 2, name: 'PRUMapan' });
    await expectClean('attack-plan (id, plan)');
  });

  it('the sales attack plan’s Check fit, its note in one Indonesian sentence', async () => {
    stubFetch({
      ...SALES_SHELL, 'GET /product-catalog': { body: { products: SHELF } },
      'GET /attack-plan': { body: salesPlan({ verdict: 'check_fit', outside: ['age', 'budget'] }) },
    });
    nav.search = new URLSearchParams({ need: 'retirement', age: '5', budget: '6' }).toString();
    inIndonesian('/attack-plan', <AttackPlanPage />, SALES_ME);
    await screen.findByText(/Di luar rentang usia dan rentang anggaran/);
    await expectClean('attack-plan (id, check fit)');
  });

  it('recruitment’s attack plan: the brief part chosen, the plan, and a company with no playbook', async () => {
    const recruitment = () => <RecruitmentLayout><RecruitmentAttackPlanPage /></RecruitmentLayout>;
    stubFetch({ ...SALES_SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView() } });
    inIndonesian('/recruitment/attack-plan', recruitment(), RECRUITMENT_ME);
    await screen.findByRole('heading', { level: 2, name: 'Dengan siapa kita bicara?' });
    // The chips are the company's playbook, shown as typed.
    await userEvent.click(within(screen.getByRole('group', { name: 'Jenis kandidat' })).getByRole('button', { name: 'Retiree' }));
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Apa yang mendorongnya' })).getByRole('button', { name: 'Career change' }),
    );
    await expectClean('recruitment/attack-plan (id, brief)');

    cleanup();
    stubFetch({ ...SALES_SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView(recruitmentPlan()) } });
    nav.search = new URLSearchParams(RECRUITMENT_BRIEF).toString();
    inIndonesian('/recruitment/attack-plan', recruitment(), RECRUITMENT_ME);
    await screen.findByRole('heading', { level: 2, name: 'Fresh graduate' });
    await expectClean('recruitment/attack-plan (id, plan)');

    cleanup();
    nav.search = '';
    stubFetch({ ...SALES_SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView(null, false) } });
    inIndonesian('/recruitment/attack-plan', recruitment(), RECRUITMENT_ME);
    await screen.findByText('Belum ada rencana recruitment yang dapat disusun.');
    await expectClean('recruitment/attack-plan (id, no playbook)');
  });

  /* ── Goal Settings and Personal Summary (`messages/goals.tsx`, `goal-words.ts`, `summary.tsx`) */

  it('goal settings: five numbered cards, two entry modes and a live cascade', async () => {
    const period = String(new Date().getFullYear());
    stubFetch({
      // The cascade's three types, so each column carries its activity's chip (P10.1-T6; by name since P18.95-T5).
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
            policiesPerMonth: 6, policiesPerWeek: 1.4,
            appointmentsPerMonth: 20, appointmentsPerWeek: 5,
            leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false,
          },
          cascadeMapping: {
            leadsCode: 'LEADS_CONTACTED',
            appointmentsCode: 'SELL_PRESENTATION',
            closingsCode: 'SELL_SUBMISSION',
          },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
          measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
          savedAt: '2026-09-13T04:00:00.000Z',
          savedByMembershipId: 'mem-leader',
        },
      },
    });
    inIndonesian('/goals', <GoalSettingsPage />, makeMe({ permissions: ['goal:read', 'goal:update'] }));

    await screen.findByRole('button', { name: 'Simpan goal' });
    await expectClean('goals (id)');
  });

  it('goal settings on a phone: the floating save pill, the commitment in the report’s sentence (P18.99-T5)', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    const period = String(new Date().getFullYear());
    stubFetch({
      '/kpm/config': { body: { activity: GOAL_CASCADE_CONFIG, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/goals': {
        body: {
          period, mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
          commissionRatePct: 10, monthsLeft: 2.2, monthsLeftIsOverride: false, apeAchievedMinor: 0,
          achieved: { minor: 290_000_000_00, provenance: 'imported', month: '2026-09' },
          caseSizeMinor: 18_000_000_00, leadsToApptPct: 50, closingRatePct: 30,
          snapshot: { monthlyApeTargetMinor: 95_454_545_00, policiesPerMonth: 6, appointmentsPerMonth: 18, leadsPerMonth: 36 },
          projected: {
            annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 290_000_000_00,
            remainingApeMinor: 210_000_000_00, monthlyApeTargetMinor: 95_454_545_00,
            policiesPerMonth: 6, policiesPerWeek: 1.4, appointmentsPerMonth: 18, appointmentsPerWeek: 5,
            leadsPerMonth: 36, leadsPerWeek: 9, targetMet: false,
          },
          cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
          cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
          measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
          savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-1',
        },
      },
    });
    inIndonesian('/goals', <GoalSettingsPage />, makeMe({ permissions: ['goal:read', 'goal:update'] }));

    // UI V1 (P18.99-T5): the floating save pill, and the report's sentence (UI-017).
    const save = await screen.findByRole('button', { name: 'Simpan goal' });
    expect(save.closest('[data-floating-save]')).not.toBeNull();
    expect(screen.getByText(/^Bulan ini/).closest('p')).toHaveTextContent('36 Set appointment, 18 Sales meeting, 6 Submission polis.');
    await expectClean('goals (id, phone)');
  });

  it('personal summary, populated: the gap, the pace, the chips, the pulse, the leads, the insights, then its year', async () => {
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
        { code: 'RECRUITMENT', label: 'Recruitment', total: 3, rows: [{ code: 'RECRUIT_PRESENTATION', label: 'Melakukan presentasi recruitment', count: 3 }] },
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
      // P18.5-T7 AC-6: *Campaigns you're chasing*, with its rows.
      'GET /campaigns/chasing': { body: CAMPAIGNS_RINA_CHASING },
      '/activity/ratios': {
        body: { membershipId: 'm-1', from: '2026-08-16', to: '2026-09-14', days: 30, ratios: [rate('SSR', 0.1, 'alert'), rate('LPA', null, 'neutral')] },
      },
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/summary': {
        body: {
          year: '2026', month: '2026-09', today: '2026-09-14', goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' },
          period: { firstMonth: '2026-01', thisMonth: '2026-09', currentMonth: true, currentYear: true },
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
    inIndonesian('/summary', <PersonalSummaryPage />);
    await screen.findByRole('region', { name: 'Target vs. realisasi (APE)' });
    await screen.findByText('SSR');
    await within(await screen.findByRole('region', { name: 'Campaign yang Anda kejar' })).findByText('Q4 APE Sprint');
    await expectClean('summary (id)');
    await userEvent.click(screen.getByRole('button', { name: 'Tahunan' }));
    await screen.findByRole('button', { name: 'Tahun: 2026' });
    await expectClean('summary (id, the year)');
  });
});

/**
 * **P18.98-T4: new hires, the 90-day activation and User Management in ID mode, each in its main state** — axe in
 * Indonesian, as *the 90-day activation (P13)* block and the User Management tests above run them in English (ADR-0179
 * §9): the hire's `/activation` with a row's note and date open and *Which case?* open; `/new-hires` with its sections,
 * *Tandai keluar*'s confirmation, a phone's cards, *Menunggu bergabung* and *+ Tambah agent* with its share step; a
 * hire's detail; and the four User Management screens. The words are the catalogue's (`messages/activation.ts`,
 * `new-hires.ts`, `add-agent.ts`, `user-management.ts`); `lang` on kept terms is T7's.
 */
describe('P18.98-T4 new hires, activation and User Management in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SHELL = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
  };
  const inIndonesian = (path: string, page: React.ReactElement, me: ReturnType<typeof makeMe>) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });
  };
  const ADDING = { ...SARI_ME, permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS, 'calendar_entry:create'] };

  it('the hire’s page: a row’s note and date open, an Otomatis chip’s words shown, and Which case? open', async () => {
    stubFetch({
      ...SHELL,
      '/activation/me/closings': { body: { closings: [{ leadId: 'l-1', name: 'Ibu Ratna', date: '2026-09-20' }] } },
      '/activation/me': { body: activationView({}, withWaitingCheckIn()) },
    });
    inIndonesian('/activation', <ActivationPage />, RINA_ME);
    await screen.findByRole('heading', { level: 2, name: 'Progres activation Anda' });
    await userEvent.click(within(document.querySelector('[data-code="INSURANCE_BASICS"]') as HTMLElement)
      .getByRole('button', { name: 'Tampilkan catatan dan tanggal' }));
    await userEvent.click(screen.getAllByRole('button', { name: /^Otomatis — / })[0]);
    await expectClean('activation (id)');
    const milestone = within(document.querySelector('[data-code="INDEPENDENT_AGENT_MILESTONE"]') as HTMLElement);
    await userEvent.click(milestone.getByRole('checkbox'));
    await userEvent.click(await milestone.findByRole('radio', { name: 'Catat closing baru' }));
    await expectClean('activation (id, which case)');
  });

  it('the hire’s page at 100%, its confirmation open, and with no activation', async () => {
    stubFetch({ ...SHELL, '/activation/me': { body: completeView() } });
    const { unmount } = inIndonesian('/activation', <ActivationPage />, RINA_ME);
    await userEvent.click(await screen.findByRole('button', { name: 'Tandai checklist selesai' }));
    await screen.findByRole('dialog');
    await expectClean('activation (id, confirm)');
    unmount();
    stubFetch({ ...SHELL, '/activation/me': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
    inIndonesian('/activation', <ActivationPage />, { ...RINA_ME, activation: null });
    await screen.findByRole('heading', { level: 2, name: 'Anda tidak punya 90-day activation.' });
    await expectClean('activation (id, none)');
  });

  it('UI-024 the roster from 768px: the table, Menunggu bergabung, + Tambah agent and its modal, and the share step', async () => {
    atWidth(1280);
    stubFetch({
      ...SHELL,
      '/new-hires': { body: ROSTER },
      '/new-hires/invites': { body: { today: JOINING_TODAY, invites: [invite(), invite({ inviteId: 'inv-2', fullName: 'Rudi Hartono', status: 'expired' })] } },
      '/new-hires/transfers': { body: [requestedTransfer()] },
      '/join/requests': { body: [joinRequest()] },
      '/join/requests/routing': { body: [] },
      '/join/my-code': { body: { code: 'SARI01', url: 'https://app.test/join?code=SARI01' } },
      'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } },
    });
    inIndonesian('/new-hires', <NewHiresPage />, ADDING);
    await screen.findByRole('table', { name: 'New Hires' });
    await screen.findByRole('region', { name: 'Menunggu bergabung' });
    await screen.findAllByRole('button', { name: 'Tinjau permintaan (1)' });
    await expectClean('new-hires (id)');
    await userEvent.click(screen.getAllByRole('button', { name: '+ Tambah agent' })[0]);
    const form = within(await screen.findByRole('dialog', { name: 'Tambah agent' }));
    await form.findByText('SARI01');
    await expectClean('new-hires (id, add agent)');
    await userEvent.type(form.getByLabelText('Kode agen'), '80777');
    await userEvent.type(form.getByLabelText('Nama'), 'Yusuf Hidayat');
    await userEvent.type(form.getByLabelText('Nomor WhatsApp'), '812 8077 7001');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah & kirim undangan' }));
    await screen.findByRole('dialog', { name: 'Undang Yusuf Hidayat' });
    await expectClean('new-hires (id, invite share)');
  });

  it('UI-024 the roster on a phone: Aktivasi 3M, the filter, the leader tree', async () => {
    atWidth(375);
    stubFetch({ ...SHELL, '/new-hires': { body: ROSTER } });
    inIndonesian('/new-hires', <NewHiresPage />, SARI_ME);
    await screen.findByRole('group', { name: 'Tampilkan' });
    await expectClean('new-hires (id, phone)');
  });

  it('one hire’s detail, overdue, with the join date’s correction and the coaching note, and Catat 1:1 open', async () => {
    stubFetch({
      ...SHELL,
      '/new-hires/mem-rina': { body: leaderView({ day: 95, overdue: true, startCorrected: { by: SARI, at: '2026-09-01T02:00:00.000Z' } }) },
    });
    inIndonesian('/new-hires/mem-rina', <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, SARI_ME);
    await screen.findByRole('heading', { level: 2, name: 'Progres activation' });
    await expectClean('new-hires/[membershipId] (id)');
    await userEvent.click(within(document.querySelector('[data-code="WEEKLY_CHECK_IN"]') as HTMLElement).getByRole('checkbox'));
    await screen.findByRole('group', { name: 'Catat 1:1' });
    await expectClean('new-hires/[membershipId] (id, log 1:1)');
  });

  it('User Management’s four screens', async () => {
    const NO_OFFICE = {
      kpmId: null, kpmLabel: null, registeredAt: null, leaderMembershipId: null, leaderName: null, status: 'none', pendingRequestTo: null,
    };
    const REGISTERED = { ...NO_OFFICE, kpmId: 'kpm-1', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', status: 'pending' };
    const leader = makeMe({
      membership: {
        membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: [
        'member:invite', 'member:search_untagged_pool', 'member:change_role', 'member:remove_from_team',
        'leader_request:read_inbox', 'leader_request:approve', 'leader:search_directory', 'leader_request:create',
      ],
    });

    stubFetch({
      '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } },
      '/join/kpms': { body: [{ kpmId: 'kpm-1', code: '0417', branchName: 'BSD City Branch', companyName: 'Prudential', city: 'Tangerang' }] },
    });
    const kpm = inIndonesian('/user-management/kpm', <RegisterKpmPage />, makeMe({ membership: null, permissions: ['kpm:read_directory', 'kpm_registration:create'] }));
    await screen.findByText('Prudential — KPM 0417');
    await userEvent.click(screen.getByRole('button', { name: 'Ajukan KPM' }));
    await expectClean('user-management/kpm (id)');
    kpm.unmount();

    stubFetch({
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-x' } },
      '/join/leaders': {
        body: [
          { membershipId: 'mem-x', fullName: 'Wilson Tanoto', role: 'ab', unitSize: 4, isCurrentLeader: false, requestSent: true },
          { membershipId: 'mem-y', fullName: 'Dewi Lestari', role: 'aab', unitSize: 0, isCurrentLeader: false, requestSent: false },
        ],
      },
    });
    const find = inIndonesian('/user-management/leader', <FindLeaderPage />, leader);
    await screen.findByText('Wilson Tanoto');
    await expectClean('user-management/leader (id)');
    find.unmount();

    stubFetch({
      '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
      '/members/my-team': {
        body: [{ membershipId: 'mem-r', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '80001', role: 'agent', orgLevelCode: 'AGENT', directCount: 2, canChangeRole: true }],
      },
      '/join/untagged': { body: [{ membershipId: 'mem-b', fullName: 'Budi Santoso', initials: 'BS', agentCode: '80002' }] },
    });
    const add = inIndonesian('/user-management/add', <AddAgentsPage />, leader);
    await screen.findAllByText('Budi Santoso');
    // UI-083: *Keluarkan* last in the role sheet, then its confirmation.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ubah peran Rina Wijaya, sekarang Agent' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan' }));
    await expectClean('user-management/add (id, a removal asked)');
    add.unmount();

    stubFetch({ '/join/requests/routing': { body: [] }, '/join/requests': { body: [joinRequest()] } });
    inIndonesian('/user-management/pending', <PendingPage />, leader);
    await screen.findByText('Putri Anggraini');
    await expectClean('user-management/pending (id)');
  });
});

/**
 * **P18.98-T4: coaching and the Unit Dashboard in ID mode, each in its main state** — axe in Indonesian, as the blocks
 * above run them in English (ADR-0179 §9): the coaching roster as a table and as a phone's cards, a session as a draft
 * with its Activity drill open and finalized with *Edit again* asked, a past session's archive, the reader's own
 * coaching, *Leader Notes*, a coachee's *Activation*; the Unit Dashboard filled, opened, on a phone, with *Update
 * production* open, empty and a unit below the reader; the Group tree. The words are the catalogue's
 * (`messages/coaching*.ts(x)`, `unit-dashboard.ts`, `group-tree.ts`, `activation.ts`'s `record`); `lang` on kept terms
 * is T7's.
 */
describe('P18.98-T4 coaching and the Unit Dashboard in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.params = {};
    nav.search = '';
  });

  const shell = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [{ pipeline: 'sales', statuses: [] }, { pipeline: 'recruitment', statuses: [] }], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/notifications': { body: { items: [], unread: 0 } },
  };
  const coachMe = makeMe({
    user: {
      id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
      pronoun: 'he', initials: 'AS', platformRole: 'none',
    },
    membership: {
      membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 4,
    },
    permissions: [
      'coaching_session:read', 'coaching_session:create', 'coaching_session:edit', 'coaching_session:finalize',
      'coaching_session:reopen', 'coaching_session:export_pdf', 'personal_summary:read', 'goal:read', 'goal:update',
      'activity_ratios:read', 'lead:read', 'lead:create', 'lead:update', 'lead:mark_outcome',
      'coaching_profile:read', 'coaching_profile:update', 'leader_notes:read', 'leader_notes:write', 'activation:read',
    ],
  });
  const inIndonesian = (path: string, page: React.ReactElement, me = coachMe) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });
  };
  const inPerson = (path: string, tab: React.ReactElement) =>
    inIndonesian(path, <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>{tab}</CoachingPersonLayout>);
  const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));

  const agus = { membershipId: 'mem-agus', name: 'Agus Santoso' };
  const rosterRow = (membershipId: string, name: string, over: Record<string, unknown> = {}) => ({
    membershipId, name, rung: { code: 'AGENT', label: 'Agent' }, depth: 1,
    lastOneOnOne: { days: 9, date: '2026-09-23', overdue: true, coach: agus }, status: 'watch_closely', ...over,
  });
  const roster = {
    today: '2026-10-02', overdueAfterDays: 7,
    directAgents: [rosterRow('mem-rina', 'Rina Wijaya'), rosterRow('mem-melati', 'Melati Putri', { lastOneOnOne: null, status: 'no_goal_set' })],
    units: [{
      head: rosterRow('mem-dimas', 'Dimas Aditya', { rung: { code: 'AAB', label: 'Associate Agency Builder' }, status: 'on_track' }),
      members: [rosterRow('mem-tono', 'Tono Saputra', { depth: 2, status: 'needs_attention' })],
    }],
  };
  const rina = {
    membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
    leader: agus, direct: true, downline: { members: 0, leaders: 0 }, today: '2026-10-02',
  };
  const M = 1_000_000 * 100;
  const draft = {
    sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: agus, status: 'draft', version: 1,
    date: null, startedAt: '2026-10-02T02:00:00.000Z', finalizedAt: null, finalizedBy: null, reopenableUntil: null,
    lastWeek: { sessionId: 's-0924', date: '2026-09-24' },
    lastWeekItems: [
      { itemId: 'lw-1', text: 'Confirm submission paperwork', dueDate: '2026-09-24', lead: null, done: true },
      { itemId: 'lw-2', text: 'Call Alvin', dueDate: '2026-09-24', lead: { leadId: 'l-2', name: 'Alvin Sanjaya' }, done: false },
    ],
    leadActions: [{ leadId: 'l-1', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: null }],
    actionItems: [{ itemId: 'a-1', text: 'Practice a tighter close', dueDate: '2026-10-06' }],
    tips: [{ tipId: 't-1', text: 'Slow down on the opening line.' }],
    snapshot: null, earlier: [],
  };
  const figures = (target: number, actual: number, pct: number, gap: number) => ({
    targetMinor: target, actualMinor: actual, attainmentPct: pct, gapMinor: gap, overMinor: 0, policiesNeeded: 1, targetMet: false,
  });
  const none = { from: '2026-10-01', to: '2026-10-02', targets: [], total: 0, sections: [] };
  const sessionRoutes = (current: unknown, read: unknown = draft) => ({
    ...shell,
    'GET /coaching/coachees/mem-rina': { body: rina },
    'GET /coaching/coachees/mem-rina/sessions': {
      body: { today: '2026-10-02', current, sessions: [{ sessionId: 's-0924', date: '2026-09-24', coach: agus, actionItemCount: 3, completedCount: 1 }] },
    },
    'GET /coaching/sessions/s-1': { body: read },
    '/summary?for=mem-rina': {
      body: {
        year: '2026', month: '2026-10', today: '2026-10-02', goal: { set: true, savedAt: null }, caseSizeMinor: 18 * M,
        period: { firstMonth: '2026-01', thisMonth: '2026-10', currentMonth: true, currentYear: true },
        monthly: { ...figures(80 * M, 65.6 * M, 82, 14.4 * M), source: { provenance: 'imported', month: '2026-09' } },
        yearly: { ...figures(960 * M, 620 * M, 65, 340 * M), source: { provenance: 'imported', month: '2026-09' } },
        pace: null, activity: { monthly: none, yearly: none }, leads: { rows: [], total: 0 }, insights: [],
      },
    },
    '/activity/ratios?for=mem-rina': { body: { ...UNIT_RATIOS, membershipId: 'mem-rina' } },
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
    'GET /leads?owner=mem-rina': { body: { rows: [], total: 0, page: 1, pageSize: 200 } },
  });
  const record = (over: Record<string, unknown> = {}) => ({
    ...draft, sessionId: 's-0924', status: 'finalized', version: 4, date: '2026-09-24', finalizedAt: '2026-09-25T03:00:00.000Z',
    finalizedBy: agus, reopenableUntil: '2026-10-01', lastWeek: { sessionId: 's-0917', date: '2026-09-17' },
    snapshot: {
      takenAt: '2026-09-24T03:00:00.000Z',
      goal: {
        period: '2026', month: '2026-09', currency: 'IDR',
        monthly: { targetMinor: 80 * M, actualMinor: 65.6 * M, attainmentPct: 82, gapMinor: 14.4 * M, targetMet: false },
        yearly: { targetMinor: 960 * M, actualMinor: 620 * M, attainmentPct: 65, gapMinor: 340 * M, targetMet: false },
        source: { provenance: 'imported', month: '2026-08' },
      },
      ratios: { from: '2026-08-26', to: '2026-09-24', days: 30, rows: [] },
      activity: { from: '2026-09-18', to: '2026-09-24', targets: [], sections: [] },
    },
    earlier: [{
      finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: agus, reopenedAt: '2026-09-25T02:00:00.000Z', reopenedBy: agus,
      reason: 'Two action items had the wrong dates.', lastWeekItems: [], leadActions: [], actionItems: [], tips: [],
    }],
    ...over,
  });

  it('coaching: the roster, one row per person and the tree (UI-033)', async () => {
    stubFetch({ ...shell, '/coaching/coachees': { body: roster } });
    inIndonesian('/coaching', <CoachingRosterPage />);
    await screen.findByRole('heading', { level: 2, name: 'Semua orang yang Anda coaching' });
    await screen.findAllByRole('link', { name: /.+/ });
    await expectClean('coaching (id, UI V1)');
  });

  it('coaching/[membershipId]/session: a draft with the Activity drill open', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'draft' }));
    inPerson('/coaching/mem-rina/session', <CoachingSessionTabPage />);
    await screen.findByText(/Rp 620 jt/);
    const drill = await screen.findByRole('button', { name: '7 hari terakhir' });
    await waitFor(() => expect(drill).toBeEnabled());
    await expectClean('coaching/[membershipId]/session (id, a draft)');
    await userEvent.click(drill);
    await screen.findByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
    await expectClean('coaching/[membershipId]/session (id, the Activity drill)');
  });

  it('coaching/[membershipId]/session: finalized, with Edit again’s reason asked', async () => {
    stubFetch(sessionRoutes(
      { sessionId: 's-1', status: 'finalized' },
      { ...draft, status: 'finalized', version: 3, date: '2026-10-02', finalizedAt: '2026-10-02T03:00:00.000Z', finalizedBy: agus, reopenableUntil: '2026-10-09' },
    ));
    inPerson('/coaching/mem-rina/session', <CoachingSessionTabPage />);
    await screen.findByText('Difinalkan 2 Okt');
    await userEvent.click(screen.getByRole('button', { name: 'Ubah lagi' }));
    await screen.findByRole('dialog', { name: 'Ubah sesi ini lagi?' });
    await expectClean('coaching/[membershipId]/session (id, Edit again)');
  });

  it('coaching/[membershipId]/archive/[sessionId]: the record, its earlier version open', async () => {
    nav.params = { membershipId: 'mem-rina', sessionId: 's-0924' };
    stubFetch({ ...shell, '/coaching/coachees/mem-rina': { body: { ...rina, today: '2026-09-28' } }, '/coaching/sessions/s-0924': { body: record() } });
    inPerson('/coaching/mem-rina/archive/s-0924', <CoachingArchivePage />);
    await screen.findByRole('region', { name: 'Versi sebelumnya' });
    await userEvent.click(screen.getByRole('button', { name: 'Lihat yang disepakati' }));
    await expectClean('coaching/[membershipId]/archive/[sessionId] (id)');
  });

  it('coaching/me: the reader’s own coaching, its past sessions open', async () => {
    stubFetch({
      ...shell,
      '/coaching/me/sessions': {
        body: {
          sessions: [{ sessionId: 's-0924', date: '2026-09-24', coach: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, actionItemCount: 2, completedCount: 1 }],
          ledFormerly: [{ sessionId: 's-led', date: '2026-08-20', coachee: { membershipId: 'mem-bayu', name: 'Bayu Pratama' }, actionItemCount: 2, completedCount: 1 }],
        },
      },
      '/coaching/sessions/s-0924': { body: record({ coachee: agus, coach: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, reopenableUntil: null }) },
    });
    inIndonesian('/coaching/me', <MyCoachingPage />);
    await screen.findByRole('region', { name: 'Tips coaching dari Wilson' });
    await userEvent.click(screen.getByRole('button', { name: 'Lihat sesi sebelumnya' }));
    await expectClean('coaching/me (id)');
  });

  it('coaching/[membershipId]/leader-notes: the capability mapping, the skill tracker and the notes', async () => {
    const item = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder, status: 'active' });
    stubFetch({
      ...shell,
      'GET /coaching/coachees/mem-rina': { body: rina },
      'GET /coaching/coachees/mem-rina/profile': {
        body: {
          catalog: {
            stages: [{ ...item('COMPETENT', 'Competent Producer', 1), stageOrder: 1, requiredMilestoneCodes: ['M1'] }],
            milestones: [item('M1', 'Sells policies independently', 1)],
            grids: [{ ...item('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', 1), requiresDownline: true, items: [item('VIS', 'Visibility', 1)] }],
          },
          milestoneCodes: ['M1'], skillCodes: [], stageCode: 'COMPETENT', version: 1, updatedAt: null, updatedBy: null,
        },
      },
      'GET /coaching/coachees/mem-rina/leader-notes': {
        body: { mine: null, others: [{ noteId: 'n-2', author: { membershipId: 'mem-sari', name: 'Sari Wulandari' }, text: 'Watch her load.', updatedAt: '2026-09-29T03:00:00.000Z' }] },
      },
    });
    inPerson('/coaching/mem-rina/leader-notes', <CoacheeLeaderNotesTab />);
    await screen.findByRole('region', { name: 'Catatan pribadi dari Sari Wulandari' });
    await expectClean('coaching/[membershipId]/leader-notes (id)');
  });

  it('coaching/[membershipId]/activation: a coachee’s checklist', async () => {
    stubFetch({ ...shell, '/coaching/coachees/': { body: rina }, 'GET /new-hires/mem-rina': { body: leaderView() } });
    inPerson('/coaching/mem-rina/activation', <CoacheeActivationTab />);
    await screen.findByText('31% selesai');
    await expectClean('coaching/[membershipId]/activation (id)');
  });

  const unitShow = (view: unknown = unitDashboard()) => {
    stubFetch({ ...shell, 'GET /unit/dashboard': { body: view }, '/activity/ratios': { body: UNIT_RATIOS } });
    return inIndonesian('/unit/dashboard', <UnitDashboardPage />, UNIT_READER);
  };

  it('unit/dashboard: filled, a unit closed, the chips filtering, and Update production open (UI V1)', async () => {
    unitShow();
    await screen.findByRole('table', { name: 'Roster tim Anda' });
    await expectClean('unit/dashboard (id)');
    await userEvent.click(screen.getByRole('button', { name: 'Unit Anda · 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Perlu perhatian 4' }));
    await expectClean('unit/dashboard (id, closed and filtered)');
    await userEvent.click(screen.getByRole('button', { name: 'Perbarui produksi' }));
    await screen.findByRole('dialog', { name: 'Perbarui produksi' });
    await expectClean('unit/dashboard (id, Update production)');
  });

  it('unit/dashboard: on a phone, the accordion with a unit opened (UI V1, UI-002)', async () => {
    onPhone();
    unitShow();
    await screen.findByRole('button', { name: /^Unit Anda · 4/ });
    await userEvent.click(screen.getByRole('button', { name: /^Unit Sari Wulandari/ }));
    await expectClean('unit/dashboard (id, phone)');
  });

  it('unit/dashboard: empty, and a unit below the reader', async () => {
    const { unmount } = unitShow(UNIT_EMPTY);
    await screen.findByText('Belum ada siapa pun di unit Anda.');
    await expectClean('unit/dashboard (id, empty)');
    unmount();
    vi.unstubAllGlobals();
    stubFetch({ ...shell, 'GET /unit/dashboard': { body: SARI_UNIT }, '/activity/ratios': { body: UNIT_RATIOS } });
    inIndonesian('/unit/dashboard/mem-sari', <UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, UNIT_READER);
    await screen.findByRole('heading', { level: 1, name: 'Unit Dashboard Sari Wulandari' });
    await expectClean('unit/dashboard/[membershipId] (id)');
  });

  it('group-tree: its line, and its empty state', async () => {
    stubFetch({ ...shell, '/members/tree': { body: { nodes: [], leader: null, rootIds: [], selfId: 'mem-agus', counts: { ab: 0, aab: 0, agent: 0, total: 0 } } } });
    inIndonesian('/group-tree', <GroupTreePage />, makeMe({ ...coachMe, permissions: ['org_tree:read'] }));
    await screen.findByText(/^Belum ada yang melapor kepada Anda\./);
    await expectClean('group-tree (id, empty)');
  });
});

describe('P18.98-T4 the shared pieces in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  const notice = (over: Record<string, unknown> = {}) => ({
    notificationId: 'n-1', templateId: 'join_request.approved', title: 'Anda sudah bergabung',
    detail: 'Permintaan Anda disetujui.', href: null, kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null,
    ...over,
  });
  const inbox = {
    items: [
      notice(),
      notice({ notificationId: 'n-2', title: 'Sesi difinalkan', detail: null, readAt: '2026-09-02T00:00:00.000Z' }),
      notice({ notificationId: 'n-3', title: 'Sesi difinalkan', detail: null, readAt: '2026-09-02T00:00:00.000Z' }),
    ],
    unread: 1, total: 45, page: 1, pageSize: 20,
  };

  it('notifications: the inbox, a repeated notice, the pager and a notice opened', async () => {
    stubFetch({ '/notifications': { body: inbox }, 'POST /notifications/n-1/read': { body: { notificationId: 'n-1', readAt: '2026-10-01T00:00:00.000Z', unread: 0 } } });
    renderWithSession(<InLanguage language="id"><NotificationsPage /></InLanguage>, { me: SUPER_ADMIN });
    await screen.findByRole('button', { name: 'Belum dibaca: Anda sudah bergabung' });
    expect(screen.getByRole('navigation', { name: 'Halaman notifikasi' })).toBeInTheDocument();
    await expectClean('notifications (id)');
    await userEvent.click(screen.getByRole('button', { name: 'Belum dibaca: Anda sudah bergabung' }));
    await screen.findByRole('dialog', { name: 'Anda sudah bergabung' });
    await expectClean('notifications (id, a notice opened)');
  });

  it('notifications: empty, and refused by the browser', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0, total: 0, page: 1, pageSize: 20 } } });
    const { unmount } = renderWithSession(<InLanguage language="id"><NotificationsPage /></InLanguage>, { me: SUPER_ADMIN });
    await screen.findByText(/^Belum ada apa pun\./);
    await expectClean('notifications (id, empty)');
    unmount();
    vi.unstubAllGlobals();
    stubFetch({ '/notifications': { status: 503, body: null } });
    renderWithSession(<InLanguage language="id"><NotificationsPage /></InLanguage>, { me: SUPER_ADMIN });
    await screen.findByText('Terjadi kesalahan. Silakan coba lagi.');
    await expectClean('notifications (id, refused)');
  });

  it('the page frame: the refusal, an office that cannot be used, and the sign for a route not built yet', async () => {
    const { NotAvailableToYou } = await import('@/components/require-session');
    const { OfficeUnavailable } = await import('@/components/office-unavailable');
    const { ComingInPhase } = await import('@/components/coming-in-phase');
    const { unmount } = renderWithSession(<InLanguage language="id"><main><NotAvailableToYou permission="kpm_analytics:read" /></main></InLanguage>);
    expect(screen.getByRole('heading', { name: 'Tidak tersedia untuk Anda' })).toBeInTheDocument();
    await expectClean('refusal (id)');
    unmount();
    const office = renderWithSession(
      <InLanguage language="id">
        <OfficeUnavailable
          error={{ code: 'TENANT_SUBSCRIPTION_ENDED', message: 'x', details: { kpmCode: '0417', endDate: '2026-10-01' }, requestId: 'r' }}
          onSignOut={() => undefined}
        />
      </InLanguage>,
    );
    expect(screen.getByRole('heading', { name: 'Langganan KPM Anda telah berakhir' })).toBeInTheDocument();
    await expectClean('office unavailable (id)');
    office.unmount();
    renderWithSession(
      <InLanguage language="id">
        <main>
          <h1>Advanced analytics</h1>
          <ComingInPhase what="Analitik lanjutan untuk KPM Anda." elsewhere={[{ href: '/kpm/overview', label: 'Overview', detail: 'Ringkasan KPM Anda.' }]} />
        </main>
      </InLanguage>,
    );
    expect(screen.getByRole('heading', { name: 'Yang dapat Anda lakukan sekarang' })).toBeInTheDocument();
    await expectClean('placeholder (id)');
  });
});

/**
 * **P18.98-T4: the pages before a session and *Your account* in ID mode, each in its main state** — axe in Indonesian,
 * as the blocks above run them in English (ADR-0179 §9): sign-in with the development accounts panel open, registration
 * on a leader's invite, *Reset your password* sent, *Choose a new password* with its two messages, *Verify your email*
 * verified, *Choose your own password*, `/join` signed out and with a code checked, and *Your account* with its sessions.
 * The words are the catalogue's (`messages/auth.tsx`, `join.tsx`, `account.ts`); `lang` on kept terms is T7's.
 */
describe('P18.98-T4 the public and account pages in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.search = '';
  });

  const inIndonesian = (page: React.ReactElement, me: ReturnType<typeof makeMe> | null = null) =>
    renderWithSession(<InLanguage language="id">{page}</InLanguage>, { me });

  it('login, with the development accounts panel open', async () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    try {
      inIndonesian(<LoginPage />);
      await userEvent.click(screen.getByRole('button', { name: /^Tampilkan semua \d+ akun$/ }));
      expect(screen.getByRole('heading', { name: 'Akun pengembangan' })).toBeInTheDocument();
      await expectClean('login (id, dev accounts)');
    } finally {
      process.env.NEXT_PUBLIC_APP_ENV = original;
    }
  });

  it('register, on a leader’s invite', async () => {
    nav.search = 'invite=kpm-1.secret';
    stubFetch({
      '/companies': { body: [{ _id: 'co-2', name: 'Prudential' }] },
      '/invites/': {
        body: {
          leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-2', companyName: 'Prudential',
          agentCode: '80777', joinDate: JOINING_TODAY, fullName: 'Yusuf Hidayat', existingAccount: false, expiresAt: '2026-11-10T03:00:00.000Z',
        },
      },
    });
    inIndonesian(<RegisterPage />);
    await screen.findByText('Anda bergabung ke tim Agus Prasetyo · KPM 0417');
    await expectClean('register (id, invite)');
  });

  it('forgot password, sent', async () => {
    stubFetch({ '/auth/forgot-password': { status: 202, body: {} } });
    inIndonesian(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim tautan atur ulang' }));
    await screen.findByText(/tautan atur ulang kata sandi sedang dikirim/);
    await expectClean('forgot-password (id, sent)');
  });

  it('reset password, with its two messages', async () => {
    inIndonesian(<ResetPasswordPage params={routeParams({ token: 't' })} />);
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'short');
    await userEvent.type(screen.getByLabelText('Konfirmasi kata sandi'), 'other');
    expect(screen.getByText('Kedua kata sandi tidak sama.')).toBeInTheDocument();
    await expectClean('reset-password (id)');
  });

  it('verify email, verified', async () => {
    stubFetch({ '/auth/verify-email': { body: {} } });
    inIndonesian(<VerifyEmailPage params={routeParams({ token: 't' })} />);
    await screen.findByText(/sudah terverifikasi/);
    await expectClean('verify-email (id)');
  });

  it('choose your own password', async () => {
    inIndonesian(<ChooseAPasswordPage />, makeMe({ mustChangePassword: true }));
    await expectClean('choose-a-password (id)');
  });

  // Signed out, `/join` draws its card with no landmark around it (`RoleShell`'s `allowSignedOut`), which axe's
  // *region* refuses in both languages — a page structure, not its words, and why the English block above lists `/join`
  // as not yet covered. Signed in, the shell's `<main>` holds it.
  it('join: a code checked', async () => {
    nav.search = 'code=JOR417';
    stubFetch({
      '/join/invite': { body: { code: 'JOR417', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', leaderName: 'Wilson Tanoto' } },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    inIndonesian(<JoinPage />, makeMe({ membership: null, permissions: ['join_via_code_link_qr'] }));
    await screen.findByRole('button', { name: 'Terima dan bergabung' });
    await expectClean('join (id, code checked)');
  });

  it('profile, with where the account is signed in', async () => {
    stubFetch({
      '/auth/sessions': {
        body: [
          { sessionId: 's1', userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/120', ip: '103.10.1.2', lastUsedAt: '2026-09-10T08:00:00.000Z', startedAt: null, expiresAt: '2026-10-01T08:00:00.000Z', current: true },
          { sessionId: 's2', userAgent: null, ip: null, lastUsedAt: null, startedAt: null, expiresAt: '2026-10-01T08:00:00.000Z', current: false },
        ],
      },
      '/notifications': { body: { items: [], unread: 0 } },
      // UI V1 (UI-111): Profil saya's read-only facts.
      '/auth/me/profile': { body: { companyName: null, agentCode: null, leader: null, group: null } },
    });
    inIndonesian(<ProfilePage />, makeMe({ permissions: ['profile:read_self'] }));
    // Since UI V1 the devices are behind *Perangkat tempat Anda masuk* ›, in a sheet.
    await userEvent.click(await screen.findByRole('button', { name: /Perangkat tempat Anda masuk/ }));
    await screen.findByText('Perangkat ini');
    await expectClean('profile (id)');
  });
});

/**
 * **P18.98-T4: training and the office's products in ID mode, each in its main state** — axe in Indonesian, as the
 * blocks above run them in English (ADR-0179 §9): the learner's list, on a desktop and on a phone, a module's page with
 * its toggle and in a support session, the reader's own coaching *Training* tab; Settings › Training on Modules with the
 * add panel open, a module's page with its Files, Videos and Links; Settings › Products with a product opened, and *Script
 * approvals* with a send-back asked. The words are the catalogue's (`messages/training.ts`, `training-settings.tsx`,
 * `settings-products.tsx`); `lang` on kept terms is T7's.
 */
describe('P18.98-T4 training and the office’s products in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  const fieldShell = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/notifications': { body: { items: [], unread: 0 } },
    'GET /training/progress': { body: trainingProgressView() },
  };
  const inField = (path: string, page: React.ReactElement, me = TRAINING_LEARNER) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });
  };
  const learnerList = (
    <LearnerTrainingLayout><LearnerCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></LearnerTrainingLayout>
  );
  const learnerModule = (
    <LearnerTrainingLayout>
      <LearnerModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} />
    </LearnerTrainingLayout>
  );

  it('training/[categoryCode]: the list, and on a phone', async () => {
    stubFetch(fieldShell);
    const { unmount } = inField('/training/SALES', learnerList);
    await screen.findByRole('list', { name: 'Modul Prospecting' });
    await expectClean('training/[categoryCode] (id)');
    unmount();
    atWidth(375);
    stubFetch(fieldShell);
    inField('/training/SALES', learnerList);
    await screen.findByRole('list', { name: 'Modul Prospecting' });
    await expectClean('training/[categoryCode] (id, phone)');
  });

  it('training/[categoryCode]/[moduleCode]: the tiles and the toggle, and in a support session', async () => {
    stubFetch({ ...fieldShell, 'GET /training/modules/CLOSING_TECHNIQUES': { body: trainingModulePage({ status: 'in_progress' }) } });
    const { unmount } = inField('/training/SALES/CLOSING_TECHNIQUES', learnerModule);
    await screen.findByRole('group', { name: 'Status Closing Techniques That Work' });
    await expectClean('training/[categoryCode]/[moduleCode] (id)');
    unmount();
    stubFetch({ ...fieldShell, 'GET /training/modules/CLOSING_TECHNIQUES': { body: trainingModulePage({ can: { update: false } }) } });
    inField('/training/SALES/CLOSING_TECHNIQUES', learnerModule, TRAINING_SUPPORT);
    await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
    await expectClean('training/[categoryCode]/[moduleCode] (id, support session)');
  });

  it('coaching/me/training: the reader’s own Training tab', async () => {
    stubFetch(fieldShell);
    inField('/coaching/me/training', <MyCoachingTrainingPage />);
    await screen.findByRole('heading', { level: 2, name: 'Sales (4/10)' });
    await expectClean('coaching/me/training (id)');
  });

  const owner = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
      isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
    },
    permissions: [
      'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'kpm:read_profile',
      'product_settings:read', 'training_settings:read', 'sales_script:approve',
    ],
  });
  const officeShell = {
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/notifications': { body: { items: [], unread: 0 } },
    '/kpm/settings/branch-info': { body: { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' } },
  };
  const inOffice = (page: React.ReactElement) =>
    renderWithSession(<InLanguage language="id"><TenantLayout>{page}</TenantLayout></InLanguage>, { me: owner });
  const settingsTree = [{
    id: 'tc1', code: 'PENJUALAN', label: 'Penjualan', description: null, displayOrder: 1, version: 1, status: 'active',
    skills: [{
      id: 'ts1', code: 'PROSPEK', categoryCode: 'PENJUALAN', label: 'Mencari prospek', displayOrder: 1, version: 1,
      status: 'active',
      modules: [
        { id: 'tm1', code: 'DAFTAR_PROSPEK', skillCode: 'PROSPEK', title: 'Menyusun daftar prospek', publishState: 'published', displayOrder: 1, version: 1, status: 'active' },
        { id: 'tm2', code: 'TELEPON', skillCode: 'PROSPEK', title: 'Telepon pertama', publishState: 'draft', displayOrder: 2, version: 1, status: 'active' },
      ],
    }],
  }];

  it('kpm/settings/training: on Modules with the add panel open', async () => {
    window.history.replaceState(null, '', '/kpm/settings/training#modules');
    nav.pathname = '/kpm/settings/training';
    stubFetch({ ...officeShell, '/kpm/settings/training': { body: settingsTree } });
    inOffice(<TrainingSettingsPage />);
    await screen.findByText('Menyusun daftar prospek');
    await userEvent.click(screen.getByRole('button', { name: '+ Tambah modul' }));
    await expectClean('kpm/settings/training (id)');
  });

  it('kpm/settings/training/[moduleId]: its fields, and its Files, Videos and Links', async () => {
    nav.pathname = '/kpm/settings/training/tm1';
    stubFetch({
      ...officeShell,
      '/kpm/settings/training/modules/DAFTAR_PROSPEK/content': {
        body: {
          moduleCode: 'DAFTAR_PROSPEK', title: 'Menyusun daftar prospek', overridden: true,
          content: {
            files: [{ id: 'f1', label: 'Materi prospek', storageKey: 'k/1', mimeType: 'application/pdf', bytes: 2_097_152 }],
            videos: [], links: [{ id: 'l1', label: 'Webinar', url: 'https://example.com/w' }],
          },
          companyContent: { files: [], videos: [], links: [] },
        },
      },
      '/kpm/settings/training': { body: settingsTree },
    });
    inOffice(<TrainingModulePage params={routeParams({ moduleId: 'tm1' })} />);
    await screen.findByText('KPM ini punya materi sendiri untuk modul ini.');
    await expectClean('kpm/settings/training/[moduleId] (id)');
  });

  it('kpm/settings/products: a product opened, and Script approvals with a send-back asked', async () => {
    nav.pathname = '/kpm/settings/products';
    const f = <T,>(value: T, overridden = false) => ({ value, overridden });
    const script = {
      goodFit: f('Keluarga muda'), opening: f('Halo dari kami.', true), benefits: f(['Proteksi jiwa']), fullScript: f('Halo.'),
      objectionTheySay: f('Terlalu mahal.'), objectionYouSay: f('Bisa disesuaikan.'), nextAction: f('Siapkan ilustrasi.'),
    };
    const row = {
      productId: 'p1', code: 'PRUMAPAN', companyName: 'PRUMapan', channel: 'conventional', category: 'life',
      lifecycle: 'active', sellable: true, active: f(true), displayName: f('PRUMapan'), description: f('Dana pensiun.'),
      script, reviewState: 'pending', rejectionReason: null,
      documents: [{ slot: 'brochure', label: 'Brosur', storageKey: null, filename: null, source: 'none' }],
    };
    stubFetch({
      ...officeShell,
      '/kpm/settings/products/script-reviews': { body: [row] },
      '/kpm/settings/products/p1/script/effective': { body: { source: 'company', script } },
      '/kpm/settings/products': { body: [row] },
    });
    inOffice(<KpmProductsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sesuaikan' }));
    await screen.findByLabelText('Nama yang dipakai KPM Anda');
    await expectClean('kpm/settings/products (id)');
    await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Kembalikan' }));
    await screen.findByLabelText('Mengapa Anda mengembalikannya?');
    await expectClean('kpm/settings/products#approvals (id)');
  });
});

/**
 * **P18.98-T6: the Super Admin's console in ID mode, each screen in its main state** — axe in Indonesian, as the blocks
 * above run them in English (ADR-0179 §9): the Overview, *All KPMs* with *Edit subscription* open, *New office*, an
 * office's page, *Transfer owner*, *KPM Owners & Admins*, *Billing & subscription* (the editor, the dialog refused, the
 * quote), *Cross-platform analytics*, the audit log, the two queues, and a support session's two pages. The words are
 * the catalogue's (`messages/admin-*.ts(x)`, `billing.tsx`, `support-session.tsx`, `office-subscription.ts`); `lang` on
 * kept terms is T7's. The pages are imported where they are run, so this block adds nothing to the file's head.
 */
describe('P18.98-T6 the Super Admin’s console in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    nav.search = '';
  });

  const ADMIN = makeMe({
    ...SUPER_ADMIN,
    permissions: [
      ...SUPER_ADMIN.permissions, 'kpm:read_profile', 'kpm:suspend', 'kpm:assign_owner', 'platform_metrics:read',
      'platform_analytics:read', 'billing:read_prices', 'kpm_request:read', 'kpm_request:decide', 'leader_limit_request:read',
      'leader_limit_request:decide', 'kpm_admin:list_platform', 'impersonation:start', 'impersonation:elevate_to_write',
    ],
  });
  const INBOX = { '/notifications': { body: { items: [], total: 0, page: 1, pageSize: 1, unread: 0 } } };
  const SUBSCRIBED = {
    ...KPM, ownerUserId: 'u-owner', ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', leadersUsed: 13,
    subscriptionState: 'active',
    subscription: { startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, currency: 'IDR', maxLeaders: 10, keepActiveAfterEnd: false },
  };
  const inIndonesian = (path: string, page: React.ReactElement) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AdminLayout>{page}</AdminLayout></InLanguage>, { me: ADMIN });
  };

  it('admin: the Overview, filled', async () => {
    stubFetch({ ...INBOX, '/admin/overview': { body: OVERVIEW } });
    inIndonesian('/admin', <AdminOverviewPage />);
    await screen.findByRole('heading', { name: 'Perlu perhatian Anda' });
    await expectClean('admin (id)');
  });

  it('admin/tenants: the list past the limit, and Edit subscription open', async () => {
    stubFetch({ ...INBOX, '/admin/tenants': { body: [SUBSCRIBED] } });
    inIndonesian('/admin/tenants', <TenantsPage />);
    await screen.findByRole('table', { name: 'KPM di platform' });
    await expectClean('admin/tenants (id)');
    await userEvent.click(screen.getByRole('button', { name: /^Ubah langganan untuk KPM 0417/ }));
    await screen.findByRole('dialog', { name: 'Ubah langganan' });
    await expectClean('admin/tenants, Edit subscription (id)');
  });

  it('admin/tenants/new and an office’s page', async () => {
    stubFetch({ ...INBOX, '/admin/companies': { body: [COMPANY] }, '/admin/companies/co-1/templates': { body: [] } });
    const { unmount } = inIndonesian('/admin/tenants/new', <NewTenantPage />);
    await screen.findByLabelText('Kode KPM');
    await expectClean('admin/tenants/new (id)');
    unmount();
    vi.unstubAllGlobals();
    const { default: TenantDetailPage } = await import('./(admin)/admin/tenants/[kpmId]/page');
    stubFetch({ ...INBOX, '/admin/tenants/kpm-1': { body: SUBSCRIBED } });
    inIndonesian('/admin/tenants/kpm-1', <TenantDetailPage params={routeParams({ kpmId: 'kpm-1' })} />);
    await screen.findByRole('heading', { name: 'Siklus hidup' });
    await expectClean('admin/tenants/[kpmId] (id)');
  });

  it('admin/tenants/[kpmId]/owner, transferring', async () => {
    const { default: AssignOwnerPage } = await import('./(admin)/admin/tenants/[kpmId]/owner/page');
    stubFetch({ ...INBOX, '/admin/tenants/kpm-1': { body: SUBSCRIBED } });
    inIndonesian('/admin/tenants/kpm-1/owner', <AssignOwnerPage params={routeParams({ kpmId: 'kpm-1' })} />);
    await screen.findByRole('heading', { level: 1, name: 'Pindahkan Owner' });
    await expectClean('admin/tenants/[kpmId]/owner (id)');
  });

  it('admin/tenant-admins', async () => {
    stubFetch({
      ...INBOX,
      '/admin/tenant-admins': {
        body: [{ membershipId: 'mem-1', fullName: 'Wilson Tanoto', email: 'wilson@kpm0417.test', initials: 'WT', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch', isOwner: true, isAdmin: false, grantedAt: null }],
      },
    });
    inIndonesian('/admin/tenant-admins', <TenantAdminsPage />);
    await screen.findByText('Melekat pada KPM');
    await expectClean('admin/tenant-admins (id)');
  });

  it('admin/billing: the editor with its override open, the dialog refused, and the quote', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T18:30:00Z'));
    const { default: BillingPage } = await import('./(admin)/admin/billing/page');
    const tier = (code: string, min: number, max: number | null, s: number, six: number, annual: number) => ({
      code, minLeaders: min, maxLeaders: max, standardMinor: s * 100, sixMonthMinor: six * 100, annualMinor: annual * 100, customPricing: max === null,
    });
    stubFetch({
      ...INBOX,
      '/admin/billing/prices': {
        body: { currency: 'IDR', annualDiscountPct: 5, tiers: [tier('T1', 1, 10, 500_000, 400_000, 380_000), tier('T2', 11, null, 375_000, 250_000, 237_500)] },
      },
    });
    inIndonesian('/admin/billing', <BillingPage />);
    await screen.findByText('Perkirakan harga Anda');
    await userEvent.click(screen.getByText('Penyesuaian manual'));
    await expectClean('admin/billing (id)');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim penawaran' }));
    await userEvent.click(screen.getByRole('button', { name: 'Buat penawaran' }));
    await screen.findByText('Isi nama KPM.');
    await expectClean('admin/billing, the dialog refused (id)');
    await userEvent.type(screen.getByLabelText('Nama KPM'), 'Jakarta Selatan');
    await userEvent.type(screen.getByLabelText('Nama PIC'), 'Andi Wijaya');
    await userEvent.type(screen.getByLabelText('Diisi oleh sales'), 'Maya');
    await userEvent.click(screen.getByRole('button', { name: 'Buat penawaran' }));
    await screen.findByRole('heading', { name: 'Penawaran langganan' });
    await expectClean('admin/billing, the quote (id)');
  });

  it('admin/analytics and admin/audit', async () => {
    const figures = { members: 20, byRung: [{ code: 'AGENT', label: 'Agent', count: 20 }], joinedThisMonth: 1, leftThisMonth: 0, signedIn7d: 12, signedIn30d: 18 };
    stubFetch({
      ...INBOX,
      '/admin/analytics': {
        body: {
          month: '2026-10',
          offices: [{ kpmId: 'kpm-1', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, state: 'active', ...figures }],
          companies: [{ id: 'co-1', name: 'Prudential', offices: 1, ...figures }],
          platform: { offices: 1, companies: 1, ...figures },
        },
      },
    });
    const { unmount } = inIndonesian('/admin/analytics', <PlatformAnalyticsPage />);
    await screen.findByRole('table', { name: 'Adopsi per cabang dan perusahaan' });
    await expectClean('admin/analytics (id)');
    unmount();
    vi.unstubAllGlobals();
    stubFetch({ ...INBOX, '/admin/audit': { body: [AUDIT] }, '/admin/tenants': { body: [KPM] } });
    inIndonesian('/admin/audit', <AuditPage />);
    await screen.findByRole('table', { name: 'Entri audit, terbaru lebih dulu' });
    await expectClean('admin/audit (id)');
  });

  it('admin/kpm-requests and admin/leader-limit-requests, a card waiting and the decided table', async () => {
    stubFetch({
      ...INBOX,
      '/admin/kpm-requests': {
        body: [
          { requestId: 'req-1', branchName: 'Surabaya Branch', companyId: 'co-1', companyName: 'Prudential', requestedByName: 'Rangga Wibisono', requestedByEmail: 'rangga@example.test', note: null, status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z', decidedAt: null, reason: null, createdKpmId: null },
          { requestId: 'req-2', branchName: 'Medan Branch', companyId: 'co-1', companyName: 'Prudential', requestedByName: 'Dewi', requestedByEmail: 'dewi@example.test', note: null, status: 'approved', requestedAt: '2026-09-01T00:00:00.000Z', decidedAt: '2026-09-02T00:00:00.000Z', reason: null, createdKpmId: 'kpm-9' },
        ],
      },
    });
    const { unmount } = inIndonesian('/admin/kpm-requests', <KpmRequestsPage />);
    await screen.findByRole('table', { name: 'Pendaftaran yang sudah diputuskan' });
    await expectClean('admin/kpm-requests (id)');
    unmount();
    vi.unstubAllGlobals();
    const limit = (over: Record<string, unknown>) => ({
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch', subjectMembershipId: 'mem-1',
      subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'promote', fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB',
      reason: 'Siap memimpin', requestedByMembershipId: 'mem-owner', requestedByName: 'Hendra Gunawan', status: 'pending',
      requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null, declineReason: null, maxLeaders: 10, leadersUsed: 13, ...over,
    });
    stubFetch({ ...INBOX, '/admin/leader-limit-requests': { body: [limit({}), limit({ requestId: 'llr-2', status: 'declined', declineReason: 'Naikkan saat perpanjangan.' })] } });
    inIndonesian('/admin/leader-limit-requests', <LeaderLimitRequestsPage />);
    await screen.findByRole('table', { name: 'Permintaan yang sudah diputuskan' });
    await expectClean('admin/leader-limit-requests (id)');
  });

  it('admin/impersonate/[userId] from Open as Owner, and admin/impersonation/[sessionId]', async () => {
    const { default: ImpersonatePage } = await import('./(admin)/admin/impersonate/[userId]/page');
    const { default: ElevateSessionPage } = await import('./(admin)/admin/impersonation/[sessionId]/page');
    nav.search = 'purpose=setup&kpmId=kpm-1';
    stubFetch({ ...INBOX, '/admin/tenants/kpm-1': { body: SUBSCRIBED } });
    const { unmount } = inIndonesian('/admin/impersonate/u-owner', <ImpersonatePage params={routeParams({ userId: 'u-owner' })} />);
    await screen.findByText('Rina Wijaya');
    await expectClean('admin/impersonate/[userId] (id)');
    unmount();
    inIndonesian('/admin/impersonation/s1', <ElevateSessionPage params={routeParams({ sessionId: 's1' })} />);
    await userEvent.type(screen.getByLabelText('Mengapa melihat saja tidak cukup?'), 'pendek');
    await screen.findByText('Minimal 10 karakter.');
    await expectClean('admin/impersonation/[sessionId] (id)');
  });
});

/**
 * **P18.98-T4, events, campaigns and the calendar, in Indonesian** — each screen's main state through axe with its
 * words in the reader's language: the agents' *Event List* and an event's modal, Settings › Events with *View feedback*
 * and the picker, the *Campaign List* and a campaign's dialog, Settings › Campaigns with its form, and the calendar's
 * week, month, phone agenda and dialogs. Longer Indonesian names must still name every control once.
 */
describe('P18.98-T4 events, campaigns and the calendar in Indonesian', () => {
  const shell = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  };
  const owner = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
      isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
    },
    permissions: [
      'member:read_profile', 'tenant_config:read', 'tenant_config:write', 'event_settings:read', 'event_attendance:confirm',
      'event_feedback:read', 'campaign_settings:read', 'notification:read_inbox',
    ],
  });
  const agent = (ui: React.ReactElement, me: ReturnType<typeof makeMe>) =>
    renderWithSession(<InLanguage language="id"><AgentLayout>{ui}</AgentLayout></InLanguage>, { me });
  const tenant = (ui: React.ReactElement) =>
    renderWithSession(<InLanguage language="id"><TenantLayout>{ui}</TenantLayout></InLanguage>, { me: owner });

  it('the Event List, and an event’s modal in each of its states', async () => {
    nav.pathname = '/events';
    stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList() } });
    const { unmount } = agent(<EventsLayout><EventsPage /></EventsLayout>, EVENTS_ME);
    await screen.findByRole('region', { name: 'Akan datang' });
    await expectClean('events (id)');
    unmount();
    for (const event of [EVENT_KICKOFF, EVENT_PRULINK, EVENT_TOWN_HALL, EVENT_BOOTCAMP]) {
      vi.unstubAllGlobals();
      nav.pathname = `/events/${event.id}`;
      stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList() }, [`GET /events/${event.id}`]: { body: event } });
      const view = agent(<EventsLayout><EventModalPage params={routeParams({ eventId: event.id })} /></EventsLayout>, EVENTS_ME);
      await screen.findByRole('dialog', { name: event.title });
      await expectClean(`events/[eventId] (${event.id}, id)`);
      view.unmount();
    }
  });

  it('Settings › Events: the list with the panel and the picker, and View feedback’s two tabs', async () => {
    const past = {
      id: 'ev-prulink', code: 'PRULINK', typeCode: 'TRAINING', title: 'PRULink briefing', blurb: '', description: '',
      startsAt: '2026-09-19T02:00:00.000Z', endsAt: '2026-09-19T04:00:00.000Z', startsOn: '2026-09-19', location: 'Jakarta',
      locationUrl: null, audience: { issuer: 'company', scope: 'select_agents', inviteeMembershipIds: ['mem-rina'] },
      phase: 'past', status: 'active', version: 1,
    };
    stubFetch({
      ...shell,
      '/kpm/settings/events/types': {
        body: [{ id: 't1', code: 'TRAINING', label: 'Training', description: null, emoji: '📚', color: '#2D9CDB', displayOrder: 1, status: 'active', events: 1 }],
      },
      '/kpm/settings/events': { body: [past] },
      'GET /kpm/settings/events/invitees': { body: { people: EVENT_INVITEES } },
      'GET /kpm/settings/events/ev-prulink/attendance': { body: eventRollCall() },
      'GET /kpm/settings/events/ev-prulink/feedback': { body: eventFeedbackSummary() },
    });
    nav.pathname = '/kpm/settings/events';
    tenant(<EventsSettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah' }));
    await screen.findByRole('searchbox', { name: 'Cari orang' });
    await expectClean('kpm/settings/events (picker, id)');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lihat masukan' }));
    await screen.findByRole('table');
    await expectClean('kpm/settings/events (Daftar hadir, id)');
    await userEvent.click(screen.getByRole('tab', { name: 'Ringkasan masukan' }));
    await screen.findByRole('heading', { name: 'PRULink briefing — Ringkasan masukan' });
    await expectClean('kpm/settings/events (Ringkasan masukan, id)');
  });

  it('the Campaign List, seasonal and structural, and a campaign’s dialog', async () => {
    nav.pathname = '/campaigns';
    stubFetch({ ...EVENTS_SHELL, 'GET /campaigns': { body: CAMPAIGN_LIST } });
    const { unmount } = agent(<CampaignsLayout><CampaignsPage /></CampaignsLayout>, CAMPAIGNS_RINA);
    await screen.findByRole('region', { name: 'Berjalan' });
    await expectClean('campaigns (seasonal, id)');
    await userEvent.click(screen.getByRole('tab', { name: 'Struktural' }));
    await screen.findByRole('region', { name: 'Kriteria promosi' });
    await expectClean('campaigns (structural, id)');
    unmount();
    vi.unstubAllGlobals();
    nav.pathname = '/campaigns/APE_SPRINT';
    stubFetch({ ...EVENTS_SHELL, 'GET /campaigns': { body: CAMPAIGN_LIST }, 'GET /campaigns/APE_SPRINT': { body: campaignDetail() } });
    agent(<CampaignsLayout><CampaignDialogPage params={routeParams({ campaignCode: 'APE_SPRINT' })} /></CampaignsLayout>, CAMPAIGNS_RINA);
    await screen.findByRole('dialog', { name: 'Q4 APE Sprint' });
    await expectClean('campaigns/[campaignCode] (id)');
  });

  it('Settings › Campaigns: the list, the form with a requirement row, and the carrier’s tiers', async () => {
    stubFetch({
      ...shell,
      '/kpm/settings/campaigns/rules': { body: [] },
      '/kpm/settings/campaigns': { body: [] },
      '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true, campaign: true }] },
    });
    nav.pathname = '/kpm/settings/campaigns';
    tenant(<CampaignsSettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah campaign' }));
    await userEvent.selectOptions(screen.getByLabelText('Jenis'), 'structural');
    await userEvent.click(screen.getByRole('button', { name: '+ Tambah syarat' }));
    await userEvent.selectOptions(screen.getByLabelText('Syarat 1'), 'APE_ACHIEVED');
    await screen.findByLabelText('Bagian');
    await expectClean('kpm/settings/campaigns (form, id)');
    await userEvent.click(screen.getByRole('link', { name: 'Production club tiers' }));
    await screen.findByText('Ini milik perusahaan asuransi Anda, bukan milik KPM Anda.');
    await expectClean('kpm/settings/campaigns (tiers, id)');
  });

  it('the calendar: the week with the compare popover, the month, a dialog, and a phone’s agenda', async () => {
    nav.pathname = '/calendar';
    const routes = {
      ...SHELL_STUBS,
      '/calendar/entries?view=week': { body: weekRead() },
      // UI V1 (UI-104): the phone's Agenda reads its own seven days.
      '/calendar/entries?view=agenda': { body: { ...weekRead(), view: 'agenda' } },
      '/calendar/entries?view=month': { body: monthRead() },
      '/calendar/settings': { body: { hideDetails: false } },
      '/calendar/downline': { body: DOWNLINE },
      '/calendar/people': { body: peoplePage() },
    };
    stubFetch(routes);
    const { unmount } = agent(<CalendarPage />, AGUS);
    await screen.findByRole('region', { name: 'Kalender, 28 Sep – 4 Okt 2026' });
    await userEvent.click(screen.getByRole('button', { name: '+ Bandingkan dengan downline' }));
    await screen.findByRole('group', { name: 'Unit langsung' });
    await expectClean('calendar (week, compare, id)');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: '+ Event baru' }));
    await screen.findByRole('dialog', { name: 'Event baru' });
    await expectClean('calendar (Event baru, id)');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByText('Sep 2026');
    await expectClean('calendar (month, id)');
    unmount();
    vi.unstubAllGlobals();
    atWidth(375);
    stubFetch(routes);
    agent(<CalendarPage />, AGUS);
    await screen.findByRole('heading', { level: 2, name: 'Senin, 28 Sep 2026 · Hari ini' });
    await userEvent.click(screen.getByRole('button', { name: /^Rapat internal: Weekly unit standup/ }));
    await screen.findByRole('dialog', { name: 'Weekly unit standup' });
    await expectClean('calendar (phone agenda, detail, id)');
  });
});

/**
 * **P18.98-T6: the Super Admin's company templates in ID mode, each in its main state** — axe in Indonesian, as the
 * blocks above run them in English (ADR-0179 §9): *Manage Companies*, a company's Company template on its tabs with its
 * picker's dialogs, and the *Org role ladder* (`admin-template*.ts(x)`). What a company typed is as typed; `lang` on
 * kept terms is T7's.
 */
describe('P18.98-T6 the company templates in Indonesian', () => {
  afterEach(() => {
    window.location.hash = '';
    vi.unstubAllGlobals();
  });

  const ROOT = makeMe({
    ...SUPER_ADMIN,
    permissions: [
      ...SUPER_ADMIN.permissions, 'company_template:read', 'company_template:write', 'recruitment_playbook:write',
      'product_catalog:crud', 'commission_rates:read', 'org_level:read', 'org_level:crud',
    ],
  });
  const inIndonesian = (path: string, page: React.ReactElement) => {
    nav.pathname = path;
    return renderWithSession(<InLanguage language="id"><AdminLayout>{page}</AdminLayout></InLanguage>, { me: ROOT });
  };
  const draft = (kind: string, payload: unknown, over: Record<string, unknown> = {}) => ({
    id: `tpl-${kind}`, companyId: 'c1', kind, version: 2, status: 'draft', publishedAt: null, publishedVersion: 1,
    officesBehind: 1, officesUnrecorded: 2, payload, ...over,
  });
  const TEMPLATES = [
    {
      id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active', archivedAt: null,
      origin: { kind: 'migration' }, officeCount: 3, publishedVersions: { activity_taxonomy: 1 },
      createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    },
    {
      id: 't-old', companyId: 'c1', name: 'Old settings', isDefault: false, status: 'archived',
      archivedAt: '2026-10-01T00:00:00.000Z', origin: { kind: 'empty' }, officeCount: 0, publishedVersions: {},
      createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    },
  ];
  const TAXONOMY = draft('activity_taxonomy', {
    categories: [{ code: 'SELLING', label: 'Penjualan', displayOrder: 1 }],
    types: [
      { code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi', description: null, displayOrder: 1 },
      { code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: 'Kirim SPAJ', displayOrder: 2 },
    ],
    bindings: { leads: [], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  });
  const template = (routes: Record<string, unknown> = {}, hash = '') => {
    window.location.hash = hash;
    stubFetch({
      '/admin/companies/c1/templates': { body: TEMPLATES },
      '/admin/companies/c1/template': { body: TAXONOMY },
      '/admin/companies': {
        body: [
          { _id: 'c1', name: 'Prudential', slug: 'prudential', status: 'active', kind: 'insurer' },
          { _id: 'c2', name: 'Allianz Life', slug: 'allianz-life', status: 'active', kind: 'insurer' },
        ],
      },
      '/admin/companies/c2/templates': { body: [{ ...TEMPLATES[0], id: 'a-1', companyId: 'c2', name: 'Allianz Life template' }] },
      ...routes,
    });
    return inIndonesian('/admin/companies/c1/template', <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />);
  };

  it('admin/companies: the list, a row being renamed, and Add a company', async () => {
    stubFetch({
      '/admin/companies': {
        body: [
          { ...COMPANY, usesPlatformDefaults: true, kind: 'insurer' },
          { ...COMPANY, _id: 'co-2', name: 'Sejahtera Baru Life', slug: 'sejahtera', status: 'suspended', usesPlatformDefaults: false, kind: 'insurer' },
          { ...COMPANY, _id: 'co-lib', name: 'Template', slug: 'template', usesPlatformDefaults: true, kind: 'template' },
        ],
      },
    });
    inIndonesian('/admin/companies', <CompaniesPage />);
    const table = await screen.findByRole('table', { name: 'Perusahaan' });
    await expectClean('admin/companies (id)');
    await userEvent.click(within(table).getAllByRole('button', { name: 'Ubah' })[0]);
    await expectClean('admin/companies (id, renaming)');
  });

  it('admin/companies/[companyId]/template: Activity types with its binding, a section being renamed', async () => {
    template();
    await screen.findByText('Kirim SPAJ');
    await screen.findByText(/^1 KPM menjalankan versi yang lebih lama\./);
    await expectClean('admin/companies/[companyId]/template (id)');
    const section = screen.getByRole('heading', { name: 'Penjualan' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(section).getAllByRole('button', { name: 'Ubah' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Ubah pengaitan' }));
    await expectClean('admin/companies/[companyId]/template (id, editing)');
  });

  it('admin/companies/[companyId]/template: the picker’s New template and Import from another company', async () => {
    template();
    await userEvent.click(await screen.findByRole('button', { name: 'Templat baru' }));
    await screen.findByRole('dialog', { name: 'Templat baru' });
    await expectClean('admin/companies/[companyId]/template (id, New template)');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Impor dari perusahaan lain' }));
    // The dialog's module is fetched on its first opening (P18.99-T16).
    const dialog = within(await screen.findByRole('dialog', { name: 'Impor dari perusahaan lain' }));
    await userEvent.selectOptions(await dialog.findByLabelText('Perusahaan'), 'c2');
    await dialog.findByLabelText('Templat');
    await expectClean('admin/companies/[companyId]/template (id, Import)');
  });

  it('admin/companies/[companyId]/template: the checklist, the carrier rules and the capability ladder', async () => {
    const { unmount } = template({
      '/admin/companies/c1/template/activation_checklist': {
        body: {
          ...draft('activation_checklist', {
            aspects: [{
              code: 'SETUP', label: 'Persiapan awal',
              items: [
                { code: 'GOAL', label: 'Mengatur goal', autoLink: 'feature:goals' },
                { code: 'LEADS', label: 'Menambah leads', autoLink: 'feature:leads' },
              ],
            }],
          }),
          linkKinds: {
            'feature:goals': { label: 'Goal Settings', route: '/goals', completesWhen: 'new hire menyimpan goal', live: true },
            'feature:leads': { label: 'Leads Management', route: '/leads', completesWhen: 'new hire menambah lead', live: false },
          },
        },
      },
      '/admin/companies/c1/template/training_taxonomy': { body: draft('training_taxonomy', { categories: [], skills: [], modules: [] }) },
    }, '#activation');
    await screen.findByText('2 item di 1 aspek');
    await expectClean('admin/companies/[companyId]/template#activation (id)');
    unmount();
    vi.unstubAllGlobals();

    const rules = template({
      '/admin/companies/c1/template/campaign_kinds': {
        body: draft('campaign_kinds', {
          rules: [{
            kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', rank: 1, reward: 'Bonus promosi', groupMode: 'all',
            criteriaGroups: [{ mode: 'all', criteria: [{ metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 120000000000 }] }],
          }],
        }),
      },
      '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true }] },
    }, '#campaign-tiers');
    await screen.findByText('Bonus promosi');
    await expectClean('admin/companies/[companyId]/template#campaign-tiers (id)');
    rules.unmount();
    vi.unstubAllGlobals();

    template({
      '/admin/companies/c1/template/capability_ladder': {
        body: draft('capability_ladder', {
          stages: [{ code: 'COMPETENT', label: 'Kompeten', requiredMilestoneCodes: ['SELLS'], stageOrder: 1 }],
          milestones: [{ code: 'SELLS', label: 'Menjual sendiri' }],
          grids: [],
        }),
      },
    }, '#capability-ladder');
    await screen.findByRole('group', { name: 'Dicapai dengan' });
    await expectClean('admin/companies/[companyId]/template#capability-ladder (id)');
  });

  it('admin/companies/[companyId]/template: Products with a product open, and Recruitment with a type open', async () => {
    const products = template({
      '/admin/companies/c1/products': {
        body: [{
          id: 'p1', companyId: 'c1', code: 'PRUMAPAN', name: 'PRUMapan', tagline: 'Proteksi jiwa dengan manfaat pensiun',
          channel: 'conventional', category: 'life', primaryNeeds: ['retirement'], eligibleAgeBands: [1],
          eligibleBudgetBands: [1, 7], benefits: ['Dana Mapan'], differentiator: 'Terjangkau.', bestFor: 'Profesional',
          defaultAttackPlan: {
            goodFit: 'Profesional', opening: 'Halo.', benefits: ['Dana Mapan'], fullScript: 'Halo.',
            objectionTheySay: 'Nanti saja.', objectionYouSay: 'Lebih ringan sekarang.', nextAction: 'Siapkan ilustrasi.',
          },
          commissionSchedule: [{ year: 1, rate: 0.125 }], lifecycle: 'active', replacedByProductId: null,
          activeByDefault: true, sortOrder: 1, version: 1,
        }],
      },
    }, '#products');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah' }));
    await screen.findByRole('table', { name: 'Persentase komisi' });
    await expectClean('admin/companies/[companyId]/template#products (id, a product open)');
    products.unmount();
    vi.unstubAllGlobals();

    const body = {
      profiles: {
        'fresh-grad': {
          label: 'Lulusan baru', tagline: 'Baru masuk dunia kerja.', goodFitFor: 'Pekerjaan pertama.',
          benefits: ['Tanpa pengalaman.'], openings: { 'side-income': 'Mau penghasilan tambahan?' },
        },
      },
      objections: { time: { theySay: 'Butuh berapa lama?', youSay: 'Yang diukur aktivitas.' } },
      profileObjections: {},
      nextAction: 'Kirimkan Opportunity Overview.',
    };
    template({
      '/admin/companies/c1/recruitment-playbook': {
        body: {
          playbook: { companyId: 'c1', version: 2, body, updatedAt: '2026-10-09T07:05:00.000Z', updatedBy: { name: 'Root' } },
          defaults: body,
          vocabulary: {
            types: [{ code: 'fresh-grad', label: 'Lulusan baru' }],
            motivations: [{ code: 'side-income', label: 'Penghasilan tambahan' }],
            hesitations: [{ code: 'time', label: 'Khawatir soal waktu' }],
          },
          limits: { textMax: 600, benefitsMax: 6 },
        },
      },
    }, '#recruitment');
    await screen.findByText('Playbook ini langsung berlaku.');
    await userEvent.click(within(screen.getByRole('group', { name: 'Lulusan baru' })).getByRole('button', { name: 'Ubah' }));
    await expectClean('admin/companies/[companyId]/template#recruitment (id, a type open)');
  });

  it('admin/org-levels: the ladder, its tiers and Add a rung', async () => {
    stubFetch({
      '/admin/org-levels': {
        body: [
          { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null, leaderTier: null },
          { orgLevelId: 'l2', companyId: 'co-1', code: 'AB', label: 'Agency Builder', displayOrder: 2, status: 'active', archivedAt: null, leaderTier: 'senior' },
          { orgLevelId: 'l3', companyId: 'co-1', code: 'OLD', label: 'Penasihat', displayOrder: 3, status: 'archived', archivedAt: null, leaderTier: null },
        ],
      },
      '/admin/companies': { body: [COMPANY] },
    });
    inIndonesian('/admin/org-levels', <OrgLevelsPage />);
    await screen.findByRole('table', { name: 'Susunan jenjang, dari yang paling junior' });
    await expectClean('admin/org-levels (id)');
  });
});

/**
 * **P18.98-T7 AC-1: every page in ID mode.** The cases above render every screen populated, and `expectClean` reads
 * each one in Indonesian for a message missing or English the glossary does not keep. These are the pages no case
 * rendered in Indonesian yet: the two that only send the reader on, shown while they do.
 * `every-page-in-indonesian.spec.ts` holds the list to every route.
 */
describe('P18.98-T7 the pages that only send the reader on, in Indonesian', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('/ while it finds where the reader belongs', async () => {
    renderWithSession(<InLanguage language="id"><Home /></InLanguage>, { me: null, loading: true });
    await expectClean('/ (id, the wait)');
  });

  it('coaching/[membershipId] while it opens the person on their session', async () => {
    renderWithSession(
      <InLanguage language="id"><CoachingPersonIndex params={routeParams({ membershipId: 'mem-rina' })} /></InLanguage>,
      { me: makeMe() },
    );
    await expectClean('coaching/[membershipId] (id, the wait)');
  });
});

/**
 * **UI V1's shared components** (Phase 18.99 T2; the report's *Shared components*), through axe in both languages
 * before the pages adopt them: one panel holding each, populated — the ratio card, the person rows and the tree, the
 * pills, the tiles, the action rows, the slider and the stepper, the save state, the ⚡, WhatsApp and Call, the agent
 * picker open, Boost's empty state — then the number sheet open over it.
 */
describe('UI V1 the shared components (Phase 18.99 T2)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const ratio = (code: string, label: string, over: Record<string, unknown> = {}) => ({
    code, label, comparison: 'gte', displayUnit: 'percent', benchmark: 0.3, tag: null, sides: null, numerator: [],
    denominator: [], purpose: null, divergesFromStandard: false, value: 0.27, share: null, numeratorCount: 3,
    denominatorCount: 11, status: 'alert', ...over,
  });
  const RATIOS = [
    ratio('SELLING_VS_RECRUITMENT', 'Selling vs Recruitment balance', {
      comparison: 'band', displayUnit: 'points', benchmark: 30, sides: { numerator: 'Selling', denominator: 'Recruitment' },
      value: 16, share: 58, status: 'success',
    }),
    ratio('SELLING_SUCCESS_RATE', 'Selling success rate'),
    ratio('LEADS_PER_ACTIVITY', 'Leads per activity', { displayUnit: 'decimal', benchmark: 1, value: 0.23 }),
    ratio('MEETING_PER_APPROACH', 'Set appointment to meeting', { benchmark: 0.5, value: null, status: 'neutral' }),
  ] as Parameters<typeof RatioCard>[0]['ratios'];

  function Panel() {
    return (
      <main>
        <h1>UI V1</h1>
        <RatioCard ratios={RATIOS} />
        <ul aria-label="Tim">
          <li>
            <PersonRow
              name="Agus Prasetyo"
              tone="self"
              href="/unit/dashboard"
              meta={<TonePill tone="blue">Anda</TonePill>}
              trailing={<TreeToggle name="Agus Prasetyo" open onToggle={() => {}} controls="tim-agus" />}
            />
            <TreeIndent id="tim-agus" label="Tim Agus Prasetyo">
              <TreeNode><PersonRow name="Indah Permatasari" href="/coaching/m-1/summary" meta={<ActivityPill count={3} />} /></TreeNode>
              <TreeNode><PersonRow name="Sari Puspita" tone="tinted" href="/unit/dashboard/m-2" meta={<ActivityPill count={0} onTint />} /></TreeNode>
            </TreeIndent>
          </li>
          <li><PersonRow name="Wilson Tanoto" tone="muted" meta="AB" /></li>
        </ul>
        <TonePill tone="amber">Perlu dipantau</TonePill>
        <StatTile label="Tim Anda" value="12" unit="agent" chips={[{ key: 'u', label: <><b>4</b> langsung</> }]} href="/unit/dashboard" />
        <StatTile label="Active Agent Oktober" value="4" unit="dari 12" ring={{ percent: 33 }} />
        <GoalHeroCard
          title="Target vs. realisasi (APE)"
          percent={31}
          achieved="Rp 29 jt"
          target="dari target Rp 94,7 jt"
          facts={[{ label: 'Sisa bulan ini', value: 'Rp 65,7 jt' }, { label: 'Polis yang dibutuhkan', value: '± 4 polis' }]}
        />
        <div className="divide-y divide-divider">
          <ActionRow date="2026-10-30" text="Ambil SPAJ yang sudah ditandatangani." person="Ibu Melati" control={{ kind: 'check', checked: false, onChange: () => {} }} />
          <ActionRow date="2026-11-02" onDateChange={() => {}} text="Telepon ulang" control={{ kind: 'remove', onRemove: () => {} }} />
          <ActionRow
            date="2026-11-03"
            text="Kirim brosur"
            auto={<AutoMarker name="Kirim brosur" explanation="Dari tindakan berikutnya di lead." />}
            control={{ kind: 'lead', name: 'Ibu Shinta', href: '/leads' }}
          />
        </div>
        <SliderWithValue label="Target APE tahunan" value={500} onChange={() => {}} min={0} max={2000} format={(v) => `Rp ${v} jt`} />
        <StepperRow label="Rasio penutupan" value={30} onChange={() => {}} />
        <SaveStateLabel state="unsaved" />
        <ContactButtons name="Ibu Melati" phone="0812-1100-2200" onSave={async (p) => p} />
        <ContactButtons name="Ibu Shinta" phone={null} onSave={async (p) => p} />
        <AgentSearch />
        <EmptyState title="Belum ada permintaan." boost="thinking" />
      </main>
    );
  }

  it.each(['en', 'id'] as const)('the panel, the agent picker open (%s)', async (language) => {
    stubFetch({ '/members/search': { body: { members: [
      { membershipId: 'm-1', fullName: 'Indah Permatasari', preferredName: null, agentCode: '80003', role: 'agent', orgLevelCode: 'AGENT' },
    ] } } });
    renderWithSession(<InLanguage language={language}><Panel /></InLanguage>, { me: makeMe() });
    await userEvent.click(screen.getByRole('combobox'));
    await screen.findByRole('option');
    await expectClean(language === 'id' ? 'UI V1 shared components (id)' : 'UI V1 shared components');
  });

  it.each(['en', 'id'] as const)('the number sheet open over it (%s)', async (language) => {
    renderWithSession(<InLanguage language={language}><Panel /></InLanguage>, { me: makeMe() });
    const ask = screen.getAllByRole('button', { name: language === 'id' ? /Kirim pesan WhatsApp ke Ibu Shinta/ : /WhatsApp message to Ibu Shinta/ })[0];
    await userEvent.click(ask);
    await screen.findByRole('dialog');
    await expectClean(language === 'id' ? 'UI V1 Isi nomor WhatsApp (id)' : 'UI V1 Isi nomor WhatsApp');
  });
});

/**
 * **UI V1's Group Tree and User Management** (Phase 18.99 T9): the states the rows, the sheets and the share block add,
 * through axe in both languages — the tree searched and a unit opened (UI-058, UI-059, UI-073), the role sheet with
 * *Keluarkan* (UI-083), the invite's QR sheet (UI-084), the empty Pending Requests with Boost (UI-089), and `/join` for
 * somebody already in an office (UI-086).
 */
describe('UI V1 Group Tree and User Management (Phase 18.99 T9)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const LEADER = makeMe({
    membership: {
      membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 2,
    },
    permissions: [
      'org_tree:read', 'member:read_profile', 'member:invite', 'member:search_untagged_pool', 'member:change_role',
      'member:remove_from_team', 'leader_request:read_inbox', 'leader_request:approve',
    ],
  });
  // The shell in the reader's language too, as `inIndonesian` above draws it.
  const render = (language: 'en' | 'id', ui: React.ReactElement) => (language === 'id'
    ? renderWithSession(<InLanguage language="id"><AgentLayout>{ui}</AgentLayout></InLanguage>, { me: LEADER })
    : renderInLayout(AgentLayout, ui, { me: LEADER }));
  const suffix = (language: 'en' | 'id', what: string) => (language === 'id' ? `${what} (id)` : what);

  it.each(['en', 'id'] as const)('UI-058, UI-059 the group tree as rows, searched, a unit opened (%s)', async (language) => {
    stubFetch({
      '/members/tree': {
        body: {
          nodes: [
            treeNode({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 1, isLeader: true,
                       directCount: 2, isSelf: true, todayActivityCount: 5 }),
            treeNode({ membershipId: 'mem-indah', fullName: 'Indah Permatasari', initials: 'IP', layer: 2, leaderId: 'mem-ab',
                       todayActivityCount: 3 }),
            treeNode({ membershipId: 'mem-sari', fullName: 'Sari Puspita', initials: 'SP', role: 'aab', layer: 2,
                       leaderId: 'mem-ab', isLeader: true, directCount: 1 }),
            treeNode({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW', layer: 3, leaderId: 'mem-sari' }),
          ],
          leader: { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab' },
          rootIds: ['mem-ab'], selfId: 'mem-ab', counts: { ab: 0, aab: 1, agent: 2, total: 3 },
        },
      },
    });
    render(language, <GroupTreePage />);
    await screen.findByTestId('group-tree-list');
    await userEvent.type(screen.getAllByRole('searchbox')[0], 'rina');
    await expectClean(suffix(language, 'group-tree (UI V1, searched)'));
  });

  const ADD_STUBS = {
    '/join/my-code': { body: { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' } },
    '/join/untagged': { body: [{ membershipId: 'mem-b', fullName: 'Budi Santoso', initials: 'BS', agentCode: '80002' }] },
    '/members/my-team': {
      body: [{ membershipId: 'mem-r', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '80001', role: 'agent', orgLevelCode: 'AGENT', directCount: 0, canChangeRole: true }],
    },
    '/join/requests/count': { body: { count: 2 } },
  };

  it.each(['en', 'id'] as const)('UI-083 the role sheet, Keluarkan last (%s)', async (language) => {
    stubFetch(ADD_STUBS);
    render(language, <AddAgentsPage />);
    const name = language === 'id' ? 'Ubah peran Rina Wijaya, sekarang Agent' : 'Change Rina Wijaya’s role, now Agent';
    await userEvent.click((await screen.findAllByRole('button', { name }))[0]);
    await screen.findByRole('dialog', { name: 'Rina Wijaya' });
    await expectClean(suffix(language, 'user-management/add (UI V1, role sheet)'));
  });

  it.each(['en', 'id'] as const)('UI-084 the invite’s QR sheet (%s)', async (language) => {
    stubFetch(ADD_STUBS);
    render(language, <AddAgentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: language === 'id' ? 'Tampilkan kode QR' : 'Show the QR code' }));
    await screen.findByRole('dialog');
    await expectClean(suffix(language, 'user-management/add (UI V1, QR sheet)'));
  });

  it.each(['en', 'id'] as const)('UI-089 Pending Requests with nothing waiting, Boost thinking (%s)', async (language) => {
    stubFetch({ '/join/requests/routing': { body: [] }, '/join/requests': { body: [] } });
    render(language, <PendingPage />);
    await screen.findByTestId('pending-empty');
    await expectClean(suffix(language, 'user-management/pending (UI V1, empty)'));
  });

  it.each(['en', 'id'] as const)('UI-086 /join for somebody already in an office: the message and the way back (%s)', async (language) => {
    nav.search = 'code=JOR417';
    stubFetch({
      '/join/invite': { body: { code: 'JOR417', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', leaderName: 'Wilson Tanoto' } },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    renderWithSession(language === 'id' ? <InLanguage language="id"><JoinPage /></InLanguage> : <JoinPage />, { me: LEADER });
    await screen.findByRole('link', { name: language === 'id' ? 'Kembali ke halaman kerja Anda' : 'Back to your work' });
    await expectClean(suffix(language, 'join (UI V1, already in an office)'));
    nav.search = '';
  });
});

/*
 * ── UI V1, Phase 18.99 T8: coaching ─────────────────────────────────────────────────────────────────────────────────
 * The coachee's new *Leads* tab, the *Activity* tab's Log, and the session's refused *Finalkan* with its outlined rows
 * and the *Isi nomor WhatsApp* sheet — in English and in Indonesian.
 */
describe('P18.99-T8 coaching (UI V1) has no axe violations', () => {
  afterEach(() => vi.unstubAllGlobals());

  const t8Leader = makeMe({
    membership: {
      membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 4,
    },
    permissions: [
      'coaching_session:read', 'coaching_session:create', 'coaching_session:edit', 'coaching_session:finalize',
      'lead:read', 'lead:update', 'lead:create', 'activity_log:read_raw', 'activity_ratios:read', 'personal_summary:read',
      'goal:read',
    ],
  });
  const t8Rina = {
    membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
    leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 }, today: '2026-10-02',
  };
  const t8Lead = (over: Record<string, unknown> = {}) => ({
    id: 'l-1', ownerMembershipId: 'mem-rina', type: 'sales', name: 'Desi Pratama', contact: { phone: null, email: null },
    statusCode: null, thisMonth: false, remarks: null, nextActionDate: '2026-10-05', nextActionNote: 'Confirm the SPAJ',
    outcome: null, source: null, dateRegistered: null, version: 1, flags: [], overdueDays: null, committedMonths: [], lastEditedBy: null,
    ...over,
  });
  const t8Leads = {
    body: {
      rows: [
        t8Lead(), t8Lead({ id: 'l-2', name: 'Ibu Shinta Maharani', nextActionDate: null, nextActionNote: null }),
        t8Lead({ id: 'l-3', name: 'Pak Gilang', type: 'recruitment', nextActionDate: null, nextActionNote: 'Second meeting' }),
      ],
      total: 3, page: 1, pageSize: 200,
    },
  };
  const t8Shell = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/notifications': { body: { items: [], unread: 0 } },
    'GET /coaching/coachees/mem-rina': { body: t8Rina },
  };
  const t8Render = (language: 'en' | 'id', tab: React.ReactElement) => {
    const page = <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}>{tab}</CoachingPersonLayout>;
    return language === 'id'
      ? renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me: t8Leader })
      : renderInLayout(AgentLayout, page, { me: t8Leader });
  };
  const named = (language: 'en' | 'id', what: string) => (language === 'id' ? `${what} (id)` : what);

  it.each(['en', 'id'] as const)('UI-029 the coachee’s Leads tab, read-only (%s)', async (language) => {
    stubFetch({ ...t8Shell, 'GET /leads?owner=mem-rina': t8Leads });
    t8Render(language, <CoacheeLeadsTabPage />);
    await screen.findByRole('button', { name: 'Desi Pratama' });
    await expectClean(named(language, 'coaching/[membershipId]/leads (UI V1)'));
  });

  it.each(['en', 'id'] as const)('UI-029 the Activity tab’s Log, the coachee’s day (%s)', async (language) => {
    stubFetch({
      ...t8Shell,
      '/activity/dashboard': { body: { range: 'ROLLING_7D', from: '2026-09-26', to: '2026-10-02', days: 7, today: '2026-10-02', buckets: [], sections: [], counts: [], total: 0, daysLogged: 0, correctedDays: 0 } },
      '/activity/log': {
        body: {
          membershipId: 'mem-rina', localDate: '2026-10-02', totalCount: 3, version: 1, frozenAt: null, editable: false, correctionCount: 0,
          entries: [{ activityTypeId: 't1', activityTypeCode: 'LEADS_CONTACTED', label: 'Set appointment', count: 3 }],
        },
      },
    });
    t8Render(language, <CoacheeActivityTab />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Log Activity' }));
    await screen.findByText('Set appointment');
    await expectClean(named(language, 'coaching/[membershipId]/activity (UI V1, Log)'));
  });

  it.each(['en', 'id'] as const)('UI-060 a refused Finalkan: the count above the button, the rows outlined; UI-081 the number sheet (%s)', async (language) => {
    Element.prototype.scrollIntoView = vi.fn();
    const draftSession = {
      sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: { membershipId: 'mem-agus', name: 'Agus Santoso' },
      status: 'draft', version: 1, date: null, startedAt: '2026-10-02T02:00:00.000Z', finalizedAt: null, finalizedBy: null,
      reopenableUntil: null, defaultDueDate: '2026-10-09', lastWeek: null, lastWeekItems: [], tips: [],
      leadActions: [{ leadId: 'l-1', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: 'Confirm the SPAJ' }],
      actionItems: [{ itemId: 'a-1', text: 'Run the comparison', dueDate: null }],
      snapshot: null, earlier: [],
    };
    stubFetch({
      ...t8Shell,
      'GET /coaching/coachees/mem-rina/sessions': { body: { today: '2026-10-02', current: { sessionId: 's-1', status: 'draft' }, sessions: [] } },
      'GET /coaching/sessions/s-1': { body: draftSession },
      '/summary?for=mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r' } } },
      '/activity/ratios?for=mem-rina': { body: { membershipId: 'mem-rina', from: '2026-09-03', to: '2026-10-02', days: 30, ratios: [] } },
      '/activity/summary?': { body: { from: '2026-09-26', to: '2026-10-02', totals: [], daysLogged: 0, totalCount: 0, targets: [], sections: [] } },
      'GET /leads?owner=mem-rina': t8Leads,
      'POST /coaching/sessions/s-1/finalize': {
        status: 422,
        body: { error: { code: 'COACHING_SESSION_INCOMPLETE', message: 'x', requestId: 'r', details: { rule: 'UNDATED_ACTION_ITEM', count: 1, itemIds: ['a-1'] } } },
      },
    });
    t8Render(language, <CoachingSessionTabPage />);
    const finalize = await screen.findByRole('button', { name: language === 'id' ? 'Finalkan sesi ini' : 'Finalize this session' });
    await screen.findByRole('button', { name: 'Desi Pratama' });
    await userEvent.click(finalize);
    await waitFor(() => expect(document.querySelector('[data-finalize-refusal]')).not.toBeNull());
    await expectClean(named(language, 'coaching/[membershipId]/session (UI V1, a refused Finalkan)'));
    await userEvent.click(screen.getByRole('button', { name: language === 'id' ? 'Kirim pesan WhatsApp ke Desi Pratama' : 'Send a WhatsApp message to Desi Pratama' }));
    await screen.findByRole('dialog');
    await expectClean(named(language, 'coaching/[membershipId]/session (UI V1, Isi nomor WhatsApp)'));
  });
});

/*
 * ── UI V1, Phase 18.99 T13: Sales, Recruitment, Campaign and Event on a phone ─────────────────────────────────────────
 */

/**
 * **UI V1's selling and programme pages on a phone** (Phase 18.99 T13; UI-107, UI-108), through axe in both languages at
 * 375px: the Sales Attack Plan's brief and plan, the Product Catalog's rows, the Recruitment plan, Pitch Materials'
 * rows, the campaign cards and the event cards with *Ikut* / *Tidak ikut*. From 768px each page is the one the blocks
 * above already run.
 */
describe('P18.99-T13 selling and programmes on a phone (UI V1) have no axe violations', () => {
  const SHELL = {
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
  };
  const named = (language: 'en' | 'id', name: string) => (language === 'id' ? `${name} (id)` : name);
  const page = (language: 'en' | 'id', ui: React.ReactElement, me: ReturnType<typeof makeMe>) =>
    renderWithSession(
      language === 'id' ? <InLanguage language="id"><AgentLayout>{ui}</AgentLayout></InLanguage> : <AgentLayout>{ui}</AgentLayout>,
      { me },
    );
  const pdf = (name: string) => ({ name, bytes: 2048, uploadedOn: '2026-10-01' });
  const slot = (code: string, title: string, required: boolean, file: string | null) => ({
    slot: code, title, line: `${title}'s line`, required, state: file ? 'uploaded' : 'missing',
    file: file ? pdf(file) : null, checklist: [], version: file ? 1 : 0,
  });
  const PITCH_VIEW = {
    slots: [
      slot('opportunity', 'Opportunity Overview', true, 'Opportunity_Overview_v3.pdf'),
      slot('proof', 'Proof & Credibility', true, 'Proof_and_Credibility_2026.pdf'),
      slot('faq', 'FAQ', true, null), slot('howtojoin', 'How to Join', true, null),
      slot('company', 'Company Profile', false, 'Company_Profile_2026.pdf'), slot('agency', 'Agency Profile', false, null),
    ],
    summary: { done: 2, total: 4, missing: 2, unconfirmed: 0 },
  };

  beforeEach(() => atWidth(375));
  afterEach(() => vi.unstubAllGlobals());

  it.each(['en', 'id'] as const)('the Sales Attack Plan on a phone: the brief, then the plan (%s)', async (language) => {
    nav.pathname = '/attack-plan';
    nav.search = '';
    stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /attack-plan': { body: salesPlan() } });
    const brief = page(language, <AttackPlanPage />, SALES_ME);
    await screen.findByRole('group', { name: language === 'id' ? 'Kebutuhan utama' : 'Primary need' });
    await expectClean(named(language, 'attack-plan (UI V1, phone brief)'));
    brief.unmount();
    nav.search = 'need=retirement&age=2&budget=2';
    page(language, <AttackPlanPage />, SALES_ME);
    await screen.findByRole('heading', { level: 2, name: 'PRUMapan' });
    await waitFor(() => expect(document.querySelector('[data-layout="phone-plan"]')).not.toBeNull());
    await expectClean(named(language, 'attack-plan (UI V1, phone plan)'));
    nav.search = '';
  });

  it.each(['en', 'id'] as const)('the Product Catalog on a phone: compact rows (%s)', async (language) => {
    nav.pathname = '/product-catalog';
    stubFetch({ ...SHELL, 'GET /product-catalog': { body: { products: SHELF } } });
    page(language, <ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout>, SALES_ME);
    await waitFor(() => expect(document.querySelector('[data-phone-section]')).not.toBeNull());
    await expectClean(named(language, 'product-catalog (UI V1, phone)'));
  });

  it.each(['en', 'id'] as const)('the Recruitment plan and Pitch Materials on a phone (%s)', async (language) => {
    nav.pathname = '/recruitment/attack-plan';
    nav.search = new URLSearchParams(RECRUITMENT_BRIEF).toString();
    stubFetch({ ...SHELL, 'GET /recruitment/attack-plan': { body: recruitmentView(recruitmentPlan()) } });
    const plan = page(language, <RecruitmentLayout><RecruitmentAttackPlanPage /></RecruitmentLayout>, RECRUITMENT_ME);
    await waitFor(() => expect(document.querySelector('[data-layout="phone-plan"]')).not.toBeNull());
    await expectClean(named(language, 'recruitment/attack-plan (UI V1, phone plan)'));
    plan.unmount();
    nav.search = '';
    nav.pathname = '/recruitment/pitch-materials';
    stubFetch({ ...SHELL, 'GET /recruitment/pitch-materials': { body: PITCH_VIEW } });
    page(language, <RecruitmentLayout><PitchMaterialsPage /></RecruitmentLayout>, RECRUITMENT_ME);
    await waitFor(() => expect(document.querySelector('[data-layout="phone-pitch"]')).not.toBeNull());
    await expectClean(named(language, 'recruitment/pitch-materials (UI V1, phone)'));
  });

  it.each(['en', 'id'] as const)('the campaigns and the events on a phone (%s)', async (language) => {
    nav.pathname = '/campaigns';
    stubFetch({ ...SHELL, 'GET /campaigns': { body: CAMPAIGN_LIST } });
    const campaigns = page(language, <CampaignsLayout><CampaignsPage /></CampaignsLayout>, CAMPAIGNS_RINA);
    await waitFor(() => expect(document.querySelector('[data-campaign-card] [data-chase]')).not.toBeNull());
    await expectClean(named(language, 'campaigns (UI V1, phone)'));
    campaigns.unmount();
    vi.unstubAllGlobals();
    atWidth(375);
    nav.pathname = '/events';
    stubFetch({ ...EVENTS_SHELL, 'GET /events': { body: eventsList() } });
    page(language, <EventsLayout><EventsPage /></EventsLayout>, EVENTS_ME);
    await waitFor(() => expect(document.querySelector('[data-group="upcoming"]')).not.toBeNull());
    await expectClean(named(language, 'events (UI V1, phone)'));
  });
});

/*
 * UI V1, Phase 18.99 T14 (UI-109, UI-110, UI-111): Profil saya with its sheets, KPM Analytics' Overview and Compliance
 * and the Strategic Leader Forum's list and meeting on a phone in the field shell, in both languages. The screens and
 * their fixtures are imported here, inside the block, so the file's head stays as it is for the tasks beside this one.
 */
describe('UI V1 T14 KPM Analytics, the Leader Forum and Profil saya through axe', () => {
  const named = (language: 'en' | 'id', what: string) => (language === 'id' ? `${what} (id)` : what);
  const render = (language: 'en' | 'id', ui: React.ReactElement, me: ReturnType<typeof makeMe>) =>
    renderWithSession(language === 'id' ? <InLanguage language="id">{ui}</InLanguage> : ui, { me });

  it.each(['en', 'id'] as const)('UI-111 Profil saya, its photo sheet and its language sheet (%s)', async (language) => {
    const { default: Profile } = await import('./profile/page');
    nav.pathname = '/profile';
    atWidth(375);
    stubFetch({
      '/auth/me/profile': { body: { companyName: 'Prudential Indonesia', agentCode: '70012345', leader: { name: 'Wilson Tanoto', orgLevelCode: 'AB' }, group: { people: 11, ab: 0, aab: 3, agents: 8 } } },
      '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
      '/auth/sessions': { body: [] },
      '/calendar/settings': { body: { hideDetails: false } },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    render(language, <Profile />, makeMe({
      user: { ...makeMe().user, fullName: 'Agus Prasetyo', dateOfBirth: '1995-03-18', gender: 'male', companyJoinMonth: '2020-09', workStatus: 'full_time' },
      membership: {
        membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: false, isKpmAdmin: false,
        status: 'active', directCount: 4, isCoreLeader: true, groups: ['Marvelous'], office: { code: '0417', branch: 'BSD City Branch' },
      },
      permissions: ['profile:read_self', 'calendar_entry:read', 'calendar_entry:update'],
    }));
    await screen.findByText(language === 'id' ? '11 orang · 3 AAB · 8 Agent' : '11 people · 3 AAB · 8 Agents');
    await expectClean(named(language, 'profile (UI V1)'));
    await userEvent.click(screen.getByRole('button', { name: language === 'id' ? 'Ubah foto profil Anda' : 'Change your profile photo' }));
    await screen.findByRole('dialog');
    await expectClean(named(language, 'profile (UI V1, Foto profil)'));
  });

  it.each(['en', 'id'] as const)('UI-109 KPM Analytics Overview and Compliance on a phone (%s)', async (language) => {
    const { default: Layout } = await import('./kpm/analytics/layout');
    const { default: Overview } = await import('./kpm/analytics/page');
    const { default: Compliance } = await import('./kpm/analytics/compliance/page');
    const analytics = await import('@test/kpm-analytics-fixtures');
    const compliance = await import('@test/kpm-compliance-fixtures');
    atWidth(375);
    nav.pathname = '/kpm/analytics';
    nav.search = '';
    stubFetch({ ...analytics.SHELL_STUBS, 'GET /kpm/analytics/compliance': { body: compliance.complianceView('training') }, 'GET /kpm/analytics': { body: analytics.analyticsView() } });
    const { unmount } = render(language, <Layout><Overview /></Layout>, analytics.CORE_LEADER_ME);
    await waitFor(() => expect(document.querySelector('[data-v1-overview]')).not.toBeNull());
    await expectClean(named(language, 'kpm/analytics (UI V1, phone)'));
    unmount();
    nav.pathname = '/kpm/analytics/compliance';
    render(language, <Layout><Compliance /></Layout>, analytics.CORE_LEADER_ME);
    await waitFor(() => expect(document.querySelector('[data-v1-section]')).not.toBeNull());
    await expectClean(named(language, 'kpm/analytics/compliance (UI V1, phone)'));
  });

  it.each(['en', 'id'] as const)('UI-110 the forum’s list and a meeting’s three tabs on a phone (%s)', async (language) => {
    const { default: List } = await import('./leader-meetings/page');
    const { default: Meeting } = await import('./leader-meetings/[meetingId]/page');
    const forum = await import('./leader-meetings/forum-fixtures');
    atWidth(375);
    nav.pathname = '/leader-meetings';
    const meeting = forum.meetingView({ can: forum.CORE_LEADER_CAN });
    stubFetch({ ...forum.SHELL_STUBS, 'GET /leader-meetings/m-14': { body: meeting }, 'GET /leader-meetings': { body: forum.listView() } });
    const { unmount } = render(language, <List />, forum.CORE_LEADER_ME);
    await waitFor(() => expect(document.querySelector('[data-v1-forum-list]')).not.toBeNull());
    await expectClean(named(language, 'leader-meetings (UI V1, phone)'));
    unmount();
    nav.pathname = '/leader-meetings/m-14';
    render(language, <Meeting params={routeParams({ meetingId: 'm-14' })} />, forum.CORE_LEADER_ME);
    await waitFor(() => expect(document.querySelector('[data-v1-overview-meeting]')).not.toBeNull());
    await expectClean(named(language, 'leader-meetings/[meetingId] (UI V1, Overview)'));
    await userEvent.click(screen.getByRole('tab', { name: 'Agenda' }));
    await expectClean(named(language, 'leader-meetings/[meetingId] (UI V1, Agenda)'));
    await userEvent.click(screen.getByRole('tab', { name: 'Action Items' }));
    await expectClean(named(language, 'leader-meetings/[meetingId] (UI V1, Action Items)'));
  });
});

/**
 * **Home and the sign-in through axe** (Phase 18.99 T11; UI-100, UI-101, UI-102): a leader's Home in the field shell on a
 * phone (the title row's bell, the tiles, *Aksi hari ini*, *Laporan tim* opened to *Group*, the chart) and on a desktop,
 * the *Isi nomor WhatsApp* sheet from the team list, an agent's Home with nothing in seven days (Boost sleeping), in
 * both languages; the sign-in's welcome is the `login` case above.
 */
describe('UI V1 T11 Home through axe', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const named = (language: 'en' | 'id', what: string) => (language === 'id' ? `${what} (id)` : what);

  it.each(['en', 'id'] as const)('UI-100, UI-101 a leader’s Home on a phone and a desktop, and the number sheet (%s)', async (language) => {
    const { default: HomePage } = await import('./(agent)/home/page');
    const home = await import('@test/home-fixtures');
    nav.pathname = '/home';
    for (const width of [375, 1280]) {
      atWidth(width);
      stubFetch({ '/home': { body: home.LEADER }, '/notifications': { body: { items: [], unread: 0 } } });
      const ui = <AgentLayout><HomePage /></AgentLayout>;
      const { unmount } = renderWithSession(language === 'id' ? <InLanguage language="id">{ui}</InLanguage> : ui, { me: home.AGUS });
      await waitFor(() => expect(document.querySelector('[data-home-team]')).not.toBeNull());
      await userEvent.click(screen.getByRole('button', { name: 'Group' }));
      await expectClean(named(language, `home (UI V1, leader, ${width})`));
      if (width === 375) {
        const lukman = [...document.querySelectorAll('[data-home-team] [data-person-row]')]
          .find((row) => row.textContent!.includes('Lukman Hakim')) as HTMLElement;
        await userEvent.click(within(lukman).getByRole('button', { name: /WhatsApp/ }));
        await screen.findByRole('dialog');
        await expectClean(named(language, 'home (UI V1, Isi nomor WhatsApp)'));
      }
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it.each(['en', 'id'] as const)('UI-100, UI-102 an agent’s Home with nothing in seven days (%s)', async (language) => {
    const { default: HomePage } = await import('./(agent)/home/page');
    const home = await import('@test/home-fixtures');
    nav.pathname = '/home';
    atWidth(375);
    stubFetch({
      '/home': { body: { ...home.AGENT_VIEW, activity: { today: 0, yesterday: 0, total: 0, days: home.LEADER.activity.days.map((d) => ({ ...d, count: 0 })) } } },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    const ui = <AgentLayout><HomePage /></AgentLayout>;
    renderWithSession(language === 'id' ? <InLanguage language="id">{ui}</InLanguage> : ui, { me: home.AGUS });
    await waitFor(() => expect(document.querySelector('[data-home-chart] [data-boost]')).not.toBeNull());
    await expectClean(named(language, 'home (UI V1, agent, nothing logged)'));
  });

  it.each(['en', 'id'] as const)('UI-104 the Calendar: the Agenda’s Tugas and the popup, 3 Hari, the Week’s Tugas row and the 1:1’s coaching button (%s)', async (language) => {
    const tasks = [coachingTask(), leadTask()];
    const oneToOne = entry({
      entryId: 'e-11', type: 'coaching', title: '1:1 coaching — Indah',
      invitees: [{ membershipId: 'mem-indah', name: 'Indah Permata', placed: false, answer: 'accepted', readerCoaches: true }],
    });
    const coach = { ...AGUS, permissions: [...AGUS.permissions, 'coaching_session:create'] };
    nav.pathname = '/calendar';
    for (const width of [375, 1280]) {
      atWidth(width);
      stubFetch({
        ...SHELL_STUBS,
        '/calendar/entries?view=agenda': { body: agendaRead({ tasks, events: [joinedEvent()] }) },
        '/calendar/entries?view=week': { body: weekRead({ tasks, entries: [...weekRead().entries, oneToOne], events: [joinedEvent()] }) },
        '/calendar/entries?view=three_days': { body: threeDayRead({ tasks, events: [joinedEvent()] }) },
      });
      const ui = <AgentLayout><CalendarPage /></AgentLayout>;
      const { unmount } = renderWithSession(language === 'id' ? <InLanguage language="id">{ui}</InLanguage> : ui, { me: coach });
      const range = language === 'id' ? 'Kalender, 28 Sep – 4 Okt 2026' : 'Calendar, 28 Sep – 4 Oct 2026';
      await screen.findAllByRole('region', { name: range });
      await expectClean(named(language, `calendar (UI V1, ${width === 375 ? 'Agenda with Tugas' : 'Week with the Tugas row'})`));
      const pill = language === 'id' ? 'Tugas pada Sen, 28 Sep: 2' : 'Tasks on Mon, 28 Sep: 2';
      if (width === 1280) {
        await userEvent.click(screen.getByRole('button', { name: pill }));
        await screen.findByRole('dialog');
        await expectClean(named(language, 'calendar (UI V1, Tugas popup)'));
        await userEvent.keyboard('{Escape}');
        await userEvent.click(screen.getByRole('button', { name: /^(1:1 coaching|Coaching 1:1): 1:1 coaching — Indah/ }));
        await screen.findByRole('link', { name: language === 'id' ? 'Mulai sesi coaching' : 'Start coaching session' });
        await expectClean(named(language, 'calendar (UI V1, 1:1 with Start coaching session)'));
        await userEvent.keyboard('{Escape}');
      } else {
        await userEvent.selectOptions(screen.getByRole('combobox', { name: language === 'id' ? 'Tampilan' : 'View' }), 'three_days');
        await waitFor(() => expect(document.querySelector('[data-three-days]')).not.toBeNull());
        await expectClean(named(language, 'calendar (UI V1, 3 Hari)'));
      }
      unmount();
      vi.unstubAllGlobals();
    }
  });
});

/*
 * UI V1, Phase 18.99 T16 (UI-111, ADR-0181): Profil saya's email as a field — its hint, the password sheet a changed
 * email opens and the line once the link is sent — and `/verify-email-change/[token]`, the page that link opens, in both
 * languages. Imported inside the block, as T14's are, so the file's head stays as it is.
 */
describe('UI V1 T16 the email change through axe', () => {
  const named = (language: 'en' | 'id', what: string) => (language === 'id' ? `${what} (id)` : what);
  const render = (language: 'en' | 'id', ui: React.ReactElement, me: ReturnType<typeof makeMe> | null) =>
    renderWithSession(language === 'id' ? <InLanguage language="id">{ui}</InLanguage> : ui, { me });

  it.each(['en', 'id'] as const)('UI-111 the email field, its password sheet and the line once the link is sent (%s)', async (language) => {
    const { default: Profile } = await import('./profile/page');
    nav.pathname = '/profile';
    atWidth(375);
    stubFetch({
      '/auth/me/profile': { body: { companyName: 'Prudential Indonesia', agentCode: '70012345', leader: null, group: null } },
      '/auth/sessions': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
      'POST /auth/me/email': { status: 202, body: { status: 'accepted' } },
    });
    render(language, <Profile />, makeMe({
      user: { ...makeMe().user, fullName: 'Indah Permatasari', email: 'indah@kpm0417.test', workStatus: 'full_time', gender: 'female' },
      permissions: ['profile:read_self'],
    }));
    const field = screen.getByLabelText('Email');
    await userEvent.clear(field);
    await userEvent.type(field, 'indah.baru@kpm0417.test');
    await userEvent.click(within(document.querySelector('[data-floating-save]') as HTMLElement)
      .getByRole('button', { name: language === 'id' ? 'Simpan' : 'Save' }));
    const sheet = await screen.findByRole('dialog', { name: language === 'id' ? 'Ubah email' : 'Change email' });
    await expectClean(named(language, 'profile (UI V1, Ubah email)'));
    await userEvent.type(within(sheet).getByLabelText(language === 'id' ? 'Kata sandi saat ini' : 'Current password'), 'pw-1');
    await userEvent.click(within(sheet).getByRole('button', { name: language === 'id' ? 'Kirim tautan' : 'Send link' }));
    await screen.findByText(/indah\.baru@kpm0417\.test\./);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expectClean(named(language, 'profile (UI V1, the link sent)'));
  });

  it.each(['en', 'id'] as const)('UI-111 /verify-email-change/[token], changed and refused (%s)', async (language) => {
    const { default: VerifyEmailChange } = await import('./(auth)/verify-email-change/[token]/page');
    nav.pathname = '/verify-email-change/t';
    stubFetch({ '/auth/verify-email-change': { body: { status: 'changed', email: 'indah.baru@kpm0417.test' } } });
    const { unmount } = render(language, <VerifyEmailChange params={routeParams({ token: 't' })} />, null);
    await screen.findByText(/indah\.baru@kpm0417\.test\./);
    await expectClean(named(language, 'verify-email-change'));
    unmount();
    vi.unstubAllGlobals();

    stubFetch({
      '/auth/verify-email-change': {
        status: 400, body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'That link is no longer valid. Request a new one.', requestId: 'r' } },
      },
    });
    render(language, <VerifyEmailChange params={routeParams({ token: 'old' })} />, null);
    await screen.findByRole('alert');
    await expectClean(named(language, 'verify-email-change (refused)'));
  });
});
