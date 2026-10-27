'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { INBOX_EMPTY, NotificationList } from '@/components/notification-list';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { TAP_TARGET } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { POPOVER_PAGE_SIZE } from '@/lib/notifications';
import { useCanMark, useInbox } from '@/lib/use-inbox';

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
 * **Not on a phone's bar since 2026-10-27** (P18.95-T12, the product owner's request): below 768px the bar holds
 * the avatar alone, which wears this bell's `UnreadBadge` and whose menu holds *Notifications* (`SidebarUserMenu`).
 * The bell and its popover are the sidebar's, from 768px, exactly as before; the placement under the bar stays in
 * its classes for a shell with no account to hold the notices, which has no avatar menu.
 */
export function NotificationBell({ href, unread }: { href: string; unread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = useId();
  const canMark = useCanMark();
  const list = useInbox(POPOVER_PAGE_SIZE, { listen: open });
  const { inbox, error, load } = list;

  // Read each time it opens (T2 AC-2), and take the focus in with it (AC-4).
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    void load(1);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    // Capture, so a click that also does something else still closes the popover first.
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [open]);

  /** Tab past its last control closes it, rather than leaving it open over a page the focus is on. */
  function onBlur(event: React.FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && !wrapper.current?.contains(next)) setOpen(false);
  }

  /** The button goes once nothing is unread; the focus stays in the popover rather than on nothing. */
  function markAllRead() {
    panel.current?.focus();
    void list.readAll();
  }

  const active = open || pathname === href;

  return (
    <div ref={wrapper} className="shrink-0" onBlur={onBlur}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={withUnread('Notifications', unread)}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          // 44 × 44 on a phone (P18.95-T1 AC-10); 36 × 36 from 768 px, as before.
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md', TAP_TARGET,
          active ? 'bg-amber/15 text-white' : 'text-white/[0.78] hover:bg-white/[0.06]',
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

      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-labelledby={headingId}
          tabIndex={-1}
          className={cn(
            'absolute inset-x-0 top-full z-20 flex max-h-[calc(100dvh-4.5rem)] flex-col border-y border-hairline bg-card text-navy shadow-modal',
            'md:inset-x-auto md:bottom-3 md:left-full md:top-auto md:ml-2 md:max-h-[calc(100vh-1.5rem)] md:w-[22rem] md:rounded-lg md:border',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <h2 id={headingId} className="font-display text-lg font-bold text-navy">Notifications</h2>
            {canMark && inbox && inbox.unread > 0 && (
              <Button variant="inline" onClick={markAllRead}>Mark all read</Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-busy={list.loading || undefined}>
            {error && (
              <div className="p-1.5">
                <ErrorBanner {...error} />
                {inbox === null && (
                  <Button variant="secondary" className="mt-2" onClick={() => void load(1)}>Try again</Button>
                )}
              </div>
            )}
            {inbox === null && !error && (
              <Skeleton label="Loading your notifications…">
                <div className="space-y-3 p-2.5">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i}>
                      <SkeletonBar className="h-3.5 w-3/5" />
                      <SkeletonBar className="mt-1.5 w-4/5" />
                    </div>
                  ))}
                </div>
              </Skeleton>
            )}
            {inbox && inbox.items.length === 0 && <EmptyState title={INBOX_EMPTY} className="py-8" />}
            {inbox && inbox.items.length > 0 && (
              <NotificationList
                items={inbox.items}
                setRead={canMark ? list.setRead : undefined}
                onFollow={() => setOpen(false)}
              />
            )}
          </div>

          <div className="border-t border-hairline p-2">
            <ButtonLink href={href} variant="secondary" className="w-full" onClick={() => setOpen(false)}>
              See all notifications
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * **What the badge says**: the count, and `9+` past nine (L-13) — past that the number stops being one somebody acts
 * on, and a wider badge would move what is beside it. The accessible name carries the exact count (`withUnread`).
 */
export function unreadBadgeText(unread: number): string {
  return unread > 9 ? '9+' : String(unread);
}

/** A control's name with the count in it, *Notifications, 3 unread*; the name alone at none. */
export function withUnread(name: string, unread: number): string {
  return unread > 0 ? `${name}, ${unread} unread` : name;
}

/**
 * **The red count on the bell's corner** — and, on a phone's bar, on the avatar's (P18.95-T12 AC-2), so the two are
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
