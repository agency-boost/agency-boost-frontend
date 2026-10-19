'use client';

import { useEffect, useState } from 'react';

/**
 * The value, held still until typing stops.
 *
 * Two screens search the server as you type, and both used the raw input: a request per
 * keystroke, each one answering a query the reader had already moved on from. That was
 * survivable only because the results stayed on screen through the wait — which was the
 * real defect, since the previous query's people look exactly like an answer to the new
 * one.
 *
 * Clearing the results fixes that and makes the missing debounce visible: a skeleton
 * flashing on every letter is its own kind of noise. So the two go together. One request
 * per pause, one placeholder per pause.
 *
 * 300ms is chosen against typing, not against the network: below about 250ms a fluent
 * typist still fires mid-word, and above ~400ms the pause starts to read as the page
 * ignoring you.
 */
export const SEARCH_DEBOUNCE_MS = 300;

export function useDebounced<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
