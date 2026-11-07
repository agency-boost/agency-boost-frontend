/**
 * **One header-control size, one section-title size** (P19.8-T1 AC-1, AC-3; R6, D-38; ADR-0227 §1, §4; MOB UI-171,
 * MOB UI-185).
 *
 * The owner's rule of 7 November 2026: tabs, segmented controls, *Filter*, the view, period and month pickers, *Unit |
 * Group* and filter chips are **13px, weight 600, 44px tall, at every size** — Activity's *Log Activity · Dashboard ·
 * Ratio*, the reference — and every section title is **14px / 700 in ink**, Home's *Aksi hari ini*.
 *
 * **Strings only, and nothing else in this file**, as `phone.ts` and `touch.ts`: a server module that draws a control
 * may read them. Every class is written whole, since Tailwind finds a class only by its literal text. None carries a
 * screen variant: the rule holds at every width, so a phone, a tablet and a laptop wear the same three.
 *
 * `header-control.spec.tsx` pins them, and each shared control that wears them.
 */

/**
 * **A header control's type and height** — 13px (`text-base`), 600, 44px at least. On the control itself: a
 * `Segmented` segment, a `RouteTabs` tab, a filter chip, a toolbar button, `PickerMenu`'s button.
 */
export const HEADER_CONTROL = 'min-h-11 text-base font-semibold';

/**
 * **A white header button**, pill-shaped on the page's grey — *Hari ini*, *Filter*, a picker (the mockups' `.btn` and
 * `.dd`: a 1px line, 14px either side, the words on one line). `HEADER_CONTROL` and its box.
 */
export const HEADER_BUTTON = 'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill '
  + 'border border-hairline bg-card px-3.5 text-base font-semibold text-ink hover:bg-hover-row '
  + 'disabled:cursor-not-allowed disabled:opacity-40';

/** **A section's title**: 14px (`text-md`), 700, in ink — Home's *Aksi hari ini* (MOB UI-185). */
export const SECTION_TITLE = 'text-md font-bold text-ink';
