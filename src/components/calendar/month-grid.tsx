'use client';

import type { ReactNode } from 'react';
import { itemsOnDay, MONTH_LINES } from '@/lib/calendar-layout';
import {
  entryNameSuffix, isBusy, OWN_COPY, PROTOTYPE_COPY, titleOf, TYPE_LABEL, type CalendarEntry, type CalendarItem,
  type CalendarRead,
} from '@/lib/calendar';
import { formatMonthSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AgendaDay } from './agenda';
import { MONTH_BORDER, PaneHeadBar, TYPE_SWATCH, type PaneHead } from './calendar-parts';

/** The month's frame: a tile, as the week's panes are. */
const FRAME = 'overflow-hidden rounded-lg border border-hairline bg-card';

/**
 * Month (`Calendar_Section.html:346-349`, `:1007-1074`; P12-T3).
 *
 * **One read feeds both views** (contradiction 9). The prototype's month was a second, hardcoded object
 * that disagreed with its week — an entry only it had, one it lacked, no travel, and the days of the
 * months either side drawn empty although the week had entries on them. Here a cell lists what the
 * week lists for that day, from the same read's entries: an adjacent month's day included, only its
 * number muted, and a trip on each day it spans.
 *
 * **Clicking** (D-month): the prototype drew a pointer and a hover and did nothing (`:159-160`). A cell
 * is a button that opens Week on that day's week; a line opens its entry's detail; *"+{n} more…"*
 * opens the week it hides. A line sits over the cell's button rather than inside it, since a button
 * cannot hold another.
 *
 * **Below 640px *"+{n} more…"* draws its count alone** (F4): a phone's cell is some 45px wide and the
 * words would run out of it. The rest is still read, so the button's name is the prototype's whole
 * phrase at every width and begins with what is drawn (WCAG 2.5.3); and it truncates in its cell
 * rather than spill out of it, whatever the width.
 *
 * **Beside somebody compared** (P18.95-T8 AC-2; the client's UI review, UI-020): the month offers
 * compare as the week does, and each person's month is a pane of its own, stacked, under the same head
 * the week's pane has (`head`). A compared month reads its member's busy blocks as *Busy* lines with
 * their time, which open nothing — a tap there lands on the cell, as on any empty part of it.
 *
 * **On a phone** (`phone`; P18.95-T8 AC-1): a line in a 45px cell read *"9-…"*, so a cell draws a dot
 * per entry in its type's colour — three, then *+{n}* — and **a tap on a day shows that day's list**
 * under the grid, the agenda's own day (`AgendaDay`), rather than opening the week. The cell is then a
 * toggle: `aria-pressed` on the day shown, and its name says how many entries it holds, since the dots
 * are not read. At 768px and wider the month is as it was.
 */
