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
    stubFetch({ '/join/invites': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    expect(await screen.findByText(/Nobody approves it/)).toBeInTheDocument();
  });

  it('AC-1: shows the code and the link as one invite, not two', async () => {
    stubFetch({ '/join/invites': { body: [invite()] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    // Twice on purpose: once to share and once in the list of what you have issued.
    expect(await screen.findAllByText('JOR417')).toHaveLength(2);
    expect(screen.getByText('https://agencyboost.app/join?code=JOR417')).toBeInTheDocument();
    expect(screen.getByText(/the same invite. Withdrawing it stops both/)).toBeInTheDocument();
  });

  it('sends only the limits that were chosen', async () => {
    const { calls } = stubFetch({ '/join/invites': { body: [] } });
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
    stubFetch({ '/join/invites': [{ body: [] }, { body: [invite()] }] });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.type(await screen.findByLabelText('What is it for'), 'September');
    await userEvent.click(screen.getByRole('button', { name: 'Create an invite' }));

    await vi.waitFor(() => expect(screen.getByLabelText('What is it for')).toHaveValue(''));
  });

  it('lists withdrawn and spent invites too, not only the working one', async () => {
    // What has been out there is worth seeing, not only what still works.
    stubFetch({
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
      '/join/invites/inv-1': { body: invite({ state: 'revoked' }) },
      '/join/invites': [{ body: [invite()] }, { body: [invite({ state: 'revoked' })] }],
    });
    renderWithSession(<AddAgentsPage />, { me: LEADER });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true);
    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
  });

  it('says how long an unlimited invite lasts, rather than leaving the cell blank', async () => {
    stubFetch({ '/join/invites': { body: [invite()] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('When you withdraw it')).toBeInTheDocument();
  });

  it('tells somebody with no invites what is missing', async () => {
    stubFetch({ '/join/invites': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('You have not made an invite yet.')).toBeInTheDocument();
  });

  it('names the task that brings the other half of this screen', async () => {
    stubFetch({ '/join/invites': { body: [] } });
    renderWithSession(<AddAgentsPage />, { me: LEADER });
    expect(await screen.findByText('Arrives in phase 3')).toBeInTheDocument();
    expect(screen.getByText(/Pulling somebody already in this office/)).toBeInTheDocument();
  });

  it('surfaces a refusal rather than appearing to issue one', async () => {
    stubFetch({
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
