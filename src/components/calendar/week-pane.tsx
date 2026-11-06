'use client';

import type { ReactNode } from 'react';
import { tasksPerDay, timedOn } from '@/lib/calendar-layout';
import { isHiddenTask, type CalendarEntry, type CalendarRead } from '@/lib/calendar';
import type { Slot } from '@/lib/calendar-form';
import { cn } from '@/lib/cn';
import { PaneHeadBar, type PaneHead } from './calendar-parts';
import { useCalendarTasks } from './calendar-tasks';
import { TimeGrid, TimeGridSkeleton, type GridItem, type ScrollGroup } from './time-grid';

export type { PaneHead } from './calendar-parts';
export type { ScrollGroup } from './time-grid';
export { EntryBlock } from './time-grid';

/**
 * One person's week (`Calendar_Section.html:317-344`, `:564-679`): the pane head, then **the one time grid**
 * (`TimeGrid`; P19.1-T3 AC-4, UI-117) in its own scroll box — the day heads, the Trip row, the *Tugas* row and the 24
 * hours, opened an hour before now (07.00 on another week).
 *
 * **The reader's own pane, and a compared one, are this one component.** What differs is passed in:
 * whether a slot on it creates (`onSlot`), the pill, and whether the hours are drawn — always on the
 * reader's, and on a compared pane only once the panes stack below 980px, so that every stacked pane
 * can be read on its own (`hoursWhenStacked`; contradiction 8, D-phone).
 *
 * **A phone's week fits its seven days** (P19.1-T3 AC-4; UI-144, *Conflicts* row 155): a 36px gutter and seven columns
 * of ~41px at 360px, *Sen* to *Min* in view with nothing to scroll sideways — where it was 52px of hours and seven
 * 48px columns scrolling inside the pane (D-phone; P12-T2 AC-13). An entry there is its colour, which opens its details.
 */
export function WeekPane({
  read,
  head,
  pill,
  regionLabel,
  hoursWhenStacked = false,
  nowMinute,
  onOpen,
  onSlot,
  onTasks,
  scroll,
  className,
}: {
  read: CalendarRead;
  head: PaneHead;
  pill?: ReactNode;
  regionLabel: string;
  /** A compared pane: hours only when stacked. */
  hoursWhenStacked?: boolean;
  /** The office's minute of today, from the read, moved each minute; `null` while unknown. */
  nowMinute: number | null;
  onOpen: (entry: CalendarEntry) => void;
  /** A drag or a tap on an empty slot. Absent, the grid takes none. */
  onSlot?: (slot: Slot) => void;
  /** A day's *Tugas* count pill (UI-104 point 3): its popup. Absent — a hidden person — the counts open nothing. */
  onTasks?: (day: string) => void;
  scroll: ScrollGroup;
  className?: string;
}) {
  const { struck } = useCalendarTasks();
  const days = read.days.map((d) => d.date);
  // *Tugas* by day, a tick in this visit taken off at once (UI-104 point 4); a hidden person's are counts only.
  const counts = tasksPerDay(read.tasks.filter((task) => isHiddenTask(task) || !struck.has(task.taskId)));
  const hiddenTasks = read.tasks.some(isHiddenTask);
  const timed: GridItem[] = [...read.entries, ...read.events];

  return (
    <section aria-label={head.name} className={cn('flex min-w-0 flex-1 flex-col bg-card', className)}>
      <PaneHeadBar head={head} pill={pill} />
      <TimeGrid
        days={days}
        today={read.today}
        nowMinute={nowMinute}
        regionLabel={regionLabel}
        mode="box"
        placedOn={(day) => timedOn(timed, day).map((item) => ({ item, who: null }))}
        trips={read.entries.filter((item) => item.allDay)}
        counts={counts}
        opensTasks={() => !hiddenTasks}
        onTasks={onTasks}
        onOpen={onOpen}
        onSlot={onSlot}
        gutter={hoursWhenStacked ? 'stacked' : 'always'}
        scroll={scroll}
        // Below 768px only (`max-md:`): 41px holds no title, so the block is its colour and its name.
        blocks="colour"
      />
    </section>
  );
}

/** The pane's frame while its read is on its way: the grid's shape, nothing in it (L-01, a Fill). */
export function WeekSkeleton({ columns = 7 }: { columns?: number }) {
  return <TimeGridSkeleton columns={columns} />;
}
