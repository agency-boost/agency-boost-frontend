'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TEXT_TAP } from '@/components/ui/phone';
import { useMessages } from '@/i18n/language-provider';
import { inlineSaveMessages } from '@/i18n/messages/inline-save';

/**
 * **A field that saves itself says so** (P18.95-T1 AC-5; ADR-0167 §5, OD-200; the client's UI review of
 * 2026-10-26, UI-007: *"inline lead edits save silently"*).
 *
 * Four states, one per field:
 *
 * - **idle** — nothing is drawn;
 * - ***Saving…*** — the write is on its way;
 * - ***Saved ✓*** — it landed, said beside the field for `INLINE_SAVED_MS` and then gone;
 * - ***Couldn't save — retry*** — it did not, and pressing it sends **the same value again**. It stays
 *   until the retry lands, or the field is saved with something else.
 *
 * A whole-form save keeps its `SaveStatus` and a one-tap action its toast (`toast.tsx`); this is for a
 * field with no button of its own — a lead's cell, a select, a checkbox, a date.
 */
export type InlineSaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** How long *Saved ✓* stays beside the field: two seconds (AC-5). */
export const INLINE_SAVED_MS = 2000;

/**
 * The words, once (ADR-0167 §5). The client's own: *Saving… → Saved ✓*, *Couldn't save — retry* — in the catalogue
 * since P18.98-T2 (`messages/inline-save.ts`), in the reader's language; this is their English, the source.
 */
export const INLINE_SAVE_COPY = inlineSaveMessages.en;

/**
 * What one attempt answers: `true` it landed; `false` it failed and may be sent again; `null` it failed
 * and **there is nothing left to retry** — the field now shows something else (a row re-read after a
 * conflict), and sending the old value again would overwrite what replaced it. `null` goes back to idle:
 * whatever replaced the value says why, where it always has.
 */
export type InlineSaveOutcome = boolean | null;

export interface InlineSave {
  /**
   * Send `send` for the field `key`, showing *Saving…* and then its answer. Answers whether it landed.
   *
   * **The latest save of a field is the one it shows.** A second save of the same key while the first is
   * still on its way takes over, and the first one's answer is dropped when it arrives.
   */
  save: (key: string, send: () => Promise<InlineSaveOutcome>) => Promise<boolean>;
  /** The failed field's own `send`, again — the same value, exactly as it went the first time. */
  retry: (key: string) => void;
  /** Back to idle at once, and an answer still on its way for it is dropped: the field has gone. */
  clear: (key: string) => void;
  stateOf: (key: string) => InlineSaveState;
  /** What `InlineSaveStatus` and `InlineSaveField` take for `key`. */
  statusOf: (key: string) => InlineSaveStatusProps;
}

export interface InlineSaveStatusProps {
  state: InlineSaveState;
  /** Absent: a failure says *Couldn't save* with no retry. */
  onRetry?: () => void;
}

/**
 * The four states for **any number of fields** on one screen, each under its own `key`.
 *
 * A thrown `send` is a failure like `false`: the screen's own handler has already said why, beside the
 * field or beneath the row, and this only adds the state and the retry.
 */
