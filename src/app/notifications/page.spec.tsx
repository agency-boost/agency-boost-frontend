import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { makeMe, makeSession, renderWithSession, stubFetch } from '@test/harness';
import { SessionContext } from '@/lib/session';
import { announceInboxChanged, INBOX_CHANGED, type InboxChange } from '@/lib/notifications';
import NotificationsPage from './page';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/notifications',
}));

const READER = makeMe({
  permissions: ['notification:read_inbox', 'notification:mark_read'],
});

/**
 * A Super Admin looking at a member's account without elevation: the server serves its permissions
 * without the mark, which is a write (roles-and-permissions §3.13), and refuses every mark it is sent.
 */
const SUPPORT = makeMe({
  isImpersonating: true,
  impersonationReadOnly: true,
  impersonatedBy: 'u-admin',
  permissions: ['notification:read_inbox'],
});

type Item = ReturnType<typeof item>;
const item = (over: Record<string, unknown> = {}) => ({
  notificationId: 'n-1', templateId: 'join_request.approved',
  title: 'You are in', detail: 'Your request was approved. You now have a leader.', href: null as string | null,
  kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null as string | null, ...over,
});
const COACHING = item({
  notificationId: 'n-2', templateId: 'coaching_session.finalized', title: 'Your coaching session was finalized',
  detail: 'Wilson Tanoto finalized your session.', href: '/coaching/me?session=s-0924',
});

/** One page of the inbox as `GET /notifications` answers it (P12.1-T4 AC-1). */
const pageOf = (items: Item[], over: Record<string, unknown> = {}) => ({
  items, unread: items.filter((i) => i.readAt === null).length, total: items.length, page: 1, pageSize: 20, ...over,
});

/** The answer to a read or an unread (T4 AC-2). */
const state = (notificationId: string, readAt: string | null, unread: number) => ({ body: { notificationId, readAt, unread } });

/** jsdom cannot navigate; next/link's href is where a row goes, and the click is what is under test. */
const swallow = (event: Event) => event.preventDefault();

