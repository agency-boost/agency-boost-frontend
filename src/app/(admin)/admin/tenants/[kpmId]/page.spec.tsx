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
  ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', companyName: 'Prudential',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: { activationWindowDays: 90 },
};

const params = routeParams({ kpmId: 'kpm-1' });

describe('tenant detail', () => {
  afterEach(() => vi.unstubAllGlobals());

  /*
   * P10.1-T2. The page carried a *Seeded settings* card: the office's settings by their raw keys,
   * for "a reviewer", under a sentence naming the phase the office would take them over in. It
   * went, and nothing took its slot — no feature is coming to it, so a sign would promise one. The
   * payload still carries `settings`; this screen just does not print them.
   */
  it('shows no seeded settings, no raw setting key and no phase', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seeded settings' })).not.toBeInTheDocument();
    expect(screen.queryByText('activationWindowDays')).not.toBeInTheDocument();
    expect(screen.queryByText(/phase \d/i)).not.toBeInTheDocument();
    // Nor a placeholder where it stood: the four cards are the page.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Profile', 'Owner', 'People', 'Lifecycle']);
  });

  it('P3.5-T14 AC-7: names the owner, and keeps the one id support asks for', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    // The Owner card's whole body used to be a <code> holding an ObjectId.
    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('rina@kpm0417.test')).toBeInTheDocument();
    expect(screen.queryByText('u-owner')).not.toBeInTheDocument();

    // The company is named too, rather than joined client-side or shown as an id.
    expect(screen.getByText('Prudential')).toBeInTheDocument();

    // The KPM id stays — `04-managing-a-kpm.md` tells the reader support will ask for it
    // — under the term I-49 settled, not the retired `Tenant id`.
    expect(screen.getByText('KPM id')).toBeInTheDocument();
    expect(screen.getByText('kpm-1')).toBeInTheDocument();
    expect(screen.queryByText('Tenant id')).not.toBeInTheDocument();
  });

  it('offers a transfer when an owner exists and an assignment when none does', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    const { unmount } = renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Transfer owner' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null } } });
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
