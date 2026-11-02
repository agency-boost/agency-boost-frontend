'use client';

import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';

/**
 * **A grey sentence's ⓘ, below 1024px** (P18.97-T4 AC-6, ADR-0176 §6; the client's grey-text table of 2026-10-27,
 * UI-027 — a verdict per size, *Mobile* · *Tablet* · *Desktop*). From 1024px the sentence stands where it always stood
 * (`SHOWN_FROM_DESKTOP` on it) and this is not drawn; below 1024px the sentence is not drawn and this ⓘ, beside its
 * subject, holds its words — on a tap, a focus or a hover, as every ⓘ's (`TippedGlyph`, ADR-0062 §2's second form).
 *
 * `onPhone` is the row's *Mobile* verdict: `tip`, the ⓘ below 768px as at 768–1023px; `remove`, nothing below 768px —
 * *"Linked items complete automatically."*. `PhoneTip` is ADR-0167 §7's sibling, for a row whose verdicts held below
 * 768px alone.
 *
 * `name` is what a screen reader says for the glyph, the sentence itself by default; the bubble says the sentence.
 */
export function BelowDesktopTip({
  text, name, onPhone = 'tip', className,
}: {
  text: string;
  name?: string;
  onPhone?: 'tip' | 'remove';
  className?: string;
}) {
  return (
    <TippedGlyph
      glyph="ⓘ"
      name={name ?? text}
      tip={text}
      align="fit"
      className={cn('lg:hidden', onPhone === 'remove' && 'max-md:hidden', className)}
    />
  );
}
