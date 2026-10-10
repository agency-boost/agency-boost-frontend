import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch } from '@test/harness';
import SharedLeaderMeetingPage from './page';
import { CORE_LEADER_ME, FIELD_ME, LINK_CAN, meetingView, notFound, OWNER_ME, SHELL_STUBS } from '../../forum-fixtures';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings/shared/tok_abc-123' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const page = (token = 'tok_abc-123') => <SharedLeaderMeetingPage params={routeParams({ token })} />;
const shared = meetingView({ via: 'link', can: LINK_CAN });

describe('/leader-meetings/shared/[token] — a meeting by its link (P18.1-T3)', () => {
  beforeEach(() => { nav.replace.mockReset(); });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P18.1-T3 AC-2: a member not tagged opens it read-only, in their own shell, with no write control drawn', async () => {
    const { calls } = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/tok_abc-123': { body: shared } });
    renderWithSession(page(), { me: FIELD_ME });
    expect(await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));

    // Save as PDF is drawn (contract, Noted 3); nothing that writes is.
    expect(main.getByRole('button', { name: 'Save as PDF' })).toBeInTheDocument();
    for (const name of ['Save', 'Share', '+ New meeting', /Change the date/, '+ Add item', '+ Add action item']) {
      expect(main.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(main.queryByRole('link', { name: 'Manage tags →' })).not.toBeInTheDocument();
    // Arrived by a link: no list to go back to.
    expect(main.queryByRole('link', { name: '← Back to all meetings' })).not.toBeInTheDocument();
    for (const tab of ['Overview & Stats', 'Agenda', 'Action Items']) {
      await userEvent.click(main.getByRole('tab', { name: tab }));
      const panel = within(screen.getByRole('tabpanel'));
      expect(panel.queryAllByRole('textbox')).toEqual([]);
      expect(panel.queryAllByRole('checkbox')).toEqual([]);
    }
    // One read of the link — its opening is audited, so it is never read twice for one visit.
    expect(calls.filter((c) => c.url.includes('/leader-meetings/shared/'))).toHaveLength(1);
    // The field view: no console chrome.
    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
  });

  it('P18.1-T3 AC-2: the Owner reads a link in the console, read-only all the same', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/tok_abc-123': { body: shared } });
    renderWithSession(page(), { me: OWNER_ME });
    await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
    expect(screen.getByText('KPM OWNER')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('P18.1-T3 AC-2: an unknown, expired, stopped or other office’s link is one not-found state', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/': notFound });
    renderWithSession(page('expired'), { me: CORE_LEADER_ME });
    expect(await screen.findByRole('heading', { name: "This link doesn't open anything." })).toBeInTheDocument();
    expect(screen.getByText('It may have expired or been stopped. Ask whoever shared it for a new one.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/unit/dashboard');
  });

  it('the token is sent as one path segment, whatever it holds', async () => {
    const { calls } = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/': notFound });
    renderWithSession(page('a/b?c'), { me: FIELD_ME });
    await screen.findByRole('heading', { name: "This link doesn't open anything." });
    expect(calls.some((c) => c.url.endsWith('/leader-meetings/shared/a%2Fb%3Fc'))).toBe(true);
  });

  it('P18.1-T3 AC-2: a reader not signed in signs in first, and comes back to the link', async () => {
    stubFetch({});
    renderWithSession(page(), { me: null });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login?next=%2Fleader-meetings%2Fshared%2Ftok_abc-123'));
  });
});
