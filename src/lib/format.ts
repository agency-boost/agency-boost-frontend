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
 * An office calendar month — `2026-09` — as a sentence names it: `September 2026`. Built from its
 * numbers, for the reason `formatCalendarDay` gives.
 */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
