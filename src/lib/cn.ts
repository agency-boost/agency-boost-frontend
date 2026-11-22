import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `twMerge`, told the theme's sizes it cannot guess. **`text-title` is a font size** (UI V1, UI-004: a page's title,
 * `tailwind.config.ts`): read as a colour, it was dropped beside `text-navy` — the later colour winning — and the title
 * fell back to the body's 13px. The t-shirt sizes (`2xs` … `3xl`) it reads as sizes already.
 *
 * *Changed 2026-11-22 (P19.26-T0 AC-4; ADR-0284 §4):* **`text-row` (15px) and `text-figure` (24px)** too, the phone type
 * scale's two sizes — read as colours, `cn('text-row font-bold text-navy')` dropped the 15px, and a `Button` or a
 * `MemberName` given `text-row` drew at its default size.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['title', 'row', 'figure'] }] } },
});

/** Merge class names, with later Tailwind utilities winning over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
