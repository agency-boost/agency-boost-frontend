'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A titled dialog with content of its own — the prototype's `.modal-box` (`Overall.html:4603-4629`).
 *
 * **Not `Dialog`.** `Dialog` is *are you sure?* and nothing else, by design: no content slot, so a form
 * moved out of a modal and onto its page cannot drift back into one unnoticed (parity I-21, I-25). This
 * is for the two things the coaching session must show over the page because the prototype does and a
 * requirement needs a place for them: the reason *Edit again* asks for (ADR-0079), and the Activity
 * card's drill, which the prototype opened as a browser pop-up (`Overall.html:10923-10953`).
 *
 * **Focus.** It moves into the box on open — to `initialFocus`, the box itself (`focusDialog`), or the
 * first control — stays there (Tab and Shift+Tab wrap), and goes back to whatever had it when the box
 * closes. Escape and the
 * backdrop close it; a click inside does not, so selecting text in it never dismisses it. Named by
 * its title, and by its description when it has one.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  initialFocus,
  focusDialog = false,
  eyebrow,
  className,
  children,
}: {
  open: boolean;
  title: string;
  /** A line under the title, read with it. */
  description?: string;
  /**
   * Something drawn **above** the title, as the calendar's detail draws its type badge over the entry's
   * title (`Calendar_Section.html:425-426`). Part of the dialog's content, not of its name.
   */
  eyebrow?: ReactNode;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * Start on the box itself, for a dialog that is read rather than filled in: a scrolling box that
   * starts on a control at its foot opens scrolled past its own title.
   */
  focusDialog?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement;
    const first = focusDialog ? box.current
      : initialFocus?.current ?? box.current?.querySelector<HTMLElement>(FOCUSABLE) ?? box.current;
    first?.focus();
    return () => {
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
    // Only as it opens: a re-render while it is open must not pull the focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const trap = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/35 p-5" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trap}
        className={cn('max-h-[calc(100vh-2.5rem)] w-full max-w-[26rem] overflow-y-auto rounded-lg bg-card p-6 shadow-modal', className)}
      >
        {eyebrow}
        <h2 id={titleId} className="font-display text-lg font-bold text-navy">{title}</h2>
        {description && <p id={descriptionId} className="mt-1 text-md text-muted">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
