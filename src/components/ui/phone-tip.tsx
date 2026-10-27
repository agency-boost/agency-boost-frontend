'use client';

import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';

/**
 * **The client's *ⓘ* verdict on a grey sentence: on a phone, the sentence moves into an ⓘ beside its subject**
 * (P18.95-T7 AC-1; ADR-0167 §7, OD-202 — the review's *Grey text* table). Below 768px the glyph is drawn and a tap,
 * a focus or a hover shows the words (`TippedGlyph`, ADR-0062 §2's second form); at 768px and wider it is not drawn,
 * and the sentence stands where it always stood (§12, OD-207). The sentence beside it takes `REMOVED_ON_PHONE`, so the
 * two never show together.
 *
 * Where the sentence has no place at 768px and wider — the goal's case size, whose 💡 tip ADR-0160 §4 removed — the ⓘ
 * is the only place it is, and only a phone has it.
 *
 * `name` is what a screen reader says for the glyph, the sentence itself by default; the bubble says the sentence.
 */
export function PhoneTip({ text, name, className }: { text: string; name?: string; className?: string }) {
  return (
    <TippedGlyph glyph="ⓘ" name={name ?? text} tip={text} align="fit" className={cn('md:hidden', className)} />
  );
}
