/**
 * The browser's print, under a title that names what is printed — the product's two downloads: the
 * Summary's *⬇ Download* (ADR-0061, ADR-0068) and a coaching session's *⬇ Download as PDF*
 * (ADR-0077). Save as PDF names its file after `document.title`, which is *AgencyBoost* on every
 * screen, so every summary and every session would otherwise be saved as `AgencyBoost.pdf`. No file
 * passes through our servers: the PDF is the browser's own.
 *
 * **The title goes back when the print window closes.** The listener is registered **before**
 * `print()`: Chrome and Firefox block inside `print()` and fire `afterprint` before it returns, so a
 * listener added after it would never run and the title would stay changed. One function, so a second
 * print adds no second listener. A browser that never fires `afterprint` gets it back when the page
 * goes: a page that prints calls `restorePrintTitle` as it unmounts.
 */

/** The title to put back — held across prints, so a second one cannot take the first's title for the page's own. */
let restoreTo: string | null = null;

/** What else waits for the print window to close: a print view taking itself off the page. */
const afterwards = new Set<() => void>();

export function restorePrintTitle() {
  if (restoreTo === null) return;
  document.title = restoreTo;
  restoreTo = null;
}

function finished() {
  restorePrintTitle();
  const waiting = [...afterwards];
  afterwards.clear();
  for (const run of waiting) run();
}

/** Print the page as `title`; `after` runs once the print window has closed. */
export function printAs(title: string, after?: () => void) {
  restoreTo ??= document.title;
  document.title = title;
  if (after) afterwards.add(after);
  window.addEventListener('afterprint', finished, { once: true });
  window.print();
}
