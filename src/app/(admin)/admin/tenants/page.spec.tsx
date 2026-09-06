import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import TenantsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create', 'company:crud'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: null, contactPhone: null, ownerUserId: 'u-owner', timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null,
  suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z', settings: {},
};

describe('tenants list', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a real table with the principal resolved to its name', async () => {
    stubFetch({
      '/admin/tenants': { body: [KPM] },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', slug: 'prudential' }] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
    expect(within(row).getByText('BSD City Branch')).toBeInTheDocument();
    expect(within(row).getByText('Prudential')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
  });

  it('flags an office with no owner as an action, not a blank cell', async () => {
    // Nobody can administer an office until an owner is assigned, so an empty cell
    // would hide the one thing that still needs doing.
    stubFetch({
      '/admin/tenants': { body: [{ ...KPM, ownerUserId: null }] },
      '/admin/companies': { body: [] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('link', { name: 'Assign an owner' })).toHaveAttribute(
      'href',
      '/admin/tenants/kpm-1/owner',
    );
  });

  it('offers creation from the empty state as well as the header', async () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('No KPMs yet.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /New office|Create the first one/ });
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the error envelope when the list cannot be read', async () => {
    stubFetch({
      '/admin/tenants': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'req-3' } },
      },
      '/admin/companies': { body: [] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nope.');
    expect(alert).toHaveTextContent('req-3');
  });

  it('never renders for a session without the platform permission', () => {
    renderInLayout(AdminLayout, <TenantsPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('kpm:list_all');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
