import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import AddAgentsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/add',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: [
    'member:invite', 'member:revoke_invite',
    // A leader manages their team from this screen; the card is gated on being able to
    // act on it, not on the role (`agent-shell` gates the Pending tab the same way).
    'member:change_role', 'member:remove_from_team',
  ],
});

/** An agent: invites people, but cannot change a role or remove anybody. */
const AGENT = makeMe({
  membership: {
    membershipId: 'mem-agent', kpmId: 'kpm-1', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['member:invite', 'member:revoke_invite'],
});

const invite = (over: Record<string, unknown> = {}) => ({
  inviteId: 'inv-1', code: 'JOR417', url: 'https://agencyboost.app/join?code=JOR417',
  label: null, autoApprove: true, maxUses: null, useCount: 0,
  expiresAt: null, revokedAt: null, state: 'active', ...over,
});

describe('inviting people (P3-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says plainly that an invite skips approval', async () => {
    // It is the whole difference from asking a leader, and the reason a limit and an
    // expiry are offered at all.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText(/Nobody approves it/)).toBeInTheDocument();
  });

  it('AC-1: shows the code and the link as one invite, not two', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [invite()] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    // Twice on purpose: once to share and once in the list of what you have issued.
    expect(await screen.findAllByText('JOR417')).toHaveLength(2);
    expect(screen.getByText('https://agencyboost.app/join?code=JOR417')).toBeInTheDocument();
    expect(screen.getByText(/Withdrawing the invite stops all three, because they are one invite/))
      .toBeInTheDocument();
  });

  it('AC-1: shows the whole link, and names what each button copies', async () => {
    // `User_Management_Section.html:446` shows the full URL; `Overall.html:3580`
    // truncates it and copies something longer. The section file supersedes for this
    // module, and what is shown must be what is copied either way.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [invite()] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    const link = await screen.findByText('https://agencyboost.app/join?code=JOR417');
    expect(link.textContent).toBe('https://agencyboost.app/join?code=JOR417');
    expect(link.textContent).not.toMatch(/…|\.\.\./);

    // Two artefacts, two buttons that say which is which (`:447`, `:452`). A bare
    // "Copy" twice is indistinguishable to anybody reading the buttons alone.
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('AC-2: hides the team card from somebody who cannot act on a team', async () => {
    // The prototype hides this card for an Agent alongside the Pending tab
    // (`User_Management_Section.html:999`). It gives the reason as "an Agent has no
    // team", which OD-23 makes unreliable — an Agent may have reports. What an Agent
    // cannot do is change a role or remove anybody, so that is the gate.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: AGENT });

    expect(await screen.findByText('Invite someone')).toBeInTheDocument();
    expect(screen.queryByText('Your team')).toBeNull();
  });

  it('AC-2: keeps the team card for a leader who can act on it', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText('Your team')).toBeInTheDocument();
  });

  it('AC-1: hides the Pending Requests tab from somebody with no inbox', async () => {
    // The prototype hides it by role (`User_Management_Section.html:996`); we hide it by
    // the permission that decides the same thing, so it survives the role becoming a
    // ladder reference. Hiding is a convenience — the API refuses an Agent regardless.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: AGENT });

    expect(await screen.findByRole('link', { name: 'Add New Agents' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pending Requests' })).toBeNull();
  });

  it('AC-1: shows it to a leader who has an inbox', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, {
      me: makeMe({
        membership: LEADER.membership,
        permissions: [...LEADER.permissions, 'leader_request:read_inbox'],
      }),
    });

    expect(await screen.findByRole('link', { name: 'Pending Requests' })).toBeInTheDocument();
  });

  it('sends only the limits that were chosen', async () => {
    const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.type(await screen.findByLabelText('What is it for'), '  September  ');
    await userEvent.selectOptions(screen.getByLabelText('How many people'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Create an invite' }));

    const post = calls.find((c) => c.init.method === 'POST')!;
    // No expiry chosen, so none is sent — an omitted field means "no ceiling", and
    // sending a null would be a different statement.
    expect(JSON.parse(post.init.body as string)).toEqual({ label: 'September', maxUses: 5 });
  });

  it('clears the form after issuing, so a second invite is not a copy of the first', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': [{ body: [] }, { body: [invite()] }], '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.type(await screen.findByLabelText('What is it for'), 'September');
    await userEvent.click(screen.getByRole('button', { name: 'Create an invite' }));

    await vi.waitFor(() => expect(screen.getByLabelText('What is it for')).toHaveValue(''));
  });

  it('lists withdrawn and spent invites too, not only the working one', async () => {
    // What has been out there is worth seeing, not only what still works.
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/untagged': { body: [] },
      '/join/invites': {
        body: [
          invite(),
          invite({ inviteId: 'inv-2', code: 'OLD222', state: 'revoked', label: 'August' }),
          invite({ inviteId: 'inv-3', code: 'FULL33', state: 'exhausted', maxUses: 1, useCount: 1 }),
        ],
      },
    });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('row', { name: /OLD222/ })).toHaveTextContent('Withdrawn');
    expect(within(table).getByRole('row', { name: /FULL33/ })).toHaveTextContent('Fully used');
    expect(within(table).getByRole('row', { name: /FULL33/ })).toHaveTextContent('1 of 1');
  });

  it('offers Withdraw only on one that still works', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/untagged': { body: [] },
      '/join/invites': {
        body: [invite(), invite({ inviteId: 'inv-2', code: 'OLD222', state: 'revoked' })],
      },
    });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: 'Withdraw' })).toHaveLength(1);
  });

  it('withdraws, then reloads rather than guessing the new state', async () => {
    const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/untagged': { body: [] },
      '/join/invites/inv-1': { body: invite({ state: 'revoked' }) },
      '/join/invites': [{ body: [invite()] }, { body: [invite({ state: 'revoked' })] }],
    });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true);
    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
  });

  it('says how long an unlimited invite lasts, rather than leaving the cell blank', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [invite()] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('When you withdraw it')).toBeInTheDocument();
  });

  it('tells somebody with no invites what is missing', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('You have not made an invite yet.')).toBeInTheDocument();
  });

  describe('changing a role (P3-T6)', () => {
    const teamMember = (over: Record<string, unknown> = {}) => ({
      membershipId: 'mem-t1', fullName: 'Rina Wijaya', initials: 'RW',
      agentCode: 'KPM0417-003', role: 'agent', directCount: 0, canChangeRole: true, ...over,
    });

    function stub(team: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
      return stubFetch({
        '/join/invites': { body: [] },
        '/join/untagged': { body: [] },
        '/members/my-team': { body: team },
        ...extra,
      });
    }

    it('says a role change moves nobody, which is the thing people assume it does', async () => {
      stub([teamMember()]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });
      expect(await screen.findByText(/changing it moves nobody/)).toBeInTheDocument();
    });

    it('AC-1: shows the control only where the server says it may', async () => {
      // The rule is a server rule, and the row carries the answer — the screen keeps no
      // second copy of it that could drift.
      stub([
        teamMember(),
        teamMember({ membershipId: 'mem-ab', fullName: 'An AB', role: 'ab', canChangeRole: false }),
      ]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      expect(await screen.findByLabelText('Role')).toBeInTheDocument();
      expect(screen.getByTitle('Agency Builder')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Role')).toHaveLength(1);
    });

    it('explains the change in the prototype own words before confirming', async () => {
      stub([teamMember()]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      // The card says it in general; the confirmation says it about this person, which
      // is the one somebody reads before pressing the button.
      const explanation = screen.getByText(/can now recruit and manage their own direct agents/);
      expect(explanation).toHaveTextContent('They keep reporting to you');
      expect(explanation).toHaveTextContent('Rina Wijaya');
    });

    it('explains a demotion the other way round', async () => {
      stub([teamMember({ role: 'aab' })]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'agent');
      expect(screen.getByText(/no longer manage their own direct agents/)).toBeInTheDocument();
    });

    it('changes nothing until it is confirmed', async () => {
      const { calls } = stub([teamMember()]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'aab');
      expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText(/can now recruit/)).not.toBeInTheDocument();
    });

    it('AC-2: sends the reason, because the log is the only place it can be read back', async () => {
      const { calls } = stub([teamMember()], { '/members/mem-t1/role': { body: [] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

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
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.selectOptions(await screen.findByLabelText('Role'), 'agent');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm change' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('2 people report to them');
      // Reloaded, so the select shows what is true rather than what was picked.
      expect(calls.filter((c) => c.url.endsWith('/members/my-team')).length).toBeGreaterThan(1);
      expect(screen.queryByRole('button', { name: 'Confirm change' })).not.toBeInTheDocument();
    });

    it('says how many somebody leads, so a demotion is not a surprise', async () => {
      stub([teamMember({ role: 'aab', directCount: 3 })]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });
      expect(await screen.findByText(/leads 3/)).toBeInTheDocument();
    });

    it('tells a leader with nobody under them', async () => {
      stub([]);
      renderWithSession(<AddAgentsPage />, { me: LEADER });
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
        '/join/invites': { body: [] },
        '/join/untagged': { body: [] },
        '/members/my-team': { body: team },
        ...extra,
      });
    }

    async function open(team = [teamMember()], extra: Record<string, unknown> = {}) {
      const stubbed = stub(team, extra);
      renderWithSession(<AddAgentsPage />, { me: LEADER });
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
      renderWithSession(<AddAgentsPage />, { me: LEADER });

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
      '/join/invites': { body: [] }, '/join/untagged': { body: [untagged()] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      expect(await screen.findByText(/they do not have to approve it/)).toBeInTheDocument();
    });

    it('lists people who report to nobody', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [untagged()] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      expect(await screen.findByText('Fajar Nugroho')).toBeInTheDocument();
      expect(screen.getByText(/reports to nobody/)).toBeInTheDocument();
    });

    it('confirms in the row rather than in a modal', async () => {
      // A modal for one row is heavier than the decision, and the prototype agrees.
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [untagged()] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
      expect(screen.getByText('Add them to your unit?')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Add to my unit' })).toBeInTheDocument();
    });

    it('adds them on confirm, and takes the pool the server returned', async () => {
      const { calls } = stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] },
        '/join/untagged/mem-un': { body: [] },
        '/join/untagged': { body: [untagged()] },
      });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

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
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.type(await screen.findByLabelText('Search by name'), 'fajar');
      await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=fajar'));
    });

    it('tells an empty office apart from a search that matched nobody', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] }, '/join/untagged': { body: [] } });
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      expect(
        await screen.findByText('Everybody in this office already reports to somebody.'),
      ).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Search by name'), 'zzz');
      expect(await screen.findByText('No untagged agents match that search.')).toBeInTheDocument();
    });

    it('surfaces a refusal, such as somebody who already has a leader', async () => {
      stubFetch({
      '/members/my-team': { body: [] },
      '/join/invites': { body: [] },
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
      renderWithSession(<AddAgentsPage />, { me: LEADER });

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my unit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('already report to somebody');
    });
  });

  it('surfaces a refusal rather than appearing to issue one', async () => {
    stubFetch({
      '/members/my-team': { body: [] },
      '/join/untagged': { body: [] },
      '/join/invites': [
        { body: [] },
        { status: 403, body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'r-1' } } },
      ],
    });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.click(await screen.findByRole('button', { name: 'Create an invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });
});
