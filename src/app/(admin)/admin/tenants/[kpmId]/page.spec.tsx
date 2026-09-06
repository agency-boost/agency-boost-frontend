import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import TenantDetailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'kpm:suspend'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: 'Jl. Raya Serpong', contactPhone: null, ownerUserId: 'u-owner',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: { activationWindowDays: 90 },
};

const params = routeParams({ kpmId: 'kpm-1' });

describe('tenant detail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the seeded settings so provisioning can be verified, not assumed', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByText('activationWindowDays')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
  });

  it('offers a transfer when an owner exists and an assignment when none does', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    const { unmount } = renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Transfer owner' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: null } } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Assign owner' })).toBeInTheDocument();
    expect(screen.getByText(/Nobody can administer this office/)).toBeInTheDocument();
  });

  it('sends the reason with a suspension and reloads the office afterwards', async () => {
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/status': { body: {} },
      '/admin/tenants/kpm-1': [
        { body: KPM },
        { body: { ...KPM, status: 'suspended', suspendedReason: 'unpaid invoice' } },
      ],
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'suspended');
    await userEvent.type(screen.getByLabelText('Reason'), 'unpaid invoice');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toEqual({
      status: 'suspended',
      reason: 'unpaid invoice',
    });
    expect(await screen.findByText('Suspended: unpaid invoice')).toBeInTheDocument();
  });

  it('shows the error envelope instead of an empty shell when the office cannot be read', async () => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'req-2' } },
      },
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('alert')).toHaveTextContent('KPM not found.');
  });
});