export function MonthGrid({
  read,
  onOpen,
  onWeek,
  head,
  pill,
  phone = false,
  selected,
  onSelect,
}: {
  read: CalendarRead;
  onOpen: (entry: CalendarEntry) => void;
  onWeek: (date: string) => void;
  /** A pane's head, drawn beside somebody compared. */
  head?: PaneHead;
  pill?: ReactNode;
  /** Below 768px: dots in each cell, and the day tapped listed under the grid. */
  phone?: boolean;
  /** The day whose list a phone shows. */
  selected?: string;
  onSelect?: (date: string) => void;
}) {
  const showing = phone && selected && read.days.some((d) => d.date === selected) ? selected : undefined;
  const grid = (
    <div className={cn('grid grid-cols-7', !head && !phone && FRAME)}>
      {PROTOTYPE_COPY.dayNames.map((name) => (
        <div key={name} className="border-b border-hairline bg-base py-[9px] text-center text-xs font-bold text-muted">
          {name}
        </div>
      ))}
      {read.days.map(({ date, inPeriod }) => {
        const items = itemsOnDay(read.entries, date);
        const shown = items.slice(0, MONTH_LINES);
        const today = date === read.today;
        return (
          <div
            key={date}
            data-date={date}
            className={cn(
              'relative min-w-0 border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0',
              phone ? 'min-h-[52px]' : 'min-h-[128px]',
              today ? 'bg-amber/[0.08] hover:bg-amber/[0.12]' : 'hover:bg-navy-soft/[0.035]',
              showing === date && 'ring-2 ring-inset ring-navy',
            )}
          >
            <button
              type="button"
              aria-label={phone && items.length > 0 ? `${formatWeekdayDay(date)}, ${OWN_COPY.eventCount(items.length)}` : formatWeekdayDay(date)}
              aria-current={today ? 'date' : undefined}
              aria-pressed={phone ? showing === date : undefined}
              onClick={() => (phone ? onSelect?.(date) : onWeek(date))}
              className="absolute inset-0 h-full w-full"
            />
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none relative text-sm font-bold',
                today ? 'text-amber-ink' : inPeriod ? 'text-navy' : 'text-muted',
              )}
            >
              {Number(date.slice(8))}
            </span>
            {phone ? (
              items.length > 0 && <Dots items={items} />
            ) : items.length > 0 && (
              <ul className="pointer-events-none relative mt-1.5 flex flex-col gap-[3px]">
                {shown.map((item, i) => (
                  <li key={isBusy(item) ? `busy-${item.startsAt}-${i}` : `${item.entryId}-${date}`} className="min-w-0">
                    {isBusy(item) ? <BusyLine item={item} /> : (
                      <button
                        type="button"
                        data-entry=""
                        aria-label={lineName(item)}
                        onClick={() => onOpen(item)}
                        className={cn(
                          'pointer-events-auto block w-full truncate rounded-sm border-l-[2.5px] bg-navy-soft/10 px-[5px] py-0.5 text-left text-2xs font-semibold leading-tight text-navy',
                          MONTH_BORDER[item.type],
                        )}
                      >
                        {!item.allDay && (
                          <span className="mr-1 font-bold text-navy-soft">{formatMonthSpan(item.start ?? '', item.end ?? '')}</span>
                        )}
                        {titleOf(item)}
                      </button>
                    )}
                  </li>
                ))}
                {items.length > MONTH_LINES && (
                  <li className="min-w-0">
                    <MoreButton hiddenCount={items.length - MONTH_LINES} onClick={() => onWeek(date)} />
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!head && !phone) return grid;
  const list = showing && (
    <div className="border-t border-hairline">
      <AgendaDay read={read} date={showing} onOpen={onOpen} />
    </div>
  );
  if (!head) return <div className={FRAME}>{grid}{list}</div>;
  return (
    <section aria-label={head.name} className={FRAME}>
      <PaneHeadBar head={head} pill={pill} />
      {grid}
      {list}
    </section>
  );
}

/** A compared member's busy block in a month cell: *Busy* and its time, in the month's form; it opens nothing. */
function BusyLine({ item }: { item: CalendarItem }) {
  return (
    <span
      data-busy=""
      className="block w-full truncate rounded-sm border-l-[2.5px] border-muted bg-navy/[0.06] px-[5px] py-0.5 text-2xs font-semibold leading-tight text-navy"
    >
      {!item.allDay && <span className="mr-1 font-bold">{formatMonthSpan(item.start ?? '', item.end ?? '')}</span>}
      {OWN_COPY.busy}
    </span>
  );
}

/**
 * A phone's cell: a dot per entry in its type's colour, a busy block's grey, three of them and then
 * *+{n}* — drawn, not read: the cell's name says how many (P18.95-T8 AC-1).
 */
function Dots({ items }: { items: CalendarItem[] }) {
  return (
    <span aria-hidden="true" className="pointer-events-none relative mt-1 flex flex-wrap items-center gap-[3px]">
      {items.slice(0, MONTH_LINES).map((item, i) => (
        <span
          key={isBusy(item) ? `busy-${item.startsAt}-${i}` : item.entryId}
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isBusy(item) ? 'bg-muted' : TYPE_SWATCH[item.type])}
        />
      ))}
      {items.length > MONTH_LINES && (
        <span className="text-2xs font-bold leading-none text-muted">{OWN_COPY.moreShort(items.length - MONTH_LINES)}</span>
      )}
    </span>
  );
}

/**
 * *"+{n} more…"*: the count drawn at every width, the words after it drawn from 640px and read at all
 * of them (F4). The prototype's phrase is split after its count, not written again, so it stays the
 * one string; `calendar.spec.ts` holds the phrase to starting with that count.
 */
function MoreButton({ hiddenCount, onClick }: { hiddenCount: number; onClick: () => void }) {
  const count = OWN_COPY.moreShort(hiddenCount);
  const rest = PROTOTYPE_COPY.more(hiddenCount).slice(count.length);
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto block max-w-full truncate px-[5px] text-left text-2xs font-bold text-muted hover:text-navy"
    >
      {count}
      <span className="max-sm:sr-only">{rest}</span>
    </button>
  );
}

/** A line's name: its type, then the words drawn on it — the month's time and the title (WCAG 2.5.3). */
function lineName(entry: CalendarEntry): string {
  const time = entry.allDay ? '' : `${formatMonthSpan(entry.start ?? '', entry.end ?? '')} `;
  return `${TYPE_LABEL[entry.type]}: ${time}${titleOf(entry)}${entryNameSuffix(entry)}`;
}

/**
 * The month's frame while its read is on its way: the day names and five empty rows (L-01, a Fill) —
 * a phone's cells as short as its month draws them (P18.95-T8 AC-1).
 */
export function MonthSkeleton({ phone = false }: { phone?: boolean }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-7">
      {PROTOTYPE_COPY.dayNames.map((name) => (
        <div key={name} className="border-b border-hairline bg-base py-[9px] text-center text-xs font-bold text-muted">
          {name}
        </div>
      ))}
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className={cn(phone ? 'min-h-[52px]' : 'min-h-[128px]', 'border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0')}>
          <span className="block h-3 w-4 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
