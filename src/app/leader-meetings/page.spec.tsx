import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import LeaderMeetingsPage from './page';
import { card, CORE_LEADER_ME, FIELD_ME, listView, notFound, OWNER_ME, refusal, SHELL_STUBS } from './forum-fixtures';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const list = (body = listView()) => stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body } });
const main = () => within(screen.getByRole('main'));

describe('/leader-meetings — the list (P19.22-T8 AC-1)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.22-T8 AC-1 the title, the note, + New forum, and the navy next-forum card', async () => {
    list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByRole('heading', { level: 1, name: 'Strategic Leader Forum' })).toBeInTheDocument();
    expect(main().getByText('Core leaders meet every 2 weeks · 60–90 minutes')).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'New forum' })).toBeInTheDocument();
    const next = within(document.querySelector('[data-next-forum="m-15"]') as HTMLElement);
    expect(next.getByText('Next forum')).toBeInTheDocument();
    expect(next.getByRole('heading', { name: 'Forum #15' })).toBeInTheDocument();
    expect(next.getByText(/28 Nov 2026 · 14[.:]00 · 8 days to go$/)).toBeInTheDocument();
    expect(next.getByText('3 core leaders')).toBeInTheDocument();
    expect(next.getByRole('img', { name: 'Agus Santoso, Sari Dewanti, Yosef Pratama' })).toBeInTheDocument();
    expect(next.getByRole('link', { name: 'Prepare the agenda' })).toHaveAttribute('href', '/leader-meetings/m-15?tab=agenda');
  });

  it('P19.22-T8 AC-1 all forums newest first: #n, the date · time, Agenda n items or Action items x/y done, the state pill', async () => {
    list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('All forums');
    const rows = [...document.querySelectorAll('[data-forum-row]')].map((r) => within(r as HTMLElement));
    expect(rows.map((r) => r.getByRole('link').getAttribute('aria-label'))).toEqual([
      'Open forum #15', 'Open forum #14', 'Open forum #13', 'Open forum #12',
    ]);
    expect(rows[0].getByText('Agenda 3 items')).toBeInTheDocument();
    expect(rows[0].getByText('Upcoming')).toHaveClass('bg-pill-blue');
    expect(rows[1].getByText('1/5').closest('span')).toHaveTextContent('Action items 1/5 done');
    expect(rows[1].getByText('Done')).toHaveClass('bg-pill-green');
    expect(rows[1].getByRole('link')).toHaveAttribute('href', '/leader-meetings/m-14');
    // A forum made before P19.22 has a date alone.
    expect(rows[3].getByText(/18 O[ck]t 2026$/)).toBeInTheDocument();
  });

  it('P19.22-T8 AC-1 a core leader makes a forum: date and time, then its agenda opens', async () => {
    const { calls } = stubFetch({
      ...SHELL_STUBS,
      'GET /leader-meetings': { body: listView() },
      'POST /leader-meetings': { status: 201, body: card({ id: 'm-16', number: 16, date: '2026-12-12', state: 'upcoming' }) },
    });
    renderWithSession(<LeaderMeetingsPage />, { me: CORE_LEADER_ME });
    await userEvent.click(await screen.findByRole('button', { name: 'New forum' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New forum' }));
    expect(dialog.getByLabelText('Time')).toHaveValue('14:00');
    await userEvent.click(dialog.getByRole('button', { name: 'Create forum' }));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toEqual({ date: '2026-11-20', time: '14:00' });
    expect(nav.push).toHaveBeenCalledWith('/leader-meetings/m-16?tab=agenda');
  });

  it('P19.22-T8 AC-1 no + New forum without the grant; no forum yet; no next forum card when none is to come', async () => {
    list(listView({ meetings: [], nextId: null, can: { create: false } }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('No forum yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New forum' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-next-forum]')).toBeNull();
  });

  it('P19.22-T8 AC-1 a member who is no core leader meets not found; a failed read says so with Try again', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': notFound });
    renderWithSession(<LeaderMeetingsPage />, { me: FIELD_ME });
    expect(await screen.findByText("This forum can't be found.")).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': refusal(500, 'INTERNAL', 'Something broke.') });
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
