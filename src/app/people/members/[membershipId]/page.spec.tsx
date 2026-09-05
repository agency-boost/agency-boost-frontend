import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '../../../../../test/harness';
import MemberPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members/mem-1',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false,
  },
  permissions: ['member:read_profile'],
});

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'aab', status: 'active',
  fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test', initials: 'RW',
  leaderId: 'mem-ab', leaderName: 'Wilson Tanoto', depth: 1, directCount: 0, subtreeCount: 0,
  isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

const params = routeParams({ membershipId: 'mem-1' });

describe('one member', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows who they are and who they report to', async () => {
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1': { body: member() },
    });
    renderWithSession(<MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByRole('heading', { name: 'Rina', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getAllByText('KPM0417-001').length).toBeGreaterThan(0);
  });

  it('explains an AAB who leads nobody rather than showing an empty unit (OD-23)', async () => {
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1': { body: member() },
    });
    renderWithSession(<MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByText(/leads nobody/)).toBeInTheDocument();
    expect(screen.getByText('Nobody reports to them.')).toBeInTheDocument();
  });

  it('shows the unit when they do lead someone', async () => {
    stubFetch({
      '/members/mem-1/reports': {
        body: [member({ membershipId: 'mem-2', agentCode: 'KPM0417-002', role: 'agent', fullName: 'Budi', preferredName: null })],
      },
      '/members/mem-1': { body: member({ isLeader: true, directCount: 1, subtreeCount: 3 }) },
    });
    renderWithSession(<MemberPage params={params} />, { me: OWNER });

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Budi' })).toHaveAttribute(
      'href',
      '/people/members/mem-2',
    );
    expect(screen.getByText('Direct reports')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who reports to them' })).toBeInTheDocument();
  });

  it('says nothing about whether someone outside your scope exists', async () => {
    // A "not permitted" message would confirm they are here. 404 and 403 have to read
    // the same, and the screen says why rather than leaving it looking like a bug.
    stubFetch({
      '/members/mem-1/reports': { status: 404, body: {} },
      '/members/mem-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Membership not found.', requestId: 'r-1' } },
      },
    });
    renderWithSession(<MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByRole('alert')).toHaveTextContent('Membership not found.');
    expect(screen.getByText(/would confirm they are here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the roster' })).toBeInTheDocument();
  });
});
