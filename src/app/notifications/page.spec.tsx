import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../test/harness';
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
  title: 'You are in', detail: 'Your request was approved. You now have a leader.',
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

  it('renders a row with no detail without leaving an empty line', async () => {
    stubFetch({ '/notifications': { body: { items: [item({ detail: null })], unread: 1 } } });
    renderWithSession(<NotificationsPage />, { me: READER });

    expect(await screen.findByText('You are in')).toBeInTheDocument();
    expect(screen.queryByText('Your request was approved. You now have a leader.')).toBeNull();
  });
});
