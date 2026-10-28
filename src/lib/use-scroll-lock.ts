'use client';

import { useEffect } from 'react';

/** How many open layers hold the page still right now, and what `body` said before the first of them. */
let holders = 0;
let before = '';

/**
 * **The page behind an open layer holds still** (P18.96-T1 AC-2): every dialog, sheet and drawer calls this
 * while it is open, so a wheel or a swipe that reaches past its edge moves nothing behind it.
 *
 * On `body`, which the viewport takes its overflow from (the root's is `visible`). **Counted, not toggled**:
 * a confirmation over the product drawer, or a dialog opened from the phone's menu, is a second lock on top
 * of the first, and the page scrolls again only when the last of them lets go — closing the inner one must
 * not free the page under the outer. Whatever `body` said before the first lock is put back after the last.
 *
 * The box itself keeps scrolling: each caller's own scroll region is `overscroll-contain`, so reaching its
 * end does not hand the scroll on to the page either.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (holders === 0) {
      before = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0) document.body.style.overflow = before;
    };
  }, [active]);
}
