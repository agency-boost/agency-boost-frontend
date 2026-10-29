import { DEFAULT_LANGUAGE, type Language } from '@/i18n/language';

/**
 * Shared formatters. `frontend/CLAUDE.md`: *"Money and tenant-timezone dates go through the shared
 * helpers. Never re-implement one."*
 *
 * There was no such file, so seven screens called `toLocaleDateString` inline with whatever options
 * they happened to pick, and the leads table drifted to `en-GB`. That is the drift the rule exists to
 * stop; the prototype has three inconsistent currency formats for the same reason.
 *
 * **One way of writing a date, a sum and a number in each language** (P18.98-T3; ADR-0174 §6, ADR-0179 §6; the
 * approved glossary's §E, OD-237). Every function takes the reader's **`language` as its last parameter**, and a
 * caller that passes none gets **Indonesian** (`DEFAULT_LANGUAGE`), the forms every screen wrote before — so nothing
 * changes until a screen passes `useFigureLanguage()`: the reader's chosen language, and Indonesian with no choice,
 * whether or not the switch is live. **Never `useLanguage()`**, the words' language, which for a reader with no choice
 * is English until the switch is live (`figureLanguage`, `i18n/language.ts`):
 *
 * | | ID (ADR-0167 §1, ADR-0174) | EN (§E) |
 * |---|---|---|
 * | a date · with its weekday · a month | `26 Okt 2026` · `Senin, 26 Okt 2026` · `Okt 2026` | `26 Oct 2026` · `Monday, 26 Oct 2026` · `Oct 2026` |
 * | a week · a weekday heading | `28 Sep – 4 Okt 2026` · `Sen` | `28 Sep – 4 Oct 2026` · `Mon` |
 * | a time · a date and a time | `13.05` · `26 Okt 2026, 13.05` | `13:05` · `26 Oct 2026, 13:05` (24-hour) |
 * | a number · a decimal | `1.250` · `17,6` | `1,250` · `17.6` |
 * | a percentage · a ratio beside its benchmark | `96%` · `29,6%` | `96%` · `29.6%` |
 * | money compact · in full | `Rp 5,8 M`, `Rp 150 jt`, `Rp 750 rb` · `Rp 45.000.000` | `IDR 5.8B`, `IDR 150M`, `IDR 750K` · `IDR 45,000,000` |
 *
 * **One rounding** (ADR-0174 §1, AC-2): a figure is computed once, and the language changes only its characters —
 * the separators, a month's or a weekday's name, the currency's mark and a unit's — never the figure. The week starts
 * on Monday in both languages (`weekdayHeadings`). What a field holds keeps its own form, and a typed decimal is read
 * with either separator in either language (`parseDecimal`).
 *
 * **Percentages and money since ADR-0174** (OD-226, OD-227; P18.97-T3; parity I-501, I-502), the client's KPM
 * Owner findings of 2026-10-27:
 *
 * - a percentage **whole**, rounded half up, with no *,0* — `96%` — but a ratio compared with its benchmark keeps
 *   its tenth (`29,6%`), and a figure stated as a rule or a record keeps the places it has (`7,25%`);
 * - money **compact** everywhere — a card, a tile, a sentence **and a table** — `Rp 357,5 jt`, and **in full**
 *   only in Data upload's cells and correction panel, an input and what it echoes, and a price — `Rp 357.500.000`.
 *
 * **Figures, not words.** The words around a figure — *points*, *of*, *Not tracked* — are the catalogue's
 * (`src/i18n/`), and move with their module (P18.98-T4, T6). The backend writes its own sentences in the same forms,
 * in `backend/src/common/format/format.ts`; a ratio's tenth beside its benchmark and `lossless`' cap of
 * {@link PERCENT_LOSSLESS_MAX_DECIMALS} places are this module's alone (`metrics-and-definitions.md` §B.25).
 *
 * **Built from tables, not `toLocaleDateString('id-ID')`.** Runtimes disagree about `id-ID`'s August
 * (*Agu* or *Agt*) and about the separator before a time, and a screen must print the same characters
 * in every browser and in the test runner. The month and weekday names are CLDR's, English's as §E writes them.
 */

