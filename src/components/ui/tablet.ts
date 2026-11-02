/**
 * **What changes below 1024px** — Tailwind's `lg` — on a tablet and, with it, a phone (ADR-0178; the client's KPM Owner
 * review of 2026-10-27, UI-038; P18.97-T6 AC-4). `phone.ts` is the phone's alone, below 768px; this is the finding
 * the client scoped *Mobile + Tablet*.
 *
 * **Strings only, and nothing else in this file**, as `phone.ts`, for the same reason: what holds a class is reached
 * from the server's graph as well as the client's. The tab row's behaviour is `use-tab-row.ts`.
 *
 * Every class here carries `max-lg:`, so a desktop (1024px and wider) renders exactly as it did: a finding changes the
 * sizes it lists and no other (ADR-0178 §6). `tablet.spec.ts` fails on a class without the prefix.
 */

/**
 * A tab strip that is **one row that scrolls sideways below 1024px**, never two lines (UI-038: `/people/members`'
 * *Directory · Pending · Removed · Role change log · Groups* on two rows at 768px and at 375px). `TAB_ROW_PHONE`'s
 * three classes, a range wider; the row scrolls inside its own box, so the page never does.
 */
export const TAB_ROW_BELOW_DESKTOP = 'max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:overflow-y-hidden';

/**
 * The underlined strip's hairline painted inside the box below 1024px, as `UNDERLINED_ROW_PHONE` does below 768px:
 * a box that scrolls would clip the 1px by which the current tab's amber rule overlaps it (`-mb-px`), and scroll a
 * pixel up and down.
 */
export const UNDERLINED_ROW_BELOW_DESKTOP = 'max-lg:border-b-0 max-lg:shadow-[inset_0_-1px_0_var(--color-hairline)]';

/** One tab in that row: `TAB_PHONE`, below 1024px — its words on one line, unsqueezed, its ring inside its edge. */
export const TAB_BELOW_DESKTOP = 'max-lg:mb-0 max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:focus-visible:[outline-offset:-2px]';

/**
 * What the row says about itself, so `globals.css` fades it on the side that has more below 1024px as well as below
 * 768px: the phone's fade is every strip's there, and from 768px only a row that says this keeps one.
 */
export const BELOW_DESKTOP_ROW = { 'data-tab-row': 'below-desktop' } as const;

/**
 * **The client's per-size verdicts on a grey sentence, from 1024px *Show* and below it *ⓘ*** (P18.97-T4 AC-6, ADR-0176
 * §6; the grey-text table of 2026-10-27, UI-027): the sentence stands from 1024px, and below 1024px it is not drawn —
 * its words are behind an ⓘ beside its subject (`BelowDesktopTip`, `below-desktop-tip.tsx`), on a tablet and, where the
 * row says *ⓘ* on a phone too, on a phone. Put it on the sentence's own element, never on a box holding anything else.
 */
export const SHOWN_FROM_DESKTOP = 'max-lg:hidden';
