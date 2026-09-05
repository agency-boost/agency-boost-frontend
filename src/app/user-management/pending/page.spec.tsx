import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import PendingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/pending',
}));

const AB = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['leader_request:read_inbox', 'leader_request:approve', 'leader_request:route_to_sub_unit'],
});

const request = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', membershipId: 'mem-joiner', fullName: 'Putri Anggraini',
  initials: 'PA', email: 'putri@kpm0417.test', agentCode: 'KPM0417-009',
  role: 'agent', requestedAt: '2026-09-01T00:00:00.000Z', routedFromName: null, ...over,
});

const ROUTING = [{ membershipId: 'mem-aab', fullName: 'Sari Puspita', unitSize: 2 }];

describe('the approval inbox (P3-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists who is waiting, with their code and role', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    expect(await screen.findByText('Putri Anggraini')).toBeInTheDocument();
    expect(screen.getByText(/KPM0417-009/)).toBeInTheDocument();
    expect(screen.getByTitle('Agent')).toBeInTheDocument();
  });

  it('says when somebody above routed a request down to you', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request({ routedFromName: 'Agus Prasetyo' })] },
    });
    renderWithSession(<PendingPage />, { me: AB });
    expect(await screen.findByText('Sent to you by Agus Prasetyo.')).toBeInTheDocument();
  });

  it('AC-2: offers your own units as destinations for an agent', async () => {
    stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    const select = await screen.findByLabelText('Add to');
    expect(within(select).getByRole('option', { name: 'My own unit' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: "Sari Puspita's unit (2)" })).toBeInTheDocument();
  });

  it('offers no destination for an AB or AAB — a leader is not placed in a unit', async () => {
    stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests': { body: [request({ role: 'aab' })] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await screen.findByText('Putri Anggraini');
    expect(screen.queryByLabelText('Add to')).not.toBeInTheDocument();
  });

  it('offers no destination when there is nowhere to send anybody', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await screen.findByText('Putri Anggraini');
    expect(screen.queryByLabelText('Add to')).not.toBeInTheDocument();
  });

  it('approves into your own unit by default', async () => {
    const { calls } = stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests/req-1/approve': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    const post = calls.find((c) => c.url.includes('/approve'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({});
  });

  it('AC-2: approves into the unit that was chosen', async () => {
    const { calls } = stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests/req-1/approve': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.selectOptions(await screen.findByLabelText('Add to'), 'mem-aab');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const post = calls.find((c) => c.url.includes('/approve'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({ routeToMembershipId: 'mem-aab' });
  });

  it('takes the inbox the server returned, not its own guess at it', async () => {
    // Two leaders can have this open at once. Trusting the response is how the screen
    // shows what is true rather than what it hoped.
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests/req-1/approve': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Nothing is waiting on you right now.')).toBeInTheDocument();
  });

  it('asks why before declining, and sends it', async () => {
    // The prototype captures no reason, so somebody is refused with no idea what to do
    // instead.
    const { calls } = stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests/req-1/decline': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await userEvent.type(screen.getByLabelText('Why?'), '  Try Sari  ');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    const post = calls.find((c) => c.url.includes('/decline'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({ reason: 'Try Sari' });
  });

  it('lets you back out of declining', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Why?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('says declining is not removal, so nobody thinks they have thrown somebody out', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [] },
    });
    renderWithSession(<PendingPage />, { me: AB });
    expect(await screen.findByText(/free to ask somebody else/)).toBeInTheDocument();
  });

  it('AC-4: reloads when somebody else decided first, rather than leaving a dead row', async () => {
    const { calls } = stubFetch({
      '/join/requests/routing': { body: [] },
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
      '/join/requests': [{ body: [request()] }, { body: [] }],
    });
    renderWithSession(<PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already approved');
    expect(calls.filter((c) => c.url.endsWith('/join/requests')).length).toBeGreaterThan(1);
  });

  it('AC-1: never renders for somebody without the inbox permission', () => {
    renderWithSession(<PendingPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('leader_request:read_inbox');
  });
});
