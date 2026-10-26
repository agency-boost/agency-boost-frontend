import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import AddAgentsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/add',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: [
    'member:invite', 'member:revoke_invite', 'member:search_untagged_pool',
    // A leader manages their team from this screen; the card is gated on being able to
    // act on it, not on the role (`agent-shell` gates the Pending tab the same way).
    'member:change_role', 'member:remove_from_team',
  ],
});

/**
 * An agent, holding what the matrix actually grants one: **neither** half of this screen.
 *
 * This fixture carried `member:invite` and `member:revoke_invite` until 2026-09-08.
 * `roles-and-permissions.md:372` denies both to `AGENT` and calls it *"the single largest
 * leak in the prototype"* — so the fixture was asserting against a role that cannot
 * exist, and it is why nothing caught the screen being open to them (P3.6-T2 AC-3).
 */
const AGENT = makeMe({
  membership: {
    membershipId: 'mem-agent', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: [],
});

/**
 * A leader's own code. Two fields, because there is no lifecycle left to describe.
 *
 * This fixture carried `inviteId`, `label`, `autoApprove`, `maxUses`, `useCount`,
 * `expiresAt`, `revokedAt` and `state` until 2026-09-09 — every one of them a way to
 * bound a credential somebody could mint again (P3.6-T1).
 */
const MY_CODE = { code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417' };

describe('inviting people (P3-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P3.5-T14: clears the search results before the next search answers', async () => {
    // The untagged search refetched on every keystroke and cleared nothing, so the
    // previous query's people sat there looking exactly like an answer to the new one.
    // Somebody types three more letters and acts on a list that answers the search
    // before it.
    let release = () => {};
    let searches = 0;
    const json = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/join/untagged')) {
          searches += 1;
          if (searches > 1) await new Promise<void>((r) => { release = r; });
          return json([
            {
              membershipId: 'mem-x', fullName: 'Budi Santoso', preferredName: null,
              initials: 'BS', agentCode: 'KPM0417-009', directCount: 0,
            },
          ]);
        }
        if (url.includes('/join/my-code') || url.includes('/members/my-team')) return json([]);
        return json({ items: [], unreadCount: 0 });
      }),
    );

    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search by name'), 'z');

    await vi.waitFor(() => {
      expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument();
      expect(screen.getByText('Searching untagged agents…')).toBeInTheDocument();
    });

    release();
    await screen.findByText('Budi Santoso');
  });

  it('says plainly that a code skips approval', async () => {
    // It is the whole difference from asking a leader, and the reason the code is worth
    // guarding at all.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText(/no approval needed/)).toBeInTheDocument();
  });

  it('AC-1: shows the code and the link as one artefact, not two', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    // Once now, not twice: the list of what you have issued went with the lifecycle.
    expect(await screen.findAllByText('JOR417')).toHaveLength(1);
    expect(screen.getByText('https://agencyboost.app/join?code=JOR417')).toBeInTheDocument();
  });

  it('AC-1: shows the whole link, and names what each button copies', async () => {
    // `User_Management_Section.html:446` shows the full URL; `Overall.html:3580`
    // truncates it and copies something longer. The section file supersedes for this
    // module, and what is shown must be what is copied either way.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    const link = await screen.findByText('https://agencyboost.app/join?code=JOR417');
    expect(link.textContent).toBe('https://agencyboost.app/join?code=JOR417');
    expect(link.textContent).not.toMatch(/…|\.\.\./);

    // Two artefacts, two buttons that say which is which (`:447`, `:452`). A bare
    // "Copy" twice is indistinguishable to anybody reading the buttons alone.
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('P18.95-T1 AC-6: says Link copied ✓ and Code copied ✓ in the shell’s toast, beside each box’s Copied.', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenLastCalledWith('https://agencyboost.app/join?code=JOR417');
    const toast = await screen.findByText('Link copied ✓');
    expect(toast.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Copied.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenLastCalledWith('JOR417');
    // The later toast replaces the earlier one: one region, nothing stacked.
    expect(await screen.findByText('Code copied ✓')).toBeInTheDocument();
    expect(screen.queryByText('Link copied ✓')).not.toBeInTheDocument();
  });

  it('P18.95-T1 AC-6: a copy that fails toasts nothing, and says so under its button', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
    expect(screen.queryByText('Link copied ✓')).not.toBeInTheDocument();
  });

  it('AC-2: hides the team card from somebody who cannot act on a team', async () => {
    // The prototype hides this card for an Agent alongside the Pending tab
    // (`User_Management_Section.html:999`). It gives the reason as "an Agent has no
    // team", which OD-23 makes unreliable — an Agent may have reports. What matters is
    // whether they can change a role or remove anybody, so that is the gate.
    //
    // The reader here used to be AGENT. An Agent cannot open this screen at all now
    // (P3.6-T2), so proving *this* gate needs somebody who can — a leader whose team
    // permissions have been taken away.
    const noTeamPowers = makeMe({
      membership: {
        membershipId: 'mem-ab2', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:invite', 'member:revoke_invite', 'member:search_untagged_pool'],
    });
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: noTeamPowers });

    expect(await screen.findByText('Invite someone')).toBeInTheDocument();
    expect(screen.queryByText('Your team')).toBeNull();
  });

  it('AC-1/AC-2: refuses the screen to an Agent, tab and URL alike', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: AGENT });

    // The URL is typeable, so hiding the tab is not gating the screen.
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'member:search_untagged_pool');
    expect(screen.queryByText('Invite someone')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Add New Agents' })).toBeNull();
  });

  it('AC-2: keeps the team card for a leader who can act on it', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText('Your team')).toBeInTheDocument();
  });

  it('AC-1: hides the Pending Requests tab from somebody with no inbox', async () => {
    // The prototype hides it by role (`User_Management_Section.html:996`); we hide it by
    // the permission that decides the same thing, so it survives the role becoming a
    // ladder reference. Hiding is a convenience — the API refuses an Agent regardless.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    // A leader with no inbox: they may open this screen, which is what makes the missing
    // Pending tab the thing under test rather than a side effect of being refused.
    const noInbox = makeMe({
      membership: {
        membershipId: 'mem-ab3', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 0,
      },
      permissions: ['member:invite', 'member:revoke_invite', 'member:search_untagged_pool'],
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: noInbox });

    expect(await screen.findByRole('link', { name: 'Add New Agents' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pending Requests' })).toBeNull();
  });

  it('AC-1: shows it to a leader who has an inbox', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, {
      me: makeMe({
        membership: LEADER.membership,
        permissions: [...LEADER.permissions, 'leader_request:read_inbox'],
      }),
    });

    expect(await screen.findByRole('link', { name: 'Pending Requests' })).toBeInTheDocument();
  });

  it('shows the same code every time, with no way to make or withdraw one', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    await screen.findByText('Invite someone');
    // The prototype has neither control, and neither do we (P3.6-T1).
    expect(screen.queryByRole('button', { name: 'Create an invite' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
    // Nor the form that fed them.
    expect(screen.queryByLabelText('What is it for')).toBeNull();
    expect(screen.queryByLabelText('How many people')).toBeNull();
    expect(screen.queryByLabelText('Stops working')).toBeNull();
    // Nor the list of what has been out there.
    expect(screen.queryByText('Your invites')).toBeNull();
  });

  it('says the code does not change, rather than that it can be withdrawn', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText(/it came with your membership and it does not change/))
      .toBeInTheDocument();
    expect(screen.queryByText(/Withdrawing the invite/)).toBeNull();
  });

  it('asks for the code once, not once per artefact', async () => {
    const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    await screen.findAllByText('JOR417');
    expect(calls.filter((c) => c.url.includes('/join/my-code'))).toHaveLength(1);
  });

  it('waits with a placeholder shaped like the three artefacts', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    // `role="status"` takes no accessible name from its contents, so the label is
    // asserted as text — which is how `skeleton.spec.tsx` reads one too.
    // Two things load on this screen, so the query names one: `role="status"` takes no
    // accessible name from its contents, which is why this reads the text instead.
    const waiting = screen
      .getAllByRole('status')
      .filter((el) => el.textContent?.includes('Loading your leader code…'));
    expect(waiting).toHaveLength(1);

    await screen.findAllByText('JOR417');
    expect(
      screen.queryAllByRole('status')
        .filter((el) => el.textContent?.includes('Loading your leader code…')),
    ).toEqual([]);
  });

  describe('changing a role (P3-T6)', () => {
    const teamMember = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
      agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true, ...over,
    });

    function stub(team: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
      return stubFetch({
        '/join/my-code': { body: MY_CODE },
        '/join/untagged': { body: [] },
        '/members/my-team': { body: team },
        ...extra,
      });
    }

    it('says a role change moves nobody, which is the thing people assume it does', async () => {
      stub([teamMember()]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });
      expect(await screen.findByText(/changing it moves nobody/)).toBeInTheDocument();
    });

    it('AC-1: shows the control only where the server says it may', async () => {
      // The rule is a server rule, and the row carries the answer — the screen keeps no
      // second copy of it that could drift.
      stub([
        teamMember(),
        teamMember({ membershipId: 'mem-ab', fullName: 'An AB', role: 'ab', canChangeRole: false }),
      ]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      expect(await screen.findByLabelText('Role')).toBeInTheDocument();
      expect(screen.getByTitle('Agency Builder')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Role')).toHaveLength(1);
    });

    it('explains the change in the prototype own words before confirming', async () => {
      stub([teamMember()]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      // The card says it in general; the confirmation says it about this person, which
      // is the one somebody reads before pressing the button.
      const explanation = screen.getByText(/can now recruit and manage their own direct agents/);
      expect(explanation).toHaveTextContent('They keep reporting to you');
      expect(explanation).toHaveTextContent('Rina Wijaya');
    });

    it('explains a demotion the other way round', async () => {
      stub([teamMember({ role: 'aab' })]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'agent');
      expect(screen.getByText(/no longer manage their own direct agents/)).toBeInTheDocument();
    });

    it('changes nothing until it is confirmed', async () => {
      const { calls } = stub([teamMember()]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText(/can now recruit/)).not.toBeInTheDocument();
    });

    it('AC-2: sends the reason, because the log is the only place it can be read back', async () => {
      const { calls } = stub([teamMember()], { '/members/mem-t1/role': { body: [] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      await userEvent.type(screen.getByLabelText('Why?'), '  Ready to lead  ');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));

      const patch = calls.find((c) => c.init.method === 'PATCH')!;
      expect(JSON.parse(patch.init.body as string)).toEqual({
        toRole: 'aab',
        reason: 'Ready to lead',
      });
    });

    it('AC-3: surfaces a refused demotion with the count, and puts the select back', async () => {
      const { calls } = stub([teamMember({ role: 'aab', directCount: 2 })], {
        '/members/mem-t1/role': {
          status: 409,
          body: {
            error: {
              code: 'ORG_HAS_DIRECT_REPORTS',
              message: '2 people report to them. Move them to another leader first.',
              requestId: 'r-1',
            },
          },
        },
      });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'agent');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('2 people report to them');
      // Reloaded, so the select shows what is true rather than what was picked.
      expect(calls.filter((c) => c.url.endsWith('/members/my-team')).length).toBeGreaterThan(1);
      expect(screen.queryByRole('button', { name: 'Confirm change' })).not.toBeInTheDocument();
    });

    it('P13.2-T4 AC-5: a promotion past the office’s leader limit is refused in plain words, with no code', async () => {
      stub([teamMember()], {
        '/members/mem-t1/role': {
          status: 409,
          body: {
            error: {
              code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 10, leadersUsed: 10 }, requestId: 'r-1',
            },
          },
        },
      });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This office has reached its limit of 10 leaders, so nobody else can be made an AB or an AAB.');
      expect(alert).toHaveTextContent('AgencyBoost can raise it.');
      expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    });

    it('says how many somebody leads, so a demotion is not a surprise', async () => {
      stub([teamMember({ role: 'aab', directCount: 3 })]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });
      expect(await screen.findByText(/leads 3/)).toBeInTheDocument();
    });

    it('tells a leader with nobody under them', async () => {
      stub([]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });
      expect(await screen.findByText('Nobody reports to you yet.')).toBeInTheDocument();
    });
  });

  describe('removing somebody (P3-T7)', () => {
    const teamMember = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
      agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true, ...over,
    });

    function stub(team: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
      return stubFetch({
        '/join/my-code': { body: MY_CODE },
        '/join/untagged': { body: [] },
        '/members/my-team': { body: team },
        ...extra,
      });
    }

    async function open(team = [teamMember()], extra: Record<string, unknown> = {}) {
      const stubbed = stub(team, extra);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Rina Wijaya' }));
      return stubbed;
    }

    it('says what removal does and does not do, in the prototype own words', async () => {
      await open();
      expect(screen.getByText(/removes them from your team immediately/)).toBeInTheDocument();
      expect(screen.getByText(/search and request a new leader/)).toBeInTheDocument();
      // The half the prototype does not say, because its version really does delete.
      expect(screen.getByText(/Nothing is deleted/)).toBeInTheDocument();
    });

    it('AC-1: the button stays disabled until the word is typed exactly', async () => {
      await open();
      const confirm = screen.getByRole('button', { name: 'Remove from team' });
      expect(confirm).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOV');
      expect(confirm).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'E');
      expect(confirm).toBeEnabled();
    });

    it('AC-1: accepts it trimmed and in any case, as the prototype does', async () => {
      await open();
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), '  remove  ');
      expect(screen.getByRole('button', { name: 'Remove from team' })).toBeEnabled();
    });

    it('sends the word rather than a flag, so the server does the checking', async () => {
      const { calls } = await open([teamMember()], { '/members/mem-t1': { body: [] } });
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      await userEvent.type(screen.getByLabelText('Why?'), '  Left the industry  ');
      await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));

      const sent = calls.find((c) => c.init.method === 'DELETE')!;
      expect(sent.url).toContain('/members/mem-t1');
      expect(JSON.parse(sent.init.body as string)).toEqual({
        confirmation: 'REMOVE',
        reason: 'Left the industry',
      });
    });

    it('changes nothing until it is confirmed, and Cancel forgets what was typed', async () => {
      const { calls } = await open();
      await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

      await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina Wijaya' }));
      expect(screen.getByRole('button', { name: 'Remove from team' })).toBeDisabled();
    });

    describe('AC-3: when they lead people', () => {
      const leader = [teamMember({ role: 'aab', directCount: 2 })];

      it('asks where the reports go, and says why it is asking', async () => {
        await open(leader);
        expect(screen.getByText('2 people report to them')).toBeInTheDocument();
        expect(screen.getByText(/reporting to somebody who has left/)).toBeInTheDocument();
        expect(screen.getByLabelText('Move them to my unit')).toBeInTheDocument();
        expect(
          screen.getByLabelText('Leave them unassigned, for another leader to pick up'),
        ).toBeInTheDocument();
      });

      it('sends the disposition, with my own membership as the destination', async () => {
        const { calls } = await open(leader, { '/members/mem-t1': { body: [] } });
        await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
        await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));

        const sent = calls.find((c) => c.init.method === 'DELETE')!;
        expect(JSON.parse(sent.init.body as string).subtree).toEqual({
          action: 'reassign',
          toMembershipId: LEADER.membership!.membershipId,
        });
      });

      it('sends orphan when that is what was picked', async () => {
        const { calls } = await open(leader, { '/members/mem-t1': { body: [] } });
        await userEvent.click(
          screen.getByLabelText('Leave them unassigned, for another leader to pick up'),
        );
        await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
        await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));

        expect(JSON.parse(calls.find((c) => c.init.method === 'DELETE')!.init.body as string).subtree)
          .toEqual({ action: 'orphan' });
      });

      it('does not ask, or send, for somebody who leads nobody', async () => {
        const { calls } = await open([teamMember()], { '/members/mem-t1': { body: [] } });
        expect(screen.queryByLabelText('Move them to my unit')).not.toBeInTheDocument();

        await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
        await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
        expect(
          JSON.parse(calls.find((c) => c.init.method === 'DELETE')!.init.body as string),
        ).not.toHaveProperty('subtree');
      });

      it('surfaces a refusal and reloads, rather than leaving a stale panel open', async () => {
        const { calls } = await open(leader, {
          '/members/mem-t1': {
            status: 400,
            body: {
              error: {
                code: 'ORG_SUBTREE_DISPOSITION_REQUIRED',
                message: '2 people report to them. Say where they go before removing this leader.',
                requestId: 'r-2',
              },
            },
          },
        });
        await userEvent.type(screen.getByLabelText('Type REMOVE to confirm'), 'REMOVE');
        await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('2 people report to them');
        expect(screen.queryByRole('button', { name: 'Remove from team' })).not.toBeInTheDocument();
        expect(calls.filter((c) => c.url.endsWith('/members/my-team')).length).toBeGreaterThan(1);
      });
    });

    it('opening removal closes a role change that was half-made', async () => {
      // Both panels sit in the same place. Two open at once is a screen asking two
      // questions about the same person and answering neither.
      stub([teamMember()]);
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      expect(screen.getByText(/can now recruit/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Remove Rina Wijaya' }));
      expect(screen.queryByText(/can now recruit/)).not.toBeInTheDocument();
      expect(screen.getByText(/removes them from your team immediately/)).toBeInTheDocument();
    });
  });

  describe('pulling in somebody already here (P3-T5 AC-3)', () => {
    const untagged = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-un', fullName: 'Fajar Nugroho', initials: 'FN',
      email: 'fajar@kpm0417.test', agentCode: 'KPM0417-011', role: 'agent', ...over,
    });

    it('says plainly that they do not have to approve it', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [untagged()] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      expect(await screen.findByText(/they do not have to approve it/)).toBeInTheDocument();
    });

    it('lists people who report to nobody', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [untagged()] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      expect(await screen.findByText('Fajar Nugroho')).toBeInTheDocument();
      expect(screen.getByText(/reports to nobody/)).toBeInTheDocument();
    });

    it('confirms in the row rather than in a modal', async () => {
      // A modal for one row is heavier than the decision, and the prototype agrees.
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [untagged()] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
      expect(screen.getByText('Add them to your unit?')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Add to my unit' })).toBeInTheDocument();
    });

    it('adds them on confirm, and takes the pool the server returned', async () => {
      const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE },
        '/join/untagged/mem-un': { body: [] },
        '/join/untagged': { body: [untagged()] },
      });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(calls.some((c) => c.url.endsWith('/join/untagged/mem-un'))).toBe(true);
      expect(
        await screen.findByText('Everybody in this office already reports to somebody.'),
      ).toBeInTheDocument();
    });

    it('searches at the server', async () => {
      const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.type(await screen.findByLabelText('Search by name'), 'fajar');
      await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=fajar'));
    });

    it('tells an empty office apart from a search that matched nobody', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE }, '/join/untagged': { body: [] } });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      expect(
        await screen.findByText('Everybody in this office already reports to somebody.'),
      ).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Search by name'), 'zzz');
      expect(await screen.findByText('No untagged agents match that search.')).toBeInTheDocument();
    });

    it('surfaces a refusal, such as somebody who already has a leader', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/my-code': { body: MY_CODE },
        '/join/untagged/mem-un': {
          status: 409,
          body: {
            error: {
              code: 'ORG_AGENT_ALREADY_TAGGED',
              message: 'They already report to somebody. Moving them is a different operation.',
              requestId: 'r-1',
            },
          },
        },
        '/join/untagged': { body: [untagged()] },
      });
      renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('already report to somebody');
    });
  });

  it('surfaces a refusal rather than showing a panel with nothing in it', async () => {
    // There is nothing to issue any more, so the failure this screen can still have is
    // being unable to read the code — and an empty share panel would say nothing at all.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/untagged': { body: [] },
      '/join/my-code': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'r-1' } },
      },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });

