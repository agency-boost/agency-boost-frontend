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
  removedAt: null,
  // P3.5-T13. The server decides what this viewer may do; the default here is an Owner
  // looking at an ordinary member, which is the case the screen is built around.
  canChangeRole: true, canPromoteToAb: true, canRemove: true,
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

  describe('changing a role and removing somebody (P3.5-T13)', () => {
    const stub = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
      stubFetch({
        '/members/mem-1/reports': { body: [] },
        '/members/mem-1/tags': { body: { groupIds: [], isCoreLeader: false } },
        '/members/groups': { body: [] },
        '/members/mem-1': { body: member(over) },
        ...extra,
      });

    it('AC-1: sends the new rung and the reason, then re-reads the person', async () => {
      const { calls } = stub();
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

      await screen.findByText('Rina Wijaya');
      await userEvent.selectOptions(screen.getByLabelText('New role'), 'ab');
      await userEvent.type(screen.getByLabelText('Why?'), 'Ready to build');
      await userEvent.click(screen.getByRole('button', { name: 'Change role' }));

      const patch = calls.find((c) => c.init.method === 'PATCH');
      expect(patch?.url).toContain('/members/mem-1/role');
      expect(JSON.parse(String(patch?.init.body))).toEqual({ toRole: 'ab', reason: 'Ready to build' });
      // The page shows the person, not the caller's team, so it re-reads rather than
      // trusting what came back.
      await vi.waitFor(() =>
        expect(calls.filter((c) => c.url.endsWith('/members/mem-1')).length).toBeGreaterThan(1),
      );
    });

    it('AC-1: says what the change means before it is made', async () => {
      stub();
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      await userEvent.selectOptions(screen.getByLabelText('New role'), 'agent');
      // The office may be acting on somebody who reports to a third person, so the
      // leader-voiced sentence would be untrue here.
      expect(screen.getByText(/Nobody moves/)).toBeInTheDocument();
      expect(screen.queryByText(/reporting to you/)).not.toBeInTheDocument();
    });

    it('AC-4: a leader is offered Agent and AAB, and never AB', async () => {
      stub({ canChangeRole: true, canPromoteToAb: false, role: 'agent' });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      const options = [...screen.getByLabelText('New role').querySelectorAll('option')].map(
        (o) => o.getAttribute('value'),
      );
      expect(options).toEqual(['', 'aab']);
      expect(screen.getByText(/Only the office can make somebody an Agency Builder/)).toBeInTheDocument();
    });

    it('AC-4: offers neither control to somebody who may use neither', async () => {
      stub({ canChangeRole: false, canPromoteToAb: false, canRemove: false });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });

      await screen.findByText('Rina Wijaya');
      expect(screen.queryByLabelText('New role')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    });

    it('AC-2: will not remove until the word is typed, exactly as the server checks it', async () => {
      const { calls } = stub();
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina' }));
      const confirm = screen.getByRole('button', { name: 'Remove them' });
      expect(confirm).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'remove me');
      expect(confirm).toBeDisabled();

      await userEvent.clear(screen.getByLabelText('Type REMOVE to confirm'));
      // Trimmed and case-insensitive, because that is what the server does — the screen
      // must not be stricter than the gate it stands in front of.
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), ' remove ');
      expect(confirm).toBeEnabled();

      await userEvent.click(confirm);
      const del = calls.find((c) => c.init.method === 'DELETE');
      expect(JSON.parse(String(del?.init.body))).toEqual({ confirmation: ' remove ' });
    });

    it('AC-3: a leader with reports cannot be removed until the body says where they go', async () => {
      const { calls } = stub({ directCount: 3, isLeader: true });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina' }));
      expect(screen.getByText('3 people report to them')).toBeInTheDocument();

      // Moving them up to *this person's* leader, not to the caller's unit: an Owner may
      // lead nobody, and moving a unit under somebody who never led it would be a
      // reorganisation dressed up as a removal.
      await userEvent.click(screen.getByLabelText('Move them up to Wilson Tanoto'));
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(screen.getByRole('button', { name: 'Remove them' }));

      const del = calls.find((c) => c.init.method === 'DELETE');
      expect(JSON.parse(String(del?.init.body)).subtree).toEqual({
        action: 'reassign',
        toMembershipId: 'mem-ab',
      });
    });

    it('AC-3: sends no disposition for somebody who leads nobody', async () => {
      // The server refuses one, so sending it anyway would be a 400 the reader cannot act
      // on.
      const { calls } = stub({ directCount: 0 });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina' }));
      expect(screen.queryByText(/report to them/)).not.toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(screen.getByRole('button', { name: 'Remove them' }));

      expect(JSON.parse(String(calls.find((c) => c.init.method === 'DELETE')?.init.body))).not.toHaveProperty('subtree');
    });

    it('shows the server refusal rather than pretending it worked', async () => {
      stub({}, {
        '/members/mem-1': [
          { body: member() },
          { status: 403, body: { error: { code: 'ORG_REMOVAL_NOT_PERMITTED', message: 'Only somebody\u2019s direct leader can remove them.', requestId: 'r-1' } } },
        ],
      });
      renderInLayout(TenantLayout, <MemberPage params={params} />, { me: OWNER });
      await screen.findByText('Rina Wijaya');

      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina' }));
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.click(screen.getByRole('button', { name: 'Remove them' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('direct leader');
    });
  });
});
