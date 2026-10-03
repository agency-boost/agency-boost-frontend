import { api } from './api-client';

export interface InboxItem {
  notificationId: string;
  templateId: string;
  /** Composed on the server: what a notification says is product copy (ADR-0010). */
  title: string;
  detail: string | null;
  /**
   * Where the item opens in the app, composed on the server beside its title: a finalized coaching
   * session opens on that session (`/coaching/me?session=…`, P11-T10 AC-8), and a calendar notice on
   * its entry's week, its detail open (`/calendar?entry=…&date=…`, ADR-0095). `null` for every other item.
   */
  href: string | null;
  kpmId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Inbox {
  items: InboxItem[];
  /** Comes with the list, so the badge and the page can never disagree. */
  unread: number;
}

export const readInbox = () => api<Inbox>('/notifications');

export const markNotificationRead = (notificationId: string) =>
  api<Inbox>(`/notifications/${notificationId}/read`, { method: 'POST' });

export const markAllNotificationsRead = () =>
  api<Inbox>('/notifications/read-all', { method: 'POST' });

/**
 * **The inbox changed on this screen**: an answer read the notice that announced it, or the reader marked
 * something read. The shell's badge reads the count again when it hears this, so it never keeps counting
 * a notice that has been dealt with. A window event, so no screen has to know where the badge lives.
 */
export const INBOX_CHANGED = 'agencyboost:inbox-changed';

export function announceInboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INBOX_CHANGED));
}
