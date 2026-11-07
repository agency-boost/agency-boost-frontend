'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import {
  entryName, hhmm, isBusy, titleOf, type CalendarEntry, type CalendarItem, type CalendarJoinedItem,
} from '@/lib/calendar';
import {
  allDayHeight, BAR_GAP_PX, BAR_PX, DAY_PX, HOUR_PX, isWeekend, layoutDay, OPEN_AT_HOUR, openingHour, showsTime,
  slotFromSelection, stackBars,
} from '@/lib/calendar-layout';
import type { Slot } from '@/lib/calendar-form';
import { formatDayHeader, formatHour, formatTimeSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ENTRY_TONE } from './calendar-parts';
import { CountPill, EVENT_TONE, type TaskPerson } from './calendar-tasks';

/** Anything on a day column: an entry, a busy block, or an event joined (UI-104 point 1). */
export type GridItem = CalendarItem | CalendarJoinedItem;
const isJoined = (item: GridItem): item is Extract<CalendarJoinedItem, { eventId: string }> => 'eventId' in item;

/** A timed thing on a column, and whose it is: `null` the reader's own, else a compared person (3 Hari's avatar). */
export interface GridPlaced {
  item: GridItem;
  who: TaskPerson | null;
}

/** The scroll boxes of every pane on the page, moved as one (`syncScroll`, `:1001-1005`). */
export interface ScrollGroup {
  register: (el: HTMLElement) => () => void;
  sync: (source: HTMLElement) => void;
}

/**
 * The days either side of 3 Hari's, drawn as a finger moves (`usePagedSwipe`, `three-days.tsx`): their heads named, their
 * grid empty until the read for them arrives. `style` slides the strip.
 */
export interface Pager {
  before: readonly string[];
  after: readonly string[];
  style: CSSProperties;
}

/**
 * **The hour gutter** (P19.1-T3 AC-4; UI-144): 56px from 768px, as `calendar-tablet-desktop` draws it.
 *
 * *Changed 2026-11-07 (P19.8-T3 AC-4; MOB UI-174):* **46px on a phone**, where it was 36px: *Tugas* and the hours
 * right-aligned 4px from the line, clear of the screen's edge. Week still fits its seven days at 360px — the grid runs
 * the screen's full width there, so 46px of hours and 7 × ~45px.
 */
export const GUTTER = 'w-[46px] md:w-14';

/** **Today on a phone**: the whole column shaded (UI-154; OD-252) — its head, its *Tugas* cell and every hour. */
export const TODAY_SHADE = 'max-md:bg-today';
/** **Today's date**: today's ink on the shade on a phone, the amber circle from 768px (UI-117; OD-252). */
export const TODAY_DATE = 'max-md:text-today-ink md:bg-primary md:text-primary-contrast';

/**
 * **The least a grid that fills the screen is** (P19.8-T3 AC-2): five hours, so a short screen — a phone on its side —
 * still shows a working stretch of the day and lets the page scroll for the rest.
 */
const FILL_MIN_PX = 5 * HOUR_PX;

