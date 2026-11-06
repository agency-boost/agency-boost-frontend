import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api-client';
import type { SurveyPending } from './surveys';

/*
 * **The reminder's store, apart from the surveys' client** (C-R2; the bundle, 2026-11-06; `performance-and-scale.md`):
 * the shell's tab bar draws the *Lainnya* dot on every page from it, and `surveys.ts` — the forms, the results, the
 * runs — is a page's, not the shell's. `surveys.ts` re-exports these four, so there is one store whichever is imported.
 */

/**
 * **One read of `/surveys/pending` for the whole shell** (C-R2): the *Lainnya* dot, the sheet's cards, the *Survei*
 * tile's dot and Home's popup read the same answer, so they never disagree. Read once a page load; read again after
 * an answer, *Kirim* or a popup drawn (`refreshPending`). A reader with no office, or one the API refuses, has none.
 */
let pending: SurveyPending | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function refreshPending(): Promise<void> {
  loading = api<SurveyPending>('/surveys/pending')
    .then((next) => { pending = next; })
    .catch(() => { pending = null; })
    .finally(() => { loading = null; notify(); });
  return loading;
}

/** For a test: forget what was read. */
export function resetPending(value: SurveyPending | null = null): void {
  pending = value;
  loading = null;
  notify();
}

/** The shell's pending surveys; `null` until read, or for a reader with none to read. */
export function useSurveyPending(enabled = true): SurveyPending | null {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => pending,
    () => null,
  );
  useEffect(() => {
    if (enabled && pending === null && loading === null) void refreshPending();
  }, [enabled]);
  return enabled ? value : null;
}

/** C-R2: the dot on *Lainnya* and on the *Survei* tile — a run open and not sent. */
export const hasSurveyDot = (p: SurveyPending | null) => (p?.open.length ?? 0) > 0;
