import { api } from './api-client';

export interface InboxItem {
  notificationId: string;
  templateId: string;
  /** Composed on the server: what a notification says is product copy (ADR-0010). */
  title: string;
  detail: string | null;
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
