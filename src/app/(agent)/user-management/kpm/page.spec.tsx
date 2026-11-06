import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import RegisterKpmPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/user-management/kpm',
}));

const NEWCOMER = makeMe({ membership: null, permissions: ['kpm:read_directory', 'kpm_registration:create'] });

const NO_OFFICE = {
  kpmId: null, kpmLabel: null, registeredAt: null,
  leaderMembershipId: null, leaderName: null, status: 'none', pendingRequestTo: null,
};
const REGISTERED = {
  ...NO_OFFICE,
  kpmId: 'kpm-1', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', status: 'pending',
};
const OFFICES = [
  { kpmId: 'kpm-1', code: '0417', branchName: 'BSD City Branch', companyName: 'Prudential', city: 'Tangerang' },
];

describe('register KPM (P3-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state and an open search for somebody in no office', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('No office registered yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(await screen.findByText('Prudential — KPM 0417')).toBeInTheDocument();
  });

  it('P18.10 §C1: the subtitle names no company, because the directory under it lists every company', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('Find the KPM your branch belongs to.')).toBeInTheDocument();
    expect(screen.queryByText(/Find the Prudential/)).not.toBeInTheDocument();
  });

  it('AC-2: locks Find your leader until an office is registered', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    const locked = await screen.findByText('Find Your Leader');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAttribute('title', 'Register an office first');
  });

  it('searches the directory by code or branch name', async () => {
    const { calls } = stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    await userEvent.type(await screen.findByLabelText('Search'), '0417');
    await vi.waitFor(() => expect(calls[calls.length - 1].url).toContain('q=0417'));
  });

  it('registers, then reflects the new state instead of the old one', async () => {
    // The prototype's own defect: selecting an office there only hides the search card,
    // so the summary band keeps naming the office you did not pick.
    stubFetch({
      '/join/me': { body: NO_OFFICE },
      '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES },
      '/join/kpm': { body: REGISTERED },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    await userEvent.click(await screen.findByRole('button', { name: 'Select' }));

    expect(await screen.findByText('Prudential — KPM 0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('unlocks Find your leader once registered, in the tabs and on the card', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    // Two of them: the sub-tab, now navigable rather than locked, and the call to
    // action on the card. Both are links — a control that navigates is a link, never a
    // button wrapped in one.
    const links = await screen.findAllByRole('link', { name: 'Find Your Leader' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/user-management/leader');
    expect(screen.queryByRole('button', { name: 'Find Your Leader' })).not.toBeInTheDocument();
  });

  it('says registering is not membership, so nobody waits for nothing', async () => {
    stubFetch({
      '/join/me': { body: { ...REGISTERED, pendingRequestTo: 'mem-leader' } },
      '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });
    expect(await screen.findByText(/waiting for a leader to take you on/)).toBeInTheDocument();
  });

  it('P19-T2 AC-4 says nothing of waiting when no leader was asked: it names the next step', async () => {
    // UI-166 item 4: "sedang menunggu leader menerima Anda" although nothing was sent.
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });
    expect(await screen.findByText('You are registered to this office. Next, ask a leader to take you on.')).toBeInTheDocument();
    expect(screen.queryByText(/waiting for a leader/)).not.toBeInTheDocument();
  });

  it('offers no "switch office" button, because it would not switch anything', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    await screen.findByText(/Registered office/);
    expect(screen.queryByRole('button', { name: /switch/i })).not.toBeInTheDocument();
    // UI-088: inside the one card, as 12px meta from 768px and behind ⓘ on a phone (Appendix A).
    const card = screen.getByTestId('registered-office');
    const meta = within(card).getAllByText(/ask\s+whoever administers your office/).find((el) => el.tagName === 'P')!;
    expect(meta.className).toContain('text-sm');
    expect(meta.className).toContain('max-md:hidden');
    expect(within(card).getByRole('button', { name: /ask\s+whoever administers your office/ }).closest('.md\\:hidden')).not.toBeNull();
  });

  it('UI-088: one card for the office, its label in sentence case, no uppercase eyebrow and no orange left border', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    const label = await screen.findByText('Registered office');
    expect(label.className).not.toContain('uppercase');
    const card = screen.getByTestId('registered-office');
    expect(card.className).not.toMatch(/border-l-/);
    expect(document.querySelector('.border-l-amber')).toBeNull();
  });

  it('tells an empty directory apart from an empty search', async () => {
    stubFetch({ '/join/me': { body: NO_OFFICE }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: [] } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('No offices are available to join.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search'), 'zzz');
    expect(await screen.findByText('No offices match that search.')).toBeInTheDocument();
  });

  it('surfaces a refused registration rather than appearing to succeed', async () => {
    stubFetch({
      '/join/me': { body: NO_OFFICE },
      '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES },
      '/join/kpm': {
        status: 409,
        body: { error: { code: 'ORG_AGENT_ALREADY_TAGGED', message: 'You are already registered to an office.', requestId: 'r-1' } },
      },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    await userEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already registered');
  });
  it('AC-1: offers asking for an office only after the search comes back empty', async () => {
    // Below the search and quiet about it. Almost everybody here has an office to find,
    // and offering "ask for a new one" as an equal choice would invite duplicates of
    // offices that already exist.
    stubFetch({
      '/join/kpm-request': { body: { request: null } },
      '/join/kpms': { body: [] },
      '/join/me': { body: { kpmId: null, kpmLabel: null, status: null, leaderName: null, leaderMembershipId: null, pendingRequestTo: null } },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('Cannot find your office?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask for an office' })).toBeInTheDocument();
  });

  it('AC-1: shows where an open request stands instead of inviting a second', async () => {
    // The API allows one at a time. Offering the form again is how somebody ends up with
    // two offices created for them.
    stubFetch({
      '/join/kpm-request': {
        body: { request: {
          requestId: 'r1', branchName: 'Surabaya Branch', companyName: 'Prudential',
          status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z', reason: null,
          createdKpmId: null,
        } },
      },
      '/join/kpms': { body: [] },
      '/join/me': { body: { kpmId: null, kpmLabel: null, status: null, leaderName: null, leaderMembershipId: null, pendingRequestTo: null } },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('You asked for an office')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask for an office' })).toBeNull();
  });

  it('gives a declined request its reason back, and lets them try again', async () => {
    stubFetch({
      '/join/kpm-request': {
        body: { request: {
          requestId: 'r1', branchName: 'Surabaya Branch', companyName: 'Prudential',
          status: 'declined', requestedAt: '2026-09-01T00:00:00.000Z',
          reason: 'This branch already trades under KPM 0417.', createdKpmId: null,
        } },
      },
      '/join/kpms': { body: [] },
      '/join/me': { body: { kpmId: null, kpmLabel: null, status: null, leaderName: null, leaderMembershipId: null, pendingRequestTo: null } },
    });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    expect(await screen.findByText('This branch already trades under KPM 0417.')).toBeInTheDocument();
  });

  describe('P19-T2 asking for an office (ADR-0191 §1; UI-164, UI-165)', () => {
    const MANULIFE = { companyId: 'c-manulife', name: 'Manulife' };
    const ASKED = {
      requestId: 'r1', branchName: 'KaiZen Family', companyName: 'Manulife', status: 'pending',
      requestedAt: '2026-11-04T00:00:00.000Z', reason: null, createdKpmId: null,
    };

    it('P19-T2 AC-2 AC-3 enables Kirim permintaan once the branch is named, with no search result, for the account’s company', async () => {
      // UI-164 exactly: the directory empty, both fields filled, and the button greyed out.
      const { calls } = stubFetch({
        '/join/me': { body: NO_OFFICE },
        '/join/kpm-request': [{ body: { request: null, company: MANULIFE } }, { body: ASKED }],
        '/join/kpms': { body: [] },
      });
      renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

      await userEvent.click(await screen.findByRole('button', { name: 'Ask for an office' }));
      expect(screen.getByText('For Manulife, the company you signed up with.')).toBeInTheDocument();
      const send = screen.getByRole('button', { name: 'Send the request' });
      expect(send).toBeDisabled();
      await userEvent.type(screen.getByLabelText('What is your branch called?'), 'KaiZen Family');
      // The note stays empty: it is optional.
      expect(send).toBeEnabled();
      await userEvent.click(send);

      const post = calls.find((c) => c.url.includes('/join/kpm-request') && c.init.method === 'POST')!;
      // No company sent: the API files it for the one the applicant signed up with.
      expect(JSON.parse(String(post.init.body))).toEqual({ branchName: 'KaiZen Family' });
      expect(await screen.findByText('You asked for an office')).toBeInTheDocument();
    });

    it('P19-T2 AC-2 asks an account with no company for one, in the same card, saying what is missing', async () => {
      const { calls } = stubFetch({
        '/join/me': { body: NO_OFFICE },
        '/join/kpm-request': [{ body: { request: null, company: null } }, { body: ASKED }],
        '/join/kpms': { body: [] },
        '/companies': { body: [{ _id: 'c-allianz', name: 'Allianz Life' }, { _id: 'c-manulife', name: 'Manulife' }] },
      });
      renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

      await userEvent.click(await screen.findByRole('button', { name: 'Ask for an office' }));
      expect(screen.getByText('Your account has no company yet. Choose the one you work for.')).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('What is your branch called?'), 'stellar');
      const send = screen.getByRole('button', { name: 'Send the request' });
      expect(send).toBeDisabled();

      await screen.findByRole('option', { name: 'Manulife' });
      await userEvent.selectOptions(screen.getByLabelText('Your company'), 'c-manulife');
      expect(send).toBeEnabled();
      await userEvent.click(send);
      const post = calls.find((c) => c.url.includes('/join/kpm-request') && c.init.method === 'POST')!;
      expect(JSON.parse(String(post.init.body))).toEqual({ companyId: 'c-manulife', branchName: 'stellar' });
    });
  });
});
