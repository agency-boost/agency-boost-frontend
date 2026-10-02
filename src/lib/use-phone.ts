'use client';

import { useEffect, useState } from 'react';

/**
 * Narrower than Tailwind's `md`, 768px: where the shell's sidebar becomes a bar across the top and
 * its nav goes into the account chip's panel (ADR-0085).
 */
export const PHONE_QUERY = '(max-width: 767.98px)';

/**
 * Is the screen narrower than 768px?
 *
 * **False on the server and on the first client render**, so the two agree and there is nothing to
 * reconcile; the media query answers in an effect, and again whenever the width crosses the line —
 * a phone turned on its side, a desktop window narrowed. False as well where there is no
 * `matchMedia`, which is jsdom: the desktop shell is the one every existing spec was written against,
 * and a spec about the phone says so by stubbing it.
 */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return phone;
}
