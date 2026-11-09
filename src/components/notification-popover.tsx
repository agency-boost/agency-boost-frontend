'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { inModal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { notificationMessages } from '@/i18n/messages/notifications';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import { POPOVER_PAGE_SIZE } from '@/lib/notifications';
import { useCanMark, useInbox } from '@/lib/use-inbox';

/**
 * **The popover's rows, downloaded when it first has some to draw** (P18.11-T16, the bundle): the bell is on every page
 * from 768px and the rows only after a tap and a read, so the list — its rows, its notice dialog — was in every route's
 * first load for nothing. `/notifications` draws the same list, imported as before.
 */
const NotificationList = dynamic(() => import('@/components/notification-list').then((m) => m.NotificationList), { ssr: false });

/**
 * **What the bell opens** (P12.1-T2; `notification-bell.tsx` for the whole of it): the latest eight, read afresh each
 * time it opens, *Mark all read* while anything is unread, and *See all notifications* at the foot.
 *
 * **A module of its own, loaded on the first tap** (the bundle, 2026-11-06; `performance-and-scale.md`): the bell is in
 * every page's shell and the list only after a tap, so the inbox's reads, its rows' states and the ways it closes were in
 * every route's first load for nothing. Mounted from the first opening and kept mounted, closed, as the bell's own state
 * always was — so the last list read still stands while the next one is read.
 *
 * It closes as before, and only while it is open: Escape (the focus back on the bell), a click outside the bell and the
 * popover, and the focus leaving both — a row's modal, drawn at the end of the page, counts as the popover's own.
 */
export function NotificationPopover({
  open,
  href,
  panelId,
  wrapper,
  trigger,
  onClose,
}: {
  open: boolean;
  href: string;
  /** The panel's id, as the bell names it in `aria-controls`. */
  panelId: string;
  /** The bell and the popover together: what a click or the focus may stay inside. */
  wrapper: RefObject<HTMLDivElement | null>;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const canMark = useCanMark();
  const list = useInbox(POPOVER_PAGE_SIZE, { listen: open });
  const { inbox, error, load } = list;
  const t = useMessages(shellMessages);
  const inboxWords = useMessages(notificationMessages);

  // Read each time it opens (T2 AC-2), and take the focus in with it (AC-4).
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    void load(1);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const box = wrapper.current;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onClose();
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      // A row's modal is drawn at the end of the page (`Modal`'s portal), and is the popover's own.
      if (!box?.contains(event.target as Node) && !inModal(event.target)) onClose();
    }
    /** Tab past its last control closes it, rather than leaving it open over a page the focus is on. */
    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      if (next && !box?.contains(next) && !inModal(next)) onClose();
    }
    // Capture, so a click that also does something else still closes the popover first.
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    box?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
      box?.removeEventListener('focusout', onFocusOut);
    };
  }, [open, onClose, trigger, wrapper]);

  /** The button goes once nothing is unread; the focus stays in the popover rather than on nothing. */
  function markAllRead() {
    panel.current?.focus();
    void list.readAll();
  }

  if (!open) return null;
  return (
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
        {/* The inbox's own title, kept English (§A.2). */}
        <h2 id={headingId} className="font-display text-lg font-bold text-navy">{kept('Notifications')}</h2>
        {canMark && inbox && inbox.unread > 0 && (
          <Button variant="inline" onClick={markAllRead}>{t.markAllRead}</Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-busy={list.loading || undefined}>
        {error && (
          <div className="p-1.5">
            <ErrorBanner {...error} />
            {inbox === null && (
              <Button variant="secondary" className="mt-2" onClick={() => void load(1)}>{t.tryAgain}</Button>
            )}
          </div>
        )}
        {inbox === null && !error && (
          <Skeleton label={t.loadingNotifications}>
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
        {inbox && inbox.items.length === 0 && <EmptyState title={inboxWords.empty} className="py-8" />}
        {inbox && inbox.items.length > 0 && (
          <NotificationList
            items={inbox.items}
            setRead={canMark ? list.setRead : undefined}
            onFollow={onClose}
          />
        )}
      </div>

      <div className="border-t border-hairline p-2">
        <ButtonLink href={href} variant="secondary" className="w-full" onClick={onClose}>
          {t.seeAllNotifications}
        </ButtonLink>
      </div>
    </div>
  );
}