/*
 * P18.8-T2 (ADR-0157): past the limit a leader's role change, or a pending leader tagged into their unit, may wait
 * for AgencyBoost — *Ask AgencyBoost to approve* asks for exactly what was refused, and the row says it is waiting.
 * And OD-50: the team's role select is the company's ladder, a rung it added included, none that makes an AB.
 */
describe('P18.8-T2 — a leader past the limit waits for AgencyBoost', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ASKER = makeMe({
    membership: LEADER.membership,
    permissions: [...LEADER.permissions, 'leader_limit_request:create', 'leader_limit_request:read'],
  });
  const teamMember = (over: Record<string, unknown> = {}) => ({
    membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW', agentCode: '88003', role: 'agent',
    orgLevelCode: 'AGENT', directCount: 0, canChangeRole: true, ...over,
  });
  const LIMIT = {
    status: 409,
    body: {
      error: {
        code: 'LEADER_LIMIT_REACHED', message: 'x', requestId: 'r-1',
        details: { maxLeaders: 10, leadersUsed: 10, canRequest: true },
      },
    },
  };
  const ask = (over: Record<string, unknown> = {}) => ({
    requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
    subjectMembershipId: 'mem-t1', subjectName: 'Rina Wijaya', subjectAgentCode: '88003', action: 'promote',
    fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: null, requestedByMembershipId: 'mem-ab',
    requestedByName: 'Agus', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
    declineReason: null, maxLeaders: 10, leadersUsed: 10, ...over,
  });

  it('AC-6 asks AgencyBoost for the role change the limit refused, with its reason', async () => {
    const { calls } = stubFetch({
      '/join/my-code': { body: MY_CODE },
      '/join/untagged': { body: [] },
      '/members/my-team': { body: [teamMember()] },
      '/members/mem-t1/role': LIMIT,
      'POST /members/mem-t1/leader-limit-request': { status: 201, body: ask() },
      '/members/leader-limit-requests': [{ body: [] }, { body: [] }, { body: [ask()] }],
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: ASKER });

    await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
    await userEvent.type(screen.getByLabelText('Why?'), 'Ready to lead');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ask AgencyBoost to approve this one past the limit');
    await userEvent.click(screen.getByRole('button', { name: 'Ask AgencyBoost to approve' }));

    const posted = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(String(posted?.init.body))).toEqual({ action: 'promote', orgLevelCode: 'aab', reason: 'Ready to lead' });
    expect(await screen.findByText("Waiting for AgencyBoost's approval")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
  });

  it('AC-6 asks to let in a pending leader the tag was refused for', async () => {
    const { calls } = stubFetch({
      '/join/my-code': { body: MY_CODE },
      '/join/untagged/mem-un': LIMIT,
      '/join/untagged': { body: [{ membershipId: 'mem-un', fullName: 'Tono', initials: 'T', email: 't@k.test', agentCode: '88009', role: 'aab' }] },
      '/members/my-team': { body: [] },
      'POST /members/mem-un/leader-limit-request': { status: 201, body: ask({ subjectMembershipId: 'mem-un', action: 'activate' }) },
      '/members/leader-limit-requests': { body: [] },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: ASKER });

    await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ask AgencyBoost to approve' }));
    const posted = calls.find((c) => c.url.includes('/members/mem-un/leader-limit-request'));
    expect(JSON.parse(String(posted?.init.body))).toEqual({ action: 'activate' });
  });

  it('OD-50 offers the company’s own rungs that a leader may place somebody on, never one that makes an AB', async () => {
    const ladder = [
      { orgLevelId: 'l1', companyId: 'c', code: 'AGENT', label: 'Agent', displayOrder: 1, leaderTier: null, status: 'active' },
      { orgLevelId: 'l2', companyId: 'c', code: 'AAB', label: 'Associate Agency Builder', displayOrder: 2, leaderTier: 'associate', status: 'active' },
      { orgLevelId: 'l3', companyId: 'c', code: 'AB', label: 'Agency Builder', displayOrder: 3, leaderTier: 'senior', status: 'active' },
      { orgLevelId: 'l4', companyId: 'c', code: 'UM', label: 'Unit Manager', displayOrder: 4, leaderTier: 'associate', status: 'active' },
      { orgLevelId: 'l5', companyId: 'c', code: 'SM', label: 'Senior Manager', displayOrder: 5, leaderTier: 'senior', status: 'active' },
    ];
    const { calls } = stubFetch({
      '/join/my-code': { body: MY_CODE },
      '/join/untagged': { body: [] },
      '/members/my-team': { body: [teamMember()] },
      '/members/mem-t1/role': { body: [] },
      '/kpm/org-levels': { body: ladder },
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], training: [], activationChecklist: null, eventTypes: [], capability: null } },
    });
    renderInLayout(AgentLayout, <AddAgentsPage />, { me: LEADER });

    await vi.waitFor(() => expect(screen.getByRole('option', { name: 'Unit Manager' })).toBeInTheDocument());
    const options = [...screen.getByLabelText('Role').querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Agent', 'Associate Agency Builder', 'Unit Manager']);
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'um');
    expect(screen.getByText(/will change from Agent to Unit Manager/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
    expect(JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')?.init.body))).toEqual({ toRole: 'um' });
  });
});
});
