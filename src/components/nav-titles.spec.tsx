import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams } from '@test/harness';
import { LEARNER, progressView, SALES } from '@test/training-fixtures';
import AdminAnalyticsPage from '@/app/(admin)/admin/analytics/page';
import AuditPage from '@/app/(admin)/admin/audit/page';
import BillingPage from '@/app/(admin)/admin/billing/page';
import CompaniesPage from '@/app/(admin)/admin/companies/page';
import KpmRequestsPage from '@/app/(admin)/admin/kpm-requests/page';
import LeaderLimitRequestsPage from '@/app/(admin)/admin/leader-limit-requests/page';
import OrgLevelsPage from '@/app/(admin)/admin/org-levels/page';
import PlatformOverviewPage from '@/app/(admin)/admin/page';
import TenantAdminsPage from '@/app/(admin)/admin/tenant-admins/page';
import AllKpmsPage from '@/app/(admin)/admin/tenants/page';
import ActivationPage from '@/app/(agent)/activation/page';
import LogActivityPage from '@/app/(agent)/activity/log/page';
import AttackPlanPage from '@/app/(agent)/attack-plan/page';
import CalendarPage from '@/app/(agent)/calendar/page';
import CampaignsLayout from '@/app/(agent)/campaigns/layout';
import CampaignsPage from '@/app/(agent)/campaigns/page';
import CoachingPage from '@/app/(agent)/coaching/page';
import EventsLayout from '@/app/(agent)/events/layout';
import EventsPage from '@/app/(agent)/events/page';
import GoalsPage from '@/app/(agent)/goals/page';
import GroupTreePage from '@/app/(agent)/group-tree/page';
import LeadsPage from '@/app/(agent)/leads/page';
import NewHiresPage from '@/app/(agent)/new-hires/page';
import RecruitmentAttackPlanPage from '@/app/(agent)/recruitment/attack-plan/page';
import RecruitmentLayout from '@/app/(agent)/recruitment/layout';
import SummaryPage from '@/app/(agent)/summary/page';
import TrainingCategoryPage from '@/app/(agent)/training/[categoryCode]/page';
import TrainingLayout from '@/app/(agent)/training/layout';
import UnitDashboardPage from '@/app/(agent)/unit/dashboard/page';
import RegisterKpmPage from '@/app/(agent)/user-management/kpm/page';
import DataUploadPage from '@/app/(tenant)/kpm/data-upload/page';
import KpmOverviewPage from '@/app/(tenant)/kpm/overview/page';
import ActivationChecklistPage from '@/app/(tenant)/kpm/settings/activation-checklist/page';
import ActivityTypesPage from '@/app/(tenant)/kpm/settings/activity-types/page';
import BranchInfoPage from '@/app/(tenant)/kpm/settings/branch-info/page';
import CampaignSettingsPage from '@/app/(tenant)/kpm/settings/campaigns/page';
import CapabilityMappingPage from '@/app/(tenant)/kpm/settings/capability-mapping/page';
import EventSettingsPage from '@/app/(tenant)/kpm/settings/events/page';
import LeadStatusesPage from '@/app/(tenant)/kpm/settings/lead-statuses/page';
import ProductsPage from '@/app/(tenant)/kpm/settings/products/page';
import RecruitmentPitchPage from '@/app/(tenant)/kpm/settings/recruitment-pitch/page';
import TrainingSettingsPage from '@/app/(tenant)/kpm/settings/training/page';
import KpmAdminsPage from '@/app/(tenant)/people/admins/page';
import ImportPeoplePage from '@/app/(tenant)/people/import/page';
import MembersPage from '@/app/(tenant)/people/members/page';
import OrgTreePage from '@/app/(tenant)/people/org-tree/page';
import KpmAnalyticsLayout from '@/app/kpm/analytics/layout';
import KpmAnalyticsPage from '@/app/kpm/analytics/page';
import LeaderMeetingsPage from '@/app/leader-meetings/page';
import { AdminShell } from './admin-shell';
import { AgentShell } from './agent-shell';
import { TenantShell } from './tenant-shell';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

