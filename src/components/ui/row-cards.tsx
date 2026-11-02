import type { LiHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **A wide table's rows as cards, on a phone** — the pieces every card is drawn with (ADR-0167 §6, P18.95-T3; shared
 * since P18.97-T7 AC-1, ADR-0178 §4). The Unit Dashboard's roster drew them first; the Owner's wide tables —
 * `/kpm/analytics`' comparison, `/people/members`' directory, `/people/admins`' list and `/kpm/data-upload`'s month —
 * read them from here, so a card looks one way wherever a table becomes one.
 *
 * **Markup only**: no hook, no state, and no `'use client'`, so a screen of either kind can draw them. Which layout a
 * screen draws is its own question, asked of the window where it mounts (`usePhone`), never answered here.
 *
 * A card is the row in the row's own words (`components-and-patterns.md`, *Tables as cards*): the first line names
 * the row, its verdict follows, then **each value under its column's heading**, label above value, in a `<dl>`.
 */

/** The table's header in small capitals (`HEAD`), over each value on a card: label above value (ADR-0167 §6). */
export const CARD_LABEL = 'text-xs font-semibold uppercase tracking-wide text-muted';

/** A group's band (`GroupDivider`'s paint), as the heading of the lists under it. */
export function CardGroup({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <>
      <h3 className="border-b border-hairline bg-navy/[0.045] px-4 py-2.5 font-display text-base font-bold text-navy">
        {label}
        {count !== undefined && (
          <>
            {' '}
            <span className="ml-1.5 font-body font-semibold text-muted">· {count}</span>
          </>
        )}
      </h3>
      {children}
    </>
  );
}

/** One value on a card, under its label. */
export function CardField({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt className={CARD_LABEL}>{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/**
 * **The cards of one table**: a list in the table's own card — its border, its ground, its corners — named as the
 * table was (its caption, or the heading that named it), so a screen reader meets *Office roster*, a list of 25, where
 * it met a table of 25 rows.
 *
 * **Nothing in it is clipped**: a table's box scrolled and clipped, and its ⓘ bubbles opened below to stay inside it;
 * a card's open where they fit, over the cards around them. The first and last card take the list's corners instead.
 */
export function RowCards({
  label, labelledBy, children, className,
}: { label?: string; labelledBy?: string; children: ReactNode; className?: string }) {
  return (
    <ul
      role="list"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn('rounded-lg border border-card-edge bg-card', className)}
    >
      {children}
    </ul>
  );
}

/** One row as a card: the roster card's gutter and rule, the last one without its rule, the ends in the list's corners. */
export function RowCard({ children, className, ...item }: LiHTMLAttributes<HTMLLIElement> & { 'data-row'?: string }) {
  return (
    <li
      {...item}
      className={cn('border-b border-hairline px-4 py-3.5 first:rounded-t-lg last:rounded-b-lg last:border-b-0', className)}
    >
      {children}
    </li>
  );
}

/** A card's values, each label above its value, in a column. */
export function CardFields({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('mt-3 flex flex-col gap-2.5', className)}>{children}</dl>;
}