describe('the notifications inbox (P3.5-T10, P12.1)', () => {
  beforeEach(() => {
    // 10:00 on 3 October in Jakarta, so a row's short date is the same on any day the suite runs.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T03:00:00Z') });
    document.addEventListener('click', swallow);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.removeEventListener('click', swallow);
  });

  it('AC-1: shows what happened, in the words the server composed', async () => {
    // ADR-0010 makes this the authoritative channel, so the copy is product copy and
    // arrives ready to read — this screen never improvises it from a template id.
    stubFetch({ '/notifications': { body: pageOf([item()]) } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(await screen.findByText('You are in')).toBeInTheDocument();
    expect(screen.getByText('Your request was approved. You now have a leader.')).toBeInTheDocument();
    // P12.1-T3 AC-6: a short date — the day and month, on the office's calendar.
    expect(screen.getByText('1 Sep')).toHaveAttribute('dateTime', '2026-09-01T00:00:00.000Z');
  });

  it('P12.1-T3 AC-6: a compact row, named by its title with Unread: in front while it is, and described by its detail and date', async () => {
    stubFetch({ '/notifications': { body: pageOf([item(), item({ notificationId: 'n-0', title: 'Older', readAt: '2026-09-02T00:00:00.000Z' })]) } });
    renderWithSession(<NotificationsPage />, { me: READER });

    const unread = await screen.findByRole('button', { name: 'Unread: You are in' });
    expect(unread).toHaveAccessibleDescription('Your request was approved. You now have a leader. 1 Sep');
    // The dot is drawn; its words are the name's.
    expect(screen.getByText('Unread:')).toHaveClass('sr-only');
    // One line each from 768px, cut with an ellipsis; P18.95-T7 AC-4 (UI-030): on a phone neither is cut, both wrap.
    for (const line of [within(unread).getByText('You are in'), within(unread).getByText('Your request was approved. You now have a leader.')]) {
      expect(line).toHaveClass('md:truncate', 'break-words');
      expect(line).not.toHaveClass('truncate');
    }
    // A read row stays legible: named by its title alone.
    expect(screen.getByRole('button', { name: 'Older' })).toBeInTheDocument();
  });

  it('P12.1-T3 AC-2, AC-4: a row with nowhere to go reads itself and opens its modal; Close puts focus back on the row', async () => {
    const { calls } = stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      '/notifications': { body: pageOf([item({ createdAt: '2026-10-03T01:05:00.000Z' })]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Unread: You are in' }));

    const modal = screen.getByRole('dialog', { name: 'You are in' });
    expect(within(modal).getByText('Your request was approved. You now have a leader.')).toBeInTheDocument();
    // Its date and time in full, in the office's timezone: 01:05 UTC is 8:05 in Jakarta.
    expect(within(modal).getByText('3 Okt 2026, 08.05')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url))
      .toEqual(['http://api.test/api/v1/notifications/n-1/read']);

    await userEvent.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Read now, and the focus is back where it was.
    expect(screen.getByRole('button', { name: 'You are in' })).toHaveFocus();
  });

  it('P12.1-T3 AC-4: Escape and the backdrop close the modal too', async () => {
    stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Unread: You are in' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'You are in' }));
    const backdrop = screen.getByRole('dialog').parentElement!;
    await userEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P12.1-T3 AC-1, AC-3: a row with an address is a link to it across the whole row, and reads itself as it is followed', async () => {
    const { calls } = stubFetch({
      'POST /notifications/n-2/read': state('n-2', '2026-10-03T03:00:00.000Z', 1),
      '/notifications': { body: pageOf([COACHING, item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    const link = await screen.findByRole('link', { name: 'Unread: Your coaching session was finalized' });
    expect(link).toHaveAttribute('href', '/coaching/me?session=s-0924');
    // The row, not the title: the detail and the date are inside the link too.
    expect(within(link).getByText('Wilson Tanoto finalized your session.')).toBeInTheDocument();
    // Every other item is a button that opens its modal, not a link.
    expect(screen.queryByRole('link', { name: /You are in/ })).not.toBeInTheDocument();

    await userEvent.click(within(link).getByText('Wilson Tanoto finalized your session.'));
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url))
      .toEqual(['http://api.test/api/v1/notifications/n-2/read']);
    expect(await screen.findByRole('link', { name: 'Your coaching session was finalized' })).toBeInTheDocument();
    // A link opens no modal.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P12.1-T3 AC-2: a mark that fails leaves the row unread, says why, and still opens it', async () => {
    stubFetch({
      'POST /notifications/n-1/read': {
        status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-1' } },
      },
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Unread: You are in' }));
    expect(screen.getByRole('dialog', { name: 'You are in' })).toBeInTheDocument();
    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
  });

  it('P12.1-T3 AC-5: the toggle reads and unreads a row, and never opens it', async () => {
    const { calls } = stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      'POST /notifications/n-1/unread': state('n-1', null, 1),
      'POST /notifications/n-2/read': state('n-2', '2026-10-03T03:00:00.000Z', 1),
      '/notifications': { body: pageOf([COACHING, item()]) },
    });
    const followed = vi.fn();
    const watch = (e: Event) => { if ((e.target as Element).closest('a')) followed(); };
    document.addEventListener('click', watch);
    onTestFinished(() => document.removeEventListener('click', watch));
    renderWithSession(<NotificationsPage />, { me: READER });

    await screen.findByRole('button', { name: 'Unread: You are in' });
    const [, toggle] = screen.getAllByRole('button', { name: 'Mark as read' });
    expect(toggle).toHaveAttribute('title', 'Mark as read');
    await userEvent.click(toggle);

    expect(await screen.findByRole('button', { name: 'You are in' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const back = screen.getByRole('button', { name: 'Mark as unread' });
    expect(back).toHaveAttribute('title', 'Mark as unread');
    await userEvent.click(back);
    expect(await screen.findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    // On a row with an address: the toggle is beside the link, never inside it, and follows nothing.
    const link = screen.getByRole('link', { name: /Your coaching session was finalized/ });
    const linkToggle = screen.getAllByRole('button', { name: 'Mark as read' })[0];
    expect(link.contains(linkToggle)).toBe(false);
    expect(link.parentElement).toBe(linkToggle.parentElement);
    await userEvent.click(linkToggle);
    expect(followed).not.toHaveBeenCalled();

    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url.split('/v1')[1])).toEqual([
      '/notifications/n-1/read', '/notifications/n-1/unread', '/notifications/n-2/read',
    ]);
  });

  it('the Phase 12.1 exit review’s N2: a read-only support session gets no toggle and no Mark all read, and a row it opens sends no mark', async () => {
    const { calls } = stubFetch({ '/notifications': { body: pageOf([COACHING, item()]) } });
    const followed = vi.fn();
    const watch = (e: Event) => { if ((e.target as Element).closest('a')) followed(); };
    document.addEventListener('click', watch);
    onTestFinished(() => document.removeEventListener('click', watch));
    renderWithSession(<NotificationsPage />, { me: SUPPORT });

    const row = await screen.findByRole('button', { name: 'Unread: You are in' });
    expect(screen.queryByRole('button', { name: /^Mark (as|all) / })).toBeNull();

    // A row with nowhere to go still opens its modal, and is still unread behind it.
    await userEvent.click(row);
    const modal = screen.getByRole('dialog', { name: 'You are in' });
    await userEvent.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Unread: You are in' })).toHaveFocus();

    // A row with an address is still the link to its page, followed across the whole row.
    const link = screen.getByRole('link', { name: 'Unread: Your coaching session was finalized' });
    expect(link).toHaveAttribute('href', '/coaching/me?session=s-0924');
    await userEvent.click(within(link).getByText('Wilson Tanoto finalized your session.'));
    expect(followed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Nothing sent for the server to refuse, so nothing to put back or explain.
    expect(calls.filter((c) => (c.init.method ?? 'GET') !== 'GET')).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: 'Unread: Your coaching session was finalized' })).toBeInTheDocument();
  });

  it('P12.1-T3 AC-7: the keyboard reaches the row and its toggle one after the other, and Enter opens the row', async () => {
    stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    const row = await screen.findByRole('button', { name: 'Unread: You are in' });
    row.focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Mark as read' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(row).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'You are in' })).toBeInTheDocument();
  });

  it('P12.1-T2 AC-6: tells the shell’s badge the count the answer gave (the product owner’s walk, 2026-10-03)', async () => {
    stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 4),
      '/notifications': { body: pageOf([item()], { unread: 5 }) },
    });
    const heard: InboxChange[] = [];
    const listen = (e: Event) => heard.push((e as CustomEvent<InboxChange>).detail);
    window.addEventListener(INBOX_CHANGED, listen);
    try {
      renderWithSession(<NotificationsPage />, { me: READER });
      await userEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
      // The badge's move as it is clicked (P18.95-T1 AC-7), then the answer's count.
      await vi.waitFor(() => expect(heard).toHaveLength(2));
      expect(heard[0]).toMatchObject({ delta: -1, local: true });
      expect(heard[1].unread).toBe(4);
    } finally {
      window.removeEventListener(INBOX_CHANGED, listen);
    }
  });

  it('AC-2: offers Mark all read only when something is unread, and reads the page again after it', async () => {
    const { calls } = stubFetch({
      'POST /notifications/read-all': { body: { unread: 0 } },
      '/notifications?page=1&pageSize=20': [
        { body: pageOf([item(), COACHING]) },
        { body: pageOf([item({ readAt: '2026-10-03T03:00:00.000Z' }), { ...COACHING, readAt: '2026-10-03T03:00:00.000Z' }]) },
      ],
      '/notifications': { body: pageOf([item(), COACHING]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    // Every row read at once, and the button gone with the last unread one.
    expect(await screen.findByRole('button', { name: 'You are in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your coaching session was finalized' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
    // P12.1-T4 AC-4: the page is read again for the server's own times.
    await vi.waitFor(() => expect(calls.filter((c) => c.url.includes('pageSize=20'))).toHaveLength(2));
  });

  it('AC-2: a Mark all read that fails says so, and shows the rows as they really are', async () => {
    stubFetch({
      'POST /notifications/read-all': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-2' } } },
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
  });

  it('says what the inbox is for when it is empty, not just that it is empty', async () => {
    stubFetch({ '/notifications': { body: pageOf([]) } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(
      await screen.findByText('Nothing yet. This is where you will hear about your unit.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Notification pages' })).toBeNull();
  });

  it('says why when the inbox cannot be read, and offers to try again', async () => {
    stubFetch({
      '/notifications?page=1&pageSize=20': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-3' } } },
        { body: pageOf([item()]) },
      ],
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
    // An inbox that could not be read is not an empty one.
    expect(screen.queryByText('Nothing yet. This is where you will hear about your unit.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
    expect(screen.queryByText('Something broke.')).toBeNull();
  });

  describe('pages (P12.1-T4 AC-4)', () => {
    /** Forty-five notifications, twenty a page, answered by the page asked for. */
    const paged = ({ url }: { url: string }) => {
      const page = Number(new URL(url).searchParams.get('page'));
      const count = page < 3 ? 20 : 5;
      const items = Array.from({ length: count }, (_, i) => item({
        notificationId: `n-${page}-${i}`, title: `Notice ${(page - 1) * 20 + i + 1}`, readAt: '2026-09-02T00:00:00.000Z',
      }));
      return { body: { items, unread: 0, total: 45, page, pageSize: 20 } };
    };

    it('twenty rows, then Previous, Page {n} of {m} and Next; Previous off on the first page and Next on the last', async () => {
      const { calls } = stubFetch({ '/notifications': paged });
      renderWithSession(<NotificationsPage />, { me: READER });

      expect(await screen.findByRole('button', { name: 'Notice 1' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Notice / })).toHaveLength(20);
      const pager = screen.getByRole('navigation', { name: 'Notification pages' });
      const [previous, next] = within(pager).getAllByRole('button');
      expect(previous).toHaveTextContent('Previous');
      expect(next).toHaveTextContent('Next');
      expect(within(pager).getByText('Page 1 of 3')).toBeInTheDocument();
      expect(previous).toBeDisabled();

      await userEvent.click(next);
      expect(await screen.findByRole('button', { name: 'Notice 21' })).toBeInTheDocument();
      expect(within(pager).getByText('Page 2 of 3')).toBeInTheDocument();
      expect(previous).toBeEnabled();

      await userEvent.click(next);
      expect(await screen.findByRole('button', { name: 'Notice 45' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Notice / })).toHaveLength(5);
      expect(next).toBeDisabled();

      await userEvent.click(previous);
      expect(await screen.findByRole('button', { name: 'Notice 21' })).toBeInTheDocument();
      expect(calls.map((c) => c.url).filter((u) => u.includes('pageSize=20')).map((u) => new URL(u).search)).toEqual([
        '?page=1&pageSize=20', '?page=2&pageSize=20', '?page=3&pageSize=20', '?page=2&pageSize=20',
      ]);
    });

    it('no pager when one page holds everything', async () => {
      stubFetch({ '/notifications': { body: pageOf([item()]) } });
      renderWithSession(<NotificationsPage />, { me: READER });
      await screen.findByRole('button', { name: 'Unread: You are in' });
      expect(screen.queryByRole('navigation', { name: 'Notification pages' })).toBeNull();
    });

    it('drops a slow answer that arrives after a later read was asked for', async () => {
      let release: (() => void) | undefined;
      const slow = new Promise<void>((resolve) => { release = resolve; });
      let asked = 0;
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        // The first read of page 2 hangs, and would answer something stale when it came.
        if (page === 2 && ++asked === 1) {
          await slow;
          const stale = { ...paged({ url }).body, items: [item({ notificationId: 'stale', title: 'Stale notice' })] };
          return { ok: true, status: 200, json: async () => stale } as Response;
        }
        return { ok: true, status: 200, json: async () => paged({ url }).body } as Response;
      }));
      renderWithSession(<NotificationsPage />, { me: READER });

      await screen.findByRole('button', { name: 'Notice 1' });
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      // Still on page 1 while page 2 hangs; Next again asks for page 2 afresh, and that one answers.
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(await screen.findByRole('button', { name: 'Notice 21' })).toBeInTheDocument();
      await act(async () => { release?.(); await slow; });
      expect(screen.getByRole('button', { name: 'Notice 21' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Stale notice/ })).toBeNull();
    });
  });

  it('reads its page again when the inbox changes elsewhere — the bell’s popover above it — and not on its own changes', async () => {
    const { calls } = stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      '/notifications': { body: pageOf([item()]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
    await screen.findByRole('button', { name: 'You are in' });
    const reads = () => calls.filter((c) => c.url.includes('pageSize=20')).length;
    expect(reads()).toBe(1);

    act(() => announceInboxChanged({ unread: 3, origin: 'somewhere-else' }));
    await vi.waitFor(() => expect(reads()).toBe(2));
  });

  it('P11-T8’s walk: asks for the inbox only once the session has settled with somebody in it', async () => {
    const { calls } = stubFetch({ '/notifications': { body: pageOf([item()]) } });
    const { rerender } = renderWithSession(<NotificationsPage />, { me: null, loading: true });
    expect(calls).toEqual([]);

    rerender(
      <SessionContext.Provider value={makeSession({ me: READER, loading: false })}>
        <NotificationsPage />
      </SessionContext.Provider>,
    );
    expect(await screen.findByText('You are in')).toBeInTheDocument();
    // The page's read and the sidebar badge's, both once there is somebody to read for.
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls.map((c) => c.url.split('?')[0]))).toEqual(new Set(['http://api.test/api/v1/notifications']));
    expect(calls.map((c) => c.url)).toContain('http://api.test/api/v1/notifications?page=1&pageSize=20');
  });

  it('P18.95-T7 AC-1 keeps the page’s sub-line from 768px and draws it nowhere on a phone (grey text row 25)', async () => {
    stubFetch({ '/notifications': { body: pageOf([item()]) } });
    renderWithSession(<NotificationsPage />, { me: READER });
    await screen.findByText('You are in');
    const sub = screen.getByText('What has happened that you should know about.');
    expect(sub.className.split(/\s+/).filter((c) => /hidden/.test(c))).toEqual(['max-md:hidden']);
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
  });

  /*
   * **Repeats of one notice in a row, as one line** (P18.95-T7 AC-4; the client's UI review, UI-030 — *Wilson updated
   * your goal · 7×*): one template, the same words and the same address, next to each other on the page.
   */
  describe('P18.95-T7 AC-4 repeats', () => {
    const KICKOFF = (n: number, readAt: string | null = null) => item({
      notificationId: `n-k${n}`, templateId: 'event.reminder', title: 'Kickoff 2026 is coming up',
      detail: '9 Nov 2026, 09.00 · Kantor KPM', createdAt: `2026-10-0${3 - Math.min(n, 2)}T0${n}:00:00.000Z`, readAt,
    });

    it('P18.95-T7 AC-4 draws three in a row as one line with its count, and one apart from them on its own', async () => {
      stubFetch({ '/notifications': { body: pageOf([KICKOFF(1), KICKOFF(2), KICKOFF(3), item(), KICKOFF(4)]) } });
      renderWithSession(<NotificationsPage />, { me: READER });

      const line = await screen.findByRole('button', { name: 'Unread: Kickoff 2026 is coming up, 3 notices' });
      expect(line).toHaveTextContent('Kickoff 2026 is coming up · 3×');
      expect(line).toHaveAccessibleDescription(/^9 Nov 2026, 09\.00 · Kantor KPM /);
      expect(line).toHaveAttribute('aria-expanded', 'false');
      // The item between them breaks the run: the fourth stands on its own, a row like any other.
      expect(screen.getByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Unread: Kickoff 2026 is coming up$/ })).toHaveLength(1);
    });

    it('P18.95-T7 AC-4 opens to the notices themselves, reading none of them, each opening and marking on its own', async () => {
      const { calls } = stubFetch({
        'POST /notifications/n-k2/read': state('n-k2', '2026-10-03T03:00:00.000Z', 2),
        '/notifications': { body: pageOf([KICKOFF(1), KICKOFF(2), KICKOFF(3)]) },
      });
      renderWithSession(<NotificationsPage />, { me: READER });

      const line = await screen.findByRole('button', { name: /Kickoff 2026 is coming up, 3 notices/ });
      const list = document.getElementById(line.getAttribute('aria-controls')!)!;
      expect(list).not.toBeVisible();
      await userEvent.click(line);
      expect(line).toHaveAttribute('aria-expanded', 'true');
      expect(list).toBeVisible();
      expect(within(list).getAllByRole('button', { name: 'Unread: Kickoff 2026 is coming up' })).toHaveLength(3);
      // Opening the line marked nothing.
      expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);

      // One of them, by its own toggle: that one alone.
      await userEvent.click(within(list).getAllByRole('button', { name: 'Mark as read' })[1]);
      await vi.waitFor(() => expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url.split('/v1')[1]))
        .toEqual(['/notifications/n-k2/read']));
      expect(within(list).getAllByRole('button', { name: /^Unread: / })).toHaveLength(2);
      // Still unread as a whole while any of it is.
      expect(line).toHaveAccessibleName('Unread: Kickoff 2026 is coming up, 3 notices');
    });

    it('P18.95-T7 AC-4 its toggle reads all of them at once, the bell moving by three, then settling on the last answer', async () => {
      const { calls } = stubFetch({
        'POST /notifications/n-k1/read': state('n-k1', '2026-10-03T03:00:00.000Z', 4),
        'POST /notifications/n-k2/read': state('n-k2', '2026-10-03T03:00:00.000Z', 3),
        'POST /notifications/n-k3/read': state('n-k3', '2026-10-03T03:00:00.000Z', 2),
        '/notifications': { body: pageOf([KICKOFF(1), KICKOFF(2), KICKOFF(3)], { unread: 5 }) },
      });
      const heard: InboxChange[] = [];
      const listen = (e: Event) => heard.push((e as CustomEvent<InboxChange>).detail);
      window.addEventListener(INBOX_CHANGED, listen);
      try {
        renderWithSession(<NotificationsPage />, { me: READER });
        await userEvent.click(await screen.findByRole('button', { name: 'Mark all 3 as read' }));

        // All three at once, before any answer.
        expect(screen.getByRole('button', { name: 'Kickoff 2026 is coming up, 3 notices' })).toBeInTheDocument();
        await vi.waitFor(() => expect(heard).toHaveLength(2));
        expect(heard[0]).toMatchObject({ delta: -3, local: true });
        expect(heard[1].unread).toBe(2);
        expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url.split('/v1')[1])).toEqual([
          '/notifications/n-k1/read', '/notifications/n-k2/read', '/notifications/n-k3/read',
        ]);
        // Read, its toggle says the way back: all three unread again.
        expect(screen.getByRole('button', { name: 'Mark all 3 as unread' })).toBeInTheDocument();
      } finally {
        window.removeEventListener(INBOX_CHANGED, listen);
      }
    });

    it('P18.95-T7 AC-4 unreads all of them, and puts back the one the server refused, saying why', async () => {
      const read = '2026-10-02T00:00:00.000Z';
      const { calls } = stubFetch({
        'POST /notifications/n-k1/unread': state('n-k1', null, 1),
        'POST /notifications/n-k2/unread': {
          status: 404, body: { error: { code: 'NOT_FOUND', message: 'That notification is not there.', requestId: 'r-1' } },
        },
        'POST /notifications/n-k3/unread': state('n-k3', null, 2),
        '/notifications': { body: pageOf([KICKOFF(1, read), KICKOFF(2, read), KICKOFF(3, read)]) },
      });
      renderWithSession(<NotificationsPage />, { me: READER });

      await userEvent.click(await screen.findByRole('button', { name: 'Mark all 3 as unread' }));
      await vi.waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(3));
      expect(await screen.findByRole('alert')).toHaveTextContent('That notification is not there.');
      const line = screen.getByRole('button', { name: 'Unread: Kickoff 2026 is coming up, 3 notices' });
      await userEvent.click(line);
      const list = document.getElementById(line.getAttribute('aria-controls')!)!;
      expect(within(list).getAllByRole('button', { name: /^Unread: / })).toHaveLength(2);
      expect(within(list).getAllByRole('button', { name: 'Kickoff 2026 is coming up' })).toHaveLength(1);
    });

    it('P18.95-T7 AC-4 a read-only support session opens the line and its notices, and is offered no mark', async () => {
      stubFetch({ '/notifications': { body: pageOf([KICKOFF(1), KICKOFF(2)]) } });
      renderWithSession(<NotificationsPage />, { me: SUPPORT });
      await userEvent.click(await screen.findByRole('button', { name: /Kickoff 2026 is coming up, 2 notices/ }));
      expect(screen.queryByRole('button', { name: /Mark all/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument();
    });
  });

  it('renders a row with no detail without leaving an empty line, in the row or in its modal', async () => {
    stubFetch({
      'POST /notifications/n-1/read': state('n-1', '2026-10-03T03:00:00.000Z', 0),
      '/notifications': { body: pageOf([item({ detail: null })]) },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    const row = await screen.findByRole('button', { name: 'Unread: You are in' });
    expect(screen.queryByText('Your request was approved. You now have a leader.')).toBeNull();
    // Described by its date alone.
    expect(row).toHaveAccessibleDescription('1 Sep');
    await userEvent.click(row);
    // The date and time, and nothing above them.
    expect(screen.getByRole('dialog').querySelectorAll('p')).toHaveLength(1);
  });
});
