'use client';

import { Fragment } from 'react';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/i18n/language-provider';
import { termAt, termDefinition, termQuestion, type TermKey } from '@/lib/terms';

/**
 * **ⓘ beside a term, holding its one line** (P18.95-T9 AC-3; ADR-0167 §10, OD-205; UI-028).
 *
 * The ⓘ every other screen draws (`TippedGlyph`, ADR-0062 §2 form 2): its words on hover, on focus and on a tap,
 * named *What is APE?* for a screen reader, its bubble the definition from `lib/terms.ts`. Placed **after** the
 * term, once a screen, where it first appears; the screen decides where that is.
 *
 * It is a button, so it never goes inside another control: a product card that is one button, a column header
 * that sorts, a `<label>`. There the ⓘ goes beside the control instead, or on the next place the term appears.
 */
export function TermTip({ term, className }: { term: TermKey; className?: string }) {
  const language = useLanguage();
  return (
    <TippedGlyph
      glyph="ⓘ"
      name={termQuestion(term, language)}
      tip={termDefinition(term, language)}
      align="fit"
      className={cn('-my-1.5 align-middle', className)}
    />
  );
}

/**
 * **A sentence somebody else wrote, with an ⓘ after each term in `terms`** — an activity's label, a product's
 * benefit. `terms` is what the screen decided this sentence is the first to mention (`firstMentions`); a term
 * the sentence does not hold is passed over, and with none the text is returned as it is.
 */
export function TermText({ text, terms }: { text: string; terms: readonly TermKey[] }) {
  const cuts = terms
    .map((term) => ({ term, at: termAt(text, term) }))
    .filter((c): c is { term: TermKey; at: [number, number] } => c.at !== null)
    .sort((a, b) => a.at[1] - b.at[1]);
  if (cuts.length === 0) return <>{text}</>;

  let from = 0;
  return (
    <>
      {cuts.map(({ term, at: [, end] }) => {
        const piece = text.slice(from, end);
        from = end;
        return (
          <Fragment key={term}>
            {piece}
            {' '}
            <TermTip term={term} />
          </Fragment>
        );
      })}
      {text.slice(from)}
    </>
  );
}
