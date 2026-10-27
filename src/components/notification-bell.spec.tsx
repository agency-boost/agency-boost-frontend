import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { INBOX_CHANGED, type InboxChange } from '@/lib/notifications';
import { useUnreadCount } from '@/lib/use-unread-count';
import { NotificationBell, UnreadBadge, unreadBadgeText, withUnread } from './notification-bell';

const nav = vi.hoisted(() => ({ pathname: '/activity/log', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const item = (over: Record<string, unknown> = {}) => ({
  notificationId: 'n-1', templateId: 'join_request.approved', title: 'You are in',
  detail: 'Your request was approved.', href: null as string | null, kpmId: 'kpm-1',
  createdAt: '2026-09-01T00:00:00.000Z', readAt: null as string | null, ...over,
});
const COACHING = item({
  notificationId: 'n-2', templateId: 'coaching_session.finalized', title: 'Your coaching session was finalized',
  detail: 'Wilson Tanoto finalized your session.', href: '/coaching/me?session=s-0924',
});
const page = (items: ReturnType<typeof item>[], over: Record<string, unknown> = {}) => ({
  items, unread: items.filter((i) => i.readAt === null).length, total: items.length, page: 1, pageSize: 8, ...over,
});

/** Every role holds both, `own` (roles-and-permissions §3.11b). */
const READER = makeMe({ permissions: ['notification:read_inbox', 'notification:mark_read'] });

/**
 * A Super Admin looking at a member's account without elevation: the server serves its permissions
 * without the mark, which is a write (§3.13), and refuses every mark it is sent.
 */
const SUPPORT = makeMe({
  isImpersonating: true,
  impersonationReadOnly: true,
  impersonatedBy: 'u-admin',
  permissions: ['notification:read_inbox'],
});

/** The bell as a shell wires it: the count from `useUnreadCount`, which hears every change. */
function Bell() {
  return <NotificationBell href="/notifications" unread={useUnreadCount()} />;
}

function renderBell(me = READER) {
  return renderWithSession(
    <>
      <p data-testid="outside">elsewhere</p>
      <Bell />
      <button type="button">after the bell</button>
    </>,
    { me },
  );
}

const bell = (name: string | RegExp = /^Notifications/) => screen.getByRole('button', { name });
const popover = () => screen.queryByRole('dialog', { name: 'Notifications' });

/** jsdom cannot navigate; next/link's href is where a link goes, and the click is what is under test. */
const swallow = (event: Event) => event.preventDefault();

describe('the bell’s popover (P12.1-T2)', () => {
  beforeEach(() => {
    nav.pathname = '/activity/log';
    nav.push.mockClear();
    document.addEventListener('click', swallow);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', swallow);
  });

  it('AC-1 is a button that opens a dialog beside it, takes the focus in, and never navigates', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();

    const trigger = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('href');
    await userEvent.click(trigger);

    const open = popover()!;
    expect(open).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', open.id);
    // The badge stays, counting the whole inbox.
    expect(within(trigger).getByText('1')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();

    // A second click closes it.
    await userEvent.click(trigger);
    expect(popover()).toBeNull();
  });

  it('P18.95-T1 AC-10 is a 44 × 44 target on a phone and 36 × 36 from 768 px', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();
    const trigger = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    expect(trigger).toHaveClass('h-9', 'w-9', 'max-md:min-h-11', 'max-md:min-w-11');
  });

  it('AC-2 reads the latest eight each time it opens, newest first as the server sends them', async () => {
    const eight = Array.from({ length: 8 }, (_, i) => item({ notificationId: `n-${i}`, title: `Notice ${i + 1}` }));
    const { calls } = stubFetch({ '/notifications': { body: page(eight, { total: 30, unread: 8 }) } });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 8 unread' }));
    const rows = await within(popover()!).findAllByRole('button', { name: /^Unread: Notice / });
    // The day after each title (`1 Sep`, ADR-0167 §1) starts with a digit, so the title stops where the date begins.
    expect(rows.map((r) => r.textContent?.match(/Notice \d+(?= ?\d{1,2} [A-Z]| ?\d{2}\.\d{2})/)?.[0])).toEqual(eight.map((i) => i.title));
    const reads = () => calls.filter((c) => c.url.endsWith('/notifications?page=1&pageSize=8')).length;
    expect(reads()).toBe(1);

    await userEvent.click(bell());
    await userEvent.click(bell());
    await vi.waitFor(() => expect(reads()).toBe(2));
  });

  it('AC-2 shows a loading state while it reads', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('pageSize=8')) await held;
      return { ok: true, status: 200, json: async () => page([item()]) } as Response;
    }));
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(within(popover()!).getByRole('status')).toHaveTextContent('Loading your notifications…');
    release?.();
    expect(await within(popover()!).findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
    expect(within(popover()!).queryByRole('status')).toBeNull();
  });

  it('AC-2 says what the inbox is for when it is empty', async () => {
    stubFetch({ '/notifications': { body: page([]) } });
    renderBell();

    await userEvent.click(bell('Notifications'));
    expect(await within(popover()!).findByText('Nothing yet. This is where you will hear about your unit.')).toBeInTheDocument();
    // Nothing unread, nothing to mark.
    expect(within(popover()!).queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('AC-2 says why when the read fails, with a way to try again', async () => {
    stubFetch({
      '/notifications?page=1&pageSize=8': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-1' } } },
        { body: page([item()]) },
      ],
      '/notifications': { body: page([item()]) },
    });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await within(popover()!).findByText('Something broke.')).toBeInTheDocument();
    await userEvent.click(within(popover()!).getByRole('button', { name: 'Try again' }));
    expect(await within(popover()!).findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
    expect(within(popover()!).queryByText('Something broke.')).toBeNull();
  });

  it('AC-3, AC-6 marks all read from the top, and the badge takes the count from the answer', async () => {
    const heard: InboxChange[] = [];
    const listen = (e: Event) => heard.push((e as CustomEvent<InboxChange>).detail);
    window.addEventListener(INBOX_CHANGED, listen);
    try {
      const { calls } = stubFetch({
        'POST /notifications/read-all': { body: { unread: 0 } },
        '/notifications?page=1&pageSize=8': [
          { body: page([item(), COACHING]) },
          { body: page([item({ readAt: '2026-10-03T00:00:00.000Z' }), { ...COACHING, readAt: '2026-10-03T00:00:00.000Z' }]) },
        ],
        '/notifications': { body: page([item(), COACHING]) },
      });
      renderBell();

      await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
      await userEvent.click(await within(popover()!).findByRole('button', { name: 'Mark all read' }));

      expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
      // The badge's move as it is clicked (P18.95-T1 AC-7), then the answer's count.
      expect(heard).toEqual([
        expect.objectContaining({ unread: 0, local: true }),
        expect.objectContaining({ unread: 0 }),
      ]);
      expect(heard[1].local).toBeUndefined();
      expect(within(popover()!).queryByRole('button', { name: 'Mark all read' })).toBeNull();
      expect(within(popover()!).getByRole('button', { name: 'You are in' })).toBeInTheDocument();
      // The focus stays in the popover rather than going with the button.
      expect(popover()).toHaveFocus();
      expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    } finally {
      window.removeEventListener(INBOX_CHANGED, listen);
    }
  });

  it('AC-3, AC-4 goes to /notifications from See all notifications, and closes as it does', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const all = within(popover()!).getByRole('link', { name: 'See all notifications' });
    expect(all).toHaveAttribute('href', '/notifications');
    await userEvent.click(all);
    expect(popover()).toBeNull();
  });

  it('AC-4 closes on Escape, and puts focus back on the bell', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await within(popover()!).findByRole('button', { name: 'Unread: You are in' });
    await userEvent.keyboard('{Escape}');
    expect(popover()).toBeNull();
    expect(bell()).toHaveFocus();
    expect(bell()).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-4 closes on a click outside it, and not on one inside it', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(within(popover()!).getByRole('heading', { name: 'Notifications' }));
    expect(popover()).not.toBeNull();
    await userEvent.click(screen.getByTestId('outside'));
    expect(popover()).toBeNull();
  });

  it('AC-4 closes when the focus leaves it, so it is not left open over the page', async () => {
    stubFetch({ '/notifications': { body: page([]) } });
    renderBell();

    await userEvent.click(bell('Notifications'));
    await within(popover()!).findByText(/Nothing yet/);
    within(popover()!).getByRole('link', { name: 'See all notifications' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after the bell' })).toHaveFocus();
    expect(popover()).toBeNull();
  });

  it('P12.1-T3 AC-3 follows a row with an address, marks it read, and closes; the badge drops by one', async () => {
    const { calls } = stubFetch({
      'POST /notifications/n-2/read': { body: { notificationId: 'n-2', readAt: '2026-10-03T00:00:00.000Z', unread: 1 } },
      '/notifications': { body: page([COACHING, item()]) },
    });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const link = await within(popover()!).findByRole('link', { name: 'Unread: Your coaching session was finalized' });
    expect(link).toHaveAttribute('href', '/coaching/me?session=s-0924');
    await userEvent.click(link);

    expect(popover()).toBeNull();
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url.split('/v1')[1])).toEqual(['/notifications/n-2/read']);
  });

  it('P12.1-T3 AC-4 opens a row with nowhere to go in its modal, over the popover, and Escape shuts the modal alone', async () => {
    stubFetch({
      'POST /notifications/n-1/read': { body: { notificationId: 'n-1', readAt: '2026-10-03T00:00:00.000Z', unread: 0 } },
      '/notifications': { body: page([item()]) },
    });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(await within(popover()!).findByRole('button', { name: 'Unread: You are in' }));

    const modal = screen.getByRole('dialog', { name: 'You are in' });
    expect(within(modal).getByText('Your request was approved.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();

    // A click inside the modal is not a click outside the popover.
    await userEvent.click(within(modal).getByText('Your request was approved.'));
    expect(popover()).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'You are in' })).toBeNull();
    expect(popover()).not.toBeNull();
    expect(within(popover()!).getByRole('button', { name: 'You are in' })).toHaveFocus();
  });

  it('P12.1-T3 AC-5 flips a row with its toggle, without opening it or closing the popover', async () => {
    stubFetch({
      'POST /notifications/n-2/read': { body: { notificationId: 'n-2', readAt: '2026-10-03T00:00:00.000Z', unread: 0 } },
      '/notifications': { body: page([COACHING]) },
    });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await within(popover()!).findByRole('link', { name: /Your coaching session/ });
    await userEvent.click(within(popover()!).getByRole('button', { name: 'Mark as read' }));

    expect(await within(popover()!).findByRole('button', { name: 'Mark as unread' })).toBeInTheDocument();
    expect(popover()).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: /coaching/ })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  describe('P18.95-T1 AC-7 — the bell’s count changes at once (the client’s UI review, 2026-10-26)', () => {
    /** An answer that waits until the test gives it: the badge is read while the write is still out. */
    function later<T>() {
      let give!: (value: T) => void;
      const promise = new Promise<T>((resolve) => { give = resolve; });
      return { promise, give };
    }
    const READ_AT = '2026-10-26T03:00:00.000Z';
    const refused = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r' } };

    it('P18.95-T1 AC-7: marking one read drops the count before the answer, and the answer settles it', async () => {
      const answer = later<unknown>();
      stubFetch({
        'POST /notifications/n-2/read': { body: answer.promise },
        '/notifications': { body: page([COACHING, item()]) },
      });
      renderBell();
      await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
      await within(popover()!).findByRole('link', { name: /Your coaching session/ });

      await userEvent.click(within(popover()!).getAllByRole('button', { name: 'Mark as read' })[0]);

      // No reload, no round trip: the badge has moved while the write is still out.
      expect(bell()).toHaveAccessibleName('Notifications, 1 unread');
      answer.give({ notificationId: 'n-2', readAt: READ_AT, unread: 1 });
      expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
    });

    it('P18.95-T1 AC-7: marking one unread raises the count at once', async () => {
      const answer = later<unknown>();
      stubFetch({
        'POST /notifications/n-2/unread': { body: answer.promise },
        '/notifications': { body: page([{ ...COACHING, readAt: READ_AT }, item()]) },
      });
      renderBell();
      await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
      await within(popover()!).findByRole('link', { name: /Your coaching session/ });

      await userEvent.click(within(popover()!).getByRole('button', { name: 'Mark as unread' }));

      expect(bell()).toHaveAccessibleName('Notifications, 2 unread');
      answer.give({ notificationId: 'n-2', readAt: null, unread: 2 });
      expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
    });

    it('P18.95-T1 AC-7: a refused mark puts the count back where it was, and says why', async () => {
      const answer = later<unknown>();
      stubFetch({
        'POST /notifications/n-2/read': { status: 500, body: answer.promise },
        '/notifications': { body: page([COACHING, item()]) },
      });
      renderBell();
      await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
      await within(popover()!).findByRole('link', { name: /Your coaching session/ });

      await userEvent.click(within(popover()!).getAllByRole('button', { name: 'Mark as read' })[0]);
      expect(bell()).toHaveAccessibleName('Notifications, 1 unread');
      answer.give(refused);

      expect(await within(popover()!).findByText('Something went wrong.')).toBeInTheDocument();
      expect(bell()).toHaveAccessibleName('Notifications, 2 unread');
    });

    it('P18.95-T1 AC-7: Mark all read empties the badge at once, and a refusal puts the count back', async () => {
      const first = later<unknown>();
      const second = later<unknown>();
      stubFetch({
        'POST /notifications/read-all': [{ body: first.promise }, { status: 500, body: second.promise }],
        '/notifications': { body: page([COACHING, item()]) },
      });
      renderBell();
      await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
      await userEvent.click(await within(popover()!).findByRole('button', { name: 'Mark all read' }));

      expect(bell()).toHaveAccessibleName('Notifications');
      expect(screen.queryByText('2')).toBeNull();
      // The server, as it happens, still holds them: its answer is the count that stands.
      first.give({ unread: 2 });
      expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();

      await userEvent.click(await within(popover()!).findByRole('button', { name: 'Mark all read' }));
      expect(bell()).toHaveAccessibleName('Notifications');
      second.give(refused);
      expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
    });

    it('P18.95-T1 AC-7: shows 9+ past nine, and the number itself once a mark brings it to nine', async () => {
      const answer = later<unknown>();
      const many = Array.from({ length: 10 }, (_, i) => item({ notificationId: `n-${i + 10}`, title: `Notice ${i + 10}` }));
      stubFetch({
        'POST /notifications/n-10/read': { body: answer.promise },
        '/notifications': { body: page(many) },
      });
      renderBell();
      expect((await screen.findByRole('button', { name: 'Notifications, 10 unread' })).textContent).toContain('9+');
      await userEvent.click(bell());
      await within(popover()!).findByRole('button', { name: /Notice 10$/ });

      await userEvent.click(within(popover()!).getAllByRole('button', { name: 'Mark as read' })[0]);

      expect(bell()).toHaveAccessibleName('Notifications, 9 unread');
      expect(bell().textContent).toContain('9');
      expect(bell().textContent).not.toContain('9+');
      answer.give({ notificationId: 'n-10', readAt: READ_AT, unread: 9 });
    });
  });

  it('the Phase 12.1 exit review’s N2: a read-only support session gets no toggle and no Mark all read, and a row it opens sends no mark', async () => {
    const { calls } = stubFetch({ '/notifications': { body: page([COACHING, item()]) } });
    renderBell(SUPPORT);

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const row = await within(popover()!).findByRole('button', { name: 'Unread: You are in' });
    expect(within(popover()!).queryByRole('button', { name: /^Mark (as|all) / })).toBeNull();

    // A row with nowhere to go still opens its modal, and is still unread behind it.
    await userEvent.click(row);
    const modal = screen.getByRole('dialog', { name: 'You are in' });
    await userEvent.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(within(popover()!).getByRole('button', { name: 'Unread: You are in' })).toHaveFocus();

    // A row with an address is still followed, and the popover closes as it is.
    const link = within(popover()!).getByRole('link', { name: 'Unread: Your coaching session was finalized' });
    expect(link).toHaveAttribute('href', '/coaching/me?session=s-0924');
    await userEvent.click(link);
    expect(popover()).toBeNull();

    // Nothing sent for the server to refuse, so nothing to put back or explain; the badge still counts both.
    expect(calls.filter((c) => (c.init.method ?? 'GET') !== 'GET')).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  });

  it('AC-5 opens under the bar at its full width on a phone, and beside the sidebar’s foot from 768px, scrolling inside itself', async () => {
    stubFetch({ '/notifications': { body: page([item()]) } });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const open = popover()!;
    // jsdom lays nothing out, so the classes that place it are what is checked.
    for (const phone of ['absolute', 'inset-x-0', 'top-full', 'max-h-[calc(100dvh-4.5rem)]']) expect(open).toHaveClass(phone);
    for (const wide of ['md:left-full', 'md:bottom-3', 'md:top-auto', 'md:inset-x-auto', 'md:max-h-[calc(100vh-1.5rem)]']) {
      expect(open).toHaveClass(wide);
    }
    // The rows scroll; the heading and See all notifications stay put.
    const rows = within(open).getByRole('button', { name: 'Unread: You are in' }).closest('.overflow-y-auto');
    expect(rows).not.toBeNull();
    // Positioned against the sidebar, not the bell: nothing between them is.
    expect(open.parentElement).not.toHaveClass('relative');
  });

  it('wears the active tint on /notifications, as the link did', async () => {
    nav.pathname = '/notifications';
    stubFetch({ '/notifications': { body: page([]) } });
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toHaveClass('bg-amber/15');
  });
});

