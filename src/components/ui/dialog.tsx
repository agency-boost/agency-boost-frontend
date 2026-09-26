'use client';

import { useEffect, useRef } from 'react';
import { Button } from './field';

/**
 * *Are you sure?* — and nothing else.
 *
 * The prototype built this (`Overall.html:539-553`, markup `:4669-4677`) **instead of**
 * `window.confirm`, and the reason is in what native confirm does: it is the browser's chrome, not the
 * product's, it cannot be styled or read aloud in the page's own voice, its buttons say OK and Cancel
 * whatever the question was, and on a phone it arrives as a system sheet over the app. We shipped
 * `window.confirm` anyway on the leads screen, twice — so ours was the divergence, not the prototype's.
 *
 * **Confirmations only. There is no `children`.** A message, a Cancel and one confirming button. That
 * restriction is the component's whole design: parity I-21 and I-25 record two *forms* deliberately
 * moved out of modals and onto the page, and a `Dialog` with a content slot is exactly how somebody
 * puts them back without noticing they are undoing a decision.
 *
 * **Focus.** The confirming button takes focus on open, Escape and the backdrop both cancel, and focus
 * returns to whatever had it when the dialog closes — so a refused delete leaves you back on the row's
 * delete button rather than at the top of the page. Tab is trapped between the two buttons, because a
 * modal whose focus escapes into the page behind it is a modal only visually.
 */
export function Dialog({
  open,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  /** Says what will happen — *Delete lead*, *Discard counts* — never *OK*. */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for something that destroys, which the prototype paints quieter, not louder. */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement;
    confirm.current?.focus();
    return () => {
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const trap = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const [a, b] = e.shiftKey ? [confirm.current, cancel.current] : [cancel.current, confirm.current];
    if (document.activeElement === b) {
      a?.focus();
      e.preventDefault();
    }
  };

  return (
    // The backdrop cancels; a click inside the box must not, or dragging to select the message
    // dismisses the question you were reading.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/35 p-5"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={message}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trap}
        className="w-full max-w-[22.5rem] rounded-lg bg-card p-6 shadow-modal"
      >
        <p className="mb-4 text-md leading-relaxed text-navy">{message}</p>
        <div className="flex justify-end gap-2.5">
          <Button ref={cancel} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirm} variant={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
