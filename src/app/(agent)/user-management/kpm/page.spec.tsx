import { screen } from '@testing-library/react';
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

  it('P18.98 §C1: the subtitle names no company, because the directory under it lists every company', async () => {
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
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });
    expect(await screen.findByText(/waiting for a leader to take you on/)).toBeInTheDocument();
  });

  it('offers no "switch office" button, because it would not switch anything', async () => {
    stubFetch({ '/join/me': { body: REGISTERED }, '/join/kpm-request': { body: { request: null } }, '/join/kpms': { body: OFFICES } });
    renderInLayout(AgentLayout, <RegisterKpmPage />, { me: NEWCOMER });

    await screen.findByText(/Registered office/);
    expect(screen.queryByRole('button', { name: /switch/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask\s+whoever administers your office/)).toBeInTheDocument();
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
});
