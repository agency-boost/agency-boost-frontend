'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import {
  addDays, hhmm, isBusy, isHiddenTask, type CalendarEntry, type CalendarItem, type CalendarJoinedItem, type CalendarRead,
} from '@/lib/calendar';
import { BAR_GAP_PX, layoutDay, segmentOn, showsTime, stackBars, tasksPerDay } from '@/lib/calendar-layout';
import type { Slot } from '@/lib/calendar-form';
import { formatDayHeader, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AgendaPerson } from './agenda';
import { Avatar } from './calendar-parts';
import { CountPill, useCalendarTasks, type TaskPerson } from './calendar-tasks';
import { EntryBlock } from './week-pane';

/** **3 Hari's hour**: 52px, the mockup's — shorter than the week's 56px, so a phone shows more of the day. */
export const THREE_DAY_HOUR_PX = 52;
/** **The time gutter**: ~36px, the hours drawn short, *09* (UI-104 point 5). */
const GUTTER = 'w-9';
/** A trip's bar in the Trip row (UI-104 point 8): ~22px. */
const TRIP_BAR_PX = 20;
/** How far a finger must travel, at least, for a swipe to page (a fifth of the width when that is more). */
const SWIPE_MIN_PX = 50;

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_LINES = `repeating-linear-gradient(to bottom, transparent, transparent ${THREE_DAY_HOUR_PX - 1}px, var(--color-divider) ${THREE_DAY_HOUR_PX - 1}px, var(--color-divider) ${THREE_DAY_HOUR_PX}px)`;

type GridItem = CalendarItem | CalendarJoinedItem;
interface Placed {
  start: string | null;
  end: string | null;
  item: GridItem;
  who: TaskPerson | null;
}

/**
 * **3 Hari** (UI V1, 2026-10-30, UI-104 point 5; mockup 2): three day columns starting with the day asked for — today
 * when it opens — today's date circled in orange.
 *
 * - **Paged like Outlook mobile**: a horizontal swipe moves exactly three days and snaps — it never stops between days
 *   (`usePagedSwipe`); ‹ › do the same; *Hari ini* returns to today and the two days after it. The days either side are
 *   drawn as the finger moves, their heads named, their grid empty until the read for them arrives.
 * - **The hour grid opens at the current hour** and scrolls with the page, **one pinned header** above it — the range
 *   arrows and the compact switcher (`controls`), the day names, the Trip row when a trip is in view, and the *Tugas*
 *   count row — while the title and the filters scroll away.
 * - **On a phone it is full-bleed**: no side padding, no card or border, a ~36px gutter of short hours (*09*), three
 *   equal columns, thin dividers, and the grid running to the bottom edge behind the floating tab bar.
 * - **Compared people** (point 9): their timed things in the same columns, each with the person's small avatar, their
 *   tasks in the count and the popup.
 */
