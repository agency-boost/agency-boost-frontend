'use client';

import { MEDIA_RANGES, useMediaQuery } from '@/lib/use-media-query';

/**
 * Narrower than Tailwind's `md`, 768px: where the shell's sidebar becomes a bar across the top and
 * its nav goes into the drawer the bar's ☰ opens (P18.95-T2, ADR-0167 §3; until then the account chip's
 * panel, ADR-0085).
 *
 * The phone's range of the three `useMediaQuery` names (`lib/use-media-query.ts`, P18.97-T6 AC-2), so the string a
 * spec's `matchMedia` stub answers is the one the hook asks.
 */
export const PHONE_QUERY = MEDIA_RANGES.phone;

/**
 * Is the screen narrower than 768px?
 *
 * `useMediaQuery('phone')`, and its rules, as they always were (P18.97-T6 AC-2): **false on the server and on the
 * first client render**, so the two agree and there is nothing to reconcile; the media query answers in an effect,
 * and again whenever the width crosses the line — a phone turned on its side, a desktop window narrowed. False as
 * well where there is no `matchMedia`, which is jsdom: the desktop shell is the one every existing spec was written
 * against, and a spec about the phone says so by stubbing it.
 */
export function usePhone(): boolean {
  return useMediaQuery('phone');
}
