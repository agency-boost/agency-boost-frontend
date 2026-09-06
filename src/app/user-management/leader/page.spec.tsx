import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import FindLeaderPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/leader',
}));

const JOINER = makeMe({
  membership: {
    membershipId: 'mem-me', kpmId: 'kpm-1', hierarchyRole: 'agent',
    isKpmOwner: false, isKpmAdmin: false, status: 'active', directCount: 0,
  },
  permissions: ['leader:search_directory', 'leader_request:create', 'leader_request:cancel'],
});

const NO_OFFICE = {
  kpmId: null, kpmLabel: null, registeredAt: null,
  leaderMembershipId: null, leaderName: null, status: 'none', pendingRequestTo: null,
};
const REGISTERED = {
  ...NO_OFFICE,
  kpmId: 'kpm-1', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', status: 'pending',
};
const LEADERS = [
  { membershipId: 'mem-ab', fullName: 'Wilson Tanoto', role: 'ab', unitSize: 4, isCurrentLeader: false, requestSent: false },
  { membershipId: 'mem-aab', fullName: 'Dewi Lestari', role: 'aab', unitSize: 0, isCurrentLeader: false, requestSent: false },
];

describe('find your leader (P3-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2: refuses to search until an office is registered, and says why', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE } });
    renderWithSession(<FindLeaderPage />, { me: makeMe({ membership: null }) });

    expect(await screen.findByText('Register an office first')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search by name')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Register KPM' })).toHaveAttribute(
      'href',
      '/user-management/kpm',
    );
  });

  it('lists every AB and AAB once registered', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('Dewi Lestari')).toBeInTheDocument();
    expect(screen.getByText('4 in their unit')).toBeInTheDocument();
  });

  it('says a leader with no unit can still take you on', async () => {
    // "0 people in unit" reads as a number they failed to reach. A new AAB has to be
    // askable or they could never get a first report.
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText('No unit yet — they can still take you on')).toBeInTheDocument();
  });

  it('sends the request and marks the row it went to', async () => {
    const { calls } = stubFetch({
      '/join/leader-request': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
      '/join/leaders': [
        { body: LEADERS },
        { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
      ],
      '/join/me': { body: REGISTERED },
    });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send request' }))[0]);

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ leaderMembershipId: 'mem-ab' });
    expect(await screen.findByText('Request sent')).toBeInTheDocument();
  });

  it('explains that asking somebody else replaces the request', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
      '/join/leaders': { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
    });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText(/replaces it rather than adding a second/)).toBeInTheDocument();
  });

  it('withdraws an outstanding request', async () => {
    const { calls } = stubFetch({
      '/join/leader-request': { body: REGISTERED },
      '/join/leaders': { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
    });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true);
  });

  it('shows a current leader as such, with nothing to press', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, status: 'active', leaderName: 'Wilson Tanoto' } },
      '/join/leaders': { body: [{ ...LEADERS[0], isCurrentLeader: true }, LEADERS[1]] },
    });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText('Your leader')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Send request' })).toHaveLength(1);
  });

  it('searches by name, at the server', async () => {
    const { calls } = stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    await userEvent.type(await screen.findByLabelText('Search by name'), 'dewi');
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=dewi'));
  });

  it('tells an office with no leaders apart from a search that matched none', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: [] } });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    expect(
      await screen.findByText('This office has no Agency Builders or Associate Agency Builders yet.'),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search by name'), 'zzz');
    expect(await screen.findByText('No leaders match that search.')).toBeInTheDocument();
  });

  it('surfaces a refused request rather than appearing to send it', async () => {
    stubFetch({
      '/join/me': { body: REGISTERED },
      '/join/leaders': { body: LEADERS },
      '/join/leader-request': {
        status: 422,
        body: { error: { code: 'ORG_LEADER_NOT_IN_KPM', message: 'That leader is not available in this office.', requestId: 'r-2' } },
      },
    });
    renderWithSession(<FindLeaderPage />, { me: JOINER });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send request' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('not available in this office');
  });
});
