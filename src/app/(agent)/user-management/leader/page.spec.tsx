import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import FindLeaderPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/leader',
}));

const JOINER = makeMe({
  membership: {
    membershipId: 'mem-me', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
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
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: makeMe({ membership: null }) });

    expect(await screen.findByText('Register an office first')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search by name')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Register KPM' })).toHaveAttribute(
      'href',
      '/user-management/kpm',
    );
  });

  it('lists every AB and AAB once registered', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('Dewi Lestari')).toBeInTheDocument();
    expect(screen.getByText('4 in their unit')).toBeInTheDocument();
  });

  /*
   * P18.95-T7 AC-1 (ADR-0167 §7; the client's *Grey text* table, rows 1–3): the client's words at every size, and its
   * *Remove* below 768px only — the sentence keeps its words from 768px, where the client has not reviewed it yet.
   */
  it('P18.95-T7 AC-1 heads the search Find a leader, says They’ll need to approve.', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    expect(await screen.findByRole('heading', { level: 2, name: 'Find a leader' })).toBeInTheDocument();
    expect(screen.queryByText(/Find a leader in/)).not.toBeInTheDocument();
    expect(screen.getByText("They'll need to approve.")).toBeInTheDocument();
    expect(screen.queryByText(/Sending a request notifies them/)).not.toBeInTheDocument();
  });

  it('says a leader with no unit can still take you on', async () => {
    // "0 people in unit" reads as a number they failed to reach. A new AAB has to be
    // askable or they could never get a first report.
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

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
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send request' }))[0]);

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ leaderMembershipId: 'mem-ab' });
    expect(await screen.findByText('Request sent')).toBeInTheDocument();
  });

  it('P18.95-T1 AC-6: says Request sent ✓ in the shell’s toast once the request is in', async () => {
    stubFetch({
      '/join/leader-request': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
      '/join/leaders': [
        { body: LEADERS },
        { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
      ],
      '/join/me': { body: REGISTERED },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Send request' }))[0]);

    const toast = await screen.findByText('Request sent ✓');
    expect(toast.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    // The row keeps its own pill: the toast is added, nothing is taken away.
    expect(await screen.findByText('Request sent')).toBeInTheDocument();
  });

  it('explains that asking somebody else replaces the request', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
      '/join/leaders': { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    expect(await screen.findByText(/replaces it rather than adding a second/)).toBeInTheDocument();
  });

  it('withdraws an outstanding request', async () => {
    const { calls } = stubFetch({
      '/join/leader-request': { body: REGISTERED },
      '/join/leaders': { body: [{ ...LEADERS[0], requestSent: true }, LEADERS[1]] },
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-ab' } },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true);
  });

  it('P18.96-T3 AC-6 a reader with a leader sees who it is and one line in place of the search, which is never asked', async () => {
    const { calls } = stubFetch({
      '/join/me': { body: { ...REGISTERED, status: 'active', leaderMembershipId: 'mem-ab', leaderName: 'Wilson Tanoto' } },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    const card = await screen.findByTestId('reporting-to');
    // UI-088: one card — whom they report to as its title, the note as 12px meta inside it, behind ⓘ on a phone.
    expect(within(card).getByText('Currently reporting to').className).not.toContain('uppercase');
    expect(within(card).getByText('Wilson Tanoto')).toBeInTheDocument();
    const note = within(card).getAllByText('Changing leader goes through your office admin.').find((el) => el.tagName === 'P')!;
    expect(note.className).toContain('text-sm');
    expect(note.className).toContain('max-md:hidden');
    expect(within(card).getByRole('button', { name: 'Changing leader goes through your office admin.' })).toBeInTheDocument();
    expect(card.className).not.toMatch(/border-l-/);
    expect(screen.queryByLabelText('Search by name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/join/leaders'))).toBe(false);
  });

  it('UI-086 offers no invite to somebody already in an office with a leader — it would lead to a refusal', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, status: 'active', leaderMembershipId: 'mem-ab', leaderName: 'Wilson Tanoto' } },
    });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    await screen.findByTestId('reporting-to');
    expect(screen.queryByText("Have a leader's code, link or QR?")).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Use an invite instead' })).not.toBeInTheDocument();
  });

  it('UI-086 offers no invite to somebody in an office with no leader either — /join refuses any member (T16)', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });
    await screen.findByRole('heading', { level: 2, name: 'Find a leader' });
    expect(screen.queryByText("Have a leader's code, link or QR?")).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Use an invite instead' })).not.toBeInTheDocument();
  });

  it('UI-086 offers the invite to somebody with no office yet, its line behind ⓘ from 768px', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: makeMe({ membership: null }) });
    expect(await screen.findByRole('link', { name: 'Use an invite instead' })).toHaveAttribute('href', '/join');
    // Appendix A (UI-086): the invite's sentence behind ⓘ from 768px, and not on a phone at all.
    const tip = screen.getByRole('button', {
      name: 'Any of the three does the same thing: it joins you and tags you to them in one step, with no approval. Opening their link or scanning their QR takes you to the same place.',
    });
    expect(tip.closest('.max-md\\:hidden')).not.toBeNull();
    expect(screen.queryAllByText(/^Any of the three does the same thing/).filter((el) => el.tagName === 'P')).toEqual([]);
  });

  it('P18.96-T3 AC-6 a reader with no leader still searches, and the list is the server’s — never the reader’s own unit', async () => {
    // The exclusion is the server's (`GET /join/leaders`); the screen draws what it is served.
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });
    expect(await screen.findByLabelText('Search by name')).toBeInTheDocument();
    expect(screen.queryByText('Changing leader goes through your office admin.')).not.toBeInTheDocument();
  });

  it('searches by name, at the server', async () => {
    const { calls } = stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: LEADERS } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    await userEvent.type(await screen.findByLabelText('Search by name'), 'dewi');
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=dewi'));
  });

  it('tells an office with no leaders apart from a search that matched none', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/leaders': { body: [] } });
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    expect(
      await screen.findByText('This office has no ABs or AABs yet.'),
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
    renderInLayout(AgentLayout, <FindLeaderPage />, { me: JOINER });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send request' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('not available in this office');
    // P18.95-T1 AC-6: a refusal toasts nothing.
    expect(screen.queryByText('Request sent ✓')).not.toBeInTheDocument();
  });
});
