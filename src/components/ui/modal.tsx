'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/lib/use-scroll-lock';

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
 *
 * **`placement="sheet"` is the same dialog anchored to the foot of the screen** (P18.95-T4, ADR-0167 §4):
 * the full width, its top corners rounded, at most 90% of the screen tall and scrolling inside, and clear
 * of the home indicator. A lead's edit sheet on a phone is the first; its manners are this one's.
 *
 * **Never taller than the screen, and its actions always in reach** (P18.96-T1 AC-2): at most the dynamic
 * viewport's height less its margin, the content scrolling inside it under a title that stays at the top and a
 * `footer` that stays at the foot; the page behind does not scroll while it is open (`useScrollLock`).
 *
 * **Drawn at the end of the page, not where it is opened** (P18.98-T4, 2026-10-29): through a portal into `<body>`, so its
 * `h2` never lands inside the page's outline — between a compliance tree's `h4`s it broke axe's *heading-order* in both
 * languages. React's tree is unchanged: its context, its events and a footer's `form={id}` reach it as before.
 */
/**
 * **Whether a node is inside an open `Modal`.** A modal is drawn at the end of `<body>`, so a popover that opened one
 * and closes on a click or a focus outside itself asks this as well: the modal is its own, over it, not outside it.
 */
export function inModal(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest('[data-modal-root]') !== null;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  initialFocus,
  focusDialog = false,
  eyebrow,
  placement = 'center',
  className,
  footer,
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
  /** `center`, the default, over the middle of the page; `sheet`, rising from its foot. */
  placement?: 'center' | 'sheet';
  className?: string;
  /**
   * **The actions at its foot** — *Cancel* and *Save* — held at the bottom of the box while the content above
   * them scrolls, so a long form never puts its *Save* out of reach. A form's submit button names its form
   * (`form={id}`), since the foot is outside it.
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useScrollLock(open);

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

  const sheet = placement === 'sheet';
  // The foot clears the home indicator on a phone that has one, and 1.5rem on one that does not.
  const footPadding = sheet ? 'pb-[max(1.5rem,env(safe-area-inset-bottom))]' : 'pb-6';

  return createPortal(
    <div
      data-modal-root=""
      data-placement={placement}
      className={cn(
        'fixed inset-0 z-50 flex justify-center bg-navy/35',
        sheet ? 'items-end' : 'items-center p-5',
      )}
      onClick={onClose}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trap}
        /*
          * **The box scrolls, and its title and its foot do not** (P18.96-T1 AC-2): no padding above or below the
          * box itself, so the sticky head and foot sit where they would sit anyway and only the content between
          * them moves. The dynamic viewport (`dvh`), so a phone's browser bar coming and going never puts the
          * foot under it; `overscroll-contain`, so reaching the end hands nothing on to the page.
          */
        className={cn(
          'w-full overflow-y-auto overscroll-contain bg-card px-6 shadow-modal',
          sheet ? 'max-h-[90dvh] rounded-t-lg' : 'max-h-[calc(100dvh-2.5rem)] max-w-[26rem] rounded-lg',
          !footer && footPadding,
          className,
        )}
      >
        {/*
          * The 1rem under the title is split: half the head's own, so content scrolled under it stops short of the
          * words, and half a margin, so content that reaches up into the gap as drawn (the MOC badge's `-mt-2`)
          * is not covered by the head where it rests.
          */}
        <div data-modal-head="" className="sticky top-0 z-10 -mx-6 bg-card px-6 pb-2 pt-6">
          {eyebrow}
          <h2 id={titleId} className="font-display text-lg font-bold text-navy">{title}</h2>
          {description && <p id={descriptionId} className="mt-1 text-md text-muted">{description}</p>}
        </div>
        <div className="mt-2">{children}</div>
        {footer && (
          <div data-modal-foot="" className={cn('sticky bottom-0 z-10 -mx-6 bg-card px-6 pt-4', footPadding)}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