/** The months, abbreviated, January first: CLDR's `id-ID`, and English's (§E). */
const MONTHS_SHORT: Readonly<Record<Language, readonly string[]>> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
/** The weekdays in full, Sunday first as `Date.getDay()` counts them. */
const WEEKDAYS_LONG: Readonly<Record<Language, readonly string[]>> = {
  id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
/** The same, abbreviated, for a column heading. */
const WEEKDAYS_SHORT: Readonly<Record<Language, readonly string[]>> = {
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
/** Between an hour and its minutes: `13.05` in `id-ID`, `13:05` in English — 24-hour in both (§E). */
const CLOCK_MARK: Readonly<Record<Language, string>> = { id: '.', en: ':' };

/** `26 Okt 2026`, or `26 Okt` without its year, from a local `Date`'s own numbers. */
function dayText(at: Date, language: Language, year = true): string {
  const text = `${at.getDate()} ${MONTHS_SHORT[language][at.getMonth()]}`;
  return year ? `${text} ${at.getFullYear()}` : text;
}

/** `Senin, 26 Okt 2026`. */
function weekdayDayText(at: Date, language: Language): string {
  return `${WEEKDAYS_LONG[language][at.getDay()]}, ${dayText(at, language)}`;
}

/** `13.05` (`id-ID`) or `13:05` (English) for 13:05: 24-hour, the hour and minute two digits each. */
function clockText(minutes: number, language: Language): string {
  const [h, m] = [Math.floor(minutes / 60) % 24, minutes % 60];
  return `${String(h).padStart(2, '0')}${CLOCK_MARK[language]}${String(m).padStart(2, '0')}`;
}

/**
 * A date as the product writes it: `4 Sep 2026` (ADR-0167 §1).
 *
 * **The instant is already the office's day.** Every date this formats arrives from the server as a
 * calendar date it resolved in the tenant timezone, so there is no zone arithmetic here — doing any
 * would reintroduce the defect invariant §9 exists to prevent.
 */
export function formatDay(iso: string, language: Language = DEFAULT_LANGUAGE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return dayText(at, language);
}

/**
 * The same date in a sentence: `13 Sep 2026`. One shape since ADR-0167 §1 — the month was spelled out
 * here (`September 13, 2026`) while it was `en-US`; the name stays because many screens call it.
 */
export function formatDayLong(iso: string, language: Language = DEFAULT_LANGUAGE): string {
  return formatDay(iso, language);
}

/**
 * A calendar day the server already resolved in the office's zone — `2026-10-07` — written
 * `7 Okt 2026`.
 *
 * **Built from its three numbers, never parsed as an instant.** `new Date('2026-10-07')` is midnight
 * UTC, which a browser west of Greenwich shows as the 6th — the one-day slip invariant §9 exists to
 * prevent, on a day the office's lock turns on.
 */
export function formatCalendarDay(day: string, language: Language = DEFAULT_LANGUAGE): string {
  const at = localDate(day);
  return at ? dayText(at, language) : '';
}

/**
 * A calendar day the server resolved in the office's zone, with its weekday: `Jumat, 2 Okt 2026`.
 *
 * The coaching session's header, *Today's session — {date}* (`Overall.html:10584`). Built from its
 * three numbers, for the reason `formatCalendarDay` gives: the prototype formats the browser's own
 * clock, and that is the slip invariant §9 forbids.
 */
export function formatCalendarDayLong(day: string, language: Language = DEFAULT_LANGUAGE): string {
  const at = localDate(day);
  return at ? weekdayDayText(at, language) : '';
}

/**
 * An office calendar month — `2026-09` — written `Sep 2026`. Built from its numbers, for the reason
 * `formatCalendarDay` gives.
 */
export function formatMonth(month: string, language: Language = DEFAULT_LANGUAGE): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m > 12) return month;
  return `${MONTHS_SHORT[language][m - 1]} ${y}`;
}

