'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { messagesIn } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { itemsOnDay, MONTH_LINES, tasksPerDay } from '@/lib/calendar-layout';
import {
  isBusy, isHiddenTask, owesOf, titleOf, type CalendarEntry, type CalendarItem, type CalendarJoinedItem, type CalendarRead,
} from '@/lib/calendar';
import { formatMonthSpan, formatNumber, formatWeekdayDay, weekdayHeadings } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MONTH_BORDER, PaneHeadBar, TYPE_SWATCH, type PaneHead } from './calendar-parts';
import { dayShort, useCalendarTasks } from './calendar-tasks';

/** A cell's line: an entry, a busy block, or an event joined (UI-104). */
type MonthItem = CalendarItem | CalendarJoinedItem;
const isJoined = (item: MonthItem): item is Extract<CalendarJoinedItem, { eventId: string }> => 'eventId' in item;
const keyOf = (item: MonthItem, i: number, date: string) =>
  (isBusy(item) ? `busy-${item.startsAt}-${i}` : isJoined(item) ? `ev-${item.eventId}-${date}` : `${item.entryId}-${date}`);

/** The month's frame: a tile, as the week's panes are. */
const FRAME = 'overflow-hidden rounded-lg border border-card-edge bg-card';

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
 * per entry in its type's colour — three, then *+{n}* — and its name says how many entries it holds, since the dots
 * are not read. **A tap on a day opens that day in the Agenda** (UI V1, UI-104 point 2; it showed the day's list under
 * the grid). At 768px and wider the month is as it was.
 *
 * **Tugas** (UI V1, UI-104 point 2): a small orange count badge beside each date with tasks — never a dot (D-27). On a
 * phone the cell's tap goes to that day's Agenda, where the checklist is; from 768px the badge is its own button to it.
 * Events joined are lines (dots on a phone) in their own tone, and open the event.
 */
