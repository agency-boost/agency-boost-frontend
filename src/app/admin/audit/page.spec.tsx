import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
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
  _id: 'a-1', kpmId: null, actorUserId: 'u-root', effectiveUserId: null,
  action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1',
  onBehalfOf: false, createdAt: '2026-09-04T02:00:00.000Z',
};

describe('audit log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the platform log — where provisioning is actually recorded', async () => {
    // A Super Admin has no tenant, so their own events carry a null kpmId. Defaulting
    // to a tenant scope would show them an empty log that looks correct.
    const { calls } = stubFetch({ '/admin/audit': { body: [ENTRY] }, '/admin/tenants': { body: [] } });
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });

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
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });

    await screen.findByRole('option', { name: /0417/ });
    await userEvent.selectOptions(screen.getByLabelText('Scope'), 'kpm-1');

    await vi.waitFor(() =>
      expect(calls.some((c) => c.url.includes('/admin/audit?kpmId=kpm-1'))).toBe(true),
    );
  });

  it('names both people for an impersonated action', async () => {
    stubFetch({
      '/admin/audit': { body: [{ ...ENTRY, effectiveUserId: 'u-owner', onBehalfOf: true }] },
      '/admin/tenants': { body: [] },
    });
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
    expect(within(row).getByText('u-root')).toBeInTheDocument();
    expect(within(row).getByText('as u-owner')).toBeInTheDocument();
  });

  it('tells an empty tenant scope apart from an empty platform scope', async () => {
    stubFetch({
      '/admin/audit': { body: [] },
      '/admin/tenants': {
        body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', status: 'active' }],
      },
    });
    renderWithSession(<AuditPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText(/Nothing recorded at platform level yet/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Scope'), 'kpm-1');
    expect(await screen.findByText('Nothing recorded for this office yet.')).toBeInTheDocument();
  });
});