/** An office month's name alone, for a chart's axis or a date block: `Okt` for `2026-10`. */
export function formatMonthName(month: string, language: Language = DEFAULT_LANGUAGE): string {
  const m = Number(month.split('-')[1]);
  return m >= 1 && m <= 12 ? MONTHS_SHORT[language][m - 1] : '';
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
export function formatShortDay(
  day: string,
  { year = false }: { year?: boolean } = {},
  language: Language = DEFAULT_LANGUAGE,
): string {
  const at = localDate(day);
  return at ? dayText(at, language, year) : '';
}

/** The weekday a calendar day falls on — `Sen` — for a column heading (`Overall.html:5003`). */
export function formatWeekday(day: string, language: Language = DEFAULT_LANGUAGE): string {
  const at = localDate(day);
  return at ? WEEKDAYS_SHORT[language][at.getDay()] : '';
}

/**
 * **The seven headings of a calendar's week, Monday first in both languages** (P18.98-T3 AC-5): `Sen … Min`,
 * `Mon … Sun`. The week is the office's Monday-to-Sunday (`nfr/i18n-dates-and-money.md`, *Period definitions*), as
 * the calendar read serves its days, so an English reader's week starts on Monday too — never the US Sunday.
 */
export function weekdayHeadings(language: Language = DEFAULT_LANGUAGE): string[] {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => WEEKDAYS_SHORT[language][day]);
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
 * `9-9.30` always was (parity I-393) — and English's since P18.98-T3, `09:00` and `9-9:30`.
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
export function formatWeekRange(from: string, to: string, language: Language = DEFAULT_LANGUAGE): string {
  const [a, b] = [localDate(from), localDate(to)];
  if (!a || !b) return '';
  if (a.getFullYear() !== b.getFullYear()) return `${dayText(a, language)} – ${dayText(b, language)}`;
  return `${dayText(a, language, false)} – ${dayText(b, language)}`;
}

/**
 * A week column's heading: its weekday, `Sen`, over its number — `28`, or `1 Okt` on the first of a
 * month (`Calendar_Section.html:327-333`).
 */
export function formatDayHeader(day: string, language: Language = DEFAULT_LANGUAGE): { weekday: string; number: string } {
  const at = localDate(day);
  if (!at) return { weekday: '', number: '' };
  return {
    weekday: formatWeekday(day, language),
    number: at.getDate() === 1 ? formatShortDay(day, {}, language) : String(at.getDate()),
  };
}

/** The hour gutter's label: `00.00`, `01.00` … `12.00` … `23.00` (`Calendar_Section.html:590`; ADR-0167 §1). */
export function formatHour(hour: number, language: Language = DEFAULT_LANGUAGE): string {
  return clockText((hour % 24) * 60, language);
}

/**
 * An office time, `09.00`; `00:00` is `00.00` (`fmtTime`, `:673-679`, in `id-ID` since ADR-0167 §1). Built
 * from its numbers, so it is the same characters on every runtime: `toLocaleTimeString` puts a narrow
 * no-break space or the word *pukul* where some do not.
 */
export function formatClock(hhmm: string, language: Language = DEFAULT_LANGUAGE): string {
  const minutes = clockMinutes(hhmm);
  return minutes === null ? '' : clockText(minutes, language);
}

/** An entry's time in the week: `09.00–09.30`, an en dash with no spaces (`Calendar_Section.html:611`). */
export function formatTimeSpan(start: string, end: string, language: Language = DEFAULT_LANGUAGE): string {
  return `${formatClock(start, language)}–${formatClock(end, language)}`;
}

/** A calendar day with its weekday, the detail's form: `Senin, 28 Sep 2026` (`Calendar_Section.html:562`). */
export function formatWeekdayDay(day: string, language: Language = DEFAULT_LANGUAGE): string {
  const at = localDate(day);
  return at ? weekdayDayText(at, language) : '';
}

/**
 * The detail's *When* for a timed entry: `Senin, 28 Sep 2026 · 09.00 – 09.30` — a middle dot, and an
 * en dash **with** spaces (`Calendar_Section.html:827`). The dot stays, not the comma of a single date
 * and time (`formatDateTime`): the weekday already takes a comma, and a span is not one moment.
 */
export function formatWhen(day: string, start: string, end: string, language: Language = DEFAULT_LANGUAGE): string {
  return `${formatWeekdayDay(day, language)} · ${formatClock(start, language)} – ${formatClock(end, language)}`;
}

/**
 * The detail's *When* for a trip: its two dates joined by an en dash, or one date for a one-day trip
 * (P12-T2 AC-7, a Fill: the prototype cannot open a trip at all, `:576`).
 */
export function formatTripWhen(startsOn: string, endsOn: string, language: Language = DEFAULT_LANGUAGE): string {
  if (startsOn === endsOn) return formatWeekdayDay(startsOn, language);
  return `${formatWeekdayDay(startsOn, language)} – ${formatWeekdayDay(endsOn, language)}`;
}

/**
 * A month line's time: 24-hour, the hour unpadded, minutes only when there are some, after the language's
 * clock mark, and an ASCII hyphen between — `9-9.30`, `14-15` (`fmtMonthTime`, `Calendar_Section.html:1036-1040`);
 * `9-9:30` in English. An end at midnight reads `24`, as the prototype's own decimal hours do.
 */
export function formatMonthSpan(start: string, end: string, language: Language = DEFAULT_LANGUAGE): string {
  const part = (minutes: number | null) => {
    if (minutes === null) return '';
    const [h, m] = [Math.floor(minutes / 60), minutes % 60];
    return m === 0 ? `${h}` : `${h}${CLOCK_MARK[language]}${String(m).padStart(2, '0')}`;
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
export function formatNoticeShort(
  iso: string,
  now: Date = new Date(),
  timeZone: string = OFFICE_TIME_ZONE,
  language: Language = DEFAULT_LANGUAGE,
): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const when = inZone(at, timeZone);
  const today = inZone(now, timeZone).day;
  if (when.day === today) return formatClock(when.clock, language);
  return formatShortDay(when.day, { year: when.day.slice(0, 4) !== today.slice(0, 4) }, language);
}

/**
 * The office's calendar day an **instant** fell on: `1 Sep 2026` (P13-T4 AC-5). For a record of
 * *when* somebody did something — an activation item ticked, a start date corrected, a note saved —
 * where the day is the office's (ADR-0016), never the browser's: 23:30 UTC is the next day in Jakarta.
 */
export function formatOfficeDay(iso: string, timeZone: string = OFFICE_TIME_ZONE, language: Language = DEFAULT_LANGUAGE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatShortDay(inZone(at, timeZone).day, { year: true }, language);
}

/**
 * An instant's date and time, in the office's timezone: `26 Okt 2026, 13.05` (ADR-0167 §1). For a record of
 * *when* — an audit row, a status change, a session's sign-in — where the minute matters. The office's zone,
 * never the browser's (ADR-0016): the same instant reads the same on every screen, wherever it is read.
 */
export function formatDateTime(iso: string, timeZone: string = OFFICE_TIME_ZONE, language: Language = DEFAULT_LANGUAGE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const when = inZone(at, timeZone);
  return `${formatCalendarDay(when.day, language)}, ${formatClock(when.clock, language)}`;
}

/**
 * An office calendar day and an office wall-clock time, as one moment: `20 Sep 2026, 18.00` — the shape
 * `formatDateTime` gives an instant, for what the server already resolved into the office's day and minute.
 */
export function formatDayClock(day: string, hhmm: string, language: Language = DEFAULT_LANGUAGE): string {
  const [date, clock] = [formatCalendarDay(day, language), formatClock(hhmm, language)];
  return date && clock ? `${date}, ${clock}` : date || clock;
}

/** The office's calendar month an instant fell in: `Okt 2026` — when access was granted, say. */
export function formatOfficeMonth(iso: string, timeZone: string = OFFICE_TIME_ZONE, language: Language = DEFAULT_LANGUAGE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatMonth(inZone(at, timeZone).day.slice(0, 7), language);
}

/** An instant's time alone, in the office's timezone: `13.05`. */
export function formatOfficeTime(iso: string, timeZone: string = OFFICE_TIME_ZONE, language: Language = DEFAULT_LANGUAGE): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return formatClock(inZone(at, timeZone).clock, language);
}

/**
 * A notification's date and time in full, for its modal (P12.1-T3 AC-4): `1 Sep 2026, 14.05`, in the
 * office's timezone — `formatDateTime`, under the name its callers know.
 */
export function formatNoticeFull(iso: string, timeZone: string = OFFICE_TIME_ZONE, language: Language = DEFAULT_LANGUAGE): string {
  return formatDateTime(iso, timeZone, language);
}

/*
 * ── Numbers (ADR-0167 §1, parity I-395; P18.98-T3) ──────────────────────────────────────────────
 *
 * `id-ID`: a thousand takes a dot, `1.250`, and a decimal a comma, `2,13`. Through `Intl.NumberFormat`,
 * which every runtime agrees on for `id-ID` digits (`format.spec.ts` pins the four-digit grouping).
 *
 * **English swaps the two marks** — `1,250`, `2.13` (§E; UI-012) — **on the text `id-ID` wrote**, so the digits,
 * and every rounding, are one computation in both languages: the language changes the characters, never the
 * figure (ADR-0174 §1, AC-2).
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

/** Each language's thousands mark and decimal mark (§E). */
const NUMBER_MARKS: Readonly<Record<Language, { group: string; decimal: string }>> = {
  id: { group: '.', decimal: ',' },
  en: { group: ',', decimal: '.' },
};

/** A figure `id-ID` wrote — `1.234,5` — in `language`'s marks: `1,234.5` in English. Nothing else changes. */
function inMarks(idText: string, language: Language): string {
  const marks = NUMBER_MARKS[language];
  return idText.replace(/[.,]/g, (mark) => (mark === '.' ? marks.group : marks.decimal));
}

/** `-0` and `-0,0` are written `0` and `0,0`: a figure that rounds to nothing has no sign. */
const unsigned = (idText: string) => (/^-0(,0+)?$/.test(idText) ? idText.slice(1) : idText);

/**
 * A number for a reader: `1.250`, `2,13`, `1.234,5` — `1,250`, `2.13`, `1,234.5` in English. `decimals` fixes the
 * places (`formatNumber(2.1, { decimals: 2 })` is `2,10`); `maxDecimals` writes up to that many and drops trailing
 * zeros (`formatNumber(1.4, { maxDecimals: 1 })` is `1,4`, and `2` is `2`). Neither: a whole number. Rounding is
 * half away from zero, `Intl`'s, and the same in both languages.
 */
export function formatNumber(
  value: number,
  { decimals, maxDecimals }: { decimals?: number; maxDecimals?: number } = {},
  language: Language = DEFAULT_LANGUAGE,
): string {
  if (!Number.isFinite(value)) return '';
  const min = decimals ?? 0;
  const max = decimals ?? maxDecimals ?? 0;
  return inMarks(unsigned(numberFormat(min, max).format(value)), language);
}

/*
 * ── Percentages (ADR-0174 §1–§3, OD-226, OD-213; parity I-501) ──────────────────────────────────
 *
 * **A percentage is a whole number, rounded half up, with no *,0*** — `96%` for 27 of 28. The server rounds a
 * share once, in integers (`rateOver`), and this writes what it served: **no percentage is rounded twice**, and
 * a screen computes none (invariant §7). Two exceptions, each its caller's to ask for:
 *
 * - **a ratio compared with its benchmark keeps its tenth**, `{ decimals: 1 }` — `29,6%` beside a `30%`
 *   benchmark, where `30%` would contradict *below* (`lib/ratio-format.ts`, `lib/ratio-balance.ts`);
 * - **a figure stated as a rule or as a record keeps the places it has**, `{ lossless: true }` — a benchmark as
 *   typed (`30%`, `15,5%`), a threshold (a campaign's, an MOC criterion's), a commission rate (`7,25%`), the
 *   carrier's persistency as Data upload shows it (`87,35%`), the rate an input echoes. Rounding one would state a
 *   different rule or misstate the file.
 *
 * English writes the same figure with a point — `29.6%`, `7.25%` — and the same sign after it (§E).
 */

/**
 * The most places `lossless` keeps — the places a benchmark is typed to (`benchmarkToInput`) and Data upload
 * reads a persistency to — so the binary noise of `0.0725 × 100` (`7.249999999999999`) is never written.
 * `metrics-and-definitions.md` §B.25.
 */
export const PERCENT_LOSSLESS_MAX_DECIMALS = 4;

/**
 * A percentage, **whole** (ADR-0174 §1): `96%`, `58%` for 57,5, `100%`, `0%`. `value` is already in percent — 15
 * for 15%. Rounding is half up — away from zero for a negative change, `-13%` for -12,5 — `Intl`'s.
 *
 * - `decimals` — the places always written: `{ decimals: 1 }` is a ratio beside its benchmark, `29,6%`, `30,0%`;
 * - `maxDecimals` — up to that many, trailing zeros dropped past `decimals`: a balance's split that needs a second
 *   place to stay on its side of the band, `{ decimals: 1, maxDecimals: 2 }` is `65,04%` and `40,0%`;
 * - `lossless` — a figure stated as a rule or a record: every place it has, up to
 *   {@link PERCENT_LOSSLESS_MAX_DECIMALS}, none when it has none — `7,25%`, `30%`.
 */
export function formatPercent(
  value: number,
  { decimals = 0, maxDecimals, lossless = false }: { decimals?: number; maxDecimals?: number; lossless?: boolean } = {},
  language: Language = DEFAULT_LANGUAGE,
): string {
  if (!Number.isFinite(value)) return '';
  const max = Math.max(decimals, maxDecimals ?? (lossless ? PERCENT_LOSSLESS_MAX_DECIMALS : decimals));
  // `-0%` is written `0%`: a change that rounds to nothing has no sign.
  return `${inMarks(unsigned(numberFormat(decimals, max).format(value)), language)}%`;
}

/**
 * **`part / of` as a whole percent, rounded half up in integers** (P18.97-T3, parity F-254; the client's UI-018,
 * *"correctly rounded"*) — the server's rule (`rateOver`, `wholePercent`; `metrics-and-definitions.md` §A.11), for
 * the few shares a screen still works out from two figures it was served: the Overview's trend against last month,
 * the Super Admin's signed-in shares, `ProgressBar`. A share the server serves is written as it came (invariant §7);
 * this is for none of those.
 *
 * `Math.round(part / of * 100)` rounds the quotient's binary approximation — `23 / 40 * 100` is `57.49999999999999`,
 * so an exact 57,5% read 57. `floor((200·part + of) / (2·of))` is exact for whole numbers below 2⁵³, which every
 * count is. Half up is toward +∞, as `Math.round` is: −57,5 is −57. `null` when `of` is not above 0: there is no share
 * of nobody, never 0% and never a division by zero.
 *
 * **A number, in no language** (P18.98-T3 AC-2): the share is rounded here, once, and `formatPercent` writes the same
 * figure in either.
 */
export function percentOf(part: number, of: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(of) || of <= 0) return null;
  return Math.floor((200 * part + of) / (2 * of));
}

