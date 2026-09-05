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
    stubFetch({ '/members': { body: { members: [member()], nextCursor: null } } });
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
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null } } });
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
        { body: { members: [member()], nextCursor: '25' } },
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
    stubFetch({ '/members': { body: { members: [member()], nextCursor: '25' } } });
    renderWithSession(<MembersPage />, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('tells an empty office apart from an empty filter', async () => {
    stubFetch({ '/members': { body: { members: [], nextCursor: null } } });
    renderWithSession(<MembersPage />, { me: OWNER });

    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'nobody');
    expect(await screen.findByText('Nobody matches that.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();
  });

  it('asks for removed members explicitly, on their own tab', async () => {
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null } } });
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
    stubFetch({ '/members': { body: { members: [], nextCursor: null } } });
    renderWithSession(<MembersPage />, { me: OWNER });
    for (const label of ['Pending', 'Groups']) {
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
        '/members': { body: { members: [], nextCursor: null } },
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

      await userEvent.click(screen.getByRole('button', { name: 'Directory' }));
      expect(await screen.findByLabelText('Search')).toBeInTheDocument();
      await vi.waitFor(() =>
        expect(calls[calls.length - 1].url).not.toContain('/members/role-changes'),
      );
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
