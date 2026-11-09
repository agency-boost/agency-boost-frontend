import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { shellMessages } from '@/i18n/messages/shell';

/**
 * **The unread count, as the bell and the title row's bell wear it** (P12.1-T2, P18.7-T12 AC-2; UI-004). Kept apart from
 * the bell's popover (`notification-bell.tsx`) because Home's title row draws the count too, and every page's header is
 * in its first load: a count needs none of the inbox (the bundle, 2026-11-06; `performance-and-scale.md`).
 */

/**
 * **What the badge says**: the count, and `9+` past nine (L-13) — past that the number stops being one somebody acts
 * on, and a wider badge would move what is beside it. The accessible name carries the exact count (`withUnread`).
 */
export function unreadBadgeText(unread: number): string {
  return unread > 9 ? '9+' : String(unread);
}

/**
 * A control's name with the count in it, *Notifications, 3 unread*; the name alone at none. In the reader's
 * `language` (`shellMessages`' `withUnread`): *Notifications, 3 belum dibaca* in ID mode.
 */
export function withUnread(name: string, unread: number, language: Language = SOURCE_LANGUAGE): string {
  return messagesIn(shellMessages, language).withUnread({ name, unread });
}

/**
 * **The red count on the bell's corner** — and, on a phone's bar, on the avatar's (P18.7-T12 AC-2), so the two are
 * one badge: its classes, its tokens and its `9+`. Nothing at all while nothing is unread. Placed against its
 * control's box, which is `relative`; hidden from a screen reader, which hears the count in the control's name.
 */
export function UnreadBadge({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1 text-2xs font-bold text-white"
    >
      {unreadBadgeText(unread)}
    </span>
  );
}