/**
 * What a reader **typed** as a decimal, back to a number — a comma or a point (ADR-0167 §1, AC-3): `1,4` and `1.4`
 * are both 1.4. `NaN` for anything that is not a number, and for an empty field.
 *
 * **The same in both languages** (P18.98-T3 AC-3): an Indonesian reader may type a point, and an English one a comma,
 * so the field never asks which language the reader is in — `17,6` and `17.6` are 17.6 whatever the screen's.
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

/**
 * **A decimal as a field holds it** (P18.98-T3 AC-3): `3,5` in Indonesian and `3.5` in English — the language's
 * decimal mark, no grouping (the values a decimal field takes are small), every place the number has. `''` for
 * nothing. What `DecimalInput` writes when its value is set from outside, read back by `parseDecimal` in either
 * language.
 */
export function formatDecimalInput(value: number | null, language: Language = DEFAULT_LANGUAGE): string {
  return value === null || !Number.isFinite(value) ? '' : String(value).replace('.', NUMBER_MARKS[language].decimal);
}

/*
 * ── Money (ADR-0174 §4, OD-227; parity I-502, which narrows I-394) ─────────────────────────────
 *
 * **Integer minor units, IDR sen, everywhere** (invariant §9). A screen holds sen and writes rupiah
 * through one of two formatters, and which one is a rule, not a taste:
 *
 * - **`formatRupiahCompact`** — `Rp 500 jt`, `Rp 5,8 M` — **everywhere**: a card, a KPI tile, a summary, a chip,
 *   a pill, a sentence and its tooltip, a print **and a table's cell** (the analytics' `Rp 5.672.500.000` reads
 *   `Rp 5,7 M`). *M* is *miliar* and *jt* is *juta* on every screen.
 * - **`formatRupiah`, in full** — `Rp 500.000.000` — **only where precision matters**: Data upload's cells and
 *   its correction panel (the carrier's file's own figures); an **input** and what it echoes (the read-only
 *   figure that stands in one); and a **price** — the Super Admin's billing quote and a subscription's costs.
 *
 * **English since P18.98-T3** (§E; UI-019): `IDR 500M`, `IDR 5.8B`, `IDR 750K`, and `IDR 500,000,000` in full. The
 * currency's mark is the language's (`moneyPrefix`: *Rp*, *IDR*), so is each unit's (*M* · *B*, *jt* · *M*, *rb* ·
 * *K*), and Indonesian puts a space before its unit where English puts none. The sum is rounded once.
 */

