/**
 * **The failures this app detects itself, which no server answered** (P18.97-T4 AC-10, ADR-0176 §10; the client's
 * UI-032: *"Could not reach the server. Check your connection and try again."* followed by a raw *NETWORK*): the
 * request never arrived (`NETWORK`), the app is misconfigured (`CONFIG`), or the screen broke (`UNEXPECTED`) —
 * `toDisplayError`'s three outcomes that are not the server's — and the roster import's file the browser could not
 * read (`FILE_UNREADABLE`). None carries a request id, so there is nothing on it for support to look up, and its code
 * is internal: it goes to the console, and the reader is given the sentence.
 *
 * **No hooks, and no `'use client'`**: `field.tsx`, which draws `ErrorBanner`, is reached from the server's graph as
 * well as the client's (`phone.ts` says why), and a client module's export cannot be called there.
 */
export const BROWSER_DETECTED_CODES = ['NETWORK', 'UNEXPECTED', 'CONFIG', 'FILE_UNREADABLE'] as const;

export type BrowserDetectedCode = (typeof BROWSER_DETECTED_CODES)[number];

/** Did the browser detect this failure, rather than a server answer it? */
export function isBrowserDetected(code: string): code is BrowserDetectedCode {
  return (BROWSER_DETECTED_CODES as readonly string[]).includes(code);
}

/**
 * **What a failure shows for support to quote** — a server's code and its request id (*PERM_DENIED · r-1*), or its
 * code alone where it carries no id — and `null` for a failure the browser detected, which shows its sentence alone.
 */
export function errorReference({ code, requestId }: { code: string; requestId?: string }): string | null {
  if (isBrowserDetected(code)) return null;
  return requestId && requestId !== 'unknown' ? `${code} · ${requestId}` : code;
}