/**
 * **The badge is one component** (P18.95-T12 AC-2): the bell's corner, and on a phone's bar the avatar's, draw
 * `UnreadBadge`, so the two cannot drift in classes, tokens or the `9+` cap (L-13).
 */
describe('UnreadBadge, the bell’s and the phone avatar’s count (P18.95-T12 AC-2)', () => {
  it.each([[1, '1'], [9, '9'], [10, '9+'], [42, '9+']])('P18.95-T12 AC-2 reads %i as %s', (unread, text) => {
    expect(unreadBadgeText(unread)).toBe(text);
    const { container } = render(<UnreadBadge unread={unread} />);
    const badge = container.firstElementChild!;
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    // The bell's classes and tokens, as it drew them before P18.95-T12.
    expect(badge.className).toBe(
      'absolute -right-0.5 -top-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1 text-2xs font-bold text-white',
    );
  });

  it.each([0, -1])('P18.95-T12 AC-2 draws nothing at %i', (unread) => {
    const { container } = render(<UnreadBadge unread={unread} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('P18.95-T12 AC-2 names a control with the exact count, and alone at none', () => {
    expect(withUnread('Notifications', 3)).toBe('Notifications, 3 unread');
    expect(withUnread('Account and notifications', 42)).toBe('Account and notifications, 42 unread');
    expect(withUnread('Account and notifications', 0)).toBe('Account and notifications');
  });

  it('P18.95-T12 AC-2 is the badge the bell wears', async () => {
    stubFetch({ '/notifications': { body: page([item()], { unread: 12 }) } });
    renderWithSession(<NotificationBell href="/notifications" unread={12} />, { me: READER });
    const bell = screen.getByRole('button', { name: 'Notifications, 12 unread' });
    const { container } = render(<UnreadBadge unread={12} />);
    expect(within(bell).getByText('9+').outerHTML).toBe(container.innerHTML);
  });
});
