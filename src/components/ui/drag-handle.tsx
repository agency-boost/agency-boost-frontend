'use client';

/**
 * The grab affordance on a reorderable row — the prototype's `⠿` (`KPM_Owner.html:1506`).
 *
 * **A real `<button>`, and the keyboard path.** The ↑↓ buttons that used to sit on every
 * row were the only way to reorder without a pointer; removing them for the drag handle
 * alone would have left the screen unusable by keyboard and unusable on touch, where HTML5
 * drag does not fire at all. So the handle *is* both: grab it with a pointer, or focus it
 * and press ↑/↓. One control, two ways to work it, and one row instead of three buttons.
 *
 * **The drag image is the whole row.** `draggable` on the handle means the browser lifts
 * the handle — six dots floating over a list, while the row itself only dimmed. Pointing
 * `setDragImage` at the row is what makes the thing you are moving look like the thing you
 * are moving.
 *
 * **On a phone a drag never starts** (HTML5 drag does not fire on touch), so a list reordered by drag offers ↑ and ↓
 * beside it there, `ReorderArrows` (P18.97-T7 AC-6, ADR-0178 §5); a screen whose handles are 44 × 44px targets on a
 * phone passes `cn(DRAG_HANDLE_CLASS, TAP_TARGET)`.
 */
/** The handle's look where its caller names none: the prototype's grey `⠿`, a grab cursor. */
export const DRAG_HANDLE_CLASS = 'cursor-grab select-none text-md text-muted disabled:cursor-not-allowed';

export function DragHandle({
  id,
  label,
  onPick,
  onDrop,
  onMove,
  disabled,
  className,
}: {
  /** For a caller that puts the focus back on it once its row has moved (the leads table, P18.8-T7). */
  id?: string;
  /** What is being moved, for the accessible name. */
  label: string;
  onPick: () => void;
  onDrop: () => void;
  /** Keyboard reorder: `-1` up, `1` down. */
  onMove: (by: -1 | 1) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      draggable={!disabled}
      disabled={disabled}
      aria-label={`Reorder ${label}. Press the up or down arrow to move it.`}
      className={className ?? DRAG_HANDLE_CLASS}
      onDragStart={(e) => {
        const row = e.currentTarget.closest('li, [data-row]');
        if (row) e.dataTransfer.setDragImage(row as Element, 12, 12);
        e.dataTransfer.effectAllowed = 'move';
        onPick();
      }}
      onDragEnd={onDrop}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        // The page would otherwise scroll out from under the row being moved.
        e.preventDefault();
        onMove(e.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      ⠿
    </button>
  );
}