/** IDR sen per rupiah. One place, so a screen cannot hold a second opinion about the unit. */
export const MINOR_UNITS_PER_MAJOR = 100;

export const toMajor = (minor: number) => Math.round(minor / MINOR_UNITS_PER_MAJOR);
export const toMinor = (major: number) => Math.round(major * MINOR_UNITS_PER_MAJOR);

/** The currency's mark before a sum: *Rp* in Indonesian, *IDR* in English (§E). */
const CURRENCY_MARK: Readonly<Record<Language, string>> = { id: 'Rp', en: 'IDR' };

/**
 * **A money field's prefix, and the mark before every sum** (P18.98-T3 AC-3): *Rp* in Indonesian, *IDR* in English.
 * A field's affix (`TextInput`'s `prefix`) reads it, so the box says what the sums around it say.
 */
export function moneyPrefix(language: Language = DEFAULT_LANGUAGE): string {
  return CURRENCY_MARK[language];
}

/** Whole digits grouped by thousands with the language's mark, `1.250.000` or `1,250,000` — by hand, so no runtime can differ. */
const grouped = (whole: number, language: Language) =>
  String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NUMBER_MARKS[language].group);

/** The whole rupiah in a sen amount, and its sign apart: `-150_000` sen is `{ sign: '-', rupiah: 1500 }`. */
function rupiahOf(minor: number): { sign: string; rupiah: number } {
  const rupiah = Math.round(Math.abs(minor) / MINOR_UNITS_PER_MAJOR);
  return { sign: minor < 0 && rupiah > 0 ? '-' : '', rupiah };
}

