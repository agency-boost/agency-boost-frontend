import { clockMinutes, endMinutes } from './format';
import { hhmm, isBusy, type CalendarItem } from './calendar';

/**
 * Where the calendar's things go on the page — pure arithmetic on what the read served, so each rule
 * is pinned by a unit test rather than by eye.
 *
 * The grid is the prototype's (`Calendar_Section.html:452-458`): 56px an hour, the whole 24 hours,
 * opened scrolled to 7 AM. Its two layout defects are fixed here (contradiction 7): entries that
 * overlap shared one full-width box and drew one over the other (`left:3px;right:3px`, `:136`), and
 * every travel bar sat at `top:3px` (`:122`). Now overlapping entries share their column side by side,
 * and overlapping bars stack, the all-day row growing to hold them (P12-T2 AC-6).
 */

/** `HOUR_H` (`:452`). */
export const HOUR_PX = 56;
/** The whole day, 24 × 56 (`:338`). */
export const DAY_PX = 24 * HOUR_PX;
/** `DEFAULT_SCROLL_HOUR` (`:455`). */
export const OPEN_AT_HOUR = 7;
/** An entry is never drawn shorter than this (`:610`). */
export const MIN_ENTRY_PX = 20;
/** A drag snaps to a quarter hour (`snap`, `:623`). */
export const SNAP_MINUTES = 15;
/** A click or a tap is half an hour (`:660-661`). */
export const CLICK_SLOT_MINUTES = 30;
/** A selection shorter than this is a click (`:660`). */
export const CLICK_PX = 10;
/** One stacked travel bar: 22px high, 3px apart (`:122`). */
export const BAR_PX = 22;
export const BAR_GAP_PX = 3;
/** The all-day row is never shorter than the prototype's (`:118`). */
export const ALLDAY_MIN_PX = 28;

const LAST_START = 24 * 60 - SNAP_MINUTES;

