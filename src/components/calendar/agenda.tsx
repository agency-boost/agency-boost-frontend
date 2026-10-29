'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { itemsOnDay } from '@/lib/calendar-layout';
import {
  entryName, isBusy, titleOf, type CalendarEntry, type CalendarItem, type CalendarRead,
} from '@/lib/calendar';
import { formatTimeSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ENTRY_TONE, PaneHeadBar, type PaneHead } from './calendar-parts';

/**
 * **The agenda: a phone's week, as a list by day** (P18.95-T8 AC-1; the client's UI review, UI-020;
 * ADR-0167). Below 768px the week's seven columns are 48px each, so Sunday ran off the pane and an
 * entry read *"W…"*; the client asked for a list. **It is the week's own read** — the same
 * `GET /calendar/entries?view=week`, the same entries, the same permissions — drawn day under day,
 * Monday first, each entry a 44px line with its time, its title in full and its type in words. A day
 * with nothing on it says so, so the week's shape is still there. An entry opens the same detail the
 * grid opens; a compared member's busy block reads *Busy* and its time, and opens nothing.
 *
 * Its region is named as the week's grid is, *Calendar, {range}*, and takes the focus after a delete
 * (m7), as the grid does. Beside somebody compared, it carries the pane's head, as the week's does.
 */
export function AgendaPane({
  read,
  head,
  pill,
  regionLabel,
  onOpen,
  className,
}: {
  read: CalendarRead;
  /** Drawn beside somebody compared, so each list says whose it is; alone, the reader's needs none. */
  head?: PaneHead;
  pill?: ReactNode;
  regionLabel: string;
  onOpen: (entry: CalendarEntry) => void;
  className?: string;
}) {
  const list = (
    <div role="region" aria-label={regionLabel} tabIndex={-1} className="bg-card">
      {read.days.map(({ date }) => (
        <AgendaDay key={date} read={read} date={date} onOpen={onOpen} />
      ))}
    </div>
  );
  if (!head) return <div className={cn('bg-card', className)}>{list}</div>;
  return (
    <section aria-label={head.name} className={cn('flex min-w-0 flex-col bg-card', className)}>
      <PaneHeadBar head={head} pill={pill} />
      {list}
    </section>
  );
}

/**
 * One day of the agenda, and **the list a month's tap shows on a phone** (AC-1): its date with its
 * weekday as a heading, *Senin, 28 Sep 2026*, today's tinted as the week's column is, then what is on
 * it, by start — a trip first, on each day it spans, as the month lists it.
 */
export function AgendaDay({
  read,
  date,
  onOpen,
}: {
  read: CalendarRead;
  date: string;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const t = useMessages(calendarMessages);
  const language = useFigureLanguage();
  const items = itemsOnDay(read.entries, date);
  const today = date === read.today;
  const heading = `agenda-${read.subject.membershipId}-${date}`;
  return (
    <div data-day={date} className="border-b border-hairline last:border-b-0">
      <h2
        id={heading}
        aria-current={today ? 'date' : undefined}
        className={cn('px-3.5 py-2 text-sm font-bold', today ? 'bg-amber/[0.08] text-amber-ink' : 'bg-base text-navy')}
      >
        {formatWeekdayDay(date, language)}
      </h2>
      {items.length === 0 ? (
        <p className="px-3.5 py-2.5 text-sm text-muted">{t.noEvents}</p>
      ) : (
        <ul aria-labelledby={heading} className="flex flex-col gap-1.5 p-2">
          {items.map((item, i) => (
            <li key={isBusy(item) ? `busy-${item.startsAt}-${i}` : `${item.entryId}-${date}`}>
              <AgendaItem item={item} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A line: its time, `09.00–09.30`, then the title, whole, and the type in words — colour is never the
 * only thing that says what it is. **Named as the grid names it**, *{type}: {title}, {time}* and what
 * the reader owes it, so a voice user says the same words in either view. A trip has no time to show.
 */
function AgendaItem({ item, onOpen }: { item: CalendarItem; onOpen: (entry: CalendarEntry) => void }) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const time = item.allDay ? '' : formatTimeSpan(item.start ?? '', item.end ?? '', language);
  const shape = 'flex min-h-11 w-full items-start gap-3 rounded-[6px] border-l-[3px] px-2.5 py-2 text-left text-navy';
  const when = <span className="w-[88px] shrink-0 text-sm font-bold">{time}</span>;
  if (isBusy(item)) {
    return (
      <div data-busy="" className={cn(shape, 'border-muted bg-navy/[0.06]')}>
        {when}
        <span className="min-w-0 flex-1 text-md font-semibold">{t.busy}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-entry=""
      aria-label={entryName(item, time, words)}
      onClick={() => onOpen(item)}
      className={cn(shape, 'hover:brightness-[0.96]', ENTRY_TONE[item.type])}
    >
      {when}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-md font-semibold">{titleOf(item, words)}</span>
        <span className="block text-xs">{t.types[item.type]}</span>
      </span>
    </button>
  );
}

/** The agenda's frame while its read is on its way: three days' headings and lines, nothing in them (L-01). */
export function AgendaSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="border-b border-hairline last:border-b-0">
          <div className="bg-base px-3.5 py-2.5">
            <span className="block h-3 w-32 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
          </div>
          <div className="flex flex-col gap-1.5 p-2">
            <span className="block h-11 animate-pulse rounded-[6px] bg-hairline/60 motion-reduce:animate-none" />
            <span className="block h-11 animate-pulse rounded-[6px] bg-hairline/60 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
