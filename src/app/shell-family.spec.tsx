import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import AgentLayout from '@/app/(agent)/layout';
import TenantLayout from '@/app/(tenant)/layout';
import AdminOverviewPage from '@/app/(admin)/admin/page';
import PersonalSummaryPage from '@/app/(agent)/summary/page';
import KpmOverviewPage from '@/app/(tenant)/kpm/overview/page';
import { overviewView } from '@/app/(tenant)/kpm/overview/overview-fixtures';
import MembersPage from '@/app/(tenant)/people/members/page';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import type { Me } from '@/lib/session';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), pathname: '/' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **Each shell is its family's, whatever address was typed** (the product owner's report, 2026-10-11). The
 * tenant shell's own gate, `member:read_profile`, is every member's, so an Agent who typed an office address got
 * the Owner's sidebar around a refusal, or around a whole page. Now a reader who is not of a shell's family
 * (`familyAllows`) is sent to their own landing and is shown no chrome on the way; inside their family the
 * permission refusals are as they were.
 */
const membership = (over: Partial<NonNullable<Me['membership']>> = {}): NonNullable<Me['membership']> => ({
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
  isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
});
const FIELD = ['member:read_profile', 'tenant_config:read', 'personal_summary:read', 'notification:read_inbox'];
const OFFICE = [...FIELD, 'kpm_overview:read'];

const AGENT = makeMe({ membership: membership(), permissions: FIELD });
const AB = makeMe({ membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }), permissions: FIELD });
const PENDING = makeMe({ membership: membership({ status: 'pending' }), permissions: ['member:read_profile'] });
const OWNER = makeMe({
  membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 3 }), permissions: OFFICE,
});
const ADMIN = makeMe({
  membership: membership({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmAdmin: true, directCount: 1 }), permissions: OFFICE,
});
const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' },
  membership: null,
  // Most of an office's read grants are the Super Admin's too (`all`): the family is what refuses them.
  permissions: ['kpm:list_all', 'kpm_overview:read', 'personal_summary:read', 'notification:read_inbox'],
});
/** A Super Admin acting as an Agent: `/auth/me` answers with the member, so the session is the Agent's. */
const AS_AGENT = makeMe({ ...AGENT, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' });

/** What the three shells read for themselves, and a page's own reads answered with a refusal it can show. */
function stubShell(extra: Parameters<typeof stubFetch>[0] = {}) {
  return stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    '/notifications': { body: { items: [], unread: 0 } },
    ...extra,
  });
}

const sidebar = () => screen.queryByRole('navigation', { name: 'Main' });

describe('a shell admits only its own family (2026-10-11)', () => {
  beforeEach(() => {
    nav.replace.mockReset();
    nav.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the office console', () => {
    it('an Agent who types /people/members lands on Home (UI-100), and the console never draws its nav', async () => {
      nav.pathname = '/people/members';
      const { calls } = stubShell();
      renderInLayout(TenantLayout, <MembersPage />, { me: AGENT });

      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/home'));
      expect(nav.replace.mock.calls).toEqual([['/home']]);
      expect(sidebar()).not.toBeInTheDocument();
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
      expect(screen.getByText('Taking you to your work…')).toBeInTheDocument();
      // The page is not drawn, so it asks the API for nothing.
      expect(calls.some((c) => c.url.includes('/members'))).toBe(false);
    });

    it('an AB on /kpm/overview lands on Home (UI-100), not on a refusal in the Owner’s chrome', async () => {
      nav.pathname = '/kpm/overview';
      stubShell();
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: AB });

      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/home'));
      expect(sidebar()).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a pending member lands on their leader request', async () => {
      nav.pathname = '/people/members';
      stubShell();
      renderInLayout(TenantLayout, <MembersPage />, { me: PENDING });
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/user-management/leader'));
      expect(sidebar()).not.toBeInTheDocument();
    });

    it('a Super Admin outside a support session lands on their console', async () => {
      nav.pathname = '/kpm/overview';
      stubShell();
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: SUPER_ADMIN });
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin'));
      expect(sidebar()).not.toBeInTheDocument();
    });

    it('a support session as an Agent follows the Agent: to the Agent’s landing, not a refusal', async () => {
      nav.pathname = '/kpm/overview';
      stubShell();
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: AS_AGENT });
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/home'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('an Admin on /kpm/overview stays, in the console', async () => {
      nav.pathname = '/kpm/overview';
      stubShell({ '/kpm/overview': { body: overviewView() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: ADMIN });

      expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      expect(screen.getByText('KPM OWNER')).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('a refusal inside the family is as it was: an Admin without the Overview’s grant is refused, in the console', async () => {
      nav.pathname = '/kpm/overview';
      stubShell();
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: makeMe({ ...ADMIN, permissions: FIELD }) });

      expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'kpm_overview:read');
      expect(sidebar()).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });
  });

  describe('the field view', () => {
    it('a Super Admin on /summary lands on their console, with no field nav on the way', async () => {
      nav.pathname = '/summary';
      stubShell();
      renderInLayout(AgentLayout, <PersonalSummaryPage />, { me: SUPER_ADMIN });

      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin'));
      expect(sidebar()).not.toBeInTheDocument();
    });

    it('the Owner on /summary stays: the field view is theirs too (ADR-0114)', async () => {
      nav.pathname = '/summary';
      stubShell({ '/summary': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
      renderInLayout(AgentLayout, <PersonalSummaryPage />, { me: OWNER });

      expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      // The field view's identity menu offers the way back to the console.
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('an Agent on /summary stays', async () => {
      nav.pathname = '/summary';
      stubShell({ '/summary': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
      renderInLayout(AgentLayout, <PersonalSummaryPage />, { me: AGENT });
      expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });
  });

  describe('the platform console', () => {
    /*
     * `kpm:list_all`, the console's own gate, is the Super Admin's alone, so nobody else ever saw this chrome:
     * the refusal replaced it. They are now sent to their own landing, as at the other two.
     */
    it('anybody but a Super Admin on /admin lands on their own page, never in the console', async () => {
      nav.pathname = '/admin';
      stubShell();
      renderInLayout(AdminLayout, <AdminOverviewPage />, { me: OWNER });

      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/kpm/overview'));
      expect(sidebar()).not.toBeInTheDocument();
      expect(screen.queryByText('SUPERADMIN')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
