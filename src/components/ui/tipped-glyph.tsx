'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/field';
import { cn } from '@/lib/cn';

/** A glyph with nothing to act on: there, and plainly not live — at the prototype's 30% (`Overall.html:497`). */
export const INERT_GLYPH = 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-muted';

/** The page's side gutter on a phone: a bubble that opens toward the window's edge stops this far short of it. */
const GUTTER_PX = 16;

type Fit = { side: 'start' | 'end'; maxWidth: number };

/**
 * A glyph whose words show beside it — on hover, on focus and on a tap (ADR-0062 §2, form 2).
 *
 * Moved here from `leads-table.tsx` when a third screen needed it (P10.1-T6): the leads table's ✎ and
 * held 🗑, and the provenance marker beside the APE produced on the Summary and on Goal Settings.
 *
 * **A `title` shows to a mouse and to nobody else.** It never appears for a keyboard, and on a
 * phone — the agent's main device — there is no hover to ask for it. So the words are drawn: a
 * bubble **above** the glyph. Not below a table row, where the table's own scroll box would clip
 * the last row's; and not beside it, where it covered the ✓, ✕, 🗑 and ☎ of the same row and
 * swallowed the next tap on them (a regression found 2026-09-30, fixed the same day). Above, it
 * overlaps only the row above — or, on the first row, the header — and never the row being worked on.
 *
 * **Which way it opens.** `end`, the default, right-aligns the bubble to the glyph on one line: the
 * leads table's, whose glyphs sit at the end of a row. `fit` is for a glyph that can sit anywhere
 * across a card, as the marker beside a figure does: on showing, the bubble opens toward the side of
 * the window with more room and wraps inside it, so on a 375px phone it never runs off the screen.
 *
 * **The words can be hovered** (WCAG 1.4.13). A reader magnifying the screen moves the pointer onto
 * them to bring them into view, so the pointer is watched on the wrapper that holds the glyph and
 * the bubble both, the bubble takes the pointer, and a transparent strip bridges the 4px between
 * them. **A press on the bubble puts it away**, so a tap meant for what lies under it costs one tap,
 * never a stuck bubble. Escape puts it away wherever the focus is — a bubble brought up by the
 * pointer has no focus to listen on — and so do leaving both, looking away, and a press anywhere
 * else on the page, which is the only one of these a tap on an iPhone sends.
 *
 * `name` is what a screen reader says; `tip` is what the bubble says. When they are the same —
 * *Last changed by Ibu Sari* — the bubble is hidden from assistive technology rather than read
 * twice; when they differ — *Delete lead*, and why it is not available — the bubble is the button's
 * description.
 *
 * `unavailable` holds the button **focusable** and inert (`aria-disabled`), at the 30% the row's
 * other unavailable glyphs wear: a disabled button cannot be focused, and a reason nobody can
 * reach is not given.
 *
 * `face` paints the button as something other than a 28px glyph — the activation's *Auto* chip
 * (`Overall.html:6580`, P13-T4 AC-4), whose words are its face and whose tooltip says what it waits for.
 */
export function TippedGlyph({
  glyph,
  name,
  tip,
  unavailable = false,
  align = 'end',
  className,
  face,
}: {
  glyph: string;
  name: string;
  tip: string;
  unavailable?: boolean;
  align?: 'end' | 'fit';
  /** Where the glyph sits in its line — the wrapper's, never the bubble's. */
  className?: string;
  /** The button's own paint, merged over the glyph's. */
  face?: string;
}) {
  const [shown, setShown] = useState(false);
  const [fit, setFit] = useState<Fit | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const describes = tip !== name;

  useEffect(() => {
    if (!shown) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShown(false);
    };
    /*
     * A tap anywhere else puts it away. Safari on iOS does not focus a tapped button, so there is
     * no blur to do it, and a bubble brought up by a tap stayed up until the glyph was tapped again.
     */
    const elsewhere = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setShown(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', elsewhere);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', elsewhere);
    };
  }, [shown]);

  const show = () => {
    if (align === 'fit' && wrapper.current) {
      const box = wrapper.current.getBoundingClientRect();
      const width = window.innerWidth;
      const start = box.left + box.width / 2 <= width / 2;
      setFit({
        side: start ? 'start' : 'end',
        maxWidth: Math.max(0, (start ? width - box.left : box.right) - GUTTER_PX),
      });
    }
    setShown(true);
  };

  return (
    <span
      ref={wrapper}
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={() => setShown(false)}
    >
      <Button
        variant="icon"
        aria-disabled={unavailable || undefined}
        aria-describedby={describes ? tipId : undefined}
        className={cn(face, unavailable && INERT_GLYPH)}
        onFocus={show}
        onBlur={() => setShown(false)}
        onClick={show}
      >
        <span aria-hidden="true">{glyph}</span>
        <span className="sr-only">{name}</span>
      </Button>
      <span
        id={tipId}
        role="tooltip"
        aria-hidden={describes ? undefined : true}
        hidden={!shown}
        onPointerDown={() => setShown(false)}
        style={align === 'fit' && fit ? { maxWidth: fit.maxWidth } : undefined}
        className={cn(
          'absolute bottom-full z-10 mb-1',
          align === 'end' ? 'right-0 whitespace-nowrap' : 'w-max whitespace-normal text-left',
          align === 'fit' && (fit?.side === 'end' ? 'right-0' : 'left-0'),
          'rounded-sm bg-navy px-2 py-1 text-xs font-semibold text-white shadow-modal',
          // The bridge across the 4px gap, so the pointer can cross it without the bubble going.
          "before:absolute before:inset-x-0 before:top-full before:h-1 before:content-['']",
        )}
      >
        {tip}
      </span>
    </span>
  );
}
