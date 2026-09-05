import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm:read_profile'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: null, contactPhone: null, ownerUserId: 'u-owner', timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null,
  suspendedReason: null, createdAt: '2026-03-01T00:00:00.000Z',
  settings: { activationWindowDays: 90, weeksPerMonth: 4.33 },
};

describe('office overview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the office and the settings it was set up with', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderWithSession(<KpmOverviewPage />, { me: OWNER });

    expect(await screen.findByText('0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.getByText('activationWindowDays')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('names the phase that brings the analytics, and shows nothing standing in for them', async () => {
    // A shell full of zeroes would read as "your office has no production", which is a
    // different and false statement.
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderWithSession(<KpmOverviewPage />, { me: OWNER });

    expect(await screen.findByText('Arrives in phase 14')).toBeInTheDocument();
    expect(screen.getByText(/not an empty version of it, and not a sample/)).toBeInTheDocument();
  });

  it('points at what does work today rather than being a dead end', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderWithSession(<KpmOverviewPage />, { me: OWNER });

    // Two of them: the sidebar nav and the onward panel. Both point at the same place,
    // which is the point — the panel repeats it where somebody is actually looking.
    const links = await screen.findAllByRole('link', { name: 'All members' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/people/members');
  });

  it('says the day boundary is the office own time zone', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderWithSession(<KpmOverviewPage />, { me: OWNER });
    expect(await screen.findByText(/worked out in its own time zone/)).toBeInTheDocument();
  });

  it('shows the error rather than an office that looks empty', async () => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'r-1' } },
      },
    });
    renderWithSession(<KpmOverviewPage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('KPM not found.');
  });

  it('never renders for somebody without the permission', () => {
    renderWithSession(<KpmOverviewPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('member:read_profile');
  });
});
