import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import MembersPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
  },
  permissions: ['member:read_profile'],
});

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
  fullName: 'Rina Wijaya', preferredName: 'Rina', email: 'rina@kpm0417.test', initials: 'RW',
  leaderId: null, leaderName: null, depth: 0, directCount: 0, subtreeCount: 0,
  isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

describe('members directory (P3-T1 AC-3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the roster with the agent code as issued', async () => {
    stubFetch({ '/members': { body: { members: [member()], nextCursor: null, counts: { directory: 187, pending: 14, removed: 3 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Rina/ });
    expect(within(row).getByText('KPM0417-001')).toBeInTheDocument();
    expect(within(row).getByText('rina@kpm0417.test')).toBeInTheDocument();
    expect(within(row).getByTitle('Agent')).toBeInTheDocument();
  });

  it('says who leads nobody, because leadership is the graph and not the role (OD-23)', async () => {
    stubFetch({
      '/members': {
        body: {
          members: [
            member({ membershipId: 'a', role: 'aab', fullName: 'Childless AAB', preferredName: null }),
            member({
              membershipId: 'b', agentCode: 'KPM0417-002', role: 'agent',
              fullName: 'Leads Someone', preferredName: null,
              isLeader: true, directCount: 2, subtreeCount: 5,
            }),
          ],
          nextCursor: null,
        },
      },
    });
    renderWithSession(<MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('row', { name: /Childless AAB/ })).toHaveTextContent('Leads nobody');
    expect(within(table).getByRole('row', { name: /Leads Someone/ })).toHaveTextContent(
      '2 direct · 5 in unit',
    );
  });

  it('sends the search and role filters to the server, not just to the table', async () => {
    // A filter applied only in the browser would still have fetched every row, which is
    // the thing pagination exists to avoid.
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });

    await userEvent.type(screen.getByLabelText('Search'), 'budi');
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'aab');

    await vi.waitFor(() => {
      const last = calls[calls.length - 1].url;
      expect(last).toContain('q=budi');
      expect(last).toContain('role=aab');
    });
  });

  it('pages forward with the cursor the server returned', async () => {
    const { calls } = stubFetch({
      '/members': [
        { body: { members: [member()], nextCursor: '25', counts: { directory: 187, pending: 14, removed: 3 } } },
        { body: { members: [member({ membershipId: 'mem-2', agentCode: 'KPM0417-026' })], nextCursor: null } },
      ],
    });
    renderWithSession(<MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('cursor=25'));
    expect(await screen.findByText('KPM0417-026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('offers Previous only once there is a page to go back to', async () => {
    stubFetch({ '/members': { body: { members: [member()], nextCursor: '25', counts: { directory: 187, pending: 14, removed: 3 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('tells an empty office apart from an empty filter', async () => {
    stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });

    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'nobody');
    expect(await screen.findByText('Nobody matches that.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();
  });

  it('asks for removed members explicitly, on their own tab', async () => {
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('status=removed'));
    expect(await screen.findByText('Nobody has been removed from this office.')).toBeInTheDocument();
  });

  it('P3-T7 AC-2: the Removed tab says when they left, not that they are removed', async () => {
    // Every row on this tab reads "Removed", so a Status column answers nothing. When
    // is the question the list is actually asked.
    const { calls } = stubFetch({
      '/members': {
        body: {
          members: [
            member({ status: 'removed', removedAt: '2026-07-19T04:00:00.000Z' }),
          ],
          nextCursor: null,
        },
      },
    });
    renderWithSession(<MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('status=removed'));

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Removed' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Rina/ })).toHaveTextContent('19/07/2026');

    // Their code and their leader are still there — the row is kept, not blanked.
    expect(within(table).getByRole('row', { name: /Rina/ })).toHaveTextContent('KPM0417-001');
  });

  it('keeps the tabs it has not built visible rather than hiding the roadmap', async () => {
    stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderWithSession(<MembersPage />, { me: OWNER });
    for (const label of ['Pending']) {
      expect(await screen.findByText(label)).toHaveAttribute('aria-disabled', 'true');
    }
  });

  describe('the role change log tab (P3-T6 AC-4)', () => {
    const entry = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-1', fullName: 'Rina Wijaya', agentCode: 'KPM0417-001',
      fromRole: 'agent', toRole: 'aab', reason: 'Ready to lead a unit',
      actorName: 'Wilson Tanoto', changedAt: '2026-08-14T03:20:00.000Z', ...over,
    });

    function open(body: unknown) {
      const stub = stubFetch({
        '/members/role-changes': { body },
        '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } },
      });
      renderWithSession(<MembersPage />, { me: OWNER });
      return stub;
    }

    it('reads the log, not the roster, and drops the roster filters while it is open', async () => {
      const { calls } = open([entry()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));

      await screen.findByRole('table');
      expect(calls.some((c) => c.url.includes('/members/role-changes'))).toBe(true);
      // Search and Role filter the roster; leaving them over the log would offer
      // controls that change nothing.
      expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    });

    it('shows what changed, why, and who did it', async () => {
      open([entry()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Rina/ });
      expect(row).toHaveTextContent('Agent→AAB');
      // The badge abbreviates; the full name has to stay reachable, because "AAB"
      // means nothing to somebody reading their first role change.
      expect(within(row).getByTitle('Associate Agency Builder')).toBeInTheDocument();
      expect(row).toHaveTextContent('Ready to lead a unit');
      expect(row).toHaveTextContent('Wilson Tanoto');
      expect(within(row).getByRole('link', { name: 'Rina Wijaya' })).toHaveAttribute(
        'href',
        '/people/members/mem-1',
      );
    });

    it('says nothing rather than nothing-happened when a reason was not given', async () => {
      // A blank cell reads as a rendering fault; an em dash reads as "not recorded".
      open([entry({ reason: null, actorName: null })]);
      await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Rina/ });
      expect(within(row).getAllByText('—')).toHaveLength(2);
    });

    it('has an empty state of its own, not the roster one', async () => {
      open([]);
      await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));
      expect(
        await screen.findByText('Nobody has changed role in this office yet.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('This office has no members yet.')).not.toBeInTheDocument();
    });

    it('goes back to the roster, and asks for it again', async () => {
      const { calls } = open([entry()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Role change log' }));
      await screen.findByRole('table');

      await userEvent.click(screen.getByRole('button', { name: /^Directory/ }));
      expect(await screen.findByLabelText('Search')).toBeInTheDocument();
      await vi.waitFor(() =>
        expect(calls[calls.length - 1].url).not.toContain('/members/role-changes'),
      );
    });
  });

  it('P3.5: carries the population in the tab label, as the prototype does', async () => {
    stubFetch({
      '/members': {
        body: {
          members: [member()],
          nextCursor: null,
          counts: { directory: 187, pending: 14, removed: 3 },
        },
      },
    });
    renderWithSession(<MembersPage />, { me: OWNER });

    expect(await screen.findByRole('button', { name: 'Directory (187)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Removed (3)' })).toBeInTheDocument();
    expect(screen.getByText('Pending (14)')).toBeInTheDocument();
    // Not a population, so no number — a count there would invite the wrong question.
    expect(screen.getByRole('button', { name: 'Role change log' })).toBeInTheDocument();
  });

  it('P3.5: indents a name by role, so the roster reads as the tree it is', async () => {
    stubFetch({
      '/members': {
        body: {
          members: [
            member({ membershipId: 'm-ab', fullName: 'An AB', preferredName: null, role: 'ab' }),
            member({ membershipId: 'm-aab', fullName: 'An AAB', preferredName: null, role: 'aab' }),
            member({ membershipId: 'm-agent', fullName: 'An Agent', preferredName: null, role: 'agent' }),
          ],
          nextCursor: null,
          counts: { directory: 3, pending: 0, removed: 0 },
        },
      },
    });
    renderWithSession(<MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    const indent = (name: string) =>
      within(table).getByRole('link', { name }).parentElement!.className;

    expect(indent('An AB')).not.toMatch(/pl-/);
    expect(indent('An AAB')).toContain('pl-4');
    expect(indent('An Agent')).toContain('pl-8');
  });

  describe('the Groups tab (P3-T9)', () => {
    const group = (over: Record<string, unknown> = {}) => ({
      groupId: 'grp-1', name: 'New Agent Mentoring Circle', ownerMembershipId: 'mem-1',
      ownerName: 'Rina Wijaya', ownerHasLeft: false, memberCount: 2, ...over,
    });

    const office = {
      nodes: [
        {
          membershipId: 'mem-1', fullName: 'Rina Wijaya', preferredName: 'Rina', initials: 'RW',
          agentCode: 'KPM0417-001', role: 'agent', depth: 0, layer: 1, leaderId: null,
          directCount: 0, subtreeCount: 0, isLeader: false, isSelf: false,
        },
      ],
      leader: null, rootIds: ['mem-1'], selfId: null,
      counts: { ab: 0, aab: 0, agent: 1, total: 1 },
    };

    function stub(groups: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
      return stubFetch({
        '/members/groups': { body: groups },
        '/members/tree': { body: office },
        '/members': { body: { members: [member()], nextCursor: null, counts: { directory: 187, pending: 14, removed: 3 } } },
        ...extra,
      });
    }

    async function openTab(groups: Record<string, unknown>[] = [group()], extra = {}) {
      const stubbed = stub(groups, extra);
      renderWithSession(<MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Groups' }));
      return stubbed;
    }

    it('AC-1: says plainly that a group is not hierarchy and grants nothing', async () => {
      // The one thing a reader could reasonably get wrong, so the screen says it.
      await openTab();
      expect(await screen.findByText(/grants nobody access to anything/)).toBeInTheDocument();
    });

    it('lists each group with its owner and how many are tagged', async () => {
      await openTab();
      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Mentoring/ });
      expect(row).toHaveTextContent('Rina Wijaya');
      expect(row).toHaveTextContent('2 people');
    });

    it('drops the roster filters, which would filter nothing here', async () => {
      await openTab();
      await screen.findByRole('table');
      expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    });

    it('creates one, sending the owner as a membership and not a name', async () => {
      const { calls } = await openTab([], { '/members/groups': { body: [] } });
      await userEvent.click(await screen.findByRole('button', { name: 'Create group' }));

      await userEvent.type(screen.getByLabelText('Group name'), '  Top Producers 2026  ');
      await userEvent.selectOptions(screen.getByLabelText('Owner'), 'mem-1');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const sent = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(sent.init.body as string)).toEqual({
        name: '  Top Producers 2026  ',
        ownerMembershipId: 'mem-1',
      });
    });

    it('offers the whole office as owner, not just the roster first page', async () => {
      // The roster pages at 25. Picking an owner from it would silently fail to offer
      // most of the office.
      const { calls } = await openTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Create group' }));

      expect(calls.some((c) => c.url.includes('/members/tree'))).toBe(true);
      expect(within(screen.getByLabelText('Owner')).getByRole('option', { name: 'Rina' }))
        .toBeInTheDocument();
    });

    it('will not save a group with no name or no owner', async () => {
      await openTab([]);
      await userEvent.click(await screen.findByRole('button', { name: 'Create group' }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Group name'), 'Named');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

      await userEvent.selectOptions(screen.getByLabelText('Owner'), 'mem-1');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('edits an existing one through the same form, prefilled', async () => {
      const { calls } = await openTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

      expect(screen.getByLabelText('Group name')).toHaveValue('New Agent Mentoring Circle');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(calls.find((c) => c.init.method === 'PUT')!.url).toContain('/members/groups/grp-1');
    });

    it('says what retiring does and does not do before doing it', async () => {
      const { calls } = await openTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Retire' }));

      expect(screen.getByText(/Retire New Agent Mentoring Circle\?/)).toBeInTheDocument();
      expect(screen.getByText(/all 2 people tagged into it keep the tag/)).toBeInTheDocument();
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

      await userEvent.click(screen.getByRole('button', { name: 'Retire group' }));
      expect(calls.find((c) => c.init.method === 'DELETE')!.url).toContain('/members/groups/grp-1');
    });

    it('counts one person in the singular', async () => {
      await openTab([group({ memberCount: 1 })]);
      await userEvent.click(await screen.findByRole('button', { name: 'Retire' }));
      expect(screen.getByText(/the person tagged into it keep the tag/)).toBeInTheDocument();
    });

    it('says when a group has lost its owner, and what to do about it', async () => {
      // Soft delete means a removed owner is still nameable. Naming them and saying
      // they have gone beats either half on its own.
      await openTab([group({ ownerHasLeft: true })]);
      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Mentoring/ });
      expect(row).toHaveTextContent('Rina Wijaya');
      expect(row).toHaveTextContent('No longer in this office — hand it to somebody else');
    });

    it('has an empty state that says what to do', async () => {
      await openTab([]);
      expect(await screen.findByText(/No groups yet — create one/)).toBeInTheDocument();
    });

    it('surfaces a clashing name rather than looking like it saved', async () => {
      // The list load answers first, the create answers second.
      await openTab([], {
        '/members/groups': [
          { body: [] },
          {
            status: 409,
            body: {
              error: {
                code: 'ORG_GROUP_NAME_TAKEN',
                message: 'This office already has a group called “Task Force”.',
                requestId: 'r-1',
              },
            },
          },
        ],
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Create group' }));
      await userEvent.type(screen.getByLabelText('Group name'), 'Task Force');
      await userEvent.selectOptions(screen.getByLabelText('Owner'), 'mem-1');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('already has a group called');
      // And the form stays open with what was typed, so it can be corrected.
      expect(screen.getByLabelText('Group name')).toHaveValue('Task Force');
    });
  });

  it('never renders for a session without the permission', () => {
    renderWithSession(<MembersPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('member:read_profile');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server error rather than an empty roster', async () => {
    stubFetch({
      '/members': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'req-9' } },
      },
    });
    renderWithSession(<MembersPage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });
});
