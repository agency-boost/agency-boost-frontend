import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `twMerge`, told the theme's sizes it cannot guess. **`text-title` is a font size** (UI V1, UI-004: a page's title,
 * `tailwind.config.ts`): read as a colour, it was dropped beside `text-navy` — the later colour winning — and the title
 * fell back to the body's 13px. The t-shirt sizes (`2xs` … `3xl`) it reads as sizes already.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['title'] }] } },
});

/** Merge class names, with later Tailwind utilities winning over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
