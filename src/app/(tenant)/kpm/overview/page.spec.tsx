import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm:read_profile'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: null, contactPhone: null, ownerUserId: 'u-owner',
  ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', companyName: 'Prudential',
  timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null,
  suspendedReason: null, createdAt: '2026-03-01T00:00:00.000Z',
  settings: { activationWindowDays: 90, weeksPerMonth: 4.33 },
};

describe('office overview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the office and the settings it was set up with', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    expect(await screen.findByText('0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.getByText('activationWindowDays')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('names the phase that brings the analytics, and shows nothing standing in for them', async () => {
    // A shell full of zeroes would read as "your office has no production", which is a
    // different and false statement.
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    expect(await screen.findByText('Arrives in phase 14')).toBeInTheDocument();
    expect(screen.getByText(/not an empty version of it, and not a sample/)).toBeInTheDocument();
  });

  it('points at what does work today rather than being a dead end', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    /*
     * The panel's own link first: **that** is what this test is about — a placeholder that
     * sends somebody onward rather than leaving them on a dead end.
     */
    // Inside the page, not the nav: every group starts open, so the nav holds one too.
    const onward = await within(screen.getByRole('main')).findByRole('link', { name: 'All members' });
    expect(onward).toHaveAttribute('href', '/people/members');

    // And the nav holds it too: every group starts open (P10.1-T3), People included.
    const links = screen.getAllByRole('link', { name: 'All members' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/people/members');
  });

  it('says the day boundary is neither the reader clock nor the server one', async () => {
    // The sentence used to read "in its own time zone", which implied a choice per
    // office. v1 runs every office on Jakarta time (ADR-0016). The part that matters —
    // that the boundary is not the reader's clock — is what the assertion keeps.
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });
    expect(await screen.findByText(/worked out in Jakarta time/)).toBeInTheDocument();
    expect(screen.getByText(/neither is yours to change/)).toBeInTheDocument();
  });

  it('shows the error rather than an office that looks empty', async () => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'r-1' } },
      },
    });
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('KPM not found.');
  });

  it('never renders for somebody without the permission', () => {
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('member:read_profile');
  });
});
