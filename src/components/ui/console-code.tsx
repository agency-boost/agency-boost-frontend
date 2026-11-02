'use client';

import { useEffect } from 'react';

/**
 * **A failure's code, said to the console instead of the page** (P18.97-T4 AC-10, ADR-0176 §10; UI-032): what
 * `ErrorBanner` draws for a failure the browser detected (`lib/browser-errors.ts`), whose code is internal and carries
 * no request id. Once per failure shown, after it is drawn — never on a re-render — so whoever is debugging has it and
 * the reader is given the sentence alone. Draws nothing.
 *
 * Its own client module, so `field.tsx` stays free of hooks: it is reached from the server's graph too.
 */
export function ConsoleCode({ code, message }: { code: string; message: string }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn(`[${code}] ${message}`);
  }, [code, message]);
  return null;
}
