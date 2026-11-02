'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { PlanIcon } from './plan-icons';

/**
 * **The first question still open in a brief, brought into view and focused** (UI V1, UI-107: *tapping it with something
 * missing scrolls to the first unanswered question*). A question is a group that says whether it is answered
 * (`data-question`, `data-answered` — `ChoiceGroup`, `MultiChoiceGroup`); it takes the focus, so a screen reader hears
 * which question it is, and is centred where the motion settings allow. Returns whether one was found.
 */
export function firstOpenQuestion(card: HTMLElement | null): boolean {
  const open = card?.querySelector<HTMLElement>('[data-question][data-answered="false"]');
  if (!open) return false;
  const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  open.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  open.focus({ preventScroll: true });
  return true;
}

/**
 * **A plan's one button: *Susun Attack Plan*, *Susun rencana recruitment*** (UI V1, UI-107; Mobile only).
 *
 * On a phone it sits right under the last question, in the flow — never pinned over the card — full width, a 52px orange
 * pill with navy words (text on the accent is navy, parity I-542) and an arrow, and it is **always active**: tapped with a
 * question open, its handler finds that question (`firstOpenQuestion`). From 768px it is the button as before, disabled
 * until the brief is whole. One button, its state by the width the screen answers (`usePhone`), so the tablet and the
 * desktop keep their behaviour exactly.
 */
export function PlanButton({ phone, complete, onClick, className, children }: {
  phone: boolean;
  complete: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      disabled={!complete && !phone}
      onClick={onClick}
      className={cn(
        className,
        'max-md:flex max-md:min-h-[3.25rem] max-md:w-full max-md:items-center max-md:justify-center max-md:gap-1.5',
        'max-md:rounded-pill max-md:text-lg max-md:font-bold',
      )}
    >
      {children}
      <PlanIcon name="arrowRight" className="h-[1.125rem] w-[1.125rem] md:hidden" />
    </Button>
  );
}
