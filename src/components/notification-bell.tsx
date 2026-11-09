'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useId, useRef, useState } from 'react';
import { TAP_TARGET } from '@/components/ui/phone';
import { UnreadBadge, withUnread } from '@/components/unread-badge';
import { kept } from '@/i18n/kept';
import { useLanguage } from '@/i18n/language-provider';
import { cn } from '@/lib/cn';
import { useOpenedOnce } from '@/lib/use-opened-once';

/**
 * **The popover, loaded the first time the bell is tapped** (the bundle, 2026-11-06; `performance-and-scale.md`): the
 * bell is in every page's shell, its list only after a tap (`notification-popover.tsx`).
 */
const NotificationPopover = dynamic(
  () => import('@/components/notification-popover').then((m) => m.NotificationPopover), { ssr: false },
);

/**
 * The bell at the foot of the sidebar, and the short list it opens (P12.1-T2).
 *
 * **The count is in the accessible name, not only in the badge.** A red circle with a number
 * beside an unlabelled icon tells a screen reader nothing, and *"Notifications"* alone would
 * hide the one thing the control exists to communicate.
 *
 * Capped at `9+`: past that the number stops being a number somebody acts on, and a wide badge
 * would push the identity chip about as the count changed.
 *
 * **A button that opens a popover, not a link to the page** (the product owner, 2026-10-03). It opens
 * the latest eight, read afresh each time, with *Mark all read* at the top while anything is unread and
 * *See all notifications* at the foot, which is the way to `/notifications`. Clicking the bell never
 * navigates.
 *
 * **A non-modal dialog**, named by its heading. Focus moves into it as it opens. Escape closes it and
 * puts focus back on the bell; a click outside it, focus leaving it, following a row with an address and
 * following *See all notifications* close it too. A row with nowhere to go opens its modal **inside** the
 * popover's own tree, so the modal's clicks and its Escape are the popover's own and it stays open
 * behind, for focus to come back to the row.
 *
 * **Where it opens.** It is positioned against the sidebar, which is `sticky` and so its containing
 * block: from 768px beside the sidebar at its foot, by the bell, growing upward inside the viewport;
 * below 768px, where the sidebar is the bar across the top, under the bar at its full width, scrolling
 * inside itself — as the account chip's panel does there (ADR-0085). The classes decide it, so there is
 * no width to read before it can draw.
 *
 * **A read-only support session marks nothing** (roles-and-permissions §7.2; the Phase 12.1 exit
 * review, N2): no *Mark all read*, no toggle, and a row opens without reading itself (`useCanMark`).
 *
 * **Not on a phone's bar since 2026-10-27** (P18.7-T12, the product owner's request): below 768px the bar holds
 * the avatar alone, which wears this bell's `UnreadBadge` and whose menu holds *Notifications* (`SidebarUserMenu`).
 * The bell and its popover are the sidebar's, from 768px, exactly as before; the placement under the bar stays in
 * its classes for a shell with no account to hold the notices, which has no avatar menu.
 */
export function NotificationBell({ href, unread }: { href: string; unread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mounted = useOpenedOnce(open);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const language = useLanguage();
  const close = useCallback(() => setOpen(false), []);

  const active = open || pathname === href;

  return (
    <div ref={wrapper} className="shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={withUnread(kept('Notifications'), unread, language)}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          // 44 × 44 on a phone (P18.7-T1 AC-10); 36 × 36 from 768 px, as before.
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md', TAP_TARGET,
          active ? 'bg-primary/15 text-white' : 'text-white/[0.78] hover:bg-white/[0.06]',
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <UnreadBadge unread={unread} />
      </button>

      {mounted && (
        <NotificationPopover open={open} href={href} panelId={panelId} wrapper={wrapper} trigger={trigger} onClose={close} />
      )}
    </div>
  );
}
