import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import JoinPage from './page';

const replace = vi.fn();
let query = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/join',
  useSearchParams: () => query,
}));

const PREVIEW = {
  code: 'JOR417',
  kpmLabel: 'Prudential — KPM 0417 · BSD City Branch',
  leaderName: 'Wilson Tanoto',
};

const NEWCOMER = makeMe({ membership: null, permissions: ['join_via_code_link_qr'] });

describe('redeeming an invite (P3-T4)', () => {
  afterEach(() => {
    query = new URLSearchParams();
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it('checks a code from the link without being asked', async () => {
    query = new URLSearchParams('code=JOR417');
    const { calls } = stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    expect(await screen.findByText('Prudential — KPM 0417 · BSD City Branch')).toBeInTheDocument();
    // Found rather than indexed: the shell reads the unread count on mount, so the
    // preview is no longer the first call this screen makes.
    expect(calls.find((c) => c.url.includes('/join/invite'))!.url).toContain('code=JOR417');
  });

  it('shows whose unit and which office before anybody accepts', async () => {
    // This path skips approval, so this is the one moment to understand it.
    query = new URLSearchParams('code=JOR417');
    stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText(/nobody has to approve it/)).toBeInTheDocument();
  });

  it('checks a typed code before writing anything', async () => {
    const { calls } = stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    await userEvent.type(await screen.findByLabelText('Invite code'), 'jor417');
    await userEvent.click(screen.getByRole('button', { name: 'Check this invite' }));

    expect(calls.find((c) => c.url.includes('/join/invite'))!.url).toContain('code=jor417');
    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    // Nothing was written — accepting is a second, deliberate step.
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('accepts, then hands off to the landing rather than guessing where to go', async () => {
    query = new URLSearchParams('code=JOR417');
    const { calls } = stubFetch({
      '/join/invite': { body: PREVIEW },
      '/join/redeem': { body: { kpmId: 'kpm-1', leaderName: 'Wilson Tanoto' } },
    });
    const { session } = renderWithSession(<JoinPage />, { me: NEWCOMER });

    await userEvent.click(await screen.findByRole('button', { name: 'Accept and join' }));

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ code: 'JOR417' });
    // Reload first, then hand off: the landing decides where somebody goes from their
    // session, and it would decide from the stale one otherwise.
    await vi.waitFor(() => expect(session.reload).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('UI-086 refuses somebody who already has an office: the message and the way back only', async () => {
    query = new URLSearchParams('code=JOR417');
    stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 0,
        },
      }),
    });

    expect(await screen.findByText(/already in an office/)).toBeInTheDocument();
    // UI-086: only the message and the way back — no field, no button they cannot use, no preview to accept.
    expect(screen.getByRole('link', { name: 'Back to your work' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept and join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument();
  });

  it('sends somebody signed out to sign in first, keeping the link usable', async () => {
    query = new URLSearchParams('code=JOR417');
    stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: null });

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
  });

  it('shows the refusal a bad code gets, without inventing a reason of its own', async () => {
    query = new URLSearchParams('code=NOPE99');
    stubFetch({
      '/join/invite': {
        status: 410,
        body: {
          error: {
            code: 'ORG_INVITE_EXPIRED',
            message: 'That invite is not valid. It may be mistyped, withdrawn, or no longer in use — ask whoever sent it for a new one.',
            requestId: 'r-1',
          },
        },
      },
    });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('mistyped, withdrawn, or no longer in use');
    expect(screen.queryByRole('button', { name: 'Accept and join' })).not.toBeInTheDocument();
  });

  it('lets somebody try a different code after a refusal', async () => {
    query = new URLSearchParams('code=JOR417');
    stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    await userEvent.click(await screen.findByRole('button', { name: 'Use a different code' }));
    expect(screen.getByLabelText('Invite code')).toBeInTheDocument();
  });

  it('holds the check until there is something to check', async () => {
    stubFetch({ '/join/invite': { body: PREVIEW } });
    renderWithSession(<JoinPage />, { me: NEWCOMER });

    const submit = await screen.findByRole('button', { name: 'Check this invite' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Invite code'), 'JOR4');
    expect(submit).toBeEnabled();
  });

  it('gives somebody who already has an office a way back to it', async () => {
    // They opened a colleague's invite by mistake. Until 2026-09-06 they were told the
    // invite was not theirs and then given nothing — no link, and no sidebar either, so
    // the browser's back button was the only exit.
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<JoinPage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 0,
        },
        permissions: ['join_via_code_link_qr'],
      }),
    });

    expect(await screen.findByText(/this invite is not for you/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your work' }))
      .toHaveAttribute('href', '/home');
  });

  it('gives a stranger no chrome, because there is no role to pick one from', () => {
    // The link arrives by email and is opened by somebody who may have no account. A
    // shell here would bounce them to /login and lose the code they came with.
    renderWithSession(<JoinPage />, { me: null });
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('a leader’s invite to one person, for an account that exists (P18.96-T3 AC-4, ADR-0170 §4)', () => {
  const BANNER = {
    leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-1', companyName: 'Prudential',
    agentCode: '20001', joinDate: '2026-10-27', fullName: 'Yoga Pratama', existingAccount: true, expiresAt: '2026-11-10T03:00:00.000Z',
  };
  afterEach(() => {
    query = new URLSearchParams();
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it('P18.96-T3 AC-4 shows whose team and which office, and accepts with one button, then goes to the landing', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    const reload = vi.fn(async () => undefined);
    const { calls } = stubFetch({
      '/invites/kpm-1.secret/accept': { body: { kpmId: 'kpm-1', leaderName: 'Agus Prasetyo' } },
      '/invites/kpm-1.secret': { body: BANNER },
    });
    renderWithSession(<JoinPage />, { me: NEWCOMER, reload });
    expect(await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417")).toBeInTheDocument();
    expect(screen.getByText(/Agent code 20001 · Join date 27 Ok?c?t 2026/)).toBeInTheDocument();
    // Not the leader-code check: no code field, and no preview of one.
    expect(screen.queryByLabelText('Invite code')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept and join' }));
    expect(calls.some((c) => c.url.endsWith('/invites/kpm-1.secret/accept') && c.init.method === 'POST')).toBe(true);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(reload).toHaveBeenCalled();
  });

  it('P18.96-T3 AC-4 signed out, it says to sign in and comes back here after', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({ '/invites/kpm-1.secret': { body: BANNER } });
    renderWithSession(<JoinPage />, { me: null });
    expect(await screen.findByText("You're joining Agus Prasetyo's team · KPM 0417")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to accept' }))
      .toHaveAttribute('href', `/login?next=${encodeURIComponent('/join?invite=kpm-1.secret')}`);
    expect(screen.queryByRole('button', { name: 'Accept and join' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-4 a refusal — another account’s code, or somebody already in an office — is said in the server’s words', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({
      '/invites/kpm-1.secret/accept': {
        status: 409,
        body: { error: { code: 'ORG_AGENT_ALREADY_TAGGED', message: 'You already belong to an office, so this invite cannot add you.', requestId: 'r' } },
      },
      '/invites/kpm-1.secret': { body: BANNER },
    });
    renderWithSession(<JoinPage />, { me: NEWCOMER });
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already belong to an office');
    expect(replace).not.toHaveBeenCalled();
  });

  it('P18.96-T3 AC-4 a link that opens nothing says so plainly', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({
      '/invites/kpm-1.secret': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'This invite was already used. Sign in instead.', requestId: 'r' } } },
    });
    renderWithSession(<JoinPage />, { me: NEWCOMER });
    expect(await screen.findByRole('alert')).toHaveTextContent('This invite was already used. Sign in instead.');
    expect(screen.queryByRole('button', { name: 'Accept and join' })).not.toBeInTheDocument();
  });
});