/** A pixel offset down the grid, snapped to the nearest quarter hour. */
export function snapMinutes(px: number): number {
  const minutes = (px / HOUR_PX) * 60;
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

/**
 * The slot a selection asks for: snapped to 15 minutes, a click half an hour (`:651-664`). **An end
 * past midnight is midnight**, `00:00` at the end of the date, never the prototype's `24:00` or
 * `24:15`, which no time input holds (contradiction 5; P12-T2 AC-5).
 */
export function slotFromSelection(top: number, height: number): { start: string; end: string } {
  const start = Math.min(Math.max(snapMinutes(top), 0), LAST_START);
  let end = height < CLICK_PX ? start + CLICK_SLOT_MINUTES : snapMinutes(top + height);
  if (end <= start) end = start + CLICK_SLOT_MINUTES;
  return { start: hhmm(start), end: hhmm(Math.min(end, 24 * 60)) };
}

/**
 * The *"Drag to block"* pill's slot (D-block-key): the next half hour of the office's today, or 23:30
 * to midnight once that has passed. `minute` is the read's, never the browser's clock.
 */
export function nextHalfHour(minute: number): { start: string; end: string } {
  const start = Math.min(Math.floor(minute / 30) * 30 + 30, 24 * 60 - 30);
  return { start: hhmm(start), end: hhmm(start + 30) };
}

/** A timed item's minutes on its date: an end of `00:00` is the end of the day. */
export function minutesOf(item: { start?: string | null; end?: string | null }): { start: number; end: number } {
  const start = clockMinutes(item.start ?? '') ?? 0;
  const end = endMinutes(item.end ?? '') ?? start + CLICK_SLOT_MINUTES;
  return { start, end: Math.max(end, start) };
}

export interface PlacedEntry<T> {
  item: T;
  top: number;
  height: number;
  /** Which of `lanes` side-by-side places it takes, from 0. */
  lane: number;
  lanes: number;
}

/**
 * One day column's timed items, side by side where they overlap. A cluster of items that overlap one
 * another, directly or through a third, shares one set of lanes; each item takes the first lane free
 * when it starts. Ordered by start, the longer first, as the read orders them by `startsAt`.
 */
export function layoutDay<T extends { start?: string | null; end?: string | null }>(items: readonly T[]): PlacedEntry<T>[] {
  const timed = items
    .map((item) => ({ item, ...minutesOf(item) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PlacedEntry<T>[] = [];
  let cluster: PlacedEntry<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const close = () => {
    for (const placed of cluster) placed.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const { item, start, end } of timed) {
    if (start >= clusterEnd) close();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);
    const placed: PlacedEntry<T> = {
      item,
      top: (start / 60) * HOUR_PX,
      height: Math.max(((end - start) / 60) * HOUR_PX - 2, MIN_ENTRY_PX),
      lane,
      lanes: 1,
    };
    cluster.push(placed);
    out.push(placed);
  }
  close();
  return out;
}

/**
 * The columns an all-day item covers in a period, **clipped at its edges** (contradiction 6): a trip
 * that began last week starts in Monday's column, and one that runs on ends in Sunday's. `null` when
 * it covers none of them. Dates compare as text, which `YYYY-MM-DD` allows.
 */
export function columnSpan(startsOn: string, endsOn: string, days: readonly string[]): { first: number; last: number } | null {
  if (days.length === 0 || endsOn < days[0] || startsOn > days[days.length - 1]) return null;
  const first = days.findIndex((day) => day >= startsOn);
  let last = days.length - 1;
  while (last > 0 && days[last] > endsOn) last -= 1;
  return { first, last };
}

export interface PlacedBar<T> {
  item: T;
  first: number;
  last: number;
  lane: number;
}

/** All-day bars, stacked where they overlap (contradiction 7), and how many rows they need. */
export function stackBars<T extends { startsOn?: string | null; endsOn?: string | null }>(
  items: readonly T[],
  days: readonly string[],
): { bars: PlacedBar<T>[]; lanes: number } {
  const spans = items
    .map((item) => ({ item, span: columnSpan(item.startsOn ?? '', item.endsOn ?? '', days) }))
    .filter((x): x is { item: T; span: { first: number; last: number } } => x.span !== null)
    .sort((a, b) => a.span.first - b.span.first || b.span.last - a.span.last);
  const laneEnds: number[] = [];
  const bars = spans.map(({ item, span }) => {
    let lane = laneEnds.findIndex((end) => end < span.first);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.last);
    } else {
      laneEnds[lane] = span.last;
    }
    return { item, first: span.first, last: span.last, lane };
  });
  return { bars, lanes: laneEnds.length };
}

/** The all-day row's height for `lanes` stacked bars. */
export function allDayHeight(lanes: number): number {
  return Math.max(ALLDAY_MIN_PX, lanes * (BAR_PX + BAR_GAP_PX) + BAR_GAP_PX);
}

/** A timed item on one date, for the week's day column. */
export function timedOn<T extends CalendarItem>(items: readonly T[], day: string): T[] {
  return items.filter((item) => !item.allDay && item.date === day);
}

/**
 * What a month cell lists for its date: the entries the week shows for that day, **and Travel on each
 * day it spans** (contradiction 9) — ordered by start, a trip first, since it has no time.
 */
export function itemsOnDay<T extends CalendarItem>(items: readonly T[], day: string): T[] {
  const key = (item: T) => (item.allDay ? -1 : minutesOf(item).start);
  return items
    .filter((item) => (item.allDay
      ? (item.startsOn ?? '') <= day && day <= (item.endsOn ?? '')
      : item.date === day))
    .sort((a, b) => key(a) - key(b) || idOf(a).localeCompare(idOf(b)));
}

const idOf = (item: CalendarItem) => (isBusy(item) ? '' : item.entryId);

/** How many lines a month cell shows before *"+{n} more…"* (`:1042-1049`). */
export const MONTH_LINES = 3;
