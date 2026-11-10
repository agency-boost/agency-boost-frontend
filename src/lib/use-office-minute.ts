'use client';

import { useEffect, useRef, useState } from 'react';

/** A read's clock: the office's minute of the day when it was made, and the instant. */
export interface OfficeNow {
  /** Minutes since the office's midnight, 0 to 1439. */
  minute: number;
  /** The instant the read was made, ISO; absent, the minute does not move. */
  at?: string;
}

/**
 * **The office's minute of the day, from the read, moved on each minute** (P12-T2 AC-3; P19.11-T1 AC-5). The browser's
 * clock is used only to count the minutes since the read answered, never to say what day or what time it is; **past
 * midnight the page reads again** (`onMidnight`) and the server says what today is (invariant §9).
 *
 * The Calendar's now-line and its rollover, and Home's *Aksi hari ini*, which turns with the office's day. Moved here from
 * `calendar-screen.tsx` (2026-11-10) so both read the one rule.
 */
export function useOfficeMinute(now: OfficeNow | undefined, onMidnight: () => void): number | null {
  const [elapsed, setElapsed] = useState(0);
  const at = now?.at;
  const midnight = useRef(onMidnight);
  midnight.current = onMidnight;

  useEffect(() => {
    setElapsed(0);
    if (!at) return undefined;
    const started = Date.now();
    const seconds = Number.isNaN(Date.parse(at)) ? 0 : new Date(at).getUTCSeconds() * 1000;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started + seconds) / 60_000)), 15_000);
    return () => clearInterval(timer);
  }, [at]);

  const minute = now ? now.minute + elapsed : null;
  const past = minute !== null && minute >= 24 * 60;
  useEffect(() => {
    if (past) midnight.current();
  }, [past]);
  return minute === null ? null : Math.min(minute, 24 * 60 - 1);
}
