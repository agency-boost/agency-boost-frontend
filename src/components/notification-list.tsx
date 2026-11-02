'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { notificationMessages } from '@/i18n/messages/notifications';
import { cn } from '@/lib/cn';
import { formatNoticeFull, formatNoticeShort, OFFICE_TIME_ZONE } from '@/lib/format';
import { groupRepeats, type InboxItem, type NoticeRun } from '@/lib/notifications';

/**
 * Said when there is nothing to show, in the bell's popover and on `/notifications` alike: the catalogue's English
 * (`notificationMessages.empty`), which both write in the reader's language (P18.98-T4).
 */
export const INBOX_EMPTY = notificationMessages.en.empty;

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
 * **On a phone neither is cut** (P18.95-T7 AC-4; the client's UI review, UI-030): below 768px the title and the
 * detail wrap onto as many lines as they take — an event's time and place among them — and from 768px each is one
 * line with its ellipsis, as before.
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
  const language = useFigureLanguage();
  const t = useMessages(notificationMessages);
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
  const toggle = unread ? t.markRead : t.markUnread;

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-pill', unread ? 'bg-amber-deep' : 'bg-transparent')}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          {unread && <span id={stateId} className="sr-only">{t.unread}</span>}
          <span
            id={titleId}
            className={cn('min-w-0 flex-1 break-words text-md text-navy md:truncate', unread ? 'font-semibold' : 'font-normal')}
          >
            {item.title}
          </span>
          <time id={whenId} dateTime={item.createdAt} className="shrink-0 text-xs text-muted">
            {formatNoticeShort(item.createdAt, undefined, OFFICE_TIME_ZONE, language)}
          </time>
        </span>
        {item.detail && (
          <span id={detailId} className="block break-words text-sm text-muted md:truncate">{item.detail}</span>
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
  const language = useFigureLanguage();
  const t = useMessages(notificationMessages);
  if (!item) return null;
  return (
    <Modal open title={item.title} onClose={onClose} focusDialog>
      {item.detail && <p className="text-md text-navy">{item.detail}</p>}
      <p className={cn('text-sm text-muted', item.detail && 'mt-3')}>
        <time dateTime={item.createdAt}>{formatNoticeFull(item.createdAt, OFFICE_TIME_ZONE, language)}</time>
      </p>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>{t.close}</Button>
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
 *
 * **Repeats in a row are one line** (P18.95-T7 AC-4, `RepeatedNotice`): the same notice said again — one template,
 * the same words, the same address — opens to its items rather than standing as seven rows of one sentence.
 */
export function NotificationList({
  items,
  setRead,
  onFollow,
}: {
  items: readonly InboxItem[];
  /** Absent for a reader who may not mark (`useCanMark`). One item, or a run of repeats at once (P18.95-T7 AC-4). */
  setRead?: (items: InboxItem | readonly InboxItem[], read: boolean) => Promise<boolean>;
  /** A row with an address was followed. */
  onFollow?: () => void;
}) {
  const [shown, setShown] = useState<InboxItem | null>(null);

  const activate = (item: InboxItem) => {
    if (setRead && item.readAt === null) void setRead(item, true);
    if (item.href) onFollow?.();
    else setShown(item);
  };
  const toggle = setRead && ((row: InboxItem) => void setRead(row, row.readAt === null));

  return (
    <>
      <ul className="flex flex-col divide-y divide-hairline">
        {groupRepeats(items).map((run) => (run.items.length === 1 ? (
          <NotificationRow key={run.key} item={run.items[0]} onActivate={activate} onToggle={toggle} />
        ) : (
          <RepeatedNotice
            key={run.key}
            run={run}
            onActivate={activate}
            onToggle={toggle}
            onToggleAll={setRead && ((all, read) => void setRead(all, read))}
          />
        )))}
      </ul>
      <NotificationModal item={shown} onClose={() => setShown(null)} />
    </>
  );
}

/**
 * **A notice repeated in a row, as one line with its count** (P18.95-T7 AC-4; the client's UI review of 2026-10-26,
 * UI-030 — *Wilson updated your goal · 7×*; `groupRepeats`). Its title and *· 3×*, its detail, the newest one's date,
 * and a dot while any of them is unread, in a row's own idiom.
 *
 * - **The line is a disclosure** (`aria-expanded`): it opens to the notices themselves, each a row as any other —
 *   opening one reads it and goes where it goes, and its own toggle reads or unreads it alone. Opening the line reads
 *   nothing: the reader has not yet seen any of them.
 * - **Its toggle reads or unreads all of them** — *Mark all 3 as read* while any is unread, *Mark all 3 as unread*
 *   once none is — as one mark (`setRead` with the run), the bell moving by the count at once.
 *
 * Named by its title and how many — *Unread: Kickoff 2026 is coming up, 3 notices* — in place of the *· 3×* drawn,
 * which a screen reader would read as *times* of a sign it cannot see.
 */
function RepeatedNotice({
  run,
  onActivate,
  onToggle,
  onToggleAll,
}: {
  run: NoticeRun;
  onActivate: (item: InboxItem) => void;
  onToggle?: (item: InboxItem) => void;
  onToggleAll?: (items: readonly InboxItem[], read: boolean) => void;
}) {
  const language = useFigureLanguage();
  const t = useMessages(notificationMessages);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const detailId = useId();
  const whenId = useId();
  const [newest] = run.items;
  const count = run.items.length;
  const unread = run.items.some((item) => item.readAt === null);
  const toggle = t.markAllOf({ n: count, read: unread });

  return (
    <li data-unread={unread || undefined} data-repeats={count}>
      <div className="flex items-center gap-1 py-0.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          // Named in one string: the *×* is drawn and not said, and a name joined from spans gains stray spaces.
          aria-label={t.repeated({ title: newest.title, n: count, unread })}
          aria-describedby={newest.detail ? `${detailId} ${whenId}` : whenId}
          onClick={() => setOpen((was) => !was)}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-navy/[0.04]"
        >
          <span
            aria-hidden="true"
            className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-pill', unread ? 'bg-amber-deep' : 'bg-transparent')}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span
                className={cn('min-w-0 flex-1 break-words text-md text-navy md:truncate', unread ? 'font-semibold' : 'font-normal')}
              >
                {newest.title}
                <span className="text-muted"> · {count}×</span>
              </span>
              <time id={whenId} dateTime={newest.createdAt} className="shrink-0 text-xs text-muted">
                {formatNoticeShort(newest.createdAt, undefined, OFFICE_TIME_ZONE, language)}
              </time>
              <span aria-hidden="true" className="shrink-0 text-xs text-muted">{open ? '▴' : '▾'}</span>
            </span>
            {newest.detail && (
              <span id={detailId} className="block break-words text-sm text-muted md:truncate">{newest.detail}</span>
            )}
          </span>
        </button>
        {onToggleAll && (
          <Button
            variant="icon"
            title={toggle}
            className="mr-1"
            onClick={(event) => {
              event.stopPropagation();
              onToggleAll(run.items, unread);
            }}
          >
            <ToggleGlyph unread={unread} />
            <span className="sr-only">{toggle}</span>
          </Button>
        )}
      </div>
      <ul id={listId} hidden={!open} aria-label={newest.title} className="mb-1 ml-5 border-l border-hairline pl-1">
        {run.items.map((item) => (
          <NotificationRow key={item.notificationId} item={item} onActivate={onActivate} onToggle={onToggle} />
        ))}
      </ul>
    </li>
  );
}
