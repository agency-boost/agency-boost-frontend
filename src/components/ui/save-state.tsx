'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { Dialog } from './dialog';

/** Where an explicit save stands: nothing to save, something to save, or on its way. */
export type SaveState = 'saved' | 'unsaved' | 'saving';

/**
 * Two values the same, **by what they hold**: objects key by key whatever their order, arrays in order, numbers and
 * strings by value. What a form holds and what the server saved are compared this way, so a toggle switched and back,
 * or a value changed and changed back, is *saved* again (UI-019).
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length
    && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * **The shared save state** (UI V1, UI-019 and UI-039; the report's *Save state "Belum disimpan" → "Tersimpan ✓"*): it
 * **compares what the form holds with what was saved**, rather than remembering that something was typed — so undoing
 * a change, or switching a mode and back, reads *Tersimpan* again (UI-019's bug).
 *
 * - `state`: `saving` while `saving` is true; else `unsaved` when `current` differs from `saved`, else `saved`.
 * - **Warns before leaving with unsaved changes** (UI-039), unless `warnOnLeave` is false: closing or reloading the tab
 *   asks the browser's own question (`beforeunload`), and **a link inside the app** is held and asked about in the
 *   product's own `Dialog` — render `guard` once on the screen. Choosing to leave follows the link.
 *
 * `compare` replaces `sameValue` where two shapes mean the same (a blank and a `null` note, say).
 */
export function useSaveState<T>(
  current: T,
  saved: T,
  {
    saving = false,
    warnOnLeave = true,
    compare = sameValue,
  }: { saving?: boolean; warnOnLeave?: boolean; compare?: (a: T, b: T) => boolean } = {},
): { state: SaveState; dirty: boolean; guard: ReactNode } {
  const dirty = !compare(current, saved);
  const state: SaveState = saving ? 'saving' : dirty ? 'unsaved' : 'saved';
  const guard = <LeaveGuard active={warnOnLeave && dirty} />;
  return { state, dirty, guard };
}

/**
 * **Holds a reader who is about to leave unsaved work** (UI-039). While `active`: the browser asks before the tab closes
 * or reloads, and a click on a link to another page of the app is stopped and asked about here first. Leaving follows
 * the same link, so the app's own navigation carries on as it would have.
 */
export function LeaveGuard({ active }: { active: boolean }) {
  const t = useMessages(uiV1Messages);
  const [held, setHeld] = useState<HTMLAnchorElement | null>(null);
  const letThrough = useRef(false);

  useEffect(() => {
    if (!active) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers read the question from here; every current one shows its own words.
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (letThrough.current) {
        letThrough.current = false;
        return;
      }
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setHeld(link);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);

  return (
    <Dialog
      open={held !== null}
      message={t.save.leave}
      confirmLabel={t.save.leaveConfirm}
      cancelLabel={t.save.stay}
      tone="danger"
      onCancel={() => setHeld(null)}
      onConfirm={() => {
        const link = held;
        setHeld(null);
        letThrough.current = true;
        link?.click();
      }}
    />
  );
}

const STATE_CLASS: Record<SaveState, string> = {
  unsaved: 'text-pill-amber-ink',
  saving: 'text-muted',
  saved: 'text-signal-green',
};

/**
 * ***Belum disimpan*** in amber, ***Menyimpan…***, ***Tersimpan ✓*** in green — beside the save button (UI-019,
 * UI-039), 13px. No dot (D-27): the words carry the state and the colour repeats it, both above 4.5:1 on white.
 *
 * **The screen's live region** (`role="status"`), so the change is heard; a screen has one.
 */
export function SaveStateLabel({ state, className }: { state: SaveState; className?: string }) {
  const t = useMessages(uiV1Messages);
  return (
    <span
      role="status"
      data-state={state}
      className={cn('inline-flex items-center whitespace-nowrap text-base font-semibold', STATE_CLASS[state], className)}
    >
      {state === 'unsaved' ? t.save.unsaved : state === 'saving' ? t.save.saving : t.save.saved}
    </span>
  );
}

/**
 * **The floating save pill** (UI V1, UI-015 and UI-018 — Goal Setting on a phone and a tablet, and the agent's *Goal
 * Setting* tab in Coaching): a white pill, shadowed, 12px from the sides, **pinned just above the bottom tab bar at every
 * scroll position** (`--tab-bar-space`, the shell's) — the save state on the left, the accent's 44px save on the right.
 *
 * Below 1024px only; a desktop puts the same two at the foot of its sticky column (UI-022), the page's. A page that
 * draws it leaves room under its last line (`FLOATING_SAVE_ROOM`), so nothing ends hidden behind it.
 */
export function FloatingSavePill({
  state,
  label,
  onSave,
  disabled = false,
  form,
  className,
}: {
  state: SaveState;
  /** The button's words: *Simpan goal*. */
  label: string;
  /** Absent when the button submits a form (`form`). */
  onSave?: () => void;
  /** Held while there is nothing to save, or while saving; a held button says why where the caller can. */
  disabled?: boolean;
  /** The id of the form the button submits. */
  form?: string;
  className?: string;
}) {
  return (
    <div
      data-floating-save=""
      className={cn(
        // Above the tab bar where the shell draws one (its room counts the home indicator); above the home indicator where not.
        'fixed inset-x-3 bottom-[max(calc(var(--tab-bar-space)+0.75rem),calc(env(safe-area-inset-bottom)+0.75rem))] z-[9]',
        'flex items-center gap-3 rounded-pill bg-card py-1.5 pl-4 pr-1.5 shadow-modal lg:hidden',
        className,
      )}
    >
      <SaveStateLabel state={state} className="min-w-0 flex-1" />
      <button
        type={form ? 'submit' : 'button'}
        form={form}
        onClick={onSave}
        disabled={disabled || state === 'saving'}
        className="min-h-11 shrink-0 rounded-pill bg-amber px-5 text-md font-bold text-navy hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}

/** The room a page leaves under its last line while a `FloatingSavePill` floats over its foot (below 1024px). */
export const FLOATING_SAVE_ROOM = 'max-lg:pb-24';
