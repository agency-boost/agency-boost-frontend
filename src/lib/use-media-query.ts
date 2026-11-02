'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * **The three sizes every screen is drawn for, named once** (P18.97-T6 AC-2, ADR-0178; the client's scope tags of
 * 2026-10-27: *Mobile* below 768px, *Tablet* 768–1023px, *Desktop* 1024px and wider). A finding changes the sizes it
 * lists and no other, so a screen that changes by size asks for one of these, never a width of its own.
 *
 * The lines are Tailwind's `md` (768px) and `lg` (1024px), so a hook's answer and a `max-md:`, `md:max-lg:` or
 * `max-lg:` class change at the same pixel. Each upper edge is `.98` under the next line, as `PHONE_QUERY` always was:
 * a fractional width — a zoomed page — falls in one range, not two.
 */
export const MEDIA_RANGES = {
  phone: '(max-width: 767.98px)',
  tablet: '(min-width: 768px) and (max-width: 1023.98px)',
  desktop: '(min-width: 1024px)',
} as const;

export type MediaRange = keyof typeof MEDIA_RANGES;

/** Before the browser paints. The server has no width to read, and no effect runs there (as `use-tab-row.ts`). */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * **Is the screen in one of these ranges?** `useMediaQuery('tablet')`; `useMediaQuery(['phone', 'tablet'])` for
 * *below 1024px*. It follows the width when it crosses a line — a tablet turned on its side, a window narrowed.
 *
 * **False on the server and on the first client render**, so the two agree and there is nothing to reconcile. False
 * as well where there is no `matchMedia`, which is jsdom: the desktop is what every existing spec was written against,
 * and a spec about another size says so by stubbing it (`atWidth`, `test/harness.tsx`).
 *
 * **When it answers.** In an effect, by default — after the first paint, as `usePhone` always has, so a screen asks
 * where it mounts, before its read, and the frame before the answer is a skeleton. **`beforePaint`** answers before
 * the first paint instead, for what is drawn the moment it mounts and would otherwise show one frame of the other
 * size: the shell's sidebar, which opens on the rail on a tablet (P18.97-T6 AC-1). Its answer re-renders inside the
 * mounting commit, so it is kept to the one caller that needs it. A caller passes the same `beforePaint` for its life.
 *
 * **Ask for the range that changes something.** The desktop is what a screen draws when nothing answers, so a screen
 * that differs below 1024px asks `['phone', 'tablet']` — never `!useMediaQuery('desktop')`, which would be true on the
 * first render and wherever no width can be read.
 *
 * `usePhone()` is `useMediaQuery('phone')`.
 */
export function useMediaQuery(
  ranges: MediaRange | readonly MediaRange[],
  { beforePaint = false }: { readonly beforePaint?: boolean } = {},
): boolean {
  const [matches, setMatches] = useState(false);
  // One string, so the effect's dependency is a value and a caller's fresh array never re-subscribes it.
  const key = (typeof ranges === 'string' ? [ranges] : ranges).join(' ');
  const useAnswer = beforePaint ? useBeforePaint : useEffect;

  useAnswer(() => {
    if (typeof window.matchMedia !== 'function' || key === '') return;
    const lists = key.split(' ').map((name) => window.matchMedia(MEDIA_RANGES[name as MediaRange]));
    const update = () => setMatches(lists.some((list) => list.matches));
    update();
    for (const list of lists) list.addEventListener('change', update);
    return () => {
      for (const list of lists) list.removeEventListener('change', update);
    };
  }, [key]);

  return matches;
}
