/**
 * Shared formatters. `frontend/CLAUDE.md`: *"Money and tenant-timezone dates go through the shared
 * helpers. Never re-implement one."*
 *
 * There was no such file, so seven screens called `toLocaleDateString` inline with whatever options
 * they happened to pick, and the leads table drifted to `en-GB`. That is the drift the rule exists to
 * stop; the prototype has three inconsistent currency formats for the same reason.
 *
 * **One way of writing a date, a sum and a number, `id-ID`** (ADR-0167 §1, OD-196, P18.95-T1; parity
 * I-393 to I-395). The client's UI review of 2026-10-26 asked for the Indonesian forms everywhere:
 *
 * - a date `26 Okt 2026`; with its weekday `Senin, 26 Okt 2026`; a month `Okt 2026`; a date and time
 *   `26 Okt 2026, 13.05`; a time `13.05`;
 * - money **compact** on a card, a tile, a summary, a chip and in a sentence — `Rp 357,5 jt` — and
 *   **in full** in a table's cell, an input and an export — `Rp 357.500.000`;
 * - a percentage to one decimal, `15,0%`; a decimal with a comma, `2,13`; a thousand with a dot, `1.250`.
 *
 * The English words around them stay (OD-197): only the formatting is Indonesian. The backend writes its
 * own sentences by the same rules, in `backend/src/common/format/format.ts`.
 *
 * **Built from tables, not `toLocaleDateString('id-ID')`.** Runtimes disagree about `id-ID`'s August
 * (*Agu* or *Agt*) and about the separator before a time, and a screen must print the same characters
 * in every browser and in the test runner. The month and weekday names are CLDR's.
 */

/** CLDR's `id-ID` abbreviated months. */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;
/** CLDR's `id-ID` weekdays, Sunday first as `Date.getDay()` counts them. */
const WEEKDAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
/** The same, abbreviated, for a column heading. */
const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

/** `26 Okt 2026`, or `26 Okt` without its year, from a local `Date`'s own numbers. */
function dayText(at: Date, year = true): string {
  const text = `${at.getDate()} ${MONTHS_SHORT[at.getMonth()]}`;
  return year ? `${text} ${at.getFullYear()}` : text;
}

/** `Senin, 26 Okt 2026`. */
function weekdayDayText(at: Date): string {
  return `${WEEKDAYS_LONG[at.getDay()]}, ${dayText(at)}`;
}

/** `13.05` for `13:05`: 24-hour, the hour and minute two digits each, a dot between (`id-ID`). */
function clockText(minutes: number): string {
  const [h, m] = [Math.floor(minutes / 60) % 24, minutes % 60];
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

/**
 * A date as the product writes it: `4 Sep 2026` (ADR-0167 §1).
 *
 * **The instant is already the office's day.** Every date this formats arrives from the server as a
 * calendar date it resolved in the tenant timezone, so there is no zone arithmetic here — doing any
 * would reintroduce the defect invariant §9 exists to prevent.
 */
export function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return dayText(at);
}

/**
 * The same date in a sentence: `13 Sep 2026`. One shape since ADR-0167 §1 — the month was spelled out
 * here (`September 13, 2026`) while it was `en-US`; the name stays because many screens call it.
 */
export function formatDayLong(iso: string): string {
  return formatDay(iso);
}

/**
 * A calendar day the server already resolved in the office's zone — `2026-10-07` — written
 * `7 Okt 2026`.
 *
 * **Built from its three numbers, never parsed as an instant.** `new Date('2026-10-07')` is midnight
 * UTC, which a browser west of Greenwich shows as the 6th — the one-day slip invariant §9 exists to
 * prevent, on a day the office's lock turns on.
 */
export function formatCalendarDay(day: string): string {
  const at = localDate(day);
  return at ? dayText(at) : '';
}

/**
 * A calendar day the server resolved in the office's zone, with its weekday: `Jumat, 2 Okt 2026`.
 *
 * The coaching session's header, *Today's session — {date}* (`Overall.html:10584`). Built from its
 * three numbers, for the reason `formatCalendarDay` gives: the prototype formats the browser's own
 * clock, and that is the slip invariant §9 forbids.
 */
