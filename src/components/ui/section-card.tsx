import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A card that is a **list**, not a padded box.
 *
 * The prototype's `.category-card` (`Overall.html:112-119`): a header band carrying the section's name
 * and a count pill, a hairline under it, and rows separated by hairlines with none after the last —
 * `overflow-hidden` so the rules meet the card's rounded corners instead of crossing them.
 *
 * **Why not `Card`.** `Card` is one `p-6` box, which is right for a form and wrong for twelve rows: the
 * activity log rendered its sections that way and a reader got a wall of labelled inputs with nothing
 * saying where one activity ended and the next began. A rule between rows is what makes a list
 * scannable, and a rule under the header is what separates *what this group is* from *what is in it*.
 *
 * Padding is `--space-4` / `--space-3` rather than the prototype's off-scale `14px 18px`: the spacing
 * scale is the source for every gap in this product (`tokens.md`), and snapping to it is what keeps a
 * card here the same height as a card anywhere else.
 */
export function SectionCard({
  title,
  meta,
  children,
  className,
}: {
  title: ReactNode;
  /** The right of the header band — a `{n} items` pill, a total. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-hairline bg-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h2 className="font-display text-md font-bold text-navy">{title}</h2>
        {meta}
      </header>
      {children}
    </section>
  );
}

/**
 * One row of a `SectionCard`: what it is on the left, the control on the right.
 *
 * **Centred, at the client's request** (2026-10-26, ADR-0161 §3; `prototype-parity.md`). The prototype
 * top-aligns (`:118`), for a left side that can run to two lines — a label with an italic sub-note. Topped, a
 * one-line row left its label at the top of a stepper-tall row with a blank band beneath it, which read as a
 * missing description; centred, the number, the words and the stepper share one middle with a sub-note or
 * without, as every settings row already does (I-92).
 */
export function SectionRow({
  children,
  control,
  className,
}: {
  children: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 last:border-b-0',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">{children}</div>
      {control}
    </div>
  );
}

SectionCard.Row = SectionRow;