/**
 * `500000000` rupiah (in sen) as `Rp 500.000.000` — **in full**, only where precision matters (ADR-0174 §4): Data
 * upload's cells and correction panel, an input and what it echoes, and a price. `IDR 500,000,000` in English.
 * A negative keeps its minus in front, `-Rp 20.000`, as the billing quote's discounts always read.
 *
 * **Indonesian grouping**, which the prototype's `toLocaleString('en-US')` gets wrong for its own
 * audience — and its compact formatter renders `1.2e9` as `Rp1.2M+`, which is neither a number nor
 * a unit anybody uses.
 */
export function formatRupiah(minor: number, language: Language = DEFAULT_LANGUAGE): string {
  if (!Number.isFinite(minor)) return '';
  const { sign, rupiah } = rupiahOf(minor);
  return `${sign}${CURRENCY_MARK[language]} ${grouped(rupiah, language)}`;
}

/**
 * **Rupiah in each compact unit, by the mark a screen writes after it** (ADR-0174 §4; `metrics-and-definitions.md`
 * §B.25): `M` a *miliar*, `jt` a *juta*, `rb` a *ribu*. Held once, here — a screen that writes a figure in a header's
 * unit, the forum's *APE (Rp M)* and *Avg. Case Size (Rp jt)*, reads its size from this, never a second `1e9`.
 *
 * **The key is the unit's code, its Indonesian mark**; what each language writes after a figure is
 * `formatMoneyUnit`'s and `formatRupiahCompact`'s (*M* is English's *B*: a *miliar* is a billion).
 */
