'use client';

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { addDays, isHiddenTask, type CalendarEntry, type CalendarRead } from '@/lib/calendar';
import { segmentOn, tasksPerDay } from '@/lib/calendar-layout';
import type { Slot } from '@/lib/calendar-form';
import { cn } from '@/lib/cn';
import type { AgendaPerson } from './agenda';
import { useCalendarTasks, type TaskPerson } from './calendar-tasks';
import { TimeGrid, type GridItem, type GridPlaced, type ScrollGroup } from './time-grid';

/** How far a finger must travel, at least, for a swipe to page (a fifth of the width when that is more). */
const SWIPE_MIN_PX = 50;

/**
 * **3 Hari** (UI V1, 2026-10-30, UI-104 point 5; P19.1-T3, UI-117 and UI-144): three day columns starting with the day
 * asked for — today when it opens — drawn by **the one time grid Week draws** (`TimeGrid`): the hours *07.00*, opened an
 * hour before now, the *Tugas* row's blue counts, today shaded on a phone and circled from 768px.
 *
 * - **The page's one toolbar** (UI-117, UI-144): no range, arrows or second *3 Hari ⌄* inside the grid any more — the
 *   toolbar above is the same in every view.
 * - **Paged like Outlook mobile**: a horizontal swipe moves exactly three days and snaps — it never stops between days
 *   (`usePagedSwipe`); ‹ › do the same; *Hari ini* returns to today and the two days after it. The days either side are
 *   drawn as the finger moves, their heads named, their grid empty until the read for them arrives.
 * - **On a phone it is full-bleed** (UI-104 point 5, kept): no side padding, no card or border, the page scrolling under
 *   the pinned heads and *Tugas* row and the grid running to the bottom edge behind the floating tab bar. **From 768px**
 *   it is a card with its own scroll box, as Week is.
 * - **Compared people** (point 9): their timed things in the same columns, each with the person's small avatar, their
 *   tasks in the count and the popup.
 */
export function ThreeDays({
  read,
  others = [],
  nowMinute,
  phone,
  regionLabel,
  scroll,
  onStep,
  onOpen,
  onSlot,
  onTasks,
}: {
  read: CalendarRead;
  others?: readonly AgendaPerson[];
  nowMinute: number | null;
  /** Below 768px: full-bleed, the page scrolling; wider, a card with a scroll box of its own. */
  phone: boolean;
  regionLabel: string;
  scroll: ScrollGroup;
  /** Three days back (`-1`) or on (`1`): a swipe, as ‹ › are. */
  onStep: (direction: -1 | 1) => void;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
  onTasks: (day: string) => void;
}) {
  const { struck } = useCalendarTasks();
  const days = read.days.map((d) => d.date);
  const swipe = usePagedSwipe(read.from, onStep);

  const people: { who: TaskPerson | null; read: CalendarRead }[] = [
    { who: null, read },
    ...others.filter((o): o is AgendaPerson & { read: CalendarRead } => o.read !== null).map((o) => ({ who: o.person, read: o.read })),
  ];
  const trips = people.flatMap(({ read: r }) => r.entries.filter((item) => item.allDay));
  const counts = tasksPerDay(people.flatMap(({ read: r }) => r.tasks.filter((task) => isHiddenTask(task) || !struck.has(task.taskId))));
  const placedOn = (day: string): GridPlaced[] => people.flatMap(({ who, read: r }) => [...r.entries, ...r.events]
    .map((item) => segmentOn(item, day))
    .filter((item): item is GridItem => item !== null)
    .map((item) => ({ item, who })));

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
      <TimeGrid
        days={days}
        today={read.today}
        nowMinute={nowMinute}
        regionLabel={regionLabel}
        mode={phone ? 'page' : 'box'}
        placedOn={placedOn}
        trips={trips}
        counts={counts}
        opensTasks={(day) => people.some(({ read: r }) => r.tasks.some((task) => task.date === day && !isHiddenTask(task)))}
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
    </div>
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
