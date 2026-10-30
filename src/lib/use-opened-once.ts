import { useState } from 'react';

/**
 * **True from the first time `open` is, and ever after** (P18.99-T16, the bundle): when a dialog loaded with
 * `next/dynamic` may mount. Mounted from its first opening — not with the page — its module is fetched on the tap that
 * opens it, and stays mounted closed after, as it always was, so what it holds between openings (a code it read once, a
 * draft) holds as before. The dialog itself still draws nothing while closed.
 *
 * `{useOpenedOnce(open) && <LazyDialog open={open} … />}`
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  // Derived from the render before (React's "storing information from previous renders"): no effect, no extra frame.
  if (open && !opened) setOpened(true);
  return open || opened;
}
