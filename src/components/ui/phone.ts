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
 * A segment of a **two-option** `Segmented` on a phone (`phoneLayout="wrap"`; P18.95-T5 AC-7): the segments keep
 * sharing the track in equal halves and a label that does not fit **wraps inside its own half**, so both options
 * are always in sight. *Set APE target directly* / *Calculate from savings target* on `/goals` scrolled the second
 * half out of a 375px screen. The track does not scroll; the two segments stand as tall as each other.
 */
export const SEGMENT_WRAP_PHONE = 'max-md:min-w-0 max-md:leading-snug';

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

/**
 * **A 40px control, 44px tall on a phone** (P18.97-T7 AC-6, ADR-0178 §5; the client's UI-040 of 2026-10-27: 48 controls
 * under 44px on `/kpm/settings/activation-checklist`, 33 on `/kpm/settings/products`, Data upload's buttons among its
 * 340): a `Button` of a box variant, a `TextInput`, a `Select`, a link wearing `buttonClass`. Height only — each is wider
 * than 44px already. **Opt-in, on the screens UI-040 names**: the shared controls stay 40px everywhere else, where no
 * finding has asked for more.
 */
export const CONTROL_PHONE = 'max-md:h-11';

/**
 * **A box to tick on a phone: its line 44px tall** (P18.97-T7 AC-6). On the `<label>` that holds the checkbox and its
 * words, which is the target a finger aims at; the box itself stays as the browser draws it.
 */
export const CHECK_LINE_PHONE = 'max-md:min-h-11';

/**
 * **A switch on a phone: a 44 × 44px target** (P18.97-T7 AC-6; UI-040: *Agents sell it*, 38 × 22px on every product).
 * The track stays as drawn (`Switch`, `field.tsx`); its transparent input — the control a finger and a screen reader
 * both meet — becomes a 44px square centred on the track, and the switch's line 44px tall, so the square reaches over
 * nothing above or below it. `Switch phoneTarget` puts them on.
 */
export const SWITCH_LINE_PHONE = 'max-md:min-h-11';
export const SWITCH_TAP_PHONE = 'max-md:left-1/2 max-md:top-1/2 max-md:h-11 max-md:w-11 '
  + 'max-md:-translate-x-1/2 max-md:-translate-y-1/2';

/**
 * **A question's chips on a phone: two to a row** (P18.95-T6 AC-1; UI-015: *Primary need*'s eight chips on five
 * lines, *Their biggest hesitation*'s five on five). A grid of two equal columns in place of the wrapping row,
 * so every chip is half the card and the question is half as tall. Put it on the chips' own box.
 */
export const CHIP_GRID_PHONE = 'max-md:grid max-md:grid-cols-2';

/**
 * One chip in that grid: **its column's width, 44px tall at least**, its words allowed onto a second line inside
 * it — *Already has a stable job* — rather than pushing its neighbour off the row. The two chips of a row stand as
 * tall as each other (the grid stretches them).
 */
export const CHIP_PHONE = 'max-md:w-full max-md:min-h-11 max-md:px-2.5 max-md:leading-snug';

/**
 * **A screen's one action, in a bar fixed to the bottom of a phone's screen** (P18.95-T6 AC-1; UI-015: *Build
 * attack plan* at 1,029px). The card's ground with a hairline above it, the page's own 20px gutter, and the
 * home indicator's inset below the action where the phone has one (`env(safe-area-inset-bottom)`, zero where it
 * has none). Under the header (`z-10`) and every dialog, over the page it scrolls above.
 *
 * The page beneath gives it room: `ACTION_BAR_ROOM_PHONE` on the content above, so its last line is never
 * hidden behind the bar.
 */
export const ACTION_BAR_PHONE = 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[9] '
  + 'max-md:border-t max-md:border-hairline max-md:bg-card max-md:px-5 max-md:pt-3 '
  + 'max-md:pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]';

/** The room under the content an `ACTION_BAR_PHONE` stands over: taller than the bar, so nothing is behind it. */
export const ACTION_BAR_ROOM_PHONE = 'max-md:pb-24';

/**
 * **The client's *Remove* verdict on a grey sentence: not drawn on a phone** (P18.95-T7 AC-1; ADR-0167 §7, OD-202 —
 * the review's *Grey text* table). The sentence keeps its words at 768px and wider, where the client has not reviewed
 * it yet (§12, OD-207), and below 768px it is not there. Put it on the sentence's own element, never on a box that
 * holds anything else.
 *
 * Its sibling verdict, *ⓘ* — the sentence moved into an ⓘ beside its subject — is `PhoneTip` (`phone-tip.tsx`): a
 * glyph, so not a class here.
 */
export const REMOVED_ON_PHONE = 'max-md:hidden';
