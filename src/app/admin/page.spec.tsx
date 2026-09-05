import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../test/harness';
import AdminOverviewPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud'],
});

const kpm = (over: Record<string, unknown>) => ({
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'B', address: null,
  contactPhone: null, ownerUserId: 'u-owner', timezone: 'Asia/Jakarta', locale: 'id-ID',
  currency: 'IDR', status: 'active', suspendedAt: null, suspendedReason: null,
  createdAt: '2026-09-01T00:00:00.000Z', settings: {}, ...over,
});

describe('admin overview', () => {
  afterEach(() => {
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it('counts offices by lifecycle state', async () => {
    stubFetch({
      '/admin/tenants': {
        body: [
          kpm({ _id: 'a' }),
          kpm({ _id: 'b', status: 'suspended' }),
          kpm({ _id: 'c', status: 'archived' }),
        ],
      },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', slug: 'prudential' }] },
    });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    const value = async (label: string) =>
      (await screen.findByText(label)).parentElement?.querySelector('p:last-child')?.textContent;

    expect(await value('Offices')).toBe('3');
    expect(await value('Active')).toBe('1');
    expect(await value('Suspended')).toBe('1');
    expect(await value('Principals')).toBe('1');
  });

  it('raises an office with no owner, since nobody can administer it until one exists', async () => {
    stubFetch({
      '/admin/tenants': { body: [kpm({ _id: 'a', ownerUserId: null })] },
      '/admin/companies': { body: [] },
    });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('1 office without an owner')).toBeInTheDocument();
  });

  it('stays quiet when every office has an owner', async () => {
    stubFetch({ '/admin/tenants': { body: [kpm({ _id: 'a' })] }, '/admin/companies': { body: [] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    await screen.findByText('Offices');
    expect(screen.queryByText(/without an owner/)).not.toBeInTheDocument();
  });

  it('signs out from the sidebar, without needing the account screen first', async () => {
    // The console is where a Super Admin spends their session, so ending it has to be
    // reachable from the sidebar rather than only from /profile.
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    const { session } = renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(session.signOut).toHaveBeenCalled();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('names the account in the menu, so you can confirm it before leaving', async () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByText('root@agencyboost.test')).toBeInTheDocument();
  });

  it('shows a placeholder rather than a misleading zero before the counts arrive', () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });
    // A zero here would read as "there are no offices", which is a different claim
    // from "we have not been told yet".
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
