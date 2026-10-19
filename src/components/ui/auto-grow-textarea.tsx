'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Textarea } from './field';

/**
 * A text cell that starts one line tall and grows to what is in it.
 *
 * The prototype's remarks cell is `<textarea rows="1">` resized to its own `scrollHeight` on every
 * input (`Overall.html:5556-5559`), with `resize:none;overflow:hidden` so the handle and the scrollbar
 * never appear. In a table that matters: a fixed two-row box wastes a row on every lead with no
 * remark and hides the second half of every long one.
 *
 * **Lives here rather than in `field.tsx`** because it needs a hook, and `field.tsx` is imported by
 * `skeleton.tsx`, which is deliberately not a client component so `loading.tsx` can render it
 * directly. One `'use client'` in that file would pull every route group's loading state into the
 * client bundle.
 *
 * **`useLayoutEffect`, not `useEffect`.** The height has to be right in the same frame the value
 * changes, or the row visibly jumps as you type. It runs on `value` so a programmatic change — a row
 * reloading after a refused save — resizes too, not only typing.
 *
 * **And again whenever the box changes width, and once the web font has loaded** (P13.1-T4 AC-6). A
 * height measured only when the value changes is the height of whatever width the box had then: the
 * table's columns settling, the sidebar folding, a phone turned on its side, or the fallback font's
 * wider letters before Inter arrived. A one-line remark measured while it wrapped onto three kept three
 * lines' height after it fitted on one, and the client read the empty two as blank lines in the seed
 * (2026-10-07). Only a change of **width** re-measures: setting the height is itself a resize, and
 * answering that would measure forever.
 *
 * **The border counts.** `scrollHeight` is the content and the padding; under `box-sizing:
 * border-box`, which Tailwind's preflight gives everything, `height` includes the border as well, so a
 * box set to its `scrollHeight` alone is one border short and a single line scrolls inside it.
 */
export function AutoGrowTextarea({
  value,
  className,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  value: string;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    // Type narrowing rather than a case that happens: every caller runs after the ref is attached
    // and stops before it is detached — which is why coverage never reaches it.
    if (!el) return;
    el.style.height = 'auto';
    const style = window.getComputedStyle(el);
    const border = style.boxSizing === 'border-box'
      ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
      : 0;
    el.style.height = `${el.scrollHeight + border}px`;
  }, []);

  useLayoutEffect(measure, [value, measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    /*
     * **The observer's first report is the width the box was drawn at**, which the layout effect has just
     * measured for: it is recorded, not answered. Seeding it from `getBoundingClientRect` compared a
     * border-box width with the observer's content-box one, so every box measured twice on arrival — some
     * three hundred forced layouts after *Show more* on a long list (the exit review's finding 1).
     */
    let width: number | null = null;
    // No observer where there is none to have — jsdom, and browsers older than the product supports.
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => {
        const next = entries[entries.length - 1]?.contentRect.width;
        if (next === undefined || next === width) return;
        const first = width === null;
        width = next;
        if (!first) measure();
      })
      : null;
    observer?.observe(el);
    // `document.fonts` is optional in the DOM's types and absent in jsdom. A font set that has already
    // loaded has nothing to wait for, and its `ready` would only measure again what was just measured.
    if (document.fonts && document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (live) measure();
      });
    }
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [measure]);

  return <Textarea {...props} ref={ref} value={value} rows={1} density="cell" className={className} />;
}
