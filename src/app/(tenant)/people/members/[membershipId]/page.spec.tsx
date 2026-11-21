import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import MemberPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/people/members/mem-budi',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 4,
  },
  permissions: ['member:read_profile', 'member:complete_personal'],
});

const budi = {
  membershipId: 'mem-budi', agentCode: '80009', role: 'agent', orgLevelCode: 'AGENT', status: 'active',
  fullName: 'Budi Santoso', preferredName: null, email: 'budi@kpm0417.test', initials: 'BS', leaderId: 'mem-sari',
  leaderName: 'Sari Puspita', depth: 3, directCount: 0, subtreeCount: 0, isLeader: false, isKpmOwner: false,
  isKpmAdmin: false, isCoreLeader: false, joinedAt: null, joinDate: '2025-09-20', removedAt: null, invitation: 'invited',
  canChangeRole: true, canPromoteToAb: true, canRemove: true, roleChoices: ['AGENT'], canChangeLeader: true,
  canEditDetails: true, openable: true, photoUrl: null,
  personal: { dateOfBirth: null, gender: null, companyJoinMonth: null, workStatus: null, phone: null, companyName: 'Prudential' },
};

/**
 * **`/people/members/[membershipId]` is All members with that member's sheet open** (P19.20-T2 AC-1; ADR-0273 §1): the
 * address other pages link to keeps landing on the person.
 */
describe('P19.20-T2 AC-1 a member’s address opens their sheet over All members', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replace.mockReset();
  });

  it('P19.20-T2 AC-1 draws All members with the sheet open, and closing it leaves for /people/members', async () => {
    stubFetch({
      '/members/mem-budi/tags': { body: {} },
      '/members/mem-budi': { body: budi },
      '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } },
    });
    renderInLayout(TenantLayout, <MemberPage params={routeParams({ membershipId: 'mem-budi' })} />, { me: OWNER });

    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Members/ })).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(replace).toHaveBeenCalledWith('/people/members');
  });

  it('P19.20-T1 AC-5 a member the reader may not open: the sheet says so, the list stays', async () => {
    stubFetch({
      '/members/mem-out': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Membership not found.' } } },
      '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } },
    });
    renderInLayout(TenantLayout, <MemberPage params={routeParams({ membershipId: 'mem-out' })} />, { me: OWNER });

    expect(await screen.findByText('Membership not found.')).toBeInTheDocument();
  });
});
