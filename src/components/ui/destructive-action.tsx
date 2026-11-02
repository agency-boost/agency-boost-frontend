'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { ActionMenuItem } from './action-menu';
import { Dialog } from './dialog';

/**
 * **A destructive action: last, red, and asked about first** (UI V1, UI-024 and UI-083; D-06, D-27) — *Batalkan
 * undangan* in an invitation's ⋯, *Keluarkan* in the role sheet and the desktop table's ⋯. Never a red button on the
 * row itself.
 *
 * `useDestructiveAction` gives both shapes from one description: `item` for an `ActionMenu` (red, `tone: 'alert'`; put
 * it last with `destructiveLast`), `row` for the foot of a sheet, and `dialog`, the confirmation, which the screen
 * renders once. Choosing either opens the confirmation; only its confirming button acts.
 */
export function useDestructiveAction({
  label,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled = false,
}: {
  /** *Keluarkan*, *Batalkan undangan*. */
  label: string;
  /** The question: *Keluarkan Siti Rahmawati dari tim Anda?* */
  message: string;
  /** What the confirming button says: *Keluarkan*. */
  confirmLabel: string;
  /**
   * What the button that backs out says, where the dialog's own *Cancel* would read like the action — *Batalkan
   * undangan* beside *Batal* (New Hires' *Jangan batalkan*; added by Phase 18.99 T6). The dialog's default when absent.
   */
  cancelLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}): { item: ActionMenuItem; row: ReactNode; dialog: ReactNode; ask: () => void } {
  const [asking, setAsking] = useState(false);
  const ask = () => { if (!disabled) setAsking(true); };
  return {
    ask,
    item: { label, tone: 'alert', disabled, onSelect: ask },
    row: <DestructiveRow label={label} onClick={ask} disabled={disabled} />,
    dialog: (
      <Dialog
        open={asking}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone="danger"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onConfirm();
        }}
      />
    ),
  };
}

/** The destructive item moved to the end of a menu's list, whatever order the screen built it in (UI-024: *last*). */
export function destructiveLast(items: readonly ActionMenuItem[]): ActionMenuItem[] {
  return [...items.filter((i) => i.tone !== 'alert'), ...items.filter((i) => i.tone === 'alert')];
}

/**
 * The red row at the foot of a sheet's choices (UI-083's role sheet: *"Keluarkan" last, red*), a divider above it,
 * 44px tall. It only asks: `useDestructiveAction`'s `row` opens the confirmation.
 */
export function DestructiveRow({
  label,
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('mt-2 border-t border-divider pt-2', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-11 w-full items-center rounded-row px-3 text-left text-md font-semibold text-signal-red hover:bg-pill-red disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}