/*
 * **Every screen let in**: who may open a page is RequireSession's to decide and its own specs' to pin. This one asks
 * a single thing of each page the nav opens — what it is titled — so the gate stands aside and every shell offers its
 * whole nav.
 */
vi.mock('@/components/require-session', async (original) => ({
  ...(await original<typeof import('@/components/require-session')>()),
  RequireSession: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * **P18.95-T9 AC-2: each menu label is its page's title** (ADR-0167 §10, OD-205; the client's UI review, UI-027:
 * *menu "Training modules" vs page "Sales Training"; menu "User management" vs page "Register KPM"*).
 *
 * Table-driven over the three shells' nav as they draw it: every item with an address must have a row here, and the
 * page that address opens must be titled with the item's words. **Case is each place's own** — the nav in sentence
 * case and a page's heading in title case, as every prototype draws them (*Leads management* over *Leads
 * Management*) — so the words are compared, not the capitals.
 */
const FIELD = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2, isCoreLeader: true,
  },
  permissions: [],
  // Leads somebody, in their own activation, with hires of their own, and a Core Leader: every item is offered.
  activation: { open: true, complete: false },
  newHires: true,
});
const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: [],
});
const ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: [],
});

/** What a page needs to put its title up: nothing for most, which title it before their reads answer. */
type Screen = { ui: () => ReactNode; me: typeof FIELD; ready?: Record<string, unknown> };

const PAGES: Record<string, Screen> = {
  // The field shell's.
  '/activity/log': { ui: () => <LogActivityPage />, me: FIELD },
  '/leads': { ui: () => <LeadsPage />, me: FIELD },
  '/goals': { ui: () => <GoalsPage />, me: FIELD },
  '/summary': { ui: () => <SummaryPage />, me: FIELD },
  '/calendar': { ui: () => <CalendarPage />, me: FIELD },
  '/unit/dashboard': { ui: () => <UnitDashboardPage />, me: FIELD },
  '/coaching': { ui: () => <CoachingPage />, me: FIELD },
  '/activation': { ui: () => <ActivationPage />, me: FIELD },
  '/new-hires': { ui: () => <NewHiresPage />, me: FIELD },
  // `/training` opens the office's first category; that page is titled once the catalog has answered.
  '/training': {
    ui: () => <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></TrainingLayout>,
    me: LEARNER,
    ready: { '/training/progress': { body: progressView([SALES]) } },
  },
  '/attack-plan': { ui: () => <AttackPlanPage />, me: FIELD },
  '/recruitment/attack-plan': { ui: () => <RecruitmentLayout><RecruitmentAttackPlanPage /></RecruitmentLayout>, me: FIELD },
  '/events': { ui: () => <EventsLayout><EventsPage /></EventsLayout>, me: FIELD },
  '/campaigns': { ui: () => <CampaignsLayout><CampaignsPage /></CampaignsLayout>, me: FIELD },
  '/leader-meetings': { ui: () => <LeaderMeetingsPage />, me: FIELD },
  '/kpm/analytics': { ui: () => <KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, me: OWNER },
  '/group-tree': { ui: () => <GroupTreePage />, me: FIELD },
  '/user-management/kpm': { ui: () => <RegisterKpmPage />, me: FIELD },
  // The office console's.
  '/kpm/overview': { ui: () => <KpmOverviewPage />, me: OWNER },
  '/kpm/data-upload': { ui: () => <DataUploadPage />, me: OWNER },
  '/kpm/settings/activity-types': { ui: () => <ActivityTypesPage />, me: OWNER },
  '/kpm/settings/lead-statuses': { ui: () => <LeadStatusesPage />, me: OWNER },
  '/kpm/settings/activation-checklist': { ui: () => <ActivationChecklistPage />, me: OWNER },
  '/kpm/settings/training': { ui: () => <TrainingSettingsPage />, me: OWNER },
  '/kpm/settings/capability-mapping': { ui: () => <CapabilityMappingPage />, me: OWNER },
  '/kpm/settings/events': { ui: () => <EventSettingsPage />, me: OWNER },
  '/kpm/settings/campaigns': { ui: () => <CampaignSettingsPage />, me: OWNER },
  '/kpm/settings/products': { ui: () => <ProductsPage />, me: OWNER },
  '/kpm/settings/recruitment-pitch': { ui: () => <RecruitmentPitchPage />, me: OWNER },
  '/kpm/settings/branch-info': { ui: () => <BranchInfoPage />, me: OWNER },
  '/people/members': { ui: () => <MembersPage />, me: OWNER },
  '/people/import': { ui: () => <ImportPeoplePage />, me: OWNER },
  '/people/org-tree': { ui: () => <OrgTreePage />, me: OWNER },
  '/people/admins': { ui: () => <KpmAdminsPage />, me: OWNER },
  // The platform console's.
  '/admin': { ui: () => <PlatformOverviewPage />, me: ADMIN },
  '/admin/companies': { ui: () => <CompaniesPage />, me: ADMIN },
  '/admin/org-levels': { ui: () => <OrgLevelsPage />, me: ADMIN },
  '/admin/tenants': { ui: () => <AllKpmsPage />, me: ADMIN },
  '/admin/kpm-requests': { ui: () => <KpmRequestsPage />, me: ADMIN },
  '/admin/leader-limit-requests': { ui: () => <LeaderLimitRequestsPage />, me: ADMIN },
  '/admin/billing': { ui: () => <BillingPage />, me: ADMIN },
  '/admin/tenant-admins': { ui: () => <TenantAdminsPage />, me: ADMIN },
  '/admin/audit': { ui: () => <AuditPage />, me: ADMIN },
  '/admin/analytics': { ui: () => <AdminAnalyticsPage />, me: ADMIN },
};