export function formatCalendarDayLong(day: string): string {
  const at = localDate(day);
  return at ? weekdayDayText(at) : '';
}

/**
 * An office calendar month — `2026-09` — written `Sep 2026`. Built from its numbers, for the reason
 * `formatCalendarDay` gives.
 */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m > 12) return month;
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

/** An office month's name alone, for a chart's axis or a date block: `Okt` for `2026-10`. */
export function formatMonthName(month: string): string {
  const m = Number(month.split('-')[1]);
  return m >= 1 && m <= 12 ? MONTHS_SHORT[m - 1] : '';
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
 * `22 Sep`, or `28 Sep 2026` with the year. Built from its numbers, as `formatCalendarDay` is.
 */
export function formatShortDay(day: string, { year = false }: { year?: boolean } = {}): string {
  const at = localDate(day);
  return at ? dayText(at, year) : '';
}

/** The weekday a calendar day falls on — `Sen` — for a column heading (`Overall.html:5003`). */
export function formatWeekday(day: string): string {
  const at = localDate(day);
  return at ? WEEKDAYS_SHORT[at.getDay()] : '';
}


/*
 * ── The calendar's dates and times (P12-T2, P12-T3) ─────────────────────────────────────────────
 *
 * Every one of these takes what the calendar read serves — an office date `YYYY-MM-DD` and an office
 * wall-clock time `HH:mm` — and spells it. **None reads a clock and none works out a day**: the read
 * serves the period's dates, the office's today and its minute (invariant §9; F-01, F-89, F-93), so
 * the browser's zone cannot move anything here. The places are the prototype's, each for its own
 * space (`Calendar_Section.html:285`, `:330`, `:590`, `:611`, `:827`, `:1013`, `:1036-1040`); the
 * shapes are `id-ID` since ADR-0167 §1, so the week's times are 24-hour, `09.00`, as the month's
 * `9-9.30` always was (parity I-393).
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
 * The week's range label: `28 Sep – 4 Okt 2026`, and `28 Des 2026 – 3 Jan 2027` across a year
 * (`Calendar_Section.html:285`; P12-T2 AC-3). An en dash with a space either side.
 */
export function formatWeekRange(from: string, to: string): string {
  const [a, b] = [localDate(from), localDate(to)];
  if (!a || !b) return '';
  if (a.getFullYear() !== b.getFullYear()) return `${dayText(a)} – ${dayText(b)}`;
  return `${dayText(a, false)} – ${dayText(b)}`;
}

/**
 * A week column's heading: its weekday, `Sen`, over its number — `28`, or `1 Okt` on the first of a
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

/** The hour gutter's label: `00.00`, `01.00` … `12.00` … `23.00` (`Calendar_Section.html:590`; ADR-0167 §1). */
export function formatHour(hour: number): string {
  return clockText((hour % 24) * 60);
}

/**
 * An office time, `09.00`; `00:00` is `00.00` (`fmtTime`, `:673-679`, in `id-ID` since ADR-0167 §1). Built
 * from its numbers, so it is the same characters on every runtime: `toLocaleTimeString` puts a narrow
 * no-break space or the word *pukul* where some do not.
 */
export function formatClock(hhmm: string): string {
  const minutes = clockMinutes(hhmm);
  return minutes === null ? '' : clockText(minutes);
}

/** An entry's time in the week: `09.00–09.30`, an en dash with no spaces (`Calendar_Section.html:611`). */
export function formatTimeSpan(start: string, end: string): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

/** A calendar day with its weekday, the detail's form: `Senin, 28 Sep 2026` (`Calendar_Section.html:562`). */
export function formatWeekdayDay(day: string): string {
  const at = localDate(day);
  return at ? weekdayDayText(at) : '';
}

/**
 * The detail's *When* for a timed entry: `Senin, 28 Sep 2026 · 09.00 – 09.30` — a middle dot, and an
 * en dash **with** spaces (`Calendar_Section.html:827`). The dot stays, not the comma of a single date
 * and time (`formatDateTime`): the weekday already takes a comma, and a span is not one moment.
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

/**
 * How far a zone's wall clock is ahead of UTC at an instant, in milliseconds — the one place the office's
 * wall clock is turned into an instant and back (invariant §9, ADR-0016). Campaign dates (`officeDayEdge`) and
 * the events panel's times (`officeInstant`) both read it, whatever zone the browser is in.
 */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

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
 * today — `14.05` — and the day and month otherwise — `1 Sep` — with the year only when it is not
 * this one, `1 Sep 2025`, so last October's notice cannot pass for this October's. *Today* is the
 * office's (ADR-0016), not the browser's.
 *
 * The clock goes through `formatClock`, so it is the calendar's `09.00` and the same characters on
 * every runtime.
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
 * The office's calendar day an **instant** fell on: `1 Sep 2026` (P13-T4 AC-5). For a record of
 * *when* somebody did something — an activation item ticked, a start date corrected, a note saved —
 * where the day is the office's (ADR-0016), never the browser's: 23:30 UTC is the next day in Jakarta.
 */
export function formatOfficeDay(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatShortDay(inZone(at, timeZone).day, { year: true });
}

/**
 * An instant's date and time, in the office's timezone: `26 Okt 2026, 13.05` (ADR-0167 §1). For a record of
 * *when* — an audit row, a status change, a session's sign-in — where the minute matters. The office's zone,
 * never the browser's (ADR-0016): the same instant reads the same on every screen, wherever it is read.
 */
export function formatDateTime(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const when = inZone(at, timeZone);
  return `${formatCalendarDay(when.day)}, ${formatClock(when.clock)}`;
}

/**
 * An office calendar day and an office wall-clock time, as one moment: `20 Sep 2026, 18.00` — the shape
 * `formatDateTime` gives an instant, for what the server already resolved into the office's day and minute.
 */
export function formatDayClock(day: string, hhmm: string): string {
  const [date, clock] = [formatCalendarDay(day), formatClock(hhmm)];
  return date && clock ? `${date}, ${clock}` : date || clock;
}

/** The office's calendar month an instant fell in: `Okt 2026` — when access was granted, say. */
export function formatOfficeMonth(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatMonth(inZone(at, timeZone).day.slice(0, 7));
}

/** An instant's time alone, in the office's timezone: `13.05`. */
export function formatOfficeTime(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatClock(inZone(at, timeZone).clock);
}

/**
 * A notification's date and time in full, for its modal (P12.1-T3 AC-4): `1 Sep 2026, 14.05`, in the
 * office's timezone — `formatDateTime`, under the name its callers know.
 */
export function formatNoticeFull(iso: string, timeZone: string = OFFICE_TIME_ZONE): string {
  return formatDateTime(iso, timeZone);
}

/*
 * ── Numbers (ADR-0167 §1, parity I-395) ─────────────────────────────────────────────────────────
 *
 * `id-ID`: a thousand takes a dot, `1.250`, and a decimal a comma, `2,13`. Through `Intl.NumberFormat`,
 * which every runtime agrees on for `id-ID` digits (`format.spec.ts` pins the four-digit grouping).
 */

const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>();

function numberFormat(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let format = NUMBER_FORMATS.get(key);
  if (!format) {
    format = new Intl.NumberFormat('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true });
    NUMBER_FORMATS.set(key, format);
  }
  return format;
}

/**
 * A number for a reader: `1.250`, `2,13`, `1.234,5`. `decimals` fixes the places (`formatNumber(2.1, { decimals: 2 })`
 * is `2,10`); `maxDecimals` writes up to that many and drops trailing zeros (`formatNumber(1.4, { maxDecimals: 1 })`
 * is `1,4`, and `2` is `2`). Neither: a whole number. Rounding is half away from zero, `Intl`'s.
 */
export function formatNumber(value: number, { decimals, maxDecimals }: { decimals?: number; maxDecimals?: number } = {}): string {
  if (!Number.isFinite(value)) return '';
  const min = decimals ?? 0;
  const max = decimals ?? maxDecimals ?? 0;
  // `-0` is written `0`: a figure that rounds to nothing has no sign.
  const text = numberFormat(min, max).format(value);
  return /^-0(,0+)?$/.test(text) ? text.slice(1) : text;
}

/**
 * A percentage, **to one decimal** (ADR-0167 §1: *"Percentages keep one decimal"*): `15,0%`, `57,5%`, `100,0%`.
 * `value` is already in percent — 15 for 15%. `maxDecimals` lets a figure keep more where rounding it would
 * misstate what is stored (a commission rate of 7,25%, `formatRate`) or a status (`formatRatioForStatus`).
 */
export function formatPercent(value: number, { maxDecimals = 1 }: { maxDecimals?: number } = {}): string {
  if (!Number.isFinite(value)) return '';
  const text = numberFormat(1, Math.max(1, maxDecimals)).format(value);
  return `${/^-0,0+$/.test(text) ? text.slice(1) : text}%`;
}

/**
 * What a reader **typed** as a decimal, back to a number — a comma or a point (ADR-0167 §1, AC-3): `1,4` and `1.4`
 * are both 1.4. `NaN` for anything that is not a number, and for an empty field.
 *
 * **For small values only** — a ratio benchmark, a rate, a count of months — never money, which takes whole
 * rupiah through `parseDigits`. The rule, so `1.250` cannot be misread:
 *
 * - a **comma** present: it is the decimal, and every point is a thousands separator — `1.250,5` is 1250.5;
 * - **no comma and one point**: the point is the decimal — `1.250` is 1.25, as a benchmark is typed;
 * - **no comma and two or more points**: they are thousands separators — `1.250.000` is 1250000;
 * - two commas, or a point after the comma: not a number.
 */
export function parseDecimal(typed: string): number {
  const text = typed.trim().replace(/\s/g, '');
  if (text === '') return Number.NaN;
  const commas = (text.match(/,/g) ?? []).length;
  const points = (text.match(/\./g) ?? []).length;
  let normal: string;
  if (commas > 1) return Number.NaN;
  if (commas === 1) {
    const [whole, fraction] = text.split(',');
    if (fraction.includes('.')) return Number.NaN;
    normal = `${whole.replace(/\./g, '')}.${fraction}`;
  } else {
    normal = points > 1 ? text.replace(/\./g, '') : text;
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(normal)) return Number.NaN;
  return Number(normal);
}

/*
 * ── Money (ADR-0167 §1, parity I-394) ───────────────────────────────────────────────────────────
 *
 * **Integer minor units, IDR sen, everywhere** (invariant §9). A screen holds sen and writes rupiah
 * through one of two formatters, and which one is a rule, not a taste:
 *
 * - **`formatRupiah`, in full** — `Rp 500.000.000` — in a **table's cell**, beside or inside an **input**,
 *   and in an **export** (a print, a file, a quote): where a figure is read against others in a column,
 *   checked against what was typed, or kept.
 * - **`formatRupiahCompact`** — `Rp 500 jt` — **everywhere else**: a card, a KPI tile, a summary, a chip, a
 *   pill, a sentence and its tooltip.
 */

/** IDR sen per rupiah. One place, so a screen cannot hold a second opinion about the unit. */
export const MINOR_UNITS_PER_MAJOR = 100;

export const toMajor = (minor: number) => Math.round(minor / MINOR_UNITS_PER_MAJOR);
export const toMinor = (major: number) => Math.round(major * MINOR_UNITS_PER_MAJOR);

/** Whole digits grouped by thousands with a dot, `1.250.000` — by hand, so no runtime can differ. */
const grouped = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** The whole rupiah in a sen amount, and its sign apart: `-150_000` sen is `{ sign: '-', rupiah: 1500 }`. */
function rupiahOf(minor: number): { sign: string; rupiah: number } {
  const rupiah = Math.round(Math.abs(minor) / MINOR_UNITS_PER_MAJOR);
  return { sign: minor < 0 && rupiah > 0 ? '-' : '', rupiah };
}

/**
 * `500000000` rupiah (in sen) as `Rp 500.000.000` — **in full**, for a table's cell, an input and an export.
 * A negative keeps its minus in front, `-Rp 20.000`, as the billing quote's discounts always read.
 *
 * **Indonesian grouping**, which the prototype's `toLocaleString('en-US')` gets wrong for its own
 * audience — and its compact formatter renders `1.2e9` as `Rp1.2M+`, which is neither a number nor
 * a unit anybody uses.
 */
export function formatRupiah(minor: number): string {
  if (!Number.isFinite(minor)) return '';
  const { sign, rupiah } = rupiahOf(minor);
  return `${sign}Rp ${grouped(rupiah)}`;
}

/** The compact units, largest first: *miliar*, *juta*, *ribu* (`metrics-and-definitions.md`, *Compact money*). */
const COMPACT_UNITS = [
  { size: 1_000_000_000, mark: 'M' },
  { size: 1_000_000, mark: 'jt' },
  { size: 1_000, mark: 'rb' },
] as const;

/**
 * A sum **compact**, for a card, a tile, a summary, a chip and a sentence: `Rp 750 rb`, `Rp 500 jt`,
 * `Rp 357,5 jt`, `Rp 1,2 M` (ADR-0167 §1; the thresholds and the rounding are `metrics-and-definitions.md`'s
 * *Compact money*, stated once):
 *
 * - 1.000.000.000 and over in *M* (miliar), 1.000.000 in *jt* (juta), 1.000 in *rb* (ribu); below, in full;
 * - **at most one decimal**, a comma, and no trailing *,0* — `Rp 500 jt`, never `Rp 500,0 jt`;
 * - **rounded half up on the digit shown, in integers** — `1.150` is `Rp 1,2 rb`, which `1.15 × 10` in floating
 *   point would make `Rp 1,1 rb` — and a figure that rounds up to a thousand of its unit is written in the next:
 *   `999.950.000` is `Rp 1 M`, not `Rp 1.000 jt`;
 * - a negative keeps its minus in front, `-Rp 750 rb`.
 *
 * **`lossless`** writes the full figure instead whenever the compact one would round: for a threshold in a
 * sentence — a campaign's requirement — where *Rp 2,5 M* for 2.450.000.000 would state a different rule.
 */
export function formatRupiahCompact(minor: number, { lossless = false }: { lossless?: boolean } = {}): string {
  if (!Number.isFinite(minor)) return '';
  const { sign, rupiah } = rupiahOf(minor);
  let index = COMPACT_UNITS.findIndex((unit) => rupiah >= unit.size);
  while (index >= 0) {
    const unit = COMPACT_UNITS[index];
    const step = unit.size / 10;
    let tenths = Math.floor(rupiah / step);
    if (2 * (rupiah - tenths * step) >= step) tenths += 1;
    // A thousand of this unit is one of the next: `999.950.000` is `Rp 1 M`, never `Rp 1.000 jt`.
    if (tenths >= 10_000 && index > 0) { index -= 1; continue; }
    if (lossless && tenths * step !== rupiah) break;
    const [whole, tenth] = [Math.floor(tenths / 10), tenths % 10];
    return `${sign}Rp ${grouped(whole)}${tenth ? `,${tenth}` : ''} ${unit.mark}`;
  }
  return formatRupiah(minor);
}

/**
 * Two compact sums read as one figure, **one `Rp` between them**: `Rp 357,5 jt / 712,7 jt` (UI-030, ADR-0167 §1).
 * The client's example for the Unit Dashboard's *Direct Group production*, which wrapped as *Rp 357.500.000 /
 * Rp 712.666.667*; `joiner` is the word the screen already uses — `/` on a tile, `of` in a sentence.
 */
export function formatRupiahCompactPair(first: number, second: number, joiner: string): string {
  const tail = formatRupiahCompact(second).replace(/^(-?)Rp /, '$1');
  return `${formatRupiahCompact(first)} ${joiner} ${tail}`;
}
