'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';
import { formatNoticeFull, formatNoticeShort } from '@/lib/format';
import type { InboxItem } from '@/lib/notifications';

/** Said when there is nothing to show, in the bell's popover and on `/notifications` alike. */
export const INBOX_EMPTY = 'Nothing yet. This is where you will hear about your unit.';

/**
 * The toggle's two glyphs, drawn as the sidebar's are (24×24, a 1.7 stroke, `currentColor`): an
 * envelope opened, to read an unread row, and one closed, to make a read row unread again.
 */
function ToggleGlyph({ unread }: { unread: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {unread ? (
        <>
          <path d="M3 10.5 12 4l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="m3 10.5 9 6 9-6" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </>
      )}
    </svg>
  );
}

/**
 * One notification, compact, so many fit (P12.1-T3 AC-6): its title on one line with the short date
 * beside it, its detail on one line under it, each cut with an ellipsis, and a dot for unread.
 *
 * **The whole row is one control** (AC-1): a link for a row with an address, which is what it is, and a
 * button for one without, which opens its modal. It spans the row, so the click target is the row and
 * not its title.
 *
 * **The toggle is the row's sibling, never its child** (AC-5). Interactive content inside a link or a
 * button is invalid, and its click would reach the row: so the row is a flex line of two controls side
 * by side, and the toggle's click goes no further than itself. Tab reaches them one after the other.
 *
 * **Named by its title**, with *Unread:* in front while it is — the dot's text alternative — and
 * described by its detail and date, so a screen reader moving down the list hears the titles, not three
 * lines of each.
 *
 * Read rows are not greyed out: a notification from last week is still the record of what happened.
 * Unread is the dot and the weight of the title, and never the colour alone.
 *
 * **No `onToggle`, no toggle**: a reader who may not mark (`useCanMark`, the read-only support session
 * of the Phase 12.1 exit review's N2) gets the row alone.
 */
export function NotificationRow({
  item,
  onActivate,
  onToggle,
}: {
  item: InboxItem;
  onActivate: (item: InboxItem) => void;
  onToggle?: (item: InboxItem) => void;
}) {
  const unread = item.readAt === null;
  const stateId = useId();
  const titleId = useId();
  const detailId = useId();
  const whenId = useId();
  const named = {
    'aria-labelledby': unread ? `${stateId} ${titleId}` : titleId,
    'aria-describedby': item.detail ? `${detailId} ${whenId}` : whenId,
  };
  const control = 'flex min-w-0 flex-1 items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-navy/[0.04]';
  const toggle = unread ? 'Mark as read' : 'Mark as unread';

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-pill', unread ? 'bg-amber-deep' : 'bg-transparent')}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          {unread && <span id={stateId} className="sr-only">Unread:</span>}
          <span
            id={titleId}
            className={cn('min-w-0 flex-1 truncate text-md text-navy', unread ? 'font-semibold' : 'font-normal')}
          >
            {item.title}
          </span>
          <time id={whenId} dateTime={item.createdAt} className="shrink-0 text-xs text-muted">
            {formatNoticeShort(item.createdAt)}
          </time>
        </span>
        {item.detail && (
          <span id={detailId} className="block truncate text-sm text-muted">{item.detail}</span>
        )}
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-1 py-0.5" data-unread={unread || undefined}>
      {item.href ? (
        <Link href={item.href} className={control} onClick={() => onActivate(item)} {...named}>
          {body}
        </Link>
      ) : (
        <button type="button" aria-haspopup="dialog" className={control} onClick={() => onActivate(item)} {...named}>
          {body}
        </button>
      )}
      {onToggle && (
        <Button
          variant="icon"
          title={toggle}
          className="mr-1"
          onClick={(event) => {
            // A sibling already, so nothing of the row's is above it; stopped anyway, so no container
            // that someday listens for a click on the row can take this one for it.
            event.stopPropagation();
            onToggle(item);
          }}
        >
          <ToggleGlyph unread={unread} />
          <span className="sr-only">{toggle}</span>
        </Button>
      )}
    </li>
  );
}

/**
 * A notification with nowhere to go, opened (P12.1-T3 AC-4): its title as the heading, its detail, and
 * its date and time in full in the office's timezone. `Modal`, so Escape, the backdrop and *Close* shut
 * it, and focus goes back to the row that opened it.
 */
export function NotificationModal({ item, onClose }: { item: InboxItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal open title={item.title} onClose={onClose} focusDialog>
      {item.detail && <p className="text-md text-navy">{item.detail}</p>}
      <p className={cn('text-sm text-muted', item.detail && 'mt-3')}>
        <time dateTime={item.createdAt}>{formatNoticeFull(item.createdAt)}</time>
      </p>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

/**
 * The rows, and what selecting one does — the same in the popover and on the page, because it is this.
 *
 * Selecting a row **marks it read** (T3 AC-2), without waiting: a link is followed at once and a modal
 * opens at once, and a mark that fails leaves the row unread behind them. A row with an address is
 * followed (`onFollow` closes the popover); one without opens its modal.
 *
 * **Without `setRead` the list marks nothing** (roles-and-permissions §7.2, the read-only support
 * session; the Phase 12.1 exit review, N2): no toggle, and a row opens — its page or its modal, as
 * ever — and stays unread, with no mark sent for the server to refuse.
 */
export function NotificationList({
  items,
  setRead,
  onFollow,
}: {
  items: readonly InboxItem[];
  /** Absent for a reader who may not mark (`useCanMark`). */
  setRead?: (item: InboxItem, read: boolean) => Promise<boolean>;
  /** A row with an address was followed. */
  onFollow?: () => void;
}) {
  const [shown, setShown] = useState<InboxItem | null>(null);

  const activate = (item: InboxItem) => {
    if (setRead && item.readAt === null) void setRead(item, true);
    if (item.href) onFollow?.();
    else setShown(item);
  };

  return (
    <>
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => (
          <NotificationRow
            key={item.notificationId}
            item={item}
            onActivate={activate}
            onToggle={setRead && ((row) => void setRead(row, row.readAt === null))}
          />
        ))}
      </ul>
      <NotificationModal item={shown} onClose={() => setShown(null)} />
    </>
  );
}