export function MonthGrid({
  read,
  onOpen,
  onWeek,
  head,
  pill,
  phone = false,
  onAgenda,
}: {
  read: CalendarRead;
  onOpen: (entry: CalendarEntry) => void;
  onWeek: (date: string) => void;
  /** A pane's head, drawn beside somebody compared. */
  head?: PaneHead;
  pill?: ReactNode;
  /** Below 768px: dots in each cell, and a tap opens the day in the Agenda. */
  phone?: boolean;
  /** That day in the Agenda (UI-104 point 2): a phone's cell, and a wider month's *Tugas* badge. */
  onAgenda: (date: string) => void;
}) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const { struck } = useCalendarTasks();
  const counts = tasksPerDay(read.tasks.filter((task) => isHiddenTask(task) || !struck.has(task.taskId)));
  const lines: MonthItem[] = [...read.entries, ...read.events];
  const grid = (
    <div className={cn('grid grid-cols-7', !head && !phone && FRAME)}>
      {weekdayHeadings(language).map((name) => (
        <div key={name} className="border-b border-hairline bg-base py-[9px] text-center text-xs font-bold text-muted">
          {name}
        </div>
      ))}
      {read.days.map(({ date, inPeriod }) => {
        const items = itemsOnDay(lines, date);
        const shown = items.slice(0, MONTH_LINES);
        const today = date === read.today;
        const tasks = counts.get(date) ?? 0;
        const tasksName = t.tasksOn({ day: dayShort(date, language), count: formatNumber(tasks, {}, language) });
        return (
          <div
            key={date}
            data-date={date}
            className={cn(
              'relative min-w-0 border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0',
              phone ? 'min-h-[52px]' : 'min-h-[128px]',
              today ? 'bg-amber/[0.08] hover:bg-amber/[0.12]' : 'hover:bg-navy-soft/[0.035]',
            )}
          >
            <button
              type="button"
              aria-label={[
                formatWeekdayDay(date, language),
                ...(phone && items.length > 0 ? [t.eventCount({ n: items.length, count: formatNumber(items.length, {}, language) })] : []),
                ...(phone && tasks > 0 ? [tasksName] : []),
              ].join(', ')}
              aria-current={today ? 'date' : undefined}
              onClick={() => (phone ? onAgenda(date) : onWeek(date))}
              className="absolute inset-0 h-full w-full"
            />
            <span className="pointer-events-none relative flex items-center justify-between gap-1">
              <span
                aria-hidden="true"
                className={cn('text-sm font-bold', today ? 'text-amber-ink' : inPeriod ? 'text-navy' : 'text-muted')}
              >
                {Number(date.slice(8))}
              </span>
              {tasks > 0 && (phone ? (
                <span aria-hidden="true" data-task-badge={date} className="rounded-pill bg-amber px-1.5 text-2xs font-bold leading-4 text-navy">
                  {formatNumber(tasks, {}, language)}
                </span>
              ) : (
                <button
                  type="button"
                  data-task-badge={date}
                  aria-label={tasksName}
                  onClick={() => onAgenda(date)}
                  className="pointer-events-auto rounded-pill bg-amber px-1.5 text-2xs font-bold leading-5 text-navy hover:brightness-95"
                >
                  {formatNumber(tasks, {}, language)}
                </button>
              ))}
            </span>
            {phone ? (
              items.length > 0 && <Dots items={items} />
            ) : items.length > 0 && (
              <ul className="pointer-events-none relative mt-1.5 flex flex-col gap-[3px]">
                {shown.map((item, i) => (
                  <li key={keyOf(item, i, date)} className="min-w-0">
                    {isBusy(item) ? <BusyLine item={item} /> : isJoined(item) ? (
                      <Link
                        href={`/events/${encodeURIComponent(item.eventId)}`}
                        data-event=""
                        aria-label={t.joinedName({ title: item.title, type: item.type.label, time: formatMonthSpan(item.start ?? '', item.end ?? '', language) })}
                        className="pointer-events-auto block w-full truncate rounded-sm border-l-[2.5px] border-lavender bg-lavender/[0.14] px-[5px] py-0.5 text-left text-2xs font-semibold leading-tight text-navy"
                      >
                        <span className="mr-1 font-bold text-navy-soft">{formatMonthSpan(item.start ?? '', item.end ?? '', language)}</span>
                        {item.title}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        data-entry=""
                        aria-label={lineName(item, words, language)}
                        onClick={() => onOpen(item)}
                        className={cn(
                          'pointer-events-auto block w-full truncate rounded-sm border-l-[2.5px] bg-navy-soft/10 px-[5px] py-0.5 text-left text-2xs font-semibold leading-tight text-navy',
                          MONTH_BORDER[item.type],
                        )}
                      >
                        {!item.allDay && (
                          <span className="mr-1 font-bold text-navy-soft">{formatMonthSpan(item.start ?? '', item.end ?? '', language)}</span>
                        )}
                        {titleOf(item, words)}
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
  if (!head) return <div className={FRAME}>{grid}</div>;
  return (
    <section aria-label={head.name} className={FRAME}>
      <PaneHeadBar head={head} pill={pill} />
      {grid}
    </section>
  );
}

/** A compared member's busy block in a month cell: *Busy* and its time, in the month's form; it opens nothing. */
function BusyLine({ item }: { item: MonthItem }) {
  const t = useMessages(calendarMessages);
  const language = useFigureLanguage();
  return (
    <span
      data-busy=""
      className="block w-full truncate rounded-sm border-l-[2.5px] border-muted bg-navy/[0.06] px-[5px] py-0.5 text-2xs font-semibold leading-tight text-navy"
    >
      {!item.allDay && <span className="mr-1 font-bold">{formatMonthSpan(item.start ?? '', item.end ?? '', language)}</span>}
      {t.busy}
    </span>
  );
}

/**
 * A phone's cell: a dot per entry in its type's colour, a busy block's grey, three of them and then
 * *+{n}* — drawn, not read: the cell's name says how many (P18.95-T8 AC-1).
 */
function Dots({ items }: { items: MonthItem[] }) {
  const t = useMessages(calendarMessages);
  return (
    <span aria-hidden="true" className="pointer-events-none relative mt-1 flex flex-wrap items-center gap-[3px]">
      {items.slice(0, MONTH_LINES).map((item, i) => (
        <span
          key={keyOf(item, i, '')}
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isBusy(item) ? 'bg-muted' : isJoined(item) ? 'bg-lavender' : TYPE_SWATCH[item.type])}
        />
      ))}
      {items.length > MONTH_LINES && (
        <span className="text-2xs font-bold leading-none text-muted">{t.moreCount({ n: items.length - MONTH_LINES })}</span>
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
  const t = useMessages(calendarMessages);
  const count = t.moreCount({ n: hiddenCount });
  const rest = t.moreRest;
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

/** A line's name: its type, then the words drawn on it — the month's time and the title (WCAG 2.5.3) — in `words`. */
function lineName(entry: CalendarEntry, words: Language, figures: Language): string {
  const t = messagesIn(calendarMessages, words);
  const time = entry.allDay ? '' : formatMonthSpan(entry.start ?? '', entry.end ?? '', figures);
  return t.lineName({ type: t.types[entry.type], time, title: titleOf(entry, words), owes: owesOf(entry) });
}

/**
 * The month's frame while its read is on its way: the day names and five empty rows (L-01, a Fill) —
 * a phone's cells as short as its month draws them (P18.95-T8 AC-1).
 */
export function MonthSkeleton({ phone = false }: { phone?: boolean }) {
  const language = useFigureLanguage();
  return (
    <div aria-hidden="true" className="grid grid-cols-7">
      {weekdayHeadings(language).map((name) => (
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