/** The hour lines, every hour, in the hairline token rather than in boxes — the colour stays the design system's. */
const HOUR_LINES = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX}px)`;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * **The one time grid** (P19.1-T3 AC-4; UI-117, UI-144): 3 Hari and Week draw this, at every size, so the two read the
 * same — the hours *07.00*, **top-aligned in their row** and never under the *Tugas* row; the day heads and the *Tugas*
 * row held in view above the grid's own scroll box, moved with the compared panes' (`scroll`); **opened an hour before
 * now**, or at 07.00 on other days (`openingHour`); the now-line in orange. **Today** is the column shaded on a phone and
 * the amber circle from 768px (UI-154, OD-252) — its head, its *Tugas* cell and every hour, one unbroken stripe (MOB
 * UI-173); a *Tugas* count is the blue pill (UI-154; *Decisions* 6).
 *
 * *Changed 2026-11-07 (P19.8-T3 AC-2; MOB UI-172, the brief's Calendar 1):* **always a scroll box of its own** — the
 * phone's 3 Hari no longer scrolls the page (it jumped 632px on open, the title and the toolbar gone). **On a phone the
 * box opens with 07.00 at its top** (`morning`), whatever the hour, 00.00–07.00 above it for a swipe down; and where it
 * is the reader's own calendar alone it **runs to the foot of the screen** behind the tab bar (`fill`), so the page itself
 * never scrolls and the title, the toolbar, the range, the day heads and the *Tugas* row stay put. From 768px it opens an
 * hour before now in a box of at most 620px, as before.
 *
 * What differs between the views is passed in, never re-drawn: how a slot is taken — a drag on a column, or a tap where a
 * horizontal finger turns 3 Hari's page (`slotBy`, `pager`). A compared pane side by side draws no gutter (`gutter:
 * 'stacked'`, contradiction 8). On a phone's Week the blocks are their colour alone (`blocks: 'colour'`, below 768px
 * only) — ~45px holds no title — and still open their details, named in full.
 */
export function TimeGrid({
  days,
  today,
  nowMinute,
  regionLabel,
  morning = false,
  fill = false,
  slotBy = 'drag',
  placedOn,
  trips,
  counts,
  opensTasks,
  onTasks,
  onOpen,
  onSlot,
  gutter = 'always',
  scroll,
  pager,
  blocks = 'words',
}: {
  days: readonly string[];
  today: string;
  /** The office's minute of today, from the read, moved each minute; `null` while unknown. */
  nowMinute: number | null;
  regionLabel: string;
  /** A phone (P19.8-T3 AC-2; MOB UI-172): the box opens with 07.00 at its top, whatever the hour. */
  morning?: boolean;
  /** The reader's own calendar alone on a phone: the box runs to the foot of the screen, and the page never scrolls. */
  fill?: boolean;
  /** How an empty slot is taken: a drag (a click is half an hour), or a tap — where a horizontal finger turns the page. */
  slotBy?: 'drag' | 'tap';
  placedOn: (day: string) => GridPlaced[];
  /** The all-day trips in view: the Trip row, drawn only when one falls in these days (UI-104 point 8). */
  trips: readonly CalendarItem[];
  counts: ReadonlyMap<string, number>;
  /** Whether a day's count opens its popup — a hidden person's opens nothing. */
  opensTasks: (day: string) => boolean;
  onTasks?: (day: string) => void;
  onOpen: (entry: CalendarEntry) => void;
  /** A drag or a tap on an empty slot (`slotBy`). Absent, the grid takes none. */
  onSlot?: (slot: Slot) => void;
  gutter?: 'always' | 'stacked';
  scroll?: ScrollGroup;
  pager?: Pager;
  blocks?: 'words' | 'colour';
}) {
  const t = useMessages(calendarMessages);
  const language = useFigureLanguage();
  const box = useRef<HTMLDivElement>(null);
  const shown = gutter === 'always' ? 'block' : 'hidden max-[979.98px]:block';
  const shownFlex = gutter === 'always' ? 'flex' : 'hidden max-[979.98px]:flex';
  const { bars, lanes } = stackBars(trips, days);
  const opening = morning ? OPEN_AT_HOUR : openingHour(days, today, nowMinute);
  useFillToFoot(box, fill);

  // Opened at its hour — 07.00 on a phone; from 768px an hour before now, or 07.00 on days that are not today's — and one
  // of the group from then on. The page is never scrolled (MOB UI-172).
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    el.scrollTop = opening * HOUR_PX;
    return scroll?.register(el);
    // Once, as the view opens: a page turned keeps the hour the reader scrolled to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroll]);

  /** A row's day cells: these days, or — paged — the strip of the days before, these, and the days after. */
  const lane = (cell: (day: string, current: boolean) => ReactNode, className?: string) => (pager ? (
    <div className="min-w-0 flex-1 overflow-hidden">
      <div className="flex w-[300%]" style={pager.style}>
        {[pager.before, days, pager.after].map((list, i) => (
          <div key={i} className={cn('flex w-1/3', className)}>{list.map((day) => cell(day, i === 1))}</div>
        ))}
      </div>
    </div>
  ) : <div className={cn('flex min-w-0 flex-1', className)}>{days.map((day) => cell(day, true))}</div>);

  const heads = (
    <div data-grid-head="" className="border-b border-hairline bg-card">
      <div className="flex">
        <div aria-hidden="true" className={cn(GUTTER, 'shrink-0 border-r border-hairline', shown)} />
        {lane((day, current) => <DayHead key={day} day={day} today={day === today} current={current} />)}
      </div>

      {/* **The Trip row** (UI-104 point 8): only when a trip falls in the visible days; a bar with the plane line icon. */}
      {bars.length > 0 && (
        <div data-trip-row="" className="flex border-t border-hairline" style={{ minHeight: allDayHeight(lanes) }}>
          <div className={cn(GUTTER, 'shrink-0 items-center justify-center border-r border-hairline text-signal-grey', shownFlex)}>
            <LineIcon name="plane" className="h-4 w-4" />
            <span className="sr-only">{t.types.travel}</span>
          </div>
          <div className="relative flex min-w-0 flex-1">
            {days.map((day) => (
              <div key={day} className={cn('flex-1 border-r border-hairline last:border-r-0', day === today && TODAY_SHADE)} />
            ))}
            {bars.map(({ item, first, last, lane: row }) => (
              <AllDayBar
                key={isBusy(item) ? `busy-${item.startsAt}-${row}` : item.entryId}
                item={item}
                style={{
                  left: `calc(${(first / days.length) * 100}% + 2px)`,
                  width: `calc(${((last - first + 1) / days.length) * 100}% - 4px)`,
                  top: BAR_GAP_PX + row * (BAR_PX + BAR_GAP_PX),
                  height: BAR_PX,
                }}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      )}

      {/* **The Tugas row** (UI-104 point 2; UI-154): one thin row above the hours, a blue count per day, *·* when none. */}
      <div data-task-row="" className="flex h-11 border-t border-hairline lg:h-8">
        <div
          className={cn(
            GUTTER,
            // *Tugas* in a phone's 46px gutter, right-aligned 4px from the line and clear of the edge (MOB UI-174).
            'shrink-0 items-center justify-end whitespace-nowrap border-r border-hairline pr-1 text-xs font-semibold text-signal-grey md:justify-center md:pr-0',
            shownFlex,
          )}
        >
          {t.tasks}
        </div>
        {lane((day, current) => (
          <div key={day} className={cn('grid min-w-0 flex-1 place-items-center border-r border-hairline last:border-r-0', day === today && TODAY_SHADE)}>
            {current ? (
              <CountPill day={day} count={counts.get(day) ?? 0} onOpen={onTasks && opensTasks(day) ? () => onTasks(day) : undefined} />
            ) : <span aria-hidden="true" className="text-md font-bold text-line">·</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const hours = (
    <div aria-hidden="true" className={cn(GUTTER, 'shrink-0 border-r border-hairline', shown)} style={{ backgroundImage: HOUR_LINES }}>
      {HOURS.map((h) => (
        // Top-aligned in its own hour, under its line, so no label is ever cut by the row above it (UI-117).
        <div
          key={h}
          className="pr-1 pt-0.5 text-right text-xs leading-tight text-muted md:pr-2"
          style={{ height: HOUR_PX }}
        >
          {formatHour(h, language)}
        </div>
      ))}
    </div>
  );

  const column = (day: string, current: boolean) => (current ? (
    <DayColumn
      key={day}
      day={day}
      today={day === today}
      items={placedOn(day)}
      nowMinute={day === today ? nowMinute : null}
      onOpen={onOpen}
      onSlot={onSlot}
      slotBy={slotBy}
      blocks={blocks}
    />
  ) : <div key={day} className="flex-1 border-r border-hairline" style={{ height: DAY_PX, backgroundImage: HOUR_LINES }} />);

  return (
    <>
      {heads}
      <div
        ref={box}
        role="region"
        aria-label={regionLabel}
        tabIndex={0}
        data-time-grid="box"
        data-fill={fill || undefined}
        onScroll={(e) => scroll?.sync(e.currentTarget)}
        className={cn(
          'relative overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          !fill && 'max-h-[620px]',
        )}
      >
        <div className="relative flex" style={{ height: DAY_PX }}>
          {hours}
          {lane(column)}
        </div>
        {/* Filling the screen, its last hours scroll clear of the floating tab bar. */}
        {fill && <div aria-hidden="true" className="h-[var(--tab-bar-space)]" />}
      </div>
    </>
  );
}

/**
 * **A box that runs to the foot of the screen** (P19.8-T3 AC-2; MOB UI-172): its height the window's less where it
 * starts on the page, so the page holds exactly one screen and never scrolls — the box does. Measured again on every
 * render (a *Filter* panel opened above it moves it down), on a resize, and when the page above it changes size (a
 * banner arriving). Off, the box keeps the height its class gives it.
 */
function useFillToFoot(ref: RefObject<HTMLDivElement | null>, on: boolean) {
  const size = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = on
      ? `${Math.max(FILL_MIN_PX, Math.round(window.innerHeight - (el.getBoundingClientRect().top + (window.scrollY || 0))))}px`
      : '';
    if (el.style.height !== next) el.style.height = next;
  }, [ref, on]);
  // Every render: something above it may have moved it.
  useLayoutEffect(() => size());
  useEffect(() => {
    if (!on) return undefined;
    window.addEventListener('resize', size);
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => size());
    watch?.observe(document.body);
    return () => {
      window.removeEventListener('resize', size);
      watch?.disconnect();
    };
  }, [on, size]);
}

/**
 * A day's head: its weekday over its number — `28`, or `1 Okt` on the first of a month (`Calendar_Section.html:327-333`).
 * **Today** carries today's ink on its shade on a phone and the amber circle from 768px, never both (OD-252).
 */
function DayHead({ day, today, current }: { day: string; today: boolean; current: boolean }) {
  const language = useFigureLanguage();
  const { weekday, number } = formatDayHeader(day, language);
  return (
    <div
      aria-hidden={!current || undefined}
      className={cn(
        'min-w-0 flex-1 border-r border-hairline px-0.5 py-1.5 text-center text-xs font-semibold leading-tight text-muted last:border-r-0',
        today && TODAY_SHADE,
      )}
    >
      {weekday}
      <span
        aria-current={current && today ? 'date' : undefined}
        className={cn(
          'mx-auto mt-0.5 flex h-7 w-fit min-w-7 items-center justify-center whitespace-nowrap rounded-full px-1 text-md font-bold',
          today ? TODAY_DATE : 'text-navy',
        )}
      >
        {number}
      </span>
    </div>
  );
}

/**
 * A travel bar, or a compared member's all-day busy block. **A trip is a button that opens its
 * detail** (contradiction 6: the prototype's bar had no handler, `:576`); a busy block opens nothing.
 */
function AllDayBar({ item, style, onOpen }: { item: CalendarItem; style: CSSProperties; onOpen: (e: CalendarEntry) => void }) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const shape = 'absolute flex items-center overflow-hidden whitespace-nowrap rounded-[6px] border px-2 text-2xs font-bold';
  if (isBusy(item)) {
    return (
      <div data-busy="" style={style} className={cn(shape, 'border-hairline bg-secondary/[0.06] text-navy')}>
        <span className="truncate">{t.busy}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-entry=""
      style={style}
      aria-label={entryName(item, '', words)}
      onClick={() => onOpen(item)}
      className={cn(shape, 'border-teal/30 bg-teal/[0.14] text-left text-teal-ink hover:brightness-[0.96]')}
    >
      <LineIcon name="plane" className="mr-1 h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{titleOf(item, words)}</span>
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
 * One day of the grid. **A slot is taken by pointer events** in a box (H-18): a drag with a mouse or a pen snaps to a
 * quarter hour, and a click or a tap is the prototype's half hour (`:623-664`); on a touch screen a drag scrolls, as a
 * page should, and `pointercancel` drops the selection. **On a paged grid a tap takes it** (`slotBy: 'tap'`): a
 * horizontal finger there turns the page and must take nothing. The keyboard's way in is *+ New event*.
 *
 * **A press on what is already there takes no slot**: an entry opens its detail, and a busy block opens nothing at all
 * (F3) — it is time taken, so *Block time* is not offered on it.
 */
function DayColumn({
  day, today, items, nowMinute, onOpen, onSlot, slotBy, blocks,
}: {
  day: string;
  today: boolean;
  items: GridPlaced[];
  nowMinute: number | null;
  onOpen: (entry: CalendarEntry) => void;
  onSlot?: (slot: Slot) => void;
  slotBy: 'drag' | 'tap';
  blocks: 'words' | 'colour';
}) {
  const language = useFigureLanguage();
  const [selection, setSelection] = useState<Selection | null>(null);
  const drag = useRef<Selection | null>(null);
  const onThing = (target: EventTarget) => (target as HTMLElement).closest('[data-entry], [data-busy], [data-event]') !== null;

  const at = (e: React.PointerEvent<HTMLDivElement>) =>
    Math.min(Math.max(e.clientY - e.currentTarget.getBoundingClientRect().top, 0), DAY_PX);

  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSlot || onThing(e.target)) return;
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
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSlot || onThing(e.target)) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const start = Math.min(Math.max(Math.floor((y / HOUR_PX) * 2) * 30, 0), 23 * 60 + 30);
    onSlot({ date: day, start: hhmm(start), end: hhmm(start + 30) });
  };

  const placed = items.map((p) => ({ start: p.item.start, end: p.item.end, placed: p }));
  return (
    // A slot on an empty part of the grid is the grid's own convenience; *+ New event* is the keyboard's way in.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      role="group"
      aria-label={formatWeekdayDay(day, language)}
      data-day={day}
      onPointerDown={slotBy === 'drag' ? begin : undefined}
      onPointerMove={slotBy === 'drag' ? move : undefined}
      onPointerUp={slotBy === 'drag' ? finish : undefined}
      onPointerCancel={slotBy === 'drag' ? cancel : undefined}
      onClick={slotBy === 'tap' ? tap : undefined}
      style={{ height: DAY_PX, backgroundImage: HOUR_LINES }}
      className={cn(
        'relative min-w-0 flex-1 border-r border-hairline last:border-r-0',
        onSlot && slotBy === 'drag' && 'cursor-crosshair',
        isWeekend(day) && 'bg-secondary/[0.015]',
        today && TODAY_SHADE,
      )}
    >
      {layoutDay(placed).map(({ item: { placed: { item, who } }, top, height, lane, lanes }, i) => (
        <EntryBlock
          key={`${who?.membershipId ?? 'me'}-${isBusy(item) ? `busy-${item.startsAt}` : isJoined(item) ? `ev-${item.eventId}` : item.entryId}-${i}`}
          item={item}
          style={{
            top,
            height,
            left: `calc(${(lane / lanes) * 100}% + 3px)`,
            width: `calc(${100 / lanes}% - 6px)`,
          }}
          withTime={showsTime(height)}
          colourOnly={blocks === 'colour'}
          onOpen={onOpen}
          chip={who ? <WhoChip initials={who.initials} /> : undefined}
        />
      ))}
      {nowMinute !== null && (
        <div
          aria-hidden="true"
          data-now=""
          className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-primary"
          style={{ top: (nowMinute / 60) * HOUR_PX }}
        >
          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-primary" />
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

/** A compared person's small avatar inside a 3 Hari block (UI-104 point 9). */
function WhoChip({ initials }: { initials: string }) {
  return (
    <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-hover text-2xs font-bold text-secondary-contrast">
      {initials}
    </span>
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
 * title's tooltip, for a pointer. **`colourOnly`** — a phone's Week, 41px a day (UI-144) — draws the block's colour and
 * reads its words, as the 2 Nov mockup draws it.
 */
export function EntryBlock({
  item, style, withTime, onOpen, chip, colourOnly = false,
}: {
  item: GridItem;
  style: CSSProperties;
  withTime: boolean;
  onOpen: (e: CalendarEntry) => void;
  /** Something small inside the block, after its words: 3 Hari's avatar of a compared person (UI-104 point 9). */
  chip?: ReactNode;
  colourOnly?: boolean;
}) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const time = formatTimeSpan(item.start ?? '', item.end ?? '', language);
  const shape = 'absolute flex flex-col justify-start overflow-hidden rounded-[6px] border-l-[3px] px-1.5 py-1 text-left text-xs leading-tight text-navy';
  // `shrink-0`: a line in a column that is too short keeps its height and is never squeezed into itself.
  const line = cn('block w-full shrink-0 truncate', colourOnly && 'max-md:sr-only');
  const timeLine = cn(line, 'text-2xs leading-tight');
  if (isBusy(item)) {
    return (
      <div data-busy="" style={style} className={cn(shape, 'cursor-default border-muted bg-secondary/[0.06]')}>
        <span title={t.busyAt({ time })} className={cn(line, 'font-bold')}>{t.busy}</span>
        <span className="sr-only">, </span>
        <span className={withTime ? timeLine : 'sr-only'}>{time}</span>
        {chip}
      </div>
    );
  }
  // An event joined (UI-104 point 1): read-only here, it opens its own page.
  if (isJoined(item)) {
    return (
      <Link
        href={`/events/${encodeURIComponent(item.eventId)}`}
        data-event=""
        style={style}
        aria-label={t.joinedName({ title: item.title, type: item.type.label, time })}
        className={cn(shape, 'z-[1] hover:brightness-[0.96]', EVENT_TONE)}
      >
        <span title={`${item.title}, ${time}`} className={cn(line, 'font-bold')}>{item.title}</span>
        {withTime && <span className={timeLine}>{time}</span>}
        {chip}
      </Link>
    );
  }
  // Named in one string — *{badge}: {title}, {time}* and what the reader owes it — which holds the words
  // drawn on it, so a voice user can say what they see (WCAG 2.5.3).
  return (
    <button
      type="button"
      data-entry=""
      style={style}
      aria-label={entryName(item, time, words)}
      onClick={() => onOpen(item)}
      className={cn(shape, 'z-[1] hover:brightness-[0.96]', ENTRY_TONE[item.type])}
    >
      <span title={`${titleOf(item, words)}, ${time}`} className={cn(line, 'font-bold')}>
        {/* A trip with times is a block like any other, with the plane line icon (UI-104 point 8). */}
        {item.type === 'travel' && <LineIcon name="plane" className="mr-1 inline h-3 w-3 align-[-2px]" />}
        {titleOf(item, words)}
      </span>
      {withTime && <span className={timeLine}>{time}</span>}
      {chip}
    </button>
  );
}

/** The grid's frame while its read is on its way: its heads and hours, nothing in them (L-01, a Fill). */
export function TimeGridSkeleton({ columns = 7, head = true }: { columns?: number; head?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {/* The person row only where the pane will draw one (P19.8-T3 AC-5; MOB UI-175). */}
      {head && (
        <div className="flex items-center gap-[9px] border-b border-hairline bg-base px-3.5 py-[11px]">
          <span className="h-[26px] w-[26px] rounded-full bg-hairline" />
          <span className="h-3 w-32 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
        </div>
      )}
      <div className="flex border-b border-hairline">
        <div className={cn(GUTTER, 'shrink-0 border-r border-hairline')} />
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5 border-r border-hairline py-2 last:border-r-0">
            <span className="h-2.5 w-6 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
            <span className="h-3 w-4 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="flex h-[392px]" style={{ backgroundImage: HOUR_LINES }}>
        <div className={cn(GUTTER, 'shrink-0 border-r border-hairline')} />
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="flex-1 border-r border-hairline last:border-r-0" />
        ))}
      </div>
    </div>
  );
}
