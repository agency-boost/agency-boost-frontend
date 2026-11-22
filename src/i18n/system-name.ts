import { useSyncExternalStore } from 'react';

/**
 * ***Nama sistem*** — a KPM's own name for the app (P19.21-T4 AC-1; ADR-0274; `functional/branding.md`).
 *
 * **One place, not every message file.** The word *AgencyBoost* is written in a hundred messages across twenty-six
 * areas; a KPM that names the app *Dynamic Smart System* reads that name in each of them. Rather than ask every area to
 * take the name as a value, the messages a screen resolves (`useMessages`) are rewritten here, once per area, language
 * and name: every string, and every message function's string result, has *AgencyBoost* written as the name.
 *
 * - **The name comes with the session** (`GET /auth/me`'s `branding.systemName`, set by `applySessionBranding`) and,
 *   on the sign-in pages a KPM's link opens, with the public read (`LinkBranding`). `null` is the default: nothing is
 *   rewritten, and the messages are the very objects the area holds.
 * - **Not rewritten**: words written outside `useMessages` — the PWA's name (`lib/pwa.ts`, kept *AgencyBoost* by the
 *   owner's decision of 3 November), *Powered by AgencyBoost*, the browser tab's title — and a message function's result
 *   that is not a string.
 * - **The prerender reads no name** (the server's snapshot is `null`), so hydration matches the HTML it adopts, and the
 *   session's name is taken up on the client's first read of the session.
 */

/** The app's own name: the word a KPM's name replaces, and every KPM's until it sets one. */
export const DEFAULT_SYSTEM_NAME = 'AgencyBoost';

let current: string | null = null;
const listeners = new Set<() => void>();

/** A name as the store keeps it: trimmed, and `null` for nothing or for the default itself. */
function clean(name: string | null | undefined): string | null {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed && trimmed !== DEFAULT_SYSTEM_NAME ? trimmed : null;
}

/** **Set the name the app is called by** — the session's, a link's — or `null` to call it AgencyBoost again. */
export function setSystemName(name: string | null | undefined): void {
  const next = clean(name);
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

/** The name now, outside React; `null` is AgencyBoost. */
export function currentSystemName(): string | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** **The name, inside React**: re-renders whoever reads it when the session's changes. `null` is AgencyBoost. */
export function useSystemName(): string | null {
  return useSyncExternalStore(subscribe, currentSystemName, () => null);
}

/** **The word *AgencyBoost* written as `name`**, every occurrence; nothing else changes. */
export function withName(text: string, name: string | null): string {
  return name ? text.split(DEFAULT_SYSTEM_NAME).join(name) : text;
}

/** A React element, a Date, a class instance: not a message tree, and never rewritten. */
function isTree(value: object): boolean {
  if ('$$typeof' in value) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rewrite(value: unknown, name: string): unknown {
  if (typeof value === 'string') return withName(value, name);
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => {
      const result = fn(...args);
      return typeof result === 'string' ? withName(result, name) : result;
    };
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, name));
  if (value && typeof value === 'object' && isTree(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item, name)]));
  }
  return value;
}

/** Each area's messages in one language, rewritten once per name. */
const rewritten = new WeakMap<object, Map<string, unknown>>();

/**
 * **A resolved message tree in the KPM's name** — what `useMessages` returns. `null` returns the tree itself; a name
 * returns a copy made once and kept for that tree and name, so a screen re-rendering reads the same functions.
 */
export function messagesInName<T>(messages: T, name: string | null): T {
  if (!name || typeof messages !== 'object' || messages === null) return messages;
  let byName = rewritten.get(messages as object);
  if (!byName) {
    byName = new Map();
    rewritten.set(messages as object, byName);
  }
  if (!byName.has(name)) byName.set(name, rewrite(messages, name));
  return byName.get(name) as T;
}
