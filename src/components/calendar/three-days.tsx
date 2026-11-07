'use client';

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { addDays, isHiddenTask, type CalendarEntry, type CalendarRead } from '@/lib/calendar';
import { tasksPerDay, timedOn } from '@/lib/calendar-layout';
import type { Slot } from '@/lib/calendar-form';
import { cn } from '@/lib/cn';
import { PaneHeadBar, type PaneHead } from './calendar-parts';
import { useCalendarTasks } from './calendar-tasks';
import { TimeGrid, type GridItem, type ScrollGroup } from './time-grid';

/** How far a finger must travel, at least, for a swipe to page (a fifth of the width when that is more). */
const SWIPE_MIN_PX = 50;

/**
 * **3 Hari** (UI V1, 2026-10-30, UI-104 point 5; P19.1-T3, UI-117 and UI-144): three day columns starting with the day
 * asked for — today when it opens — drawn by **the one time grid Week draws** (`TimeGrid`): the hours *07.00*, the
 * *Tugas* row's blue counts, today shaded on a phone and circled from 768px.
 *
 * - **The page's one toolbar** (UI-117, UI-144): no range, arrows or second *3 Hari ⌄* inside the grid any more — the
 *   toolbar above is the same in every view.
 * - **Paged like Outlook mobile**: a horizontal swipe moves exactly three days and snaps — it never stops between days
 *   (`usePagedSwipe`); ‹ › do the same; *Hari ini* returns to today and the two days after it. The days either side are
 *   drawn as the finger moves, their heads named, their grid empty until the read for them arrives. **A tap takes a slot**
 *   on a phone, since a horizontal finger there turns the page.
 *
 * *Changed 2026-11-07 (P19.8-T3; MOB UI-172, UI-175; the brief's Calendar 1):*
 *
 * - **On a phone it opens at the top of the page and the page never scrolls** — where it scrolled the page to an hour
 *   before now, 632px down, the title and the toolbar gone. The grid has **its own scroll box, opened with 07.00 at its
 *   top** (00.00–07.00 above it, a swipe down inside the grid), **running the screen's full width to its foot** behind
 *   the floating tab bar (`fill`), under the day heads and the *Tugas* row, which stay put. From 768px a card with its
 *   own box, as before.
 * - **Compared people are drawn as Week draws them**: no person row on the reader's own calendar; with *Bandingkan
 *   dengan downline*, a person row above each person's grid (`head`; the compared panes are the page's, as Week's are)
 *   — where their things joined the reader's columns, each with an avatar (UI-104 point 9; D-36, one grid for both).
 */
export function ThreeDays({
  read,
  head,
  nowMinute,
  phone,
  fill = false,
  regionLabel,
  scroll,
  onStep,
  onOpen,
  onSlot,
  onTasks,
  className,
}: {
  read: CalendarRead;
  /** The person row above the grid: only where somebody is compared (MOB UI-175). */
  head?: PaneHead;
  nowMinute: number | null;
  /** Below 768px: opens at 07.00, a tap takes a slot; wider, a drag. */
  phone: boolean;
  /** The reader's own calendar alone on a phone: the grid runs to the foot of the screen, the page still. */
  fill?: boolean;
  regionLabel: string;
  scroll: ScrollGroup;
  /** Three days back (`-1`) or on (`1`): a swipe, as ‹ › are. */
  onStep: (direction: -1 | 1) => void;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
  onTasks: (day: string) => void;
  className?: string;
}) {
  const { struck } = useCalendarTasks();
  const days = read.days.map((d) => d.date);
  const swipe = usePagedSwipe(read.from, onStep);
  // *Tugas* by day, a tick in this visit taken off at once (UI-104 point 4); a hidden person's are counts only.
  const counts = tasksPerDay(read.tasks.filter((task) => isHiddenTask(task) || !struck.has(task.taskId)));
  const timed: GridItem[] = [...read.entries, ...read.events];

  return (
    <section
      aria-label={head?.name}
      data-three-days=""
      onTouchStart={swipe.start}
      onTouchMove={swipe.move}
      onTouchEnd={swipe.end}
      onTouchCancel={swipe.cancel}
      className={cn('flex min-w-0 flex-1 touch-pan-y flex-col bg-card', className)}
    >
      {head && <PaneHeadBar head={head} />}
      <TimeGrid
        days={days}
        today={read.today}
        nowMinute={nowMinute}
        regionLabel={regionLabel}
        morning={phone}
        fill={fill}
        slotBy={phone ? 'tap' : 'drag'}
        placedOn={(day) => timedOn(timed, day).map((item) => ({ item, who: null }))}
        trips={read.entries.filter((item) => item.allDay)}
        counts={counts}
        opensTasks={(day) => read.tasks.some((task) => task.date === day && !isHiddenTask(task))}
        onTasks={onTasks}
        onOpen={onOpen}
        onSlot={onSlot}
        scroll={scroll}
        pager={{
          before: [3, 2, 1].map((n) => addDays(days[0], -n)),
          after: [1, 2, 3].map((n) => addDays(days[days.length - 1], n)),
          style: swipe.style,
        }}
      />
    </section>
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
