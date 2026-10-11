import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import LeaderMeetingsPage from './page';
import {
  card, CORE_LEADER_ME, editors, FIELD_ME, listView, MAYA, MEETINGS, notFound, OWNER_ME, refusal, SHELL_STUBS,
} from './forum-fixtures';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const list = (body = listView()) => stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body } });
const main = () => within(screen.getByRole('main'));
/** The cards, in the order drawn: each meeting's `li` in the list (the avatar stacks are lists of their own). */
const cards = () => [...screen.getAllByRole('heading', { level: 2 })].map((h) => h.closest('li') as HTMLElement);

describe('/leader-meetings — the list (P18.1-T2)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('P18.1-T2 AC-2: the title, the sub-line and the list’s own line, verbatim, in the Owner’s console', async () => {
    list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByRole('heading', { level: 1, name: 'Strategic Leader Forum' })).toBeInTheDocument();
    expect(screen.getByText('Biweekly check-ins with your core leaders — agenda, notes, and action items')).toBeInTheDocument();
    expect(await screen.findByText(
      'Biweekly strategic check-ins with your core leaders — agenda, discussion notes, and action items, updated together.',
    )).toBeInTheDocument();
    // The console's own shell, with the item live.
    expect(screen.getByText('KPM OWNER')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Strategic Leader Forum' })).toHaveAttribute('href', '/leader-meetings');
  });

  it('P18.1-T2 AC-2: a card per meeting, newest first, each with its date block, title, meta, initials, open items and Open', async () => {
    // Served oldest first: the screen orders them.
    list(listView({ meetings: [...MEETINGS].reverse() }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');

    const rows = cards();
    expect(rows.map((r) => within(r).getByRole('heading').textContent)).toEqual([
      'Strategic Check-in — #14', 'Strategic Check-in — #13', 'Strategic Check-in — #12',
    ]);
    const [upcoming, past, clear] = rows.map((r) => within(r));
    expect(upcoming.getByText('Oct 13, 2026 · Upcoming · 3 core leaders tagged')).toBeInTheDocument();
    expect(past.getByText('Sep 26, 2026 · Completed · 2 core leaders tagged')).toBeInTheDocument();
    // F-186: singular for one.
    expect(clear.getByText('Sep 12, 2026 · Completed · 1 core leader tagged')).toBeInTheDocument();

    expect(upcoming.getByText('Oct')).toBeInTheDocument();
    expect(upcoming.getByText('13')).toBeInTheDocument();
    expect(rows[0].querySelector('[aria-hidden="true"]')).toHaveClass('bg-navy');
    // Grey once Completed (`:630`).
    expect(rows[1].querySelector('[aria-hidden="true"]')).toHaveClass('bg-muted');

    expect(upcoming.getByRole('img', { name: 'Agus Santoso (AB)' })).toHaveTextContent('AS');
    expect(upcoming.getByRole('img', { name: 'Sari Dewanti (AAB)' })).toHaveTextContent('SD');
    expect(upcoming.getByRole('img', { name: 'Yosef Pratama (AB)' })).toBeInTheDocument();
    // The Owner is not among them (`:2591`), nor an Admin who is not tagged: three avatars for "3".
    expect(upcoming.queryByRole('img', { name: /Wilson Tanoto/ })).not.toBeInTheDocument();
    expect(upcoming.queryByRole('img', { name: /Maya Halim/ })).not.toBeInTheDocument();
    expect(upcoming.getAllByRole('img')).toHaveLength(3);

    expect(rows[0]).toHaveTextContent('4 open items');
    expect(rows[1]).toHaveTextContent('2 open items');
    expect(clear.getByText('All clear')).toBeInTheDocument();

    const open = upcoming.getByRole('link', { name: 'Open' });
    expect(open).toHaveAttribute('href', '/leader-meetings/m-14');
    expect(open).toHaveAccessibleDescription('Strategic Check-in — #14');
  });

  it('P18.1-T2 AC-2: the avatars are the people the count counts — a tagged Admin among them, an untagged one not', async () => {
    list(listView({
      meetings: [card({ editors: editors({ admins: [{ ...MAYA, tagged: true }], coreLeaderCount: 4 }) })],
    }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('Oct 13, 2026 · Upcoming · 4 core leaders tagged')).toBeInTheDocument();
    const avatars = within(cards()[0]).getAllByRole('img');
    expect(avatars.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Maya Halim (AAB)', 'Agus Santoso (AB)', 'Sari Dewanti (AAB)', 'Yosef Pratama (AB)',
    ]);
  });

  it('P18.1-T2 AC-2: "1 open item", singular', async () => {
    list(listView({ meetings: [card({ openItems: 1 })] }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText(/open item$/)).toHaveTextContent('1 open item');
  });

  it('P18.1-T2 AC-2: All · Upcoming · Past, each saying whether it is pressed, filtered over the one read', async () => {
    const { mock } = list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');
    const all = screen.getByRole('button', { name: 'All' });
    const upcoming = screen.getByRole('button', { name: 'Upcoming' });
    const past = screen.getByRole('button', { name: 'Past' });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(upcoming).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(past);
    expect(past).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Strategic Check-in — #14')).not.toBeInTheDocument();
    expect(screen.getByText('Strategic Check-in — #13')).toBeInTheDocument();

    await userEvent.click(upcoming);
    expect(screen.getByText('Strategic Check-in — #14')).toBeInTheDocument();
    expect(screen.queryByText('Strategic Check-in — #12')).not.toBeInTheDocument();
    expect(mock.mock.calls.filter(([url]) => String(url).endsWith('/leader-meetings'))).toHaveLength(1);
  });

  it('ADR-0137: the filter on is navy — what is chosen; + New meeting is amber with navy words — an action', async () => {
    list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');
    const all = screen.getByRole('button', { name: 'All' });
    const past = screen.getByRole('button', { name: 'Past' });
    expect(all).toHaveClass('bg-navy', 'text-white');
    expect(past).not.toHaveClass('bg-navy');
    await userEvent.click(past);
    expect(past).toHaveClass('bg-navy', 'text-white');
    for (const option of [all, past]) expect(option).not.toHaveClass('bg-amber');

    const create = screen.getByRole('button', { name: '+ New meeting' });
    expect(create).toHaveClass('bg-amber', 'text-navy', 'hover:bg-amber-dark');
    expect(create).not.toHaveClass('bg-navy');
  });

  it('P18.1-T2 AC-2: "No meetings match this filter." when a filter leaves nothing (`:2619`)', async () => {
    list(listView({ meetings: [MEETINGS[1], MEETINGS[2]] }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #13');
    await userEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(screen.getByText('No meetings match this filter.')).toBeInTheDocument();
  });

  it('L-110: no meeting at all is "No meetings yet.", with + New meeting beside the filter as always', async () => {
    list(listView({ meetings: [] }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('No meetings yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New meeting' })).toBeInTheDocument();
    expect(screen.queryByText('No meetings match this filter.')).not.toBeInTheDocument();
  });

  it('P18.1-T2 AC-2: a Core Leader reads the list in their own shell, with no + New meeting', async () => {
    list(listView({ can: { create: false } }));
    renderWithSession(<LeaderMeetingsPage />, { me: CORE_LEADER_ME });
    await screen.findByText('Strategic Check-in — #14');
    expect(screen.queryByRole('button', { name: '+ New meeting' })).not.toBeInTheDocument();
    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
  });

  it('P18.1-T2 AC-1: a member the server answers 404 meets the not-found state, linking to where they land', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': notFound });
    renderWithSession(<LeaderMeetingsPage />, { me: FIELD_ME });
    expect(await screen.findByRole('heading', { name: "This meeting can't be found." })).toBeInTheDocument();
    expect(screen.getByText("It may have been deleted, or it isn't one you can open.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/activity/log');
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
  });

  it('L-110: the wait is a skeleton of the filter and three cards, named; an error is the banner with Try again', async () => {
    stubFetch({
      ...SHELL_STUBS,
      'GET /leader-meetings': [refusal(500, 'INTERNAL_ERROR', 'Something went wrong.'), { body: listView() }],
    });
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading meetings…');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Strategic Check-in — #14')).toBeInTheDocument();
  });

  it('a reader not signed in is sent to sign in, and back here after (D-share)', async () => {
    stubFetch({});
    renderWithSession(<LeaderMeetingsPage />, { me: null });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login?next=%2Fleader-meetings'));
  });

  it('a reader who signed out themselves here goes to plain sign-in, carrying no page (2026-10-11)', async () => {
    stubFetch({});
    renderWithSession(<LeaderMeetingsPage />, { me: null, signedOut: true });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    expect(nav.replace).not.toHaveBeenCalledWith(expect.stringContaining('next='));
  });

  it('P18.1-T2 AC-8: markup in a title is text — <b> and <script> drawn as typed', async () => {
    list(listView({ meetings: [card({ title: '<b>Bold</b> <script>alert(1)</script>' })] }));
    const { container } = renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('<b>Bold</b> <script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('main b, main script')).toBeNull();
  });

  it('P18.1-T2 AC-8: at 360px a card wraps its right-hand side under the title instead of widening the page', async () => {
    list();
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');
    const [first] = cards();
    expect(first).toHaveClass('flex-wrap');
    expect(within(first).getByRole('heading').parentElement).toHaveClass('min-w-0');
    expect(within(first).getByRole('heading')).toHaveClass('break-words');
  });

  describe('+ New meeting (OD-145, I-254)', () => {
    it('P18.1-T2 AC-2: opens New meeting, titled one past the highest number, and the meeting opens once made', async () => {
      const { calls } = stubFetch({
        ...SHELL_STUBS,
        'GET /leader-meetings': { body: listView() },
        'POST /leader-meetings': { status: 201, body: card({ id: 'm-15', number: 15, title: 'Strategic Check-in — #15', date: '2026-10-27' }) },
      });
      renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
      await userEvent.click(await screen.findByRole('button', { name: '+ New meeting' }));

      const dialog = within(screen.getByRole('dialog', { name: 'New meeting' }));
      const title = dialog.getByRole('textbox', { name: 'Title' });
      expect(title).toHaveValue('Strategic Check-in — #15');
      expect(title).toHaveAttribute('maxLength', '120');
      await userEvent.type(dialog.getByLabelText('Date'), '2026-10-27');
      await userEvent.click(dialog.getByRole('button', { name: 'Create meeting' }));

      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/leader-meetings/m-15'));
      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(String(post.init.body))).toEqual({ title: 'Strategic Check-in — #15', date: '2026-10-27' });
    });

    it('asks for a title and a date before sending anything, in the spec’s words', async () => {
      const { calls } = list();
      renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
      await userEvent.click(await screen.findByRole('button', { name: '+ New meeting' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New meeting' }));
      await userEvent.clear(dialog.getByRole('textbox', { name: 'Title' }));
      await userEvent.type(dialog.getByRole('textbox', { name: 'Title' }), '   ');
      await userEvent.click(dialog.getByRole('button', { name: 'Create meeting' }));

      expect(dialog.getByText('Give the meeting a title.')).toBeInTheDocument();
      expect(dialog.getByText('Pick a date.')).toBeInTheDocument();
      expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription('Give the meeting a title.');
      expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    });

    it('P18.1-T2 AC-9: the server’s refusal stands under its field; anything else is the banner', async () => {
      stubFetch({
        ...SHELL_STUBS,
        'GET /leader-meetings': { body: listView() },
        'POST /leader-meetings': [
          refusal(400, 'VALIDATION_FAILED', 'date must be a valid date', { violations: ['date must be a valid date'] }),
          refusal(503, 'SERVICE_UNAVAILABLE', 'Try again shortly.'),
        ],
      });
      renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
      await userEvent.click(await screen.findByRole('button', { name: '+ New meeting' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New meeting' }));
      await userEvent.type(dialog.getByLabelText('Date'), '2026-10-27');
      await userEvent.click(dialog.getByRole('button', { name: 'Create meeting' }));
      expect(await dialog.findByText('Pick a date.')).toBeInTheDocument();
      expect(dialog.queryByText('Give the meeting a title.')).not.toBeInTheDocument();

      await userEvent.click(dialog.getByRole('button', { name: 'Create meeting' }));
      expect(await dialog.findByText('Try again shortly.')).toBeInTheDocument();
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('Cancel closes it, and opened again it starts over', async () => {
      list();
      renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
      await userEvent.click(await screen.findByRole('button', { name: '+ New meeting' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), ' extra');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '+ New meeting' }));
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Strategic Check-in — #15');
    });
  });

  it('the core leaders drawn are the meeting’s own — the frozen list on a past one (F-186)', async () => {
    list(listView({ meetings: [card({ state: 'completed', editors: editors({ coreLeaders: [], coreLeaderCount: 0, frozen: true }) })] }));
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('Oct 13, 2026 · Completed · 0 core leaders tagged')).toBeInTheDocument();
    expect(main().queryByRole('img')).not.toBeInTheDocument();
  });
});
