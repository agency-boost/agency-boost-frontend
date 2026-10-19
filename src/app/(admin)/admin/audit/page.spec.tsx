import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import AuditPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/audit',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'audit_log:read'],
});

const ENTRY = {
  _id: 'a-1',
  actorUserId: 'u-root', actorName: 'Root Operator',
  effectiveUserId: null, effectiveName: null,
  action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1',
  targetLabel: '0417 · Surabaya Branch',
  createdAt: '2026-09-04T02:00:00.000Z',
};

describe('audit log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the platform log — where provisioning is actually recorded', async () => {
    // A Super Admin has no tenant, so their own events carry a null kpmId. Defaulting
    // to a tenant scope would show them an empty log that looks correct.
    const { calls } = stubFetch({ '/admin/audit': { body: [ENTRY] }, '/admin/tenants': { body: [] } });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });

    await screen.findByRole('table');
    const audit = calls.filter((c) => c.url.includes('/admin/audit'));
    expect(audit).toHaveLength(1);
    expect(audit[0].url).not.toContain('kpmId=');
  });

  it('narrows to one office when a tenant is chosen', async () => {
    const { calls } = stubFetch({
      '/admin/audit': { body: [] },
      '/admin/tenants': {
        body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', status: 'active' }],
      },
    });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });

    await screen.findByRole('option', { name: /0417/ });
    await userEvent.selectOptions(screen.getByLabelText('Scope'), 'kpm-1');

    await vi.waitFor(() =>
      expect(calls.some((c) => c.url.includes('/admin/audit?kpmId=kpm-1'))).toBe(true),
    );
  });

  it('names both people for an impersonated action', async () => {
    stubFetch({
      '/admin/audit': {
        body: [{
          ...ENTRY, effectiveUserId: 'u-owner', effectiveName: 'Rangga Wibisono',
        }],
      },
      '/admin/tenants': { body: [] },
    });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
    expect(within(row).getByText('Root Operator')).toBeInTheDocument();
    expect(within(row).getByText('as Rangga Wibisono')).toBeInTheDocument();
  });

  describe('naming what a row is about', () => {
    /*
     * Every row used to read `memberships 68f3c1a9…`, so answering *"who suspended
     * Surabaya?"* meant three lookups in a database shell — which is the question this
     * screen exists to answer, and the one moment nobody wants to be writing queries.
     */
    const render = (entry: Record<string, unknown>) => {
      stubFetch({ '/admin/audit': { body: [entry] }, '/admin/tenants': { body: [] } });
      renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });
    };

    it('names the target and the actor', async () => {
      render(ENTRY);

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
      expect(within(row).getByText('0417 · Surabaya Branch')).toBeInTheDocument();
      expect(within(row).getByText('Root Operator')).toBeInTheDocument();
      expect(within(row).queryByText('kpm-1')).toBeNull();
    });

    it('falls back to the id when nothing names it', async () => {
      // A collection nobody has taught the resolver about is *this is all we know*, not
      // *nothing happened* — so the id stays rather than the cell going blank.
      render({
        ...ENTRY, targetCollection: 'goals', targetId: 'g-9', targetLabel: null,
        actorName: null,
      });

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
      expect(within(row).getByText('g-9')).toBeInTheDocument();
      expect(within(row).getByText('u-root')).toBeInTheDocument();
    });
  });

  it('tells an empty tenant scope apart from an empty platform scope', async () => {
    stubFetch({
      '/admin/audit': { body: [] },
      '/admin/tenants': {
        body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', status: 'active' }],
      },
    });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText(/Nothing recorded at platform level yet/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Scope'), 'kpm-1');
    expect(await screen.findByText('Nothing recorded for this office yet.')).toBeInTheDocument();
  });

  it('shows pre-rename rows under the name the product now uses (ADR-0023)', async () => {
    /*
     * The database still says `platform_template.published`, and will for ever — an
     * append-only evidence log is not rewritten so a rename looks tidy. The reader sees
     * one vocabulary all the same.
     */
    stubFetch({
      '/admin/audit': {
        body: [{
          ...ENTRY,
          _id: 'a-old',
          action: 'platform_template.published',
          targetCollection: 'platformTemplates',
        }],
      },
      '/admin/tenants': { body: [] },
    });
    renderInLayout(AdminLayout, <AuditPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('company_template.published')).toBeInTheDocument();
    expect(screen.getByText('companyTemplates')).toBeInTheDocument();
    expect(screen.queryByText('platform_template.published')).not.toBeInTheDocument();
  });
});
