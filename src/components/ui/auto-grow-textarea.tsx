'use client';

import { useLayoutEffect, useRef } from 'react';
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

  useLayoutEffect(() => {
    const el = ref.current;
    // Type narrowing rather than a case that happens: `useLayoutEffect` runs after the ref is
    // attached, so this cannot be taken — which is why coverage never reaches it.
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <Textarea {...props} ref={ref} value={value} rows={1} density="cell" className={className} />;
}
