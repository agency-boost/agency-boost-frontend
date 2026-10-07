'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './field';
import { INERT_GLYPH } from './tipped-glyph';

/** One thing the menu can do. */
export interface ActionMenuItem {
  /** What it says, and its accessible name. */
  label: string;
  /** The prototype's glyph beside it (`✓ ✕ 🗑`), hidden from assistive technology. */
  glyph?: string;
  /** Which way the glyph reads: green where it succeeds, red where it does not. */
  tone?: 'neutral' | 'success' | 'alert';
  /** There and not live: still reached by the arrows, announced as unavailable, and doing nothing. */
  disabled?: boolean;
  /** Why it is not live — beneath it on the screen, and its accessible description. */
  reason?: string;
  onSelect: () => void;
}

/** Room left between the menu and the window's edge, and between the menu and its button. */
const EDGE_PX = 8;
const GAP_PX = 4;

const GLYPH_TONE = { neutral: 'text-muted', success: 'text-success', alert: 'text-alert' } as const;

/**
 * A row's actions behind one ⋮ (P13.1-T4 AC-3, ADR-0108 §3).
 *
 * **A real `role="menu"`, because it behaves as one.** The account chip is a disclosure and says why:
 * claiming the menu role without its keys leaves a screen reader pressing keys that do nothing. This
 * one has them, as the ARIA menu-button pattern sets them out — Enter, Space or ↓ open it on the first
 * item and ↑ on the last; ↑ ↓ move round it, Home and End go to the ends; Escape closes it and puts
 * the focus back on ⋮; Tab closes it and moves on from ⋮; a click or a tap anywhere else closes it
 * where the reader is. An item that is not available stays in the list, so the arrows meet it and the
 * reason beneath it is read, and choosing it does nothing.
 *
 * **Choosing puts the focus back on ⋮ first, then acts.** A dialog the item opens records what had the
 * focus and returns it there when it closes, so the reader comes back to the button they left from —
 * not to the top of the page, which is where a focus inside a menu that has gone would leave them.
 *
 * **Fixed to the window, not placed in the row.** The table scrolls inside its own box, and a box that
 * scrolls one way clips the other: the last lead's menu, hung below its row, was cut off at the
 * table's foot. Placed against the window it is never clipped, it opens upward when there is no room
 * below, and it follows its button while the page scrolls.
 */
export function ActionMenu({
  label,
  items,
  inert = false,
}: {
  /** The ⋮ button's accessible name: *Actions for Pak Budi*. */
  label: string;
  items: readonly ActionMenuItem[];
  /** A row that is not yet anything to act on: ⋮ is there and plainly not live, and opens nothing. */
  inert?: boolean;
}) {
  const [open, setOpen] = useState<null | 'first' | 'last'>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  const entries = useCallback(
    () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])],
    [],
  );

  function close(refocus: boolean) {
    setOpen(null);
    if (refocus) trigger.current?.focus();
  }

  /**
   * Below the button, its right edge on the button's — or above it, when the window has no room below.
   *
   * **Written to the element, not kept in state.** A placement in state would draw the menu once
   * unplaced and once placed, and hiding it for the first draw would also make it unfocusable for the
   * moment the first item is being given the focus.
   */
  const position = useCallback(() => {
    const at = trigger.current?.getBoundingClientRect();
    const box = menu.current;
    if (!at || !box) return;
    const height = box.offsetHeight;
    // The viewport without its scrollbars, which is what `position: fixed`'s `right` and `top` are
    // measured in: `innerWidth` counts a classic scrollbar, and put the menu 15px off its button on
    // Windows (the exit review's finding 3).
    const viewport = document.documentElement;
    const below = viewport.clientHeight - at.bottom;
    const up = below < height + GAP_PX + EDGE_PX && at.top > below;
    box.style.top = `${Math.max(EDGE_PX, up ? at.top - height - GAP_PX : at.bottom + GAP_PX)}px`;
    box.style.right = `${Math.max(EDGE_PX, viewport.clientWidth - at.right)}px`;
  }, []);

  // Placed before it is painted, so it never flashes anywhere else first.
  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const all = entries();
    (open === 'first' ? all[0] : all[all.length - 1])?.focus();

    function outside(event: Event) {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || menu.current?.contains(target)) return;
      // Where the reader clicked or tapped is where they are going; the focus is theirs.
      setOpen(null);
    }
    // Capture, and both events: `pointerdown` is a tap as well as a click, and `mousedown` is what a
    // browser without pointer events — and the test DOM — sends.
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open, entries, position]);

  function onTriggerKey(event: React.KeyboardEvent) {
    if (inert) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function onMenuKey(event: React.KeyboardEvent) {
    const all = entries();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      event.preventDefault();
      all[(index + all.length) % all.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown': return go(at + 1);
      case 'ArrowUp': return go(at - 1);
      case 'Home': return go(0);
      case 'End': return go(all.length - 1);
      case 'Escape':
        event.preventDefault();
        return close(true);
      case 'Tab':
        // Back on ⋮ before the browser moves on, so Tab goes to what follows it, not to the page's top.
        return close(true);
      default:
    }
  }

  function choose(item: ActionMenuItem) {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  }

  return (
    <>
      <Button
        ref={trigger}
        id={triggerId}
        variant="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={open ? menuId : undefined}
        aria-disabled={inert || undefined}
        className={cn('text-md font-bold', inert && INERT_GLYPH)}
        onKeyDown={onTriggerKey}
        onClick={() => {
          if (inert) return;
          if (open) close(false);
          else setOpen('first');
        }}
      >
        <span aria-hidden="true">⋮</span>
      </Button>

      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKey}
          className="fixed z-30 min-w-[13rem] max-w-[calc(100vw-1rem)] rounded-md border border-hairline bg-card py-1 shadow-modal"
        >
          {items.map((item) => {
            const itemId = `${menuId}-${item.label.replace(/\W+/g, '-')}`;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                // Named by its label alone; the reason is its description, not part of its name.
                aria-labelledby={`${itemId}-label`}
                aria-describedby={item.disabled && item.reason ? `${itemId}-reason` : undefined}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-start gap-2.5 px-3 py-2 text-left text-md',
                  'hover:bg-navy/[0.04] focus:bg-navy/[0.06]',
                  item.disabled ? 'cursor-not-allowed text-muted' : 'text-navy',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('w-4 shrink-0 text-center', item.disabled ? 'opacity-40' : GLYPH_TONE[item.tone ?? 'neutral'])}
                >
                  {item.glyph}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span id={`${itemId}-label`}>{item.label}</span>
                  {item.disabled && item.reason && (
                    <span id={`${itemId}-reason`} className="text-xs leading-snug text-muted">{item.reason}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