export function ThreeDays({
  read,
  others = [],
  nowMinute,
  controls,
  regionLabel,
  onStep,
  onOpen,
  onSlot,
  onTasks,
}: {
  read: CalendarRead;
  others?: readonly AgendaPerson[];
  nowMinute: number | null;
  /** The pinned header's first row: the range arrows, the range, *Hari ini* and the switcher. */
  controls: ReactNode;
  regionLabel: string;
  /** Three days back (`-1`) or on (`1`): a swipe, as ‹ › are. */
  onStep: (direction: -1 | 1) => void;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
  onTasks: (day: string) => void;
}) {
  const t = useMessages(calendarMessages);
  const language = useFigureLanguage();
  const { struck } = useCalendarTasks();
  const days = read.days.map((d) => d.date);
  const grid = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const swipe = usePagedSwipe(read.from, onStep);

  // Opened at the current hour — or 7 AM on days that are not today's — just under the pinned header.
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const hour = days.includes(read.today) && nowMinute !== null ? Math.floor(nowMinute / 60) : 7;
    const top = el.getBoundingClientRect().top + (window.scrollY || 0) + hour * THREE_DAY_HOUR_PX - (header.current?.offsetHeight ?? 0);
    // The page's own scroll, set rather than animated: it opens there.
    const page = document.scrollingElement ?? document.documentElement;
    page.scrollTop = Math.max(0, top);
    // Once, as the view opens: a page turned keeps the hour the reader scrolled to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const people: { who: TaskPerson | null; read: CalendarRead }[] = [
    { who: null, read },
    ...others.filter((o): o is AgendaPerson & { read: CalendarRead } => o.read !== null).map((o) => ({ who: o.person, read: o.read })),
  ];
  const trips = people.flatMap(({ read: r }) => r.entries.filter((item) => item.allDay));
  const { bars, lanes } = stackBars(trips, days);
  const counts = tasksPerDay(people.flatMap(({ read: r }) => r.tasks.filter((task) => isHiddenTask(task) || !struck.has(task.taskId))));
  const placedOn = (day: string): Placed[] => people.flatMap(({ who, read: r }) => [...r.entries, ...r.events]
    .map((item) => segmentOn(item, day))
    .filter((item): item is GridItem => item !== null)
    .map((item) => ({ start: item.start, end: item.end, item, who })));

  const before = [3, 2, 1].map((n) => addDays(days[0], -n));
  const after = [1, 2, 3].map((n) => addDays(days[days.length - 1], n));
  const strip = (panel: (list: readonly string[], current: boolean) => ReactNode) => (
    <div className="min-w-0 flex-1 overflow-hidden">
      <div className="flex w-[300%]" style={swipe.style}>
        {panel(before, false)}
        {panel(days, true)}
        {panel(after, false)}
      </div>
    </div>
  );
  const columns = (list: readonly string[], cell: (day: string) => ReactNode, className?: string) => (
    <div className={cn('grid w-1/3 grid-cols-3', className)}>{list.map((day) => <div key={day} className="min-w-0 border-l border-divider">{cell(day)}</div>)}</div>
  );

  return (
    <div
      data-three-days=""
      onTouchStart={swipe.start}
      onTouchMove={swipe.move}
      onTouchEnd={swipe.end}
      onTouchCancel={swipe.cancel}
      className={cn(
        'touch-pan-y bg-card',
        'max-md:-mx-4 max-md:-mb-[calc(var(--tab-bar-space)+1.5rem)]',
        'md:overflow-hidden md:rounded-lg',
      )}
    >
      <div ref={header} className="sticky top-0 z-20 border-b border-divider bg-card">
        {controls}
        <div className="flex h-12 items-center">
          <div className={cn(GUTTER, 'shrink-0')} />
          {strip((list, current) => columns(list, (day) => {
            const { weekday, number } = formatDayHeader(day, language);
            const today = day === read.today;
            return (
              <div aria-hidden={!current || undefined} className="text-center text-xs leading-tight text-muted">
                {weekday}
                <span
                  aria-current={current && today ? 'date' : undefined}
                  className={cn(
                    'mx-auto mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full text-md font-bold',
                    today ? 'bg-amber text-navy' : 'text-ink',
                  )}
                >
                  {number}
                </span>
                {current && <span className="sr-only">{formatWeekdayDay(day, language)}</span>}
              </div>
            );
          }, 'items-center'))}
        </div>
        {bars.length > 0 && (
          <div data-trip-row="" className="flex border-t border-divider">
            <div className={cn(GUTTER, 'flex shrink-0 items-center justify-center text-signal-grey')}>
              <LineIcon name="plane" className="h-4 w-4" />
              <span className="sr-only">{t.types.travel}</span>
            </div>
            <div className="relative min-w-0 flex-1" style={{ height: lanes * (TRIP_BAR_PX + BAR_GAP_PX) + BAR_GAP_PX }}>
              {bars.map(({ item, first, last, lane }, i) => (
                <TripBar
                  key={isBusy(item) ? `busy-${item.startsAt}-${i}` : `${item.entryId}-${i}`}
                  item={item}
                  onOpen={onOpen}
                  style={{
                    left: `calc(${(first / days.length) * 100}% + 2px)`,
                    width: `calc(${((last - first + 1) / days.length) * 100}% - 4px)`,
                    top: BAR_GAP_PX + lane * (TRIP_BAR_PX + BAR_GAP_PX),
                    height: TRIP_BAR_PX,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div data-task-row="" className="flex h-11 items-center border-t border-divider md:h-8">
          <div className={cn(GUTTER, 'shrink-0 text-center text-xs font-semibold tracking-tight text-signal-grey')}>{t.tasks}</div>
          {strip((list, current) => columns(list, (day) => (
            <div className="grid place-items-center">
              {current ? (
                <CountPill
                  day={day}
                  count={counts.get(day) ?? 0}
                  onOpen={people.some(({ read: r }) => r.tasks.some((task) => task.date === day && !isHiddenTask(task))) ? () => onTasks(day) : undefined}
                />
              ) : <span aria-hidden="true" className="text-md font-bold text-line">·</span>}
            </div>
          )))}
        </div>
      </div>

      <div ref={grid} role="region" aria-label={regionLabel} tabIndex={-1} className="relative flex pb-[var(--tab-bar-space)] md:pb-0">
        <div aria-hidden="true" className={cn(GUTTER, 'shrink-0')}>
          {HOURS.map((h) => (
            <div key={h} className="-translate-y-[7px] text-center text-xs text-signal-grey" style={{ height: THREE_DAY_HOUR_PX }}>
              {h === 0 ? '' : String(h).padStart(2, '0')}
            </div>
          ))}
        </div>
        {strip((list, current) => columns(list, (day) => (current ? (
          <DayGrid
            day={day}
            items={placedOn(day)}
            nowMinute={day === read.today ? nowMinute : null}
            onOpen={onOpen}
            onSlot={onSlot}
          />
        ) : <div style={{ height: 24 * THREE_DAY_HOUR_PX, backgroundImage: HOUR_LINES }} />)))}
      </div>
    </div>
  );
}

/** One day of the grid: its timed things side by side where they overlap, the now-line on today, a tap for a slot. */
function DayGrid({
  day, items, nowMinute, onOpen, onSlot,
}: {
  day: string;
  items: Placed[];
  nowMinute: number | null;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
}) {
  const language = useFigureLanguage();
  const take = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSlot || (e.target as HTMLElement).closest('[data-entry], [data-busy], [data-event]')) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const start = Math.min(Math.max(Math.floor((y / THREE_DAY_HOUR_PX) * 2) * 30, 0), 23 * 60 + 30);
    onSlot({ date: day, start: hhmm(start), end: hhmm(start + 30) });
  };
  return (
    // A tap on an empty slot is the grid's own convenience; *+ New event* is the keyboard's way in, as in Week.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      role="group"
      aria-label={formatWeekdayDay(day, language)}
      data-day={day}
      onClick={take}
      className="relative"
      style={{ height: 24 * THREE_DAY_HOUR_PX, backgroundImage: HOUR_LINES }}
    >
      {layoutDay(items, THREE_DAY_HOUR_PX).map(({ item: placed, top, height, lane, lanes }, i) => (
        <EntryBlock
          key={`${placed.who?.membershipId ?? 'me'}-${isBusy(placed.item) ? `busy-${placed.item.startsAt}` : 'eventId' in placed.item ? placed.item.eventId : placed.item.entryId}-${i}`}
          item={placed.item}
          style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 1px)`, width: `calc(${100 / lanes}% - 2px)` }}
          withTime={showsTime(height)}
          onOpen={onOpen}
          chip={placed.who ? <span className="mt-0.5 block"><Avatar initials={placed.who.initials} /></span> : undefined}
        />
      ))}
      {nowMinute !== null && (
        <div
          aria-hidden="true"
          data-now=""
          className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-amber"
          style={{ top: (nowMinute / 60) * THREE_DAY_HOUR_PX }}
        >
          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-amber" />
        </div>
      )}
    </div>
  );
}

/** An all-day trip in the Trip row: the plane line icon and its title, across its days; a tap opens it. */
function TripBar({ item, style, onOpen }: { item: CalendarItem; style: CSSProperties; onOpen: (entry: CalendarEntry) => void }) {
  const t = useMessages(calendarMessages);
  const shape = 'absolute flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-[6px] border-l-[3px] px-1.5 text-xs font-semibold';
  if (isBusy(item)) {
    return <div data-busy="" style={style} className={cn(shape, 'border-line bg-pill-grey text-signal-grey')}>{t.busy}</div>;
  }
  return (
    <button
      type="button"
      data-entry=""
      style={style}
      onClick={() => onOpen(item)}
      className={cn(shape, 'border-teal bg-teal/[0.14] text-left text-teal-ink')}
    >
      <LineIcon name="plane" className="h-3.5 w-3.5" />
      <span className="truncate">{item.title || t.untitled}</span>
    </button>
  );
}

/**
 * **A paged swipe** (UI-104 point 5: *one swipe moves exactly 3 days and snaps*): the columns follow a horizontal
 * finger, and on release either turn a whole page — past a fifth of the width, or 50px — or spring back; nothing stops
 * between days. A vertical movement is the page's scroll and is left alone (`touch-pan-y`). The strip rests at its
 * middle panel; a turned page waits there until the next read (`from`) arrives, then comes back without a jump.
 */
function usePagedSwipe(from: string, onStep: (direction: -1 | 1) => void) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touch = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; width: number } | null>(null);

  useEffect(() => {
    setAnimating(false);
    setOffset(0);
  }, [from]);

  const start = (e: TouchEvent<HTMLDivElement>) => {
    const point = e.touches[0];
    if (!point) return;
    touch.current = { x: point.clientX, y: point.clientY, axis: null, width: e.currentTarget.offsetWidth || 300 };
    setAnimating(false);
  };
  const move = (e: TouchEvent<HTMLDivElement>) => {
    const t = touch.current;
    const point = e.touches[0];
    if (!t || !point) return;
    const dx = point.clientX - t.x;
    const dy = point.clientY - t.y;
    if (t.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > 8) t.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (t.axis === 'x') setOffset(dx);
  };
  const end = (e: TouchEvent<HTMLDivElement>) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.axis !== 'x') return;
    const point = e.changedTouches[0];
    const dx = point ? point.clientX - t.x : offset;
    setAnimating(true);
    if (Math.abs(dx) >= Math.max(SWIPE_MIN_PX, t.width / 5)) {
      const direction: -1 | 1 = dx < 0 ? 1 : -1;
      setOffset(-direction * t.width);
      onStep(direction);
    } else {
      setOffset(0);
    }
  };
  const cancel = () => {
    touch.current = null;
    setAnimating(true);
    setOffset(0);
  };
  const style: CSSProperties = {
    transform: `translateX(calc(-100% / 3 + ${offset}px))`,
    transition: animating ? 'transform 180ms ease-out' : 'none',
  };
  return { start, move, end, cancel, style };
}