/** Every item with an address, in the shell's order, by its words: a pill or a count after them is not its label. */
function navItems(shell: ReactNode, me: typeof FIELD): { label: string; href: string }[] {
  renderWithSession(<>{shell}</>, { me });
  const main = screen.getByRole('navigation', { name: 'Main' });
  const items = [...main.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => ({
    label: (a.querySelector('[data-nav-label]')?.textContent ?? a.textContent ?? '').replace(/\s+/g, ' ').trim(),
    href: a.getAttribute('href')!,
  }));
  cleanup();
  return items;
}

const SHELLS = [
  ['the field shell', <AgentShell key="a">x</AgentShell>, FIELD],
  ['the office console', <TenantShell key="t">x</TenantShell>, OWNER],
  ['the platform console', <AdminShell key="p">x</AdminShell>, ADMIN],
] as const;

/** A page's own title, once it is up: its `<h1>`. */
async function titleOf(href: string): Promise<string> {
  const page = PAGES[href];
  nav.pathname = href;
  // Nothing answers but what a title waits for: every other read stays on its way, and the title is up before it.
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const key = Object.keys(page.ready ?? {}).find((fragment) => url.includes(fragment));
    if (!key) return new Promise(() => undefined);
    const { body } = (page.ready as Record<string, { body: unknown }>)[key];
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  }));
  renderWithSession(<>{page.ui()}</>, { me: page.me });
  const heading = await screen.findByRole('heading', { level: 1 }, { timeout: 3000 });
  return (heading.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('P18.95-T9 AC-2 each menu label is its page’s title', () => {
  beforeEach(() => { nav.pathname = '/'; });
  afterEach(() => vi.unstubAllGlobals());

  describe.each(SHELLS)('%s', (_, shell, me) => {
    const items = navItems(shell, me);

    it('draws its nav at all, and every item has a page here', () => {
      expect(items.length).toBeGreaterThan(5);
      expect(items.filter((item) => !PAGES[item.href]).map((item) => item.href)).toEqual([]);
    });

    it.each(items.map((item) => [item.label, item.href] as const))('P18.95-T9 AC-2 “%s” opens a page titled the same (%s)', async (label, href) => {
      expect((await titleOf(href)).toLowerCase()).toBe(label.toLowerCase());
    });
  });

  it('P18.95-T9 AC-2 the client’s two pairs: Training modules and User management are their pages’ titles now', async () => {
    expect(await titleOf('/training')).toBe('Training Modules');
    cleanup();
    expect(await titleOf('/user-management/kpm')).toBe('User Management');
  });
});
