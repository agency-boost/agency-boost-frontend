'use client';

import type { ReactNode } from 'react';
import { tasksPerDay, timedOn } from '@/lib/calendar-layout';
import { isHiddenTask, type CalendarEntry, type CalendarRead } from '@/lib/calendar';
import type { Slot } from '@/lib/calendar-form';
import { cn } from '@/lib/cn';
import { PaneHeadBar, type PaneHead } from './calendar-parts';
import { doneTasks, openTasks, useCalendarTasks } from './calendar-tasks';
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
 * **A phone's week fits its seven days** (P19.1-T3 AC-4; UI-144, *Conflicts* row 155): *Sen* to *Min* in view with
 * nothing to scroll sideways — where it was 52px of hours and seven 48px columns scrolling inside the pane (D-phone;
 * P12-T2 AC-13). An entry there shows its title on one line, cut with an ellipsis (P19.11-T1 AC-6; UX-6), and opens its
 * details.
 *
 * *Changed 2026-11-07 (P19.8-T3; MOB UI-172, UI-174, UI-175):* **no person row on the reader's own calendar** — the head
 * is drawn only where somebody is compared (`head`), as 3 Hari draws it; **on a phone it opens with 07.00 at its top**
 * (`phone`) and, the reader's own alone, **runs the screen's full width to its foot** (`fill`): a 46px gutter and seven
 * ~45px columns at 360px.
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
  phone = false,
  fill = false,
  className,
}: {
  read: CalendarRead;
  /** The person row above the grid: only where somebody is compared (MOB UI-175). */
  head?: PaneHead;
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
  /** Below 768px: the grid opens at 07.00 (MOB UI-172). */
  phone?: boolean;
  /** The reader's own week alone on a phone: the grid runs to the foot of the screen, the page still. */
  fill?: boolean;
  className?: string;
}) {
  const { isDone } = useCalendarTasks();
  const days = read.days.map((d) => d.date);
  // *Tugas* by day, the open ones (P19.11-T1 AC-2): a tick, loaded or tapped, taken off; a hidden person's are counts only.
  const counts = tasksPerDay(openTasks(read.tasks, isDone));
  // A day with every task ticked keeps a muted ✓ that opens them (P19.11-T1 AC-1).
  const done = tasksPerDay(doneTasks(read.tasks, isDone));
  const hiddenTasks = read.tasks.some(isHiddenTask);
  const timed: GridItem[] = [...read.entries, ...read.events];

  return (
    <section aria-label={head?.name} data-week-pane="" className={cn('flex min-w-0 flex-1 flex-col bg-card', className)}>
      {head && <PaneHeadBar head={head} pill={pill} />}
      <TimeGrid
        days={days}
        today={read.today}
        nowMinute={nowMinute}
        regionLabel={regionLabel}
        morning={phone}
        fill={fill}
        placedOn={(day) => timedOn(timed, day).map((item) => ({ item, who: null }))}
        trips={read.entries.filter((item) => item.allDay)}
        counts={counts}
        done={done}
        opensTasks={() => !hiddenTasks}
        onTasks={onTasks}
        onOpen={onOpen}
        onSlot={onSlot}
        gutter={hoursWhenStacked ? 'stacked' : 'always'}
        scroll={scroll}
        // Below 768px only (`max-md:`): ~45px a day, so each title is one line with an ellipsis (P19.11-T1 AC-6).
        blocks="narrow"
      />
    </section>
  );
}

/** The pane's frame while its read is on its way: the grid's shape, nothing in it (L-01, a Fill). */
export function WeekSkeleton({ columns = 7, head = true }: { columns?: number; head?: boolean }) {
  return <TimeGridSkeleton columns={columns} head={head} />;
}
