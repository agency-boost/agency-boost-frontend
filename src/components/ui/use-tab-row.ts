'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A tab strip's behaviour on a phone (ADR-0167; UI-013; P18.95-T1 AC-8): the edge fade on the side that
 * has more, and the current tab scrolled into view. Its classes are `phone.ts`'s `TAB_ROW_PHONE` and
 * `TAB_PHONE`; the fade itself is drawn by `globals.css` below 768px only.
 */

export type Fade = 'start' | 'end' | 'both';

/** Kept clear of the fade when the current tab is brought into view: `--tab-fade`, 1.5rem. */
const FADE_REM = 1.5;

/**
 * Which side of a scrolling row has more to show: `data-fade` on the row, which `globals.css` fades on a
 * phone. Undefined when it all fits — always, at 768px and wider, where a tab strip wraps as it always did.
 */
export function fadeOf(row: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>): Fade | undefined {
  const more = row.scrollWidth - row.clientWidth;
  if (more <= 1) return undefined;
  const before = row.scrollLeft > 1;
  const after = row.scrollLeft < more - 1;
  if (before && after) return 'both';
  if (before) return 'start';
  return after ? 'end' : undefined;
}

/**
 * Scrolls `row` sideways, and only `row`, until `tab` is in view clear of the fade.
 *
 * **Not `scrollIntoView`.** That scrolls every scrolling ancestor, the page included, to show the tab: a
 * page restored half-way down on *Back* would be pulled up to its tab row. Here the page never moves.
 */
export function reveal(row: HTMLElement, tab: HTMLElement) {
  const box = row.getBoundingClientRect();
  const on = tab.getBoundingClientRect();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const clear = FADE_REM * rem;
  if (on.left < box.left + clear) row.scrollLeft -= box.left + clear - on.left;
  else if (on.right > box.right - clear) row.scrollLeft += on.right - (box.right - clear);
}

/**
 * Before the browser paints, so a strip that opens on its fourth tab is drawn scrolled to it rather than
 * drawn at its start and then jumping. The server has no layout to read, and no effect runs there.
 */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The current tab, by what the strip already says about it: `aria-current` on a link, `aria-selected` on a tab. */
const CURRENT = '[aria-current]:not([aria-current="false"]), [aria-selected="true"]';

/**
 * A tab strip's phone behaviour: the fade on the side that has more, and the current tab scrolled into
 * view when the strip mounts and whenever `current` changes.
 *
 * Put `ref` and `data-fade={fade}` on the row. The strip's roles, names, keyboard and focus order are
 * not touched — this reads the row and scrolls it, nothing else.
 *
 * jsdom lays nothing out: every width is 0, so the row never has more and nothing scrolls, and the specs
 * written against the desktop strip see exactly what they saw. `phone.spec.tsx` gives the row widths.
 */
export function useTabRow<T extends HTMLElement>(current: unknown) {
  const ref = useRef<T | null>(null);
  const [fade, setFade] = useState<Fade | undefined>(undefined);

  useBeforePaint(() => {
    const row = ref.current;
    if (!row) return;
    const measure = () => setFade(fadeOf(row));
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // The row's own box changing size: a phone turned on its side, a sidebar collapsing.
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resized?.observe(row);
    // Tabs arriving or changing after the row mounts — the training categories, a badge's count — give
    // it more without its box changing size, which no observer of the box would see.
    const changed = typeof MutationObserver === 'function' ? new MutationObserver(measure) : null;
    changed?.observe(row, { childList: true, subtree: true, characterData: true });
    return () => {
      row.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      resized?.disconnect();
      changed?.disconnect();
    };
  }, []);

  useBeforePaint(() => {
    const row = ref.current;
    const tab = row?.querySelector<HTMLElement>(CURRENT);
    if (!row || !tab) return;
    reveal(row, tab);
    setFade(fadeOf(row));
  }, [current]);

  return { ref, fade };
}
