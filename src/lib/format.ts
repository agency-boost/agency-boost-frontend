/**
 * Shared formatters. `frontend/CLAUDE.md`: *"Money and tenant-timezone dates go through the shared
 * helpers. Never re-implement one."*
 *
 * There was no such file, so seven screens called `toLocaleDateString` inline with whatever options
 * they happened to pick, and the leads table drifted to `en-GB` — `4 Sep 2026` where the prototype
 * shows `Sep 4, 2026`. That is the drift the rule exists to stop; the prototype has three
 * inconsistent currency formats for the same reason.
 */

/**
 * A date as the product writes it: `Sep 4, 2026`.
 *
 * `Overall.html:5457-5461` — `en-US` with `{ month: 'short', day: 'numeric', year: 'numeric' }`.
 *
 * **`en-US`, not the reader's locale**, and not `id-ID`. The UI is Indonesian but these dates sit in
 * tables beside English column headings, and a date that changes shape with the browser's language
 * setting cannot be lined up in a column or compared between two screens. Money is the opposite case
 * and goes through `formatRupiah`, which is `id-ID` deliberately.
 *
 * **The instant is already the office's day.** Every date this formats arrives from the server as a
 * calendar date it resolved in the tenant timezone, so there is no zone arithmetic here — doing any
 * would reintroduce the defect invariant §9 exists to prevent.
 */
export function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The same date spelled out, for a sentence: `September 13, 2026`.
 *
 * A compact `Sep 13` is right in a column and wrong mid-prose, where the abbreviation reads as a
 * truncation. Same locale as `formatDay`, for the reason given there.
 */
