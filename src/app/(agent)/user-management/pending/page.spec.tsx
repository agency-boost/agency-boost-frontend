import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import PendingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/pending',
}));

const AB = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['leader_request:read_inbox', 'leader_request:approve', 'leader_request:route_to_sub_unit'],
});

const request = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', membershipId: 'mem-joiner', fullName: 'Putri Anggraini',
  initials: 'PA', email: 'putri@kpm0417.test', agentCode: 'KPM0417-009',
  role: 'agent', requestedAt: '2026-09-01T00:00:00.000Z', routedFromName: null,
  leaderMembershipId: 'mem-ab', leaderName: 'Agus Prasetyo', ...over,
});

const ROUTING = [
  { membershipId: 'mem-aab', fullName: 'Sari Puspita', unitSize: 2, forLeaderMembershipId: 'mem-ab' },
];

describe('the approval inbox (P3-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists who is waiting, with their code and role', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    expect(await screen.findByText('Putri Anggraini')).toBeInTheDocument();
    expect(screen.getByText(/KPM0417-009/)).toBeInTheDocument();
    expect(screen.getByTitle('Agent')).toBeInTheDocument();
  });

  it('says when somebody above routed a request down to you', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request({ routedFromName: 'Agus Prasetyo' })] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });
    expect(await screen.findByText('Sent to you by Agus Prasetyo.')).toBeInTheDocument();
  });

  it('AC-2: offers your own units as destinations for an agent', async () => {
    stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    const select = await screen.findByLabelText('Add to');
    expect(within(select).getByRole('option', { name: 'My own unit' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: "Sari Puspita's unit (2)" })).toBeInTheDocument();
  });

  it('offers only the sub-units under the leader this row names', async () => {
    // The office queue holds rows naming different leaders, and the API validates a
    // destination against the leader the *request* names. An unfiltered list offered an
    // Owner choices that were all refused with 422.
    stubFetch({
      '/join/requests/routing': {
        body: [
          ...ROUTING,
          { membershipId: 'mem-other', fullName: 'Someone Else', unitSize: 4,
            forLeaderMembershipId: 'mem-other-ab' },
        ],
      },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    const select = await screen.findByLabelText('Add to');
    expect(within(select).getByRole('option', { name: "Sari Puspita's unit (2)" })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: "Someone Else's unit (4)" })).toBeNull();
  });

  it('names the leader rather than saying "my own" when deciding for somebody else', async () => {
    stubFetch({
      '/join/requests/routing': {
        body: [{ ...ROUTING[0], forLeaderMembershipId: 'mem-sari' }],
      },
      '/join/requests': {
        body: [request({ leaderMembershipId: 'mem-sari', leaderName: 'Sari Puspita' })],
      },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    const select = await screen.findByLabelText('Add to');
    expect(within(select).getByRole('option', { name: "Sari Puspita's own unit" })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'My own unit' })).toBeNull();
  });

  it('offers no destination for an AB or AAB — a leader is not placed in a unit', async () => {
    stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests': { body: [request({ role: 'aab' })] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    await screen.findByText('Putri Anggraini');
    expect(screen.queryByLabelText('Add to')).not.toBeInTheDocument();
  });

  it('offers no destination when there is nowhere to send anybody', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    await screen.findByText('Putri Anggraini');
    expect(screen.queryByLabelText('Add to')).not.toBeInTheDocument();
  });

  it('approves into your own unit by default', async () => {
    const { calls } = stubFetch({
      '/join/requests/routing': { body: ROUTING },
      '/join/requests/req-1/approve': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

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
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

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
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('No pending requests right now.')).toBeInTheDocument();
  });

  it('asks why before declining, and sends it', async () => {
    // The prototype captures no reason, so somebody is refused with no idea what to do
    // instead.
    const { calls } = stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests/req-1/decline': { body: [] },
      '/join/requests': { body: [request()] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

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
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

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
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });
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
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already approved');
    expect(calls.filter((c) => c.url.endsWith('/join/requests')).length).toBeGreaterThan(1);
  });

  it('P13.2 exit review: an approval at the leader limit is said in the limit’s words, never the code', async () => {
    stubFetch({
      '/join/requests/routing': { body: [] },
      '/join/requests/req-1/approve': {
        status: 409,
        body: {
          error: {
            code: 'LEADER_LIMIT_REACHED',
            message: 'This office has reached its limit of 10 leaders.',
            details: { maxLeaders: 10, leadersUsed: 10 },
            requestId: 'r-2',
          },
        },
      },
      '/join/requests': { body: [request({ role: 'ab' })] },
    });
    renderInLayout(AgentLayout, <PendingPage />, { me: AB });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'This office has reached its limit of 10 leaders, so nobody else can be made an AB or an AAB.',
    );
    expect(alert).toHaveTextContent('AgencyBoost can raise it.');
    expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    // The request stays, to be approved once there is room.
    expect(screen.getByText('Putri Anggraini')).toBeInTheDocument();
  });

  it('AC-1: never renders for somebody without the inbox permission', () => {
    renderInLayout(AgentLayout, <PendingPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'leader_request:read_inbox');
  });

  /*
   * P18.8-T2 AC-6 (ADR-0157): an approval past the limit may wait for AgencyBoost — *Ask AgencyBoost to approve*
   * asks to let the joiner in, and the row then says it is waiting, with *Cancel request*, in place of Approve.
   */
  describe('P18.8-T2 — a leader past the limit waits for AgencyBoost', () => {
    const ASKER = makeMe({
      membership: AB.membership,
      permissions: [...AB.permissions, 'leader_limit_request:create', 'leader_limit_request:read'],
    });
    const ask = (over: Record<string, unknown> = {}) => ({
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
      subjectMembershipId: 'mem-joiner', subjectName: 'Putri Anggraini', subjectAgentCode: '88009', action: 'activate',
      fromOrgLevelCode: 'AAB', toOrgLevelCode: null, reason: null, requestedByMembershipId: 'mem-ab',
      requestedByName: 'Agus Prasetyo', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
      declineReason: null, maxLeaders: 10, leadersUsed: 10, ...over,
    });

    it('asks to let the joiner in, and the row then waits with Cancel request', async () => {
      const { calls } = stubFetch({
        '/join/requests/routing': { body: [] },
        '/join/requests/req-1/approve': {
          status: 409,
          body: {
            error: {
              code: 'LEADER_LIMIT_REACHED', message: 'x', requestId: 'r-2',
              details: { maxLeaders: 10, leadersUsed: 10, canRequest: true },
            },
          },
        },
        '/join/requests': { body: [request({ role: 'aab' })] },
        'POST /members/mem-joiner/leader-limit-request': { status: 201, body: ask() },
        '/members/leader-limit-requests': [{ body: [] }, { body: [] }, { body: [ask()] }],
        'DELETE /members/leader-limit-requests/llr-1': { body: [] },
      });
      renderInLayout(AgentLayout, <PendingPage />, { me: ASKER });

      await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
      const alert = await screen.findByRole('alert');
      await userEvent.click(within(alert).getByRole('button', { name: 'Ask AgencyBoost to approve' }));

      const posted = calls.find((c) => c.url.includes('/leader-limit-request') && c.init.method === 'POST');
      expect(posted?.url).toContain('/members/mem-joiner/leader-limit-request');
      expect(JSON.parse(String(posted?.init.body))).toEqual({ action: 'activate' });

      expect(await screen.findByText("Waiting for AgencyBoost's approval")).toBeInTheDocument();
      expect(screen.getByText('Let in as Associate Agency Builder')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true);
    });
  });
});