export const RUPIAH_PER_UNIT = { M: 1_000_000_000, jt: 1_000_000, rb: 1_000 } as const;
export type CompactUnit = keyof typeof RUPIAH_PER_UNIT;

/** Each compact unit's mark in each language (§E): a *miliar* is *M* and *B*, a *juta* *jt* and *M*, a *ribu* *rb* and *K*. */
const UNIT_MARKS: Readonly<Record<CompactUnit, Readonly<Record<Language, string>>>> = {
  M: { id: 'M', en: 'B' },
  jt: { id: 'jt', en: 'M' },
  rb: { id: 'rb', en: 'K' },
};
/** Between a compact figure and its unit: a space in Indonesian, `Rp 5,8 M`; none in English, `IDR 5.8B` (§E). */
const UNIT_GAP: Readonly<Record<Language, string>> = { id: ' ', en: '' };

/** The compact units, largest first: *miliar*, *juta*, *ribu* (`metrics-and-definitions.md`, *Compact money*). */
const COMPACT_UNITS: readonly CompactUnit[] = ['M', 'jt', 'rb'];

/**
 * **A header's money unit** (P18.98-T3 AC-1; ADR-0174 §5): what goes in the brackets of a column or a row whose
 * figures are written in one unit — *Rp M* and *Rp jt* in Indonesian, *IDR B* and *IDR M* in English, so the forum's
 * *APE (Rp M)* reads *APE (IDR B)* and its *Avg. Case Size (Rp jt)* reads *Avg. Case Size (IDR M)*. The name before
 * the brackets is a kept-English term (§A.4); the unit is a format. **Not for a file's header**: the production file's
 * *APE (Rp M)* is the carrier's million and the import's contract (AC-4), written by the template, in no language.
 */
