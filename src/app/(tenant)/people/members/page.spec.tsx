import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, digestAt, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import MembersPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    const table = await screen.findByRole('table');
    // *Leads nobody* until P18.97-T4 AC-3 (UI-024): the glossary's *No team*, as the Overview's AB list reads it.
    expect(within(table).getByRole('row', { name: /Childless AAB/ })).toHaveTextContent('No team');
    expect(within(table).getByRole('row', { name: /Leads Someone/ })).toHaveTextContent(
      '2 direct · 5 in unit',
    );
  });

  it('sends the search and role filters to the server, not just to the table', async () => {
    // A filter applied only in the browser would still have fetched every row, which is
    // the thing pagination exists to avoid.
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('cursor=25'));
    expect(await screen.findByText('KPM0417-026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('offers Previous only once there is a page to go back to', async () => {
    stubFetch({ '/members': { body: { members: [member()], nextCursor: '25', counts: { directory: 187, pending: 14, removed: 3 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('tells an empty office apart from an empty filter', async () => {
    stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'nobody');
    expect(await screen.findByText('Nobody matches that.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(await screen.findByText('This office has no members yet.')).toBeInTheDocument();
  });

  it('asks for removed members explicitly, on their own tab', async () => {
    const { calls } = stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('status=removed'));
    expect(await screen.findByText('Nobody has been removed from this office.')).toBeInTheDocument();
  });

  it('P3.5-T14: asks the server once per pause, not once per letter', async () => {
    // The search box had no debounce, so it fired a request per keystroke. Harmless while
    // the old rows stayed put; a flicker per letter once they correctly clear. The two
    // belong together.
    const { calls } = stubFetch({
      '/members': {
        body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const before = calls.length;

    await userEvent.type(screen.getByLabelText('Search'), 'Rina');

    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=Rina'));
    // Four letters, one request — and it carries the whole word, not the first letter.
    expect(calls.length - before).toBe(1);
  });

  it('P3.5-T14: clears the previous tab before the next one arrives', async () => {
    // The defect this pins. `load()` refetched on a tab switch but reset nothing, so the
    // previous tab's rows stayed on screen for the whole request — under a column header
    // that had already flipped, because the header reads `tab` synchronously. Switching
    // Directory → Removed showed active members beneath a "Removed" heading, each one
    // displaying an em dash where a removal date should be.
    let release = () => {};
    let memberCalls = 0;
    const json = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (!url.includes('/members')) return json({ items: [], unreadCount: 0 });
        memberCalls += 1;
        // The Removed request never settles here. That pending window is where the bug
        // lived, and it is the only place the assertion can be made.
        if (memberCalls > 1) await new Promise<void>((r) => { release = r; });
        return json({
          members: [member()],
          nextCursor: null,
          counts: { directory: 187, pending: 14, removed: 3 },
        });
      }),
    );

    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    expect(await screen.findByRole('row', { name: /Rina/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Removed/ }));

    await vi.waitFor(() => {
      expect(screen.queryByRole('row', { name: /Rina/ })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Loading removed members…');
    });

    // The counts survive the switch: they are the same three numbers on every tab, so
    // blanking them would put a flicker in the one part of the screen not changing.
    expect(screen.getByRole('button', { name: 'Directory (187)' })).toBeInTheDocument();

    release();
    await screen.findByRole('row', { name: /Rina/ });
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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('status=removed'));

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Removed' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Rina/ })).toHaveTextContent('19 Jul 2026');

    // Their code and their leader are still there — the row is kept, not blanked.
    expect(within(table).getByRole('row', { name: /Rina/ })).toHaveTextContent('KPM0417-001');
  });

  describe('Last activity and Last coached (P18-T1 AC-8, D-directory)', () => {
    const page = (members: ReturnType<typeof member>[]) => ({
      '/members': { body: { members, nextCursor: null, counts: { directory: members.length, pending: 0, removed: 0 } } },
    });

    it('AC-8: the directory carries both columns, beside Reports to, as the prototype places them', async () => {
      stubFetch(page([member({ lastActivityOn: '2026-10-09', lastActivityDays: 0, lastCoachedDays: 1 })]));
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      const table = await screen.findByRole('table');
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
        'Name', 'Agent code', 'Role', 'Reports to', 'Last activity', 'Last coached', 'Unit', 'Status',
      ]);
    });

    it('AC-8: Today, "{n} days ago" and Never, from the server’s counts in the office’s calendar', async () => {
      stubFetch(page([
        member({ membershipId: 'a', fullName: 'Today Person', preferredName: null, lastActivityOn: '2026-10-09', lastActivityDays: 0, lastCoachedDays: 0 }),
        member({ membershipId: 'b', fullName: 'One Day', preferredName: null, lastActivityOn: '2026-10-08', lastActivityDays: 1, lastCoachedDays: 14 }),
        member({ membershipId: 'c', fullName: 'Never Person', preferredName: null, lastActivityOn: null, lastActivityDays: null, lastCoachedDays: null }),
      ]));
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      const table = await screen.findByRole('table');
      const cells = (name: RegExp) => within(within(table).getByRole('row', { name })).getAllByRole('cell').map((c) => c.textContent);
      expect(cells(/Today Person/).slice(4, 6)).toEqual(['Today', 'Today']);
      expect(cells(/One Day/).slice(4, 6)).toEqual(['1 day ago', '14 days ago']);
      expect(cells(/Never Person/).slice(4, 6)).toEqual(['Never', 'Never']);
      // The last logged day is the machine-readable date behind the words.
      expect(within(table).getByText('1 day ago').closest('time')).toHaveAttribute('dateTime', '2026-10-08');
    });

    it('AC-8: a row the server sent without them reads a dash, never "Never"', async () => {
      stubFetch(page([member()]));
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Rina/ });
      expect(within(row).getAllByRole('cell').slice(4, 6).map((c) => c.textContent)).toEqual(['—', '—']);
    });

    it('AC-8: the Removed tab keeps its own columns, as the prototype’s does', async () => {
      stubFetch({
        '/members': { body: { members: [member({ status: 'removed', removedAt: '2026-07-19T04:00:00.000Z', lastActivityDays: 3, lastCoachedDays: 3 })], nextCursor: null } },
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Removed' }));
      const table = await screen.findByRole('table');
      await within(table).findByRole('columnheader', { name: 'Removed' });
      expect(within(table).queryByRole('columnheader', { name: 'Last activity' })).not.toBeInTheDocument();
      expect(within(table).queryByRole('columnheader', { name: 'Last coached' })).not.toBeInTheDocument();
    });

    it('AC-8: every page carries them — the next page’s rows too', async () => {
      stubFetch({
        '/members': [
          { body: { members: [member({ lastActivityDays: 2, lastCoachedDays: 5 })], nextCursor: '50', counts: { directory: 51, pending: 0, removed: 0 } } },
          { body: { members: [member({ membershipId: 'mem-51', agentCode: 'KPM0417-051', fullName: 'Last Page', preferredName: null, lastActivityDays: 9, lastCoachedDays: null })], nextCursor: null } },
        ],
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Last Page/ });
      expect(within(row).getAllByRole('cell').slice(4, 6).map((c) => c.textContent)).toEqual(['9 days ago', 'Never']);
    });
  });

  describe('the Core Leader chip and control (P18.8-T5 AC-3, ADR-0159 §1)', () => {
    const page = (members: Record<string, unknown>[]) => ({
      body: { members, nextCursor: null, counts: { directory: members.length, pending: 0, removed: 0 } },
    });
    const AGUS = member({
      membershipId: 'mem-agus', role: 'ab', fullName: 'Agus Salim', preferredName: null, isCoreLeader: true, canTagCoreLeader: true,
    });
    const SARI = member({
      membershipId: 'mem-sari', agentCode: 'KPM0417-002', role: 'aab', fullName: 'Sari Puspita', preferredName: null,
      isCoreLeader: false, canTagCoreLeader: true,
    });
    const RINA = member({ membershipId: 'mem-rina', agentCode: 'KPM0417-003', isCoreLeader: false, canTagCoreLeader: false });

    it('draws the chip on a Core Leader’s row, and the control on a leader’s row alone', async () => {
      stubFetch({ '/members': page([AGUS, SARI, RINA]) });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      const table = await screen.findByRole('table');
      const agus = within(table).getByRole('row', { name: /Agus Salim/ });
      expect(within(agus).getByText('Core Leader')).toBeInTheDocument();
      expect(within(agus).getByRole('button', { name: 'Remove the Core Leader tag from Agus Salim' })).toBeEnabled();
      const sari = within(table).getByRole('row', { name: /Sari Puspita/ });
      expect(within(sari).queryByText('Core Leader')).not.toBeInTheDocument();
      expect(within(sari).getByRole('button', { name: 'Tag Sari Puspita Core Leader' })).toHaveTextContent('+ Core Leader');
      const rina = within(table).getByRole('row', { name: /Rina/ });
      expect(within(rina).queryByRole('button', { name: /Core Leader/ })).not.toBeInTheDocument();
    });

    it('tags from the row with the flag alone, and draws what the server stored', async () => {
      const { calls } = stubFetch({
        '/members': page([SARI]),
        'PUT /members/mem-sari/core-leader': ({ body }) => ({
          body: { membershipId: 'mem-sari', fullName: 'Sari Puspita', groupIds: ['grp-1'], ...(body as object), canBeCoreLeader: true },
        }),
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Tag Sari Puspita Core Leader' }));
      const sent = calls.find((c) => c.init.method === 'PUT')!;
      expect(sent.url).toContain('/members/mem-sari/core-leader');
      expect(JSON.parse(sent.init.body as string)).toEqual({ isCoreLeader: true });
      const row = within(screen.getByRole('table')).getByRole('row', { name: /Sari Puspita/ });
      expect(await within(row).findByText('Core Leader')).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Remove the Core Leader tag from Sari Puspita' })).toBeInTheDocument();
    });

    it('says the server’s refusal, and leaves the row as it was', async () => {
      stubFetch({
        '/members': page([SARI]),
        'PUT /members/mem-sari/core-leader': {
          status: 400,
          body: { error: { code: 'CORE_LEADER_NOT_A_LEADER', message: 'Only a leader can be a Core Leader. Move them to a leader rung first.', requestId: 'r' } },
        },
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Tag Sari Puspita Core Leader' }));
      expect(await screen.findByText(/Only a leader can be a Core Leader/)).toBeInTheDocument();
      const row = within(screen.getByRole('table')).getByRole('row', { name: /Sari Puspita/ });
      expect(within(row).queryByText('Core Leader')).not.toBeInTheDocument();
    });

    it('offers no control on the Removed tab', async () => {
      stubFetch({ '/members': page([{ ...AGUS, status: 'removed', removedAt: '2026-09-01T00:00:00.000Z' }]) });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: /^Removed/ }));
      const table = await screen.findByRole('table', { name: 'Removed members' });
      expect(within(table).queryByRole('button', { name: /Core Leader/ })).not.toBeInTheDocument();
    });
  });

  it('draws every tab as one that opens, with none waiting on a later build', async () => {
    // This used to loop over the unbuilt tabs, and the list had been empty since the last one
    // shipped, so it asserted nothing. The disabled branch it guarded went with it (P10.1-T2).
    stubFetch({ '/members': { body: { members: [], nextCursor: null, counts: { directory: 0, pending: 0, removed: 0 } } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

    for (const name of [/^Directory/, /^Pending/, /^Removed/, 'Role change log', 'Groups']) {
      expect(await within(screen.getByRole('main')).findByRole('button', { name })).toBeEnabled();
    }
    expect(within(screen.getByRole('main')).queryByText(/phase/i)).not.toBeInTheDocument();
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
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
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
      expect(within(row).getByTitle('AAB')).toBeInTheDocument();
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

  describe('the Pending tab (P3.5)', () => {
    const request = (over: Record<string, unknown> = {}) => ({
      requestId: 'req-1', membershipId: 'mem-asked', fullName: 'Putri Anggraini', initials: 'PA',
      email: 'putri@kpm0417.test', agentCode: 'KPM0417-008', role: 'agent',
      requestedAt: '2026-09-01T00:00:00.000Z', routedFromName: null, ...over,
    });

    const asked = member({
      membershipId: 'mem-asked', fullName: 'Putri Anggraini', preferredName: null,
      agentCode: 'KPM0417-008', email: 'putri@kpm0417.test', status: 'pending',
    });
    const unasked = member({
      membershipId: 'mem-unasked', fullName: 'Fajar Nugroho', preferredName: null,
      agentCode: 'KPM0417-009', email: 'fajar@kpm0417.test', status: 'pending',
    });

    function open(waiting = [asked, unasked], queue = [request()], extra = {}) {
      const stub = stubFetch({
        '/join/requests': { body: queue },
        '/members': {
          body: {
            members: waiting,
            nextCursor: null,
            counts: { directory: 8, pending: waiting.length, removed: 1 },
          },
        },
        ...extra,
      });
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
      return stub;
    }

    async function openTab(...args: Parameters<typeof open>) {
      const stub = open(...args);
      await userEvent.click(await screen.findByRole('button', { name: /^Pending/ }));
      await screen.findByRole('table');
      return stub;
    }

    /** *Approve*, which opens the row's *Join date* (P18.96-T7 G1), and *Approve* again, which sends it. */
    async function approve() {
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    }

    it('lists everybody registered but not yet in a unit, not only those who asked', async () => {
      // The bug this closes: the tab counted pending memberships and rendered open
      // requests. Somebody who registered and asked nobody was counted and never shown —
      // and they are the ones most in need of finding.
      await openTab();
      const table = screen.getByRole('table');
      expect(within(table).getByRole('row', { name: /Putri/ })).toBeInTheDocument();
      expect(within(table).getByRole('row', { name: /Fajar/ })).toBeInTheDocument();
    });

    it('the count matches the rows, because both are the same population', async () => {
      await openTab();
      expect(screen.getByRole('button', { name: 'Pending (2)' })).toBeInTheDocument();
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3); // header + 2
    });

    it('offers a decision only where there is one to make', async () => {
      await openTab();
      const table = screen.getByRole('table');

      const withAsk = within(table).getByRole('row', { name: /Putri/ });
      expect(within(withAsk).getByRole('button', { name: 'Approve' })).toBeInTheDocument();

      const without = within(table).getByRole('row', { name: /Fajar/ });
      expect(within(without).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(without).toHaveTextContent('They have asked no leader');
    });

    it('says approving puts them under the leader they asked for, not under you', async () => {
      await openTab();
      expect(screen.getByText(/the leader they asked for/)).toBeInTheDocument();
    });

    it('approves through the queue', async () => {
      const { calls } = await openTab([asked], [request()], {
        '/join/requests/req-1/approve': { body: [] },
      });
      await approve();
      expect(calls.find((c) => c.init.method === 'POST')!.url).toContain('/req-1/approve');
    });

    it('P18.96-T7 G1 Approve asks for the join date — the shared field, today by default — and sends it', async () => {
      const today = dayInZone(OFFICE_TIME_ZONE, new Date());
      const { calls } = await openTab([asked], [request()], {
        '/join/requests/req-1/approve': { body: [] },
      });
      const putri = within(screen.getByRole('table')).getByRole('row', { name: /Putri/ });
      await userEvent.click(within(putri).getByRole('button', { name: 'Approve' }));
      // Nothing is sent yet: the first press opens the row's *Join date*.
      expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);
      const field = within(putri).getByLabelText('Join date');
      expect(field).toHaveAttribute('type', 'date');
      expect(field).toHaveValue(today);
      expect(field).toHaveAttribute('max', today);
      expect(within(putri).getByText('The day they joined. Today unless they joined earlier.')).toBeInTheDocument();

      // An earlier day, as a leader corrects it: the face writes it the app's way, and the second press sends it.
      fireEvent.change(field, { target: { value: '2026-09-01' } });
      expect(field.nextElementSibling).toHaveTextContent('1 Sep 2026');
      await userEvent.click(within(putri).getByRole('button', { name: 'Approve' }));
      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(post.url).toContain('/join/requests/req-1/approve');
      expect(JSON.parse(String(post.init.body))).toEqual({ joinDate: '2026-09-01' });
    });

    it('P18.96-T7 G1 a join date after today is refused before it is sent, and Cancel puts the row back', async () => {
      const { calls } = await openTab([asked], [request()]);
      const putri = within(screen.getByRole('table')).getByRole('row', { name: /Putri/ });
      await userEvent.click(within(putri).getByRole('button', { name: 'Approve' }));
      fireEvent.change(within(putri).getByLabelText('Join date'), { target: { value: '2999-01-01' } });
      expect(within(putri).getByText(/^The join date cannot be after today, /)).toBeInTheDocument();
      expect(within(putri).getByRole('button', { name: 'Approve' })).toBeDisabled();

      await userEvent.click(within(putri).getByRole('button', { name: 'Cancel' }));
      expect(within(putri).queryByLabelText('Join date')).not.toBeInTheDocument();
      expect(within(putri).getByRole('button', { name: 'Decline' })).toBeInTheDocument();
      expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);
    });

    it('has an empty state that says the office is clear', async () => {
      open([], []);
      await userEvent.click(await screen.findByRole('button', { name: /^Pending/ }));
      expect(await screen.findByText('Everybody who has registered is in a unit.')).toBeInTheDocument();
    });

    it('surfaces a refusal rather than looking like it worked', async () => {
      await openTab([asked], [request()], {
        '/join/requests/req-1/approve': {
          status: 409,
          body: {
            error: {
              code: 'ORG_REQUEST_ALREADY_DECIDED',
              message: 'That request was already approved.',
              requestId: 'r-1',
            },
          },
        },
      });
      await approve();
      expect(await screen.findByRole('alert')).toHaveTextContent('already approved');
    });

    it('P13.2 exit review: an approval at the leader limit is said in the limit’s words, never the code', async () => {
      await openTab([asked], [request()], {
        '/join/requests/req-1/approve': {
          status: 409,
          body: {
            error: {
              code: 'LEADER_LIMIT_REACHED',
              message: 'This office has reached its limit of 3 leaders.',
              details: { maxLeaders: 3, leadersUsed: 3 },
              requestId: 'r-2',
            },
          },
        },
      });
      await approve();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This office has reached its limit of 3 leaders, so nobody else can be made an AB or an AAB.');
      expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    });

    it('P18.8-T2 AC-6: asks AgencyBoost to let the joiner in, and the row then waits with Cancel request', async () => {
      const waitingRow = {
        requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
        subjectMembershipId: 'mem-asked', subjectName: 'Putri Anggraini', subjectAgentCode: '88008', action: 'activate',
        fromOrgLevelCode: 'AAB', toOrgLevelCode: null, reason: null, requestedByMembershipId: 'mem-owner',
        requestedByName: 'Wilson', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
        declineReason: null, maxLeaders: 3, leadersUsed: 3,
      };
      await openTab([asked], [request({ role: 'aab' })], {
        '/join/requests/req-1/approve': {
          status: 409,
          body: {
            error: {
              code: 'LEADER_LIMIT_REACHED', message: 'x', requestId: 'r-2',
              details: { maxLeaders: 3, leadersUsed: 3, canRequest: true },
            },
          },
        },
        '/members/leader-limit-requests': [{ body: [] }, { body: [waitingRow] }],
        'POST /members/mem-asked/leader-limit-request': { status: 201, body: waitingRow },
      });
      await approve();
      const alert = await screen.findByRole('alert');
      await userEvent.click(within(alert).getByRole('button', { name: 'Ask AgencyBoost to approve' }));
      expect(await screen.findByText("Waiting for AgencyBoost's approval")).toBeInTheDocument();
      expect(screen.getByText('Let in as AAB')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

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
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });

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
      renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
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
    // An office reader without the grant: anybody else is not refused here but sent to their own landing
    // (2026-10-11, `shell-family.spec.tsx`).
    renderInLayout(TenantLayout, <MembersPage />, { me: makeMe({ ...OWNER, permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'member:read_profile');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server error rather than an empty roster', async () => {
    stubFetch({
      '/members': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'req-9' } },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });
});

/**
 * **Below 1024px the five tabs are one row that scrolls sideways** (P18.97-T6 AC-4, ADR-0178 §2; the client's KPM Owner
 * review of 2026-10-27, UI-038: *Directory (28) · Pending (2) · Removed (2) · Role change log · Groups* on two rows at
 * 768px and at 375px). The shared tab row every strip has on a phone — `useTabRow` and the row's classes, a range wider
 * (`tablet.ts`) — so the side that has more fades and the current tab is brought into view. The tabs stay this row's
 * own buttons, with their names and `aria-current`; a row that fits reads as it did, and from 1024px it wraps as before.
 */
/**
 * **Who came back, codes on one line, and *No team*** (P18.97-T4 AC-3, ADR-0176 §2, §5; the client's KPM Owner review
 * of 2026-10-27, UI-024: *Yanti Kusuma … in Directory with status ACTIVE while a "Removed (2)" tab exists*, *"PRU- /
 * 80003"*, *"Leads nobody"*). Yanti left and came back — two memberships, one removed and one active (invariant §2) —
 * and `GET /members` marks both (`rejoinedOn`, the server's): *Rejoined* beside her status, *Rejoined {date}* under
 * *Removed*.
 */
describe('P18.97-T4 AC-3 the directory says who came back, on one line each', () => {
  afterEach(() => vi.unstubAllGlobals());

  const YANTI = member({
    membershipId: 'mem-yanti-2', agentCode: 'PRU-80003', fullName: 'Yanti Kusuma', preferredName: null,
    email: 'removed@kpm0417.test', rejoinedOn: '2026-09-30',
  });
  const RINA = member({ agentCode: 'PRU-80001', rejoinedOn: null });
  const COUNTS = { directory: 28, pending: 2, removed: 2 };

  it('P18.97-T4 AC-3 marks a member who came back Rejoined beside her status, and nobody else', async () => {
    stubFetch({ '/members': { body: { members: [RINA, YANTI], nextCursor: null, counts: COUNTS } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const table = await screen.findByRole('table');
    const yanti = within(table).getByRole('row', { name: /Yanti Kusuma/ });
    const status = within(yanti).getAllByRole('cell').at(-1)!;
    expect(status).toHaveTextContent(/^ActiveRejoined$/i);
    expect(within(table).getByRole('row', { name: /Rina/ })).not.toHaveTextContent(/Rejoined/i);
  });

  it('P18.97-T4 AC-3 reads Rejoined {date} under Removed on the membership she left', async () => {
    const { calls } = stubFetch({
      '/members': {
        body: {
          members: [member({
            membershipId: 'mem-yanti-1', agentCode: 'PRU-80003', fullName: 'Yanti Kusuma', preferredName: null,
            status: 'removed', removedAt: '2026-09-10T04:00:00.000Z', rejoinedOn: '2026-09-30',
          })],
          nextCursor: null,
          counts: COUNTS,
        },
      },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: /^Removed/ }));
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('status=removed'));
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Yanti Kusuma/ });
    const removed = within(row).getAllByRole('cell').at(-1)!;
    expect(removed).toHaveTextContent('10 Sep 2026Rejoined 30 Sep 2026');
    expect(within(removed).getByText('30 Sep 2026')).toHaveAttribute('dateTime', '2026-09-30');
  });

  it('P18.97-T4 AC-3 keeps an agent code on one line, and says No team for one who leads nobody', async () => {
    stubFetch({ '/members': { body: { members: [YANTI], nextCursor: null, counts: COUNTS } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Yanti Kusuma/ });
    const code = within(row).getByText('PRU-80003');
    for (const px of [375, 768, 1280]) expect(wears(code.closest('td')!, px).split(' ')).toContain('whitespace-nowrap');
    expect(row).toHaveTextContent('No team');
    expect(row).not.toHaveTextContent('Leads nobody');
  });

  it('P18.97-T4 AC-3 marks nothing for a read older than the mark', async () => {
    const { rejoinedOn: _gone, ...older } = YANTI as Record<string, unknown>;
    stubFetch({ '/members': { body: { members: [older], nextCursor: null, counts: COUNTS } } });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Yanti Kusuma/ });
    expect(row).not.toHaveTextContent(/Rejoined/i);
  });
});

describe('P18.97-T6 AC-4 below 1024px the members’ tabs are one row that scrolls sideways', () => {
  afterEach(() => vi.unstubAllGlobals());

  const NAMES = ['Directory (28)', 'Pending (2)', 'Removed (2)', 'Role change log', 'Groups'];
  const COUNTS = { directory: 28, pending: 2, removed: 2 };
  const empty = { body: { members: [], nextCursor: null, counts: COUNTS } };
  async function open(px: number) {
    atWidth(px);
    stubFetch({
      '/members/role-changes': { body: [] },
      '/members/groups': { body: [] },
      '/members/tree': { body: { nodes: [], leader: null, rootIds: [], selfId: null, counts: { ab: 0, aab: 0, agent: 0, total: 0 } } },
      '/join/inbox': { body: [] },
      '/leader-limit-requests': { body: [] },
      '/members': empty,
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const first = await screen.findByRole('button', { name: 'Directory (28)' });
    return { row: first.parentElement!, tabs: () => NAMES.map((name) => screen.getByRole('button', { name })) };
  }
  /** The row's widths, which jsdom never lays out: `content` wide inside `visible`, a tab every 100px, 90 wide. */
  function layOut(row: HTMLElement, { content, visible }: { content: number; visible: number }) {
    let left = 0;
    Object.defineProperty(row, 'scrollWidth', { configurable: true, get: () => content });
    Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => visible });
    Object.defineProperty(row, 'scrollLeft', {
      configurable: true,
      get: () => left,
      set: (v: number) => { left = Math.max(0, Math.min(content - visible, v)); },
    });
    row.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: visible, height: 44 });
    Array.from(row.children).forEach((tab, i) => {
      (tab as HTMLElement).getBoundingClientRect = () => DOMRect.fromRect({ x: i * 100 - left, y: 0, width: 90, height: 44 });
    });
    return { get left() { return left; } };
  }
  /** The row as it would be printed at a width: each element's classes those that hold there, the row's own mark gone. */
  function drawnAt(row: HTMLElement, px: number) {
    const copy = row.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...Array.from(copy.querySelectorAll('*'))]) el.setAttribute('class', wears(el, px));
    copy.removeAttribute('data-tab-row');
    return copy.outerHTML;
  }
  /** The row's markup on the build before P18.97-T6 (frontend `68d8d61`), rendered from this fixture on 2026-10-28. */
  const BEFORE_T6 = '51f635406879ce0477d17fb36ddcb693d849a183cc6c9dcdfc52d907db15cc7d';

  it.each([767, 768, 1023])('P18.97-T6 AC-4 at %ipx the row does not wrap: it scrolls inside its own box, the hairline painted in it', async (px) => {
    const { row, tabs } = await open(px);
    const worn = wears(row, px).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto', 'overflow-y-hidden', 'border-b-0']));
    expect(worn).toContain('shadow-[inset_0_-1px_0_var(--color-hairline)]');
    expect(row).toHaveAttribute('data-tab-row', 'below-desktop');
    for (const tab of tabs()) {
      // One line each, never squeezed, the rule lying on the painted hairline, the ring inside the tab's edge.
      expect(wears(tab, px).split(' ')).toEqual(expect.arrayContaining(['mb-0', 'shrink-0', 'whitespace-nowrap']));
      expect(wears(tab, px)).toContain('focus-visible:[outline-offset:-2px]');
    }
  });

  it.each([1024, 1280])('P18.97-T6 AC-4 at %ipx the row is drawn as it was, to the byte, and wraps', async (px) => {
    const { row } = await open(px);
    expect(createHash('sha256').update(drawnAt(row, px)).digest('hex')).toBe(BEFORE_T6);
    expect(wears(row, px)).toBe('mb-6 flex flex-wrap gap-6 border-b border-hairline');
    expect(row).not.toHaveAttribute('data-fade');
  });

  it('P18.97-T6 AC-4 keeps the five tabs this row’s own buttons — their names, order, the current one marked', async () => {
    const { row, tabs } = await open(768);
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(NAMES);
    expect(tabs()[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('tablist')).toBeNull();
    await userEvent.click(tabs()[3]);
    expect(screen.getByRole('button', { name: 'Role change log' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Directory (28)' })).not.toHaveAttribute('aria-current');
  });

  it('P18.97-T6 AC-4 says nothing about a fade while the row fits — a tablet on the rail', async () => {
    const { row } = await open(1023);
    layOut(row, { content: 480, visible: 632 });
    fireEvent.scroll(row);
    expect(row).not.toHaveAttribute('data-fade');
  });

  it('P18.97-T6 AC-4 fades the side that has more, and follows the reader scrolling', async () => {
    const { row } = await open(768);
    const box = layOut(row, { content: 500, visible: 436 });
    fireEvent.scroll(row);
    expect(row).toHaveAttribute('data-fade', 'end');
    row.scrollLeft = 30;
    fireEvent.scroll(row);
    expect(box.left).toBe(30);
    expect(row).toHaveAttribute('data-fade', 'both');
    row.scrollLeft = 64;
    fireEvent.scroll(row);
    expect(row).toHaveAttribute('data-fade', 'start');
  });

  it('P18.97-T6 AC-4 brings the chosen tab into view by scrolling the row alone — never the page', async () => {
    const { row, tabs } = await open(767);
    const box = layOut(row, { content: 520, visible: 335 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      await userEvent.click(tabs()[4]);
      // *Groups*, 400–490, is brought clear of the 24px fade at the row's right edge, 335: 490 − (335 − 24).
      expect(box.left).toBe(179);
      expect(row).toHaveAttribute('data-fade', 'both');
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      scrollTo.mockRestore();
    }
  });
});

/**
 * **The directory as cards on a phone** (P18.97-T7 AC-1, ADR-0178 §4; the client's KPM Owner review of 2026-10-27,
 * UI-034: *All members*, 839px). Below 768px a card per member — on *Directory* and on *Removed*, which draw the same
 * roster — each label above its value, through the shared card pieces (`components/ui/row-cards.tsx`), keeping what
 * P18.97-T4 put on the row: *No team*, *Rejoined*, a code on one line. At 768px and wider the table it was, to the byte.
 */
describe('P18.97-T7 AC-1 the directory as cards on a phone (UI-034)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const COUNTS = { directory: 28, pending: 2, removed: 2 };
  const WILSON = member({
    membershipId: 'mem-wilson', agentCode: 'PRU-80000', role: 'ab', fullName: 'Wilson Tanoto', preferredName: null,
    email: 'wilson@kpm0417.test', isKpmOwner: true, isLeader: true, directCount: 3, subtreeCount: 27,
    isCoreLeader: true, canTagCoreLeader: true, lastActivityDays: 0, lastActivityOn: '2026-10-27', lastCoachedDays: null,
  });
  const MAYA = member({
    membershipId: 'mem-maya', agentCode: 'PRU-80002', role: 'ab', fullName: 'Maya Halim', preferredName: null,
    email: 'maya@kpm0417.test', isKpmAdmin: true, leaderName: 'Wilson Tanoto', canTagCoreLeader: true,
    lastActivityDays: 3, lastActivityOn: '2026-10-24', lastCoachedDays: 12,
  });
  const YANTI = member({
    membershipId: 'mem-yanti-2', agentCode: 'PRU-80003', fullName: 'Yanti Kusuma', preferredName: null, role: 'agent',
    email: 'yanti@kpm0417.test', leaderName: 'Maya Halim', rejoinedOn: '2026-09-30', lastActivityDays: null, lastCoachedDays: null,
  });
  const LEFT = member({
    membershipId: 'mem-yanti-1', agentCode: 'PRU-80003', fullName: 'Yanti Kusuma', preferredName: null, role: 'agent',
    email: 'yanti@kpm0417.test', leaderName: 'Maya Halim', status: 'removed', removedAt: '2026-09-10T04:00:00.000Z',
    rejoinedOn: '2026-09-30',
  });
  const page = (members: unknown[]) => ({ body: { members, nextCursor: null, counts: COUNTS } });
  const routes = (removed = false) => ({
    '/members/role-changes': { body: [] },
    '/members/groups': { body: [] },
    '/join/inbox': { body: [] },
    '/leader-limit-requests': { body: [] },
    '/members': removed ? [page([WILSON, MAYA, YANTI]), page([LEFT])] : page([WILSON, MAYA, YANTI]),
  });

  /** The roster's markup on the build before P18.97-T7, each tab, rendered from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<'directory' | 'removed', Record<768 | 1280, string>> = {
    directory: {
      768: '926198cdebf3c343171ffcd31a56a896996b2cde56758de931ff99b3c058a145',
      1280: '926198cdebf3c343171ffcd31a56a896996b2cde56758de931ff99b3c058a145',
    },
    removed: {
      768: 'f0d066d19130c1cc24fc76ae97c6617d21dfb5f5c581d23f72ae2411a564f7c2',
      1280: 'f0d066d19130c1cc24fc76ae97c6617d21dfb5f5c581d23f72ae2411a564f7c2',
    },
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-1 at %ipx draws the directory’s and Removed’s tables as they were, to the byte', async (px) => {
    atWidth(px);
    stubFetch(routes(true));
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const directory = await screen.findByRole('table', { name: 'Office roster' });
    expect(digestAt(directory.parentElement!, px)).toBe(BEFORE_T7.directory[px]);
    await userEvent.click(screen.getByRole('button', { name: /^Removed/ }));
    const removed = await screen.findByRole('table', { name: 'Removed members' });
    expect(digestAt(removed.parentElement!, px)).toBe(BEFORE_T7.removed[px]);
  });
  const cardOf = (name: string) => screen.getByRole('link', { name }).closest('li')!;
  const fields = (card: HTMLElement) => Object.fromEntries([...card.querySelectorAll('dl > div')]
    .map((field) => [field.querySelector('dt')!.textContent, field.querySelector('dd')!.textContent]));

  it.each([375, 767])('P18.97-T7 AC-1 at %ipx draws a card per member and no table, each value under its heading', async (px) => {
    atWidth(px);
    stubFetch(routes());
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    const list = await screen.findByRole('list', { name: 'Office roster' });
    expect(screen.queryByRole('table', { name: 'Office roster' })).not.toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    const wilson = cardOf('Wilson Tanoto');
    // The name, the person page's link, with the rung's badge and the tags on its line; the email under it.
    expect(within(wilson).getByRole('link', { name: 'Wilson Tanoto' })).toHaveAttribute('href', '/people/members/mem-wilson');
    expect(within(wilson).getByTitle('AB')).toBeInTheDocument();
    expect(within(wilson).getByText('Owner')).toBeInTheDocument();
    expect(within(wilson).getByText('Core Leader')).toBeInTheDocument();
    expect(wilson).toHaveTextContent('wilson@kpm0417.test');
    expect(fields(wilson)).toEqual({ 'Agent code': 'PRU-80000', 'Last activity': 'Today', 'Last coached': 'Never', Unit: '3 direct · 27 in unit' });
    expect(fields(cardOf('Maya Halim'))).toEqual({
      'Agent code': 'PRU-80002', 'Reports to': 'Wilson Tanoto', 'Last activity': '3 days ago', 'Last coached': '12 days ago', Unit: 'No team',
    });
    expect(within(cardOf('Maya Halim')).getByText('Admin')).toBeInTheDocument();
  });

  it('P18.97-T7 AC-1 keeps what P18.97-T4 put on the row: Rejoined beside her status, a code on one line, No team', async () => {
    atWidth(375);
    stubFetch(routes());
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await screen.findByRole('list', { name: 'Office roster' });
    const yanti = cardOf('Yanti Kusuma');
    expect(within(yanti).getByText('Active')).toBeInTheDocument();
    expect(within(yanti).getByText('Rejoined')).toBeInTheDocument();
    expect(within(cardOf('Maya Halim')).queryByText('Rejoined')).not.toBeInTheDocument();
    const code = within(yanti).getByText('PRU-80003');
    expect(code.className).toContain('whitespace-nowrap');
    expect(fields(yanti)).toMatchObject({ Unit: 'No team', 'Reports to': 'Maya Halim', 'Last activity': 'Never', 'Last coached': 'Never' });
    // A value the table writes as — is not drawn: Wilson reports to nobody (the first card's fields have no *Reports to*).
    expect(fields(cardOf('Wilson Tanoto'))).not.toHaveProperty('Reports to');
  });

  it('P18.97-T7 AC-1 draws Removed as cards too: the day she left, and Rejoined {date}', async () => {
    atWidth(375);
    stubFetch(routes(true));
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await screen.findByRole('list', { name: 'Office roster' });
    await userEvent.click(screen.getByRole('button', { name: /^Removed/ }));
    const list = await screen.findByRole('list', { name: 'Removed members' });
    const left = within(list).getAllByRole('listitem')[0];
    expect(fields(left)).toEqual({
      'Agent code': 'PRU-80003', 'Reports to': 'Maya Halim', Unit: 'No team', Removed: '10 Sep 2026Rejoined 30 Sep 2026',
    });
    expect(within(left).getByText('30 Sep 2026')).toHaveAttribute('dateTime', '2026-09-30');
    // No status pill and no activity on a membership that has ended, as on the Removed table.
    expect(within(left).queryByText('Active')).not.toBeInTheDocument();
    expect(within(left).queryByRole('button', { name: /Core Leader/ })).not.toBeInTheDocument();
  });

  it('P18.97-T7 AC-1 tags and untags a Core Leader from the card, a 44px target on a phone', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      ...routes(),
      'PUT /members/mem-maya/core-leader': ({ body }) => ({
        body: { membershipId: 'mem-maya', fullName: 'Maya Halim', groupIds: [], ...(body as object), canBeCoreLeader: true },
      }),
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await screen.findByRole('list', { name: 'Office roster' });
    const tag = within(cardOf('Maya Halim')).getByRole('button', { name: 'Tag Maya Halim Core Leader' });
    expect(wears(tag, 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    expect(wears(within(cardOf('Maya Halim')).getByRole('link', { name: 'Maya Halim' }), 375).split(' ')).toContain('min-h-11');
    await userEvent.click(tag);
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/members/mem-maya/core-leader') && c.init.method === 'PUT')).toBe(true));
    expect(await within(cardOf('Maya Halim')).findByText('Core Leader')).toBeInTheDocument();
  });

  it('P18.97-T7 AC-1 never draws the roster’s table first on a phone: the width is asked before the roster answers', async () => {
    atWidth(375);
    stubFetch(routes());
    let drew = false;
    // The roster's table, that is: the frame before the width answers is a skeleton (`role="status"`).
    const roster = (el: Element) => [el, ...el.querySelectorAll('table')]
      .some((t) => t.matches('table') && t.closest('[role="status"]') === null);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element && roster(node)) drew = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER });
    await screen.findByRole('list', { name: 'Office roster' });
    observer.disconnect();
    expect(drew).toBe(false);
  });
});
