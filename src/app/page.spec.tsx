import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../test/harness';
import Home from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/',
}));

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: null, contactPhone: null, ownerUserId: 'u-owner', timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null, suspendedReason: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  settings: { activationWindowDays: 90, weeksPerMonth: 4.33 },
};

const owner = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false,
  },
  permissions: ['kpm:read_profile'],
});

describe('landing', () => {
  afterEach(() => {
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it('waits rather than bouncing an anonymous visitor before the session is known', () => {
    renderWithSession(<Home />, { me: null, loading: true });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('sends an anonymous visitor to sign in', () => {
    renderWithSession(<Home />, { me: null, loading: false });
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('sends a Super Admin to the platform console', () => {
    renderWithSession(<Home />, {
      me: makeMe({
        user: {
          id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
          pronoun: 'they', initials: 'R', platformRole: 'super_admin',
        },
        membership: null,
      }),
    });
    expect(replace).toHaveBeenCalledWith('/admin');
  });

  it('sends an agent to their account, since their screens start in Phase 6', () => {
    renderWithSession(<Home />, { me: makeMe() });
    expect(replace).toHaveBeenCalledWith('/profile');
  });

  it("lands a KPM Owner on their office with the seeded configuration present", async () => {
    // Phase 2 AC: the Owner's first sign-in shows their office and the settings
    // provisioning seeded. The full Overview arrives in Phase 14 with its data.
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderWithSession(<Home />, { me: owner });

    expect(await screen.findByRole('heading', { name: /0417 · BSD City Branch/ })).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('4.33')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('says so when the office profile cannot be read, rather than showing an empty page', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { status: 404, body: {} } });
    renderWithSession(<Home />, { me: owner });
    expect(await screen.findByText('Your office profile could not be loaded.')).toBeInTheDocument();
  });
});