export function useInlineSave(): InlineSave {
  const [states, setStates] = useState<Readonly<Record<string, InlineSaveState>>>({});
  const sends = useRef(new Map<string, () => Promise<InlineSaveOutcome>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Which attempt is each field's current one; an answer from any other is dropped. */
  const turns = useRef(new Map<string, number>());
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    const pending = timers.current;
    return () => {
      live.current = false;
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const put = useCallback((key: string, state: InlineSaveState) => {
    if (!live.current) return;
    setStates((now) => {
      if ((now[key] ?? 'idle') === state) return now;
      const next = { ...now };
      if (state === 'idle') delete next[key];
      else next[key] = state;
      return next;
    });
  }, []);

  const stopTimer = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.current.delete(key);
  }, []);

  const save = useCallback(async (key: string, send: () => Promise<InlineSaveOutcome>) => {
    stopTimer(key);
    const turn = (turns.current.get(key) ?? 0) + 1;
    turns.current.set(key, turn);
    sends.current.set(key, send);
    put(key, 'saving');
    let outcome: InlineSaveOutcome;
    try {
      outcome = await send();
    } catch {
      outcome = false;
    }
    if (turns.current.get(key) !== turn) return outcome === true;
    if (outcome === false) {
      put(key, 'failed');
      return false;
    }
    sends.current.delete(key);
    if (outcome === null) {
      put(key, 'idle');
      return false;
    }
    put(key, 'saved');
    if (live.current) {
      timers.current.set(key, setTimeout(() => {
        timers.current.delete(key);
        put(key, 'idle');
      }, INLINE_SAVED_MS));
    }
    return true;
  }, [put, stopTimer]);

  const retry = useCallback((key: string) => {
    const send = sends.current.get(key);
    if (send) void save(key, send);
  }, [save]);

  const clear = useCallback((key: string) => {
    stopTimer(key);
    turns.current.set(key, (turns.current.get(key) ?? 0) + 1);
    sends.current.delete(key);
    put(key, 'idle');
  }, [put, stopTimer]);

  const stateOf = useCallback((key: string) => states[key] ?? 'idle', [states]);
  const statusOf = useCallback(
    (key: string): InlineSaveStatusProps => ({ state: states[key] ?? 'idle', onRetry: () => retry(key) }),
    [states, retry],
  );

  return { save, retry, clear, stateOf, statusOf };
}

/**
 * *Saving…*, *Saved ✓* or *Couldn't save — retry*, beside one field — and nothing at all while idle.
 *
 * **Its own polite live region** (`role="status"`), mounted when the field starts saving and gone two
 * seconds after it has saved, so a screen that is not saving has no extra `status` region (every
 * `Skeleton` and `SaveStatus` is one, and a screen's tests read theirs with `getByRole('status')`). **The
 * words arrive a render after the region**, as the toast's do: a region mounted together with its text
 * is not announced by every screen reader.
 *
 * The words carry the state and the colour repeats it: grey while saving, `--color-success` once saved,
 * `--color-alert` on a failure — each 4.5:1 on a card and on the page. The retry is a real button, named
 * for the field it retries, a 44px target on a phone.
 */
export function InlineSaveStatus({
  state,
  onRetry,
  label,
  className,
}: InlineSaveStatusProps & {
  /** The field's own name — *Remarks, row 3* — which the retry button's name carries after its words. */
  label?: string;
  className?: string;
}) {
  const [said, setSaid] = useState<InlineSaveState>('idle');
  const t = useMessages(inlineSaveMessages);
  useEffect(() => {
    setSaid(state);
  }, [state]);

  if (state === 'idle' && said === 'idle') return null;

  return (
    <span
      role="status"
      data-state={said}
      className={cn(
        'flex items-center whitespace-nowrap text-xs font-semibold leading-tight',
        said === 'saved' ? 'text-success' : said === 'failed' ? 'text-alert' : 'text-muted',
        className,
      )}
    >
      {said === 'saving' && t.saving}
      {said === 'saved' && t.saved}
      {said === 'failed' && (onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label={label ? t.retryField({ field: label }) : undefined}
          className={cn('font-semibold text-alert underline underline-offset-2 hover:no-underline', TEXT_TAP)}
        >
          {t.failed}
        </button>
      ) : t.failedFinal)}
    </span>
  );
}

/**
 * A field that saves itself, with its status **beside it** — on the line under it, inside the same box,
 * so the table's columns and the card's grid keep their widths.
 *
 * A plain block around the field, so what the field fills it still fills. **A retry gives the focus back
 * to the field**: the button that was pressed becomes *Saving…* and goes, and a keyboard would otherwise
 * be left on nothing.
 */
export function InlineSaveField({
  status,
  label,
  className,
  children,
}: {
  status: InlineSaveStatusProps;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const onRetry = status.onRetry && (() => {
    status.onRetry?.();
    box.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  });
  return (
    <div ref={box} className={className}>
      {children}
      <InlineSaveStatus state={status.state} onRetry={onRetry} label={label} className="mt-0.5 px-1.5" />
    </div>
  );
}
