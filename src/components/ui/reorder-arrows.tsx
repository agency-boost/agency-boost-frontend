'use client';

import { useEffect, useRef } from 'react';
import { Button } from './field';

/**
 * **↑ and ↓ for a list reordered by drag, on a phone** (P18.97-T7 AC-6, ADR-0178 §5; the client's UI-040 of 2026-10-27).
 *
 * A drag never starts on a touch screen — HTML5 drag does not fire there — and the handle's own ↑ ↓ keys need a
 * keyboard, so a phone could not reorder the list at all. Two buttons, each a 44 × 44px target (`Button variant="icon"`,
 * `TAP_TARGET`), named for what they move — *Move Learn insurance basics up* — so a screen reader and a switch user meet
 * them as a keyboard user does. A screen draws them below 768px only, beside the handle, and moves the row through the
 * same function the handle's keys call.
 *
 * **At the ends they stay, unavailable** (`aria-disabled`): the first row's ↑ and the last row's ↓ do nothing and say
 * so, and keep the focus — a button that went `disabled` under the reader's finger would drop it on the page.
 *
 * **The focus follows the row.** A row that moves is re-ordered in the DOM, and a browser drops the focus of a node it
 * moves; so the arrow that was pressed takes the focus back once the row has its new place (`index`).
 */
export function ReorderArrows({
  label,
  index,
  count,
  onMove,
  disabled = false,
}: {
  /** What moves, for the buttons' names. */
  label: string;
  /** The row's place among the `count` it moves among. */
  index: number;
  count: number;
  /** `-1` up, `1` down — the handle's own keys' call. */
  onMove: (by: -1 | 1) => void;
  /** A write is out: both say so and do nothing. */
  disabled?: boolean;
}) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const pressed = useRef<'up' | 'down' | null>(null);

  useEffect(() => {
    const which = pressed.current;
    if (which === null) return;
    pressed.current = null;
    (which === 'up' ? up : down).current?.focus();
  }, [index]);

  const top = index <= 0;
  const bottom = index >= count - 1;
  const move = (by: -1 | 1) => {
    if (disabled || (by < 0 ? top : bottom)) return;
    pressed.current = by < 0 ? 'up' : 'down';
    onMove(by);
  };
  const ends = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted';

  return (
    <span className="flex shrink-0 items-center">
      <Button
        ref={up}
        variant="icon"
        aria-label={`Move ${label} up`}
        aria-disabled={disabled || top || undefined}
        className={ends}
        onClick={() => move(-1)}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        ref={down}
        variant="icon"
        aria-label={`Move ${label} down`}
        aria-disabled={disabled || bottom || undefined}
        className={ends}
        onClick={() => move(1)}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </span>
  );
}
