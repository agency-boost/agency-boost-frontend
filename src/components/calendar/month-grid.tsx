'use client';

import { itemsOnDay, MONTH_LINES } from '@/lib/calendar-layout';
import {
  entryNameSuffix, isBusy, OWN_COPY, PROTOTYPE_COPY, titleOf, TYPE_BADGE, type CalendarEntry, type CalendarRead,
} from '@/lib/calendar';
import { formatMonthSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MONTH_BORDER } from './calendar-parts';

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
 */
export function MonthGrid({
  read,
  onOpen,
  onWeek,
}: {
  read: CalendarRead;
  onOpen: (entry: CalendarEntry) => void;
  onWeek: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-hairline bg-card">
      {PROTOTYPE_COPY.dayNames.map((name) => (
        <div key={name} className="border-b border-hairline bg-base py-[9px] text-center text-xs font-bold text-muted">
          {name}
        </div>
      ))}
      {read.days.map(({ date, inPeriod }) => {
        const items = itemsOnDay(read.entries, date).filter((item): item is CalendarEntry => !isBusy(item));
        const shown = items.slice(0, MONTH_LINES);
        const today = date === read.today;
        return (
          <div
            key={date}
            data-date={date}
            className={cn(
              'relative min-h-[128px] min-w-0 border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0',
              today ? 'bg-amber/[0.08] hover:bg-amber/[0.12]' : 'hover:bg-navy-soft/[0.035]',
            )}
          >
            <button
              type="button"
              aria-label={formatWeekdayDay(date)}
              aria-current={today ? 'date' : undefined}
              onClick={() => onWeek(date)}
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
            {items.length > 0 && (
              <ul className="pointer-events-none relative mt-1.5 flex flex-col gap-[3px]">
                {shown.map((entry) => (
                  <li key={`${entry.entryId}-${date}`} className="min-w-0">
                    <button
                      type="button"
                      data-entry=""
                      aria-label={lineName(entry)}
                      onClick={() => onOpen(entry)}
                      className={cn(
                        'pointer-events-auto block w-full truncate rounded-sm border-l-[2.5px] bg-navy-soft/10 px-[5px] py-0.5 text-left text-2xs font-semibold leading-tight text-navy',
                        MONTH_BORDER[entry.type],
                      )}
                    >
                      {!entry.allDay && (
                        <span className="mr-1 font-bold text-navy-soft">{formatMonthSpan(entry.start ?? '', entry.end ?? '')}</span>
                      )}
                      {titleOf(entry)}
                    </button>
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
  return `${TYPE_BADGE[entry.type]}: ${time}${titleOf(entry)}${entryNameSuffix(entry)}`;
}

/** The month's frame while its read is on its way: the day names and five empty rows (L-01, a Fill). */
export function MonthSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-7">
      {PROTOTYPE_COPY.dayNames.map((name) => (
        <div key={name} className="border-b border-hairline bg-base py-[9px] text-center text-xs font-bold text-muted">
          {name}
        </div>
      ))}
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="min-h-[128px] border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0">
          <span className="block h-3 w-4 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