export function formatDayLong(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * A calendar day the server already resolved in the office's zone — `2026-10-07` — spelled for a
 * sentence: `October 7, 2026`.
 *
 * **Built from its three numbers, never parsed as an instant.** `new Date('2026-10-07')` is midnight
 * UTC, which a browser west of Greenwich shows as October 6 — the one-day slip invariant §9 exists to
 * prevent, on a day the office's lock turns on.
 */
export function formatCalendarDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * A calendar day the server resolved in the office's zone, with its weekday: `Friday, October 2, 2026`.
 *
 * The coaching session's header, *Today's session — {date}* (`Overall.html:10584`, `fmtToday()`:
 * `en-US`, weekday and month long). Built from its three numbers, for the reason `formatCalendarDay`
 * gives: the prototype formats the browser's own clock, and that is the slip invariant §9 forbids.
 */
export function formatCalendarDayLong(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * An office calendar month — `2026-09` — as a sentence names it: `September 2026`. Built from its
 * numbers, for the reason `formatCalendarDay` gives.
 */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * The calendar month an instant falls in **in the office's zone** — `2026-10` at 01:00 on 1 October in
 * Jakarta, which is still September in UTC (invariant §9). For a default a screen offers, never for a
 * computation over data: those are the server's.
 */
export function monthInZone(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}`;
}

/**
 * The calendar day an instant falls on **in the office's zone** — `2026-10-08` at 01:00 on 8 October in
 * Jakarta, which is still the 7th in UTC (invariant §9). As `monthInZone`: for a default a screen offers
 * or a date it prints, never for a computation over data. The quote tool's *today* (P13.2-T2).
 */
export function dayInZone(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A calendar day's three numbers, as a local `Date` — never parsed as an instant. */
function localDate(day: string): Date | null {
  const [y, m, d] = day.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/**
 * A calendar day the server resolved in the office's zone, compact for a column or a range:
 * `Sep 22`, or `Sep 28, 2026` with the year. Built from its numbers, as `formatCalendarDay` is.
 */
export function formatShortDay(day: string, { year = false }: { year?: boolean } = {}): string {
  const at = localDate(day);
  if (!at) return '';
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
}

/** The weekday a calendar day falls on — `Mon` — for a column heading (`Overall.html:5003`). */
export function formatWeekday(day: string): string {
  const at = localDate(day);
  return at ? at.toLocaleDateString('en-US', { weekday: 'short' }) : '';
}


/*
 * ── The calendar's dates and times (P12-T2, P12-T3) ─────────────────────────────────────────────
 *
 * Every one of these takes what the calendar read serves — an office date `YYYY-MM-DD` and an office
 * wall-clock time `HH:mm` — and spells it. **None reads a clock and none works out a day**: the read
 * serves the period's dates, the office's today and its minute (invariant §9; F-01, F-89, F-93), so
 * the browser's zone cannot move anything here. The shapes are the prototype's, each for its own
 * space (`Calendar_Section.html:285`, `:330`, `:590`, `:611`, `:827`, `:1013`, `:1036-1040`), so the
 * week's 12-hour times and the month's 24-hour ones are both verbatim (P12-T3 AC-3).
 */

/** Minutes after the office's midnight for `HH:mm`; `null` for anything that is not a time. */
export function clockMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** An end time's minutes: `00:00` as an **end** is midnight at the end of the date, 1440 (P12-T2 AC-5). */
export function endMinutes(hhmm: string): number | null {
  const m = clockMinutes(hhmm);
  return m === 0 ? 1440 : m;
}

/**
 * The week's range label: `Sep 28 – Oct 4, 2026`, and `Dec 28, 2026 – Jan 3, 2027` across a year
 * (`Calendar_Section.html:285`; P12-T2 AC-3). An en dash with a space either side.
 */
export function formatWeekRange(from: string, to: string): string {
  const [a, b] = [localDate(from), localDate(to)];
  if (!a || !b) return '';
  if (a.getFullYear() !== b.getFullYear()) {
    return `${formatShortDay(from, { year: true })} – ${formatShortDay(to, { year: true })}`;
  }
  return `${formatShortDay(from)} – ${formatShortDay(to)}, ${b.getFullYear()}`;
}

/**
 * A week column's heading: its weekday, `Mon`, over its number — `28`, or `Oct 1` on the first of a
 * month (`Calendar_Section.html:327-333`).
 */
export function formatDayHeader(day: string): { weekday: string; number: string } {
  const at = localDate(day);
  if (!at) return { weekday: '', number: '' };
  return {
    weekday: formatWeekday(day),
    number: at.getDate() === 1 ? formatShortDay(day) : String(at.getDate()),
  };
}

/** The hour gutter's label: `12 AM`, `1 AM` … `12 PM` … `11 PM` (`Calendar_Section.html:590`). */
export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

/** An office time in the week's 12-hour form, `9:00 AM`; `00:00` is `12:00 AM` (`fmtTime`, `:673-679`). */
export function formatClock(hhmm: string): string {
  const minutes = clockMinutes(hhmm);
  if (minutes === null) return '';
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** An entry's time in the week: `9:00 AM–9:30 AM`, an en dash with no spaces (`Calendar_Section.html:611`). */
export function formatTimeSpan(start: string, end: string): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

/** A calendar day with its weekday, the detail's form: `Monday, Sep 28, 2026` (`Calendar_Section.html:562`). */
export function formatWeekdayDay(day: string): string {
  const at = localDate(day);
  return at ? at.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/**
 * The detail's *When* for a timed entry: `Monday, Sep 28, 2026 · 9:00 AM – 9:30 AM` — a middle dot,
 * and an en dash **with** spaces (`Calendar_Section.html:827`).
 */
export function formatWhen(day: string, start: string, end: string): string {
  return `${formatWeekdayDay(day)} · ${formatClock(start)} – ${formatClock(end)}`;
}

/**
 * The detail's *When* for a trip: its two dates joined by an en dash, or one date for a one-day trip
 * (P12-T2 AC-7, a Fill: the prototype cannot open a trip at all, `:576`).
 */
export function formatTripWhen(startsOn: string, endsOn: string): string {
  if (startsOn === endsOn) return formatWeekdayDay(startsOn);
  return `${formatWeekdayDay(startsOn)} – ${formatWeekdayDay(endsOn)}`;
}

/**
 * A month line's time: 24-hour, the hour unpadded, minutes only when there are some, after a dot, and
 * an ASCII hyphen between — `9-9.30`, `14-15` (`fmtMonthTime`, `Calendar_Section.html:1036-1040`). An
 * end at midnight reads `24`, as the prototype's own decimal hours do.
 */
export function formatMonthSpan(start: string, end: string): string {
  const part = (minutes: number | null) => {
    if (minutes === null) return '';
    const [h, m] = [Math.floor(minutes / 60), minutes % 60];
    return m === 0 ? `${h}` : `${h}.${String(m).padStart(2, '0')}`;
  };
  return `${part(clockMinutes(start))}-${part(endMinutes(end))}`;
}

/**
 * The office's timezone, which v1 fixes for every office (ADR-0016): the backend's
 * `DEFAULT_TENANT_TIMEZONE`, pinned to it by `format.spec.ts` reading that constant, so the two cannot
 * drift. For an **instant** a screen must place on the office's calendar — a notification's time — and
 * never for a computation over data, which is the server's (invariant §9).
 */
export const OFFICE_TIME_ZONE = 'Asia/Jakarta';

/** An instant's calendar day and 24-hour clock in a zone: `{ day: '2026-10-03', clock: '14:05' }`. */
function inZone(at: Date, timeZone: string): { day: string; clock: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: `${part('year')}-${part('month')}-${part('day')}`, clock: `${part('hour')}:${part('minute')}` };
}

/**
 * When a notification arrived, short enough for a compact row (P12.1-T3 AC-6): the time for one from
 * today — `2:05 PM` — and the day and month otherwise — `Sep 1` — with the year only when it is not
 * this one, `Sep 1, 2025`, so last October's notice cannot pass for this October's. *Today* is the
 * office's (ADR-0016), not the browser's.
 *
 * The clock goes through `formatClock`, so it is the calendar's `9:00 AM` and the same characters on
 * every runtime: `toLocaleTimeString` puts a narrow no-break space before *PM* on some and not others.
 */
export function formatNoticeShort(iso: string, now: Date = new Date(), timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const when = inZone(at, timeZone);
  const today = inZone(now, timeZone).day;
  if (when.day === today) return formatClock(when.clock);
  return formatShortDay(when.day, { year: when.day.slice(0, 4) !== today.slice(0, 4) });
}

/**
 * The office's calendar day an **instant** fell on, compact: `Sep 1, 2026` (P13-T4 AC-5). For a record of
 * *when* somebody did something — an activation item ticked, a start date corrected, a note saved —
 * where the day is the office's (ADR-0016), never the browser's: 23:30 UTC is the next day in Jakarta.
 */
export function formatOfficeDay(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatShortDay(inZone(at, timeZone).day, { year: true });
}

/**
 * A notification's date and time in full, for its modal (P12.1-T3 AC-4): `September 1, 2026 · 2:05 PM`,
 * in the office's timezone. The middle dot is the calendar detail's, between a day and its time
 * (`formatWhen`).
 */
export function formatNoticeFull(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const when = inZone(at, timeZone);
  return `${formatCalendarDay(when.day)} · ${formatClock(when.clock)}`;
}
