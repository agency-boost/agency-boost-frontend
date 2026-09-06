import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import MemberPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members/mem-1',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
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
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/mem-1': { body: member() },
    });
    renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByRole('heading', { name: 'Rina', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getAllByText('KPM0417-001').length).toBeGreaterThan(0);
  });

  it('explains an AAB who leads nobody rather than showing an empty unit (OD-23)', async () => {
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/mem-1': { body: member() },
    });
    renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByText(/leads nobody/)).toBeInTheDocument();
    expect(screen.getByText('Nobody reports to them.')).toBeInTheDocument();
  });

  it('shows the unit when they do lead someone', async () => {
    stubFetch({
      '/members/mem-1/reports': {
        body: [member({ membershipId: 'mem-2', agentCode: 'KPM0417-002', role: 'agent', fullName: 'Budi', preferredName: null })],
      },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/mem-1': { body: member({ isLeader: true, directCount: 1, subtreeCount: 3 }) },
    });
    renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

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
      '/members/mem-1/tags': { status: 404, body: {} },
      '/members/groups': { body: [] },
      '/members/mem-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Membership not found.', requestId: 'r-1' } },
      },
    });
    renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

    expect(await screen.findByRole('alert')).toHaveTextContent('Membership not found.');
    expect(screen.getByText(/would confirm they are here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the roster' })).toBeInTheDocument();
  });

  describe('tags (P3-T9)', () => {
    const tags = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false, ...over,
    });
    const group = (over: Record<string, unknown> = {}) => ({
      groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-9',
      ownerName: 'Wilson Tanoto', ownerHasLeft: false, memberCount: 1, ...over,
    });

    function open(t = tags(), groups: Record<string, unknown>[] = [group()], extra = {}) {
      const stubbed = stubFetch({
        '/members/mem-1/reports': { body: [] },
        '/members/mem-1/tags': { body: t },
        '/members/groups': { body: groups },
        '/members/mem-1': { body: member() },
        ...extra,
      });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      return stubbed;
    }

    it('AC-1: says a tag is not hierarchy and grants nothing', async () => {
      open();
      expect(await screen.findByText(/changes nothing about who reports to whom/)).toBeInTheDocument();
    });

    it('AC-2: says what Core Leader actually decides, and what it does not', async () => {
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
      expect(screen.getByText(/co-edit a Strategic Leader Forum minute, and nothing/))
        .toBeInTheDocument();
      expect(screen.getByText(/It is not a role, and it grants no access/)).toBeInTheDocument();
    });

    it('shows the tags somebody carries as chips', async () => {
      open(tags({ groupIds: ['grp-1'], isCoreLeader: true }));
      expect(await screen.findByText('Core Leader')).toBeInTheDocument();
      expect(screen.getByText('New Agent Mentoring Circle')).toBeInTheDocument();
    });

    it('says so plainly when somebody has none', async () => {
      open();
      expect(await screen.findByText('No tags.')).toBeInTheDocument();
    });

    it('sends the groups and the flag together, as one save', async () => {
      const { calls } = open(tags(), [group()], { '/members/mem-1/tags': { body: tags() } });
      await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));

      await userEvent.click(screen.getByLabelText('New Agent Mentoring Circle'));
      await userEvent.click(screen.getByLabelText('Core Leader'));
      await userEvent.click(screen.getByRole('button', { name: 'Save tags' }));

      const sent = calls.find((c) => c.init.method === 'PUT')!;
      expect(JSON.parse(sent.init.body as string)).toEqual({
        groupIds: ['grp-1'],
        isCoreLeader: true,
      });
    });

    it('changes nothing until saved, and Cancel discards the draft', async () => {
      const { calls } = open();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
      await userEvent.click(screen.getByLabelText('Core Leader'));
      expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('No tags.')).toBeInTheDocument();
    });

    it('keeps showing a tag whose group has been retired', async () => {
      // The tag is the record that a cohort existed, so it renders as itself rather
      // than vanishing when the group stops being offered.
      open(tags({ groupIds: ['grp-old'] }), [group()]);
      expect(await screen.findByText('A group since retired')).toBeInTheDocument();
    });

    it('points at where groups are made when there are none', async () => {
      open(tags(), []);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
      expect(screen.getByText(/No groups yet/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All members → Groups' }))
        .toHaveAttribute('href', '/people/members');
    });
  });
});
