import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, makeSession, renderWithSession, stubFetch } from '@test/harness';
import { SessionContext } from '@/lib/session';
import NotificationsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/notifications',
}));

const READER = makeMe({
  permissions: ['notification:read_inbox', 'notification:mark_read'],
});

const item = (over: Record<string, unknown> = {}) => ({
  notificationId: 'n-1', templateId: 'join_request.approved',
  title: 'You are in', detail: 'Your request was approved. You now have a leader.', href: null,
  kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null, ...over,
});

describe('the notifications inbox (P3.5-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: shows what happened, in the words the server composed', async () => {
    // ADR-0010 makes this the authoritative channel, so the copy is product copy and
    // arrives ready to read — this screen never improvises it from a template id.
    stubFetch({ '/notifications': { body: { items: [item()], unread: 1 } } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(await screen.findByText('You are in')).toBeInTheDocument();
    expect(screen.getByText('Your request was approved. You now have a leader.')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
  });

  it('AC-2: marking one read drops it out of the unread state', async () => {
    stubFetch({
      '/notifications/n-1/read': { body: { items: [item({ readAt: '2026-09-06T00:00:00.000Z' })], unread: 0 } },
      '/notifications': { body: { items: [item()], unread: 1 } },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
    // The row stays — a read notification is still the record of what happened — but
    // its control and the bulk action are gone.
    expect(await screen.findByText('You are in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark read' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('tells the shell’s badge to count again after a read (the product owner’s walk, 2026-10-03)', async () => {
    stubFetch({
      '/notifications/n-1/read': { body: { items: [item({ readAt: '2026-09-06T00:00:00.000Z' })], unread: 0 } },
      '/notifications': { body: { items: [item()], unread: 1 } },
    });
    const heard = vi.fn();
    window.addEventListener('agencyboost:inbox-changed', heard);
    try {
      renderWithSession(<NotificationsPage />, { me: READER });
      await userEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
      await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
    } finally {
      window.removeEventListener('agencyboost:inbox-changed', heard);
    }
  });

  it('AC-2: offers Mark all read only when something is unread', async () => {
    stubFetch({ '/notifications': { body: { items: [item()], unread: 1 } } });
    renderWithSession(<NotificationsPage />, { me: READER });
    expect(await screen.findByRole('button', { name: 'Mark all read' })).toBeInTheDocument();
  });

  it('says what the inbox is for when it is empty, not just that it is empty', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(
      await screen.findByText('Nothing yet. This is where you will hear about your unit.'),
    ).toBeInTheDocument();
  });

  it('P11-T10 AC-8 opens an item that has somewhere to go: its title is a link to the address the server composed', async () => {
    stubFetch({
      '/notifications': {
        body: {
          items: [
            item({
              notificationId: 'n-2', templateId: 'coaching_session.finalized', title: 'Your coaching session was finalized',
              detail: 'Wilson Tanoto finalized your session.', href: '/coaching/me?session=s-0924',
            }),
            item(),
          ],
          unread: 2,
        },
      },
    });
    renderWithSession(<NotificationsPage />, { me: READER });

    const link = await screen.findByRole('link', { name: 'Your coaching session was finalized' });
    expect(link).toHaveAttribute('href', '/coaching/me?session=s-0924');
    // Every other item is the record it always was.
    expect(screen.getByText('You are in').tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: 'You are in' })).not.toBeInTheDocument();
  });

  it('P11-T8’s walk: asks for the inbox only once the session has settled with somebody in it', async () => {
    const { calls } = stubFetch({ '/notifications': { body: { items: [item()], unread: 1 } } });
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
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set(['http://api.test/api/v1/notifications']));
  });

  it('renders a row with no detail without leaving an empty line', async () => {
    stubFetch({ '/notifications': { body: { items: [item({ detail: null })], unread: 1 } } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(await screen.findByText('You are in')).toBeInTheDocument();
    expect(screen.queryByText('Your request was approved. You now have a leader.')).toBeNull();
  });
});
