import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch } from '@test/harness';
import SharedLeaderMeetingPage from './page';
import { FIELD_ME, LINK_CAN, meetingView, notFound, SHELL_STUBS } from '../../forum-fixtures';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings/shared/tok_abc-123', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const page = (token = 'tok_abc-123') => <SharedLeaderMeetingPage params={routeParams({ token })} />;

describe('/leader-meetings/shared/[token] — a forum by its link (P18.1-T3, P19.22-T8 AC-2)', () => {
  beforeEach(() => { nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.22-T8 AC-2 a member who is no core leader reads it: agenda and action items, read-only, no analytics tabs', async () => {
    const { calls } = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/tok_abc-123': { body: meetingView({ via: 'link', can: LINK_CAN }) } });
    renderWithSession(page(), { me: FIELD_ME });
    expect(await screen.findByRole('heading', { level: 2, name: 'Forum #14' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Agenda', 'Action items']);
    expect(main.queryByRole('link', { name: 'All forums' })).not.toBeInTheDocument();
    expect(main.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(main.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
    expect(main.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).disabled)).toBe(true);
    expect(main.queryByRole('button', { name: 'Add agenda' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/leader-meetings/shared/'))).toHaveLength(1);
  });

  it('P18.1-T3 AC-2 an unknown or expired link is one not-found state', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/': notFound });
    renderWithSession(page('gone'), { me: FIELD_ME });
    expect(await screen.findByText("This link doesn't open anything.")).toBeInTheDocument();
  });
});
