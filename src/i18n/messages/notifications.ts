import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The inbox's own words** — `/notifications` and the rows it shares with the bell's popover
 * (`components/notification-list.tsx`; P12.1-T3, T4; P18.95-T7 AC-4; P18.98-T4, the shared pieces): the page's line,
 * *Mark all read*, its wait, its empty state, the pager's name, a row's toggle and its *Unread:*, a repeated notice's
 * name and toggle, and a notice's *Close*.
 *
 * **What a notice says is not here**: the API composes each row's title and detail for the reader, in their language,
 * when the inbox is read (P18.98-T5 AC-4), and the screen shows them as they come. **English is the source**, byte for
 * byte; the Indonesian is the approved glossary's (§B.1 *Tandai sudah dibaca · Tandai semua sudah dibaca*, *Tutup*,
 * *Coba lagi*; §B.10 *{n} belum dibaca*), with what it lacked in the glossary for approval's §B.10 (*kotak masuk*).
 * **Kept** (§A): the title *Notifications*, *unit*. A notice's date is written by the caller in the figures' language.
 *
 * @moved components/notification-list.tsx
 * @moved app/notifications/
 * @moved lib/notifications.ts
 */
const en = {
  title: kept('Notifications'),
  subtitle: 'What has happened that you should know about.',
  markAllRead: 'Mark all read',
  tryAgain: 'Try again',
  loading: 'Loading your inbox…',
  /** Said when there is nothing to show, in the bell's popover and on the page alike. */
  empty: 'Nothing yet. This is where you will hear about your unit.',
  /** The pager's landmark. */
  pages: 'Notification pages',
  /** A row's toggle, its name and its tooltip. */
  markRead: 'Mark as read',
  markUnread: 'Mark as unread',
  /** Before an unread row's title, for a screen reader: the dot's text alternative. */
  unread: 'Unread:',
  close: 'Close',
  /** A notice repeated `n` times in a row, as one line: its name, and its toggle for all of them. */
  repeated: ({ title, n, unread }: { title: string; n: number; unread: boolean }) =>
    `${unread ? 'Unread: ' : ''}${title}, ${n} notices`,
  markAllOf: ({ n, read }: { n: number; read: boolean }) => (read ? `Mark all ${n} as read` : `Mark all ${n} as unread`),
};

const id: MessagesOf<typeof en> = {
  title: kept('Notifications'),
  subtitle: 'Hal-hal yang sudah terjadi dan perlu Anda ketahui.',
  markAllRead: 'Tandai semua sudah dibaca',
  tryAgain: 'Coba lagi',
  loading: 'Memuat kotak masuk Anda…',
  empty: `Belum ada apa pun. Di sinilah Anda akan mendapat kabar tentang ${kept('unit')} Anda.`,
  pages: 'Halaman notifikasi',
  markRead: 'Tandai sudah dibaca',
  markUnread: 'Tandai belum dibaca',
  unread: 'Belum dibaca:',
  close: 'Tutup',
  repeated: ({ title, n, unread }) => `${unread ? 'Belum dibaca: ' : ''}${title}, ${n} notifikasi`,
  markAllOf: ({ n, read }) => (read ? `Tandai ${n} notifikasi ini sudah dibaca` : `Tandai ${n} notifikasi ini belum dibaca`),
};

export const notificationMessages = defineMessages({ en, id });