export function formatMoneyUnit(unit: CompactUnit, language: Language = DEFAULT_LANGUAGE): string {
  return `${CURRENCY_MARK[language]} ${UNIT_MARKS[unit][language]}`;
}

/**
 * A sum **compact**, for every figure but those `formatRupiah` keeps — a card, a tile, a summary, a chip, a
 * sentence and a table: `Rp 750 rb`, `Rp 500 jt`, `Rp 357,5 jt`, `Rp 1,2 M` (ADR-0174 §4; the thresholds and the
 * rounding are `metrics-and-definitions.md` §B.25, stated once) — `IDR 750K`, `IDR 500M`, `IDR 357.5M`, `IDR 1.2B` in
 * English, at the same thresholds and to the same figure:
 *
 * - 1.000.000.000 and over in *M* (miliar), 1.000.000 in *jt* (juta), 1.000 in *rb* (ribu); below, in full.
 *   There is no *triliun*: a thousand *miliar* and more stays in *M*, grouped, `Rp 1.500 M` (`IDR 1,500B`);
 * - **at most one decimal**, a comma, and no trailing *,0* — `Rp 500 jt`, never `Rp 500,0 jt`;
 * - **rounded half up on the digit shown, in integers** — `1.150` is `Rp 1,2 rb`, which `1.15 × 10` in floating
 *   point would make `Rp 1,1 rb` — and a figure that rounds up to a thousand of its unit is written in the next:
 *   `999.950.000` is `Rp 1 M`, not `Rp 1.000 jt`;
 * - a negative keeps its minus in front, `-Rp 750 rb`.
 *
 * **`lossless`** writes the full figure instead whenever the compact one would round: for a threshold in a
 * sentence — a campaign's requirement — where *Rp 2,5 M* for 2.450.000.000 would state a different rule.
 */
export function formatRupiahCompact(
  minor: number,
  { lossless = false }: { lossless?: boolean } = {},
  language: Language = DEFAULT_LANGUAGE,
): string {
  if (!Number.isFinite(minor)) return '';
  const { sign, rupiah } = rupiahOf(minor);
  let index = COMPACT_UNITS.findIndex((unit) => rupiah >= RUPIAH_PER_UNIT[unit]);
  while (index >= 0) {
    const unit = COMPACT_UNITS[index];
    const step = RUPIAH_PER_UNIT[unit] / 10;
    let tenths = Math.floor(rupiah / step);
    if (2 * (rupiah - tenths * step) >= step) tenths += 1;
    // A thousand of this unit is one of the next: `999.950.000` is `Rp 1 M`, never `Rp 1.000 jt`.
    if (tenths >= 10_000 && index > 0) { index -= 1; continue; }
    if (lossless && tenths * step !== rupiah) break;
    const [whole, tenth] = [Math.floor(tenths / 10), tenths % 10];
    const figure = `${grouped(whole, language)}${tenth ? `${NUMBER_MARKS[language].decimal}${tenth}` : ''}`;
    return `${sign}${CURRENCY_MARK[language]} ${figure}${UNIT_GAP[language]}${UNIT_MARKS[unit][language]}`;
  }
  return formatRupiah(minor, language);
}

/**
 * Two compact sums read as one figure, **one `Rp` between them**: `Rp 357,5 jt / 712,7 jt` (UI-030, ADR-0167 §1, ADR-0174 §4);
 * `IDR 357.5M / 712.7M` in English, one `IDR`. The client's example for the Unit Dashboard's *Direct Group
 * production*, which wrapped as *Rp 357.500.000 / Rp 712.666.667*; `joiner` is the word the screen already uses —
 * `/` on a tile, `of` in a sentence — and the caller's, in the reader's language.
 */
export function formatRupiahCompactPair(first: number, second: number, joiner: string, language: Language = DEFAULT_LANGUAGE): string {
  const mark = `${CURRENCY_MARK[language]} `;
  const written = formatRupiahCompact(second, {}, language);
  const tail = written.startsWith('-') ? `-${written.slice(1 + mark.length)}` : written.slice(mark.length);
  return `${formatRupiahCompact(first, {}, language)} ${joiner} ${tail}`;
}
