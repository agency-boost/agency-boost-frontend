'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  allDayHeight, BAR_GAP_PX, BAR_PX, DAY_PX, HOUR_PX, layoutDay, OPEN_AT_HOUR, showsTime, slotFromSelection, stackBars,
  timedOn,
} from '@/lib/calendar-layout';
import {
  entryNameSuffix, isBusy, OWN_COPY, titleOf, TYPE_LABEL, type CalendarEntry, type CalendarItem, type CalendarRead,
} from '@/lib/calendar';
import type { Slot } from '@/lib/calendar-form';
import { formatDayHeader, formatHour, formatTimeSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ENTRY_TONE, PaneHeadBar, type PaneHead } from './calendar-parts';

/** The scroll boxes of every pane on the page, moved as one (`syncScroll`, `:1001-1005`). */
export interface ScrollGroup {
  register: (el: HTMLElement) => () => void;
  sync: (source: HTMLElement) => void;
}

export type { PaneHead } from './calendar-parts';

/**
 * The hour lines, every 56px (`.day-col`, `:131`), drawn in the hairline token rather than in boxes.
 * A custom property, not a value: the colour stays the design system's.
 */
const HOUR_LINES = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX}px)`;

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * **Below 768px a pane scrolls sideways inside itself** above a minimum day-column width, and the page
 * never does (D-phone; P12-T2 AC-13): 52px of hours and seven columns of 48px. Wider, the columns
 * share the pane as the prototype's do.
 */
const PHONE_MIN_WIDTH = 'max-md:min-w-[388px]';

/**
 * One person's week (`Calendar_Section.html:317-344`, `:564-679`): the pane head, the day headers, the
 * all-day row and the 24-hour grid, opened scrolled to 7 AM.
 *
 * **The reader's own pane, and a compared one, are this one component.** What differs is passed in:
 * whether a slot on it creates (`onSlot`), the pill, and whether the hours are drawn — always on the
 * reader's, and on a compared pane only once the panes stack below 980px, so that every stacked pane
 * can be read on its own (`hoursWhenStacked`; contradiction 8, D-phone).
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
  scroll: ScrollGroup;
  className?: string;
}) {
  const days = read.days.map((d) => d.date);
  const box = useRef<HTMLDivElement>(null);
  const hours = hoursWhenStacked ? 'hidden max-[979.98px]:block' : 'block';

  // Opened at 7 AM, and one of the group from then on.
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    el.scrollTop = OPEN_AT_HOUR * HOUR_PX;
    return scroll.register(el);
  }, [scroll]);

  const allDay = read.entries.filter((item) => item.allDay);
  const { bars, lanes } = stackBars(allDay, days);

  return (
    <section aria-label={head.name} className={cn('flex min-w-0 flex-1 flex-col bg-card', className)}>
      <PaneHeadBar head={head} pill={pill} />

      <div className="overflow-x-auto">
        <div className={PHONE_MIN_WIDTH}>
          <div className="flex">
            <div aria-hidden="true" className={cn('w-[52px] shrink-0 border-r border-hairline', hours)} />
            {days.map((day) => {
              const { weekday, number } = formatDayHeader(day);
              const today = day === read.today;
              return (
                <div
                  key={day}
                  className={cn(
                    'flex-1 border-r border-hairline px-0.5 py-2 text-center text-sm font-semibold text-muted last:border-r-0',
                    today && 'bg-amber/[0.08]',
                  )}
                >
                  {weekday}
                  <span className={cn('mt-0.5 block font-display text-md font-bold', today ? 'text-amber-ink' : 'text-navy')}>
                    {number}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex border-b border-hairline" style={{ minHeight: allDayHeight(lanes) }}>
            <div aria-hidden="true" className={cn('w-[52px] shrink-0 border-r border-hairline', hours)} />
            <div className="relative flex flex-1">
              {days.map((day) => (
                <div
                  key={day}
                  className={cn('flex-1 border-r border-hairline last:border-r-0', day === read.today && 'bg-amber/[0.08]')}
                />
              ))}
              {bars.map(({ item, first, last, lane }) => (
                <AllDayBar
                  key={isBusy(item) ? `busy-${item.startsAt}-${lane}` : item.entryId}
                  item={item}
                  style={{
                    left: `calc(${(first / days.length) * 100}% + 2px)`,
                    width: `calc(${((last - first + 1) / days.length) * 100}% - 4px)`,
                    top: BAR_GAP_PX + lane * (BAR_PX + BAR_GAP_PX),
                    height: BAR_PX,
                  }}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>

          <div
            ref={box}
            role="region"
            aria-label={regionLabel}
            tabIndex={0}
            onScroll={(e) => scroll.sync(e.currentTarget)}
            className="relative max-h-[620px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="relative flex" style={{ height: DAY_PX }}>
              <div aria-hidden="true" className={cn('w-[52px] shrink-0 border-r border-hairline', hours)}>
                {HOURS.map((h) => (
                  <div key={h} className="-translate-y-1.5 pr-[7px] text-right text-2xs text-muted" style={{ height: HOUR_PX }}>
                    {formatHour(h)}
                  </div>
                ))}
              </div>
              <div className="relative flex flex-1">
                {days.map((day, i) => (
                  <DayColumn
                    key={day}
                    day={day}
                    weekend={i >= 5}
                    today={day === read.today}
                    items={timedOn(read.entries, day)}
                    nowMinute={day === read.today ? nowMinute : null}
                    onOpen={onOpen}
                    onSlot={onSlot}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A travel bar, or a compared member's all-day busy block. **A trip is a button that opens its
 * detail** (contradiction 6: the prototype's bar had no handler, `:576`); a busy block opens nothing.
 */
function AllDayBar({ item, style, onOpen }: { item: CalendarItem; style: React.CSSProperties; onOpen: (e: CalendarEntry) => void }) {
  const shape = 'absolute flex items-center overflow-hidden whitespace-nowrap rounded-[6px] border px-2 text-2xs font-bold';
  if (isBusy(item)) {
    return (
      <div data-busy="" style={style} className={cn(shape, 'border-hairline bg-navy/[0.06] text-navy')}>
        <span className="truncate">{OWN_COPY.busy}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-entry=""
      style={style}
      aria-label={`${TYPE_LABEL[item.type]}: ${titleOf(item)}${entryNameSuffix(item)}`}
      onClick={() => onOpen(item)}
      className={cn(shape, 'border-teal/30 bg-teal/[0.14] text-left text-teal-ink hover:brightness-[0.96]')}
    >
      <span className="truncate">{titleOf(item)}</span>
    </button>
  );
}

/** Where a drag started, and how far it has gone, in pixels down the column. */
interface Selection {
  start: number;
  top: number;
  height: number;
}

/**
 * One day of the grid. **A slot is taken by pointer events** (H-18): a drag with a mouse or a pen
 * snaps to a quarter hour, and a click or a tap is the prototype's half hour (`:623-664`). On a touch
 * screen a drag scrolls, as a page should, and the browser's `pointercancel` drops the selection: there
 * is no long-press drag. The keyboard's way in is *+ New event*.
 *
 * **A press on what is already there takes no slot**: an entry opens its detail, and a busy block opens
 * nothing at all (F3) — it is time taken, so *Block time* is not offered on it.
 */
function DayColumn({
  day,
  weekend,
  today,
  items,
  nowMinute,
  onOpen,
  onSlot,
}: {
  day: string;
  weekend: boolean;
  today: boolean;
  items: CalendarItem[];
  nowMinute: number | null;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const drag = useRef<Selection | null>(null);

  const at = (e: React.PointerEvent<HTMLDivElement>) =>
    Math.min(Math.max(e.clientY - e.currentTarget.getBoundingClientRect().top, 0), DAY_PX);

  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSlot || (e.target as HTMLElement).closest('[data-entry], [data-busy]')) return;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      e.preventDefault();
    }
    const y = at(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { start: y, top: y, height: 4 };
    setSelection(drag.current);
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const y = at(e);
    drag.current = { ...drag.current, top: Math.min(drag.current.start, y), height: Math.max(4, Math.abs(y - drag.current.start)) };
    setSelection(drag.current);
  };

  const finish = () => {
    const done = drag.current;
    drag.current = null;
    setSelection(null);
    if (done && onSlot) onSlot({ date: day, ...slotFromSelection(done.top, done.height) });
  };

  const cancel = () => {
    drag.current = null;
    setSelection(null);
  };

  return (
    <div
      role="group"
      aria-label={formatWeekdayDay(day)}
      data-day={day}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={cancel}
      style={{ height: DAY_PX, backgroundImage: HOUR_LINES }}
      className={cn(
        'relative flex-1 border-r border-hairline last:border-r-0',
        onSlot && 'cursor-crosshair',
        weekend && 'bg-navy/[0.015]',
        today && 'bg-amber/[0.08]',
      )}
    >
      {layoutDay(items).map(({ item, top, height, lane, lanes }) => (
        <EntryBlock
          key={isBusy(item) ? `busy-${item.startsAt}-${lane}` : item.entryId}
          item={item}
          style={{
            top,
            height,
            left: `calc(${(lane / lanes) * 100}% + 3px)`,
            width: `calc(${100 / lanes}% - 6px)`,
          }}
          withTime={showsTime(height)}
          onOpen={onOpen}
        />
      ))}
      {nowMinute !== null && (
        <div
          aria-hidden="true"
          data-now=""
          className="pointer-events-none absolute inset-x-0 z-[5] border-t-[1.6px] border-alert"
          style={{ top: (nowMinute / 60) * HOUR_PX }}
        >
          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-alert" />
        </div>
      )}
      {selection && (
        <div
          aria-hidden="true"
          data-selection=""
          className="pointer-events-none absolute inset-x-[3px] z-[8] rounded-[5px] bg-info ring-1 ring-inset ring-white/70"
          style={{ top: selection.top, height: selection.height }}
        />
      )}
    </div>
  );
}

/**
 * An entry on the grid: its title and its time, `09.00–09.30` (`:611`). **A button**, named by its
 * type, title and time, so colour is never the only thing that says what it is (H-18; P12-T2 AC-11).
 * A compared member's busy block reads *Busy* and its time, and opens nothing.
 *
 * **Its words start at the top, as the prototype's `.event` does** (`:136-138`; P13.1-T8 AC-1): a button
 * centres what it holds, so this one lays its lines out as a column from its top edge. **The title is one
 * line**, cut with an ellipsis when it runs long, and **the time is drawn under it only where both lines
 * fit whole** (`withTime`, `showsTime`) — a 30-minute entry draws its title alone rather than half
 * a time. Nothing cut or left out is lost: the name holds the whole title and the time, and so does the
 * title's tooltip, for a pointer.
 */
function EntryBlock({
  item, style, withTime, onOpen,
}: { item: CalendarItem; style: React.CSSProperties; withTime: boolean; onOpen: (e: CalendarEntry) => void }) {
  const time = formatTimeSpan(item.start ?? '', item.end ?? '');
  const shape = 'absolute flex flex-col justify-start overflow-hidden rounded-[6px] border-l-[3px] px-1.5 py-1 text-left text-xs leading-tight text-navy';
  // `shrink-0`: a line in a column that is too short keeps its height and is never squeezed into itself.
  const line = 'block w-full shrink-0 truncate';
  const timeLine = cn(line, 'text-2xs leading-tight');
  if (isBusy(item)) {
    return (
      <div data-busy="" style={style} className={cn(shape, 'cursor-default border-muted bg-navy/[0.06]')}>
        <span title={`${OWN_COPY.busy}, ${time}`} className={cn(line, 'font-bold')}>{OWN_COPY.busy}</span>
        <span className="sr-only">, </span>
        <span className={withTime ? timeLine : 'sr-only'}>{time}</span>
      </div>
    );
  }
  // Named in one string — *{badge}: {title}, {time}* and what the reader owes it — which holds the words
  // drawn on it, so a voice user can say what they see (WCAG 2.5.3).
  return (
    <button
      type="button"
      data-entry=""
      style={style}
      aria-label={`${TYPE_LABEL[item.type]}: ${titleOf(item)}, ${time}${entryNameSuffix(item)}`}
      onClick={() => onOpen(item)}
      className={cn(shape, 'z-[1] hover:brightness-[0.96]', ENTRY_TONE[item.type])}
    >
      <span title={`${titleOf(item)}, ${time}`} className={cn(line, 'font-bold')}>{titleOf(item)}</span>
      {withTime && <span className={timeLine}>{time}</span>}
    </button>
  );
}

/** The pane's frame while its read is on its way: the grid's shape, nothing in it (L-01, a Fill). */
export function WeekSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="flex items-center gap-[9px] border-b border-hairline bg-base px-3.5 py-[11px]">
        <span className="h-[26px] w-[26px] rounded-full bg-hairline" />
        <span className="h-3 w-32 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
      </div>
      <div className="flex border-b border-hairline">
        <div className="w-[52px] shrink-0 border-r border-hairline" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5 border-r border-hairline py-2 last:border-r-0">
            <span className="h-2.5 w-6 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
            <span className="h-3 w-4 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="flex h-[392px]" style={{ backgroundImage: HOUR_LINES }}>
        <div className="w-[52px] shrink-0 border-r border-hairline" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex-1 border-r border-hairline last:border-r-0" />
        ))}
      </div>
    </div>
  );
}
