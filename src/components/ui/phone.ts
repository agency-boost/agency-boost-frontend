/**
 * **What a phone changes** — below 768px, Tailwind's `md`, and nothing at or above it (ADR-0167, the
 * client's UI review of 2026-10-26: UI-013, UI-014, UI-029; P18.95-T1 AC-8 to AC-10).
 *
 * **Strings only, and nothing else in this file.** `field.tsx` reads them, and it is reached from the
 * server's graph as well as the client's: a hook here, or `'use client'`, would make every server
 * module that draws a button import one. The tab row's behaviour is `use-tab-row.ts`.
 *
 * Every class here carries `max-md:`, so a tablet and a desktop render exactly as they did: the client
 * has reviewed the phone alone, and the sizes it has not seen do not change underneath it (§12,
 * OD-207). `phone.spec.tsx` fails on a class here without the prefix.
 *
 * Two of the review's sizes are not here, because they are about every element rather than about a
 * component: no text under 12px, and a field's text at 16px so iOS does not zoom. Those are the type
 * scale's own properties, moved once in `globals.css` (*On a phone*).
 */

/**
 * A tab strip on a phone: **one row that scrolls sideways**, never two or three lines (UI-013: the
 * training categories on three, a coaching session's seven tabs on three, User Management on two). The
 * row scrolls inside its own box, so the page never does.
 */
export const TAB_ROW_PHONE = 'max-md:flex-nowrap max-md:overflow-x-auto max-md:overflow-y-hidden';

/**
 * The underlined strip's hairline, on a phone, **painted inside the box rather than as its border**.
 *
 * A box that scrolls clips what overflows it. The current tab's amber rule sits *on* the hairline by
 * overlapping it 1px (`-mb-px`); in a scrolling box that pixel was clipped, and it made the row scroll
 * a pixel up and down as well. An inset shadow is painted under the tabs, so the rule lies over the
 * hairline as before, and nothing overflows.
 */
export const UNDERLINED_ROW_PHONE = 'max-md:border-b-0 max-md:shadow-[inset_0_-1px_0_var(--color-hairline)]';

/**
 * One tab in that row: its words on one line and never squeezed, no overlap left to clip, and the focus
 * ring drawn just inside its edge, where the row's scroll box cannot cut it off. Ring and keyboard are
 * otherwise the tab's own.
 */
export const TAB_PHONE = 'max-md:mb-0 max-md:shrink-0 max-md:whitespace-nowrap max-md:focus-visible:[outline-offset:-2px]';

/**
 * `Segmented`'s track on a phone. The segments keep sharing the track equally when their words fit; when
 * they do not, each stays as wide as its words (`SEGMENT_PHONE`) and the track scrolls, rather than
 * breaking a label over two lines.
 */
export const SEGMENTS_PHONE = 'max-md:overflow-x-auto max-md:overflow-y-hidden';
export const SEGMENT_PHONE = 'max-md:min-w-max';

/**
 * A control a finger aims at, **44 × 44px at least** (WCAG 2.5.5; UI-029: the ⌄ and ⋮ were 28px). For a
 * control already centred in a flex box: the icon button, the inline text button.
 *
 * **The box grows, rather than an invisible area around it.** Two glyphs side by side — ✓ ✕ 🗑, a lead's
 * WhatsApp and ⋮ — each own the whole of their 44px, and neither's reaches over the other's, where a tap
 * meant for one would land on the next.
 */
export const TAP_TARGET = 'max-md:min-h-11 max-md:min-w-11';

/** A link or a row that is already a flex line, centred — *‹ Back*, a session in the history: 44px tall. */
export const TAP_HEIGHT = 'max-md:min-h-11';

/**
 * A link or a text button that stands on its own — *Open Goal Settings*, *View past sessions* — and is
 * otherwise inline: **44px tall, its words centred in the height** (UI-029: 17–20px).
 *
 * The gap stands in for a space between its words and a glyph after them (*View past sessions ▾*): a
 * flex line starts each piece on its own, and the space at the start of the second piece goes.
 *
 * **A link inside a sentence is not given this** (WCAG 2.5.8's inline exception): growing it would push
 * the lines of its paragraph apart, and its sentence is the target.
 */
export const TEXT_TAP = 'max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:gap-x-1';

/**
 * A glyph in a line of words — the ⓘ beside a figure or a heading: **its box stays the glyph's**, so the
 * line keeps its height and the figure beside it does not move, and an invisible square at least
 * 44 × 44px, centred on the glyph, takes the tap.
 *
 * It hangs from the nearest positioned box, which must be the glyph's own size: `TippedGlyph`'s wrapper,
 * which is `relative` at every size already.
 */
export const TAP_AREA = 'max-md:after:absolute max-md:after:left-1/2 max-md:after:top-1/2 '
  + 'max-md:after:h-[max(100%,2.75rem)] max-md:after:w-[max(100%,2.75rem)] '
  + "max-md:after:-translate-x-1/2 max-md:after:-translate-y-1/2 max-md:after:content-['']";
